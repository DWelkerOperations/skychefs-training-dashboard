"use strict";

const STORAGE_KEY = "skychefs-training-dashboard:v2";
const PUBLISHED_DATA_URL = "data/trainees.json";
const SOURCE_SNAPSHOT_URL = "data/source-snapshot.json";

// Centralized business rules. These are deliberately not exposed as editable page inputs.
const PROJECTION_RULES = Object.freeze({
  probationDays: 90,
  safetyClassEndOffsetDays: 4,
  certificationFromAssignedOjtDays: 21,
  certificationFromSafetyStartDays: 35,
  certificationFromHireDays: 35,
  attentionWindowDays: 14,
});

const OPTIONS = Object.freeze({
  positions: ["CDL Driver", "NonCDL Driver", "Helper", "Guide"],
  employmentStatuses: ["Good", "Certified", "Separated", "Demotion", "Lateral", "Light Duty"],
  sources: ["Internal", "External"],
  trainingStages: [
    "Not started",
    "Initial Class",
    "Dock Training",
    "AOA / Airport Familiarization",
    "OJT",
    "Evaluation",
    "Certification Finalization",
    "Certified",
    "Other",
  ],
  yesNo: ["", "Y", "N", "Not required"],
  aircraft: ["CRJ", "E75", "A319 / A320 / A321", "B737", "B757", "B767", "A380", "B747"],
  delayReasons: [
    "",
    "Badge / access pending",
    "Customs seal pending",
    "Trainer availability",
    "Schedule interruption",
    "Attendance",
    "Evaluation not passed",
    "Documentation incomplete",
    "Operational reassignment",
    "Other",
  ],
});

const STAFFING_BASELINE = Object.freeze([
  { position: "CDL Driver", goal: 227, have: 138, need: 89 },
  { position: "NonCDL Driver", goal: 72, have: 39, need: 33 },
  { position: "Helper", goal: 240, have: 160, need: 80 },
]);

const INACTIVE_STATUSES = new Set(["Separated", "Demotion", "Lateral", "Light Duty"]);
const RISK_PRIORITY = Object.freeze({ Delayed: 0, Blocked: 1, "At risk": 2, "On track": 3, Certified: 4, Inactive: 5 });
const STAGE_PROGRESS = Object.freeze({
  "Not started": 0,
  "Initial Class": 10,
  "Dock Training": 20,
  "AOA / Airport Familiarization": 40,
  OJT: 60,
  Evaluation: 80,
  "Certification Finalization": 90,
  Certified: 100,
  Other: 0,
});

const state = {
  trainees: [],
  sourceSnapshot: null,
  dataMode: "published",
  activeView: "overview",
  overviewPosition: "all",
  overviewSource: "all",
  traineeSearch: "",
  traineePosition: "all",
  traineeRisk: "all",
};

const elements = {};
let toastTimer;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  buildFormOptions();
  applyRuleText();
  bindEvents();
  await loadSourceSnapshot();
  await loadInitialData();

  const requestedView = window.location.hash.replace("#", "");
  showView(["overview", "trainees", "method"].includes(requestedView) ? requestedView : "overview", false);
}

function cacheElements() {
  const ids = [
    "data-mode-badge",
    "trainee-tab-count",
    "overview-as-of",
    "overview-filter-cluster",
    "overview-position-filter",
    "overview-source-filter",
    "kpi-active-label",
    "kpi-active",
    "kpi-active-note",
    "kpi-on-track-label",
    "kpi-on-track",
    "kpi-on-track-note",
    "kpi-due-label",
    "kpi-due",
    "kpi-due-note",
    "kpi-attention-card",
    "kpi-attention-icon",
    "kpi-attention-label",
    "kpi-attention",
    "kpi-attention-note",
    "forecast-kicker",
    "forecast-title",
    "forecast-meta",
    "forecast-chart",
    "stage-kicker",
    "stage-title",
    "stage-breakdown",
    "staffing-kicker",
    "staffing-title",
    "staffing-meta",
    "staffing-baseline",
    "staffing-source-note",
    "attention-kicker",
    "attention-title",
    "attention-view-all",
    "attention-table-head",
    "attention-table-body",
    "attention-empty",
    "export-csv-button",
    "export-json-button",
    "trainee-search",
    "trainee-position-filter",
    "trainee-risk-filter",
    "record-count",
    "trainee-table-body",
    "trainee-empty",
    "reload-published-button",
    "clear-local-button",
    "trainee-dialog",
    "trainee-form",
    "trainee-dialog-title",
    "projection-basis",
    "delete-trainee-button",
    "aircraft-grid",
    "form-error",
    "toast",
  ];

  ids.forEach((id) => {
    elements[toCamel(id)] = document.getElementById(id);
  });
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function bindEvents() {
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.viewTarget));
  });

  document.querySelectorAll("[data-open-trainee]").forEach((button) => {
    button.addEventListener("click", () => openTraineeDialog());
  });

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", closeTraineeDialog);
  });

  elements.overviewPositionFilter.addEventListener("change", (event) => {
    state.overviewPosition = event.target.value;
    renderOverview();
  });

  elements.overviewSourceFilter.addEventListener("change", (event) => {
    state.overviewSource = event.target.value;
    renderOverview();
  });

  elements.traineeSearch.addEventListener("input", (event) => {
    state.traineeSearch = event.target.value.trim().toLowerCase();
    renderTraineeTable();
  });

  elements.traineePositionFilter.addEventListener("change", (event) => {
    state.traineePosition = event.target.value;
    renderTraineeTable();
  });

  elements.traineeRiskFilter.addEventListener("change", (event) => {
    state.traineeRisk = event.target.value;
    renderTraineeTable();
  });

  elements.traineeTableBody.addEventListener("click", handleEditClick);
  elements.attentionTableBody.addEventListener("click", handleEditClick);
  elements.traineeForm.addEventListener("submit", saveTraineeFromForm);
  elements.traineeForm.addEventListener("input", updateCalculatedFormFields);
  elements.traineeForm.addEventListener("change", updateCalculatedFormFields);
  elements.deleteTraineeButton.addEventListener("click", deleteCurrentTrainee);

  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.exportJsonButton.addEventListener("click", exportJson);
  elements.reloadPublishedButton.addEventListener("click", reloadPublishedData);
  elements.clearLocalButton.addEventListener("click", clearLocalEdits);

  window.addEventListener("hashchange", () => {
    const view = window.location.hash.replace("#", "");
    if (["overview", "trainees", "method"].includes(view) && view !== state.activeView) {
      showView(view, false);
    }
  });
}

