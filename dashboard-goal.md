# Goal prompt: SkyChefs Training Progression Dashboard

Build and maintain a responsive, static HTML dashboard for the SkyChefs OJT training pipeline, deployable on GitHub Pages without a build step. Use `Progression Template.xlsb` and `Template Trainee Tracker.xlsx` as the source references for field structure, training stages, certification forecasts, and staffing baseline.

## Goal

Give leaders a fast overall view of training progress and give training coordinators a controlled input experience where they can update trainee facts without being able to overwrite projected-date equations or dashboard calculations.

## Brand requirements

- Use the current U.S. brand name **SkyChefs**.
- Use only the approved logo asset at `assets/skychefs-logo-approved.svg`.
- Do not redraw, recolor, crop, stretch, or substitute the logo.
- Use the exact logo red from the approved SVG where a brand accent is needed. Use neutral colors for the remainder of the interface unless exact approved brand color values are provided.
- Never use the legacy LSG blue-and-yellow globe logo or refer to the current U.S. brand as “LSG Sky Chefs.”

## Required views

1. **Overview homepage**
   - Automatically load aggregate information extracted from the supplied workbooks; do not require the visitor to import a file.
   - When the published trainee roster is empty, show the workbook driver forecast, staffing need and variance, TDY totals, position goals, regional staffing, and stations with the largest open-position gaps.
   - When trainee records exist, show active trainee count, on-track rate, certifications projected in the next 30 days, training stages, and people needing attention.
   - Keep workbook dates visible so forecast values are not mistaken for live headcount.

2. **Trainee input tab**
   - Search and filters.
   - A horizontally navigable tracker that preserves every source workbook column in source order, even when the roster is empty.
   - Keep trainee name, employee number, and the edit action visible while moving between core, progress, aircraft, and outcome column groups.
   - Clearly mark protected progress, projected dates, and readiness fields.
   - Add/edit form based on the tracker fields: trainee name, employee number, position, status, source, hire/transfer date, safety class date, dock training, AOA badge, customs seal, OJT assignment, trainer, schedule, training stage, five weekly milestones, aircraft qualifications, actual certification date, delay reason, and comments.
   - Clearly gray and lock all derived date fields.
   - CSV and JSON export.

3. **Rules and publishing tab**
   - Explain the formulas in plain language.
   - Explain browser-local persistence.
   - Explain how `data/source-snapshot.json` and `data/trainees.json` load automatically.
   - Explain how to replace published JSON and republish through GitHub Pages.
   - Warn that static GitHub Pages cannot provide safe simultaneous multi-user editing without an authenticated backend.

## Protected calculation rules

Keep these calculations in application code and out of editable form fields:

- Probation end = hire/transfer date + 90 calendar days.
- Safety class end = safety class start + 4 calendar days.
- Projected certification priority:
  1. Actual certification date, when entered.
  2. Assigned OJT date + 21 calendar days.
  3. Safety class start + 35 calendar days.
  4. Hire/transfer date + 35 calendar days.
- Progress = 20% per completed week, with the selected stage acting as a minimum progress indicator.
- Readiness rules:
  - Certified when an actual certification date is present or the record is marked certified.
  - Inactive for separated, demotion, lateral, or light-duty records.
  - Delayed when the projection is before today.
  - Blocked when a required prerequisite is explicitly marked No.
  - At risk when progress trails the five-week schedule by at least one milestone, certification is within 14 days with less than 80% progress, no projection source date exists, or a delay reason is present.
  - On track otherwise.

Treat the day offsets as centrally managed business assumptions. Do not make them editable through the routine trainee form. If the training owner changes the schedule, update the rule constants, documentation, tests, and user-visible explanation together.

## Data and privacy requirements

- Do not manufacture trainee records when the supplied tracker is empty; present a clear empty state and allow direct entry.
- Never copy the source workbooks into the public site.
- Do not expose employee data in a public GitHub repository or public Pages site.
- Persist browser edits locally and make the UI state explicit: Workbook data, Published data, Local edits, or Data unavailable.
- Recalculate all derived values after every load or edit. Do not accept projected dates as editable source facts.

## Quality and acceptance criteria

- Works from a plain static web server and GitHub Pages.
- No external package, CDN, or build system is required.
- Responsive at desktop, tablet, and phone sizes.
- Usable with keyboard navigation and screen readers; dialogs, tabs, labels, tables, and status messages have accessible semantics.
- Handles an empty roster without broken cards or charts.
- Prevents editing calculated dates through the user interface.
- Exports source facts to JSON and includes derived fields only in the human-readable CSV output.
- Uses the approved SkyChefs logo file without modification.
