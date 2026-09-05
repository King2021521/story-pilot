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
      defaultVolumeId: "volume_plan_1",
      genre: "冰雪末世",
      id: "project_large",
      status: "writing",
      style: "硬核生存、基地经营、群像博弈、技术升级",
      title: "雪境堡垒",
      wordCountGoal: 5_000_000,
      workId: "work_large",
    };
    const bookPlan = {
      corePromise: "每一卷都有安全屋升级、外部威胁升级、内部秩序代价和阶段高潮。",
      endingDirection: "主角把安全屋从私人避难所推演为极寒文明节点。",
      id: "book_plan_large",
      mainPlotlineId: "plotline_main",
      projectId: project.id,
      status: "active",
      targetWordCount: 5_000_000,
      title: "雪境堡垒 500万字全书规划",
    };
    const volumePlans = Array.from({ length: 10 }, (_, index) => ({
      bookPlanId: bookPlan.id,
      climax: `第 ${index + 1} 卷卷末完成一次安全屋等级跃迁和外部秩序反转。`,
      id: `volume_plan_${index + 1}`,
      majorConflict: `第 ${index + 1} 卷围绕热源、人口、路线或外部联盟升级对抗。`,
      projectId: project.id,
      purpose: `第 ${index + 1} 卷推动基地规模、规则代价和敌对势力压力同步升级。`,
      status: "active",
      targetWordCount: 500_000,
      title: `第 ${index + 1} 卷 雪线阶段 ${index + 1}`,
      volumeIndex: index + 1,
    }));
    const arcPlans = Array.from({ length: 200 }, (_, index) => {
      const arcIndex = index + 1;
      const volumeIndex = Math.floor(index / 20) + 1;
      return {
        arcIndex,
        characterArcId: null,
        endChapterIndex: Math.min(1500, arcIndex * 8),
        escalation: ["危机出现", "资源误判", "规则冲突", "阶段反击"],
        id: `arc_plan_${arcIndex}`,
        plotlineId: "plotline_main",
        projectId: project.id,
        purpose: `第 ${arcIndex} 段弧线验证一个安全屋规则是否能承受外部压力。`,
        startChapterIndex: (arcIndex - 1) * 8 + 1,
        status: "active",
        title: `阶段弧线 ${arcIndex}`,
        volumePlanId: `volume_plan_${volumeIndex}`,
      };
    });
    const chapterPlans = Array.from({ length: 1500 }, (_, index) => {
      const chapterIndex = index + 1;
      return {
        chapterGoal: `推进第 ${chapterIndex} 章的资源压力、人物选择和安全屋升级反馈。`,
        chapterIndex,
        id: `chapter_plan_${chapterIndex}`,
        status: chapterIndex <= 120 ? "approved" : "draft",
        title: `雪线推进 ${chapterIndex}`,
      };
    });
    const scenePlans = Array.from({ length: 4500 }, (_, index) => {
      const sceneIndex = index + 1;
      return {
        chapterPlanId: `chapter_plan_${Math.floor(index / 3) + 1}`,
        id: `scene_plan_${sceneIndex}`,
        sceneGoal: `场景 ${sceneIndex} 承接安全屋压力和信息增量。`,
        sceneIndex,
      };
    });
    const chapters = Array.from({ length: 1500 }, (_, index) => ({
      content: `第 ${index + 1} 章正文摘要占位，用于验证大体量项目打开速度。`,
      id: `chapter_${index + 1}`,
      title: `第 ${index + 1} 章 雪线推进 ${index + 1}`,
      version: 1,
    }));
    const characters = Array.from({ length: 120 }, (_, index) => ({
      id: `character_${index + 1}`,
      name: `堡垒人物 ${index + 1}`,
      role: index === 0 ? "protagonist" : "supporting",
    }));
    const storyEvents = Array.from({ length: 4500 }, (_, index) => ({
      chapterId: `chapter_${Math.floor(index / 3) + 1}`,
      description: `事件 ${index + 1} 改变资源、关系或外部威胁。`,
      id: `event_${index + 1}`,
      involvedCharacterIds: [],
      status: index < 360 ? "canon" : "planned",
      storyTime: `第 ${Math.floor(index / 3) + 1} 章`,
      title: `剧情事件 ${index + 1}`,
      type: "discovery",
    }));
    const plotDebts = Array.from({ length: 1000 }, (_, index) => ({
      actualPayoffChapterIndex: null,
      debtType: index % 2 === 0 ? "reader_promise" : "foreshadowing",
      expectedPayoffChapterIndex: index + 20,
      id: `plot_debt_${index + 1}`,
      lifecycleNotes: [`第 ${index + 1} 章埋设，第 ${index + 10} 章强化`],
      promise: `剧情债 ${index + 1} 必须兑现安全屋升级、外部威胁或人物代价。`,
      relatedCharacterIds: [`character_${(index % 120) + 1}`],
      relatedForeshadowingId: null,
      relatedPlotlineId: "plotline_main",
      relatedWorldRuleIds: ["world_rule_1"],
      riskLevel: index % 5 === 0 ? "high" : "medium",
      seedChapterIndex: index + 1,
      status: index % 7 === 0 ? "payoff_ready" : "open",
      title: `剧情债 ${index + 1}`,
    }));
    const memoryCandidates = Array.from({ length: 10000 }, (_, index) => ({
      confidence: 0.8,
      id: `memory_${index + 1}`,
      kind: "fact",
      sourceChapterId: `chapter_${(index % 1500) + 1}`,
      status: "pending",
      text: `记忆候选 ${index + 1}`,
    }));
    const storyStateSnapshots = Array.from({ length: 1000 }, (_, index) => ({
      activeConflicts: [`冲突 ${index + 1}`],
      chapterId: `chapter_${index + 1}`,
      chapterIndex: index + 1,
      currentArcPlanId: `arc_plan_${(index % 200) + 1}`,
      currentVolumeId: `volume_plan_${Math.floor(index / 100) + 1}`,
      globalSituation: `第 ${index + 1} 章后，极寒压力和安全屋规则继续升级。`,
      hiddenInformation: [],
      id: `story_state_${index + 1}`,
      locationState: {},
      openQuestions: [],
      organizationState: {},
      resourceState: {},
      revealedInformation: [],
      sourceChapterVersion: 1,
      storyTime: `第 ${index + 1} 章`,
    }));
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
              characterStateSnapshots: [],
              characters,
              chapters,
              creativePath: {
                arcPlans,
                bookPlans: [bookPlan],
                brief: {
                  emotionalRewards: ["安全感", "资源争夺", "技术升级"],
                  estimatedChapterCount: 1500,
                  estimatedWordCount: 5_000_000,
                  forbiddenDirections: [],
                  genre: "冰雪末世",
                  id: "brief_large",
                  initialIdea: "极寒末世中提前打造安全屋，并把私人堡垒推成文明节点。",
                  lengthProfile: "500万字长篇",
                  narrativePov: "第三人称多视角",
                  platformProfile: "男频",
                  status: "confirmed",
                  subgenres: ["末世生存", "基地经营", "群像博弈"],
                  targetAudience: "喜欢硬核生存、长期升级和组织博弈的读者",
                },
                blueprint: {
                  corePromise: "持续兑现安全屋升级、资源争夺、规则代价和外部威胁升级。",
                  id: "blueprint_large",
                  logline: "冰雪末世里，防灾工程师把旧堡垒改造成安全屋，并建立新的极寒秩序。",
                  mainGoal: "把安全屋升级为可长期维持人口、热源、医疗和交易的城市节点。",
                  premise: "极寒不是天灾孤岛，而是旧冰冠计划失败后的文明重启压力。",
                  status: "confirmed",
                },
                chapterExecutionCards: chapterPlans.slice(0, 60).map((plan) => ({
                  chapterPlanId: plan.id,
                  id: `execution_card_${plan.chapterIndex}`,
                  status: "confirmed",
                  title: `${plan.title}执行卡`,
                })),
                chapterOutlines: [],
                chapterPlans,
                outlines: [],
                reviewIssues: [],
                scenePlans,
                stages: [{ readinessScore: 78, stageKey: "chapters", status: "available" }],
                volumePlans,
              },
              foreshadowings: [],
              items: [],
              locations: [],
              memoryCandidates,
              organizations: [],
              plotDebts,
              plotlines: [
                {
                  id: "plotline_main",
                  name: "安全屋主线",
                  priority: 10,
                  summary: "围绕安全屋升级、资源争夺和极寒秩序推进。",
                  type: "main",
                },
              ],
              project,
              storyEvents,
              storyStateSnapshots,
              workOrders: [],
              worldRules: [
                {
                  category: "economy",
                  content: "极寒后燃料、电池、药品、通行权和信息可信度成为核心资源。",
                  id: "world_rule_1",
                  status: "canon",
                  title: "资源秩序",
                },
              ],
            },
            id: request.id,
            ok: true,
          };
        case "context.buildPackage":
          return {
            data: {
              contextPackage: {
                estimatedTokenCount: 12_400,
                id: "context_package_perf",
                items: [
                  { content: "500万字项目核心承诺和最近状态。", kind: "project_brief" },
                  { content: "开放剧情债和最近章节摘要。", kind: "plot_debts" },
                ],
                omittedItems: [],
                tokenBudget: 16_000,
              },
            },
            id: request.id,
            ok: true,
          };
        default:
          return { data: null, id: request.id, ok: true };
      }
    };
  });
});

