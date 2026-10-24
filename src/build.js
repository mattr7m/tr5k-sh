// Builds the public and private sites from the vault.
//
// The two sites are separate passes over separately filtered note sets, each
// written to its own output directory (in the cluster, its own volume): the
// public pass never sees a private-only note, and the public web container
// never mounts the private output.
//
// Output swaps atomically: a pass writes releases/<id>/ then repoints the
// `current` symlink. A failed build leaves the previous release serving.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lint } from 'markdownlint/sync';
import { SITES } from './contract.js';
import { collect, BuildError } from './collect.js';
import { createRenderer } from './markdown.js';
import { layout, tagsBar, articleList, postCard, plainCard } from './render.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const LINT_CONFIG = { default: true, MD013: false, MD033: false, MD041: false, MD025: false };

// CONTENT_ROOT overrides the config's contentRoot, so the vault folder name
// is a deployment setting (e.g. "tr5k.sh") rather than baked into the image.
export function loadConfig(configPath = path.join(REPO, 'site.config.json'), env = process.env) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (env.CONTENT_ROOT) config.contentRoot = env.CONTENT_ROOT;
  return config;
}

function renderSite(site, collected, config) {
  const notes = collected.perSite[site];
  const files = new Map(); // relative path → string | { copyFrom }
  const siteWarnings = [];
  const sections = config.nav.filter((n) => !n.page);
  const sectionsBySlug = new Map(sections.map((s) => [s.slug, s]));
  const pageNav = config.nav.filter((n) => n.page);
  const usedAssets = new Set();
  const ctx = {
    notesByName: new Map(notes.map((n) => [n.basename.toLowerCase(), n])),
    assets: collected.assets,
    usedAssets,
    warn: () => {},
  };
  const render = createRenderer(ctx);
  const page = (rel, args) => files.set(rel, layout({ config, site, ...args }));

  // Posts (pages that are nav entries are rendered at their nav slug instead).
  const pageSlugs = new Set(pageNav.map((p) => p.page));
  for (const n of notes) {
    ctx.warn = (m) => siteWarnings.push({ scope: 'note', rel: n.rel, message: m });
    const html = render(n.body);
    if (pageSlugs.has(n.slug)) continue;
    const section = sectionsBySlug.get(n.categories[0]);
    page(`posts/${n.slug}/index.html`, { section, title: n.title, body: postCard(n, html, sectionsBySlug) });
  }

  // Static nav pages (About): a published note with the configured slug.
  for (const p of pageNav) {
    const n = notes.find((x) => x.slug === p.page);
    ctx.warn = (m) => siteWarnings.push({ scope: 'note', rel: n?.rel, message: m });
    const body = n ? plainCard(n.title, render(n.body)) : plainCard(p.title, '<p>Nothing here yet.</p>');
    page(`${p.slug}/index.html`, { section: p, title: p.title, body });
  }

  // Category and category+tag indexes.
  const listable = notes.filter((n) => !pageSlugs.has(n.slug));
  for (const s of sections) {
    const inCat = listable.filter((n) => n.categories.includes(s.slug));
    const counts = new Map();
    inCat.forEach((n) => n.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    const tags = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
    page(`${s.slug}/index.html`, {
      section: s, title: s.title,
      body: [tagsBar(s, tags, null), articleList(`All in ${s.title}`, inCat)].join('\n'),
    });
    for (const t of tags) {
      page(`${s.slug}/${t}/index.html`, {
        section: s, tag: t, title: `${s.title} / ${t}`,
        body: [tagsBar(s, tags, t), articleList(`${s.title} / ${t}`, inCat.filter((n) => n.tags.includes(t)))].join('\n'),
      });
    }
  }

  page('index.html', { title: null, body: articleList('Latest', listable.slice(0, config.homeLimit || 20)) });
  page('404.html', { title: 'Not found', body: plainCard('Not found', '<p>Nothing at this path. Try the <a href="/">latest posts</a>.</p>') });

  files.set('assets/site.css', { copyFrom: path.join(REPO, 'assets', 'site.css') });
  for (const f of usedAssets) files.set(`assets/${path.basename(f)}`, { copyFrom: f });

  // Report-only markdownlint over this site's notes.
  const lintResults = lint({ strings: Object.fromEntries(notes.map((n) => [n.rel, n.body])), config: LINT_CONFIG });
  for (const [rel, issues] of Object.entries(lintResults)) {
    for (const i of issues) siteWarnings.push({ scope: 'lint', rel, message: `line ${i.lineNumber}: ${i.ruleNames[0]} ${i.ruleDescription}` });
  }
  return { files, warnings: siteWarnings, count: notes.length };
}

// The status page lives only on the private site: it lists drift folders and
// note paths from both sites, none of which may appear publicly.
function statusPage(config, results, collected, builtAt) {
  const rows = [];
  const add = (label, list) => list.forEach((w) => rows.push(`<li>[${label}] ${w.rel ? `${w.rel}: ` : ''}${String(w.message).replace(/</g, '&lt;')}</li>`));
  add('vault', collected.warnings);
  for (const site of SITES) add(site, results[site].warnings);
  const body = plainCard('Build status', `<p>Built ${builtAt.toISOString()} · public ${results.public.count} notes · private ${results.private.count} notes · ${rows.length} warnings</p>
<ul class="article-list status-list">
${rows.join('\n') || '<li class="empty">no warnings</li>'}
</ul>`);
  return layout({ config, site: 'private', section: null, title: 'Build status', body });
}

function writeRelease(outDir, files) {
  const id = `${Date.now()}`;
  const rel = path.join('releases', id);
  const target = path.join(outDir, rel);
  for (const [p, content] of files) {
    const dest = path.join(target, p);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (typeof content === 'string') fs.writeFileSync(dest, content);
    else fs.copyFileSync(content.copyFrom, dest);
  }
  const tmp = path.join(outDir, `.current-${id}`);
  fs.symlinkSync(rel, tmp);
  fs.renameSync(tmp, path.join(outDir, 'current')); // atomic repoint
  const releases = fs.readdirSync(path.join(outDir, 'releases')).sort();
  for (const old of releases.slice(0, -2)) fs.rmSync(path.join(outDir, 'releases', old), { recursive: true, force: true });
  return target;
}

export function buildAll({ vaultDir, publicOut, privateOut, config = loadConfig() }) {
  const collected = collect(vaultDir, config); // throws BuildError on slug collision
  const builtAt = new Date();
  const results = {};
  for (const site of SITES) results[site] = renderSite(site, collected, config);
  results.private.files.set('_status/index.html', statusPage(config, results, collected, builtAt));
  const out = {
    public: writeRelease(publicOut, results.public.files),
    private: writeRelease(privateOut, results.private.files),
  };
  return { out, results, collected };
}

export { BuildError };

// CLI: node src/build.js <vaultDir> <publicOut> <privateOut>
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [vaultDir = process.env.VAULT_DIR, publicOut = process.env.PUBLIC_OUT, privateOut = process.env.PRIVATE_OUT] = process.argv.slice(2);
  if (!vaultDir || !publicOut || !privateOut) {
    console.error('usage: node src/build.js <vaultDir> <publicOut> <privateOut>  (or VAULT_DIR/PUBLIC_OUT/PRIVATE_OUT)');
    process.exit(2);
  }
  try {
    const { results } = buildAll({ vaultDir, publicOut, privateOut });
    console.log(`built: public ${results.public.count} notes, private ${results.private.count} notes`);
  } catch (err) {
    console.error(err instanceof BuildError ? `build failed: ${err.message}` : err);
    process.exit(1);
  }
}
