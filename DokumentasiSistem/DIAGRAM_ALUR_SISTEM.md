# Diagram Alur Sistem Telegram Manager

## 1. ARSITEKTUR KESELURUHAN

```mermaid
graph TB
    subgraph "USER INTERFACE"
        Browser[Browser<br/>localhost:3001]
    end
    
    subgraph "FRONTEND LAYER"
        React[React App<br/>Port 3001]
        Proxy[Dev Proxy<br/>setupProxy.js]
    end
    
    subgraph "BACKEND LAYER"
        Express[Express Server<br/>Port 3000]
        Routes[API Routes]
        Queue[Bull Queue<br/>Job Processing]
        DB[SQLite Database<br/>db.js]
    end
    
    subgraph "PYTHON LAYER"
        Flask[Flask Service<br/>Port 5000]
        Pyrogram[Pyrogram Client<br/>Telegram API]
    end
    
    subgraph "EXTERNAL"
        Telegram[Telegram API<br/>api.telegram.org]
        Files[File System<br/>uploads/]
    end
    
    Browser --> React
    React --> Proxy
    Proxy --> Express
    Express --> Routes
    Routes --> DB
    Routes --> Queue
    Queue --> Flask
    Flask --> Pyrogram
    Pyrogram --> Telegram
    Routes --> Files
```

## 2. STARTUP SEQUENCE DETAIL

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant React
    participant Express
    participant Flask
    participant DB
    
    Note over User,DB: System Startup
    
    User->>Browser: Navigate to localhost:3001
    Browser->>React: Load React App
    React->>React: index.js → App.js
    React->>React: Setup Router & Navigation
    React->>Express: Health check /health
    Express->>Express: Initialize server.js
    Express->>DB: Initialize database
    DB->>Express: Database ready
    Express->>Flask: Health check /health
    Flask->>Express: Python service ready
    Express->>React: Backend ready
    React->>Browser: App loaded & ready
    Browser->>User: Dashboard displayed
```

## 3. NAVIGASI ANTAR HALAMAN

```mermaid
graph LR
    subgraph "Navigation Component"
        NavDesktop[Desktop Navbar<br/>≥992px]
        NavMobile[Mobile Bottom Nav<br/><992px]
    end
    
    subgraph "Pages"
        Dashboard[Dashboard<br/>/]
        Projects[Projects<br/>/projects]
        Sessions[Sessions<br/>/sessions]
        Channels[Channels<br/>/channels]
        Files[Files<br/>/files]
    end
    
    NavDesktop --> Dashboard
    NavDesktop --> Projects
    NavDesktop --> Sessions
    NavDesktop --> Channels
    NavDesktop --> Files
    
    NavMobile --> Dashboard
    NavMobile --> Projects
    NavMobile --> Sessions
    NavMobile --> Channels
    NavMobile --> Files
```

## 4. ALUR DATA DASHBOARD

```mermaid
sequenceDiagram
    participant Dashboard
    participant Backend
    participant DB
    
    Dashboard->>Backend: GET /api/dashboard/stats
    Backend->>DB: SELECT COUNT(*) FROM projects
    DB->>Backend: Projects count
    Backend->>DB: SELECT COUNT(*) FROM sessions
    DB->>Backend: Sessions count
    Backend->>DB: SELECT COUNT(*) FROM channels
    DB->>Backend: Channels count
    Backend->>DB: SELECT COUNT(*), SUM(file_size) FROM files
    DB->>Backend: Files count & size
    Backend->>Dashboard: Aggregated statistics
    Dashboard->>Dashboard: Display stats cards
```

## 5. ALUR MANAJEMEN PROJECTS

```mermaid
graph TD
    subgraph "Projects Page Flow"
        ProjectsList[Projects List]
        CreateBtn[Create Button]
        EditBtn[Edit Button]
        RunBtn[Run Button]
        StopBtn[Stop Button]
        LogsBtn[Logs Button]
        DeleteBtn[Delete Button]
    end
    
    subgraph "Modals"
        CreateModal[Create/Edit Modal]
        RunModal[Run Modal]
        LogsModal[Logs Modal]
        DeleteModal[Delete Confirmation]
    end
    
    subgraph "Backend Operations"
        CreateAPI[POST /api/projects]
        UpdateAPI[PUT /api/projects/:id]
        RunAPI[POST /api/projects/:id/run]
        StopAPI[POST /api/projects/:id/stop]
        LogsAPI[GET /api/projects/:id/logs]
        DeleteAPI[DELETE /api/projects/:id]
    end
    
    ProjectsList --> CreateBtn
    ProjectsList --> EditBtn
    ProjectsList --> RunBtn
    ProjectsList --> StopBtn
    ProjectsList --> LogsBtn
    ProjectsList --> DeleteBtn
    
    CreateBtn --> CreateModal
    EditBtn --> CreateModal
    RunBtn --> RunModal
    LogsBtn --> LogsModal
    DeleteBtn --> DeleteModal
    
    CreateModal --> CreateAPI
    CreateModal --> UpdateAPI
    RunModal --> RunAPI
    RunModal --> StopAPI
    LogsModal --> LogsAPI
    DeleteModal --> DeleteAPI
