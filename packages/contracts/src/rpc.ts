import { z } from "zod";

import type { RpcError, StoryPilotErrorCode } from "./errors.js";

export const rpcRequestSchema = z.object({
  id: z.string().min(1),
  command: z.string().min(1),
  payload: z.unknown().optional(),
});

export type RpcRequest = z.infer<typeof rpcRequestSchema>;

export type RpcSuccess<TData = unknown> = {
  id: string;
  ok: true;
  data: TData;
};

export type RpcFailure = {
  id: string;
  ok: false;
  error: RpcError;
};

export type RpcResponse<TData = unknown> = RpcSuccess<TData> | RpcFailure;

export function parseRpcRequest(input: unknown): RpcRequest {
  return rpcRequestSchema.parse(input);
}

export function createRpcSuccess<TData>(id: string, data: TData): RpcSuccess<TData> {
  return {
    id,
    ok: true,
    data,
  };
}

export function createRpcError(
  id: string,
  code: StoryPilotErrorCode,
  message: string,
  details?: unknown,
): RpcFailure {
  return {
    id,
    ok: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
}
