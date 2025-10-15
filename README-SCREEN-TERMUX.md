# Setup Telegram Campaign Manager untuk Termux

Panduan setup lengkap dengan auto-start semua service menggunakan screen di Termux.

## 🚀 Quick Setup (One Command)

```bash
bash setup-screen-termux.sh
```

Script ini akan:
1. ✅ Install semua dependencies (Node.js, Python, Redis, screen, dll)
2. ✅ Setup environment dan konfigurasi
3. ✅ Install semua package dependencies
4. ✅ **Otomatis menjalankan semua service di background**

Setelah selesai, aplikasi langsung bisa diakses!

## 📋 Requirements

- Termux (Android)
- Koneksi internet
- Storage permission (untuk akses file)

## 🎯 Cara Penggunaan

### 1. Install Termux

Download Termux dari:
- **F-Droid** (Recommended): https://f-droid.org/packages/com.termux/
- **GitHub**: https://github.com/termux/termux-app/releases

⚠️ **Jangan gunakan Termux dari Google Play Store** (sudah deprecated)

### 2. Setup Storage Permission

```bash
termux-setup-storage
```

Izinkan akses storage saat diminta.

### 3. Clone Repository

```bash
pkg install git -y
git clone https://github.com/ululazmi18/telegramManagerSender.git
cd telegramManagerSender
```

### 4. Jalankan Setup

```bash
bash setup-screen-termux.sh
```

Script akan:
- Install Node.js LTS
- Install Python 3 + virtualenv
- Install Redis
- Install screen
- Install semua dependencies
- Setup konfigurasi
- **Menjalankan semua service otomatis menggunakan screen**

### 5. Akses Aplikasi

Setelah setup selesai, aplikasi langsung bisa diakses:

**Lokal (di HP Termux):**
```
http://localhost:3001
```

**Dari perangkat lain (dalam jaringan Wi-Fi yang sama):**
```
http://[IP_TERMUX]:3001
```

Untuk cek IP Termux:
```bash
ip addr show wlan0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1
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
# Cek semua port
netstat -tulpn | grep -E '3000|3001|8000|6379'
```

### Termux mati saat layar off

Untuk mencegah Termux mati saat layar off:

1. **Acquire Wakelock:**
```bash
termux-wake-lock
```

2. **Disable Battery Optimization:**
   - Settings → Apps → Termux → Battery → Unrestricted

3. **Gunakan Termux:Boot (Opsional):**
   - Install Termux:Boot dari F-Droid
   - Auto-start service saat HP reboot

### Redis error di Termux

Jika Redis error dengan warning ARM64-COW-BUG, itu normal dan bisa diabaikan. Config sudah di-set untuk ignore warning tersebut.

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

## 💡 Tips Termux

### Keep Termux Running

1. **Wakelock:**
```bash
termux-wake-lock
```

2. **Release Wakelock:**
```bash
termux-wake-unlock
```

### Background Execution

Service akan tetap jalan di background menggunakan screen meskipun:
- ✅ Termux di-minimize
- ✅ Buka aplikasi lain
- ⚠️ Termux di-force stop (service akan mati)

### Akses dari Browser Lain

Untuk akses dari HP/laptop lain dalam jaringan Wi-Fi yang sama:

1. Cek IP Termux:
```bash
ip addr show wlan0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1
```

2. Buka di browser perangkat lain:
```
http://[IP_TERMUX]:3001
```

Contoh: `http://192.168.1.100:3001`

## 📊 Monitoring

### Cek resource usage

```bash
# Lihat process
top

# Lihat memory
free -h

# Lihat storage
df -h
```

### Cek service status

```bash
bash manage-services.sh status
```

## 🚀 Production Tips untuk Termux

1. **Gunakan Termux:Boot** untuk auto-start saat HP reboot
2. **Enable Wakelock** agar service tetap jalan
3. **Disable Battery Optimization** untuk Termux
4. **Regular backup** database dan konfigurasi
5. **Monitor logs** secara berkala
6. **Gunakan Wi-Fi stabil** untuk akses dari perangkat lain

## 📝 Catatan

- Semua service berjalan di background menggunakan screen
- Log service bisa dilihat dengan `screen -r [nama-session]`
- Service akan tetap jalan meskipun Termux di-minimize
- Jika HP di-restart, perlu jalankan ulang service
- Redis di Termux menggunakan config khusus (ignore ARM64-COW-BUG warning)

### Perbedaan dengan Setup Biasa

**Setup Biasa (`setup.sh`):**
- Perlu buka 4 terminal terpisah
- Manual start setiap service
- Lebih ribet untuk management

**Setup Screen (`setup-screen-termux.sh`):**
- ✅ One command setup
- ✅ Auto-start semua service
- ✅ Easy management dengan `manage-services.sh`
- ✅ Service jalan di background
- ✅ Bisa lihat log kapan saja dengan screen

## 🆘 Support

Jika ada masalah, buka issue di GitHub atau hubungi developer.

## 📄 License

MIT License

---

## 🔗 Links

- **Repository**: https://github.com/ululazmi18/telegramManagerSender
- **Termux**: https://termux.dev/
- **F-Droid Termux**: https://f-droid.org/packages/com.termux/
