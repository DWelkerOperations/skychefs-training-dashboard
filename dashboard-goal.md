# Goal prompt: SkyChefs Training Progression Dashboard

Build and maintain a responsive, static HTML dashboard for the SkyChefs OJT training pipeline, deployable on GitHub Pages without a build step. Use `ORD Trainee Progression Tracker (2026).xlsx`, especially its `OJT Pipeline` sheet, as the current operational reference. Retain `Progression Template.xlsb` and `Template Trainee Tracker.xlsx` only as earlier structural and staffing references.

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
   - When the published trainee roster is empty, show aggregate current-list counts, active trainees, certifications, certifications due in the next 30 days, attention counts, stage mix, position mix, status mix, and the eight-week certification forecast from the active OJT Pipeline.
   - When trainee records exist, show active trainee count, on-track rate, certifications projected in the next 30 days, training stages, and people needing attention.
   - Keep workbook dates visible so forecast values are not mistaken for live headcount.

2. **Trainee input tab**
   - Search and filters.
   - A horizontally navigable tracker that preserves all 43 `OJT Pipeline` operational columns in source order, even when the roster is empty.
   - Keep trainee name and the edit action visible while moving between core, access/prerequisite, progress, aircraft, and outcome column groups.
   - Clearly mark protected probation, elapsed-time, safety, projected-date, forecast, variance, and readiness fields.
   - Add/edit form based on the current tracker fields, including license class, class attendance, inflight-door session, dock status, ADA, A.S.S.E.T., paperwork, fingerprint appointment, SIDA/badge steps, OJT assignment, trainer, schedule, weekly status values, safety certifier, four aircraft types, actual certification, cohort markers, delay reason, and comments.
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

- Probation end = hire/transfer date + 60 calendar days.
- Days in training = current date − hire/transfer date.
- Safety class end = hire/transfer date + 3 calendar days, matching the current formula pattern used for later cohorts.
- Projected certification = hire/transfer date + 35 calendar days.
- Certification forecast = assigned OJT date + 21 calendar days; otherwise best-guess SIDA date + 21 calendar days; otherwise the 35-day projected date.
- Days +/- projected certification = projected certification date − actual certification date.
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

- Publish only aggregate workbook counts on the public GitHub Pages site; do not copy employee-level rows from the active workbook into the repository.
- Never copy the source workbooks into the public site.
- Do not expose employee data in a public GitHub repository or public Pages site.
- Persist browser edits locally and make the UI state explicit: Workbook data, Published data, Local edits, or Data unavailable.
- Recalculate all derived values after every load or edit. Do not accept projected dates as editable source facts.

## Quality and acceptance criteria

- Works from a plain static web server and GitHub Pages.
- No external package, CDN, or build system is required.
- Responsive at desktop, tablet, and phone sizes.
- Usable with keyboard navigation and screen readers; dialogs, tabs, labels, tables, and status messages have accessible semantics.
- Handles an intentionally empty public roster without broken cards or charts while still showing the aggregate current-state snapshot.
- Prevents editing calculated dates through the user interface.
- Exports source facts to JSON and includes derived fields only in the human-readable CSV output.
- Uses the approved SkyChefs logo file without modification.
