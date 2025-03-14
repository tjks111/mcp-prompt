#!/usr/bin/env node

// This is a simple wrapper script that uses the createRequire API
// to load CommonJS modules in an ESM context

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Set up paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Create a require function
const require = createRequire(import.meta.url);

// Load the CommonJS module
require(join(rootDir, 'dist', 'index.js')); 