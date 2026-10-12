import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile('build/index.html', 'utf8');
const snapshot = JSON.parse(await readFile('build/api/status.json', 'utf8'));
const base = process.env.BASE_PATH || '';
assert.match(html, /id="status-heading"/);
assert.match(html, /http-equiv="content-security-policy"/i);
const pageUrl = new URL(`${base}/`, 'https://status.example');
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(
  (match) => new URL(match[1], pageUrl).pathname
);
assert(references.includes(`${base}/favicon.svg`));
assert(references.includes(`${base}/preferences.js`));
assert(references.includes(`${base}/api/status.json`));
assert(!html.includes('%lang%'));
assert(!html.includes('%theme%'));
assert(!html.includes('_vercel'));
assert(Array.isArray(snapshot.components));
assert(snapshot.components.every((component) => Array.isArray(component.history)));
console.info(`Static page and status JSON verified for base path "${base}".`);
