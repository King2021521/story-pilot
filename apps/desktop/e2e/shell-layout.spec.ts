import { expect, test, type Page } from "@playwright/test";

interface StoryPilotE2eRpcRequest {
  readonly command: string;
  readonly id: string;
  readonly payload: Record<string, unknown>;
}

interface StoryPilotE2eRpcResponse {
  readonly data: unknown;
  readonly id: string;
  readonly ok: true;
}

declare global {
  interface Window {
    __STORY_PILOT_E2E_REQUESTS__?: StoryPilotE2eRpcRequest[];
    __STORY_PILOT_E2E_RPC__?: (
      request: StoryPilotE2eRpcRequest,
    ) => Promise<StoryPilotE2eRpcResponse> | StoryPilotE2eRpcResponse;
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const project = {
      defaultVolumeId: "volume_1",
      genre: "冰雪末世",
      id: "project_1",
      status: "planning",
      style: "硬核生存、基地经营、群像博弈、技术升级",
      title: "雪境堡垒",
      wordCountGoal: 5_000_000,
      workId: "work_1",
    };
    const chapters = [
      {
        content: "寒潮预警被所有人当成又一次夸张新闻。",
        id: "chapter_1",
        title: "第一章 寒潮前夜",
        version: 1,
      },
    ];
    const creativePath = {
      arcPlans: [],
      bookPlans: [],
      brief: {
        emotionalRewards: ["生存压迫", "安全屋建设", "资源博弈"],
        estimatedChapterCount: 1500,
        estimatedWordCount: 5_000_000,
        forbiddenDirections: [],
        genre: "冰雪末世",
        id: "brief_1",
        initialIdea: "极寒灾变中，主角提前打造安全屋并建立末世秩序。",
        lengthProfile: "超长篇连载",
        narrativePov: "第三人称有限视角",
        platformProfile: "男频",
        status: "draft",
        subgenres: ["末世生存", "基地经营"],
        targetAudience: "喜欢硬核基建和强冲突的读者",
      },
      blueprint: null,
      chapterOutlines: [],
      chapterPlans: [],
      outlines: [],
      reviewIssues: [],
      scenePlans: [],
      stages: [{ readinessScore: 40, stageKey: "chapters", status: "available" }],
      volumePlans: [],
    };
    const runtimeSettings = {
      model: {
        apiKey: "sk-test",
        baseUrl: "https://api.example.com/v1",
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
    const diagnosticsHealth = {
      appHome: "/Users/test/.story-pilot",
      globalDatabasePath: "/Users/test/.story-pilot/global.sqlite",
      model: "configured",
      projectCount: 1,
      projectsRoot: "/Users/test/.story-pilot/projects",
      settingsPath: "/Users/test/.story-pilot/setting.json",
      sidecar: "ok",
      storage: "ok",
    };
    const requests: StoryPilotE2eRpcRequest[] = [];

    window.__STORY_PILOT_E2E_REQUESTS__ = requests;
    window.__STORY_PILOT_E2E_RPC__ = async (request) => {
      requests.push(request);

      switch (request.command) {
        case "project.listRecent":
          return { data: { items: [project] }, id: request.id, ok: true };
        case "project.open":
          return { data: project, id: request.id, ok: true };
        case "workbench.getBoard":
          return {
            data: {
              artifacts: [],
              chapters,
              characters: [{ id: "character_1", name: "陆沉", role: "protagonist" }],
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
              worldRules: [
                {
                  category: "economy",
                  content: "极寒后燃料、电池、药品和安全屋通行权成为核心资源。",
                  id: "rule_resource_order",
                  status: "canon",
                  title: "资源秩序",
                },
              ],
              worldbuildingProfile: null,
            },
            id: request.id,
            ok: true,
          };
        case "element.generateCandidates":
          return {
            data: {
              items: Array.from({ length: 10 }, (_, index) => ({
                description: "控制安全屋外部白色补给线的半地下互助联盟。",
                name: index === 0 ? "白线同盟" : `白线同盟${index + 1}`,
                rationale: "能承载物资交易、背叛和临时秩序争夺。",
                tags: ["补给", "势力"],
                type: "faction",
              })),
            },
            id: request.id,
            ok: true,
          };
        case "element.acceptCandidates":
          return {
            data: {
              accepted: [
                {
                  id: "organization_1",
                  name: "白线同盟",
                  target: "organization",
                  type: "faction",
                },
              ],
            },
            id: request.id,
            ok: true,
          };
        case "graph.getNeighborhood":
          return {
            data: {
              edges: [{ label: "scene", sourceId: "chapter_1", targetId: "location_1" }],
              nodes: [
                { id: "chapter_1", label: "第一章 寒潮前夜", type: "chapter" },
                { id: "location_1", label: "地下安全屋", type: "location" },
              ],
            },
            id: request.id,
            ok: true,
          };
        case "settings.get":
          return { data: runtimeSettings, id: request.id, ok: true };
        case "diagnostics.getHealth":
          return { data: diagnosticsHealth, id: request.id, ok: true };
        default:
          return { data: null, id: request.id, ok: true };
      }
    };
  });
});

