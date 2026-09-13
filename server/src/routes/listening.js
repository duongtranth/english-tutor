const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/items', (req, res) => {
  const examType = req.query.examType;
  if (!['TOEIC', 'IELTS'].includes(examType)) {
    return res.status(400).json({ error: 'examType must be TOEIC or IELTS' });
  }
  const rows = db
    .prepare('SELECT id, title FROM listening_items WHERE exam_type = ?')
    .all(examType);
  res.json({ items: rows });
});

router.get('/items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM listening_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const questions = db
    .prepare('SELECT id, prompt, choices FROM listening_questions WHERE item_id = ?')
    .all(item.id)
    .map((q) => ({ ...q, choices: JSON.parse(q.choices) }));

  res.json({
    item: { id: item.id, title: item.title, transcript: item.transcript },
    questions,
  });
});

router.post('/items/:id/attempt', (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const { answers } = req.body || {};
  const questions = db
    .prepare('SELECT * FROM listening_questions WHERE item_id = ?')
    .all(itemId);
  if (questions.length === 0) return res.status(404).json({ error: 'Item not found' });

  let score = 0;
  const results = questions.map((q) => {
    const selected = answers ? answers[q.id] : undefined;
    const correct = selected === q.answer_index;
    if (correct) score += 1;
    return { questionId: q.id, correct, answerIndex: q.answer_index };
  });

  db.prepare(
    'INSERT INTO listening_attempts (user_id, item_id, score, total) VALUES (?, ?, ?, ?)'
  ).run(req.userId, itemId, score, questions.length);

  res.json({ score, total: questions.length, results });
});

module.exports = router;
