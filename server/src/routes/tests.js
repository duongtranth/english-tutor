const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const VALID_SKILLS = new Set(['reading', 'listening', 'writing', 'speaking', 'mixed']);
const VALID_FILE_KINDS = new Set(['question', 'audio', 'answer', 'other']);

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function serializeTest(test) {
  if (!test) return null;
  const files = db.prepare('SELECT id, kind, original_name, mime_type, size FROM test_files WHERE test_id = ? ORDER BY id').all(test.id);
  const sections = db.prepare('SELECT * FROM test_sections WHERE test_id = ? ORDER BY section_number, id').all(test.id).map((section) => ({
    ...section,
    metadata: parseJson(section.metadata_json, {}),
    questions: db.prepare('SELECT * FROM test_questions WHERE section_id = ? ORDER BY question_number, id').all(section.id).map((q) => ({
      ...q,
      options: parseJson(q.options_json, []),
      correctAnswer: parseJson(q.correct_answer_json, null),
      metadata: parseJson(q.metadata_json, {}),
    })),
  }));
  return { ...test, files, sections };
}

function serializeTestForTaking(test) {
  const full = serializeTest(test);
  return {
    ...full,
    sections: full.sections.map((section) => ({
      ...section,
      questions: section.questions.map(({ correctAnswer, explanation, ...question }) => question),
    })),
  };
}

