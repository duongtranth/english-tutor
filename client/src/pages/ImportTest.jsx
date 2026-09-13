import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function guessKind(file) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith('audio/')) return 'audio';
  if (name.includes('answer') || name.includes('key')) return 'answer';
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'question';
  return 'other';
}

export default function ImportTest() {
  const navigate = useNavigate();
  const { examType } = useAuth();
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [selectedExam, setSelectedExam] = useState(examType);
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const totalSize = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);

  function addFiles(fileList) {
    const next = Array.from(fileList || []).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      kind: guessKind(file),
    }));
    setFiles((current) => [...current, ...next]);
  }

  async function submit(event) {
    event.preventDefault();
    if (!title.trim()) return setError('Please enter a test title.');
    if (files.length === 0) return setError('Please add at least one file.');
    if (totalSize > 55 * 1024 * 1024) return setError('For Phase 1, keep one import under 55 MB.');

    setSubmitting(true);
    setError('');
    try {
      const encodedFiles = await Promise.all(files.map(async (item) => ({
        clientKey: item.id,
        name: item.file.name,
        type: item.file.type,
        kind: item.kind,
        dataBase64: await readAsDataUrl(item.file),
      })));
      const created = await api.importTest({
        title: title.trim(),
        examType: selectedExam,
        source: source.trim(),
        files: encodedFiles,
        sections: [],
      });
      navigate(`/tests/${created.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page import-page">
      <div className="page-heading-row">
        <div>
          <h1>Import a test</h1>
          <p className="muted">Phase 1 stores your source files and creates a draft test. AI parsing comes next.</p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <form className="card import-form" onSubmit={submit}>
        <label>
          Test title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cambridge IELTS 20 — Test 1" />
        </label>

        <div className="form-row">
          <label>
            Exam
            <select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)}>
              <option value="IELTS">IELTS</option>
              <option value="TOEIC">TOEIC</option>
            </select>
          </label>
          <label>
            Source / book
            <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Cambridge 20" />
          </label>
        </div>

        <label className="drop-zone">
          <strong>Drop files here or click to browse</strong>
          <span>PDF, images, MP3/M4A/WAV, answer keys</span>
          <input
            type="file"
            multiple
            accept=".pdf,image/*,audio/*,.doc,.docx,.txt"
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>

        {files.length > 0 && (
          <div className="upload-list">
            {files.map((item) => (
              <div className="upload-row" key={item.id}>
                <div>
                  <strong>{item.file.name}</strong>
                  <span>{(item.file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <select
                  value={item.kind}
                  onChange={(e) => setFiles((current) => current.map((x) => x.id === item.id ? { ...x, kind: e.target.value } : x))}
                >
                  <option value="question">Question paper</option>
                  <option value="audio">Audio</option>
                  <option value="answer">Answer key</option>
                  <option value="other">Other</option>
                </select>
                <button type="button" className="btn-link danger" onClick={() => setFiles((current) => current.filter((x) => x.id !== item.id))}>Remove</button>
              </div>
            ))}
            <p className="muted">Total: {(totalSize / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        )}

        <div className="form-actions">
          <button className="btn-primary" disabled={submitting}>{submitting ? 'Importing…' : 'Import draft'}</button>
        </div>
      </form>
    </main>
  );
}
