const fs = require("fs");
const path = require("path");

const ROOTS = [
  path.join("app", "admin"),
  "components",
];

const HELP_FILE = path.join("lib", "fieldHelpData.ts");

const IGNORE_LABELS = new Set([
  "סגור",
  "סגור תפריט",
  "פתח תפריט",
  "Open AI Assistant",
  "צפיה",
  "עריכה",
  "חיפוש",
  "בחר חודש",
  "DD/MM/YY",
]);

function normalizeLabel(label) {
  return label
    .replace(/<[^>]+>/g, " ")
    .replace(/\{[^}]+\}/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/\\/g, "")
    .replace(/[״“”]/g, "\"")
    .replace(/\*/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\((אופציונלי|מומלץ)\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*$/g, "")
    .trim();
}

function isCodeArtifact(label) {
  return [
    "className=",
    "e.target",
    "=>",
    "/>",
    "setTenantMode(",
    "setDeleteLogo(",
    "setPurgeAuditLogs(",
    "handleGroupChange(",
    ")`",
  ].some((token) => label.includes(token));
}

function walk(dir, files) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

function extractLabels(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const labels = [];

  for (const match of text.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)) {
    const normalized = normalizeLabel(match[1]);
    if (normalized) labels.push(normalized);
  }

  for (const match of text.matchAll(/(?:aria-label|data-field-label)=\\"([^\\"]+)\\"/g)) {
    const normalized = normalizeLabel(match[1]);
    if (normalized) labels.push(normalized);
  }

  for (const match of text.matchAll(/(?:aria-label|data-field-label)="([^"]+)"/g)) {
    const normalized = normalizeLabel(match[1]);
    if (normalized) labels.push(normalized);
  }

  return labels;
}

function extractHelpKeys() {
  const text = fs.readFileSync(HELP_FILE, "utf8");
  return new Set(
    [...text.matchAll(/^\s*"([^"]+)":\s*\{/gm)]
      .map((match) => normalizeLabel(match[1]))
      .filter(Boolean),
  );
}

const files = [];
for (const root of ROOTS) walk(root, files);

const helpKeys = extractHelpKeys();
const missing = new Map();

for (const filePath of files) {
  const labels = extractLabels(filePath);
  for (const label of labels) {
    if (!label || isCodeArtifact(label) || IGNORE_LABELS.has(label) || helpKeys.has(label)) continue;
    if (!missing.has(label)) missing.set(label, new Set());
    missing.get(label).add(filePath);
  }
}

if (missing.size === 0) {
  console.log("Field help audit passed: all detected labels have F1 help.");
  process.exit(0);
}

console.error("Field help audit failed. Missing help entries for:");
for (const [label, filePaths] of [...missing.entries()].sort((a, b) => a[0].localeCompare(b[0], "he"))) {
  console.error(`- ${label}`);
  console.error(`  ${[...filePaths][0]}`);
}

process.exit(1);
