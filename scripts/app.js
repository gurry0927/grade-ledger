const STORAGE_KEY = "grade-ledger.records.v1";
const SETTINGS_KEY = "grade-ledger.settings.v1";

const SUBJECTS = [
  { id: "國文", label: "國文" },
  { id: "英文", label: "英文" },
  { id: "數學", label: "數學" },
  { id: "歷史", label: "歷史" },
  { id: "地理", label: "地理" },
  { id: "公民", label: "公民" },
  { id: "社會", label: "社會（合科）" },
  { id: "物理", label: "物理" },
  { id: "化學", label: "化學" },
  { id: "生物", label: "生物" },
  { id: "地科", label: "地科" },
  { id: "理化", label: "理化（合科）" },
  { id: "自然", label: "自然（合科）" },
];

const RADAR_MODES = {
  combined: ["國文", "英文", "數學", "社會", "自然"],
  split: ["國文", "英文", "數學", "歷史", "地理", "公民", "物理", "化學", "生物", "地科"],
};

const DEFAULT_SETTINGS = {
  profileName: "我",
  theme: "soft",
  radarMode: "combined",
};

const THEME_COLORS = {
  soft: "#f6eef4",
  "soft-blue": "#eef4fb",
  "soft-yellow": "#faf3df",
  "soft-green": "#edf7ef",
  tech: "#090d16",
  plain: "#f7f7f4",
};

const form = document.querySelector("#scoreForm");
const subjectSelect = document.querySelector("#subject");
const recordsList = document.querySelector("#recordsList");
const radarMode = document.querySelector("#radarMode");
const trendSubject = document.querySelector("#trendSubject");
const trendSubjectMode = document.querySelector("#trendSubjectMode");
const trendType = document.querySelector("#trendType");
const recordTypeFilter = document.querySelector("#recordTypeFilter");
const searchInput = document.querySelector("#searchInput");
const importFile = document.querySelector("#importFile");
const cancelEdit = document.querySelector("#cancelEdit");
const saveButton = document.querySelector("#saveButton");
const profileNameInput = document.querySelector("#profileName");
const themeSelect = document.querySelector("#themeSelect");
const settingsButton = document.querySelector("#settingsButton");
const settingsPanel = document.querySelector("#settingsPanel");

let records = loadRecords();
let settings = loadSettings();
let editingId = null;

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function profileName() {
  return settings.profileName.trim() || "我";
}

function currentRecords() {
  const name = profileName();
  return records.filter((record) => (record.studentName || "我") === name);
}

function percent(record) {
  return record.maxScore > 0 ? (record.score / record.maxScore) * 100 : 0;
}

function rounded(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits).replace(/\.0$/, "") : "-";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function subjectLabel(subjectId) {
  return SUBJECTS.find((subject) => subject.id === subjectId)?.label ?? subjectId;
}

function subjectTargets(subjectId, mode) {
  if (mode === "split") {
    if (subjectId === "社會") return ["歷史", "地理", "公民"];
    if (subjectId === "自然") return ["物理", "化學", "生物", "地科"];
    if (subjectId === "理化") return ["物理", "化學"];
    return [subjectId];
  }

  if (["歷史", "地理", "公民", "社會"].includes(subjectId)) return ["社會"];
  if (["物理", "化學", "理化", "生物", "地科", "自然"].includes(subjectId)) return ["自然"];
  return [subjectId];
}

function relatedSubjects(subjectId) {
  if (subjectId === "all") return null;
  if (["歷史", "地理", "公民", "社會"].includes(subjectId)) return new Set(["社會", "歷史", "地理", "公民"]);
  if (["物理", "化學", "理化"].includes(subjectId)) return new Set(["自然", "理化", "物理", "化學"]);
  if (subjectId === "自然") return new Set(["自然", "理化", "物理", "化學", "生物", "地科"]);
  if (["生物", "地科"].includes(subjectId)) return new Set(["自然", subjectId]);
  return new Set([subjectId]);
}

