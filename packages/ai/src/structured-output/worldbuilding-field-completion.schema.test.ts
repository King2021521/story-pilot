import { describe, expect, it } from "vitest";

import { WorldbuildingFieldCompletionOutputSchema } from "./worldbuilding-field-completion.schema.js";

describe("WorldbuildingFieldCompletionOutputSchema", () => {
  it("parses fixed 12-dimension worldbuilding field completions at production depth", () => {
    const completeDimension = buildTextOfLength(320);

    expect(
      WorldbuildingFieldCompletionOutputSchema.parse({
        fields: {
          coreConflict: completeDimension,
          culture: completeDimension,
          economy: completeDimension,
          factions: completeDimension,
          geography: completeDimension,
          history: completeDimension,
          powerOrder: completeDimension,
          powerSystem: completeDimension,
          rules: completeDimension,
          socialStructure: completeDimension,
          specialMechanism: completeDimension,
          worldBase: completeDimension,
        },
      }),
    ).toEqual({
      fields: expect.objectContaining({
        powerSystem: completeDimension,
        worldBase: completeDimension,
      }),
    });
  });

  it("rejects generated dimension text under 300 characters", () => {
    expect(() =>
      WorldbuildingFieldCompletionOutputSchema.parse({
        fields: buildWorldbuildingFields(buildTextOfLength(299)),
      }),
    ).toThrow();
  });

  it("rejects generated dimension text over 500 characters", () => {
    expect(() =>
      WorldbuildingFieldCompletionOutputSchema.parse({
        fields: buildWorldbuildingFields(buildTextOfLength(501)),
      }),
    ).toThrow();
  });

  it("rejects extra output fields that do not map to the form", () => {
    expect(() =>
      WorldbuildingFieldCompletionOutputSchema.parse({
        fields: {
          ...buildWorldbuildingFields(buildTextOfLength(320)),
          qualityCheck: "不要把质量检查混进业务表单。",
        },
      }),
    ).toThrow();
  });
});

function buildWorldbuildingFields(value: string) {
  return {
    coreConflict: value,
    culture: value,
    economy: value,
    factions: value,
    geography: value,
    history: value,
    powerOrder: value,
    powerSystem: value,
    rules: value,
    socialStructure: value,
    specialMechanism: value,
    worldBase: value,
  };
}

function buildTextOfLength(length: number): string {
  return "设".repeat(length);
}
