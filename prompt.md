# Project Log & Prompts (Sumiss)

This file logs all the steps, prompts, and actions taken during the development of Sumiss.

## Step 1: Initial Scaffolding
**Date:** 2026-10-09
**Action:** Created initial project documentation.
**Details:**
- Defined the project as a local-first AI assistant for summarizing WhatsApp chat exports.
- Outlined the key features based on the requirements: 
  - Summarizing unread conversations.
  - Finding important messages, decisions, and action items.
  - Prioritizing by urgency.
  - Highlighting mentions and deadlines.
  - Ensuring local-only processing.
- Structured the classification output with colored indicators:
  - 🔴 Urgent things I need to know
  - 🟠 Things I need to do
  - 🟡 Decisions that were made
  - 🔵 Things I was mentioned/tagged in
  - 🟢 Deadlines / dates
  - ⚪ Everything else
- Generated `README.md`, `CHANGELOG.md`, and `prompt.md`.

## Step 2: Environment Setup
**Date:** 2026-10-09
**Action:** Created frontend, backend, and database environments.
**Details:**
- Initialized Next.js application in `/frontend` directory for the dashboard GUI (running on localhost:3000).
- Initialized NestJS application in `/backend` directory to act as the API brain (configured port to 4000).
- Created a `docker-compose.yml` to spin up:
  - Redis (for message brokering and background task queue using BullMQ).
  - PostgreSQL (for storing structurally parsed data like Chats, Participants, Messages, Tags).

## Step 3: Global Design Palette
**Date:** 2026-10-09
**Action:** Configured Tailwind v4 global color palette.
**Details:**
- Modified `frontend/src/app/globals.css` to lock in a purely dark theme.
- Defined variables: `--background`, `--surface`, `--foreground`, `--muted`, `--accent`.
- Mapped semantic priority colors: `--priority-critical`, `--priority-action`, `--priority-meeting`.

## Step 4: Lexical Scanner Implementation (Backend)
**Date:** 2026-10-09
**Action:** Created the `AnalyzerService` for chat message triage.
**Details:**
- Installed `chrono-node` for robust natural language date/time extraction.
- Implemented rules:
  1. **Identity Matching:** Uses Regex to find mentions against a user-defined config (assigns `#EF4444`).
  2. **Date Extraction:** Uses `chrono-node` to find meetings (assigns `#10B981`).
  3. **Keyword Dictionaries:** Detects task words (e.g. "fix", "urgent") and meeting words (assigns `#F59E0B` or `#10B981`).
  4. **Structure:** Flags questions containing `?` and query words ("how", "what") as `#F59E0B`.
- Integrated a priority scoring system for messages to determine overall feed ranking.

## Step 5: Triage Priority Scoring System
**Date:** 2026-10-09
**Action:** Overhauled `AnalyzerService` with exact scores and noise filtration.
**Details:**
- Configured baseline score starting at `0`.
- Added scoring metrics: Mention (`+50`), Future Date (`+30`), Question (`+20`), Keyword (`+15`).
- Added noise suppression: standalone words like "ok", "thanks" are given a `-100` penalty to be hidden.
- Bootstrapped PostgreSQL via Docker and initialized Prisma to store the scored messages.

## Step 6: Frontend Dashboard Prototype
**Date:** 2026-10-09
**Action:** Built the static Three-Pane layout in Next.js.
**Details:**
- Modified `page.tsx` to implement a mocked version of the Triage UI.
- **Left Pane:** "The Sieve" with Smart Views and Upload placeholders.
- **Center Pane:** The "Action Area" rendering cards with the semantic colors, snippets, tags, and action buttons.
- **Right Pane:** The "Details Area" showcasing the Context Viewer, Extracted Entities, and Chat Analytics.
- Deployed the Next.js frontend dev server for a live preview.

## Step 7: Native Setup Migration
**Date:** 2026-10-09
**Action:** Migrated away from Docker to native Homebrew macOS execution.
**Details:**
- Created `setup-local.sh` to automatically install and start PostgreSQL 15 and Redis via Homebrew.
- Updated `.env` and `package.json` to support a `dev:local` script that bridges Native services with NestJS.

## Step 8: Frontend Upload Integration
**Date:** 2026-10-09
**Action:** Replaced mocked frontend data with live API calls.
**Details:**
- Implemented file upload (`FormData`) to send the `.txt` export to the backend.
- Hooked up `useEffect` to fetch real classified messages from `localhost:4000/messages`.
- Added loading state indicator (frosted glass popup) while processing.

## Step 9: Ollama LLM Integration
**Date:** 2026-10-09
**Action:** Replaced Regex lexical scanner with a local open-weights LLM.
**Details:**
- Updated `AnalyzerService` to contact a local Ollama server (`http://127.0.0.1:11434/api/generate`).
- Structured a strictly typed JSON prompt to enforce accurate semantic categorization.
- Selected `qwen3.5:9b` as the default local LLM for its superior JSON extraction.
- Fully overhauled the `AppService` parsing loop to properly await asynchronous AI requests sequentially.

## Step 10: Source Management & Bugfixes
**Date:** 2026-10-09
**Action:** Implemented feature to delete uploaded sources.
**Details:**
- Downgraded Prisma from unstable `v8.0-RC` to stable `v5.22` and regenerated client to resolve Typescript and connection errors.
- Added a `sourceName` column to `schema.prisma`.
- Created a `DELETE /sources/:name` endpoint.
- Updated the frontend Sidebar to display all active sources with a hoverable Trash Icon to securely delete them from the database.
