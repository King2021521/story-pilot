/* global console, process */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const specsDir = resolve(repoRoot, "docs/specs/production-readiness");

const requiredFiles = [
  "README.md",
  "00-production-readiness-roadmap.md",
  "01-runtime-config-release-spec.md",
  "02-creative-gates-data-integrity-spec.md",
  "03-ai-workflow-prompt-evaluation-spec.md",
  "04-longform-outline-plot-engine-spec.md",
  "05-memory-knowledge-graph-continuity-spec.md",
  "06-chapter-production-editor-spec.md",
  "07-production-qa-performance-ops-spec.md",
  "08-validation-traceability-matrix.md",
  "09-production-reinforcement-plan.md",
];

const requiredSpecSections = [
  "## 目标",
  "## 当前缺口",
  "## 范围",
  "## 当前可复用实现",
  "## 实施切片",
  "## 测试用例",
  "## 阶段验证清单",
  "## 验收标准",
];

const forbiddenPatterns = [/\bTBD\b/u, /\bTODO\b/u, /待定/u, /以后再/u, /后续实现/u, /占位/u];

const failures = [];

for (const file of requiredFiles) {
  const path = resolve(specsDir, file);
  if (!existsSync(path)) {
    failures.push(`Missing required spec file: ${file}`);
  }
}

for (const file of requiredFiles.filter((name) => name.endsWith(".md"))) {
  const path = resolve(specsDir, file);
  if (!existsSync(path)) {
    continue;
  }

  const content = readFileSync(path, "utf8");
  checkForbiddenPatterns(file, content);
  checkLocalLinks(file, content);

  if (/^\d{2}-.*-spec\.md$/u.test(file)) {
    for (const section of requiredSpecSections) {
      if (!content.includes(section)) {
        failures.push(`${file} missing section: ${section}`);
      }
    }
  }
}

const readme = readFile("README.md");
if (readme) {
  for (const file of requiredFiles.filter((name) => name !== "README.md")) {
    if (!readme.includes(`./${file}`)) {
      failures.push(`README.md missing link to ${file}`);
    }
  }
}

const traceability = readFile("08-validation-traceability-matrix.md");
if (traceability) {
  for (const phase of ["P0", "P1", "P2", "P3", "P4", "P5", "P6"]) {
    const heading = `## ${phase} 追踪矩阵`;
    if (!traceability.includes(heading)) {
      failures.push(`08-validation-traceability-matrix.md missing ${heading}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Production readiness spec verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Verified ${requiredFiles.length} production readiness spec files.`);

function readFile(file) {
  const path = resolve(specsDir, file);
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

function checkForbiddenPatterns(file, content) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) {
      failures.push(`${file} contains forbidden placeholder pattern: ${pattern}`);
    }
  }
}

function checkLocalLinks(file, content) {
  const path = resolve(specsDir, file);
  const linkPattern = /\[[^\]]+\]\((?!https?:\/\/|mailto:|#)([^)]+)\)/gu;
  let match;

  while ((match = linkPattern.exec(content)) !== null) {
    const rawTarget = match[1].trim().replace(/^</u, "").replace(/>$/u, "");
    const withoutAnchor = rawTarget.split("#")[0];
    if (!withoutAnchor) {
      continue;
    }

    const targetPath = resolve(dirname(path), withoutAnchor);
    if (!existsSync(targetPath)) {
      failures.push(`${file} has broken local link: ${rawTarget}`);
    }
  }
}
