---
name: Bilingual semantic photo search
description: Supported approach for PhotoMatrix search across English and Dutch visual concepts.
---

Use managed-LLM query expansion to turn each search into a compact set of English and Dutch concepts, synonyms, and individual meaningful words. Match those terms against titles, photographer descriptions, AI descriptions, and AI tags. Rank exact-phrase matches first, then rank by the number of expanded concepts matched.

**Why:** Literal matching is useful for exact terms, but members should be able to search by concept and language rather than knowing the wording used in a photo's metadata.

The managed OpenAI-compatible endpoint supports chat/vision but rejects `POST /embeddings` as an unsupported endpoint. A vector implementation therefore cannot use the existing managed integration without adding another provider.

**How to apply:** Keep exact matching as a no-AI fallback, cache successful expansions briefly, preserve photographer-entered text as a separate search source, and split generated phrases into words so useful multi-word concepts cannot silently miss exact tags.