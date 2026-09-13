const TYPE_PATTERNS = [
  ['true_false_not_given', /TRUE\s*\/\s*FALSE\s*\/\s*NOT GIVEN|TRUE,? FALSE,? OR NOT GIVEN/i],
  ['yes_no_not_given', /YES\s*\/\s*NO\s*\/\s*NOT GIVEN|YES,? NO,? OR NOT GIVEN/i],
  ['matching_headings', /MATCH(?:ING)?\s+HEADINGS|CHOOSE THE CORRECT HEADING/i],
  ['summary_completion', /COMPLETE THE SUMMARY/i],
  ['form_completion', /COMPLETE THE FORM|COMPLETE THE NOTES|COMPLETE THE TABLE|COMPLETE THE FLOW-CHART/i],
  ['sentence_completion', /COMPLETE THE SENTENCES|COMPLETE EACH SENTENCE/i],
  ['short_answer', /ANSWER THE QUESTIONS|SHORT-ANSWER QUESTIONS/i],
  ['multiple_select', /CHOOSE (?:TWO|THREE|FOUR) LETTERS|CHOOSE (?:TWO|THREE|FOUR) ANSWERS/i],
  ['multiple_choice', /CHOOSE THE CORRECT LETTER|MULTIPLE CHOICE/i],
];

function normalize(text = '') {
  return text
    .replace(/\r/g, '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function inferQuestionType(context = '', prompt = '', options = []) {
  const haystack = `${context}\n${prompt}`;
  for (const [type, pattern] of TYPE_PATTERNS) {
    if (pattern.test(haystack)) return type;
  }
  if (options.length >= 2) return 'multiple_choice';
  if (/_{2,}|\.{3,}|\bblank\b/i.test(prompt)) return 'sentence_completion';
  return 'short_answer';
}

function extractQuestionRange(line) {
  const match = line.match(/Questions?\s+(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/i);
  return match ? { start: Number(match[1]), end: Number(match[2] || match[1]) } : null;
}

function detectSkill(text, fallback = 'mixed') {
  if (/\bREADING\b|READING PASSAGE/i.test(text)) return 'reading';
  if (/\bLISTENING\b/i.test(text)) return 'listening';
  if (/\bWRITING\b/i.test(text)) return 'writing';
  if (/\bSPEAKING\b/i.test(text)) return 'speaking';
  return fallback;
}

function findSectionMarkers(text, examType) {
  const markers = [];
  let match;
  const regex = examType === 'TOEIC'
    ? /(^|\n)(PART\s+([1-7])\b[^\n]*)/gi
    : /(^|\n)((?:READING PASSAGE\s+[1-3]|SECTION\s+[1-4]|PART\s+[1-4])\b[^\n]*)/gi;

  while ((match = regex.exec(text))) {
    const title = match[2].trim();
    const numberMatch = title.match(/(\d+)/);
    markers.push({ index: match.index + match[1].length, title, number: Number(numberMatch?.[1] || markers.length + 1) });
  }
  return markers;
}

function sectionSkill(title, documentText, examType) {
  if (examType === 'TOEIC') {
    const part = Number(title.match(/PART\s+(\d+)/i)?.[1]);
    if (part >= 1 && part <= 4) return 'listening';
    if (part >= 5 && part <= 7) return 'reading';
  }
  if (/READING PASSAGE/i.test(title)) return 'reading';
  if (/SECTION\s+[1-4]/i.test(title) && /\bLISTENING\b/i.test(documentText.slice(0, 1600))) return 'listening';
  return detectSkill(documentText);
}

function splitIntoSections(text, examType) {
  const markers = findSectionMarkers(text, examType);
  if (!markers.length) {
    return [{
      title: detectSkill(text) === 'mixed' ? `${examType} imported section` : `${detectSkill(text)} section`,
      sectionNumber: 1,
      skill: detectSkill(text),
      body: text,
    }];
  }

  const sections = [];
  for (let i = 0; i < markers.length; i += 1) {
    const marker = markers[i];
    const end = markers[i + 1]?.index ?? text.length;
    sections.push({
      title: marker.title,
      sectionNumber: marker.number || i + 1,
      skill: sectionSkill(marker.title, text, examType),
      body: text.slice(marker.index, end).trim(),
    });
  }
  return sections;
}

function parseQuestions(section) {
  const lines = section.body.split('\n').map((line) => line.trim()).filter(Boolean);
  const questions = [];
  let current = null;
  let instructionBuffer = [];
  let activeInstruction = '';
  let firstQuestionLineIndex = -1;

  function finishCurrent() {
    if (!current) return;
    current.prompt = current.prompt.join(' ').replace(/\s+/g, ' ').trim();
    current.questionType = inferQuestionType(current.instructions, current.prompt, current.options);
    if (!current.prompt) current.prompt = `Question ${current.questionNumber}`;
    questions.push(current);
    current = null;
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const range = extractQuestionRange(line);
    if (range) {
      instructionBuffer.push(line);
      if (instructionBuffer.length > 10) instructionBuffer.shift();
      activeInstruction = instructionBuffer.slice(-6).join('\n');
      continue;
    }

    const qMatch = line.match(/^(\d{1,3})(?:[.)]|\s*[-–:]\s*|\s+)(.*)$/);
    const optionMatch = line.match(/^([A-H])[.)]\s*(.+)$/i);

    if (qMatch && Number(qMatch[1]) <= 250) {
      finishCurrent();
      if (firstQuestionLineIndex < 0) firstQuestionLineIndex = i;
      current = {
        questionNumber: Number(qMatch[1]),
        prompt: [qMatch[2] || ''],
        options: [],
        correctAnswer: null,
        explanation: null,
        instructions: activeInstruction,
        metadata: {},
      };
      continue;
    }

    if (current && optionMatch) {
      current.options.push(`${optionMatch[1].toUpperCase()}. ${optionMatch[2]}`);
      continue;
    }

    if (current) {
      if (/^(Questions?|READING PASSAGE|SECTION|PART)\b/i.test(line)) {
        instructionBuffer.push(line);
        if (instructionBuffer.length > 10) instructionBuffer.shift();
        activeInstruction = instructionBuffer.slice(-6).join('\n');
      } else {
        current.prompt.push(line);
      }
    } else {
      instructionBuffer.push(line);
      if (instructionBuffer.length > 10) instructionBuffer.shift();
      activeInstruction = instructionBuffer.slice(-6).join('\n');
    }
  }
  finishCurrent();

  const passageLines = firstQuestionLineIndex > 0 ? lines.slice(0, firstQuestionLineIndex) : [];
  const passage = passageLines
    .filter((line) => !/^(Questions?\s+\d|Choose |Complete |Write |Do the following|Match )/i.test(line))
    .join('\n')
    .trim();

  return { questions, passage };
}

