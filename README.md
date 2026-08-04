# SkyChefs Training Progression Dashboard

[View the live dashboard](https://dwelkeroperations.github.io/skychefs-training-dashboard/)

A static, GitHub Pages-ready dashboard aligned to the operating structure of:

- `Progression Template.xlsb`
- `Template Trainee Tracker.xlsx`
- `ORD Trainee Progression Tracker (2026).xlsx` — active reference, `OJT Pipeline` sheet

The site automatically loads a privacy-safe aggregate snapshot extracted from the active OJT Pipeline. It has an overall visual dashboard, a complete horizontally navigable 43-column trainee tracker, protected calculations, CSV/JSON export, and a documented publishing workflow. No build step or external JavaScript package is required.

## Run locally

From this directory:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. A web server is required because browsers block `fetch()` of the published JSON data from a `file://` URL.

## Publish with GitHub Pages

1. Create a private GitHub repository when the roster contains employee data.
2. Commit the contents of this directory to the repository's default branch.
3. In **Settings → Pages**, choose **Deploy from a branch**.
4. Select the default branch and `/ (root)`, then save.
5. Use the generated Pages URL after deployment finishes.

GitHub Pages availability and privacy controls depend on the organization's GitHub plan and policies. Confirm that the Pages site is not publicly accessible before adding real employee data.

## Data workflow

The page loads `data/current-state-summary.json`, `data/source-snapshot.json`, and `data/trainees.json` automatically. No browser file import is required.

- `data/current-state-summary.json` contains aggregate current-roster, certification, stage, position, status, and eight-week forecast counts extracted from `OJT Pipeline` without names or employee-level rows.
- `data/source-snapshot.json` retains the earlier aggregate staffing and progression reference.
- `data/trainees.json` intentionally remains empty in the public repository.
- The **Trainee Input** tab preserves all 43 operational `OJT Pipeline` columns in workbook order and adds protected readiness and edit controls.
- Edits made in **Trainee input** are stored in the current browser's `localStorage`.
- **Export JSON** and **Export CSV** create files containing employee data. Store them only in an approved private system.
- Calculated fields are omitted from JSON and rebuilt in the browser. They cannot be overwritten through the input form.

GitHub Pages cannot read files from a user's Downloads folder after deployment. To refresh workbook information, regenerate `data/source-snapshot.json` from the approved source files and publish the updated snapshot.

GitHub Pages is a static host. It does not provide authenticated, simultaneous multi-user data entry. A real shared input workflow requires an approved backend or data source. Do not put live employee data in a public repository.

## Protected calculations

The editable input fields provide facts. The application calculates:

- Probation end = hire / transfer date + 60 calendar days.
- Days in training = current date − hire / transfer date.
- Safety class end = hire / transfer date + 3 calendar days, matching the current formula pattern used for later cohorts in the active tracker.
- Projected certification = hire / transfer date + 35 calendar days.
- Certification forecast = assigned OJT date + 21 calendar days; otherwise best-guess SIDA date + 21 days; otherwise the 35-day projected date.
- Days +/- projected certification = projected certification date − actual certification date.
- Progress = 20% per completed weekly milestone, with the selected training stage used as a minimum indicator.
- Readiness = Certified, Inactive, Delayed, Blocked, At risk, or On track based on dates, milestones, and prerequisites.

The rules are centralized in `PROJECTION_RULES` near the top of `app.js`. Change them only after the training owner approves the business logic.

## Source assumptions

- The active workbook contains employee-level records, but those rows are not copied into this public repository.
- The `OJT Pipeline` header row defines the 43 operational fields used by the web application.
- The current workbook contains inconsistent formula coverage and one broken `#REF!` formula. The web application centralizes the recurring rules so routine users cannot edit them.
- The Progression Template snapshot contains driver certification forecasts, TDY counts, position goals, regional staffing totals, and station gaps. Workbook dates remain visible in the dashboard so forecast values are not mistaken for current live headcount.
- The source workbooks are not copied into this repository.

## Files

- `index.html` — page structure and accessible forms.
- `styles.css` — responsive presentation using the approved SkyChefs logo color and neutral UI colors.
- `app.js` — calculations, rendering, filters, exports, automatic data loading, and local persistence.
- `data/source-snapshot.json` — extracted aggregate workbook information used by the overview.
- `data/current-state-summary.json` — aggregate-only snapshot of the active OJT Pipeline.
- `data/trainees.json` — published roster source.
- `assets/skychefs-logo-approved.svg` — unmodified approved SkyChefs logo.
- `dashboard-goal.md` — reusable implementation goal prompt.
