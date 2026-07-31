const { renderGuide } = require('./_render');

renderGuide({
  inputPath:      'docs/admin-guide-import.md',
  outputPath:     'docs/admin-guide-import.pdf',
  coverTitle:     'PhotoMatrix',
  coverSubtitle:  'Admin Guide',
  coverSubtitle2: 'Importing Photos from a URL',
});