function average(values) {
  if (!values.length) return NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function latestBySubject(source, mode = "combined") {
  const axes = RADAR_MODES[mode] ?? RADAR_MODES.combined;
  const map = new Map();

  for (const record of [...source].sort((a, b) => a.examDate.localeCompare(b.examDate))) {
    for (const axis of subjectTargets(record.subject, mode)) {
      if (!axes.includes(axis)) continue;
      if (!map.has(axis)) map.set(axis, []);
      map.get(axis).push(percent(record));
    }
  }

  return axes.map((axis) => {
    const recent = (map.get(axis) ?? []).slice(-3);
    return { axis, value: average(recent) };
  });
}

function populateSubjects() {
  subjectSelect.innerHTML = SUBJECTS.map((subject) => `<option value="${subject.id}">${subject.label}</option>`).join("");
  trendSubject.innerHTML = [
    '<option value="all">全部科目</option>',
    ...SUBJECTS.map((subject) => `<option value="${subject.id}">${subject.label}</option>`),
  ].join("");
}

function applySettings() {
  document.documentElement.dataset.theme = settings.theme;
  profileNameInput.value = profileName();
  themeSelect.value = settings.theme;
  radarMode.value = settings.radarMode;
  document.querySelector("#studentName").value = profileName();
  document.querySelector("#profileLabel").textContent = `${profileName()} 的近況`;
  document.querySelector("meta[name='theme-color']").setAttribute("content", THEME_COLORS[settings.theme] ?? THEME_COLORS.soft);
}

function updateSummary() {
  const source = currentRecords();
  document.querySelector("#recordCount").textContent = `${source.length} 筆`;
  const recent = [...source].sort((a, b) => b.examDate.localeCompare(a.examDate)).slice(0, 8).map(percent);
  document.querySelector("#latestAverage").textContent = recent.length ? `${rounded(average(recent))}%` : "-";

  const available = latestBySubject(source, settings.radarMode).filter((item) => Number.isFinite(item.value));
  available.sort((a, b) => b.value - a.value);
  document.querySelector("#bestSubject").textContent = available[0] ? `${available[0].axis} ${rounded(available[0].value)}%` : "-";
  document.querySelector("#watchSubject").textContent = available.at(-1) ? `${available.at(-1).axis} ${rounded(available.at(-1).value)}%` : "-";
  document.querySelector("#radarModeLabel").textContent = settings.radarMode === "split" ? "拆分細科" : "合併五軸";
}

function drawRadar() {
  const canvas = document.querySelector("#radarChart");
  const ctx = canvas.getContext("2d");
  const data = latestBySubject(currentRecords(), settings.radarMode);
  const axes = data.map((item) => item.axis);
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2 + 8;
  const radius = Math.min(width, height) * (axes.length > 6 ? 0.29 : 0.34);
  const styles = getComputedStyle(document.documentElement);
  const ink = styles.getPropertyValue("--ink").trim();
  const line = styles.getPropertyValue("--line").trim();
  const accent = styles.getPropertyValue("--accent").trim();
  const accent2 = styles.getPropertyValue("--accent-2").trim();

  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 1;
  ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";

  for (let level = 1; level <= 5; level += 1) {
    const r = (radius * level) / 5;
    ctx.beginPath();
    axes.forEach((axis, index) => {
      const point = polarPoint(centerX, centerY, r, index, axes.length);
      index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.strokeStyle = line;
    ctx.stroke();
  }

  axes.forEach((axis, index) => {
    const outer = polarPoint(centerX, centerY, radius, index, axes.length);
    const label = polarPoint(centerX, centerY, radius + (axes.length > 6 ? 30 : 34), index, axes.length);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(outer.x, outer.y);
    ctx.strokeStyle = line;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textAlign = label.x < centerX - 8 ? "right" : label.x > centerX + 8 ? "left" : "center";
    ctx.textBaseline = "middle";
    ctx.fillText(axis, label.x, label.y);
  });

  ctx.beginPath();
  data.forEach((item, index) => {
    const value = Number.isFinite(item.value) ? item.value : 0;
    const point = polarPoint(centerX, centerY, radius * (value / 100), index, data.length);
    index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fillStyle = colorWithAlpha(accent, 0.22);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();

  data.forEach((item, index) => {
    const value = Number.isFinite(item.value) ? item.value : 0;
    const point = polarPoint(centerX, centerY, radius * (value / 100), index, data.length);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = accent2;
    ctx.fill();
  });
}

function polarPoint(centerX, centerY, radius, index, total) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
  };
}

function drawTrend() {
  const canvas = document.querySelector("#trendChart");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 28, right: 24, bottom: 46, left: 46 };
  const styles = getComputedStyle(document.documentElement);
  const ink = styles.getPropertyValue("--ink").trim();
  const muted = styles.getPropertyValue("--muted").trim();
  const line = styles.getPropertyValue("--line").trim();
  const accent = styles.getPropertyValue("--accent").trim();
  const warn = styles.getPropertyValue("--warn").trim();
  const source = currentRecords()
    .filter((record) => {
      if (trendSubject.value === "all") return true;
      if (trendSubjectMode.value === "exact") return record.subject === trendSubject.value;
      return relatedSubjects(trendSubject.value).has(record.subject);
    })
    .filter((record) => trendType.value === "all" || record.examType === trendType.value)
    .sort((a, b) => a.examDate.localeCompare(b.examDate));

  ctx.clearRect(0, 0, width, height);
  ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;

  for (let score = 0; score <= 100; score += 20) {
    const y = scale(score, 0, 100, height - padding.bottom, padding.top);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.textAlign = "right";
    ctx.fillText(String(score), padding.left - 8, y + 5);
  }

  if (!source.length) {
    ctx.fillStyle = muted;
    ctx.textAlign = "center";
    ctx.fillText("還沒有符合條件的紀錄", width / 2, height / 2);
    return;
  }

  const points = source.map((record, index) => ({
    x: source.length === 1 ? width / 2 : scale(index, 0, source.length - 1, padding.left, width - padding.right),
    y: scale(percent(record), 0, 100, height - padding.bottom, padding.top),
    record,
  }));

  ctx.beginPath();
  points.forEach((point, index) => {
    index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();

  points.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = point.record.examType === "模擬考" ? accent : warn;
    ctx.fill();

    if (index === 0 || index === points.length - 1 || points.length <= 7) {
      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.fillText(rounded(percent(point.record), 0), point.x, point.y - 12);
      ctx.fillStyle = muted;
      ctx.fillText(point.record.examDate.slice(5), point.x, height - 20);
    }
  });
}

function scale(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return (outMin + outMax) / 2;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function renderRecords() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = currentRecords()
    .filter((record) => recordTypeFilter.value === "all" || record.examType === recordTypeFilter.value)
    .filter((record) => {
      const haystack = `${record.subject} ${subjectLabel(record.subject)} ${record.note}`.toLowerCase();
      return !query || haystack.includes(query);
    })
    .sort((a, b) => b.examDate.localeCompare(a.examDate))
    .slice(0, 12);

  if (!filtered.length) {
    recordsList.innerHTML = '<div class="empty-state">還沒有成績紀錄</div>';
    return;
  }

  recordsList.innerHTML = filtered.map((record) => `
    <article class="record-item">
      <div class="record-main">
        <div class="record-title">
          <span class="badge">${escapeHtml(record.examType)}</span>
          <span>${escapeHtml(subjectLabel(record.subject))}</span>
        </div>
        <div class="record-meta">${escapeHtml(record.examDate)} · ${escapeHtml(record.score)} / ${escapeHtml(record.maxScore)}</div>
        ${record.note ? `<div class="record-note">${escapeHtml(record.note)}</div>` : ""}
      </div>
      <div class="record-score">
        <strong>${rounded(percent(record))}%</strong>
        <div class="record-actions">
          <button type="button" class="ghost-button" data-edit="${record.id}">編輯</button>
          <button type="button" class="ghost-button" data-delete="${record.id}">刪除</button>
        </div>
      </div>
    </article>
  `).join("");
}

function updateShareCard() {
  const source = currentRecords().sort((a, b) => a.examDate.localeCompare(b.examDate));
  const recent = source.slice(-6);
  const recentAverage = average(recent.map(percent));
  const axes = latestBySubject(source, settings.radarMode).filter((item) => Number.isFinite(item.value)).sort((a, b) => b.value - a.value);

  document.querySelector("#shareScore").textContent = recent.length ? rounded(recentAverage, 0) : "-";
  document.querySelector("#shareText").textContent = recent.length
    ? `最近 ${recent.length} 筆平均 ${rounded(recentAverage)}%。${axes[0]?.axis ?? "-"}目前比較穩，${axes.at(-1)?.axis ?? "-"}可以再多看幾次。`
    : "先記一筆分數，這裡會變成你的能力曲線摘要。";
}

function refresh() {
  applySettings();
  updateSummary();
  drawTrend();
  drawRadar();
  renderRecords();
  updateShareCard();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function colorWithAlpha(color, alpha) {
  const scratch = document.createElement("canvas").getContext("2d");
  scratch.fillStyle = color;
  const normalized = scratch.fillStyle;
  if (!normalized.startsWith("#") || normalized.length !== 7) return color;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function recordFromForm() {
  const formData = new FormData(form);
  const score = Number(formData.get("score"));
  const maxScore = Number(formData.get("maxScore"));

  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) {
    throw new Error("請確認分數介於 0 到滿分之間。");
  }

  return {
    id: editingId ?? crypto.randomUUID(),
    studentName: profileName(),
    examDate: String(formData.get("examDate")),
    examType: String(formData.get("examType")),
    subject: String(formData.get("subject")),
    score,
    maxScore,
    note: String(formData.get("note")).trim(),
    updatedAt: new Date().toISOString(),
  };
}

function resetForm() {
  editingId = null;
  form.reset();
  document.querySelector("#examDate").value = today();
  document.querySelector("#maxScore").value = "100";
  document.querySelector("#studentName").value = profileName();
  cancelEdit.hidden = true;
  saveButton.textContent = "儲存";
}

function editRecord(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;

  editingId = id;
  form.examDate.value = record.examDate;
  form.examType.value = record.examType;
  form.subject.value = record.subject;
  form.score.value = record.score;
  form.maxScore.value = record.maxScore;
  form.note.value = record.note ?? "";
  cancelEdit.hidden = false;
  saveButton.textContent = "更新";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteRecord(id) {
  records = records.filter((record) => record.id !== id);
  saveRecords();
  refresh();
}

function exportCsv() {
  const header = ["studentName", "examDate", "examType", "subject", "score", "maxScore", "note"];
  const rows = records.map((record) => header.map((key) => csvCell(record[key])).join(","));
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `成績帳本-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function parseCsv(text) {
  const rows = [];
  let cell = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function importCsv(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(String(reader.result).replace(/^\ufeff/, ""));
    const header = rows.shift();
    if (!header) return;
    const imported = rows.map((row) => {
      const item = Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""]));
      return {
        id: crypto.randomUUID(),
        studentName: item.studentName || profileName(),
        examDate: item.examDate,
        examType: item.examType,
        subject: item.subject,
        score: Number(item.score),
        maxScore: Number(item.maxScore),
        note: item.note,
        updatedAt: new Date().toISOString(),
      };
    }).filter((record) => record.studentName && record.examDate && record.subject && Number.isFinite(record.score));

    records = [...records, ...imported];
    saveRecords();
    refresh();
    importFile.value = "";
  };
  reader.readAsText(file);
}

function loadDemo() {
  const name = profileName();
  const demo = [
    ["2026-05-10", "模擬考", "國文", 72],
    ["2026-05-10", "模擬考", "英文", 68],
    ["2026-05-10", "模擬考", "數學", 61],
    ["2026-05-10", "模擬考", "社會", 78],
    ["2026-05-10", "模擬考", "自然", 58],
    ["2026-06-15", "段考", "數學", 70],
    ["2026-06-15", "段考", "歷史", 82],
    ["2026-06-15", "段考", "地理", 74],
    ["2026-06-15", "段考", "公民", 79],
    ["2026-06-15", "段考", "理化", 64],
    ["2026-07-02", "小考", "生物", 71],
    ["2026-07-02", "小考", "地科", 69],
    ["2026-07-20", "練習卷", "數學", 76],
    ["2026-07-20", "練習卷", "理化", 72],
  ];

  records = records.filter((record) => record.studentName !== name);
  records = [
    ...records,
    ...demo.map(([examDate, examType, subject, score], index) => ({
      id: `demo-${index}-${crypto.randomUUID()}`,
      studentName: name,
      examDate,
      examType,
      subject,
      score,
      maxScore: 100,
      note: examType === "模擬考" ? "範例資料" : "",
      updatedAt: new Date().toISOString(),
    })),
  ];
  saveRecords();
  refresh();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const record = recordFromForm();
    records = editingId
      ? records.map((item) => (item.id === editingId ? record : item))
      : [...records, record];
    saveRecords();
    resetForm();
    refresh();
  } catch (error) {
    alert(error.message);
  }
});

recordsList.addEventListener("click", (event) => {
  const editId = event.target.closest("[data-edit]")?.dataset.edit;
  const deleteId = event.target.closest("[data-delete]")?.dataset.delete;
  if (editId) editRecord(editId);
  if (deleteId) deleteRecord(deleteId);
});

settingsButton.addEventListener("click", () => {
  const isOpen = !settingsPanel.hidden;
  settingsPanel.hidden = isOpen;
  settingsButton.setAttribute("aria-expanded", String(!isOpen));
});

profileNameInput.addEventListener("change", () => {
  settings.profileName = profileNameInput.value.trim() || "我";
  saveSettings();
  resetForm();
  refresh();
});

themeSelect.addEventListener("input", () => {
  settings.theme = themeSelect.value;
  saveSettings();
  refresh();
});

radarMode.addEventListener("input", () => {
  settings.radarMode = radarMode.value;
  saveSettings();
  refresh();
});

for (const element of [trendSubject, trendSubjectMode, trendType, recordTypeFilter, searchInput]) {
  element.addEventListener("input", refresh);
}

cancelEdit.addEventListener("click", resetForm);
document.querySelector("#exportButton").addEventListener("click", exportCsv);
document.querySelector("#resetDemo").addEventListener("click", loadDemo);
document.querySelector("#copySummary").addEventListener("click", async () => {
  const text = `${profileName()} 的成績近況\n${document.querySelector("#shareText").textContent}`;
  await navigator.clipboard?.writeText(text);
});
importFile.addEventListener("change", () => {
  if (importFile.files[0]) importCsv(importFile.files[0]);
});

populateSubjects();
applySettings();
resetForm();
if (!currentRecords().length) loadDemo();
refresh();
