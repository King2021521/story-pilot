import { PlusOutlined } from "@ant-design/icons";
import { Button, Col, Empty, Form, Input, InputNumber, List, Row, Select, Space, Tag, Typography } from "antd";

const { Text, Title } = Typography;

export interface CharacterElement {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}

export interface WorldRuleElement {
  readonly category: string;
  readonly content: string;
  readonly id: string;
  readonly status: string;
  readonly title: string;
}

export interface PlotlineElement {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  readonly summary: string | null;
  readonly type: string;
}

export interface ForeshadowingElement {
  readonly id: string;
  readonly payoffText: string | null;
  readonly seedText: string | null;
  readonly status: string;
  readonly title: string;
}

export interface CreateCharacterValues {
  readonly name: string;
  readonly role: "protagonist" | "antagonist" | "support" | "cameo";
}

export interface CreateWorldRuleValues {
  readonly category: "magic" | "tech" | "society" | "history" | "geography" | "economy" | "custom";
  readonly constraintLevel: "hard" | "soft" | "optional";
  readonly statement: string;
  readonly title: string;
}

export interface CreatePlotlineValues {
  readonly kind: "main" | "branch" | "romance" | "mystery" | "growth" | "world";
  readonly priority: number;
  readonly summary?: string;
  readonly title: string;
}

export interface CreateForeshadowingValues {
  readonly description: string;
  readonly importance: number;
  readonly payoffExpectation?: string;
  readonly title: string;
}

export interface CreativeElementsPanelProps {
  readonly characters: readonly CharacterElement[];
  readonly foreshadowings: readonly ForeshadowingElement[];
  readonly plotlines: readonly PlotlineElement[];
  readonly worldRules: readonly WorldRuleElement[];
  onCreateCharacter(input: CreateCharacterValues): Promise<void> | void;
  onCreateForeshadowing(input: CreateForeshadowingValues): Promise<void> | void;
  onCreatePlotline(input: CreatePlotlineValues): Promise<void> | void;
  onCreateWorldRule(input: CreateWorldRuleValues): Promise<void> | void;
}

