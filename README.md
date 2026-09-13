# English Tutor — TOEIC & IELTS

A web app for learning English across Vocabulary, Grammar, Reading, Listening, and personal IELTS/TOEIC test libraries.

## Architecture

- `server/` — Node.js + Express, SQLite database (built-in `node:sqlite`), JWT authentication.
- `client/` — React + Vite, React Router.
- `server/ocr/` — local document OCR bridge using PaddleOCR-VL-1.6 downloaded from Hugging Face.

## Running the project

### Backend (port 4000)

```bash
cd server
npm install
npm run dev
```

### Frontend (port 5173)

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` in your browser and register a new account to get started.

## Features

- Register / login (JWT)
- Switch between TOEIC and IELTS, tracked per user
- Vocabulary flashcards with a spaced repetition system (Leitner boxes)
- Grammar multiple-choice quizzes with answer explanations
- Reading comprehension passages with multiple-choice questions
- Listening practice with the original seed content
- Dashboard tracking progress across each skill
- Personal Test Library for IELTS/TOEIC
- Upload question PDFs/TXT, answer keys, audio, and supporting images
- Fast browser-side text extraction for PDFs that already contain embedded text
- Local PaddleOCR-VL-1.6 document OCR for scanned PDFs and photos
- Browser Tesseract OCR as a last-resort fallback if the local model is unavailable
- Heuristic IELTS/TOEIC parser for sections, numbered questions, common question types, options, and answer keys
- Editable parsed-test preview before a draft is marked ready
- Imported audio playback in Listening sections
- Timed or untimed Test Mode
- Browser autosave and resume for in-progress tests
- Automatic grading for supported question types
- Attempt history with score, answered count, and elapsed time
- Mistake Book collecting wrong answers from submitted imported tests

## Local document OCR

The preferred OCR backend is **`PaddlePaddle/PaddleOCR-VL-1.6`** from Hugging Face: https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6

The model weights are not committed to this repository. Setup downloads them once into `server/models/PaddleOCR-VL-1.6/`, and that directory is ignored by Git.

PaddleOCR-VL uses a full document-parsing pipeline rather than line-only OCR: it analyzes page layout/reading order and then performs VLM recognition. This is useful for IELTS/TOEIC pages containing multiple columns, forms, tables, diagrams, and mixed layouts.

### Install and download the model

PaddleOCR currently documents Python **3.9–3.13** for manual installation. From the repository:

```bash
cd server
npm run ocr:setup
```

This command:

1. creates `server/.venv-ocr/`;
2. installs the Transformers/PyTorch inference stack and `paddleocr[doc-parser]`;
3. downloads `PaddlePaddle/PaddleOCR-VL-1.6` from Hugging Face into `server/models/PaddleOCR-VL-1.6/`.

The Hugging Face model repository is about **1.9 GB**, so the first setup requires an internet connection and enough disk space. Restart the Node backend after setup.

Useful overrides:

```bash
# Force CPU OCR
OCR_DEVICE=cpu npm run dev

# Use a different Python environment
OCR_PYTHON=/path/to/python npm run dev

# Store the Hugging Face model somewhere else
PADDLEOCR_VL_MODEL_DIR=/path/to/PaddleOCR-VL-1.6 npm run dev
```

For NVIDIA Blackwell / RTX 50-series GPUs, follow PaddleOCR's current Blackwell environment guidance. Their dedicated guide currently requires an NVIDIA driver supporting CUDA 12.9 or newer for that path.

The Node server keeps one Python OCR worker alive after the first OCR request so the ~0.9B VLM is not reloaded for every page or upload.

## Test import workflow

1. Open **Tests → Import test**.
2. Add a PDF/TXT/image question paper and optionally an answer-key file and audio.
3. Set each file role (`Question paper`, `Answer key`, `Audio`, or `Other`).
4. Click **Analyze files**.
5. For a normal text PDF, PDF.js extracts the embedded text immediately.
6. For a scan/photo, the app sends the file to the local PaddleOCR-VL worker. If local OCR is not installed or fails, browser Tesseract is used as a fallback.
7. Review the detected section/question/answer counts and warnings.
8. Import the parsed draft.
9. Open **Edit parsed data** to correct question text, type, options, or answers.
10. Mark the test ready after reviewing it.
11. Start the test in timed or untimed mode.
12. Submit to see the score and wrong answers; incorrect graded answers are added to **Mistake Book**.

### Current parser scope

The structural parser is intentionally conservative. It supports common IELTS and TOEIC text layouts and keeps all generated data editable.

Supported structures include common IELTS Reading passages, IELTS Listening sections, TOEIC Parts 1–7, multiple choice, multiple select, TRUE/FALSE/NOT GIVEN, YES/NO/NOT GIVEN, matching headings/information, completion, and short-answer questions.

OCR and structural parsing are separate stages. PaddleOCR-VL produces layout-aware document text/Markdown; the existing IELTS/TOEIC parser then converts that text into editable sections and questions. This means OCR can be improved or swapped later without changing the test database schema.

## Development

Run parser regression tests from the client directory:

```bash
npm test
```

Existing demo vocabulary/questions/passages/listening items are still seeded from `server/src/seed.js`.
