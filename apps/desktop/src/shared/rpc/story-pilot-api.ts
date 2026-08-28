import type { CommandName, CommandPayload } from "@story-pilot/contracts";

import type { RpcClient } from "./rpc-client";

export class StoryPilotApiClient {
  constructor(private readonly rpcClient: RpcClient) {}

  listRecentProjects(input: CommandPayload<"project.listRecent">) {
    return this.sendItems("project.listRecent", input);
  }

  openProject(input: CommandPayload<"project.open">) {
    return this.send("project.open", input);
  }

  getProjectOverview(input: CommandPayload<"project.getOverview">) {
    return this.send("project.getOverview", input);
  }

  backupProject(input: CommandPayload<"project.backup">) {
    return this.send("project.backup", input);
  }

  getWorkbenchSnapshot(input: CommandPayload<"workbench.getSnapshot">) {
    return this.send("workbench.getSnapshot", input);
  }

  getWorkbenchBoard(input: CommandPayload<"workbench.getBoard">) {
    return this.send("workbench.getBoard", input);
  }

  getCreativePath(input: CommandPayload<"creativeStage.getPath">) {
    return this.send("creativeStage.getPath", input);
  }

  completeCreativeStage(input: CommandPayload<"creativeStage.complete">) {
    return this.send("creativeStage.complete", input);
  }

  saveBrief(input: CommandPayload<"brief.save">) {
    return this.send("brief.save", input);
  }

  confirmBrief(input: CommandPayload<"brief.confirm">) {
    return this.send("brief.confirm", input);
  }

  generateBlueprint(input: CommandPayload<"blueprint.generate">) {
    return this.send("blueprint.generate", input);
  }

  applyBlueprint(input: CommandPayload<"blueprint.apply">) {
    return this.send("blueprint.apply", input);
  }

  generateOutline(input: CommandPayload<"outline.generate">) {
    return this.send("outline.generate", input);
  }

  approveChapterOutline(input: CommandPayload<"outline.approveChapterOutline">) {
    return this.send("outline.approveChapterOutline", input);
  }

  applyChapterOutline(input: CommandPayload<"outline.applyChapterOutline">) {
    return this.send("outline.applyChapterOutline", input);
  }

  createProject(input: CommandPayload<"project.create">) {
    return this.send("project.create", input);
  }

  createChapter(input: CommandPayload<"chapter.create">) {
    return this.send("chapter.create", input);
  }

  listChapters(input: CommandPayload<"chapter.list">) {
    return this.sendItems("chapter.list", input);
  }

  getChapter(input: CommandPayload<"chapter.get">) {
    return this.send("chapter.get", input);
  }

  saveChapterContent(input: CommandPayload<"chapter.saveContent">) {
    return this.send("chapter.saveContent", input);
  }

  listChapterVersions(input: CommandPayload<"chapter.listVersions">) {
    return this.send("chapter.listVersions", input);
  }

  restoreChapterVersion(input: CommandPayload<"chapter.restoreVersion">) {
    return this.send("chapter.restoreVersion", input);
  }

  generateChapterDraft(input: CommandPayload<"chapter.generateDraft">) {
    return this.send("chapter.generateDraft", input);
  }

  generateChapterDraftFromOutline(input: CommandPayload<"chapter.generateDraftFromOutline">) {
    return this.send("chapter.generateDraftFromOutline", input);
  }

  reviewChapterContinuity(input: CommandPayload<"chapter.reviewContinuity">) {
    return this.send("chapter.reviewContinuity", input);
  }

  getArtifact(input: CommandPayload<"artifact.get">) {
    return this.send("artifact.get", input);
  }

  applyArtifact(input: CommandPayload<"artifact.apply">) {
    return this.send("artifact.apply", input);
  }

  rejectArtifact(input: CommandPayload<"artifact.reject">) {
    return this.send("artifact.reject", input);
  }

  listMemoryCandidates(input: CommandPayload<"memory.listCandidates">) {
    return this.sendItems("memory.listCandidates", input);
  }

  confirmMemory(
    input: CommandPayload<"memory.confirm"> | Omit<CommandPayload<"memory.confirm">, "decision">,
  ) {
    return this.send("memory.confirm", {
      ...input,
      decision: "decision" in input ? input.decision : "canon",
    });
  }

