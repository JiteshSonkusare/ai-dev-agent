import asyncio
import os
import shutil
from pathlib import Path
from typing import Optional


async def _run(args: list, cwd: str, env: Optional[dict] = None) -> tuple:
    merged_env = {**os.environ, **(env or {})}
    proc = await asyncio.create_subprocess_exec(
        *args,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=merged_env,
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode, stdout.decode(), stderr.decode()


class GitService:
    def __init__(self, pat: str = "", username: str = "x-token-auth"):
        self._pat = pat
        self._username = username

    def _auth_url(self, repo_url: str) -> str:
        # Skip if URL already has auth (e.g. from GitHubService.get_clone_url)
        if "@" in repo_url:
            return repo_url
        if self._pat and "://" in repo_url:
            protocol, rest = repo_url.split("://", 1)
            return f"{protocol}://{self._username}:{self._pat}@{rest}"
        return repo_url

    async def clone(self, repo_url: str, dest: str, branch: str = "main") -> tuple[int, str]:
        os.makedirs(dest, exist_ok=True)
        url = self._auth_url(repo_url)
        rc, out, err = await _run(
            ["git", "clone", "--branch", branch, "--single-branch", url, "."],
            cwd=dest,
        )
        return rc, err if rc != 0 else out

    async def checkout_new_branch(self, cwd: str, branch: str) -> tuple[int, str]:
        rc, out, err = await _run(["git", "checkout", "-b", branch], cwd=cwd)
        return rc, err if rc != 0 else out

    async def add_and_commit(self, cwd: str, message: str) -> tuple[int, str]:
        await _run(["git", "add", "-A"], cwd=cwd)
        rc, out, err = await _run(["git", "commit", "-m", message], cwd=cwd)
        return rc, err if rc != 0 else out

    async def push(self, cwd: str, branch: str) -> tuple[int, str]:
        rc, out, err = await _run(["git", "push", "origin", branch], cwd=cwd)
        return rc, err if rc != 0 else out

    async def fetch_and_rebase(self, cwd: str, main_branch: str) -> tuple[int, str]:
        await _run(["git", "fetch", "origin", main_branch], cwd=cwd)
        rc, out, err = await _run(["git", "rebase", f"origin/{main_branch}"], cwd=cwd)
        if rc != 0:
            await _run(["git", "rebase", "--abort"], cwd=cwd)
        return rc, err if rc != 0 else out

    async def detect_main_branch(self, cwd: str) -> str:
        rc, out, _ = await _run(["git", "rev-parse", "--verify", "origin/main"], cwd=cwd)
        return "main" if rc == 0 else "master"

    @staticmethod
    def cleanup(path: str) -> None:
        if os.path.exists(path):
            shutil.rmtree(path, ignore_errors=True)
