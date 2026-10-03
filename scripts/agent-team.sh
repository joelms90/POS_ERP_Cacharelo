#!/bin/bash
set -e

# ==============================================================================
# Empire POS-ERP: Multi-Agent Team Orchestrator (agy + codex + opencode)
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
OPENCODE_BIN="$(which opencode || echo '/Users/joelmorales/.opencode/bin/opencode')"

show_help() {
    echo -e "${BOLD}${CYAN}Empire POS-ERP Multi-Agent Team Orchestrator${NC}"
    echo "Usage: ./scripts/agent-team.sh [command] [args]"
    echo ""
    echo "Commands:"
    echo "  setup <feature_name>               Create isolated worktrees for backend, admin, and pos"
    echo "  dispatch <agent> <app> <prompt>    Dispatch codex or opencode to an app in the background"
    echo "  status                             Show status of active agents and their latest logs"
    echo "  check [backend|admin|pos|all]      Run PDCA verification gate for one or all apps"
    echo "  clean                              Terminate background agents and remove temporary worktrees"
    echo ""
    echo "Apps: backend (apps/sync_api), admin (apps/business_control_tauri), pos (apps/pos_flutter)"
    echo "Agents: codex, opencode"
}

cmd_setup() {
    local feature="$1"
    if [ -z "$feature" ]; then
        echo -e "${RED}Error: Feature name required (e.g. ./scripts/agent-team.sh setup 014-kds)${NC}"
        exit 1
    fi

    echo -e "${BOLD}${BLUE}==> Setting up worktrees for feature: ${feature}${NC}"
    cd "${REPO_ROOT}"

    declare -A APPS=( ["backend"]="apps/sync_api" ["admin"]="apps/business_control_tauri" ["pos"]="apps/pos_flutter" )

    for app in "${!APPS[@]}"; do
        local branch="${feature}/${app}"
        local target_dir="${WORKTREE_BASE}/${app}"

        if [ -d "${target_dir}" ]; then
            echo -e "${YELLOW}  • Worktree for ${app} already exists at ${target_dir}${NC}"
        else
            if git show-ref --quiet "refs/heads/${branch}"; then
                echo -e "  • Reusing branch ${branch} -> ${target_dir}"
                git worktree add "${target_dir}" "${branch}"
            else
                echo -e "  • Creating branch ${branch} -> ${target_dir}"
                git worktree add -b "${branch}" "${target_dir}" HEAD
            fi
        fi
    done

    echo -e "${GREEN}✅ Worktrees ready in ${WORKTREE_BASE}/${NC}"
}

cmd_dispatch() {
    local agent="$1"
    local app="$2"
    local prompt="$3"

    if [ -z "$agent" ] || [ -z "$app" ] || [ -z "$prompt" ]; then
        echo -e "${RED}Error: Usage: dispatch <codex|opencode> <backend|admin|pos> \"<prompt>\"${NC}"
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

    if [ "$agent" = "codex" ]; then
        if [ ! -x "$CODEX_BIN" ]; then
            echo -e "${RED}Error: codex binary not found at $CODEX_BIN${NC}"
            exit 1
        fi
        (
            cd "${target_dir}"
            "$CODEX_BIN" exec "$prompt" > "${logfile}" 2>&1
        ) &
        local pid=$!
        echo "$pid" > "${pidfile}"
        echo "${app}|${logfile}" > "${PIDS_DIR}/${agent}.meta"
        echo -e "${GREEN}🚀 Codex running in background (PID: ${pid})${NC}"

    elif [ "$agent" = "opencode" ]; then
        if [ ! -x "$OPENCODE_BIN" ]; then
            echo -e "${RED}Error: opencode binary not found at $OPENCODE_BIN${NC}"
            exit 1
        fi
        (
            "$OPENCODE_BIN" run --dir "${target_dir}" --auto "$prompt" > "${logfile}" 2>&1
        ) &
        local pid=$!
        echo "$pid" > "${pidfile}"
        echo "${app}|${logfile}" > "${PIDS_DIR}/${agent}.meta"
        echo -e "${GREEN}🚀 OpenCode running in background (PID: ${pid})${NC}"

    else
        echo -e "${RED}Unknown agent: ${agent}. Supported: codex, opencode${NC}"
        exit 1
    fi
}

cmd_status() {
    echo -e "${BOLD}${CYAN}==> Multi-Agent Team Status${NC}"
    local count=0

    for agent in codex opencode; do
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
                echo -e "  [${agent^^}] App: ${BOLD}${app}${NC} | PID: ${pid} | Status: ${GREEN}${BOLD}RUNNING 🔄${NC}"
            else
                echo -e "  [${agent^^}] App: ${BOLD}${app}${NC} | PID: ${pid} | Status: ${BLUE}${BOLD}FINISHED ✅${NC}"
            fi

            if [ -f "${logfile}" ]; then
                echo -e "    ${CYAN}Latest output:${NC}"
                tail -n 3 "${logfile}" | sed 's/^/      /'
            fi
            echo ""
        fi
    done

    if [ "$count" -eq 0 ]; then
        echo -e "  ${YELLOW}No background agents active.${NC}"
    fi
}

cmd_check() {
    local target="${1:-all}"
    echo -e "${BOLD}${CYAN}==> Running PDCA Verification Gate: ${target}${NC}"

    local backend_ok=1
    local admin_ok=1
    local pos_ok=1

    if [ "$target" = "backend" ] || [ "$target" = "all" ]; then
        echo -n "  • Checking Backend API (sync_api)... "
        if (cd "${REPO_ROOT}/apps/sync_api" && npm run build) > /dev/null 2>&1; then
            echo -e "${GREEN}${BOLD}PASSED (build OK)${NC}"
            backend_ok=0
        else
            echo -e "${RED}${BOLD}FAILED${NC}"
        fi
    fi

    if [ "$target" = "admin" ] || [ "$target" = "all" ]; then
        echo -n "  • Checking Admin Web (business_control_tauri)... "
        if (cd "${REPO_ROOT}/apps/business_control_tauri" && npm run build) > /dev/null 2>&1; then
            echo -e "${GREEN}${BOLD}PASSED (tsc + vite OK)${NC}"
            admin_ok=0
        else
            echo -e "${RED}${BOLD}FAILED${NC}"
        fi
    fi

    if [ "$target" = "pos" ] || [ "$target" = "all" ]; then
        echo -n "  • Checking POS Flutter (pos_flutter)... "
        if (cd "${REPO_ROOT}/apps/pos_flutter" && flutter analyze --no-fatal-infos --no-fatal-warnings) > /dev/null 2>&1; then
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

cmd_clean() {
    echo -e "${BOLD}${YELLOW}==> Cleaning up team sessions and worktrees...${NC}"
    cd "${REPO_ROOT}"

    for agent in codex opencode; do
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
        cmd_setup "$2"
        ;;
    dispatch)
        cmd_dispatch "$2" "$3" "$4"
        ;;
    status)
        cmd_status
        ;;
    check)
        cmd_check "$2"
        ;;
    clean)
        cmd_clean
        ;;
    *)
        show_help
        ;;
esac
