# AI DevAgent

Autonomous AI-powered development platform that executes the full SDLC - from GitHub issue to merged pull request.

![AI DevAgent Workflow](docs/images/agent-workflow.png)

## What It Does

1. **Fetch** - Pull backlog issues from GitHub (repos or Projects V2)
2. **Plan** - AI agent explores the codebase and creates an implementation plan
3. **Approve** - Developer reviews and approves the plan (human-in-the-loop gate)
4. **Develop** - Agent writes code following the plan using skill instructions
5. **Review** - Agent self-reviews code quality
6. **Commit & PR** - Agent commits, pushes, and creates a pull request
7. **Merge** - Developer approves the PR (second gate)
8. **Pipeline** - Agent monitors CI/CD and closes the GitHub issue

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, SQLAlchemy (async) |
| Frontend | React 18, TypeScript, Tailwind CSS |
| Database | Microsoft SQL Server |
| AI Agent | Claude API (tool_use), LangGraph |
| Source Control | GitHub API (REST + GraphQL) |

## Quick Start

```bash
# Backend
cd src/backend
pip install -r requirements.txt
cp .env.example .env.development    # edit DB connection + encryption key
uvicorn main:app --port 8000

# Frontend
cd src/frontend
npm install
npm run dev
```

Open `http://localhost:5173` - register, add GitHub + Claude connections, pull tasks, start the agent.

## Documentation

| Doc | Description |
|-----|-------------|
| [Overview](docs/01-overview.md) | Project background, capabilities, tech stack |
| [Architecture](docs/02-architecture.md) | System design, folder structure, DB schema, tools |
| [Flows](docs/03-flows.md) | Auth flow, agent workflow, tool_use loop, gate approval |
| [Setup Guide](docs/04-setup-guide.md) | How to run locally, environment config |
| [Deployment](docs/05-deployment.md) | Kubernetes deployment with manifests |
| [Database Schema](docs/db.sql) | SQL Server CREATE TABLE script |
