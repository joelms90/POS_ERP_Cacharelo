#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDS_DIR="${REPO_ROOT}/.dev-pids"
LOGS_DIR="${REPO_ROOT}/.dev-logs"

mkdir -p "${PIDS_DIR}" "${LOGS_DIR}"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Docker Desktop may be installed without its CLI plugin directory on PATH.
resolve_compose() {
    if docker compose version >/dev/null 2>&1; then
        COMPOSE=(docker compose)
    elif docker-compose version >/dev/null 2>&1; then
        COMPOSE=(docker-compose)
    elif [ -x /Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose ] &&
         /Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose version >/dev/null 2>&1; then
        COMPOSE=(/Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose)
    else
        echo "Docker Compose is unavailable. Start/install Docker Desktop and retry." >&2
        return 1
    fi
}

find_free_port() {
    local port=$1
    while lsof -nP -sTCP:LISTEN -iTCP:$port >/dev/null 2>&1; do
        port=$((port+1))
    done
    echo $port
}

is_port_our_backend() {
    local port=$1
    if curl -s "http://localhost:${port}/api/health" 2>/dev/null | grep -q "OK"; then
        return 0
    fi
    return 1
}

is_http_ok() {
    local url=$1
    curl -sf -o /dev/null -m 2 "${url}" 2>/dev/null
}

# Poll [url] until it returns a successful HTTP status (not a dev-server 404
# while the app is still compiling). Failure stops startup before success is reported.
wait_for_http() {
    local url=$1
    local name=$2
    local timeout=${3:-150}
    local waited=0

    until is_http_ok "${url}"; do
        if [ "${waited}" -ge "${timeout}" ]; then
            echo -e "  • ${YELLOW}${name} did not become ready at ${url} within ${timeout}s (see ${LOGS_DIR}).${NC}"
            return 1
        fi
        sleep 2
        waited=$((waited + 2))
    done
    return 0
}

cmd_start() {
    echo -e "${BOLD}${CYAN}=======================================================================${NC}"
    echo -e "${BOLD}${CYAN}          STARTING COMPLETE LOCAL DEVELOPMENT STACK                    ${NC}"
    echo -e "${BOLD}${CYAN}=======================================================================${NC}"

    resolve_compose

    # 1. Database
    echo -e "\n${BOLD}${BLUE}[1/4] Ensuring PostgreSQL Database is running...${NC}"
    cd "${REPO_ROOT}/apps/sync_api"
    if ! "${COMPOSE[@]}" ps --services --filter "status=running" 2>/dev/null | grep -qx "db"; then
        echo "  • Starting postgres container via docker compose..."
        "${COMPOSE[@]}" up -d db
        sleep 2
    else
        echo -e "  • ${GREEN}PostgreSQL container is already running on port 5432.${NC}"
    fi

    # 2. Backend Port Detection
    echo -e "\n${BOLD}${BLUE}[2/4] Setting up Backend API...${NC}"
    local backend_port=3000
    if is_port_our_backend 3000; then
        backend_port=3000
        echo -e "  • ${GREEN}Backend API is already running on port 3000.${NC}"
    elif is_port_our_backend 3001; then
        backend_port=3001
        echo -e "  • ${GREEN}Backend API is already running on port 3001.${NC}"
    else
        if lsof -nP -sTCP:LISTEN -iTCP:3000 >/dev/null 2>&1; then
            backend_port=3001
            echo -e "  • ${YELLOW}Port 3000 is busy by another app. Using port 3001.${NC}"
        fi
        echo "  • Starting NestJS backend on port ${backend_port}..."
        set -m
        (
            cd "${REPO_ROOT}/apps/sync_api"
            PORT=${backend_port} \
            NODE_ENV=development \
            ENABLE_GCP_INTEGRATIONS=false \
            DATABASE_URL="postgres://pos_user:pos_password@localhost:5432/pos_dev" \
            npm run dev </dev/null > "${LOGS_DIR}/backend.log" 2>&1
        ) &
        echo $! > "${PIDS_DIR}/backend.pid"
        set +m
        sleep 3
    fi
    wait_for_http "http://localhost:${backend_port}/api/health" "Backend API" 60

    # 3. Admin Web Dashboard
    echo -e "\n${BOLD}${BLUE}[3/4] Setting up Admin Dashboard (React/Vite)...${NC}"
    local admin_port=1420
    if lsof -nP -sTCP:LISTEN -iTCP:1420 >/dev/null 2>&1; then
        admin_port=1422
    fi
    if lsof -nP -sTCP:LISTEN -iTCP:${admin_port} >/dev/null 2>&1; then
        echo -e "  • ${GREEN}Admin Dashboard is already running on port ${admin_port}.${NC}"
    else
        echo "  • Starting Admin Dashboard on port ${admin_port}..."
        set -m
        (
            cd "${REPO_ROOT}/apps/business_control_tauri"
            VITE_API_URL="http://localhost:${backend_port}/api" npx vite --port ${admin_port} </dev/null > "${LOGS_DIR}/admin.log" 2>&1
        ) &
        echo $! > "${PIDS_DIR}/admin.pid"
        set +m
        sleep 2
    fi
    wait_for_http "http://localhost:${admin_port}/" "Admin Dashboard" 60

    # 4. Flutter Web POS
    echo -e "\n${BOLD}${BLUE}[4/4] Launching Flutter Web POS (Chrome)...${NC}"
    local flutter_port=8081
    if lsof -nP -sTCP:LISTEN -iTCP:${flutter_port} >/dev/null 2>&1; then
        echo -e "  • ${GREEN}Flutter Web is already running on port ${flutter_port}; waiting for it to become ready...${NC}"
    else
        echo "  • Launching Flutter POS in Chrome on port ${flutter_port}..."
        set -m
        (
            cd "${REPO_ROOT}/apps/pos_flutter"
            # Keep compiler state alive after a Paperclip heartbeat cleans its scratch directory.
            mkdir -p "${LOGS_DIR}/flutter-runtime"
            TMPDIR="${LOGS_DIR}/flutter-runtime" flutter run -d "${FLUTTER_DEVICE:-chrome}" --web-hostname=127.0.0.1 --web-port=${flutter_port} --dart-define=API_URL="http://localhost:${backend_port}/api" </dev/null > "${LOGS_DIR}/flutter.log" 2>&1
        ) &
        echo $! > "${PIDS_DIR}/flutter.pid"
        set +m
        echo "  • Compiling Flutter web app (first build can take ~30-90s)..."
    fi
    wait_for_http "http://localhost:${flutter_port}/" "Flutter Web POS" 180

    echo -e "\n${BOLD}${GREEN}=======================================================================${NC}"
    echo -e "${BOLD}${GREEN}           🎉 ALL LOCAL SERVICES OPERATIONAL!                          ${NC}"
    echo -e "${BOLD}${GREEN}=======================================================================${NC}"
    echo -e "  🔌 Backend API:      ${CYAN}http://localhost:${backend_port}/api${NC}"
    echo -e "  🖥️ Admin Dashboard:  ${CYAN}http://localhost:${admin_port}${NC}"
    echo -e "  📱 Flutter Web POS:  ${CYAN}http://localhost:${flutter_port}${NC}"
    echo -e "  🗄️ PostgreSQL DB:     ${CYAN}localhost:5432 (pos_dev)${NC}"
    echo -e "-----------------------------------------------------------------------"
    echo -e "Logs available at: ${LOGS_DIR}/"
    echo -e "To stop all services: ${BOLD}make dev-all-stop${NC}"
}

