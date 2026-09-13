const express = require('express');
const cors = require('cors');
require('dotenv').config();

const seedAll = require('./seed');
seedAll();

const authRoutes = require('./routes/auth');
const vocabRoutes = require('./routes/vocab');
const grammarRoutes = require('./routes/grammar');
const readingRoutes = require('./routes/reading');
const listeningRoutes = require('./routes/listening');
const progressRoutes = require('./routes/progress');
const testRoutes = require('./routes/tests');

const app = express();
app.use(cors());
// Phase 1 imports encode local PDF/audio files as base64 JSON.
// Keep this generous enough for one personal practice test bundle.
app.use(express.json({ limit: '80mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/vocab', vocabRoutes);
app.use('/api/grammar', grammarRoutes);
app.use('/api/reading', readingRoutes);
app.use('/api/listening', listeningRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/tests', testRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