```

## 6. ALUR MANAJEMEN SESSIONS

```mermaid
graph TD
    subgraph "Session Management"
        SessionsList[Sessions List]
        LoginPhone[Login by Phone]
        LoginString[Login by String]
        UpdateBtn[Update Button]
        DownloadBtn[Download Button]
        DeleteBtn[Delete Button]
    end
    
    subgraph "Login Flow"
        PhoneModal[Phone Login Modal]
        CodeModal[Verification Code Modal]
        StringModal[Session String Modal]
    end
    
    subgraph "Backend APIs"
        SendCodeAPI[POST /api/sessions/phone/send_code]
        CompleteAuthAPI[POST /api/sessions/phone/complete_auth]
        RegisterStringAPI[POST /api/sessions/register_string]
        UpdateAPI[PUT /api/sessions/:id/update_data]
        DownloadAPI[GET /api/sessions/:id/download]
        DeleteAPI[DELETE /api/sessions/:id]
    end
    
    subgraph "Python Service"
        SendCodePy[POST /send_code]
        CompleteAuthPy[POST /complete_auth]
        ValidateSessionPy[POST /validate_session]
        GetMePy[POST /get_me]
    end
    
    SessionsList --> LoginPhone
    SessionsList --> LoginString
    SessionsList --> UpdateBtn
    SessionsList --> DownloadBtn
    SessionsList --> DeleteBtn
    
    LoginPhone --> PhoneModal
    PhoneModal --> SendCodeAPI
    SendCodeAPI --> SendCodePy
    SendCodePy --> CodeModal
    CodeModal --> CompleteAuthAPI
    CompleteAuthAPI --> CompleteAuthPy
    
    LoginString --> StringModal
    StringModal --> RegisterStringAPI
    RegisterStringAPI --> ValidateSessionPy
    
    UpdateBtn --> UpdateAPI
    UpdateAPI --> ValidateSessionPy
    
    DownloadBtn --> DownloadAPI
    DeleteBtn --> DeleteAPI
```

## 7. ALUR JOB QUEUE SYSTEM

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Queue
    participant Worker
    participant Python
    participant Telegram
    
    User->>Frontend: Click Run Project
    Frontend->>Backend: POST /api/projects/:id/run
    Backend->>Backend: Create process_run record
    Backend->>Backend: Get project configuration
    Backend->>Queue: Add jobs to queue
    Queue->>Worker: Process job
    Worker->>Python: POST /send_message
    Python->>Telegram: Send message via Pyrogram
    Telegram->>Python: Response
    Python->>Worker: Result
    Worker->>Backend: Update job status
    Backend->>Backend: Log to database
    Backend->>Frontend: Status update
    Frontend->>User: Show progress
```

## 8. STRUKTUR DATABASE

```mermaid
erDiagram
    SESSIONS {
        int id PK
        string phone_number
        text session_string
        json user_info
        datetime created_at
        datetime updated_at
    }
    
    CHANNELS {
        int id PK
        string name
        string username
        string chat_id
        int category_id FK
        datetime created_at
    }
    
    CATEGORIES {
        int id PK
        string name
        string description
        datetime created_at
    }
    
    FILES {
        int id PK
        string filename
        string file_type
        string file_path
        int file_size
        datetime created_at
    }
    
    PROJECTS {
        int id PK
        string name
        string description
        string owner
        json config
        string status
        datetime created_at
        datetime updated_at
    }
    
    PROJECT_SESSIONS {
        int project_id FK
        int session_id FK
        datetime created_at
    }
    
    PROJECT_TARGETS {
        int project_id FK
        int channel_id FK
        datetime created_at
    }
    
    PROJECT_MESSAGES {
        int project_id FK
        int file_id FK
        datetime created_at
    }
    
    PROCESS_RUNS {
        int id PK
        int project_id FK
        string status
        json stats
        datetime started_at
        datetime completed_at
    }
    
    PROCESS_LOGS {
        int id PK
        int run_id FK
        string level
        text message
        json metadata
        datetime created_at
    }
    
    CHANNELS ||--o{ CATEGORIES : belongs_to
    PROJECTS ||--o{ PROJECT_SESSIONS : has_many
    PROJECTS ||--o{ PROJECT_TARGETS : has_many
    PROJECTS ||--o{ PROJECT_MESSAGES : has_many
    PROJECTS ||--o{ PROCESS_RUNS : has_many
    SESSIONS ||--o{ PROJECT_SESSIONS : has_many
    CHANNELS ||--o{ PROJECT_TARGETS : has_many
    FILES ||--o{ PROJECT_MESSAGES : has_many
    PROCESS_RUNS ||--o{ PROCESS_LOGS : has_many
```

