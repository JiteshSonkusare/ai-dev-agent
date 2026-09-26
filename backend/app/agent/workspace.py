"""Workspace lifecycle — create and destroy task workspaces."""

import os
import shutil

from app.core.config import settings


def create_workspace(task_id: str) -> str:
    """Create a fresh workspace directory for a task. Returns the repo path."""
    base = os.path.join(settings.workspace_base_path, f"task-{task_id}")
    # Clean up any leftover workspace from a previous run
    if os.path.exists(base):
        shutil.rmtree(base, ignore_errors=True)
    repo_path = os.path.join(base, "repo")
    os.makedirs(repo_path, exist_ok=True)
    return repo_path


def cleanup_workspace(task_id: str) -> None:
    """Remove the workspace directory after task completion."""
    base = os.path.join(settings.workspace_base_path, f"task-{task_id}")
    if os.path.exists(base):
        shutil.rmtree(base, ignore_errors=True)
