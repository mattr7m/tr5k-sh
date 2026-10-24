// Reads the synced vault and produces the note set each site may use.
//
// Only `<vault>/<contentRoot>/` is ever read. Anything else that syncs (a new
// top-level folder, notes at the vault root) is reported as drift and never
// opened — defence in depth behind obsidian-headless's exclude list.

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import {
  SITES, normalizePublish, toSlugList, noteDate, noteTitle, noteSlug, compareNotes,
} from './contract.js';

export class BuildError extends Error {}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue; // .obsidian, .trash, dotfiles
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export function collect(vaultDir, config) {
  const warnings = [];
  const root = path.join(vaultDir, config.contentRoot);
  const categories = new Set(config.nav.filter((n) => !n.page).map((n) => n.slug));

  // Drift: top-level vault entries other than the content root.
  if (fs.existsSync(vaultDir)) {
    for (const e of fs.readdirSync(vaultDir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === config.contentRoot) continue;
      warnings.push({ scope: 'drift', message: `"${e.name}" synced outside ${config.contentRoot}/ — add it to the sync exclude list (never read)` });
    }
  }
  if (!fs.existsSync(root)) {
    warnings.push({ scope: 'drift', message: `content root ${config.contentRoot}/ not found in the vault` });
    return { notes: [], assets: new Map(), warnings, perSite: emptyPerSite() };
  }

  const files = walk(root);
  const assets = new Map(); // basename (lowercase) → absolute path
  for (const f of files.filter((x) => !x.endsWith('.md'))) {
    const key = path.basename(f).toLowerCase();
    if (assets.has(key)) warnings.push({ scope: 'all', message: `duplicate attachment name "${path.basename(f)}" — embeds resolve to the first found` });
    else assets.set(key, f);
  }

  const notes = [];
  for (const file of files.filter((x) => x.endsWith('.md'))) {
    const rel = path.relative(root, file);
    const basename = path.basename(file, '.md');
    let parsed;
    try {
      parsed = matter(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      warnings.push({ scope: 'all', message: `${rel}: unreadable frontmatter (${err.message}) — skipped` });
      continue;
    }
    const fm = parsed.data || {};
    const noteWarn = (m) => warnings.push({ scope: 'note', rel, message: m });
    const publish = normalizePublish(fm['tr5k-sh-publish'], noteWarn);
    if (publish.size === 0) continue; // default deny

    const declared = toSlugList(fm['tr5k-sh-category']);
    const unknown = declared.filter((c) => !categories.has(c));
    unknown.forEach((c) => noteWarn(`unknown category "${c}" (not in nav config) — not listed under it`));
    const date = noteDate(fm);
    if (!date) noteWarn('no tr5k-sh-date (or created) — sorted last');

    notes.push({
      file, rel, basename,
      dir: path.dirname(file),
      title: noteTitle(fm, basename),
      slug: noteSlug(fm, basename),
      date,
      categories: declared.filter((c) => categories.has(c)),
      tags: toSlugList(fm['tr5k-sh-tag']),
      publish,
      body: parsed.content,
    });
  }

  // One canonical URL per post: a slug collision is a hard error, because
  // silently picking one would overwrite the other's page.
  const bySlug = new Map();
  for (const n of notes) {
    if (bySlug.has(n.slug)) {
      throw new BuildError(`slug collision "${n.slug}": ${bySlug.get(n.slug).rel} and ${n.rel} — set tr5k-sh-slug on one`);
    }
    bySlug.set(n.slug, n);
  }

  notes.sort(compareNotes);
  const perSite = emptyPerSite();
  for (const site of SITES) perSite[site] = notes.filter((n) => n.publish.has(site));
  return { notes, assets, warnings, perSite };
}

function emptyPerSite() {
  return Object.fromEntries(SITES.map((s) => [s, []]));
}