function insertStructure(testId, sections, fileIdByClientKey = new Map()) {
  const insertSection = db.prepare(`
    INSERT INTO test_sections (test_id, skill, section_number, title, instructions, passage, audio_file_id, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertQuestion = db.prepare(`
    INSERT INTO test_questions (section_id, question_number, question_type, prompt, options_json, correct_answer_json, explanation, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ownsFile = db.prepare('SELECT id FROM test_files WHERE id = ? AND test_id = ?');

  for (const [index, section] of (sections || []).entries()) {
    const skill = VALID_SKILLS.has(section.skill) ? section.skill : 'mixed';
    let audioFileId = null;
    if (section.audioClientKey) audioFileId = fileIdByClientKey.get(section.audioClientKey) || null;
    if (!audioFileId && section.audioFileId && ownsFile.get(section.audioFileId, testId)) audioFileId = Number(section.audioFileId);

    const sectionInfo = insertSection.run(
      testId,
      skill,
      Number(section.sectionNumber) || index + 1,
      section.title || null,
      section.instructions || null,
      section.passage || null,
      audioFileId,
      JSON.stringify(section.metadata || {})
    );
    const sectionId = Number(sectionInfo.lastInsertRowid);

    for (const [qIndex, question] of (section.questions || []).slice(0, 500).entries()) {
      insertQuestion.run(
        sectionId,
        Number(question.questionNumber) || qIndex + 1,
        String(question.questionType || 'multiple_choice').slice(0, 80),
        String(question.prompt || `Question ${qIndex + 1}`).slice(0, 20000),
        JSON.stringify(Array.isArray(question.options) ? question.options : []),
        JSON.stringify(question.correctAnswer ?? null),
        question.explanation || null,
        JSON.stringify(question.metadata || {})
      );
    }
  }
}

function cleanText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function optionLetter(value) {
  const match = cleanText(value).match(/^\(?([A-H])(?:[.)\s]|$)/i);
  return match ? match[1].toUpperCase() : null;
}

function normalizedToken(value, questionType) {
  const text = cleanText(value);
  if (!text) return '';
  if (questionType === 'multiple_choice' || questionType === 'matching_headings' || questionType === 'matching_information') {
    return optionLetter(text) || text.toUpperCase();
  }
  if (questionType === 'true_false_not_given' || questionType === 'yes_no_not_given') return text.toUpperCase();
  return text
    .toLowerCase()
    .replace(/[.,;:!?]+$/g, '')
    .trim();
}

function multiTokens(value, questionType) {
  if (Array.isArray(value)) return value.map((item) => normalizedToken(item, questionType)).filter(Boolean).sort();
  const text = cleanText(value);
  if (!text) return [];
  if (questionType === 'multiple_select') {
    return text.split(/\s*(?:,|\/|&|\band\b)\s*/i).map((item) => optionLetter(item) || item.toUpperCase()).filter(Boolean).sort();
  }
  return [normalizedToken(text, questionType)].filter(Boolean);
}

function hasGradableAnswer(value) {
  if (Array.isArray(value)) return value.some((item) => cleanText(item));
  return cleanText(value) !== '' && value !== null && value !== undefined;
}

function isAnswerCorrect(userAnswer, correctAnswer, questionType) {
  if (!hasGradableAnswer(correctAnswer)) return null;

  if (questionType === 'multiple_select') {
    const user = multiTokens(userAnswer, questionType);
    const correct = multiTokens(correctAnswer, questionType);
    return user.length === correct.length && user.every((token, i) => token === correct[i]);
  }

  const userValues = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
  const correctValues = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
  const normalizedCorrect = correctValues.map((item) => normalizedToken(item, questionType)).filter(Boolean);
  const normalizedUser = userValues.map((item) => normalizedToken(item, questionType)).filter(Boolean);
  return normalizedUser.length === 1 && normalizedCorrect.includes(normalizedUser[0]);
}

function serializeAttempt(attempt, includeAnswers = false) {
  const result = { ...attempt };
  if (includeAnswers) {
    result.answers = db.prepare(`
      SELECT aa.*, q.question_number, q.question_type, q.prompt, q.options_json,
             s.title AS section_title, s.skill
      FROM test_attempt_answers aa
      JOIN test_questions q ON q.id = aa.question_id
      JOIN test_sections s ON s.id = q.section_id
      WHERE aa.attempt_id = ?
      ORDER BY s.section_number, q.question_number, q.id
    `).all(attempt.id).map((row) => ({
      ...row,
      options: parseJson(row.options_json, []),
      userAnswer: parseJson(row.user_answer_json, null),
      correctAnswer: parseJson(row.correct_answer_json, null),
    }));
  }
  return result;
}

router.get('/', (req, res) => {
  const examType = req.query.examType;
  const examClause = examType === 'IELTS' || examType === 'TOEIC' ? 'AND t.exam_type = ?' : '';
  const args = examClause ? [req.userId, examType] : [req.userId];
  const rows = db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM test_sections s WHERE s.test_id = t.id) AS section_count,
      (SELECT COUNT(*) FROM test_files f WHERE f.test_id = t.id) AS file_count,
      (SELECT COUNT(*) FROM test_attempts a WHERE a.test_id = t.id AND a.user_id = t.user_id) AS attempt_count,
      (SELECT score FROM test_attempts a WHERE a.test_id = t.id AND a.user_id = t.user_id ORDER BY a.submitted_at DESC, a.id DESC LIMIT 1) AS last_score,
      (SELECT total FROM test_attempts a WHERE a.test_id = t.id AND a.user_id = t.user_id ORDER BY a.submitted_at DESC, a.id DESC LIMIT 1) AS last_total
    FROM tests t
    WHERE t.user_id = ? ${examClause}
    ORDER BY t.updated_at DESC, t.id DESC
  `).all(...args);
  res.json(rows);
});

router.get('/mistakes', (req, res) => {
  const examType = req.query.examType;
  const examClause = examType === 'IELTS' || examType === 'TOEIC' ? 'AND t.exam_type = ?' : '';
  const args = examClause ? [req.userId, examType] : [req.userId];
  const rows = db.prepare(`
    SELECT aa.id, aa.attempt_id, aa.question_id, aa.user_answer_json, aa.correct_answer_json,
           q.question_number, q.question_type, q.prompt, q.options_json,
           s.title AS section_title, s.skill,
           t.id AS test_id, t.title AS test_title, t.exam_type,
           a.submitted_at
    FROM test_attempt_answers aa
    JOIN test_attempts a ON a.id = aa.attempt_id
    JOIN test_questions q ON q.id = aa.question_id
    JOIN test_sections s ON s.id = q.section_id
    JOIN tests t ON t.id = a.test_id
    WHERE a.user_id = ? AND aa.is_correct = 0 ${examClause}
    ORDER BY a.submitted_at DESC, aa.id DESC
    LIMIT 200
  `).all(...args).map((row) => ({
    ...row,
    options: parseJson(row.options_json, []),
    userAnswer: parseJson(row.user_answer_json, null),
    correctAnswer: parseJson(row.correct_answer_json, null),
  }));
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const test = db.prepare('SELECT * FROM tests WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!test) return res.status(404).json({ error: 'Test not found' });
  res.json(serializeTest(test));
});

router.get('/:id/take', (req, res) => {
  const test = db.prepare('SELECT * FROM tests WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!test) return res.status(404).json({ error: 'Test not found' });
  if (test.status !== 'ready') return res.status(409).json({ error: 'Review the test and mark it ready before taking it.' });
  res.json(serializeTestForTaking(test));
});

router.get('/:id/files/:fileId', (req, res) => {
  const file = db.prepare(`
    SELECT f.* FROM test_files f
    JOIN tests t ON t.id = f.test_id
    WHERE f.id = ? AND f.test_id = ? AND t.user_id = ?
  `).get(req.params.fileId, req.params.id, req.userId);
  if (!file) return res.status(404).json({ error: 'File not found' });
  const target = path.join(uploadsDir, file.stored_name);
  if (!fs.existsSync(target)) return res.status(404).json({ error: 'Stored file is missing' });
  if (file.mime_type) res.type(file.mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${String(file.original_name).replace(/"/g, '')}"`);
  res.sendFile(target);
});

