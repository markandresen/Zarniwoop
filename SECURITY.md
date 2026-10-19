# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately via GitHub: **Security → Report a vulnerability** on this repository
(GitHub private vulnerability reporting). You will get a response as soon as possible.

## How Zarniwoop handles secrets

- API keys are entered by the user at runtime and stored only on the local machine,
  encrypted with Electron `safeStorage` (OS keychain / DPAPI). They are never committed
  to this repository and never exposed to the renderer process.
- If OS-level encryption is unavailable, Zarniwoop refuses to store keys.
- The embedded browser runs in a separate, sandboxed session with no access to the
  app's privileged APIs; permission requests (camera, mic, location, …) are denied.
