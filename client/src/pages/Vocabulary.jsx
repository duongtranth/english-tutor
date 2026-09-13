import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Vocabulary() {
  const { examType } = useAuth();
  const [words, setWords] = useState(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(0);

  const loadWords = useCallback(() => {
    setWords(null);
    setIndex(0);
    setFlipped(false);
    setReviewed(0);
    api.vocabDue(examType, 15).then((d) => setWords(d.words)).catch((e) => setError(e.message));
  }, [examType]);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  async function handleReview(known) {
    const word = words[index];
    try {
      await api.vocabReview(word.id, known);
    } catch (e) {
      setError(e.message);
    }
    setReviewed((r) => r + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  if (error) return <div className="page"><div className="error-box">{error}</div></div>;
  if (!words) return <div className="page">Đang tải...</div>;

  if (words.length === 0) {
    return (
      <div className="page">
        <h1>Từ vựng {examType}</h1>
        <p>Không có từ nào cần ôn tập lúc này. Quay lại sau nhé! 🎉</p>
      </div>
    );
  }

  if (index >= words.length) {
    return (
      <div className="page">
        <h1>Hoàn thành! 🎉</h1>
        <p>Bạn đã ôn tập {reviewed} từ.</p>
        <button onClick={loadWords}>Ôn tiếp bộ từ mới</button>
      </div>
    );
  }

  const word = words[index];

  return (
    <div className="page">
      <h1>Từ vựng {examType}</h1>
      <p className="subtitle">Thẻ {index + 1} / {words.length}</p>
      <div className="flashcard" onClick={() => setFlipped((f) => !f)}>
        {!flipped ? (
          <div className="flashcard-front">
            <span className="topic-tag">{word.topic}</span>
            <h2>{word.term}</h2>
            <p className="hint">Nhấn để xem nghĩa</p>
          </div>
        ) : (
          <div className="flashcard-back">
            <h3>{word.definition}</h3>
            <p className="example">"{word.example}"</p>
          </div>
        )}
      </div>
      {flipped && (
        <div className="flashcard-actions">
          <button className="btn-danger" onClick={() => handleReview(false)}>❌ Chưa thuộc</button>
          <button className="btn-success" onClick={() => handleReview(true)}>✅ Đã thuộc</button>
        </div>
      )}
    </div>
  );
}
