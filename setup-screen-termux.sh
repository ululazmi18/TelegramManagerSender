#!/bin/bash
# Setup lengkap Telegram Campaign Manager dengan Screen untuk Termux
# Otomatis install dependencies dan jalankan semua server
# Jalankan: bash setup-screen-termux.sh

set -e  # Exit on error

BASEDIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASEDIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setup Telegram Campaign Manager untuk Termux${NC}"
echo "========================================================"

# 1. Update dan install paket Termux yang diperlukan
echo ""
echo -e "${BLUE}📦 Step 1: Update dan install Termux packages...${NC}"
pkg update -y
pkg upgrade -y
pkg install -y python nodejs-lts redis make clang openssh iproute2 net-tools curl tar bash gzip wget which git screen

echo -e "${GREEN}✅ Termux packages installed${NC}"

# 2. Install dependencies Python
echo ""
echo -e "${BLUE}🐍 Step 2: Install Python dependencies...${NC}"
cd "$BASEDIR/python-service"

# Buat dan aktifkan virtualenv
if [ ! -d "venv" ]; then
    echo "Membuat virtual environment..."
    python -m venv venv
fi
source "venv/bin/activate"

pip install --upgrade pip

# Uninstall package lama yang conflict
echo "Cleaning old packages..."
pip uninstall -y fastapi uvicorn pydantic starlette 2>/dev/null || true

# Install Flask dependencies
echo "Installing Flask dependencies..."
pip install --no-cache-dir -r requirements.txt
echo -e "${GREEN}✅ Flask dependencies installed successfully${NC}"

# Install pyrogram for Telegram integration
echo "Installing pyrogram for terminal integration..."
if python -c "import pyrogram" 2>/dev/null; then
    echo -e "${GREEN}✅ Pyrogram already installed${NC}"
else
    pip install pyrogram
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Pyrogram installed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to install pyrogram${NC}"
        exit 1
    fi
fi

# Nonaktifkan venv setelah selesai step Python
deactivate 2>/dev/null || true

# 3. Install dependencies Node.js Backend
echo ""
echo -e "${BLUE}🟢 Step 3: Install Node.js Backend dependencies...${NC}"
cd "$BASEDIR/backend"
npm install

# 3.1. Install Web Terminal dependencies
echo ""
echo -e "${BLUE}🔧 Step 3.1: Install Web Terminal dependencies...${NC}"
# Check if ws and node-pty are already installed
if npm list ws node-pty >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Terminal dependencies already installed${NC}"
else
    echo -e "${YELLOW}Installing ws and node-pty...${NC}"
    npm install ws node-pty
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Terminal dependencies installed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to install terminal dependencies${NC}"
        exit 1
    fi
fi

# 4. Install dependencies Frontend
echo ""
echo -e "${BLUE}🔩  Step 4: Install Frontend dependencies...${NC}"
cd "$BASEDIR/frontend"
npm install

# 5. Setup direktori
echo ""
echo -e "${BLUE}📁 Step 5: Setup directories...${NC}"
cd "$BASEDIR"
mkdir -p logs db uploads backend/uploads

# 6. Setup Web Terminal components
echo ""
echo -e "${BLUE}🔧 Step 6: Setup Web Terminal components...${NC}"

# Check login_dasar.py
if [ ! -f "$BASEDIR/login_dasar.py" ]; then
    echo -e "${YELLOW}Creating login_dasar.py...${NC}"
    cat > "$BASEDIR/login_dasar.py" << 'EOF'
import asyncio
from pyrogram import Client

api_id = 20233450
api_hash = "f32bc9aff34316b554bce7796e4c4738"

phone_number = ""

async def main():
    app = Client('my_account', api_id=api_id, api_hash=api_hash, in_memory=True)
    await app.start()
    
    session_string = await app.export_session_string()
    print("Session String:", session_string)
    me = await app.get_me()
    print(me)
    await app.stop()

if __name__ == "__main__":
    asyncio.run(main())
EOF
    echo -e "${GREEN}✅ login_dasar.py created${NC}"
else
    echo -e "${GREEN}✅ login_dasar.py already exists${NC}"
fi

# Check if terminal-server.js exists
if [ ! -f "$BASEDIR/backend/terminal-server.js" ]; then
    echo -e "${YELLOW}⚠️  terminal-server.js not found - Web Terminal may not work${NC}"
else
    echo -e "${GREEN}✅ terminal-server.js found${NC}"
fi

