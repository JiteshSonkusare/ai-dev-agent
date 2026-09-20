import asyncio
import json
import os
from typing import Any


class AdoMcpService:
    """Azure DevOps MCP client — spawns @azure-devops/mcp as stdio subprocess."""

    def __init__(self, org_url: str, pat: str, project: str):
        self._org_url = org_url
        self._org_name = org_url.rstrip("/").split("/")[-1]
        self._pat = pat
        self._project = project
        self._process: asyncio.subprocess.Process = None
        self._request_id = 0

    async def _ensure_process(self) -> asyncio.subprocess.Process:
        if self._process is None or self._process.returncode is not None:
            self._process = await asyncio.create_subprocess_exec(
                "npx", "-y", "@anthropic-ai/azure-devops-mcp", self._org_name,
                env={"AZURE_DEVOPS_PAT": self._pat, **os.environ},
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        return self._process

    async def _call(self, method: str, params: dict) -> dict:
        proc = await self._ensure_process()
        self._request_id += 1
        request = {"jsonrpc": "2.0", "id": self._request_id, "method": method, "params": params}
        proc.stdin.write((json.dumps(request) + "\n").encode())
        await proc.stdin.drain()

        line = await proc.stdout.readline()
        return json.loads(line.decode()) if line else {}

    async def get_file(self, repo: str, path: str, branch: str = "main") -> str:
        result = await self._call("tools/call", {
            "name": "get_file_contents",
            "arguments": {"repositoryId": repo, "path": path, "branch": branch},
        })
        return result.get("result", {}).get("content", [{}])[0].get("text", "")

    async def create_pull_request(self, repo: str, source_branch: str, target_branch: str, title: str, description: str) -> dict:
        result = await self._call("tools/call", {
            "name": "create_pull_request",
            "arguments": {
                "repositoryId": repo,
                "sourceRefName": f"refs/heads/{source_branch}",
                "targetRefName": f"refs/heads/{target_branch}",
                "title": title,
                "description": description,
            },
        })
        return result.get("result", {})

    async def close(self) -> None:
        if self._process and self._process.returncode is None:
            self._process.terminate()
            await self._process.wait()
