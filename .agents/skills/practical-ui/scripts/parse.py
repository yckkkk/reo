#!/usr/bin/env python3
"""
Parallel ZhiPu expert async parser for chapter PDFs.
- Upload each chapter → get task_id
- Poll every 20s until succeeded
- Download result zip (md + images) and unpack into the chapter dir
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error
import zipfile
import io
import mimetypes
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import uuid

API_KEY = os.environ["ZHIPU_API_KEY"]
BASE = "https://open.bigmodel.cn/api/paas/v4"
BUILD = Path(os.environ["BUILD"])
LOG_LOCK = threading.Lock()
LOG_FILE = BUILD / "parse.log"


def log(msg: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    with LOG_LOCK:
        print(line, flush=True)
        with LOG_FILE.open("a") as f:
            f.write(line + "\n")


def multipart_body(file_path: Path, file_type: str, tool_type: str):
    boundary = f"----pui{uuid.uuid4().hex}"
    nl = b"\r\n"
    fname = file_path.name.encode("utf-8")
    with file_path.open("rb") as f:
        file_bytes = f.read()
    body = io.BytesIO()
    # file field
    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="file"; filename="')
    body.write(fname)
    body.write(b'"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(file_bytes)
    body.write(nl)
    # file_type
    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="file_type"\r\n\r\n')
    body.write(file_type.encode())
    body.write(nl)
    # tool_type
    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="tool_type"\r\n\r\n')
    body.write(tool_type.encode())
    body.write(nl)
    body.write(f"--{boundary}--\r\n".encode())
    return body.getvalue(), boundary


def http(method: str, url: str, *, headers=None, body=None, timeout=300):
    req = urllib.request.Request(url, method=method, data=body)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def create_task(chapter_dir: Path) -> str:
    pdf = chapter_dir / "chapter.pdf"
    log(f"{chapter_dir.name}: uploading ({pdf.stat().st_size // (1024*1024)}MB)...")
    body, boundary = multipart_body(pdf, "PDF", "expert")
    code, payload = http(
        "POST",
        f"{BASE}/files/parser/create",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        body=body,
        timeout=600,
    )
    log(f"{chapter_dir.name}: create status={code} body={payload[:300]!r}")
    if code != 200:
        raise RuntimeError(f"create failed: {code} {payload!r}")
    data = json.loads(payload)
    task_id = data.get("task_id") or data.get("id")
    if not task_id:
        raise RuntimeError(f"no task_id in response: {data}")
    return task_id


def poll_task(chapter_dir: Path, task_id: str, max_wait_s: int = 3600) -> dict:
    deadline = time.time() + max_wait_s
    interval = 15
    while time.time() < deadline:
        code, payload = http(
            "GET",
            f"{BASE}/files/parser/result/{task_id}/download_link",
            headers={"Authorization": f"Bearer {API_KEY}"},
            timeout=120,
        )
        if code != 200:
            log(f"{chapter_dir.name}: poll http={code} body={payload[:200]!r}")
            time.sleep(interval)
            continue
        data = json.loads(payload)
        status = data.get("status")
        if status == "succeeded":
            log(f"{chapter_dir.name}: succeeded")
            return data
        if status == "failed":
            raise RuntimeError(f"task failed: {data}")
        log(f"{chapter_dir.name}: {status}, waiting {interval}s...")
        time.sleep(interval)
    raise TimeoutError(f"{chapter_dir.name}: timeout after {max_wait_s}s")


def download_and_unpack(chapter_dir: Path, url: str):
    log(f"{chapter_dir.name}: downloading result...")
    code, payload = http("GET", url, timeout=600)
    if code != 200:
        raise RuntimeError(f"download failed: {code}")
    # Save raw archive for debugging / to know what we got
    raw = chapter_dir / "result.raw"
    raw.write_bytes(payload)
    # Try to open as zip
    try:
        zf = zipfile.ZipFile(io.BytesIO(payload))
        zf.extractall(chapter_dir / "unpacked")
        log(f"{chapter_dir.name}: unpacked zip ({len(zf.namelist())} entries)")
    except zipfile.BadZipFile:
        # Maybe it's a single md file or json — just save raw
        log(f"{chapter_dir.name}: result is not a zip, saved as result.raw")


def process_chapter(chapter_dir: Path):
    try:
        if (chapter_dir / "unpacked").exists():
            log(f"{chapter_dir.name}: already done, skip")
            return chapter_dir.name, "skip"
        task_id = create_task(chapter_dir)
        (chapter_dir / "task_id.txt").write_text(task_id)
        result = poll_task(chapter_dir, task_id)
        url = result.get("parsing_result_url")
        if not url:
            # If format is text, content field is inline
            inline = result.get("content")
            if inline:
                (chapter_dir / "chapter.md").write_text(inline)
                log(f"{chapter_dir.name}: saved inline content ({len(inline)} chars)")
                return chapter_dir.name, "inline"
            raise RuntimeError(f"no result url or content: {result}")
        download_and_unpack(chapter_dir, url)
        return chapter_dir.name, "ok"
    except Exception as e:
        log(f"{chapter_dir.name}: ERROR {e}")
        log(traceback.format_exc())
        return chapter_dir.name, f"error: {e}"


def main():
    chapters = sorted((BUILD / "chapters").iterdir())
    log(f"processing {len(chapters)} chapters")
    results = {}
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(process_chapter, c): c for c in chapters}
        for fut in as_completed(futures):
            name, status = fut.result()
            results[name] = status
    log(f"final: {json.dumps(results, indent=2)}")


if __name__ == "__main__":
    main()
