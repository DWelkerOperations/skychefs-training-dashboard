# SkyChefs Training Progression Dashboard

A static, GitHub Pages-ready dashboard built from the structure of:

- `Progression Template.xlsb`
- `Template Trainee Tracker.xlsx`

The site has an overall visual dashboard, a trainee input table, a protected calculation model, CSV/JSON import and export, and a documented publishing workflow. No build step or external JavaScript package is required.

## Run locally

From this directory:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. A web server is required because browsers block `fetch()` of `data/trainees.json` from a `file://` URL.

## Publish with GitHub Pages

1. Create a private GitHub repository when the roster contains employee data.
2. Commit the contents of this directory to the repository's default branch.
3. In **Settings → Pages**, choose **Deploy from a branch**.
4. Select the default branch and `/ (root)`, then save.
5. Use the generated Pages URL after deployment finishes.

GitHub Pages availability and privacy controls depend on the organization's GitHub plan and policies. Confirm that the Pages site is not publicly accessible before adding real employee data.

## Data workflow

The bundled `data/trainees.json` contains clearly labeled example records only.

- Edits made in **Trainee input** are stored in the current browser's `localStorage`.
- **Export JSON** produces a replacement for `data/trainees.json`.
- Commit that replacement file to publish one shared, read-only roster.
- **Import CSV / JSON** accepts the tracker headers from the source Excel template. Save the tracker as CSV before importing it.
- Calculated fields are omitted from JSON and rebuilt in the browser. They cannot be overwritten through the input form.

GitHub Pages is a static host. It does not provide authenticated, simultaneous multi-user data entry. A real shared input workflow requires an approved backend or data source. Do not put live employee data in a public repository.

## Protected calculations

The editable input fields provide facts. The application calculates:

- Probation end = hire / transfer date + 90 calendar days.
- Safety class end = safety class start + 4 calendar days.
- Projected certification uses this priority:
  1. Actual certification date.
  2. Assigned OJT date + 21 calendar days.
  3. Safety class start + 35 calendar days.
  4. Hire / transfer date + 35 calendar days.
- Progress = 20% per completed weekly milestone, with the selected training stage used as a minimum indicator.
- Readiness = Certified, Inactive, Delayed, Blocked, At risk, or On track based on dates, milestones, and prerequisites.

The rules are centralized in `PROJECTION_RULES` near the top of `app.js`. Change them only after the training owner approves the business logic.

## Source assumptions

- The trainee tracker is an empty template; it does not contain a current people roster.
- Its five weekly columns define the training path used by the web application.
- The Progression Template baseline dated February 25, 2026 contains goals of 227 CDL drivers, 72 non-CDL drivers, and 240 helpers, with 138, 39, and 160 shown as “have.” Those baseline figures are labeled and kept separate from live trainee KPIs.
- The source workbooks are not copied into this repository.

## Files

- `index.html` — page structure and accessible forms.
- `styles.css` — responsive presentation using the approved SkyChefs logo color and neutral UI colors.
- `app.js` — calculations, rendering, filters, imports, exports, and local persistence.
- `data/trainees.json` — published roster source.
- `assets/skychefs-logo-approved.svg` — unmodified approved SkyChefs logo.
- `dashboard-goal.md` — reusable implementation goal prompt.
