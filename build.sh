#!/bin/bash

# Exit on error
set -e

echo "Installing dependencies..."
npm install

echo "Building TypeScript code..."
npm run build

echo "Build completed successfully!"
echo "To run the server, use: npm start"