import { useEffect, useMemo, useState } from 'react';
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
  if (
    file.type === 'application/pdf' || file.type.startsWith('image/') ||
    name.endsWith('.pdf') || name.endsWith('.txt') || name.endsWith('.md')
  ) return 'question';
  return 'other';
}

function supportsExtraction(file) {
  const name = file.name.toLowerCase();
  return file.type === 'application/pdf' || file.type.startsWith('text/') || file.type.startsWith('image/') ||
    name.endsWith('.pdf') || name.endsWith('.txt') || name.endsWith('.md') || /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(name);
}

function isPdf(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isImage(file) {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(file.name);
}

function isText(file) {
  const name = file.name.toLowerCase();
  return file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md');
}

function meaningfulText(text) {
  return String(text || '').replace(/--- PAGE BREAK ---/g, '').replace(/\s+/g, '').length >= 80;
}

function progressLabel(fileName, detail) {
  const page = detail?.page ? ` · page ${detail.page}${detail.pages ? `/${detail.pages}` : ''}` : '';
  const pct = typeof detail?.progress === 'number' ? ` · ${Math.round(detail.progress * 100)}%` : '';
  if (detail?.phase === 'ocr-fallback') return `${fileName}: PaddleOCR-VL unavailable — using browser OCR…`;
  if (detail?.phase === 'render') return `${fileName}: rendering for browser OCR${page}`;
  if (detail?.phase === 'ocr') return `${fileName}: browser OCR${page}${pct}`;
  return `${fileName}: extracting embedded text${page}${pct}`;
}

export default function ImportTest() {
  const navigate = useNavigate();
  const { examType } = useAuth();
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [selectedExam, setSelectedExam] = useState(examType);
  const [files, setFiles] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [ocrStatus, setOcrStatus] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const totalSize = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);

  useEffect(() => {
    let active = true;
    api.ocrStatus()
      .then((status) => active && setOcrStatus(status))
      .catch(() => active && setOcrStatus(null));
    return () => { active = false; };
  }, []);

  function invalidateAnalysis() {
    setAnalysis(null);
    setAnalysisStatus('');
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

  async function runLocalOcr(file) {
    if (file.size > 40 * 1024 * 1024) throw new Error(`${file.name}: local OCR input must be 40 MB or smaller.`);
    setAnalysisStatus(`${file.name}: running PaddleOCR-VL-1.6 locally…`);
    const result = await api.ocrDocument({
      name: file.name,
      type: file.type,
      dataBase64: await readAsDataUrl(file),
    });
    if (!meaningfulText(result.text)) throw new Error(`${file.name}: PaddleOCR-VL returned too little readable text.`);
    return result.text;
  }

  async function extractForAnalysis(file, warnings) {
    if (isText(file)) {
      return extractTextFromFile(file, {
        ocrFallback: false,
        onProgress: (detail) => setAnalysisStatus(progressLabel(file.name, detail)),
      });
    }

    if (isPdf(file)) {
      let embedded = '';
      try {
        embedded = await extractTextFromFile(file, {
          ocrFallback: false,
          onProgress: (detail) => setAnalysisStatus(progressLabel(file.name, detail)),
        });
      } catch (err) {
        warnings.push(`${file.name}: embedded-text extraction failed (${err.message}). Trying local document OCR.`);
      }
      if (meaningfulText(embedded)) return embedded;
    }

    if (isImage(file) || isPdf(file)) {
      try {
        const text = await runLocalOcr(file);
        warnings.push(`${file.name}: parsed with local PaddleOCR-VL-1.6.`);
        return text;
      } catch (localErr) {
        warnings.push(`${file.name}: PaddleOCR-VL unavailable or failed (${localErr.message}). Falling back to browser Tesseract OCR.`);
        setAnalysisStatus(`${file.name}: local model failed — using browser OCR fallback…`);
        const fallback = await extractTextFromFile(file, {
          ocrFallback: true,
          onProgress: (detail) => setAnalysisStatus(progressLabel(file.name, detail)),
        });
        return fallback;
      }
    }

    throw new Error(`${file.name}: unsupported file type for text/OCR analysis.`);
  }

  async function analyzeFiles() {
    setAnalyzing(true);
    setError('');
    setAnalysisStatus('Preparing files…');
    try {
      const questionTexts = [];
      const answerTexts = [];
      const extractionWarnings = [];
      const candidates = files.filter((item) => item.kind === 'question' || item.kind === 'answer');

      if (!candidates.length) throw new Error('Add at least one question paper or answer-key file first.');

      for (const item of candidates) {
        if (!supportsExtraction(item.file)) {
          extractionWarnings.push(`${item.file.name}: unsupported file type for text/OCR analysis.`);
          continue;
        }
        try {
          setAnalysisStatus(`${item.file.name}: starting analysis…`);
          const text = await extractForAnalysis(item.file, extractionWarnings);
          const target = item.kind === 'answer' ? answerTexts : questionTexts;
          target.push({ name: item.file.name, text });
        } catch (err) {
          extractionWarnings.push(err.message);
        }
      }

      if (!questionTexts.length) {
        setAnalysis({ sections: [], questionCount: 0, answerCount: 0, matchedAnswers: 0, warnings: extractionWarnings });
        throw new Error('No question text could be extracted. Try a clearer scan/photo or check the file role.');
      }

      setAnalysisStatus('Parsing IELTS/TOEIC structure and matching answers…');
      const parsed = parseTestText(questionTexts, answerTexts, selectedExam);
      setAnalysis({ ...parsed, warnings: [...extractionWarnings, ...parsed.warnings] });
      setAnalysisStatus(`Done · ${parsed.questionCount} questions · ${parsed.matchedAnswers} answers matched`);
    } catch (err) {
      setError(err.message);
      setAnalysisStatus('');
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
          <p className="muted">Upload PDF/TXT/images plus an optional answer key and audio. Embedded PDF text is used first; scans and photos use local PaddleOCR-VL-1.6, with browser OCR only as a fallback.</p>
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
          <span>PDF · JPG/PNG · TXT · MP3/M4A/WAV · answer keys</span>
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
            {analyzing ? 'Analyzing…' : 'Analyze files'}
          </button>
          <div className={`local-ocr-status ${ocrStatus?.ready ? 'ready' : 'missing'}`}>
            {ocrStatus?.ready ? (
              <><strong>PaddleOCR-VL-1.6 ready</strong><span>Local · {ocrStatus.device}</span></>
            ) : (
              <><strong>Local model not installed</strong><span>Run: cd server &amp;&amp; bash ocr/setup_ocr.sh</span></>
            )}
          </div>
        </div>

        {analysisStatus && <div className={`analysis-progress ${analyzing ? 'running' : 'done'}`}>{analysisStatus}</div>}

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
          <button className="btn-primary" disabled={submitting || analyzing}>
            {submitting ? 'Importing…' : analysis?.questionCount ? 'Import parsed draft' : 'Import draft'}
          </button>
        </div>
      </form>
    </main>
  );
}
