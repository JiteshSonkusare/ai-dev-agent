# DevAgent — Capstone Project Plan

## An Autonomous Software Development Agent with Human Oversight

---

## 1. Concept

An agentic AI platform where a Claude-powered agent autonomously executes the full software development lifecycle — from reading a GitHub issue to deploying code — while keeping the developer in control at critical decision points.

The agent uses **tool calling** to interact with GitHub, the filesystem, and CI/CD pipelines. It follows **skill files** (domain-specific instructions in markdown) to match team coding standards. A **self-correction loop** handles PR review feedback autonomously. The developer sees every decision the agent makes in real-time and can intervene at any gate.

---

## 2. User Flow

1. Product owner creates tasks in GitHub Project Board and assigns them to a developer.
2. Developer logs into DevAgent, connects their GitHub account and configures skills in Settings.
3. Developer clicks **"Pull Tasks"** — the app fetches all GitHub issues assigned to them.
4. Developer sees a task list with title, ticket number, status, due date, and assignee.
5. Developer clicks **"Start"** on a task — the full autonomous cycle begins.
6. Developer can start multiple tasks concurrently — each runs independently.
7. Developer monitors real-time progress of each step (reasoning, tool calls, decisions).
8. At gates (plan approval, merge approval), developer reviews and approves/rejects.
9. Dashboard shows all completed, in-progress, and pending tasks with search and filters.

---

## 3. Workflow — Full Autonomous Cycle

```
STEP 1: FETCH
  Agent reads the GitHub issue (title, body, labels, acceptance criteria)

STEP 2: PLAN
  Agent explores the codebase (list files, read key files)
  Agent loads the develop skill file (if configured)
  Agent produces an implementation plan

🚦 GATE: PLAN APPROVAL
  Developer reviews the plan
  Options: Approve / Reject / Edit

STEP 3: DEVELOP
  Agent creates a feature branch
  Agent implements code following the plan and skill instructions
  Agent reads, writes, and modifies files in the repository

STEP 4: SELF-REVIEW
  Agent loads the review skill file (if configured)
  Agent reviews its own code against skill standards
  Agent fixes any issues found

STEP 5: COMMIT & PUSH
  Agent commits all changes with a descriptive message
  Agent pushes the feature branch to GitHub

STEP 6: CREATE PR
  Agent creates a pull request with title, description, and linked issue

STEP 7: PR REVIEW (loop — max 3 iterations)
  Agent reviews the PR diff using the review skill
  If issues found:
    Agent fixes the issues
    Agent commits and pushes again
    Agent re-reviews
  If clean: proceed

🚦 GATE: MERGE APPROVAL
  Developer reviews the final PR
  Options: Approve / Reject

STEP 8: MERGE
  Agent merges the pull request into main
  This triggers the CI/CD pipeline automatically (GitHub Actions)

STEP 9: PIPELINE MONITORING
  Agent polls GitHub Actions for the pipeline run status
  Reports: pass / fail with summary
  If pipeline fails: reports logs to developer

STEP 10: CLOSE
  Agent closes the GitHub issue
  Agent posts a summary comment on the issue
  Task marked as completed in DevAgent
```

---

## 4. Agentic AI Patterns Demonstrated

| Pattern | Where It Appears |
|---------|-----------------|
| **Tool use** | Agent calls GitHub API, reads/writes files, runs commands, creates PRs |
| **Agent loop (ReAct)** | Reason → Act (tool call) → Observe (result) → Repeat until done |
| **Planning & decomposition** | Agent reads issue → explores codebase → breaks work into steps |
| **Autonomous execution** | Plan → Develop → Review → Commit → PR — runs without human input |
| **Human-in-the-loop** | Gates at plan approval and merge approval |
| **Self-correction** | PR review → finds issues → fixes → re-reviews (up to 3 iterations) |
| **Skill/instruction following** | Agent loads .md skill files and follows them as coding constraints |
| **State persistence** | Task progress, step outputs, conversation history persisted across steps |
| **Observability** | Real-time streaming of agent reasoning, tool calls, and decisions |
| **Multi-step orchestration** | 10 steps chained, output of each step feeds the next |
| **Error recovery** | Agent handles failures, retries, self-corrects on review feedback |
| **Concurrent execution** | Multiple tasks run independently in parallel |

---

## 5. External Integrations (Settings Page)

### GitHub Integration
- **Purpose:** Manage project tasks, code repository, and CI/CD pipelines
- **What it does:**
  - Fetches issues assigned to the developer (task pulling)
  - Reads and writes code in repositories
  - Creates branches, commits, pushes, and pull requests
  - Monitors GitHub Actions pipeline status
  - Closes issues and posts summary comments
