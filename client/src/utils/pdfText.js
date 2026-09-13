let pdfJsPromise;
let tesseractPromise;

async function loadPdfJs() {
  if (!pdfJsPromise) {
    const moduleUrl = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
    pdfJsPromise = import(/* @vite-ignore */ moduleUrl).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

async function loadTesseract() {
  if (!tesseractPromise) {
    const moduleUrl = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js';
    tesseractPromise = import(/* @vite-ignore */ moduleUrl);
  }
  return tesseractPromise;
}

function cleanExtractedText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function createOcrWorker(onProgress) {
  let tesseract;
  try {
    tesseract = await loadTesseract();
  } catch {
    throw new Error('Could not load the OCR engine. Check your internet connection and try again.');
  }

  return tesseract.createWorker('eng', 1, {
    logger: (message) => {
      if (message?.status === 'recognizing text' && typeof message.progress === 'number') {
        onProgress?.({ phase: 'ocr', progress: message.progress });
      }
    },
  });
}

async function ocrImage(file, onProgress) {
  onProgress?.({ phase: 'ocr', page: 1, pages: 1, progress: 0 });
  const worker = await createOcrWorker((detail) => onProgress?.({ ...detail, page: 1, pages: 1 }));
  try {
    const result = await worker.recognize(file);
    onProgress?.({ phase: 'ocr', page: 1, pages: 1, progress: 1 });
    return cleanExtractedText(result?.data?.text || '');
  } finally {
    await worker.terminate();
  }
}

async function renderPageToCanvas(page) {
  const viewport = page.getViewport({ scale: 1.8 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

async function ocrPdf(pdf, onProgress) {
  const worker = await createOcrWorker((detail) => onProgress?.(detail));
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress?.({ phase: 'render', page: pageNumber, pages: pdf.numPages, progress: 0 });
      const page = await pdf.getPage(pageNumber);
      const canvas = await renderPageToCanvas(page);
      onProgress?.({ phase: 'ocr', page: pageNumber, pages: pdf.numPages, progress: 0 });
      const result = await worker.recognize(canvas, {}, {
        text: true,
      });
      pages.push(cleanExtractedText(result?.data?.text || ''));
      canvas.width = 1;
      canvas.height = 1;
      onProgress?.({ phase: 'ocr', page: pageNumber, pages: pdf.numPages, progress: 1 });
    }
  } finally {
    await worker.terminate();
  }
  return cleanExtractedText(pages.join('\n\n--- PAGE BREAK ---\n\n'));
}

async function extractPdfText(pdf, onProgress) {
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress?.({ phase: 'extract', page: pageNumber, pages: pdf.numPages, progress: pageNumber / pdf.numPages });
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = [];
    let currentY = null;
    let currentLine = [];

    for (const item of content.items) {
      if (!item.str) continue;
      const y = item.transform?.[5] ?? null;
      if (currentY !== null && y !== null && Math.abs(y - currentY) > 2.5) {
        if (currentLine.length) lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
        currentLine = [];
      }
      currentLine.push(item.str);
      currentY = y;
    }
    if (currentLine.length) lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
    pages.push(lines.filter(Boolean).join('\n'));
  }
  return cleanExtractedText(pages.join('\n\n--- PAGE BREAK ---\n\n'));
}

export async function extractTextFromFile(file, { ocrFallback = true, onProgress } = {}) {
  const name = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  const isText = file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md');
  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(name);

  if (isText) {
    onProgress?.({ phase: 'extract', page: 1, pages: 1, progress: 1 });
    return cleanExtractedText(await file.text());
  }

  if (isImage) {
    if (!ocrFallback) throw new Error(`OCR is disabled for ${file.name}.`);
    const text = await ocrImage(file, onProgress);
    if (text.length < 20) throw new Error(`${file.name}: OCR could not detect enough English text.`);
    return text;
  }

  if (!isPdf) throw new Error(`Text extraction is not supported for ${file.name}.`);

  let pdfjs;
  try {
    pdfjs = await loadPdfJs();
  } catch {
    throw new Error('Could not load the PDF text extractor. Check your internet connection and try again.');
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const text = await extractPdfText(pdf, onProgress);

  // Real exam PDFs with embedded text are much faster and more accurate than OCR.
  // Only fall back when PDF.js finds almost no meaningful text.
  if (text.replace(/--- PAGE BREAK ---/g, '').trim().length >= 80 || !ocrFallback) return text;

  onProgress?.({ phase: 'ocr-fallback', page: 0, pages: pdf.numPages, progress: 0 });
  const ocrText = await ocrPdf(pdf, onProgress);
  if (ocrText.length < 20) throw new Error(`${file.name}: both PDF text extraction and OCR found too little text.`);
  return ocrText;
}
