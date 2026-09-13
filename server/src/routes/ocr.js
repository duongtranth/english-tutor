const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const ocrWorker = require('../services/ocrWorker');

const router = express.Router();
router.use(requireAuth);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff']);
const MAX_OCR_BYTES = 40 * 1024 * 1024;

function decodeDataUrl(dataBase64) {
  const input = String(dataBase64 || '');
  const raw = input.includes(',') ? input.slice(input.indexOf(',') + 1) : input;
  return Buffer.from(raw, 'base64');
}

router.get('/status', (req, res) => {
  res.json(ocrWorker.status());
});

router.post('/document', async (req, res) => {
  const { name, dataBase64 } = req.body || {};
  if (!name || !dataBase64) return res.status(400).json({ error: 'name and dataBase64 are required' });

  const ext = path.extname(String(name)).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return res.status(400).json({ error: `Local OCR does not support ${ext || 'this file type'}.` });
  }

  let buffer;
  try {
    buffer = decodeDataUrl(dataBase64);
  } catch {
    return res.status(400).json({ error: 'Invalid base64 document data' });
  }
  if (!buffer.length) return res.status(400).json({ error: 'OCR document is empty' });
  if (buffer.length > MAX_OCR_BYTES) return res.status(413).json({ error: 'OCR input must be 40 MB or smaller' });

  const tempPath = path.join(os.tmpdir(), `english-tutor-ocr-${crypto.randomUUID()}${ext}`);
  try {
    fs.writeFileSync(tempPath, buffer);
    const result = await ocrWorker.recognize(tempPath);
    res.json({
      text: result.text,
      pages: result.pages,
      model: result.model,
      device: result.device,
      engine: result.engine,
    });
  } catch (err) {
    const current = ocrWorker.status();
    console.error('OCR error:', err);
    res.status(current.ready ? 500 : 503).json({
      error: err.message,
      ocrStatus: current,
      setup: 'cd server && bash ocr/setup_ocr.sh',
    });
  } finally {
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
  }
});

module.exports = router;
