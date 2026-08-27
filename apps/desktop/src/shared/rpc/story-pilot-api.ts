import type { CommandName, CommandPayload } from "@story-pilot/contracts";

import type { RpcClient } from "./rpc-client";

export class StoryPilotApiClient {
  constructor(private readonly rpcClient: RpcClient) {}

  listRecentProjects(input: CommandPayload<"project.listRecent">) {
    return this.send("project.listRecent", input);
  }

  openProject(input: CommandPayload<"project.open">) {
    return this.send("project.open", input);
  }

  getWorkbenchBoard(input: CommandPayload<"workbench.getBoard">) {
    return this.send("workbench.getBoard", input);
  }

  createProject(input: CommandPayload<"project.create">) {
    return this.send("project.create", input);
  }

  createChapter(input: CommandPayload<"chapter.create">) {
    return this.send("chapter.create", input);
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

  applyArtifact(input: CommandPayload<"artifact.apply">) {
    return this.send("artifact.apply", input);
  }

  rejectArtifact(input: CommandPayload<"artifact.reject">) {
    return this.send("artifact.reject", input);
  }

  confirmMemory(input: Omit<CommandPayload<"memory.confirm">, "decision">) {
    return this.send("memory.confirm", {
      ...input,
      decision: "canon",
    });
  }

  rejectMemory(input: CommandPayload<"memory.reject">) {
    return this.send("memory.reject", input);
  }

  createCharacter(input: CommandPayload<"character.create">) {
    return this.send("character.create", input);
  }

  createWorldRule(input: CommandPayload<"worldRule.create">) {
    return this.send("worldRule.create", input);
  }

  createPlotline(input: CommandPayload<"plotline.create">) {
    return this.send("plotline.create", input);
  }

  createForeshadowing(input: CommandPayload<"foreshadowing.create">) {
    return this.send("foreshadowing.create", input);
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
}
