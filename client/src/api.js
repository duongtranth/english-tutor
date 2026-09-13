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
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
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

  progressSummary: () => request('/progress/summary'),
};
