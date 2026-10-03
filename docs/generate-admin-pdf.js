const { renderGuide } = require('./_render');

renderGuide({
  inputPath:      'docs/admin-guide-photographers.md',
  outputPath:     'docs/admin-guide-photographers.pdf',
  coverTitle:     'PhotoMatrix',
  coverSubtitle:  'Web Admin Guide',
  coverSubtitle2: 'Managing Photographers',
});

// Keep the focused import guide available for existing links and downloads.
renderGuide({
  inputPath:      'docs/admin-guide-import.md',
  outputPath:     'docs/admin-guide-import.pdf',
  coverTitle:     'PhotoMatrix',
  coverSubtitle:  'Web Admin Guide',
  coverSubtitle2: 'Importing Photos from a URL',
});

renderGuide({
  inputPath:      'docs/admin-guide-bulk-edit.md',
  outputPath:     'docs/admin-guide-bulk-edit.pdf',
  coverTitle:     'PhotoMatrix',
  coverSubtitle:  'Web Admin Guide',
  coverSubtitle2: 'Bulk Photo Management',
});
