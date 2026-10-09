#!/bin/bash

echo "🚀 Starting Sumiss Native Setup..."

# Trap CTRL+C to properly kill both processes when the user exits
trap 'echo "🛑 Stopping services..."; kill 0' SIGINT

# Start the backend in the background
echo "🟢 Starting Backend on port 4000..."
cd backend && npm run dev:local &

# Navigate back to root and start frontend in the background
cd ..
echo "🔵 Starting Frontend on port 3000..."
cd frontend && npm run dev &

# Wait for all background processes to finish (keeps the terminal open)
wait
