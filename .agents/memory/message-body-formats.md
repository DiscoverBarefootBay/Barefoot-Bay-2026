---
name: Message body formats
description: How to distinguish newly composed plain text from historical HTML in saved messages
---

Messages do not have an explicit saved content-format marker. Render new composer text as escaped plain text with preserved line breaks; recognize only historically plausible HTML at the start of a body, and render it through a strict allowlist. Do not inject saved message bodies as raw HTML.

**Why:** The composer stores raw newlines, which collapse when inserted as HTML. Older records may contain legitimate markup, but treating arbitrary bodies as HTML creates script-injection risks and loses the author's spacing. A leading literal rich-text tag is inherently ambiguous until content formats are saved explicitly.

**How to apply:** Reuse the shared body renderer for messages and replies. When introducing any new editing or storage path, prefer an explicit content-format field rather than extending the heuristic. Do not change the separate email formatting logic to fix website display.