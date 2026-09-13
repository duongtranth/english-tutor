# English Tutor — TOEIC & IELTS

A web app for learning English across all four skills (Vocabulary, Grammar, Reading, Listening), supporting both the TOEIC and IELTS exams.

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

## Possible extensions

- Add more vocabulary / questions / passages / listening items in `server/src/seed.js`
- Use real audio recordings instead of text-to-speech for the Listening section
- Add full-length mock tests matching the real TOEIC/IELTS format