function buildFormOptions() {
  setSelectOptions(elements.traineeForm.elements.position, OPTIONS.positions, "Select position");
  setSelectOptions(elements.traineeForm.elements.status, OPTIONS.employmentStatuses);
  setSelectOptions(elements.traineeForm.elements.source, OPTIONS.sources, "Select source");
  setSelectOptions(elements.traineeForm.elements.trainingStage, OPTIONS.trainingStages, "Select stage");
  setSelectOptions(elements.traineeForm.elements.delayReason, OPTIONS.delayReasons);

  document.querySelectorAll("[data-yn]").forEach((select) => {
    setSelectOptions(select, OPTIONS.yesNo, "Not recorded", true);
  });

  elements.aircraftGrid.innerHTML = OPTIONS.aircraft
    .map(
      (aircraft) => `
        <label class="aircraft-check">
          <input type="checkbox" name="aircraft" value="${escapeHtml(aircraft)}" />
          <span>${escapeHtml(aircraft)}</span>
        </label>`,
    )
    .join("");
}

function setSelectOptions(select, values, placeholder = "", valuesIncludeBlank = false) {
  const options = [];
  if (placeholder && (!valuesIncludeBlank || values[0] !== "")) {
    options.push(`<option value="">${escapeHtml(placeholder)}</option>`);
  }
  values.forEach((value) => {
    if (value === "" && valuesIncludeBlank) {
      options.push(`<option value="">${escapeHtml(placeholder)}</option>`);
    } else {
      options.push(`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`);
    }
  });
  select.innerHTML = options.join("");
}

function applyRuleText() {
  const map = {
    "rule-ojt-days": PROJECTION_RULES.certificationFromAssignedOjtDays,
    "rule-training-days": PROJECTION_RULES.certificationFromSafetyStartDays,
    "rule-hire-days": PROJECTION_RULES.certificationFromHireDays,
    "rule-probation-days": PROJECTION_RULES.probationDays,
    "rule-class-days": PROJECTION_RULES.safetyClassEndOffsetDays,
  };
  Object.entries(map).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
}

async function loadSourceSnapshot() {
  try {
    const response = await fetch(`${SOURCE_SNAPSHOT_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Workbook snapshot returned ${response.status}`);
    state.sourceSnapshot = await response.json();
  } catch (error) {
    console.warn("Workbook snapshot could not be loaded.", error);
    state.sourceSnapshot = null;
  }
}

async function loadInitialData() {
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      state.trainees = normalizeCollection(parsed.trainees ?? parsed);
      state.dataMode = "local";
      renderAll();
      return;
    } catch (error) {
      console.warn("Local dashboard data could not be parsed.", error);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  await loadPublishedData();
}

async function loadPublishedData() {
  try {
    const response = await fetch(`${PUBLISHED_DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Published data returned ${response.status}`);
    const parsed = await response.json();
    state.trainees = normalizeCollection(parsed.trainees ?? parsed);
    state.dataMode = "published";
  } catch (error) {
    console.warn("Published data could not be loaded.", error);
    state.trainees = [];
    state.dataMode = "unavailable";
  }
  renderAll();
}

function normalizeCollection(records) {
  if (!Array.isArray(records)) return [];
  return records
    .map((record, index) => normalizeRecord(record, index))
    .filter((record) => record.traineeName || record.employeeNumber);
}

function normalizeRecord(record = {}, index = 0) {
  const milestones = record.milestones ?? {};
  const recordAircraft = Array.isArray(record.aircraft)
    ? record.aircraft
    : typeof record.aircraft === "string"
      ? record.aircraft.split(/[;,|]/).map((value) => value.trim()).filter(Boolean)
      : [];

  return {
    id: String(record.id || createId(`record-${index + 1}`)),
    traineeName: cleanText(record.traineeName),
    employeeNumber: cleanText(record.employeeNumber),
    position: cleanText(record.position),
    status: cleanText(record.status) || "Good",
    source: cleanText(record.source),
    hireDate: normalizeDateString(record.hireDate),
    safetyStartDate: normalizeDateString(record.safetyStartDate),
    assignedOjtDate: normalizeDateString(record.assignedOjtDate),
    trainerName: cleanText(record.trainerName),
    trainerSchedule: cleanText(record.trainerSchedule),
    trainingStage: cleanText(record.trainingStage) || "Not started",
    dockTraining: normalizeYesNo(record.dockTraining),
    aoaBadge: normalizeYesNo(record.aoaBadge),
    customsSeal: normalizeYesNo(record.customsSeal),
    milestones: {
      week1: toBoolean(milestones.week1 ?? record.week1),
      week2: toBoolean(milestones.week2 ?? record.week2),
      week3: toBoolean(milestones.week3 ?? record.week3),
      week4: toBoolean(milestones.week4 ?? record.week4),
      week5: toBoolean(milestones.week5 ?? record.week5),
    },
    aircraft: [...new Set(recordAircraft.map(cleanText).filter(Boolean))],
    certificationDate: normalizeDateString(record.certificationDate),
    delayReason: cleanText(record.delayReason),
    comments: cleanText(record.comments),
    demo: Boolean(record.demo),
    createdAt: cleanText(record.createdAt),
    updatedAt: cleanText(record.updatedAt),
  };
}

function renderAll() {
  populateDynamicFilters();
  renderDataBadge();
  renderOverview();
  renderTraineeTable();
  elements.traineeTabCount.textContent = state.trainees.length;
}

