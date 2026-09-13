import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';

const QUESTION_TYPES = [
  'multiple_choice',
  'multiple_select',
  'true_false_not_given',
  'yes_no_not_given',
  'matching_headings',
  'matching_information',
  'sentence_completion',
  'summary_completion',
  'form_completion',
  'short_answer',
];

function editableSections(sections = []) {
  return sections.map((section) => ({
    sectionNumber: section.section_number,
    skill: section.skill,
    title: section.title || '',
    instructions: section.instructions || '',
    passage: section.passage || '',
    audioFileId: section.audio_file_id || null,
    metadata: section.metadata || {},
    questions: section.questions.map((question) => ({
      questionNumber: question.question_number,
      questionType: question.question_type,
      prompt: question.prompt || '',
      optionsText: (question.options || []).join('\n'),
      correctAnswerText: question.correctAnswer == null
        ? ''
        : typeof question.correctAnswer === 'string'
          ? question.correctAnswer
          : JSON.stringify(question.correctAnswer),
      explanation: question.explanation || '',
      metadata: question.metadata || {},
    })),
  }));
}

function payloadSections(sections) {
  return sections.map((section, sectionIndex) => ({
    sectionNumber: Number(section.sectionNumber) || sectionIndex + 1,
    skill: section.skill,
    title: section.title.trim(),
    instructions: section.instructions.trim(),
    passage: section.passage,
    audioFileId: section.audioFileId,
    metadata: section.metadata || {},
    questions: section.questions.map((question, questionIndex) => ({
      questionNumber: Number(question.questionNumber) || questionIndex + 1,
      questionType: question.questionType,
      prompt: question.prompt.trim() || `Question ${questionIndex + 1}`,
      options: question.optionsText.split('\n').map((option) => option.trim()).filter(Boolean),
      correctAnswer: question.correctAnswerText.trim() || null,
      explanation: question.explanation.trim() || null,
      metadata: question.metadata || {},
    })),
  }));
}

