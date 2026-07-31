const { renderGuide } = require('./_render');

renderGuide({
  inputPath:      'docs/user-guide.md',
  outputPath:     'docs/user-guide.pdf',
  coverTitle:     'PhotoMatrix',
  coverSubtitle:  'User Guide',
});
