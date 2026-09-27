-- AI DevAgent Database Schema
-- Microsoft SQL Server (Azure SQL compatible)
-- Run this script to create all tables for a fresh deployment

CREATE TABLE users (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(512) NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    github_username VARCHAR(255) NULL,
    github_email VARCHAR(255) NULL,
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE sessions (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at DATETIMEOFFSET NOT NULL,
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_sessions_token ON sessions(token);

CREATE TABLE orgs (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE org_members (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    org_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE connections (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(30) NOT NULL,
    auth_type VARCHAR(20) NOT NULL,
    credentials_encrypted VARCHAR(MAX) NOT NULL,
    base_url VARCHAR(500) NOT NULL DEFAULT '',
    extra_config VARCHAR(MAX) NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'connected',
    label VARCHAR(255) NOT NULL DEFAULT '',
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_connections_user ON connections(user_id);

CREATE TABLE skills (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    skill_type VARCHAR(20) NOT NULL,
    content VARCHAR(MAX) NOT NULL DEFAULT '',
    description VARCHAR(500) NOT NULL DEFAULT '',
    repository VARCHAR(255) NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_skills_user ON skills(user_id);

CREATE TABLE runs (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(36) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    current_step VARCHAR(30) NOT NULL DEFAULT '',
    workspace_path VARCHAR(500) NOT NULL DEFAULT '',
    branch_name VARCHAR(255) NOT NULL DEFAULT '',
    started_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    finished_at DATETIMEOFFSET NULL,
    pr_urls_json VARCHAR(MAX) NOT NULL DEFAULT '[]',
    total_input_tokens INT NOT NULL DEFAULT 0,
    total_output_tokens INT NOT NULL DEFAULT 0,
    model VARCHAR(50) NOT NULL DEFAULT '',
    error VARCHAR(MAX) NOT NULL DEFAULT '',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_runs_user ON runs(user_id);

CREATE TABLE run_steps (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    run_id VARCHAR(36) NOT NULL,
    step_name VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at DATETIMEOFFSET NULL,
    completed_at DATETIMEOFFSET NULL,
    duration_seconds FLOAT NULL,
    tool_calls VARCHAR(MAX) NOT NULL DEFAULT '[]',
    reasoning VARCHAR(MAX) NOT NULL DEFAULT '[]',
    tokens_in INT NOT NULL DEFAULT 0,
    tokens_out INT NOT NULL DEFAULT 0,
    output VARCHAR(MAX) NOT NULL DEFAULT '{}',
    error VARCHAR(MAX) NOT NULL DEFAULT '',
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);
CREATE INDEX ix_run_steps_run ON run_steps(run_id);

CREATE TABLE gates (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    run_id VARCHAR(36) NOT NULL,
    step_name VARCHAR(30) NOT NULL,
    gate_type VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payload VARCHAR(MAX) NOT NULL DEFAULT '{}',
    developer_response VARCHAR(MAX) NOT NULL DEFAULT '',
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    resolved_at DATETIMEOFFSET NULL,
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);
CREATE INDEX ix_gates_run ON gates(run_id);

CREATE TABLE tasks (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    run_id VARCHAR(36) NULL,
    github_issue_number INT NOT NULL,
    github_url VARCHAR(500) NOT NULL,
    title VARCHAR(500) NOT NULL,
    body VARCHAR(MAX) NOT NULL DEFAULT '',
    repo_owner VARCHAR(255) NOT NULL,
    repo_name VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'backlog',
    priority VARCHAR(30) NULL,
    labels VARCHAR(MAX) NOT NULL DEFAULT '[]',
    story_points INT NULL,
    due_date VARCHAR(30) NULL,
    github_status NVARCHAR(30) DEFAULT 'open',
    github_created_at VARCHAR(30) NULL,
    pulled_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (run_id) REFERENCES runs(id)
);
CREATE INDEX ix_tasks_user ON tasks(user_id);
CREATE INDEX ix_tasks_run ON tasks(run_id);

CREATE TABLE task_logs (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    run_id VARCHAR(36) NULL,
    level VARCHAR(10) NOT NULL DEFAULT 'info',
    message VARCHAR(MAX) NOT NULL,
    step_name VARCHAR(30) NULL,
    details VARCHAR(MAX) NULL,
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (run_id) REFERENCES runs(id)
);
CREATE INDEX ix_task_logs_task ON task_logs(task_id);
CREATE INDEX ix_task_logs_run ON task_logs(run_id);
