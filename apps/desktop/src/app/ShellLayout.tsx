import {
  AppstoreOutlined,
  BarsOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import type { CommandPayload } from "@story-pilot/contracts";
import { GENRE_PRESETS, STYLE_PRESETS } from "@story-pilot/presets";
import {
  App as AntApp,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Layout,
  Modal,
  Select,
  Space,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from "antd";
import { useCallback, useEffect, useState } from "react";

import { ArtifactReviewPanel, type ArtifactReviewItem } from "../features/ai/ArtifactReviewPanel";
import { AiTaskDrawer } from "../features/ai/AiTaskDrawer";
import type { ChapterVersionItem } from "../features/chapter/ChapterVersionDrawer";
import type {
  CompletableCreativeStageKey,
  SaveBriefValues,
} from "../features/creative-path/CreativePathWorkbench";
import type {
  AcceptElementCandidatesValues,
  ElementCandidateItem,
  GenerateElementCandidatesResult,
  GenerateElementCandidatesValues,
} from "../features/creative/CreativeElementsPanel";
import { GraphPreviewPanel, type GraphPreviewData } from "../features/memory/GraphPreviewPanel";
import type { MemoryCandidateDecisionInput } from "../features/memory/MemoryConfirmDrawer";
import { ProjectSidebar, type ProjectSidebarProject } from "../features/project/ProjectSidebar";
import {
  WorkbenchHome,
  type WorkbenchBoard,
  type WorkbenchChapter,
  type WorkbenchProject,
} from "../features/workbench/WorkbenchHome";
import { useStoryPilotApi } from "../shared/rpc/useStoryPilotApi";

const { Content, Sider } = Layout;
const { Text, Title } = Typography;

interface CreateProjectFormValues {
  readonly genre?: string;
  readonly logline?: string;
  readonly style?: string;
  readonly title: string;
}

export function ShellLayout() {
  const { message } = AntApp.useApp();
  const storyPilotApi = useStoryPilotApi();
  const [activeProject, setActiveProject] = useState<WorkbenchProject | undefined>();
  const [board, setBoard] = useState<WorkbenchBoard | undefined>();
  const [boardOpen, setBoardOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
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
  const [createProjectForm] = Form.useForm<CreateProjectFormValues>();

  const selectChapter = useCallback((chapterId: string) => {
    setSelectedChapterId(chapterId);
    setChapterVersions([]);
    setGraphPreview(undefined);
  }, []);

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
        setAiOpen(true);
        await refreshBoard(activeProject.id);
        message.success("AI 草稿已进入产物区");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
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

  const createForeshadowing = useCallback(
    async (input: Omit<CommandPayload<"foreshadowing.create">, "projectId">) => {
      if (!activeProject) {
        return;
      }

      try {
        await storyPilotApi.createForeshadowing({
          ...input,
          projectId: activeProject.id,
        });
        await refreshBoard(activeProject.id);
        message.success("伏笔已创建");
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

      try {
        return (await storyPilotApi.generateElementCandidates({
          constraints: [...input.constraints],
          count: input.count,
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

  const generateBlueprint = useCallback(async () => {
    if (!activeProject) {
      return;
    }

    try {
      await storyPilotApi.generateBlueprint({ projectId: activeProject.id });
      await refreshBoard(activeProject.id);
      message.success("创作蓝图已生成");
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  }, [activeProject, message, refreshBoard, storyPilotApi]);

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
        message.success("创作蓝图已应用");
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
        await storyPilotApi.generateOutline({
          chapterCount: input.chapterCount,
          projectId: activeProject.id,
          scope: input.scope,
        });
        await refreshBoard(activeProject.id);
        message.success("章纲已生成");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
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
        setAiOpen(true);
        await refreshBoard(activeProject.id);
        message.success("章纲草稿已进入产物区");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, refreshBoard, storyPilotApi],
  );

  return (
    <Layout className="story-shell">
      <Sider aria-label="作品管理区" className="story-shell__sidebar" width={292}>
        <ProjectSidebar
          activeProjectId={activeProject?.id}
          chapters={board?.chapters ?? []}
          onCreateProject={() => setCreateProjectOpen(true)}
          onOpenProject={(projectId) => {
            void openProject(projectId).catch((error: unknown) => {
              message.error(getErrorMessage(error));
            });
          }}
          onSelectChapter={selectChapter}
          projects={projects}
          selectedChapterId={selectedChapterId}
        />
      </Sider>

      <Content aria-label="工作台" className="story-shell__content">
        <header className="story-toolbar">
          <div>
            <Text className="story-eyebrow">工作台</Text>
            <Title level={3}>{activeProject?.title ?? "Story Pilot"}</Title>
          </div>
          <Space wrap>
            <Button
              aria-label="项目看板"
              icon={<AppstoreOutlined />}
              onClick={() => setBoardOpen(true)}
            >
              项目看板
            </Button>
            <Button
              aria-label="AI 任务"
              icon={<RobotOutlined />}
              onClick={() => setAiOpen(true)}
              type="primary"
            >
              AI 任务
            </Button>
          </Space>
        </header>

        <WorkbenchHome
          board={board}
          chapterVersions={chapterVersions}
          loadingChapterVersions={loadingChapterVersions}
          loading={loadingWorkbench}
          onApplyBlueprint={applyBlueprint}
          onApplyChapterOutline={applyChapterOutline}
          onApproveChapterOutline={approveChapterOutline}
          onCompleteStage={completeStage}
          onConfirmBrief={confirmBrief}
          onConfirmMemory={confirmMemory}
          onAcceptElementCandidates={acceptElementCandidates}
          onCreateChapter={createChapter}
          onCreateCharacter={createCharacter}
          onCreateForeshadowing={createForeshadowing}
          onCreatePlotline={createPlotline}
          onCreateWorldRule={createWorldRule}
          onGenerateBlueprint={generateBlueprint}
          onGenerateDraft={generateDraft}
          onGenerateDraftFromOutline={generateDraftFromOutline}
          onGenerateElementCandidates={generateElementCandidates}
          onGenerateOutline={generateOutline}
          onLoadChapterVersions={loadChapterVersions}
          onRejectMemory={rejectMemory}
          onRestoreChapterVersion={restoreChapterVersion}
          onSaveChapter={saveChapter}
          onSaveBrief={saveBrief}
          onSelectChapter={selectChapter}
          savingChapter={savingChapter}
          selectedChapterId={selectedChapterId}
        />
      </Content>

      <Drawer
        onClose={() => setBoardOpen(false)}
        open={boardOpen}
        placement="right"
        size="default"
        title="项目看板"
      >
        <Tabs
          onChange={(key) => {
            if (key === "graph") {
              void loadGraphPreview();
            }
          }}
          items={[
            {
              children: (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="章节状态">
                    <Tag color={activeProject ? "processing" : "default"}>
                      {activeProject ? `${board?.chapters.length ?? 0} 章` : "未打开作品"}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="待确认记忆">
                    {board?.memoryCandidates.length ?? 0} 条
                  </Descriptions.Item>
                  <Descriptions.Item label="待审产物">
                    {board?.artifacts.length ?? 0} 条
                  </Descriptions.Item>
                  <Descriptions.Item label="AI 任务">
                    {board?.workOrders.length ?? 0} 个
                  </Descriptions.Item>
                </Descriptions>
              ),
              key: "overview",
              label: (
                <span>
                  <BarsOutlined /> 概览
                </span>
              ),
            },
            {
              children: (
                <ArtifactReviewPanel
                  artifacts={board?.artifacts ?? []}
                  onApply={applyArtifact}
                  onReject={rejectArtifact}
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
                <Timeline
                  items={(board?.chapters ?? []).map((chapter, index) => ({
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
                <GraphPreviewPanel loading={loadingGraphPreview} neighborhood={graphPreview} />
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
      </Drawer>

      <AiTaskDrawer onClose={() => setAiOpen(false)} open={aiOpen} />

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
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败";
}
