# Security Guidelines

## Authentication & Authorization
- All API routes must verify authentication
- Validate user session on every request — never trust client-side auth state
- Use row-level or resource-level access control for data isolation

## Input Validation
- Validate ALL external input with schemas at the boundary
- Never trust query params, request bodies, or URL params directly
- Sanitize user-generated content before rendering (XSS prevention)

## Secrets Management
- Store secrets in environment variables only
- Never commit `.env`, API keys, or credentials
- Use `.env.local` for local development (ensure it's in `.gitignore`)

## API Security
- Use parameterized queries — never concatenate user input into queries
- Rate limit public endpoints
- Return generic error messages to clients — log details server-side

## Dependencies
- Keep dependencies up to date
- Review new dependencies before adding (check maintenance, size, security)
- Run security audits periodically

## What to Never Do
- Expose internal error stacks to clients
- Store passwords in plain text
- Use `eval()` or dynamic code execution with user input
- Disable strict type checks for convenience
