#!/usr/bin/env python3
"""Persistent JSON-lines OCR worker for English Tutor.

The model is loaded once, then each stdin line is a request:
  {"id": "...", "path": "/absolute/file.pdf"}
A single JSON response is emitted on stdout. Library logs are redirected to stderr
so stdout stays machine-readable for the Node process.
"""

from __future__ import annotations

import contextlib
import json
import os
from pathlib import Path
import sys
import traceback

SERVER_ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = Path(
    os.environ.get(
        "PADDLEOCR_VL_MODEL_DIR",
        str(SERVER_ROOT / "models" / "PaddleOCR-VL-1.6"),
    )
).resolve()
MODEL_REPO = "PaddlePaddle/PaddleOCR-VL-1.6"
DEVICE = os.environ.get("OCR_DEVICE", "gpu")
ENGINE = os.environ.get("OCR_ENGINE", "transformers")


def _extract_markdown(result) -> str:
    """Handle PaddleOCR result shapes across recent 3.x releases."""
    markdown = getattr(result, "markdown", None)
    if isinstance(markdown, dict):
        for key in ("markdown_texts", "text", "markdown_text"):
            value = markdown.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        values = [value for value in markdown.values() if isinstance(value, str) and value.strip()]
        if values:
            return "\n\n".join(values).strip()

    payload = getattr(result, "json", None)
    if isinstance(payload, dict):
        root = payload.get("res", payload)
        if isinstance(root, dict):
            parsing = root.get("parsing_res_list") or root.get("layout_parsing_result") or []
            if isinstance(parsing, list):
                blocks = []
                for block in parsing:
                    if not isinstance(block, dict):
                        continue
                    content = block.get("block_content") or block.get("content") or block.get("text")
                    if isinstance(content, str) and content.strip():
                        blocks.append(content.strip())
                if blocks:
                    return "\n\n".join(blocks)

    return ""


def _load_pipeline():
    if not (MODEL_DIR / "config.json").exists():
        raise RuntimeError(
            f"Model not found at {MODEL_DIR}. Run `cd server && .venv-ocr/bin/python ocr/download_model.py`."
        )

    # PaddleOCR and Transformers may emit banners/logs to stdout. Keep protocol clean.
    with contextlib.redirect_stdout(sys.stderr):
        from paddleocr import PaddleOCRVL

        kwargs = {
            "pipeline_version": "v1.6",
            "engine": ENGINE,
            "vl_rec_model_dir": str(MODEL_DIR),
            "device": DEVICE,
        }
        return PaddleOCRVL(**kwargs)


def _recognize(pipeline, input_path: str) -> tuple[str, int]:
    path = Path(input_path).resolve()
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"OCR input does not exist: {path}")

    pages = []
    with contextlib.redirect_stdout(sys.stderr):
        output = pipeline.predict(input=str(path))
        for result in output:
            text = _extract_markdown(result)
            if text:
                pages.append(text)

    combined = "\n\n--- PAGE BREAK ---\n\n".join(pages).strip()
    if len(combined) < 10:
        raise RuntimeError("PaddleOCR-VL returned too little readable text for this document.")
    return combined, len(pages)


def _respond(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> int:
    try:
        pipeline = _load_pipeline()
    except Exception as exc:  # startup error is useful in Node stderr
        traceback.print_exc(file=sys.stderr)
        return 2

    for raw_line in sys.stdin:
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        request_id = None
        try:
            request = json.loads(raw_line)
            request_id = request.get("id")
            text, pages = _recognize(pipeline, request["path"])
            _respond(
                {
                    "id": request_id,
                    "ok": True,
                    "text": text,
                    "pages": pages,
                    "model": MODEL_REPO,
                    "device": DEVICE,
                    "engine": ENGINE,
                }
            )
        except Exception as exc:
            traceback.print_exc(file=sys.stderr)
            _respond({"id": request_id, "ok": False, "error": str(exc)})

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
