import { describe, expect, it } from "vitest";

import { formatUserError } from "./error-message";

describe("formatUserError", () => {
  it("maps model configuration and auth errors to actionable messages", () => {
    expect(formatUserError(new Error("OPENAI_COMPATIBLE_HTTP_ERROR: 401"))).toContain(
      "模型鉴权失败",
    );
    expect(formatUserError(new Error("AI_MODEL_NOT_CONFIGURED"))).toContain("模型未配置");
    expect(formatUserError(new Error("OPENAI_COMPATIBLE_HTTP_ERROR: 404"))).toContain("HTTP 404");
  });
});
