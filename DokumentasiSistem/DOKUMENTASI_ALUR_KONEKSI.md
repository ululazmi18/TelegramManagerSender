# Dokumentasi Alur Koneksi Telegram Manager

## 1. ARSITEKTUR SISTEM

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FRONTEND      │    │    BACKEND      │    │ PYTHON SERVICE  │
│   (React)       │◄──►│   (Node.js)     │◄──►│    (Flask)      │
│   Port: 3001    │    │   Port: 3000    │    │   Port: 5000    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   BROWSER       │    │   DATABASE      │    │   TELEGRAM      │
│   (User UI)     │    │   (SQLite)      │    │     API         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 2. STARTUP SEQUENCE (Urutan Load Awal)

### 2.1 Frontend Startup
```
1. index.js (Entry Point)
   ├── ReactDOM.createRoot()
   ├── Render <App />
   └── Mount ke DOM element 'root'

2. App.js (Main Application)
   ├── Import semua komponen
   ├── Setup Router (BrowserRouter)
   ├── Setup Navigation
   ├── Setup Routes:
   │   ├── "/" → Dashboard
   │   ├── "/projects" → Projects
   │   ├── "/sessions" → Sessions
   │   ├── "/channels" → Channels
   │   └── "/files" → Files
   └── ScrollToTop handler

3. setupProxy.js (Development Proxy)
   ├── Proxy /api → http://localhost:3000
   └── Proxy /internal → http://localhost:3000
```

### 2.2 Backend Startup
```
1. server.js (Entry Point)
   ├── Load environment variables (.env)
   ├── Initialize Express app
   ├── Setup middleware (CORS, bodyParser)
   ├── Mount route handlers:
   │   ├── /api/sessions → sessionRoutes
   │   ├── /api/credentials → credentialRoutes
   │   ├── /api/channels → channelRoutes
   │   ├── /api/categories → categoryRoutes
   │   ├── /api/files → fileRoutes
   │   ├── /api/projects → projectRoutes
   │   ├── /api/dashboard → dashboardRoutes
   │   └── /internal → internalRoutes
   ├── Initialize database (db.initDB())
   ├── Setup job queue worker
   └── Start server on port 3000

2. db.js (Database Initialization)
   ├── Check if database exists
   ├── Create SQLite database if not exists
   ├── Run migrations
   └── Setup database connection
```

### 2.3 Python Service Startup
```
1. app.py (Flask Service)
   ├── Initialize Flask app
   ├── Setup CORS
   ├── Setup logging
   ├── Initialize authentication sessions
   └── Start Flask server on port 5000
```

## 3. STRUKTUR FILE DAN KONEKSI

### 3.1 Frontend Structure
```
frontend/
├── public/
│   ├── index.html (HTML template)
│   └── favicon.ico
├── src/
│   ├── index.js (Entry point)
│   ├── App.js (Main app component)
│   ├── App.css (Global styles)
│   ├── index.css (Base styles)
│   ├── setupProxy.js (Dev proxy config)
│   └── components/
│       ├── Navigation.js (Top/Mobile nav)
│       ├── Navigation.css (Nav styles)
│       ├── Dashboard.js (Dashboard page)
│       ├── Projects.js (Projects management)
│       ├── Sessions.js (Telegram sessions)
│       ├── Channels.js (Channel management)
│       └── Files.js (File management)
├── package.json (Dependencies)
└── package-lock.json
```

### 3.2 Backend Structure
```
backend/
├── server.js (Main server)
├── db.js (Database layer)
├── db-fallback.js (Fallback DB)
├── queue.js (Job queue system)
├── routes/ (API endpoints)
│   ├── sessions.js (Session management)
│   ├── credentials.js (API credentials)
│   ├── channels.js (Channel CRUD)
│   ├── categories.js (Category management)
│   ├── files.js (File operations)
│   ├── projects.js (Project management)
│   ├── projectTargets.js (Project targets)
│   ├── projectSessions.js (Project sessions)
│   ├── projectMessages.js (Project messages)
│   ├── delays.js (Delay settings)
│   ├── internal.js (Internal API)
│   └── dashboard.js (Dashboard data)
├── utils/ (Utility functions)
├── package.json
└── package-lock.json
```

### 3.3 Python Service Structure
```
python-service/
├── app.py (Flask service)
├── requirements.txt (Python deps)
├── telegram_service.log (Logs)
└── venv/ (Virtual environment)
```

## 4. ALUR NAVIGASI HALAMAN

