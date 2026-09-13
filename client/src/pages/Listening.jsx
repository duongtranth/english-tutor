import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function speak(text, onEnd) {
  if (!('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.lang = 'en-US';
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export default function Listening() {
  const { examType } = useAuth();
  const [items, setItems] = useState(null);
  const [active, setActive] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const loadItems = useCallback(() => {
    setItems(null);
    setActive(null);
    api.listeningItems(examType).then((d) => setItems(d.items)).catch((e) => setError(e.message));
  }, [examType]);

  useEffect(() => {
    loadItems();
    return () => window.speechSynthesis?.cancel();
  }, [loadItems]);

  async function openItem(id) {
    setError('');
    setResult(null);
    setAnswers({});
    setRevealed(false);
    try {
      const data = await api.listeningItem(id);
      setActive(data);
    } catch (e) {
      setError(e.message);
    }
  }

  function playAudio() {
    setPlaying(true);
    speak(active.item.transcript, () => setPlaying(false));
  }

  function selectAnswer(questionId, choiceIndex) {
    if (result) return;
    setAnswers((a) => ({ ...a, [questionId]: choiceIndex }));
  }

  async function submit() {
    try {
      const data = await api.listeningAttempt(active.item.id, answers);
      setResult(data);
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <div className="page"><div className="error-box">{error}</div></div>;

  if (!active) {
    if (!items) return <div className="page">Đang tải...</div>;
    return (
      <div className="page">
        <h1>Luyện nghe {examType}</h1>
        <div className="list-cards">
          {items.map((it) => (
            <button key={it.id} className="list-card" onClick={() => openItem(it.id)}>{it.title}</button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="btn-link" onClick={() => { window.speechSynthesis?.cancel(); setActive(null); }}>← Quay lại danh sách</button>
      <h1>{active.item.title}</h1>

      {!ttsSupported && (
        <div className="error-box">Trình duyệt không hỗ trợ đọc văn bản. Hãy đọc transcript bên dưới.</div>
      )}

      <div className="listening-controls">
        <button onClick={playAudio} disabled={playing}>{playing ? '🔊 Đang phát...' : '▶️ Nghe đoạn hội thoại'}</button>
        <button className="btn-link" onClick={() => setRevealed((r) => !r)}>
          {revealed ? 'Ẩn transcript' : 'Hiện transcript'}
        </button>
      </div>
      {revealed && <div className="passage-body">{active.item.transcript}</div>}

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
          <button onClick={() => openItem(active.item.id)}>Làm lại</button>
        </div>
      )}
    </div>
  );
}
