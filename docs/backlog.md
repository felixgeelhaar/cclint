## Watch Mode Command

Implement `cclint watch` command that continuously lints CLAUDE.md files on changes. Uses chokidar for cross-platform file watching with debouncing. Supports recursive watching, auto-fix on change, and clear terminal between runs.

---

## Init/Scaffold Command

Implement `cclint init` command to generate starter CLAUDE.md files. Includes template system (minimal, typescript, python, go, monorepo, library, api), project type detection from package.json/pyproject.toml/go.mod, and interactive mode with prompts.

---

## Pre-commit Hook Installation

Implement `cclint install-hook` and `cclint uninstall-hook` commands. Auto-detect hook manager (husky, lefthook, pre-commit, raw git). Support --fix and --staged options for hook behavior.

---

## Interactive Fix Mode

Add --interactive flag to lint command for step-through fix review. Show violation details, current content, and suggested fix. Allow apply/skip/apply-all/quit actions using inquirer prompts.

---

## Explain Command

Implement `cclint explain [rule]` command for rule documentation. Add metadata to all rules (description, rationale, examples, options). Support --all to list rules and --category to filter.

---

## Diff-Aware Linting

Add --diff flag to lint command to only report violations in changed lines. Use simple-git to get diff hunks. Filter violations by changed line ranges. Support comparing to any git ref.

---
