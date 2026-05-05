#!/usr/bin/env python3
"""Retry failed chapters serially (avoids TLS state contention)."""
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from parse import process_chapter, log  # reuse

BUILD = Path(os.environ["BUILD"])
FAILED = ["04-layout-spacing", "06-copywriting", "07-buttons", "08-forms"]

for name in FAILED:
    chapter = BUILD / "chapters" / name
    if (chapter / "task_id.txt").exists() and (chapter / "unpacked").exists():
        log(f"{name}: already fully done, skip")
        continue
    if (chapter / "task_id.txt").exists():
        log(f"{name}: task already created, skipping upload — main parse will poll")
        continue
    log(f"=== serial retry: {name} ===")
    nm, status = process_chapter(chapter)
    log(f"{nm} retry -> {status}")
    time.sleep(2)

log("retry pass complete")
