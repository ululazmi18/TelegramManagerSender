#!/bin/bash
# Script untuk mengelola semua service Telegram Campaign Manager
# Usage: bash manage-services.sh [start|stop|restart|status|logs]

BASEDIR="$(cd "$(dirname "$0")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to start all services
start_services() {
    echo -e "${BLUE}🚀 Starting all services...${NC}"
    echo ""
    
    # Kill existing screen sessions jika ada
    screen -S redis -X quit 2>/dev/null || true
    screen -S python-service -X quit 2>/dev/null || true
    screen -S backend -X quit 2>/dev/null || true
    screen -S frontend -X quit 2>/dev/null || true
    
    sleep 2
    
    # Start Redis (cek dulu apakah sudah berjalan sebagai systemd service)
    if systemctl is-active --quiet redis-server 2>/dev/null; then
        echo -e "${GREEN}✅ Redis already running (systemd service)${NC}"
    elif pgrep -x redis-server > /dev/null; then
        echo -e "${GREEN}✅ Redis already running${NC}"
    else
        echo -e "${BLUE}Starting Redis...${NC}"
        screen -dmS redis bash -c "cd '$BASEDIR' && redis-server '$BASEDIR/redis.conf' 2>&1; echo 'Redis exited. Press enter to close.'; read"
        sleep 2
    fi
    
    # Start Python Service
    echo -e "${BLUE}Starting Python Service...${NC}"
    screen -dmS python-service bash -c "cd '$BASEDIR/python-service' && source venv/bin/activate && python app.py 2>&1; echo 'Python service exited. Press enter to close.'; read"
    sleep 4
    
    # Start Backend
    echo -e "${BLUE}Starting Backend...${NC}"
    screen -dmS backend bash -c "cd '$BASEDIR/backend' && node server.js 2>&1; echo 'Backend exited. Press enter to close.'; read"
    sleep 3
    
    # Start Frontend
    echo -e "${BLUE}Starting Frontend...${NC}"
    screen -dmS frontend bash -c "cd '$BASEDIR/frontend' && npm start 2>&1; echo 'Frontend exited. Press enter to close.'; read"
    sleep 3
    
    echo ""
    echo -e "${GREEN}✅ All services started!${NC}"
    show_status
}

# Function to stop all services
stop_services() {
    echo -e "${YELLOW}🛑 Stopping all services...${NC}"
    echo ""
    
    # Stop Redis first (check if it's managed by us, not systemd)
    if ! systemctl is-active --quiet redis-server 2>/dev/null; then
        if pgrep -x redis-server > /dev/null; then
            echo -e "${BLUE}Stopping Redis...${NC}"
            if redis-cli shutdown 2>/dev/null; then
                echo -e "${GREEN}✅ Redis stopped${NC}"
            else
                pkill -f "redis-server" && echo -e "${GREEN}✅ Redis stopped${NC}"
            fi
        fi
    fi
    
    # Stop screen sessions
    screen -S redis -X quit 2>/dev/null
    screen -S python-service -X quit 2>/dev/null && echo -e "${GREEN}✅ Python Service stopped${NC}" || echo -e "${YELLOW}⚠️  Python Service not running${NC}"
    screen -S backend -X quit 2>/dev/null && echo -e "${GREEN}✅ Backend stopped${NC}" || echo -e "${YELLOW}⚠️  Backend not running${NC}"
    screen -S frontend -X quit 2>/dev/null && echo -e "${GREEN}✅ Frontend stopped${NC}" || echo -e "${YELLOW}⚠️  Frontend not running${NC}"
    
    echo ""
    echo -e "${GREEN}✅ All services stopped!${NC}"
}

# Function to restart all services
restart_services() {
    echo -e "${BLUE}🔄 Restarting all services...${NC}"
    stop_services
    sleep 2
    start_services
}

# Function to show status
show_status() {
    echo ""
    echo "========================================================"
    echo -e "${BLUE}📊 Service Status:${NC}"
    echo "========================================================"
    echo ""
    
    # Check Redis
    if screen -list | grep -q "redis"; then
        echo -e "  Redis:          ${GREEN}✅ Running${NC}"
    elif systemctl is-active --quiet redis-server 2>/dev/null; then
        echo -e "  Redis:          ${GREEN}✅ Running (systemd)${NC}"
    elif pgrep -x redis-server > /dev/null; then
        echo -e "  Redis:          ${GREEN}✅ Running${NC}"
    else
        echo -e "  Redis:          ${RED}❌ Stopped${NC}"
    fi
    
    # Check Python Service
    if screen -list | grep -q "python-service"; then
        echo -e "  Python Service: ${GREEN}✅ Running${NC}"
    else
        echo -e "  Python Service: ${RED}❌ Stopped${NC}"
    fi
    
    # Check Backend
    if screen -list | grep -q "backend"; then
        echo -e "  Backend:        ${GREEN}✅ Running${NC}"
    else
        echo -e "  Backend:        ${RED}❌ Stopped${NC}"
    fi
    
    # Check Frontend
    if screen -list | grep -q "frontend"; then
        echo -e "  Frontend:       ${GREEN}✅ Running${NC}"
    else
        echo -e "  Frontend:       ${RED}❌ Stopped${NC}"
    fi
    
    echo ""
    echo "========================================================"
    echo -e "${BLUE}🌐 Access URLs:${NC}"
    echo "========================================================"
    echo ""
    echo "  Main App:       http://localhost:3001"
    echo "  Network:        http://$(hostname -I | awk '{print $1}'):3001"
    echo ""
}

# Function to show logs menu
show_logs() {
    echo ""
    echo "========================================================"
    echo -e "${BLUE}📺 View Service Logs:${NC}"
    echo "========================================================"
    echo ""
    echo "  1. Redis"
    echo "  2. Python Service"
    echo "  3. Backend"
    echo "  4. Frontend"
    echo "  5. All (list screen sessions)"
    echo ""
    echo -e "${YELLOW}Tip: Tekan Ctrl+A lalu D untuk keluar dari screen${NC}"
    echo ""
    read -p "Pilih service (1-5): " choice
    
    case $choice in
        1)
            screen -r redis
            ;;
        2)
            screen -r python-service
            ;;
        3)
            screen -r backend
            ;;
        4)
            screen -r frontend
            ;;
        5)
            screen -ls
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            ;;
    esac
}

# Main script
case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "========================================================"
        echo -e "${BLUE}Telegram Campaign Manager - Service Manager${NC}"
        echo "========================================================"
        echo ""
        echo "Usage: bash manage-services.sh [command]"
        echo ""
        echo "Commands:"
        echo "  start    - Start all services"
        echo "  stop     - Stop all services"
        echo "  restart  - Restart all services"
        echo "  status   - Show service status"
        echo "  logs     - View service logs"
        echo ""
        echo "Example:"
        echo "  bash manage-services.sh start"
        echo "  bash manage-services.sh status"
        echo ""
        exit 1
        ;;
esac
