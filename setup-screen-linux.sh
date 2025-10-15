#!/bin/bash
# Setup lengkap Telegram Campaign Manager dengan Screen Linux
# Otomatis install dependencies dan jalankan semua server
# Jalankan: bash setup-screen-linux.sh

set -e  # Exit on error

BASEDIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASEDIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setup Telegram Campaign Manager${NC}"
echo "========================================================"

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}⚠️  Jangan jalankan script ini sebagai root!${NC}"
    echo "Jalankan sebagai user biasa. Script akan meminta sudo password jika diperlukan."
    exit 1
fi

# 1. Update sistem dan install dependencies
echo ""
echo -e "${BLUE}📦 Step 1: Update sistem dan install dependencies...${NC}"
sudo apt update
sudo apt install -y curl wget git build-essential

# 2. Install Node.js (menggunakan NodeSource untuk versi LTS terbaru)
echo ""
echo -e "${BLUE}🟢 Step 2: Install Node.js LTS...${NC}"
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js sudah terinstall: $(node --version)"
fi

# 3. Install Python 3 dan pip
echo ""
echo -e "${BLUE}🐍 Step 3: Install Python 3 dan dependencies...${NC}"
sudo apt install -y python3 python3-pip python3-venv python3-dev

# 4. Install Redis
echo ""
echo -e "${BLUE}💾 Step 4: Install Redis...${NC}"
if ! command -v redis-server &> /dev/null; then
    echo "Installing Redis..."
    sudo apt install -y redis-server
    # Enable Redis service
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
    echo -e "${GREEN}✅ Redis installed and started${NC}"
else
    echo "Redis sudah terinstall"
    sudo systemctl start redis-server 2>/dev/null || true
fi

# 5. Install screen untuk menjalankan service di background
echo ""
echo -e "${BLUE}🖥️  Step 5: Install screen...${NC}"
sudo apt install -y screen

# 6. Install dependencies Python
echo ""
echo -e "${BLUE}🐍 Step 6: Install Python dependencies...${NC}"
cd "$BASEDIR/python-service"

# Buat dan aktifkan virtualenv
if [ ! -d "venv" ]; then
    echo "Membuat virtual environment..."
    python3 -m venv venv
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
if python3 -c "import pyrogram" 2>/dev/null; then
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

# 7. Install dependencies Node.js Backend
echo ""
echo -e "${BLUE}🟢 Step 7: Install Node.js Backend dependencies...${NC}"
cd "$BASEDIR/backend"
npm install

# 7.1. Install Web Terminal dependencies
echo ""
echo -e "${BLUE}🔧 Step 7.1: Install Web Terminal dependencies...${NC}"
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

# 8. Install dependencies Frontend
echo ""
echo -e "${BLUE}⚛️  Step 8: Install Frontend dependencies...${NC}"
cd "$BASEDIR/frontend"
npm install

# 9. Setup direktori
echo ""
echo -e "${BLUE}📁 Step 9: Setup directories...${NC}"
cd "$BASEDIR"
mkdir -p logs db uploads backend/uploads

# 10. Setup Web Terminal components
echo ""
echo -e "${BLUE}🔧 Step 10: Setup Web Terminal components...${NC}"

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

# 11. Buat Redis config
echo ""
echo -e "${BLUE}💾 Step 11: Setup Redis config...${NC}"
cat > "$BASEDIR/redis.conf" <<EOF
# Redis config
port 6379
bind 127.0.0.1
daemonize no
save ""
appendonly no
EOF
echo -e "${GREEN}✅ Redis config dibuat${NC}"

# 12. Copy .env jika belum ada
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

# 13. Jalankan semua service menggunakan screen
echo -e "${BLUE}🚀 Step 12: Menjalankan semua service...${NC}"
echo ""

# Kill existing screen sessions jika ada
screen -S redis -X quit 2>/dev/null || true
screen -S python-service -X quit 2>/dev/null || true
screen -S backend -X quit 2>/dev/null || true
screen -S frontend -X quit 2>/dev/null || true

sleep 2

# Start Redis
echo -e "${BLUE}Starting Redis...${NC}"
screen -dmS redis bash -c "cd '$BASEDIR' && redis-server '$BASEDIR/redis.conf'"
sleep 2

# Start Python Service
echo -e "${BLUE}Starting Python Service...${NC}"
screen -dmS python-service bash -c "cd '$BASEDIR/python-service' && source venv/bin/activate && python app.py"
sleep 3

# Start Backend
echo -e "${BLUE}Starting Backend...${NC}"
screen -dmS backend bash -c "cd '$BASEDIR/backend' && node server.js"
sleep 3

# Start Frontend
echo -e "${BLUE}Starting Frontend...${NC}"
screen -dmS frontend bash -c "cd '$BASEDIR/frontend' && npm start"
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
echo "  Network: http://$(hostname -I | awk '{print $1}'):3001"
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
echo "  screen -S redis -X quit"
echo "  screen -S python-service -X quit"
echo "  screen -S backend -X quit"
echo "  screen -S frontend -X quit"
echo ""
echo -e "${BLUE}📋 Lihat Semua Screen Session:${NC}"
echo ""
echo "  screen -ls"
echo ""
echo "========================================================"
echo -e "${GREEN}Setup dan deployment selesai! 🎉${NC}"
echo "========================================================"
