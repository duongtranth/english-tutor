import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { extractTextFromFile } from '../utils/pdfText';
import { parseTestText } from '../utils/testParser';

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
  if (file.type === 'application/pdf' || name.endsWith('.pdf') || name.endsWith('.txt')) return 'question';
  return 'other';
}

function supportsTextExtraction(file) {
  const name = file.name.toLowerCase();
  return file.type === 'application/pdf' || file.type.startsWith('text/') || name.endsWith('.pdf') || name.endsWith('.txt') || name.endsWith('.md');
}

export default function ImportTest() {
  const navigate = useNavigate();
  const { examType } = useAuth();
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [selectedExam, setSelectedExam] = useState(examType);
  const [files, setFiles] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const totalSize = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);

  function invalidateAnalysis() {
    setAnalysis(null);
  }

  function addFiles(fileList) {
    const next = Array.from(fileList || []).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      kind: guessKind(file),
    }));
    setFiles((current) => [...current, ...next]);
    invalidateAnalysis();
  }

  function setFileKind(id, kind) {
    setFiles((current) => current.map((item) => item.id === id ? { ...item, kind } : item));
    invalidateAnalysis();
  }

  async function analyzeFiles() {
    setAnalyzing(true);
    setError('');
    try {
      const questionTexts = [];
      const answerTexts = [];
      const extractionWarnings = [];
      const candidates = files.filter((item) => item.kind === 'question' || item.kind === 'answer');

      if (!candidates.length) throw new Error('Add at least one question paper or answer-key file first.');

      for (const item of candidates) {
        if (!supportsTextExtraction(item.file)) {
          extractionWarnings.push(`${item.file.name}: image/OCR parsing is not enabled yet.`);
          continue;
        }
        try {
          const text = await extractTextFromFile(item.file);
          const target = item.kind === 'answer' ? answerTexts : questionTexts;
          target.push({ name: item.file.name, text });
        } catch (err) {
          extractionWarnings.push(err.message);
        }
      }

      if (!questionTexts.length) {
        setAnalysis({ sections: [], questionCount: 0, answerCount: 0, matchedAnswers: 0, warnings: extractionWarnings });
        throw new Error('No extractable question text was found. Text-based PDFs/TXT work now; scanned PDFs/images need OCR/vision parsing.');
      }

      const parsed = parseTestText(questionTexts, answerTexts, selectedExam);
      setAnalysis({ ...parsed, warnings: [...extractionWarnings, ...parsed.warnings] });
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!title.trim()) return setError('Please enter a test title.');
    if (files.length === 0) return setError('Please add at least one file.');
    if (totalSize > 55 * 1024 * 1024) return setError('Keep one import under 55 MB.');

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
      const audio = files.find((item) => item.kind === 'audio');
      const parsedSections = (analysis?.sections || []).map((section) => ({
        ...section,
        audioClientKey: section.skill === 'listening' ? audio?.id || null : null,
      }));
      const created = await api.importTest({
        title: title.trim(),
        examType: selectedExam,
        source: source.trim(),
        files: encodedFiles,
        sections: parsedSections,
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
          <p className="muted">Upload a text-based PDF/TXT question paper and answer key. The parser will build an editable draft before you mark it ready.</p>
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
            <select value={selectedExam} onChange={(e) => { setSelectedExam(e.target.value); invalidateAnalysis(); }}>
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
          <span>Text PDF/TXT for parsing · images/audio are stored with the test</span>
          <input
            type="file"
            multiple
            accept=".pdf,image/*,audio/*,.txt,.md"
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
                <select value={item.kind} onChange={(e) => setFileKind(item.id, e.target.value)}>
                  <option value="question">Question paper</option>
                  <option value="audio">Audio</option>
                  <option value="answer">Answer key</option>
                  <option value="other">Other</option>
                </select>
                <button type="button" className="btn-link danger" onClick={() => { setFiles((current) => current.filter((x) => x.id !== item.id)); invalidateAnalysis(); }}>Remove</button>
              </div>
            ))}
            <p className="muted">Total: {(totalSize / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        )}

        <div className="analysis-actions">
          <button type="button" className="btn-secondary" onClick={analyzeFiles} disabled={analyzing || files.length === 0}>
            {analyzing ? 'Analyzing PDF…' : 'Analyze files'}
          </button>
          <span className="muted">Run this before importing if you want questions and answers extracted automatically.</span>
        </div>

        {analysis && (
          <section className="analysis-summary">
            <div><strong>{analysis.questionCount}</strong><span>questions</span></div>
            <div><strong>{analysis.sections.length}</strong><span>sections</span></div>
            <div><strong>{analysis.matchedAnswers}/{analysis.answerCount}</strong><span>answers mapped</span></div>
            {analysis.warnings.length > 0 && (
              <ul className="parser-warnings">
                {analysis.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
              </ul>
            )}
          </section>
        )}

        <div className="form-actions">
          <button className="btn-primary" disabled={submitting}>
            {submitting ? 'Importing…' : analysis?.questionCount ? 'Import parsed draft' : 'Import draft'}
          </button>
        </div>
      </form>
    </main>
  );
}