  rejectMemory(input: CommandPayload<"memory.reject">) {
    return this.send("memory.reject", input);
  }

  mergeMemory(input: CommandPayload<"memory.merge">) {
    return this.send("memory.merge", input);
  }

  searchMemory(input: CommandPayload<"memory.search">) {
    return this.sendItems("memory.search", input);
  }

  getGraphNeighborhood(input: CommandPayload<"graph.getNeighborhood">) {
    return this.send("graph.getNeighborhood", input);
  }

  findGraphContradictions(input: CommandPayload<"graph.findContradictions">) {
    return this.send("graph.findContradictions", input);
  }

  rebuildGraph(input: CommandPayload<"graph.rebuild">) {
    return this.send("graph.rebuild", input);
  }

  listWorkOrders(input: CommandPayload<"workOrder.list">) {
    return this.sendItems("workOrder.list", input);
  }

  getWorkOrder(input: CommandPayload<"workOrder.get">) {
    return this.send("workOrder.get", input);
  }

  runWorkflow(input: CommandPayload<"workflow.run">) {
    return this.send("workflow.run", input);
  }

  cancelWorkflow(input: CommandPayload<"workflow.cancel">) {
    return this.send("workflow.cancel", input);
  }

  retryWorkflow(input: CommandPayload<"workflow.retry">) {
    return this.send("workflow.retry", input);
  }

  listCharacters(input: CommandPayload<"character.list">) {
    return this.sendItems("character.list", input);
  }

  createCharacter(input: CommandPayload<"character.create">) {
    return this.send("character.create", input);
  }

  updateCharacter(input: CommandPayload<"character.update">) {
    return this.send("character.update", input);
  }

  generateCharacterNames(input: CommandPayload<"character.generateNames">) {
    return this.send("character.generateNames", input);
  }

  generateElementCandidates(input: CommandPayload<"element.generateCandidates">) {
    return this.send("element.generateCandidates", input);
  }

  acceptElementCandidates(input: CommandPayload<"element.acceptCandidates">) {
    return this.send("element.acceptCandidates", input);
  }

  listWorldRules(input: CommandPayload<"worldRule.list">) {
    return this.sendItems("worldRule.list", input);
  }

  createWorldRule(input: CommandPayload<"worldRule.create">) {
    return this.send("worldRule.create", input);
  }

  updateWorldRule(input: CommandPayload<"worldRule.update">) {
    return this.send("worldRule.update", input);
  }

  listPlotlines(input: CommandPayload<"plotline.list">) {
    return this.sendItems("plotline.list", input);
  }

  createPlotline(input: CommandPayload<"plotline.create">) {
    return this.send("plotline.create", input);
  }

  updatePlotlineNode(input: CommandPayload<"plotline.updateNode">) {
    return this.send("plotline.updateNode", input);
  }

  listStoryEvents(input: CommandPayload<"storyEvent.list">) {
    return this.sendItems("storyEvent.list", input);
  }

  createStoryEvent(input: CommandPayload<"storyEvent.create">) {
    return this.send("storyEvent.create", input);
  }

  listForeshadowings(input: CommandPayload<"foreshadowing.list">) {
    return this.sendItems("foreshadowing.list", input);
  }

  createForeshadowing(input: CommandPayload<"foreshadowing.create">) {
    return this.send("foreshadowing.create", input);
  }

  planForeshadowing(input: CommandPayload<"foreshadowing.plan">) {
    return this.send("foreshadowing.plan", input);
  }

  private async send<TCommand extends CommandName>(
    command: TCommand,
    payload: CommandPayload<TCommand>,
  ): Promise<unknown> {
    const response = await this.rpcClient.send(command, payload);
    if (!response.ok) {
      throw new Error(response.error.message);
    }

    return response.data;
  }

  private async sendItems<TCommand extends CommandName>(
    command: TCommand,
    payload: CommandPayload<TCommand>,
  ): Promise<readonly unknown[]> {
    const data = await this.send(command, payload);
    if (Array.isArray(data)) {
      return data;
    }
    if (isListResponse(data)) {
      return data.items;
    }

    throw new Error(`Invalid list response for ${command}`);
  }
}

function isListResponse(data: unknown): data is { readonly items: readonly unknown[] } {
  return typeof data === "object" && data !== null && "items" in data && Array.isArray(data.items);
}
