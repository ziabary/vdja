import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = process.cwd();
const reportsDir = join(repoRoot, "docs/reports");
const stateDir = join(repoRoot, ".git", "activity-report");
const requiredSections = [
  "Purpose and Scope",
  "Governing Sources",
  "Initial Repository State",
  "Pre-existing Workspace Changes",
  "Files Added",
  "Files Modified",
  "Files Deleted",
  "Implementation Summary",
  "Architecture Decisions / Deviations",
  "Tests and Verification",
  "Expected Failures",
  "Unexpected Failures",
  "Production Code Changes",
  "Final Repository State",
  "Acceptance Criteria",
  "Open Issues",
] as const;

function slugifyPurpose(value: string): string {
  return value.trim();
}

export function validatePurpose(value: string): string {
  const normalized = slugifyPurpose(value);
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(normalized)) {
    throw new Error(`Invalid PURPOSE '${value}'. Use uppercase ASCII kebab-case, e.g. ARCHITECTURE-GUARDRAILS.`);
  }
  return normalized;
}

function ensureReportDirectory(): void {
  mkdirSync(reportsDir, { recursive: true });
  mkdirSync(stateDir, { recursive: true });
}

function nowStamp(): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const part = (name: string): string => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}${part("month")}${part("day")}-${part("hour")}${part("minute")}`;
}

function getCurrentReportPath(): string | null {
  const markerPath = join(stateDir, "current-report.txt");
  if (!existsSync(markerPath)) return null;
  const value = readFileSync(markerPath, "utf8").trim();
  return value || null;
}

function setCurrentReportPath(path: string): void {
  const markerPath = join(stateDir, "current-report.txt");
  writeFileSync(markerPath, path, "utf8");
}

function gitStatusPorcelain(): string {
  return execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all", "--", "."], { cwd: repoRoot, encoding: "utf8" }).trimEnd();
}

function ensureNoOverwrite(target: string): void {
  if (existsSync(target)) {
    throw new Error(`Report already exists: ${target}`);
  }
}

export function ensureFilenameFormat(value: string): void {
  const fileBase = value.split("/").pop() ?? value;
  if (!/^\d{8}-\d{4}-[A-Z0-9]+(?:-[A-Z0-9]+)*\.md$/.test(fileBase)) {
    throw new Error(`Filename does not match required format: ${fileBase}`);
  }
}

function readReport(path: string): string {
  return readFileSync(path, "utf8");
}

function sectionExists(reportText: string, sectionName: string): boolean {
  return reportText.includes(`## ${sectionName}`) || reportText.includes(`# ${sectionName}`);
}

export function collectPathsFromGitStatus(rawStatus: string, repositoryPrefix = "ui/"): Set<string> {
  const paths = new Set<string>();
  const normalizeStatusPath=(candidate:string):string=>{
    const decoded=candidate.startsWith('"')?JSON.parse(candidate) as string:candidate;
    return normalizeRepositoryPath(decoded.startsWith(repositoryPrefix)?decoded.slice(repositoryPrefix.length):decoded);
  };
  for (const line of rawStatus.split(/\r?\n/).filter(Boolean)) {
    const status = line.slice(0, 2);
    const candidate = line.slice(3).trim();
    if (!candidate) continue;
    if (candidate === "" || candidate === "-" || candidate === "--") continue;
    if (status.includes("R") || status.includes("C")) {
      const renamed = candidate.split(" -> ").pop() ?? candidate;
      paths.add(normalizeStatusPath(renamed));
    } else {
      paths.add(normalizeStatusPath(candidate));
    }
  }
  return paths;
}

function sectionBody(reportText: string, sectionName: string): string {
  const heading = `## ${sectionName}\n`;
  const start = reportText.indexOf(heading);
  if (start < 0) throw new Error(`Required report section missing: ${sectionName}`);
  const bodyStart = start + heading.length;
  const next = reportText.indexOf("\n## ", bodyStart);
  return reportText.slice(bodyStart, next < 0 ? undefined : next).trim();
}

