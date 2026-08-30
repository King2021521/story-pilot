import {
  BarsOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import type { CommandPayload } from "@story-pilot/contracts";
import {
  COUNT_PRESETS,
  ELEMENT_TYPE_PRESETS,
  GENRE_PRESETS,
  STYLE_PRESETS,
} from "@story-pilot/presets";
import {
  App as AntApp,
  Button,
  Checkbox,
  Descriptions,
  Empty,
  Form,
  Input,
  Layout,
  Modal,
  Select,
  Space,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from "antd";
import { useCallback, useEffect, useRef, useState } from "react";

import { ArtifactReviewPanel, type ArtifactReviewItem } from "../features/ai/ArtifactReviewPanel";
import type { ChapterVersionItem } from "../features/chapter/ChapterVersionDrawer";
import type {
  CompletableCreativeStageKey,
  CreativeStageKey,
  SaveBriefValues,
} from "../features/creative-path/CreativePathWorkbench";
import type {
  AcceptElementCandidatesValues,
  CreateForeshadowingValues,
  ElementCandidateItem,
  GenerateElementCandidatesResult,
  GenerateElementCandidatesValues,
} from "../features/creative/CreativeElementsPanel";
import { GraphPreviewPanel, type GraphPreviewData } from "../features/memory/GraphPreviewPanel";
import type { MemoryCandidateDecisionInput } from "../features/memory/MemoryConfirmDrawer";
import { ProjectSidebar, type ProjectSidebarProject } from "../features/project/ProjectSidebar";
import {
  SettingsDrawer,
  type DiagnosticsHealthView,
  type RuntimeSettingsView,
} from "../features/settings/SettingsDrawer";
import {
  getWorkspaceModuleTitle,
  type WorkspaceModuleKey,
} from "../features/workbench/workspaceModules";
import {
  WorkbenchHome,
  type CompleteCoreStoryFieldsResult,
  type CoreStoryFields,
  type CreateStoryEventValues,
  type SaveArcPlanValues,
  type SaveBookPlanDraftValues,
  type SaveCoreStoryFieldsResult,
  type SaveVolumePlanValues,
  type UpdateCharacterValues,
  type UpdateForeshadowingValues,
  type UpdateStoryEventValues,
  type WorkbenchBoard,
  type WorkbenchChapter,
  type WorkbenchProject,
  type WorldbuildingFields,
} from "../features/workbench/WorkbenchHome";
import { formatUserError } from "../shared/errors/error-message";
import { useStoryPilotApi } from "../shared/rpc/useStoryPilotApi";

const { Content, Sider } = Layout;
const { Text, Title } = Typography;

type InspectorTabKey = "status" | "toolbox" | "artifacts" | "timeline" | "graph";
type ShellCreativePath = NonNullable<WorkbenchBoard["creativePath"]>;
type ShellStage = ShellCreativePath["stages"][number];

const SHELL_WORLD_DIMENSION_COUNT = 12;

const MODULE_STAGE_MAP: Partial<Record<WorkspaceModuleKey, CreativeStageKey>> = {
  basic: "brief",
  "book-outline": "outline",
  characters: "characters",
  "chapter-planning": "chapters",
  manuscript: "chapters",
  "plot-nodes": "outline",
  "story-core": "blueprint",
  storylines: "plot_arcs",
  worldbuilding: "worldbuilding",
};

interface CreateProjectFormValues {
  readonly genre?: string;
  readonly logline?: string;
  readonly style?: string;
  readonly title: string;
}

interface InspectorToolboxFormValues {
  readonly constraints?: string[];
  readonly count: GenerateElementCandidatesValues["count"];
  readonly description?: string;
  readonly elementType: GenerateElementCandidatesValues["elementType"];
  readonly style?: string;
  readonly worldRuleIds?: string[];
}

export function ShellLayout() {
  const { message } = AntApp.useApp();
  const storyPilotApi = useStoryPilotApi();
  const [activeProject, setActiveProject] = useState<WorkbenchProject | undefined>();
  const [activeModuleKey, setActiveModuleKey] = useState<WorkspaceModuleKey>("dashboard");
  const [board, setBoard] = useState<WorkbenchBoard | undefined>();
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [graphPreview, setGraphPreview] = useState<GraphPreviewData | undefined>();
  const [loadingGraphPreview, setLoadingGraphPreview] = useState(false);
  const [chapterVersions, setChapterVersions] = useState<readonly ChapterVersionItem[]>([]);
  const [loadingChapterVersions, setLoadingChapterVersions] = useState(false);
  const [loadingWorkbench, setLoadingWorkbench] = useState(true);
  const [projects, setProjects] = useState<readonly ProjectSidebarProject[]>([]);
  const [savingChapter, setSavingChapter] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettingsView | undefined>();
  const [diagnosticsHealth, setDiagnosticsHealth] = useState<DiagnosticsHealthView | undefined>();
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [inspectorTabKey, setInspectorTabKey] = useState<InspectorTabKey>("status");
  const [createProjectForm] = Form.useForm<CreateProjectFormValues>();

  const openInspectorTab = useCallback((tabKey: InspectorTabKey) => {
    setInspectorCollapsed(false);
    setInspectorTabKey(tabKey);
  }, []);

  const selectChapter = useCallback((chapterId: string) => {
    setSelectedChapterId(chapterId);
    setChapterVersions([]);
    setGraphPreview(undefined);
  }, []);

  const loadRuntimeSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const [settings, health] = await Promise.all([
        storyPilotApi.getSettings(),
        storyPilotApi.getDiagnosticsHealth(),
      ]);
      setRuntimeSettings(settings as RuntimeSettingsView);
      setDiagnosticsHealth(health as DiagnosticsHealthView);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoadingSettings(false);
    }
  }, [message, storyPilotApi]);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
    void loadRuntimeSettings();
  }, [loadRuntimeSettings]);

  const refreshBoard = useCallback(
    async (projectId: string) => {
      const nextBoard = (await storyPilotApi.getWorkbenchBoard({ projectId })) as WorkbenchBoard;
      setBoard(nextBoard);
      setActiveProject(nextBoard.project);
      setProjects((currentProjects) => upsertProject(currentProjects, nextBoard.project));
      setSelectedChapterId((currentChapterId) =>
        nextBoard.chapters.some((chapter) => chapter.id === currentChapterId)
          ? currentChapterId
          : nextBoard.chapters[0]?.id,
      );

      return nextBoard;
    },
    [storyPilotApi],
  );

  const openProject = useCallback(
    async (projectId: string) => {
      const project = (await storyPilotApi.openProject({ projectId })) as WorkbenchProject;
      setActiveProject(project);
      setProjects((currentProjects) => upsertProject(currentProjects, project));
      setActiveModuleKey("dashboard");
      await refreshBoard(project.id);
    },
    [refreshBoard, storyPilotApi],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialProject() {
      setLoadingWorkbench(true);
      try {
        const recentProjects = (await storyPilotApi.listRecentProjects({
          limit: 20,
        })) as WorkbenchProject[];
        if (cancelled) {
          return;
        }
        setProjects(recentProjects);
        const firstProject = recentProjects[0];
        if (!firstProject) {
          setActiveProject(undefined);
          setBoard(undefined);
          setSelectedChapterId(undefined);
          return;
        }

        const project = (await storyPilotApi.openProject({
          projectId: firstProject.id,
        })) as WorkbenchProject;
        const nextBoard = (await storyPilotApi.getWorkbenchBoard({
          projectId: project.id,
        })) as WorkbenchBoard;
        if (cancelled) {
          return;
        }
        setActiveProject(project);
        setBoard(nextBoard);
        setProjects((currentProjects) => upsertProject(currentProjects, project));
        setActiveModuleKey("dashboard");
        setSelectedChapterId(nextBoard.chapters[0]?.id);
        setChapterVersions([]);
      } catch (error) {
        if (!cancelled) {
          message.error(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkbench(false);
        }
      }
    }

    void loadInitialProject();

    return () => {
      cancelled = true;
    };
  }, [message, storyPilotApi]);

  const createProject = useCallback(
    async (values: CreateProjectFormValues) => {
      setCreatingProject(true);
      try {
        const project = (await storyPilotApi.createProject(
          createProjectPayload(values),
        )) as WorkbenchProject;
        setProjects((currentProjects) => upsertProject(currentProjects, project));
        setActiveModuleKey("dashboard");
        await refreshBoard(project.id);
        setCreateProjectOpen(false);
        createProjectForm.resetFields();
        message.success("作品已创建");
      } catch (error) {
        message.error(getErrorMessage(error));
      } finally {
        setCreatingProject(false);
      }
    },
    [createProjectForm, message, refreshBoard, storyPilotApi],
  );

  const createChapter = useCallback(
    async (input: Omit<CommandPayload<"chapter.create">, "projectId" | "volumeId">) => {
      if (!activeProject) {
        return;
      }

      try {
        const chapter = (await storyPilotApi.createChapter({
          ...input,
          projectId: activeProject.id,
          volumeId: activeProject.defaultVolumeId,
        })) as WorkbenchChapter;
        await refreshBoard(activeProject.id);
        setSelectedChapterId(chapter.id);
        message.success("章节已创建");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const saveChapter = useCallback(
    async (input: {
      readonly baseVersion: number;
      readonly chapterId: string;
      readonly content: string;
    }) => {
      if (!activeProject) {
        return;
      }

      setSavingChapter(true);
      try {
        const chapter = (await storyPilotApi.saveChapterContent({
          ...input,
          projectId: activeProject.id,
        })) as WorkbenchChapter;
        setBoard((currentBoard) =>
          currentBoard ? replaceChapter(currentBoard, chapter) : currentBoard,
        );
        setSelectedChapterId(chapter.id);
        message.success("章节已保存");
      } catch (error) {
        message.error(getErrorMessage(error));
      } finally {
        setSavingChapter(false);
      }
    },
    [activeProject, message, storyPilotApi],
  );

  const loadChapterVersions = useCallback(
    async (input: { readonly chapterId: string }) => {
      if (!activeProject) {
        return;
      }

      setLoadingChapterVersions(true);
      try {
        const versions = (await storyPilotApi.listChapterVersions({
          chapterId: input.chapterId,
          projectId: activeProject.id,
        })) as ChapterVersionItem[];
        setChapterVersions(versions);
      } catch (error) {
        message.error(getErrorMessage(error));
      } finally {
        setLoadingChapterVersions(false);
      }
    },
    [activeProject, message, storyPilotApi],
  );

  const restoreChapterVersion = useCallback(
    async (input: { readonly chapterId: string; readonly versionId: string }) => {
      if (!activeProject) {
        return;
      }

      try {
        const chapter = (await storyPilotApi.restoreChapterVersion({
          ...input,
          projectId: activeProject.id,
        })) as WorkbenchChapter;
        setBoard((currentBoard) =>
          currentBoard ? replaceChapter(currentBoard, chapter) : currentBoard,
        );
        setSelectedChapterId(chapter.id);
        setChapterVersions([]);
        message.success("章节版本已恢复");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, storyPilotApi],
  );

  const generateDraft = useCallback(
    async (input: { readonly chapterId: string; readonly instruction: string }) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.generateChapterDraft({
          ...input,
          projectId: activeProject.id,
        });
        openInspectorTab("artifacts");
        await refreshBoard(activeProject.id);
        message.success("AI 草稿已进入产物区");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, openInspectorTab, refreshBoard, storyPilotApi],
  );

  const applyArtifact = useCallback(
    async (artifact: ArtifactReviewItem) => {
      if (!activeProject || !board) {
        return;
      }

      const targetChapter = board.chapters.find((chapter) => chapter.id === artifact.targetId);
      if (!targetChapter) {
        message.error("未找到产物对应章节");
        return;
      }

      try {
        const result = (await storyPilotApi.applyArtifact({
          applyMode: "replace",
          artifactId: artifact.id,
          projectId: activeProject.id,
          targetVersion: targetChapter.version,
        })) as { readonly chapter?: WorkbenchChapter };
        if (result.chapter) {
          setSelectedChapterId(result.chapter.id);
        }
        await refreshBoard(activeProject.id);
        message.success("AI 产物已应用为章节版本");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, board, message, refreshBoard, storyPilotApi],
  );

  const rejectArtifact = useCallback(
    async (artifact: ArtifactReviewItem) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.rejectArtifact({
          artifactId: artifact.id,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("AI 产物已拒绝");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const loadGraphPreview = useCallback(async () => {
    if (!activeProject || !selectedChapterId) {
      setGraphPreview(undefined);
      return;
    }

    setLoadingGraphPreview(true);
    try {
      const neighborhood = (await storyPilotApi.getGraphNeighborhood({
        depth: 2,
        nodeId: selectedChapterId,
        nodeType: "chapter",
        projectId: activeProject.id,
      })) as GraphPreviewData;
      setGraphPreview(neighborhood);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoadingGraphPreview(false);
    }
  }, [activeProject, message, selectedChapterId, storyPilotApi]);

  const selectInspectorTab = useCallback(
    (tabKey: InspectorTabKey) => {
      setInspectorTabKey(tabKey);
      if (tabKey === "graph") {
        void loadGraphPreview();
      }
    },
    [loadGraphPreview],
  );

  const openInspectorFromRail = useCallback(
    (tabKey: InspectorTabKey) => {
      openInspectorTab(tabKey);
      if (tabKey === "graph") {
        void loadGraphPreview();
      }
    },
    [loadGraphPreview, openInspectorTab],
  );

  const confirmMemory = useCallback(
    async (input: MemoryCandidateDecisionInput) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.confirmMemory({
          candidateId: input.candidateId,
          decision: input.decision,
          ...(input.editedStatement ? { editedStatement: input.editedStatement } : {}),
          ...(input.mergeTargetMemoryId ? { mergeTargetMemoryId: input.mergeTargetMemoryId } : {}),
          projectId: activeProject.id,
        });
        setBoard((currentBoard) => filterMemoryCandidate(currentBoard, input.candidateId));
        message.success(resolveMemoryDecisionMessage(input.decision));
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, storyPilotApi],
  );

  const rejectMemory = useCallback(
    async (candidateId: string) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.rejectMemory({
          candidateId,
          projectId: activeProject.id,
        });
        setBoard((currentBoard) => filterMemoryCandidate(currentBoard, candidateId));
        message.success("候选记忆已拒绝");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, storyPilotApi],
  );

  const createCharacter = useCallback(
    async (input: Omit<CommandPayload<"character.create">, "projectId">) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.createCharacter({
          ...input,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("人物已创建");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const updateCharacter = useCallback(
    async (input: UpdateCharacterValues) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.updateCharacter({
          characterId: input.characterId,
          patch: input.patch,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("人物已保存");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const createWorldRule = useCallback(
    async (input: Omit<CommandPayload<"worldRule.create">, "projectId">) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.createWorldRule({
          ...input,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("规则已创建");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const saveWorldbuildingFields = useCallback(
    async (input: Omit<CommandPayload<"worldbuilding.saveFields">, "projectId">) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.saveWorldbuildingFields({
          fields: input.fields,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("世界观已保存");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const completeWorldbuildingFields = useCallback(
    async (
      input: Omit<CommandPayload<"worldbuilding.completeFields">, "projectId">,
    ): Promise<{ readonly fields: CommandPayload<"worldbuilding.completeFields">["fields"] }> => {
      if (!activeProject) {
        return { fields: input.fields };
      }

      try {
        const result = (await storyPilotApi.completeWorldbuildingFields({
          fields: input.fields,
          projectId: activeProject.id,
        })) as { readonly fields: CommandPayload<"worldbuilding.completeFields">["fields"] };
        message.success("AI 已补全世界观");
        return result;
      } catch (error) {
        message.error(getErrorMessage(error));
        return { fields: input.fields };
      }
    },
    [activeProject, message, storyPilotApi],
  );

  const createPlotline = useCallback(
    async (input: Omit<CommandPayload<"plotline.create">, "projectId">) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.createPlotline({
          ...input,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("故事线已创建");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const updatePlotline = useCallback(
    async (input: Omit<CommandPayload<"plotline.update">, "projectId">) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.updatePlotline({
          ...input,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("故事线已保存");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const createPlotlineNode = useCallback(
    async (input: Omit<CommandPayload<"plotline.createNode">, "projectId">) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.createPlotlineNode({
          ...input,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("故事线节点已添加");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const updatePlotlineNode = useCallback(
    async (input: Omit<CommandPayload<"plotline.updateNode">, "projectId">) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.updatePlotlineNode({
          ...input,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("故事线节点已更新");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const createForeshadowing = useCallback(
    async (input: CreateForeshadowingValues) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.createForeshadowing({
          description: input.description,
          importance: input.importance,
          ...optionalText("payoffExpectation", input.payoffExpectation),
          ...optionalText("payoffEventId", input.payoffEventId),
          projectId: activeProject.id,
          ...optionalText("seedEventId", input.seedEventId),
          status: input.status ?? "seeded",
          title: input.title,
        });
        await refreshBoard(activeProject.id);
        message.success("伏笔已创建");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const createStoryEvent = useCallback(
    async (input: CreateStoryEventValues) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.createStoryEvent({
          ...optionalText("chapterId", input.chapterId),
          description: input.description,
          eventType: input.eventType,
          participants: [...(input.participants ?? [])],
          projectId: activeProject.id,
          status: input.status ?? "draft",
          title: input.title,
          ...optionalText("storyTime", input.storyTime),
        });
        await refreshBoard(activeProject.id);
        message.success("剧情节点已创建");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const updateStoryEvent = useCallback(
    async (input: UpdateStoryEventValues) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.updateStoryEvent({
          ...input,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("剧情节点已更新");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const updateForeshadowing = useCallback(
    async (input: UpdateForeshadowingValues) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.updateForeshadowing({
          ...input,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("伏笔已更新");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const planForeshadowing = useCallback(
    async (input: Omit<CommandPayload<"foreshadowing.plan">, "projectId">) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.planForeshadowing({
          ...input,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("伏笔回收规划已提交");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const generateElementCandidates = useCallback(
    async (input: GenerateElementCandidatesValues): Promise<GenerateElementCandidatesResult> => {
      if (!activeProject) {
        return { items: [] };
      }

      const description = input.description?.trim();
      try {
        return (await storyPilotApi.generateElementCandidates({
          constraints: [...input.constraints],
          count: input.count,
          ...(description ? { description } : {}),
          elementType: input.elementType,
          genre: input.genre,
          projectId: activeProject.id,
          ...(input.style === undefined ? {} : { style: input.style }),
          worldRuleIds: [...input.worldRuleIds],
        })) as GenerateElementCandidatesResult;
      } catch (error) {
        message.error(getErrorMessage(error));
        return { items: [] };
      }
    },
    [activeProject, message, storyPilotApi],
  );

  const acceptElementCandidates = useCallback(
    async (input: AcceptElementCandidatesValues) => {
      if (!activeProject) {
        return;
      }

      const items: CommandPayload<"element.acceptCandidates">["items"] = input.items.map(
        (item: ElementCandidateItem) => ({
          name: item.name,
          type: item.type,
          ...(item.description === undefined ? {} : { description: item.description }),
          ...(item.rationale === undefined ? {} : { rationale: item.rationale }),
          tags: [...(item.tags ?? [])],
        }),
      );

      try {
        await storyPilotApi.acceptElementCandidates({
          items,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("候选已采纳");
      } catch (error) {
        message.error(getErrorMessage(error));
        throw error;
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const saveBrief = useCallback(
    async (input: SaveBriefValues) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.saveBrief({
          emotionalRewards: [...input.emotionalRewards],
          forbiddenDirections: [...input.forbiddenDirections],
          genre: input.genre,
          projectId: activeProject.id,
          subgenres: [...input.subgenres],
          ...optionalNumber("estimatedChapterCount", input.estimatedChapterCount),
          ...optionalNumber("estimatedWordCount", input.estimatedWordCount),
          ...optionalText("targetAudience", input.targetAudience),
          ...optionalText("platformProfile", input.platformProfile),
          ...optionalText("lengthProfile", input.lengthProfile),
          ...optionalText("narrativePov", input.narrativePov),
          ...optionalText("initialIdea", input.initialIdea),
        });
        await refreshBoard(activeProject.id);
        message.success("立项已保存");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const confirmBrief = useCallback(
    async (input: { readonly briefId: string }) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.confirmBrief({
          briefId: input.briefId,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("立项已确认");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const completeStage = useCallback(
    async (input: { readonly stageKey: CompletableCreativeStageKey }) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.completeCreativeStage({
          projectId: activeProject.id,
          stageKey: input.stageKey,
        });
        await refreshBoard(activeProject.id);
        message.success("阶段已完成");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const evaluateStageGate = useCallback(
    async (input: { readonly stageKey: CreativeStageKey }) => {
      if (!activeProject) {
        return;
      }

      try {
        const result = (await storyPilotApi.evaluateCreativeStageGate({
          projectId: activeProject.id,
          stageKey: input.stageKey,
        })) as { readonly gateReport?: { readonly ok?: boolean; readonly summary?: string } };
        await refreshBoard(activeProject.id);
        if (result.gateReport?.ok) {
          message.success("阶段门禁已通过");
        } else {
          message.warning(result.gateReport?.summary ?? "阶段门禁仍需补齐");
        }
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const advanceStage = useCallback(
    async (input: { readonly stageKey: CreativeStageKey; readonly mode: "strict" | "force" }) => {
      if (!activeProject) {
        return;
      }

      try {
        const result = (await storyPilotApi.advanceCreativeStage({
          mode: input.mode,
          projectId: activeProject.id,
          stageKey: input.stageKey,
        })) as { readonly advanced?: boolean; readonly gateReport?: { readonly summary?: string } };
        await refreshBoard(activeProject.id);
        if (result.advanced) {
          message.success("阶段已推进");
        } else {
          message.warning(result.gateReport?.summary ?? "阶段门禁未通过");
        }
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const reopenStage = useCallback(
    async (input: { readonly stageKey: CreativeStageKey; readonly reason?: string }) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.reopenCreativeStage({
          projectId: activeProject.id,
          stageKey: input.stageKey,
          ...optionalText("reason", input.reason),
        });
        await refreshBoard(activeProject.id);
        message.success("阶段已重开");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const skipStage = useCallback(
    async (input: { readonly stageKey: CreativeStageKey; readonly reason: string }) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.skipCreativeStage({
          projectId: activeProject.id,
          reason: input.reason,
          stageKey: input.stageKey,
        });
        await refreshBoard(activeProject.id);
        message.success("阶段已跳过");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const generateBlueprint = useCallback(async () => {
    if (!activeProject) {
      return;
    }

    try {
      await storyPilotApi.generateAi({
        capability: "blueprint.generate",
        projectId: activeProject.id,
        targetType: "project",
      });
      await refreshBoard(activeProject.id);
      message.success("创作蓝图已生成");
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  }, [activeProject, message, refreshBoard, storyPilotApi]);

  const saveCoreStoryFields = useCallback(
    async (input: { readonly fields: CoreStoryFields }): Promise<SaveCoreStoryFieldsResult> => {
      if (!activeProject) {
        throw new Error("未打开作品");
      }

      try {
        const result = (await storyPilotApi.saveBlueprintForm({
          fields: input.fields,
          projectId: activeProject.id,
        })) as SaveCoreStoryFieldsResult;
        await refreshBoard(activeProject.id);
        message.success("核心故事草稿已保存");
        return result;
      } catch (error) {
        message.error(getErrorMessage(error));
        throw error;
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const completeCoreStoryFields = useCallback(
    async (input: { readonly fields: CoreStoryFields }): Promise<CompleteCoreStoryFieldsResult> => {
      if (!activeProject) {
        return { fields: input.fields };
      }

      try {
        const result = (await storyPilotApi.completeBlueprintForm({
          fields: input.fields,
          projectId: activeProject.id,
        })) as CompleteCoreStoryFieldsResult;
        message.success("AI 已补全核心故事");
        return result;
      } catch (error) {
        message.error(getErrorMessage(error));
        return { fields: input.fields };
      }
    },
    [activeProject, message, storyPilotApi],
  );

  const applyBlueprint = useCallback(
    async (input: { readonly blueprintId: string }) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.applyBlueprint({
          blueprintId: input.blueprintId,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("核心故事已确认");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const generateOutline = useCallback(
    async (input: { readonly scope: "chapter_batch"; readonly chapterCount: 10 }) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.generateAi({
          capability: "outline.generate",
          input: {
            chapterCount: input.chapterCount,
            scope: input.scope,
          },
          projectId: activeProject.id,
          targetType: "project",
        });
        await refreshBoard(activeProject.id);
        message.success("章纲已生成");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const generateBookPlan = useCallback(
    async (input: { readonly targetWordCount: number; readonly volumeCount: number }) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.generateBookPlan({
          projectId: activeProject.id,
          targetWordCount: input.targetWordCount,
          volumeCount: input.volumeCount,
        });
        openInspectorTab("artifacts");
        await refreshBoard(activeProject.id);
        message.success("全书规划已生成");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, openInspectorTab, refreshBoard, storyPilotApi],
  );

  const saveBookPlanDraft = useCallback(
    async (input: SaveBookPlanDraftValues) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.saveBookPlanDraft({
          corePromise: input.corePromise.trim(),
          endingDirection: nullableText(input.endingDirection),
          mainPlotlineId: nullableText(input.mainPlotlineId),
          projectId: activeProject.id,
          status: input.status,
          targetWordCount: input.targetWordCount,
          title: input.title.trim(),
          ...optionalText("bookPlanId", input.bookPlanId),
        });
        await refreshBoard(activeProject.id);
        message.success("全书规划已保存");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const saveVolumePlan = useCallback(
    async (input: SaveVolumePlanValues) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.saveVolumePlan({
          bookPlanId: input.bookPlanId,
          climax: nullableText(input.climax),
          majorConflict: input.majorConflict.trim(),
          projectId: activeProject.id,
          purpose: input.purpose.trim(),
          status: input.status,
          targetWordCount: input.targetWordCount,
          title: input.title.trim(),
          volumeIndex: input.volumeIndex,
          ...optionalText("volumePlanId", input.volumePlanId),
        });
        await refreshBoard(activeProject.id);
        message.success("卷规划已保存");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const saveArcPlan = useCallback(
    async (input: SaveArcPlanValues) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.saveArcPlan({
          arcIndex: input.arcIndex,
          characterArcId: nullableText(input.characterArcId),
          endChapterIndex: nullableNumber(input.endChapterIndex),
          escalation: input.escalation,
          plotlineId: nullableText(input.plotlineId),
          projectId: activeProject.id,
          purpose: input.purpose.trim(),
          startChapterIndex: nullableNumber(input.startChapterIndex),
          status: input.status,
          title: input.title.trim(),
          volumePlanId: input.volumePlanId,
          ...optionalText("arcPlanId", input.arcPlanId),
        });
        await refreshBoard(activeProject.id);
        message.success("阶段弧线已保存");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const generateRollingOutline = useCallback(
    async (input: {
      readonly volumePlanId?: string;
      readonly arcPlanId?: string;
      readonly startChapterIndex: number;
      readonly chapterCount: 10 | 20;
    }) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.generateRollingOutline({
          chapterCount: input.chapterCount,
          projectId: activeProject.id,
          startChapterIndex: input.startChapterIndex,
          ...optionalText("arcPlanId", input.arcPlanId),
          ...optionalText("volumePlanId", input.volumePlanId),
        });
        openInspectorTab("artifacts");
        await refreshBoard(activeProject.id);
        message.success("滚动章纲已生成");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, openInspectorTab, refreshBoard, storyPilotApi],
  );

  const approveChapterOutline = useCallback(
    async (input: { readonly chapterOutlineId: string }) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.approveChapterOutline({
          chapterOutlineId: input.chapterOutlineId,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("章纲已批准");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const applyChapterOutline = useCallback(
    async (input: { readonly chapterOutlineId: string }) => {
      if (!activeProject) {
        return;
      }

      try {
        const result = (await storyPilotApi.applyChapterOutline({
          chapterOutlineId: input.chapterOutlineId,
          projectId: activeProject.id,
        })) as { readonly chapter?: WorkbenchChapter };
        await refreshBoard(activeProject.id);
        if (result.chapter) {
          setSelectedChapterId(result.chapter.id);
        }
        message.success("章纲已应用为章节");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  const generateDraftFromOutline = useCallback(
    async (input: { readonly chapterOutlineId: string }) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.generateChapterDraftFromOutline({
          chapterOutlineId: input.chapterOutlineId,
          projectId: activeProject.id,
        });
        openInspectorTab("artifacts");
        await refreshBoard(activeProject.id);
        message.success("章纲草稿已进入产物区");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, openInspectorTab, refreshBoard, storyPilotApi],
  );

  const generateDraftFromPlan = useCallback(
    async (input: { readonly chapterPlanId: string }) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.generateChapterDraftFromPlan({
          chapterPlanId: input.chapterPlanId,
          projectId: activeProject.id,
        });
        openInspectorTab("artifacts");
        await refreshBoard(activeProject.id);
        message.success("结构章纲草稿已进入产物区");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, openInspectorTab, refreshBoard, storyPilotApi],
  );

  const saveModelSettings = useCallback(
    async (model: NonNullable<CommandPayload<"settings.update">["model"]>) => {
      try {
        const settings = (await storyPilotApi.updateSettings({ model })) as RuntimeSettingsView;
        setRuntimeSettings(settings);
        message.success("模型配置已保存");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [message, storyPilotApi],
  );

  const saveStorageSettings = useCallback(
    async (storage: NonNullable<CommandPayload<"settings.update">["storage"]>) => {
      try {
        const settings = (await storyPilotApi.updateSettings({ storage })) as RuntimeSettingsView;
        setRuntimeSettings(settings);
        message.success("数据配置已保存");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [message, storyPilotApi],
  );

  const validateModelSettings = useCallback(
    async (input: CommandPayload<"settings.validateModel">) => {
      try {
        const result = (await storyPilotApi.validateModelSettings(input)) as {
          readonly errorCode?: string;
          readonly missingFields?: readonly string[];
          readonly ok: boolean;
          readonly statusCode?: number;
        };
        if (result.ok) {
          message.success("模型校验通过");
        } else {
          message.warning(
            result.missingFields?.length
              ? `模型配置缺失：${result.missingFields.join(", ")}`
              : getErrorMessage(
                  new Error(
                    result.statusCode
                      ? `OPENAI_COMPATIBLE_HTTP_ERROR: ${result.statusCode}`
                      : (result.errorCode ?? "模型校验失败"),
                  ),
                ),
          );
        }
        await loadRuntimeSettings();
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [loadRuntimeSettings, message, storyPilotApi],
  );

  const exportDiagnostics = useCallback(async () => {
    try {
      const result = (await storyPilotApi.exportDiagnostics()) as {
        readonly path?: string;
        readonly redacted?: boolean;
      };
      message.success(result.path ? `诊断包已导出：${result.path}` : "诊断包已导出");
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  }, [message, storyPilotApi]);

  return (
    <Layout className="story-shell">
      <header aria-label="应用标题栏" className="story-app-titlebar">
        <div className="story-app-titlebar__left">
          <Tooltip title={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}>
            <Button
              aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
              className="story-app-titlebar__control"
              icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              type="text"
            />
          </Tooltip>
          <span className="story-app-titlebar__divider" />
          <span className="story-app-titlebar__title">
            <FileTextOutlined />
            <span>{activeProject?.title ?? "Story Pilot"}</span>
          </span>
        </div>
        <div className="story-app-titlebar__right">
          <Text className="story-app-titlebar__module">
            {getWorkspaceModuleTitle(activeModuleKey)}
          </Text>
          <Tooltip title={inspectorCollapsed ? "展开检查器" : "收起检查器"}>
            <Button
              aria-label={inspectorCollapsed ? "展开检查器" : "收起检查器"}
              className="story-app-titlebar__control"
              icon={inspectorCollapsed ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
              onClick={() => setInspectorCollapsed(!inspectorCollapsed)}
              type="text"
            />
          </Tooltip>
        </div>
      </header>

      <Layout className="story-shell__body">
        <Sider
          aria-label="作品管理区"
          className="story-shell__sidebar"
          collapsed={sidebarCollapsed}
          collapsedWidth={76}
          trigger={null}
          width={292}
        >
          <ProjectSidebar
            activeModuleKey={activeModuleKey}
            activeProjectId={activeProject?.id}
            chapters={board?.chapters ?? []}
            collapsed={sidebarCollapsed}
            onCreateProject={() => setCreateProjectOpen(true)}
            onOpenProject={(projectId) => {
              void openProject(projectId).catch((error: unknown) => {
                message.error(getErrorMessage(error));
              });
            }}
            onOpenSettings={openSettings}
            onSelectChapter={selectChapter}
            onSelectModule={setActiveModuleKey}
            onToggleCollapsed={setSidebarCollapsed}
            projects={projects}
            selectedChapterId={selectedChapterId}
            showCollapseControl={false}
          />
        </Sider>

        <Content aria-label="工作台" className="story-shell__content">
          <header className="story-toolbar">
            <div>
              <Text className="story-eyebrow">{getWorkspaceModuleTitle(activeModuleKey)}</Text>
              <Title level={3}>{activeProject?.title ?? "Story Pilot"}</Title>
            </div>
          </header>

          <WorkbenchHome
            activeModuleKey={activeModuleKey}
            board={board}
            chapterVersions={chapterVersions}
            loading={loadingWorkbench}
            loadingChapterVersions={loadingChapterVersions}
            onAcceptElementCandidates={acceptElementCandidates}
            onAdvanceStage={advanceStage}
            onApplyBlueprint={applyBlueprint}
            onApplyChapterOutline={applyChapterOutline}
            onApproveChapterOutline={approveChapterOutline}
            onCompleteCoreStoryFields={completeCoreStoryFields}
            onCompleteStage={completeStage}
            onCompleteWorldbuildingFields={completeWorldbuildingFields}
            onConfirmBrief={confirmBrief}
            onConfirmMemory={confirmMemory}
            onCreateChapter={createChapter}
            onCreateCharacter={createCharacter}
            onCreateForeshadowing={createForeshadowing}
            onCreatePlotline={createPlotline}
            onCreatePlotlineNode={createPlotlineNode}
            onCreateStoryEvent={createStoryEvent}
            onCreateWorldRule={createWorldRule}
            onEvaluateStageGate={evaluateStageGate}
            onGenerateBlueprint={generateBlueprint}
            onGenerateBookPlan={generateBookPlan}
            onGenerateDraft={generateDraft}
            onGenerateDraftFromOutline={generateDraftFromOutline}
            onGenerateDraftFromPlan={generateDraftFromPlan}
            onGenerateElementCandidates={generateElementCandidates}
            onGenerateOutline={generateOutline}
            onGenerateRollingOutline={generateRollingOutline}
            onLoadChapterVersions={loadChapterVersions}
            onPlanForeshadowing={planForeshadowing}
            onRejectMemory={rejectMemory}
            onReopenStage={reopenStage}
            onRestoreChapterVersion={restoreChapterVersion}
            onSaveArcPlan={saveArcPlan}
            onSaveBookPlanDraft={saveBookPlanDraft}
            onSaveBrief={saveBrief}
            onSaveChapter={saveChapter}
            onSaveCoreStoryFields={saveCoreStoryFields}
            onSaveVolumePlan={saveVolumePlan}
            onSaveWorldbuildingFields={saveWorldbuildingFields}
            onSelectChapter={selectChapter}
            onSkipStage={skipStage}
            onUpdateCharacter={updateCharacter}
            onUpdateForeshadowing={updateForeshadowing}
            onUpdatePlotline={updatePlotline}
            onUpdatePlotlineNode={updatePlotlineNode}
            onUpdateStoryEvent={updateStoryEvent}
            savingChapter={savingChapter}
            selectedChapterId={selectedChapterId}
          />
        </Content>

        {inspectorCollapsed ? (
          <InspectorRail activeTabKey={inspectorTabKey} onSelectTab={openInspectorFromRail} />
        ) : (
          <WorkspaceInspector
            activeModuleKey={activeModuleKey}
            board={board}
            graphPreview={graphPreview}
            loadingGraphPreview={loadingGraphPreview}
            onAcceptElementCandidates={acceptElementCandidates}
            onApplyArtifact={applyArtifact}
            onGenerateElementCandidates={generateElementCandidates}
            onLoadGraphPreview={loadGraphPreview}
            onRejectArtifact={rejectArtifact}
            onTabChange={selectInspectorTab}
            selectedChapterId={selectedChapterId}
            tabKey={inspectorTabKey}
          />
        )}
      </Layout>

      <SettingsDrawer
        health={diagnosticsHealth}
        loading={loadingSettings}
        onClose={() => setSettingsOpen(false)}
        onExportDiagnostics={exportDiagnostics}
        onSaveModel={saveModelSettings}
        onSaveStorage={saveStorageSettings}
        onValidateModel={validateModelSettings}
        open={settingsOpen}
        settings={runtimeSettings}
      />

      <Modal
        footer={null}
        onCancel={() => setCreateProjectOpen(false)}
        open={createProjectOpen}
        title="新建作品"
      >
        <Form
          form={createProjectForm}
          initialValues={{ genre: "悬疑", style: "悬疑推理" }}
          layout="vertical"
          onFinish={createProject}
        >
          <Form.Item
            label="作品名称"
            name="title"
            rules={[{ required: true, message: "请输入作品名称" }]}
          >
            <Input autoFocus />
          </Form.Item>
          <Form.Item label="题材" name="genre">
            <Select aria-label="题材" options={[...GENRE_PRESETS]} />
          </Form.Item>
          <Form.Item label="风格" name="style">
            <Select aria-label="风格" options={[...STYLE_PRESETS]} />
          </Form.Item>
          <Form.Item label="一句话简介" name="logline">
            <Input.TextArea autoSize={{ maxRows: 4, minRows: 3 }} />
          </Form.Item>
          <Space>
            <Button onClick={() => setCreateProjectOpen(false)}>取消</Button>
            <Button htmlType="submit" loading={creatingProject} type="primary">
              创建作品
            </Button>
          </Space>
        </Form>
      </Modal>
    </Layout>
  );
}

function WorkspaceInspector({
  activeModuleKey,
  board,
  graphPreview,
  loadingGraphPreview,
  onAcceptElementCandidates,
  onApplyArtifact,
  onGenerateElementCandidates,
  onLoadGraphPreview,
  onRejectArtifact,
  onTabChange,
  selectedChapterId,
  tabKey,
}: {
  readonly activeModuleKey: WorkspaceModuleKey;
  readonly board?: WorkbenchBoard | undefined;
  readonly graphPreview?: GraphPreviewData | undefined;
  readonly loadingGraphPreview: boolean;
  readonly selectedChapterId?: string | undefined;
  readonly tabKey: InspectorTabKey;
  onAcceptElementCandidates(input: AcceptElementCandidatesValues): Promise<void> | void;
  onApplyArtifact(artifact: ArtifactReviewItem): Promise<void> | void;
  onGenerateElementCandidates(
    input: GenerateElementCandidatesValues,
  ): Promise<GenerateElementCandidatesResult>;
  onLoadGraphPreview(): Promise<void> | void;
  onRejectArtifact(artifact: ArtifactReviewItem): Promise<void> | void;
  onTabChange(tabKey: InspectorTabKey): void;
}) {
  return (
    <aside aria-label="创作检查器" className="story-inspector">
      <header className="story-inspector__header">
        <div>
          <Text className="story-section-title">Inspector</Text>
          <Title level={5}>创作检查器</Title>
        </div>
      </header>
      <Tabs
        activeKey={tabKey}
        className="story-inspector__tabs"
        onChange={(key) => onTabChange(key as InspectorTabKey)}
        size="small"
        items={[
          {
            children: <InspectorStatus activeModuleKey={activeModuleKey} board={board} />,
            key: "status",
            label: (
              <span>
                <BarsOutlined /> 状态
              </span>
            ),
          },
          {
            children: (
              <InspectorToolbox
                board={board}
                onAcceptElementCandidates={onAcceptElementCandidates}
                onGenerateElementCandidates={onGenerateElementCandidates}
              />
            ),
            key: "toolbox",
            label: (
              <span>
                <ToolOutlined /> 工具箱
              </span>
            ),
          },
          {
            children: (
              <InspectorArtifacts
                artifacts={board?.artifacts ?? []}
                workOrderCount={board?.workOrders.length ?? 0}
                onApplyArtifact={onApplyArtifact}
                onRejectArtifact={onRejectArtifact}
              />
            ),
            key: "artifacts",
            label: (
              <span>
                <RobotOutlined /> AI 产物
              </span>
            ),
          },
          {
            children: (
              <InspectorTimeline
                chapters={board?.chapters ?? []}
                selectedChapterId={selectedChapterId}
              />
            ),
            key: "timeline",
            label: (
              <span>
                <DatabaseOutlined /> 脉络
              </span>
            ),
          },
          {
            children: (
              <InspectorGraph
                disabled={!board || !selectedChapterId}
                graphPreview={graphPreview}
                loading={loadingGraphPreview}
                onLoadGraphPreview={onLoadGraphPreview}
              />
            ),
            key: "graph",
            label: (
              <span>
                <DeploymentUnitOutlined /> 图谱
              </span>
            ),
          },
        ]}
      />
    </aside>
  );
}

function InspectorRail({
  activeTabKey,
  onSelectTab,
}: {
  readonly activeTabKey: InspectorTabKey;
  onSelectTab(tabKey: InspectorTabKey): void;
}) {
  const items = [
    { icon: <BarsOutlined />, key: "status", label: "状态" },
    { icon: <ToolOutlined />, key: "toolbox", label: "工具箱" },
    { icon: <RobotOutlined />, key: "artifacts", label: "AI 产物" },
    { icon: <DatabaseOutlined />, key: "timeline", label: "脉络" },
    { icon: <DeploymentUnitOutlined />, key: "graph", label: "图谱" },
  ] as const;

  return (
    <aside aria-label="检查器快捷栏" className="story-inspector-rail">
      {items.map((item) => (
        <Tooltip key={item.key} placement="left" title={item.label}>
          <Button
            aria-label={`打开检查器：${item.label}`}
            icon={item.icon}
            onClick={() => onSelectTab(item.key)}
            type={activeTabKey === item.key ? "primary" : "text"}
          />
        </Tooltip>
      ))}
    </aside>
  );
}

function InspectorToolbox({
  board,
  onAcceptElementCandidates,
  onGenerateElementCandidates,
}: {
  readonly board?: WorkbenchBoard | undefined;
  onAcceptElementCandidates(input: AcceptElementCandidatesValues): Promise<void> | void;
  onGenerateElementCandidates(
    input: GenerateElementCandidatesValues,
  ): Promise<GenerateElementCandidatesResult>;
}) {
  const [form] = Form.useForm<InspectorToolboxFormValues>();
  const [candidateItems, setCandidateItems] = useState<readonly ElementCandidateItem[]>([]);
  const [selectedCandidateKeys, setSelectedCandidateKeys] = useState<readonly string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const previousProjectIdRef = useRef<string | undefined>(board?.project.id);
  const worldRuleItems = board?.worldRules ?? [];
  const defaultStyle = board?.project.style?.trim() || "通用";
  const selectedCandidates = candidateItems.filter((candidate, index) =>
    selectedCandidateKeys.includes(inspectorCandidateKey(candidate, index)),
  );

  useEffect(() => {
    if (previousProjectIdRef.current !== board?.project.id) {
      previousProjectIdRef.current = board?.project.id;
      setCandidateItems([]);
      setSelectedCandidateKeys([]);
    }

    form.setFieldsValue({
      style: defaultStyle,
      worldRuleIds: (board?.worldRules ?? []).map((rule) => rule.id),
    });
  }, [board, defaultStyle, form]);

  return (
    <div className="story-inspector__stack inspector-toolbox">
      <section
        aria-label="AI 生成工具箱"
        className="story-inspector__section inspector-toolbox__panel"
      >
        <Form
          className="inspector-toolbox__form"
          form={form}
          initialValues={{
            constraints: [],
            count: 10,
            elementType: "character_name",
            style: defaultStyle,
            worldRuleIds: worldRuleItems.map((rule) => rule.id),
          }}
          layout="vertical"
          name="inspectorToolboxForm"
          onFinish={async (values) => {
            if (!board) {
              setCandidateItems([]);
              setSelectedCandidateKeys([]);
              return;
            }

            setGenerating(true);
            try {
              const description = values.description?.trim();
              const result = await onGenerateElementCandidates({
                constraints: values.constraints ?? [],
                count: values.count,
                ...(description ? { description } : {}),
                elementType: values.elementType,
                genre: board.project.genre,
                style: values.style?.trim() || defaultStyle,
                worldRuleIds: values.worldRuleIds ?? [],
              });
              setCandidateItems(result.items);
              setSelectedCandidateKeys([]);
            } finally {
              setGenerating(false);
            }
          }}
        >
          <div className="inspector-toolbox__fields">
            <div className="inspector-toolbox__quick-grid">
              <Form.Item label="生成类型" name="elementType">
                <Select
                  aria-label="生成类型"
                  disabled={!board}
                  optionFilterProp="label"
                  options={[...ELEMENT_TYPE_PRESETS]}
                />
              </Form.Item>
              <Form.Item label="数量" name="count">
                <Select aria-label="数量" disabled={!board} options={[...COUNT_PRESETS]} />
              </Form.Item>
            </div>
            <Form.Item label="创作描述" name="description">
              <Input.TextArea
                aria-label="创作描述"
                autoSize={{ minRows: 3, maxRows: 5 }}
                disabled={!board}
                maxLength={500}
                placeholder="例如：围绕安全屋外部补给线生成可长期博弈的地下势力名称。"
                showCount
              />
            </Form.Item>
            <Form.Item label="风格" name="style">
              <Select
                aria-label="风格"
                disabled={!board}
                optionFilterProp="label"
                options={[...STYLE_PRESETS]}
              />
            </Form.Item>
            <Form.Item label="世界观约束" name="worldRuleIds">
              <Select
                aria-label="世界观约束"
                disabled={!board || worldRuleItems.length === 0}
                mode="multiple"
                optionFilterProp="label"
                options={worldRuleItems.map((rule) => ({ label: rule.title, value: rule.id }))}
                placeholder={worldRuleItems.length === 0 ? "暂无世界规则" : "默认使用全部世界规则"}
              />
            </Form.Item>
            <Form.Item label="额外约束" name="constraints">
              <Select
                aria-label="额外约束"
                disabled={!board}
                mode="tags"
                options={[
                  { label: "避免现代感", value: "避免现代感" },
                  { label: "适合长期伏笔", value: "适合长期伏笔" },
                  { label: "能推动冲突升级", value: "能推动冲突升级" },
                ]}
                placeholder="选择或输入约束"
                tokenSeparators={["，", ","]}
              />
            </Form.Item>
          </div>
          <Space className="inspector-toolbox__actions" wrap>
            <Button
              aria-label="生成候选"
              disabled={!board}
              htmlType="submit"
              icon={<ThunderboltOutlined />}
              loading={generating}
              type="primary"
            >
              生成候选
            </Button>
            <Button
              aria-label="采纳选中"
              disabled={selectedCandidates.length === 0}
              loading={accepting}
              onClick={async () => {
                if (selectedCandidates.length === 0) {
                  return;
                }
                setAccepting(true);
                try {
                  await onAcceptElementCandidates({ items: selectedCandidates });
                  setCandidateItems((currentItems) =>
                    currentItems.filter(
                      (candidate, index) =>
                        !selectedCandidateKeys.includes(inspectorCandidateKey(candidate, index)),
                    ),
                  );
                  setSelectedCandidateKeys([]);
                } finally {
                  setAccepting(false);
                }
              }}
            >
              采纳选中
            </Button>
          </Space>
        </Form>
      </section>

      <section
        aria-label="工具箱候选结果"
        className="story-inspector__section inspector-toolbox__results"
      >
        <div className="inspector-toolbox__result-header">
          <Text className="story-section-title">候选结果</Text>
          <Text type="secondary">{candidateItems.length} 个</Text>
        </div>
        {candidateItems.length === 0 ? (
          <Empty description="暂无候选" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <ul className="inspector-toolbox__list">
            {candidateItems.map((candidate, index) => {
              const key = inspectorCandidateKey(candidate, index);
              const checked = selectedCandidateKeys.includes(key);

              return (
                <li className="inspector-toolbox__candidate" key={key}>
                  <Checkbox
                    aria-label={`选择候选 ${candidate.name}`}
                    checked={checked}
                    onChange={(event) => {
                      setSelectedCandidateKeys((currentKeys) =>
                        event.target.checked
                          ? [...currentKeys, key]
                          : currentKeys.filter((candidateKey) => candidateKey !== key),
                      );
                    }}
                  />
                  <div className="inspector-toolbox__candidate-body">
                    <div className="inspector-toolbox__candidate-title">
                      <Text strong>{candidate.name}</Text>
                      <Tag>{getInspectorCandidateTypeLabel(candidate.type)}</Tag>
                    </div>
                    {candidate.description ? (
                      <Text type="secondary">{candidate.description}</Text>
                    ) : null}
                    {candidate.rationale ? <Text>{candidate.rationale}</Text> : null}
                    {candidate.tags && candidate.tags.length > 0 ? (
                      <Space size={[4, 4]} wrap>
                        {candidate.tags.map((tag) => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </Space>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function InspectorStatus({
  activeModuleKey,
  board,
}: {
  readonly activeModuleKey: WorkspaceModuleKey;
  readonly board?: WorkbenchBoard | undefined;
}) {
  if (!board) {
    return <Empty description="暂无打开的作品" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const stage = getShellStageForModule(board.creativePath, activeModuleKey);
  const foreshadowings = board.foreshadowings ?? [];
  const readyForeshadowingCount = foreshadowings.filter(
    (foreshadowing) => foreshadowing.status === "payoff_ready",
  ).length;
  const paidForeshadowingCount = foreshadowings.filter(
    (foreshadowing) => foreshadowing.status === "paid_off",
  ).length;
  const filledWorldbuildingFieldCount = countShellFilledWorldbuildingFields(
    board.worldbuildingProfile?.fields,
  );
  const estimatedWordCount =
    board.creativePath?.brief?.estimatedWordCount ?? board.project.wordCountGoal ?? null;
  const estimatedChapterCount = board.creativePath?.brief?.estimatedChapterCount ?? null;

  return (
    <div className="story-inspector__stack">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="当前模块">
          <Text strong>{getWorkspaceModuleTitle(activeModuleKey)}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="阶段状态">
          <Tag color={getShellStatusColor(stage?.status)}>{stage?.status ?? "available"}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="完成度">{stage?.readinessScore ?? 0}%</Descriptions.Item>
        <Descriptions.Item label="世界观">
          {filledWorldbuildingFieldCount}/{SHELL_WORLD_DIMENSION_COUNT}
        </Descriptions.Item>
        <Descriptions.Item label="人物">{board.characters?.length ?? 0}</Descriptions.Item>
        <Descriptions.Item label="故事线">{board.plotlines?.length ?? 0}</Descriptions.Item>
        <Descriptions.Item label="剧情节点">{board.storyEvents?.length ?? 0}</Descriptions.Item>
        <Descriptions.Item label="伏笔">{foreshadowings.length}</Descriptions.Item>
        <Descriptions.Item label="待回收">{readyForeshadowingCount}</Descriptions.Item>
        <Descriptions.Item label="已回收">{paidForeshadowingCount}</Descriptions.Item>
        <Descriptions.Item label="待审产物">{board.artifacts.length}</Descriptions.Item>
      </Descriptions>
      <section className="story-inspector__section" aria-label="写作上下文">
        <Text className="story-section-title">写作上下文</Text>
        <ul className="context-fact-list">
          <li>题材：{board.project.genre}</li>
          <li>风格：{board.project.style ?? "通用"}</li>
          <li>章节：{board.chapters.length}</li>
          <li>预计字数：{formatInspectorNumber(estimatedWordCount)}</li>
          <li>预计章节：{formatInspectorNumber(estimatedChapterCount)}</li>
          <li>待确认记忆：{board.memoryCandidates.length}</li>
        </ul>
      </section>
    </div>
  );
}

function InspectorArtifacts({
  artifacts,
  onApplyArtifact,
  onRejectArtifact,
  workOrderCount,
}: {
  readonly artifacts: readonly ArtifactReviewItem[];
  readonly workOrderCount: number;
  onApplyArtifact(artifact: ArtifactReviewItem): Promise<void> | void;
  onRejectArtifact(artifact: ArtifactReviewItem): Promise<void> | void;
}) {
  return (
    <div className="story-inspector__stack">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="运行任务">{workOrderCount} 个</Descriptions.Item>
        <Descriptions.Item label="待审产物">{artifacts.length} 条</Descriptions.Item>
      </Descriptions>
      <ArtifactReviewPanel
        artifacts={artifacts}
        onApply={onApplyArtifact}
        onReject={onRejectArtifact}
      />
    </div>
  );
}

function InspectorTimeline({
  chapters,
  selectedChapterId,
}: {
  readonly chapters: readonly WorkbenchChapter[];
  readonly selectedChapterId?: string | undefined;
}) {
  if (chapters.length === 0) {
    return <Empty description="暂无章节脉络" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Timeline
      items={chapters.map((chapter, index) => ({
        children: chapter.title,
        dot:
          chapter.id === selectedChapterId ? (
            <CheckCircleOutlined />
          ) : index === 0 ? (
            <ClockCircleOutlined />
          ) : (
            <FileTextOutlined />
          ),
      }))}
    />
  );
}

function InspectorGraph({
  disabled,
  graphPreview,
  loading,
  onLoadGraphPreview,
}: {
  readonly disabled: boolean;
  readonly graphPreview?: GraphPreviewData | undefined;
  readonly loading: boolean;
  onLoadGraphPreview(): Promise<void> | void;
}) {
  return (
    <div className="story-inspector__stack">
      <Button disabled={disabled} onClick={onLoadGraphPreview}>
        刷新图谱
      </Button>
      <GraphPreviewPanel loading={loading} neighborhood={graphPreview} />
    </div>
  );
}

function inspectorCandidateKey(candidate: ElementCandidateItem, index: number): string {
  return `${index}:${candidate.type}:${candidate.name}`;
}

function getInspectorCandidateTypeLabel(type: ElementCandidateItem["type"]): string {
  return ELEMENT_TYPE_PRESETS.find((option) => option.value === type)?.label ?? type;
}

function getShellStageForModule(
  creativePath: WorkbenchBoard["creativePath"],
  moduleKey: WorkspaceModuleKey,
): ShellStage | undefined {
  const stageKey = MODULE_STAGE_MAP[moduleKey];
  return stageKey ? creativePath?.stages.find((stage) => stage.stageKey === stageKey) : undefined;
}

function getShellStatusColor(status: string | undefined): string {
  if (status === "completed") {
    return "green";
  }
  if (status === "available") {
    return "blue";
  }
  if (status === "blocked" || status === "locked") {
    return "default";
  }
  return "gold";
}

function countShellFilledWorldbuildingFields(
  fields: WorldbuildingFields | null | undefined,
): number {
  if (!fields) {
    return 0;
  }

  return Object.values(fields).filter((value) => value.trim().length > 0).length;
}

function formatInspectorNumber(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("zh-CN") : "-";
}

function createProjectPayload(values: CreateProjectFormValues): CommandPayload<"project.create"> {
  const genre = values.genre?.trim();
  const logline = values.logline?.trim();
  const style = values.style?.trim();

  return {
    ...(genre ? { genre } : {}),
    ...(logline ? { logline } : {}),
    ...(style ? { style } : {}),
    title: values.title.trim(),
  };
}

function optionalText<TKey extends string>(
  key: TKey,
  value: string | undefined,
): Partial<Record<TKey, string>> {
  const trimmed = value?.trim();
  return trimmed ? ({ [key]: trimmed } as Record<TKey, string>) : {};
}

function nullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function nullableNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

function optionalNumber<TKey extends string>(
  key: TKey,
  value: number | null | undefined,
): Partial<Record<TKey, number>> {
  return typeof value === "number" && Number.isFinite(value)
    ? ({ [key]: Math.trunc(value) } as Record<TKey, number>)
    : {};
}

function upsertProject(
  currentProjects: readonly ProjectSidebarProject[],
  project: ProjectSidebarProject,
): readonly ProjectSidebarProject[] {
  const withoutProject = currentProjects.filter(
    (currentProject) => currentProject.id !== project.id,
  );

  return [project, ...withoutProject];
}

function replaceChapter(board: WorkbenchBoard, chapter: WorkbenchChapter): WorkbenchBoard {
  return {
    ...board,
    chapters: board.chapters.map((currentChapter) =>
      currentChapter.id === chapter.id ? chapter : currentChapter,
    ),
  };
}

function filterMemoryCandidate(
  board: WorkbenchBoard | undefined,
  candidateId: string,
): WorkbenchBoard | undefined {
  if (!board) {
    return board;
  }

  return {
    ...board,
    memoryCandidates: board.memoryCandidates.filter((candidate) => candidate.id !== candidateId),
  };
}

function resolveMemoryDecisionMessage(decision: MemoryCandidateDecisionInput["decision"]): string {
  switch (decision) {
    case "canon":
      return "记忆已确认";
    case "hypothesis":
      return "记忆已保留为假设";
    case "merge":
      return "记忆已合并";
  }
}

function getErrorMessage(error: unknown): string {
  return formatUserError(error);
}
