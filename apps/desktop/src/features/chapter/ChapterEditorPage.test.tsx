import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders";
import { ChapterEditorPage } from "./ChapterEditorPage";

describe("ChapterEditorPage", () => {
  it("renders chapter editor and calls save and generate draft callbacks", async () => {
    const onGenerateDraft = vi.fn();
    const onSave = vi.fn();

    render(
      <AppProviders>
        <ChapterEditorPage
          chapter={{
            content: "雨夜里，林鸢发现门缝下有一封旧信。",
            id: "chapter_1",
            title: "第一章 雨夜来信",
            version: 1,
          }}
          onGenerateDraft={onGenerateDraft}
          onSave={onSave}
        />
      </AppProviders>,
    );

    fireEvent.change(screen.getByLabelText("章节正文"), {
      target: { value: "更新后的章节正文。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存章节" }));
    fireEvent.click(screen.getByRole("button", { name: "生成草稿" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        baseVersion: 1,
        chapterId: "chapter_1",
        content: "更新后的章节正文。",
      }),
    );
    expect(onGenerateDraft).toHaveBeenCalledWith({
      chapterId: "chapter_1",
      instruction: "基于当前章节目标生成草稿",
    });
  });
});
