import { invoke } from "@tauri-apps/api/core";
import type { CommandName, CommandPayload, RpcRequest, RpcResponse } from "@story-pilot/contracts";

export interface RpcClient {
  send<TCommand extends CommandName>(
    command: TCommand,
    payload: CommandPayload<TCommand>,
  ): Promise<RpcResponse>;
}

export class TauriRpcClient implements RpcClient {
  async send<TCommand extends CommandName>(
    command: TCommand,
    payload: CommandPayload<TCommand>,
  ): Promise<RpcResponse> {
    const request: RpcRequest = {
      command,
      id: crypto.randomUUID(),
      payload,
    };

    return invoke<RpcResponse>("story_pilot_rpc", { request });
  }
}
