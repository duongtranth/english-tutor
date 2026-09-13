import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function showAnswer(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export default function MistakeBook() {
  const { examType } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [skill, setSkill] = useState('all');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.testMistakes(examType)
      .then((data) => active && setItems(data))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [examType]);

  const filtered = useMemo(
    () => skill === 'all' ? items : items.filter((item) => item.skill === skill),
    [items, skill]
  );

  const counts = useMemo(() => items.reduce((acc, item) => {
    acc[item.skill] = (acc[item.skill] || 0) + 1;
    return acc;
  }, {}), [items]);

  return (
    <main className="page mistakes-page">
      <div className="page-heading-row">
        <div>
          <h1>Mistake Book</h1>
          <p className="muted">Wrong answers from your imported {examType} tests, newest first.</p>
        </div>
        <Link className="btn-secondary" to="/tests">Test Library</Link>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="mistake-filters">
        {['all', 'listening', 'reading', 'writing', 'speaking', 'mixed'].map((name) => (
          <button
            key={name}
            className={skill === name ? 'active' : ''}
            onClick={() => setSkill(name)}
          >
            {name === 'all' ? `All (${items.length})` : `${name} (${counts[name] || 0})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading mistakes…</p>
      ) : filtered.length === 0 ? (
        <section className="card empty-state">
          <h2>No mistakes here yet</h2>
          <p>Complete a graded imported test and incorrect answers will appear automatically.</p>
        </section>
      ) : (
        <div className="mistake-list">
          {filtered.map((item) => (
            <article className="card mistake-card" key={item.id}>
              <div className="mistake-card-head">
                <div>
                  <span className="section-skill">{item.skill}</span>
                  <strong>{item.test_title}</strong>
                </div>
                <span className="muted">Q{item.question_number}</span>
              </div>
              <p className="quiz-prompt">{item.prompt}</p>
              {item.options?.length > 0 && (
                <div className="mistake-options">{item.options.map((option) => <span key={option}>{option}</span>)}</div>
              )}
              <div className="answer-compare wrong"><span>Your answer</span><strong>{showAnswer(item.userAnswer)}</strong></div>
              <div className="answer-compare correct"><span>Correct answer</span><strong>{showAnswer(item.correctAnswer)}</strong></div>
              <div className="mistake-card-footer">
                <span className="muted">{new Date(`${item.submitted_at}Z`).toLocaleString()}</span>
                <Link to={`/tests/${item.test_id}/take`}>Retake test →</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
