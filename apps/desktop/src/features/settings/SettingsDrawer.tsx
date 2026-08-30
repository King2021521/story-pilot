import {
  ApiOutlined,
  BugOutlined,
  DatabaseOutlined,
  ExportOutlined,
  RobotOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import type { CommandPayload } from "@story-pilot/contracts";
import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Skeleton,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import type { FormInstance } from "antd";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const { Paragraph, Text } = Typography;

export interface RuntimeSettingsView {
  readonly model: {
    readonly apiKey: string;
    readonly baseUrl: string;
    readonly embeddingModel: string;
    readonly maxRetries: number;
    readonly model: string;
    readonly provider: "openai-compatible";
    readonly timeoutMs: number;
  };
  readonly privacy: {
    readonly allowDiagnosticsExport: boolean;
    readonly redactApiKeyInLogs: boolean;
  };
  readonly storage: {
    readonly autoBackup: boolean;
    readonly backupRetention: number;
    readonly homeDir: string;
  };
  readonly version: number;
}

export interface DiagnosticsHealthView {
  readonly appHome: string;
  readonly globalDatabasePath?: string;
  readonly model: "configured" | "failed" | "missing";
  readonly projectCount: number;
  readonly projectsRoot?: string;
  readonly settingsPath?: string;
  readonly sidecar: "degraded" | "failed" | "ok";
  readonly storage: "degraded" | "failed" | "ok";
}

interface ModelFormValues {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly embeddingModel: string;
  readonly maxRetries: number;
  readonly model: string;
  readonly timeoutMs: number;
}

interface StorageFormValues {
  readonly autoBackup: boolean;
  readonly backupRetention: number;
}

type SettingsSectionKey = "model" | "storage" | "diagnostics";

interface SettingsSectionDefinition {
  readonly description: string;
  readonly icon: ReactNode;
  readonly key: SettingsSectionKey;
  readonly label: string;
}

const DEFAULT_SETTINGS_SECTION: SettingsSectionDefinition = {
  description: "管理 AI 生成内容时使用的 OpenAI-compatible 模型。",
  icon: <RobotOutlined />,
  key: "model",
  label: "模型配置",
};

const SETTINGS_SECTIONS: readonly SettingsSectionDefinition[] = [
  DEFAULT_SETTINGS_SECTION,
  {
    description: "查看本地数据目录，并调整自动备份策略。",
    icon: <DatabaseOutlined />,
    key: "storage",
    label: "数据与备份",
  },
  {
    description: "检查 sidecar、存储和模型健康状态，导出脱敏诊断包。",
    icon: <BugOutlined />,
    key: "diagnostics",
    label: "诊断信息",
  },
];

export interface SettingsDrawerProps {
  readonly health?: DiagnosticsHealthView | undefined;
  readonly loading?: boolean;
  readonly open: boolean;
  readonly settings?: RuntimeSettingsView | undefined;
  onClose(): void;
  onExportDiagnostics(): Promise<void> | void;
  onSaveModel(input: NonNullable<CommandPayload<"settings.update">["model"]>): Promise<void> | void;
  onSaveStorage(
    input: NonNullable<CommandPayload<"settings.update">["storage"]>,
  ): Promise<void> | void;
  onValidateModel(input: CommandPayload<"settings.validateModel">): Promise<void> | void;
}

export function SettingsDrawer({
  health,
  loading = false,
  onClose,
  onExportDiagnostics,
  onSaveModel,
  onSaveStorage,
  onValidateModel,
  open,
  settings,
}: SettingsDrawerProps) {
  const [modelForm] = Form.useForm<ModelFormValues>();
  const [storageForm] = Form.useForm<StorageFormValues>();
  const [activeSectionKey, setActiveSectionKey] = useState<SettingsSectionKey>("model");

  const activeSection = useMemo(
    () =>
      SETTINGS_SECTIONS.find((section) => section.key === activeSectionKey) ??
      DEFAULT_SETTINGS_SECTION,
    [activeSectionKey],
  );

  useEffect(() => {
    if (!open || !settings) {
      return;
    }

    modelForm.setFieldsValue({
      apiKey: settings.model.apiKey,
      baseUrl: settings.model.baseUrl,
      embeddingModel: settings.model.embeddingModel,
      maxRetries: settings.model.maxRetries,
      model: settings.model.model,
      timeoutMs: settings.model.timeoutMs,
    });
    storageForm.setFieldsValue({
      autoBackup: settings.storage.autoBackup,
      backupRetention: settings.storage.backupRetention,
    });
  }, [modelForm, open, settings, storageForm]);

  const submitModel = async () => {
    const values = await modelForm.validateFields();
    await onSaveModel({
      apiKey: values.apiKey.trim(),
      baseUrl: values.baseUrl.trim(),
      embeddingModel: values.embeddingModel.trim(),
      maxRetries: values.maxRetries,
      model: values.model.trim(),
      provider: "openai-compatible",
      timeoutMs: values.timeoutMs,
    });
  };

  const validateModel = async () => {
    const values = await modelForm.validateFields();
    await onValidateModel({
      apiKey: values.apiKey.trim(),
      baseUrl: values.baseUrl.trim(),
      model: values.model.trim(),
    });
  };

  const submitStorage = async () => {
    const values = await storageForm.validateFields();
    await onSaveStorage({
      autoBackup: values.autoBackup,
      backupRetention: values.backupRetention,
    });
  };

  return (
    <Modal
      className="settings-workspace-modal"
      destroyOnHidden={false}
      footer={null}
      onCancel={onClose}
      open={open}
      title="设置"
      width={1080}
    >
      <section aria-label="设置工作区" className="settings-workspace">
        <aside aria-label="设置菜单" className="settings-workspace__nav">
          <div className="settings-workspace__nav-heading">
            <Text className="story-eyebrow">Settings</Text>
            <Text strong>应用设置</Text>
          </div>
          <nav className="settings-workspace__menu">
            {SETTINGS_SECTIONS.map((section) => (
              <button
                aria-label={section.label}
                aria-pressed={activeSectionKey === section.key}
                className={
                  activeSectionKey === section.key
                    ? "settings-workspace__menu-item settings-workspace__menu-item--active"
                    : "settings-workspace__menu-item"
                }
                key={section.key}
                onClick={() => setActiveSectionKey(section.key)}
                type="button"
              >
                <span aria-hidden="true" className="settings-workspace__menu-icon">
                  {section.icon}
                </span>
                <span>
                  <span className="settings-workspace__menu-title">{section.label}</span>
                  <span className="settings-workspace__menu-description">
                    {section.description}
                  </span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <main aria-label="设置内容" className="settings-workspace__content">
          <header className="settings-workspace__content-header">
            <Text className="story-eyebrow">设置</Text>
            <Typography.Title level={3}>{activeSection.label}</Typography.Title>
            <Paragraph type="secondary">{activeSection.description}</Paragraph>
          </header>

          {loading ? (
            <div className="settings-workspace__panel">
              <Skeleton active paragraph={{ rows: 8 }} title={{ width: "36%" }} />
            </div>
          ) : (
            <SettingsSectionPanel
              activeSectionKey={activeSectionKey}
              health={health}
              modelForm={modelForm}
              onExportDiagnostics={onExportDiagnostics}
              onSubmitModel={submitModel}
              onSubmitStorage={submitStorage}
              onValidateModel={validateModel}
              settings={settings}
              storageForm={storageForm}
            />
          )}
        </main>
      </section>
    </Modal>
  );
}

function SettingsSectionPanel({
  activeSectionKey,
  health,
  modelForm,
  onExportDiagnostics,
  onSubmitModel,
  onSubmitStorage,
  onValidateModel,
  settings,
  storageForm,
}: {
  readonly activeSectionKey: SettingsSectionKey;
  readonly health?: DiagnosticsHealthView | undefined;
  readonly modelForm: FormInstance<ModelFormValues>;
  onExportDiagnostics(): Promise<void> | void;
  onSubmitModel(): Promise<void>;
  onSubmitStorage(): Promise<void>;
  onValidateModel(): Promise<void>;
  readonly settings?: RuntimeSettingsView | undefined;
  readonly storageForm: FormInstance<StorageFormValues>;
}) {
  if (activeSectionKey === "storage") {
    return (
      <div className="settings-workspace__panel">
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="数据目录">{settings?.storage.homeDir ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="项目目录">{health?.projectsRoot ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="全局数据库">
            {health?.globalDatabasePath ?? "-"}
          </Descriptions.Item>
        </Descriptions>
        <Form form={storageForm} layout="vertical">
          <Form.Item label="自动备份" name="autoBackup" valuePropName="checked">
            <Switch aria-label="自动备份" />
          </Form.Item>
          <Form.Item label="备份保留数量" name="backupRetention">
            <InputNumber aria-label="备份保留数量" max={365} min={1} />
          </Form.Item>
        </Form>
        <Button
          aria-label="保存数据配置"
          icon={<SaveOutlined />}
          onClick={() => void onSubmitStorage()}
          type="primary"
        >
          保存数据配置
        </Button>
      </div>
    );
  }

  if (activeSectionKey === "diagnostics") {
    return (
      <div className="settings-workspace__panel">
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Sidecar">
            <StatusTag status={health?.sidecar} />
          </Descriptions.Item>
          <Descriptions.Item label="存储">
            <StatusTag status={health?.storage} />
          </Descriptions.Item>
          <Descriptions.Item label="模型">
            <StatusTag status={health?.model} />
          </Descriptions.Item>
          <Descriptions.Item label="作品数量">{health?.projectCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="配置文件">{health?.settingsPath ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="数据目录">{health?.appHome ?? "-"}</Descriptions.Item>
        </Descriptions>
        <Paragraph type="secondary">
          诊断包会脱敏模型密钥，并只导出运行状态、路径、日志摘要和健康信息。
        </Paragraph>
        <Button
          aria-label="导出诊断包"
          icon={<ExportOutlined />}
          onClick={() => void onExportDiagnostics()}
        >
          导出诊断包
        </Button>
      </div>
    );
  }

  return (
    <div className="settings-workspace__panel">
      <Alert
        title={
          health?.model === "configured"
            ? "真实模型已配置"
            : "未配置真实模型时，AI 生成功能会被阻断。"
        }
        showIcon
        type={health?.model === "configured" ? "success" : "warning"}
      />
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="配置文件">{health?.settingsPath ?? "-"}</Descriptions.Item>
      </Descriptions>
      <Form form={modelForm} layout="vertical">
        <Form.Item
          label="Base URL"
          name="baseUrl"
          rules={[{ required: true, message: "请输入 OpenAI-compatible Base URL" }]}
        >
          <Input aria-label="Base URL" placeholder="https://api.example.com/v1" />
        </Form.Item>
        <Form.Item
          label="API Key"
          name="apiKey"
          rules={[{ required: true, message: "请输入 API Key" }]}
        >
          <Input.Password aria-label="API Key" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label="模型名称"
          name="model"
          rules={[{ required: true, message: "请输入模型名称" }]}
        >
          <Input aria-label="模型名称" />
        </Form.Item>
        <Form.Item label="Embedding 模型" name="embeddingModel">
          <Input aria-label="Embedding 模型" />
        </Form.Item>
        <Space size={12}>
          <Form.Item label="超时毫秒" name="timeoutMs">
            <InputNumber aria-label="超时毫秒" min={1000} step={1000} />
          </Form.Item>
          <Form.Item label="最大重试" name="maxRetries">
            <InputNumber aria-label="最大重试" max={10} min={0} />
          </Form.Item>
        </Space>
      </Form>
      <Space wrap>
        <Button
          aria-label="保存模型配置"
          icon={<SaveOutlined />}
          onClick={() => void onSubmitModel()}
          type="primary"
        >
          保存模型配置
        </Button>
        <Button aria-label="校验模型" icon={<ApiOutlined />} onClick={() => void onValidateModel()}>
          校验模型
        </Button>
      </Space>
    </div>
  );
}

function StatusTag({
  status,
}: {
  readonly status: "configured" | "degraded" | "failed" | "missing" | "ok" | undefined;
}) {
  if (!status) {
    return <Text type="secondary">-</Text>;
  }

  const color = status === "ok" || status === "configured" ? "green" : "orange";
  return <Tag color={color}>{status}</Tag>;
}
