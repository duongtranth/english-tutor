const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/passages', (req, res) => {
  const examType = req.query.examType;
  if (!['TOEIC', 'IELTS'].includes(examType)) {
    return res.status(400).json({ error: 'examType must be TOEIC or IELTS' });
  }
  const rows = db
    .prepare('SELECT id, title FROM reading_passages WHERE exam_type = ?')
    .all(examType);
  res.json({ passages: rows });
});

router.get('/passages/:id', (req, res) => {
  const passage = db
    .prepare('SELECT * FROM reading_passages WHERE id = ?')
    .get(req.params.id);
  if (!passage) return res.status(404).json({ error: 'Passage not found' });

  const questions = db
    .prepare('SELECT id, prompt, choices FROM reading_questions WHERE passage_id = ?')
    .all(passage.id)
    .map((q) => ({ ...q, choices: JSON.parse(q.choices) }));

  res.json({ passage: { id: passage.id, title: passage.title, body: passage.body }, questions });
});

router.post('/passages/:id/attempt', (req, res) => {
  const passageId = parseInt(req.params.id, 10);
  const { answers } = req.body || {}; // { questionId: selectedIndex }
  const questions = db
    .prepare('SELECT * FROM reading_questions WHERE passage_id = ?')
    .all(passageId);
  if (questions.length === 0) return res.status(404).json({ error: 'Passage not found' });

  let score = 0;
  const results = questions.map((q) => {
    const selected = answers ? answers[q.id] : undefined;
    const correct = selected === q.answer_index;
    if (correct) score += 1;
    return { questionId: q.id, correct, answerIndex: q.answer_index };
  });

  db.prepare(
    'INSERT INTO reading_attempts (user_id, passage_id, score, total) VALUES (?, ?, ?, ?)'
  ).run(req.userId, passageId, score, questions.length);

  res.json({ score, total: questions.length, results });
});

module.exports = router;
