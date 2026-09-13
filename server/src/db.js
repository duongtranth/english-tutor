const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'app.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('TOEIC','IELTS')),
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  example TEXT,
  topic TEXT
);

CREATE TABLE IF NOT EXISTS word_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  word_id INTEGER NOT NULL REFERENCES words(id),
  box INTEGER NOT NULL DEFAULT 1,
  due_at TEXT NOT NULL DEFAULT (datetime('now')),
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, word_id)
);

CREATE TABLE IF NOT EXISTS grammar_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('TOEIC','IELTS')),
  prompt TEXT NOT NULL,
  choices TEXT NOT NULL,
  answer_index INTEGER NOT NULL,
  explanation TEXT
);

CREATE TABLE IF NOT EXISTS grammar_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  question_id INTEGER NOT NULL REFERENCES grammar_questions(id),
  correct INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reading_passages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('TOEIC','IELTS')),
  title TEXT NOT NULL,
  body TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reading_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passage_id INTEGER NOT NULL REFERENCES reading_passages(id),
  prompt TEXT NOT NULL,
  choices TEXT NOT NULL,
  answer_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reading_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  passage_id INTEGER NOT NULL REFERENCES reading_passages(id),
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS listening_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('TOEIC','IELTS')),
  title TEXT NOT NULL,
  transcript TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS listening_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES listening_items(id),
  prompt TEXT NOT NULL,
  choices TEXT NOT NULL,
  answer_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS listening_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  item_id INTEGER NOT NULL REFERENCES listening_items(id),
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

module.exports = db;
