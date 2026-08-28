import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  createSyntheticLongformProject,
  verifySyntheticLongformProject,
} from "./longform-synthetic.js";

const outputRoot =
  process.env.STORY_PILOT_LONGFORM_ROOT ?? join(tmpdir(), `story-pilot-longform-${Date.now()}`);
const reportPath =
  process.env.STORY_PILOT_LONGFORM_REPORT ?? join(outputRoot, "longform-report.json");

const project = await createSyntheticLongformProject({
  rootDir: outputRoot,
  seed: process.env.STORY_PILOT_LONGFORM_SEED ?? "production",
});
const report = await verifySyntheticLongformProject({
  databasePath: project.databasePath,
});

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({ ...report, reportPath }, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
