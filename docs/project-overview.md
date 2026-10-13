# Development Guide

Read this first. It explains what we built, how the code works, how we work as a team, and how to run and deploy the project.

---

## 1. What we are building

A website that loads a CSV file and plots two numeric columns as a **scatter plot** or a **line graph**.

- Runs fully in the browser (client-side). The CSV is never uploaded anywhere.
- Fast on big datasets because it draws on a canvas, not thousands of SVG elements.
- Static site, deployed for free on Vercel.

## 2. Tech stack

| Item | Used | Why |
|------|------|-----|
| Language | HTML, CSS, vanilla JavaScript | Simple, no setup, everyone can read it |
| Charts | Canvas 2D API (built into browsers) | Fast for many points; SVG slows down with thousands of elements |
| CSV parsing | Our own `parser.js` | No library needed, easy to unit test |
| File reading | `FileReader` browser API | Reads the file locally |
| Libraries | None | No `npm install`, no build step |
| Hosting | Vercel (static) | Free, auto-deploys from GitHub |
| Version control | Git + GitHub | Branches, PRs, Issues, Projects board |
| Communication | Slack | Standups, huddles, survey |

## 3. Repo structure

```
project-name/
├── README.md
├── CONTRIBUTING.md
├── .gitignore
├── docs/
│   ├── DEVELOPMENT_GUIDE.md   (this file)
│   ├── requirements.md
│   ├── design.md
│   ├── progress-log.md
│   └── meeting-notes/
├── src/
│   ├── index.html
│   ├── style.css
│   ├── parser.js
│   └── app.js
└── .github/
    └── pull_request_template.md
```

## 4. Run it locally

**Quickest:** open `src/index.html` by double-clicking it. The sample data loads automatically.

**Local server (closer to production):**
```
cd src
python -m http.server 8000
```
Then open `http://localhost:8000`. (Or use the VS Code "Live Server" extension, or `npx serve src`.)

**Manual test checklist**
1. Sample data shows a scatter plot, with no red error text.
2. Switching Chart to Line draws a line; switching back draws points.
3. Changing the X and Y dropdowns redraws with new axis labels.
4. A title typed in the box appears above the chart.
5. Upload a real CSV and check the dropdowns list its numeric columns.
6. Download PNG saves an image with a white background.
7. Resizing the window redraws the chart.
8. A CSV with only one numeric column shows "Need at least two numeric columns."

**Troubleshooting:** open the browser console (F12). `parseCSV is not defined` means `parser.js` isn't loading before `app.js`. A blank page usually means a filename typo.

## 5. How the code works

**Data flow**
```
CSV file -> FileReader (text) -> parseCSV() -> rows of strings
-> load() finds numeric columns, fills dropdowns
-> draw() converts values to pixels and paints the chart
```

### `index.html`
The page skeleton: file input, sample button, X/Y/chart-type dropdowns, title box, download button, the `<canvas>`, and two text lines (`#status`, `#err`). It loads `parser.js` first, then `app.js` (order matters).

### `style.css`
Fonts, colors, flexbox layout for the controls, and a canvas that fills the page width at 460px height.

### `parser.js`
One function: `parseCSV(text)`. It reads the text character by character and tracks whether it is inside quotes (a small state machine).
- A comma outside quotes ends a field.
- A newline outside quotes ends a row (handles `\n` and `\r\n`).
- Inside quotes, commas and newlines stay in the value, and `""` becomes one quote.
- Removes the invisible BOM that Excel can add.
- Skips empty lines.

A simple `split(',')` would break on values like `"Smith, John"`, which is why we wrote a real parser.

### `app.js`
| Function | Job |
|----------|-----|
| `load(text, name)` | Parses the CSV, takes the first row as headers, finds numeric columns (a column is numeric if at least 80% of its first 500 non-empty values convert with `Number()`), fills the dropdowns, calls `draw()` |
| `niceTicks(min, max)` | Picks clean axis numbers (0, 5, 10) instead of awkward ones (3.7, 7.4) |
| `fmt(v)` | Shortens numbers to 5 significant digits for labels |
| `draw()` | The core: collects valid points, sets up the canvas, maps data to pixels, draws grid, labels, and the data |

**Key idea in `draw()`: mapping data to pixels**
```
pixelX = left + (x - xMin) / (xMax - xMin) * plotWidth
pixelY = top + plotHeight - (y - yMin) / (yMax - yMin) * plotHeight
```
Y is flipped because canvas Y grows downward but graph Y grows upward.

**Other details in `draw()`**
- Line charts sort points by X so the line goes left to right.
- The canvas is scaled by `devicePixelRatio` so it stays sharp on retina screens.
- For more than 1,000 points, scatter circles become semi-transparent; above 5,000 they get smaller.
- The status line shows rows loaded and points plotted.

