import { Injectable } from "@nestjs/common";
import {
  type CommandPayload,
  createRpcError,
  createRpcSuccess,
  parseCommandPayload,
  parseRpcRequest,
  type RpcRequest,
  type RpcResponse,
  type StoryPilotErrorCode,
} from "@story-pilot/contracts";
import { ZodError } from "zod";

import { ArtifactService, type ApplyArtifactInput } from "../artifact/artifact.service.js";
import { CharacterService, type CreateCharacterInput } from "../character/character.service.js";
import {
  ChapterService,
  type CreateChapterInput,
  type GenerateChapterDraftInput,
} from "../chapter/chapter.service.js";
import { GraphService } from "../graph/graph.service.js";
import { HealthService } from "../health/health.service.js";
import { MemoryService } from "../memory/memory.service.js";
import { ForeshadowingService, type CreateForeshadowingInput } from "../plot/foreshadowing.service.js";
import { PlotlineService, type CreatePlotlineInput } from "../plot/plotline.service.js";
import { StoryEventService, type CreateStoryEventInput } from "../plot/story-event.service.js";
import { ProjectService, type CreateProjectInput } from "../project/project.service.js";
import { WorkflowService, type RunWorkflowInput } from "../workflow/workflow.service.js";
import { WorldRuleService } from "../world/world-rule.service.js";

@Injectable()
export class RpcService {
  constructor(
    private readonly artifactService: ArtifactService,
    private readonly characterService: CharacterService,
    private readonly chapterService: ChapterService,
    private readonly foreshadowingService: ForeshadowingService,
    private readonly graphService: GraphService,
    private readonly healthService: HealthService,
    private readonly memoryService: MemoryService,
    private readonly plotlineService: PlotlineService,
    private readonly projectService: ProjectService,
    private readonly storyEventService: StoryEventService,
    private readonly workflowService: WorkflowService,
    private readonly worldRuleService: WorldRuleService,
  ) {}

  async handle(input: unknown): Promise<RpcResponse> {
    let request: RpcRequest;

    try {
      request = parseRpcRequest(input);
    } catch (error) {
      return createRpcError("unknown", "VALIDATION_FAILED", "RPC request validation failed", error);
    }

    if (request.command === "app.health") {
      return createRpcSuccess(request.id, this.healthService.getHealth());
    }

    let payload: unknown;
    try {
      payload = parseCommandPayload(request.command, request.payload);
    } catch (error) {
      if (getPayloadErrorCode(error) === "UNKNOWN_COMMAND") {
        return createRpcError(request.id, "UNKNOWN_COMMAND", `Unsupported command: ${request.command}`);
      }
      return createRpcError(request.id, getPayloadErrorCode(error), "RPC payload validation failed", serializeError(error));
    }

    try {
      return createRpcSuccess(request.id, await this.dispatch(request.command, payload));
    } catch (error) {
      return createRpcError(
        request.id,
        mapServiceErrorCode(error),
        error instanceof Error ? error.message : String(error),
        serializeError(error),
      );
    }
  }

