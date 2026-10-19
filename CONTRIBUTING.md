# Contributing

Thanks for taking a look. Small, focused pull requests are easiest to review.

## Local setup

```bash
npm install
npm run lint && npm run typecheck && npm run test
```

## Expectations

- Keep the tool surface small and explicit; new tools need tests and docs.
- Never commit a real endpoint, secret or token. Use environment variables and the
  placeholders in `.env.example`.
- Run `npm run format` before opening a pull request; CI checks formatting, lint,
  typecheck, tests (with coverage thresholds) and the build.

## Reporting issues

Include the Node version, the aria2 version and the exact tool call that failed.
Redact your RPC URL and secret.
