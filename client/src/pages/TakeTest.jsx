import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';

function suggestedMinutes(test) {
  const skills = new Set((test?.sections || []).map((section) => section.skill));
  if (test?.exam_type === 'TOEIC') {
    if (skills.has('listening') && skills.has('reading')) return 120;
    if (skills.has('listening')) return 45;
    if (skills.has('reading')) return 75;
  }
  if (test?.exam_type === 'IELTS') {
    if (skills.size === 1 && skills.has('listening')) return 40;
    if (skills.size === 1 && skills.has('reading')) return 60;
    if (skills.size === 1 && skills.has('writing')) return 60;
    if (skills.size === 1 && skills.has('speaking')) return 15;
    if (skills.has('listening') && skills.has('reading')) return 100;
  }
  return 60;
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function fixedChoices(type) {
  if (type === 'true_false_not_given') return ['TRUE', 'FALSE', 'NOT GIVEN'];
  if (type === 'yes_no_not_given') return ['YES', 'NO', 'NOT GIVEN'];
  return null;
}

function optionValue(option, index) {
  const text = String(option ?? '').trim();
  const match = text.match(/^([A-H])[.)\s]/i);
  return match ? match[1].toUpperCase() : String.fromCharCode(65 + index);
}

function displayAnswer(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function AudioPlayer({ testId, fileId }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    api.testFile(testId, fileId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [testId, fileId]);

  if (error) return <div className="alert error">Audio: {error}</div>;
  if (!url) return <p className="muted">Loading audio…</p>;
  return <audio className="test-audio" controls preload="metadata" src={url} />;
}

function QuestionInput({ question, value, onChange }) {
  const forced = fixedChoices(question.question_type);
  const choices = forced || (Array.isArray(question.options) && question.options.length ? question.options : null);
  const isMulti = question.question_type === 'multiple_select';

  if (choices) {
    if (isMulti) {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="take-options">
          {choices.map((option, index) => {
            const answerValue = forced ? option : optionValue(option, index);
            return (
              <label className="take-option" key={`${answerValue}-${index}`}>
                <input
                  type="checkbox"
                  checked={selected.includes(answerValue)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...selected, answerValue]
                      : selected.filter((item) => item !== answerValue);
                    onChange(next);
                  }}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      );
    }

    return (
      <div className="take-options">
        {choices.map((option, index) => {
          const answerValue = forced ? option : optionValue(option, index);
          return (
            <label className="take-option" key={`${answerValue}-${index}`}>
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={value === answerValue}
                onChange={() => onChange(answerValue)}
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <input
      className="take-text-answer"
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Type your answer"
      autoComplete="off"
    />
  );
}

export default function TakeTest() {
  const { id } = useParams();
  const storageKey = `english-tutor:test-progress:${id}`;
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('setup');
  const [answers, setAnswers] = useState({});
  const [startedAt, setStartedAt] = useState(null);
  const [durationSeconds, setDurationSeconds] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [savedProgress, setSavedProgress] = useState(null);
  const submittingRef = useRef(false);
  const answersRef = useRef({});

  useEffect(() => { answersRef.current = answers; }, [answers]);

  useEffect(() => {
    let active = true;
    api.testForTaking(id)
      .then((data) => {
        if (!active) return;
        setTest(data);
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
          if (saved?.startedAt && saved?.answers) setSavedProgress(saved);
        } catch {}
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id, storageKey]);

  const questions = useMemo(() => (test?.sections || []).flatMap((section) => section.questions || []), [test]);
  const answeredCount = useMemo(() => questions.filter((question) => {
    const value = answers[question.id];
    return Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== '';
  }).length, [questions, answers]);

  function persist(nextAnswers = answersRef.current, nextStartedAt = startedAt, nextDuration = durationSeconds) {
    if (!nextStartedAt) return;
    localStorage.setItem(storageKey, JSON.stringify({ answers: nextAnswers, startedAt: nextStartedAt, durationSeconds: nextDuration }));
  }

  function start(timed) {
    const now = Date.now();
    const duration = timed ? suggestedMinutes(test) * 60 : null;
    answersRef.current = {};
    setAnswers({});
    setStartedAt(now);
    setDurationSeconds(duration);
    setTimeLeft(duration);
    setSavedProgress(null);
    setMode('running');
    persist({}, now, duration);
  }

  function resume() {
    const saved = savedProgress;
    if (!saved) return;
    const restoredAnswers = saved.answers || {};
    answersRef.current = restoredAnswers;
    setAnswers(restoredAnswers);
    setStartedAt(saved.startedAt);
    setDurationSeconds(saved.durationSeconds ?? null);
    if (saved.durationSeconds) {
      const elapsed = Math.floor((Date.now() - saved.startedAt) / 1000);
      setTimeLeft(Math.max(0, saved.durationSeconds - elapsed));
    } else {
      setTimeLeft(null);
    }
    setMode('running');
  }

  function discardSavedAttempt() {
    localStorage.removeItem(storageKey);
    setSavedProgress(null);
  }

  function setAnswer(questionId, value) {
    setAnswers((current) => {
      const next = { ...current, [questionId]: value };
      answersRef.current = next;
      persist(next);
      return next;
    });
  }

  async function submit(auto = false) {
    if (submittingRef.current || !startedAt) return;
    if (!auto && !window.confirm(`Submit now? You answered ${answeredCount}/${questions.length} questions.`)) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const data = await api.submitTest(id, answersRef.current, elapsed);
      localStorage.removeItem(storageKey);
      setResult(data);
      setMode('result');
    } catch (err) {
      setError(err.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (mode !== 'running' || !durationSeconds || !startedAt) return undefined;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, durationSeconds - elapsed);
      setTimeLeft(remaining);
      if (remaining === 0) submit(true);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [mode, durationSeconds, startedAt]);

  if (loading) return <main className="page"><p>Loading test…</p></main>;
  if (error && !test) return <main className="page"><div className="alert error">{error}</div></main>;
  if (!test) return null;

  if (mode === 'setup') {
    const minutes = suggestedMinutes(test);
    return (
      <main className="page take-test-page">
        <Link className="back-link" to={`/tests/${id}`}>← Test preview</Link>
        <section className="card take-setup-card">
          <span className="exam-pill">{test.exam_type}</span>
          <h1>{test.title}</h1>
          <p className="muted">{questions.length} questions · {test.sections.length} sections</p>
          <div className="take-setup-actions">
            <button className="btn-primary" onClick={() => start(true)}>Start timed · {minutes} min</button>
            <button className="btn-secondary" onClick={() => start(false)}>Practice without timer</button>
          </div>
          {savedProgress && (
            <div className="resume-box">
              <strong>Saved attempt found</strong>
              <span>Your answers were autosaved in this browser.</span>
              <div className="inline-actions">
                <button className="btn-secondary" onClick={resume}>Resume attempt</button>
                <button className="btn-link danger" onClick={discardSavedAttempt}>Discard</button>
              </div>
            </div>
          )}
        </section>
      </main>
    );
  }

  if (mode === 'result' && result) {
    const percent = result.total ? Math.round((result.score / result.total) * 100) : 0;
    const wrong = (result.answers || []).filter((item) => !item.is_correct);
    return (
      <main className="page take-test-page">
        <section className="card result-hero">
          <span className="exam-pill">{test.exam_type}</span>
          <h1>{result.score} / {result.total}</h1>
          <div className="result-percent">{percent}%</div>
          <p>{wrong.length === 0 ? 'No graded mistakes — nice run.' : `${wrong.length} graded question${wrong.length === 1 ? '' : 's'} to review.`}</p>
          <p className="muted">Time: {formatTime(result.elapsed_seconds)} · Answered: {result.answered_count}/{questions.length}</p>
          <div className="take-setup-actions">
            <button className="btn-primary" onClick={() => { setResult(null); setMode('setup'); }}>Retake</button>
            <Link className="btn-secondary" to="/mistakes">Open Mistake Book</Link>
            <Link className="btn-secondary" to={`/tests/${id}`}>Attempt history</Link>
          </div>
        </section>

        {wrong.length > 0 && (
          <section className="result-review-list">
            <h2>Review mistakes</h2>
            {wrong.map((item) => (
              <article className="card result-question" key={item.id}>
                <div className="question-kicker">{item.skill} · Q{item.question_number}</div>
                <p className="quiz-prompt">{item.prompt}</p>
                <div className="answer-compare wrong"><span>Your answer</span><strong>{displayAnswer(item.userAnswer)}</strong></div>
                <div className="answer-compare correct"><span>Correct answer</span><strong>{displayAnswer(item.correctAnswer)}</strong></div>
              </article>
            ))}
          </section>
        )}
      </main>
    );
  }

  return (
    <main className="page take-test-page">
      <header className="take-sticky-header">
        <div>
          <strong>{test.title}</strong>
          <span>{answeredCount}/{questions.length} answered</span>
        </div>
        <div className={`test-timer ${timeLeft !== null && timeLeft < 300 ? 'warning' : ''}`}>
          {timeLeft === null ? 'Untimed' : formatTime(timeLeft)}
        </div>
        <button className="btn-primary" disabled={submitting} onClick={() => submit(false)}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </header>

      {error && <div className="alert error">{error}</div>}

      <nav className="question-nav" aria-label="Question navigation">
        {questions.map((question) => {
          const value = answers[question.id];
          const answered = Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== '';
          return <a className={answered ? 'answered' : ''} href={`#question-${question.id}`} key={question.id}>{question.question_number}</a>;
        })}
      </nav>

      {(test.sections || []).map((section) => (
        <section className="take-section" key={section.id}>
          <div className="card take-section-heading">
            <div>
              <span className="section-skill">{section.skill}</span>
              <h2>{section.title || `Section ${section.section_number}`}</h2>
              {section.instructions && <p className="muted pre-wrap">{section.instructions}</p>}
            </div>
            {section.audio_file_id && <AudioPlayer testId={id} fileId={section.audio_file_id} />}
          </div>

          {section.passage && <article className="passage-body take-passage">{section.passage}</article>}

          <div className="take-question-list">
            {(section.questions || []).map((question) => (
              <article className="card take-question" id={`question-${question.id}`} key={question.id}>
                <div className="question-kicker">Question {question.question_number} · {question.question_type.replaceAll('_', ' ')}</div>
                <p className="quiz-prompt">{question.prompt}</p>
                <QuestionInput question={question} value={answers[question.id]} onChange={(value) => setAnswer(question.id, value)} />
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
