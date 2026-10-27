// Page templates. Markup and class names come straight from the mock's v3
// design (site/index.html) so its stylesheet applies unchanged; the mock's
// JS section-switching is replaced by real per-route static pages.

import { formatDate } from './contract.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FONTS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;1,8..60,400&display=swap';

function breadcrumb(section, tag) {
  const parts = ['<span class="prompt">$</span>', '<a href="/" class="path-segment path-home">~</a>'];
  if (section) {
    parts.push('<span class="separator">/</span>', `<a href="/${esc(section.slug)}/" class="path-section">${esc(section.title)}</a>`);
    if (tag) parts.push('<span class="separator path-sub-sep">/</span>', `<span class="path-sub">${esc(tag)}</span>`);
  }
  parts.push('<span class="caret"></span>');
  return parts.join('\n        ');
}

export function layout({ config, site, section, tag, title, body }) {
  const nav = config.nav.map((n) =>
    `<a href="/${esc(n.slug)}/"${section?.slug === n.slug ? ' class="active"' : ''}>${esc(n.title)}</a>`).join('\n      ');
  const badge = site === 'private' ? '<span class="private-badge">private</span>' : '';
  const pageTitle = title ? `${esc(title)} · ${esc(config.siteTitle)}` : esc(config.siteTitle);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${site === 'private' ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<title>${pageTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="${FONTS}" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<nav class="topbar">
  <div class="topbar-inner">
    <div class="topbar-left">
      <a href="/" class="site-title">tr5k<span class="dot">.</span><span class="tld">sh</span></a>${badge}
      <div class="terminal-nav">
        ${breadcrumb(section, tag)}
      </div>
    </div>
    <div class="section-nav">
      ${nav}
    </div>
  </div>
</nav>
<main class="main-layout">
  <div class="section-content visible">
${body}
  </div>
</main>
<footer class="site-footer">
  <div class="footer-inner">
    <span>&copy; ${new Date().getUTCFullYear()} ${esc(config.author)}</span>
    <span><a href="${esc(config.github)}">github</a></span>
  </div>
</footer>
</body>
</html>
`;
}

export function tagsBar(section, tags, activeTag) {
  if (!tags.length) return '';
  const chip = (href, label, active) => `<a class="tag-chip${active ? ' active' : ''}" href="${href}">${esc(label)}</a>`;
  return `    <div class="tags-bar">
      ${chip(`/${section.slug}/`, 'all', !activeTag)}
      ${tags.map((t) => chip(`/${section.slug}/${t}/`, t, t === activeTag)).join('\n      ')}
    </div>`;
}

export function articleList(label, notes) {
  const items = notes.length
    ? notes.map((n) => `        <li><a href="/posts/${n.slug}/"><span class="article-title">${esc(n.title)}</span><span class="article-date">${formatDate(n.date)}</span></a></li>`).join('\n')
    : '        <li class="empty">nothing here yet</li>';
  return `    <div style="margin-top: 28px;">
      <span class="section-label">${esc(label)}</span>
      <ul class="article-list">
${items}
      </ul>
    </div>`;
}

export function postCard(note, html, sectionsBySlug) {
  const primary = note.categories[0];
  const meta = [`<span>${formatDate(note.date)}</span>`];
  for (const c of note.categories) {
    meta.push(`<a class="tag" href="/${c}/">${esc(sectionsBySlug.get(c)?.title || c)}</a>`);
  }
  for (const t of note.tags) {
    meta.push(primary ? `<a class="tag" href="/${primary}/${t}/">${esc(t)}</a>` : `<span class="tag">${esc(t)}</span>`);
  }
  const extra = (note.cssClasses || []).map((c) => ` ${c}`).join(''); // Obsidian cssclasses, slugified
  return `    <article class="content page-card paper-ruled${extra}">
      <h1>${esc(note.title)}</h1>
      <div class="post-meta">
        ${meta.join('\n        ')}
      </div>
${html}
    </article>`;
}

export function plainCard(title, html) {
  return `    <article class="content page-card paper-ruled">
      <h1>${esc(title)}</h1>
${html}
    </article>`;
}
