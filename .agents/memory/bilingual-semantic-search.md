---
name: Bilingual semantic photo search
description: Future direction for PhotoMatrix search across English and Dutch visual concepts.
---

PhotoMatrix should eventually support semantic search where English and Dutch queries can find the same relevant photos even when stored descriptions and generated tags use only one language.

**Why:** Literal matching is useful for exact terms, but members should be able to search by concept and language rather than knowing the wording used in a photo's metadata.

**How to apply:** Use multilingual text embeddings over the existing AI description, generated tags, title, and relevant metadata; combine vector ranking with existing exact search and preserve photographer-entered text as a separate source.