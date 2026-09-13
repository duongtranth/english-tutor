import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function TestLibrary() {
  const { examType } = useAuth();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.tests(examType)
      .then((data) => active && setTests(data))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [examType]);

  async function removeTest(id) {
    if (!window.confirm('Delete this imported test and its uploaded files?')) return;
    try {
      await api.deleteTest(id);
      setTests((items) => items.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="page tests-page">
      <div className="page-heading-row">
        <div>
          <h1>Test Library</h1>
          <p className="muted">Your imported {examType} practice tests.</p>
        </div>
        <Link className="btn-primary" to="/tests/import">+ Import test</Link>
      </div>

      {error && <div className="alert error">{error}</div>}
      {loading ? (
        <p>Loading tests...</p>
      ) : tests.length === 0 ? (
        <section className="empty-state card">
          <h2>No {examType} tests yet</h2>
          <p>Import a question PDF, audio file, answer key, or any combination of them.</p>
          <Link className="btn-primary" to="/tests/import">Import your first test</Link>
        </section>
      ) : (
        <div className="test-grid">
          {tests.map((test) => (
            <article className="card test-card" key={test.id}>
              <div className="test-card-top">
                <span className={`status-pill ${test.status}`}>{test.status}</span>
                <span className="exam-pill">{test.exam_type}</span>
              </div>
              <h2>{test.title}</h2>
              {test.source && <p className="muted">{test.source}</p>}
              <div className="test-meta">
                <span>{test.file_count} file{test.file_count === 1 ? '' : 's'}</span>
                <span>{test.section_count} section{test.section_count === 1 ? '' : 's'}</span>
              </div>
              <div className="test-actions">
                <Link className="btn-secondary" to={`/tests/${test.id}`}>Preview</Link>
                <button className="btn-link danger" onClick={() => removeTest(test.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
