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

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/vocab', vocabRoutes);
app.use('/api/grammar', grammarRoutes);
app.use('/api/reading', readingRoutes);
app.use('/api/listening', listeningRoutes);
app.use('/api/progress', progressRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
