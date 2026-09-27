"""Claude API tool definitions for the agent worker."""

AGENT_TOOLS = [
    {
        "name": "read_file",
        "description": "Read the contents of a file from the repository. Returns the file content as text.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path relative to the repository root, e.g. 'src/index.ts'"}
            },
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": "Create or overwrite a file in the repository with the given content.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path relative to the repository root"},
                "content": {"type": "string", "description": "The full file content to write"},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "list_files",
        "description": "List files and directories at the given path. Returns names with '/' suffix for directories.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Directory path relative to repo root. Use '' or '.' for root.", "default": "."}
            },
            "required": [],
        },
    },
    {
        "name": "search_files",
        "description": "Search for text in files across the repository using grep. Returns matching lines with file paths.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Text or regex pattern to search for"},
                "path": {"type": "string", "description": "Directory to search in (relative to repo root). Defaults to entire repo.", "default": "."},
                "file_pattern": {"type": "string", "description": "File glob pattern to filter, e.g. '*.ts' or '*.py'", "default": ""},
            },
            "required": ["query"],
        },
    },
    {
        "name": "run_command",
        "description": "Execute a shell command in the repository workspace. Use for running tests, builds, linters. Timeout: 120 seconds.",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Shell command to execute, e.g. 'npm test' or 'dotnet build'"}
            },
            "required": ["command"],
        },
    },
    {
        "name": "git_commit",
        "description": "Stage all changes and create a git commit with the given message.",
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "Commit message"}
            },
            "required": ["message"],
        },
    },
    {
        "name": "git_push",
        "description": "Push the current branch to the remote origin.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "create_pull_request",
        "description": "Create a pull request on GitHub from the current feature branch to the base branch.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "PR title"},
                "body": {"type": "string", "description": "PR description in markdown"},
                "base_branch": {"type": "string", "description": "Target branch to merge into, e.g. 'main'", "default": "main"},
            },
            "required": ["title", "body"],
        },
    },
    {
        "name": "get_pr_diff",
        "description": "Get the file changes (diff) of a pull request for review purposes.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pr_number": {"type": "integer", "description": "Pull request number"}
            },
            "required": ["pr_number"],
        },
    },
    {
        "name": "merge_pull_request",
        "description": "Merge a pull request on GitHub.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pr_number": {"type": "integer", "description": "Pull request number"}
            },
            "required": ["pr_number"],
        },
    },
    {
        "name": "get_pipeline_status",
        "description": "Check the status of the latest GitHub Actions workflow run for a branch.",
        "input_schema": {
            "type": "object",
            "properties": {
                "branch": {"type": "string", "description": "Branch name to check pipeline for", "default": "main"}
            },
            "required": [],
        },
    },
    {
        "name": "close_issue",
        "description": "Close the GitHub issue with an optional summary comment.",
        "input_schema": {
            "type": "object",
            "properties": {
                "comment": {"type": "string", "description": "Summary comment to add before closing", "default": ""}
            },
            "required": [],
        },
    },
]
