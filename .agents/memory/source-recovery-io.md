---
name: Exact source recovery
description: Avoid restoring source files from bounded terminal transcripts
---

Do not use terminal transcript output as an exact file-content source when recovering files from git. Export the git object into a temporary file, then read that file with the filesystem reader.

**Why:** The programmatic shell callback returned a bounded tail of a large git object without reliably flagging truncation, and its terminal output introduced CRLF line endings. Treating that transcript as complete source removed the beginning of the API specification.

**How to apply:** For exact recovery, redirect git show to a temporary file and use readFile on that path before writing the destination. Compare recovered content against the intended git tree; regenerate generated clients from the recovered specification rather than hand-merging them.