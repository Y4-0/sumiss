# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project scaffolding.
- `README.md` defining project goals, output categories, and local-first constraints.
- `CHANGELOG.md` for tracking project changes and version history.
- `prompt.md` to log the development process and steps step-by-step.
- Initialized Next.js frontend application (App Router, Tailwind CSS, TypeScript).
- Initialized NestJS backend application (TypeScript, strict mode) configured to run on port 4000.
- Added `docker-compose.yml` with PostgreSQL and Redis services.
- Implemented global color palette in Tailwind via `globals.css` (Dark theme lock-in).
- Built the `AnalyzerService` in the backend using `chrono-node` for lexical scanning (Mentions, Dates, Intents).
- Implemented specific score-based priority triage rules for AnalyzerService (Mention: +50, Date: +30, Question: +20, Keyword: +15, Noise: -100).
- Created native macOS execution script `setup-local.sh` to provision Postgres and Redis without Docker.
- Replaced mocked UI data with live asynchronous polling and API calls in the Next.js frontend.
- Added file upload endpoint for `.txt` WhatsApp chat exports.
- **Breaking/Architecture**: Replaced the primitive regex lexical scanner with an integration to a local **Ollama LLM** (`qwen3.5:9b`).
- Enforced zero-shot JSON-mode structured output prompting for Ollama to assign priorities and tags.
- Added a frosted-glass `Analyzing Chat...` processing UI popup for better UX during async LLM generation.
- Added a new `sourceName` column to Prisma schema and updated the NestJS controller.
- Implemented `Remove Source` feature in the frontend sidebar to gracefully delete chat records from the DB by filename.
- Downgraded Prisma from v8 RC to v5 stable to prevent schema sync and client generation typescript crashes.
- **Breaking/Architecture**: Fully removed local Ollama integration to improve speed and reliability.
- **Breaking/Architecture**: Migrated analyzer engine to use Google's Gemini API (`gemini-flash-lite-latest`).
- Optimized `AnalyzerService` with prompt-batching to analyze 100 messages concurrently in a single API request, bypassing strict rate limits.
- Implemented global `generateSummary` endpoint powered by Gemini to generate "Executive Summaries" of uploaded chats.
- Refactored frontend UI with premium glassmorphism, dynamic gradients, and animated elements. Removed all deprecated Ollama engine toggles.
- Decoupled upload and analysis, allowing files to be queued as "Unanalyzed" sources.
- Re-introduced the Lexical (Local) scanning option using `chrono-node` as an instant alternative to Gemini.
- Added a dynamic "Analysis Engine" toggle in the frontend (Gemini AI vs Lexical).
- Added an explicit "Your Username" field to correctly track direct `@mentions` and filter out hallucinated mentions of "you".
- Implemented a "Re-analyze" feature that dynamically appears on analyzed sources when switching between engines.
- Added a live mathematical countdown timer in the UI displaying time remaining until midnight PST for Gemini API quota resets.
- Refined the Gemini prompt to aggressively flag chat system messages (e.g. "joined using a group link") as noise with a score of `-100`.
