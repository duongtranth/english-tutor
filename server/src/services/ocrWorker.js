const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const crypto = require('crypto');

const serverRoot = path.join(__dirname, '..', '..');
const defaultPython = process.platform === 'win32'
  ? path.join(serverRoot, '.venv-ocr', 'Scripts', 'python.exe')
  : path.join(serverRoot, '.venv-ocr', 'bin', 'python');
const pythonPath = process.env.OCR_PYTHON || defaultPython;
const workerPath = path.join(serverRoot, 'ocr', 'worker.py');
const modelDir = process.env.PADDLEOCR_VL_MODEL_DIR || path.join(serverRoot, 'models', 'PaddleOCR-VL-1.6');

let worker = null;
let lineReader = null;
const pending = new Map();
let lastStderr = '';

function status() {
  const modelReady = fs.existsSync(path.join(modelDir, 'config.json')) &&
    (fs.existsSync(path.join(modelDir, 'model.safetensors')) || fs.existsSync(path.join(modelDir, 'model.safetensors.index.json')));
  return {
    ready: fs.existsSync(pythonPath) && fs.existsSync(workerPath) && modelReady,
    pythonReady: fs.existsSync(pythonPath),
    modelReady,
    pythonPath,
    modelDir,
    model: 'PaddlePaddle/PaddleOCR-VL-1.6',
    device: process.env.OCR_DEVICE || 'gpu',
  };
}

function rejectAll(message) {
  for (const [, request] of pending) {
    clearTimeout(request.timer);
    request.reject(new Error(message));
  }
  pending.clear();
}

function stopWorker() {
  if (lineReader) {
    lineReader.close();
    lineReader = null;
  }
  if (worker) {
    try { worker.kill(); } catch {}
    worker = null;
  }
}

function startWorker() {
  if (worker && !worker.killed) return worker;
  const current = status();
  if (!current.pythonReady) {
    throw new Error('Local OCR Python environment is not installed. Run: cd server && bash ocr/setup_ocr.sh');
  }
  if (!current.modelReady) {
    throw new Error('PaddleOCR-VL-1.6 model is not downloaded. Run: cd server && .venv-ocr/bin/python ocr/download_model.py');
  }

  lastStderr = '';
  worker = spawn(pythonPath, [workerPath], {
    cwd: serverRoot,
    env: {
      ...process.env,
      PADDLEOCR_VL_MODEL_DIR: modelDir,
      OCR_DEVICE: process.env.OCR_DEVICE || 'gpu',
      OCR_ENGINE: process.env.OCR_ENGINE || 'transformers',
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  worker.stderr.on('data', (chunk) => {
    const text = String(chunk);
    lastStderr = `${lastStderr}${text}`.slice(-12000);
    if (process.env.OCR_DEBUG === '1') process.stderr.write(`[ocr] ${text}`);
  });

  lineReader = readline.createInterface({ input: worker.stdout });
  lineReader.on('line', (line) => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.ok) request.resolve(message);
    else request.reject(new Error(message.error || 'Local OCR failed'));
  });

  worker.on('exit', (code) => {
    const detail = lastStderr.trim().split('\n').slice(-8).join('\n');
    rejectAll(`OCR worker exited with code ${code ?? 'unknown'}${detail ? `: ${detail}` : ''}`);
    worker = null;
    lineReader = null;
  });

  worker.on('error', (err) => {
    rejectAll(`Could not start local OCR worker: ${err.message}`);
    stopWorker();
  });

  return worker;
}

function recognize(filePath, { timeoutMs = 15 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    let processHandle;
    try {
      processHandle = startWorker();
    } catch (err) {
      reject(err);
      return;
    }

    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Local OCR timed out. Try fewer pages or a smaller scan.'));
    }, timeoutMs);

    pending.set(id, { resolve, reject, timer });
    processHandle.stdin.write(`${JSON.stringify({ id, path: filePath })}\n`, (err) => {
      if (!err) return;
      clearTimeout(timer);
      pending.delete(id);
      reject(err);
    });
  });
}

process.once('exit', stopWorker);
process.once('SIGINT', () => { stopWorker(); process.exit(130); });
process.once('SIGTERM', () => { stopWorker(); process.exit(143); });

module.exports = { recognize, status, stopWorker };
