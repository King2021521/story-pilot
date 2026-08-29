import { describe, expect, it } from "vitest";

import { WorldbuildingFieldCompletionOutputSchema } from "./worldbuilding-field-completion.schema.js";

describe("WorldbuildingFieldCompletionOutputSchema", () => {
  it("parses fixed 12-dimension worldbuilding field completions", () => {
    expect(
      WorldbuildingFieldCompletionOutputSchema.parse({
        fields: {
          coreConflict: "旧信真相与旧城秩序不可同时保全。",
          culture: "旧城居民相信沉默是保护家人的必要代价。",
          economy: "档案、路引和旧城通行资格构成关键资源。",
          factions: "钟楼议会、旧警署残部和地下信使互相制衡。",
          geography: "旧城围绕钟楼向外扩散，内圈保存档案。",
          history: "十年前钟楼火灾改变了旧城权力结构。",
          powerOrder: "钟楼议会拥有名义裁决权。",
          powerSystem: "角色依靠线索、关系和档案解读能力推进调查。",
          rules: "任何人不得私自带走钟楼档案。",
          socialStructure: "旧城按是否拥有钟楼通行资格分层。",
          specialMechanism: "每封旧信都会对应一段被删改的档案。",
          worldBase: "近现代旧城悬疑世界。",
        },
      }),
    ).toEqual({
      fields: expect.objectContaining({
        powerSystem: "角色依靠线索、关系和档案解读能力推进调查。",
        worldBase: "近现代旧城悬疑世界。",
      }),
    });
  });

  it("rejects generated dimension text over 500 characters", () => {
    expect(() =>
      WorldbuildingFieldCompletionOutputSchema.parse({
        fields: {
          coreConflict: "旧信真相与旧城秩序不可同时保全。",
          culture: "旧城居民相信沉默是保护家人的必要代价。",
          economy: "档案、路引和旧城通行资格构成关键资源。",
          factions: "钟楼议会、旧警署残部和地下信使互相制衡。",
          geography: "旧城围绕钟楼向外扩散，内圈保存档案。",
          history: "十年前钟楼火灾改变了旧城权力结构。",
          powerOrder: "钟楼议会拥有名义裁决权。",
          powerSystem: "角色依靠线索、关系和档案解读能力推进调查。",
          rules: "任何人不得私自带走钟楼档案。",
          socialStructure: "旧城按是否拥有钟楼通行资格分层。",
          specialMechanism: "每封旧信都会对应一段被删改的档案。",
          worldBase: "设".repeat(501),
        },
      }),
    ).toThrow();
  });
});
