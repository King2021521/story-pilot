import { invoke } from "@tauri-apps/api/core";
import {
  createRpcError,
  createRpcSuccess,
  type CommandName,
  type CommandPayload,
  type RpcRequest,
  type RpcResponse,
} from "@story-pilot/contracts";

declare global {
  interface Window {
    __STORY_PILOT_E2E_RPC__?: (request: RpcRequest) => Promise<RpcResponse> | RpcResponse;
  }
}

export interface RpcClient {
  send<TCommand extends CommandName>(
    command: TCommand,
    payload: CommandPayload<TCommand>,
  ): Promise<RpcResponse>;
}

export class TauriRpcClient implements RpcClient {
  constructor(private readonly webPreviewFallback: RpcClient = new WebPreviewRpcClient()) {}

  async send<TCommand extends CommandName>(
    command: TCommand,
    payload: CommandPayload<TCommand>,
  ): Promise<RpcResponse> {
    const request: RpcRequest = {
      command,
      id: crypto.randomUUID(),
      payload,
    };

    try {
      return await invoke<RpcResponse>("story_pilot_rpc", { request });
    } catch (error) {
      if (isTauriBridgeUnavailable(error)) {
        return this.webPreviewFallback.send(command, payload);
      }

      throw error;
    }
  }
}

export class WebPreviewRpcClient implements RpcClient {
  async send<TCommand extends CommandName>(
    command: TCommand,
    payload: CommandPayload<TCommand>,
  ): Promise<RpcResponse> {
    const requestId = crypto.randomUUID();
    const request: RpcRequest = {
      command,
      id: requestId,
      payload,
    };
    const e2eRpc = typeof window === "undefined" ? undefined : window.__STORY_PILOT_E2E_RPC__;
    if (e2eRpc) {
      return await e2eRpc(request);
    }

    if (command === "app.health") {
      return createRpcSuccess(requestId, {
        mode: "web-preview",
        service: "story-pilot-desktop",
        status: "ok",
      });
    }

    if (command === "project.listRecent") {
      return createRpcSuccess(requestId, { items: [] });
    }

    return createRpcError(
      requestId,
      "APP_BACKEND_UNAVAILABLE",
      "Story Pilot desktop preview is running without the Tauri sidecar bridge.",
    );
  }
}

function isTauriBridgeUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Cannot read properties of undefined (reading 'invoke')") ||
    error.message.includes("__TAURI_INTERNALS__") ||
    error.message.includes("window.__TAURI__") ||
    error.message.includes("Tauri")
  );
}