  private async dispatch(command: string, payload: unknown): Promise<unknown> {
    switch (command) {
      case "project.create": {
        const parsed = payload as CommandPayload<"project.create">;
        const input: CreateProjectInput = {
          title: parsed.title,
          ...(parsed.genre === undefined ? {} : { genre: parsed.genre }),
          ...(parsed.logline === undefined ? {} : { logline: parsed.logline }),
          ...(parsed.wordCountGoal === undefined ? {} : { wordCountGoal: parsed.wordCountGoal }),
        };
        return this.projectService.createProject(input);
      }
      case "chapter.create": {
        const parsed = payload as CommandPayload<"chapter.create">;
        const input: CreateChapterInput = {
          projectId: parsed.projectId,
          title: parsed.title,
          volumeId: parsed.volumeId,
          ...(parsed.sortOrder === undefined ? {} : { sortOrder: parsed.sortOrder }),
          ...(parsed.summary === undefined ? {} : { summary: parsed.summary }),
        };
        return this.chapterService.createChapter(input);
      }
      case "chapter.get": {
        const parsed = payload as CommandPayload<"chapter.get">;
        return this.chapterService.getChapter(parsed.projectId, parsed.chapterId);
      }
      case "chapter.saveContent": {
        return this.chapterService.saveContent(payload as CommandPayload<"chapter.saveContent">);
      }
      case "chapter.listVersions": {
        return this.chapterService.listVersions(payload as CommandPayload<"chapter.listVersions">);
      }
      case "chapter.generateDraft": {
        const parsed = payload as CommandPayload<"chapter.generateDraft">;
        const input: GenerateChapterDraftInput = {
          chapterId: parsed.chapterId,
          projectId: parsed.projectId,
          ...(parsed.instruction === undefined ? {} : { instruction: parsed.instruction }),
        };
        return this.chapterService.generateDraft(input);
      }
      case "artifact.apply": {
        const parsed = payload as CommandPayload<"artifact.apply">;
        const input: ApplyArtifactInput = {
          applyMode: parsed.applyMode,
          artifactId: parsed.artifactId,
          projectId: parsed.projectId,
          ...(parsed.targetVersion === undefined ? {} : { targetVersion: parsed.targetVersion }),
        };
        return this.artifactService.applyArtifact(input);
      }
      case "memory.listCandidates": {
        const parsed = payload as CommandPayload<"memory.listCandidates">;
        return this.memoryService.listCandidates({
          projectId: parsed.projectId,
          ...(parsed.status === undefined ? {} : { status: parsed.status }),
        });
      }
      case "memory.confirm": {
        const parsed = payload as CommandPayload<"memory.confirm">;
        if (parsed.decision === "reject") {
          return this.memoryService.reject(parsed);
        }
        if (parsed.decision === "merge") {
          if (!parsed.mergeTargetMemoryId) {
            throw new Error("MEMORY_MERGE_TARGET_REQUIRED");
          }
          return this.memoryService.merge({
            candidateId: parsed.candidateId,
            projectId: parsed.projectId,
            targetMemoryId: parsed.mergeTargetMemoryId,
            ...(parsed.editedStatement === undefined ? {} : { editedStatement: parsed.editedStatement }),
          });
        }

        return this.memoryService.confirm({
          candidateId: parsed.candidateId,
          decision: parsed.decision,
          projectId: parsed.projectId,
          ...(parsed.editedStatement === undefined ? {} : { editedStatement: parsed.editedStatement }),
        });
      }
      case "memory.reject": {
        return this.memoryService.reject(payload as CommandPayload<"memory.reject">);
      }
      case "memory.merge": {
        const parsed = payload as CommandPayload<"memory.merge">;
        return this.memoryService.merge({
          candidateId: parsed.candidateId,
          projectId: parsed.projectId,
          targetMemoryId: parsed.targetMemoryId,
        });
      }
      case "graph.getNeighborhood": {
        const parsed = payload as CommandPayload<"graph.getNeighborhood">;
        return this.graphService.getNeighborhood({
          entityId: parsed.nodeId,
          projectId: parsed.projectId,
        });
      }
      case "graph.rebuild": {
        const parsed = payload as CommandPayload<"graph.rebuild">;
        return this.graphService.rebuild(parsed.projectId);
      }
      case "workflow.cancel": {
        return this.workflowService.cancel(payload as CommandPayload<"workflow.cancel">);
      }
      case "workflow.run": {
        const parsed = payload as CommandPayload<"workflow.run">;
        if (parsed.workflowType === "chapter_draft" && parsed.targetType === "chapter" && parsed.targetId) {
          const instruction = getString(parsed.input.instruction);
          const input: GenerateChapterDraftInput = {
            chapterId: parsed.targetId,
            projectId: parsed.projectId,
            ...(instruction === undefined ? {} : { instruction }),
          };
          return this.chapterService.generateDraft({
            ...input,
          });
        }

        const input: RunWorkflowInput = {
          input: parsed.input,
          projectId: parsed.projectId,
          targetType: parsed.targetType,
          workflowType: parsed.workflowType,
          ...(parsed.targetId === undefined ? {} : { targetId: parsed.targetId }),
        };
        return this.workflowService.run(input);
      }
      case "character.create": {
        const parsed = payload as CommandPayload<"character.create">;
        const input: CreateCharacterInput = {
          name: parsed.name,
          projectId: parsed.projectId,
          role: parsed.role,
          ...(parsed.archetype === undefined ? {} : { archetype: parsed.archetype }),
          ...(parsed.biography === undefined ? {} : { biography: parsed.biography }),
          ...(parsed.flaw === undefined ? {} : { flaw: parsed.flaw }),
          ...(parsed.goal === undefined ? {} : { goal: parsed.goal }),
          ...(parsed.need === undefined ? {} : { need: parsed.need }),
          ...(parsed.secret === undefined ? {} : { secret: parsed.secret }),
          ...(parsed.voiceProfile === undefined ? {} : { voiceProfile: parsed.voiceProfile }),
        };
        return this.characterService.createCharacter(input);
      }
      case "worldRule.create": {
        return this.worldRuleService.createWorldRule(payload as CommandPayload<"worldRule.create">);
      }
      case "plotline.create": {
        const parsed = payload as CommandPayload<"plotline.create">;
        const input: CreatePlotlineInput = {
          kind: parsed.kind,
          priority: parsed.priority,
          projectId: parsed.projectId,
          title: parsed.title,
          ...(parsed.summary === undefined ? {} : { summary: parsed.summary }),
        };
        return this.plotlineService.createPlotline(input);
      }
      case "storyEvent.create": {
        const parsed = payload as CommandPayload<"storyEvent.create">;
        const input: CreateStoryEventInput = {
          description: parsed.description,
          eventType: parsed.eventType,
          participants: parsed.participants,
          projectId: parsed.projectId,
          title: parsed.title,
          ...(parsed.chapterId === undefined ? {} : { chapterId: parsed.chapterId }),
          ...(parsed.sceneId === undefined ? {} : { sceneId: parsed.sceneId }),
          ...(parsed.storyTime === undefined ? {} : { storyTime: parsed.storyTime }),
        };
        return this.storyEventService.createStoryEvent(input);
      }
      case "foreshadowing.create": {
        const parsed = payload as CommandPayload<"foreshadowing.create">;
        const input: CreateForeshadowingInput = {
          description: parsed.description,
          projectId: parsed.projectId,
          title: parsed.title,
          ...(parsed.payoffEventId === undefined ? {} : { payoffEventId: parsed.payoffEventId }),
          ...(parsed.payoffExpectation === undefined ? {} : { payoffExpectation: parsed.payoffExpectation }),
          ...(parsed.seedEventId === undefined ? {} : { seedEventId: parsed.seedEventId }),
        };
        return this.foreshadowingService.createForeshadowing(input);
      }
      default:
        throw new Error(`UNKNOWN_COMMAND: ${command}`);
    }
  }
}

