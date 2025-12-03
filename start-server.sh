#!/bin/bash
# Kill any process using port 3000 before starting
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# Start the server
exec npm start

