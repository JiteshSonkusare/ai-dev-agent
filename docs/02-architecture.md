# Architecture

## System Overview

```
┌─────────────┐     ┌───────────────────┐      ┌─────────────────┐
│   React UI  │────▶│  FastAPI Backend  │─────▶│   Azure SQL DB  │
│  (Vite/TS)  │◀────│  (Python 3.9+)    │◀─────│   (MS SQL)      │
└─────────────┘     └────────┬──────────┘      └─────────────────┘
                             │
                    ┌────────┴─────────┐
                    │                  │
              ┌─────▼──────┐    ┌──────▼──────┐
              │ Claude API │    │  GitHub API │
              │ (tool_use) │    │ (REST/GQL)  │
              └────────────┘    └─────────────┘
```

## Backend Structure

```
src/backend/
├── app/
│   ├── agent/                  # AI agent core
│   │   ├── loop.py             # Claude tool_use agentic loop
│   │   ├── worker.py           # LangGraph workflow orchestrator
│   │   ├── tools.py            # 12 tool definitions (JSON schema)
│   │   ├── tool_handlers.py    # Tool execution with safety guards
│   │   ├── progress.py         # DB progress writer
│   │   ├── prompts.py          # System prompt builder per step
│   │   └── workspace.py        # Workspace lifecycle (create/cleanup)
│   ├── api/routes/             # REST API endpoints
│   │   ├── auth.py             # Auth, org, user management
│   │   ├── connections.py      # GitHub + Claude connections
│   │   ├── tasks.py            # Task CRUD, agent start, progress, gates
│   │   ├── skills.py           # Skill content management
│   │   └── dashboard.py        # Analytics dashboard
│   ├── core/                   # Infrastructure
│   │   ├── config.py           # Pydantic settings from .env
│   │   ├── db.py               # SQLAlchemy async engine
│   │   ├── auth.py             # Password hashing, session tokens
│   │   └── encryption.py       # Fernet encryption for credentials
│   ├── models/models.py        # 11 SQLAlchemy models
│   └── services/               # External service clients
│       ├── git.py              # Git CLI wrapper (clone, branch, push)
│       └── github.py           # GitHub API client (PR, issues, actions)
├── main.py                     # FastAPI app entry point
└── requirements.txt
```

## Frontend Structure

```
src/frontend/src/
├── api/client.ts               # API client, types, axios instance
├── context/
│   ├── AuthContext.tsx          # Session management, login/logout
│   └── ThemeContext.tsx         # Dark/light mode
├── components/
│   ├── Layout.tsx              # Sidebar nav, header, running jobs badge
│   └── ui.tsx                  # Shared components (Card, Button, Input)
├── pages/
│   ├── LoginPage.tsx           # Login + org registration
│   ├── DashboardPage.tsx       # Analytics charts (Recharts)
│   ├── TasksPage.tsx           # Processed tasks list with drawer
│   ├── PullTasksPage.tsx       # Pull backlog from GitHub
│   ├── RunningJobsPage.tsx     # Active agent jobs (DB-backed)
│   ├── TaskProgressPage.tsx    # Split-panel live progress view
│   └── SettingsPage.tsx        # Connections, skills, users, profile
└── App.tsx                     # Routes and providers
```

## Database Schema (11 tables)

| Table | Purpose |
|-------|---------|
| `users` | User accounts (email, name, role, github identity) |
| `sessions` | Bearer token sessions with expiry |
| `orgs` | Organizations (multi-tenant) |
| `org_members` | User-to-org membership |
| `connections` | Encrypted GitHub PAT + Claude API key per user |
| `skills` | Markdown skill instructions (plan/develop/review) |
| `tasks` | GitHub issues pulled as tasks |
| `runs` | Agent execution runs (status, tokens, branch) |
| `run_steps` | Per-step progress (tool_calls, reasoning, duration) |
| `gates` | Human approval gates (plan_approval, merge_approval) |
| `task_logs` | Audit log entries per task/step |

## LLM Integration - Claude tool_use

The agent uses Claude's native tool_use API (not a framework wrapper). Each workflow step sends a system prompt + tools to Claude, which responds with either text (reasoning) or tool_use blocks.

**12 Tools available to the agent:**

| Tool | Category | Purpose |
|------|----------|---------|
| `read_file` | Filesystem | Read a file from the cloned repo |
| `write_file` | Filesystem | Create or update a file |
| `list_files` | Filesystem | List directory contents |
| `search_files` | Filesystem | Grep for text patterns |
| `run_command` | Shell | Execute shell commands (with timeout + blocklist) |
| `git_commit` | Git | Stage all changes and commit |
| `git_push` | Git | Push branch to remote |
| `create_pull_request` | GitHub | Create a PR via GitHub API |
| `get_pr_diff` | GitHub | Read PR file changes |
| `merge_pull_request` | GitHub | Merge an approved PR |
| `get_pipeline_status` | GitHub | Check GitHub Actions run status |
| `close_issue` | GitHub | Close issue with summary comment |

**Safety guards in tool execution:**
- Path traversal protection (all paths resolved relative to workspace)
- Command timeout (120s) and blocked commands list
- Tool calls logged to DB for full audit trail

## Workflow Orchestration - LangGraph

The agent workflow is a LangGraph `StateGraph` with 9 nodes and 6 conditional edges:

```
setup -> plan -> gate_plan -> develop -> review -> commit_pr -> gate_merge -> pipeline -> finish
```

Conditional edges route errors and rejections to the finish node. Gates are DB-persisted and polled every 5 seconds until the developer approves or rejects.
