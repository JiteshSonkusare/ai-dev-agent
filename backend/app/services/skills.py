import json

import httpx

from app.services.ado import AdoMcpService
from app.services.github import GitHubService


class SkillsService:
    """Fetches skills, rules, agents, and manifest from a skills repo."""

    def __init__(self, connection_type: str, config: dict):
        self._type = connection_type
        self._config = config

    async def fetch_file(self, path: str, branch: str = "main") -> str:
        if self._type == "azure_devops":
            svc = AdoMcpService(
                org_url=self._config["base_url"],
                pat=self._config["pat"],
                project=self._config["project_name"],
            )
            try:
                return await svc.get_file(self._config["repo_name"], path, branch)
            finally:
                await svc.close()
        elif self._type == "github":
            owner = self._config["owner"]
            repo = self._config["repo_name"]
            token = self._config["pat"]
            url = f"https://api.github.com/repos/{owner}/{repo}/contents{path}?ref={branch}"
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, headers={
                    "Authorization": f"token {token}",
                    "Accept": "application/vnd.github.v3.raw",
                })
                resp.raise_for_status()
                return resp.text
        raise ValueError(f"Unsupported connection type: {self._type}")

    async def fetch_manifest(self, manifest_path: str, branch: str = "main") -> dict:
        content = await self.fetch_file(manifest_path, branch)
        return json.loads(content)

    async def fetch_skills_for_agent(self, agent_profile: dict, app_type: str, branch: str = "main") -> str:
        """Fetch all skill files for an agent profile, resolving {app_type} variables."""
        combined = []
        for path_template in agent_profile.get("skills_paths", []):
            path = path_template.replace("{app_type}", app_type)
            try:
                content = await self.fetch_file(path, branch)
                combined.append(f"# {path}\n\n{content}")
            except Exception:
                pass
        return "\n\n---\n\n".join(combined)
