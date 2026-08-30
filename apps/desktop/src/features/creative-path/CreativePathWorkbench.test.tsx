import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders";
import { CreativePathWorkbench, type CreativePathBoard } from "./CreativePathWorkbench";

type PersistedLegacyGateReport = NonNullable<CreativePathBoard["stages"][number]["gateReport"]>;

describe("CreativePathWorkbench", () => {
  it("renders the nine-step creative path before chapter production", () => {
    render(
      <AppProviders>
        <CreativePathWorkbench
          board={createCreativePathBoard()}
          onApplyBlueprint={vi.fn()}
          onApplyChapterOutline={vi.fn()}
          onApproveChapterOutline={vi.fn()}
          onCompleteStage={vi.fn()}
          onConfirmBrief={vi.fn()}
          onGenerateBlueprint={vi.fn()}
          onGenerateDraftFromOutline={vi.fn()}
          onGenerateOutline={vi.fn()}
          onOpenCreativeElements={vi.fn()}
          onSaveBrief={vi.fn()}
        />
      </AppProviders>,
    );

    expect(screen.getByText("创作路径")).toBeInTheDocument();
    expect(screen.getAllByText("作品立项").length).toBeGreaterThan(0);
    expect(screen.getAllByText("大纲设计").length).toBeGreaterThan(0);
    expect(screen.queryByText("暂无章节")).not.toBeInTheDocument();
  });

  it("submits brief, blueprint, outline, and chapter draft actions", async () => {
    const onSaveBrief = vi.fn().mockResolvedValue(undefined);
    const onConfirmBrief = vi.fn().mockResolvedValue(undefined);
    const onGenerateBlueprint = vi.fn().mockResolvedValue(undefined);
    const onApplyBlueprint = vi.fn().mockResolvedValue(undefined);
    const onGenerateOutline = vi.fn().mockResolvedValue(undefined);
    const onApproveChapterOutline = vi.fn().mockResolvedValue(undefined);
    const onApplyChapterOutline = vi.fn().mockResolvedValue(undefined);
    const onGenerateDraftFromOutline = vi.fn().mockResolvedValue(undefined);
    const board = createCreativePathBoard();

    render(
      <AppProviders>
        <CreativePathWorkbench
          board={board}
          onApplyBlueprint={onApplyBlueprint}
          onApplyChapterOutline={onApplyChapterOutline}
          onApproveChapterOutline={onApproveChapterOutline}
          onCompleteStage={vi.fn()}
          onConfirmBrief={onConfirmBrief}
          onGenerateBlueprint={onGenerateBlueprint}
          onGenerateDraftFromOutline={onGenerateDraftFromOutline}
          onGenerateOutline={onGenerateOutline}
          onOpenCreativeElements={vi.fn()}
          onSaveBrief={onSaveBrief}
        />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole("button", { name: "保存立项" }));
    await waitFor(() => {
      expect(onSaveBrief).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedChapterCount: 260,
          estimatedWordCount: 800_000,
          genre: "玄幻",
          subgenres: ["废柴逆袭"],
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "确认立项" }));
    fireEvent.click(screen.getByRole("button", { name: "生成创作蓝图" }));
    fireEvent.click(screen.getByRole("button", { name: "应用蓝图" }));
    fireEvent.click(screen.getByRole("button", { name: "生成前 10 章章纲" }));
    fireEvent.click(screen.getByRole("button", { name: "批准章纲 第 1 章：开局钩子" }));
    fireEvent.click(screen.getByRole("button", { name: "应用为空章节 第 1 章：开局钩子" }));
    fireEvent.click(screen.getByRole("button", { name: "基于章纲生成草稿 第 1 章：开局钩子" }));

    await waitFor(() => {
      expect(onConfirmBrief).toHaveBeenCalledWith({ briefId: "brief_1" });
      expect(onGenerateBlueprint).toHaveBeenCalledTimes(1);
      expect(onApplyBlueprint).toHaveBeenCalledWith({ blueprintId: "blueprint_1" });
      expect(onGenerateOutline).toHaveBeenCalledWith({ chapterCount: 10, scope: "chapter_batch" });
      expect(onApproveChapterOutline).toHaveBeenCalledWith({ chapterOutlineId: "outline_ch_1" });
      expect(onApplyChapterOutline).toHaveBeenCalledWith({ chapterOutlineId: "outline_ch_1" });
      expect(onGenerateDraftFromOutline).toHaveBeenCalledWith({
        chapterOutlineId: "outline_ch_1",
      });
    });
  });

  it("submits longform book plan and rolling outline actions", async () => {
    const onGenerateBookPlan = vi.fn().mockResolvedValue(undefined);
    const onGenerateDraftFromPlan = vi.fn().mockResolvedValue(undefined);
    const onGenerateRollingOutline = vi.fn().mockResolvedValue(undefined);
    const board = createCreativePathBoard({
      arcPlans: [
        {
          arcIndex: 1,
          characterArcId: null,
          endChapterIndex: 20,
          escalation: ["发现禁令", "第一次越界", "暴露代价"],
          id: "arc_plan_1",
          plotlineId: null,
          purpose: "建立修行规则和第一重代价。",
          startChapterIndex: 1,
          status: "draft",
          title: "星潮初醒",
          volumePlanId: "volume_plan_1",
        },
      ],
      bookPlans: [
        {
          corePromise: "每卷完成一次境界突破和一次关系反转。",
          endingDirection: "主角以失去旧身份为代价重塑天道。",
          id: "book_plan_1",
          mainPlotlineId: null,
          status: "draft",
          targetWordCount: 3_000_000,
          title: "星潮纪全书规划",
        },
      ],
      chapterPlans: [
        {
          chapterGoal: "主角第一次触碰星潮禁令。",
          chapterIndex: 1,
          id: "chapter_plan_1",
          status: "draft",
          title: "第 1 章 星潮禁令",
        },
      ],
      scenePlans: [
        {
          chapterPlanId: "chapter_plan_1",
          id: "scene_plan_1",
          sceneIndex: 1,
        },
      ],
      volumePlans: [
        {
          bookPlanId: "book_plan_1",
          climax: "主角公开打破司星阁第一条禁令。",
          id: "volume_plan_1",
          majorConflict: "主角想借星潮修行，司星阁禁止底层接触星潮。",
          purpose: "完成世界规则展示和主角初次突破。",
          status: "draft",
          targetWordCount: 360_000,
          title: "第一卷 星潮初醒",
          volumeIndex: 1,
        },
      ],
    });

    render(
      <AppProviders>
        <CreativePathWorkbench
          board={board}
          onApplyBlueprint={vi.fn()}
          onApplyChapterOutline={vi.fn()}
          onApproveChapterOutline={vi.fn()}
          onCompleteStage={vi.fn()}
          onConfirmBrief={vi.fn()}
          onGenerateBlueprint={vi.fn()}
          onGenerateBookPlan={onGenerateBookPlan}
          onGenerateDraftFromOutline={vi.fn()}
          onGenerateDraftFromPlan={onGenerateDraftFromPlan}
          onGenerateOutline={vi.fn()}
          onGenerateRollingOutline={onGenerateRollingOutline}
          onOpenCreativeElements={vi.fn()}
          onSaveBrief={vi.fn()}
        />
      </AppProviders>,
    );

    expect(screen.getByText("星潮纪全书规划")).toBeInTheDocument();
    expect(screen.getByText("第一卷 星潮初醒")).toBeInTheDocument();
    expect(screen.getAllByText("第 1 章 星潮禁令").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "生成全书规划" }));
    fireEvent.click(screen.getByRole("button", { name: "生成未来 10 章章纲" }));
    fireEvent.click(screen.getByRole("button", { name: "基于结构章纲生成草稿 第 1 章 星潮禁令" }));

    await waitFor(() => {
      expect(onGenerateBookPlan).toHaveBeenCalledWith({
        targetWordCount: 3_000_000,
        volumeCount: 6,
      });
      expect(onGenerateRollingOutline).toHaveBeenCalledWith({
        chapterCount: 10,
        startChapterIndex: 2,
        volumePlanId: "volume_plan_1",
      });
      expect(onGenerateDraftFromPlan).toHaveBeenCalledWith({
        chapterPlanId: "chapter_plan_1",
      });
    });
  });

  it("exposes middle-stage entries after blueprint unlocks worldbuilding", async () => {
    const onOpenCreativeElements = vi.fn();
    const onCompleteStage = vi.fn().mockResolvedValue(undefined);
    const board = createCreativePathBoard({
      stages: [
        { readinessScore: 100, stageKey: "brief", status: "completed" },
        { readinessScore: 100, stageKey: "blueprint", status: "completed" },
        { readinessScore: 10, stageKey: "worldbuilding", status: "available" },
        { readinessScore: 0, stageKey: "characters", status: "locked" },
        { readinessScore: 0, stageKey: "plot_arcs", status: "locked" },
        { readinessScore: 0, stageKey: "outline", status: "locked" },
        { readinessScore: 0, stageKey: "chapters", status: "locked" },
        { readinessScore: 0, stageKey: "memory_review", status: "locked" },
        { readinessScore: 0, stageKey: "retrospective", status: "locked" },
      ],
    });

    render(
      <AppProviders>
        <CreativePathWorkbench
          board={board}
          onApplyBlueprint={vi.fn()}
          onApplyChapterOutline={vi.fn()}
          onApproveChapterOutline={vi.fn()}
          onCompleteStage={onCompleteStage}
          onConfirmBrief={vi.fn()}
          onGenerateBlueprint={vi.fn()}
          onGenerateDraftFromOutline={vi.fn()}
          onGenerateOutline={vi.fn()}
          onOpenCreativeElements={onOpenCreativeElements}
          onSaveBrief={vi.fn()}
        />
      </AppProviders>,
    );

    expect(screen.getByRole("heading", { name: "世界观与要素" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "人物与关系网" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "剧情弧线" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "进入创作要素" }));
    fireEvent.click(screen.getByRole("button", { name: "完成世界观与要素" }));

    await waitFor(() => {
      expect(onOpenCreativeElements).toHaveBeenCalledTimes(1);
      expect(onCompleteStage).toHaveBeenCalledWith({ stageKey: "worldbuilding" });
    });
  });

  it("renders stages when persisted gate reports do not include requirement details", () => {
    const board = createCreativePathBoard({
      stages: [
        {
          gateReport: { completed: true } as unknown as PersistedLegacyGateReport,
          readinessScore: 100,
          stageKey: "brief",
          status: "completed",
        },
        {
          gateReport: { completed: true } as unknown as PersistedLegacyGateReport,
          readinessScore: 100,
          stageKey: "blueprint",
          status: "completed",
        },
        {
          gateReport: { initialized: true } as unknown as PersistedLegacyGateReport,
          readinessScore: 10,
          stageKey: "worldbuilding",
          status: "available",
        },
        { readinessScore: 0, stageKey: "characters", status: "locked" },
        { readinessScore: 0, stageKey: "plot_arcs", status: "locked" },
        { readinessScore: 0, stageKey: "outline", status: "locked" },
        { readinessScore: 0, stageKey: "chapters", status: "locked" },
        { readinessScore: 0, stageKey: "memory_review", status: "locked" },
        { readinessScore: 0, stageKey: "retrospective", status: "locked" },
      ],
    });

    render(
      <AppProviders>
        <CreativePathWorkbench
          board={board}
          onApplyBlueprint={vi.fn()}
          onApplyChapterOutline={vi.fn()}
          onApproveChapterOutline={vi.fn()}
          onCompleteStage={vi.fn()}
          onConfirmBrief={vi.fn()}
          onGenerateBlueprint={vi.fn()}
          onGenerateDraftFromOutline={vi.fn()}
          onGenerateOutline={vi.fn()}
          onOpenCreativeElements={vi.fn()}
          onSaveBrief={vi.fn()}
        />
      </AppProviders>,
    );

    expect(screen.getByRole("heading", { name: "世界观与要素" })).toBeInTheDocument();
  });
});