function renderDataBadge() {
  elements.dataModeBadge.classList.toggle("is-local", state.dataMode === "local");

  if (state.dataMode === "local") {
    elements.dataModeBadge.textContent = "Local edits";
  } else if (state.trainees.length) {
    elements.dataModeBadge.textContent = "Published roster";
  } else if (state.sourceSnapshot) {
    elements.dataModeBadge.textContent = "Workbook data";
  } else if (state.dataMode === "unavailable") {
    elements.dataModeBadge.textContent = "Data unavailable";
  } else {
    elements.dataModeBadge.textContent = "Published data";
  }
}

function populateDynamicFilters() {
  const positions = uniqueSorted([...OPTIONS.positions, ...state.trainees.map((record) => record.position).filter(Boolean)]);
  const sources = uniqueSorted([...OPTIONS.sources, ...state.trainees.map((record) => record.source).filter(Boolean)]);

  populateFilter(elements.overviewPositionFilter, positions, "All positions", state.overviewPosition);
  populateFilter(elements.traineePositionFilter, positions, "All positions", state.traineePosition);
  populateFilter(elements.overviewSourceFilter, sources, "All sources", state.overviewSource);
}

function populateFilter(select, values, allLabel, selectedValue) {
  select.innerHTML = [
    `<option value="all">${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`),
  ].join("");
  select.value = values.includes(selectedValue) ? selectedValue : "all";
}

function renderOverview() {
  if (!state.trainees.length && state.sourceSnapshot) {
    renderSourceOverview();
    return;
  }

  restoreTraineeOverviewChrome();
  const filtered = state.trainees.filter((record) => {
    const positionMatch = state.overviewPosition === "all" || record.position === state.overviewPosition;
    const sourceMatch = state.overviewSource === "all" || record.source === state.overviewSource;
    return positionMatch && sourceMatch;
  });
  const enriched = filtered.map(enrichRecord);
  const active = enriched.filter((record) => record.isActive);
  const today = todayUtc();
  const next30 = addDays(today, 30);
  const onTrack = active.filter((record) => record.risk.label === "On track").length;
  const attention = active.filter((record) => ["Delayed", "Blocked", "At risk"].includes(record.risk.label));
  const due = active.filter((record) => {
    const date = parseDate(record.projection.date);
    return date && date >= today && date <= next30;
  }).length;

  elements.kpiActive.textContent = active.length;
  elements.kpiActiveNote.textContent = filtered.length === state.trainees.length ? "Across all positions" : `${filtered.length} filtered records`;
  elements.kpiOnTrack.textContent = active.length ? `${Math.round((onTrack / active.length) * 100)}%` : "—";
  elements.kpiOnTrackNote.textContent = `${onTrack} of ${active.length} active trainees`;
  elements.kpiDue.textContent = due;
  elements.kpiAttention.textContent = attention.length;
  elements.kpiAttentionNote.textContent = attention.length ? "Delayed, at risk, or blocked" : "No current exceptions";
  elements.overviewAsOf.textContent = `As of ${formatDate(today)} · ${filtered.length} visible record${filtered.length === 1 ? "" : "s"}`;

  renderForecast(active);
  renderStageBreakdown(active);
  renderStaffingBaseline();
  renderAttentionTable(attention);
}

function renderSourceOverview() {
  const snapshot = state.sourceSnapshot;
  const driverWeeks = Array.isArray(snapshot.driverWeekly) ? snapshot.driverWeekly : [];
  const latest = driverWeeks.at(-1) || {};
  const sourceUpdated = snapshot.sources?.progression?.updatedDate;

  elements.overviewFilterCluster.classList.add("is-hidden");
  elements.kpiActiveLabel.textContent = "Certified drivers";
  elements.kpiActive.textContent = formatNumber(latest.certified);
  elements.kpiActiveNote.textContent = `${formatNumber(latest.total)} including forecast certifications`;
  elements.kpiOnTrackLabel.textContent = "Drivers with TDY";
  elements.kpiOnTrack.textContent = formatNumber(latest.totalWithTdy);
  elements.kpiOnTrackNote.textContent = `${formatNumber(latest.total)} drivers + ${formatNumber(latest.badgedTdy)} TDY`;
  elements.kpiDueLabel.textContent = "Staffing need";
  elements.kpiDue.textContent = formatNumber(latest.staffingNeed);
  elements.kpiDueNote.textContent = "Driver requirement in the forecast";
  elements.kpiAttentionLabel.textContent = "Variance to need";
  elements.kpiAttention.textContent = signedNumber(latest.variance);
  elements.kpiAttentionNote.textContent = latest.variance >= 0 ? "Above the forecast staffing need" : "Below the forecast staffing need";
  elements.kpiAttentionCard.classList.toggle("kpi-card-alert", latest.variance < 0);
  elements.kpiAttentionIcon.classList.toggle("kpi-icon-alert", latest.variance < 0);
  elements.kpiAttentionIcon.classList.toggle("kpi-icon-good", latest.variance >= 0);
  elements.kpiAttentionIcon.textContent = latest.variance >= 0 ? "✓" : "!";

  const forecastThrough = latest.date ? formatDate(latest.date) : "the last workbook period";
  elements.overviewAsOf.textContent = `Loaded automatically from the supplied workbooks · forecast through ${forecastThrough}`;
  elements.forecastKicker.textContent = "Workbook outlook";
  elements.forecastTitle.textContent = "New driver certifications";
  elements.forecastMeta.textContent = "Last 8 workbook weeks";
  elements.forecastChart.setAttribute("aria-label", "New driver certifications by workbook week");
  elements.stageKicker.textContent = "Progression baseline";
  elements.stageTitle.textContent = "Progress to position goals";
  elements.staffingKicker.textContent = "Pivot detail";
  elements.staffingTitle.textContent = "Regional staffing snapshot";
  elements.staffingMeta.textContent = sourceUpdated ? `Source updated ${formatDate(sourceUpdated)}` : "Workbook data";
  elements.staffingSourceNote.textContent = "Employees, staffing need, open positions, and prehires are loaded from the Progression Template workbook snapshot.";
  elements.attentionKicker.textContent = "Largest gaps";
  elements.attentionTitle.textContent = "Stations by open positions";
  elements.attentionViewAll.classList.add("is-hidden");

  renderSourceForecast(driverWeeks);
  renderSourcePositionGoals(snapshot.positionGoals || []);
  renderSourceRegions(snapshot.regionSummary || []);
  renderSourceStations(snapshot.topStationsByOpenings || []);
}