# Check if Terminal.js component exists
if [ ! -f "$BASEDIR/frontend/src/components/Terminal.js" ]; then
    echo -e "${YELLOW}⚠️  Terminal.js component not found - Web Terminal may not work${NC}"
else
    echo -e "${GREEN}✅ Terminal.js component found${NC}"
fi

# 7. Buat Redis config untuk Termux
echo ""
echo -e "${BLUE}💾 Step 7: Setup Redis config...${NC}"
cat > "$BASEDIR/redis.conf" <<EOF
# Redis config untuk Termux
port 6379
bind 127.0.0.1
daemonize no
ignore-warnings ARM64-COW-BUG
save ""
appendonly no
EOF
echo -e "${GREEN}✅ Redis config dibuat${NC}"

# 8. Copy .env jika belum ada
if [ ! -f "$BASEDIR/.env" ]; then
    if [ -f "$BASEDIR/.env.example" ]; then
        echo ""
        echo -e "${BLUE}📝 Copy .env.example ke .env${NC}"
        cp "$BASEDIR/.env.example" "$BASEDIR/.env"
    fi
fi

echo ""
echo "========================================================"
echo -e "${GREEN}✅ Setup selesai!${NC}"
echo "========================================================"
echo ""

# 9. Jalankan semua service menggunakan screen
echo -e "${BLUE}🚀 Step 8: Menjalankan semua service...${NC}"
echo ""

# Kill existing screen sessions jika ada
screen -S redis -X quit 2>/dev/null || true
screen -S python-service -X quit 2>/dev/null || true
screen -S backend -X quit 2>/dev/null || true
screen -S frontend -X quit 2>/dev/null || true

sleep 2

# Start Redis
echo -e "${BLUE}Starting Redis...${NC}"
screen -dmS redis bash -c "cd '$BASEDIR' && redis-server '$BASEDIR/redis.conf' 2>&1; echo 'Redis exited. Press enter to close.'; read"
sleep 2

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
echo "========================================================"
echo -e "${GREEN}✅ Semua service berhasil dijalankan!${NC}"
echo "========================================================"
echo ""
echo -e "${BLUE}📋 Informasi Service:${NC}"
echo ""
echo "  • Redis         : Running in screen session 'redis'"
echo "  • Python Service: Running in screen session 'python-service' (Port 8000)"
echo "  • Backend       : Running in screen session 'backend' (Port 3000)"
echo "  • Frontend      : Running in screen session 'frontend' (Port 3001)"
echo ""
echo -e "${BLUE}🌐 Akses Aplikasi:${NC}"
echo ""
echo "  Local:  http://localhost:3001"
echo "  Network: http://$(ip addr show wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1 || echo '[IP_ANDA]'):3001"
echo ""
echo -e "${BLUE}🔧 Web Terminal Features:${NC}"
echo ""
echo "  • Real-time terminal emulator in browser"
echo "  • Interactive Telegram login process"
echo "  • Auto-save session string to database"
echo "  • Seamless integration with existing app"
echo ""
echo "  💡 Go to Sessions and click '🔐 Create Session String' to use terminal"
echo ""
echo -e "${BLUE}📺 Melihat Log Service:${NC}"
echo ""
echo "  screen -r redis           # Lihat log Redis"
echo "  screen -r python-service  # Lihat log Python Service"
echo "  screen -r backend         # Lihat log Backend"
echo "  screen -r frontend        # Lihat log Frontend"
echo ""
echo -e "${YELLOW}  Tekan Ctrl+A lalu D untuk keluar dari screen tanpa stop service${NC}"
echo ""
echo -e "${BLUE}🛑 Stop Semua Service:${NC}"
echo ""
echo "  bash manage-services.sh stop"
echo ""
echo "  Atau manual:"
echo "  screen -S redis -X quit"
echo "  screen -S python-service -X quit"
echo "  screen -S backend -X quit"
echo "  screen -S frontend -X quit"
echo ""
echo -e "${BLUE}📋 Lihat Semua Screen Session:${NC}"
echo ""
echo "  screen -ls"
echo ""
echo -e "${BLUE}💡 Manajemen Service:${NC}"
echo ""
echo "  Gunakan script manage-services.sh untuk kemudahan:"
echo "  bash manage-services.sh start    # Start semua service"
echo "  bash manage-services.sh stop     # Stop semua service"
echo "  bash manage-services.sh restart  # Restart semua service"
echo "  bash manage-services.sh status   # Cek status"
echo "  bash manage-services.sh logs     # Lihat logs"
echo ""
echo "========================================================"
echo -e "${GREEN}Setup dan deployment selesai! 🎉${NC}"
echo "========================================================"