**Event handlers** (bottom of `app.js`): file input uses `FileReader`; "Use sample data" generates a 200-row sine wave plus noise; dropdowns and the title box call `draw()`; window resize redraws; Download PNG copies the canvas onto a white background and saves it; the last line loads sample data on start.

## 6. Design decisions (and why)

1. **Client-side only:** no upload delay, no server, and user data stays private.
2. **Canvas over SVG:** better performance with large datasets. Tradeoff: no per-point hover without extra code.
3. **No libraries:** we can explain every line, and there is nothing to install.
4. **Parser in its own file:** it takes text in and returns rows out, so it can be unit tested without a browser.
5. **Plain `<script>` tags (not modules):** the page works by double-clicking, with no server.

## 7. How we work as a team

### Roles
- **Scrum Master** (rotates each sprint): runs meetings, keeps the board updated, removes blockers.
- **Product Owner:** decides backlog priority (the professor's requirements guide this).
- **Developers:** frontend, parsing/data, QA, and documentation owners.

### Scrum events (weekly rhythm)
| Day | Activity |
|-----|----------|
| Mon | Sprint planning: pick issues, assign owners, write a one-sentence sprint goal |
| Mon-Thu | Daily standup in Slack (yesterday / today / blockers), build, review PRs |
| Fri | Sprint review (demo), then retrospective (what went well / didn't / what to change) |
| Fri | Update `docs/progress-log.md` and tag a release (`v0.1`, `v0.2`, ...) |

### Artifacts
- **Product backlog:** GitHub Issues not yet scheduled
- **Sprint backlog:** issues on the current sprint board
- **Increment:** the working site at the end of each sprint

### Requirements and traceability
Requirements live in `docs/requirements.md`. Each functional requirement becomes a GitHub Issue with acceptance criteria. Every PR links its issue (`Closes #12`), so each requirement traces to the code that implements it.

## 8. Git workflow

1. Never commit directly to `main` (it is protected; PRs need 1 approval).
2. Create a branch from an up-to-date `main`:
   ```
   git checkout main
   git pull
   git checkout -b feature/short-name
   ```
   Prefixes: `feature/`, `fix/`, `docs/`, `chore/`.
3. Commit small and often with clear prefixes: `feat:`, `fix:`, `docs:`, `test:`, `chore:`
   ```
   git add <files>
   git commit -m "feat: add line graph option"
   git push -u origin feature/short-name
   ```
4. Open a PR, fill in the template, link the issue, and request a review.
5. A teammate reviews (Files changed > Review changes > Approve) and merges. Rotate reviewers.

**Definition of Done:** code works and is reviewed, tests pass, docs updated.

## 9. `.gitignore` and `.DS_Store`

`.DS_Store` is a hidden macOS file that stores Finder folder settings. It is not part of the project, so we ignore it. `.gitignore` sits in the repo root and tells Git which files to never track (OS files, editor folders, `node_modules/`, `.env`, `.vercel/`).

If a file is already tracked, ignoring it is not enough. Remove it from Git first:
```
git rm --cached -r --ignore-unmatch .DS_Store
```
Never commit passwords or API keys (`.env` is ignored for this reason).

> Do **not** list this guide in `.gitignore`. If you do, Git will skip it and the team will never receive it. Commit it normally.

## 10. Deploy on Vercel

1. Go to vercel.com and sign up with **Continue with GitHub**.
2. Click **Add New > Project** and import the repo (grant access if it is private).
3. **Framework Preset:** Other.
4. **Root Directory:** click Edit and select `src` (this is where `index.html` lives).
5. Leave Build Command and Output Directory empty (no build step).
6. Click **Deploy**. You get a link like `graph-plotter.vercel.app`.
7. Every merge to `main` redeploys automatically. Put the link in the README and Slack.

Alternative: GitHub Pages (Settings > Pages), but it cannot serve from `/src`, so files must move to the root or `/docs`.

## 11. Known limitations (our backlog)

- Only numeric columns can be plotted (no date axes yet)
- No hover tooltip
- Very large files: `Math.min(...array)` can fail on huge arrays, and line charts are not downsampled
- Comma-separated files only (no semicolons or tabs)
- No automated tests yet (`parser.js` is the best first candidate)

Each of these should become a GitHub Issue for a later sprint.

## 12. Glossary

- **Client-side rendering:** processing and drawing happen in the user's browser.
- **State machine:** the technique our CSV parser uses, switching behavior based on whether it is inside quotes.
- **Canvas:** a browser surface you draw on with JavaScript, pixel by pixel.
- **PR (pull request):** a request to merge a branch, reviewed by a teammate.
- **Sprint:** a one-week work cycle.
- **Traceability:** linking each requirement to the issue, PR, and code that implements it.
- **Static site:** only files, no backend; the host just serves them.