### 4.1 Navigation Component (Navigation.js)
```javascript
// Komponen navigasi yang mengatur routing
const Navigation = () => {
  const location = useLocation();
  
  // Desktop navbar (≥992px)
  <Navbar className="navbar-custom sticky-top">
    <Nav.Link as={Link} to="/">Dashboard</Nav.Link>
    <Nav.Link as={Link} to="/projects">Projects</Nav.Link>
    <Nav.Link as={Link} to="/sessions">Sessions</Nav.Link>
    <Nav.Link as={Link} to="/channels">Channels</Nav.Link>
    <Nav.Link as={Link} to="/files">Files</Nav.Link>
  </Navbar>
  
  // Mobile navbar (<992px)
  <div className="mobile-nav">
    // Same links but in bottom navigation
  </div>
}
```

### 4.2 Route Mapping (App.js)
```javascript
<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/projects" element={<Projects />} />
  <Route path="/sessions" element={<Sessions />} />
  <Route path="/channels" element={<Channels />} />
  <Route path="/files" element={<Files />} />
</Routes>
```

## 5. KONEKSI FRONTEND-BACKEND

### 5.1 API Call Pattern
```javascript
// Semua komponen menggunakan pattern ini:
const fetchData = async () => {
  try {
    const response = await fetch('/api/endpoint');
    const data = await response.json();
    setData(data);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### 5.2 Proxy Configuration (setupProxy.js)
```javascript
// Development proxy untuk menghubungkan frontend ke backend
module.exports = function(app) {
  app.use('/api', createProxyMiddleware({
    target: 'http://localhost:3000', // Backend server
    changeOrigin: true,
  }));
  
  app.use('/internal', createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true,
  }));
};
```

## 6. DETAIL SETIAP HALAMAN

### 6.1 Dashboard (/)
**File:** `frontend/src/components/Dashboard.js`
**Backend:** `backend/routes/dashboard.js`

**Alur Koneksi:**
```
1. Dashboard.js loads
2. useEffect() calls fetchStats()
3. GET /api/dashboard/stats
4. dashboard.js processes request
5. Queries database for:
   - Projects count (total, running, stopped)
   - Sessions count
   - Channels count  
   - Files count and total size
6. Returns aggregated statistics
7. Dashboard displays stats cards
```

**API Endpoints:**
- `GET /api/dashboard/stats` - Statistik dashboard

### 6.2 Projects (/projects)
**File:** `frontend/src/components/Projects.js`
**Backend:** `backend/routes/projects.js`

**Alur Koneksi:**
```
1. Projects.js loads
2. useEffect() calls fetchProjects()
3. GET /api/projects
4. projects.js returns all projects
5. Component displays projects table
6. User actions trigger:
   - Create: POST /api/projects
   - Edit: PUT /api/projects/:id
   - Delete: DELETE /api/projects/:id
   - Run: POST /api/projects/:id/run
   - Stop: POST /api/projects/:id/stop
   - Logs: GET /api/projects/:id/logs
```

**API Endpoints:**
- `GET /api/projects` - List semua projects
- `POST /api/projects` - Buat project baru
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Hapus project
- `POST /api/projects/:id/run` - Jalankan project
- `POST /api/projects/:id/stop` - Stop project
- `GET /api/projects/:id/logs` - Ambil logs project

### 6.3 Sessions (/sessions)
**File:** `frontend/src/components/Sessions.js`
**Backend:** `backend/routes/sessions.js`

**Alur Koneksi:**
```
1. Sessions.js loads
2. fetchSessions() calls GET /api/sessions
3. Component displays sessions table
4. User actions:
   - Login by phone: POST /api/sessions/phone/send_code
   - Complete auth: POST /api/sessions/phone/complete_auth
   - Register string: POST /api/sessions/register_string
   - Update: PUT /api/sessions/:id/update_data
   - Download: GET /api/sessions/:id/download
   - Delete: DELETE /api/sessions/:id
```

**Python Service Integration:**
```
Backend → Python Service communication:
- POST /internal/pyrogram/send_code
- POST /internal/pyrogram/complete_auth  
- POST /internal/pyrogram/validate_session
- POST /internal/pyrogram/get_me
```

### 6.4 Channels (/channels)
**File:** `frontend/src/components/Channels.js`
**Backend:** `backend/routes/channels.js`

**Alur Koneksi:**
```
1. Channels.js loads
2. fetchChannels() calls GET /api/channels
3. fetchCategories() calls GET /api/categories
4. Component displays channels table
5. User actions:
   - Create: POST /api/channels
   - Edit: PUT /api/channels/:id
   - Delete: DELETE /api/channels/:id
```

### 6.5 Files (/files)
**File:** `frontend/src/components/Files.js`
**Backend:** `backend/routes/files.js`

**Alur Koneksi:**
```
1. Files.js loads
2. fetchFiles() calls GET /api/files
3. Component displays files table
4. User actions:
   - Upload: POST /api/files/upload
   - Preview: GET /api/files/:id/preview
   - Download: GET /api/files/:id/download
   - Delete: DELETE /api/files/:id
```

## 7. DATABASE LAYER

### 7.1 Database Connection (db.js)
```javascript
// SQLite database dengan SQL.js wrapper
const Database = require('sql.js');

