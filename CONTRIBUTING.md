# Contributing

Thanks for taking the time to contribute. This document covers how to propose a
change and what it has to look like before it can be merged.

By participating, you agree to abide by the
[Code of Conduct](CODE_OF_CONDUCT.md).

---

## Before you start

- For a **bug**, open an issue first with the page, the browser, the viewport
  width and the theme combination it happens in. Those four things reproduce
  almost everything in this project.
- For a **feature**, open an issue before writing code so we can agree on the
  approach. A rejected pull request is a waste of your evening.
- For a **typo or one-line fix**, skip the issue and open the pull request.

---

## Workflow

1. Fork the repository and create a branch off `main`:

   ```bash
   git checkout -b feat/theme-export
   ```

   Branch names use the same prefixes as commits: `feat/`, `fix/`, `docs/`,
   `refactor/`, `chore/`.

2. Make your change.

3. If you touched anything under `tools/`, regenerate and verify:

   ```bash
   python3 tools/gen_themes.py    # if you changed a palette
   python3 tools/build.py         # regenerate the pages
   python3 tools/smoke.py         # errors, 404s, horizontal overflow
   python3 tools/a11y.py          # WCAG 2.1 AA
   ```

   Generated HTML is committed, so the regenerated pages belong in the same
   commit as the source change that caused them.

4. Push and open a pull request describing **what** changed and **why**.

---

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/).
Every commit message follows:

```
type(scope): subject
```

### Rules

- `type` and `scope` are lower case.
- `subject` is imperative mood, lower case, **no trailing period** — write
  `add neon focus ring`, not `Added neon focus ring.`
- Keep the whole first line under 72 characters.
- Scope is optional but preferred. Omit it only when a change genuinely spans
  the whole project: `chore: bump bootstrap to 5.3.4`.

### Types

| Type | Use it for |
|---|---|
| `feat` | A new page, component, theme or capability |
| `fix` | A bug in existing behaviour |
| `docs` | README, this file, code comments only |
| `style` | Formatting with no behaviour change — whitespace, ordering |
| `refactor` | Restructuring that neither fixes a bug nor adds a feature |
| `perf` | A measurable performance improvement |
| `test` | The harnesses under `tools/` |
| `build` | Vendored dependencies, the page generator |
| `chore` | Housekeeping that fits nothing above |

### Scopes

Use the area of the project you touched:

`theme`, `neon`, `layout`, `responsive`, `a11y`, `charts`, `tables`, `forms`,
`sidebar`, `navbar`, `customizer`, `palette`, `dashboards`, `apps`, `auth`,
`tokens`, `build`, `deps`

### Examples

```
feat(theme): add slate palette
fix(tables): ellipsize conversation preview instead of clipping
fix(a11y): raise --text-subtle to clear AA on tinted surfaces
docs(readme): add live demo link
refactor(charts): move series colours into the theme registry
perf(neon): disable particle canvas below 768px
build(deps): vendor chart.js 4.4.1
```

### Breaking changes

Append `!` after the scope and explain the break in the body:

```
feat(tokens)!: rename --surface-alt to --surface-2

Any custom CSS referencing --surface-alt must be updated.
```

---

## Code style

- **No inline styles and no inline event handlers.** Use a class and
  `addEventListener`.
- **Colour comes from tokens.** Never write a literal hex in `style.css` — if a
  colour is missing, add the token. A hard-coded colour breaks 39 of the 40
  combinations.
- **Use logical properties** (`margin-inline-start`, not `margin-left`) so RTL
  keeps working without a second stylesheet.
- **Do not edit files under `pages/` directly.** They are generated. Edit
  `tools/pages_*.py` and rebuild, or your change will be overwritten.
- Every interactive element needs an accessible name, and every status needs a
  second signal besides colour.

---

## What gets a change rejected

- It fails `a11y.py`.
- It introduces horizontal overflow at 320px.
- It works in one theme and was never checked in the other 39.
- It edits generated HTML instead of the generator.