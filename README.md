# Telegram Campaign Manager

Aplikasi untuk mengelola kampanye pesan Telegram dengan antarmuka web yang modern.

## 🚀 Quick Start

Pilih panduan setup sesuai platform Anda:

### 📱 Untuk Termux (Android)

**Setup dengan Screen (Recommended):**
```bash
bash setup-screen-termux.sh
```

📖 **[Baca Panduan Lengkap Termux →](README-SCREEN-TERMUX.md)**

---

### 💻 Untuk Linux (Ubuntu/Debian)

**Setup dengan Screen (Recommended):**
```bash
bash setup-screen-linux.sh
```

📖 **[Baca Panduan Lengkap Linux →](README-SCREEN-LINUX.md)**

---

## 📚 Dokumentasi

- **[README-SCREEN-TERMUX.md](README-SCREEN-TERMUX.md)** - Panduan lengkap untuk Termux dengan auto-start menggunakan screen
- **[README-SCREEN-LINUX.md](README-SCREEN-LINUX.md)** - Panduan lengkap untuk Linux dengan auto-start menggunakan screen

## ✨ Fitur Utama

- ✅ **One-Command Setup** - Install dan jalankan semua dengan 1 perintah
- ✅ **Auto-Start Services** - Semua service otomatis jalan di background menggunakan screen
- ✅ **Easy Management** - Script untuk start/stop/restart/status semua service
- ✅ **Multi-Platform** - Support Termux (Android) dan Linux
- ✅ **Modern UI** - Interface web yang responsive dan user-friendly
- ✅ **Campaign Management** - Kelola kampanye pesan Telegram dengan mudah

## 🛠️ Teknologi

- **Frontend:** React.js + Bootstrap
- **Backend:** Node.js + Express
- **Python Service:** Flask + Pyrogram
- **Database:** SQLite
- **Queue:** Redis + BullMQ
- **Process Manager:** Screen

## 🎯 Manajemen Service

Setelah setup, gunakan script `manage-services.sh`:

```bash
# Start semua service
bash manage-services.sh start

# Stop semua service
bash manage-services.sh stop

# Restart semua service
bash manage-services.sh restart

# Cek status service
bash manage-services.sh status

# Lihat logs
bash manage-services.sh logs
```

## 🌐 Akses Aplikasi

Setelah service berjalan:

**Lokal:**
```
http://localhost:3001
```

**Dari jaringan lain:**
```
http://[IP_ADDRESS]:3001
```

## 📋 Requirements

### Termux
- Termux dari F-Droid (bukan Google Play Store)
- Storage permission
- Koneksi internet

### Linux
- Linux dengan apt package manager
- User dengan sudo privileges
- Koneksi internet

## 🔧 Troubleshooting

Jika ada masalah, lihat dokumentasi lengkap:
- [Troubleshooting Termux](README-SCREEN-TERMUX.md#-troubleshooting)
- [Troubleshooting Linux](README-SCREEN-LINUX.md#-troubleshooting)

Atau cek status service:
```bash
bash manage-services.sh status
bash manage-services.sh logs
```

## 📊 Service Architecture

```
┌─────────────────────────────────────────┐
│               Frontend (React)          │
│               Port: 3001                │
└─────────────────────┬───────────────────┘
                      │
┌─────────────────────▼───────────────────┐
│              Backend (Node.js)          │
│               Port: 3000                │
└────────┬───────────────────────┬────────┘
         │                       │
┌────────▼────────┐   ┌──────────▼───────┐
│ Python Service  │   │      Redis       │
│ Port: 8000      │   │   Port: 6379     │
└─────────────────┘   └──────────────────┘
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License

## 🔗 Links

- **Repository:** https://github.com/ululazmi18/telegramManagerSender
- **Issues:** https://github.com/ululazmi18/telegramManagerSender/issues

## 📞 Support

Jika ada pertanyaan atau masalah:
1. Cek dokumentasi yang sesuai (Termux/Linux)
2. Lihat troubleshooting guide
3. Buka issue di GitHub

---

**Made with ❤️ for Telegram Campaign Management**
# TelegramManagerSender
