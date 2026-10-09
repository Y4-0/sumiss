# Sumiss

Sumiss is a local AI "catch-up" assistant designed to turn a wall of exported WhatsApp messages into structured, actionable insights. By keeping all processing local, your conversations, data, and summaries never leave your device.

## Features

- **Summarizing long and unread conversations**
- **Identifying important messages, decisions, and action items**
- **Prioritizing information based on urgency and relevance**
- **Highlighting mentions, deadlines, and tasks you may have missed**
- **Using local-first processing** (ensuring complete data privacy)

## Information Categories

Sumiss automatically categorizes the parsed chat data into the following buckets:

- 🔴 **Urgent things I need to know**
- 🟠 **Things I need to do**
- 🟡 **Decisions that were made**
- 🔵 **Things I was mentioned/tagged in**
- 🟢 **Deadlines / dates**
- ⚪ **Everything else**

## Getting Started

Sumiss has completely dropped Docker in favor of a faster, native macOS execution environment!

### Prerequisites
1. **Node.js** (v18+)
2. **Homebrew** (for automatic Postgres & Redis installation)
3. **Ollama** installed locally (with a model downloaded, default: `qwen3.5:9b`)

### Setup & Run
1. Install dependencies in both folders:
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```
2. Start the backend (this will automatically provision Postgres & Redis via Homebrew if missing!):
   ```bash
   cd backend
   npm run dev:local
   ```
3. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```
4. Access the dashboard at `http://localhost:3000` and upload your chat exports!
