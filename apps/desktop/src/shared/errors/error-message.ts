const MODEL_CONFIG_PATH = "~/.story-pilot/setting.json";

export function formatUserError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");

  if (message.includes("AI_MODEL_NOT_CONFIGURED")) {
    return `模型未配置：请在设置页或 ${MODEL_CONFIG_PATH} 填写 baseUrl、model 和 apiKey。`;
  }

  if (
    message.includes("OPENAI_COMPATIBLE_HTTP_ERROR: 401") ||
    message.includes("AI_MODEL_AUTH_FAILED")
  ) {
    return `模型鉴权失败：请检查 ${MODEL_CONFIG_PATH} 中的 baseUrl、model 和 apiKey。`;
  }

  if (message.includes("OPENAI_COMPATIBLE_HTTP_ERROR: 403")) {
    return `模型鉴权失败：当前 API Key 无权访问该模型，请检查 ${MODEL_CONFIG_PATH}。`;
  }

  const httpStatus = /OPENAI_COMPATIBLE_HTTP_ERROR:\s*(\d+)/u.exec(message)?.[1];
  if (httpStatus) {
    return `模型接口请求失败（HTTP ${httpStatus}）：请检查 Base URL 是否正确，通常需要包含 /v1。`;
  }

  if (message.includes("AI_MODEL_ENDPOINT_INVALID")) {
    return "模型 Base URL 无效：请填写完整的 http(s) 地址。";
  }

  if (message.includes("AI_MODEL_REQUEST_FAILED")) {
    return "模型服务连接失败：请检查网络、Base URL 和服务可用性。";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败";
}
