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
import { AiCommandService } from "../ai-command/ai-command.service.js";
import { CharacterService, type CreateCharacterInput } from "../character/character.service.js";
import {
  ChapterService,
  type CreateChapterInput,
  type GenerateChapterDraftInput,
  type GenerateChapterDraftFromPlanInput,
} from "../chapter/chapter.service.js";
import { ChapterExecutionCardService } from "../chapter/chapter-execution-card.service.js";
import { ContextPackageService } from "../context-package/context-package.service.js";
import { ElementCandidateService } from "../creative/element-candidate.service.js";
import { CreativePathService } from "../creative-path/creative-path.service.js";
import { DiagnosticsService } from "../diagnostics/diagnostics.service.js";
import { GraphService } from "../graph/graph.service.js";
import { HealthService } from "../health/health.service.js";
import { MemoryService } from "../memory/memory.service.js";
import { OutlineService } from "../outline/outline.service.js";
import { ConflictService } from "../plot/conflict.service.js";
import { EventRelationService } from "../plot/event-relation.service.js";
import {
  ForeshadowingService,
  type CreateForeshadowingInput,
} from "../plot/foreshadowing.service.js";
import { LongformPlanService } from "../plot/longform-plan.service.js";
import { PlotlineService, type CreatePlotlineInput } from "../plot/plotline.service.js";
import { StoryEventService, type CreateStoryEventInput } from "../plot/story-event.service.js";
import { ProjectService, type CreateProjectInput } from "../project/project.service.js";
import { ChapterReviewService } from "../review/chapter-review.service.js";
import { SerialReviewService } from "../review/serial-review.service.js";
import { SettingsService } from "../settings/settings.service.js";
import { SerialStateService } from "../serial-state/serial-state.service.js";
import { WorkflowService, type RunWorkflowInput } from "../workflow/workflow.service.js";
import { WorkbenchService } from "../workbench/workbench.service.js";
import { WorldbuildingService } from "../world/worldbuilding.service.js";
import { WorldRuleService } from "../world/world-rule.service.js";

