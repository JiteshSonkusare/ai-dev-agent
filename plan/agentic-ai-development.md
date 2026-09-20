# Agentic AI Development Platform — Architecture Plan

## Vision

A multi-tenant AI-powered development platform where teams onboard their own projects, configure their own tools and standards, and run intelligent agentic workflows that plan and implement code — with full visibility and human-in-the-loop control. Each project is fully autonomous. The organisation exists only to manage users and access.

---

## Ownership Model

```
Organisation  →  access control only (users + roles)
    │
    └── Project  →  owns everything else
          ├── Connections   (Jira, ADO, GitHub — project chooses)
          ├── Skills Repo   (which repo holds the standards)
          ├── Agent Profiles (planner, developer, reviewer)
          ├── Workflow Template (steps + gate policy)
          └── Runs
```

**Org Admin** — manages who is in the org, nothing else
**Project Admin** (Architect) — owns all config for their project, no dependency on org admin

**Real example:**

| | Contact Centre | CX Platform |
|---|---|---|
| Issue tracker | ADO Boards | Atlassian Jira |
| Code repo | Azure DevOps | GitHub |
| Skills repo | ADO standards repo | GitHub standards repo |
| Admin | CC team lead | CX team lead |
| Dependency on org admin | ❌ None after joining | ❌ None after joining |

---

## Data Model

### Org
```
id, name, slug, created_at
-- Org is a container for users only. No connections or config here.
```

### OrgMember
```
id, org_id, user_id
org_role (org_admin | member)
-- org_admin can add/remove members. That's all.
```

### Project
```
id, org_id, name, description
created_by, created_at
```

### ProjectMember
```
id, project_id, user_id
role (admin | architect | developer | viewer)
-- Project admin manages their own team independently.
-- A user can be developer on CC and architect on CX Platform.
```

### Connection  ← lives at PROJECT level
```
id, project_id
type (atlassian | azure_devops | github | azure_devops_boards | claude_api)
auth_type (pat | oauth | api_key)
credentials_encrypted  -- stored in Azure Key Vault
base_url, project_name, extra_config (JSON)
status (connected | error)
label  -- e.g. "CC Jira", "CC ADO Repo", "Claude API"
-- For claude_api: extra_config holds model, max_tokens, rate_limit
```

### SkillsRepo  ← lives at PROJECT level
```
id, project_id, connection_id
repo_name, branch (default: main)
skills_path  (e.g. /skills)
rules_path   (e.g. /rules)
agents_path  (e.g. /agents)
manifest_path (e.g. /manifest.json — maps app_type → code repo + build commands)
last_synced_at
```

### AgentProfile  ← lives at PROJECT level
```
id, project_id, name, description
skills_paths (JSON array — files from skills repo to inject)
system_prompt_override (optional)
-- e.g. "Planner Agent", "Developer Agent", "Reviewer Agent"
```

### WorkflowTemplate  ← lives at PROJECT level
```
id, project_id, name
steps (JSON array — ordered step definitions)
gate_policy (auto_approve_all | review_plan | review_all | custom)
is_default (bool)
```

### WorkflowStep (within template steps JSON)
```
order: int                — execution order (1, 2, 3...)
type: plan | dev | review | test   — predefined step type (platform-defined)
skill_path: string        — folder name in skills repo (e.g. "cc-plan-tech", "cc-dev")
gate_after: bool          — pause for human review after this step completes
model_override: string?   — override model from SKILL.md frontmatter (optional)
```

### Predefined Step Types (platform-defined contracts)
```
PLAN    — Runs once per epic. Input: epic/story ID. Output: list of task tickets.
DEV     — Runs once per task (loops). Input: task ticket ID. Output: branch + PR.
REVIEW  — Runs once per task. Input: PR + code. Output: approve / changes required.
TEST    — Runs once per task. Input: code / branch. Output: pass / fail.
```

The architect selects from these step types when building a workflow, then maps each step
to a skill folder from the connected skills repo. The system knows the execution contract
for each type (what it expects in, what it produces, whether it loops per-task).

Example workflows:
  - "Plan + Dev":         [plan → dev]
  - "Full Pipeline":      [plan → dev → review → test]
  - "Dev Only":           [dev]  (tasks already exist in tracker)
  - "Plan + Test":        [plan → test]