router.get('/:id/attempts', (req, res) => {
  const test = db.prepare('SELECT id FROM tests WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!test) return res.status(404).json({ error: 'Test not found' });
  const attempts = db.prepare(`
    SELECT * FROM test_attempts
    WHERE test_id = ? AND user_id = ?
    ORDER BY submitted_at DESC, id DESC
    LIMIT 50
  `).all(test.id, req.userId);
  res.json(attempts);
});

router.get('/:id/attempts/:attemptId', (req, res) => {
  const attempt = db.prepare(`
    SELECT a.* FROM test_attempts a
    JOIN tests t ON t.id = a.test_id
    WHERE a.id = ? AND a.test_id = ? AND a.user_id = ? AND t.user_id = ?
  `).get(req.params.attemptId, req.params.id, req.userId, req.userId);
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  res.json(serializeAttempt(attempt, true));
});

router.post('/:id/submit', (req, res) => {
  const test = db.prepare('SELECT * FROM tests WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!test) return res.status(404).json({ error: 'Test not found' });
  if (test.status !== 'ready') return res.status(409).json({ error: 'Test is not ready.' });

  const submittedAnswers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  const elapsedSeconds = Math.max(0, Math.min(Number(req.body?.elapsedSeconds) || 0, 24 * 60 * 60));
  const questions = db.prepare(`
    SELECT q.*, s.section_number, s.skill, s.title AS section_title
    FROM test_questions q
    JOIN test_sections s ON s.id = q.section_id
    WHERE s.test_id = ?
    ORDER BY s.section_number, q.question_number, q.id
  `).all(test.id);
  if (!questions.length) return res.status(400).json({ error: 'This test has no questions.' });

  const graded = [];
  let score = 0;
  let total = 0;
  let answeredCount = 0;

  for (const question of questions) {
    const correctAnswer = parseJson(question.correct_answer_json, null);
    const userAnswer = submittedAnswers[String(question.id)] ?? submittedAnswers[question.id] ?? null;
    if (Array.isArray(userAnswer) ? userAnswer.length > 0 : cleanText(userAnswer) !== '') answeredCount += 1;
    const result = isAnswerCorrect(userAnswer, correctAnswer, question.question_type);
    if (result !== null) {
      total += 1;
      if (result) score += 1;
    }
    graded.push({ question, userAnswer, correctAnswer, isCorrect: result });
  }

  let attemptId;
  try {
    db.exec('BEGIN');
    attemptId = Number(db.prepare(`
      INSERT INTO test_attempts (test_id, user_id, score, total, answered_count, elapsed_seconds)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(test.id, req.userId, score, total, answeredCount, elapsedSeconds).lastInsertRowid);

    const insertAnswer = db.prepare(`
      INSERT INTO test_attempt_answers (attempt_id, question_id, user_answer_json, correct_answer_json, is_correct)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of graded) {
      if (item.isCorrect === null) continue;
      insertAnswer.run(
        attemptId,
        item.question.id,
        JSON.stringify(item.userAnswer ?? null),
        JSON.stringify(item.correctAnswer ?? null),
        item.isCorrect ? 1 : 0
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error(err);
    return res.status(500).json({ error: 'Failed to save test result' });
  }

  const attempt = db.prepare('SELECT * FROM test_attempts WHERE id = ?').get(attemptId);
  res.status(201).json(serializeAttempt(attempt, true));
});

router.post('/import', (req, res) => {
  const { title, examType, source = '', files = [], sections = [] } = req.body || {};
  if (!title || !['IELTS', 'TOEIC'].includes(examType)) {
    return res.status(400).json({ error: 'title and a valid examType are required' });
  }

  const insertTest = db.prepare('INSERT INTO tests (user_id, exam_type, title, source, status) VALUES (?, ?, ?, ?, ?)');
  const insertFile = db.prepare('INSERT INTO test_files (test_id, kind, original_name, stored_name, mime_type, size) VALUES (?, ?, ?, ?, ?, ?)');
  const writtenFiles = [];
  let testId = null;

  try {
    db.exec('BEGIN');
    testId = Number(insertTest.run(req.userId, examType, title.trim(), source.trim(), 'draft').lastInsertRowid);
    const fileIdByClientKey = new Map();

    for (const file of files) {
      if (!file?.name || !file?.dataBase64) continue;
      const kind = VALID_FILE_KINDS.has(file.kind) ? file.kind : 'other';
      const safeExt = path.extname(file.name).slice(0, 12).replace(/[^.a-zA-Z0-9]/g, '');
      const storedName = `${testId}-${crypto.randomUUID()}${safeExt}`;
      const raw = String(file.dataBase64).includes(',') ? String(file.dataBase64).split(',').pop() : String(file.dataBase64);
      const buffer = Buffer.from(raw, 'base64');
      const target = path.join(uploadsDir, storedName);
      fs.writeFileSync(target, buffer);
      writtenFiles.push(target);
      const info = insertFile.run(testId, kind, file.name, storedName, file.type || null, buffer.length);
      if (file.clientKey) fileIdByClientKey.set(file.clientKey, Number(info.lastInsertRowid));
    }

    insertStructure(testId, sections, fileIdByClientKey);
    db.exec('COMMIT');
    const test = db.prepare('SELECT * FROM tests WHERE id = ? AND user_id = ?').get(testId, req.userId);
    res.status(201).json(serializeTest(test));
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    for (const target of writtenFiles) {
      try { if (fs.existsSync(target)) fs.unlinkSync(target); } catch {}
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to import test' });
  }
});

router.put('/:id/structure', (req, res) => {
  const test = db.prepare('SELECT * FROM tests WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!test) return res.status(404).json({ error: 'Test not found' });
  const sections = req.body?.sections;
  if (!Array.isArray(sections)) return res.status(400).json({ error: 'sections must be an array' });
  if (sections.length > 50) return res.status(400).json({ error: 'Too many sections' });

  try {
    db.exec('BEGIN');
    db.prepare('DELETE FROM test_sections WHERE test_id = ?').run(test.id);
    insertStructure(test.id, sections);
    db.prepare(`UPDATE tests SET status = 'draft', updated_at = datetime('now') WHERE id = ?`).run(test.id);
    db.exec('COMMIT');
    res.json(serializeTest(db.prepare('SELECT * FROM tests WHERE id = ?').get(test.id)));
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error(err);
    res.status(500).json({ error: 'Failed to update test structure' });
  }
});

router.patch('/:id', (req, res) => {
  const test = db.prepare('SELECT * FROM tests WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!test) return res.status(404).json({ error: 'Test not found' });

  const title = typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim() : test.title;
  const source = typeof req.body.source === 'string' ? req.body.source.trim() : test.source;
  const status = ['draft', 'ready'].includes(req.body.status) ? req.body.status : test.status;
  db.prepare(`UPDATE tests SET title = ?, source = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
    .run(title, source, status, req.params.id, req.userId);

  res.json(serializeTest(db.prepare('SELECT * FROM tests WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  const test = db.prepare('SELECT * FROM tests WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!test) return res.status(404).json({ error: 'Test not found' });

  const files = db.prepare('SELECT stored_name FROM test_files WHERE test_id = ?').all(test.id);
  db.prepare('DELETE FROM tests WHERE id = ? AND user_id = ?').run(test.id, req.userId);
  for (const file of files) {
    const target = path.join(uploadsDir, file.stored_name);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
  res.json({ ok: true });
});

module.exports = router;