## 9. API ENDPOINTS MAPPING

```mermaid
graph LR
    subgraph "Frontend Components"
        DashboardComp[Dashboard.js]
        ProjectsComp[Projects.js]
        SessionsComp[Sessions.js]
        ChannelsComp[Channels.js]
        FilesComp[Files.js]
    end
    
    subgraph "Backend Routes"
        DashboardRoute[/api/dashboard/*]
        ProjectsRoute[/api/projects/*]
        SessionsRoute[/api/sessions/*]
        ChannelsRoute[/api/channels/*]
        FilesRoute[/api/files/*]
        InternalRoute[/internal/*]
    end
    
    subgraph "Python Endpoints"
        SendCode[/send_code]
        CompleteAuth[/complete_auth]
        ValidateSession[/validate_session]
        SendMessage[/send_message]
        GetMe[/get_me]
    end
    
    DashboardComp --> DashboardRoute
    ProjectsComp --> ProjectsRoute
    SessionsComp --> SessionsRoute
    ChannelsComp --> ChannelsRoute
    FilesComp --> FilesRoute
    
    SessionsRoute --> InternalRoute
    ProjectsRoute --> InternalRoute
    
    InternalRoute --> SendCode
    InternalRoute --> CompleteAuth
    InternalRoute --> ValidateSession
    InternalRoute --> SendMessage
    InternalRoute --> GetMe
```

## 10. RESPONSIVE DESIGN FLOW

```mermaid
graph TD
    subgraph "Screen Size Detection"
        Desktop[Desktop ≥992px]
        Tablet[Tablet 768-991px]
        Mobile[Mobile <768px]
    end
    
    subgraph "Navigation"
        DesktopNav[Top Navbar]
        MobileNav[Bottom Navbar]
    end
    
    subgraph "Layout"
        FullTable[Full Table Columns]
        HiddenCols[Hidden Columns]
        CompactTable[Compact Table]
    end
    
    subgraph "Components"
        LargeButtons[Large Buttons]
        SmallButtons[Small Buttons]
        FullForms[Full Width Forms]
        CompactForms[Compact Forms]
    end
    
    Desktop --> DesktopNav
    Desktop --> FullTable
    Desktop --> LargeButtons
    Desktop --> FullForms
    
    Tablet --> DesktopNav
    Tablet --> HiddenCols
    Tablet --> SmallButtons
    Tablet --> CompactForms
    
    Mobile --> MobileNav
    Mobile --> CompactTable
    Mobile --> SmallButtons
    Mobile --> CompactForms
```

## 11. ERROR HANDLING FLOW

```mermaid
sequenceDiagram
    participant Frontend
    participant Backend
    participant Python
    participant Database
    
    Frontend->>Backend: API Request
    
    alt Success Path
        Backend->>Database: Query
        Database->>Backend: Data
        Backend->>Frontend: Success Response
        Frontend->>Frontend: Update UI
    else Backend Error
        Backend->>Backend: Catch Error
        Backend->>Backend: Log Error
        Backend->>Frontend: Error Response
        Frontend->>Frontend: Show Error Message
    else Python Service Error
        Backend->>Python: Request
        Python->>Python: Catch Error
        Python->>Backend: Error Response
        Backend->>Frontend: Error Response
        Frontend->>Frontend: Show Error Message
    else Database Error
        Backend->>Database: Query
        Database->>Backend: Error
        Backend->>Backend: Log Error
        Backend->>Frontend: Error Response
        Frontend->>Frontend: Show Error Message
    end
```

## 12. FILE UPLOAD FLOW

```mermaid
sequenceDiagram
    participant User
    participant FilesPage
    participant Backend
    participant FileSystem
    participant Database
    
    User->>FilesPage: Select file & click upload
    FilesPage->>FilesPage: Validate file (type, size)
    FilesPage->>Backend: POST /api/files/upload (multipart)
    Backend->>Backend: Validate file
    Backend->>FileSystem: Save to uploads/
    FileSystem->>Backend: File saved
    Backend->>Database: INSERT file record
    Database->>Backend: File ID
    Backend->>FilesPage: Success response
    FilesPage->>FilesPage: Refresh file list
    FilesPage->>User: Show success message
```

Diagram-diagram ini memberikan visualisasi lengkap tentang bagaimana setiap bagian sistem terhubung dan berinteraksi satu sama lain.