test("shell uses a non-overlapping workspace and collapsible inspector chrome", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByLabel("应用标题栏")).toBeVisible();
  await expect(page.getByLabel("作品管理区")).toBeVisible();
  await expect(page.getByLabel("工作台")).toBeVisible();
  await expect(page.getByLabel("创作检查器")).toBeVisible();
  await expect(page.getByRole("tab", { name: /工具箱/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "项目看板" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "AI 任务" })).toHaveCount(0);
  await expect(page.getByLabel("作品树")).toBeVisible();
  await expect(page.getByText("当前作品")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "收起作品 雪境堡垒" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.getByRole("button", { name: "收起作品 雪境堡垒" }).click();
  await expect(page.getByRole("button", { name: "4. 角色设计" })).toHaveCount(0);
  await page.getByRole("button", { name: "展开作品 雪境堡垒" }).click();
  await expect(page.getByRole("button", { name: "4. 角色设计" })).toBeVisible();

  const titlebarBox = await page.getByLabel("应用标题栏").boundingBox();
  const sidebarBox = await page.getByLabel("作品管理区").boundingBox();
  const workspaceBox = await page.getByLabel("工作台").boundingBox();
  const inspectorBox = await page.getByLabel("创作检查器").boundingBox();
  expect(titlebarBox).not.toBeNull();
  expect(sidebarBox).not.toBeNull();
  expect(workspaceBox).not.toBeNull();
  expect(inspectorBox).not.toBeNull();
  expect(titlebarBox!.height).toBeLessThanOrEqual(48);
  expect(sidebarBox!.y).toBeGreaterThanOrEqual(titlebarBox!.height - 1);
  expect(boxesOverlap(sidebarBox!, workspaceBox!)).toBe(false);
  expect(boxesOverlap(workspaceBox!, inspectorBox!)).toBe(false);
  expect(workspaceBox!.width).toBeGreaterThan(700);

  await page.getByRole("tab", { name: /工具箱/ }).click();
  await page.getByLabel("生成类型").click();
  await page.locator(".ant-select-dropdown").getByText("势力名称").click();
  await page.getByLabel("创作描述").fill("围绕安全屋外部补给线生成可长期博弈的地下势力名称。");
  await expect(page.getByLabel("风格")).toBeVisible();
  await expect(page.getByLabel("世界观约束")).toBeVisible();
  await expect(page.getByLabel("额外约束")).toBeVisible();
  await expect(page.getByRole("button", { name: "生成候选" })).toBeVisible();
  await page.getByRole("button", { name: "生成候选" }).click();
  await expect(page.getByText("白线同盟", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "生成候选" })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const formPanel = document.querySelector('[aria-label="AI 生成工具箱"]');
        const resultsPanel = document.querySelector('[aria-label="工具箱候选结果"]');
        if (!formPanel || !resultsPanel) {
          return Number.POSITIVE_INFINITY;
        }

        return Math.round(
          resultsPanel.getBoundingClientRect().top - formPanel.getBoundingClientRect().bottom,
        );
      }),
    )
    .toBeLessThanOrEqual(24);
  const toolboxCandidateList = page
    .getByLabel("工具箱候选结果")
    .locator(".inspector-toolbox__list");
  await expect(toolboxCandidateList).toBeVisible();
  await expect
    .poll(() =>
      toolboxCandidateList.evaluate((element) => ({
        hasVerticalScroll: element.scrollHeight > element.clientHeight,
        overflowY: window.getComputedStyle(element).overflowY,
      })),
    )
    .toMatchObject({ hasVerticalScroll: true, overflowY: "auto" });
  await toolboxCandidateList.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.getByText("白线同盟10")).toBeVisible();
  await page.getByRole("checkbox", { exact: true, name: "选择候选 白线同盟" }).check();
  await page.getByRole("button", { name: "采纳选中" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__STORY_PILOT_E2E_REQUESTS__?.map((request) => request.payload)),
    )
    .toContainEqual(
      expect.objectContaining({
        description: "围绕安全屋外部补给线生成可长期博弈的地下势力名称。",
        elementType: "faction",
        projectId: "project_1",
        worldRuleIds: ["rule_resource_order"],
      }),
    );

  await page.getByRole("button", { name: "收起侧栏" }).click();
  await expect(page.getByRole("button", { name: "展开侧栏" })).toBeVisible();

  await page.getByRole("button", { name: "收起检查器" }).click();
  await expect(page.getByLabel("检查器快捷栏")).toBeVisible();
  await expect(page.getByLabel("创作检查器")).toHaveCount(0);

  await page.getByRole("button", { name: "打开检查器：图谱" }).click();
  await expect(page.getByLabel("创作检查器")).toBeVisible();
  await expect(page.getByText("地下安全屋")).toBeVisible();

  await page.getByRole("button", { name: "设置" }).click();
  const settingsDialog = page.getByRole("dialog", { name: "设置" });
  await expect(settingsDialog).toBeVisible();
  await expect(settingsDialog.getByLabel("设置菜单")).toBeVisible();
  await expect(settingsDialog.getByRole("tab", { name: "模型配置" })).toHaveCount(0);
  await expect(
    settingsDialog.getByRole("button", { exact: true, name: "模型配置" }),
  ).toHaveAttribute("aria-pressed", "true");

  await settingsDialog.getByRole("button", { exact: true, name: "数据与备份" }).click();
  await expect(
    settingsDialog.getByRole("button", { exact: true, name: "数据与备份" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(settingsDialog.getByText("/Users/test/.story-pilot/projects")).toBeVisible();

  const settingsMenuBox = await settingsDialog.getByLabel("设置菜单").boundingBox();
  const settingsContentBox = await settingsDialog.getByLabel("设置内容").boundingBox();
  expect(settingsMenuBox).not.toBeNull();
  expect(settingsContentBox).not.toBeNull();
  expect(boxesOverlap(settingsMenuBox!, settingsContentBox!)).toBe(false);
});

test("worldbuilding and core story long text fields are stacked full-row editors", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "2. 世界观设计" }).click();
  await expect(page.getByRole("heading", { name: "世界观设计" })).toBeVisible();
  await expectFieldStackedBelow(page, "世界基底", "空间地理");
  await expectFieldStackedBelow(page, "历史背景", "力量体系");

  await page.getByRole("button", { name: "3. 核心故事" }).click();
  await expect(page.getByRole("heading", { name: "核心故事设计" })).toBeVisible();
  await expectFieldStackedBelow(page, "故事前提", "一句话故事");
  await expectFieldStackedBelow(page, "核心承诺", "主线目标");
});

function boxesOverlap(
  first: { height: number; width: number; x: number; y: number },
  second: { height: number; width: number; x: number; y: number },
): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

async function expectFieldStackedBelow(page: Page, firstLabel: string, secondLabel: string) {
  const first = page.getByLabel(firstLabel, { exact: true });
  const second = page.getByLabel(secondLabel, { exact: true });

  await expect(first).toBeVisible();
  await expect(second).toBeVisible();

  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(Math.abs(firstBox!.x - secondBox!.x)).toBeLessThanOrEqual(8);
  expect(secondBox!.width).toBeGreaterThanOrEqual(firstBox!.width * 0.95);
  expect(secondBox!.y).toBeGreaterThan(firstBox!.y + firstBox!.height);
}
