import { ApiOutlined, ExportOutlined, SaveOutlined } from "@ant-design/icons";
import type { CommandPayload } from "@story-pilot/contracts";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { useEffect } from "react";

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
    <Drawer
      className="settings-drawer"
      loading={loading}
      onClose={onClose}
      open={open}
      placement="right"
      size="large"
      title="设置"
    >
      <Tabs
        items={[
          {
            children: (
              <div className="settings-drawer__panel">
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
                  <Descriptions.Item label="配置文件">
                    {health?.settingsPath ?? "-"}
                  </Descriptions.Item>
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
                    onClick={() => void submitModel()}
                    type="primary"
                  >
                    保存模型配置
                  </Button>
                  <Button
                    aria-label="校验模型"
                    icon={<ApiOutlined />}
                    onClick={() => void validateModel()}
                  >
                    校验模型
                  </Button>
                </Space>
              </div>
            ),
            key: "model",
            label: "模型配置",
          },
          {
            children: (
              <div className="settings-drawer__panel">
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="数据目录">
                    {settings?.storage.homeDir ?? "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="项目目录">
                    {health?.projectsRoot ?? "-"}
                  </Descriptions.Item>
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
                  onClick={() => void submitStorage()}
                  type="primary"
                >
                  保存数据配置
                </Button>
              </div>
            ),
            key: "storage",
            label: "数据与备份",
          },
          {
            children: (
              <div className="settings-drawer__panel">
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
                  <Descriptions.Item label="作品数量">
                    {health?.projectCount ?? 0}
                  </Descriptions.Item>
                  <Descriptions.Item label="配置文件">
                    {health?.settingsPath ?? "-"}
                  </Descriptions.Item>
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
            ),
            key: "diagnostics",
            label: "诊断信息",
          },
        ]}
      />
    </Drawer>
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
