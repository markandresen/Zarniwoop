# Zarniwoop

Desktop workspace shell: embedded browser + AI sidebar companion.

**Product / architecture truth:** [`project_plan/`](project_plan/README.md)  
**Version truth:** Git (this repo). Dropbox only syncs the folder across machines.

## Stack (Phase 1)

- Electron + Vite (`electron-vite`)
- Svelte 5 + Tailwind CSS v4
- `safeStorage` API key vault
- SQLite via `sql.js` (schemas ready; vector/FTS in Phase 3)

## Develop

```bash
npm install
npm run dev
```

Primary workstation target: **Windows**. macOS is also supported.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Electron + Vite dev |
| `npm run build` | Production build to `out/` |
| `npm run typecheck` | Svelte / TS check |

## Security

API keys are stored locally, encrypted with the OS keychain via Electron `safeStorage` — never in this repo. See [SECURITY.md](SECURITY.md) to report a vulnerability.

## License

[MIT](LICENSE)
