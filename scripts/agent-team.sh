#!/bin/bash
set -e

# ==============================================================================
# Empire POS-ERP: Multi-Agent Team Orchestrator (agy + claude + codex + opencode)
# ==============================================================================

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"
PIDS_DIR="${WORKTREE_BASE}/pids"
LOGS_DIR="${WORKTREE_BASE}/logs"

mkdir -p "${PIDS_DIR}" "${LOGS_DIR}"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

CODEX_BIN="$(which codex || echo '/opt/homebrew/bin/codex')"
CLAUDE_BIN="$(which claude || echo '/opt/homebrew/bin/claude')"
OPENCODE_BIN="$(which opencode || echo '/Users/joelmorales/.opencode/bin/opencode')"
AGY_BIN="$(which agy || echo '/Users/joelmorales/.local/bin/agy')"

SUPPORTED_AGENTS=("codex" "claude" "opencode" "agy")
SUPPORTED_APPS=("backend" "admin" "pos")

validate_apps() {
    local apps_csv="$1"
    local app
    IFS=',' read -r -a requested_apps <<< "${apps_csv}"
    for app in "${requested_apps[@]}"; do
        case "${app}" in
            backend|admin|pos) ;;
            *)
                echo -e "${RED}Error: Unsupported app '${app}'. Use backend, admin, pos, or a comma-separated list.${NC}"
                exit 1
                ;;
        esac
    done
}

