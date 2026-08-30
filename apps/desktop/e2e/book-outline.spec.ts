import { expect, test } from "@playwright/test";

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
      genre: "权谋",
      id: "project_1",
      status: "planning",
      style: "寒门权谋",
      title: "布衣天子",
      workId: "work_1",
    };
    const creativePath = {
      arcPlans: [
        {
          arcIndex: 1,
          characterArcId: null,
          endChapterIndex: 24,
          escalation: ["旧案开场", "证人失踪", "公堂反杀"],
          id: "arc_plan_1",
          plotlineId: "plotline_1",
          projectId: "project_1",
          purpose: "用第一阶段让主角从被动受害转为主动查案。",
          startChapterIndex: 1,
          status: "draft",
          title: "旧案破口",
          volumePlanId: "volume_plan_1",
        },
      ],
      bookPlans: [
        {
          corePromise: "小人物每卷完成一次权力反转，并付出一次身份代价。",
          endingDirection: "主角放弃旧身份，重建朝堂规则。",
          id: "book_plan_1",
          mainPlotlineId: "plotline_1",
          projectId: "project_1",
          status: "active",
          targetWordCount: 1_200_000,
          title: "布衣天子全书大纲",
        },
      ],
      brief: {
        emotionalRewards: ["爽点", "权谋"],
        estimatedChapterCount: 320,
        estimatedWordCount: 1_200_000,
        forbiddenDirections: [],
        genre: "权谋",
        id: "brief_1",
        initialIdea: "寒门少年因旧案被迫入局朝堂。",
        lengthProfile: "长篇连载",
        narrativePov: "第三人称",
        platformProfile: "男频",
        status: "draft",
        subgenres: ["寒门逆袭"],
        targetAudience: "男频爽文",
      },
      blueprint: null,
      chapterOutlines: [],
      chapterPlans: [],
      outlines: [],
      reviewIssues: [],
      scenePlans: [],
      stages: [],
      volumePlans: [
        {
          bookPlanId: "book_plan_1",
          climax: "主角在公堂反杀第一次构陷。",
          id: "volume_plan_1",
          majorConflict: "旧贵族封锁上升通道，主角必须借民案撬动权力结构。",
          projectId: "project_1",
          purpose: "完成身份压迫、入局动机和第一次公开胜利。",
          status: "draft",
          targetWordCount: 280_000,
          title: "第一卷 寒门入局",
          volumeIndex: 1,
        },
      ],
    };
    const plotlines = [
      {
        id: "plotline_1",
        name: "旧案主线",
        priority: 10,
        summary: "围绕旧案调查推进。",
        type: "main",
      },
    ];
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
            },
            id: request.id,
            ok: true,
          };
        case "plot.saveBookPlanDraft": {
          Object.assign(creativePath.bookPlans[0], request.payload, {
            id: request.payload.bookPlanId ?? "book_plan_1",
          });
          return { data: creativePath.bookPlans[0], id: request.id, ok: true };
        }
        case "plot.saveVolumePlan": {
          Object.assign(creativePath.volumePlans[0], request.payload, {
            id: request.payload.volumePlanId ?? "volume_plan_1",
          });
          return { data: creativePath.volumePlans[0], id: request.id, ok: true };
        }
        case "plot.saveArcPlan": {
          Object.assign(creativePath.arcPlans[0], request.payload, {
            id: request.payload.arcPlanId ?? "arc_plan_1",
          });
          return { data: creativePath.arcPlans[0], id: request.id, ok: true };
        }
        default:
          return { data: null, id: request.id, ok: true };
      }
    };
  });
});

test("book outline uses stable layered forms and persists each tier", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "作品总控台" })).toBeVisible();
  await page.getByRole("button", { name: "6. 全书大纲" }).click();

  await expect(page.getByRole("heading", { name: "全书大纲" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "全书计划" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "卷规划" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "阶段弧线" })).toBeVisible();

  const listBox = await page.locator(".book-outline-tier-list").boundingBox();
  const editorBox = await page.locator(".book-outline-editor").boundingBox();
  const assistantBox = await page.locator(".book-outline-assistant").boundingBox();
  expect(listBox).not.toBeNull();
  expect(editorBox).not.toBeNull();
  expect(assistantBox).not.toBeNull();
  expect(boxesOverlap(listBox!, editorBox!)).toBe(false);
  expect(boxesOverlap(listBox!, assistantBox!)).toBe(false);
  expect(boxesOverlap(editorBox!, assistantBox!)).toBe(false);

  await page.getByRole("button", { name: "编辑全书规划 布衣天子全书大纲" }).click();
  const corePromiseInput = page.getByRole("textbox", { name: "核心承诺" });
  await expect(corePromiseInput).toHaveValue("小人物每卷完成一次权力反转，并付出一次身份代价。");
  await corePromiseInput.fill("每卷一次公开胜利和一次隐藏损失。");
  await expect(corePromiseInput).toHaveValue("每卷一次公开胜利和一次隐藏损失。");
  await page.getByRole("button", { name: "保存全书规划" }).click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "plot.saveBookPlanDraft")
          ?.payload;
      }),
    )
    .toMatchObject({
      bookPlanId: "book_plan_1",
      corePromise: "每卷一次公开胜利和一次隐藏损失。",
      projectId: "project_1",
    });

  await page.getByRole("button", { name: "编辑卷规划 第一卷 寒门入局" }).click();
  const volumeConflictInput = page.getByRole("textbox", { name: "卷核心冲突" });
  await expect(volumeConflictInput).toHaveValue("旧贵族封锁上升通道，主角必须借民案撬动权力结构。");
  await volumeConflictInput.fill("寒门新官必须用民案撬动旧贵族封锁。");
  await expect(volumeConflictInput).toHaveValue("寒门新官必须用民案撬动旧贵族封锁。");
  await page.getByRole("button", { name: "保存卷规划" }).click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "plot.saveVolumePlan")?.payload;
      }),
    )
    .toMatchObject({
      bookPlanId: "book_plan_1",
      majorConflict: "寒门新官必须用民案撬动旧贵族封锁。",
      projectId: "project_1",
      volumePlanId: "volume_plan_1",
    });

  await page.getByRole("button", { name: "编辑阶段弧线 旧案破口" }).click();
  const escalationInput = page.getByRole("textbox", { name: "升级链" });
  await expect(escalationInput).toHaveValue("旧案开场\n证人失踪\n公堂反杀");
  await escalationInput.fill("旧案开场\n证人失踪\n公堂反杀\n幕后势力露面");
  await expect(escalationInput).toHaveValue("旧案开场\n证人失踪\n公堂反杀\n幕后势力露面");
  await page.getByRole("button", { name: "保存阶段弧线" }).click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "plot.saveArcPlan")?.payload;
      }),
    )
    .toMatchObject({
      arcPlanId: "arc_plan_1",
      escalation: ["旧案开场", "证人失踪", "公堂反杀", "幕后势力露面"],
      projectId: "project_1",
      volumePlanId: "volume_plan_1",
    });
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