```

### Run
```
id, project_id, triggered_by
epic_key, status (running | awaiting_gate | done | error | timed_out | cancelled)
auto_approve
started_at, finished_at
steps_json, pr_urls_json
total_input_tokens, total_output_tokens, model
retry_count
error
```

---

## Skills System

Skills live in a GitHub/ADO repo configured per project. Each skill is a **complete workflow for one step type** — it defines phases, gates, absolute rules, and all instructions Claude needs.

### Skill Structure (real example from cc-dev)
```
project-standards-repo/
  skills/
    cc-plan-tech/                    ← mapped to step type: PLAN
      SKILL.md                       ← entry point (frontmatter + phases + gates)
      references/
        read-story.md                ← Phase 1 instructions
        app-catalog.md               ← app type detection rules
        issue-types.md               ← ticket type classification
        propose-tasks.md             ← Phase 3 instructions
        create-tasks.md              ← Phase 4 instructions
        arch-review-gate.md          ← Phase 5 instructions
    cc-dev/                          ← mapped to step type: DEV
      SKILL.md                       ← entry point (7 phases, 3 gates)
      references/
        detect-application.md        ← Phase 1: read ticket + detect app type
        generate-plan.md             ← Phase 2: create implementation plan
        git-prep.md                  ← Phase 3: branch setup
        implement.md                 ← Phase 4+5: load rules + write code
        review.md                    ← Phase 6: architecture review
        pr-summary.md                ← Phase 7: PR description + push
        state-file.md                ← resume detection
      _plan-templates/
        feature.md
        bugfix.md
        deploy.md
    cc-review/                       ← mapped to step type: REVIEW
      SKILL.md
      references/...
    cc-test/                         ← mapped to step type: TEST
      SKILL.md
      references/...
  rules/                             ← coding standards (loaded by skills)
    dotnet-api/
      references/
        architecture.md
        naming-conventions.md
        testing-standards.md
    admin-portal/
      references/...
    react-app/
      references/...
```

### SKILL.md Anatomy (frontmatter)
```yaml
---
name: cc-dev
description: Given a Jira ticket ID, reads the ticket, generates an implementation plan, implements code following team standards, runs architecture review, and prepares a PR.
user-invocable: true
argument-hint: "<TICKET-ID>  e.g. /cc-dev CCF-1234"
model: claude-opus-4-6            ← default model for this skill
---
```

The skill defines its own:
- **Phases** (ordered steps within the skill)
- **Gates** (human checkpoints within the skill)
- **Reference files** (loaded on demand per phase)
- **Absolute rules** (invariants the agent must never break)
- **Resume detection** (state file for interrupted runs)

### How Skills Map to Workflow Steps

```
Workflow Template (architect creates in app):
  steps: [
    { order: 1, type: "plan", skill_path: "cc-plan-tech" },
    { order: 2, type: "dev",  skill_path: "cc-dev" }
  ]

Runtime:
  1. System reads step[0] → type=plan, skill=cc-plan-tech
  2. Fetches skills/cc-plan-tech/SKILL.md from skills repo
  3. Parses SKILL.md → finds reference files to load
  4. Fetches all references
  5. Builds Claude system prompt = SKILL.md + all references
  6. Executes the skill (Claude follows the phases defined in SKILL.md)
  7. Skill produces output (list of tasks)
  8. System moves to step[1] → type=dev, loops per task
  9. For each task: fetches skills/cc-dev/SKILL.md + references, executes
```

### Skill Discovery (for workflow builder UI)

When architect opens the workflow builder, the app scans the connected skills repo:
```
GET skills repo → list folders under skills_path
  → for each folder: read SKILL.md → parse frontmatter (name, description)
  → return list for the dropdown
