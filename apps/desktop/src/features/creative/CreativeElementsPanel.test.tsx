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

    render(
      <AppProviders>
        <CreativeElementsPanel
          characters={[]}
          foreshadowings={[]}
          onCreateCharacter={onCreateCharacter}
          onCreateForeshadowing={onCreateForeshadowing}
          onCreatePlotline={onCreatePlotline}
          onCreateWorldRule={onCreateWorldRule}
          plotlines={[]}
          worldRules={[]}
        />
      </AppProviders>,
    );

    fireEvent.change(screen.getByLabelText("人物名称"), { target: { value: "林鸢" } });
    fireEvent.click(screen.getByRole("button", { name: "创建人物" }));

    fireEvent.change(screen.getByLabelText("规则标题"), { target: { value: "旧城区治理" } });
    fireEvent.change(screen.getByLabelText("规则内容"), { target: { value: "旧城区由钟楼议会管理。" } });
    fireEvent.click(screen.getByRole("button", { name: "创建规则" }));

    fireEvent.change(screen.getByLabelText("故事线标题"), { target: { value: "旧信谜团" } });
    fireEvent.change(screen.getByLabelText("故事线摘要"), { target: { value: "围绕旧信来源展开。" } });
    fireEvent.click(screen.getByRole("button", { name: "创建故事线" }));

    fireEvent.change(screen.getByLabelText("伏笔标题"), { target: { value: "水印伏笔" } });
    fireEvent.change(screen.getByLabelText("伏笔内容"), { target: { value: "信纸水印暗示十年前档案。" } });
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
});
