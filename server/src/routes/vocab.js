const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Leitner box -> review interval in days
const BOX_INTERVALS = { 1: 0, 2: 1, 3: 2, 4: 4, 5: 7, 6: 14 };
const MAX_BOX = 6;

router.get('/due', (req, res) => {
  const examType = req.query.examType;
  if (!['TOEIC', 'IELTS'].includes(examType)) {
    return res.status(400).json({ error: 'examType must be TOEIC or IELTS' });
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 15, 50);

  // Words never seen by this user
  const newWords = db
    .prepare(
      `SELECT w.* FROM words w
       WHERE w.exam_type = ?
         AND w.id NOT IN (SELECT word_id FROM word_progress WHERE user_id = ?)
       ORDER BY w.id LIMIT ?`
    )
    .all(examType, req.userId, limit);

  // Words due for review
  const dueWords = db
    .prepare(
      `SELECT w.*, p.box, p.due_at FROM words w
       JOIN word_progress p ON p.word_id = w.id
       WHERE w.exam_type = ? AND p.user_id = ? AND p.due_at <= datetime('now')
       ORDER BY p.due_at LIMIT ?`
    )
    .all(examType, req.userId, limit);

  const combined = [...dueWords, ...newWords].slice(0, limit);
  res.json({ words: combined });
});

router.post('/:wordId/review', (req, res) => {
  const wordId = parseInt(req.params.wordId, 10);
  const { known } = req.body || {};
  if (typeof known !== 'boolean') return res.status(400).json({ error: 'known (boolean) is required' });

  const word = db.prepare('SELECT id FROM words WHERE id = ?').get(wordId);
  if (!word) return res.status(404).json({ error: 'Word not found' });

  const existing = db
    .prepare('SELECT * FROM word_progress WHERE user_id = ? AND word_id = ?')
    .get(req.userId, wordId);

  let box = existing ? existing.box : 1;
  box = known ? Math.min(box + 1, MAX_BOX) : 1;
  const intervalDays = BOX_INTERVALS[box] ?? 0;

  if (existing) {
    db.prepare(
      `UPDATE word_progress SET box = ?, due_at = datetime('now', '+' || ? || ' days'),
       correct_count = correct_count + ?, wrong_count = wrong_count + ?
       WHERE id = ?`
    ).run(box, intervalDays, known ? 1 : 0, known ? 0 : 1, existing.id);
  } else {
    db.prepare(
      `INSERT INTO word_progress (user_id, word_id, box, due_at, correct_count, wrong_count)
       VALUES (?, ?, ?, datetime('now', '+' || ? || ' days'), ?, ?)`
    ).run(req.userId, wordId, box, intervalDays, known ? 1 : 0, known ? 0 : 1);
  }

  res.json({ box, intervalDays });
});

module.exports = router;
