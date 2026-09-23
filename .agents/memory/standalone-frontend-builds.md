---
name: Standalone frontend builds
description: Why an ad-hoc frontend production build may fail despite a healthy managed preview.
---

When building a routed frontend artifact directly in a shell, provide the workflow-supplied port and base path explicitly (the root PhotoMatrix frontend uses `/` as its base path). A failed standalone build complaining about either variable does not mean the running preview or app code is broken.

**Why:** Managed artifact workflows inject routing settings, but separate shell commands do not inherit them. A build without both settings failed before loading application code, while the managed preview worked and a build with both settings succeeded.

**How to apply:** Check the artifact's configuration for required runtime inputs, then set the shell build environment to the same routing context as its workflow. Do not modify application logic to hide missing build context.