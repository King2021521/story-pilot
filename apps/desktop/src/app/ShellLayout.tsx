import {
  AppstoreOutlined,
  BarsOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import type { CommandName, CommandPayload } from "@story-pilot/contracts";
import {
  App as AntApp,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Layout,
  Modal,
  Space,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AiTaskDrawer } from "../features/ai/AiTaskDrawer";
import { ProjectSidebar, type ProjectSidebarProject } from "../features/project/ProjectSidebar";
import {
  WorkbenchHome,
  type WorkbenchBoard,
  type WorkbenchChapter,
  type WorkbenchProject,
} from "../features/workbench/WorkbenchHome";
import { TauriRpcClient, type RpcClient } from "../shared/rpc/rpc-client";

const { Content, Sider } = Layout;
const { Text, Title } = Typography;

interface CreateProjectFormValues {
  readonly genre?: string;
  readonly logline?: string;
  readonly title: string;
}

export function ShellLayout() {
  const { message } = AntApp.useApp();
  const rpcClient = useMemo<RpcClient>(() => new TauriRpcClient(), []);
  const [activeProject, setActiveProject] = useState<WorkbenchProject | undefined>();
  const [board, setBoard] = useState<WorkbenchBoard | undefined>();
  const [boardOpen, setBoardOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [loadingWorkbench, setLoadingWorkbench] = useState(true);
  const [projects, setProjects] = useState<readonly ProjectSidebarProject[]>([]);
  const [savingChapter, setSavingChapter] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string | undefined>();
  const [createProjectForm] = Form.useForm<CreateProjectFormValues>();

  const refreshBoard = useCallback(
    async (projectId: string) => {
      const nextBoard = await sendRpcData<"workbench.getBoard", WorkbenchBoard>(
        rpcClient,
        "workbench.getBoard",
        { projectId },
      );
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
    [rpcClient],
  );

  const openProject = useCallback(
    async (projectId: string) => {
      const project = await sendRpcData<"project.open", WorkbenchProject>(
        rpcClient,
        "project.open",
        {
          projectId,
        },
      );
      setActiveProject(project);
      setProjects((currentProjects) => upsertProject(currentProjects, project));
      await refreshBoard(project.id);
    },
    [refreshBoard, rpcClient],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialProject() {
      setLoadingWorkbench(true);
      try {
        const recentProjects = await sendRpcData<"project.listRecent", WorkbenchProject[]>(
          rpcClient,
          "project.listRecent",
          { limit: 20 },
        );
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

        const project = await sendRpcData<"project.open", WorkbenchProject>(
          rpcClient,
          "project.open",
          {
            projectId: firstProject.id,
          },
        );
        const nextBoard = await sendRpcData<"workbench.getBoard", WorkbenchBoard>(
          rpcClient,
          "workbench.getBoard",
          { projectId: project.id },
        );
        if (cancelled) {
          return;
        }
        setActiveProject(project);
        setBoard(nextBoard);
        setProjects((currentProjects) => upsertProject(currentProjects, project));
        setSelectedChapterId(nextBoard.chapters[0]?.id);
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
  }, [message, rpcClient]);

  const createProject = useCallback(
    async (values: CreateProjectFormValues) => {
      setCreatingProject(true);
      try {
        const project = await sendRpcData<"project.create", WorkbenchProject>(
          rpcClient,
          "project.create",
          createProjectPayload(values),
        );
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
    [createProjectForm, message, refreshBoard, rpcClient],
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
        const chapter = await sendRpcData<"chapter.saveContent", WorkbenchChapter>(
          rpcClient,
          "chapter.saveContent",
          {
            ...input,
            projectId: activeProject.id,
          },
        );
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
    [activeProject, message, rpcClient],
  );

  const generateDraft = useCallback(
    async (input: { readonly chapterId: string; readonly instruction: string }) => {
      if (!activeProject) {
        return;
      }

      try {
        await sendRpcData<"chapter.generateDraft", unknown>(rpcClient, "chapter.generateDraft", {
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
    [activeProject, message, refreshBoard, rpcClient],
  );

  const acceptMemory = useCallback(
    async (candidateId: string) => {
      if (!activeProject) {
        return;
      }

      try {
        await sendRpcData<"memory.confirm", unknown>(rpcClient, "memory.confirm", {
          candidateId,
          decision: "canon",
          projectId: activeProject.id,
        });
        setBoard((currentBoard) => filterMemoryCandidate(currentBoard, candidateId));
        message.success("记忆已确认");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, rpcClient],
  );

  const rejectMemory = useCallback(
    async (candidateId: string) => {
      if (!activeProject) {
        return;
      }

      try {
        await sendRpcData<"memory.reject", unknown>(rpcClient, "memory.reject", {
          candidateId,
          projectId: activeProject.id,
        });
        setBoard((currentBoard) => filterMemoryCandidate(currentBoard, candidateId));
        message.success("候选记忆已拒绝");
      } catch (error) {
        message.error(getErrorMessage(error));
      }
    },
    [activeProject, message, rpcClient],
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
          onSelectChapter={setSelectedChapterId}
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
          loading={loadingWorkbench}
          onAcceptMemory={acceptMemory}
          onGenerateDraft={generateDraft}
          onRejectMemory={rejectMemory}
          onSaveChapter={saveChapter}
          onSelectChapter={setSelectedChapterId}
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
        <Form form={createProjectForm} layout="vertical" onFinish={createProject}>
          <Form.Item
            label="作品名称"
            name="title"
            rules={[{ required: true, message: "请输入作品名称" }]}
          >
            <Input autoFocus />
          </Form.Item>
          <Form.Item label="题材" name="genre">
            <Input placeholder="悬疑 / 都市 / 奇幻" />
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

async function sendRpcData<TCommand extends CommandName, TData>(
  rpcClient: RpcClient,
  command: TCommand,
  payload: CommandPayload<TCommand>,
): Promise<TData> {
  const response = await rpcClient.send(command, payload);
  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data as TData;
}

function createProjectPayload(values: CreateProjectFormValues): CommandPayload<"project.create"> {
  const genre = values.genre?.trim();
  const logline = values.logline?.trim();

  return {
    ...(genre ? { genre } : {}),
    ...(logline ? { logline } : {}),
    title: values.title.trim(),
  };
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败";
}
