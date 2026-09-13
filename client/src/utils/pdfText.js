let pdfJsPromise;

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

export async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  const isText = file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md');

  if (isText) return file.text();
  if (!isPdf) throw new Error(`Text extraction is not supported for ${file.name} yet.`);

  let pdfjs;
  try {
    pdfjs = await loadPdfJs();
  } catch {
    throw new Error('Could not load the PDF text extractor. Check your internet connection and try again.');
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
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

  const text = pages.join('\n\n--- PAGE BREAK ---\n\n').trim();
  if (text.length < 80) {
    throw new Error(`${file.name} appears to be scanned/image-only. OCR/vision parsing is not enabled yet.`);
  }
  return text;
}