export function normalizeRepositoryPath(value: string): string {
  const decoded=value.startsWith('"') ? JSON.parse(value) as string : value;
  const path=decoded.replaceAll("\\","/");
  if(!path||path.startsWith("/")||/^[A-Za-z]:\//.test(path)||path.split("/").some(part=>part===".."||part==="."||part===""))throw new Error(`Invalid repository-relative file path: ${value}`);
  return path;
}

export function listedPaths(body: string): Set<string> {
  const paths = new Set<string>();
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^[-*]\s+(?:`([^`]+)`|(\S+))(?:\s|$)/);
    if(match&&match[1]!=="None."&&match[2]!=="None."&&!line.includes("Not yet recorded"))paths.add(normalizeRepositoryPath(match[1]??match[2]!));
  }
  return paths;
}

export function validFinalStatus(value:string):boolean {return ["COMPLETE","PARTIAL","BLOCKED"].includes(value);}

function finalizeCommand(): void {
  const status = process.argv[3];
  if (!status || !validFinalStatus(status)) throw new Error("report:finalize accepts only COMPLETE, PARTIAL, or BLOCKED.");
  const reportPath = getCurrentReportPath();
  if (!reportPath || !existsSync(reportPath)) throw new Error("No current activity report exists.");
  const reportText = readReport(reportPath);
  if (!reportText.includes("- Status: IN_PROGRESS")) throw new Error("Only an IN_PROGRESS report may be finalized.");
  writeFileSync(reportPath, reportText.replace("- Status: IN_PROGRESS", `- Status: ${status}`), "utf8");
  console.log(`Finalized report: ${reportPath} (${status})`);
}

function startCommand(): void {
  ensureReportDirectory();
  const purposeArg = process.argv[3];
  if (!purposeArg) {
    throw new Error("Missing required PURPOSE argument: report:start <PURPOSE>");
  }

  const purpose = validatePurpose(purposeArg);
  const stamp = nowStamp();
  const reportPath = join(reportsDir, `${stamp}-${purpose}.md`);
  ensureNoOverwrite(reportPath);

  const status = gitStatusPorcelain();
  const currentReportPath = getCurrentReportPath();
  if (currentReportPath && existsSync(currentReportPath)) {
    throw new Error(`A current report already exists: ${currentReportPath}. Finalize and verify it before starting a new task.`);
  }

  const initialBody = [
    `# Activity Report: ${purpose}`,
    "",
    `- Report Path: ${reportPath}`,
    `- Created At: ${new Date().toISOString()}`,
    `- Status: IN_PROGRESS`,
    "",
    "## Purpose and Scope",
    "",
    `- Purpose: ${purpose}`,
    "- Scope: Repository-modifying task for architecture guardrails and conformance enforcement.",
    "",
    "## Governing Sources",
    "",
    "- AGENTS.md",
    "- docs/architecture/00-manifest.md",
    "- docs/architecture/01-system-architecture.md",
    "- docs/architecture/02-engineering-conventions.md",
    "- docs/architecture/03-persistence-and-database.md",
    "- docs/architecture/04-authorization-model.md",
    "- docs/architecture/05-module-architecture.md",
    "- docs/architecture/06-document-and-rag.md",
    "- docs/architecture/07-ai-router.md",
    "- docs/architecture/08-deployment-architecture.md",
    "- docs/architecture/09-notification-and-ticketing.md",
    "- docs/architecture/10-commercial-architecture.md",
    "",
    "## Initial Repository State",
    "",
    "- Repository baseline at task start.",
    "- The repo is a legacy monorepo-like application workspace with target architecture folders present but not yet implemented as canonical manifests/contracts.",
    "",
    "## Pre-existing Workspace Changes",
    "",
    "- Not yet inspected.",
    "",
    "## Files Added",
    "",
    "- Not yet recorded.",
    "",
    "## Files Modified",
    "",
    "- Not yet recorded.",
    "",
    "## Files Deleted",
    "",
    "- Not yet recorded.",
    "",
    "## Implementation Summary",
    "",
    "- Task started with red-first architecture guardrails and repository activity tracking.",
    "",
    "## Architecture Decisions / Deviations",
    "",
    "- No production implementation was added.",
    "- Red-first guardrails intentionally describe the target architecture rather than legacy behavior.",
    "",
    "## Tests and Verification",
    "",
    "- Not yet executed.",
    "",
    "## Expected Failures",
    "",
    "- Missing target package manifests and module manifests are expected red results.",
    "",
    "## Unexpected Failures",
    "",
    "- None recorded yet.",
    "",
    "## Production Code Changes",
    "",
    "- None recorded; production code remains untouched.",
    "",
    "## Final Repository State",
    "",
    "- Initial git-status capture recorded below.",
    "",
    "```text",
    status || "(no tracked changes at task start)",
    "```",
    "",
    "## Acceptance Criteria",
    "",
    "- The reported change set is documented and verified.",
    "- The repository remains in a red-first guardrail state until the target architecture is implemented.",
    "",
    "## Open Issues",
    "",
    "- Target architecture manifests and package contracts are intentionally absent and expected to fail against the guardrails.",
    "",
    "---",
    "",
    "Generated by scripts/activity-report.ts",
    "",
  ].join("\n");

  writeFileSync(reportPath, initialBody, "utf8");
  setCurrentReportPath(reportPath);
  console.log(reportPath);
}