function restoreTraineeOverviewChrome() {
  elements.overviewFilterCluster.classList.remove("is-hidden");
  elements.kpiActiveLabel.textContent = "Active trainees";
  elements.kpiOnTrackLabel.textContent = "On track";
  elements.kpiDueLabel.textContent = "Certifications due";
  elements.kpiDueNote.textContent = "Next 30 days";
  elements.kpiAttentionLabel.textContent = "Needs attention";
  elements.kpiAttentionCard.classList.add("kpi-card-alert");
  elements.kpiAttentionIcon.classList.add("kpi-icon-alert");
  elements.kpiAttentionIcon.classList.remove("kpi-icon-good");
  elements.kpiAttentionIcon.textContent = "!";
  elements.forecastKicker.textContent = "Outlook";
  elements.forecastTitle.textContent = "Projected certifications";
  elements.forecastMeta.textContent = "8-week forecast";
  elements.forecastChart.setAttribute("aria-label", "Projected certifications by week");
  elements.stageKicker.textContent = "Pipeline";
  elements.stageTitle.textContent = "Training stage";
  elements.staffingKicker.textContent = "Source workbook baseline";
  elements.staffingTitle.textContent = "Staffing progression";
  elements.staffingMeta.textContent = "Updated Feb 25, 2026";
  elements.staffingSourceNote.textContent = "Reference goals and “have” counts come from the Progression Template. They are kept separate from live trainee KPIs to avoid presenting the dated baseline as current headcount.";
  elements.attentionKicker.textContent = "Action list";
  elements.attentionTitle.textContent = "People needing attention";
  elements.attentionViewAll.classList.remove("is-hidden");
  elements.attentionTableHead.innerHTML = `
    <tr>
      <th scope="col">Trainee</th>
      <th scope="col">Issue</th>
      <th scope="col">Progress</th>
      <th scope="col">Projected cert.</th>
      <th scope="col"><span class="sr-only">Edit</span></th>
    </tr>`;
  elements.staffingBaseline.classList.remove("is-regional");
}

function renderSourceForecast(driverWeeks) {
  const weeks = driverWeeks
    .filter((week) => Number.isFinite(week.newHireCertifications))
    .slice(-8);
  const max = Math.max(...weeks.map((week) => week.newHireCertifications), 1);
  elements.forecastChart.innerHTML = weeks
    .map((week) => {
      const count = week.newHireCertifications;
      const height = count ? Math.max(10, Math.round((count / max) * 100)) : 4;
      return `
        <div class="forecast-week">
          <div class="forecast-bar-wrap">
            <div class="forecast-bar ${count ? "" : "is-zero"}" style="height:${height}%">
              <span class="forecast-value">${formatNumber(count)}</span>
            </div>
          </div>
          <span class="forecast-label">Week ending<br />${escapeHtml(formatDate(week.date, { month: "short", day: "numeric", omitYear: true }))}</span>
        </div>`;
    })
    .join("");
}

function renderSourcePositionGoals(positionGoals) {
  elements.stageBreakdown.innerHTML = positionGoals
    .map((item) => {
      const percent = item.goal ? Math.min(100, Math.round((item.have / item.goal) * 100)) : 0;
      return `
        <div class="stage-row">
          <div class="stage-row-heading"><span>${escapeHtml(item.position)}</span><span>${formatNumber(item.have)} / ${formatNumber(item.goal)} · ${formatNumber(item.need)} need</span></div>
          <div class="meter" aria-label="${escapeHtml(item.position)} ${percent} percent of goal"><span style="width:${percent}%"></span></div>
        </div>`;
    })
    .join("");
}

function renderSourceRegions(regions) {
  elements.staffingBaseline.classList.add("is-regional");
  elements.staffingBaseline.innerHTML = regions
    .map((region) => {
      const percent = region.needed ? Math.min(100, Math.round((region.employees / region.needed) * 100)) : 0;
      return `
        <div class="staffing-row">
          <span class="staffing-position">${escapeHtml(region.region)}</span>
          <div class="staffing-track" aria-label="${escapeHtml(region.region)} ${percent}% staffed"><span style="width:${percent}%"></span></div>
          <span class="staffing-value"><strong>${formatNumber(region.employees)}</strong> / ${formatNumber(region.needed)}<br />${formatNumber(region.openPositions)} open · ${formatNumber(region.prehire)} prehire</span>
        </div>`;
    })
    .join("");
}

function renderSourceStations(stations) {
  const rows = stations.slice(0, 6);
  elements.attentionTableHead.innerHTML = `
    <tr>
      <th scope="col">Station</th>
      <th scope="col">Region</th>
      <th scope="col">Employees / need</th>
      <th scope="col">Open positions</th>
      <th scope="col">Prehire</th>
    </tr>`;
  elements.attentionEmpty.classList.toggle("is-hidden", rows.length > 0);
  elements.attentionTableBody.parentElement.parentElement.classList.toggle("is-hidden", rows.length === 0);
  elements.attentionTableBody.innerHTML = rows
    .map(
      (station) => `
        <tr>
          <td><span class="person-name">${escapeHtml(station.station)}</span></td>
          <td>${escapeHtml(station.region)}</td>
          <td><strong>${formatNumber(station.employees)}</strong> / ${formatNumber(station.needed)}</td>
          <td><span class="status-pill status-delayed">${formatNumber(station.openPositions)} open</span></td>
          <td>${formatNumber(station.prehire)}</td>
        </tr>`,
    )
    .join("");
}

