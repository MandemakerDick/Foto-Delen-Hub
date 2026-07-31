const PDFDocument = require('/home/runner/workspace/artifacts/api-server/node_modules/pdfkit');
const fs = require('fs');

const md = fs.readFileSync('docs/admin-guide-import.md', 'utf8');
const doc = new PDFDocument({ margin: 56, size: 'A4' });
const out = fs.createWriteStream('docs/admin-guide-import.pdf');
doc.pipe(out);

const ORANGE = '#e07b39';
const DARK   = '#1a1a1a';
const GREY   = '#666666';
const LIGHT  = '#f5f5f5';
const BORDER = '#dddddd';
const W = doc.page.width - 112;

// Cover page
doc.rect(0, 0, doc.page.width, doc.page.height).fill('#111111');
doc.fill(ORANGE).fontSize(28).font('Helvetica-Bold').text('PhotoMatrix', 56, 160, { align: 'center', width: W });
doc.fill('#ffffff').fontSize(16).font('Helvetica').text('Admin Guide', 56, doc.y + 6, { align: 'center', width: W });
doc.fill(ORANGE).fontSize(13).font('Helvetica-Bold').text('Importing Photos from a URL', 56, doc.y + 10, { align: 'center', width: W });
doc.fill('#888888').fontSize(9).font('Helvetica').text('July 2026', 56, doc.y + 8, { align: 'center', width: W });

doc.addPage();
let pageNum = 1;
doc.on('pageAdded', () => { pageNum++; });

const footer = () => {
  doc.save();
  doc.fill(GREY).fontSize(8).font('Helvetica')
     .text(String(pageNum), 56, doc.page.height - 38, { align: 'right', width: W });
  doc.restore();
};
footer();

const lines = md.split('\n');
let tableRows = [], inTable = false;

const stripMd = t =>
  t.replace(/\*\*([^*]+)\*\*/g, '$1')
   .replace(/\*([^*]+)\*/g, '$1')
   .replace(/`([^`]+)`/g, '$1');

const flushTable = () => {
  if (!tableRows.length) return;
  const c0 = W * 0.33, c1 = W * 0.67, x = 56, rowH = 20;
  tableRows.forEach((row, ri) => {
    if (doc.y + rowH > doc.page.height - 60) { doc.addPage(); footer(); }
    const isH = ri === 0;
    const bg  = isH ? ORANGE : (ri % 2 === 0 ? LIGHT : '#ffffff');
    const fc  = isH ? '#ffffff' : DARK;
    const y   = doc.y;
    doc.rect(x, y, c0 + c1, rowH).fill(bg).stroke(BORDER);
    doc.fill(fc).fontSize(9).font(isH ? 'Helvetica-Bold' : 'Helvetica');
    doc.text(stripMd(row[0] || ''), x + 5, y + 5, { width: c0 - 10, lineBreak: false });
    doc.text(stripMd(row[1] || ''), x + c0 + 5, y + 5, { width: c1 - 10, lineBreak: false });
    doc.y = y + rowH;
  });
  doc.moveDown(0.5);
  tableRows = [];
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

  if (/^# /.test(line)) return; // covered by cover page

  if (/^## /.test(line)) {
    if (doc.y > doc.page.height - 100) { doc.addPage(); footer(); }
    doc.moveDown(0.8);
    doc.fill(ORANGE).fontSize(15).font('Helvetica-Bold')
       .text(line.replace(/^## /, ''), { width: W });
    doc.moveDown(0.25);
    return;
  }

  if (/^### /.test(line)) {
    doc.moveDown(0.5);
    doc.fill(DARK).fontSize(11).font('Helvetica-Bold')
       .text(line.replace(/^### /, ''), { width: W });
    doc.moveDown(0.15);
    return;
  }

  if (/^\d+\. \[/.test(line)) return; // TOC entries

  if (/^> /.test(line)) {
    doc.fill(GREY).fontSize(9).font('Helvetica-Oblique')
       .text(stripMd(line.replace(/^> /, '')), 66, doc.y, { width: W - 10 });
    doc.moveDown(0.3);
    return;
  }

  if (/^[*-] /.test(line)) {
    doc.fill(DARK).fontSize(10).font('Helvetica')
       .text('• ' + stripMd(line.replace(/^[*-] /, '')), { indent: 10, width: W });
    return;
  }

  if (/^\d+\. /.test(line)) {
    const num = line.match(/^(\d+)\. /)[1];
    doc.fill(DARK).fontSize(10).font('Helvetica')
       .text(num + '. ' + stripMd(line.replace(/^\d+\. /, '')), { indent: 10, width: W });
    return;
  }

  if (!line.trim()) { doc.moveDown(0.35); return; }

  doc.fill(DARK).fontSize(10).font('Helvetica').text(stripMd(line), { width: W });
});

flushTable();
doc.end();
out.on('finish', () => {
  const size = fs.statSync('docs/admin-guide-import.pdf').size;
  console.log('PDF written: ' + size + ' bytes');
});
