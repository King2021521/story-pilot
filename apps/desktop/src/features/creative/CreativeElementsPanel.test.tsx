import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders";
import { CreativeElementsPanel } from "./CreativeElementsPanel";

describe("CreativeElementsPanel", () => {
  it("submits character, world rule, plotline, and foreshadowing forms", async () => {
    const onCreateCharacter = vi.fn();
    const onCreateWorldRule = vi.fn();
    const onCreatePlotline = vi.fn();
    const onCreateForeshadowing = vi.fn();
    const onGenerateElementCandidates = vi.fn();
    const onAcceptElementCandidates = vi.fn();

    render(
      <AppProviders>
        <CreativeElementsPanel
          characters={[]}
          foreshadowings={[]}
          items={[]}
          locations={[]}
          onCreateCharacter={onCreateCharacter}
          onCreateForeshadowing={onCreateForeshadowing}
          onCreatePlotline={onCreatePlotline}
          onCreateWorldRule={onCreateWorldRule}
          onAcceptElementCandidates={onAcceptElementCandidates}
          onGenerateElementCandidates={onGenerateElementCandidates}
          organizations={[]}
          plotlines={[]}
          projectGenre="悬疑"
          projectStyle="悬疑推理"
          worldRules={[]}
        />
      </AppProviders>,
    );

    fireEvent.change(screen.getByLabelText("人物名称"), { target: { value: "林鸢" } });
    fireEvent.click(screen.getByRole("button", { name: "创建人物" }));

    fireEvent.change(screen.getByLabelText("规则标题"), { target: { value: "旧城区治理" } });
    fireEvent.change(screen.getByLabelText("规则内容"), {
      target: { value: "旧城区由钟楼议会管理。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建规则" }));

    fireEvent.change(screen.getByLabelText("故事线标题"), { target: { value: "旧信谜团" } });
    fireEvent.change(screen.getByLabelText("故事线摘要"), {
      target: { value: "围绕旧信来源展开。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建故事线" }));

    fireEvent.change(screen.getByLabelText("伏笔标题"), { target: { value: "水印伏笔" } });
    fireEvent.change(screen.getByLabelText("伏笔内容"), {
      target: { value: "信纸水印暗示十年前档案。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建伏笔" }));

    await waitFor(() => {
      expect(onCreateCharacter).toHaveBeenCalledWith({ name: "林鸢", role: "support" });
      expect(onCreateWorldRule).toHaveBeenCalledWith({
        category: "custom",
        constraintLevel: "soft",
        statement: "旧城区由钟楼议会管理。",
        title: "旧城区治理",
      });
      expect(onCreatePlotline).toHaveBeenCalledWith({
        kind: "branch",
        priority: 0,
        summary: "围绕旧信来源展开。",
        title: "旧信谜团",
      });
      expect(onCreateForeshadowing).toHaveBeenCalledWith({
        description: "信纸水印暗示十年前档案。",
        importance: 3,
        title: "水印伏笔",
      });
    });
  });

  it("generates selectable AI element candidates and accepts the selected items", async () => {
    const candidate = {
      description: "受星轨潮汐影响的刀器，潮声越近锋芒越亮。",
      name: "潮汐断星刃",
      rationale: "贴合热血玄幻题材。",
      tags: ["武器", "星轨"],
      type: "weapon" as const,
    };
    const onGenerateElementCandidates = vi.fn().mockResolvedValue({ items: [candidate] });
    const onAcceptElementCandidates = vi.fn().mockResolvedValue(undefined);

    render(
      <AppProviders>
        <CreativeElementsPanel
          characters={[]}
          foreshadowings={[]}
          items={[]}
          locations={[]}
          onAcceptElementCandidates={onAcceptElementCandidates}
          onCreateCharacter={vi.fn()}
          onCreateForeshadowing={vi.fn()}
          onCreatePlotline={vi.fn()}
          onCreateWorldRule={vi.fn()}
          onGenerateElementCandidates={onGenerateElementCandidates}
          organizations={[]}
          plotlines={[]}
          projectGenre="玄幻"
          projectStyle="热血"
          worldRules={[
            {
              category: "magic",
              content: "所有兵器和功法都必须受星轨潮汐影响。",
              id: "rule_1",
              status: "canon",
              title: "星轨潮汐",
            },
          ]}
        />
      </AppProviders>,
    );

    expect(screen.getByLabelText("候选类型")).toHaveAttribute("role", "combobox");
    expect(screen.getByLabelText("数量")).toHaveAttribute("role", "combobox");
    expect(screen.getByLabelText("候选风格")).toHaveAttribute("role", "combobox");

    fireEvent.click(screen.getByRole("button", { name: "批量生成候选" }));

    await waitFor(() => {
      expect(onGenerateElementCandidates).toHaveBeenCalledWith({
        constraints: [],
        count: 10,
        elementType: "weapon",
        genre: "玄幻",
        style: "热血",
        worldRuleIds: ["rule_1"],
      });
    });
    expect(await screen.findByText("潮汐断星刃")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("选择候选 潮汐断星刃"));
    fireEvent.click(screen.getByRole("button", { name: "采纳选中" }));

    await waitFor(() => {
      expect(onAcceptElementCandidates).toHaveBeenCalledWith({ items: [candidate] });
    });
  });

  it("uses 通用 as candidate style when the project has no style", async () => {
    const onGenerateElementCandidates = vi.fn().mockResolvedValue({ items: [] });

    render(
      <AppProviders>
        <CreativeElementsPanel
          characters={[]}
          foreshadowings={[]}
          items={[]}
          locations={[]}
          onAcceptElementCandidates={vi.fn()}
          onCreateCharacter={vi.fn()}
          onCreateForeshadowing={vi.fn()}
          onCreatePlotline={vi.fn()}
          onCreateWorldRule={vi.fn()}
          onGenerateElementCandidates={onGenerateElementCandidates}
          organizations={[]}
          plotlines={[]}
          projectGenre="玄幻"
          worldRules={[]}
        />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole("button", { name: "批量生成候选" }));

    await waitFor(() => {
      expect(onGenerateElementCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ style: "通用" }),
      );
    });
  });
});
