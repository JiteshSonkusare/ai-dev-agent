"""Core Claude tool_use agent loop."""

import logging
from datetime import datetime, timezone
from typing import Callable, Awaitable

import anthropic

from app.agent.tool_handlers import ToolExecutor

logger = logging.getLogger(__name__)


def _extract_text(response) -> str:
    """Extract text content from a Claude response."""
    for block in response.content:
        if hasattr(block, "text"):
            return block.text
    return ""


async def run_agent_loop(
    api_key: str,
    model: str,
    system_prompt: str,
    user_message: str,
    tools: list[dict],
    tool_executor: ToolExecutor,
    on_progress: Callable[[str, dict], Awaitable[None]],
    max_iterations: int = 100,
    base_url: str = "",
) -> dict:
    """
    Run a Claude tool_use agent loop until completion or max iterations.

    Args:
        api_key: Anthropic API key
        model: Model name (e.g. claude-sonnet-4-6)
        system_prompt: System prompt with instructions
        user_message: Initial user message (task description)
        tools: Tool definitions for Claude API
        tool_executor: ToolExecutor instance for executing tool calls
        on_progress: Async callback(event_type, data) for progress reporting
        max_iterations: Safety limit on loop iterations

    Returns:
        dict with status, final_response, total_tokens_in, total_tokens_out
    """
    client_kwargs = {"api_key": api_key}
    if base_url:
        client_kwargs["base_url"] = base_url
    client = anthropic.AsyncAnthropic(**client_kwargs)
    messages = [{"role": "user", "content": user_message}]
    total_in = 0
    total_out = 0

    for iteration in range(max_iterations):
        print(f"[LOOP] iter={iteration} messages={len(messages)}", flush=True)
        try:
            response = await client.messages.create(
                model=model,
                max_tokens=8192,
                system=system_prompt,
                messages=messages,
                tools=tools,
            )
        except anthropic.APIError as e:
            logger.error(f"Claude API error at iteration {iteration}: {e}")
            return {
                "status": "error",
                "final_response": f"Claude API error: {str(e)}",
                "total_tokens_in": total_in,
                "total_tokens_out": total_out,
            }
        except Exception as e:
            logger.error(f"Unexpected error in agent loop at iteration {iteration}: {e}")
            return {
                "status": "error",
                "final_response": f"Agent loop error: {str(e)}",
                "total_tokens_in": total_in,
                "total_tokens_out": total_out,
            }

        # Track tokens
        total_in += response.usage.input_tokens
        total_out += response.usage.output_tokens
        print(f"[LOOP] iter={iteration} stop={response.stop_reason} blocks={[b.type for b in response.content]} in={response.usage.input_tokens} out={response.usage.output_tokens}", flush=True)

        await on_progress("tokens", {
            "input": response.usage.input_tokens,
            "output": response.usage.output_tokens,
        })

        # Report reasoning (text blocks)
        for block in response.content:
            if hasattr(block, "text") and block.text:
                await on_progress("reasoning", {
                    "content": block.text[:2000],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

        # Check if agent is done (end_turn or max_tokens with text content)
        if response.stop_reason in ("end_turn", "max_tokens"):
            final_text = _extract_text(response)
            return {
                "status": "completed",
                "final_response": final_text,
                "total_tokens_in": total_in,
                "total_tokens_out": total_out,
            }

        # Process tool calls
        if response.stop_reason == "tool_use":
            # Add assistant response to messages
            messages.append({"role": "assistant", "content": response.content})

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    # Execute the tool
                    result = await tool_executor.execute(block.name, block.input)

                    # Report progress
                    await on_progress("tool_call", {
                        "tool": block.name,
                        "input": _summarize_input(block.name, block.input),
                        "output": result[:500] if len(result) > 500 else result,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })

            # Feed results back to Claude
            messages.append({"role": "user", "content": tool_results})
        else:
            # Unexpected stop reason
            logger.warning(f"Unexpected stop_reason: {response.stop_reason}")
            return {
                "status": "unexpected_stop",
                "final_response": _extract_text(response),
                "total_tokens_in": total_in,
                "total_tokens_out": total_out,
            }

    # Max iterations reached
    return {
        "status": "max_iterations",
        "final_response": "Agent reached maximum iteration limit.",
        "total_tokens_in": total_in,
        "total_tokens_out": total_out,
    }


def _summarize_input(tool_name: str, tool_input: dict) -> dict:
    """Summarize tool input for progress display — truncate large content."""
    summary = dict(tool_input)
    if tool_name == "write_file" and "content" in summary:
        content = summary["content"]
        summary["content"] = f"({len(content)} chars)" if len(content) > 200 else content
    if tool_name == "run_command":
        pass  # keep command as-is
    return summary
