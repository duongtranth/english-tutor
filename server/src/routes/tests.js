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

router.get('/', (req, res) => {
  const examType = req.query.examType;
  let rows;
  if (examType === 'IELTS' || examType === 'TOEIC') {
    rows = db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM test_sections s WHERE s.test_id = t.id) AS section_count,
        (SELECT COUNT(*) FROM test_files f WHERE f.test_id = t.id) AS file_count
      FROM tests t
      WHERE t.user_id = ? AND t.exam_type = ?
      ORDER BY t.updated_at DESC, t.id DESC
    `).all(req.userId, examType);
  } else {
    rows = db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM test_sections s WHERE s.test_id = t.id) AS section_count,
        (SELECT COUNT(*) FROM test_files f WHERE f.test_id = t.id) AS file_count
      FROM tests t
      WHERE t.user_id = ?
      ORDER BY t.updated_at DESC, t.id DESC
    `).all(req.userId);
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const test = db.prepare('SELECT * FROM tests WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!test) return res.status(404).json({ error: 'Test not found' });
  res.json(serializeTest(test));
});

router.post('/import', (req, res) => {
  const { title, examType, source = '', files = [], sections = [] } = req.body || {};
  if (!title || !['IELTS', 'TOEIC'].includes(examType)) {
    return res.status(400).json({ error: 'title and a valid examType are required' });
  }

  const insertTest = db.prepare('INSERT INTO tests (user_id, exam_type, title, source, status) VALUES (?, ?, ?, ?, ?)');
  const insertFile = db.prepare('INSERT INTO test_files (test_id, kind, original_name, stored_name, mime_type, size) VALUES (?, ?, ?, ?, ?, ?)');
  const insertSection = db.prepare(`
    INSERT INTO test_sections (test_id, skill, section_number, title, instructions, passage, audio_file_id, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertQuestion = db.prepare(`
    INSERT INTO test_questions (section_id, question_number, question_type, prompt, options_json, correct_answer_json, explanation, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    const testId = Number(insertTest.run(req.userId, examType, title.trim(), source.trim(), 'draft').lastInsertRowid);
    const fileIdByClientKey = new Map();

    for (const file of files) {
      if (!file?.name || !file?.dataBase64) continue;
      const kind = ['question', 'audio', 'answer', 'other'].includes(file.kind) ? file.kind : 'other';
      const safeExt = path.extname(file.name).slice(0, 12).replace(/[^.a-zA-Z0-9]/g, '');
      const storedName = `${testId}-${crypto.randomUUID()}${safeExt}`;
      const raw = String(file.dataBase64).includes(',') ? String(file.dataBase64).split(',').pop() : String(file.dataBase64);
      const buffer = Buffer.from(raw, 'base64');
      fs.writeFileSync(path.join(uploadsDir, storedName), buffer);
      const info = insertFile.run(testId, kind, file.name, storedName, file.type || null, buffer.length);
      if (file.clientKey) fileIdByClientKey.set(file.clientKey, Number(info.lastInsertRowid));
    }

    for (const [index, section] of sections.entries()) {
      const skill = ['reading', 'listening', 'writing', 'speaking', 'mixed'].includes(section.skill) ? section.skill : 'mixed';
      const audioFileId = section.audioClientKey ? fileIdByClientKey.get(section.audioClientKey) || null : null;
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
      for (const [qIndex, question] of (section.questions || []).entries()) {
        insertQuestion.run(
          sectionId,
          Number(question.questionNumber) || qIndex + 1,
          question.questionType || 'multiple_choice',
          question.prompt || `Question ${qIndex + 1}`,
          JSON.stringify(question.options || []),
          JSON.stringify(question.correctAnswer ?? null),
          question.explanation || null,
          JSON.stringify(question.metadata || {})
        );
      }
    }
    return testId;
  });

  try {
    const testId = tx();
    const test = db.prepare('SELECT * FROM tests WHERE id = ?').get(testId);
    res.status(201).json(serializeTest(test));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to import test' });
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
