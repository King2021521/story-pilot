import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("story-pilot sidecar runner", () => {
  it("finds an nvm node binary when launched from a macOS GUI-style environment", () => {
    const workspace = mkdtempSync(join(tmpdir(), "story-pilot-runner-"));
    const home = join(workspace, "home");
    const repoRoot = join(workspace, "repo");
    const fakeNode = join(home, ".nvm", "versions", "node", "v24.14.0", "bin", "node");
    const capturePath = join(workspace, "node-invocation.txt");

    mkdirSync(join(repoRoot, "apps", "sidecar", "dist"), { recursive: true });
    mkdirSync(join(fakeNode, ".."), { recursive: true });
    writeFileSync(join(repoRoot, "apps", "sidecar", "dist", "main.js"), "");
    writeFileSync(
      fakeNode,
      `#!/usr/bin/env bash\nprintf '%s\\n' "$0 $*" > "$STORY_PILOT_NODE_CAPTURE"\n`,
    );
    chmodSync(fakeNode, 0o755);

    try {
      const result = spawnSync(
        "/bin/bash",
        [join(process.cwd(), "src-tauri", "binaries", "story-pilot-sidecar.template.sh")],
        {
          cwd: workspace,
          encoding: "utf8",
          env: {
            HOME: home,
            PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
            STORY_PILOT_NODE_CAPTURE: capturePath,
            STORY_PILOT_REPO_ROOT: repoRoot,
          },
        },
      );

      expect(result.status).toBe(0);
      expect(readFileSync(capturePath, "utf8")).toContain(
        `${fakeNode} apps/sidecar/dist/main.js`,
      );
    } finally {
      rmSync(workspace, { force: true, recursive: true });
    }
  });
});
