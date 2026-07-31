/**
 * Shared Markdown-to-PDFKit renderer used by both guide generation scripts.
 * Call renderGuide(options) to produce a PDF.
 */
const PDFDocument = require('/home/runner/workspace/artifacts/api-server/node_modules/pdfkit');
const fs = require('fs');

const ORANGE = '#e07b39';
const DARK   = '#1a1a1a';
const GREY   = '#777777';
const LIGHT  = '#f7f7f7';
const BORDER = '#cccccc';

function renderGuide({ inputPath, outputPath, coverTitle, coverSubtitle, coverSubtitle2 }) {
  const md = fs.readFileSync(inputPath, 'utf8');
  const PW = 595.28, PH = 841.89, M = 56;
  const W  = PW - 2 * M;

  const doc = new PDFDocument({ margin: M, size: 'A4', bufferPages: true });
  const out = fs.createWriteStream(outputPath);
  doc.pipe(out);

  // ── Cover ──────────────────────────────────────────────────────
  doc.rect(0, 0, PW, PH).fill('#111111');

  const coverY = PH * 0.35; // roughly in upper-third
  doc.fontSize(30).font('Helvetica-Bold').fillColor(ORANGE)
     .text(coverTitle, M, coverY, { align: 'center', width: W });
  doc.moveDown(0.4);
  doc.fontSize(15).font('Helvetica').fillColor('#ffffff')
     .text(coverSubtitle, { align: 'center', width: W });
  if (coverSubtitle2) {
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(ORANGE)
       .text(coverSubtitle2, { align: 'center', width: W });
  }
  doc.moveDown(0.6);
  doc.fontSize(9).font('Helvetica').fillColor('#888888')
     .text('July 2026', { align: 'center', width: W });

  // ── Body ───────────────────────────────────────────────────────
  doc.addPage();
  doc.moveDown(0.5); // breathing room at top of first body page

  const lines = md.trimEnd().split('\n');
  let tableRows = [], inTable = false, skipToc = false;

  const stripMd = t =>
    t.replace(/\*\*([^*]+)\*\*/g, '$1')
     .replace(/\*([^*]+)\*/g, '$1')
     .replace(/`([^`]+)`/g, '$1');

  // Measure text height for a cell given width
  const cellHeight = (text, width, fontSize) => {
    const charsPerLine = Math.floor(width / (fontSize * 0.52));
    const lines = Math.ceil(text.length / Math.max(charsPerLine, 1));
    return Math.max(1, lines) * fontSize * 1.3;
  };

  const flushTable = () => {
    if (!tableRows.length) return;
    const nCols = tableRows[0].length;
    // Column widths
    let colW;
    if (nCols === 3)       colW = [W * 0.22, W * 0.16, W * 0.62];
    else if (nCols === 2)  colW = [W * 0.30, W * 0.70];
    else                   colW = tableRows[0].map(() => W / nCols);

    const xStart = M;
    const fontSize = 9;
    const PAD = 5;

    tableRows.forEach((row, ri) => {
      const isH = ri === 0;
      // Dynamic row height based on tallest cell
      const rh = Math.max(20, ...row.map((cell, ci) =>
        cellHeight(stripMd(cell), colW[ci] - PAD * 2, fontSize) + PAD * 2
      ));
      if (doc.y + rh > PH - M - 10) doc.addPage();

      const bg = isH ? ORANGE : (ri % 2 === 0 ? LIGHT : '#ffffff');
      const fc = isH ? '#ffffff' : DARK;
      const y  = doc.y;
      let cx   = xStart;

      // Draw cell backgrounds and borders
      row.forEach((_, ci) => {
        doc.rect(cx, y, colW[ci], rh).fill(bg);
        doc.rect(cx, y, colW[ci], rh).stroke(BORDER);
        cx += colW[ci];
      });

      // Draw cell text
      cx = xStart;
      doc.fontSize(fontSize).font(isH ? 'Helvetica-Bold' : 'Helvetica').fillColor(fc);
      row.forEach((cell, ci) => {
        doc.text(stripMd(cell), cx + PAD, y + PAD, {
          width: colW[ci] - PAD * 2,
          lineBreak: true,
          lineGap: 1,
        });
        cx += colW[ci];
      });

      doc.y = y + rh;
    });
    doc.moveDown(0.5);
    doc.x = M; // reset cursor to left margin after table cells moved it
    tableRows = [];
    doc.fontSize(10).font('Helvetica').fillColor(DARK);
  };

  lines.forEach(line => {
    // Horizontal rule
    if (/^---+$/.test(line.trim())) { doc.moveDown(0.25); return; }

    // Table row
    if (line.startsWith('|')) {
      if (/^\|[\s\-|:]+\|$/.test(line)) return; // separator row
      tableRows.push(line.split('|').slice(1, -1).map(c => c.trim()));
      inTable = true;
      return;
    } else if (inTable) {
      flushTable();
      inTable = false;
    }

    // H1 — skip (cover handles it)
    if (/^# /.test(line)) return;

    // H2
    if (/^## /.test(line)) {
      const title = line.replace(/^## /, '');
      // Skip "Table of Contents" heading — entries are already skipped
      if (/table of contents/i.test(title)) { skipToc = true; return; }
      skipToc = false;
      if (doc.y > PH - M - 100) doc.addPage();
      doc.moveDown(0.6);
      doc.fontSize(15).font('Helvetica-Bold').fillColor(ORANGE)
         .text(title, { width: W });
      doc.moveDown(0.2);
      return;
    }

    // H3
    if (/^### /.test(line)) {
      skipToc = false;
      if (doc.y > PH - M - 60) doc.addPage();
      doc.moveDown(0.4);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(DARK)
         .text(line.replace(/^### /, ''), { width: W });
      doc.moveDown(0.1);
      return;
    }

    // TOC link entries — skip
    if (/^\d+\. \[/.test(line)) return;

    // Skip any plain lines while inside TOC section (empty lines between entries)
    if (skipToc && !line.trim()) return;

    // Blockquote
    if (/^> /.test(line)) {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor(GREY)
         .text(stripMd(line.replace(/^> /, '')), M + 12, doc.y, { width: W - 12 });
      doc.moveDown(0.25);
      return;
    }

    // Bullet
    if (/^[*-] /.test(line)) {
      // Detect inline bold prefix like "**Android (Chrome):**"
      const raw = line.replace(/^[*-] /, '');
      const boldPrefix = raw.match(/^\*\*(.+?)\*\*(.*)$/);
      if (boldPrefix) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK)
           .text('\u2022 ' + boldPrefix[1], { continued: boldPrefix[2].trim() !== '', indent: 10, width: W });
        if (boldPrefix[2].trim()) {
          doc.font('Helvetica').text(boldPrefix[2], { width: W - 10 });
        }
      } else {
        doc.fontSize(10).font('Helvetica').fillColor(DARK)
           .text('\u2022 ' + stripMd(raw), { indent: 10, width: W - 10 });
      }
      return;
    }

    // Numbered list
    if (/^\d+\. /.test(line)) {
      const match = line.match(/^(\d+)\. (.*)/);
      doc.fontSize(10).font('Helvetica').fillColor(DARK)
         .text(match[1] + '.  ' + stripMd(match[2]), { indent: 8, width: W - 8 });
      return;
    }

    // Empty line
    if (!line.trim()) { doc.moveDown(0.3); return; }

    // Plain paragraph — handle inline bold
    const boldParts = line.match(/^\*\*(.+?)\*\*(.*)$/);
    if (boldParts) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK)
         .text(stripMd(boldParts[1]), { continued: boldParts[2].trim() !== '', width: W });
      if (boldParts[2].trim()) {
        doc.font('Helvetica').text(boldParts[2].trim(), { width: W });
      }
      return;
    }

    doc.fontSize(10).font('Helvetica').fillColor(DARK)
       .text(stripMd(line), { width: W });
  });

  flushTable();

  // ── Page numbers (post-pass, safe — no text-state side-effects) ──
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i++) { // skip cover (i=0)
    doc.switchToPage(range.start + i);
    doc.fontSize(8).font('Helvetica').fillColor(GREY)
       .text(String(i), M, PH - M + 10, { align: 'right', width: W });
  }

  doc.end();
  return new Promise(resolve => {
    out.on('finish', () => {
      const size = fs.statSync(outputPath).size;
      console.log(`${outputPath}: ${size} bytes`);
      resolve();
    });
  });
}

module.exports = { renderGuide };
