const db = require('./db');

function count(table) {
  return db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
}

function seedWords() {
  if (count('words') > 0) return;
  const insert = db.prepare(
    'INSERT INTO words (exam_type, term, definition, example, topic) VALUES (?, ?, ?, ?, ?)'
  );
  const toeicWords = [
    ['invoice', 'a document listing goods/services and their cost', 'Please send the invoice to accounting.', 'Office'],
    ['reimburse', 'to pay back money spent', 'The company will reimburse your travel expenses.', 'Finance'],
    ['negotiate', 'to discuss to reach an agreement', 'They negotiated a better price with the supplier.', 'Business'],
    ['inventory', 'the goods a business holds in stock', 'We need to check the inventory before ordering more.', 'Logistics'],
    ['candidate', 'a person applying for a job', 'Three candidates were shortlisted for the position.', 'HR'],
    ['deadline', 'the time by which something must be done', 'The deadline for the report is Friday.', 'Office'],
    ['itinerary', 'a planned route or schedule for a trip', 'Please review the itinerary before the business trip.', 'Travel'],
    ['merger', 'the combining of two companies into one', 'The merger was approved by both boards.', 'Business'],
    ['revenue', 'income generated from business operations', 'Revenue increased by 10% this quarter.', 'Finance'],
    ['warranty', 'a guarantee of quality from a seller', 'The laptop comes with a two-year warranty.', 'Retail'],
    ['procurement', 'the process of obtaining goods or services', 'The procurement team is reviewing new vendors.', 'Business'],
    ['subsidiary', 'a company controlled by a parent company', 'Our subsidiary in Vietnam handles regional sales.', 'Business'],
    ['agenda', 'a list of items to discuss at a meeting', 'Let\'s go over today\'s agenda first.', 'Office'],
    ['compliance', 'the act of following rules or laws', 'The audit checks for regulatory compliance.', 'Legal'],
    ['logistics', 'the coordination of moving goods or people', 'Logistics delays affected the shipment.', 'Logistics'],
    ['stakeholder', 'a person with an interest in a business', 'We presented the plan to all stakeholders.', 'Business'],
    ['quarterly', 'occurring every three months', 'The quarterly report is due next week.', 'Finance'],
    ['vacancy', 'an unoccupied job position', 'There is a vacancy in the marketing department.', 'HR'],
    ['forecast', 'a prediction of future trends', 'The sales forecast looks promising for Q4.', 'Finance'],
    ['endorse', 'to publicly approve or support', 'The manager endorsed the new proposal.', 'Business'],
  ];
  const ieltsWords = [
    ['ubiquitous', 'present everywhere', 'Smartphones have become ubiquitous in modern life.', 'Technology'],
    ['detrimental', 'causing harm or damage', 'Pollution is detrimental to public health.', 'Environment'],
    ['exacerbate', 'to make a problem worse', 'Poor diet can exacerbate health issues.', 'Health'],
    ['plausible', 'seeming reasonable or likely', 'The scientist offered a plausible explanation.', 'Academic'],
    ['mitigate', 'to make something less severe', 'New policies aim to mitigate climate change.', 'Environment'],
    ['controversial', 'causing public disagreement', 'The new law is highly controversial.', 'Society'],
    ['unprecedented', 'never having happened before', 'The pandemic caused unprecedented changes.', 'Society'],
    ['sustainable', 'able to continue without harm', 'We need sustainable sources of energy.', 'Environment'],
    ['discrepancy', 'a lack of agreement between facts', 'There is a discrepancy in the two reports.', 'Academic'],
    ['inevitable', 'certain to happen', 'Change is inevitable in a growing economy.', 'Society'],
    ['empirical', 'based on observation rather than theory', 'The study relies on empirical evidence.', 'Academic'],
    ['coherent', 'logical and consistent', 'The essay presents a coherent argument.', 'Academic'],
    ['diverse', 'showing variety', 'The city has a diverse population.', 'Society'],
    ['phenomenon', 'a fact or situation that is observed', 'Global warming is a well-documented phenomenon.', 'Environment'],
    ['contemporary', 'belonging to the present time', 'Contemporary art often challenges tradition.', 'Culture'],
    ['implication', 'a possible effect or result', 'The policy has serious implications for farmers.', 'Society'],
    ['substantial', 'of considerable size or importance', 'There was a substantial increase in tourism.', 'Economy'],
    ['prevalent', 'widespread in a particular area', 'Obesity is prevalent in many developed countries.', 'Health'],
    ['legislation', 'laws considered as a group', 'New legislation was passed to protect workers.', 'Law'],
    ['adverse', 'unfavorable or harmful', 'The drug has several adverse side effects.', 'Health'],
  ];
  for (const [term, definition, example, topic] of toeicWords) {
    insert.run('TOEIC', term, definition, example, topic);
  }
  for (const [term, definition, example, topic] of ieltsWords) {
    insert.run('IELTS', term, definition, example, topic);
  }
}

