import asyncio

import anthropic

_claude_semaphore = asyncio.Semaphore(3)


class ClaudeService:
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6"):
        self._client = anthropic.AsyncAnthropic(api_key=api_key)
        self._model = model

    async def generate(
        self,
        system: str,
        prompt: str,
        max_tokens: int = 8096,
    ) -> tuple[str, dict]:
        async with _claude_semaphore:
            response = await self._client.messages.create(
                model=self._model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": prompt}],
            )
        text = response.content[0].text
        usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        }
        return text, usage

    async def generate_with_history(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 8096,
    ) -> tuple[str, dict]:
        async with _claude_semaphore:
            response = await self._client.messages.create(
                model=self._model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
            )
        text = response.content[0].text
        usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        }
        return text, usage
