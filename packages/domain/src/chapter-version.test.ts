import { describe, expect, it } from "vitest";

import { createNextChapterVersion } from "./index.js";

describe("chapter versioning", () => {
  it("increments the current chapter version", () => {
    expect(createNextChapterVersion(0)).toBe(1);
    expect(createNextChapterVersion(7)).toBe(8);
  });
});
