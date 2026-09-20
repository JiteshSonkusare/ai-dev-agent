"""
Gate handler — manages platform-level gates between workflow steps.
Gates pause execution and wait for human decision via SSE/API.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class GateRequest:
    """A pending gate waiting for human decision."""
    run_id: str
    step_order: int
    step_type: str
    skill_name: str
    summary: str
    options: list[str] = field(default_factory=lambda: ["approve", "reject"])


class GateHandler:
    """
    Manages platform-level gates.
    Uses asyncio.Event to pause execution until a decision arrives via API.
    """

    def __init__(self):
        self._events: dict[str, asyncio.Event] = {}
        self._decisions: dict[str, str] = {}
        self._pending: dict[str, GateRequest] = {}

    async def wait_for_gate(
        self,
        run_id: str,
        step_order: int,
        step_type: str,
        skill_name: str,
        summary: str,
        timeout: Optional[float] = None,
    ) -> str:
        """
        Pause execution and wait for a human decision.
        Returns the decision string (e.g. "approve", "reject").
        Raises TimeoutError if timeout expires.
        """
        gate_key = f"{run_id}:{step_order}"

        event = asyncio.Event()
        self._events[gate_key] = event
        self._pending[gate_key] = GateRequest(
            run_id=run_id,
            step_order=step_order,
            step_type=step_type,
            skill_name=skill_name,
            summary=summary,
        )

        try:
            if timeout:
                await asyncio.wait_for(event.wait(), timeout=timeout)
            else:
                await event.wait()
        except asyncio.TimeoutError:
            self._cleanup(gate_key)
            raise

        decision = self._decisions.pop(gate_key, "approve")
        self._cleanup(gate_key)
        return decision

    def resume(self, run_id: str, step_order: int, decision: str) -> bool:
        """
        Resume a paused gate with a decision.
        Called from the API when user approves/rejects.
        Returns True if gate was found and resumed.
        """
        gate_key = f"{run_id}:{step_order}"
        event = self._events.get(gate_key)
        if not event:
            return False
        self._decisions[gate_key] = decision
        event.set()
        return True

    def resume_by_run(self, run_id: str, decision: str) -> bool:
        """Resume any pending gate for a run (convenience for single-gate flows)."""
        for key, req in self._pending.items():
            if req.run_id == run_id:
                return self.resume(run_id, req.step_order, decision)
        return False

    def get_pending(self, run_id: str) -> Optional[GateRequest]:
        """Get the currently pending gate for a run, if any."""
        for req in self._pending.values():
            if req.run_id == run_id:
                return req
        return None

    def _cleanup(self, gate_key: str) -> None:
        self._events.pop(gate_key, None)
        self._pending.pop(gate_key, None)


gate_handler = GateHandler()
