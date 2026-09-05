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
      status: "writing",
      style: "硬核生存、基地经营、群像博弈、技术升级",
      title: "雪境堡垒",
      wordCountGoal: 5_000_000,
      workId: "work_1",
    };
    const chapters = [
      {
        content:
          "沈砚把旧堡垒的燃油管线从雪层里挖出来，第一次意识到寒潮不是天气，而是秩序崩塌的开始。",
        id: "chapter_1",
        title: "第一章 雪墙之前",
        version: 2,
      },
    ];
    const artifacts: Array<Record<string, unknown>> = [];
    const creativePath = {
      arcPlans: [
        {
          arcIndex: 1,
          characterArcId: null,
          endChapterIndex: 20,
          escalation: ["寒潮预警", "仓库争夺", "安全屋第一次封门"],
          id: "arc_plan_1",
          plotlineId: "plotline_main",
          purpose: "让主角从提前准备转为建立规则。",
          startChapterIndex: 1,
          status: "draft",
          title: "白灾开局",
          volumePlanId: "volume_plan_1",
        },
      ],
      bookPlans: [
        {
          corePromise: "每一阶段都有安全屋升级、外部威胁升级和内部秩序代价。",
          endingDirection: "主角建立能穿越极寒周期的新秩序。",
          id: "book_plan_1",
          mainPlotlineId: "plotline_main",
          status: "active",
          targetWordCount: 5_000_000,
          title: "雪境堡垒 500万字全书规划",
        },
      ],
      brief: {
        emotionalRewards: ["安全感", "资源争夺", "技术升级"],
        estimatedChapterCount: 1500,
        estimatedWordCount: 5_000_000,
        forbiddenDirections: [],
        genre: "冰雪末世",
        id: "brief_1",
        initialIdea: "极寒末世里提前打造安全屋。",
        lengthProfile: "五百万字长篇",
        narrativePov: "第三人称",
        platformProfile: "男频",
        status: "confirmed",
        subgenres: ["末世生存", "基地经营"],
        targetAudience: "喜欢硬核生存和长期建设的读者",
      },
      blueprint: null,
      chapterExecutionCards: [
        {
          chapterPlanId: "chapter_plan_1",
          id: "execution_card_1",
          status: "confirmed",
          title: "第一章执行卡",
        },
      ],
      chapterOutlines: [],
      chapterPlans: [
        {
          chapterGoal: "建立极寒预警、主角准备优势和第一处资源危机。",
          chapterIndex: 1,
          id: "chapter_plan_1",
          status: "approved",
          title: "第 1 章：雪墙之前",
        },
        {
          chapterGoal: "让邻里第一次围绕燃料和供暖发生冲突。",
          chapterIndex: 2,
          id: "chapter_plan_2",
          status: "draft",
          title: "第 2 章：燃油管线",
        },
      ],
      outlines: [],
      reviewIssues: [],
      scenePlans: [],
      stages: [{ readinessScore: 70, stageKey: "chapters", status: "available" }],
      volumePlans: [
        {
          bookPlanId: "book_plan_1",
          climax: "安全屋第一次公开拒绝外部掠夺者。",
          id: "volume_plan_1",
          majorConflict: "主角想守住有限热源，外部群体想重新分配安全屋资源。",
          purpose: "完成白灾压迫、基地雏形和第一批人物关系。",
          status: "active",
          targetWordCount: 500_000,
          title: "第一卷 白灾入屋",
          volumeIndex: 1,
        },
      ],
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
              artifacts,
              chapters,
              characterStateSnapshots: [],
              characters: [{ id: "character_1", name: "沈砚", role: "protagonist" }],
              creativePath,
              foreshadowings: [],
              memoryCandidates: [],
              plotDebts: [
                {
                  actualPayoffChapterIndex: null,
                  debtType: "reader_promise",
                  expectedPayoffChapterIndex: 12,
                  id: "plot_debt_1",
                  lifecycleNotes: [],
                  promise: "安全屋每次扩张都必须付出资源或关系代价。",
                  relatedCharacterIds: ["character_1"],
                  relatedForeshadowingId: null,
                  relatedPlotlineId: "plotline_main",
                  relatedWorldRuleIds: [],
                  riskLevel: "medium",
                  seedChapterIndex: 1,
                  status: "open",
                  title: "安全屋升级代价",
                },
              ],
              plotlines: [
                {
                  id: "plotline_main",
                  name: "安全屋主线",
                  priority: 10,
                  summary: "围绕安全屋升级、资源争夺和秩序建立推进。",
                  type: "main",
                },
              ],
              project,
              storyEvents: [],
              storyStateSnapshots: [],
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
            },
            id: request.id,
            ok: true,
          };
        case "serialReview.generate": {
          const artifact = {
            body: '{"progressSummary":"第 1-2 章完成白灾压迫和安全屋承诺建立。"}',
            id: "artifact_serial_review_1",
            kind: "serial_review_report",
            status: "pending",
            targetId: "1-2",
            targetType: "chapter_range",
            title: "第 1-2 章阶段复盘",
          };
          artifacts.push(artifact);
          return { data: { artifact }, id: request.id, ok: true };
        }
        case "chapter.reviewDraft": {
          const artifact = {
            body: '{"score":82,"blockingIssues":[]}',
            id: "artifact_chapter_review_1",
            kind: "chapter_review_report",
            status: "pending",
            targetId: "chapter_1",
            targetType: "chapter",
            title: "第一章审稿报告",
          };
          artifacts.push(artifact);
          return { data: { artifact }, id: request.id, ok: true };
        }
        case "storyState.extractDelta": {
          const artifact = {
            body: '{"storyDelta":{"globalSituationChange":"寒潮风险从新闻变成现实威胁。"}}',
            id: "artifact_state_delta_1",
            kind: "story_state_delta_draft",
            status: "pending",
            targetId: "chapter_1",
            targetType: "chapter",
            title: "第一章状态变化",
          };
          artifacts.push(artifact);
          return { data: { artifact }, id: request.id, ok: true };
        }
        case "storyState.applyDelta":
          artifacts.forEach((artifact) => {
            if (artifact.id === request.payload.artifactId) {
              artifact.status = "applied";
            }
          });
          return {
            data: {
              characterSnapshots: [{ id: "character_state_1" }],
              plotDebtChanges: [],
              storySnapshot: { id: "story_state_1" },
            },
            id: request.id,
            ok: true,
          };
        case "serialReview.apply":
          artifacts.forEach((artifact) => {
            if (artifact.id === request.payload.artifactId) {
              artifact.status = "applied";
            }
          });
          return { data: { id: "serial_review_1", status: "archived" }, id: request.id, ok: true };
        default:
          return { data: null, id: request.id, ok: true };
      }
    };
  });
});

