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
    const chapters = [
      {
        content: "",
        id: "chapter_3",
        title: "第三章 公堂前夜",
        version: 0,
      },
    ];
    const characters = [
      {
        id: "character_qinyu",
        name: "秦钰",
        role: "protagonist",
      },
    ];
    const storyEvents: Array<Record<string, unknown> & { id: string; title: string }> = [
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
    const foreshadowings: Array<Record<string, unknown> & { id: string; title: string }> = [
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
              characters,
              foreshadowings,
              items: [],
              locations: [],
              memoryCandidates: [],
              organizations: [],
              plotlines: [],
              project,
              storyEvents,
              workOrders: [],
              worldRules: [],
            },
            id: request.id,
            ok: true,
          };
        case "storyEvent.update": {
          const payload = request.payload as {
            patch: Record<string, unknown>;
            storyEventId: string;
          };
          const target = storyEvents.find((event) => event.id === payload.storyEventId);
          if (target) {
            Object.assign(target, payload.patch);
            if (typeof payload.patch.description === "string") {
              target.summary = payload.patch.description;
            }
          }
          return { data: target ?? null, id: request.id, ok: true };
        }
        case "foreshadowing.update": {
          const payload = request.payload as {
            foreshadowingId: string;
            patch: Record<string, unknown>;
          };
          const target = foreshadowings.find(
            (foreshadowing) => foreshadowing.id === payload.foreshadowingId,
          );
          if (target) {
            Object.assign(target, payload.patch);
            if (typeof payload.patch.description === "string") {
              target.seedText = payload.patch.description;
            }
            if (typeof payload.patch.payoffExpectation === "string") {
              target.payoffText = payload.patch.payoffExpectation;
            }
          }
          return { data: target ?? null, id: request.id, ok: true };
        }
        default:
          return { data: null, id: request.id, ok: true };
      }
    };
  });
});

test("plot node design uses stable editing forms and persists event and foreshadowing changes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "作品总控台" })).toBeVisible();
  await page.getByRole("button", { name: "7. 剧情节点" }).click();

  await expect(page.getByRole("heading", { name: "剧情节点设计" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "剧情节点档案" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "伏笔 / 回收档案" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI 回收辅助" })).toBeVisible();

  const listBox = await page.locator(".plot-node-design-list").boundingBox();
  const eventEditorBox = await page.locator(".plot-node-event-editor").boundingBox();
  const foreshadowingEditorBox = await page
    .locator(".plot-node-foreshadowing-editor")
    .boundingBox();
  const assistantBox = await page.locator(".plot-node-design-assistant").boundingBox();
  expect(listBox).not.toBeNull();
  expect(eventEditorBox).not.toBeNull();
  expect(foreshadowingEditorBox).not.toBeNull();
  expect(assistantBox).not.toBeNull();
  expect(boxesOverlap(listBox!, eventEditorBox!)).toBe(false);
  expect(boxesOverlap(listBox!, foreshadowingEditorBox!)).toBe(false);
  expect(boxesOverlap(eventEditorBox!, assistantBox!)).toBe(false);
  expect(boxesOverlap(foreshadowingEditorBox!, assistantBox!)).toBe(false);

  await page.getByRole("button", { name: "编辑剧情节点 旧信出现" }).click();
  const eventTitleInput = page.getByRole("textbox", { name: "节点标题" });
  const eventStoryTimeInput = page.getByRole("textbox", { name: "故事时间" });
  const eventDescriptionInput = page.getByRole("textbox", { name: "节点描述" });
  await expect(eventTitleInput).toHaveValue("旧信出现");
  await eventTitleInput.fill("水印来源暴露");
  await eventStoryTimeInput.fill("第 3 章公堂前");
  await eventDescriptionInput.fill("秦钰确认旧信水印来自官府档案纸。");
  await expect(eventTitleInput).toHaveValue("水印来源暴露");
  await expect(eventStoryTimeInput).toHaveValue("第 3 章公堂前");
  await expect(eventDescriptionInput).toHaveValue("秦钰确认旧信水印来自官府档案纸。");
  await page.getByRole("button", { name: "保存剧情节点" }).click();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "storyEvent.update")?.payload;
      }),
    )
    .toMatchObject({
      patch: {
        description: "秦钰确认旧信水印来自官府档案纸。",
        storyTime: "第 3 章公堂前",
        title: "水印来源暴露",
      },
      projectId: "project_1",
      storyEventId: "event_seed",
    });

  await page.getByRole("button", { name: "编辑伏笔 信纸水印" }).click();
  const foreshadowingDescriptionInput = page.getByRole("textbox", { name: "伏笔内容" });
  const foreshadowingPayoffInput = page.getByRole("textbox", { name: "回收方案" });
  await expect(foreshadowingDescriptionInput).toHaveValue("信纸水印第一次出现，暂不解释来源。");
  await foreshadowingDescriptionInput.fill("水印像是普通纸纹，实则是官府档案纸暗纹。");
  await foreshadowingPayoffInput.fill("第 20 章揭示水印证明档案调包。");
  await expect(foreshadowingDescriptionInput).toHaveValue(
    "水印像是普通纸纹，实则是官府档案纸暗纹。",
  );
  await expect(foreshadowingPayoffInput).toHaveValue("第 20 章揭示水印证明档案调包。");
  await page.getByRole("button", { name: "保存伏笔" }).click();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "foreshadowing.update")?.payload;
      }),
    )
    .toMatchObject({
      foreshadowingId: "foreshadowing_1",
      patch: {
        description: "水印像是普通纸纹，实则是官府档案纸暗纹。",
        payoffExpectation: "第 20 章揭示水印证明档案调包。",
      },
      projectId: "project_1",
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