stop_service() {
    local svc="$1"
    local pidfile="${PIDS_DIR}/${svc}.pid"

    [ -f "${pidfile}" ] || return 0

    local pid
    pid="$(cat "${pidfile}" 2>/dev/null)"
    rm -f "${pidfile}"

    if [ -z "${pid}" ] || ! kill -0 "${pid}" 2>/dev/null; then
        return 0
    fi

    local pgid self_pgid
    pgid="$(ps -o pgid= -p "${pid}" 2>/dev/null | tr -d ' ')"
    self_pgid="$(ps -o pgid= -p "$$" 2>/dev/null | tr -d ' ')"

    echo "  • Terminating ${svc} (PID: ${pid}${pgid:+, PGID: ${pgid}})..."
    if [ -n "${pgid}" ] && [ "${pgid}" != "${self_pgid}" ]; then
        kill -TERM -- "-${pgid}" 2>/dev/null || true
    else
        kill -TERM "${pid}" 2>/dev/null || true
    fi

    local attempts=0
    while kill -0 "${pid}" 2>/dev/null && [ "${attempts}" -lt 10 ]; do
        sleep 0.3
        attempts=$((attempts + 1))
    done

    if kill -0 "${pid}" 2>/dev/null; then
        echo "    • Force killing ${svc}..."
        if [ -n "${pgid}" ] && [ "${pgid}" != "${self_pgid}" ]; then
            kill -KILL -- "-${pgid}" 2>/dev/null || true
        else
            kill -KILL "${pid}" 2>/dev/null || true
        fi
    fi
}

cmd_stop() {
    echo -e "${BOLD}${YELLOW}==> Stopping all local development services...${NC}"
    for svc in flutter admin backend; do
        stop_service "${svc}"
    done
    echo -e "${GREEN}✅ Local dev services stopped.${NC}"
}

cmd_status() {
    echo -e "${BOLD}${CYAN}==> Local Development Services Status${NC}"
    for port in 5432 3000 3001 1420 1422 8081 5180; do
        if lsof -nP -sTCP:LISTEN -iTCP:$port >/dev/null 2>&1; then
            local proc
            proc="$(lsof -nP -sTCP:LISTEN -iTCP:$port | awk 'NR==2 {print $1, "(PID:", $2 ")"}')"
            echo -e "  • Port ${BOLD}${port}${NC}: ${GREEN}ACTIVE 🟢${NC} - ${proc}"
        fi
    done
}

case "$1" in
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    status)
        cmd_status
        ;;
    *)
        echo "Usage: ./scripts/dev-all.sh [start|stop|status]"
        exit 1
        ;;
esac
