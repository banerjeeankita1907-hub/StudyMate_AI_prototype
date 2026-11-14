# StudyMate AI — Personalized Learning Companion

StudyMate is a browser-based study companion with study-plan generation,
doubt explanations, multiple-choice quizzes, flashcards and local progress
tracking. This repository now includes a small Node.js server so AI-provider
credentials remain server-side.

## Features

- Study plans with day-wise topics and practice suggestions.
- Short concept explanations for student questions.
- Four-question multiple-choice quizzes with answer feedback.
- Six-card flashcard sets with navigation.
- Browser-local XP, streak and activity history.
- Server-side AI proxy at `POST /api/ai`.
- Prompt length and token limits, bounded request body and basic per-IP
  in-memory request throttling.
- Escaped AI-generated text and validated quiz/flashcard response schemas.
- Unit and integration tests for server, API and browser integrity.

## Run locally

Requires Node.js 18 or newer.

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

To enable AI generation, configure the server environment first:

```bash
export ANTHROPIC_API_KEY="your-server-side-key"
export ANTHROPIC_MODEL="claude-sonnet-4-6"
npm start
```

The API key is read only by the server from the environment. It is not embedded
in the HTML, sent to the browser or stored in localStorage. Without a configured
key, the server responds with a clear 503 configuration message. See
[.env.example](.env.example) for the variable names.

## Quality checks

```bash
npm run check
npm test
```

GitHub Actions runs syntax, API, server and static-browser integrity tests.

## Architecture

```text
StudyMate_AI_prototype.html  # single-page browser UI
server.cjs                  # same-origin static server and API route
api/ai.cjs                  # provider request validation and API wrapper
tests/
  ai.test.cjs
  server.test.cjs
  browser-integrity.test.cjs
```

The browser sends prompts to `/api/ai`; the server validates the request and
attaches the provider key before forwarding it to the AI API. The server uses
a fixed upstream URL and does not accept arbitrary proxy destinations.

## Security and privacy limitations

The app stores XP, streak and activity labels in the current browser's local
storage. Do not enter sensitive personal, medical, financial or confidential
academic information in prompts. The in-memory per-IP rate limit is a basic
single-process safeguard, not a substitute for an API gateway, user
authentication, persistent quotas or abuse monitoring. Use HTTPS behind a
trusted hosting platform before public deployment.

AI-generated explanations and study plans can contain factual errors.
Students should verify important technical or academic claims against course
materials and trusted references. The quiz and flashcard outputs are
practice aids, not validated examinations.

## Licence

No separate licence file is currently provided. Ask before reusing or
redistributing this repository's code.
