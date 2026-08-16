# Contributing to Coster

Thanks for your interest in improving Coster! This document explains how to get set up
and what we expect from contributions.

## Development setup

```bash
git clone https://github.com/your-org/coster.git
cd coster
npm install
npm run build
npm test
```

Useful scripts:

- `npm run build` — bundle with tsup into `dist/` (CJS + ESM + types).
- `npm test` — run the Vitest suite.
- `npx tsc --noEmit` — typecheck (must stay clean).
- `npm run format` — format with Prettier.

## Project layout

- `src/core/` — storage, config, export, backfill, quality gate.
- `src/cli/` — the `coster` command-line interface.
- `src/mcp/` — the Model Context Protocol server.
- `src/inject/` — per-tool file generators and detection.
- `src/capture/` — git hooks and `cost:` directive parsing.
- `tests/` — unit and integration tests.

## Before opening a PR

1. Run `npm run build`, `npm test`, and `npx tsc --noEmit` and make sure all pass.
2. Add tests for new behavior.
3. Keep the public CLI surface stable; if you change a command, update `README.md`.
4. Follow the existing code style (no comments unless requested; KISS / YAGNI / SOLID).

## Reporting bugs

Open an issue using the bug template and include:

- Your OS and Node version (`node -v`).
- The exact command you ran and its output (sanitized of any private data).
- Steps to reproduce.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
