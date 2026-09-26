"""Execute tool calls from the Claude agent loop."""

import asyncio
import os
from pathlib import Path

from typing import Optional

from app.services.git import GitService
from app.services.github import GitHubService


class ToolExecutor:
    """Executes tool calls within a sandboxed workspace."""

    def __init__(
        self,
        workspace_path: str,
        git_service: GitService,
        github_service: GitHubService,
        repo_owner: str,
        repo_name: str,
        branch_name: str,
        issue_number: int,
    ):
        self._workspace = workspace_path
        self._git = git_service
        self._github = github_service
        self._owner = repo_owner
        self._repo = repo_name
        self._branch = branch_name
        self._issue = issue_number
        self._pr_number: Optional[int] = None  # set after PR creation

    def _safe_path(self, rel_path: str) -> str:
        """Resolve path within workspace, blocking directory traversal."""
        resolved = Path(self._workspace).joinpath(rel_path).resolve()
        if not str(resolved).startswith(str(Path(self._workspace).resolve())):
            raise ValueError(f"Path traversal blocked: {rel_path}")
        return str(resolved)

    async def execute(self, tool_name: str, tool_input: dict) -> str:
        """Dispatch a tool call and return the result as a string."""
        try:
            handler = getattr(self, f"_tool_{tool_name}", None)
            if not handler:
                return f"Error: Unknown tool '{tool_name}'"
            return await handler(tool_input)
        except Exception as e:
            return f"Error: {type(e).__name__}: {str(e)}"

    # ── Filesystem tools ─────────────────────────────────────────────────

    async def _tool_read_file(self, inp: dict) -> str:
        path = self._safe_path(inp["path"])
        if not os.path.isfile(path):
            return f"Error: File not found: {inp['path']}"
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        size = len(content)
        if size > 100_000:
            content = content[:100_000] + f"\n\n... (truncated, total {size} chars)"
        return content

    async def _tool_write_file(self, inp: dict) -> str:
        path = self._safe_path(inp["path"])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(inp["content"])
        return f"File written: {inp['path']} ({len(inp['content'])} chars)"

    async def _tool_list_files(self, inp: dict) -> str:
        rel = inp.get("path", ".") or "."
        path = self._safe_path(rel)
        if not os.path.isdir(path):
            return f"Error: Directory not found: {rel}"
        entries = []
        for entry in sorted(os.listdir(path)):
            full = os.path.join(path, entry)
            entries.append(f"{entry}/" if os.path.isdir(full) else entry)
        return "\n".join(entries) if entries else "(empty directory)"

    async def _tool_search_files(self, inp: dict) -> str:
        query = inp["query"]
        rel_path = inp.get("path", ".") or "."
        file_pattern = inp.get("file_pattern", "")
        search_dir = self._safe_path(rel_path)

        cmd = ["grep", "-rn", "--include", file_pattern, "--", query, search_dir] if file_pattern else \
              ["grep", "-rn", "--", query, search_dir]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
            result = stdout.decode(errors="replace")
            # Make paths relative to workspace
            result = result.replace(self._workspace + os.sep, "")
            lines = result.strip().split("\n")
            if len(lines) > 50:
                return "\n".join(lines[:50]) + f"\n\n... ({len(lines)} total matches)"
            return result.strip() if result.strip() else "No matches found."
        except asyncio.TimeoutError:
            return "Error: Search timed out after 30 seconds."

    # ── Shell ────────────────────────────────────────────────────────────

    async def _tool_run_command(self, inp: dict) -> str:
        command = inp["command"]
        blocked = ["rm -rf /", "sudo", "mkfs", "dd if=", ":(){", "fork bomb"]
        if any(b in command.lower() for b in blocked):
            return f"Error: Blocked command: {command}"

        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                cwd=self._workspace,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
            out = stdout.decode(errors="replace")
            err = stderr.decode(errors="replace")
            result = f"Exit code: {proc.returncode}\n"
            if out:
                result += f"stdout:\n{out[:5000]}\n"
            if err:
                result += f"stderr:\n{err[:2000]}"
            return result.strip()
        except asyncio.TimeoutError:
            return "Error: Command timed out after 120 seconds."

    # ── Git tools ────────────────────────────────────────────────────────

    async def _tool_git_commit(self, inp: dict) -> str:
        rc, output = await self._git.add_and_commit(self._workspace, inp["message"])
        return output if rc == 0 else f"Error (rc={rc}): {output}"

    async def _tool_git_push(self, _inp: dict) -> str:
        rc, output = await self._git.push(self._workspace, self._branch)
        return f"Pushed to origin/{self._branch}" if rc == 0 else f"Error (rc={rc}): {output}"

    # ── GitHub API tools ─────────────────────────────────────────────────

    async def _tool_create_pull_request(self, inp: dict) -> str:
        base = inp.get("base_branch", "main")
        pr = await self._github.create_pull_request(
            self._owner, self._repo, self._branch, base, inp["title"], inp["body"],
        )
        self._pr_number = pr["number"]
        return f"PR #{pr['number']} created: {pr['html_url']}"

    async def _tool_get_pr_diff(self, inp: dict) -> str:
        pr_num = inp.get("pr_number", self._pr_number)
        if not pr_num:
            return "Error: No PR number provided and no PR has been created yet."
        files = await self._github.get_pull_request_diff(self._owner, self._repo, pr_num)
        lines = []
        for f in files[:20]:
            status = f.get("status", "")
            lines.append(f"{status}: {f['filename']} (+{f.get('additions', 0)} -{f.get('deletions', 0)})")
            if f.get("patch"):
                patch = f["patch"][:1000]
                lines.append(patch)
            lines.append("")
        return "\n".join(lines) if lines else "No file changes found."

    async def _tool_merge_pull_request(self, inp: dict) -> str:
        pr_num = inp.get("pr_number", self._pr_number)
        if not pr_num:
            return "Error: No PR number provided."
        result = await self._github.merge_pull_request(self._owner, self._repo, pr_num)
        return f"PR #{pr_num} merged. SHA: {result.get('sha', 'unknown')}"

    async def _tool_get_pipeline_status(self, inp: dict) -> str:
        branch = inp.get("branch", "main")
        status = await self._github.get_pipeline_status(self._owner, self._repo, branch)
        return (
            f"Pipeline: {status['status']}\n"
            f"Conclusion: {status.get('conclusion', 'N/A')}\n"
            f"Name: {status.get('name', 'N/A')}\n"
            f"URL: {status.get('html_url', 'N/A')}"
        )

    async def _tool_close_issue(self, inp: dict) -> str:
        comment = inp.get("comment", "")
        await self._github.close_issue(self._owner, self._repo, self._issue, comment)
        return f"Issue #{self._issue} closed."