function formatElapsed(seconds = 0) {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export default function TestPreview() {
  const { id } = useParams();
  const [test, setTest] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [draftSections, setDraftSections] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.test(id), api.testAttempts(id)])
      .then(([data, attemptRows]) => {
        if (!active) return;
        setTest(data);
        setAttempts(attemptRows);
        setDraftSections(editableSections(data.sections));
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  async function markReady() {
    const questionCount = test.sections.reduce((sum, section) => sum + section.questions.length, 0);
    if (!questionCount) return setError('This test has no parsed questions yet. Add or parse questions before marking it ready.');
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

  function startEditing() {
    setDraftSections(editableSections(test.sections));
    setEditing(true);
    setError('');
  }

  function updateSection(sectionIndex, patch) {
    setDraftSections((current) => current.map((section, index) => index === sectionIndex ? { ...section, ...patch } : section));
  }

  function updateQuestion(sectionIndex, questionIndex, patch) {
    setDraftSections((current) => current.map((section, index) => {
      if (index !== sectionIndex) return section;
      return {
        ...section,
        questions: section.questions.map((question, qIndex) => qIndex === questionIndex ? { ...question, ...patch } : question),
      };
    }));
  }

  function removeQuestion(sectionIndex, questionIndex) {
    setDraftSections((current) => current.map((section, index) => index === sectionIndex
      ? { ...section, questions: section.questions.filter((_, qIndex) => qIndex !== questionIndex) }
      : section));
  }

  function addQuestion(sectionIndex) {
    setDraftSections((current) => current.map((section, index) => {
      if (index !== sectionIndex) return section;
      const lastNumber = section.questions.at(-1)?.questionNumber || 0;
      return {
        ...section,
        questions: [...section.questions, {
          questionNumber: Number(lastNumber) + 1,
          questionType: 'multiple_choice',
          prompt: '',
          optionsText: '',
          correctAnswerText: '',
          explanation: '',
          metadata: {},
        }],
      };
    }));
  }

  async function saveStructure() {
    setSaving(true);
    setError('');
    try {
      const updated = await api.replaceTestStructure(id, payloadSections(draftSections));
      setTest(updated);
      setDraftSections(editableSections(updated.sections));
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="page"><p>Loading preview...</p></main>;
  if (error && !test) return <main className="page"><div className="alert error">{error}</div></main>;
  if (!test) return null;

  const questionCount = test.sections.reduce((sum, section) => sum + section.questions.length, 0);
  const answeredCount = test.sections.reduce((sum, section) => sum + section.questions.filter((question) => question.correctAnswer != null && question.correctAnswer !== '').length, 0);
  const bestAttempt = attempts.reduce((best, attempt) => {
    if (!attempt.total) return best;
    const ratio = attempt.score / attempt.total;
    if (!best || ratio > best.ratio) return { ...attempt, ratio };
    return best;
  }, null);

  return (
    <main className="page test-preview-page">
      <div className="page-heading-row">
        <div>
          <Link className="back-link" to="/tests">← Test Library</Link>
          <h1>{test.title}</h1>
          <p className="muted">{test.exam_type}{test.source ? ` · ${test.source}` : ''} · {questionCount} questions · {answeredCount} answers</p>
        </div>
        <div className="preview-actions">
          <span className={`status-pill ${test.status}`}>{test.status}</span>
          {!editing && <button className="btn-secondary" onClick={startEditing}>Edit parsed data</button>}
          {test.status !== 'ready' && !editing && <button className="btn-primary" onClick={markReady} disabled={saving}>{saving ? 'Saving…' : 'Mark ready'}</button>}
          {test.status === 'ready' && !editing && <Link className="btn-primary" to={`/tests/${id}/take`}>Start test</Link>}
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

      {attempts.length > 0 && (
        <section className="card attempt-history-card">
          <div className="section-heading-row">
            <div>
              <h2>Attempt history</h2>
              <p className="muted">Track recent scores and time spent on this test.</p>
            </div>
            {bestAttempt && <strong>Best {bestAttempt.score}/{bestAttempt.total} · {Math.round(bestAttempt.ratio * 100)}%</strong>}
          </div>
          <div className="attempt-history-list">
            {attempts.slice(0, 10).map((attempt) => (
              <div className="attempt-history-row" key={attempt.id}>
                <div>
                  <strong>{attempt.score}/{attempt.total}</strong>
                  <span>{attempt.total ? `${Math.round((attempt.score / attempt.total) * 100)}%` : 'ungraded'}</span>
                </div>
                <span>{attempt.answered_count} answered</span>
                <span>{formatElapsed(attempt.elapsed_seconds)}</span>
                <span>{new Date(`${attempt.submitted_at}Z`).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card parsed-structure-card">
        <div className="section-heading-row">
          <div>
            <h2>Parsed structure</h2>
            <p className="muted">Review parser output before marking the test ready. Automatic parsing is deliberately editable because exam PDFs vary in layout.</p>
          </div>
          {editing && (
            <div className="inline-actions">
              <button className="btn-link" onClick={() => { setEditing(false); setDraftSections(editableSections(test.sections)); }}>Cancel</button>
              <button className="btn-primary" onClick={saveStructure} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          )}
        </div>

        {!editing && test.sections.length === 0 && (
          <div className="empty-parser-state">
            <p><strong>No structured questions were detected.</strong></p>
            <p className="muted">Text-based PDF/TXT files can be analyzed on the Import page. Scanned PDFs and images will need the OCR/vision adapter planned for the next step.</p>
          </div>
        )}

        {!editing && test.sections.map((section) => (
          <article className="section-preview" key={section.id}>
            <div className="section-heading-row">
              <div>
                <span className="file-kind">{section.skill}</span>
                <h3>{section.title || `${section.skill} section ${section.section_number}`}</h3>
              </div>
              <strong>{section.questions.length} questions</strong>
            </div>
            {section.passage && <details><summary>Passage / source text</summary><div className="passage-preview">{section.passage}</div></details>}
            <div className="parsed-question-list">
              {section.questions.map((question) => (
                <div className="parsed-question" key={question.id}>
                  <div className="question-number">{question.question_number}</div>
                  <div className="question-body">
                    <div><span className="question-type">{question.question_type}</span> {question.prompt}</div>
                    {question.options?.length > 0 && <div className="option-preview">{question.options.join(' · ')}</div>}
                    <div className={question.correctAnswer ? 'answer-present' : 'answer-missing'}>
                      Answer: {question.correctAnswer || 'not detected'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}

        {editing && draftSections.map((section, sectionIndex) => (
          <article className="section-editor" key={`${section.sectionNumber}-${sectionIndex}`}>
            <div className="form-row three-cols">
              <label>Section #<input type="number" min="1" value={section.sectionNumber} onChange={(e) => updateSection(sectionIndex, { sectionNumber: e.target.value })} /></label>
              <label>Skill<select value={section.skill} onChange={(e) => updateSection(sectionIndex, { skill: e.target.value })}><option value="reading">Reading</option><option value="listening">Listening</option><option value="writing">Writing</option><option value="speaking">Speaking</option><option value="mixed">Mixed</option></select></label>
              <label>Title<input value={section.title} onChange={(e) => updateSection(sectionIndex, { title: e.target.value })} /></label>
            </div>
            <label>Instructions<textarea rows="2" value={section.instructions} onChange={(e) => updateSection(sectionIndex, { instructions: e.target.value })} /></label>
            <label>Passage / context<textarea rows="6" value={section.passage} onChange={(e) => updateSection(sectionIndex, { passage: e.target.value })} /></label>

            <div className="question-editor-list">
              {section.questions.map((question, questionIndex) => (
                <div className="question-editor" key={`${question.questionNumber}-${questionIndex}`}>
                  <div className="form-row three-cols">
                    <label>#<input type="number" min="1" value={question.questionNumber} onChange={(e) => updateQuestion(sectionIndex, questionIndex, { questionNumber: e.target.value })} /></label>
                    <label>Type<select value={question.questionType} onChange={(e) => updateQuestion(sectionIndex, questionIndex, { questionType: e.target.value })}>{QUESTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                    <label>Answer<input value={question.correctAnswerText} onChange={(e) => updateQuestion(sectionIndex, questionIndex, { correctAnswerText: e.target.value })} placeholder="A / TRUE / word" /></label>
                  </div>
                  <label>Question<textarea rows="2" value={question.prompt} onChange={(e) => updateQuestion(sectionIndex, questionIndex, { prompt: e.target.value })} /></label>
                  <label>Options — one per line<textarea rows="3" value={question.optionsText} onChange={(e) => updateQuestion(sectionIndex, questionIndex, { optionsText: e.target.value })} placeholder={'A. option one\nB. option two'} /></label>
                  <button type="button" className="btn-link danger" onClick={() => removeQuestion(sectionIndex, questionIndex)}>Remove question</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-secondary" onClick={() => addQuestion(sectionIndex)}>+ Add question</button>
          </article>
        ))}
      </section>
    </main>
  );
}