- **Configuration:** GitHub Personal Access Token with `repo` scope
- **Stored:** Encrypted in database (Fernet encryption — already built)

### Skills Integration
- **Purpose:** Provide domain-specific instructions the agent follows during execution
- **What it is:** Skills are `.md` files containing coding standards, patterns, review checklists — the same concept as Claude Code skills
- **Skill types:**
  - **Develop Skill** — loaded during Step 3 (Develop). Contains coding conventions, architecture rules, patterns to follow
  - **Review Skill** — loaded during Step 4 (Self-Review) and Step 7 (PR Review). Contains review checklists, common violations, quality standards
  - **Plan Skill** (optional) — loaded during Step 2 (Plan). Contains planning templates, decomposition guidelines
- **How it works:**
  - Developer uploads or pastes `.md` skill files in Settings per project
  - At runtime, the engine checks: does this project have a skill for this step?
  - If yes → skill content is injected into the agent's system prompt for that step
  - If no → agent uses a sensible default prompt
- **Configuration:** Upload `.md` file or paste content in Settings page

### Claude API Integration
- **Purpose:** Powers the agent's reasoning and tool-use capabilities
- **Configuration:** Anthropic API key (BYOK — bring your own key per project)
- **Stored:** Encrypted in database

---

## 6. Architecture

### Tech Stack
- **Frontend:** React 19, TypeScript, Vite, TailwindCSS, React Query, React Router
- **Backend:** FastAPI (Python), SQLAlchemy (async), Alembic migrations
- **Database:** PostgreSQL (production) / SQLite (local dev)
- **AI:** Anthropic Claude API with tool_use
- **Agent Worker:** Python container with git, Node.js, Python, .NET runtimes
- **Containerisation:** Docker, Docker Compose
- **CI/CD Integration:** GitHub Actions (monitored, not managed)

### Component Architecture

```
┌──────────────── Frontend (React) ──────────────────────┐
│  Dashboard │ Task List │ Task Progress │ Settings        │
└────────────────────────┬───────────────────────────────┘
                         │ REST + Polling
┌────────────────────────▼───────────────────────────────┐
│                  Backend (FastAPI)                       │
│                                                         │
│  API Routes          Engine              Services       │
│  ├─ /auth            ├─ Orchestrator     ├─ GitHub      │
│  ├─ /tasks           ├─ Container Mgr    ├─ Claude      │
│  ├─ /runs            └─ Gate Manager     └─ Skills      │
│  ├─ /settings                                           │
│  └─ /callbacks  ◄── Agent containers report here        │
│                                                         │
│  Database (PostgreSQL)                                  │
│  ├─ users, sessions, orgs, projects                     │
│  ├─ connections (encrypted GitHub tokens, API keys)     │
│  ├─ skills (uploaded .md content per project)           │
│  ├─ tasks (pulled from GitHub)                          │
│  ├─ runs (execution records)                            │
│  ├─ run_steps (per-step progress and artifacts)         │
│  └─ gates (pending approvals)                           │
│                                                         │
└─────────────────────────┬──────────────────────────────┘
                          │ Spins up per task
┌─────────────────────────▼──────────────────────────────┐
│              Agent Worker Container (ephemeral)          │
│                                                         │
│  /workspace/repo/  ← cloned repository                  │
│                                                         │
│  Agent Loop (Claude tool_use):                          │
│  ├─ read_file, write_file, list_files                   │
│  ├─ run_command (npm test, dotnet build, etc.)          │
│  ├─ git_clone, git_branch, git_commit, git_push         │
│  ├─ github_create_pr, github_merge_pr                   │
│  ├─ github_get_pipeline_status                          │
│  └─ report_progress (callback to backend)               │
│                                                         │
│  Auto-destroyed after task completes                    │
└─────────────────────────────────────────────────────────┘
```

### Communication Flow

```
Agent Container ──POST /callbacks/progress──► Backend ──writes──► DB
                                                                    │
                                              Frontend ──polls──► Backend
                                              (React Query, 2-3s interval)
```

Gate handling:
```
Container ──POST /callbacks/gate──► Backend stores gate in DB
                                    Frontend shows approval dialog
                                    Developer clicks Approve
                                    Backend updates gate status
Container polls GET /callbacks/gate-status → approved → continues
```

---

## 7. Agent Worker — Tools Definition

Tools the Claude agent can call during execution:

