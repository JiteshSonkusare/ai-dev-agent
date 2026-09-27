# Application Flows

## 1. Authentication Flow

```
                    ┌──────────────────────┐
                    │    Registration      │
                    │  (creates org+admin) │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Login Page         │
                    │  org_name + email    │
                    │  + password          │
                    └──────────┬───────────┘
                               │
              ┌────────────────▼─────────────────┐
              │  Backend validates:              │
              │  1. Org exists                   │
              │  2. User exists in org           │
              │  3. Password matches (PBKDF2)    │
              └────────────────┬─────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Session token       │
                    │  (24h expiry)        │
                    │  stored in DB +      │
                    │  localStorage        │
                    └──────────────────────┘
```

**User-Org model:** Same email can exist in multiple orgs. Login requires org name + email + password. Admin creates users within their org.

## 2. Agent Workflow (LangGraph StateGraph)

```
┌─────────┐    ┌──────┐    ┌───────────┐    ┌─────────┐    ┌────────┐    ┌───────────┐    ┌────────────┐    ┌──────────┐    ┌────────┐
│  SETUP  │───▶│ PLAN │───▶│ GATE:PLAN │───▶│ DEVELOP │───▶│ REVIEW │───▶│ COMMIT+PR │───▶│ GATE:MERGE │───▶│ PIPELINE │───▶│ FINISH │
└────┬────┘    └──┬───┘    └─────┬─────┘    └────┬────┘    └────────┘    └─────┬─────┘    └──────┬─────┘    └──────────┘    └────────┘
     │            │              │                │                             │                 │
     │ error      │ error        │ rejected       │ error                       │ error           │ rejected
     └────────────┴──────────────┴────────────────┴─────────────────────────────┴─────────────────┴──────────▶ FINISH
```

### Step Details

| Step | What happens | Tools used |
|------|-------------|------------|
| **Setup** | Load task, connections, skills. Clone repo. Create feature branch. | (internal) |
| **Plan** | Agent explores codebase and produces implementation plan | `read_file`, `list_files`, `search_files` |
| **Gate: Plan** | Developer reviews and approves/rejects the plan | (human decision) |
| **Develop** | Agent writes code following the approved plan | `read_file`, `write_file`, `list_files`, `search_files`, `run_command` |
| **Review** | Agent self-reviews code against standards | `read_file`, `write_file`, `list_files`, `search_files`, `run_command` |
| **Commit+PR** | Agent commits changes, pushes branch, creates PR | `git_commit`, `git_push`, `create_pull_request` |
| **Gate: Merge** | Developer reviews PR and approves/rejects merge | (human decision) |
| **Pipeline** | Merge PR, monitor GitHub Actions, close issue | `get_pipeline_status`, `close_issue` |
| **Finish** | Update task status, cleanup workspace | (internal) |

## 3. Claude tool_use Agent Loop

Each workflow step runs this loop:

```
                    ┌────────────────────┐
                    │  Send to Claude:   │
                    │  system_prompt +   │
                    │  messages + tools  │
                    └────────┬───────────┘
                             │
                    ┌────────▼───────────┐
                    │  Claude responds   │
                    └────────┬───────────┘
                             │
              ┌──────────────┼─────────────┐
              │              │             │
     ┌────────▼────┐  ┌──────▼─────┐  ┌────▼────────┐
     │ stop_reason │  │ stop_reason│  │ stop_reason │
     │ = end_turn  │  │ = tool_use │  │ = max_tokens│
     └──────┬──────┘  └──────┬─────┘  └──────┬──────┘
            │                │               │
       Return plan/    Execute tools    Return text
       response        (read_file,     (truncated but
                       write_file,      valid)
                       run_command...)
                            │
                    ┌───────▼───────────┐
                    │  Append results   │
                    │  to messages      │
                    │  (tool_result)    │
                    └───────┬───────────┘
                            │
                            └──── loop back to Claude
```

**Loop limits:** max 100 iterations per step. Each iteration can produce multiple tool calls in a single response.

## 4. Task Lifecycle

```
  GitHub Issue          Pull Tasks          Start Agent          Agent completes
       │                    │                    │                  │
       ▼                    ▼                    ▼                  ▼
   ┌────────┐          ┌─────────┐         ┌────────────┐         ┌──────┐
   │  open  │─────────▶│ backlog │────────▶│in_progress │────────▶│ done │
   └────────┘  fetch   └─────────┘  start  └──────┬─────┘  done   └──────┘
                                                  │
                                          error/  │  rejected/
                                          timeout │  cancelled
                                                  ▼
                                              ┌─────────┐     re-pull
                                              │  error  │──────────▶ backlog
                                              └─────────┘
```

## 5. Gate Approval Flow

```
  Agent reaches gate point
         │
         ▼
  ┌───────────────────┐
  │ Create Gate in DB │
  │ status = pending  │
  └────────┬──────────┘
           │
  ┌────────▼──────────┐     ┌───────────────────────┐
  │ Agent polls DB    │────▶│ Developer sees gate   │
  │ every 5 seconds   │     │ in Progress page UI   │
  └────────┬──────────┘     │ with plan text or     │
           │                │ PR link               │
           │                └─────────┬─────────────┘
           │                          │
           │               ┌──────────▼───────────┐
           │               │  [Approve] [Reject]  │
           │               └──────────┬───────────┘
           │                          │
           │               ┌──────────▼───────────┐
           │               │ Update gate in DB    │
           │               │ status = approved    │
           │               │ or rejected          │
           │               └──────────────────────┘
           │                          │
  ┌────────▼──────────┐               │
  │ Poll detects      │◀──────────────┘
  │ approved/rejected │
  └────────┬──────────┘
           │
      approved: continue to next step
      rejected: go to finish (status = interrupted)
```