function renderForecast(activeRecords) {
  const firstWeek = weekEndingThursday(todayUtc());
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const end = addDays(firstWeek, index * 7);
    return { end, key: toIsoDate(end), count: 0 };
  });

  activeRecords.forEach((record) => {
    const projected = parseDate(record.projection.date);
    if (!projected) return;
    const key = toIsoDate(weekEndingThursday(projected));
    const bucket = weeks.find((week) => week.key === key);
    if (bucket) bucket.count += 1;
  });

  const total = weeks.reduce((sum, week) => sum + week.count, 0);
  if (!total) {
    elements.forecastChart.innerHTML = `<div class="chart-empty"><strong>No certifications projected in the next 8 weeks</strong><br />Add a safety start or assigned OJT date to create a forecast.</div>`;
    return;
  }

  const max = Math.max(...weeks.map((week) => week.count), 1);
  elements.forecastChart.innerHTML = weeks
    .map((week) => {
      const height = week.count ? Math.max(10, Math.round((week.count / max) * 100)) : 4;
      return `
        <div class="forecast-week">
          <div class="forecast-bar-wrap">
            <div class="forecast-bar ${week.count ? "" : "is-zero"}" style="height:${height}%">
              <span class="forecast-value">${week.count}</span>
            </div>
          </div>
          <span class="forecast-label">Week ending<br />${escapeHtml(formatDate(week.end, { month: "short", day: "numeric", omitYear: true }))}</span>
        </div>`;
    })
    .join("");
}

function renderStageBreakdown(activeRecords) {
  if (!activeRecords.length) {
    elements.stageBreakdown.innerHTML = `<div class="empty-state"><span>○</span><p>No active trainee stages to summarize.</p></div>`;
    return;
  }

  const counts = new Map();
  activeRecords.forEach((record) => {
    const stage = record.trainingStage || "Not assigned";
    counts.set(stage, (counts.get(stage) || 0) + 1);
  });

  elements.stageBreakdown.innerHTML = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([stage, count]) => {
      const percent = Math.round((count / activeRecords.length) * 100);
      return `
        <div class="stage-row">
          <div class="stage-row-heading"><span>${escapeHtml(stage)}</span><span>${count} · ${percent}%</span></div>
          <div class="meter" aria-label="${escapeHtml(stage)} ${percent} percent"><span style="width:${percent}%"></span></div>
        </div>`;
    })
    .join("");
}

function renderAttentionTable(attentionRecords) {
  const sorted = [...attentionRecords]
    .sort(sortByRiskAndProjection)
    .slice(0, 6);

  elements.attentionEmpty.classList.toggle("is-hidden", sorted.length > 0);
  elements.attentionTableBody.parentElement.parentElement.classList.toggle("is-hidden", sorted.length === 0);
  elements.attentionTableBody.innerHTML = sorted
    .map(
      (record) => `
        <tr>
          <td><span class="person-name">${escapeHtml(record.traineeName || "Unnamed trainee")}</span><span class="person-meta">${escapeHtml(record.position || "No position")}</span></td>
          <td><span class="status-pill ${riskClass(record.risk.label)}">${escapeHtml(record.risk.label)}</span><span class="cell-meta">${escapeHtml(record.risk.issue)}</span></td>
          <td>${progressMarkup(record.progress, record.risk.label)}</td>
          <td>${record.projection.date ? escapeHtml(formatDate(record.projection.date)) : "—"}</td>
          <td><button class="row-action" type="button" data-edit-id="${escapeHtml(record.id)}" aria-label="Edit ${escapeHtml(record.traineeName || "trainee")}">✎</button></td>
        </tr>`,
    )
    .join("");
}

function renderStaffingBaseline() {
  elements.staffingBaseline.innerHTML = STAFFING_BASELINE.map((item) => {
    const percent = Math.min(100, Math.round((item.have / item.goal) * 100));
    return `
      <div class="staffing-row">
        <span class="staffing-position">${escapeHtml(item.position)}</span>
        <div class="staffing-track" aria-label="${escapeHtml(item.position)} ${percent}% of goal"><span style="width:${percent}%"></span></div>
        <span class="staffing-value"><strong>${item.have}</strong> / ${item.goal} · ${item.need} need</span>
      </div>`;
  }).join("");
}

function renderTraineeTable() {
  const filtered = state.trainees
    .map(enrichRecord)
    .filter((record) => {
      const haystack = [record.traineeName, record.employeeNumber, record.trainerName, record.position, record.trainingStage]
        .join(" ")
        .toLowerCase();
      const searchMatch = !state.traineeSearch || haystack.includes(state.traineeSearch);
      const positionMatch = state.traineePosition === "all" || record.position === state.traineePosition;
      const riskMatch = state.traineeRisk === "all" || record.risk.label === state.traineeRisk;
      return searchMatch && positionMatch && riskMatch;
    })
    .sort(sortByRiskAndProjection);

  elements.recordCount.textContent = `${filtered.length} trainee${filtered.length === 1 ? "" : "s"}`;
  elements.traineeEmpty.classList.toggle("is-hidden", filtered.length > 0);
  elements.traineeTableBody.parentElement.parentElement.classList.toggle("is-hidden", filtered.length === 0);
  if (!filtered.length) {
    const title = elements.traineeEmpty.querySelector("h3");
    const message = elements.traineeEmpty.querySelector("p");
    if (!state.trainees.length) {
      title.textContent = "No trainee rows were found in the supplied tracker";
      message.textContent = "The workbook contains the field structure and dropdowns only. Add the first trainee here when you are ready.";
    } else {
      title.textContent = "No trainees match these filters";
      message.textContent = "Adjust the search or filters to see other records.";
    }
  }
  elements.traineeTableBody.innerHTML = filtered
    .map((record) => {
      const projectionText = record.projection.date ? formatDate(record.projection.date) : "Not available";
      return `
        <tr>
          <td><span class="person-name">${escapeHtml(record.traineeName || "Unnamed trainee")}</span><span class="person-meta">${escapeHtml(record.employeeNumber || "No employee number")}${record.demo ? " · Example" : ""}</span></td>
          <td><strong>${escapeHtml(record.position || "—")}</strong><span class="cell-meta">${escapeHtml(record.source || "Source not recorded")}</span></td>
          <td><strong>${escapeHtml(record.trainingStage || "Not started")}</strong><span class="cell-meta">${escapeHtml(record.trainerName || "Trainer not assigned")}</span></td>
          <td>${progressMarkup(record.progress, record.risk.label)}</td>
          <td>${prerequisiteMarkup(record)}</td>
          <td><span class="locked-date">${escapeHtml(projectionText)}</span><span class="cell-meta">${escapeHtml(record.projection.basis)}</span></td>
          <td><span class="status-pill ${riskClass(record.risk.label)}">${escapeHtml(record.risk.label)}</span><span class="cell-meta">${escapeHtml(record.risk.issue)}</span></td>
          <td><button class="row-action" type="button" data-edit-id="${escapeHtml(record.id)}" aria-label="Edit ${escapeHtml(record.traineeName || "trainee")}">✎</button></td>
        </tr>`;
    })
    .join("");
}

