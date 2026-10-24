# tr5k.sh

Builder and templates for **tr5k.sh**, a notebook-style personal site generated straight from an
Obsidian vault. Deployment lives in the private `tr5k-sh-ops` repo; coordination in
[`kube-open-code-agent/tasks/tr5k-sh-stack.md`](https://github.com/mattr7m/kube-open-code-agent/blob/main/tasks/tr5k-sh-stack.md).

**This repo never contains vault content.** Notes reach the site at runtime via a headless
Obsidian Sync client in the cluster; this repo holds only code, the design, and test fixtures.

## How it works

```
Obsidian Sync ──► vault-sync ──► /vault (only tr5k-sh/ synced)
                  (obsidian-headless,          │  read-only
                   mirror-remote)              ▼
                                           builder ──► public tree  ──► web-public  ──► tr5k-sh.apps…
                                                   └─► private tree ──► web-private ◄── oauth2-proxy ◄── tr5k-sh-private.apps…
                                                                         (localhost)     (pocket-id)
```

- **vault-sync** (`docker/vault-sync/`): `ob sync --continuous` in **`mirror-remote`** mode —
  download-only, and any local change is reverted, so the cluster cannot alter the vault. The
  entrypoint re-applies the sync config on every start and **refuses to run** unless
  `OB_EXCLUDED_FOLDERS` is set.
- **builder** (`src/`): reads only `<vault>/<content root>/` (`contentRoot` in `site.config.json`,
  overridable with the `CONTENT_ROOT` env var — the live vault uses `tr5k.sh`), renders the public and private sites as two
  separate passes, swaps each output atomically, and rebuilds a few seconds after any change. A
  failed build leaves the previous site serving.

## Frontmatter

Nothing is published unless it says so.

```yaml
---
tr5k-sh-publish: public          # public | private | all — or a list. Missing/empty = unpublished.
tr5k-sh-category: [personal]     # must match a nav entry in site.config.json
tr5k-sh-tag: [woodworking]
tr5k-sh-date: 2026-10-24         # sort key, newest first (falls back to `created`)
tr5k-sh-title: "Optional"        # default: filename
tr5k-sh-slug: optional           # default: slugified filename; needed if two notes share a name
---
```

The `tr5k-sh-post` template in `obsidian-templates` stamps this (with publish left empty).

| Rule | Behaviour |
|---|---|
| Sites | public ← `public`/`all`; private ← `private`/`all`. Built from separately filtered note sets. |
| URLs | `/` latest · `/<category>/` all in category · `/<category>/<tag>/` both · `/posts/<slug>/` the post |
| Order | `tr5k-sh-date`, then `created`; undated notes sort last and are flagged. Never file times. |
| Slugs | Two published notes with the same slug **fail the build** (no silent overwrite). |
| Wikilinks | To a note in the same site → link. Otherwise → the text as written (alias if given), no link. |
| Images | `![[img.png]]` and relative `![](…)` are copied into a site only if that site's notes use them. |
| Categories | Unknown names are flagged and not listed (no accidental new nav sections). |
| About | The published note with slug `about` renders at `/about/`. |

Build warnings (drift outside `tr5k-sh/`, undated notes, unknown categories, missing images,
report-only markdownlint) appear at **`/_status/`** on the **private** site only.

## Develop

```bash
npm ci
npm test                                         # contract + build tests, incl. the leak test
node src/build.js test/fixtures/vault out/public out/private
```

`test/build.test.js` builds a fixture vault containing a private-only note, its image, an
unpublished note, and a note outside `tr5k-sh/`, then asserts **none of them leave any trace**
in the public output. Keep that test passing; extend its fixture whenever a new feature could
carry content across the boundary.

## Images

CI publishes `ghcr.io/mattr7m/tr5k-sh-builder` and `ghcr.io/mattr7m/tr5k-sh-vault-sync` on every
merge to `main` (tags `sha-<short>` and `main`); `tr5k-sh-ops` pins them by digest.

## Design

`design/` holds the original mock (v3 `index.html` is the source of `assets/site.css`; v1/v2 are
archived directions) and its README.
