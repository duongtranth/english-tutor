#!/usr/bin/env python3
"""Download PaddleOCR-VL-1.6 from Hugging Face into server/models/."""

from pathlib import Path
import os

from huggingface_hub import snapshot_download

SERVER_ROOT = Path(__file__).resolve().parents[1]
REPO_ID = os.environ.get("OCR_MODEL_REPO", "PaddlePaddle/PaddleOCR-VL-1.6")
MODEL_DIR = Path(
    os.environ.get(
        "PADDLEOCR_VL_MODEL_DIR",
        str(SERVER_ROOT / "models" / "PaddleOCR-VL-1.6"),
    )
).resolve()


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {REPO_ID} from Hugging Face")
    print(f"Destination: {MODEL_DIR}")
    snapshot_download(
        repo_id=REPO_ID,
        local_dir=str(MODEL_DIR),
        local_dir_use_symlinks=False,
        resume_download=True,
    )
    print("Model download complete.")


if __name__ == "__main__":
    main()