function progressMarkup(progress, riskLabel) {
  const color = ["On track", "Certified"].includes(riskLabel)
    ? "var(--good)"
    : riskLabel === "At risk"
      ? "var(--risk)"
      : riskLabel === "Inactive"
        ? "var(--muted)"
        : "var(--brand-red)";
  return `<div class="progress-inline"><div class="meter"><span style="width:${progress}%;background:${color}"></span></div><strong>${progress}%</strong></div>`;
}

function prerequisiteMarkup(record) {
  const items = [
    ["Dock", record.dockTraining],
    ["AOA", record.aoaBadge],
    ["Seal", record.customsSeal],
  ];
  return `<div class="prereq-list">${items
    .map(([label, value]) => {
      const className = value === "Y" || value === "Not required" ? "is-complete" : value === "N" ? "is-blocked" : "";
      const title = `${label}: ${value || "not recorded"}`;
      return `<span class="prereq-chip ${className}" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
    })
    .join("")}</div>`;
}

function enrichRecord(record) {
  const projection = calculateProjection(record);
  const progress = calculateProgress(record);
  const isCertified = Boolean(record.certificationDate) || record.status === "Certified" || record.trainingStage === "Certified";
  const isInactive = INACTIVE_STATUSES.has(record.status);
  const isActive = !isCertified && !isInactive;
  const risk = calculateRisk(record, projection, progress, { isCertified, isInactive, isActive });
  return { ...record, projection, progress, isCertified, isInactive, isActive, risk };
}

function calculateProjection(record) {
  if (record.certificationDate) {
    return { date: record.certificationDate, basis: "Actual certification date" };
  }
  if (record.assignedOjtDate) {
    return {
      date: toIsoDate(addDays(parseDate(record.assignedOjtDate), PROJECTION_RULES.certificationFromAssignedOjtDays)),
      basis: `Assigned OJT + ${PROJECTION_RULES.certificationFromAssignedOjtDays} days`,
    };
  }
  if (record.safetyStartDate) {
    return {
      date: toIsoDate(addDays(parseDate(record.safetyStartDate), PROJECTION_RULES.certificationFromSafetyStartDays)),
      basis: `Safety class start + ${PROJECTION_RULES.certificationFromSafetyStartDays} days`,
    };
  }
  if (record.hireDate) {
    return {
      date: toIsoDate(addDays(parseDate(record.hireDate), PROJECTION_RULES.certificationFromHireDays)),
      basis: `Hire / transfer + ${PROJECTION_RULES.certificationFromHireDays} days`,
    };
  }
  return { date: "", basis: "Source date required" };
}

function calculateProgress(record) {
  if (record.certificationDate || record.status === "Certified" || record.trainingStage === "Certified") return 100;
  const milestoneProgress = Object.values(record.milestones || {}).filter(Boolean).length * 20;
  const stageProgress = STAGE_PROGRESS[record.trainingStage] ?? 0;
  return clamp(Math.max(milestoneProgress, stageProgress), 0, 100);
}

function calculateRisk(record, projection, progress, flags) {
  if (flags.isCertified) return { label: "Certified", issue: record.certificationDate ? `Certified ${formatDate(record.certificationDate)}` : "Marked certified" };
  if (flags.isInactive) return { label: "Inactive", issue: record.status };

  const today = todayUtc();
  const projected = parseDate(projection.date);
  if (projected && projected < today) {
    const days = Math.max(1, daysBetween(projected, today));
    return { label: "Delayed", issue: `${days} day${days === 1 ? "" : "s"} past projection` };
  }

  const missingPrerequisites = [
    ["dock training", record.dockTraining],
    ["AOA badge", record.aoaBadge],
    ["customs seal", record.customsSeal],
  ]
    .filter(([, value]) => value === "N")
    .map(([label]) => label);
  if (missingPrerequisites.length) {
    return { label: "Blocked", issue: `Pending ${missingPrerequisites.join(", ")}` };
  }

  const expectedProgress = calculateExpectedProgress(record);
  if (expectedProgress - progress >= 20) {
    return { label: "At risk", issue: `${progress}% complete vs. ${expectedProgress}% scheduled` };
  }

  if (projected) {
    const daysUntil = daysBetween(today, projected);
    if (daysUntil <= PROJECTION_RULES.attentionWindowDays && progress < 80) {
      return { label: "At risk", issue: `Certification in ${daysUntil} day${daysUntil === 1 ? "" : "s"}` };
    }
  } else {
    return { label: "At risk", issue: "No source date for projection" };
  }

  if (record.delayReason) return { label: "At risk", issue: record.delayReason };
  return { label: "On track", issue: "No current exception" };
}

function calculateExpectedProgress(record) {
  if (!record.safetyStartDate) return 0;
  const elapsed = daysBetween(parseDate(record.safetyStartDate), todayUtc());
  if (elapsed <= 0) return 0;
  const raw = Math.floor((elapsed / PROJECTION_RULES.certificationFromSafetyStartDays) * 5) * 20;
  return clamp(raw, 0, 100);
}

function sortByRiskAndProjection(a, b) {
  const riskDifference = (RISK_PRIORITY[a.risk.label] ?? 99) - (RISK_PRIORITY[b.risk.label] ?? 99);
  if (riskDifference) return riskDifference;
  const aDate = a.projection.date || "9999-12-31";
  const bDate = b.projection.date || "9999-12-31";
  return aDate.localeCompare(bDate) || a.traineeName.localeCompare(b.traineeName);
}

function riskClass(label) {
  return `status-${label.toLowerCase().replace(/\s+/g, "-")}`;
}

function showView(view, updateHash = true) {
  state.activeView = view;
  document.querySelectorAll(".page-view").forEach((section) => {
    const active = section.dataset.view === view;
    section.hidden = !active;
    section.classList.toggle("is-active", active);
  });
  document.querySelectorAll(".view-tab").forEach((tab) => {
    const active = tab.dataset.viewTarget === view;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  if (updateHash) history.replaceState(null, "", `#${view}`);
  document.getElementById(`${view}-view`)?.focus({ preventScroll: true });
}

