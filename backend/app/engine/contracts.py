"""
Step type contracts — defines the platform's predefined step types,
their execution modes, and the data they pass between each other.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class StepType(str, Enum):
    PLAN = "plan"
    DEV = "dev"
    REVIEW = "review"
    TEST = "test"


class ExecutionMode(str, Enum):
    ONCE_PER_EPIC = "once_per_epic"
    ONCE_PER_TASK = "once_per_task"


STEP_CONTRACTS: dict[StepType, dict[str, Any]] = {
    StepType.PLAN: {
        "execution_mode": ExecutionMode.ONCE_PER_EPIC,
        "input": "epic_or_story_id",
        "output": "task_ticket_ids",
        "description": "Reads an epic/story, proposes and creates task tickets",
    },
    StepType.DEV: {
        "execution_mode": ExecutionMode.ONCE_PER_TASK,
        "input": "task_ticket_id",
        "output": "pr_url",
        "description": "Implements code for a task and creates a PR",
    },
    StepType.REVIEW: {
        "execution_mode": ExecutionMode.ONCE_PER_TASK,
        "input": "pr_url_and_code",
        "output": "review_decision",
        "description": "Reviews code/PR, returns approve or changes required",
    },
    StepType.TEST: {
        "execution_mode": ExecutionMode.ONCE_PER_TASK,
        "input": "code_and_branch",
        "output": "test_result",
        "description": "Runs tests on the code, returns pass or fail",
    },
}


@dataclass
class WorkflowStep:
    """A single step in a workflow template."""
    order: int
    type: StepType
    skill_path: str
    gate_after: bool = False
    model_override: Optional[str] = None

    @classmethod
    def from_dict(cls, d: dict) -> "WorkflowStep":
        return cls(
            order=d["order"],
            type=StepType(d["type"]),
            skill_path=d["skill_path"],
            gate_after=d.get("gate_after", False),
            model_override=d.get("model_override"),
        )


@dataclass
class SkillBundle:
    """A loaded skill ready for execution."""
    name: str
    description: str
    model: str
    skill_md: str
    references: dict[str, str] = field(default_factory=dict)

    @property
    def system_prompt(self) -> str:
        parts = [self.skill_md]
        for path, content in self.references.items():
            parts.append(f"\n\n---\n# {path}\n\n{content}")
        return "\n".join(parts)


@dataclass
class StepResult:
    """Output from executing a single step."""
    step_order: int
    step_type: StepType
    status: str  # completed | error | gate_pending
    output: dict[str, Any] = field(default_factory=dict)
    tokens_used: dict[str, int] = field(default_factory=lambda: {"input": 0, "output": 0})
    error: Optional[str] = None


@dataclass
class RunContext:
    """Shared context passed through the entire workflow run."""
    run_id: str
    project_id: str
    epic_key: str
    auto_approve: bool
    claude_api_key: str
    claude_model: str
    issue_tracker_type: str
    issue_tracker_config: dict
    code_repo_type: str
    code_repo_config: dict
    skills_repo_config: dict
    task_ids: list[str] = field(default_factory=list)
    pr_urls: list[str] = field(default_factory=list)
    total_input_tokens: int = 0
    total_output_tokens: int = 0