function seedGrammar() {
  if (count('grammar_questions') > 0) return;
  const insert = db.prepare(
    'INSERT INTO grammar_questions (exam_type, prompt, choices, answer_index, explanation) VALUES (?, ?, ?, ?, ?)'
  );
  const toeicQ = [
    ['The manager ___ the report before the meeting.', ['reviewed', 'reviewing', 'review', 'to review'], 0, '"reviewed" is the correct past tense verb form.'],
    ['All employees ___ attend the training session next week.', ['must', 'musting', 'to must', 'musted'], 0, 'Modal verb "must" is followed by base form.'],
    ['The proposal was rejected ___ of budget concerns.', ['because', 'because of', 'due', 'since'], 1, '"because of" is followed by a noun phrase.'],
    ['She has worked here ___ five years.', ['since', 'for', 'from', 'during'], 1, '"for" is used with a duration of time.'],
    ['Please make sure the invoice ___ sent by Friday.', ['is', 'are', 'be', 'being'], 0, 'Singular subject "invoice" takes "is".'],
    ['The new policy will affect ___ department in the company.', ['every', 'all', 'most', 'each of'], 0, '"every" + singular noun is correct here.'],
    ['If the shipment arrives late, we ___ the client immediately.', ['will notify', 'notify', 'notified', 'notifying'], 0, 'First conditional uses "will + base verb" in the main clause.'],
    ['The contract must be signed ___ both parties.', ['by', 'with', 'from', 'at'], 0, 'Passive voice agent is introduced with "by".'],
    ['Our sales team exceeded ___ targets this quarter.', ['their', 'his', 'its', 'there'], 0, '"their" agrees with the plural noun "team" (as a group of people).'],
    ['The meeting has been postponed ___ next Monday.', ['until', 'for', 'since', 'by'], 0, '"until" indicates the new point in time.'],
  ];
  const ieltsQ = [
    ['Despite ___ hard, he failed the exam.', ['study', 'studying', 'studied', 'to study'], 1, 'Preposition "despite" is followed by a gerund.'],
    ['The research findings ___ widely debated among scientists.', ['is', 'are', 'was', 'has been'], 1, 'Plural subject "findings" requires "are".'],
    ['Had I known about the deadline, I ___ finished earlier.', ['would', 'would have', 'will have', 'had'], 1, 'Third conditional requires "would have + past participle".'],
    ['The government introduced measures ___ reduce pollution.', ['for', 'to', 'in order that', 'so'], 1, 'Infinitive of purpose: "to reduce".'],
    ['Not only ___ the plan expensive, but it was also impractical.', ['was', 'is', 'were', 'did'], 0, 'Inversion after "Not only" at the start of a clause.'],
    ['The number of students studying abroad ___ increased steadily.', ['have', 'has', 'having', 'had been'], 1, '"The number of" takes a singular verb.'],
    ['It is essential that every candidate ___ the requirements.', ['meet', 'meets', 'met', 'meeting'], 0, 'Subjunctive mood after "essential that": base form.'],
    ['This essay, ___ was written last year, is still relevant.', ['that', 'which', 'who', 'what'], 1, 'Non-defining relative clause uses "which".'],
    ['The more evidence we gather, ___ our conclusion becomes.', ['stronger', 'the stronger', 'strongest', 'more strong'], 1, 'Comparative structure: "the more..., the stronger...".'],
    ['Few studies ___ conducted on this rare phenomenon.', ['has been', 'have been', 'is', 'are'], 1, '"Few studies" is plural, so "have been" is correct.'],
  ];
  for (const [prompt, choices, answerIndex, explanation] of toeicQ) {
    insert.run('TOEIC', prompt, JSON.stringify(choices), answerIndex, explanation);
  }
  for (const [prompt, choices, answerIndex, explanation] of ieltsQ) {
    insert.run('IELTS', prompt, JSON.stringify(choices), answerIndex, explanation);
  }
}

