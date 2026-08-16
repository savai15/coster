# Security Policy

## Supported versions

The latest `1.x` release receives security updates.

## Reporting a vulnerability

Coster stores all data locally and makes no network calls in normal operation. If you
discover a vulnerability (including any path traversal, arbitrary file write, or
unintended network access), please report it privately rather than opening a public issue.

- Use GitHub's private vulnerability reporting on the repository, or
- Email the maintainers (see the repository `CODEOWNERS` / maintainer list).

Please include:

- A description of the issue and its impact.
- Steps to reproduce (sanitized; no private data).
- Your OS and Node version.

We will acknowledge within a few days and aim to ship a fix in the next patch release.

## Scope notes

- Coster runs git hooks you install via `coster hooks install`. The hook scripts call
  `coster` by name and are designed to fail open (`|| true`) so they never block git.
- The MCP server only reads/writes the local `.coster/` database for the project it is
  pointed at. Do not expose the MCP server over an untrusted network.
