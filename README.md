# Sumiss

Sumiss is an AI "catch-up" assistant designed to turn a wall of exported WhatsApp messages into structured, actionable insights. By using the lightning-fast Google Gemini API, your conversations are instantly parsed and categorized.

## Features

- **Summarizing long and unread conversations**
- **Identifying important messages, decisions, and action items**
- **Prioritizing information based on urgency and relevance**
- **Highlighting mentions, deadlines, and tasks you may have missed**

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
3. **Google Gemini API Key**

### Setup & Run
1. Install dependencies in both folders:
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```
2. Create a `.env` file in the `backend/` folder and add your API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. Start the backend (this will automatically provision Postgres & Redis via Homebrew if missing!):
   ```bash
   cd backend
   npm run dev:local
   ```
4. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```
5. Access the dashboard at `http://localhost:3000` and upload your chat exports!
