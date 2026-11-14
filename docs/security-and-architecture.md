# StudyMate server and security design

## Request flow

The browser sends a prompt to the same-origin `POST /api/ai` route. The Node
server validates the request body, attaches the provider key from the server
environment, and forwards the request to a fixed upstream API URL. The provider
key is never embedded in browser HTML or returned in the response.

The API accepts:
- `prompt`: a non-empty string no longer than 10,000 characters.
- `maxTokens`: an integer from 1 to 2,000.

The server caps request bodies at 48 KiB, rejects incorrect content types,
does not cache AI responses and applies a basic in-memory limit of 12 requests
per source IP per 60 seconds.

## Browser rendering

AI Markdown is HTML-escaped before limited formatting is applied. Quiz
questions and answers are assigned through textContent/innerText after schema
validation. Flashcard terms and definitions are length-checked and escaped.
Dashboard activity labels are normalized from localStorage and escaped before
rendering.

## Provider configuration

Set `ANTHROPIC_API_KEY` and optionally `ANTHROPIC_MODEL` in the server
environment. Never put them in the HTML, browser storage, source control or
Vite-style public environment variables. The included .env.example contains
only a placeholder.

## Limitations before public deployment

- The in-memory rate limiter is per process and does not provide distributed
  quotas or abuse analytics.
- There is no user authentication, account-level billing, persistent request
  history or budget cap.
- The local progress store is browser-local and can be edited by the user.
- Prompts are sent to the configured AI provider; do not include confidential
  or sensitive personal data.
- AI outputs may be inaccurate and are not automatically fact-checked.
- The Node server should be deployed behind HTTPS and an appropriate reverse
  proxy with monitoring, provider spending limits and secret rotation.

The project is a learning prototype, not an institutional learning-management
system or a validated assessment platform.