```

Architect sees:
| Skill | Description | Model |
|-------|-------------|-------|
| cc-plan-tech | Technical planning — reads Epic, creates tasks | opus |
| cc-dev | Development — implements code, creates PR | opus |
| cc-review | Architecture review | sonnet |
| cc-test | Run tests and validate | sonnet |

They drag step types (plan, dev, review, test) into the flow, then pick which skill fills each slot.

### Rules vs Skills

| | Skills | Rules |
|---|---|---|
| Purpose | Workflow orchestration (what to do) | Coding standards (how to write code) |
| Loaded by | Platform at step execution | Skills internally (Phase 4 in cc-dev) |
| Example | cc-dev/references/implement.md | rules/dotnet-api/references/architecture.md |
| Who writes | Architect | Architect |
| When used | Platform loads skill for Claude | Skill tells Claude to load rules |

Skills reference rules internally — the platform doesn't need to know about rules directly.

---

## Backend Architecture

### Stack
- **FastAPI** — async API
- **SQLite** (dev) → **PostgreSQL** (prod)
- **SQLAlchemy** async ORM + **Alembic** migrations
- **LangGraph** — agent graph execution
- **asyncio** — parallel epic runs

### Project Structure
```
backend/
  app/
    api/
      routes/
        auth.py             -- login, session
        orgs.py             -- org + member management (access only)
        projects.py         -- project CRUD + project members
        connections.py      -- project-level connections
        skills.py           -- skills repo config + skill discovery
        workflows.py        -- workflow template CRUD (step types + skill mapping)
        runs.py             -- start run, stream, resume gate
        dashboard.py        -- run history + stats per project
    models/                 -- SQLAlchemy models
    schemas/                -- Pydantic schemas
    services/
      atlassian_service.py  -- Jira via Atlassian MCP
      ado_service.py        -- ADO via local ADO MCP stdio
      github_service.py     -- GitHub via GitHub MCP
      skills_service.py     -- fetch skills from repo, parse SKILL.md, load references
      claude_service.py     -- Claude API with semaphore (BYOK)
      git_service.py        -- git clone, branch, push on container
    engine/
      executor.py           -- workflow execution engine (reads template, runs steps)
      step_runner.py        -- executes one step: loads skill, calls Claude, handles output
      skill_loader.py       -- fetches SKILL.md + references from skills repo
      gate_handler.py       -- manages platform-level gates (interrupt + resume)
      contracts.py          -- step type contracts (plan/dev/review/test)
    core/
      auth.py               -- session auth
      config.py
      db.py
      encryption.py
  main.py
```

---

## API Design

### Org — access only
```
POST   /api/orgs                          -- create org
GET    /api/orgs/{org_id}
POST   /api/orgs/{org_id}/members         -- add user to org
DELETE /api/orgs/{org_id}/members/{id}    -- remove user
PATCH  /api/orgs/{org_id}/members/{id}    -- change org role
```

### Projects — full autonomy
```
POST   /api/orgs/{org_id}/projects        -- create project
GET    /api/orgs/{org_id}/projects        -- list (only projects user belongs to)
GET    /api/projects/{project_id}
PATCH  /api/projects/{project_id}
```

### Project Members
```
POST   /api/projects/{project_id}/members       -- add member (project admin only)
PATCH  /api/projects/{project_id}/members/{id}  -- change project role
DELETE /api/projects/{project_id}/members/{id}
```

### Connections — project-level
```
POST   /api/projects/{project_id}/connections
GET    /api/projects/{project_id}/connections
DELETE /api/projects/{project_id}/connections/{id}
GET    /api/projects/{project_id}/connections/{id}/test  -- verify works
```

### Skills — project-level
```
POST   /api/projects/{project_id}/skills-repos           -- configure skills repo
GET    /api/projects/{project_id}/skills-repos
POST   /api/projects/{project_id}/skills-repos/{id}/sync -- fetch latest from repo
GET    /api/projects/{project_id}/skills-repos/{id}/skills -- discover skills (list folders with SKILL.md)
GET    /api/projects/{project_id}/skills-repos/{id}/skills/{skill_path} -- preview skill (frontmatter + description)
```

### Workflow Templates — project-level (architect builds flows here)
```
POST   /api/projects/{project_id}/workflow-templates
GET    /api/projects/{project_id}/workflow-templates
PATCH  /api/projects/{project_id}/workflow-templates/{id}
DELETE /api/projects/{project_id}/workflow-templates/{id}
GET    /api/projects/{project_id}/workflow-templates/step-types   -- returns available step types + contracts
```

### Runs
```
POST   /api/projects/{project_id}/runs           -- start batch
GET    /api/projects/{project_id}/runs           -- history (all members see this)
GET    /api/runs/{run_id}/stream                 -- SSE stream
POST   /api/runs/{run_id}/resume                 -- gate decision
GET    /api/projects/{project_id}/dashboard      -- stats + recent runs
```

---

## Agentic Flow (per epic)

All execution happens server-side on the container. Developer only sees the output PR.

### Runtime Execution Engine

The workflow engine reads the `WorkflowTemplate.steps` and executes them in order.
Each step type has a known contract — the engine handles looping and data passing between steps.

```
Workflow: [plan, dev, review]

