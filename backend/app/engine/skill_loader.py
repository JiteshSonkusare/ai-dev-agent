"""
Skill loader — fetches SKILL.md and all referenced files from the skills repo.
Parses frontmatter and extracts reference paths from the skill's STEP 0 section.
"""

from __future__ import annotations

import re
from typing import Optional

from app.engine.contracts import SkillBundle
from app.services.skills import SkillsService


def _parse_frontmatter(content: str) -> dict[str, str]:
    """Extract YAML frontmatter from a SKILL.md file."""
    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return {}
    result = {}
    for line in match.group(1).strip().splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            result[key.strip()] = value.strip().strip('"').strip("'")
    return result


def _extract_reference_paths(skill_md: str, skill_path: str) -> list[str]:
    """
    Extract reference file paths from the SKILL.md content.
    Looks for patterns like:
      - Read `~/.claude/skills/cc-dev/references/detect-application.md`
      - `~/.claude/skills/cc-dev/references/implement.md`

    Normalizes paths relative to the skills repo (strips ~/.claude/skills/ prefix).
    Also handles relative paths like `references/file.md`.
    """
    paths = []

    patterns = [
        re.compile(r"`~/\.claude/skills/([^`]+)`"),
        re.compile(r"`\./references/([^`]+)`"),
        re.compile(r"Read\s+`([^`]+)`"),
    ]

    for pattern in patterns:
        for match in pattern.finditer(skill_md):
            raw = match.group(1)
            if raw.startswith("~/.claude/skills/"):
                raw = raw.replace("~/.claude/skills/", "")
            path = _normalize_ref_path(raw, skill_path)
            if path and path not in paths:
                paths.append(path)

    ref_dir_pattern = re.compile(
        rf"`~?/\.?claude/skills/{re.escape(skill_path)}/([^`]+\.md)`"
    )
    for match in ref_dir_pattern.finditer(skill_md):
        rel = match.group(1)
        full = f"{skill_path}/{rel}"
        if full not in paths:
            paths.append(full)

    numbered_pattern = re.compile(
        r"\d+\.\s+Read\s+`([^`]+)`"
    )
    for match in numbered_pattern.finditer(skill_md):
        raw = match.group(1)
        if raw.startswith("~/.claude/skills/"):
            raw = raw.replace("~/.claude/skills/", "")
        elif not raw.startswith(skill_path):
            raw = f"{skill_path}/{raw}"
        if raw not in paths:
            paths.append(raw)

    return paths


def _normalize_ref_path(raw: str, skill_path: str) -> Optional[str]:
    """Normalize a raw reference path to be relative to skills/ in the repo."""
    if not raw.endswith(".md"):
        return None
    if raw.startswith(skill_path):
        return raw
    if "/" not in raw or raw.startswith("references/") or raw.startswith("_plan-templates/"):
        return f"{skill_path}/{raw}"
    return raw


async def load_skill(
    skills_service: SkillsService,
    skills_path: str,
    skill_path: str,
    branch: str = "main",
) -> SkillBundle:
    """
    Load a complete skill from the skills repo.

    Args:
        skills_service: service for fetching files from the repo
        skills_path: base path in repo where skills live (e.g. "/skills")
        skill_path: skill folder name (e.g. "cc-dev")
        branch: repo branch

    Returns:
        SkillBundle with system prompt and all references loaded
    """
    skill_file = f"{skills_path}/{skill_path}/SKILL.md"
    skill_md = await skills_service.fetch_file(skill_file, branch)

    frontmatter = _parse_frontmatter(skill_md)

    ref_paths = _extract_reference_paths(skill_md, skill_path)

    references: dict[str, str] = {}
    for ref in ref_paths:
        full_path = f"{skills_path}/{ref}" if not ref.startswith(skills_path.lstrip("/")) else f"/{ref}"
        try:
            content = await skills_service.fetch_file(full_path, branch)
            references[ref] = content
        except Exception:
            pass

    return SkillBundle(
        name=frontmatter.get("name", skill_path),
        description=frontmatter.get("description", ""),
        model=frontmatter.get("model", "claude-sonnet-4-6"),
        skill_md=skill_md,
        references=references,
    )


async def discover_skills(
    skills_service: SkillsService,
    skills_path: str,
    branch: str = "main",
) -> list[dict[str, str]]:
    """
    Discover available skills in a repo by listing folders with SKILL.md.
    Returns list of {name, description, model, path} for the workflow builder UI.

    This requires directory listing support — implementation depends on
    the repo provider (ADO file tree API / GitHub contents API).
    """
    raise NotImplementedError(
        "discover_skills requires repo directory listing — "
        "implement per provider (ADO tree API / GitHub contents API)"
    )
