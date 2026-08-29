import { describe, expect, it } from "vitest";

import { MVP_COMMAND_NAMES, commandSchemas, parseCommandPayload } from "./index.js";

describe("command registry", () => {
  it("contains the MVP command set", () => {
    expect(MVP_COMMAND_NAMES).toEqual([
      "app.health",
      "settings.get",
      "settings.update",
      "settings.validateModel",
      "diagnostics.getHealth",
      "diagnostics.export",
      "project.create",
      "project.listRecent",
      "project.open",
      "project.getOverview",
      "project.backup",
      "backup.createProject",
      "backup.restoreProject",
      "workbench.getSnapshot",
      "workbench.getBoard",
      "ai.generate",
      "ai.getRun",
      "ai.cancelRun",
      "ai.listArtifacts",
      "creativeStage.getPath",
      "creativeStage.evaluateGate",
      "creativeStage.advance",
      "creativeStage.reopen",
      "creativeStage.skip",
      "creativeStage.complete",
      "brief.save",
      "brief.confirm",
      "blueprint.generate",
      "blueprint.saveForm",
      "blueprint.completeForm",
      "blueprint.apply",
      "outline.generate",
      "outline.approveChapterOutline",
      "outline.applyChapterOutline",
      "plot.generateBookPlan",
      "plot.applyBookPlan",
      "plot.saveBookPlanDraft",
      "plot.saveVolumePlan",
      "plot.saveArcPlan",
      "plot.generateRollingOutline",
      "plot.applyChapterPlans",
      "plot.analyzeOutlineImpact",
      "chapter.list",
      "chapter.get",
      "chapter.create",
      "chapter.saveContent",
      "chapter.listVersions",
      "chapter.restoreVersion",
      "chapter.generateDraft",
      "chapter.generateDraftFromOutline",
      "chapter.generateDraftFromPlan",
      "chapter.reviewContinuity",
      "character.list",
      "character.create",
      "character.update",
      "character.generateNames",
      "element.generateCandidates",
      "element.acceptCandidates",
      "worldRule.list",
      "worldRule.create",
      "worldRule.update",
      "worldbuilding.saveFields",
      "worldbuilding.completeFields",
      "plotline.list",
      "plotline.create",
      "plotline.update",
      "plotline.createNode",
      "plotline.updateNode",
      "storyEvent.list",
      "storyEvent.create",
      "foreshadowing.list",
      "foreshadowing.create",
      "foreshadowing.plan",
      "workOrder.list",
      "workOrder.get",
      "workflow.run",
      "workflow.cancel",
      "workflow.retry",
      "artifact.get",
      "artifact.apply",
      "artifact.reject",
      "memory.listCandidates",
      "memory.confirm",
      "memory.reject",
      "memory.merge",
      "memory.search",
      "graph.getNeighborhood",
      "graph.findContradictions",
      "graph.rebuild",
      "graph.projectSinceCheckpoint",
    ]);
  });

  it("keeps command names and schemas aligned", () => {
    expect(Object.keys(commandSchemas)).toEqual([...MVP_COMMAND_NAMES]);
  });

  it("parses project.create payloads", () => {
    expect(
      parseCommandPayload("project.create", {
        title: "长夜序章",
        genre: "悬疑",
        style: "悬疑推理",
      }),
    ).toEqual({
      title: "长夜序章",
      genre: "悬疑",
      style: "悬疑推理",
    });
  });

  it("parses diagnostics and backup payloads", () => {
    expect(parseCommandPayload("diagnostics.getHealth", {})).toEqual({});
    expect(parseCommandPayload("diagnostics.export", {})).toEqual({});
    expect(parseCommandPayload("backup.createProject", { projectId: "proj_1" })).toEqual({
      projectId: "proj_1",
    });
    expect(
      parseCommandPayload("backup.restoreProject", {
        backupPath: "/tmp/proj_1.project.sqlite",
        projectId: "proj_1",
      }),
    ).toEqual({
      backupPath: "/tmp/proj_1.project.sqlite",
      projectId: "proj_1",
    });
  });

  it("parses runtime settings payloads", () => {
    expect(parseCommandPayload("settings.get", {})).toEqual({});
    expect(
      parseCommandPayload("settings.update", {
        model: {
          apiKey: "json-api-key",
          baseUrl: "https://api.example.test/v1",
          model: "gpt-test",
          timeoutMs: 60000,
        },
        storage: {
          autoBackup: false,
          backupRetention: 10,
        },
      }),
    ).toEqual({
      model: {
        apiKey: "json-api-key",
        baseUrl: "https://api.example.test/v1",
        model: "gpt-test",
        timeoutMs: 60000,
      },
      storage: {
        autoBackup: false,
        backupRetention: 10,
      },
    });
    expect(
      parseCommandPayload("settings.validateModel", {
        apiKey: "json-api-key",
        baseUrl: "https://api.example.test/v1",
        model: "gpt-test",
      }),
    ).toEqual({
      apiKey: "json-api-key",
      baseUrl: "https://api.example.test/v1",
      model: "gpt-test",
    });
  });

  it("parses character profile payloads with narrative design fields", () => {
    expect(
      parseCommandPayload("character.create", {
        appearance: "旧风衣、随身旧笔记本，观察时会按住袖口。",
        arcEnd: "愿意公开旧案证据并承担代价。",
        arcStart: "逃避旧案，只想离开旧城。",
        arcTurn: "发现证人仍被追杀后决定回头。",
        archetype: "离队调查者",
        biography: "前刑警，因十年前钟楼案离队。",
        firstAppearance: "第 1 章",
        flaw: "过度自责",
        genderAge: "女，27 岁",
        goal: "查清旧信来源",
        importance: "core",
        name: "林鸢",
        narrativeFunction: "viewpoint",
        need: "重新学会信任他人",
        projectId: "proj_1",
        relationshipHook: "与钟楼守档人互相试探。",
        role: "protagonist",
        secret: "十年前曾到过案发现场",
        storyTask: "把旧信线索推进成主线调查，并把被掩盖的旧案逼出来。",
        voiceProfile: "克制、短句、偏观察细节。",
      }),
    ).toMatchObject({
      firstAppearance: "第 1 章",
      genderAge: "女，27 岁",
      importance: "core",
      name: "林鸢",
      narrativeFunction: "viewpoint",
      role: "protagonist",
      storyTask: "把旧信线索推进成主线调查，并把被掩盖的旧案逼出来。",
    });

    expect(() =>
      parseCommandPayload("character.create", {
        importance: "decorative",
        name: "林鸢",
        projectId: "proj_1",
      }),
    ).toThrow();
  });

  it("parses plotline profile and node payloads with narrative design fields", () => {
    expect(
      parseCommandPayload("plotline.create", {
        centralQuestion: "旧信到底是谁寄出的？",
        driver: "每三章投放一条可验证线索，并用一次误导制造新问题。",
        emotionalPromise: "持续悬疑、逼近真相和人物承担代价的爽感。",
        importance: "core",
        kind: "mystery",
        midEscalation: "线索从旧信转向档案伪造和证人追杀。",
        narrativeRole: "secret_reveal",
        payoffPlan: "在卷末揭示寄信人身份，并回收信纸水印伏笔。",
        priority: 5,
        projectId: "proj_1",
        relatedCharacterIds: ["character_1"],
        relatedForeshadowingIds: ["foreshadowing_1"],
        relatedStoryEventIds: ["event_1"],
        relatedWorldRuleIds: ["world_rule_1"],
        startState: "主角只知道旧信存在，不知道背后牵连旧案。",
        status: "planning",
        summary: "围绕旧信来源展开的调查线。",
        title: "旧信谜团",
      }),
    ).toMatchObject({
      centralQuestion: "旧信到底是谁寄出的？",
      importance: "core",
      kind: "mystery",
      narrativeRole: "secret_reveal",
      relatedCharacterIds: ["character_1"],
      status: "planning",
      title: "旧信谜团",
    });

    expect(
      parseCommandPayload("plotline.update", {
        patch: {
          payoffPlan: "第 20 章揭示寄信人并改变主角目标。",
          relatedCharacterIds: [],
          status: "active",
        },
        plotlineId: "plotline_1",
        projectId: "proj_1",
      }),
    ).toEqual({
      patch: {
        payoffPlan: "第 20 章揭示寄信人并改变主角目标。",
        relatedCharacterIds: [],
        status: "active",
      },
      plotlineId: "plotline_1",
      projectId: "proj_1",
    });

    expect(
      parseCommandPayload("plotline.createNode", {
        chapterHint: "第 3 章",
        description: "让读者看到信纸水印，但暂时不解释来源。",
        kind: "seed",
        plotlineId: "plotline_1",
        position: 1,
        projectId: "proj_1",
        status: "planned",
        title: "信纸水印出现",
      }),
    ).toMatchObject({
      chapterHint: "第 3 章",
      kind: "seed",
      plotlineId: "plotline_1",
      status: "planned",
      title: "信纸水印出现",
    });

    expect(() =>
      parseCommandPayload("plotline.create", {
        importance: "decorative",
        projectId: "proj_1",
        title: "无效故事线",
      }),
    ).toThrow();
  });

  it("parses AI workflow payloads", () => {
    expect(
      parseCommandPayload("ai.generate", {
        capability: "outline.generate",
        input: {
          chapterCount: 10,
          scope: "chapter_batch",
        },
        instruction: "生成未来 10 章高细节章纲",
        options: {
          maxOutputTokens: 8000,
          temperature: 0.6,
        },
        projectId: "proj_1",
        targetId: "outline_1",
        targetType: "outline",
      }),
    ).toEqual({
      capability: "outline.generate",
      input: {
        chapterCount: 10,
        scope: "chapter_batch",
      },
      instruction: "生成未来 10 章高细节章纲",
      options: {
        maxOutputTokens: 8000,
        temperature: 0.6,
      },
      projectId: "proj_1",
      targetId: "outline_1",
      targetType: "outline",
    });

    expect(
      parseCommandPayload("ai.getRun", {
        projectId: "proj_1",
        workflowRunId: "run_1",
      }),
    ).toEqual({
      projectId: "proj_1",
      workflowRunId: "run_1",
    });

    expect(
      parseCommandPayload("ai.cancelRun", {
        projectId: "proj_1",
        workflowRunId: "run_1",
      }),
    ).toEqual({
      projectId: "proj_1",
      workflowRunId: "run_1",
    });

    expect(
      parseCommandPayload("ai.listArtifacts", {
        kind: "chapter_draft",
        projectId: "proj_1",
        targetId: "chapter_1",
        targetType: "chapter",
      }),
    ).toEqual({
      kind: "chapter_draft",
      projectId: "proj_1",
      targetId: "chapter_1",
      targetType: "chapter",
    });
  });

  it("parses element candidate generation and acceptance payloads", () => {
    expect(
      parseCommandPayload("element.generateCandidates", {
        constraints: ["不使用现代科技词"],
        count: 10,
        elementType: "weapon",
        genre: "玄幻",
        projectId: "proj_1",
        style: "热血",
        worldRuleIds: ["rule_1"],
      }),
    ).toEqual({
      constraints: ["不使用现代科技词"],
      count: 10,
      elementType: "weapon",
      genre: "玄幻",
      projectId: "proj_1",
      style: "热血",
      worldRuleIds: ["rule_1"],
    });

    expect(
      parseCommandPayload("element.acceptCandidates", {
        items: [
          {
            description: "旧城禁军遗失的短刃。",
            name: "夜照",
            rationale: "适合悬疑题材里的线索武器。",
            tags: ["旧城", "线索"],
            type: "weapon",
          },
        ],
        projectId: "proj_1",
      }),
    ).toEqual({
      items: [
        {
          description: "旧城禁军遗失的短刃。",
          name: "夜照",
          rationale: "适合悬疑题材里的线索武器。",
          tags: ["旧城", "线索"],
          type: "weapon",
        },
      ],
      projectId: "proj_1",
    });
  });

  it("parses fixed worldbuilding form fields with 500 character limits", () => {
    expect(
      parseCommandPayload("worldbuilding.saveFields", {
        fields: {
          geography: "旧城围绕钟楼扩散。",
          powerSystem: "角色依靠档案解读和人情网络推进调查。",
          worldBase: "近现代旧城悬疑世界。",
        },
        projectId: "proj_1",
      }),
    ).toEqual({
      fields: {
        coreConflict: "",
        culture: "",
        economy: "",
        factions: "",
        geography: "旧城围绕钟楼扩散。",
        history: "",
        powerOrder: "",
        powerSystem: "角色依靠档案解读和人情网络推进调查。",
        rules: "",
        socialStructure: "",
        specialMechanism: "",
        worldBase: "近现代旧城悬疑世界。",
      },
      projectId: "proj_1",
    });

    expect(() =>
      parseCommandPayload("worldbuilding.completeFields", {
        fields: {
          worldBase: "超".repeat(501),
        },
        projectId: "proj_1",
      }),
    ).toThrow();
  });

  it("parses editable core story form fields with bounded long text and option fields", () => {
    expect(
      parseCommandPayload("blueprint.saveForm", {
        fields: {
          corePromise: "每个单元都给出硬线索和情绪反转。",
          differentiators: ["旧信谜题和人物成长绑定"],
          emotionalAxes: ["悬疑", "反转"],
          logline: "雨夜旧信把主角拖回十年前钟楼旧案。",
          mainConflict: "主角追查真相时不断触碰旧城秩序。",
          mainGoal: "找出钟楼火灾真相并保护仍被旧案威胁的人。",
          premise: "旧城钟楼火灾十年后，主角收到一封不该存在的旧信。",
          risks: ["线索密度不足会削弱追读"],
          stakes: "失败会让旧案幸存者再次被清算。",
          storyDriver: "mystery",
        },
        projectId: "proj_1",
      }),
    ).toEqual({
      fields: {
        antagonistForce: "",
        corePromise: "每个单元都给出硬线索和情绪反转。",
        differentiators: ["旧信谜题和人物成长绑定"],
        emotionalAxes: ["悬疑", "反转"],
        logline: "雨夜旧信把主角拖回十年前钟楼旧案。",
        mainConflict: "主角追查真相时不断触碰旧城秩序。",
        mainGoal: "找出钟楼火灾真相并保护仍被旧案威胁的人。",
        premise: "旧城钟楼火灾十年后，主角收到一封不该存在的旧信。",
        protagonistArc: "",
        risks: ["线索密度不足会削弱追读"],
        stakes: "失败会让旧案幸存者再次被清算。",
        storyDriver: "mystery",
      },
      projectId: "proj_1",
    });

    expect(() =>
      parseCommandPayload("blueprint.completeForm", {
        fields: {
          premise: "故".repeat(801),
        },
        projectId: "proj_1",
      }),
    ).toThrow();
  });

  it("parses longform planning payloads", () => {
    expect(
      parseCommandPayload("plot.generateBookPlan", {
        projectId: "proj_1",
        targetWordCount: 3_000_000,
        volumeCount: 8,
      }),
    ).toEqual({
      projectId: "proj_1",
      targetWordCount: 3_000_000,
      volumeCount: 8,
    });

    expect(
      parseCommandPayload("plot.applyBookPlan", {
        artifactId: "artifact_1",
        projectId: "proj_1",
      }),
    ).toEqual({
      artifactId: "artifact_1",
      projectId: "proj_1",
    });

    expect(
      parseCommandPayload("plot.saveBookPlanDraft", {
        bookPlanId: "book_plan_1",
        corePromise: "每卷完成一次核心爽点兑现。",
        endingDirection: "主角公开终局代价。",
        mainPlotlineId: "plotline_1",
        projectId: "proj_1",
        status: "active",
        targetWordCount: 3_000_000,
        title: "全书大纲",
      }),
    ).toEqual({
      bookPlanId: "book_plan_1",
      corePromise: "每卷完成一次核心爽点兑现。",
      endingDirection: "主角公开终局代价。",
      mainPlotlineId: "plotline_1",
      projectId: "proj_1",
      status: "active",
      targetWordCount: 3_000_000,
      title: "全书大纲",
    });

    expect(
      parseCommandPayload("plot.saveVolumePlan", {
        bookPlanId: "book_plan_1",
        climax: "卷末完成第一次公开破局。",
        majorConflict: "底层修士与司星阁禁令正面冲突。",
        projectId: "proj_1",
        purpose: "展示规则、压迫和第一次突破。",
        status: "draft",
        targetWordCount: 360_000,
        title: "第一卷 星潮初醒",
        volumeIndex: 1,
        volumePlanId: "volume_plan_1",
      }),
    ).toEqual({
      bookPlanId: "book_plan_1",
      climax: "卷末完成第一次公开破局。",
      majorConflict: "底层修士与司星阁禁令正面冲突。",
      projectId: "proj_1",
      purpose: "展示规则、压迫和第一次突破。",
      status: "draft",
      targetWordCount: 360_000,
      title: "第一卷 星潮初醒",
      volumeIndex: 1,
      volumePlanId: "volume_plan_1",
    });

    expect(
      parseCommandPayload("plot.saveArcPlan", {
        arcIndex: 1,
        arcPlanId: "arc_plan_1",
        characterArcId: "character_arc_1",
        endChapterIndex: 20,
        escalation: ["发现禁令", "第一次越界", "暴露代价"],
        plotlineId: "plotline_1",
        projectId: "proj_1",
        purpose: "建立修行规则和第一重代价。",
        startChapterIndex: 1,
        status: "draft",
        title: "星潮初醒",
        volumePlanId: "volume_plan_1",
      }),
    ).toEqual({
      arcIndex: 1,
      arcPlanId: "arc_plan_1",
      characterArcId: "character_arc_1",
      endChapterIndex: 20,
      escalation: ["发现禁令", "第一次越界", "暴露代价"],
      plotlineId: "plotline_1",
      projectId: "proj_1",
      purpose: "建立修行规则和第一重代价。",
      startChapterIndex: 1,
      status: "draft",
      title: "星潮初醒",
      volumePlanId: "volume_plan_1",
    });

    expect(
      parseCommandPayload("plot.generateRollingOutline", {
        chapterCount: 20,
        projectId: "proj_1",
        startChapterIndex: 41,
        volumePlanId: "volume_plan_1",
      }),
    ).toEqual({
      chapterCount: 20,
      projectId: "proj_1",
      startChapterIndex: 41,
      volumePlanId: "volume_plan_1",
    });

    expect(
      parseCommandPayload("plot.applyChapterPlans", {
        artifactId: "artifact_2",
        projectId: "proj_1",
        selectedChapterPlanIds: ["draft_chapter_plan_1"],
      }),
    ).toEqual({
      artifactId: "artifact_2",
      projectId: "proj_1",
      selectedChapterPlanIds: ["draft_chapter_plan_1"],
    });

    expect(
      parseCommandPayload("plot.analyzeOutlineImpact", {
        patch: { title: "新的卷目标" },
        projectId: "proj_1",
        targetId: "chapter_plan_1",
        targetType: "chapter_plan",
      }),
    ).toEqual({
      patch: { title: "新的卷目标" },
      projectId: "proj_1",
      targetId: "chapter_plan_1",
      targetType: "chapter_plan",
    });
  });

  it("parses creative path and outline payloads", () => {
    expect(
      parseCommandPayload("brief.save", {
        emotionalRewards: ["爽点", "悬疑"],
        estimatedChapterCount: 260,
        estimatedWordCount: 800_000,
        forbiddenDirections: ["不要系统流"],
        genre: "玄幻",
        initialIdea: "少年发现旧都遗物。",
        lengthProfile: "长篇连载",
        narrativePov: "第三人称",
        platformProfile: "男频",
        projectId: "proj_1",
        subgenres: ["废柴逆袭"],
        targetAudience: "男频爽文",
      }),
    ).toMatchObject({
      estimatedChapterCount: 260,
      estimatedWordCount: 800_000,
      genre: "玄幻",
      initialIdea: "少年发现旧都遗物。",
      subgenres: ["废柴逆袭"],
      targetAudience: "男频爽文",
    });

    expect(() =>
      parseCommandPayload("brief.save", {
        estimatedChapterCount: 0,
        estimatedWordCount: 9_999,
        genre: "玄幻",
        projectId: "proj_1",
      }),
    ).toThrow();

    expect(
      parseCommandPayload("outline.generate", {
        chapterCount: 10,
        projectId: "proj_1",
        scope: "chapter_batch",
      }),
    ).toEqual({
      chapterCount: 10,
      projectId: "proj_1",
      scope: "chapter_batch",
    });

    expect(
      parseCommandPayload("chapter.generateDraftFromOutline", {
        chapterOutlineId: "chapter_outline_1",
        instruction: "强化悬疑钩子",
        projectId: "proj_1",
      }),
    ).toEqual({
      chapterOutlineId: "chapter_outline_1",
      instruction: "强化悬疑钩子",
      projectId: "proj_1",
    });

    expect(
      parseCommandPayload("chapter.generateDraftFromPlan", {
        chapterPlanId: "chapter_plan_1",
        instruction: "强化章末钩子",
        projectId: "proj_1",
      }),
    ).toEqual({
      chapterPlanId: "chapter_plan_1",
      instruction: "强化章末钩子",
      projectId: "proj_1",
    });

    expect(
      parseCommandPayload("creativeStage.evaluateGate", {
        projectId: "proj_1",
        stageKey: "worldbuilding",
      }),
    ).toEqual({
      projectId: "proj_1",
      stageKey: "worldbuilding",
    });

    expect(
      parseCommandPayload("creativeStage.advance", {
        mode: "strict",
        projectId: "proj_1",
        stageKey: "worldbuilding",
      }),
    ).toEqual({
      mode: "strict",
      projectId: "proj_1",
      stageKey: "worldbuilding",
    });

    expect(
      parseCommandPayload("creativeStage.reopen", {
        projectId: "proj_1",
        reason: "补充势力关系",
        stageKey: "characters",
      }),
    ).toEqual({
      projectId: "proj_1",
      reason: "补充势力关系",
      stageKey: "characters",
    });

    expect(
      parseCommandPayload("creativeStage.skip", {
        projectId: "proj_1",
        reason: "已有外部设定稿",
        stageKey: "worldbuilding",
      }),
    ).toEqual({
      projectId: "proj_1",
      reason: "已有外部设定稿",
      stageKey: "worldbuilding",
    });

    expect(
      parseCommandPayload("creativeStage.complete", {
        projectId: "proj_1",
        stageKey: "worldbuilding",
      }),
    ).toEqual({
      projectId: "proj_1",
      stageKey: "worldbuilding",
    });
  });

  it("rejects unsupported element candidate counts and empty acceptance batches", () => {
    expect(() =>
      parseCommandPayload("element.generateCandidates", {
        count: 7,
        elementType: "weapon",
        projectId: "proj_1",
      }),
    ).toThrow();

    expect(() =>
      parseCommandPayload("element.acceptCandidates", {
        items: [],
        projectId: "proj_1",
      }),
    ).toThrow();
  });

  it("parses chapter.saveContent payloads", () => {
    expect(
      parseCommandPayload("chapter.saveContent", {
        projectId: "proj_1",
        chapterId: "chapter_1",
        content: "雨夜来信",
        baseVersion: 1,
      }),
    ).toEqual({
      projectId: "proj_1",
      chapterId: "chapter_1",
      content: "雨夜来信",
      baseVersion: 1,
    });
  });

  it("parses story events with participants", () => {
    expect(
      parseCommandPayload("storyEvent.create", {
        projectId: "proj_1",
        title: "雨夜来信",
        description: "主角收到关键线索。",
        eventType: "discovery",
        participants: [
          {
            entityType: "character",
            entityId: "char_1",
            role: "discoverer",
          },
        ],
      }),
    ).toMatchObject({
      participants: [
        {
          entityType: "character",
          entityId: "char_1",
          role: "discoverer",
        },
      ],
    });
  });

  it("parses foreshadowings with seed and payoff event links", () => {
    expect(
      parseCommandPayload("foreshadowing.create", {
        projectId: "proj_1",
        title: "旧报纸日期",
        description: "门缝下露出的旧报纸日期。",
        payoffExpectation: "揭示十年前的火灾不是事故。",
        seedEventId: "event_seed",
        payoffEventId: "event_payoff",
      }),
    ).toMatchObject({
      payoffEventId: "event_payoff",
      seedEventId: "event_seed",
    });
  });

  it("rejects unknown commands", () => {
    expect(() => parseCommandPayload("unknown.command", {})).toThrow("UNKNOWN_COMMAND");
  });

  it("rejects invalid command payloads", () => {
    expect(() =>
      parseCommandPayload("memory.confirm", {
        projectId: "proj_1",
        candidateId: "candidate_1",
        decision: "auto_canon",
      }),
    ).toThrow();
  });
});
