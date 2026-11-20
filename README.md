# Sidequest

A small AI tool for hobby builders who want to stop overthinking and make something of their own.

Describe an idea, explore existing solutions, and find a personal twist worth building. Sidequest helps you choose a small project and take a concrete first step—not predict business success.

## How it works

1. Share an idea, an annoyance, or an area of interest.
2. Choose Soft (default, 2–4 questions) or Hard (8–10). The full questionnaire is generated from your initial idea and shown one question at a time; pick multiple options and add your thoughts. One question asks where you want to realize the idea.
3. Review an inspiring 80–120 word mini-pitch grounded in the saved initial idea analysis and questionnaire answers, then confirm it and explore up to four source-backed solutions relevant to your idea and available where you want to realize it; “Not important” removes the geographic restriction.
4. Compare companies in a table: source-backed implemented features and developed ideas linked to each company. Unconfirmed feature gaps are labeled.
5. Tick individual ideas from either column across companies and optionally add a comment.
6. Get one coherent MVP scoped to a single evening, a self-contained prompt for the working first version, and practical steps to try it, show it to a potential user, and learn from their response.

The interface and AI responses are in English. Ideas can be entered in any language.

## Run locally

Requires Node.js 24. No dependencies need to be installed. Local progress is saved to `.sidequest-local/sessions.json` (gitignored) and survives server restarts; the browser keeps a per-tab session ID. Local sessions do not expire automatically. Local testing has no app-imposed request, search, or session-count quotas; OpenAI account limits still apply.

1. Copy `.env.example` to `.env`.
2. Configure your server-side environment variables locally.
3. Start the app:

```sh
npm start
```

Open [localhost:3000](http://localhost:3000). On Windows, `Start.cmd` is also available.

Never commit `.env` or put credentials in frontend code.

## Deploy

The project includes a Vercel configuration. Use the **Other** preset, the repository root, and the build settings from `vercel.json`.

Configure credentials in the hosting provider's environment settings as secrets. See [deployment instructions](DEPLOY.md) for setup details.

## Development

Built with Node.js, plain HTML/CSS/JavaScript, and the OpenAI Responses API with web search. No frontend framework, account system, or database is required.

```sh
npm test       # Automated checks; no live AI requests
npm run build  # Build the static frontend
npm run smoke  # Full live flow; requires a running app and uses API credits
```

## Sources and limitations

Source-backed claims, AI interpretations, and personal preferences are presented separately. Cards link to sources returned by web search; unsupported cards are excluded. If fewer than four solutions can be verified, the app shows partial results.

Source links establish provenance, not a guarantee that every AI interpretation is correct. A missing feature mention is not proof that the feature is absent. Check the original sources when a detail matters.

Sidequest is an MVP for personal projects, not a market validation platform. AI requests require an internet connection and may incur API charges.
