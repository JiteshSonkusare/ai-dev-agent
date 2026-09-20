# DevAgent — Infrastructure

## Overview

Single Windows Server VM hosting all components. No containers, no Kubernetes.

---

## Components

| Component | Technology | Details |
|-----------|-----------|---------|
| **Database** | MS SQL Express | On the VM (free) or Azure SQL ($5/mo managed) |
| **Backend** | Python 3.11+ / FastAPI | Runs as Windows Service via NSSM on `localhost:8000` |
| **Frontend** | React 19 / Vite | Static build served by IIS |
| **LLM** | Claude API | BYOK — user provides Anthropic API key in Settings |
| **GitHub** | GitHub REST + GraphQL API | User's PAT for auth, repo ops, PR creation |
| **Web Server** | IIS | Serves React + reverse proxies `/api/*` to FastAPI |
| **Agent Workspace** | Local filesystem | `C:\agent-workspace\task-{id}\` — clone, develop, push |

---

## VM Layout

```
Windows Server VM (Azure B2s — 2 vCPU, 4 GB RAM)
│
├── IIS (Port 80/443)
│   ├── Site: DevAgent
│   │   ├── /              → React static files (C:\inetpub\devagent\wwwroot\)
│   │   └── /api/*         → Reverse proxy to http://localhost:8000
│   └── SSL: Let's Encrypt or Azure-managed cert
│
├── FastAPI Backend (Port 8000)
│   ├── Managed by: NSSM (Non-Sucking Service Manager) as Windows Service
│   ├── Command: uvicorn main:app --host 127.0.0.1 --port 8000
│   ├── Auto-restart on crash: Yes
│   └── Logs: C:\devagent\logs\
│
├── MS SQL Express
│   ├── Instance: localhost\SQLEXPRESS
│   ├── Database: devagent_db
│   └── Auth: SQL Server authentication
│
├── Git for Windows
│   └── Used by agent worker to clone, branch, commit, push
│
├── Python 3.11+
│   └── Backend runtime + pip packages
│
├── Node.js 20+
│   └── Build React frontend (npm run build)
│
└── C:\agent-workspace\
    └── task-{id}\            ← created per task, deleted after completion
        └── repo\             ← git clone target
```

---

## Software Prerequisites

Install on the VM before deployment:

| Software | Version | Purpose | Download |
|----------|---------|---------|----------|
| Python | 3.11+ | Backend runtime | python.org |
| Node.js | 20 LTS | Build frontend | nodejs.org |
| Git | Latest | Repo operations | git-scm.com |
| MS SQL Express | 2022 | Database | microsoft.com |
| NSSM | Latest | Run FastAPI as Windows Service | nssm.cc |
| IIS | Built-in | Web server + reverse proxy | Server Manager → Add Roles |

### IIS Modules Required

- URL Rewrite Module (for reverse proxy)
- Application Request Routing (ARR) (for proxying to FastAPI)

---

## IIS Configuration

### React Static Files

```
Site: DevAgent
Physical Path: C:\inetpub\devagent\wwwroot\
Binding: *:80 (HTTP) + *:443 (HTTPS)
```

Build and deploy React:
```powershell
cd frontend
npm run build
xcopy /E /Y dist\* C:\inetpub\devagent\wwwroot\
```

### Reverse Proxy to FastAPI

`web.config` in `C:\inetpub\devagent\wwwroot\`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- Proxy /api/* to FastAPI backend -->
        <rule name="API Proxy" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://localhost:8000/api/{R:1}" />
        </rule>
        <!-- SPA fallback — serve index.html for all non-file routes -->
        <rule name="SPA Fallback" stopProcessing="true">
          <match url=".*" />
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

---

## FastAPI as Windows Service

Using NSSM to run uvicorn as a Windows Service:

```powershell
# Install the service
nssm install DevAgentAPI "C:\Python311\python.exe" "-m uvicorn main:app --host 127.0.0.1 --port 8000"
nssm set DevAgentAPI AppDirectory "C:\devagent\backend"
nssm set DevAgentAPI AppStdout "C:\devagent\logs\backend-stdout.log"
nssm set DevAgentAPI AppStderr "C:\devagent\logs\backend-stderr.log"
nssm set DevAgentAPI AppRotateFiles 1
nssm set DevAgentAPI AppRotateBytes 10485760

# Start the service
nssm start DevAgentAPI
```

Service auto-restarts on crash. Logs rotate at 10 MB.

---

## MS SQL Configuration

### Connection String

```
mssql+aioodbc://sa:YourPassword123!@localhost\SQLEXPRESS/devagent_db?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
```

### Backend `.env`

```env
DATABASE_URL=mssql+aioodbc://sa:YourPassword123!@localhost\SQLEXPRESS/devagent_db?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
ENCRYPTION_KEY=your-fernet-key-here
SESSION_EXPIRE_HOURS=24
```

### Database Setup

```sql
CREATE DATABASE devagent_db;
```

Tables are auto-created by SQLAlchemy on first startup (`Base.metadata.create_all`).

---

## Agent Workspace

When a task runs, the agent worker:

1. Creates `C:\agent-workspace\task-{task_id}\`
2. Clones the repo: `git clone https://{PAT}@github.com/{owner}/{repo}.git`
3. Sets git identity:
   ```
   git config user.name "{github_username}"
   git config user.email "{github_email}"
   ```
4. Agent loop: reads files, writes files, runs commands — all local
5. Commits, pushes, creates PR via GitHub API
6. Deletes `C:\agent-workspace\task-{task_id}\` after completion

### Workspace Cleanup

Stale workspaces (older than 24 hours) should be cleaned up periodically:

```powershell
# Scheduled task — runs daily
Get-ChildItem "C:\agent-workspace\task-*" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-24) } |
  Remove-Item -Recurse -Force
```

---

## Deployment Steps

### First-Time Setup

```powershell
# 1. Install prerequisites (Python, Node.js, Git, MS SQL Express, NSSM)

# 2. Create database
sqlcmd -S localhost\SQLEXPRESS -Q "CREATE DATABASE devagent_db"

# 3. Clone project
git clone https://github.com/{your-org}/cc-automation-mvp.git C:\devagent

# 4. Backend setup
cd C:\devagent\backend
pip install -r requirements.txt
copy .env.example .env
# Edit .env with MS SQL connection string and encryption key

# 5. Frontend build
cd C:\devagent\frontend
npm install
npm run build
xcopy /E /Y dist\* C:\inetpub\devagent\wwwroot\

# 6. Configure IIS
# - Create site pointing to C:\inetpub\devagent\wwwroot\
# - Install URL Rewrite + ARR
# - Add web.config (see above)

# 7. Install FastAPI as Windows Service
nssm install DevAgentAPI "C:\Python311\python.exe" "-m uvicorn main:app --host 127.0.0.1 --port 8000"
nssm set DevAgentAPI AppDirectory "C:\devagent\backend"
nssm start DevAgentAPI

# 8. Create agent workspace
mkdir C:\agent-workspace

# 9. Verify
curl http://localhost:8000/health
# → {"status":"ok","version":"2.0.0"}
```

### Update Deployment

```powershell
# Pull latest code
cd C:\devagent
git pull origin main

# Backend — restart service
cd backend
pip install -r requirements.txt
nssm restart DevAgentAPI

# Frontend — rebuild and deploy
cd ..\frontend
npm install
npm run build
xcopy /E /Y dist\* C:\inetpub\devagent\wwwroot\
```

---

## Estimated Cost

| Resource | Option | Cost |
|----------|--------|------|
| **VM** | Azure B2s (2 vCPU, 4 GB) | ~$30/mo |
| **MS SQL** | Express on VM | Free |
| **MS SQL** | Azure SQL (Basic) | ~$5/mo |
| **Storage** | 64 GB managed disk | ~$5/mo |
| **Total** | | **~$35–40/mo** |

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| GitHub PAT storage | Fernet-encrypted in MS SQL |
| Claude API key storage | Fernet-encrypted in MS SQL |
| Agent workspace files | Deleted after task completion |
| IIS HTTPS | Let's Encrypt or Azure-managed cert |
| MS SQL access | Localhost only — no external access |
| FastAPI access | Localhost only — IIS proxies externally |
| VM access | NSG: allow 80/443/3389 only |