| Tool | Purpose | Implementation |
|------|---------|---------------|
| `read_file(path)` | Read a file from the repository | Local filesystem read in /workspace/repo/ |
| `write_file(path, content)` | Create or update a file | Local filesystem write |
| `list_files(path)` | List directory contents | os.listdir on /workspace/repo/ |
| `search_files(pattern, query)` | Search for text in files | grep/find in repository |
| `run_command(command)` | Execute a shell command (test, build, lint) | subprocess.run in /workspace/ |
| `git_commit(message)` | Stage all changes and commit | git add -A && git commit |
| `git_push()` | Push current branch to remote | git push origin {branch} |
| `create_pr(title, body, base)` | Create a pull request | GitHub REST API |
| `get_pr_diff(pr_number)` | Get the diff of a PR for review | GitHub REST API |
| `merge_pr(pr_number)` | Merge a pull request | GitHub REST API |
| `get_pipeline_status()` | Check GitHub Actions run status | GitHub REST API |
| `close_issue(comment)` | Close the issue with a summary | GitHub REST API |
| `report_progress(step, message)` | Report progress to backend | HTTP POST to callback URL |
| `request_gate(type, payload)` | Request human approval | HTTP POST to callback URL |

---

## 8. Frontend Pages

### 8.1 Dashboard Page
- Overview cards: total tasks, completed, in-progress, pending
- Recent activity feed
- Quick links to active runs

### 8.2 Task List Page
- **"Pull Tasks" button** — fetches all GitHub issues assigned to the developer
- Paginated table with columns: ticket number, title, status, due date, assignee
- Search by title or ticket number
- Date range filter (from/to)
- Status filter (pending, in-progress, completed, failed)
- **"Start" button** on each pending task — triggers the autonomous cycle
- **"View Progress" link** on each in-progress task

### 8.3 Task Progress Page
- Visual step progress bar (Fetch → Plan → Develop → Review → PR → Merge → Pipeline → Done)
- Current step highlighted with status
- **Agent reasoning log** — real-time display of:
  - Agent's thinking/reasoning
  - Tool calls being made (e.g., "Reading src/routes/index.ts...")
  - Tool results (summarised)
  - Decisions made
- **Gate approval panel** — when a gate is hit:
  - Shows the plan or PR for review
  - Approve / Reject buttons
- **Run summary** — after completion:
  - Files changed count
  - PR link
  - Pipeline status
  - Review iterations needed
  - Total duration

### 8.4 Settings Page
- **GitHub Connection:** token input, repo URL, test connection button
- **Claude API Key:** key input (masked), test connection button
- **Skills Configuration:**
  - Develop Skill: upload .md or paste content
  - Review Skill: upload .md or paste content
  - Plan Skill (optional): upload .md or paste content
  - Preview loaded skill content

---

## 9. Database Schema (new/modified tables)

### New Tables

**tasks**
- id, project_id, github_issue_number, title, body, status (pending/in_progress/completed/failed), assignee, labels, due_date, created_at, updated_at

**run_steps**
- id, run_id, step_name, status (pending/in_progress/completed/failed/skipped), started_at, completed_at, output (JSON — artifacts, reasoning log), tool_calls (JSON array)

**gates**
- id, run_id, step_name, gate_type (plan_approval/merge_approval), status (pending/approved/rejected), payload (JSON), developer_response, created_at, resolved_at

**skills**
- id, project_id, skill_type (develop/review/plan), name, content (markdown text), created_at, updated_at

### Modified Tables

**runs** — add fields: task_id, current_step, container_id, summary (JSON)

---

## 10. API Endpoints (new/modified)

### Task Endpoints
- `POST /api/tasks/pull` — fetch issues from GitHub for the current user
- `GET /api/tasks` — list tasks with pagination, search, date filter
- `GET /api/tasks/{id}` — get task detail
- `POST /api/tasks/{id}/start` — start the autonomous cycle for a task

### Run Progress Endpoints
- `GET /api/runs/{id}/steps` — get all steps with progress (frontend polls this)
- `GET /api/runs/{id}/log` — get agent reasoning/tool call log

### Gate Endpoints
- `GET /api/runs/{id}/gates` — get pending gates for a run
- `POST /api/runs/{id}/gates/{gate_id}/approve` — approve a gate
- `POST /api/runs/{id}/gates/{gate_id}/reject` — reject a gate

### Callback Endpoints (called by agent container)
- `POST /api/callbacks/progress` — container reports step progress
- `POST /api/callbacks/gate` — container requests human approval
- `GET /api/callbacks/gate-status/{gate_id}` — container polls for gate resolution
- `POST /api/callbacks/done` — container reports task completion

