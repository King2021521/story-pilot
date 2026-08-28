import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders";
import { CreativePathWorkbench, type CreativePathBoard } from "./CreativePathWorkbench";

describe("CreativePathWorkbench", () => {
  it("renders the nine-step creative path before chapter production", () => {
    render(
      <AppProviders>
        <CreativePathWorkbench
          board={createCreativePathBoard()}
          onApplyBlueprint={vi.fn()}
          onApplyChapterOutline={vi.fn()}
          onApproveChapterOutline={vi.fn()}
          onConfirmBrief={vi.fn()}
          onGenerateBlueprint={vi.fn()}
          onGenerateDraftFromOutline={vi.fn()}
          onGenerateOutline={vi.fn()}
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
          onConfirmBrief={onConfirmBrief}
          onGenerateBlueprint={onGenerateBlueprint}
          onGenerateDraftFromOutline={onGenerateDraftFromOutline}
          onGenerateOutline={onGenerateOutline}
          onSaveBrief={onSaveBrief}
        />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole("button", { name: "保存立项" }));
    await waitFor(() => {
      expect(onSaveBrief).toHaveBeenCalledWith(
        expect.objectContaining({
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
});

function createCreativePathBoard(): CreativePathBoard {
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
    outlines: [
      {
        id: "outline_1",
        scope: "chapter_batch",
        status: "draft",
        title: "前 10 章章纲",
      },
    ],
    reviewIssues: [],
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
  };
}
