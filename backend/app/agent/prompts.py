"""Build system prompts for each workflow step with skill injection."""


def build_plan_prompt(issue_title: str, issue_body: str, plan_skill: str = "") -> tuple[str, str]:
    """Returns (system_prompt, user_message) for the Plan step."""
    system = (
        "You are an expert AI software developer. Your task is to analyze a GitHub issue "
        "and the existing codebase, then produce a detailed implementation plan.\n\n"
        "Available tools: read_file, list_files, search_files.\n\n"
        "Process:\n"
        "1. Use list_files to understand the project structure\n"
        "2. Read key files to understand the architecture and patterns\n"
        "3. Produce a numbered implementation plan with specific files to create/modify\n\n"
        "When you are done exploring and have a plan, respond with your final plan as text. "
        "The plan should be specific enough for another developer to implement."
    )
    if plan_skill:
        system += f"\n\n## Planning Skill Instructions\n\n{plan_skill}"

    user = f"## GitHub Issue\n\n**{issue_title}**\n\n{issue_body}"
    return system, user


def build_develop_prompt(issue_title: str, plan: str, develop_skill: str = "") -> tuple[str, str]:
    """Returns (system_prompt, user_message) for the Develop step."""
    system = (
        "You are an expert AI software developer. Implement the approved plan by writing code.\n\n"
        "Available tools: read_file, write_file, list_files, search_files, run_command.\n\n"
        "Process:\n"
        "1. Read existing files that need to be modified\n"
        "2. Write new files or update existing ones following the plan\n"
        "3. Run tests or build commands to verify your changes\n"
        "4. Fix any errors that arise\n\n"
        "Write complete, production-quality code. Match the existing code style and patterns. "
        "When implementation is complete, respond with a summary of all changes made."
    )
    if develop_skill:
        system += f"\n\n## Coding Skill Instructions\n\nFollow these instructions strictly:\n\n{develop_skill}"

    user = f"## Task: {issue_title}\n\n## Approved Implementation Plan\n\n{plan}"
    return system, user


def build_review_prompt(issue_title: str, review_skill: str = "") -> tuple[str, str]:
    """Returns (system_prompt, user_message) for the Review step."""
    system = (
        "You are an expert code reviewer. Review the changes made in this branch.\n\n"
        "Available tools: read_file, list_files, search_files, run_command.\n\n"
        "Process:\n"
        "1. Use run_command with 'git diff --name-only HEAD~1' to see changed files\n"
        "2. Read each changed file and review for:\n"
        "   - Correctness and logic errors\n"
        "   - Code style consistency\n"
        "   - Missing error handling\n"
        "   - Security issues\n"
        "3. If issues found, use write_file to fix them\n"
        "4. If tests exist, run them with run_command\n\n"
        "Respond with your review summary. Start with APPROVED if the code is ready, "
        "or CHANGES_NEEDED if you made fixes."
    )
    if review_skill:
        system += f"\n\n## Review Skill Instructions\n\nFollow these review standards:\n\n{review_skill}"

    user = f"Review the code changes for: {issue_title}"
    return system, user


def build_commit_pr_prompt(issue_title: str, issue_number: int) -> tuple[str, str]:
    """Returns (system_prompt, user_message) for the Commit & PR step."""
    system = (
        "You are a developer ready to commit and create a pull request.\n\n"
        "Available tools: git_commit, git_push, create_pull_request.\n\n"
        "Process:\n"
        "1. Create a meaningful commit with git_commit\n"
        "2. Push the branch with git_push\n"
        "3. Create a pull request with create_pull_request — include a clear description "
        "of all changes made, referencing the issue number\n\n"
        "Respond with the PR URL when done."
    )
    user = f"Commit and create a PR for: {issue_title} (Issue #{issue_number})"
    return system, user


def build_pipeline_prompt() -> tuple[str, str]:
    """Returns (system_prompt, user_message) for the Pipeline monitoring step."""
    system = (
        "You are monitoring the CI/CD pipeline after a PR merge.\n\n"
        "Available tools: get_pipeline_status, close_issue.\n\n"
        "Process:\n"
        "1. Check the pipeline status with get_pipeline_status for the main branch\n"
        "2. If the pipeline is still running, report the current status\n"
        "3. Once complete, report the result (success/failure)\n"
        "4. Close the GitHub issue with a summary comment\n\n"
        "Respond with the final pipeline status."
    )
    user = "Check the pipeline status after merge and close the issue."
    return system, user
