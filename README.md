# SkyChefs Training Progression Dashboard

[View the live dashboard](https://dwelkeroperations.github.io/skychefs-training-dashboard/)

A static, GitHub Pages-ready dashboard built from the structure of:

- `Progression Template.xlsb`
- `Template Trainee Tracker.xlsx`

The site automatically loads a published snapshot extracted from both source workbooks. It has an overall visual dashboard, a trainee input table, protected calculations, CSV/JSON export, and a documented publishing workflow. No build step or external JavaScript package is required.

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

The page loads `data/source-snapshot.json` and `data/trainees.json` automatically. No browser file import is required.

- `data/source-snapshot.json` contains aggregate staffing, forecast, region, and station information extracted from the supplied workbooks.
- The supplied trainee tracker contains headers and dropdown values but no trainee rows, so `data/trainees.json` starts with an empty roster.
- Edits made in **Trainee input** are stored in the current browser's `localStorage`.
- **Export JSON** produces a replacement for `data/trainees.json`.
- Commit that replacement file to publish one shared, read-only roster.
- Calculated fields are omitted from JSON and rebuilt in the browser. They cannot be overwritten through the input form.

GitHub Pages cannot read files from a user's Downloads folder after deployment. To refresh workbook information, regenerate `data/source-snapshot.json` from the approved source files and publish the updated snapshot.

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
- The Progression Template snapshot contains driver certification forecasts, TDY counts, position goals, regional staffing totals, and station gaps. Workbook dates remain visible in the dashboard so forecast values are not mistaken for current live headcount.
- The source workbooks are not copied into this repository.

## Files

- `index.html` — page structure and accessible forms.
- `styles.css` — responsive presentation using the approved SkyChefs logo color and neutral UI colors.
- `app.js` — calculations, rendering, filters, exports, automatic data loading, and local persistence.
- `data/source-snapshot.json` — extracted aggregate workbook information used by the overview.
- `data/trainees.json` — published roster source.
- `assets/skychefs-logo-approved.svg` — unmodified approved SkyChefs logo.
- `dashboard-goal.md` — reusable implementation goal prompt.
