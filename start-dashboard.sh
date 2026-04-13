#!/bin/bash

# Load node/npm — try nvm first, then common brew/system paths
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

PROJECT_DIR="/Users/thezivieamora/Cowork/AIA Agency Dashboard/davao-amora-dashboard"

# Kill any existing server on port 5173
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 0.5

# Start the dev server in background
cd "$PROJECT_DIR"
npm run dev >> /tmp/davao-dashboard.log 2>&1 &

# Wait for server to respond (up to 30 seconds), then open browser
for i in $(seq 1 30); do
  sleep 1
  if curl -sf http://localhost:5173 > /dev/null 2>&1; then
    open "http://localhost:5173"
    exit 0
  fi
done

# Fallback: open anyway after timeout
open "http://localhost:5173"
