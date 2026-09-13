const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/summary', (req, res) => {
  const examTypes = ['TOEIC', 'IELTS'];
  const summary = {};

  for (const examType of examTypes) {
    const vocab = db
      .prepare(
        `SELECT COUNT(*) AS learned FROM word_progress p
         JOIN words w ON w.id = p.word_id
         WHERE p.user_id = ? AND w.exam_type = ? AND p.box >= 3`
      )
      .get(req.userId, examType);
    const vocabTotal = db
      .prepare('SELECT COUNT(*) AS total FROM words WHERE exam_type = ?')
      .get(examType);

    const grammar = db
      .prepare(
        `SELECT COUNT(*) AS attempts, SUM(correct) AS correct FROM grammar_attempts a
         JOIN grammar_questions q ON q.id = a.question_id
         WHERE a.user_id = ? AND q.exam_type = ?`
      )
      .get(req.userId, examType);

    const reading = db
      .prepare(
        `SELECT COUNT(*) AS attempts, SUM(score) AS score, SUM(total) AS total FROM reading_attempts a
         JOIN reading_passages p ON p.id = a.passage_id
         WHERE a.user_id = ? AND p.exam_type = ?`
      )
      .get(req.userId, examType);

    const listening = db
      .prepare(
        `SELECT COUNT(*) AS attempts, SUM(score) AS score, SUM(total) AS total FROM listening_attempts a
         JOIN listening_items i ON i.id = a.item_id
         WHERE a.user_id = ? AND i.exam_type = ?`
      )
      .get(req.userId, examType);

    summary[examType] = {
      vocab: { learned: vocab.learned, total: vocabTotal.total },
      grammar: { attempts: grammar.attempts || 0, correct: grammar.correct || 0 },
      reading: { attempts: reading.attempts || 0, score: reading.score || 0, total: reading.total || 0 },
      listening: { attempts: listening.attempts || 0, score: listening.score || 0, total: listening.total || 0 },
    };
  }

  res.json({ summary });
});

module.exports = router;
