const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Request failed with status ${res.status}`);
    error.data = data;
    error.status = res.status;
    throw error;
  }
  return data;
}

async function requestBlob(path) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return res.blob();
}

export const api = {
  register: (email, password, name) =>
    request('/auth/register', { method: 'POST', body: { email, password, name }, auth: false }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),

  vocabDue: (examType, limit = 15) => request(`/vocab/due?examType=${examType}&limit=${limit}`),
  vocabReview: (wordId, known) =>
    request(`/vocab/${wordId}/review`, { method: 'POST', body: { known } }),

  grammarQuestions: (examType, limit = 10) =>
    request(`/grammar/questions?examType=${examType}&limit=${limit}`),
  grammarAttempt: (questionId, selectedIndex) =>
    request('/grammar/attempt', { method: 'POST', body: { questionId, selectedIndex } }),

  readingPassages: (examType) => request(`/reading/passages?examType=${examType}`),
  readingPassage: (id) => request(`/reading/passages/${id}`),
  readingAttempt: (id, answers) =>
    request(`/reading/passages/${id}/attempt`, { method: 'POST', body: { answers } }),

  listeningItems: (examType) => request(`/listening/items?examType=${examType}`),
  listeningItem: (id) => request(`/listening/items/${id}`),
  listeningAttempt: (id, answers) =>
    request(`/listening/items/${id}/attempt`, { method: 'POST', body: { answers } }),

  ocrStatus: () => request('/ocr/status'),
  ocrDocument: (payload) => request('/ocr/document', { method: 'POST', body: payload }),

  tests: (examType) => request(`/tests${examType ? `?examType=${examType}` : ''}`),
  test: (id) => request(`/tests/${id}`),
  testForTaking: (id) => request(`/tests/${id}/take`),
  testAttempts: (id) => request(`/tests/${id}/attempts`),
  testAttempt: (id, attemptId) => request(`/tests/${id}/attempts/${attemptId}`),
  submitTest: (id, answers, elapsedSeconds) =>
    request(`/tests/${id}/submit`, { method: 'POST', body: { answers, elapsedSeconds } }),
  testMistakes: (examType) => request(`/tests/mistakes${examType ? `?examType=${examType}` : ''}`),
  testFile: (id, fileId) => requestBlob(`/tests/${id}/files/${fileId}`),
  importTest: (payload) => request('/tests/import', { method: 'POST', body: payload }),
  replaceTestStructure: (id, sections) => request(`/tests/${id}/structure`, { method: 'PUT', body: { sections } }),
  updateTest: (id, payload) => request(`/tests/${id}`, { method: 'PATCH', body: payload }),
  deleteTest: (id) => request(`/tests/${id}`, { method: 'DELETE' }),

  progressSummary: () => request('/progress/summary'),
};