class DatabaseWrapper {
  constructor() {
    this.db = null;
  }
  
  initDB() {
    // Initialize SQLite database
    // Run migrations
    // Create tables if not exist
  }
  
  run(sql, params) {
    // Execute SQL with parameters
  }
  
  get(sql, params) {
    // Get single row
  }
  
  all(sql, params) {
    // Get all rows
  }
}
```

### 7.2 Database Tables
```sql
-- Main tables
CREATE TABLE sessions (id, phone_number, session_string, user_info, ...)
CREATE TABLE channels (id, name, username, chat_id, category_id, ...)
CREATE TABLE categories (id, name, description, ...)
CREATE TABLE files (id, filename, file_type, file_path, ...)
CREATE TABLE projects (id, name, description, config, status, ...)

-- Project relations
CREATE TABLE project_sessions (project_id, session_id, ...)
CREATE TABLE project_targets (project_id, channel_id, ...)
CREATE TABLE project_messages (project_id, file_id, ...)

-- Process tracking
CREATE TABLE process_runs (id, project_id, status, stats, ...)
CREATE TABLE process_logs (id, run_id, level, message, ...)
```

## 8. JOB QUEUE SYSTEM

### 8.1 Queue Processing (queue.js)
```javascript
// Bull queue untuk background jobs
const Queue = require('bull');
const sendMessageQueue = new Queue('send message');

// Worker process
sendMessageQueue.process(async (job) => {
  const { session_id, chat_id, message, run_id } = job.data;
  
  // Call Python service to send message
  const response = await fetch('http://localhost:5000/send_message', {
    method: 'POST',
    body: JSON.stringify({
      session_string,
      chat_id,
      message
    })
  });
  
  // Log result
  logToDatabase(run_id, response);
});
```

## 9. PYTHON SERVICE INTEGRATION

### 9.1 Telegram Operations (app.py)
```python
# Flask endpoints untuk Telegram operations
@app.route('/send_code', methods=['POST'])
def send_code():
    # Send verification code via Telegram
    
@app.route('/complete_auth', methods=['POST'])  
def complete_auth():
    # Complete authentication with code
    
@app.route('/validate_session', methods=['POST'])
def validate_session():
    # Validate existing session string
    
@app.route('/send_message', methods=['POST'])
def send_message():
    # Send message to channel using Pyrogram
```

## 10. ERROR HANDLING & LOGGING

### 10.1 Frontend Error Handling
```javascript
// Setiap komponen menggunakan try-catch
try {
  const response = await fetch('/api/endpoint');
  if (!response.ok) throw new Error('API Error');
  const data = await response.json();
} catch (error) {
  console.error('Error:', error);
  setError(error.message);
}
```

### 10.2 Backend Error Handling
```javascript
// Setiap route menggunakan error middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});
```

### 10.3 Logging System
```javascript
// Process logs disimpan ke database
const logToDatabase = (run_id, level, message, metadata) => {
  const sql = `INSERT INTO process_logs 
               (run_id, level, message, metadata, created_at) 
               VALUES (?, ?, ?, ?, datetime('now'))`;
  db.run(sql, [run_id, level, message, JSON.stringify(metadata)]);
};
```

## 11. RESPONSIVE DESIGN

### 11.1 Mobile Navigation (Navigation.css)
```css
/* Desktop navbar */
@media (min-width: 992px) {
  .mobile-nav { display: none; }
}

/* Mobile bottom navbar */
@media (max-width: 991px) {
  .navbar-collapse { display: none !important; }
  .mobile-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1030;
  }
}
```

### 11.2 Responsive Tables
```css
/* Mobile table optimizations */
@media (max-width: 768px) {
  .table th, .table td {
    padding: 0.5rem 0.3rem;
    font-size: 0.85rem;
  }
  
  .d-none-xs { display: none !important; }
}
```

## 12. SECURITY & AUTHENTICATION

### 12.1 Session Management
- Session strings disimpan encrypted di database
- API credentials disimpan di environment variables
- CORS dikonfigurasi untuk development/production

### 12.2 File Upload Security
- File type validation
- File size limits (50MB)
- Secure file storage di uploads/ directory

## 13. DEPLOYMENT & CONFIGURATION

### 13.1 Environment Variables (.env)
```
PORT=3000
PYTHON_SERVICE_URL=http://localhost:5000
DATABASE_PATH=./db/telegram_app.db
UPLOAD_DIR=./uploads
```

### 13.2 Service Management (manage-services.sh)
```bash
# Script untuk mengelola semua services
start_backend()    # Start Node.js backend
start_frontend()   # Start React frontend  
start_python()     # Start Python service
start_all()        # Start semua services
stop_all()         # Stop semua services
```

Dokumentasi ini menjelaskan alur lengkap dari startup hingga setiap interaksi dalam aplikasi Telegram Manager.
