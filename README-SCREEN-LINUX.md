# Setup Telegram Campaign Manager

Panduan setup lengkap dengan auto-start semua service menggunakan screen.

## 🚀 Quick Setup (One Command)

```bash
bash setup-screen-linux.sh
```

Script ini akan:
1. ✅ Install semua dependencies (Node.js, Python, Redis, dll)
2. ✅ Setup environment dan konfigurasi
3. ✅ Install semua package dependencies
4. ✅ **Otomatis menjalankan semua service di background**

Setelah selesai, aplikasi langsung bisa diakses!

## 📋 Requirements

- Linux dengan apt package manager
- User dengan sudo privileges
- Koneksi internet

## 🎯 Cara Penggunaan

### 1. Clone Repository

```bash
git clone https://github.com/ululazmi18/telegramManagerSender.git
cd telegramManagerSender
```

### 2. Jalankan Setup

```bash
bash setup-screen-linux.sh
```

Script akan:
- Install Node.js LTS
- Install Python 3 + virtualenv
- Install Redis
- Install semua dependencies
- Setup konfigurasi
- **Menjalankan semua service otomatis menggunakan screen**

### 3. Akses Aplikasi

Setelah setup selesai, aplikasi langsung bisa diakses:

**Lokal:**
```
http://localhost:3001
```

**Dari jaringan lain:**
```
http://[IP_ADDRESS]:3001
```

Untuk cek IP:
```bash
hostname -I
```

## 🛠️ Mengelola Service

Gunakan script `manage-services.sh` untuk mengelola semua service:

### Start Semua Service
```bash
bash manage-services.sh start
```

### Stop Semua Service
```bash
bash manage-services.sh stop
```

### Restart Semua Service
```bash
bash manage-services.sh restart
```

### Cek Status Service
```bash
bash manage-services.sh status
```

### Lihat Log Service
```bash
bash manage-services.sh logs
```

## 📺 Screen Sessions

Semua service berjalan di screen sessions terpisah:

- `redis` - Redis server
- `python-service` - Python/Flask service (Port 8000)
- `backend` - Node.js backend (Port 3000)
- `frontend` - React frontend (Port 3001)

### Melihat Log Service

```bash
# Lihat log Redis
screen -r redis

# Lihat log Python Service
screen -r python-service

# Lihat log Backend
screen -r backend

# Lihat log Frontend
screen -r frontend

# Lihat semua screen sessions
screen -ls
```

**Keluar dari screen tanpa stop service:** Tekan `Ctrl+A` lalu `D`

### Stop Service Manual

```bash
# Stop Redis
screen -S redis -X quit

# Stop Python Service
screen -S python-service -X quit

# Stop Backend
screen -S backend -X quit

# Stop Frontend
screen -S frontend -X quit
```

## ⚙️ Konfigurasi

Edit file `.env` untuk mengubah konfigurasi:

```bash
nano .env
```

Konfigurasi penting:
- `PORT` - Port backend (default: 3000)
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)
- `PYTHON_SERVICE_URL` - URL Python service (default: http://localhost:8000)
- `JWT_SECRET` - Secret key untuk JWT

Setelah edit `.env`, restart service:
```bash
bash manage-services.sh restart
```

## 🔧 Troubleshooting

### Service tidak jalan setelah setup

Cek status semua service:
```bash
bash manage-services.sh status
```

Lihat log untuk debug:
```bash
bash manage-services.sh logs
```

### Port sudah digunakan

Cek process yang menggunakan port:
```bash
# Cek port 3000 (Backend)
sudo lsof -i :3000

# Cek port 3001 (Frontend)
sudo lsof -i :3001

# Cek port 8000 (Python Service)
sudo lsof -i :8000

# Cek port 6379 (Redis)
sudo lsof -i :6379
```

Kill process jika perlu:
```bash
sudo kill -9 [PID]
```

### Redis error

Restart Redis:
```bash
sudo systemctl restart redis-server
```

Cek status Redis:
```bash
sudo systemctl status redis-server
```

### Python dependencies error

Reinstall Python dependencies:
```bash
cd python-service
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

### Node.js dependencies error

Reinstall Node.js dependencies:
```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

## 🔄 Update Aplikasi

```bash
# Pull update dari git
git pull

# Reinstall dependencies jika ada perubahan
cd backend && npm install
cd ../frontend && npm install
cd ../python-service && source venv/bin/activate && pip install -r requirements.txt && deactivate

# Restart service
bash manage-services.sh restart
```

## 🔐 Firewall (Opsional)

Jika ingin akses dari luar, buka port di firewall:

```bash
# UFW
sudo ufw allow 3001/tcp

# iptables
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
```

## 📊 Monitoring

### Cek resource usage

```bash
# CPU dan Memory
htop

# Disk usage
df -h

# Network
netstat -tulpn | grep -E '3000|3001|8000|6379'
```

## 🚀 Production Tips

1. **Gunakan reverse proxy (Nginx)** untuk production
2. **Setup SSL/TLS** untuk HTTPS
3. **Gunakan PM2** sebagai alternatif screen untuk production
4. **Setup auto-start** service saat server reboot
5. **Regular backup** database dan konfigurasi
6. **Monitor logs** secara berkala

## 📝 Catatan

- Semua service berjalan di background menggunakan screen
- Log service bisa dilihat dengan `screen -r [nama-session]`
- Service akan tetap jalan meskipun terminal ditutup
- Untuk production, disarankan menggunakan systemd atau PM2

### Redis Management

Script ini **otomatis mendeteksi** Redis yang sudah berjalan:

- ✅ Jika Redis sudah berjalan sebagai **systemd service**, script akan menggunakannya
- ✅ Jika Redis belum berjalan, script akan menjalankannya di **screen**
- ✅ Kompatibel dengan laptop yang sudah ada Redis systemd maupun yang belum

**Untuk meringankan laptop** (agar Redis hanya jalan saat diperlukan):

```bash
# Disable Redis systemd
sudo systemctl stop redis-server
sudo systemctl disable redis-server
```

Setelah itu, Redis hanya akan jalan di screen saat aplikasi dijalankan.

## 🆘 Support

Jika ada masalah, buka issue di GitHub atau hubungi developer.

## 📄 License

MIT License
