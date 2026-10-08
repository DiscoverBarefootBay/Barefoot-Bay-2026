---
name: Git hook runtime environment
description: UI-launched pushes can lack Node even when workspace shell commands work.
---

Native pre-push hooks must not assume the push launcher inherits the workspace shell's Node PATH.

**Why:** A push launched outside the workspace shell failed with `node: not found`; the Git UI labeled it a remote rejection even though the local hook failed before the push.

**How to apply:** Install checkout-local hooks using the installing process's absolute runtime path. Verify with a PATH containing Git but no Node. Preserve the validation rather than disabling the hook, and reinstall after runtime replacement.
