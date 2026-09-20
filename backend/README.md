# Agentic AI Development Platform — Backend

## Stack

- **FastAPI** — async API
- **SQLAlchemy** async ORM + **Alembic** migrations
- **SQLite** (dev) / **PostgreSQL** (prod)
- **Anthropic SDK** — Claude API (BYOK per project)
- **asyncio** — parallel workflow execution

## Project Structure

```
backend/
├── main.py                          # FastAPI app entry point
├── requirements.txt
├── app/
│   ├── core/
│   │   ├── auth.py                  # password hashing, session tokens
│   │   ├── config.py                # settings (DB, encryption, Azure AD)
│   │   ├── db.py                    # SQLAlchemy async engine + session
│   │   └── encryption.py            # Fernet encrypt/decrypt (Key Vault in prod)
│   ├── models/
│   │   └── models.py                # 11 SQLAlchemy models (User, Org, Project, Connection, Run, etc.)
│   ├── services/
│   │   ├── ado.py                   # Azure DevOps MCP stdio client
│   │   ├── claude.py                # Claude BYOK service (per-project API key)
│   │   ├── git.py                   # git clone/branch/commit/push
│   │   ├── github.py               # GitHub PR creation
│   │   ├── jira.py                  # Jira REST client
│   │   └── skills.py               # fetch files from skills repo (ADO/GitHub)
│   ├── engine/                      # Workflow execution engine
│   │   ├── contracts.py             # step types (plan/dev/review/test), SkillBundle, RunContext
│   │   ├── skill_loader.py          # parse SKILL.md frontmatter + load all references
│   │   ├── gate_handler.py          # asyncio-based gate pause/resume between steps
│   │   ├── step_runner.py           # execute one step: load skill → call Claude → parse output
│   │   └── executor.py             # orchestrate full workflow from template steps
│   └── api/
│       ├── deps.py                  # auth dependencies (get_current_user, require_project_role)
│       └── routes/
│           ├── auth.py              # register, login, logout
│           ├── orgs.py              # org CRUD + member management
│           ├── projects.py          # project CRUD + project members
│           ├── connections.py       # connection CRUD + test endpoint
│           ├── skills.py            # skills repo CRUD + skill discovery
│           ├── workflows.py         # workflow template CRUD + step-types endpoint
│           └── runs.py              # start run, SSE stream, gate resume, dashboard
```

## Architecture

```
Request → FastAPI Route → Engine (executor.py)
                              │
                              ├── skill_loader.py   → fetches SKILL.md + refs from skills repo
                              ├── step_runner.py    → sends skill prompt to Claude API
                              ├── gate_handler.py   → pauses for human approval
                              └── contracts.py      → step type contracts define execution mode
```

## Workflow Engine

The engine executes workflow templates defined by architects:

1. **Predefined step types**: `plan`, `dev`, `review`, `test`
2. **Skills from repo**: each step maps to a skill folder (e.g. `cc-dev/SKILL.md`)
3. **Dynamic execution**: engine loads skill at runtime, builds Claude prompt, executes

```
WorkflowTemplate.steps = [
    { order: 1, type: "plan",   skill_path: "cc-plan-tech", gate_after: true },
    { order: 2, type: "dev",    skill_path: "cc-dev",       gate_after: false },
    { order: 3, type: "review", skill_path: "cc-review",    gate_after: false }
]
```

Step type contracts:

| Type | Executes | Input | Output |
|------|----------|-------|--------|
| plan | Once per epic | Epic/Story ID | Task ticket IDs |
| dev | Once per task (loops) | Task ticket ID | Branch + PR URL |
| review | Once per task (loops) | PR + code | Approve/Reject |
| test | Once per task (loops) | Code/branch | Pass/Fail |

## API Endpoints

| Group | Prefix | Description |
|-------|--------|-------------|
| Auth | `/api/auth` | Register, login, logout |
| Orgs | `/api/orgs` | Org CRUD + members (access control only) |
| Projects | `/api/projects` | Project CRUD + project members |
| Connections | `/api/projects/{id}/connections` | Jira, ADO, GitHub, Claude API |
| Skills | `/api/projects/{id}/skills-repos` | Skills repo config + discovery |
| Workflows | `/api/projects/{id}/workflow-templates` | Template CRUD + step-types |
| Runs | `/api/projects/{id}/runs` | Start, stream (SSE), resume gate, dashboard |

## Running

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## Environment Variables

```env
DATABASE_URL=sqlite+aiosqlite:///./cc_automation.db
ENCRYPTION_KEY=<fernet-key>
SESSION_SECRET=<random-string>
SESSION_EXPIRE_HOURS=24
```
