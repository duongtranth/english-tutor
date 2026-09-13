import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';

export default function TestPreview() {
  const { id } = useParams();
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.test(id)
      .then((data) => active && setTest(data))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  async function markReady() {
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateTest(id, { status: 'ready' });
      setTest(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="page"><p>Loading preview...</p></main>;
  if (error && !test) return <main className="page"><div className="alert error">{error}</div></main>;
  if (!test) return null;

  return (
    <main className="page test-preview-page">
      <div className="page-heading-row">
        <div>
          <Link className="back-link" to="/tests">← Test Library</Link>
          <h1>{test.title}</h1>
          <p className="muted">{test.exam_type}{test.source ? ` · ${test.source}` : ''}</p>
        </div>
        <div className="preview-actions">
          <span className={`status-pill ${test.status}`}>{test.status}</span>
          {test.status !== 'ready' && <button className="btn-primary" onClick={markReady} disabled={saving}>{saving ? 'Saving…' : 'Mark ready'}</button>}
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <section className="card">
        <h2>Imported files</h2>
        {test.files.length === 0 ? <p className="muted">No source files.</p> : (
          <div className="file-summary-list">
            {test.files.map((file) => (
              <div className="file-summary-row" key={file.id}>
                <span className="file-kind">{file.kind}</span>
                <strong>{file.original_name}</strong>
                <span className="muted">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card parser-placeholder">
        <h2>Parsed structure</h2>
        {test.sections.length === 0 ? (
          <div>
            <p><strong>Files are stored successfully.</strong> This Phase 1 draft does not yet extract questions from PDFs automatically.</p>
            <p className="muted">The database is already ready for Reading/Listening sections, flexible IELTS/TOEIC question types, choices, correct answers, explanations, and metadata. The AI parser can populate these records in the next phase.</p>
          </div>
        ) : (
          test.sections.map((section) => (
            <article className="section-preview" key={section.id}>
              <h3>{section.title || `${section.skill} section ${section.section_number}`}</h3>
              <p>{section.questions.length} questions</p>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
