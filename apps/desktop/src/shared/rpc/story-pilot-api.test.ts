import type { CommandName, CommandPayload, RpcResponse } from "@story-pilot/contracts";
import { describe, expect, it, vi } from "vitest";

import { StoryPilotApiClient } from "./story-pilot-api";
import type { RpcClient } from "./rpc-client";

type WorldbuildingFields = CommandPayload<"worldbuilding.saveFields">["fields"];
type CoreStoryFields = CommandPayload<"blueprint.saveForm">["fields"];

function worldbuildingFields(overrides: Partial<WorldbuildingFields>): WorldbuildingFields {
  return {
    coreConflict: "",
    culture: "",
    economy: "",
    factions: "",
    geography: "",
    history: "",
    powerOrder: "",
    powerSystem: "",
    rules: "",
    socialStructure: "",
    specialMechanism: "",
    worldBase: "",
    ...overrides,
  };
}

function coreStoryFields(overrides: Partial<CoreStoryFields>): CoreStoryFields {
  return {
    antagonistForce: "",
    corePromise: "",
    differentiators: [],
    emotionalAxes: [],
    logline: "",
    mainConflict: "",
    mainGoal: "",
    premise: "",
    protagonistArc: "",
    risks: [],
    stakes: "",
    storyDriver: "growth_reversal",
    ...overrides,
  };
}

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
      centralQuestion: "旧信到底是谁寄出的？",
      driver: "每三章投放一条线索。",
      emotionalPromise: "持续悬疑和真相逼近。",
      importance: "core",
      kind: "mystery",
      narrativeRole: "secret_reveal",
      priority: 5,
      projectId: "project_1",
      relatedCharacterIds: [],
      relatedForeshadowingIds: [],
      relatedStoryEventIds: [],
      relatedWorldRuleIds: [],
      status: "planning",
      summary: "围绕旧信来源展开。",
      title: "旧信谜团",
    });
    await api.createForeshadowing({
      description: "信纸水印暗示十年前档案。",
      importance: 3,
      payoffExpectation: "后续揭示档案伪造者。",
      projectId: "project_1",
      status: "seeded",
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
    await api.generateBookPlan({
      projectId: "project_1",
      targetWordCount: 3_000_000,
      volumeCount: 3,
    });
    await api.applyBookPlan({
      artifactId: "artifact_book_plan_1",
      projectId: "project_1",
    });
    await api.saveBookPlanDraft({
      bookPlanId: "book_plan_1",
      corePromise: "每卷完成一次核心爽点兑现。",
      endingDirection: "终局揭示皇权背后的真正代价。",
      mainPlotlineId: "plotline_1",
      projectId: "project_1",
      status: "draft",
      targetWordCount: 3_000_000,
      title: "全书大纲",
    });
    await api.saveVolumePlan({
      bookPlanId: "book_plan_1",
      climax: "卷末完成第一次公开破局。",
      majorConflict: "主角调查旧案，旧城权力结构持续封锁真相。",
      projectId: "project_1",
      purpose: "完成开局压迫、主线启动和第一次胜利。",
      status: "draft",
      targetWordCount: 360_000,
      title: "第一卷 旧信入局",
      volumeIndex: 1,
      volumePlanId: "volume_plan_1",
    });
    await api.saveArcPlan({
      arcIndex: 1,
      arcPlanId: "arc_plan_1",
      characterArcId: "character_arc_1",
      endChapterIndex: 20,
      escalation: ["旧信出现", "第一次误导", "公开破局"],
      plotlineId: "plotline_1",
      projectId: "project_1",
      purpose: "完成从被动收信到主动调查的阶段转向。",
      startChapterIndex: 1,
      status: "draft",
      title: "旧信追查",
      volumePlanId: "volume_plan_1",
    });
    await api.saveOutlineDraft({
      basis: { strategy: "三幕式推进" },
      outlineId: "outline_1",
      projectId: "project_1",
      scope: "full_book",
      status: "draft",
      title: "全书手工大纲",
    });
    await api.saveVolumeOutline({
      climax: "极寒夜主角守住核心安全屋。",
      majorConflict: "资源暴露后，外部幸存者联盟不断逼近。",
      outlineId: "outline_1",
      projectId: "project_1",
      purpose: "建立末世压迫、据点经营和第一次大规模攻防。",
      sortOrder: 1,
      status: "draft",
      title: "第一卷 暴雪降临",
      volumeId: "volume_1",
      wordCountGoal: 600_000,
    });
    await api.saveChapterOutline({
      chapterId: "chapter_1",
      chapterGoal: "主角收到极寒预警并启动安全屋改造。",
      conflict: "主角必须在断电前完成安全屋最后加固。",
      emotionalTurn: "从怀疑变成确认灾难临近。",
      hook: "天气预警从三天变成三小时。",
      informationGain: "极寒不是普通寒潮。",
      outlineId: "outline_1",
      projectId: "project_1",
      relatedForeshadowingIds: ["foreshadowing_1"],
      relatedPlotlineNodeIds: ["node_1"],
      requiredCharacterIds: ["char_1"],
      requiredLocationIds: ["location_1"],
      sortOrder: 1,
      status: "draft",
      title: "第 1 章 暴雪预警",
      volumeOutlineId: "volume_outline_1",
      targetWordCount: 3500,
    });
    await api.saveSceneOutline({
      beatType: "opening_hook",
      chapterOutlineId: "chapter_outline_1",
      conflict: "门禁短暂失效，求助者看见内部门廊。",
      entryState: "主角以为只要关门就能独善其身。",
      exitState: "主角保住门禁，却留下人情债。",
      projectId: "project_1",
      purpose: "把安全屋优势和道德压力同时展示出来。",
      sceneOutlineId: "scene_outline_1",
      sortOrder: 1,
      status: "draft",
      title: "门外求救",
    });
    await api.saveChapterPlan({
      arcPlanId: "arc_plan_1",
      chapterGoal: "主角启动安全屋，并第一次面对求助压力。",
      chapterIndex: 1,
      conflict: "主角必须在救人和暴露据点之间选择。",
      emotionalTurn: "从独善其身到被迫承担。",
      hook: "门外传来熟悉的求救声。",
      informationGain: "安全屋入口可能被追踪。",
      projectId: "project_1",
      relatedCharacterIds: ["char_1"],
      relatedForeshadowingIds: ["foreshadowing_1"],
      relatedPlotlineIds: ["plotline_1"],
      status: "draft",
      targetWordCount: 3200,
      title: "第 1 章 暴雪预警",
    });
    await api.saveScenePlan({
      chapterPlanId: "chapter_plan_1",
      conflictTurn: "电力切换失败，邻居开始敲门。",
      memoryTargets: ["安全屋首次暴露热源"],
      outcome: "主角守住入口，但留下门禁破绽。",
      projectId: "project_1",
      sceneGoal: "把安全屋危机具体化。",
      sceneIndex: 1,
      status: "draft",
    });
    await api.generateRollingOutline({
      chapterCount: 10,
      projectId: "project_1",
      startChapterIndex: 1,
      volumePlanId: "volume_plan_1",
    });
    await api.applyChapterPlans({
      artifactId: "artifact_rolling_1",
      projectId: "project_1",
      selectedChapterPlanIds: ["chapter_plan_1"],
    });
    await api.analyzeOutlineImpact({
      patch: { hook: "新的章末钩子" },
      projectId: "project_1",
      targetId: "chapter_plan_1",
      targetType: "chapter_plan",
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
    await api.generateChapterDraftFromPlan({
      chapterPlanId: "chapter_plan_1",
      instruction: "强化章末钩子",
      projectId: "project_1",
    });
    await api.generateChapterExecutionCard({
      chapterPlanId: "chapter_plan_1",
      projectId: "project_1",
    });
    await api.applyChapterExecutionCard({
      artifactId: "artifact_execution_card_1",
      projectId: "project_1",
    });
    await api.saveChapterExecutionCard({
      projectId: "project_1",
      values: {
        chapterIndex: 1,
        chapterPlanId: "chapter_plan_1",
        coreConflict: "主角必须在安全屋保密和救援外部幸存者之间做选择。",
        emotionalTurn: "从单纯自保转向意识到安全屋会形成秩序责任。",
        forbiddenMoves: [],
        hook: "炉芯日志出现不可能预警。",
        informationGain: "热源启动会留下可追踪信号。",
        narrativeGoal: "让读者看到安全屋第一次升级和第一次暴露风险。",
        readerReward: "兑现安全屋供热升级，并留下热源来源悬念。",
        relatedForeshadowingIds: [],
        relatedPlotDebtIds: [],
        relatedPlotlineIds: [],
        requiredCharacterIds: [],
        requiredLocationIds: [],
        sceneBriefs: [
          {
            conflictTurn: "外部敲门制造保密压力。",
            memoryTargets: [],
            outcome: "热源启动成功但风险上升。",
            sceneGoal: "验证供热闭环。",
            sceneIndex: 1,
          },
        ],
        status: "draft",
        targetWordCount: 3500,
        title: "第一章 炉芯预警",
      },
    });
    await api.reviewChapterDraft({
      chapterId: "chapter_1",
      chapterVersion: 1,
      projectId: "project_1",
    });
    await api.generateSerialReview({
      endChapterIndex: 10,
      projectId: "project_1",
      scope: "chapter_batch",
      startChapterIndex: 1,
    });
    await api.applySerialReview({
      artifactId: "artifact_serial_review_1",
      projectId: "project_1",
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
    await api.projectGraphSinceCheckpoint({ projectId: "project_1" });
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
    await api.listEntityRelations({ projectId: "project_1" });
    await api.createEntityRelation({
      description: "主角保护医生，医生提供医疗秩序。",
      polarity: 1,
      projectId: "project_1",
      relationType: "protects",
      sourceEntityId: "char_1",
      sourceEntityType: "character",
      status: "confirmed",
      strength: 0.8,
      targetEntityId: "char_2",
      targetEntityType: "character",
    });
    await api.updateEntityRelation({
      entityRelationId: "relation_1",
      patch: {
        description: "关系从互利变成稳定同盟。",
        strength: 0.95,
      },
      projectId: "project_1",
    });
    await api.generateCharacterNames({ constraints: ["悬疑"], count: 3, projectId: "project_1" });
    await api.saveBlueprintForm({
      fields: coreStoryFields({
        mainGoal: "查清钟楼旧案。",
        premise: "主角收到旧信。",
        storyDriver: "mystery",
      }),
      projectId: "project_1",
    });
    await api.completeBlueprintForm({
      fields: coreStoryFields({
        mainGoal: "查清钟楼旧案。",
      }),
      projectId: "project_1",
    });
    await api.generateElementCandidates({
      constraints: [],
      count: 5,
      description: "生成安全屋外部资源争夺中的关键武器名称。",
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
    await api.saveWorldbuildingFields({
      fields: worldbuildingFields({
        geography: "旧城围绕钟楼扩散。",
        worldBase: "近现代旧城悬疑世界。",
      }),
      projectId: "project_1",
    });
    await api.completeWorldbuildingFields({
      fields: worldbuildingFields({
        worldBase: "近现代旧城悬疑世界。",
      }),
      projectId: "project_1",
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
      outcome: "主角决定追查旧案。",
      participants: [],
      projectId: "project_1",
      status: "draft",
      title: "旧信",
    });
    await api.updateStoryEvent({
      patch: {
        description: "旧信水印指向官府档案纸。",
        status: "canon",
        storyTime: "第 3 章",
      },
      projectId: "project_1",
      storyEventId: "event_1",
    });
    await api.listEventRelations({ projectId: "project_1" });
    await api.createEventRelation({
      description: "旧信导致主角进入钟楼。",
      projectId: "project_1",
      relationType: "causes",
      sourceEventId: "event_1",
      targetEventId: "event_2",
    });
    await api.updateEventRelation({
      eventRelationId: "event_relation_1",
      patch: {
        description: "因果关系改为递进升级。",
        relationType: "escalates",
      },
      projectId: "project_1",
    });
    await api.listConflicts({ projectId: "project_1" });
    await api.createConflict({
      conflictType: "survival",
      escalationPath: ["断电", "邻里围门"],
      opposingForces: ["安全屋", "失控幸存者"],
      projectId: "project_1",
      relatedPlotlineId: "plotline_1",
      stakes: "安全屋一旦暴露，主角会失去唯一生存优势。",
      status: "active",
      title: "暖源暴露危机",
    });
    await api.updateConflict({
      conflictId: "conflict_1",
      patch: {
        status: "resolved",
      },
      projectId: "project_1",
    });
    await api.listForeshadowings({ projectId: "project_1" });
    await api.createForeshadowing({
      description: "信纸水印暗示十年前档案。",
      importance: 3,
      payoffExpectation: "后续揭示档案伪造者。",
      projectId: "project_1",
      status: "seeded",
      title: "水印伏笔",
    });
    await api.updateForeshadowing({
      foreshadowingId: "foreshadowing_1",
      patch: {
        importance: 5,
        payoffExpectation: "第 20 章回收水印。",
        status: "payoff_ready",
      },
      projectId: "project_1",
    });
    await api.planForeshadowing({
      projectId: "project_1",
    });
    await api.listPlotDebts({
      projectId: "project_1",
      status: ["open"],
    });
    await api.savePlotDebt({
      projectId: "project_1",
      values: {
        debtType: "reader_promise",
        lifecycleNotes: [],
        promise: "安全屋升级必须伴随更高代价。",
        relatedCharacterIds: [],
        relatedWorldRuleIds: [],
        riskLevel: "medium",
        status: "open",
        title: "安全屋升级承诺",
      },
    });
    await api.extractStoryStateDelta({
      chapterId: "chapter_1",
      chapterVersion: 1,
      projectId: "project_1",
    });
    await api.applyStoryStateDelta({
      artifactId: "artifact_delta_1",
      projectId: "project_1",
    });

    expect(send.mock.calls.map(([command]) => command)).toEqual([
      "project.getOverview",
      "project.backup",
      "workbench.getSnapshot",
      "ai.generate",
      "plot.generateBookPlan",
      "plot.applyBookPlan",
      "plot.saveBookPlanDraft",
      "plot.saveVolumePlan",
      "plot.saveArcPlan",
      "outline.saveDraft",
      "outline.saveVolumeOutline",
      "outline.saveChapterOutline",
      "outline.saveSceneOutline",
      "plot.saveChapterPlan",
      "plot.saveScenePlan",
      "plot.generateRollingOutline",
      "plot.applyChapterPlans",
      "plot.analyzeOutlineImpact",
      "ai.getRun",
      "ai.cancelRun",
      "ai.listArtifacts",
      "chapter.list",
      "chapter.get",
      "chapter.reviewContinuity",
      "chapter.generateDraftFromPlan",
      "chapterExecutionCard.generate",
      "chapterExecutionCard.apply",
      "chapterExecutionCard.save",
      "chapter.reviewDraft",
      "serialReview.generate",
      "serialReview.apply",
      "artifact.get",
      "memory.listCandidates",
      "memory.confirm",
      "memory.merge",
      "memory.search",
      "graph.getNeighborhood",
      "graph.findContradictions",
      "graph.rebuild",
      "graph.projectSinceCheckpoint",
      "workOrder.list",
      "workOrder.get",
      "workflow.run",
      "workflow.cancel",
      "workflow.retry",
      "character.list",
      "character.update",
      "entityRelation.list",
      "entityRelation.create",
      "entityRelation.update",
      "character.generateNames",
      "blueprint.saveForm",
      "blueprint.completeForm",
      "element.generateCandidates",
      "element.acceptCandidates",
      "worldRule.list",
      "worldRule.update",
      "worldbuilding.saveFields",
      "worldbuilding.completeFields",
      "plotline.list",
      "plotline.updateNode",
      "storyEvent.list",
      "storyEvent.create",
      "storyEvent.update",
      "eventRelation.list",
      "eventRelation.create",
      "eventRelation.update",
      "conflict.list",
      "conflict.create",
      "conflict.update",
      "foreshadowing.list",
      "foreshadowing.create",
      "foreshadowing.update",
      "foreshadowing.plan",
      "plotDebt.list",
      "plotDebt.save",
      "storyState.extractDelta",
      "storyState.applyDelta",
    ]);
  });
});
