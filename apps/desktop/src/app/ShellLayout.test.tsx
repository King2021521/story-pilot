import { invoke } from "@tauri-apps/api/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "./AppProviders";
import { ShellLayout } from "./ShellLayout";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("ShellLayout", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (_tauriCommand, args) => {
      const request = getRpcRequest(args);

      return rpcSuccess(request.id, request.command === "project.listRecent" ? [] : null);
    });
  });

  it("renders project sidebar, workbench, board drawer entry, and AI task drawer entry", () => {
    render(
      <AppProviders>
        <ShellLayout />
      </AppProviders>,
    );

    expect(screen.getByLabelText("作品管理区")).toBeInTheDocument();
    expect(screen.getByLabelText("工作台")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "项目看板" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 任务" })).toBeInTheDocument();
  });

  it("creates a local project through RPC when no recent project exists", async () => {
    const project = createProject();

    invokeMock.mockImplementation(async (_tauriCommand, args) => {
      const request = getRpcRequest(args);
      if (request.command === "project.create") {
        return rpcSuccess(request.id, project);
      }
      if (request.command === "workbench.getBoard") {
        return rpcSuccess(request.id, {
          artifacts: [],
          chapters: [],
          memoryCandidates: [],
          project,
          workOrders: [],
        });
      }

      return rpcSuccess(request.id, []);
    });

    render(
      <AppProviders>
        <ShellLayout />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole("button", { name: /新建作品/ }));
    fireEvent.change(screen.getByLabelText("作品名称"), { target: { value: "雾都案卷" } });
    fireEvent.change(screen.getByLabelText("题材"), { target: { value: "悬疑" } });
    fireEvent.click(screen.getByRole("button", { name: "创建作品" }));

    await waitFor(() => {
      expect(rpcPayload("project.create")).toMatchObject({
        genre: "悬疑",
        title: "雾都案卷",
      });
    });
    expect(await screen.findByRole("heading", { name: "雾都案卷" })).toBeInTheDocument();
  });

  it("sends chapter and memory actions through typed RPC commands", async () => {
    const project = createProject();
    const chapter = {
      content: "雨夜里，林鸢发现门缝下有一封旧信。",
      id: "chapter_1",
      title: "第一章 雨夜来信",
      version: 1,
    };
    let memoryCandidates = [
      {
        confidence: 0.82,
        content: "林鸢发现一封来历异常的旧信。",
        id: "candidate_accept",
        kind: "event",
        status: "pending",
      },
      {
        confidence: 0.71,
        content: "旧城区钟楼在雨夜会停摆。",
        id: "candidate_reject",
        kind: "world_rule",
        status: "pending",
      },
    ];

    invokeMock.mockImplementation(async (_tauriCommand, args) => {
      const request = getRpcRequest(args);
      switch (request.command) {
        case "project.listRecent":
          return rpcSuccess(request.id, [project]);
        case "project.open":
          return rpcSuccess(request.id, project);
        case "workbench.getBoard":
          return rpcSuccess(request.id, {
            artifacts: [],
            chapters: [chapter],
            memoryCandidates,
            project,
            workOrders: [],
          });
        case "chapter.saveContent":
          chapter.content = request.payload.content as string;
          chapter.version += 1;
          return rpcSuccess(request.id, chapter);
        case "chapter.generateDraft":
          return rpcSuccess(request.id, {
            artifact: { id: "artifact_1", status: "pending", title: "AI 章节草稿" },
            memoryCandidates: [],
            workflowRun: { id: "run_1", status: "succeeded" },
          });
        case "memory.confirm":
          memoryCandidates = memoryCandidates.filter(
            (candidate) => candidate.id !== request.payload.candidateId,
          );
          return rpcSuccess(request.id, {
            candidate: { id: request.payload.candidateId, status: "accepted" },
            memory: { id: "memory_1", status: "canon" },
          });
        case "memory.reject":
          memoryCandidates = memoryCandidates.filter(
            (candidate) => candidate.id !== request.payload.candidateId,
          );
          return rpcSuccess(request.id, {
            candidate: { id: request.payload.candidateId, status: "rejected" },
          });
        default:
          return rpcSuccess(request.id, null);
      }
    });

    render(
      <AppProviders>
        <ShellLayout />
      </AppProviders>,
    );

    fireEvent.change(await screen.findByLabelText("章节正文"), {
      target: { value: "更新后的章节正文。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存章节" }));
    fireEvent.click(screen.getByRole("button", { name: "生成草稿" }));
    fireEvent.click(screen.getByRole("tab", { name: "记忆确认" }));

    const acceptedCandidate = screen.getByText("林鸢发现一封来历异常的旧信。").closest("li");
    expect(acceptedCandidate).not.toBeNull();
    fireEvent.click(within(acceptedCandidate as HTMLElement).getByRole("button", { name: "接受" }));

    const rejectedCandidate = await screen.findByText("旧城区钟楼在雨夜会停摆。");
    const rejectedCandidateItem = rejectedCandidate.closest("li");
    expect(rejectedCandidateItem).not.toBeNull();
    fireEvent.click(
      within(rejectedCandidateItem as HTMLElement).getByRole("button", { name: "拒绝" }),
    );

    await waitFor(() => {
      expect(rpcPayload("chapter.saveContent")).toMatchObject({
        baseVersion: 1,
        chapterId: "chapter_1",
        content: "更新后的章节正文。",
        projectId: "project_1",
      });
      expect(rpcPayload("chapter.generateDraft")).toMatchObject({
        chapterId: "chapter_1",
        instruction: "基于当前章节目标生成草稿",
        projectId: "project_1",
      });
      expect(rpcPayload("memory.confirm")).toMatchObject({
        candidateId: "candidate_accept",
        decision: "canon",
        projectId: "project_1",
      });
      expect(rpcPayload("memory.reject")).toMatchObject({
        candidateId: "candidate_reject",
        projectId: "project_1",
      });
    });
  });
});

interface TestRpcRequest {
  readonly id: string;
  readonly command: string;
  readonly payload: Record<string, unknown>;
}

function getRpcRequest(args: unknown): TestRpcRequest {
  return (args as { request: TestRpcRequest }).request;
}

function rpcSuccess(id: string, data: unknown) {
  return {
    data,
    id,
    ok: true,
  };
}

function rpcPayload(command: string): Record<string, unknown> {
  const call = invokeMock.mock.calls.find(([, args]) => getRpcRequest(args).command === command);

  return call ? getRpcRequest(call[1]).payload : {};
}

function createProject() {
  return {
    defaultVolumeId: "volume_1",
    genre: "悬疑",
    id: "project_1",
    rootPath: "/tmp/story-pilot/project_1",
    status: "planning",
    title: "雾都案卷",
    updatedAt: 1,
    workId: "work_1",
  };
}
