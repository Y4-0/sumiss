#!/bin/bash
set -e

echo "🔍 Checking dependencies..."

if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew is not installed. Please install it from https://brew.sh/ and try again."
    exit 1
fi

# Ensure correct postgresql@15 path is prioritized
export PATH="/opt/homebrew/opt/postgresql@15/bin:/usr/local/opt/postgresql@15/bin:$PATH"

if ! command -v postgres &> /dev/null || ! postgres -V | grep -q '15'; then
    echo "📦 Installing PostgreSQL 15 via Homebrew..."
    brew install postgresql@15
fi

if ! command -v redis-server &> /dev/null; then
    echo "📦 Installing Redis via Homebrew..."
    brew install redis
fi

echo "🚀 Starting services natively..."
brew services start postgresql@15
brew services start redis

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3
if ! pg_isready; then
    echo "❌ PostgreSQL is not ready. Please check 'brew services list' for errors."
    exit 1
fi

echo "🗄️ Initializing database..."
# Create the database if it doesn't exist
if ! psql -lqt | cut -d \| -f 1 | grep -qw sumiss; then
    createdb sumiss
    echo "✅ Database 'sumiss' created."
else
    echo "✅ Database 'sumiss' already exists."
fi

echo "⚙️ Configuring environment variables..."
cd "$(dirname "$0")/backend"
if [ ! -f .env ]; then
    cp .env.example .env
    # Replace $USER in .env with actual username for macOS
    sed -i '' "s/\$USER/$(whoami)/g" .env
    echo "✅ Created .env from .env.example"
else
    # Update existing .env to use local user instead of docker 'postgres' user
    sed -i '' "s/postgres:password/$(whoami)/g" .env
fi

echo "⚙️ Pushing Prisma schema..."
npx prisma db push
npx prisma generate

echo "✅ Local setup complete! The backend is ready to run."
