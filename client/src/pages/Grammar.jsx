import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Grammar() {
  const { examType } = useAuth();
  const [questions, setQuestions] = useState(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [error, setError] = useState('');

  const loadQuestions = useCallback(() => {
    setQuestions(null);
    setIndex(0);
    setSelected(null);
    setFeedback(null);
    setScore(0);
    api.grammarQuestions(examType, 10).then((d) => setQuestions(d.questions)).catch((e) => setError(e.message));
  }, [examType]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  async function handleSelect(choiceIndex) {
    if (feedback) return;
    setSelected(choiceIndex);
    const q = questions[index];
    try {
      const result = await api.grammarAttempt(q.id, choiceIndex);
      setFeedback(result);
      if (result.correct) setScore((s) => s + 1);
    } catch (e) {
      setError(e.message);
    }
  }

  function handleNext() {
    setSelected(null);
    setFeedback(null);
    setIndex((i) => i + 1);
  }

  if (error) return <div className="page"><div className="error-box">{error}</div></div>;
  if (!questions) return <div className="page">Đang tải...</div>;

  if (index >= questions.length) {
    return (
      <div className="page">
        <h1>Kết quả</h1>
        <p className="stat-number">{score} / {questions.length}</p>
        <button onClick={loadQuestions}>Làm lại bộ câu hỏi khác</button>
      </div>
    );
  }

  const q = questions[index];

  return (
    <div className="page">
      <h1>Ngữ pháp {examType}</h1>
      <p className="subtitle">Câu {index + 1} / {questions.length} — Điểm: {score}</p>
      <div className="quiz-card">
        <p className="quiz-prompt">{q.prompt}</p>
        <div className="quiz-choices">
          {q.choices.map((choice, i) => {
            let cls = 'choice-btn';
            if (feedback) {
              if (i === feedback.answerIndex) cls += ' correct';
              else if (i === selected) cls += ' incorrect';
            } else if (i === selected) {
              cls += ' selected';
            }
            return (
              <button key={i} className={cls} onClick={() => handleSelect(i)} disabled={!!feedback}>
                {choice}
              </button>
            );
          })}
        </div>
        {feedback && (
          <div className="feedback-box">
            <p>{feedback.correct ? '✅ Chính xác!' : '❌ Chưa đúng.'}</p>
            {feedback.explanation && <p className="explanation">{feedback.explanation}</p>}
            <button onClick={handleNext}>{index + 1 < questions.length ? 'Câu tiếp theo' : 'Xem kết quả'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