### Skills Endpoints
- `GET /api/projects/{id}/skills` — list skills for a project
- `POST /api/projects/{id}/skills` — create/update a skill
- `DELETE /api/projects/{id}/skills/{skill_id}` — delete a skill

### Settings Endpoints (existing — modify)
- Add skill management to project settings

---

## 11. Agent Worker Structure

```
agent-worker/
├── Dockerfile
├── requirements.txt
├── main.py                     ← entry point: reads env vars, runs agent
├── agent/
│   ├── loop.py                 ← core agent loop (Claude tool_use cycle)
│   ├── tools.py                ← tool definitions for Claude API
│   └── skills.py               ← loads skill content into system prompt
├── tools/
│   ├── filesystem.py           ← read_file, write_file, list_files, search_files
│   ├── git.py                  ← clone, branch, commit, push
│   ├── github_api.py           ← create_pr, merge_pr, get_pipeline, close_issue
│   └── shell.py                ← run_command (npm test, dotnet build, etc.)
├── reporting/
│   ├── callback.py             ← POST progress/gate/done to backend
│   └── models.py               ← progress, gate, result schemas
└── config.py                   ← reads all env vars into typed config
```

Container image includes: Python 3.11, Node.js 20, .NET 8 SDK, Git.

---

## 12. What Already Exists (from current codebase)

| Component | Status | Action Needed |
|-----------|--------|--------------|
| Auth (register/login/sessions) | ✅ Working | Keep as-is |
| Multi-tenant org/project model | ✅ Working | Keep as-is |
| Connection management (encrypted) | ✅ Working | Extend for GitHub |
| Workflow templates | ✅ Working | Refactor for new step types |
| Run execution with SSE | ✅ Working | Replace SSE with polling, add container orchestration |
| Gate-based approval | ✅ Working | Wire into container callback flow |
| React frontend (dashboard, settings) | ✅ Partial | Rebuild pages for new UX |
| Database + migrations | ✅ Working | Add new tables |
| Engine (prompt → response) | ❌ Not agentic | **Full rewrite** — add tool_use agent loop |
| Agent worker container | ❌ Does not exist | **Build from scratch** |
| GitHub integration | ❌ Does not exist | **Build from scratch** |
| Skills system | ❌ Does not exist | **Build from scratch** |
| Task pulling from GitHub | ❌ Does not exist | **Build from scratch** |
| Pipeline monitoring | ❌ Does not exist | **Build from scratch** |

---

## 13. Implementation Phases

### Phase 1: Agent Worker (core agentic part)
- Build the agent loop with Claude tool_use
- Implement all tools (filesystem, git, GitHub API, shell)
- Build the skill loading system
- Build the callback reporting system
- Build and test the Docker container image

### Phase 2: Backend Refactor
- Add container manager (Docker SDK to spin up/stop agent workers)
- Add callback endpoints (progress, gate, done)
- Add task endpoints (pull from GitHub, list, search)
- Add skills CRUD endpoints
- Add gate management endpoints
- Update database schema and migrations
- Refactor the orchestrator to use containers

### Phase 3: Frontend Rebuild
- Task list page with pull, search, filters, start button
- Task progress page with step visualisation and agent log
- Gate approval dialogs
- Dashboard with overview metrics
- Settings page updates (GitHub connection, skills upload)

### Phase 4: Integration & Testing
- End-to-end flow: pull task → start → plan → approve → develop → PR → merge
- Concurrent task execution
- Error handling and timeout scenarios
- Gate approval/rejection flows
- Pipeline monitoring

### Phase 5: Deployment
- Docker Compose for local development
- Production deployment (VM or AKS — decision pending)
- Environment configuration
- Documentation

### Phase 6: Course Submission
- Project documentation and architecture diagrams
- Demo recording or live demo preparation
- Capstone writeup highlighting agentic AI patterns
- Production scaling discussion (AKS architecture)

---

## 14. Configurable Gates (bonus feature)

Developer can configure the autonomy level per project:

| Mode | Gates | Use Case |
|------|-------|----------|
| **Conservative** | After Plan + Before Merge | Default — full oversight |
| **Autonomous** | Before Merge only | Trusted codebase, agent skips plan approval |
| **Full oversight** | After every step | Learning/debugging the agent |

---

## 15. Infrastructure Decision (pending)

Two options under consideration:

| Approach | Cost | Best For |
|----------|------|----------|
| **Single Azure VM + Docker Compose** | ~$30/mo | Course demo |
| **AKS (Azure Kubernetes Service)** | ~$150-280/mo | Production-grade |

Decision deferred — will discuss separately. The application architecture supports both — the only difference is whether the backend talks to Docker SDK or Kubernetes API to spin up agent workers.
