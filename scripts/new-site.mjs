#!/usr/bin/env node
// Scaffold sites/<slug> from template/ and copy the lead's downloaded assets into it.
//   node scripts/new-site.mjs <slug>
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const slug = process.argv[2];
if (!slug) { console.error('usage: new-site.mjs <slug>'); process.exit(1); }
const dest = path.join('sites', slug);
if (fs.existsSync(dest)) { console.log(JSON.stringify({ site: dest, created: false })); process.exit(0); }

fs.cpSync('template', dest, { recursive: true, verbatimSymlinks: true, filter: (s) => !['dist', '.astro', '.vercel'].includes(path.relative('template', s)) });
const assets = path.join('runs', slug, 'assets');
if (fs.existsSync(assets)) fs.cpSync(assets, path.join(dest, 'public', 'assets'), { recursive: true });
if (!fs.existsSync(path.join(dest, 'node_modules'))) execSync('npm install --prefer-offline --no-audit --no-fund', { cwd: dest, stdio: 'ignore' });

console.log(JSON.stringify({ site: dest, created: true, assets: fs.readdirSync(path.join(dest, 'public', 'assets')) }));