@Injectable()
export class RpcService {
  constructor(
    private readonly artifactService: ArtifactService,
    private readonly aiCommandService: AiCommandService,
    private readonly characterService: CharacterService,
    private readonly chapterExecutionCardService: ChapterExecutionCardService,
    private readonly chapterService: ChapterService,
    private readonly contextPackageService: ContextPackageService,
    private readonly conflictService: ConflictService,
    private readonly creativePathService: CreativePathService,
    private readonly diagnosticsService: DiagnosticsService,
    private readonly elementCandidateService: ElementCandidateService,
    private readonly eventRelationService: EventRelationService,
    private readonly foreshadowingService: ForeshadowingService,
    private readonly graphService: GraphService,
    private readonly healthService: HealthService,
    private readonly memoryService: MemoryService,
    private readonly outlineService: OutlineService,
    private readonly plotlineService: PlotlineService,
    private readonly longformPlanService: LongformPlanService,
    private readonly projectService: ProjectService,
    private readonly chapterReviewService: ChapterReviewService,
    private readonly serialReviewService: SerialReviewService,
    private readonly settingsService: SettingsService,
    private readonly serialStateService: SerialStateService,
    private readonly storyEventService: StoryEventService,
    private readonly workflowService: WorkflowService,
    private readonly workbenchService: WorkbenchService,
    private readonly worldbuildingService: WorldbuildingService,
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
        return createRpcError(
          request.id,
          "UNKNOWN_COMMAND",
          `Unsupported command: ${request.command}`,
        );
      }
      return createRpcError(
        request.id,
        getPayloadErrorCode(error),
        "RPC payload validation failed",
        serializeError(error),
      );
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
      case "settings.get": {
        return this.settingsService.getSettings();
      }
      case "settings.update": {
        return this.settingsService.updateSettings(payload as CommandPayload<"settings.update">);
      }
      case "settings.validateModel": {
        return this.settingsService.validateModel(
          payload as CommandPayload<"settings.validateModel">,
        );
      }
      case "diagnostics.getHealth": {
        return this.diagnosticsService.getHealthReport();
      }
      case "diagnostics.export": {
        return this.diagnosticsService.exportBundle();
      }
      case "project.create": {
        const parsed = payload as CommandPayload<"project.create">;
        const input: CreateProjectInput = {
          title: parsed.title,
          ...(parsed.genre === undefined ? {} : { genre: parsed.genre }),
          ...(parsed.style === undefined ? {} : { style: parsed.style }),
          ...(parsed.logline === undefined ? {} : { logline: parsed.logline }),
          ...(parsed.wordCountGoal === undefined ? {} : { wordCountGoal: parsed.wordCountGoal }),
        };
        return this.projectService.createProject(input);
      }
      case "project.listRecent": {
        const parsed = payload as CommandPayload<"project.listRecent">;
        return {
          items: await this.projectService.listRecent({
            ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
          }),
        };
      }
      case "project.open": {
        const parsed = payload as CommandPayload<"project.open">;
        return this.projectService.openProject(
          "projectId" in parsed ? { projectId: parsed.projectId } : { path: parsed.path },
        );
      }
      case "project.getOverview": {
        const parsed = payload as CommandPayload<"project.getOverview">;
        return this.projectService.getOverview(parsed.projectId);
      }
      case "project.backup": {
        const parsed = payload as CommandPayload<"project.backup">;
        return this.projectService.backup(parsed.projectId);
      }
      case "backup.createProject": {
        const parsed = payload as CommandPayload<"backup.createProject">;
        return this.projectService.backup(parsed.projectId);
      }
      case "backup.restoreProject": {
        return this.projectService.restoreBackup(
          payload as CommandPayload<"backup.restoreProject">,
        );
      }
      case "workbench.getSnapshot": {
        const parsed = payload as CommandPayload<"workbench.getSnapshot">;
        return this.workbenchService.getSnapshot(parsed.projectId);
      }
      case "workbench.getBoard": {
        const parsed = payload as CommandPayload<"workbench.getBoard">;
        return this.workbenchService.getBoard(parsed.projectId);
      }
      case "ai.generate": {
        return this.aiCommandService.generate(payload as CommandPayload<"ai.generate">);
      }
      case "ai.getRun": {
        return this.aiCommandService.getRun(payload as CommandPayload<"ai.getRun">);
      }
      case "ai.cancelRun": {
        return this.aiCommandService.cancelRun(payload as CommandPayload<"ai.cancelRun">);
      }
      case "ai.listArtifacts": {
        return this.aiCommandService.listArtifacts(payload as CommandPayload<"ai.listArtifacts">);
      }
      case "context.buildPackage": {
        return this.contextPackageService.buildPackage(
          payload as CommandPayload<"context.buildPackage">,
        );
      }
      case "creativeStage.getPath": {
        const parsed = payload as CommandPayload<"creativeStage.getPath">;
        return this.creativePathService.getPath(parsed.projectId);
      }
      case "creativeStage.evaluateGate": {
        return this.creativePathService.evaluateStageGate(
          payload as CommandPayload<"creativeStage.evaluateGate">,
        );
      }
      case "creativeStage.advance": {
        return this.creativePathService.advanceStage(
          payload as CommandPayload<"creativeStage.advance">,
        );
      }
      case "creativeStage.reopen": {
        return this.creativePathService.reopenStage(
          payload as CommandPayload<"creativeStage.reopen">,
        );
      }
      case "creativeStage.skip": {
        return this.creativePathService.skipStage(payload as CommandPayload<"creativeStage.skip">);
      }
      case "creativeStage.complete": {
        const parsed = payload as CommandPayload<"creativeStage.complete">;
        return this.creativePathService.completeStage(parsed);
      }
      case "brief.save": {
        const parsed = payload as CommandPayload<"brief.save">;
        return this.creativePathService.saveBrief({
          emotionalRewards: parsed.emotionalRewards,
          forbiddenDirections: parsed.forbiddenDirections,
          genre: parsed.genre,
          projectId: parsed.projectId,
          subgenres: parsed.subgenres,
          ...(parsed.estimatedChapterCount === undefined
            ? {}
            : { estimatedChapterCount: parsed.estimatedChapterCount }),
          ...(parsed.estimatedWordCount === undefined
            ? {}
            : { estimatedWordCount: parsed.estimatedWordCount }),
          ...(parsed.initialIdea === undefined ? {} : { initialIdea: parsed.initialIdea }),
          ...(parsed.lengthProfile === undefined ? {} : { lengthProfile: parsed.lengthProfile }),
          ...(parsed.narrativePov === undefined ? {} : { narrativePov: parsed.narrativePov }),
          ...(parsed.platformProfile === undefined
            ? {}
            : { platformProfile: parsed.platformProfile }),
          ...(parsed.targetAudience === undefined ? {} : { targetAudience: parsed.targetAudience }),
        });
      }
      case "brief.confirm": {
        const parsed = payload as CommandPayload<"brief.confirm">;
        return this.creativePathService.confirmBrief(parsed);
      }
      case "blueprint.generate": {
        const parsed = payload as CommandPayload<"blueprint.generate">;
        return this.creativePathService.generateBlueprint(parsed);
      }
      case "blueprint.saveForm": {
        const parsed = payload as CommandPayload<"blueprint.saveForm">;
        return this.creativePathService.saveBlueprintForm(parsed);
      }
      case "blueprint.completeForm": {
        const parsed = payload as CommandPayload<"blueprint.completeForm">;
        return this.creativePathService.completeBlueprintForm(parsed);
      }
      case "blueprint.apply": {
        const parsed = payload as CommandPayload<"blueprint.apply">;
        return this.creativePathService.applyBlueprint(parsed);
      }
      case "outline.generate": {
        const parsed = payload as CommandPayload<"outline.generate">;
        return this.outlineService.generate(parsed);
      }
      case "outline.saveDraft": {
        return this.outlineService.saveOutlineDraft(payload as CommandPayload<"outline.saveDraft">);
      }
      case "outline.saveVolumeOutline": {
        return this.outlineService.saveVolumeOutline(
          payload as CommandPayload<"outline.saveVolumeOutline">,
        );
      }
      case "outline.saveChapterOutline": {
        return this.outlineService.saveChapterOutline(
          payload as CommandPayload<"outline.saveChapterOutline">,
        );
      }
      case "outline.saveSceneOutline": {
        return this.outlineService.saveSceneOutline(
          payload as CommandPayload<"outline.saveSceneOutline">,
        );
      }
      case "outline.approveChapterOutline": {
        const parsed = payload as CommandPayload<"outline.approveChapterOutline">;
        return this.outlineService.approveChapterOutline(parsed);
      }
      case "outline.applyChapterOutline": {
        const parsed = payload as CommandPayload<"outline.applyChapterOutline">;
        return this.outlineService.applyChapterOutline(parsed);
      }
      case "plot.generateBookPlan": {
        return this.longformPlanService.generateBookPlan(
          payload as CommandPayload<"plot.generateBookPlan">,
        );
      }
      case "plot.applyBookPlan": {
        return this.longformPlanService.applyBookPlan(
          payload as CommandPayload<"plot.applyBookPlan">,
        );
      }
      case "plot.saveBookPlanDraft": {
        return this.longformPlanService.saveBookPlanDraft(
          payload as CommandPayload<"plot.saveBookPlanDraft">,
        );
      }
      case "plot.saveVolumePlan": {
        return this.longformPlanService.saveVolumePlan(
          payload as CommandPayload<"plot.saveVolumePlan">,
        );
      }
      case "plot.saveArcPlan": {
        return this.longformPlanService.saveArcPlan(payload as CommandPayload<"plot.saveArcPlan">);
      }
      case "plot.deleteBookPlan": {
        return this.longformPlanService.deleteBookPlan(
          payload as CommandPayload<"plot.deleteBookPlan">,
        );
      }
      case "plot.deleteVolumePlan": {
        return this.longformPlanService.deleteVolumePlan(
          payload as CommandPayload<"plot.deleteVolumePlan">,
        );
      }
      case "plot.deleteArcPlan": {
        return this.longformPlanService.deleteArcPlan(
          payload as CommandPayload<"plot.deleteArcPlan">,
        );
      }
      case "plot.saveChapterPlan": {
        return this.longformPlanService.saveChapterPlan(
          payload as CommandPayload<"plot.saveChapterPlan">,
        );
      }
      case "plot.saveScenePlan": {
        return this.longformPlanService.saveScenePlan(
          payload as CommandPayload<"plot.saveScenePlan">,
        );
      }
      case "plot.generateRollingOutline": {
        return this.longformPlanService.generateRollingOutline(
          payload as CommandPayload<"plot.generateRollingOutline">,
        );
      }
      case "plot.applyChapterPlans": {
        return this.longformPlanService.applyChapterPlans(
          payload as CommandPayload<"plot.applyChapterPlans">,
        );
      }
      case "plot.analyzeOutlineImpact": {
        return this.longformPlanService.analyzeOutlineImpact(
          payload as CommandPayload<"plot.analyzeOutlineImpact">,
        );
      }
      case "plotDebt.list": {
        return this.serialStateService.listPlotDebts(payload as CommandPayload<"plotDebt.list">);
      }
      case "plotDebt.save": {
        return this.serialStateService.savePlotDebt(payload as CommandPayload<"plotDebt.save">);
      }
      case "storyState.extractDelta": {
        return this.serialStateService.extractDelta(
          payload as CommandPayload<"storyState.extractDelta">,
        );
      }
      case "storyState.applyDelta": {
        return this.serialStateService.applyDelta(
          payload as CommandPayload<"storyState.applyDelta">,
        );
      }
      case "chapter.list": {
        const parsed = payload as CommandPayload<"chapter.list">;
        return {
          items: await this.chapterService.listChapters({
            projectId: parsed.projectId,
            ...(parsed.volumeId === undefined ? {} : { volumeId: parsed.volumeId }),
          }),
        };
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
      case "chapter.restoreVersion": {
        const parsed = payload as CommandPayload<"chapter.restoreVersion">;
        return this.chapterService.restoreVersion(parsed);
      }
      case "chapter.reviewContinuity": {
        const parsed = payload as CommandPayload<"chapter.reviewContinuity">;
        return this.workflowService.run({
          input: { scope: parsed.scope },
          projectId: parsed.projectId,
          targetId: parsed.chapterId,
          targetType: "chapter",
          workflowType: "review",
        });
      }
      case "chapter.reviewDraft": {
        return this.chapterReviewService.reviewDraft(
          payload as CommandPayload<"chapter.reviewDraft">,
        );
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
      case "chapter.generateDraftFromOutline": {
        const parsed = payload as CommandPayload<"chapter.generateDraftFromOutline">;
        return this.chapterService.generateDraftFromOutline({
          chapterOutlineId: parsed.chapterOutlineId,
          projectId: parsed.projectId,
          ...(parsed.instruction === undefined ? {} : { instruction: parsed.instruction }),
        });
      }
      case "chapter.generateDraftFromPlan": {
        const parsed = payload as CommandPayload<"chapter.generateDraftFromPlan">;
        const input: GenerateChapterDraftFromPlanInput = {
          chapterPlanId: parsed.chapterPlanId,
          projectId: parsed.projectId,
          ...(parsed.instruction === undefined ? {} : { instruction: parsed.instruction }),
        };
        return this.chapterService.generateDraftFromPlan(input);
      }
      case "chapterExecutionCard.generate": {
        return this.chapterExecutionCardService.generate(
          payload as CommandPayload<"chapterExecutionCard.generate">,
        );
      }
      case "chapterExecutionCard.apply": {
        return this.chapterExecutionCardService.apply(
          payload as CommandPayload<"chapterExecutionCard.apply">,
        );
      }
      case "chapterExecutionCard.save": {
        return this.chapterExecutionCardService.save(
          payload as CommandPayload<"chapterExecutionCard.save">,
        );
      }
      case "serialReview.generate": {
        return this.serialReviewService.generate(
          payload as CommandPayload<"serialReview.generate">,
        );
      }
      case "serialReview.apply": {
        return this.serialReviewService.apply(payload as CommandPayload<"serialReview.apply">);
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
      case "artifact.get": {
        const parsed = payload as CommandPayload<"artifact.get">;
        return this.artifactService.getArtifact(parsed.projectId, parsed.artifactId);
      }
      case "artifact.reject": {
        const parsed = payload as CommandPayload<"artifact.reject">;
        return this.artifactService.rejectArtifact(parsed.projectId, parsed.artifactId);
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
            ...(parsed.editedStatement === undefined
              ? {}
              : { editedStatement: parsed.editedStatement }),
          });
        }

        return this.memoryService.confirm({
          candidateId: parsed.candidateId,
          decision: parsed.decision,
          projectId: parsed.projectId,
          ...(parsed.editedStatement === undefined
            ? {}
            : { editedStatement: parsed.editedStatement }),
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
      case "memory.search": {
        const parsed = payload as CommandPayload<"memory.search">;
        return {
          items: await this.memoryService.searchMemories({
            projectId: parsed.projectId,
            query: parsed.query,
            ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
            ...(parsed.status === undefined ? {} : { status: parsed.status }),
          }),
        };
      }
      case "graph.getNeighborhood": {
        const parsed = payload as CommandPayload<"graph.getNeighborhood">;
        return this.graphService.getNeighborhood({
          depth: parsed.depth,
          entityId: parsed.nodeId,
          nodeType: parsed.nodeType,
          projectId: parsed.projectId,
        });
      }
      case "graph.rebuild": {
        const parsed = payload as CommandPayload<"graph.rebuild">;
        return this.graphService.rebuild(parsed.projectId);
      }
      case "graph.projectSinceCheckpoint": {
        const parsed = payload as CommandPayload<"graph.projectSinceCheckpoint">;
        return this.graphService.projectSinceCheckpoint(parsed.projectId);
      }
      case "graph.findContradictions": {
        const parsed = payload as CommandPayload<"graph.findContradictions">;
        return this.graphService.findContradictions({
          projectId: parsed.projectId,
          scope: parsed.scope,
          ...(parsed.targetId === undefined ? {} : { targetId: parsed.targetId }),
        });
      }
      case "workOrder.list": {
        const parsed = payload as CommandPayload<"workOrder.list">;
        return {
          items: await this.workflowService.listWorkOrders({
            projectId: parsed.projectId,
            ...(parsed.status === undefined ? {} : { status: parsed.status }),
          }),
        };
      }
      case "workOrder.get": {
        const parsed = payload as CommandPayload<"workOrder.get">;
        return this.workflowService.getWorkOrder(parsed);
      }
      case "workflow.cancel": {
        return this.workflowService.cancel(payload as CommandPayload<"workflow.cancel">);
      }
      case "workflow.retry": {
        const parsed = payload as CommandPayload<"workflow.retry">;
        const previousRun = await this.workflowService.getWorkflowRun(parsed);
        if (previousRun.workflowName === "chapter_draft") {
          const chapterId = getString(previousRun.input.chapterId);
          if (!chapterId) {
            throw new Error(`WORKFLOW_RETRY_INPUT_INVALID: ${previousRun.id}`);
          }
          const instruction = getString(previousRun.input.instruction);
          return this.chapterService.generateDraft({
            chapterId,
            projectId: parsed.projectId,
            ...(instruction === undefined ? {} : { instruction }),
          });
        }

        return this.workflowService.retry(parsed);
      }
      case "workflow.run": {
        const parsed = payload as CommandPayload<"workflow.run">;
        if (
          parsed.workflowType === "chapter_draft" &&
          parsed.targetType === "chapter" &&
          parsed.targetId
        ) {
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
          ...(parsed.appearance === undefined ? {} : { appearance: parsed.appearance }),
          ...(parsed.arcEnd === undefined ? {} : { arcEnd: parsed.arcEnd }),
          ...(parsed.arcStart === undefined ? {} : { arcStart: parsed.arcStart }),
          ...(parsed.arcTurn === undefined ? {} : { arcTurn: parsed.arcTurn }),
          ...(parsed.archetype === undefined ? {} : { archetype: parsed.archetype }),
          ...(parsed.biography === undefined ? {} : { biography: parsed.biography }),
          ...(parsed.firstAppearance === undefined
            ? {}
            : { firstAppearance: parsed.firstAppearance }),
          ...(parsed.flaw === undefined ? {} : { flaw: parsed.flaw }),
          ...(parsed.genderAge === undefined ? {} : { genderAge: parsed.genderAge }),
          ...(parsed.goal === undefined ? {} : { goal: parsed.goal }),
          ...(parsed.importance === undefined ? {} : { importance: parsed.importance }),
          ...(parsed.need === undefined ? {} : { need: parsed.need }),
          ...(parsed.narrativeFunction === undefined
            ? {}
            : { narrativeFunction: parsed.narrativeFunction }),
          ...(parsed.relationshipHook === undefined
            ? {}
            : { relationshipHook: parsed.relationshipHook }),
          ...(parsed.secret === undefined ? {} : { secret: parsed.secret }),
          ...(parsed.storyTask === undefined ? {} : { storyTask: parsed.storyTask }),
          ...(parsed.voiceProfile === undefined ? {} : { voiceProfile: parsed.voiceProfile }),
        };
        return this.characterService.createCharacter(input);
      }
      case "character.list": {
        const parsed = payload as CommandPayload<"character.list">;
        return { items: await this.characterService.listCharacters(parsed.projectId) };
      }
      case "character.update": {
        return this.characterService.updateCharacter(payload as CommandPayload<"character.update">);
      }
      case "character.delete": {
        return this.characterService.deleteCharacter(payload as CommandPayload<"character.delete">);
      }
      case "entityRelation.list": {
        const parsed = payload as CommandPayload<"entityRelation.list">;
        return {
          items: await this.characterService.listRelations({
            projectId: parsed.projectId,
            ...(parsed.entityId === undefined ? {} : { entityId: parsed.entityId }),
            ...(parsed.entityType === undefined ? {} : { entityType: parsed.entityType }),
            ...(parsed.status === undefined ? {} : { status: parsed.status }),
          }),
        };
      }
      case "entityRelation.create": {
        const parsed = payload as CommandPayload<"entityRelation.create">;
        return this.characterService.createRelation({
          polarity: parsed.polarity,
          projectId: parsed.projectId,
          relationType: parsed.relationType,
          sourceEntityId: parsed.sourceEntityId,
          sourceEntityType: parsed.sourceEntityType,
          status: parsed.status,
          strength: parsed.strength,
          targetEntityId: parsed.targetEntityId,
          targetEntityType: parsed.targetEntityType,
          ...(parsed.description === undefined ? {} : { description: parsed.description }),
        });
      }
      case "entityRelation.update": {
        return this.characterService.updateRelation(
          payload as CommandPayload<"entityRelation.update">,
        );
      }
      case "character.generateNames": {
        const parsed = payload as CommandPayload<"character.generateNames">;
        return this.characterService.generateNames({
          constraints: parsed.constraints,
          count: parsed.count,
          ...(parsed.style === undefined ? {} : { style: parsed.style }),
        });
      }
      case "element.generateCandidates": {
        return this.elementCandidateService.generateCandidates(
          payload as CommandPayload<"element.generateCandidates">,
        );
      }
      case "element.acceptCandidates": {
        return this.elementCandidateService.acceptCandidates(
          payload as CommandPayload<"element.acceptCandidates">,
        );
      }
      case "worldRule.create": {
        return this.worldRuleService.createWorldRule(payload as CommandPayload<"worldRule.create">);
      }
      case "worldRule.list": {
        const parsed = payload as CommandPayload<"worldRule.list">;
        return { items: await this.worldRuleService.listWorldRules(parsed.projectId) };
      }
      case "worldRule.update": {
        return this.worldRuleService.updateWorldRule(payload as CommandPayload<"worldRule.update">);
      }
      case "worldbuilding.saveFields": {
        return this.worldbuildingService.saveFields(
          payload as CommandPayload<"worldbuilding.saveFields">,
        );
      }
      case "worldbuilding.completeFields": {
        return this.worldbuildingService.completeFields(
          payload as CommandPayload<"worldbuilding.completeFields">,
        );
      }
      case "plotline.create": {
        const parsed = payload as CommandPayload<"plotline.create">;
        const input: CreatePlotlineInput = {
          ...(parsed.centralQuestion === undefined
            ? {}
            : { centralQuestion: parsed.centralQuestion }),
          ...(parsed.driver === undefined ? {} : { driver: parsed.driver }),
          ...(parsed.emotionalPromise === undefined
            ? {}
            : { emotionalPromise: parsed.emotionalPromise }),
          importance: parsed.importance,
          kind: parsed.kind,
          ...(parsed.midEscalation === undefined ? {} : { midEscalation: parsed.midEscalation }),
          narrativeRole: parsed.narrativeRole,
          ...(parsed.payoffPlan === undefined ? {} : { payoffPlan: parsed.payoffPlan }),
          priority: parsed.priority,
          projectId: parsed.projectId,
          relatedCharacterIds: parsed.relatedCharacterIds,
          relatedForeshadowingIds: parsed.relatedForeshadowingIds,
          relatedStoryEventIds: parsed.relatedStoryEventIds,
          relatedWorldRuleIds: parsed.relatedWorldRuleIds,
          ...(parsed.startState === undefined ? {} : { startState: parsed.startState }),
          status: parsed.status,
          title: parsed.title,
          ...(parsed.summary === undefined ? {} : { summary: parsed.summary }),
        };
        return this.plotlineService.createPlotline(input);
      }
      case "plotline.list": {
        const parsed = payload as CommandPayload<"plotline.list">;
        return { items: await this.plotlineService.listPlotlines(parsed.projectId) };
      }
      case "plotline.update": {
        return this.plotlineService.updatePlotline(payload as CommandPayload<"plotline.update">);
      }
      case "plotline.delete": {
        return this.plotlineService.deletePlotline(payload as CommandPayload<"plotline.delete">);
      }
      case "plotline.createNode": {
        const parsed = payload as CommandPayload<"plotline.createNode">;
        return this.plotlineService.createNode({
          kind: parsed.kind,
          plotlineId: parsed.plotlineId,
          projectId: parsed.projectId,
          status: parsed.status,
          title: parsed.title,
          ...(parsed.chapterHint === undefined ? {} : { chapterHint: parsed.chapterHint }),
          ...(parsed.description === undefined ? {} : { description: parsed.description }),
          ...(parsed.position === undefined ? {} : { position: parsed.position }),
          ...(parsed.targetChapterId === undefined
            ? {}
            : { targetChapterId: parsed.targetChapterId }),
        });
      }
      case "plotline.updateNode": {
        return this.plotlineService.updateNode(payload as CommandPayload<"plotline.updateNode">);
      }
      case "storyEvent.create": {
        const parsed = payload as CommandPayload<"storyEvent.create">;
        const input: CreateStoryEventInput = {
          description: parsed.description,
          eventType: parsed.eventType,
          participants: parsed.participants,
          projectId: parsed.projectId,
          status: parsed.status,
          title: parsed.title,
          ...(parsed.chapterId === undefined ? {} : { chapterId: parsed.chapterId }),
          ...(parsed.outcome === undefined ? {} : { outcome: parsed.outcome }),
          ...(parsed.sceneId === undefined ? {} : { sceneId: parsed.sceneId }),
          ...(parsed.storyTime === undefined ? {} : { storyTime: parsed.storyTime }),
        };
        return this.storyEventService.createStoryEvent(input);
      }
      case "storyEvent.update": {
        return this.storyEventService.updateStoryEvent(
          payload as CommandPayload<"storyEvent.update">,
        );
      }
      case "storyEvent.list": {
        const parsed = payload as CommandPayload<"storyEvent.list">;
        return { items: await this.storyEventService.listStoryEvents(parsed.projectId) };
      }
      case "eventRelation.list": {
        return {
          items: await this.eventRelationService.listEventRelations(
            payload as CommandPayload<"eventRelation.list">,
          ),
        };
      }
      case "eventRelation.create": {
        return this.eventRelationService.createEventRelation(
          payload as CommandPayload<"eventRelation.create">,
        );
      }
      case "eventRelation.update": {
        return this.eventRelationService.updateEventRelation(
          payload as CommandPayload<"eventRelation.update">,
        );
      }
      case "conflict.list": {
        return {
          items: await this.conflictService.listConflicts(
            payload as CommandPayload<"conflict.list">,
          ),
        };
      }
      case "conflict.create": {
        return this.conflictService.createConflict(payload as CommandPayload<"conflict.create">);
      }
      case "conflict.update": {
        return this.conflictService.updateConflict(payload as CommandPayload<"conflict.update">);
      }
      case "foreshadowing.create": {
        const parsed = payload as CommandPayload<"foreshadowing.create">;
        const input: CreateForeshadowingInput = {
          description: parsed.description,
          importance: parsed.importance,
          projectId: parsed.projectId,
          status: parsed.status,
          title: parsed.title,
          ...(parsed.payoffEventId === undefined ? {} : { payoffEventId: parsed.payoffEventId }),
          ...(parsed.payoffExpectation === undefined
            ? {}
            : { payoffExpectation: parsed.payoffExpectation }),
          ...(parsed.seedEventId === undefined ? {} : { seedEventId: parsed.seedEventId }),
        };
        return this.foreshadowingService.createForeshadowing(input);
      }
      case "foreshadowing.update": {
        return this.foreshadowingService.updateForeshadowing(
          payload as CommandPayload<"foreshadowing.update">,
        );
      }
      case "foreshadowing.list": {
        const parsed = payload as CommandPayload<"foreshadowing.list">;
        return { items: await this.foreshadowingService.listForeshadowings(parsed.projectId) };
      }
      case "foreshadowing.plan": {
        const parsed = payload as CommandPayload<"foreshadowing.plan">;
        const target = resolveForeshadowingPlanTarget(parsed);
        return this.workflowService.run({
          input: {},
          projectId: parsed.projectId,
          workflowType: "foreshadowing_plan",
          ...(target === undefined ? {} : target),
        });
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
  if (error.message.startsWith("FILE_OUT_OF_SCOPE")) {
    return "FILE_OUT_OF_SCOPE";
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

function resolveForeshadowingPlanTarget(
  payload: CommandPayload<"foreshadowing.plan">,
): Pick<RunWorkflowInput, "targetId" | "targetType"> | undefined {
  if (payload.chapterId) {
    return { targetId: payload.chapterId, targetType: "chapter" };
  }
  if (payload.plotlineId) {
    return { targetId: payload.plotlineId, targetType: "plotline" };
  }

  return undefined;
}