test("longform serial loop exposes review, state extraction, and serial review actions", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "作品总控台" })).toBeVisible();

  await page.getByRole("button", { name: "8. 章节规划" }).click();
  await expect(page.getByRole("heading", { exact: true, name: "章节规划" })).toBeVisible();
  await page.getByRole("button", { name: "生成阶段复盘" }).click();
  const serialReviewDialog = page.getByRole("dialog", { name: "生成阶段复盘" });
  await expect(serialReviewDialog).toBeVisible();
  await expect(serialReviewDialog.getByRole("spinbutton", { name: "起始章节" })).toHaveValue("1");
  await expect(serialReviewDialog.getByRole("spinbutton", { name: "结束章节" })).toHaveValue("2");
  await serialReviewDialog.getByRole("button", { name: /生成复盘报告/ }).click();

  await expect(page.getByRole("tab", { name: /AI 产物/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("第 1-2 章阶段复盘")).toBeVisible();
  await expect
    .poll(() => lastPayload(page, "serialReview.generate"))
    .toMatchObject({
      endChapterIndex: 2,
      projectId: "project_1",
      scope: "chapter_batch",
      startChapterIndex: 1,
    });

  const serialReviewArtifact = page
    .locator(".artifact-review-list__item")
    .filter({ hasText: "第 1-2 章阶段复盘" });
  await serialReviewArtifact.getByRole("button", { name: "应用" }).click();
  await expect
    .poll(() => lastPayload(page, "serialReview.apply"))
    .toMatchObject({
      artifactId: "artifact_serial_review_1",
      projectId: "project_1",
    });

  await page.getByRole("button", { name: "9. 正文创作" }).click();
  await expect(page.getByRole("heading", { name: "第一章 雪墙之前" })).toBeVisible();
  await page.getByRole("button", { name: "审阅当前版本" }).click();
  await expect(page.getByText("第一章审稿报告")).toBeVisible();
  await expect
    .poll(() => lastPayload(page, "chapter.reviewDraft"))
    .toMatchObject({
      chapterId: "chapter_1",
      chapterVersion: 2,
      projectId: "project_1",
    });

  await page.getByRole("button", { name: "抽取状态变化" }).click();
  await expect(page.getByText("第一章状态变化")).toBeVisible();
  await expect
    .poll(() => lastPayload(page, "storyState.extractDelta"))
    .toMatchObject({
      chapterId: "chapter_1",
      chapterVersion: 2,
      projectId: "project_1",
    });

  const stateArtifact = page
    .locator(".artifact-review-list__item")
    .filter({ hasText: "第一章状态变化" });
  await stateArtifact.getByRole("button", { name: "应用" }).click();
  await expect
    .poll(() => lastPayload(page, "storyState.applyDelta"))
    .toMatchObject({
      artifactId: "artifact_state_delta_1",
      projectId: "project_1",
    });

  const workspaceBox = await page.getByLabel("工作台").boundingBox();
  const inspectorBox = await page.getByLabel("创作检查器").boundingBox();
  expect(workspaceBox).not.toBeNull();
  expect(inspectorBox).not.toBeNull();
  expect(boxesOverlap(workspaceBox!, inspectorBox!)).toBe(false);
});

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
