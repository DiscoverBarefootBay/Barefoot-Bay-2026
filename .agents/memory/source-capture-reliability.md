---
name: Source capture reliability
description: Avoid malformed historical source copies in isolated browser measurements.
---

Do not rely solely on a shell callback's truncation flag when copying a large source file into a browser baseline.

**Why:** A captured historical calendar source began halfway through JSX despite a false truncation flag. The copied baseline failed to compile; materializing the complete source in a temporary file and reading it with an explicit adequate byte budget resolved it.

**How to apply:** For source copies that must be byte-complete, use a file read rather than feeding captured shell stdout directly into a writer. Compare byte lengths and validate the beginning/end before compiling. Historical browser baselines must stay unlinked from the real app and be removed after measurement.