function getPayloadErrorCode(error: unknown): StoryPilotErrorCode {
  return error instanceof Error && error.message.startsWith("UNKNOWN_COMMAND")
    ? "UNKNOWN_COMMAND"
    : "VALIDATION_FAILED";
}

function mapServiceErrorCode(error: unknown): StoryPilotErrorCode {
  if (error instanceof ZodError) {
    return "MODEL_OUTPUT_PARSE_FAILED";
  }
  if (!(error instanceof Error)) {
    return "APP_BACKEND_UNAVAILABLE";
  }
  if (error.message.startsWith("UNKNOWN_COMMAND")) {
    return "UNKNOWN_COMMAND";
  }
  if (error.message.startsWith("CHAPTER_VERSION_CONFLICT")) {
    return "CHAPTER_VERSION_CONFLICT";
  }
  if (error.message.includes("GRAPH") || error.message.includes("KUZU")) {
    return "GRAPH_UNAVAILABLE";
  }
  if (error.message.includes("MODEL") || error.message.includes("FAKE_MODEL")) {
    return "MODEL_PROVIDER_NOT_CONFIGURED";
  }

  return "APP_BACKEND_UNAVAILABLE";
}

function serializeError(error: unknown): unknown {
  if (error instanceof ZodError) {
    return { issues: error.issues };
  }
  if (error instanceof Error) {
    return { message: error.message, name: error.name };
  }

  return error;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