export function CreativeElementsPanel({
  characters,
  foreshadowings,
  onCreateCharacter,
  onCreateForeshadowing,
  onCreatePlotline,
  onCreateWorldRule,
  plotlines,
  worldRules,
}: CreativeElementsPanelProps) {
  const [characterForm] = Form.useForm<CreateCharacterValues>();
  const [worldRuleForm] = Form.useForm<CreateWorldRuleValues>();
  const [plotlineForm] = Form.useForm<CreatePlotlineValues>();
  const [foreshadowingForm] = Form.useForm<CreateForeshadowingValues>();

  return (
    <Row className="creative-elements" gutter={[14, 14]}>
      <Col lg={12} xs={24}>
        <section className="creative-panel">
          <Title level={5}>人物</Title>
          <Form
            form={characterForm}
            initialValues={{ role: "support" }}
            layout="vertical"
            name="characterForm"
            onFinish={async (values) => {
              await onCreateCharacter(values);
              characterForm.resetFields();
              characterForm.setFieldValue("role", "support");
            }}
          >
            <Form.Item label="人物名称" name="name" rules={[{ required: true, message: "请输入人物名称" }]}>
              <Input />
            </Form.Item>
            <Form.Item label="人物定位" name="role">
              <Select
                options={[
                  { label: "主角", value: "protagonist" },
                  { label: "反派", value: "antagonist" },
                  { label: "配角", value: "support" },
                  { label: "客串", value: "cameo" },
                ]}
              />
            </Form.Item>
            <Button aria-label="创建人物" htmlType="submit" icon={<PlusOutlined />} type="primary">
              创建人物
            </Button>
          </Form>
          <CompactList
            emptyText="暂无人物"
            items={characters.map((character) => ({
              id: character.id,
              label: character.name,
              tags: [character.role],
            }))}
          />
        </section>
      </Col>

      <Col lg={12} xs={24}>
        <section className="creative-panel">
          <Title level={5}>世界规则</Title>
          <Form
            form={worldRuleForm}
            initialValues={{ category: "custom", constraintLevel: "soft" }}
            layout="vertical"
            name="worldRuleForm"
            onFinish={async (values) => {
              await onCreateWorldRule(values);
              worldRuleForm.resetFields();
              worldRuleForm.setFieldsValue({ category: "custom", constraintLevel: "soft" });
            }}
          >
            <Form.Item label="规则标题" name="title" rules={[{ required: true, message: "请输入规则标题" }]}>
              <Input />
            </Form.Item>
            <Form.Item label="规则内容" name="statement" rules={[{ required: true, message: "请输入规则内容" }]}>
              <Input.TextArea autoSize={{ maxRows: 4, minRows: 2 }} />
            </Form.Item>
            <Space align="start" className="creative-panel__inline">
              <Form.Item label="规则分类" name="category">
                <Select
                  options={[
                    { label: "自定义", value: "custom" },
                    { label: "社会", value: "society" },
                    { label: "历史", value: "history" },
                    { label: "地理", value: "geography" },
                    { label: "经济", value: "economy" },
                    { label: "科技", value: "tech" },
                    { label: "魔法", value: "magic" },
                  ]}
                />
              </Form.Item>
              <Form.Item label="约束等级" name="constraintLevel">
                <Select
                  options={[
                    { label: "软约束", value: "soft" },
                    { label: "硬约束", value: "hard" },
                    { label: "可选", value: "optional" },
                  ]}
                />
              </Form.Item>
            </Space>
            <Button aria-label="创建规则" htmlType="submit" icon={<PlusOutlined />} type="primary">
              创建规则
            </Button>
          </Form>
          <CompactList
            emptyText="暂无世界规则"
            items={worldRules.map((rule) => ({
              description: rule.content,
              id: rule.id,
              label: rule.title,
              tags: [rule.category, rule.status],
            }))}
          />
        </section>
      </Col>

      <Col lg={12} xs={24}>
        <section className="creative-panel">
          <Title level={5}>故事线</Title>
          <Form
            form={plotlineForm}
            initialValues={{ kind: "branch", priority: 0 }}
            layout="vertical"
            name="plotlineForm"
            onFinish={async (values) => {
              await onCreatePlotline(values);
              plotlineForm.resetFields();
              plotlineForm.setFieldsValue({ kind: "branch", priority: 0 });
            }}
          >
            <Form.Item label="故事线标题" name="title" rules={[{ required: true, message: "请输入故事线标题" }]}>
              <Input />
            </Form.Item>
            <Form.Item label="故事线摘要" name="summary">
              <Input.TextArea autoSize={{ maxRows: 4, minRows: 2 }} />
            </Form.Item>
            <Space align="start" className="creative-panel__inline">
              <Form.Item label="故事线类型" name="kind">
                <Select
                  options={[
                    { label: "支线", value: "branch" },
                    { label: "主线", value: "main" },
                    { label: "悬疑", value: "mystery" },
                    { label: "成长", value: "growth" },
                    { label: "感情", value: "romance" },
                    { label: "世界线", value: "world" },
                  ]}
                />
              </Form.Item>
              <Form.Item label="优先级" name="priority">
                <InputNumber min={0} />
              </Form.Item>
            </Space>
            <Button aria-label="创建故事线" htmlType="submit" icon={<PlusOutlined />} type="primary">
              创建故事线
            </Button>
          </Form>
          <CompactList
            emptyText="暂无故事线"
            items={plotlines.map((plotline) => ({
              description: plotline.summary ?? undefined,
              id: plotline.id,
              label: plotline.name,
              tags: [plotline.type, `P${plotline.priority}`],
            }))}
          />
        </section>
      </Col>

      <Col lg={12} xs={24}>
        <section className="creative-panel">
          <Title level={5}>伏笔</Title>
          <Form
            form={foreshadowingForm}
            initialValues={{ importance: 3 }}
            layout="vertical"
            name="foreshadowingForm"
            onFinish={async (values) => {
              await onCreateForeshadowing(values);
              foreshadowingForm.resetFields();
              foreshadowingForm.setFieldValue("importance", 3);
            }}
          >
            <Form.Item label="伏笔标题" name="title" rules={[{ required: true, message: "请输入伏笔标题" }]}>
              <Input />
            </Form.Item>
            <Form.Item label="伏笔内容" name="description" rules={[{ required: true, message: "请输入伏笔内容" }]}>
              <Input.TextArea autoSize={{ maxRows: 4, minRows: 2 }} />
            </Form.Item>
            <Form.Item label="重要性" name="importance">
              <InputNumber max={5} min={1} />
            </Form.Item>
            <Button aria-label="创建伏笔" htmlType="submit" icon={<PlusOutlined />} type="primary">
              创建伏笔
            </Button>
          </Form>
          <CompactList
            emptyText="暂无伏笔"
            items={foreshadowings.map((foreshadowing) => ({
              description: foreshadowing.seedText ?? undefined,
              id: foreshadowing.id,
              label: foreshadowing.title,
              tags: [foreshadowing.status],
            }))}
          />
        </section>
      </Col>
    </Row>
  );
}

interface CompactListItem {
  readonly description?: string | undefined;
  readonly id: string;
  readonly label: string;
  readonly tags: readonly string[];
}

function CompactList({ emptyText, items }: { readonly emptyText: string; readonly items: readonly CompactListItem[] }) {
  if (items.length === 0) {
    return <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <List
      className="creative-list"
      dataSource={[...items]}
      renderItem={(item) => (
        <List.Item>
          <Space direction="vertical" size={4}>
            <Text strong>{item.label}</Text>
            {item.description ? <Text type="secondary">{item.description}</Text> : null}
            <Space size={6} wrap>
              {item.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </Space>
          </Space>
        </List.Item>
      )}
    />
  );
}
