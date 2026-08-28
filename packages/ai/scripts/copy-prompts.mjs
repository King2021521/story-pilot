import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(packageRoot, "src", "prompts");
const targetRoot = join(packageRoot, "dist", "prompts");

copyMarkdownFiles(sourceRoot);

function copyMarkdownFiles(directory) {
  for (const entry of readdirSync(directory)) {
    const sourcePath = join(directory, entry);
    const stats = statSync(sourcePath);

    if (stats.isDirectory()) {
      copyMarkdownFiles(sourcePath);
      continue;
    }

    if (extname(sourcePath) !== ".md") {
      continue;
    }

    const targetPath = join(targetRoot, relative(sourceRoot, sourcePath));
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }
}