function verifyCommand(): void {
  ensureReportDirectory();
  const currentReport = getCurrentReportPath();
  if (!currentReport) {
    throw new Error("No current activity report exists.");
  }
  if (!existsSync(currentReport)) {
    throw new Error(`Current activity report not found: ${currentReport}`);
  }
  ensureFilenameFormat(currentReport);

  const reportText = readReport(currentReport);
  for (const section of requiredSections) {
    if (!sectionExists(reportText, section)) {
      throw new Error(`Required report section missing: ${section}`);
    }
  }

  const status = reportText.match(/^- Status: (\S+)$/m)?.[1];
  if (!status || !validFinalStatus(status)) throw new Error(`Invalid final report status: ${status ?? "(missing)"}`);

  const finalStatus = gitStatusPorcelain();
  const statusPaths = collectPathsFromGitStatus(finalStatus);
  const added = listedPaths(sectionBody(reportText, "Files Added"));
  const modified = listedPaths(sectionBody(reportText, "Files Modified"));
  const deleted = listedPaths(sectionBody(reportText, "Files Deleted"));
  const preExisting = listedPaths(sectionBody(reportText, "Pre-existing Workspace Changes"));
  const accounted = new Set([...added,...modified,...deleted,...preExisting]);
  const reportRelative = relative(repoRoot,currentReport).replaceAll("\\","/");
  if (!added.has(reportRelative) && !modified.has(reportRelative)) throw new Error(`Current report must appear as a file in Files Added or Files Modified: ${reportRelative}`);
  for (const path of statusPaths) {
    if (!accounted.has(path)) {
      throw new Error(`Final git status path is not accounted for in the report: ${path}`);
    }
  }
  for(const line of finalStatus.split(/\r?\n/)){
    if(!line || !line.slice(0,2).includes("D"))continue;
    const raw=line.slice(3).trim();
    const path=[...collectPathsFromGitStatus(line)][0];
    if(!path)throw new Error(`Deleted status path missing: ${raw}`);
    if(!deleted.has(path)&&!preExisting.has(path))throw new Error(`Unexplained deleted file: ${path}`);
  }
  const tests = sectionBody(reportText,"Tests and Verification");
  if(!/\b(?:exit|PASS|FAIL)\b/i.test(tests)||/Not yet executed/i.test(tests))throw new Error("Tests and Verification is placeholder or lacks results.");
  const acceptance=sectionBody(reportText,"Acceptance Criteria");
  if(!/\|\s*Criterion\s*\|\s*Result\s*\|\s*Evidence\s*\|/.test(acceptance)||!/^\|\s*\d+\s*\|\s*(?:PASS|FAIL|NOT_APPLICABLE)\s*\|/m.test(acceptance))throw new Error("Acceptance Criteria must contain a numbered result table.");

  const reportStats = statSync(currentReport);
  const createdAt=reportText.match(/^- Created At: (.+)$/m)?.[1];
  if(!createdAt||reportStats.mtimeMs<=new Date(createdAt).getTime())throw new Error("Report was not modified during this task.");

  unlinkSync(join(stateDir, "current-report.txt"));
  console.log(`Verified report: ${currentReport}`);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const command = process.argv[2];
  try {
    if (command === "start") startCommand();
    else if (command === "verify") verifyCommand();
    else if (command === "finalize") finalizeCommand();
    else throw new Error(`Unknown command: ${command || "(none)"}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
