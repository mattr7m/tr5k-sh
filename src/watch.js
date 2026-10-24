// Long-running builder: initial build, then rebuild DEBOUNCE_MS after the last
// vault change, plus a periodic full rebuild as a safety net (sync can land
// files in bursts, and fs events are best-effort on network filesystems).
// A failed build is logged and the previous release keeps serving.

import fs from 'node:fs';
import { buildAll, loadConfig, BuildError } from './build.js';

const vaultDir = process.env.VAULT_DIR || '/vault';
const publicOut = process.env.PUBLIC_OUT || '/out/public';
const privateOut = process.env.PRIVATE_OUT || '/out/private';
const DEBOUNCE_MS = Number(process.env.DEBOUNCE_MS || 3000);
const PERIODIC_MS = Number(process.env.PERIODIC_MS || 10 * 60 * 1000);

const log = (...a) => console.log(new Date().toISOString(), ...a);
let timer = null;
let building = false;
let pending = false;

function build(reason) {
  if (building) { pending = true; return; }
  building = true;
  try {
    const { results, collected } = buildAll({ vaultDir, publicOut, privateOut, config: loadConfig() });
    const warns = collected.warnings.length + results.public.warnings.length + results.private.warnings.length;
    log(`build ok (${reason}): public ${results.public.count}, private ${results.private.count}, ${warns} warnings`);
  } catch (err) {
    log(`build FAILED (${reason}) — previous release still serving:`, err instanceof BuildError ? err.message : err);
  } finally {
    building = false;
    if (pending) { pending = false; schedule('queued change'); }
  }
}

function schedule(reason) {
  clearTimeout(timer);
  timer = setTimeout(() => build(reason), DEBOUNCE_MS);
}

fs.mkdirSync(publicOut, { recursive: true });
fs.mkdirSync(privateOut, { recursive: true });
build('startup');
try {
  fs.watch(vaultDir, { recursive: true }, (_event, file) => {
    if (file && String(file).split(/[\\/]/).some((p) => p.startsWith('.'))) return; // .obsidian etc.
    schedule(`change: ${file}`);
  });
  log(`watching ${vaultDir}`);
} catch (err) {
  log(`fs.watch unavailable (${err.message}); relying on periodic rebuilds`);
}
setInterval(() => build('periodic'), PERIODIC_MS);