require_simple_feature_name() {
    local feature="$1"
    if [[ ! "${feature}" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
        echo -e "${RED}Error: Feature names must use lowercase letters, numbers, and hyphens (for example: sucursal-version).${NC}"
        exit 1
    fi
}

require_clean_tracked_tree() {
    if ! git diff --quiet || ! git diff --cached --quiet; then
        echo -e "${RED}Error: Commit or stash tracked changes before starting a feature lifecycle.${NC}"
        echo "Untracked files are allowed and will not be added automatically."
        exit 1
    fi
}

show_help() {
    echo -e "${BOLD}${CYAN}Empire POS-ERP Multi-Agent Team Orchestrator${NC}"
    echo "Usage: ./scripts/agent-team.sh [command] [args]"
    echo ""
    echo "Commands:"
    echo "  setup <work_prefix> [apps]         Create isolated worktrees (apps: backend,admin,pos)"
    echo "  feature-start <name> [apps]        Create/switch feat/<name> and work/<name>/<app> worktrees"
    echo "  feature-check [apps]               Check selected apps (defaults to all)"
    echo "  feature-finish <name> [apps]       Check and merge selected work/<name>/<app> branches"
    echo "  dispatch <agent> <app> <prompt>    Dispatch a coding agent to an app in the background"
    echo "  status                             Show status of active agents, PIDs, and latest logs"
    echo "  logs <agent>                       Tail real-time logs for a specific agent"
    echo "  check [backend|admin|pos|all]      Run PDCA verification gate for one or all apps"
    echo "  merge <feature_name>               Verify quality gates and merge feature branches into current branch"
    echo "  clean                              Terminate background agents and remove temporary worktrees"
    echo ""
    echo "Supported Apps:   backend (apps/sync_api), admin (apps/business_control_tauri), pos (apps/pos_flutter)"
    echo "Supported Agents: codex, claude, opencode, agy"
}

cmd_setup() {
    local feature="$1"
    local apps_csv="${2:-backend,admin,pos}"
    if [ -z "$feature" ]; then
        echo -e "${RED}Error: Feature name required (e.g. ./scripts/agent-team.sh setup 015-resumen-sucursal)${NC}"
        exit 1
    fi

    echo -e "${BOLD}${BLUE}==> Setting up isolated worktrees for feature: ${feature}${NC}"
    cd "${REPO_ROOT}"
    validate_apps "${apps_csv}"

    local apps=()
    IFS=',' read -r -a apps <<< "${apps_csv}"

    for app in "${apps[@]}"; do
        local branch="${feature}/${app}"
        local target_dir="${WORKTREE_BASE}/${app}"

        if [ -d "${target_dir}" ]; then
            local existing_branch
            existing_branch="$(git -C "${target_dir}" branch --show-current)"
            if [ "${existing_branch}" != "${branch}" ]; then
                echo -e "${RED}Error: ${target_dir} is already used by ${existing_branch}, not ${branch}.${NC}"
                echo "Run 'make team-clean' only after confirming no other feature uses these worktrees."
                exit 1
            fi
            echo -e "${YELLOW}  • Reusing worktree for ${app} at ${target_dir}${NC}"
        else
            if git show-ref --quiet "refs/heads/${branch}"; then
                echo -e "  • Reusing existing branch ${branch} -> ${target_dir}"
                git worktree add "${target_dir}" "${branch}"
            else
                echo -e "  • Creating branch ${branch} -> ${target_dir}"
                git worktree add -b "${branch}" "${target_dir}" HEAD
            fi
        fi

        # Ensure node_modules are symlinked so builds and compilers work without reinstalling
        if [ "$app" = "backend" ] && [ -d "${REPO_ROOT}/apps/sync_api/node_modules" ]; then
            ln -sfn "${REPO_ROOT}/apps/sync_api/node_modules" "${target_dir}/apps/sync_api/node_modules"
        elif [ "$app" = "admin" ] && [ -d "${REPO_ROOT}/apps/business_control_tauri/node_modules" ]; then
            ln -sfn "${REPO_ROOT}/apps/business_control_tauri/node_modules" "${target_dir}/apps/business_control_tauri/node_modules"
        fi
    done

    echo -e "${GREEN}✅ Worktrees ready in ${WORKTREE_BASE}/${NC}"
}

cmd_feature_start() {
    local feature="$1"
    local apps_csv="${2:-backend,admin,pos}"
    require_simple_feature_name "${feature}"
    validate_apps "${apps_csv}"
    cd "${REPO_ROOT}"
    require_clean_tracked_tree

    local integration_branch="feat/${feature}"
    local work_prefix="work/${feature}"

    if [ "$(git branch --show-current)" != "${integration_branch}" ]; then
        if git show-ref --verify --quiet "refs/heads/${integration_branch}"; then
            git switch "${integration_branch}"
        else
            git switch -c "${integration_branch}"
        fi
    fi

    echo -e "${GREEN}Integration branch: ${integration_branch}${NC}"
    echo -e "${GREEN}Agent worktree prefix: ${work_prefix}${NC}"
    cmd_setup "${work_prefix}" "${apps_csv}"
    echo ""
    echo "Next: declare the feature in .claude/workspaces.md, commit that declaration, then dispatch only the selected apps."
}

cmd_dispatch() {
    local agent="$1"
    local app="$2"
    local prompt="$3"

    if [ -z "$agent" ] || [ -z "$app" ] || [ -z "$prompt" ]; then
        echo -e "${RED}Error: Usage: dispatch <codex|claude|opencode|agy> <backend|admin|pos> \"<prompt>\"${NC}"
        exit 1
    fi

    local target_dir="${WORKTREE_BASE}/${app}"
    if [ ! -d "${target_dir}" ]; then
        target_dir="${REPO_ROOT}"
        echo -e "${YELLOW}Notice: Worktree for '${app}' not found; running in root repo directory: ${target_dir}${NC}"
    fi

    local timestamp
    timestamp="$(date +%Y%m%d_%H%M%S)"
    local logfile="${LOGS_DIR}/${agent}_${app}_${timestamp}.log"
    local pidfile="${PIDS_DIR}/${agent}.pid"

    echo -e "${BOLD}${CYAN}==> Dispatching ${agent} to ${app}...${NC}"
    echo "  Directory: ${target_dir}"
    echo "  Log:       ${logfile}"

    case "$agent" in
        codex)
            if [ ! -x "$CODEX_BIN" ]; then
                echo -e "${RED}Error: codex binary not found at $CODEX_BIN${NC}"
                exit 1
            fi
            (
                cd "${target_dir}"
                "$CODEX_BIN" exec "$prompt" > "${logfile}" 2>&1
            ) &
            ;;
        claude)
            if [ ! -x "$CLAUDE_BIN" ]; then
                echo -e "${RED}Error: claude binary not found at $CLAUDE_BIN${NC}"
                exit 1
            fi
            (
                cd "${target_dir}"
                "$CLAUDE_BIN" -p "$prompt" --permission-mode acceptEdits > "${logfile}" 2>&1
            ) &
            ;;
        opencode)
            if [ ! -x "$OPENCODE_BIN" ]; then
                echo -e "${RED}Error: opencode binary not found at $OPENCODE_BIN${NC}"
                exit 1
            fi
            (
                cd "${target_dir}"
                "$OPENCODE_BIN" run --dir "${target_dir}" --auto "$prompt" > "${logfile}" 2>&1
            ) &
            ;;
        agy)
            if [ ! -x "$AGY_BIN" ]; then
                echo -e "${RED}Error: agy binary not found at $AGY_BIN${NC}"
                exit 1
            fi
            (
                cd "${target_dir}"
                "$AGY_BIN" -p "$prompt" --dangerously-skip-permissions > "${logfile}" 2>&1
            ) &
            ;;
        *)
            echo -e "${RED}Unknown agent: ${agent}. Supported: codex, claude, opencode, agy${NC}"
            exit 1
            ;;
    esac

    local pid=$!
    echo "$pid" > "${pidfile}"
    echo "${app}|${logfile}" > "${PIDS_DIR}/${agent}.meta"
    echo -e "${GREEN}🚀 ${agent} running in background (PID: ${pid})${NC}"
    echo -e "   Follow logs with: ${CYAN}./scripts/agent-team.sh logs ${agent}${NC}"
}