1. Engine reads step[0] → type=plan, skill=cc-plan-tech
   a. Fetch skill from skills repo: skills/cc-plan-tech/SKILL.md + references/
   b. Build system prompt = SKILL.md content + all referenced files
   c. Execute: Claude (project's API key) runs the skill phases
   d. Skill reads epic from tracker, proposes tasks, creates them in Jira
   e. Output: list of task ticket IDs [CCF-101, CCF-102, CCF-103]
   f. Gate (if gate_after=true): human reviews task proposals

2. Engine reads step[1] → type=dev, skill=cc-dev
   ** Loops once per task (dev type contract) **
   For each task [CCF-101, CCF-102, CCF-103]:
     a. Fetch skill from skills repo: skills/cc-dev/SKILL.md + references/
     b. Build system prompt
     c. Execute: Claude runs the cc-dev phases:
        - Read ticket → detect app type → generate plan
        - Gate (skill-internal): developer confirms plan
        - Git prep → clone repo on container → create branch
        - Load rules (skill loads rules/{app_type}/ internally)
        - Implement files → build verify → self-heal if fails (max 3)
        - Architecture review
        - Push + create PR
     d. Output: PR URL
     e. Gate (if gate_after=true): human reviews before next task

3. Engine reads step[2] → type=review, skill=cc-review
   ** Loops once per task (review type contract) **
   For each task:
     a. Fetch skill: skills/cc-review/SKILL.md + references/
     b. Execute: Claude reviews the PR code
     c. Output: approve / changes required
     d. If changes required → feed back to dev step (or mark for human)
```

### Step Type Contracts

| Type | Executes | Input | Output | After |
|------|----------|-------|--------|-------|
| plan | Once per epic | Epic/Story ID | Task ticket IDs | Tasks exist in tracker |
| dev | Once per task (loop) | Task ticket ID | Branch + PR URL | PR ready for review |
| review | Once per task (loop) | PR + code | Approve/Reject | Decision recorded |
| test | Once per task (loop) | Code/branch | Pass/Fail | Result recorded |

### Skill Loading at Runtime

```python
async def load_skill(skills_repo: SkillsRepo, skill_path: str) -> SkillBundle:
    """Fetch SKILL.md + all referenced files from the skills repo."""
    # 1. Fetch SKILL.md
    skill_md = await fetch_from_repo(skills_repo, f"skills/{skill_path}/SKILL.md")

    # 2. Parse frontmatter → name, description, model
    frontmatter = parse_frontmatter(skill_md)

    # 3. Parse body → find all reference file paths mentioned in "STEP 0"
    ref_paths = extract_reference_paths(skill_md)

    # 4. Fetch all reference files
    references = {}
    for ref in ref_paths:
        references[ref] = await fetch_from_repo(skills_repo, ref)

    return SkillBundle(
        name=frontmatter["name"],
        model=frontmatter.get("model", "claude-sonnet-4-6"),
        system_prompt=skill_md,
        references=references,
    )
```

### Gate Handling

Two levels of gates:
1. **Platform gates** (gate_after on workflow step) — engine pauses between steps, waits for user via SSE
2. **Skill-internal gates** (defined in SKILL.md) — the skill itself asks Claude to pause and request confirmation

Platform gates are handled by LangGraph `interrupt_before`. Skill-internal gates are handled by the skill's own instructions (Claude outputs a gate message, engine detects it, pauses).

### Self-Healing Loop (within dev step)

Build fails inside the cc-dev skill? The skill's own instructions handle it:
```
implement.md Phase 5 Step 5:
  If build FAILS → fix all errors before moving to Phase 6
  (skill instructs Claude to retry — platform provides max 3 retries as safety)
```

Engine enforces: max 3 Claude calls for fix attempts. After that → mark task as error.

---

## ADO MCP Integration

```python
# Spawned per project connection, PAT from project connection record
# Runs on the same container — no external runner needed
process = await asyncio.create_subprocess_exec(
    "npx", "-y", "@azure-devops/mcp", org_name,
    env={"AZURE_DEVOPS_PAT": project_connection.pat, **os.environ},
    stdin=PIPE, stdout=PIPE, stderr=PIPE
)
```

Used for: create branch, create PR, read files from standards repo, search code.
Git CLI used for: clone to /tmp on container, local implementation, push.

---

## New Features vs Current

| Feature | Current | New |
|---|---|---|
| Multi-tenant | ❌ Single user | ✅ Org + projects + roles |
| Connections | ❌ Hardcoded in .env | ✅ Project-level, UI-managed |
| Skills | Hardcoded .env paths | ✅ Repo-driven, architect-managed |
| Agent profiles | ❌ None | ✅ Per project, configurable |
| Workflow steps | Hardcoded | ✅ Template-driven per project |
| Gate policy | Per run toggle | ✅ Per project policy |
| ADO MCP | ❌ Raw REST | ✅ Local MCP stdio |
| Issue tracker | Atlassian only | ✅ Atlassian or ADO Boards |
| Code repo | ADO only | ✅ ADO or GitHub |
| Webhook triggers | ❌ Manual only | ✅ Jira/ADO event → auto run |
| Cost tracking | Per run only | ✅ Per project + per user |
| Skill testing | ❌ None | ✅ Test agent on mock ticket |
| Run visibility | Per user | ✅ All project members |

---

## Deployment & Execution Model

### Deployment — Azure Container Apps

| Component | Azure Service | Reason |
|---|---|---|
| API + Orchestration | Azure Container Apps | Auto-scales, serverless pricing, scale-to-zero |
| Database | Azure PostgreSQL Flexible | Managed, reliable |
| Secrets (API keys, PATs) | Azure Key Vault | Encrypted credential storage |
| Git clone temp storage | Ephemeral container disk | Dies with the container |
| Frontend | Azure Static Web App | Free tier, CDN |

### Execution — Fully Server-Side

All code operations happen on the container itself. No local agents, no runners, no tunnels.

```
Container starts run:
  /tmp/{run_id}/{epic_key}/
    └── git clone (using project's connection PAT/OAuth)
    └── create branch
    └── write implementation files (from Claude response)
    └── run build/test
    └── git push
    └── create PR via API
    └── cleanup /tmp
```

Developer receives a PR in ADO/GitHub — reviews there. No local machine involvement.

### BYOK — Bring Your Own Key

Each project stores its own Claude API key as a connection:

```
Connection type: claude_api
  api_key (encrypted via Key Vault)
  model (default: claude-sonnet-4-6)
  max_tokens_per_call
  rate_limit (optional)
```

- No shared rate limits between projects
- Each project's runs use their own key
- Platform has zero contention at scale (100+ projects)

### Scaling

- Containers are stateless — clone to /tmp, work, push, delete
- 95% of time is idle (waiting on Claude API responses)
- Auto-scales based on queue depth
- Scales to zero when no runs active (cost saving)
- 100 concurrent projects = 100 lightweight containers, minimal compute

---

## Functional Decisions (Agreed)

### Build/Test — Runtime handled via Skills
- SDK/runtime requirements are defined in skill files (e.g. "requires .NET 8 SDK", "requires Node 20")
- Container must have common SDKs pre-installed (or skill specifies what's available)
- Skill instructs the agent what build/test commands to run (e.g. `dotnet build`, `npm run build`)
- If a project uses an unusual runtime, the skill file documents it — agent follows instructions

### Multiple Code Repos — Mapped in Skills Repo
- A project can have multiple code repos (backend, frontend, infra)
- Mapping lives in the skills/standards repo (e.g. manifest defines: app_type "dotnet-api" → repo "backend-service")
- When a ticket is detected as a specific app_type, the platform knows which repo to clone
- Skills repo is the single source of truth for repo mapping + agent context

### Self-Healing on Build Failure
- If Claude generates code that fails build/test:
  1. Capture build error output
  2. Feed error back to Claude as context ("build failed with: ...")
  3. Claude generates fix
  4. Re-run build
  5. Max 3 retries — if still failing, mark task as error, notify user
- Agent must produce passing code before push — never push broken code

### Gate Timeout
- Configurable timeout per project (default: 24 hours)
- Notification sent when gate is hit (UI + optional email/Teams)
- Reminder notification at 50% of timeout
- On timeout: auto-cancel the run, mark as "timed_out"
- Project admin can configure: timeout duration + timeout action (cancel | auto-approve)

### Conflict Detection — Git-based resolution
- Before push: `git fetch origin main && git rebase origin/main`
- If rebase conflicts: attempt auto-resolve for trivial conflicts
- If unresolvable: mark task as conflict, notify user with details
- Parallel epics are independent — if both touch same files, second PR will show conflicts in ADO/GitHub (human resolves during review)

### Auth — DB table + optional Azure AD
- Core auth: user table in DB with email/password (session-based)
- Optional: Azure AD / OIDC integration for enterprise SSO
- Phase 1 ships with DB auth, Azure AD added in later phase
- Token-based API auth for programmatic access (webhook triggers, CI integration)

### PR Strategy — One PR per task, always
- Each task produces exactly one PR
- Epic with 5 tasks = 5 PRs
- Keeps PRs small, reviewable, independently mergeable
- Developer reviews each PR separately in ADO/GitHub

---

## Key Design Decisions (Agreed)

### 1. Code execution — Server-side only
- All git operations (clone, branch, implement, build, push) happen on the container
- No local agents, no runners, no tunnels, no developer machine involvement
- Developer's only touchpoint is reviewing the PR in ADO/GitHub
- Why: simplicity, no install friction, no WebSocket complexity, proven pattern (Devin, Factory AI, Sweep)

### 2. "Code leaving the org" — Solved by deployment, not architecture
- Default: SaaS hosted in our Azure — code passes through our containers + Claude API
- Enterprise option (future): same Docker image deployed in customer's own VPC/subscription
- Code always reaches Claude API regardless (required for AI generation) — this is the real trust boundary
- Platform never persists source code — ephemeral /tmp only, deleted after run

### 3. BYOK — Each project brings its own Claude API key
- Stored encrypted in Azure Key Vault via project connection settings
- No shared rate limits — zero contention between projects
- Platform is pure orchestration + cheap compute (95% idle, waiting on Claude)
- Scaling is trivial: 100 concurrent projects = 100 lightweight containers barely using CPU

### 4. Platform value = orchestration, not compute
- The platform provides: workflow engine, skills injection, gate policies, multi-tool integration, UI
- Compute cost is negligible — containers mostly wait on external APIs
- Real cost is Claude API tokens — paid by each project via their own key
- This makes the platform extremely cheap to run at scale

### 5. No local execution option
- If a developer wants local control → they use Claude Code CLI directly (different product)
- This SaaS is for automated, unattended workflows — not interactive coding
- Clean separation: SaaS = automation, CLI = interactive

### 6. Scaling model
- Azure Container Apps with auto-scale (scale to zero when idle)
- Each run is stateless: clone → work → push → cleanup /tmp
- No shared disk, no persistent volumes needed
- Queue-worker pattern: runs queue up, containers scale out, drain, scale back

---

## Implementation Phases

### Phase 1 — Foundation
- DB models + Alembic migrations
- Org + member management (access only)
- Project + project member management
- Basic session auth

### Phase 2 — Connections
- Project-level connection CRUD (Atlassian, ADO, GitHub, Claude API)
- Connection test endpoint per type
- Encrypted credential storage (Azure Key Vault)
- BYOK: each project configures own Claude API key + model preference

### Phase 3 — Skills System
- Skills repo registration + sync per project
- Agent profile CRUD per project
- `load_skills_node` — loads agent profile from project skills repo at runtime

### Phase 4 — Workflow Engine
- Workflow template builder per project
- Dynamic graph construction from template
- Gate policy enforcement
- Parallel epic execution

### Phase 5 — ADO MCP
- Local ADO MCP stdio client
- Replace raw REST in rules + PR creation
- Branch creation via MCP

### Phase 6 — Advanced
- Webhook triggers (Jira + ADO)
- Skill testing against mock tickets
- Cost tracking dashboard per project
- Run notifications (email / Teams)

---

## Frontend Changes Required

- Org page — user management only
- Project switcher
- Project settings:
  - Connections (Jira, ADO, GitHub, Claude API)
  - Skills repo (connect repo, browse available skills)
  - Workflow builder (drag step types, map skills to each step, set gates)
- Workflow builder UI:
  - Step palette: [PLAN] [DEV] [REVIEW] [TEST]
  - Drag into flow → assign skill from dropdown (populated from skills repo)
  - Toggle gate_after per step
  - Preview skill description + model on hover
- Run page — start run with selected workflow, SSE stream showing progress per step
- Project dashboard — shared run history for all project members
- Cost/token usage per project