function seedReading() {
  if (count('reading_passages') > 0) return;
  const insertPassage = db.prepare(
    'INSERT INTO reading_passages (exam_type, title, body) VALUES (?, ?, ?)'
  );
  const insertQ = db.prepare(
    'INSERT INTO reading_questions (passage_id, prompt, choices, answer_index) VALUES (?, ?, ?, ?)'
  );

  const toeicId = insertPassage.run(
    'TOEIC',
    'Office Relocation Notice',
    `To: All Staff\nFrom: Facilities Management\nSubject: Office Relocation\n\nWe are pleased to announce that our company will relocate to a new office at 500 Riverside Avenue starting next month. The new building offers larger meeting rooms, a dedicated parking area, and improved internet infrastructure. Employees are asked to pack personal belongings by the 20th, as the moving company will begin transporting furniture and equipment on the 21st. IT staff will set up computers and phone lines at the new location before the 25th, so all departments should be fully operational by the following Monday. Please direct any questions to the Facilities Management team.`
  ).lastInsertRowid;
  insertQ.run(toeicId, 'What is the main purpose of this notice?', JSON.stringify([
    'To announce a company holiday', 'To inform staff about an office move', 'To advertise a new building for rent', 'To request feedback on office design'
  ]), 1);
  insertQ.run(toeicId, 'By what date should employees pack their belongings?', JSON.stringify([
    'The 20th', 'The 21st', 'The 25th', 'The following Monday'
  ]), 0);
  insertQ.run(toeicId, 'Who should employees contact with questions?', JSON.stringify([
    'IT staff', 'The moving company', 'Facilities Management', 'Human Resources'
  ]), 2);

  const ieltsId = insertPassage.run(
    'IELTS',
    'The Rise of Urban Farming',
    `Urban farming has grown rapidly over the past two decades as cities seek sustainable ways to feed their populations. Rooftop gardens, vertical farms, and community plots have transformed unused urban spaces into productive land. Proponents argue that urban farming reduces the distance food travels, thereby lowering carbon emissions associated with transportation. It also provides city dwellers with fresh produce and strengthens community ties through shared gardening projects. However, critics point out those urban farms often require significant investment in infrastructure, such as artificial lighting and irrigation systems, which can offset some environmental benefits. Despite these challenges, many city planners view urban farming as an essential component of future sustainable development, particularly as climate change threatens conventional agricultural yields.`
  ).lastInsertRowid;
  insertQ.run(ieltsId, 'According to the passage, why has urban farming become popular?', JSON.stringify([
    'It is cheaper than traditional farming', 'Cities want sustainable ways to feed populations', 'Governments require it by law', 'It replaces the need for supermarkets'
  ]), 1);
  insertQ.run(ieltsId, 'What is one criticism of urban farming mentioned in the passage?', JSON.stringify([
    'It requires significant investment in infrastructure', 'It produces low-quality food', 'It is illegal in most cities', 'It reduces community engagement'
  ]), 0);
  insertQ.run(ieltsId, 'What do many city planners believe about urban farming?', JSON.stringify([
    'It is a temporary trend', 'It is essential for future sustainable development', 'It should be banned', 'It has no environmental impact'
  ]), 1);
}

function seedListening() {
  if (count('listening_items') > 0) return;
  const insertItem = db.prepare(
    'INSERT INTO listening_items (exam_type, title, transcript) VALUES (?, ?, ?)'
  );
  const insertQ = db.prepare(
    'INSERT INTO listening_questions (item_id, prompt, choices, answer_index) VALUES (?, ?, ?, ?)'
  );

  const toeicId = insertItem.run(
    'TOEIC',
    'Voicemail: Meeting Reschedule',
    `Hi, this is Sarah from the marketing department. I'm calling about tomorrow's ten o'clock meeting. Unfortunately, I have a conflict with a client call, so I'd like to move our meeting to two o'clock in the afternoon instead. Please let me know if that time works for you. If not, we can also meet on Thursday morning. Thanks, and talk soon.`
  ).lastInsertRowid;
  insertQ.run(toeicId, 'Why is Sarah calling?', JSON.stringify([
    'To cancel a meeting completely', 'To reschedule a meeting', 'To confirm a client call', 'To request a report'
  ]), 1);
  insertQ.run(toeicId, 'What time does Sarah suggest instead?', JSON.stringify([
    'Ten o\'clock', 'Twelve o\'clock', 'Two o\'clock', 'Four o\'clock'
  ]), 2);
  insertQ.run(toeicId, 'What alternative day does Sarah mention?', JSON.stringify([
    'Wednesday', 'Thursday', 'Friday', 'Monday'
  ]), 1);

  const ieltsId = insertItem.run(
    'IELTS',
    'Lecture Excerpt: Renewable Energy',
    `Today we're going to look at the growth of renewable energy sources around the world. Over the last decade, solar power capacity has increased dramatically, largely due to falling production costs. Wind energy has also expanded, particularly in coastal regions where wind speeds are consistently high. However, one of the main challenges facing renewable energy is storage, since both solar and wind power generation can be inconsistent depending on weather conditions. Researchers are currently developing more efficient battery technologies to address this issue, which could make renewable energy a more reliable option for countries seeking to reduce their dependence on fossil fuels.`
  ).lastInsertRowid;
  insertQ.run(ieltsId, 'What has caused solar power capacity to increase?', JSON.stringify([
    'Government bans on fossil fuels', 'Falling production costs', 'Increased wind speeds', 'New international laws'
  ]), 1);
  insertQ.run(ieltsId, 'Where has wind energy expanded the most?', JSON.stringify([
    'Desert regions', 'Mountain areas', 'Coastal regions', 'Urban centers'
  ]), 2);
  insertQ.run(ieltsId, 'What is described as a main challenge for renewable energy?', JSON.stringify([
    'Cost of installation', 'Public opposition', 'Energy storage', 'Lack of researchers'
  ]), 2);
}

function seedAll() {
  seedWords();
  seedGrammar();
  seedReading();
  seedListening();
}

module.exports = seedAll;
