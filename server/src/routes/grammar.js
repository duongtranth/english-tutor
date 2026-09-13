const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/questions', (req, res) => {
  const examType = req.query.examType;
  if (!['TOEIC', 'IELTS'].includes(examType)) {
    return res.status(400).json({ error: 'examType must be TOEIC or IELTS' });
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);
  const rows = db
    .prepare('SELECT * FROM grammar_questions WHERE exam_type = ? ORDER BY RANDOM() LIMIT ?')
    .all(examType, limit);
  const questions = rows.map((r) => ({
    id: r.id,
    prompt: r.prompt,
    choices: JSON.parse(r.choices),
  }));
  res.json({ questions });
});

router.post('/attempt', (req, res) => {
  const { questionId, selectedIndex } = req.body || {};
  const q = db.prepare('SELECT * FROM grammar_questions WHERE id = ?').get(questionId);
  if (!q) return res.status(404).json({ error: 'Question not found' });

  const correct = selectedIndex === q.answer_index;
  db.prepare(
    'INSERT INTO grammar_attempts (user_id, question_id, correct) VALUES (?, ?, ?)'
  ).run(req.userId, questionId, correct ? 1 : 0);

  res.json({ correct, answerIndex: q.answer_index, explanation: q.explanation });
});

module.exports = router;