cmd_status() {
    echo -e "${BOLD}${CYAN}==> Multi-Agent Team Status${NC}"
    local count=0

    for agent in "${SUPPORTED_AGENTS[@]}"; do
        local pidfile="${PIDS_DIR}/${agent}.pid"
        local metafile="${PIDS_DIR}/${agent}.meta"

        if [ -f "${pidfile}" ]; then
            count=$((count+1))
            local pid
            pid="$(cat "${pidfile}")"
            local app="unknown"
            local logfile=""
            if [ -f "${metafile}" ]; then
                IFS="|" read -r app logfile < "${metafile}"
            fi

            if kill -0 "${pid}" 2>/dev/null; then
                echo -e "  [$(printf '%s' "${agent}" | tr '[:lower:]' '[:upper:]')] App: ${BOLD}${app}${NC} | PID: ${pid} | Status: ${GREEN}${BOLD}RUNNING 🔄${NC}"
            else
                echo -e "  [$(printf '%s' "${agent}" | tr '[:lower:]' '[:upper:]')] App: ${BOLD}${app}${NC} | PID: ${pid} | Status: ${BLUE}${BOLD}FINISHED ✅${NC}"
            fi

            if [ -f "${logfile}" ]; then
                echo -e "    ${CYAN}Latest output (${logfile}):${NC}"
                tail -n 3 "${logfile}" | sed 's/^/      /'
            fi
            echo ""
        fi
    done

    if [ "$count" -eq 0 ]; then
        echo -e "  ${YELLOW}No background agents active.${NC}"
    fi
}

cmd_feature_check() {
    local apps_csv="${1:-backend,admin,pos}"
    validate_apps "${apps_csv}"
    local apps=()
    local app
    IFS=',' read -r -a apps <<< "${apps_csv}"
    for app in "${apps[@]}"; do
        cmd_check "${app}"
    done
}