function createCreativePathBoard(overrides: Partial<CreativePathBoard> = {}): CreativePathBoard {
  return {
    blueprint: {
      antagonistForce: "旧秩序",
      corePromise: "持续提供线索推进和阶段回报。",
      differentiators: ["章纲约束正文"],
      id: "blueprint_1",
      logline: "少年发现旧都遗物。",
      mainConflict: "主角与旧秩序冲突。",
      premise: "少年发现旧都遗物。",
      protagonistArc: "从被动卷入到主动承担。",
      risks: ["设定过多拖慢开篇"],
      status: "draft",
    },
    brief: {
      emotionalRewards: ["爽点"],
      estimatedChapterCount: 260,
      estimatedWordCount: 800_000,
      forbiddenDirections: [],
      genre: "玄幻",
      id: "brief_1",
      initialIdea: "少年发现旧都遗物。",
      lengthProfile: "长篇连载",
      narrativePov: "第三人称",
      platformProfile: "男频",
      status: "draft",
      subgenres: ["废柴逆袭"],
      targetAudience: "男频爽文",
    },
    chapterOutlines: [
      {
        chapterGoal: "完成开局钩子。",
        chapterId: null,
        conflict: "主角与阻力碰撞。",
        hook: "旧都遗物发出异响。",
        id: "outline_ch_1",
        informationGain: "旧都曾被封锁。",
        status: "approved",
        title: "第 1 章：开局钩子",
      },
    ],
    arcPlans: [],
    bookPlans: [],
    chapterPlans: [],
    outlines: [
      {
        id: "outline_1",
        scope: "chapter_batch",
        status: "draft",
        title: "前 10 章章纲",
      },
    ],
    reviewIssues: [],
    sceneOutlines: [],
    scenePlans: [],
    stages: [
      { readinessScore: 10, stageKey: "brief", status: "available" },
      { readinessScore: 0, stageKey: "blueprint", status: "locked" },
      { readinessScore: 0, stageKey: "worldbuilding", status: "locked" },
      { readinessScore: 0, stageKey: "characters", status: "locked" },
      { readinessScore: 0, stageKey: "plot_arcs", status: "locked" },
      { readinessScore: 0, stageKey: "outline", status: "locked" },
      { readinessScore: 0, stageKey: "chapters", status: "locked" },
      { readinessScore: 0, stageKey: "memory_review", status: "locked" },
      { readinessScore: 0, stageKey: "retrospective", status: "locked" },
    ],
    volumeOutlines: [],
    volumePlans: [],
    ...overrides,
  };
}
