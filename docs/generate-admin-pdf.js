const PDFDocument = require('/home/runner/workspace/artifacts/api-server/node_modules/pdfkit');
const fs = require('fs');

const md = fs.readFileSync('docs/admin-guide-import.md', 'utf8');
const doc = new PDFDocument({ margin: 56, size: 'A4', bufferPages: true });
const out = fs.createWriteStream('docs/admin-guide-import.pdf');
doc.pipe(out);

const ORANGE = '#e07b39';
const DARK   = '#1a1a1a';
const GREY   = '#666666';
const LIGHT  = '#f5f5f5';
const BORDER = '#cccccc';
const W = doc.page.width - 112;  // 56 margin each side

// ── Cover page ──────────────────────────────────────────────
doc.rect(0, 0, doc.page.width, doc.page.height).fill('#111111');
doc.fontSize(28).font('Helvetica-Bold').fillColor(ORANGE)
   .text('PhotoMatrix', 56, 160, { align: 'center', width: W });
doc.fontSize(16).font('Helvetica').fillColor('#ffffff')
   .text('Admin Guide', { align: 'center', width: W });
doc.moveDown(0.4);
doc.fontSize(13).font('Helvetica-Bold').fillColor(ORANGE)
   .text('Importing Photos from a URL', { align: 'center', width: W });
doc.moveDown(0.5);
doc.fontSize(9).font('Helvetica').fillColor('#888888')
   .text('July 2026', { align: 'center', width: W });

// ── Body pages ───────────────────────────────────────────────
doc.addPage();

const lines = md.split('\n');
let tableRows = [], inTable = false;

const stripMd = t =>
  t.replace(/\*\*([^*]+)\*\*/g, '$1')
   .replace(/\*([^*]+)\*/g, '$1')
   .replace(/`([^`]+)`/g, '$1');

const needsNewPage = (reserve = 80) => doc.y > doc.page.height - reserve;

const flushTable = () => {
  if (!tableRows.length) return;
  const c0 = W * 0.33, c1 = W * 0.67, x = 56, rowH = 20;
  tableRows.forEach((row, ri) => {
    if (needsNewPage(rowH + 10)) doc.addPage();
    const isH = ri === 0;
    const bg  = isH ? ORANGE : (ri % 2 === 0 ? LIGHT : '#ffffff');
    const fc  = isH ? '#ffffff' : DARK;
    const y   = doc.y;
    // Fill background
    doc.rect(x, y, c0 + c1, rowH).fill(bg);
    // Border
    doc.rect(x, y, c0 + c1, rowH).stroke(BORDER);
    // Cell text
    doc.fontSize(9).font(isH ? 'Helvetica-Bold' : 'Helvetica').fillColor(fc);
    doc.text(stripMd(row[0] || ''), x + 5, y + 5, { width: c0 - 10, lineBreak: false });
    doc.text(stripMd(row[1] || ''), x + c0 + 5, y + 5, { width: c1 - 10, lineBreak: false });
    doc.y = y + rowH;
  });
  doc.moveDown(0.5);
  tableRows = [];
  // Reset to body text style
  doc.fontSize(10).font('Helvetica').fillColor(DARK);
};

lines.forEach(line => {
  if (/^---+$/.test(line.trim())) { doc.moveDown(0.3); return; }

  // Table row
  if (line.startsWith('|')) {
    if (/^\|[\s\-|:]+\|$/.test(line)) return; // separator
    tableRows.push(line.split('|').slice(1, -1).map(c => c.trim()));
    inTable = true;
    return;
  } else if (inTable) {
    flushTable();
    inTable = false;
  }

  // H1 — skip (cover page handles it)
  if (/^# /.test(line)) return;

  // H2
  if (/^## /.test(line)) {
    if (needsNewPage(100)) doc.addPage();
    doc.moveDown(0.8);
    doc.fontSize(15).font('Helvetica-Bold').fillColor(ORANGE)
       .text(line.replace(/^## /, ''), { width: W });
    doc.moveDown(0.25);
    return;
  }

  // H3
  if (/^### /.test(line)) {
    if (needsNewPage(60)) doc.addPage();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(DARK)
       .text(line.replace(/^### /, ''), { width: W });
    doc.moveDown(0.15);
    return;
  }

  // TOC entries
  if (/^\d+\. \[/.test(line)) return;

  // Blockquote
  if (/^> /.test(line)) {
    doc.fontSize(9).font('Helvetica-Oblique').fillColor(GREY)
       .text(stripMd(line.replace(/^> /, '')), 68, doc.y, { width: W - 12 });
    doc.moveDown(0.3);
    return;
  }

  // Bullet
  if (/^[*-] /.test(line)) {
    doc.fontSize(10).font('Helvetica').fillColor(DARK)
       .text('\u2022 ' + stripMd(line.replace(/^[*-] /, '')), { indent: 10, width: W });
    return;
  }

  // Numbered list
  if (/^\d+\. /.test(line)) {
    const num = line.match(/^(\d+)\. /)[1];
    doc.fontSize(10).font('Helvetica').fillColor(DARK)
       .text(num + '. ' + stripMd(line.replace(/^\d+\. /, '')), { indent: 10, width: W });
    return;
  }

  // Empty line
  if (!line.trim()) { doc.moveDown(0.35); return; }

  // Plain paragraph
  doc.fontSize(10).font('Helvetica').fillColor(DARK)
     .text(stripMd(line), { width: W });
});

flushTable();

// ── Page numbers (added after all pages are buffered) ─────────
const totalPages = doc.bufferedPageRange().count;
for (let i = 0; i < totalPages; i++) {
  if (i === 0) continue; // no number on cover
  doc.switchToPage(i);
  doc.fontSize(8).font('Helvetica').fillColor(GREY)
     .text(String(i), 56, doc.page.height - 38, { align: 'right', width: W });
}

doc.end();
out.on('finish', () => {
  const size = fs.statSync('docs/admin-guide-import.pdf').size;
  console.log('PDF written: ' + size + ' bytes');
});
