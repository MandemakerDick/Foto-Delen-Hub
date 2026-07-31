/**
 * Shared Markdown-to-PDFKit renderer for PhotoMatrix guides.
 * Page numbers are written BEFORE each addPage() call so bufferPages /
 * switchToPage are never needed (those cause phantom blank pages).
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

  const doc = new PDFDocument({ margin: M, size: 'A4' }); // no bufferPages
  const out = fs.createWriteStream(outputPath);
  doc.pipe(out);

  // ── Cover ──────────────────────────────────────────────────────
  doc.rect(0, 0, PW, PH).fill('#111111');
  const coverY = PH * 0.35;
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

  // ── Page-number helpers ────────────────────────────────────────
  // contentPageNum counts body pages (1-based); cover is never numbered.
  let contentPageNum = 0;

  const writeFooter = () => {
    if (contentPageNum < 1) return;
    doc.fontSize(8).font('Helvetica').fillColor(GREY)
       .text(String(contentPageNum), M, PH - M - 10, { align: 'right', width: W });
  };

  // Call this instead of doc.addPage() everywhere in the body renderer.
  const newPage = () => {
    writeFooter();          // stamp footer on the page we're leaving
    doc.addPage();
    contentPageNum++;
    doc.fontSize(10).font('Helvetica').fillColor(DARK); // reset style
  };

  // ── Body ───────────────────────────────────────────────────────
  doc.addPage();
  contentPageNum = 1;
  doc.moveDown(0.5);

  const lines = md.trimEnd().split('\n');
  let tableRows = [], inTable = false, skipToc = false;

  const EMOJI_SUB = {
    '🟡': '[Pending]', '✅': '[Approved]', '❌': '[Rejected]',
    '⚠️': '[Warning]', '✔️': '[Yes]',
  };
  const stripMd = t =>
    t.replace(/🟡|✅|❌|⚠️|✔️/g, m => EMOJI_SUB[m] ?? '')
     .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
     .replace(/\*\*([^*]+)\*\*/g, '$1')
     .replace(/\*([^*]+)\*/g, '$1')
     .replace(/`([^`]+)`/g, '$1');

  const needsNewPage = (reserve = 80) => doc.y > PH - M - reserve;

  const flushTable = () => {
    if (!tableRows.length) return;
    const nCols = tableRows[0].length;
    let colW;
    if (nCols === 3)      colW = [W * 0.22, W * 0.16, W * 0.62];
    else if (nCols === 2) colW = [W * 0.30, W * 0.70];
    else                  colW = tableRows[0].map(() => W / nCols);

    const PAD = 5, fontSize = 9;
    const totalW = colW.reduce((a, b) => a + b, 0);

    tableRows.forEach((row, ri) => {
      // Estimate row height from longest cell content
      const rh = Math.max(20, ...row.map((cell, ci) => {
        const chars = stripMd(cell).length;
        const charsPerLine = Math.max(1, Math.floor((colW[ci] - PAD * 2) / (fontSize * 0.52)));
        return Math.ceil(chars / charsPerLine) * fontSize * 1.4 + PAD * 2;
      }));

      if (needsNewPage(rh + 10)) newPage();

      const isH = ri === 0;
      const bg  = isH ? ORANGE : (ri % 2 === 0 ? LIGHT : '#ffffff');
      const fc  = isH ? '#ffffff' : DARK;
      const y   = doc.y;
      let cx    = M;

      // Backgrounds + borders
      row.forEach((_, ci) => {
        doc.rect(cx, y, colW[ci], rh).fill(bg);
        doc.rect(cx, y, colW[ci], rh).stroke(BORDER);
        cx += colW[ci];
      });

      // Cell text
      cx = M;
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
    doc.x = M;
    tableRows = [];
    doc.fontSize(10).font('Helvetica').fillColor(DARK);
  };

  lines.forEach(line => {
    if (/^---+$/.test(line.trim())) { doc.moveDown(0.25); return; }

    if (line.startsWith('|')) {
      if (/^\|[\s\-|:]+\|$/.test(line)) return;
      tableRows.push(line.split('|').slice(1, -1).map(c => c.trim()));
      inTable = true;
      return;
    } else if (inTable) {
      flushTable();
      inTable = false;
    }

    if (/^# /.test(line)) return;

    if (/^## /.test(line)) {
      const title = line.replace(/^## /, '');
      if (/table of contents/i.test(title)) { skipToc = true; return; }
      skipToc = false;
      if (needsNewPage(100)) newPage();
      doc.moveDown(0.6);
      doc.fontSize(15).font('Helvetica-Bold').fillColor(ORANGE).text(title, { width: W });
      doc.moveDown(0.2);
      return;
    }

    if (/^### /.test(line)) {
      skipToc = false;
      if (needsNewPage(60)) newPage();
      doc.moveDown(0.4);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(DARK)
         .text(line.replace(/^### /, ''), { width: W });
      doc.moveDown(0.1);
      return;
    }

    if (/^\d+\. \[/.test(line)) return; // TOC link entries
    if (skipToc && !line.trim()) return;

    if (/^> /.test(line)) {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor(GREY)
         .text(stripMd(line.replace(/^> /, '')), M + 12, doc.y, { width: W - 12 });
      doc.moveDown(0.25);
      return;
    }

    if (/^[*-] /.test(line)) {
      const raw = line.replace(/^[*-] /, '');
      const boldPrefix = raw.match(/^\*\*(.+?)\*\*(.*)$/);
      if (boldPrefix) {
        const rest = boldPrefix[2].replace(/^\*([^*]+)\*/, '$1').trim();
        doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK)
           .text('\u2022 ' + stripMd(boldPrefix[1]) + (rest ? '' : ''), {
             continued: !!rest, indent: 10, width: W - 10,
           });
        if (rest) doc.font('Helvetica').text(' ' + stripMd(rest), { width: W - 10 });
      } else {
        doc.fontSize(10).font('Helvetica').fillColor(DARK)
           .text('\u2022 ' + stripMd(raw), { indent: 10, width: W - 10 });
      }
      return;
    }

    if (/^\d+\. /.test(line)) {
      const m = line.match(/^(\d+)\. (.*)/);
      doc.fontSize(10).font('Helvetica').fillColor(DARK)
         .text(m[1] + '.  ' + stripMd(m[2]), { indent: 8, width: W - 8 });
      return;
    }

    if (!line.trim()) { doc.moveDown(0.3); return; }

    const boldParts = line.match(/^\*\*(.+?)\*\*(.*)$/);
    if (boldParts) {
      const rest = stripMd(boldParts[2]).trim();
      doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK)
         .text(stripMd(boldParts[1]), { continued: !!rest, width: W });
      if (rest) doc.font('Helvetica').text(' ' + rest, { width: W });
      return;
    }

    doc.fontSize(10).font('Helvetica').fillColor(DARK).text(stripMd(line), { width: W });
  });

  flushTable();
  writeFooter(); // stamp the last body page

  doc.end();
  return new Promise(resolve => {
    out.on('finish', () => {
      console.log(`${outputPath}: ${fs.statSync(outputPath).size} bytes`);
      resolve();
    });
  });
}

module.exports = { renderGuide };
