import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, examType } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.progressSummary().then((d) => setSummary(d.summary)).catch((e) => setError(e.message));
  }, []);

  const stats = summary ? summary[examType] : null;

  return (
    <div className="page">
      <h1>Chào, {user.name} 👋</h1>
      <p className="subtitle">Đang luyện tập cho: <strong>{examType}</strong></p>
      {error && <div className="error-box">{error}</div>}

      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <h3>Từ vựng</h3>
            <p className="stat-number">{stats.vocab.learned} / {stats.vocab.total}</p>
            <p>đã thuộc</p>
          </div>
          <div className="stat-card">
            <h3>Ngữ pháp</h3>
            <p className="stat-number">{stats.grammar.attempts ? Math.round((stats.grammar.correct / stats.grammar.attempts) * 100) : 0}%</p>
            <p>{stats.grammar.attempts} câu đã làm</p>
          </div>
          <div className="stat-card">
            <h3>Đọc hiểu</h3>
            <p className="stat-number">{stats.reading.total ? Math.round((stats.reading.score / stats.reading.total) * 100) : 0}%</p>
            <p>{stats.reading.attempts} bài đã làm</p>
          </div>
          <div className="stat-card">
            <h3>Nghe</h3>
            <p className="stat-number">{stats.listening.total ? Math.round((stats.listening.score / stats.listening.total) * 100) : 0}%</p>
            <p>{stats.listening.attempts} bài đã làm</p>
          </div>
        </div>
      )}

      <div className="quick-links">
        <Link className="quick-link" to="/vocabulary">🗂️ Học từ vựng</Link>
        <Link className="quick-link" to="/grammar">✍️ Luyện ngữ pháp</Link>
        <Link className="quick-link" to="/reading">📖 Luyện đọc</Link>
        <Link className="quick-link" to="/listening">🎧 Luyện nghe</Link>
      </div>
    </div>
  );
}
