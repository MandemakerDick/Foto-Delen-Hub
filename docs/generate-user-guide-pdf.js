const PDFDocument = require('/home/runner/workspace/artifacts/api-server/node_modules/pdfkit');
const fs = require('fs');

const md = fs.readFileSync('docs/user-guide.md', 'utf8');
const doc = new PDFDocument({ margin: 56, size: 'A4', bufferPages: true });
const out = fs.createWriteStream('docs/user-guide.pdf');
doc.pipe(out);

const ORANGE = '#e07b39';
const DARK   = '#1a1a1a';
const GREY   = '#666666';
const LIGHT  = '#f5f5f5';
const BORDER = '#cccccc';
const W = doc.page.width - 112;

// ── Cover page ──────────────────────────────────────────────
doc.rect(0, 0, doc.page.width, doc.page.height).fill('#111111');
doc.fontSize(28).font('Helvetica-Bold').fillColor(ORANGE)
   .text('PhotoMatrix', 56, 160, { align: 'center', width: W });
doc.fontSize(16).font('Helvetica').fillColor('#ffffff')
   .text('User Guide', { align: 'center', width: W });
doc.moveDown(0.5);
doc.fontSize(9).font('Helvetica').fillColor('#888888')
   .text('July 2026', { align: 'center', width: W });

// ── Body pages ───────────────────────────────────────────────
doc.addPage();

// Trim trailing newlines to prevent a blank last page
const lines = md.trimEnd().split('\n');
let tableRows = [], inTable = false;

const stripMd = t =>
  t.replace(/\*\*([^*]+)\*\*/g, '$1')
   .replace(/\*([^*]+)\*/g, '$1')
   .replace(/`([^`]+)`/g, '$1');

const needsNewPage = (reserve = 80) => doc.y > doc.page.height - reserve;

const flushTable = () => {
  if (!tableRows.length) return;
  // Determine column count from header row
  const colCount = tableRows[0].length;
  const colW = colCount === 3
    ? [W * 0.22, W * 0.15, W * 0.63]
    : [W * 0.33, W * 0.67];
  const x = 56, rowH = 20;
  tableRows.forEach((row, ri) => {
    if (needsNewPage(rowH + 10)) doc.addPage();
    const isH = ri === 0;
    const bg  = isH ? ORANGE : (ri % 2 === 0 ? LIGHT : '#ffffff');
    const fc  = isH ? '#ffffff' : DARK;
    const y   = doc.y;
    const totalW = colW.reduce((a, b) => a + b, 0);
    doc.rect(x, y, totalW, rowH).fill(bg);
    doc.rect(x, y, totalW, rowH).stroke(BORDER);
    doc.fontSize(9).font(isH ? 'Helvetica-Bold' : 'Helvetica').fillColor(fc);
    let cx = x;
    row.forEach((cell, ci) => {
      doc.text(stripMd(cell || ''), cx + 5, y + 5, { width: colW[ci] - 10, lineBreak: false });
      cx += colW[ci];
    });
    doc.y = y + rowH;
  });
  doc.moveDown(0.5);
  tableRows = [];
  doc.fontSize(10).font('Helvetica').fillColor(DARK);
};

lines.forEach(line => {
  if (/^---+$/.test(line.trim())) { doc.moveDown(0.3); return; }

  if (line.startsWith('|')) {
    if (/^\|[\s\-|:]+\|$/.test(line)) return;
    tableRows.push(line.split('|').slice(1, -1).map(c => c.trim()));
    inTable = true;
    return;
  } else if (inTable) {
    flushTable();
    inTable = false;
  }

  if (/^# /.test(line)) return; // cover handles it

  if (/^## /.test(line)) {
    if (needsNewPage(100)) doc.addPage();
    doc.moveDown(0.8);
    doc.fontSize(15).font('Helvetica-Bold').fillColor(ORANGE)
       .text(line.replace(/^## /, ''), { width: W });
    doc.moveDown(0.25);
    return;
  }

  if (/^### /.test(line)) {
    if (needsNewPage(60)) doc.addPage();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(DARK)
       .text(line.replace(/^### /, ''), { width: W });
    doc.moveDown(0.15);
    return;
  }

  if (/^\d+\. \[/.test(line)) return; // TOC entries

  if (/^> /.test(line)) {
    doc.fontSize(9).font('Helvetica-Oblique').fillColor(GREY)
       .text(stripMd(line.replace(/^> /, '')), 68, doc.y, { width: W - 12 });
    doc.moveDown(0.3);
    return;
  }

  if (/^[*-] /.test(line)) {
    doc.fontSize(10).font('Helvetica').fillColor(DARK)
       .text('\u2022 ' + stripMd(line.replace(/^[*-] /, '')), { indent: 10, width: W });
    return;
  }

  if (/^\d+\. /.test(line)) {
    const num = line.match(/^(\d+)\. /)[1];
    doc.fontSize(10).font('Helvetica').fillColor(DARK)
       .text(num + '. ' + stripMd(line.replace(/^\d+\. /, '')), { indent: 10, width: W });
    return;
  }

  if (!line.trim()) { doc.moveDown(0.35); return; }

  doc.fontSize(10).font('Helvetica').fillColor(DARK)
     .text(stripMd(line), { width: W });
});

flushTable();

// ── Page numbers (post-pass, no graphics-state side-effects) ──
const totalPages = doc.bufferedPageRange().count;
for (let i = 1; i < totalPages; i++) { // skip cover (page 0)
  doc.switchToPage(i);
  doc.fontSize(8).font('Helvetica').fillColor(GREY)
     .text(String(i), 56, doc.page.height - 38, { align: 'right', width: W });
}

doc.end();
out.on('finish', () => {
  const size = fs.statSync('docs/user-guide.pdf').size;
  console.log('user-guide.pdf written: ' + size + ' bytes');
});
