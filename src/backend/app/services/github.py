import httpx


class GitHubService:
    """GitHub API service for repo operations, PRs, pipelines, and issues."""

    def __init__(self, token: str, base_url: str = "https://api.github.com"):
        self._token = token
        self._base_url = base_url.rstrip("/")
        self._headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
        }

    async def create_pull_request(self, owner: str, repo: str, head: str, base: str, title: str, body: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self._base_url}/repos/{owner}/{repo}/pulls",
                headers=self._headers,
                json={"head": head, "base": base, "title": title, "body": body},
            )
            resp.raise_for_status()
            return resp.json()

    async def get_repo(self, owner: str, repo: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self._base_url}/repos/{owner}/{repo}",
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()

    def get_clone_url(self, owner: str, repo: str) -> str:
        return f"https://x-access-token:{self._token}@github.com/{owner}/{repo}.git"

    async def get_pull_request_diff(self, owner: str, repo: str, pr_number: int) -> list[dict]:
        """Get files changed in a PR with diffs."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self._base_url}/repos/{owner}/{repo}/pulls/{pr_number}/files",
                headers=self._headers,
                params={"per_page": 100},
            )
            resp.raise_for_status()
            return resp.json()

    async def merge_pull_request(self, owner: str, repo: str, pr_number: int, merge_method: str = "squash") -> dict:
        """Merge a PR."""
        async with httpx.AsyncClient() as client:
            resp = await client.put(
                f"{self._base_url}/repos/{owner}/{repo}/pulls/{pr_number}/merge",
                headers=self._headers,
                json={"merge_method": merge_method},
            )
            resp.raise_for_status()
            return resp.json()

    async def get_pipeline_status(self, owner: str, repo: str, branch: str = "main") -> dict:
        """Get latest GitHub Actions workflow run for a branch."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self._base_url}/repos/{owner}/{repo}/actions/runs",
                headers=self._headers,
                params={"branch": branch, "per_page": 1},
            )
            resp.raise_for_status()
            data = resp.json()
            runs = data.get("workflow_runs", [])
            if not runs:
                return {"status": "no_runs", "conclusion": None}
            run = runs[0]
            return {
                "status": run.get("status", "unknown"),
                "conclusion": run.get("conclusion"),
                "html_url": run.get("html_url", ""),
                "name": run.get("name", ""),
            }

    async def close_issue(self, owner: str, repo: str, issue_number: int, comment: str = "") -> dict:
        """Close a GitHub issue with an optional summary comment."""
        async with httpx.AsyncClient() as client:
            if comment:
                await client.post(
                    f"{self._base_url}/repos/{owner}/{repo}/issues/{issue_number}/comments",
                    headers=self._headers,
                    json={"body": comment},
                )
            resp = await client.patch(
                f"{self._base_url}/repos/{owner}/{repo}/issues/{issue_number}",
                headers=self._headers,
                json={"state": "closed"},
            )
            resp.raise_for_status()
            return resp.json()
