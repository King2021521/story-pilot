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

  it("wraps every MVP command exposed to the desktop workbench", async () => {
    const send = vi.fn(
      async <TCommand extends CommandName>(
        _command: TCommand,
        _payload: CommandPayload<TCommand>,
      ): Promise<RpcResponse> => {
        void _command;
        void _payload;

        const returnsItems = _command.includes(".list") || _command === "memory.search";

        return {
          data: returnsItems ? { items: [] } : {},
          id: "req_test",
          ok: true,
        };
      },
    );
    const api = new StoryPilotApiClient({ send });

    await api.getProjectOverview({ projectId: "project_1" });
    await api.backupProject({ projectId: "project_1" });
    await api.getWorkbenchSnapshot({ projectId: "project_1" });
    await api.generateAi({
      capability: "outline.generate",
      input: { chapterCount: 10, scope: "chapter_batch" },
      projectId: "project_1",
      targetType: "project",
    });
    await api.getAiRun({ projectId: "project_1", workflowRunId: "run_1" });
    await api.cancelAiRun({ projectId: "project_1", workflowRunId: "run_1" });
    await api.listAiArtifacts({ kind: "outline_draft", projectId: "project_1" });
    await api.listChapters({ projectId: "project_1" });
    await api.getChapter({ chapterId: "chapter_1", projectId: "project_1" });
    await api.reviewChapterContinuity({
      chapterId: "chapter_1",
      projectId: "project_1",
      scope: "chapter",
    });
    await api.getArtifact({ artifactId: "artifact_1", projectId: "project_1" });
    await api.listMemoryCandidates({ projectId: "project_1", status: "pending" });
    await api.confirmMemory({
      candidateId: "candidate_1",
      decision: "hypothesis",
      projectId: "project_1",
    });
    await api.mergeMemory({
      candidateId: "candidate_1",
      projectId: "project_1",
      targetMemoryId: "memory_1",
    });
    await api.searchMemory({ limit: 20, projectId: "project_1", query: "旧信" });
    await api.getGraphNeighborhood({
      depth: 2,
      nodeId: "char_1",
      nodeType: "character",
      projectId: "project_1",
    });
    await api.findGraphContradictions({ projectId: "project_1", scope: "project" });
    await api.rebuildGraph({ projectId: "project_1" });
    await api.listWorkOrders({ projectId: "project_1" });
    await api.getWorkOrder({ projectId: "project_1", workOrderId: "work_order_1" });
    await api.runWorkflow({
      input: {},
      projectId: "project_1",
      targetId: "chapter_1",
      targetType: "chapter",
      workflowType: "memory_extract",
    });
    await api.cancelWorkflow({ projectId: "project_1", workflowRunId: "run_1" });
    await api.retryWorkflow({ projectId: "project_1", workflowRunId: "run_1" });
    await api.listCharacters({ projectId: "project_1" });
    await api.updateCharacter({
      characterId: "char_1",
      patch: { goal: "找真相" },
      projectId: "project_1",
    });
    await api.generateCharacterNames({ constraints: ["悬疑"], count: 3, projectId: "project_1" });
    await api.generateElementCandidates({
      constraints: [],
      count: 5,
      elementType: "weapon",
      genre: "玄幻",
      projectId: "project_1",
      style: "热血",
      worldRuleIds: ["rule_1"],
    });
    await api.acceptElementCandidates({
      items: [
        {
          description: "受星轨潮汐影响的刀器。",
          name: "潮汐断星刃",
          tags: [],
          type: "weapon",
        },
      ],
      projectId: "project_1",
    });
    await api.listWorldRules({ projectId: "project_1" });
    await api.updateWorldRule({
      patch: { title: "新规则" },
      projectId: "project_1",
      worldRuleId: "rule_1",
    });
    await api.listPlotlines({ projectId: "project_1" });
    await api.updatePlotlineNode({
      patch: { status: "done" },
      plotlineNodeId: "node_1",
      projectId: "project_1",
    });
    await api.listStoryEvents({ projectId: "project_1" });
    await api.createStoryEvent({
      description: "发现旧信",
      eventType: "discovery",
      participants: [],
      projectId: "project_1",
      title: "旧信",
    });
    await api.listForeshadowings({ projectId: "project_1" });
    await api.planForeshadowing({
      projectId: "project_1",
    });

    expect(send.mock.calls.map(([command]) => command)).toEqual([
      "project.getOverview",
      "project.backup",
      "workbench.getSnapshot",
      "ai.generate",
      "ai.getRun",
      "ai.cancelRun",
      "ai.listArtifacts",
      "chapter.list",
      "chapter.get",
      "chapter.reviewContinuity",
      "artifact.get",
      "memory.listCandidates",
      "memory.confirm",
      "memory.merge",
      "memory.search",
      "graph.getNeighborhood",
      "graph.findContradictions",
      "graph.rebuild",
      "workOrder.list",
      "workOrder.get",
      "workflow.run",
      "workflow.cancel",
      "workflow.retry",
      "character.list",
      "character.update",
      "character.generateNames",
      "element.generateCandidates",
      "element.acceptCandidates",
      "worldRule.list",
      "worldRule.update",
      "plotline.list",
      "plotline.updateNode",
      "storyEvent.list",
      "storyEvent.create",
      "foreshadowing.list",
      "foreshadowing.plan",
    ]);
  });
});
