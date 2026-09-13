const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'app.db'));
db.exec('PRAGMA foreign_keys = ON;');

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

CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  exam_type TEXT NOT NULL CHECK (exam_type IN ('TOEIC','IELTS')),
  title TEXT NOT NULL,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('question','audio','answer','other')),
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS test_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  skill TEXT NOT NULL CHECK (skill IN ('reading','listening','writing','speaking','mixed')),
  section_number INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  instructions TEXT,
  passage TEXT,
  audio_file_id INTEGER REFERENCES test_files(id),
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS test_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES test_sections(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  correct_answer_json TEXT NOT NULL DEFAULT 'null',
  explanation TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS test_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  answered_count INTEGER NOT NULL DEFAULT 0,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  started_at TEXT DEFAULT (datetime('now')),
  submitted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_attempt_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES test_questions(id) ON DELETE CASCADE,
  user_answer_json TEXT NOT NULL DEFAULT 'null',
  correct_answer_json TEXT NOT NULL DEFAULT 'null',
  is_correct INTEGER NOT NULL DEFAULT 0,
  UNIQUE(attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_tests_user ON tests(user_id, exam_type, created_at);
CREATE INDEX IF NOT EXISTS idx_test_sections_test ON test_sections(test_id, section_number);
CREATE INDEX IF NOT EXISTS idx_test_questions_section ON test_questions(section_id, question_number);
CREATE INDEX IF NOT EXISTS idx_test_attempts_user ON test_attempts(user_id, test_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_test_attempt_answers_attempt ON test_attempt_answers(attempt_id, is_correct);

CREATE TRIGGER IF NOT EXISTS invalidate_attempts_before_section_delete
BEFORE DELETE ON test_sections
BEGIN
  DELETE FROM test_attempts WHERE test_id = OLD.test_id;
END;
`);

module.exports = db;