test("large 500w project keeps dashboard and chapter planning responsive", async ({ page }) => {
  const dashboardStartedAt = Date.now();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "作品总控台" })).toBeVisible();
  expect(Date.now() - dashboardStartedAt).toBeLessThan(5_000);

  await expect(page.getByRole("heading", { name: "雪境堡垒" })).toBeVisible();
  await expect(page.getByLabel("创作检查器")).toBeVisible();

  const planningStartedAt = Date.now();
  await page.getByRole("button", { name: "8. 章节规划" }).click();
  await expect(page.getByRole("heading", { exact: true, name: "章节规划" })).toBeVisible();
  await expect(page.getByText(/显示 30 \/ 1500 章，共\s*1500 章/)).toBeVisible();
  expect(Date.now() - planningStartedAt).toBeLessThan(2_000);
  await expect(page.getByLabel("章节规划分页")).toBeVisible();
  await expect(page.getByText("第 1500 章：雪线推进 1500")).toHaveCount(0);

  const filterStartedAt = Date.now();
  await page.getByLabel("筛选起始章节").fill("1490");
  await page.getByLabel("筛选结束章节").fill("1500");
  await expect(page.getByText(/显示 11 \/ 11 章，共\s*1500 章/)).toBeVisible();
  await expect(page.getByText("第 1500 章：雪线推进 1500")).toBeVisible();
  expect(Date.now() - filterStartedAt).toBeLessThan(1_000);

  const contextPackageMs = await buildContextPackageFromPage(page);
  expect(contextPackageMs).toBeLessThan(3_000);
  await expect
    .poll(() => lastPayload(page, "context.buildPackage"))
    .toMatchObject({
      projectId: "project_large",
      purpose: "chapter_draft",
      targetId: "chapter_plan_1500",
      targetType: "chapter_plan",
      tokenBudget: 16_000,
    });

  const workspaceBox = await page.getByLabel("工作台").boundingBox();
  const inspectorBox = await page.getByLabel("创作检查器").boundingBox();
  expect(workspaceBox).not.toBeNull();
  expect(inspectorBox).not.toBeNull();
  expect(boxesOverlap(workspaceBox!, inspectorBox!)).toBe(false);
});

async function buildContextPackageFromPage(page: Page) {
  return page.evaluate(async () => {
    const rpc = window.__STORY_PILOT_E2E_RPC__;
    if (!rpc) {
      return Number.POSITIVE_INFINITY;
    }

    const startedAt = performance.now();
    await rpc({
      command: "context.buildPackage",
      id: "context-package-perf",
      payload: {
        projectId: "project_large",
        purpose: "chapter_draft",
        targetId: "chapter_plan_1500",
        targetType: "chapter_plan",
        tokenBudget: 16_000,
      },
    });
    return performance.now() - startedAt;
  });
}

async function lastPayload(page: Page, command: string) {
  return page.evaluate((targetCommand) => {
    const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
    return requests.findLast((request) => request.command === targetCommand)?.payload;
  }, command);
}

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
