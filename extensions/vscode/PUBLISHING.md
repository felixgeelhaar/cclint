# Publishing the cclint VS Code extension

This extension is a thin Language Client for `cclint-lsp`. Marketplace
credentials are **not** stored in this repo — publish from a maintainer machine
or a secrets-backed release workflow.

## Prerequisites

1. A [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage)
   publisher matching `publisher` in `package.json` (`felixgeelhaar`).
2. A Personal Access Token (PAT) with **Marketplace → Manage** scope from
   [Azure DevOps](https://dev.azure.com) (User settings → Personal access tokens).
3. `cclint-lsp` available to end users (global `npm i -g @felixgeelhaar/cclint`
   or workspace `node_modules`).

Optional: also publish to [Open VSX](https://open-vsx.org/) with an
[Eclipse Open VSX token](https://open-vsx.org/user-settings/tokens).

## Local package (no credentials)

```bash
cd extensions/vscode
npm ci
npm run package
# → cclint-0.x.y.vsix
```

Install for smoke-testing:

```bash
code --install-extension cclint-*.vsix
```

CI builds the same VSIX as an artifact on every push/PR (job `vscode-vsix`) so
reviewers can download and install without publishing.

## Publish to VS Marketplace

```bash
cd extensions/vscode
npm ci
npx @vscode/vsce publish -p "$VSCE_PAT"
# or, after npm run package:
# npx @vscode/vsce publish --packagePath cclint-*.vsix -p "$VSCE_PAT"
```

Bump `version` in `extensions/vscode/package.json` in lockstep with the root
package when cutting a release (same semver as `@felixgeelhaar/cclint`).

## Publish to Open VSX

```bash
cd extensions/vscode
npm ci
npm run package
npx ovsx publish cclint-*.vsix -p "$OVSX_PAT"
```

## Checklist before first marketplace listing

- [ ] `publisher` account exists and owns the `cclint` extension name
- [ ] `icon` (`media/icon.png`, 128×128+) and `galleryBanner` look correct
- [ ] README describes requirements (`cclint-lsp` on PATH / local bin)
- [ ] VSIX installs cleanly; diagnostics appear on `CLAUDE.md` / `AGENTS.md`
- [ ] Repository / bugs / homepage URLs in `package.json` resolve
- [ ] PAT stored only in CI secrets or a password manager — never committed