cmd_feature_finish() {
    local feature="$1"
    local apps_csv="${2:-backend,admin,pos}"
    require_simple_feature_name "${feature}"
    validate_apps "${apps_csv}"
    cd "${REPO_ROOT}"

    local integration_branch="feat/${feature}"
    if [ "$(git branch --show-current)" != "${integration_branch}"; then
        echo -e "${RED}Error: feature-finish must run from ${integration_branch}.${NC}"
        exit 1
    fi

    cmd_feature_check "${apps_csv}"

    local apps=()
    local app
    IFS=',' read -r -a apps <<< "${apps_csv}"
    for app in "${apps[@]}"; do
        local branch="work/${feature}/${app}"
        if ! git show-ref --verify --quiet "refs/heads/${branch}"; then
            echo -e "${RED}Error: Expected agent branch ${branch} does not exist.${NC}"
            exit 1
        fi
        local worktree_dir="${WORKTREE_BASE}/${app}"
        if [ -d "${worktree_dir}" ] && [ "$(git -C "${worktree_dir}" branch --show-current)" = "${branch}" ] && [ -n "$(git -C "${worktree_dir}" status --porcelain)" ]; then
            echo -e "${RED}Error: ${branch} has uncommitted work in ${worktree_dir}.${NC}"
            echo "Ask the app agent to commit or discard its own changes before merging."
            exit 1
        fi
        git merge --no-ff "${branch}" -m "merge(${app}): integrate ${branch}"
    done

    echo -e "${GREEN}✅ Selected app branches are merged into ${integration_branch}.${NC}"
    echo "Review the combined diff, commit any shared docs/workspace update, push, then deploy explicitly."
    echo "Worktrees remain intact until you intentionally run 'make team-clean'."
}

cmd_logs() {
    local agent="$1"
    if [ -z "$agent" ]; then
        echo -e "${RED}Error: Specify agent name (e.g. ./scripts/agent-team.sh logs codex)${NC}"
        exit 1
    fi

    local metafile="${PIDS_DIR}/${agent}.meta"
    if [ ! -f "${metafile}" ]; then
        echo -e "${YELLOW}No recent metadata found for ${agent}.${NC}"
        exit 1
    fi

    IFS="|" read -r app logfile < "${metafile}"
    if [ ! -f "${logfile}" ]; then
        echo -e "${YELLOW}Logfile not found: ${logfile}${NC}"
        exit 1
    fi

    echo -e "${BOLD}${CYAN}==> Tailing logs for ${agent} (${app}): ${logfile}${NC}"
    tail -f "${logfile}"
}

cmd_check() {
    local target="${1:-all}"
    echo -e "${BOLD}${CYAN}==> Running PDCA Verification Gate: ${target}${NC}"

    local backend_ok=1
    local admin_ok=1
    local pos_ok=1

    if [ "$target" = "backend" ] || [ "$target" = "all" ]; then
        echo -n "  • Checking Backend API (sync_api)... "
        local dir="${REPO_ROOT}/apps/sync_api"
        if [ -d "${WORKTREE_BASE}/backend/apps/sync_api" ]; then
            dir="${WORKTREE_BASE}/backend/apps/sync_api"
        fi
        if (cd "${dir}" && npm run build) > /dev/null 2>&1; then
            echo -e "${GREEN}${BOLD}PASSED (build OK)${NC}"
            backend_ok=0
        else
            echo -e "${RED}${BOLD}FAILED${NC}"
        fi
    fi

    if [ "$target" = "admin" ] || [ "$target" = "all" ]; then
        echo -n "  • Checking Admin Web (business_control_tauri)... "
        local dir="${REPO_ROOT}/apps/business_control_tauri"
        if [ -d "${WORKTREE_BASE}/admin/apps/business_control_tauri" ]; then
            dir="${WORKTREE_BASE}/admin/apps/business_control_tauri"
        fi
        if (cd "${dir}" && npm run build) > /dev/null 2>&1; then
            echo -e "${GREEN}${BOLD}PASSED (tsc + vite OK)${NC}"
            admin_ok=0
        else
            echo -e "${RED}${BOLD}FAILED${NC}"
        fi
    fi

    if [ "$target" = "pos" ] || [ "$target" = "all" ]; then
        echo -n "  • Checking POS Flutter (pos_flutter)... "
        local dir="${REPO_ROOT}/apps/pos_flutter"
        if [ -d "${WORKTREE_BASE}/pos/apps/pos_flutter" ]; then
            dir="${WORKTREE_BASE}/pos/apps/pos_flutter"
        fi
        if (cd "${dir}" && flutter analyze --no-fatal-infos --no-fatal-warnings) > /dev/null 2>&1; then
            echo -e "${GREEN}${BOLD}PASSED (analyze OK)${NC}"
            pos_ok=0
        else
            echo -e "${RED}${BOLD}FAILED${NC}"
        fi
    fi

    if [ "$target" = "all" ]; then
        if [ "$backend_ok" -eq 0 ] && [ "$admin_ok" -eq 0 ] && [ "$pos_ok" -eq 0 ]; then
            echo -e "\n${GREEN}${BOLD}🎉 ALL QUALITY GATES PASSED! Ready to commit and merge.${NC}"
            return 0
        else
            echo -e "\n${RED}${BOLD}⚠️ Some quality gates failed. Review errors before merging.${NC}"
            return 1
        fi
    fi
}

cmd_merge() {
    local feature="$1"
    if [ -z "$feature" ]; then
        echo -e "${RED}Error: Feature name required (e.g. ./scripts/agent-team.sh merge 015-resumen-sucursal)${NC}"
        exit 1
    fi

    echo -e "${BOLD}${BLUE}==> Validating quality gates before merge for feature: ${feature}${NC}"
    if ! cmd_check all; then
        echo -e "${RED}❌ Aborting merge: quality gates must pass first.${NC}"
        exit 1
    fi

    local current_branch
    current_branch="$(git branch --show-current)"
    echo -e "${CYAN}Target branch for merge: ${BOLD}${current_branch}${NC}"

    for app in backend admin pos; do
        local branch="${feature}/${app}"
        if git show-ref --quiet "refs/heads/${branch}"; then
            echo -e "  • Merging ${branch} into ${current_branch}..."
            git merge --no-ff "${branch}" -m "merge(${app}): integrate ${branch} into ${current_branch}"
        fi
    done

    echo -e "${GREEN}✅ All app branches for ${feature} successfully merged into ${current_branch}!${NC}"
    echo -e "Cleaning up temporary worktrees..."
    cmd_clean
}

cmd_clean() {
    echo -e "${BOLD}${YELLOW}==> Cleaning up team sessions and worktrees...${NC}"
    cd "${REPO_ROOT}"

    for agent in "${SUPPORTED_AGENTS[@]}"; do
        local pidfile="${PIDS_DIR}/${agent}.pid"
        if [ -f "${pidfile}" ]; then
            local pid
            pid="$(cat "${pidfile}")"
            if kill -0 "${pid}" 2>/dev/null; then
                echo "  • Terminating ${agent} (PID: ${pid})..."
                kill -9 "${pid}" 2>/dev/null || true
            fi
            rm -f "${pidfile}" "${PIDS_DIR}/${agent}.meta"
        fi
    done

    if [ -d "${WORKTREE_BASE}" ]; then
        for app in backend admin pos; do
            local dir="${WORKTREE_BASE}/${app}"
            if [ -d "${dir}" ]; then
                echo "  • Removing worktree: ${dir}..."
                git worktree remove --force "${dir}" 2>/dev/null || true
            fi
        done
        rm -rf "${WORKTREE_BASE}"
    fi

    echo -e "${GREEN}✅ Cleanup complete.${NC}"
}

case "$1" in
    setup)
        cmd_setup "$2" "$3"
        ;;
    feature-start)
        cmd_feature_start "$2" "$3"
        ;;
    feature-check)
        cmd_feature_check "$2"
        ;;
    feature-finish)
        cmd_feature_finish "$2" "$3"
        ;;
    dispatch)
        cmd_dispatch "$2" "$3" "$4"
        ;;
    status)
        cmd_status
        ;;
    logs)
        cmd_logs "$2"
        ;;
    check)
        cmd_check "$2"
        ;;
    merge)
        cmd_merge "$2"
        ;;
    clean)
        cmd_clean
        ;;
    *)
        show_help
        ;;
esac
