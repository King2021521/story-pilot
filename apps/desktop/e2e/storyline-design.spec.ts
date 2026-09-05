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
      genre: "悬疑",
      id: "project_1",
      status: "planning",
      style: "悬疑推理",
      title: "布衣天子",
      workId: "work_1",
    };
    const plotlines: Array<
      Record<string, unknown> & {
        id: string;
        name: string;
        nodes: Array<Record<string, unknown>>;
      }
    > = [
      {
        centralQuestion: "旧案真凶是谁？",
        driver: "每三章投放一条线索。",
        emotionalPromise: "持续悬疑和真相逼近。",
        id: "plotline_1",
        importance: "core",
        name: "旧案主线",
        narrativeRole: "main_drive",
        nodes: [],
        payoffPlan: "卷末揭露旧案真相。",
        priority: 10,
        relatedCharacterIds: [],
        relatedForeshadowingIds: [],
        relatedStoryEventIds: [],
        relatedWorldRuleIds: [],
        startState: "主角收到旧信。",
        status: "planning",
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
              characters: [],
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
        case "plotline.update": {
          const payload = request.payload as {
            patch: Record<string, unknown>;
            plotlineId: string;
          };
          const target = plotlines.find((plotline) => plotline.id === payload.plotlineId);
          if (target) {
            Object.assign(target, payload.patch);
            if (typeof payload.patch.title === "string") {
              target.name = payload.patch.title;
            }
          }
          return { data: target ?? null, id: request.id, ok: true };
        }
        case "plotline.create": {
          const payload = request.payload as {
            title: string;
          } & Record<string, unknown>;
          const plotline = {
            ...payload,
            id: "plotline_created",
            name: payload.title,
            nodes: [],
            type: payload.kind,
          };
          plotlines.push(plotline);
          return { data: plotline, id: request.id, ok: true };
        }
        case "plotline.delete": {
          const payload = request.payload as { plotlineId: string };
          const index = plotlines.findIndex((plotline) => plotline.id === payload.plotlineId);
          if (index >= 0) {
            plotlines.splice(index, 1);
          }
          return { data: { plotlineId: payload.plotlineId }, id: request.id, ok: true };
        }
        case "plotline.createNode": {
          const payload = request.payload as {
            plotlineId: string;
            title: string;
          };
          const node = { ...payload, id: "plotline_node_1" };
          const target = plotlines.find((plotline) => plotline.id === payload.plotlineId);
          if (target) {
            target.nodes = [...target.nodes, node];
          }
          return { data: node, id: request.id, ok: true };
        }
        default:
          return { data: null, id: request.id, ok: true };
      }
    };
  });
});

test("storyline design uses list-first dialogs and persists actions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "作品总控台" })).toBeVisible();
  await page.getByRole("button", { name: "5. 故事线设计" }).click();

  await expect(page.getByRole("heading", { name: "故事线设计" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "故事线列表" })).toBeVisible();
  await expect(page.getByRole("region", { name: "故事线档案表单" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "新建故事线" })).toBeVisible();

  await page.getByRole("button", { name: "编辑故事线 旧案主线" }).click();
  const editDialog = page.getByRole("dialog", { name: "编辑故事线：旧案主线" });
  await expect(editDialog).toBeVisible();
  await editDialog.getByLabel("核心问题").fill("旧案真凶是否还在操控旧城？");
  await editDialog.getByLabel("推进机制").fill("每三章投放一条硬线索，并安排一次误导。");
  await editDialog.getByLabel("回收方式").fill("第 20 章揭示寄信人身份，并回收旧案证据。");
  await editDialog.getByRole("button", { name: "保存修改" }).click();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "plotline.update")?.payload;
      }),
    )
    .toMatchObject({
      patch: {
        centralQuestion: "旧案真凶是否还在操控旧城？",
        driver: "每三章投放一条硬线索，并安排一次误导。",
        payoffPlan: "第 20 章揭示寄信人身份，并回收旧案证据。",
      },
      plotlineId: "plotline_1",
      projectId: "project_1",
    });
  await expect(editDialog).toHaveCount(0);

  await page.getByRole("button", { name: "添加节点 旧案主线" }).click();
  const nodeDialog = page.getByRole("dialog", { name: "添加故事线节点：旧案主线" });
  await expect(nodeDialog).toBeVisible();
  const nodeTitleInput = nodeDialog.getByRole("textbox", { name: "节点标题" });
  const nodeChapterHintInput = nodeDialog.getByRole("textbox", { name: "章节提示" });
  const nodeDescriptionInput = nodeDialog.getByRole("textbox", { name: "节点说明" });
  await expect(nodeTitleInput).toHaveValue("");
  await nodeTitleInput.fill("信纸水印出现");
  await nodeChapterHintInput.fill("第 3 章");
  await nodeDescriptionInput.fill("让读者看到水印，但暂时不解释来源。");
  await expect(nodeTitleInput).toHaveValue("信纸水印出现");
  await expect(nodeChapterHintInput).toHaveValue("第 3 章");
  await expect(nodeDescriptionInput).toHaveValue("让读者看到水印，但暂时不解释来源。");
  await nodeDialog.getByRole("button", { name: "添加节点" }).click();

  await expect(page.getByText("信纸水印出现")).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "plotline.createNode")?.payload;
      }),
    )
    .toMatchObject({
      chapterHint: "第 3 章",
      description: "让读者看到水印，但暂时不解释来源。",
      kind: "seed",
      plotlineId: "plotline_1",
      projectId: "project_1",
      status: "planned",
      title: "信纸水印出现",
    });

  await page.getByRole("button", { name: "新建故事线" }).click();
  const createDialog = page.getByRole("dialog", { name: "新建故事线" });
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel("故事线名称").fill("证人保护线");
  await createDialog.getByLabel("故事线摘要").fill("围绕证人藏身与转移展开。");
  await createDialog.getByLabel("核心问题").fill("证人能否活到公开作证？");
  await createDialog.getByLabel("推进机制").fill("通过追杀、转移、误导和背叛持续升级。");
  await createDialog.getByLabel("情绪承诺").fill("高压追逃和阶段性反转。");
  await createDialog.getByRole("button", { name: "创建故事线" }).click();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "plotline.create")?.payload;
      }),
    )
    .toMatchObject({
      centralQuestion: "证人能否活到公开作证？",
      driver: "通过追杀、转移、误导和背叛持续升级。",
      emotionalPromise: "高压追逃和阶段性反转。",
      projectId: "project_1",
      summary: "围绕证人藏身与转移展开。",
      title: "证人保护线",
    });

  await page.getByRole("button", { name: "删除故事线 旧案主线" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "删除故事线" });
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog.getByText("删除后会从当前作品的故事线列表中移除。")).toBeVisible();
  await deleteDialog.getByRole("button", { name: "确认删除" }).click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const requests = window.__STORY_PILOT_E2E_REQUESTS__ ?? [];
        return requests.findLast((request) => request.command === "plotline.delete")?.payload;
      }),
    )
    .toMatchObject({
      plotlineId: "plotline_1",
      projectId: "project_1",
    });
});