function handleEditClick(event) {
  const button = event.target.closest("[data-edit-id]");
  if (!button) return;
  const record = state.trainees.find((item) => item.id === button.dataset.editId);
  if (record) openTraineeDialog(record);
}

function openTraineeDialog(record = null) {
  elements.traineeForm.reset();
  elements.formError.textContent = "";
  elements.traineeDialogTitle.textContent = record ? "Edit trainee" : "Add trainee";
  elements.deleteTraineeButton.classList.toggle("is-hidden", !record);

  if (record) {
    const fields = [
      "id",
      "traineeName",
      "employeeNumber",
      "position",
      "status",
      "source",
      "hireDate",
      "safetyStartDate",
      "assignedOjtDate",
      "trainerName",
      "trainerSchedule",
      "trainingStage",
      "dockTraining",
      "aoaBadge",
      "customsSeal",
      "certificationDate",
      "delayReason",
      "comments",
    ];
    fields.forEach((name) => {
      if (elements.traineeForm.elements[name]) elements.traineeForm.elements[name].value = record[name] ?? "";
    });
    Object.entries(record.milestones || {}).forEach(([name, checked]) => {
      if (elements.traineeForm.elements[name]) elements.traineeForm.elements[name].checked = Boolean(checked);
    });
    elements.traineeForm.querySelectorAll('input[name="aircraft"]').forEach((checkbox) => {
      checkbox.checked = record.aircraft.includes(checkbox.value);
    });
  } else {
    elements.traineeForm.elements.status.value = "Good";
    elements.traineeForm.elements.trainingStage.value = "Not started";
  }

  updateCalculatedFormFields();
  elements.traineeDialog.showModal();
  window.setTimeout(() => elements.traineeForm.elements.traineeName.focus(), 0);
}

function closeTraineeDialog() {
  elements.traineeDialog.close();
}

function updateCalculatedFormFields() {
  const formRecord = recordFromForm(false);
  const projection = calculateProjection(formRecord);
  const hire = parseDate(formRecord.hireDate);
  const safetyStart = parseDate(formRecord.safetyStartDate);
  elements.traineeForm.elements.probationEndDate.value = hire
    ? toIsoDate(addDays(hire, PROJECTION_RULES.probationDays))
    : "";
  elements.traineeForm.elements.safetyEndDate.value = safetyStart
    ? toIsoDate(addDays(safetyStart, PROJECTION_RULES.safetyClassEndOffsetDays))
    : "";
  elements.traineeForm.elements.projectedCertificationDate.value = projection.date;
  elements.projectionBasis.textContent = projection.basis;
}

function recordFromForm(includeMetadata = true) {
  const form = elements.traineeForm;
  const existing = state.trainees.find((record) => record.id === form.elements.id.value);
  const now = new Date().toISOString();
  const record = normalizeRecord({
    id: form.elements.id.value || createId(),
    traineeName: form.elements.traineeName.value,
    employeeNumber: form.elements.employeeNumber.value,
    position: form.elements.position.value,
    status: form.elements.status.value,
    source: form.elements.source.value,
    hireDate: form.elements.hireDate.value,
    safetyStartDate: form.elements.safetyStartDate.value,
    assignedOjtDate: form.elements.assignedOjtDate.value,
    trainerName: form.elements.trainerName.value,
    trainerSchedule: form.elements.trainerSchedule.value,
    trainingStage: form.elements.trainingStage.value,
    dockTraining: form.elements.dockTraining.value,
    aoaBadge: form.elements.aoaBadge.value,
    customsSeal: form.elements.customsSeal.value,
    milestones: {
      week1: form.elements.week1.checked,
      week2: form.elements.week2.checked,
      week3: form.elements.week3.checked,
      week4: form.elements.week4.checked,
      week5: form.elements.week5.checked,
    },
    aircraft: [...form.querySelectorAll('input[name="aircraft"]:checked')].map((input) => input.value),
    certificationDate: form.elements.certificationDate.value,
    delayReason: form.elements.delayReason.value,
    comments: form.elements.comments.value,
    demo: false,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  if (record.certificationDate) {
    record.status = "Certified";
    record.trainingStage = "Certified";
    record.milestones = { week1: true, week2: true, week3: true, week4: true, week5: true };
  }
  if (!includeMetadata) {
    record.createdAt = existing?.createdAt || "";
    record.updatedAt = existing?.updatedAt || "";
  }
  return record;
}

function saveTraineeFromForm(event) {
  event.preventDefault();
  const record = recordFromForm();
  if (!record.traineeName) {
    elements.formError.textContent = "Enter the trainee name before saving.";
    elements.traineeForm.elements.traineeName.focus();
    return;
  }
  if (!record.position) {
    elements.formError.textContent = "Select the trainee position before saving.";
    elements.traineeForm.elements.position.focus();
    return;
  }

  const index = state.trainees.findIndex((item) => item.id === record.id);
  if (index >= 0) state.trainees.splice(index, 1, record);
  else state.trainees.push(record);

  saveLocalData();
  renderAll();
  closeTraineeDialog();
  showToast(index >= 0 ? "Trainee updated. Calculated dates refreshed." : "Trainee added. Calculated dates created.");
}

function deleteCurrentTrainee() {
  const id = elements.traineeForm.elements.id.value;
  const record = state.trainees.find((item) => item.id === id);
  if (!record) return;
  if (!window.confirm(`Delete ${record.traineeName || "this trainee"}? This removes the local record.`)) return;
  state.trainees = state.trainees.filter((item) => item.id !== id);
  saveLocalData();
  renderAll();
  closeTraineeDialog();
  showToast("Trainee record deleted from this device.");
}

function saveLocalData() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: 2, savedAt: new Date().toISOString(), trainees: state.trainees }),
  );
  state.dataMode = "local";
}

