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

      return rpcSuccess(
        request.id,
        request.command === "project.listRecent" ? { items: [] } : null,
      );
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

  it("opens settings, saves model config, validates model, and exports diagnostics", async () => {
    const project = createProject();
    const runtimeSettings = {
      model: {
        apiKey: "",
        baseUrl: "",
        embeddingModel: "",
        maxRetries: 2,
        model: "gpt-5.5",
        provider: "openai-compatible",
        timeoutMs: 120000,
      },
      privacy: {
        allowDiagnosticsExport: true,
        redactApiKeyInLogs: true,
      },
      storage: {
        autoBackup: true,
        backupRetention: 20,
        homeDir: "/Users/test/.story-pilot",
      },
      version: 1,
    };

    invokeMock.mockImplementation(async (_tauriCommand, args) => {
      const request = getRpcRequest(args);
      switch (request.command) {
        case "project.listRecent":
          return rpcSuccess(request.id, { items: [project] });
        case "project.open":
          return rpcSuccess(request.id, project);
        case "workbench.getBoard":
          return rpcSuccess(request.id, {
            artifacts: [],
            chapters: [],
            memoryCandidates: [],
            project,
            workOrders: [],
          });
        case "settings.get":
          return rpcSuccess(request.id, runtimeSettings);
        case "settings.update":
          Object.assign(runtimeSettings.model, request.payload.model);
          Object.assign(runtimeSettings.storage, request.payload.storage);
          return rpcSuccess(request.id, runtimeSettings);
        case "settings.validateModel":
          return rpcSuccess(request.id, {
            latencyMs: 128,
            model: "gpt-5.5",
            ok: true,
            provider: "openai-compatible",
          });
        case "diagnostics.getHealth":
          return rpcSuccess(request.id, {
            appHome: "/Users/test/.story-pilot",
            globalDatabasePath: "/Users/test/.story-pilot/global.sqlite",
            model: "missing",
            projectCount: 1,
            projectsRoot: "/Users/test/.story-pilot/projects",
            settingsPath: "/Users/test/.story-pilot/setting.json",
            sidecar: "ok",
            storage: "ok",
          });
        case "diagnostics.export":
          return rpcSuccess(request.id, {
            path: "/Users/test/.story-pilot/diagnostics/diagnostics-1.json",
            redacted: true,
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

    fireEvent.click(await screen.findByRole("button", { name: "设置" }));
    expect(await screen.findByText("模型配置")).toBeInTheDocument();
    expect(await screen.findByText("/Users/test/.story-pilot/setting.json")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://api.example.com/v1" },
    });
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "sk-test-key" },
    });
    fireEvent.change(screen.getByLabelText("模型名称"), {
      target: { value: "gpt-5.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存模型配置" }));

    await waitFor(() => {
      expect(rpcPayload("settings.update")).toMatchObject({
        model: {
          apiKey: "sk-test-key",
          baseUrl: "https://api.example.com/v1",
          model: "gpt-5.5",
        },
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "校验模型" }));
    await waitFor(() => {
      expect(rpcPayload("settings.validateModel")).toMatchObject({
        apiKey: "sk-test-key",
        baseUrl: "https://api.example.com/v1",
        model: "gpt-5.5",
      });
    });

    fireEvent.click(screen.getByRole("tab", { name: "诊断信息" }));
    fireEvent.click(screen.getByRole("button", { name: "导出诊断包" }));

    await waitFor(() => {
      expect(rpcPayload("diagnostics.export")).toMatchObject({});
    });
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

      return rpcSuccess(request.id, { items: [] });
    });

    render(
      <AppProviders>
        <ShellLayout />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole("button", { name: /新建作品/ }));
    expect(screen.getByLabelText("题材")).toHaveAttribute("role", "combobox");
    expect(screen.getByLabelText("风格")).toHaveAttribute("role", "combobox");
    fireEvent.change(screen.getByLabelText("作品名称"), { target: { value: "雾都案卷" } });
    fireEvent.click(screen.getByRole("button", { name: "创建作品" }));

    await waitFor(() => {
      expect(rpcPayload("project.create")).toMatchObject({
        genre: "悬疑",
        style: "悬疑推理",
        title: "雾都案卷",
      });
    });
    expect(await screen.findByRole("heading", { name: "雾都案卷" })).toBeInTheDocument();
  });

  it("drives the creative path from brief to outline-based draft commands", async () => {
    const project = createProject();
    const creativePath = createCreativePathBoard();
    const chapters: Array<{
      content: string;
      id: string;
      title: string;
      version: number;
    }> = [];

    invokeMock.mockImplementation(async (_tauriCommand, args) => {
      const request = getRpcRequest(args);
      switch (request.command) {
        case "project.listRecent":
          return rpcSuccess(request.id, { items: [project] });
        case "project.open":
          return rpcSuccess(request.id, project);
        case "workbench.getBoard":
          return rpcSuccess(request.id, {
            artifacts: [],
            chapters,
            creativePath,
            memoryCandidates: [],
            project,
            workOrders: [],
          });
        case "brief.save":
          creativePath.brief = {
            ...creativePath.brief,
            genre: request.payload.genre as string,
            initialIdea: (request.payload.initialIdea as string | undefined) ?? "",
          };
          return rpcSuccess(request.id, creativePath.brief);
        case "brief.confirm":
          creativePath.brief = { ...creativePath.brief, status: "confirmed" };
          return rpcSuccess(request.id, creativePath.brief);
        case "ai.generate":
          if (request.payload.capability === "blueprint.generate") {
            creativePath.blueprint = {
              antagonistForce: "旧城钟楼背后的既得利益者。",
              corePromise: "每三章给出一条硬线索和一次反转。",
              differentiators: ["旧信谜题与人物成长绑定。"],
              id: "blueprint_1",
              logline: "旧信把主角拖回十年前的钟楼旧案。",
              mainConflict: "主角追查旧案时不断触碰旧城秩序。",
              premise: "雨夜旧信揭开旧城钟楼案。",
              protagonistArc: "从逃避旧案到主动承担代价。",
              risks: ["线索密度不足会削弱悬疑感。"],
              status: "draft",
            };
            return rpcSuccess(request.id, {
              artifactIds: ["artifact_blueprint_1"],
              capability: "blueprint.generate",
              status: "completed",
              workflowRunId: "run_blueprint_1",
              workOrderId: "work_order_blueprint_1",
            });
          }
          if (request.payload.capability === "outline.generate") {
            creativePath.outlines = [
              {
                id: "outline_1",
                scope: "chapter_batch",
                status: "draft",
                title: "前 10 章章纲",
              },
            ];
            creativePath.chapterOutlines = [
              {
                chapterGoal: "用雨夜旧信建立开局钩子。",
                chapterId: null,
                conflict: "主角想逃离旧案，旧信逼迫她回头。",
                hook: "信纸水印指向十年前钟楼。",
                id: "chapter_outline_1",
                informationGain: "读者知道旧信与钟楼旧案有关。",
                status: "draft",
                title: "第 1 章：开局钩子",
              },
            ];
            return rpcSuccess(request.id, {
              artifactIds: ["artifact_outline_1"],
              capability: "outline.generate",
              status: "completed",
              workflowRunId: "run_outline_1",
              workOrderId: "work_order_outline_1",
            });
          }
          return rpcSuccess(request.id, null);
        case "blueprint.generate":
          creativePath.blueprint = {
            antagonistForce: "旧城钟楼背后的既得利益者。",
            corePromise: "每三章给出一条硬线索和一次反转。",
            differentiators: ["旧信谜题与人物成长绑定。"],
            id: "blueprint_1",
            logline: "旧信把主角拖回十年前的钟楼旧案。",
            mainConflict: "主角追查旧案时不断触碰旧城秩序。",
            premise: "雨夜旧信揭开旧城钟楼案。",
            protagonistArc: "从逃避旧案到主动承担代价。",
            risks: ["线索密度不足会削弱悬疑感。"],
            status: "draft",
          };
          return rpcSuccess(request.id, {
            artifact: { id: "artifact_blueprint_1", status: "pending" },
            blueprint: creativePath.blueprint,
          });
        case "blueprint.apply":
          creativePath.blueprint = { ...creativePath.blueprint!, status: "applied" };
          return rpcSuccess(request.id, creativePath.blueprint);
        case "outline.generate":
          creativePath.outlines = [
            {
              id: "outline_1",
              scope: "chapter_batch",
              status: "draft",
              title: "前 10 章章纲",
            },
          ];
          creativePath.chapterOutlines = [
            {
              chapterGoal: "用雨夜旧信建立开局钩子。",
              chapterId: null,
              conflict: "主角想逃离旧案，旧信逼迫她回头。",
              hook: "信纸水印指向十年前钟楼。",
              id: "chapter_outline_1",
              informationGain: "读者知道旧信与钟楼旧案有关。",
              status: "draft",
              title: "第 1 章：开局钩子",
            },
          ];
          return rpcSuccess(request.id, {
            artifact: { id: "artifact_outline_1", status: "pending" },
            chapterOutlines: creativePath.chapterOutlines,
            outline: creativePath.outlines[0],
          });
        case "outline.approveChapterOutline":
          creativePath.chapterOutlines = creativePath.chapterOutlines.map((chapterOutline) => ({
            ...chapterOutline,
            status:
              chapterOutline.id === request.payload.chapterOutlineId
                ? "approved"
                : chapterOutline.status,
          }));
          return rpcSuccess(request.id, creativePath.chapterOutlines[0]);
        case "outline.applyChapterOutline":
          creativePath.chapterOutlines = creativePath.chapterOutlines.map((chapterOutline) => ({
            ...chapterOutline,
            chapterId:
              chapterOutline.id === request.payload.chapterOutlineId
                ? "chapter_1"
                : chapterOutline.chapterId,
            status:
              chapterOutline.id === request.payload.chapterOutlineId
                ? "applied"
                : chapterOutline.status,
          }));
          chapters.push({
            content: "",
            id: "chapter_1",
            title: "第 1 章：开局钩子",
            version: 0,
          });
          return rpcSuccess(request.id, {
            chapter: chapters[0],
            chapterOutline: creativePath.chapterOutlines[0],
          });
        case "chapter.generateDraftFromOutline":
          return rpcSuccess(request.id, {
            artifact: { id: "artifact_draft_1", status: "pending", title: "AI 章节草稿" },
            memoryCandidates: [],
            workflowRun: { id: "run_1", status: "completed" },
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

    expect(await screen.findByRole("tab", { name: "创作路径" })).toBeInTheDocument();
    expect(screen.getAllByText("大纲设计").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "保存立项" }));
    await waitFor(() => {
      expect(rpcPayload("brief.save")).toMatchObject({
        genre: "悬疑",
        projectId: "project_1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "确认立项" }));
    fireEvent.click(screen.getByRole("button", { name: "生成创作蓝图" }));
    await screen.findByText("雨夜旧信揭开旧城钟楼案。");
    fireEvent.click(screen.getByRole("button", { name: "应用蓝图" }));
    fireEvent.click(screen.getByRole("button", { name: "生成前 10 章章纲" }));
    await screen.findByText("第 1 章：开局钩子");
    fireEvent.click(screen.getByRole("button", { name: /批准章纲/ }));
    fireEvent.click(screen.getByRole("button", { name: /应用为空章节/ }));
    fireEvent.click(screen.getByRole("button", { name: /基于章纲生成草稿/ }));

    await waitFor(() => {
      expect(rpcPayload("brief.confirm")).toMatchObject({
        briefId: "brief_1",
        projectId: "project_1",
      });
      expect(rpcPayload("ai.generate")).toMatchObject({
        capability: "blueprint.generate",
        projectId: "project_1",
        targetType: "project",
      });
      expect(rpcPayload("blueprint.apply")).toMatchObject({
        blueprintId: "blueprint_1",
        projectId: "project_1",
      });
      expect(allRpcPayloads("ai.generate").at(1)).toMatchObject({
        capability: "outline.generate",
        input: {
          chapterCount: 10,
          scope: "chapter_batch",
        },
        projectId: "project_1",
        targetType: "project",
      });
      expect(rpcPayload("outline.approveChapterOutline")).toMatchObject({
        chapterOutlineId: "chapter_outline_1",
        projectId: "project_1",
      });
      expect(rpcPayload("outline.applyChapterOutline")).toMatchObject({
        chapterOutlineId: "chapter_outline_1",
        projectId: "project_1",
      });
      expect(rpcPayload("chapter.generateDraftFromOutline")).toMatchObject({
        chapterOutlineId: "chapter_outline_1",
        projectId: "project_1",
      });
    });
  }, 10_000);

  it("opens creative elements and completes the worldbuilding stage from the creative path", async () => {
    const project = createProject();
    const creativePath = createCreativePathBoard({
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

    invokeMock.mockImplementation(async (_tauriCommand, args) => {
      const request = getRpcRequest(args);
      switch (request.command) {
        case "project.listRecent":
          return rpcSuccess(request.id, { items: [project] });
        case "project.open":
          return rpcSuccess(request.id, project);
        case "workbench.getBoard":
          return rpcSuccess(request.id, {
            artifacts: [],
            chapters: [],
            creativePath,
            memoryCandidates: [],
            project,
            workOrders: [],
            worldRules: [],
          });
        case "creativeStage.advance":
          creativePath.stages = creativePath.stages.map((stage) => {
            if (stage.stageKey === "worldbuilding") {
              return { ...stage, readinessScore: 100, status: "completed" };
            }
            if (stage.stageKey === "characters") {
              return { ...stage, readinessScore: 10, status: "available" };
            }
            return stage;
          });
          return rpcSuccess(request.id, {
            readinessScore: 100,
            stageKey: "worldbuilding",
            status: "completed",
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

    expect(await screen.findByRole("button", { name: "进入创作要素" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "完成世界观与要素" }));

    await waitFor(() => {
      expect(rpcPayload("creativeStage.advance")).toMatchObject({
        mode: "strict",
        projectId: "project_1",
        stageKey: "worldbuilding",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "进入创作要素" }));
    expect(await screen.findByText("AI 候选生成")).toBeInTheDocument();
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
          return rpcSuccess(request.id, { items: [project] });
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

    fireEvent.click(await screen.findByRole("tab", { name: "章节生产" }));
    fireEvent.change(await screen.findByLabelText("章节正文"), {
      target: { value: "更新后的章节正文。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存章节" }));
    fireEvent.click(screen.getByRole("button", { name: "生成草稿" }));
    fireEvent.click(screen.getByRole("tab", { name: "记忆确认" }));

    const acceptedCandidate = screen.getByText("林鸢发现一封来历异常的旧信。").closest("li");
    expect(acceptedCandidate).not.toBeNull();
    fireEvent.click(within(acceptedCandidate as HTMLElement).getByRole("button", { name: "确认" }));
    fireEvent.click(screen.getByRole("button", { name: "确认记忆" }));

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

  it("sends creative object creation actions through typed RPC commands", async () => {
    const project = createProject();

    invokeMock.mockImplementation(async (_tauriCommand, args) => {
      const request = getRpcRequest(args);
      switch (request.command) {
        case "project.listRecent":
          return rpcSuccess(request.id, { items: [project] });
        case "project.open":
          return rpcSuccess(request.id, project);
        case "workbench.getBoard":
          return rpcSuccess(request.id, {
            artifacts: [],
            chapters: [],
            characters: [],
            foreshadowings: [],
            items: [],
            locations: [],
            memoryCandidates: [],
            organizations: [],
            plotlines: [],
            project,
            workOrders: [],
            worldRules: [],
          });
        case "element.generateCandidates":
          return rpcSuccess(request.id, {
            items: [
              {
                description: "受星轨潮汐影响的刀器。",
                name: "潮汐断星刃",
                rationale: "贴合玄幻战斗节奏。",
                tags: ["武器"],
                type: "weapon",
              },
            ],
          });
        case "element.acceptCandidates":
          return rpcSuccess(request.id, {
            accepted: [
              {
                id: "item_1",
                name: "潮汐断星刃",
                target: "item",
                type: "weapon",
              },
            ],
          });
        default:
          return rpcSuccess(request.id, { id: `${request.command}:result` });
      }
    });

    render(
      <AppProviders>
        <ShellLayout />
      </AppProviders>,
    );

    fireEvent.click(await screen.findByRole("tab", { name: "创作要素" }));

    fireEvent.click(screen.getByRole("button", { name: "批量生成候选" }));
    await waitFor(() => {
      expect(rpcPayload("element.generateCandidates")).toMatchObject({
        count: 10,
        elementType: "weapon",
        genre: "悬疑",
        projectId: "project_1",
        style: "悬疑推理",
      });
    });
    expect(await screen.findByText("潮汐断星刃")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("选择候选 潮汐断星刃"));
    fireEvent.click(screen.getByRole("button", { name: "采纳选中" }));
    await waitFor(() => {
      expect(rpcPayload("element.acceptCandidates")).toMatchObject({
        items: [expect.objectContaining({ name: "潮汐断星刃", type: "weapon" })],
        projectId: "project_1",
      });
    });

    fireEvent.change(screen.getByLabelText("人物名称"), { target: { value: "林鸢" } });
    fireEvent.click(screen.getByRole("button", { name: "创建人物" }));
    await waitFor(() => {
      expect(rpcPayload("character.create")).toMatchObject({
        name: "林鸢",
        projectId: "project_1",
        role: "support",
      });
    });

    fireEvent.change(screen.getByLabelText("规则标题"), { target: { value: "旧城区治理" } });
    fireEvent.change(screen.getByLabelText("规则内容"), {
      target: { value: "旧城区由钟楼议会管理。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建规则" }));
    await waitFor(() => {
      expect(rpcPayload("worldRule.create")).toMatchObject({
        category: "custom",
        constraintLevel: "soft",
        projectId: "project_1",
        statement: "旧城区由钟楼议会管理。",
        title: "旧城区治理",
      });
    });

    fireEvent.change(screen.getByLabelText("故事线标题"), { target: { value: "旧信谜团" } });
    fireEvent.change(screen.getByLabelText("故事线摘要"), {
      target: { value: "围绕旧信来源展开。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建故事线" }));
    await waitFor(() => {
      expect(rpcPayload("plotline.create")).toMatchObject({
        kind: "branch",
        priority: 0,
        projectId: "project_1",
        summary: "围绕旧信来源展开。",
        title: "旧信谜团",
      });
    });

    fireEvent.change(screen.getByLabelText("伏笔标题"), { target: { value: "水印伏笔" } });
    fireEvent.change(screen.getByLabelText("伏笔内容"), {
      target: { value: "信纸水印暗示十年前档案。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建伏笔" }));

    await waitFor(() => {
      expect(rpcPayload("foreshadowing.create")).toMatchObject({
        description: "信纸水印暗示十年前档案。",
        importance: 3,
        projectId: "project_1",
        title: "水印伏笔",
      });
    });
  });

  it("creates chapters, restores chapter versions, and reviews AI artifacts", async () => {
    const project = createProject();
    const chapter = {
      content: "雨夜里，林鸢发现门缝下有一封旧信。",
      id: "chapter_1",
      title: "第一章 雨夜来信",
      version: 2,
    };
    const chapters = [chapter];
    const artifacts = [
      {
        body: "AI 草稿正文。",
        id: "artifact_apply",
        kind: "chapter_draft",
        status: "pending",
        targetId: "chapter_1",
        targetType: "chapter",
        title: "AI 章节草稿",
      },
      {
        body: "废弃草稿正文。",
        id: "artifact_reject",
        kind: "chapter_draft",
        status: "pending",
        targetId: "chapter_1",
        targetType: "chapter",
        title: "废弃草稿",
      },
    ];

    invokeMock.mockImplementation(async (_tauriCommand, args) => {
      const request = getRpcRequest(args);
      switch (request.command) {
        case "project.listRecent":
          return rpcSuccess(request.id, { items: [project] });
        case "project.open":
          return rpcSuccess(request.id, project);
        case "workbench.getBoard":
          return rpcSuccess(request.id, {
            artifacts,
            chapters,
            characters: [],
            foreshadowings: [],
            memoryCandidates: [],
            plotlines: [],
            project,
            workOrders: [],
            worldRules: [],
          });
        case "chapter.create": {
          const createdChapter = {
            content: "",
            id: "chapter_2",
            title: request.payload.title as string,
            version: 0,
          };
          chapters.push(createdChapter);
          return rpcSuccess(request.id, createdChapter);
        }
        case "chapter.listVersions":
          return rpcSuccess(request.id, [
            {
              chapterId: "chapter_1",
              content: "旧正文。",
              createdAt: 1,
              id: "version_1",
              projectId: "project_1",
              source: "user",
              summary: null,
              version: 1,
            },
          ]);
        case "chapter.restoreVersion":
          chapter.content = "旧正文。";
          chapter.version = 3;
          return rpcSuccess(request.id, chapter);
        case "artifact.apply":
          chapter.content = artifacts[0]!.body;
          chapter.version = 4;
          artifacts[0]!.status = "applied";
          return rpcSuccess(request.id, { artifact: artifacts[0], chapter });
        case "artifact.reject":
          artifacts[1]!.status = "rejected";
          return rpcSuccess(request.id, artifacts[1]);
        default:
          return rpcSuccess(request.id, null);
      }
    });

    render(
      <AppProviders>
        <ShellLayout />
      </AppProviders>,
    );

    fireEvent.click(await screen.findByRole("tab", { name: "章节生产" }));
    await screen.findByLabelText("章节正文");

    fireEvent.click(screen.getByRole("button", { name: "新建章节" }));
    fireEvent.change(screen.getByLabelText("章节标题"), { target: { value: "第二章 钟楼停摆" } });
    fireEvent.change(screen.getByLabelText("章节摘要"), {
      target: { value: "林鸢追查钟楼线索。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建章节" }));

    await waitFor(() => {
      expect(rpcPayload("chapter.create")).toMatchObject({
        projectId: "project_1",
        summary: "林鸢追查钟楼线索。",
        title: "第二章 钟楼停摆",
        volumeId: "volume_1",
      });
    });

    fireEvent.click(within(screen.getByLabelText("章节树")).getByText("第一章 雨夜来信"));
    expect(await screen.findByRole("heading", { name: "第一章 雨夜来信" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "版本" }));
    fireEvent.click(await screen.findByRole("button", { name: "恢复 v1" }));

    await waitFor(() => {
      expect(rpcPayload("chapter.restoreVersion")).toMatchObject({
        chapterId: "chapter_1",
        projectId: "project_1",
        versionId: "version_1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "项目看板" }));
    fireEvent.click(await screen.findByRole("tab", { name: /AI 产物/ }));

    const draftArtifact = screen.getByText("AI 章节草稿").closest("li");
    expect(draftArtifact).not.toBeNull();
    fireEvent.click(within(draftArtifact as HTMLElement).getByRole("button", { name: "应用" }));

    await waitFor(() => {
      expect(rpcPayload("artifact.apply")).toMatchObject({
        applyMode: "replace",
        artifactId: "artifact_apply",
        projectId: "project_1",
        targetVersion: 3,
      });
    });

    const rejectedArtifact = await screen.findByText("废弃草稿");
    const rejectedArtifactItem = rejectedArtifact.closest("li");
    expect(rejectedArtifactItem).not.toBeNull();
    fireEvent.click(
      within(rejectedArtifactItem as HTMLElement).getByRole("button", { name: "拒绝" }),
    );

    await waitFor(() => {
      expect(rpcPayload("artifact.reject")).toMatchObject({
        artifactId: "artifact_reject",
        projectId: "project_1",
      });
    });
  });

  it("loads a graph preview for the selected chapter from the project board", async () => {
    const project = createProject();
    const chapter = {
      content: "雨夜里，林鸢发现门缝下有一封旧信。",
      id: "chapter_1",
      title: "第一章 雨夜来信",
      version: 1,
    };

    invokeMock.mockImplementation(async (_tauriCommand, args) => {
      const request = getRpcRequest(args);
      switch (request.command) {
        case "project.listRecent":
          return rpcSuccess(request.id, { items: [project] });
        case "project.open":
          return rpcSuccess(request.id, project);
        case "workbench.getBoard":
          return rpcSuccess(request.id, {
            artifacts: [],
            chapters: [chapter],
            memoryCandidates: [],
            project,
            workOrders: [],
          });
        case "graph.getNeighborhood":
          return rpcSuccess(request.id, {
            edges: [{ label: "actor", sourceId: "char_1", targetId: "event_1" }],
            nodes: [
              { id: "chapter_1", label: "第一章 雨夜来信", type: "chapter" },
              { id: "char_1", label: "林鸢", type: "character" },
            ],
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

    fireEvent.click(await screen.findByRole("tab", { name: "章节生产" }));
    await screen.findByLabelText("章节正文");
    fireEvent.click(screen.getByRole("button", { name: "项目看板" }));
    fireEvent.click(await screen.findByRole("tab", { name: /图谱/ }));

    await waitFor(() => {
      expect(rpcPayload("graph.getNeighborhood")).toMatchObject({
        depth: 2,
        nodeId: "chapter_1",
        nodeType: "chapter",
        projectId: "project_1",
      });
    });
    expect(await screen.findByText("林鸢")).toBeInTheDocument();
    expect(screen.getByText("1 条关系")).toBeInTheDocument();
  });
});

interface TestRpcRequest {
  readonly id: string;
  readonly command: string;
  readonly payload: Record<string, unknown>;
}

interface TestCreativePathBoard {
  stages: Array<{
    readinessScore: number;
    stageKey: string;
    status: string;
  }>;
  brief: {
    emotionalRewards: string[];
    forbiddenDirections: string[];
    genre: string;
    id: string;
    initialIdea: string;
    lengthProfile: string;
    narrativePov: string;
    platformProfile: string;
    status: string;
    subgenres: string[];
    targetAudience: string;
  };
  blueprint: null | {
    antagonistForce: string;
    corePromise: string;
    differentiators: string[];
    id: string;
    logline: string;
    mainConflict: string;
    premise: string;
    protagonistArc: string;
    risks: string[];
    status: string;
  };
  outlines: Array<{
    id: string;
    scope: string;
    status: string;
    title: string;
  }>;
  chapterOutlines: Array<{
    chapterGoal: string;
    chapterId: null | string;
    conflict: string;
    hook: string;
    id: string;
    informationGain: string;
    status: string;
    title: string;
  }>;
  reviewIssues: unknown[];
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

function allRpcPayloads(command: string): Record<string, unknown>[] {
  return invokeMock.mock.calls
    .filter(([, args]) => getRpcRequest(args).command === command)
    .map(([, args]) => getRpcRequest(args).payload);
}

function createProject() {
  return {
    defaultVolumeId: "volume_1",
    genre: "悬疑",
    id: "project_1",
    rootPath: "/tmp/story-pilot/project_1",
    status: "planning",
    style: "悬疑推理",
    title: "雾都案卷",
    updatedAt: 1,
    workId: "work_1",
  };
}

function createCreativePathBoard(
  overrides: Partial<TestCreativePathBoard> = {},
): TestCreativePathBoard {
  return {
    blueprint: null,
    brief: {
      emotionalRewards: ["悬疑", "反转"],
      forbiddenDirections: [],
      genre: "悬疑",
      id: "brief_1",
      initialIdea: "雨夜旧信把主角拖回十年前的钟楼旧案。",
      lengthProfile: "长篇连载",
      narrativePov: "第三人称",
      platformProfile: "男频",
      status: "draft",
      subgenres: ["探案单元剧"],
      targetAudience: "悬疑强钩子",
    },
    chapterOutlines: [],
    outlines: [],
    reviewIssues: [],
    stages: [
      { readinessScore: 20, stageKey: "brief", status: "available" },
      { readinessScore: 0, stageKey: "blueprint", status: "locked" },
      { readinessScore: 0, stageKey: "worldbuilding", status: "locked" },
      { readinessScore: 0, stageKey: "characters", status: "locked" },
      { readinessScore: 0, stageKey: "plot_arcs", status: "locked" },
      { readinessScore: 0, stageKey: "outline", status: "locked" },
      { readinessScore: 0, stageKey: "chapters", status: "locked" },
      { readinessScore: 0, stageKey: "memory_review", status: "locked" },
      { readinessScore: 0, stageKey: "retrospective", status: "locked" },
    ],
    ...overrides,
  };
}
