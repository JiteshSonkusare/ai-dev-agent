# 🚀 MVP Implementation Plan

**AI Workflow Automation Platform (React Dashboard + LangGraph Backend)**

---

# 📌 1. Overview

This MVP is a **dashboard-driven AI workflow system** where:

* User enters a **Jira Epic**
* System runs an **automated workflow**
* Uses **Claude API for reasoning**
* Performs:

  * Technical planning
  * Task creation
  * Development
  * Build & test
  * PR creation
  * PR review

No webhook required. Fully **manual trigger via dashboard**.

---

# 🧱 2. Architecture

```text
React Dashboard (Frontend)
        ↓
FastAPI Backend (API Layer)
        ↓
LangGraph Workflow Engine
        ↓
Claude API + Jira API + ADO API
```

---

# 🖥️ 3. Frontend (React Dashboard)

## Tech Stack

* React + TypeScript
* Vite
* Axios
* Basic UI (Eufemia / Material UI optional)

---

## Pages

### 1. 🔐 Connect Jira

* Button: "Connect Jira"
* Redirects to OAuth
* Shows connection status

---

### 2. ▶️ Run Workflow

* Input: Epic ID (e.g. `EPIC-123`)
* Button: "Run Workflow"

---

### 3. 📊 Workflow Status

* Current Step
* Logs
* Created Jira Tasks
* PR Link
* Status (Running / Failed / Completed)

---

## API Calls

```text
POST /auth/jira/connect
GET  /auth/jira/callback

POST /workflow/run
GET  /workflow/status/{run_id}
```

---

# ⚙️ 4. Backend (FastAPI)

## Tech Stack

* Python
* FastAPI
* LangGraph
* httpx / requests
* Pydantic
* PostgreSQL (or SQLite for MVP)

---

## Project Structure

```text
app/
  api/
    auth.py
    workflow.py

  graph/
    workflow.py
    state.py
    nodes/

  services/
    jira_client.py
    ado_client.py
    claude_client.py
    build_runner.py

  auth/
    jira_oauth.py
    token_store.py

  prompts/
    skills/
    dev/
    review/

  rules/
    dotnet-api.md
    react-app.md
    worker-service.md
```

---

# 🔐 5. Jira OAuth Flow

## First Time

1. User clicks "Connect Jira"
2. Redirect to Atlassian OAuth
3. Callback to backend
4. Store:

   * access_token
   * refresh_token

## Later

* Auto refresh token
* No login required

---

# 🧠 6. LangGraph Workflow

## State Model

```json
{
  "epic_key": "",
  "epic_data": {},
  "tech_tasks": [],
  "impl_plan": {},
  "build_status": "",
  "test_status": "",
  "pr_url": "",
  "review_comments": [],
  "status": ""
}
```

---

## Workflow Steps

```text
1. Read Epic
2. Technical Planning
3. Create Jira Tasks
4. Read Tasks
5. Implementation Plan
6. Development
7. Build
8. Test
9. Verify
10. Raise PR
11. Review PR
```

---

## Graph Structure

```text
START
 → read_epic
 → tech_planning
 → create_jira_tasks
 → read_tasks
 → implementation_plan
 → develop
 → build
 → test
 → verify
 → raise_pr
 → review_pr
 → END
```

---

# 🧩 7. Node Responsibilities

## 1. read_epic

* Call Jira API
* Fetch Epic details

---

## 2. tech_planning

* Load rules
* Call Claude
* Generate task breakdown

---

## 3. create_jira_tasks

* Create subtasks via Jira API

---

## 4. implementation_plan

* Claude generates step-by-step plan

---

## 5. develop

* Claude generates code
* Apply changes locally or repo

---

## 6. build

* Run build command (dotnet / npm etc.)

---

## 7. test

* Run unit tests

---

## 8. verify

* Check success/failure

---

## 9. raise_pr

* Use Azure DevOps API
* Create branch + PR

---

## 10. review_pr

* Claude reviews diff
* Add inline comments

---

# 🤖 8. Claude Integration

## Pattern

Each node:

```python
call_claude(
  system_prompt=loaded_prompt,
  input=context,
  tools=[optional]
)
```

---

## Prompts

Stored in:

```text
prompts/
  skills/
  dev/
  review/
```

---

## Rules

Loaded dynamically:

```text
rules/
  dotnet-api.md
  react-app.md
```

---

# 🔌 9. Tool Integrations

## Jira

* Read epic
* Create tasks

## Azure DevOps

* Create PR
* Add comments

## Local Build Tools

* dotnet build
* npm build
* test runners

---

# 📦 10. Deployment

## Option 1 (Recommended MVP)

**Azure App Service**

* Deploy FastAPI backend
* Serve React build

---

## Option 2

**Azure Container Apps**

* Dockerized deployment

---

## Required Services

* Azure App Service
* Azure Key Vault (optional)
* PostgreSQL / SQLite
* Claude API key

---

# 🔐 11. Secrets

Store securely:

* Jira OAuth tokens
* Claude API key
* ADO credentials

---

# 📊 12. Logging & Monitoring

For MVP:

* Console logs
* Store workflow logs in DB

Later:

* Azure Application Insights

---

# 🚀 13. Execution Flow (User View)

```text
User opens dashboard
→ clicks Connect Jira (first time)
→ enters Epic ID
→ clicks Run

System:
→ reads Epic
→ creates tasks
→ develops code
→ builds & tests
→ raises PR
→ reviews PR

User:
→ sees logs + PR link
```

---

# 🧠 14. Future Enhancements

* Add webhook trigger
* Add retry/fix loop
* Add multi-repo support
* Add role-based access
* Add workflow builder UI
* Add multi-tenant support

---

# ✅ Final Summary

This MVP gives you:

* Manual trigger dashboard
* End-to-end automation
* Claude-powered reasoning
* Jira + ADO integration
* Deployable system

---

**You are building the foundation of a scalable AI workflow platform.**
