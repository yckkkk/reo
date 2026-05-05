#!/usr/bin/env python3
"""Inject a `## Contents` TOC block into each chapter.md.

Rationale: per Anthropic's skill-authoring best practices
(https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices),
reference files longer than 100 lines should have a table of contents
at the top so that a `head -N` preview shows the full heading inventory.
Claude Code may preview a file before reading it fully; without a TOC,
the full scope stays invisible until the entire file is loaded.

Idempotent — HTML-comment markers bracket the injected block so re-runs
replace cleanly without duplicating.
"""
from __future__ import annotations

import re
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent
CHAPTERS = SKILL_ROOT / "chapters"

TOC_START = "<!-- auto-toc:start -->"
TOC_END = "<!-- auto-toc:end -->"
LINE_THRESHOLD = 100


def build_toc_block(md_text: str) -> str:
    headings = re.findall(r"^## (.+)$", md_text, flags=re.MULTILINE)
    seen: set[str] = set()
    unique: list[str] = []
    for raw in headings:
        h = raw.strip()
        if h and h not in seen:
            unique.append(h)
            seen.add(h)
    if not unique:
        return ""
    out = [TOC_START, "## Contents", ""]
    out.extend(f"- {h}" for h in unique)
    out.append("")
    out.append(TOC_END)
    return "\n".join(out) + "\n"


def strip_existing_toc(text: str) -> str:
    return re.sub(
        rf"{re.escape(TOC_START)}.*?{re.escape(TOC_END)}\n*",
        "",
        text,
        flags=re.DOTALL,
    )


def inject(md_path: Path) -> str:
    original = md_path.read_text(encoding="utf-8")
    stripped = strip_existing_toc(original)
    n_lines = len(stripped.splitlines())

    if n_lines < LINE_THRESHOLD:
        if stripped != original:
            md_path.write_text(stripped, encoding="utf-8")
            return f"short ({n_lines} lines), stale TOC removed"
        return f"short ({n_lines} lines), skipped"

    toc = build_toc_block(stripped)
    if not toc:
        return "no ## headings found"

    first_h2 = re.search(r"^## ", stripped, flags=re.MULTILINE)
    if not first_h2:
        return "no ## heading to anchor against"

    idx = first_h2.start()
    new_text = stripped[:idx] + toc + "\n" + stripped[idx:]
    md_path.write_text(new_text, encoding="utf-8")
    h_count = toc.count("\n- ")
    return f"TOC injected ({h_count} headings, {n_lines} lines)"


def main() -> None:
    for chapter_dir in sorted(CHAPTERS.iterdir()):
        md = chapter_dir / "chapter.md"
        if not md.exists():
            continue
        status = inject(md)
        print(f"  {chapter_dir.name}: {status}")


if __name__ == "__main__":
    main()
