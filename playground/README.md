# cclint playground

Local browser lint UI. Rules run entirely in your browser — nothing is uploaded.

```bash
# from repo root
npm run playground        # http://127.0.0.1:5173
npm run playground:build  # static files in playground/dist
```

Uses `src/browser/lintMarkdown` (browser-safe rule set). Filesystem-dependent
rules (`import-resolution`, `monorepo-hierarchy`, `agents-md`) are omitted.
