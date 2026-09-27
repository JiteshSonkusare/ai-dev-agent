# Setup Guide

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.9+ |
| Node.js | 18+ |
| MS SQL Server | 2019+ or Azure SQL |
| Git | 2.30+ |
| ODBC Driver | ODBC Driver 18 for SQL Server |

## 1. Database Setup

Create a database named `aidevagent_db` on your SQL Server instance, then run the schema script:

```bash
sqlcmd -S localhost -d aidevagent_db -i docs/db.sql
```

Or for Azure SQL:
```bash
sqlcmd -S your-server.database.windows.net -U sqladmin -P 'YourPassword' -d aidevagent_db -i docs/db.sql
```

> **Note:** The application also auto-creates tables on startup via SQLAlchemy `create_all`. The `db.sql` script is provided for manual setup or review.

## 2. Backend Setup

```bash
cd src/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env.development
```

Edit `.env.development`:
```env
ENV=development
DATABASE_URL=mssql+aioodbc://sqladmin:YourPass@localhost/aidevagent_db?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
ENCRYPTION_KEY=<generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
WORKSPACE_BASE_PATH=/tmp/agent-workspace
```

Start the backend:
```bash
uvicorn main:app --port 8000 --reload
```

Verify: `curl http://localhost:8000/health`

## 3. Frontend Setup

```bash
cd src/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Verify: Open `http://localhost:5173`

## 4. Initial Configuration

1. **Register** - Create an organization and admin account at the login page
2. **GitHub Connection** - Settings > Connections > Add GitHub
   - Create a Personal Access Token at github.com/settings/tokens
   - Scopes needed: `repo`, `workflow`
   - Enter: `https://github.com/your-username`
3. **Claude Connection** - Settings > Connections > Add Claude API
   - Get API key from console.anthropic.com
   - Enter: `sk-ant-api03-...`
   - Base URL: leave empty (or set custom endpoint if using a proxy)
4. **Profile** - Settings > Profile > Set GitHub username and email (used for git commits)

## 5. Running Your First Task

1. Go to **My Tasks** > **Pull Tasks**
2. Select a repository or "All Assigned Issues"
3. Click **Pull Backlog Tasks** - fetches your open GitHub issues
4. Click **Start** on any task
5. Go to **Running Jobs** to monitor the agent
6. **Approve** the plan when the gate appears
7. Watch the agent develop, review, and create a PR
8. **Approve** the merge when ready
9. Task completes - PR merged, issue closed

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ENV` | Yes | `development` or `production` |
| `DATABASE_URL` | Yes | MS SQL connection string |
| `ENCRYPTION_KEY` | Yes | Fernet key for credential encryption |
| `WORKSPACE_BASE_PATH` | No | Agent workspace dir (default: `/tmp/agent-workspace`) |
