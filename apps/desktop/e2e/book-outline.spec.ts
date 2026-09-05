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
          const payload = request.payload;
          const id = typeof payload.bookPlanId === "string" ? payload.bookPlanId : "book_plan_new";
          let plan = creativePath.bookPlans.find((item) => item.id === id);
          if (!plan) {
            plan = {
              corePromise: "",
              endingDirection: null,
              id,
              mainPlotlineId: null,
              projectId: "project_1",
              status: "draft",
              targetWordCount: 1_200_000,
              title: "",
            };
            creativePath.bookPlans.push(plan);
          }
          Object.assign(plan, payload, { id, projectId: "project_1" });
          return { data: plan, id: request.id, ok: true };
        }
        case "plot.saveVolumePlan": {
          const payload = request.payload;
          const id =
            typeof payload.volumePlanId === "string" ? payload.volumePlanId : "volume_plan_new";
          let plan = creativePath.volumePlans.find((item) => item.id === id);
          if (!plan) {
            plan = {
              bookPlanId:
                typeof payload.bookPlanId === "string" ? payload.bookPlanId : "book_plan_1",
              climax: null,
              id,
              majorConflict: "",
              projectId: "project_1",
              purpose: "",
              status: "draft",
              targetWordCount: 280_000,
              title: "",
              volumeIndex: 2,
            };
            creativePath.volumePlans.push(plan);
          }
          Object.assign(plan, payload, { id, projectId: "project_1" });
          return { data: plan, id: request.id, ok: true };
        }
        case "plot.saveArcPlan": {
          const payload = request.payload;
          const id = typeof payload.arcPlanId === "string" ? payload.arcPlanId : "arc_plan_new";
          let plan = creativePath.arcPlans.find((item) => item.id === id);
          if (!plan) {
            plan = {
              arcIndex: 2,
              characterArcId: null,
              endChapterIndex: null,
              escalation: [],
              id,
              plotlineId: null,
              projectId: "project_1",
              purpose: "",
              startChapterIndex: null,
              status: "draft",
              title: "",
              volumePlanId:
                typeof payload.volumePlanId === "string" ? payload.volumePlanId : "volume_plan_1",
            };
            creativePath.arcPlans.push(plan);
          }
          Object.assign(plan, payload, { id, projectId: "project_1" });
          return { data: plan, id: request.id, ok: true };
        }
        case "plot.deleteArcPlan": {
          const id = request.payload.arcPlanId;
          const index = creativePath.arcPlans.findIndex((item) => item.id === id);
          if (index >= 0) {
            creativePath.arcPlans.splice(index, 1);
          }
          return { data: { arcPlanId: id, deleted: index >= 0 }, id: request.id, ok: true };
        }
        case "plot.deleteVolumePlan": {
          const id = request.payload.volumePlanId;
          const index = creativePath.volumePlans.findIndex((item) => item.id === id);
          if (index >= 0) {
            creativePath.volumePlans.splice(index, 1);
            creativePath.arcPlans.splice(
              0,
              creativePath.arcPlans.length,
              ...creativePath.arcPlans.filter((item) => item.volumePlanId !== id),
            );
          }
          return { data: { volumePlanId: id, deleted: index >= 0 }, id: request.id, ok: true };
        }
        case "plot.deleteBookPlan": {
          const id = request.payload.bookPlanId;
          const index = creativePath.bookPlans.findIndex((item) => item.id === id);
          if (index >= 0) {
            creativePath.bookPlans.splice(index, 1);
            const volumeIds = new Set(
              creativePath.volumePlans
                .filter((item) => item.bookPlanId === id)
                .map((item) => item.id),
            );
            creativePath.volumePlans.splice(
              0,
              creativePath.volumePlans.length,
              ...creativePath.volumePlans.filter((item) => item.bookPlanId !== id),
            );
            creativePath.arcPlans.splice(
              0,
              creativePath.arcPlans.length,
              ...creativePath.arcPlans.filter((item) => !volumeIds.has(item.volumePlanId)),
            );
          }
          return { data: { bookPlanId: id, deleted: index >= 0 }, id: request.id, ok: true };
        }
        case "plot.generateBookPlan": {
          creativePath.bookPlans[0].targetWordCount = request.payload.targetWordCount as number;
          return { data: creativePath.bookPlans[0], id: request.id, ok: true };
        }
        default:
          return { data: null, id: request.id, ok: true };
      }
    };
  });
});

