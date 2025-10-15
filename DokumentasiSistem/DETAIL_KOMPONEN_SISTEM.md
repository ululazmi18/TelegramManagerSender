# Detail Komponen Sistem Telegram Manager

## 1. FRONTEND COMPONENTS

### 1.1 App.js (Main Application)
**Lokasi:** `frontend/src/App.js`
**Fungsi:** Entry point utama aplikasi React
**Koneksi:**
- Import semua komponen halaman
- Setup React Router untuk navigasi
- Render Navigation component
- Handle scroll to top saat route change

### 1.2 Navigation.js (Navigasi)
**Lokasi:** `frontend/src/components/Navigation.js`
**Fungsi:** Komponen navigasi responsive
**Koneksi:**
- Desktop: Top navbar dengan Bootstrap
- Mobile: Bottom navigation bar
- Link ke semua halaman utama
- Active state detection

### 1.3 Dashboard.js (Halaman Dashboard)
**Lokasi:** `frontend/src/components/Dashboard.js`
**API Calls:**
- `GET /api/dashboard/stats` - Ambil statistik
**Fungsi:**
- Tampilkan cards statistik (Projects, Sessions, Channels, Files)
- Auto-refresh setiap 30 detik
- Responsive layout (2 cards per row di mobile)

### 1.4 Projects.js (Manajemen Project)
**Lokasi:** `frontend/src/components/Projects.js`
**API Calls:**
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/run` - Run project
- `POST /api/projects/:id/stop` - Stop project
- `GET /api/projects/:id/logs` - View logs

### 1.5 Sessions.js (Manajemen Session)
**Lokasi:** `frontend/src/components/Sessions.js`
**API Calls:**
- `GET /api/sessions` - List sessions
- `POST /api/sessions/phone/send_code` - Login by phone
- `POST /api/sessions/phone/complete_auth` - Complete auth
- `POST /api/sessions/register_string` - Register session string
- `PUT /api/sessions/:id/update_data` - Update session
- `GET /api/sessions/:id/download` - Download session
- `DELETE /api/sessions/:id` - Delete session

## 2. BACKEND ROUTES

### 2.1 server.js (Main Server)
**Lokasi:** `backend/server.js`
**Fungsi:**
- Initialize Express app
- Setup middleware (CORS, bodyParser)
- Mount semua route handlers
- Initialize database
- Setup job queue worker
- Handle job completion events

### 2.2 projects.js (Project Routes)
**Lokasi:** `backend/routes/projects.js`
**Endpoints:**
- `GET /` - List all projects
- `POST /` - Create new project
- `PUT /:id` - Update project
- `DELETE /:id` - Delete project
- `POST /:id/run` - Run project (create jobs)
- `POST /:id/stop` - Stop project
- `GET /:id/logs` - Get project logs

### 2.3 sessions.js (Session Routes)
**Lokasi:** `backend/routes/sessions.js`
**Endpoints:**
- `GET /` - List sessions
- `POST /phone/send_code` - Send verification code
- `POST /phone/complete_auth` - Complete authentication
- `POST /register_string` - Register session string
- `PUT /:id/update_data` - Update session data
- `GET /:id/download` - Download session file
- `DELETE /:id` - Delete session

## 3. PYTHON SERVICE

### 3.1 app.py (Flask Service)
**Lokasi:** `python-service/app.py`
**Endpoints:**
- `POST /send_code` - Send Telegram verification code
- `POST /complete_auth` - Complete Telegram authentication
- `POST /validate_session` - Validate session string
- `POST /send_message` - Send message to channel
- `POST /get_me` - Get user info from session

## 4. DATABASE LAYER

### 4.1 db.js (Database Wrapper)
**Lokasi:** `backend/db.js`
**Fungsi:**
- SQLite database dengan SQL.js
- Database initialization
- Migration system
- Query wrapper methods (run, get, all)

## 5. JOB QUEUE

### 5.1 queue.js (Job Processing)
**Lokasi:** `backend/queue.js`
**Fungsi:**
- Bull queue untuk background jobs
- Message sending job processor
- Project status tracking
- Job completion handling
