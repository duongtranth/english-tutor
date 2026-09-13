#!/usr/bin/env bash
set -euo pipefail

SERVER_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SERVER_ROOT"

if [[ -n "${PYTHON_BIN:-}" ]]; then
  PY="$PYTHON_BIN"
else
  PY=""
  for candidate in python3.13 python3.12 python3.11 python3.10 python3.9 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      if "$candidate" - <<'PY' >/dev/null 2>&1
import sys
raise SystemExit(0 if (3, 9) <= sys.version_info[:2] <= (3, 13) else 1)
PY
      then
        PY="$candidate"
        break
      fi
    fi
  done
fi

if [[ -z "$PY" ]]; then
  echo "PaddleOCR-VL requires Python 3.9-3.13. Install Python 3.10+ or run with PYTHON_BIN=/path/to/python bash ocr/setup_ocr.sh" >&2
  exit 1
fi

echo "Using Python: $($PY --version 2>&1)"
"$PY" -m venv .venv-ocr
# shellcheck disable=SC1091
source .venv-ocr/bin/activate

python -m pip install --upgrade pip wheel setuptools

# Use PaddleOCR-VL's local Transformers engine so the VLM weights can be
# downloaded directly from Hugging Face. PaddleOCR still runs the complete
# document pipeline, including layout analysis before VLM recognition.
python -m pip install --upgrade torch torchvision transformers accelerate safetensors pillow huggingface_hub
python -m pip install --upgrade "paddleocr[doc-parser]"

python ocr/download_model.py

cat <<'EOF'

OCR setup complete.
Model: PaddlePaddle/PaddleOCR-VL-1.6 (Hugging Face)
Default device: GPU

Restart the Node backend, then open Tests -> Import test.
To force CPU inference:
  OCR_DEVICE=cpu npm run dev

For NVIDIA RTX 50 / Blackwell GPUs, verify your NVIDIA driver supports CUDA 12.9+
as required by PaddleOCR's current Blackwell guide.
EOF
