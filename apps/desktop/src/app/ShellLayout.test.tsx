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

  it("renders a three-pane writing workspace with titlebar-level collapse controls", () => {
    render(
      <AppProviders>
        <ShellLayout />
      </AppProviders>,
    );

    expect(screen.getByLabelText("应用标题栏")).toBeInTheDocument();
    expect(screen.getByLabelText("作品管理区")).toBeInTheDocument();
    expect(screen.getByLabelText("工作台")).toBeInTheDocument();
    expect(screen.getByLabelText("创作检查器")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "项目看板" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "AI 任务" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "收起侧栏" }));
    expect(screen.getByRole("button", { name: "展开侧栏" })).toBeInTheDocument();
    expect(screen.queryByText("小说创作工作台")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开侧栏" }));
    expect(screen.getByText("小说创作工作台")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "收起检查器" }));
    expect(screen.queryByLabelText("创作检查器")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开检查器" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开检查器" }));
    expect(screen.getByLabelText("创作检查器")).toBeInTheDocument();
  });

  it("generates and accepts auxiliary candidates from the inspector toolbox", async () => {
    const project = {
      ...createProject(),
      genre: "冰雪末世",
      style: "硬核生存、基地经营",
      title: "雪境堡垒",
      wordCountGoal: 5_000_000,
    };
    const worldRules = [
      {
        category: "economy",
        content: "极寒后燃料、电池、药品和安全屋通行权成为核心资源。",
        id: "rule_resource_order",
        status: "canon",
        title: "资源秩序",
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
            chapters: [],
            characters: [],
            foreshadowings: [],
            items: [],
            locations: [],
            memoryCandidates: [],
            organizations: [],
            plotlines: [],
            project,
            storyEvents: [],
            workOrders: [],
            worldRules,
          });
        case "element.generateCandidates":
          return rpcSuccess(request.id, {
            items: [
              {
                description: "控制安全屋外部白色补给线的半地下互助联盟。",
                name: "白线同盟",
                rationale: "能承载物资交易、背叛和临时秩序争夺。",
                tags: ["补给", "势力"],
                type: "faction",
              },
            ],
          });
        case "element.acceptCandidates":
          return rpcSuccess(request.id, {
            accepted: [
              {
                id: "organization_1",
                name: "白线同盟",
                target: "organization",
                type: "faction",
              },
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

    fireEvent.click(await screen.findByRole("tab", { name: /工具箱/ }));
    fireEvent.mouseDown(screen.getByLabelText("生成类型"));
    fireEvent.click(await screen.findByText("势力名称"));
    fireEvent.change(screen.getByLabelText("创作描述"), {
      target: { value: "围绕安全屋外部补给线生成可长期博弈的地下势力名称。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成候选" }));

    await waitFor(() => {
      expect(rpcPayload("element.generateCandidates")).toMatchObject({
        count: 10,
        description: "围绕安全屋外部补给线生成可长期博弈的地下势力名称。",
        elementType: "faction",
        genre: "冰雪末世",
        projectId: "project_1",
        style: "硬核生存、基地经营",
        worldRuleIds: ["rule_resource_order"],
      });
    });
    expect(await screen.findByText("白线同盟")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("选择候选 白线同盟"));
    fireEvent.click(screen.getByRole("button", { name: "采纳选中" }));

    await waitFor(() => {
      expect(rpcPayload("element.acceptCandidates")).toMatchObject({
        items: [expect.objectContaining({ name: "白线同盟", type: "faction" })],
        projectId: "project_1",
      });
    });
  });

  it("clears temporary inspector toolbox candidates when switching projects", async () => {
    const firstProject = {
      ...createProject(),
      genre: "冰雪末世",
      style: "硬核生存",
      title: "雪境堡垒",
    };
    const secondProject = {
      ...createProject(),
      genre: "悬疑",
      id: "project_2",
      style: "悬疑推理",
      title: "雾城旧案",
      workId: "work_2",
    };

    invokeMock.mockImplementation(async (_tauriCommand, args) => {
      const request = getRpcRequest(args);
      const projectId = String(request.payload.projectId ?? firstProject.id);
      const project = projectId === secondProject.id ? secondProject : firstProject;
      switch (request.command) {
        case "project.listRecent":
          return rpcSuccess(request.id, { items: [firstProject, secondProject] });
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
            storyEvents: [],
            workOrders: [],
            worldRules: [],
          });
        case "element.generateCandidates":
          return rpcSuccess(request.id, {
            items: [
              {
                description: "控制安全屋外部白色补给线的半地下互助联盟。",
                name: "白线同盟",
                rationale: "能承载物资交易、背叛和临时秩序争夺。",
                tags: ["补给", "势力"],
                type: "faction",
              },
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

    expect(await screen.findByRole("heading", { name: "雪境堡垒" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /工具箱/ }));
    fireEvent.click(screen.getByRole("button", { name: "生成候选" }));
    expect(await screen.findByText("白线同盟")).toBeInTheDocument();

    fireEvent.click(screen.getByText("雾城旧案"));

    expect(await screen.findByRole("heading", { name: "雾城旧案" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("白线同盟")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "采纳选中" })).toBeDisabled();
    });
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
    const settingsDialog = await screen.findByRole("dialog", { name: "设置" });
    const settingsScope = within(settingsDialog);

    expect(settingsScope.getByLabelText("设置菜单")).toBeInTheDocument();
    expect(settingsScope.queryByRole("tab", { name: "模型配置" })).not.toBeInTheDocument();
    expect(settingsScope.getByRole("button", { name: "模型配置" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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

    fireEvent.click(settingsScope.getByRole("button", { name: "诊断信息" }));
    expect(settingsScope.getByRole("button", { name: "诊断信息" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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

  it("opens an active work as a modular novel workspace", async () => {
    const project = createProject();
    const creativePath = createCreativePathBoard({
      blueprint: {
        antagonistForce: "旧城钟楼背后的既得利益者。",
        corePromise: "每三章给出一条硬线索和一次反转。",
        differentiators: ["旧信谜题与人物成长绑定。"],
        id: "blueprint_1",
        logline: "旧信把主角拖回十年前的钟楼旧案。",
        mainConflict: "主角追查旧案时不断触碰旧城秩序。",
        premise: "雨夜旧信揭开旧城钟楼案。",
        protagonistArc: "从逃避旧案到主动承担代价。",
        risks: ["线索密度不足会削弱悬疑感。"],
        status: "applied",
      },
      chapterPlans: [
        {
          chapterGoal: "用雨夜旧信建立开局钩子。",
          chapterIndex: 1,
          id: "chapter_plan_1",
          status: "draft",
          title: "第 1 章：开局钩子",
        },
      ],
      volumePlans: [
        {
          bookPlanId: "book_plan_1",
          climax: "主角在钟楼发现第一份伪证。",
          id: "volume_plan_1",
          majorConflict: "主角追查旧案时不断触碰旧城秩序。",
          purpose: "完成开局钩子和第一次调查反击。",
          status: "draft",
          targetWordCount: 300_000,
          title: "第一卷 旧城来信",
          volumeIndex: 1,
        },
      ],
    });
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
            characters: [],
            creativePath,
            foreshadowings: [],
            items: [],
            locations: [],
            memoryCandidates: [],
            organizations: [],
            plotlines: [],
            project,
            storyEvents: [],
            workOrders: [],
            worldRules: [],
          });
        case "worldbuilding.saveFields":
          return rpcSuccess(request.id, {
            fields: request.payload.fields,
          });
        case "worldbuilding.completeFields":
          return rpcSuccess(request.id, {
            fields: {
              coreConflict:
                "旧信牵出十年前钟楼案，主角必须在追查真相和保护旧城普通人之间持续取舍。",
              culture: "旧城居民相信钟楼报时代表秩序延续，公开质疑钟楼会被视为背叛共同体。",
              economy: "档案、路引和钟楼通行资格是最稀缺资源，掌握资源的人能决定线索是否流通。",
              factions: "钟楼议会、旧警署残部和地下信使互相制衡，任何一方都不能公开撕破秩序。",
              geography:
                "旧城围绕钟楼向外扩散，内圈保存档案，中圈居住旧案相关家族，外圈负责消息交换。",
              history: "十年前钟楼火灾改变了旧城权力结构，幸存者用沉默换来表面稳定。",
              powerOrder: "钟楼议会拥有名义裁决权，真正执行依赖旧警署和地下信使的默契。",
              powerSystem: "没有超自然力量，角色变强依靠档案解读、关系交换和对旧城规矩的熟悉。",
              rules: "任何人不得私自带走钟楼档案；破坏规则会失去通行资格并被所有势力追查。",
              socialStructure:
                "旧城按是否拥有钟楼通行资格分层，普通人只能依附家族或信使网络获得保护。",
              specialMechanism:
                "每封旧信都会对应一段被删改的档案，信件出现意味着旧秩序主动暴露裂缝。",
              worldBase:
                "近现代旧城悬疑世界，钟楼、档案和旧信构成核心舞台，现实规则下隐藏长期权力交易。",
            },
          });
        case "storyEvent.create":
          return rpcSuccess(request.id, {
            id: "event_1",
            title: request.payload.title,
          });
        case "plot.generateRollingOutline":
          return rpcSuccess(request.id, {
            artifact: { id: "artifact_rolling_1", status: "pending" },
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

    expect(await screen.findByRole("heading", { name: "作品总控台" })).toBeInTheDocument();
    expect(screen.getByRole("tree", { name: "作品树" })).toBeInTheDocument();
    expect(screen.queryByText("当前作品")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1. 基本信息" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "9. 正文创作" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2. 世界观设计" }));
    expect(await screen.findByRole("heading", { name: "世界观设计" })).toBeInTheDocument();
    expect(screen.getByLabelText("世界基底")).toBeInTheDocument();
    expect(screen.getByLabelText("超自然 / 特殊机制")).toBeInTheDocument();
    expect(screen.queryByText("这是一个什么世界？")).not.toBeInTheDocument();
    expect(
      screen.queryByText("时代、文明程度、现实或架空、世界规模、基本类型。"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("世界要素批量生成")).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByLabelText("说明：世界基底"));
    expect(await screen.findByText("这是一个什么世界？")).toBeInTheDocument();
    expect(
      await screen.findByText("时代、文明程度、现实或架空、世界规模、基本类型。"),
    ).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByLabelText("说明：世界基底"));

    fireEvent.change(screen.getByLabelText("世界基底"), {
      target: { value: "近现代旧城悬疑世界，核心舞台是钟楼和旧档案。" },
    });
    fireEvent.change(screen.getByLabelText("力量体系"), {
      target: { value: "角色依靠线索、关系和档案解读能力推进调查。" },
    });

    fireEvent.click(screen.getByRole("button", { name: "AI 辅助补全" }));
    await waitFor(() => {
      expect(rpcPayload("worldbuilding.completeFields")).toMatchObject({
        fields: {
          powerSystem: "角色依靠线索、关系和档案解读能力推进调查。",
          worldBase: "近现代旧城悬疑世界，核心舞台是钟楼和旧档案。",
        },
        projectId: "project_1",
      });
    });
    expect(screen.getByLabelText("空间地理")).toHaveValue(
      "旧城围绕钟楼向外扩散，内圈保存档案，中圈居住旧案相关家族，外圈负责消息交换。",
    );

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(rpcPayload("worldbuilding.saveFields")).toMatchObject({
        fields: {
          geography: "旧城围绕钟楼向外扩散，内圈保存档案，中圈居住旧案相关家族，外圈负责消息交换。",
          worldBase:
            "近现代旧城悬疑世界，钟楼、档案和旧信构成核心舞台，现实规则下隐藏长期权力交易。",
        },
        projectId: "project_1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "7. 剧情节点" }));
    expect(await screen.findByRole("heading", { name: "剧情节点设计" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "新建剧情节点" }));
    const storyEventDialog = await screen.findByRole("dialog", { name: "新建剧情节点" });
    fireEvent.change(within(storyEventDialog).getByLabelText("节点标题"), {
      target: { value: "旧信出现" },
    });
    fireEvent.change(within(storyEventDialog).getByLabelText("节点描述"), {
      target: { value: "主角收到旧信，被迫回到十年前的旧案。" },
    });
    fireEvent.click(within(storyEventDialog).getByRole("button", { name: "创建剧情节点" }));
    await waitFor(() => {
      expect(rpcPayload("storyEvent.create")).toMatchObject({
        description: "主角收到旧信，被迫回到十年前的旧案。",
        eventType: "discovery",
        projectId: "project_1",
        title: "旧信出现",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "8. 章节规划" }));
    expect(await screen.findByRole("heading", { name: "章节规划" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "生成未来 10 章章纲" }));
    await waitFor(() => {
      expect(rpcPayload("plot.generateRollingOutline")).toMatchObject({
        chapterCount: 10,
        projectId: "project_1",
        startChapterIndex: 2,
        volumePlanId: "volume_plan_1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "9. 正文创作" }));
    expect(await screen.findByLabelText("章节正文")).toBeInTheDocument();
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
    const coreStoryFields = {
      antagonistForce: "旧城钟楼背后的既得利益者。",
      corePromise: "每三章给出一条硬线索和一次反转。",
      differentiators: ["旧信谜题与人物成长绑定。"],
      emotionalAxes: ["悬疑", "反转"],
      logline: "旧信把主角拖回十年前的钟楼旧案。",
      mainConflict: "主角追查旧案时不断触碰旧城秩序。",
      mainGoal: "查清钟楼旧案并公开被隐藏的档案。",
      premise: "雨夜旧信揭开旧城钟楼案。",
      protagonistArc: "从逃避旧案到主动承担代价。",
      risks: ["线索密度不足会削弱悬疑感。"],
      stakes: "失败会让旧案幸存者再次被清算。",
      storyDriver: "mystery",
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
              ...coreStoryFields,
              id: "blueprint_1",
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
            ...coreStoryFields,
            id: "blueprint_1",
            status: "draft",
          };
          return rpcSuccess(request.id, {
            artifact: { id: "artifact_blueprint_1", status: "pending" },
            blueprint: creativePath.blueprint,
          });
        case "blueprint.completeForm":
          return rpcSuccess(request.id, { fields: coreStoryFields });
        case "blueprint.saveForm":
          creativePath.blueprint = {
            ...coreStoryFields,
            ...(request.payload.fields as Partial<typeof coreStoryFields>),
            id: "blueprint_1",
            status: "draft",
          };
          return rpcSuccess(request.id, creativePath.blueprint);
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
        case "plot.generateBookPlan":
          creativePath.bookPlans = [
            {
              corePromise: "每卷完成一次境界突破和一次关系反转。",
              endingDirection: "主角以失去旧身份为代价重塑天道。",
              id: "book_plan_1",
              mainPlotlineId: null,
              status: "draft",
              targetWordCount: request.payload.targetWordCount as number,
              title: "星潮纪全书规划",
            },
          ];
          creativePath.volumePlans = [
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
          ];
          creativePath.arcPlans = [
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
              title: "旧城钟楼案",
              volumePlanId: "volume_plan_1",
            },
          ];
          return rpcSuccess(request.id, {
            artifact: { id: "artifact_book_plan_1", status: "pending" },
            workflowRun: { id: "run_book_plan_1", status: "completed" },
          });
        case "plot.generateRollingOutline":
          creativePath.chapterPlans = [
            {
              chapterGoal: "用雨夜旧信建立开局钩子。",
              chapterIndex: request.payload.startChapterIndex as number,
              id: "chapter_plan_1",
              status: "draft",
              title: "第 1 章：开局钩子",
            },
          ];
          creativePath.scenePlans = [
            {
              chapterPlanId: "chapter_plan_1",
              id: "scene_plan_1",
              sceneIndex: 1,
            },
          ];
          return rpcSuccess(request.id, {
            artifact: { id: "artifact_rolling_1", status: "pending" },
            workflowRun: { id: "run_rolling_1", status: "completed" },
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
        case "chapter.generateDraftFromPlan":
          return rpcSuccess(request.id, {
            artifact: { id: "artifact_plan_draft_1", status: "pending", title: "结构章纲草稿" },
            memoryCandidates: [],
            workflowRun: { id: "run_plan_1", status: "completed" },
          });
        case "chapterExecutionCard.generate":
          return rpcSuccess(request.id, {
            artifact: {
              id: "artifact_execution_card_1",
              kind: "chapter_execution_card_draft",
              status: "pending",
              title: "第 1 章执行卡",
            },
            contextPackage: { id: "context_package_1" },
          });
        case "serialReview.generate":
          return rpcSuccess(request.id, {
            artifact: {
              id: "artifact_serial_review_1",
              kind: "serial_review_report",
              status: "pending",
              title: "阶段复盘报告",
            },
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

    expect(await screen.findByRole("heading", { name: "作品总控台" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "6. 全书大纲" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1. 基本信息" }));
    fireEvent.change(screen.getByLabelText("预计字数"), { target: { value: "900000" } });
    fireEvent.change(screen.getByLabelText("预计章节数"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "保存基本信息" }));
    await waitFor(() => {
      expect(rpcPayload("brief.save")).toMatchObject({
        estimatedChapterCount: 300,
        estimatedWordCount: 900_000,
        genre: "悬疑",
        projectId: "project_1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "确认基本信息" }));
    fireEvent.click(screen.getByRole("button", { name: "3. 核心故事" }));
    fireEvent.click(screen.getByRole("button", { name: "AI 辅助补全" }));
    await waitFor(() => {
      expect(screen.getByLabelText("故事前提")).toHaveValue("雨夜旧信揭开旧城钟楼案。");
    });
    fireEvent.click(screen.getByRole("button", { name: "确认核心故事" }));
    fireEvent.click(screen.getByRole("button", { name: "6. 全书大纲" }));
    fireEvent.click(screen.getByRole("button", { name: "AI 生成全书规划" }));
    fireEvent.click(await screen.findByRole("button", { name: "生成全书规划" }));
    await waitFor(() => {
      expect(screen.getAllByText("星潮纪全书规划").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole("button", { name: "8. 章节规划" }));
    fireEvent.click(screen.getByRole("button", { name: "生成未来 10 章章纲" }));
    await waitFor(() => {
      expect(screen.getAllByText("第 1 章：开局钩子").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole("button", { name: "生成阶段复盘" }));
    const reviewDialog = await screen.findByRole("dialog", { name: "生成阶段复盘" });
    fireEvent.click(within(reviewDialog).getByRole("button", { name: /生成复盘报告/ }));
    fireEvent.click(screen.getByRole("button", { name: "生成执行卡 第 1 章：开局钩子" }));
    fireEvent.click(screen.getByRole("button", { name: "基于结构章纲生成草稿 第 1 章：开局钩子" }));
    fireEvent.click(screen.getByRole("button", { name: "生成前 10 章章纲" }));
    await waitFor(() => {
      expect(screen.getAllByText("第 1 章：开局钩子").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole("button", { name: /批准章纲/ }));
    fireEvent.click(screen.getByRole("button", { name: /应用为空章节/ }));
    fireEvent.click(screen.getByRole("button", { name: /基于章纲生成草稿/ }));

    await waitFor(() => {
      expect(rpcPayload("brief.confirm")).toMatchObject({
        briefId: "brief_1",
        projectId: "project_1",
      });
      expect(rpcPayload("blueprint.completeForm")).toMatchObject({
        fields: {
          storyDriver: "growth_reversal",
        },
        projectId: "project_1",
      });
      expect(rpcPayload("blueprint.saveForm")).toMatchObject({
        fields: {
          mainGoal: "查清钟楼旧案并公开被隐藏的档案。",
          stakes: "失败会让旧案幸存者再次被清算。",
        },
        projectId: "project_1",
      });
      expect(rpcPayload("blueprint.apply")).toMatchObject({
        blueprintId: "blueprint_1",
        projectId: "project_1",
      });
      expect(rpcPayload("plot.generateBookPlan")).toMatchObject({
        projectId: "project_1",
        targetWordCount: 800_000,
        volumeCount: 6,
      });
      expect(rpcPayload("plot.generateRollingOutline")).toMatchObject({
        chapterCount: 10,
        projectId: "project_1",
        startChapterIndex: 1,
        volumePlanId: "volume_plan_1",
      });
      expect(rpcPayload("chapterExecutionCard.generate")).toMatchObject({
        chapterPlanId: "chapter_plan_1",
        projectId: "project_1",
      });
      expect(rpcPayload("serialReview.generate")).toMatchObject({
        endChapterIndex: 1,
        projectId: "project_1",
        scope: "chapter_batch",
        startChapterIndex: 1,
      });
      expect(rpcPayload("chapter.generateDraftFromPlan")).toMatchObject({
        chapterPlanId: "chapter_plan_1",
        projectId: "project_1",
      });
      expect(allRpcPayloads("ai.generate").at(0)).toMatchObject({
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

  it("edits core story as an input-first form with AI field completion", async () => {
    const project = createProject();
    const creativePath = createCreativePathBoard({
      blueprint: {
        antagonistForce: "旧城钟楼背后的既得利益者。",
        corePromise: "每三章给出一条硬线索和一次反转。",
        differentiators: ["旧信谜题与人物成长绑定。"],
        emotionalAxes: ["悬疑", "反转"],
        id: "blueprint_1",
        logline: "旧信把主角拖回十年前的钟楼旧案。",
        mainConflict: "主角追查旧案时不断触碰旧城秩序。",
        mainGoal: "查清钟楼旧案。",
        premise: "雨夜旧信揭开旧城钟楼案。",
        protagonistArc: "从逃避旧案到主动承担代价。",
        risks: ["线索密度不足会削弱悬疑感。"],
        stakes: "失败会让旧案幸存者再次被清算。",
        status: "draft",
        storyDriver: "mystery",
      },
    });
    const completedFields = {
      antagonistForce: "旧警署、钟楼议会和被旧案保护的幸存者。",
      corePromise: "每个单元都给出硬线索、人物反转和旧案真相推进。",
      differentiators: ["旧信谜题和人物成长绑定", "钟楼档案构成连续线索网"],
      emotionalAxes: ["悬疑", "压迫感"],
      logline: "雨夜旧信把主角拖回十年前钟楼旧案。",
      mainConflict: "主角追查真相时不断触碰旧城秩序。",
      mainGoal: "找出钟楼火灾真相并迫使旧城公开档案。",
      premise: "旧城钟楼火灾十年后，主角收到一封不该存在的旧信。",
      protagonistArc: "从逃避旧案到主动承担代价。",
      risks: ["旧案反转不能只靠隐瞒信息"],
      stakes: "失败会让旧案幸存者再次被清算，主角也会失去替亲人翻案的机会。",
      storyDriver: "mystery",
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
            creativePath,
            memoryCandidates: [],
            project,
            workOrders: [],
          });
        case "blueprint.completeForm":
          return rpcSuccess(request.id, { fields: completedFields });
        case "blueprint.saveForm":
          creativePath.blueprint = {
            ...completedFields,
            id: "blueprint_1",
            status: "draft",
          };
          return rpcSuccess(request.id, creativePath.blueprint);
        case "blueprint.apply":
          creativePath.blueprint = {
            ...creativePath.blueprint!,
            status: "confirmed",
          };
          return rpcSuccess(request.id, creativePath.blueprint);
        default:
          return rpcSuccess(request.id, null);
      }
    });

    render(
      <AppProviders>
        <ShellLayout />
      </AppProviders>,
    );

    expect(await screen.findByRole("heading", { name: "作品总控台" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "3. 核心故事" }));
    expect(await screen.findByRole("heading", { name: "核心故事设计" })).toBeInTheDocument();
    expect(screen.getByLabelText("故事前提")).toHaveValue("雨夜旧信揭开旧城钟楼案。");
    expect(screen.getByLabelText("主线目标")).toHaveValue("查清钟楼旧案。");
    expect(screen.getByLabelText("失败代价")).toBeInTheDocument();
    expect(screen.getByLabelText("故事驱动类型")).toHaveAttribute("role", "combobox");
    expect(screen.queryByText("生成核心故事方案")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("主线目标"), {
      target: { value: "查清钟楼火灾真相。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 辅助补全" }));

    await waitFor(() => {
      expect(rpcPayload("blueprint.completeForm")).toMatchObject({
        fields: {
          mainGoal: "查清钟楼火灾真相。",
          storyDriver: "mystery",
        },
        projectId: "project_1",
      });
    });
    expect(screen.getByLabelText("失败代价")).toHaveValue(
      "失败会让旧案幸存者再次被清算，主角也会失去替亲人翻案的机会。",
    );

    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => {
      expect(rpcPayload("blueprint.saveForm")).toMatchObject({
        fields: {
          mainGoal: "找出钟楼火灾真相并迫使旧城公开档案。",
          stakes: "失败会让旧案幸存者再次被清算，主角也会失去替亲人翻案的机会。",
        },
        projectId: "project_1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "确认核心故事" }));
    await waitFor(() => {
      expect(allRpcPayloads("blueprint.saveForm")).toHaveLength(2);
      expect(rpcPayload("blueprint.apply")).toMatchObject({
        blueprintId: "blueprint_1",
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

    expect(await screen.findByRole("heading", { name: "作品总控台" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2. 世界观设计" }));
    expect(await screen.findByRole("heading", { name: "世界观设计" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("世界基底"), {
      target: { value: "旧城悬疑世界。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(rpcPayload("worldbuilding.saveFields")).toMatchObject({
        fields: {
          worldBase: "旧城悬疑世界。",
        },
        projectId: "project_1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "4. 角色设计" }));
    expect(await screen.findByRole("heading", { name: "角色列表" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建角色" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 生成角色候选" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "角色档案表单" })).not.toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole("button", { name: "9. 正文创作" }));
    fireEvent.change(await screen.findByLabelText("章节正文"), {
      target: { value: "更新后的章节正文。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存章节" }));
    fireEvent.click(screen.getByRole("button", { name: "生成草稿" }));
    fireEvent.click(screen.getByRole("button", { name: "记忆确认" }));

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
    const plotlines: Array<Record<string, unknown>> = [
      {
        centralQuestion: "旧案真凶是谁？",
        driver: "每三章给出一条线索。",
        emotionalPromise: "持续悬疑和真相逼近。",
        id: "plotline_existing",
        importance: "core",
        name: "旧案主线",
        narrativeRole: "main_drive",
        nodes: [],
        payoffPlan: "卷末回收旧案真相。",
        priority: 10,
        relatedCharacterIds: ["character_existing"],
        relatedForeshadowingIds: [],
        relatedStoryEventIds: [],
        relatedWorldRuleIds: [],
        startState: "主角收到旧信。",
        status: "planning",
        summary: "围绕旧案调查推进。",
        type: "main",
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
            chapters: [],
            characters: [
              {
                id: "character_existing",
                importance: "core",
                name: "顾晏",
                narrativeFunction: "opposition",
                role: "antagonist",
                storyTask: "制造旧案调查的主要阻力。",
                traits: [{ name: "secret", value: "掌握档案原件。" }],
              },
            ],
            foreshadowings: [],
            items: [],
            locations: [],
            memoryCandidates: [],
            organizations: [],
            plotlines,
            project,
            storyEvents: [],
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
        case "worldbuilding.saveFields":
          return rpcSuccess(request.id, {
            fields: request.payload.fields,
          });
        case "plotline.create": {
          const plotline = {
            ...request.payload,
            id: "plotline_created",
            name: request.payload.title,
            nodes: [],
            status: request.payload.status ?? "planning",
            type: request.payload.kind,
          };
          plotlines.push(plotline);
          return rpcSuccess(request.id, plotline);
        }
        case "plotline.update": {
          const target = plotlines.find((plotline) => plotline.id === request.payload.plotlineId);
          const patch = request.payload.patch as Record<string, unknown>;
          if (target) {
            Object.assign(target, patch);
            if (typeof patch.title === "string") {
              target.name = patch.title;
            }
          }
          return rpcSuccess(request.id, target ?? null);
        }
        case "plotline.createNode": {
          const node = {
            ...request.payload,
            id: "plotline_node_created",
          };
          const target = plotlines.find((plotline) => plotline.id === request.payload.plotlineId);
          if (target) {
            target.nodes = [
              ...((target.nodes as Record<string, unknown>[] | undefined) ?? []),
              node,
            ];
          }
          return rpcSuccess(request.id, node);
        }
        default:
          return rpcSuccess(request.id, { id: `${request.command}:result` });
      }
    });

    render(
      <AppProviders>
        <ShellLayout />
      </AppProviders>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "2. 世界观设计" }));

    fireEvent.change(screen.getByLabelText("世界基底"), {
      target: { value: "旧城悬疑世界。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(rpcPayload("worldbuilding.saveFields")).toMatchObject({
        fields: {
          worldBase: "旧城悬疑世界。",
        },
        projectId: "project_1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "4. 角色设计" }));
    expect(screen.getByRole("heading", { name: "角色列表" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "角色档案表单" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建角色" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 生成角色候选" })).toBeInTheDocument();
    expect(screen.getByText("顾晏")).toBeInTheDocument();
    expect(screen.getByText("制造阻力")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "编辑角色 顾晏" }));
    const editCharacterDialog = await screen.findByRole("dialog", { name: "编辑角色：顾晏" });
    expect(within(editCharacterDialog).getByDisplayValue("顾晏")).toBeInTheDocument();
    expect(
      within(editCharacterDialog).getByDisplayValue("制造旧案调查的主要阻力。"),
    ).toBeInTheDocument();
    expect(within(editCharacterDialog).getByDisplayValue("掌握档案原件。")).toBeInTheDocument();
    fireEvent.change(within(editCharacterDialog).getByLabelText("剧情任务"), {
      target: { value: "制造新的调查阻力，并逼出旧案档案伪造线。" },
    });
    fireEvent.click(within(editCharacterDialog).getByRole("button", { name: "保存修改" }));
    await waitFor(() => {
      expect(rpcPayload("character.update")).toMatchObject({
        characterId: "character_existing",
        patch: {
          name: "顾晏",
          narrativeFunction: "opposition",
          role: "antagonist",
          secret: "掌握档案原件。",
          storyTask: "制造新的调查阻力，并逼出旧案档案伪造线。",
        },
        projectId: "project_1",
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "编辑角色：顾晏" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "删除角色 顾晏" }));
    const deleteCharacterDialog = await screen.findByRole("dialog", { name: "删除角色" });
    expect(
      within(deleteCharacterDialog).getByText("删除后会从当前作品的角色列表中移除。"),
    ).toBeInTheDocument();
    fireEvent.click(within(deleteCharacterDialog).getByRole("button", { name: "确认删除" }));
    await waitFor(() => {
      expect(rpcPayload("character.delete")).toMatchObject({
        characterId: "character_existing",
        projectId: "project_1",
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "删除角色" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "AI 生成角色候选" }));
    const characterAiDialog = await screen.findByRole("dialog", { name: "AI 生成角色候选" });
    fireEvent.change(within(characterAiDialog).getByLabelText("创作描述"), {
      target: { value: "生成能承担旧案反转线的角色候选。" },
    });
    fireEvent.click(within(characterAiDialog).getByRole("button", { name: "生成角色候选" }));
    await waitFor(() => {
      expect(rpcPayload("element.generateCandidates")).toMatchObject({
        count: 10,
        description: "生成能承担旧案反转线的角色候选。",
        elementType: "character_name",
        genre: "悬疑",
        projectId: "project_1",
        style: "悬疑推理",
      });
    });
    expect(await within(characterAiDialog).findByText("潮汐断星刃")).toBeInTheDocument();
    fireEvent.click(within(characterAiDialog).getByLabelText("选择候选 潮汐断星刃"));
    fireEvent.click(within(characterAiDialog).getByRole("button", { name: "采纳选中" }));
    await waitFor(() => {
      expect(rpcPayload("element.acceptCandidates")).toMatchObject({
        items: [expect.objectContaining({ name: "潮汐断星刃", type: "weapon" })],
        projectId: "project_1",
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "AI 生成角色候选" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "新建角色" }));
    const createCharacterDialog = await screen.findByRole("dialog", { name: "新建角色" });
    fireEvent.change(within(createCharacterDialog).getByLabelText("人物名称"), {
      target: { value: "林鸢" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("年龄/身份"), {
      target: { value: "女，27 岁" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("首次登场"), {
      target: { value: "第 1 章" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("原型标签"), {
      target: { value: "离队调查者" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("剧情任务"), {
      target: { value: "把旧信线索推进成主线调查，并把被掩盖的旧案逼出来。" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("外在目标"), {
      target: { value: "查清旧信来源" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("内在需求"), {
      target: { value: "重新学会信任他人" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("致命缺陷"), {
      target: { value: "过度自责" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("秘密"), {
      target: { value: "十年前曾到过案发现场" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("关系钩子"), {
      target: { value: "与钟楼守档人互相试探。" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("初始状态"), {
      target: { value: "逃避旧案，只想离开旧城。" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("关键转折"), {
      target: { value: "发现证人仍被追杀后决定回头。" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("结局状态"), {
      target: { value: "愿意公开旧案证据并承担代价。" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("说话风格"), {
      target: { value: "克制、短句、偏观察细节。" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("外形记忆点"), {
      target: { value: "旧风衣、随身旧笔记本，观察时会按住袖口。" },
    });
    fireEvent.change(within(createCharacterDialog).getByLabelText("人物小传"), {
      target: { value: "前刑警，因十年前钟楼案离队。" },
    });
    fireEvent.click(within(createCharacterDialog).getByRole("button", { name: "创建人物" }));
    await waitFor(() => {
      expect(rpcPayload("character.create")).toMatchObject({
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
        importance: "major",
        name: "林鸢",
        narrativeFunction: "driver",
        need: "重新学会信任他人",
        projectId: "project_1",
        relationshipHook: "与钟楼守档人互相试探。",
        role: "support",
        secret: "十年前曾到过案发现场",
        storyTask: "把旧信线索推进成主线调查，并把被掩盖的旧案逼出来。",
        voiceProfile: "克制、短句、偏观察细节。",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "5. 故事线设计" }));
    expect(await screen.findByRole("heading", { name: "故事线列表" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "故事线档案表单" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建故事线" })).toBeInTheDocument();
    expect(screen.getByText("旧案主线")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "编辑故事线 旧案主线" }));
    const editPlotlineDialog = await screen.findByRole("dialog", { name: "编辑故事线：旧案主线" });
    fireEvent.change(within(editPlotlineDialog).getByLabelText("核心问题"), {
      target: { value: "旧案真凶是否还在操控旧城？" },
    });
    fireEvent.change(within(editPlotlineDialog).getByLabelText("回收方式"), {
      target: { value: "第 20 章揭示寄信人身份，并回收旧案关键证据。" },
    });
    fireEvent.click(within(editPlotlineDialog).getByRole("button", { name: "保存修改" }));
    await waitFor(() => {
      expect(rpcPayload("plotline.update")).toMatchObject({
        patch: {
          centralQuestion: "旧案真凶是否还在操控旧城？",
          payoffPlan: "第 20 章揭示寄信人身份，并回收旧案关键证据。",
          title: "旧案主线",
        },
        plotlineId: "plotline_existing",
        projectId: "project_1",
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "编辑故事线：旧案主线" }),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "添加节点 旧案主线" }));
    const createNodeDialog = await screen.findByRole("dialog", {
      name: "添加故事线节点：旧案主线",
    });
    fireEvent.change(within(createNodeDialog).getByLabelText("节点标题"), {
      target: { value: "信纸水印出现" },
    });
    fireEvent.change(within(createNodeDialog).getByLabelText("章节提示"), {
      target: { value: "第 3 章" },
    });
    fireEvent.change(within(createNodeDialog).getByLabelText("节点说明"), {
      target: { value: "让读者看到信纸水印，但暂时不解释来源。" },
    });
    fireEvent.click(within(createNodeDialog).getByRole("button", { name: "添加节点" }));
    await waitFor(() => {
      expect(rpcPayload("plotline.createNode")).toMatchObject({
        chapterHint: "第 3 章",
        description: "让读者看到信纸水印，但暂时不解释来源。",
        kind: "seed",
        plotlineId: "plotline_existing",
        projectId: "project_1",
        status: "planned",
        title: "信纸水印出现",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "新建故事线" }));
    const createPlotlineDialog = await screen.findByRole("dialog", { name: "新建故事线" });
    fireEvent.change(within(createPlotlineDialog).getByLabelText("故事线名称"), {
      target: { value: "旧信谜团" },
    });
    fireEvent.change(within(createPlotlineDialog).getByLabelText("故事线摘要"), {
      target: { value: "围绕旧信来源展开。" },
    });
    fireEvent.change(within(createPlotlineDialog).getByLabelText("核心问题"), {
      target: { value: "旧信到底是谁寄出的？" },
    });
    fireEvent.change(within(createPlotlineDialog).getByLabelText("推进机制"), {
      target: { value: "每三章投放一条可验证线索，并用一次误导制造新的问题。" },
    });
    fireEvent.change(within(createPlotlineDialog).getByLabelText("情绪承诺"), {
      target: { value: "持续解谜、反转和真相逼近。" },
    });
    fireEvent.click(within(createPlotlineDialog).getByRole("button", { name: "创建故事线" }));
    await waitFor(() => {
      expect(rpcPayload("plotline.create")).toMatchObject({
        centralQuestion: "旧信到底是谁寄出的？",
        driver: "每三章投放一条可验证线索，并用一次误导制造新的问题。",
        emotionalPromise: "持续解谜、反转和真相逼近。",
        importance: "major",
        kind: "branch",
        narrativeRole: "main_drive",
        priority: 0,
        projectId: "project_1",
        relatedCharacterIds: [],
        relatedForeshadowingIds: [],
        relatedStoryEventIds: [],
        relatedWorldRuleIds: [],
        status: "planning",
        summary: "围绕旧信来源展开。",
        title: "旧信谜团",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "删除故事线 旧案主线" }));
    const deletePlotlineDialog = await screen.findByRole("dialog", { name: "删除故事线" });
    expect(
      within(deletePlotlineDialog).getByText("删除后会从当前作品的故事线列表中移除。"),
    ).toBeInTheDocument();
    fireEvent.click(within(deletePlotlineDialog).getByRole("button", { name: "确认删除" }));
    await waitFor(() => {
      expect(rpcPayload("plotline.delete")).toMatchObject({
        plotlineId: "plotline_existing",
        projectId: "project_1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "7. 剧情节点" }));
    fireEvent.click(screen.getByRole("button", { name: "新建伏笔" }));
    const foreshadowingDialog = await screen.findByRole("dialog", { name: "新建伏笔" });
    fireEvent.change(within(foreshadowingDialog).getByLabelText("伏笔标题"), {
      target: { value: "水印伏笔" },
    });
    fireEvent.change(within(foreshadowingDialog).getByLabelText("伏笔内容"), {
      target: { value: "信纸水印暗示十年前档案。" },
    });
    fireEvent.click(within(foreshadowingDialog).getByRole("button", { name: "创建伏笔" }));

    await waitFor(() => {
      expect(rpcPayload("foreshadowing.create")).toMatchObject({
        description: "信纸水印暗示十年前档案。",
        importance: 3,
        projectId: "project_1",
        title: "水印伏笔",
      });
    });
  }, 10_000);

  it("opens character editing and AI assistance from list actions", async () => {
    const project = createProject();
    const characters = [
      {
        id: "character_qinyu",
        importance: "core",
        name: "秦钰",
        narrativeFunction: "driver",
        role: "protagonist",
        storyTask: "追查旧案并推动主线真相浮出水面。",
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
            chapters: [],
            characterStateSnapshots: [
              {
                characterId: "character_qinyu",
                chapterId: "chapter_1",
                chapterIndex: 1,
                createdAt: 1,
                emotionalState: "警惕，压抑愤怒。",
                externalGoal: "确认旧信来源。",
                id: "state_character_qinyu_1",
                internalNeed: "重新相信同伴。",
                knowledgeState: "知道旧信和十年前档案有关。",
                physicalState: "轻伤。",
                position: "钟楼旧档案室",
                projectId: "project_1",
                relationshipState: {},
                resourceState: {},
                riskFlags: ["身份暴露"],
                secrets: ["隐瞒曾到过案发现场"],
                sourceId: "chapter_1",
                sourceType: "chapter",
              },
            ],
            characters,
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
        default:
          return rpcSuccess(request.id, null);
      }
    });

    const { container } = render(
      <AppProviders>
        <ShellLayout />
      </AppProviders>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "4. 角色设计" }));
    expect(await screen.findByRole("heading", { name: "角色列表" })).toBeInTheDocument();

    const workspace = container.querySelector(".character-design-workspace");
    const primaryRow = workspace?.querySelector(":scope > .character-design-primary");
    const listPane = screen.getByRole("region", { name: "角色列表面板" });

    expect(primaryRow).toBeInstanceOf(HTMLElement);
    expect(primaryRow).toContainElement(listPane);
    expect(screen.queryByRole("region", { name: "角色档案表单" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看角色状态 秦钰" }));
    const stateDialog = await screen.findByRole("dialog", { name: "状态时间线：秦钰" });
    expect(within(stateDialog).getByText("钟楼旧档案室")).toBeInTheDocument();
    expect(within(stateDialog).getByText("身份暴露")).toBeInTheDocument();
    fireEvent.click(within(stateDialog).getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "状态时间线：秦钰" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "新建角色" }));
    expect(await screen.findByRole("dialog", { name: "新建角色" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "角色档案表单" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "新建角色" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "AI 生成角色候选" }));
    const aiDialog = await screen.findByRole("dialog", { name: "AI 生成角色候选" });
    expect(within(aiDialog).getByRole("heading", { name: "AI 辅助" })).toBeInTheDocument();
  });

  it("edits plot nodes with a stable form-first layout and aligned fields", async () => {
    const project = createProject();
    const chapter = {
      content: "",
      id: "chapter_3",
      title: "第三章 公堂前夜",
      version: 0,
    };
    const characters = [
      {
        id: "character_qinyu",
        name: "秦钰",
        role: "protagonist",
      },
    ];
    const storyEvents = [
      {
        chapterId: null,
        eventType: "discovery",
        id: "event_seed",
        participants: [],
        sceneId: null,
        status: "draft",
        storyTime: "第 1 章夜雨",
        summary: "秦钰收到带水印的旧信。",
        title: "旧信出现",
      },
      {
        chapterId: null,
        eventType: "reveal",
        id: "event_payoff",
        participants: [],
        sceneId: null,
        status: "planned",
        storyTime: null,
        summary: "秦钰在公堂指出档案被调包。",
        title: "档案调包真相",
      },
    ];
    const foreshadowings = [
      {
        id: "foreshadowing_1",
        importance: 4,
        links: [{ eventId: "event_seed", role: "seed" }],
        payoffText: "",
        seedText: "信纸水印第一次出现，暂不解释来源。",
        status: "seeded",
        title: "信纸水印",
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
            characters,
            foreshadowings,
            items: [],
            locations: [],
            memoryCandidates: [],
            organizations: [],
            plotDebts: [
              {
                actualPayoffChapterIndex: null,
                debtType: "mystery",
                expectedPayoffChapterIndex: 20,
                id: "plot_debt_watermark",
                lifecycleNotes: ["第 1 章信纸水印出现"],
                promise: "解释信纸水印为何来自官府档案纸。",
                projectId: "project_1",
                relatedCharacterIds: ["character_qinyu"],
                relatedForeshadowingId: "foreshadowing_1",
                relatedPlotlineId: null,
                relatedWorldRuleIds: [],
                riskLevel: "high",
                seedChapterIndex: 1,
                status: "open",
                title: "水印来源",
              },
            ],
            plotlines: [],
            project,
            storyEvents,
            workOrders: [],
            worldRules: [],
          });
        default:
          return rpcSuccess(request.id, null);
      }
    });

    const { container } = render(
      <AppProviders>
        <ShellLayout />
      </AppProviders>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "7. 剧情节点" }));
    expect(await screen.findByRole("heading", { name: "剧情节点设计" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "节点与伏笔" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "剧情节点详情" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建剧情节点" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建伏笔" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 规划回收" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "节点标题" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "伏笔标题" })).not.toBeInTheDocument();

    const workspace = container.querySelector(".plot-node-design-workspace");
    const primaryRow = workspace?.querySelector(":scope > .plot-node-design-primary");
    const listPane = screen.getByRole("region", { name: "剧情节点列表面板" });
    const detailPane = screen.getByRole("region", { name: "剧情节点详情面板" });

    expect(primaryRow).toBeInstanceOf(HTMLElement);
    expect(primaryRow).toContainElement(listPane);
    expect(primaryRow).toContainElement(detailPane);

    fireEvent.click(screen.getByRole("button", { name: "编辑剧情节点 旧信出现" }));
    let dialog = await screen.findByRole("dialog", { name: "编辑剧情节点：旧信出现" });
    fireEvent.change(within(dialog).getByLabelText("节点标题"), {
      target: { value: "水印来源暴露" },
    });
    fireEvent.change(within(dialog).getByLabelText("故事时间"), {
      target: { value: "第 3 章公堂前" },
    });
    fireEvent.change(within(dialog).getByLabelText("节点描述"), {
      target: { value: "秦钰确认旧信水印来自官府档案纸。" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存剧情节点" }));

    await waitFor(() => {
      expect(rpcPayload("storyEvent.update")).toMatchObject({
        patch: {
          description: "秦钰确认旧信水印来自官府档案纸。",
          storyTime: "第 3 章公堂前",
          title: "水印来源暴露",
        },
        projectId: "project_1",
        storyEventId: "event_seed",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "查看伏笔 信纸水印" }));
    expect(await screen.findByRole("heading", { name: "伏笔详情" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "编辑伏笔 信纸水印" }));
    dialog = await screen.findByRole("dialog", { name: "编辑伏笔：信纸水印" });
    fireEvent.change(within(dialog).getByLabelText("伏笔内容"), {
      target: { value: "水印像是普通纸纹，实则是官府档案纸暗纹。" },
    });
    fireEvent.change(within(dialog).getByLabelText("回收方案"), {
      target: { value: "第 20 章揭示水印证明档案调包。" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存伏笔" }));

    await waitFor(() => {
      expect(rpcPayload("foreshadowing.update")).toMatchObject({
        foreshadowingId: "foreshadowing_1",
        patch: {
          description: "水印像是普通纸纹，实则是官府档案纸暗纹。",
          payoffExpectation: "第 20 章揭示水印证明档案调包。",
        },
        projectId: "project_1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "AI 规划回收" }));
    dialog = await screen.findByRole("dialog", { name: "AI 规划回收" });
    fireEvent.click(within(dialog).getByRole("button", { name: "生成伏笔回收方案" }));

    await waitFor(() => {
      expect(rpcPayload("foreshadowing.plan")).toMatchObject({
        projectId: "project_1",
      });
    });

    expect(screen.getByRole("region", { name: "剧情债账本" })).toBeInTheDocument();
    expect(screen.getByText("水印来源")).toBeInTheDocument();
    expect(screen.getByText("风险 高")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "新增剧情债" }));
    dialog = await screen.findByRole("dialog", { name: "新增剧情债" });
    fireEvent.change(within(dialog).getByLabelText("剧情债标题"), {
      target: { value: "证人失踪" },
    });
    fireEvent.change(within(dialog).getByLabelText("埋设章节"), {
      target: { value: "4" },
    });
    fireEvent.change(within(dialog).getByLabelText("预期回收章节"), {
      target: { value: "18" },
    });
    fireEvent.change(within(dialog).getByLabelText("承诺内容"), {
      target: { value: "证人突然失踪，后续必须说明谁转移了证人以及目的。" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "创建剧情债" }));

    await waitFor(() => {
      expect(rpcPayload("plotDebt.save")).toMatchObject({
        projectId: "project_1",
        values: {
          debtType: "reader_promise",
          expectedPayoffChapterIndex: 18,
          promise: "证人突然失踪，后续必须说明谁转移了证人以及目的。",
          riskLevel: "medium",
          seedChapterIndex: 4,
          status: "open",
          title: "证人失踪",
        },
      });
    });
  });

  it("edits layered book outline plans with aligned form fields", async () => {
    const project = createProject();
    const creativePath = createCreativePathBoard({
      arcPlans: [
        {
          arcIndex: 1,
          characterArcId: null,
          endChapterIndex: 20,
          escalation: ["旧信出现", "证人失踪", "公堂反杀"],
          id: "arc_plan_1",
          plotlineId: "plotline_1",
          purpose: "让主角从被动收信转为主动查案。",
          startChapterIndex: 1,
          status: "draft",
          title: "旧信追查",
          volumePlanId: "volume_plan_1",
        },
      ],
      bookPlans: [
        {
          corePromise: "每卷一次权力反转和一次身份代价。",
          endingDirection: "主角放弃旧身份，重建朝堂规则。",
          id: "book_plan_1",
          mainPlotlineId: "plotline_1",
          status: "active",
          targetWordCount: 1_200_000,
          title: "布衣天子全书大纲",
        },
      ],
      volumePlans: [
        {
          bookPlanId: "book_plan_1",
          climax: "主角在公堂反杀第一次构陷。",
          id: "volume_plan_1",
          majorConflict: "旧贵族封锁上升通道。",
          purpose: "完成身份压迫、入局动机和第一次公开胜利。",
          status: "draft",
          targetWordCount: 280_000,
          title: "第一卷 寒门入局",
          volumeIndex: 1,
        },
      ],
    });
    const plotlines = [
      {
        id: "plotline_1",
        name: "旧案主线",
        priority: 10,
        summary: "围绕旧案调查推进。",
        type: "main",
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
            chapters: [],
            creativePath,
            foreshadowings: [],
            items: [],
            locations: [],
            memoryCandidates: [],
            organizations: [],
            plotlines,
            project,
            storyEvents: [],
            workOrders: [],
            worldRules: [],
          });
        case "plot.saveBookPlanDraft": {
          const payload = request.payload as {
            readonly bookPlanId?: string;
          } & Omit<(typeof creativePath.bookPlans)[number], "id">;
          creativePath.bookPlans = [
            {
              ...creativePath.bookPlans[0],
              ...payload,
              id: payload.bookPlanId ?? "book_plan_1",
            },
          ];
          return rpcSuccess(request.id, creativePath.bookPlans[0]);
        }
        case "plot.saveVolumePlan": {
          const payload = request.payload as {
            readonly volumePlanId?: string;
          } & Omit<(typeof creativePath.volumePlans)[number], "id">;
          creativePath.volumePlans = [
            {
              ...creativePath.volumePlans[0],
              ...payload,
              id: payload.volumePlanId ?? "volume_plan_1",
            },
          ];
          return rpcSuccess(request.id, creativePath.volumePlans[0]);
        }
        case "plot.saveArcPlan": {
          const payload = request.payload as {
            readonly arcPlanId?: string;
          } & Omit<(typeof creativePath.arcPlans)[number], "id">;
          creativePath.arcPlans = [
            {
              ...creativePath.arcPlans[0],
              ...payload,
              id: payload.arcPlanId ?? "arc_plan_1",
            },
          ];
          return rpcSuccess(request.id, creativePath.arcPlans[0]);
        }
        default:
          return rpcSuccess(request.id, null);
      }
    });

    const { container } = render(
      <AppProviders>
        <ShellLayout />
      </AppProviders>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "6. 全书大纲" }));
    expect(await screen.findByRole("heading", { name: "大纲层级" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "全书规划详情" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "核心承诺" })).not.toBeInTheDocument();

    const workspace = container.querySelector(".book-outline-workspace");
    const primaryRow = workspace?.querySelector(":scope > .book-outline-primary");
    const listPane = screen.getByRole("region", { name: "大纲层级列表" });
    const detailPane = screen.getByRole("region", { name: "大纲详情" });

    expect(primaryRow).toBeInstanceOf(HTMLElement);
    expect(primaryRow).toContainElement(listPane);
    expect(primaryRow).toContainElement(detailPane);
    expect(primaryRow?.children).toHaveLength(2);
    expect(screen.queryByRole("region", { name: "AI 辅助规划" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "编辑全书规划 布衣天子全书大纲" }));
    let dialog = await screen.findByRole("dialog", { name: /编辑全书规划/ });
    fireEvent.change(within(dialog).getByLabelText("核心承诺"), {
      target: { value: "每卷一次公开胜利和一次隐藏损失。" },
    });
    fireEvent.change(within(dialog).getByLabelText("结局方向"), {
      target: { value: "主角公开朝堂真相后离开旧身份。" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存全书规划" }));

    await waitFor(() => {
      expect(rpcPayload("plot.saveBookPlanDraft")).toMatchObject({
        bookPlanId: "book_plan_1",
        corePromise: "每卷一次公开胜利和一次隐藏损失。",
        endingDirection: "主角公开朝堂真相后离开旧身份。",
        projectId: "project_1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "编辑卷规划 第一卷 寒门入局" }));
    dialog = await screen.findByRole("dialog", { name: /编辑卷规划/ });
    fireEvent.change(within(dialog).getByLabelText("卷核心冲突"), {
      target: { value: "寒门新官必须用民案撬动旧贵族封锁。" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存卷规划" }));

    await waitFor(() => {
      expect(rpcPayload("plot.saveVolumePlan")).toMatchObject({
        bookPlanId: "book_plan_1",
        majorConflict: "寒门新官必须用民案撬动旧贵族封锁。",
        projectId: "project_1",
        volumePlanId: "volume_plan_1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "编辑阶段弧线 旧信追查" }));
    dialog = await screen.findByRole("dialog", { name: /编辑阶段弧线/ });
    fireEvent.change(within(dialog).getByLabelText("升级链"), {
      target: { value: "旧信出现\n证人失踪\n公堂反杀\n幕后势力露面" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存阶段弧线" }));

    await waitFor(() => {
      expect(rpcPayload("plot.saveArcPlan")).toMatchObject({
        arcPlanId: "arc_plan_1",
        escalation: ["旧信出现", "证人失踪", "公堂反杀", "幕后势力露面"],
        projectId: "project_1",
        volumePlanId: "volume_plan_1",
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
        body: '{"card":{"title":"第一章执行卡"}}',
        id: "artifact_execution_card",
        kind: "chapter_execution_card_draft",
        status: "pending",
        targetId: "chapter_plan_1",
        targetType: "chapter_plan",
        title: "第一章执行卡",
      },
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
      {
        body: '{"storyDelta":{"globalSituationChange":"钟楼旧案被重新打开"}}',
        id: "artifact_state_delta",
        kind: "story_state_delta_draft",
        status: "pending",
        targetId: "chapter_1",
        targetType: "chapter",
        title: "第一章状态变化",
      },
      {
        body: '{"progressSummary":"前十章节奏稳定"}',
        id: "artifact_serial_review",
        kind: "serial_review_report",
        status: "pending",
        targetId: "1-10",
        targetType: "chapter_range",
        title: "前十章阶段复盘",
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
          chapter.content = artifacts[1]!.body;
          chapter.version = 4;
          artifacts[1]!.status = "applied";
          return rpcSuccess(request.id, { artifact: artifacts[1], chapter });
        case "chapterExecutionCard.apply":
          artifacts[0]!.status = "applied";
          return rpcSuccess(request.id, {
            chapterPlanId: "chapter_plan_1",
            id: "execution_card_1",
            status: "confirmed",
          });
        case "chapter.reviewDraft":
          return rpcSuccess(request.id, {
            artifact: {
              id: "artifact_chapter_review",
              kind: "chapter_review_report",
              status: "pending",
              title: "章节审稿报告",
            },
          });
        case "storyState.extractDelta":
          return rpcSuccess(request.id, {
            artifact: artifacts[3],
          });
        case "storyState.applyDelta":
          artifacts[3]!.status = "applied";
          return rpcSuccess(request.id, {
            characterSnapshots: [],
            plotDebtChanges: [],
            storySnapshot: { id: "story_state_1" },
          });
        case "serialReview.apply":
          artifacts[4]!.status = "applied";
          return rpcSuccess(request.id, {
            id: "serial_review_1",
            status: "archived",
          });
        case "artifact.reject":
          artifacts[2]!.status = "rejected";
          return rpcSuccess(request.id, artifacts[2]);
        default:
          return rpcSuccess(request.id, null);
      }
    });

    render(
      <AppProviders>
        <ShellLayout />
      </AppProviders>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "9. 正文创作" }));
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

    fireEvent.click(await screen.findByRole("tab", { name: /AI 产物/ }));

    fireEvent.click(screen.getByRole("tab", { name: /状态/ }));
    fireEvent.click(screen.getByRole("button", { name: "审阅当前版本" }));
    fireEvent.click(screen.getByRole("button", { name: "抽取状态变化" }));

    await waitFor(() => {
      expect(rpcPayload("chapter.reviewDraft")).toMatchObject({
        chapterId: "chapter_1",
        chapterVersion: 3,
        projectId: "project_1",
      });
      expect(rpcPayload("storyState.extractDelta")).toMatchObject({
        chapterId: "chapter_1",
        chapterVersion: 3,
        projectId: "project_1",
      });
    });

    fireEvent.click(await screen.findByRole("tab", { name: /AI 产物/ }));

    const executionCardArtifact = screen.getByText("第一章执行卡").closest("li");
    expect(executionCardArtifact).not.toBeNull();
    fireEvent.click(
      within(executionCardArtifact as HTMLElement).getByRole("button", { name: "应用" }),
    );

    await waitFor(() => {
      expect(rpcPayload("chapterExecutionCard.apply")).toMatchObject({
        artifactId: "artifact_execution_card",
        projectId: "project_1",
      });
    });

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

    const stateDeltaArtifact = await screen.findByText("第一章状态变化");
    const stateDeltaArtifactItem = stateDeltaArtifact.closest("li");
    expect(stateDeltaArtifactItem).not.toBeNull();
    fireEvent.click(
      within(stateDeltaArtifactItem as HTMLElement).getByRole("button", { name: "应用" }),
    );

    await waitFor(() => {
      expect(rpcPayload("storyState.applyDelta")).toMatchObject({
        artifactId: "artifact_state_delta",
        projectId: "project_1",
      });
    });

    const serialReviewArtifact = await screen.findByText("前十章阶段复盘");
    const serialReviewArtifactItem = serialReviewArtifact.closest("li");
    expect(serialReviewArtifactItem).not.toBeNull();
    fireEvent.click(
      within(serialReviewArtifactItem as HTMLElement).getByRole("button", { name: "应用" }),
    );

    await waitFor(() => {
      expect(rpcPayload("serialReview.apply")).toMatchObject({
        artifactId: "artifact_serial_review",
        projectId: "project_1",
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

    fireEvent.click(await screen.findByRole("button", { name: "9. 正文创作" }));
    await screen.findByLabelText("章节正文");
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
    estimatedChapterCount: number | null;
    estimatedWordCount: number | null;
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
    emotionalAxes?: string[];
    id: string;
    logline: string;
    mainConflict: string;
    mainGoal?: string;
    premise: string;
    protagonistArc: string;
    risks: string[];
    stakes?: string;
    status: string;
    storyDriver?: string;
  };
  outlines: Array<{
    id: string;
    scope: string;
    status: string;
    title: string;
  }>;
  volumeOutlines: Array<{
    id: string;
    outlineId: string;
    sortOrder: number;
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
  sceneOutlines: Array<{
    chapterOutlineId: string;
    id: string;
    sortOrder: number;
    status: string;
    title: string;
  }>;
  bookPlans: Array<{
    corePromise: string;
    endingDirection: null | string;
    id: string;
    mainPlotlineId: null | string;
    status: string;
    targetWordCount: number;
    title: string;
  }>;
  volumePlans: Array<{
    bookPlanId: string;
    climax: null | string;
    id: string;
    majorConflict: string;
    purpose: string;
    status: string;
    targetWordCount: number;
    title: string;
    volumeIndex: number;
  }>;
  arcPlans: Array<{
    arcIndex: number;
    characterArcId: null | string;
    endChapterIndex: null | number;
    escalation: string[];
    id: string;
    plotlineId: null | string;
    purpose: string;
    startChapterIndex: null | number;
    status: string;
    title: string;
    volumePlanId: string;
  }>;
  chapterPlans: Array<{
    chapterGoal: string;
    chapterIndex: number;
    id: string;
    status: string;
    title: string;
  }>;
  scenePlans: Array<{
    chapterPlanId: string;
    id: string;
    sceneIndex: number;
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
      estimatedChapterCount: 260,
      estimatedWordCount: 800_000,
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
    arcPlans: [],
    bookPlans: [],
    chapterOutlines: [],
    chapterPlans: [],
    outlines: [],
    reviewIssues: [],
    scenePlans: [],
    sceneOutlines: [],
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
    volumeOutlines: [],
    volumePlans: [],
    ...overrides,
  };
}
