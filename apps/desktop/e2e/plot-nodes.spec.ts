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
        case "storyEvent.create": {
          const payload = request.payload as Record<string, unknown>;
          const target = {
            chapterId: payload.chapterId ?? null,
            eventType: payload.eventType ?? "discovery",
            id: `event_${storyEvents.length + 1}`,
            participants: payload.participants ?? [],
            sceneId: null,
            status: payload.status ?? "draft",
            storyTime: payload.storyTime ?? null,
            summary: payload.description ?? "",
            title: payload.title ?? "未命名节点",
          };
          storyEvents.push(target);
          return { data: target, id: request.id, ok: true };
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
        case "foreshadowing.plan":
          return { data: null, id: request.id, ok: true };
        default:
          return { data: null, id: request.id, ok: true };
      }
    };
  });
});

test("plot node design uses list detail workflow with modal create/edit and AI planning", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "作品总控台" })).toBeVisible();
  await page.getByRole("button", { name: "7. 剧情节点" }).click();

  await expect(page.getByRole("heading", { name: "剧情节点设计" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "节点与伏笔" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "剧情节点详情" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建剧情节点" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建伏笔" })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 规划回收" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "节点标题" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "伏笔标题" })).toHaveCount(0);

  const listBox = await page.locator(".plot-node-design-list").boundingBox();
  const detailBox = await page.locator(".plot-node-design-detail").boundingBox();
  expect(listBox).not.toBeNull();
  expect(detailBox).not.toBeNull();
  expect(boxesOverlap(listBox!, detailBox!)).toBe(false);

  await page.getByRole("button", { name: "新建剧情节点" }).click();
  let dialog = page.getByRole("dialog", { name: "新建剧情节点" });
  await expect(dialog.getByRole("textbox", { name: "节点标题" })).toBeVisible();
  await dialog.getByRole("textbox", { name: "节点标题" }).fill("公堂试探");
  await dialog.getByRole("textbox", { name: "节点描述" }).fill("秦钰用旧信逼出第一处证词破绽。");
  await dialog.getByRole("button", { name: "创建剧情节点" }).click();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "storyEvent.create")?.payload;
      }),
    )
    .toMatchObject({
      description: "秦钰用旧信逼出第一处证词破绽。",
      projectId: "project_1",
      title: "公堂试探",
    });

  await page.getByRole("button", { name: "查看剧情节点 旧信出现" }).click();
  await expect(page.getByRole("heading", { name: "剧情节点详情" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "剧情节点详情面板" }).getByText("秦钰收到带水印的旧信。"),
  ).toBeVisible();

  await page.getByRole("button", { name: "编辑剧情节点 旧信出现" }).click();
  dialog = page.getByRole("dialog", { name: "编辑剧情节点：旧信出现" });
  const eventTitleInput = dialog.getByRole("textbox", { name: "节点标题" });
  const eventStoryTimeInput = dialog.getByRole("textbox", { name: "故事时间" });
  const eventDescriptionInput = dialog.getByRole("textbox", { name: "节点描述" });
  await expect(eventTitleInput).toHaveValue("旧信出现");
  await eventTitleInput.fill("水印来源暴露");
  await eventStoryTimeInput.fill("第 3 章公堂前");
  await eventDescriptionInput.fill("秦钰确认旧信水印来自官府档案纸。");
  await expect(eventTitleInput).toHaveValue("水印来源暴露");
  await expect(eventStoryTimeInput).toHaveValue("第 3 章公堂前");
  await expect(eventDescriptionInput).toHaveValue("秦钰确认旧信水印来自官府档案纸。");
  await dialog.getByRole("button", { name: "保存剧情节点" }).click();

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

  await page.getByRole("button", { name: "查看伏笔 信纸水印" }).click();
  await expect(page.getByRole("heading", { name: "伏笔详情" })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "剧情节点详情面板" })
      .getByText("信纸水印第一次出现，暂不解释来源。"),
  ).toBeVisible();

  await page.getByRole("button", { name: "编辑伏笔 信纸水印" }).click();
  dialog = page.getByRole("dialog", { name: "编辑伏笔：信纸水印" });
  const foreshadowingDescriptionInput = dialog.getByRole("textbox", { name: "伏笔内容" });
  const foreshadowingPayoffInput = dialog.getByRole("textbox", { name: "回收方案" });
  await expect(foreshadowingDescriptionInput).toHaveValue("信纸水印第一次出现，暂不解释来源。");
  await foreshadowingDescriptionInput.fill("水印像是普通纸纹，实则是官府档案纸暗纹。");
  await foreshadowingPayoffInput.fill("第 20 章揭示水印证明档案调包。");
  await expect(foreshadowingDescriptionInput).toHaveValue(
    "水印像是普通纸纹，实则是官府档案纸暗纹。",
  );
  await expect(foreshadowingPayoffInput).toHaveValue("第 20 章揭示水印证明档案调包。");
  await dialog.getByRole("button", { name: "保存伏笔" }).click();

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

  await page.getByRole("button", { name: "AI 规划回收" }).click();
  dialog = page.getByRole("dialog", { name: "AI 规划回收" });
  await dialog.getByRole("button", { name: "生成伏笔回收方案" }).click();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "foreshadowing.plan")?.payload;
      }),
    )
    .toMatchObject({
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
