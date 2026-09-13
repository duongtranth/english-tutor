# English Tutor — TOEIC & IELTS

A web app for learning English across Vocabulary, Grammar, Reading, Listening, and personal IELTS/TOEIC test libraries.

## Architecture

- `server/` — Node.js + Express, SQLite database (built-in `node:sqlite`), JWT authentication.
- `client/` — React + Vite, React Router.

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
- Listening practice (transcript read aloud via the Web Speech API) with multiple-choice questions
- Dashboard tracking progress across each skill
- Personal Test Library for IELTS/TOEIC
- Upload question PDFs/TXT, answer keys, audio, and supporting images
- Browser-side text extraction for text-based PDFs
- Heuristic IELTS/TOEIC parser for sections, numbered questions, common question types, options, and answer keys
- Editable parsed-test preview before a draft is marked ready

## Test import workflow

1. Open **Tests → Import test**.
2. Add a text-based PDF/TXT question paper and optionally an answer-key file and audio.
3. Set each file role (`Question paper`, `Answer key`, `Audio`, or `Other`).
4. Click **Analyze files**.
5. Review the detected section/question/answer counts and warnings.
6. Import the parsed draft.
7. Open **Edit parsed data** to correct question text, type, options, or answers.
8. Mark the test ready after reviewing it.

### Current parser scope

The current parser is intentionally conservative. It supports common IELTS and TOEIC text layouts and keeps all generated data editable. Text-based PDFs are extracted in the browser with PDF.js loaded from jsDelivr. Scanned/image-only PDFs and uploaded images are stored with the test but are not OCR'd yet; those files need the planned OCR/vision adapter.

## Development

Run parser regression tests from the client directory:

```bash
npm test
```

Existing demo vocabulary/questions/passages/listening items are still seeded from `server/src/seed.js`.