function cleanAnswer(value) {
  return value
    .replace(/\s*\([^)]*(?:accept|also|or)[^)]*\)\s*$/i, '')
    .replace(/^[-:.)\s]+|[-:.)\s]+$/g, '')
    .trim();
}

export function parseAnswerKey(text = '') {
  const normalized = normalize(text);
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const answers = new Map();
  const duplicates = [];
  let skill = 'all';

  function addAnswer(number, rawValue) {
    const value = cleanAnswer(rawValue);
    if (!value || value.length > 100) return;
    const key = `${skill}:${number}`;
    if (answers.has(key)) duplicates.push(number);
    answers.set(key, value);
  }

  for (const line of lines) {
    if (/\bLISTENING\b/i.test(line)) { skill = 'listening'; continue; }
    if (/\bREADING\b/i.test(line)) { skill = 'reading'; continue; }

    const single = line.match(/^(\d{1,3})[.)]?\s+(.{1,100})$/);
    if (single && !/Questions?\b/i.test(single[2])) {
      const tail = single[2].trim();
      const nextPair = tail.match(/\s+(\d{1,3})[.)]?\s+/);
      if (!nextPair) {
        addAnswer(Number(single[1]), tail);
        continue;
      }
    }

    const pairRegex = /(\d{1,3})[.)]?\s+(TRUE|FALSE|NOT GIVEN|YES|NO|[A-H](?:\s*[,/]\s*[A-H])?|\d+(?:[.:/-]\d+)*|[A-Za-z][A-Za-z' -]{0,35}?)(?=\s+\d{1,3}[.)]?\s+|$)/gi;
    let pair;
    while ((pair = pairRegex.exec(line))) addAnswer(Number(pair[1]), pair[2]);
  }

  return { answers, duplicates };
}

function applyAnswers(sections, answerResult) {
  let matched = 0;
  for (const section of sections) {
    for (const question of section.questions) {
      const skillKey = `${section.skill}:${question.questionNumber}`;
      const allKey = `all:${question.questionNumber}`;
      const answer = answerResult.answers.get(skillKey) ?? answerResult.answers.get(allKey);
      if (answer !== undefined) {
        question.correctAnswer = answer;
        matched += 1;
      }
    }
  }
  return matched;
}

export function parseTestText(questionTexts, answerTexts, examType) {
  const warnings = [];
  const sections = [];

  for (const item of questionTexts) {
    const text = normalize(item.text);
    if (!text) continue;
    const split = splitIntoSections(text, examType);
    for (const section of split) {
      const parsed = parseQuestions(section);
      if (!parsed.questions.length) {
        warnings.push(`No numbered questions detected in ${item.name}${section.title ? ` (${section.title})` : ''}.`);
        continue;
      }
      sections.push({
        skill: section.skill,
        sectionNumber: sections.length + 1,
        title: section.title,
        instructions: parsed.questions[0]?.instructions || '',
        passage: parsed.passage,
        questions: parsed.questions.map(({ instructions, ...question }) => question),
        metadata: { sourceFile: item.name },
      });
    }
  }

  let answerCount = 0;
  let matchedAnswers = 0;
  if (answerTexts.length) {
    const combined = answerTexts.map((item) => item.text).join('\n\n');
    const answerResult = parseAnswerKey(combined);
    answerCount = answerResult.answers.size;
    matchedAnswers = applyAnswers(sections, answerResult);
    if (answerResult.duplicates.length) warnings.push('Duplicate answer numbers were found; review the mapped answers before marking the test ready.');
  }

  const questionCount = sections.reduce((sum, section) => sum + section.questions.length, 0);
  if (!questionCount) warnings.push('No questions were parsed. You can still import the source files as a draft.');
  if (answerCount && matchedAnswers < Math.min(answerCount, questionCount)) {
    warnings.push(`Only ${matchedAnswers} answer-key entries matched parsed questions.`);
  }

  return { sections, questionCount, answerCount, matchedAnswers, warnings };
}
