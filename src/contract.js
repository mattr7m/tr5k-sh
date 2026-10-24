// The frontmatter routing contract (authoritative spec:
// kube-open-code-agent/tasks/tr5k-sh-stack.md). Pure functions only, so the
// rules are unit-testable without touching the filesystem.

export const SITES = ['public', 'private'];

export function slugify(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// tr5k-sh-publish → Set of sites. Default deny: missing, empty, or unknown
// values publish nowhere. `all` is shorthand for every site.
export function normalizePublish(value, warn = () => {}) {
  const out = new Set();
  const visit = (v) => {
    if (v === null || v === undefined || v === '') return;
    if (Array.isArray(v)) return v.forEach(visit);
    const s = String(v).trim().toLowerCase();
    if (s === '') return;
    if (s === 'all') SITES.forEach((x) => out.add(x));
    else if (SITES.includes(s)) out.add(s);
    else warn(`unknown tr5k-sh-publish value "${v}" (ignored)`);
  };
  visit(value);
  return out;
}

// A property may arrive as a YAML list or, if typed as text in Obsidian, a
// comma-separated string. Either way: a deduped list of slugs.
export function toSlugList(value) {
  if (value === null || value === undefined) return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(raw.map(slugify).filter(Boolean))];
}

// Sort key. Never mtime (sync re-touches files) and no birthtime (unsupported
// on Linux by obsidian-headless). Missing → null → sorted last + flagged.
export function noteDate(fm) {
  for (const key of ['tr5k-sh-date', 'created']) {
    const v = fm?.[key];
    if (v === null || v === undefined || v === '') continue;
    const d = v instanceof Date ? v : new Date(String(v));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function noteTitle(fm, basename) {
  const t = fm?.['tr5k-sh-title'];
  return t ? String(t) : basename;
}

export function noteSlug(fm, basename) {
  const s = fm?.['tr5k-sh-slug'];
  return slugify(s ? s : basename);
}

// Newest first; undated last; ties broken by title for stable output.
export function compareNotes(a, b) {
  if (a.date && b.date && a.date.getTime() !== b.date.getTime()) return b.date - a.date;
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  return a.title.localeCompare(b.title);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The mock's date style ("Nov 04, 2025"), in UTC so YAML dates don't shift.
export function formatDate(d) {
  if (!d) return 'undated';
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}, ${d.getUTCFullYear()}`;
}
