import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTestText } from './testParser.js';

test('parses IELTS true/false questions and maps reading answers', () => {
  const questions = [{
    name: 'reading.txt',
    text: `IELTS READING\nREADING PASSAGE 1\nA short passage about transport.\nQuestions 1-2\nDo the following statements agree?\nTRUE / FALSE / NOT GIVEN\n1 Public transport is always cheaper.\n2 The study included buses.`,
  }];
  const answers = [{ name: 'answers.txt', text: `READING\n1 TRUE\n2 FALSE` }];
  const result = parseTestText(questions, answers, 'IELTS');

  assert.equal(result.questionCount, 2);
  assert.equal(result.sections[0].skill, 'reading');
  assert.equal(result.sections[0].questions[0].questionType, 'true_false_not_given');
  assert.equal(result.sections[0].questions[0].correctAnswer, 'TRUE');
  assert.equal(result.sections[0].questions[1].correctAnswer, 'FALSE');
});

test('parses TOEIC Part 5 multiple choice', () => {
  const questions = [{
    name: 'toeic.txt',
    text: `TOEIC READING\nPART 5 Incomplete Sentences\n101 The report was _____ yesterday.\nA. finish\nB. finished\nC. finishing\nD. finishes\n102 Please _____ the form.\nA. complete\nB. completed\nC. completion\nD. completely`,
  }];
  const answers = [{ name: 'key.txt', text: `101 B 102 A` }];
  const result = parseTestText(questions, answers, 'TOEIC');

  assert.equal(result.questionCount, 2);
  assert.equal(result.sections[0].skill, 'reading');
  assert.equal(result.sections[0].questions[0].questionType, 'multiple_choice');
  assert.deepEqual(result.sections[0].questions[0].options, ['A. finish', 'B. finished', 'C. finishing', 'D. finishes']);
  assert.equal(result.sections[0].questions[0].correctAnswer, 'B');
});

test('keeps IELTS listening and reading answer numbers separate', () => {
  const questions = [
    { name: 'listening.txt', text: `IELTS LISTENING\nSECTION 1\nQuestions 1-1\n1 Name of the hotel _____` },
    { name: 'reading.txt', text: `IELTS READING\nREADING PASSAGE 1\nPassage text.\nQuestions 1-1\n1 The author supports the plan.` },
  ];
  const answers = [{ name: 'answers.txt', text: `LISTENING\n1 Riverside\nREADING\n1 TRUE` }];
  const result = parseTestText(questions, answers, 'IELTS');

  const listening = result.sections.find((section) => section.skill === 'listening');
  const reading = result.sections.find((section) => section.skill === 'reading');
  assert.equal(listening.questions[0].correctAnswer, 'Riverside');
  assert.equal(reading.questions[0].correctAnswer, 'TRUE');
});