function exportJson() {
  const payload = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    projectionRules: PROJECTION_RULES,
    trainees: state.trainees.map(stripDerivedFields),
  };
  downloadFile("trainees.json", JSON.stringify(payload, null, 2), "application/json");
  showToast("JSON exported. Replace data/trainees.json in the repository to publish it.");
}

function exportCsv() {
  const headers = [
    "#",
    "Trainee Name",
    "Employee Number",
    "Position",
    "Status",
    "Source",
    "Hire Date (Or Transfer Date)",
    "Probation End Date",
    "Safety Initial Class Start Date",
    "Safety Initial Class End Date",
    "Dock Training",
    "AOA Badge",
    "Customs Seal",
    "Assigned OJT Date",
    "OJT Trainer Name",
    "OJT Trainer Schedule",
    "Training Stage",
    "WK 1: Initial Class Room Training & Truck Familiarization",
    "WK 2: Off-Site AOA training (if applicable) and Airport Familiarization",
    "WK 3: Full On-the-Job Training (OJT)",
    "WK 4: On-the-Job Training (OJT) / EVALUATION",
    "WK 5: Certification and Training Finalization",
    "Projected Certification Date",
    ...OPTIONS.aircraft,
    "Date of Cert.",
    "Comments",
    "Reason for delay List",
  ];
  const rows = state.trainees.map((record, index) => {
    const projection = calculateProjection(record);
    const hire = parseDate(record.hireDate);
    const safetyStart = parseDate(record.safetyStartDate);
    return [
      index + 1,
      record.traineeName,
      record.employeeNumber,
      record.position,
      record.status,
      record.source,
      record.hireDate,
      hire ? toIsoDate(addDays(hire, PROJECTION_RULES.probationDays)) : "",
      record.safetyStartDate,
      safetyStart ? toIsoDate(addDays(safetyStart, PROJECTION_RULES.safetyClassEndOffsetDays)) : "",
      record.dockTraining,
      record.aoaBadge,
      record.customsSeal,
      record.assignedOjtDate,
      record.trainerName,
      record.trainerSchedule,
      record.trainingStage,
      boolCsv(record.milestones.week1),
      boolCsv(record.milestones.week2),
      boolCsv(record.milestones.week3),
      boolCsv(record.milestones.week4),
      boolCsv(record.milestones.week5),
      projection.date,
      ...OPTIONS.aircraft.map((aircraft) => boolCsv(record.aircraft.includes(aircraft))),
      record.certificationDate,
      record.comments,
      record.delayReason,
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  downloadFile("trainee-tracker.csv", `\uFEFF${csv}`, "text/csv;charset=utf-8");
  showToast("CSV exported with calculated dates included as read-only outputs.");
}

function stripDerivedFields(record) {
  const normalized = normalizeRecord(record);
  return {
    id: normalized.id,
    traineeName: normalized.traineeName,
    employeeNumber: normalized.employeeNumber,
    position: normalized.position,
    status: normalized.status,
    source: normalized.source,
    hireDate: normalized.hireDate,
    safetyStartDate: normalized.safetyStartDate,
    assignedOjtDate: normalized.assignedOjtDate,
    trainerName: normalized.trainerName,
    trainerSchedule: normalized.trainerSchedule,
    trainingStage: normalized.trainingStage,
    dockTraining: normalized.dockTraining,
    aoaBadge: normalized.aoaBadge,
    customsSeal: normalized.customsSeal,
    milestones: normalized.milestones,
    aircraft: normalized.aircraft,
    certificationDate: normalized.certificationDate,
    delayReason: normalized.delayReason,
    comments: normalized.comments,
    demo: normalized.demo,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
  };
}

async function reloadPublishedData() {
  if (state.dataMode === "local" && !window.confirm("Discard local edits and reload the published repository data?")) return;
  localStorage.removeItem(STORAGE_KEY);
  await loadSourceSnapshot();
  await loadPublishedData();
  showToast("Published workbook data reloaded.");
}

async function clearLocalEdits() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    showToast("There are no local edits to clear.");
    return;
  }
  if (!window.confirm("Clear locally saved dashboard edits from this browser?")) return;
  localStorage.removeItem(STORAGE_KEY);
  await loadPublishedData();
  showToast("Local edits cleared. Published data restored.");
}

function downloadFile(filename, contents, mimeType) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3800);
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const normalized = normalizeDateString(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function normalizeDateString(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return toIsoDate(value);
  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf()) ? "" : toIsoDate(parsed);
}

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function addDays(date, days) {
  const result = new Date(date.valueOf());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function daysBetween(start, end) {
  return Math.floor((end.valueOf() - start.valueOf()) / 86_400_000);
}

function weekEndingThursday(date) {
  const day = date.getUTCDay();
  const offset = (4 - day + 7) % 7;
  return addDays(date, offset);
}

function toIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatDate(value, options = {}) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "—";
  const { omitYear = false, ...dateOptions } = options;
  const formatOptions = {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...dateOptions,
  };
  if (!omitYear) formatOptions.year = dateOptions.year ?? "numeric";
  return new Intl.DateTimeFormat("en-US", formatOptions).format(date);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function signedNumber(value) {
  if (!Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function normalizeYesNo(value) {
  const text = cleanText(value).toLowerCase();
  if (["y", "yes", "true", "1", "complete", "completed"].includes(text)) return "Y";
  if (["n", "no", "false", "0", "incomplete"].includes(text)) return "N";
  if (["not required", "n/a", "na"].includes(text)) return "Not required";
  return "";
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = cleanText(value).toLowerCase();
  if (!text || ["n", "no", "false", "0", "not started", "incomplete"].includes(text)) return false;
  return true;
}

function cleanText(value) {
  return value == null ? "" : String(value).trim();
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function boolCsv(value) {
  return value ? "Y" : "N";
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function createId(prefix = "trainee") {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
