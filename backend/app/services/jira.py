import httpx


class JiraService:
    def __init__(self, base_url: str, email: str, api_token: str):
        self._base_url = base_url.rstrip("/")
        self._auth = (email, api_token)

    async def get_issue(self, issue_key: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self._base_url}/rest/api/3/issue/{issue_key}",
                auth=self._auth,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_child_issues(self, epic_key: str) -> list[dict]:
        jql = f'"Epic Link" = {epic_key} OR parent = {epic_key}'
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self._base_url}/rest/api/3/search",
                params={"jql": jql, "maxResults": 100},
                auth=self._auth,
            )
            resp.raise_for_status()
            return resp.json().get("issues", [])

    async def create_issue(self, project_key: str, summary: str, description: str, issue_type: str = "Task", parent_key: str = None) -> dict:
        fields = {
            "project": {"key": project_key},
            "summary": summary,
            "description": {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": description}]}]},
            "issuetype": {"name": issue_type},
        }
        if parent_key:
            fields["parent"] = {"key": parent_key}
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self._base_url}/rest/api/3/issue",
                json={"fields": fields},
                auth=self._auth,
            )
            resp.raise_for_status()
            return resp.json()

    async def transition_issue(self, issue_key: str, transition_name: str) -> None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self._base_url}/rest/api/3/issue/{issue_key}/transitions",
                auth=self._auth,
            )
            resp.raise_for_status()
            transitions = resp.json().get("transitions", [])
            tid = next((t["id"] for t in transitions if t["name"].lower() == transition_name.lower()), None)
            if tid:
                await client.post(
                    f"{self._base_url}/rest/api/3/issue/{issue_key}/transitions",
                    json={"transition": {"id": tid}},
                    auth=self._auth,
                )
