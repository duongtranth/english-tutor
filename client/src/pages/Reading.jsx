import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Reading() {
  const { examType } = useAuth();
  const [passages, setPassages] = useState(null);
  const [active, setActive] = useState(null); // { passage, questions }
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const loadPassages = useCallback(() => {
    setPassages(null);
    setActive(null);
    api.readingPassages(examType).then((d) => setPassages(d.passages)).catch((e) => setError(e.message));
  }, [examType]);

  useEffect(() => {
    loadPassages();
  }, [loadPassages]);

  async function openPassage(id) {
    setError('');
    setResult(null);
    setAnswers({});
    try {
      const data = await api.readingPassage(id);
      setActive(data);
    } catch (e) {
      setError(e.message);
    }
  }

  function selectAnswer(questionId, choiceIndex) {
    if (result) return;
    setAnswers((a) => ({ ...a, [questionId]: choiceIndex }));
  }

  async function submit() {
    try {
      const data = await api.readingAttempt(active.passage.id, answers);
      setResult(data);
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <div className="page"><div className="error-box">{error}</div></div>;

  if (!active) {
    if (!passages) return <div className="page">Đang tải...</div>;
    return (
      <div className="page">
        <h1>Đọc hiểu {examType}</h1>
        <div className="list-cards">
          {passages.map((p) => (
            <button key={p.id} className="list-card" onClick={() => openPassage(p.id)}>{p.title}</button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="btn-link" onClick={() => setActive(null)}>← Quay lại danh sách</button>
      <h1>{active.passage.title}</h1>
      <div className="passage-body">{active.passage.body}</div>

      <div className="quiz-list">
        {active.questions.map((q, qi) => (
          <div className="quiz-card" key={q.id}>
            <p className="quiz-prompt">{qi + 1}. {q.prompt}</p>
            <div className="quiz-choices">
              {q.choices.map((choice, i) => {
                let cls = 'choice-btn';
                if (result) {
                  const r = result.results.find((r) => r.questionId === q.id);
                  if (i === r.answerIndex) cls += ' correct';
                  else if (i === answers[q.id]) cls += ' incorrect';
                } else if (answers[q.id] === i) {
                  cls += ' selected';
                }
                return (
                  <button key={i} className={cls} onClick={() => selectAnswer(q.id, i)} disabled={!!result}>
                    {choice}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!result ? (
        <button
          onClick={submit}
          disabled={Object.keys(answers).length < active.questions.length}
        >
          Nộp bài
        </button>
      ) : (
        <div className="feedback-box">
          <p className="stat-number">{result.score} / {result.total}</p>
          <button onClick={() => openPassage(active.passage.id)}>Làm lại</button>
        </div>
      )}
    </div>
  );
}
