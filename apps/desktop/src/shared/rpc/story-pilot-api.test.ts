import type { CommandName, CommandPayload, RpcResponse } from "@story-pilot/contracts";
import { describe, expect, it, vi } from "vitest";

import { StoryPilotApiClient } from "./story-pilot-api";
import type { RpcClient } from "./rpc-client";

describe("StoryPilotApiClient", () => {
  it("unwraps list responses returned by the sidecar RPC service", async () => {
    const rpcClient: RpcClient = {
      async send(command) {
        return {
          data: {
            items: [
              {
                id: "project_1",
                title: "雾都案卷",
              },
            ],
          },
          id: `req_${command}`,
          ok: true,
        };
      },
    };
    const api = new StoryPilotApiClient(rpcClient);

    await expect(api.listRecentProjects({ limit: 20 })).resolves.toEqual([
      {
        id: "project_1",
        title: "雾都案卷",
      },
    ]);
  });

  it("wraps workbench creation and chapter actions with typed RPC commands", async () => {
    const calls: Array<{ command: string; payload: unknown }> = [];
    const rpcClient: RpcClient = {
      async send(command, payload) {
        calls.push({ command, payload });
        return {
          data: { id: `${command}:result` },
          id: "req_test",
          ok: true,
        };
      },
    };
    const api = new StoryPilotApiClient(rpcClient);

    await api.createProject({ genre: "悬疑", title: "长夜序章" });
    await api.saveChapterContent({
      baseVersion: 1,
      chapterId: "chapter_1",
      content: "正文",
      projectId: "project_1",
    });
    await api.confirmMemory({ candidateId: "candidate_1", projectId: "project_1" });

    expect(calls).toEqual([
      {
        command: "project.create",
        payload: { genre: "悬疑", title: "长夜序章" },
      },
      {
        command: "chapter.saveContent",
        payload: {
          baseVersion: 1,
          chapterId: "chapter_1",
          content: "正文",
          projectId: "project_1",
        },
      },
      {
        command: "memory.confirm",
        payload: {
          candidateId: "candidate_1",
          decision: "canon",
          projectId: "project_1",
        },
      },
    ]);
  });

  it("wraps creative object creation with typed RPC commands", async () => {
    const send = vi.fn(
      async <TCommand extends CommandName>(
        _command: TCommand,
        _payload: CommandPayload<TCommand>,
      ): Promise<RpcResponse> => {
        void _command;
        void _payload;

        return {
          data: {},
          id: "req_test",
          ok: true,
        };
      },
    );
    const api = new StoryPilotApiClient({ send });

    await api.createCharacter({
      name: "林鸢",
      projectId: "project_1",
      role: "protagonist",
    });
    await api.createWorldRule({
      category: "society",
      constraintLevel: "soft",
      projectId: "project_1",
      statement: "旧城区由钟楼议会管理。",
      title: "旧城区治理",
    });
    await api.createPlotline({
      kind: "mystery",
      priority: 5,
      projectId: "project_1",
      summary: "围绕旧信来源展开。",
      title: "旧信谜团",
    });
    await api.createForeshadowing({
      description: "信纸水印暗示十年前档案。",
      importance: 3,
      payoffExpectation: "后续揭示档案伪造者。",
      projectId: "project_1",
      title: "水印伏笔",
    });

    expect(send.mock.calls.map(([command]) => command)).toEqual([
      "character.create",
      "worldRule.create",
      "plotline.create",
      "foreshadowing.create",
    ]);
  });
});