test("book outline uses list detail workflow with modal create/edit/delete", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "作品总控台" })).toBeVisible();
  await page.getByRole("button", { name: "6. 全书大纲" }).click();

  await expect(page.getByRole("heading", { exact: true, name: "全书大纲" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "大纲层级" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "全书规划详情" })).toBeVisible();
  await expect(page.getByRole("button", { name: "查看全书规划 布衣天子全书大纲" })).toBeVisible();
  await expect(page.getByRole("button", { name: "查看卷规划 第一卷 寒门入局" })).toBeVisible();
  await expect(page.getByRole("button", { name: "查看阶段弧线 旧案破口" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "核心承诺" })).toHaveCount(0);

  const listBox = await page.locator(".book-outline-tier-list").boundingBox();
  const detailBox = await page.locator(".book-outline-detail").boundingBox();
  expect(listBox).not.toBeNull();
  expect(detailBox).not.toBeNull();
  expect(boxesOverlap(listBox!, detailBox!)).toBe(false);

  await page.getByRole("button", { name: "编辑全书规划 布衣天子全书大纲" }).click();
  const bookDialog = page.getByRole("dialog", { name: /编辑全书规划/ });
  await expect(bookDialog).toBeVisible();
  const corePromiseInput = bookDialog.getByRole("textbox", { name: "核心承诺" });
  await expect(corePromiseInput).toHaveValue("小人物每卷完成一次权力反转，并付出一次身份代价。");
  await corePromiseInput.fill("每卷一次公开胜利和一次隐藏损失。");
  await expect(corePromiseInput).toHaveValue("每卷一次公开胜利和一次隐藏损失。");
  await bookDialog.getByRole("button", { name: "保存全书规划" }).click();
  await expect(bookDialog).toBeHidden();
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

  await page.getByRole("button", { name: "新增卷 布衣天子全书大纲" }).click();
  const newVolumeDialog = page.getByRole("dialog", { name: "新建卷规划" });
  await expect(newVolumeDialog).toBeVisible();
  await newVolumeDialog.getByRole("textbox", { name: "卷标题" }).fill("第二卷 京华风雷");
  await newVolumeDialog.getByRole("spinbutton", { name: "卷序号" }).fill("2");
  await newVolumeDialog.getByRole("spinbutton", { name: "卷目标字数" }).fill("450000");
  await newVolumeDialog
    .getByRole("textbox", { name: "卷叙事任务" })
    .fill("把安全屋外部威胁推进到京城资源网络，扩大地图和利益层级。");
  await newVolumeDialog
    .getByRole("textbox", { name: "卷核心冲突" })
    .fill("进入京城后，草台班子被迫面对更高层级的财政与人情局。");
  await newVolumeDialog.getByRole("button", { name: "保存卷规划" }).click();
  await expect(newVolumeDialog).toBeHidden();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "plot.saveVolumePlan")?.payload;
      }),
    )
    .toMatchObject({
      bookPlanId: "book_plan_1",
      majorConflict: "进入京城后，草台班子被迫面对更高层级的财政与人情局。",
      projectId: "project_1",
      title: "第二卷 京华风雷",
      volumeIndex: 2,
    });

  await page.getByRole("button", { name: "编辑卷规划 第一卷 寒门入局" }).click();
  const volumeDialog = page.getByRole("dialog", { name: /编辑卷规划/ });
  await expect(volumeDialog).toBeVisible();
  const volumeConflictInput = volumeDialog.getByRole("textbox", { name: "卷核心冲突" });
  await expect(volumeConflictInput).toHaveValue("旧贵族封锁上升通道，主角必须借民案撬动权力结构。");
  await volumeConflictInput.fill("寒门新官必须用民案撬动旧贵族封锁。");
  await expect(volumeConflictInput).toHaveValue("寒门新官必须用民案撬动旧贵族封锁。");
  await volumeDialog.getByRole("button", { name: "保存卷规划" }).click();
  await expect(volumeDialog).toBeHidden();
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

  await page.getByRole("button", { name: "新增阶段弧线 第一卷 寒门入局" }).click();
  const newArcDialog = page.getByRole("dialog", { name: "新建阶段弧线" });
  await expect(newArcDialog).toBeVisible();
  await newArcDialog.getByRole("textbox", { name: "弧线标题" }).fill("身份代价");
  await newArcDialog.getByRole("spinbutton", { name: "弧线序号" }).fill("2");
  await newArcDialog
    .getByRole("textbox", { name: "弧线作用" })
    .fill("团队为了进入权力腹地，必须暴露一个不能被旧敌知道的身份。");
  await newArcDialog.getByRole("button", { name: "保存阶段弧线" }).click();
  await expect(newArcDialog).toBeHidden();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "plot.saveArcPlan")?.payload;
      }),
    )
    .toMatchObject({
      projectId: "project_1",
      title: "身份代价",
      volumePlanId: "volume_plan_1",
    });

  await page.getByRole("button", { name: "编辑阶段弧线 旧案破口" }).click();
  const arcDialog = page.getByRole("dialog", { name: /编辑阶段弧线/ });
  await expect(arcDialog).toBeVisible();
  const escalationInput = arcDialog.getByRole("textbox", { name: "升级链" });
  await expect(escalationInput).toHaveValue("旧案开场\n证人失踪\n公堂反杀");
  await escalationInput.fill("旧案开场\n证人失踪\n公堂反杀\n幕后势力露面");
  await expect(escalationInput).toHaveValue("旧案开场\n证人失踪\n公堂反杀\n幕后势力露面");
  await arcDialog.getByRole("button", { name: "保存阶段弧线" }).click();
  await expect(arcDialog).toBeHidden();
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

  await page.getByRole("button", { name: "删除阶段弧线 旧案破口" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "删除阶段弧线" });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "确认删除" }).click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "plot.deleteArcPlan")?.payload;
      }),
    )
    .toMatchObject({
      arcPlanId: "arc_plan_1",
      projectId: "project_1",
    });

  await page.getByRole("button", { name: "AI 生成全书规划" }).click();
  const generateDialog = page.getByRole("dialog", { name: "AI 生成全书规划" });
  await expect(generateDialog).toBeVisible();
  await generateDialog.getByRole("spinbutton", { name: "生成目标字数" }).fill("1800000");
  await generateDialog.getByRole("spinbutton", { name: "生成预计卷数" }).fill("4");
  await generateDialog.getByRole("button", { name: "生成全书规划" }).click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "plot.generateBookPlan")?.payload;
      }),
    )
    .toMatchObject({
      projectId: "project_1",
      targetWordCount: 1_800_000,
      volumeCount: 4,
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
