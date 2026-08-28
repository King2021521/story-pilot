import { PlusOutlined, ThunderboltOutlined } from "@ant-design/icons";
import {
  COUNT_PRESETS,
  ELEMENT_TYPE_PRESETS,
  STYLE_PRESETS,
  type CountPresetValue,
  type ElementTypePresetValue,
} from "@story-pilot/presets";
import {
  Button,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";

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

export interface WorldElement {
  readonly description?: string | null;
  readonly id: string;
  readonly name: string;
  readonly status?: string;
  readonly type: string;
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

export interface ElementCandidateItem {
  readonly description?: string;
  readonly name: string;
  readonly rationale?: string;
  readonly tags?: readonly string[];
  readonly type: ElementTypePresetValue;
}

export interface GenerateElementCandidatesValues {
  readonly constraints: readonly string[];
  readonly count: CountPresetValue;
  readonly elementType: ElementTypePresetValue;
  readonly genre: string;
  readonly style?: string;
  readonly worldRuleIds: readonly string[];
}

export interface AcceptElementCandidatesValues {
  readonly items: readonly ElementCandidateItem[];
}

export interface GenerateElementCandidatesResult {
  readonly items: readonly ElementCandidateItem[];
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

interface CandidateFormValues {
  readonly constraints?: string[];
  readonly count: CountPresetValue;
  readonly elementType: ElementTypePresetValue;
  readonly style?: string;
  readonly worldRuleIds?: string[];
}

export interface CreativeElementsPanelProps {
  readonly characters: readonly CharacterElement[];
  readonly foreshadowings: readonly ForeshadowingElement[];
  readonly items: readonly WorldElement[];
  readonly locations: readonly WorldElement[];
  readonly organizations: readonly WorldElement[];
  readonly plotlines: readonly PlotlineElement[];
  readonly projectGenre: string;
  readonly projectStyle?: string | null | undefined;
  readonly worldRules: readonly WorldRuleElement[];
  onAcceptElementCandidates(input: AcceptElementCandidatesValues): Promise<void> | void;
  onCreateCharacter(input: CreateCharacterValues): Promise<void> | void;
  onCreateForeshadowing(input: CreateForeshadowingValues): Promise<void> | void;
  onCreatePlotline(input: CreatePlotlineValues): Promise<void> | void;
  onCreateWorldRule(input: CreateWorldRuleValues): Promise<void> | void;
  onGenerateElementCandidates(
    input: GenerateElementCandidatesValues,
  ):
    | Promise<GenerateElementCandidatesResult | readonly ElementCandidateItem[] | void>
    | GenerateElementCandidatesResult
    | readonly ElementCandidateItem[]
    | void;
}

export function CreativeElementsPanel({
  characters,
  foreshadowings,
  items,
  locations,
  onAcceptElementCandidates,
  onCreateCharacter,
  onCreateForeshadowing,
  onCreatePlotline,
  onCreateWorldRule,
  onGenerateElementCandidates,
  organizations,
  plotlines,
  projectGenre,
  projectStyle,
  worldRules,
}: CreativeElementsPanelProps) {
  const [candidateForm] = Form.useForm<CandidateFormValues>();
  const [characterForm] = Form.useForm<CreateCharacterValues>();
  const [worldRuleForm] = Form.useForm<CreateWorldRuleValues>();
  const [plotlineForm] = Form.useForm<CreatePlotlineValues>();
  const [foreshadowingForm] = Form.useForm<CreateForeshadowingValues>();
  const [candidateItems, setCandidateItems] = useState<readonly ElementCandidateItem[]>([]);
  const [selectedCandidateKeys, setSelectedCandidateKeys] = useState<readonly string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const worldRuleOptions = useMemo(
    () => worldRules.map((rule) => ({ label: rule.title, value: rule.id })),
    [worldRules],
  );
  const defaultStyle = projectStyle?.trim() || "通用";

  useEffect(() => {
    candidateForm.setFieldsValue({
      style: defaultStyle,
      worldRuleIds: worldRules.map((rule) => rule.id),
    });
  }, [candidateForm, defaultStyle, worldRules]);

  const selectedCandidates = candidateItems.filter((candidate, index) =>
    selectedCandidateKeys.includes(candidateKey(candidate, index)),
  );

  return (
    <Row className="creative-elements" gutter={[14, 14]}>
      <Col span={24}>
        <section className="creative-panel creative-panel--candidate">
          <header className="creative-panel__header">
            <Title level={5}>AI 候选生成</Title>
            <Text type="secondary">
              {projectGenre} / {defaultStyle}
            </Text>
          </header>
          <Form
            form={candidateForm}
            initialValues={{
              constraints: [],
              count: 10,
              elementType: "weapon",
              style: defaultStyle,
              worldRuleIds: worldRules.map((rule) => rule.id),
            }}
            layout="vertical"
            name="elementCandidateForm"
            onFinish={async (values) => {
              setGenerating(true);
              try {
                const result = await onGenerateElementCandidates({
                  constraints: values.constraints ?? [],
                  count: values.count,
                  elementType: values.elementType,
                  genre: projectGenre,
                  ...(values.style === undefined ? {} : { style: values.style }),
                  worldRuleIds: values.worldRuleIds ?? [],
                });
                const generatedItems = normalizeCandidateResult(result);
                setCandidateItems(generatedItems);
                setSelectedCandidateKeys([]);
              } finally {
                setGenerating(false);
              }
            }}
          >
            <Row gutter={[12, 0]}>
              <Col lg={6} sm={12} xs={24}>
                <Form.Item label="候选类型" name="elementType">
                  <Select aria-label="候选类型" options={[...ELEMENT_TYPE_PRESETS]} />
                </Form.Item>
              </Col>
              <Col lg={4} sm={12} xs={24}>
                <Form.Item label="数量" name="count">
                  <Select aria-label="数量" options={[...COUNT_PRESETS]} />
                </Form.Item>
              </Col>
              <Col lg={6} sm={12} xs={24}>
                <Form.Item label="候选风格" name="style">
                  <Select aria-label="候选风格" options={[...STYLE_PRESETS]} />
                </Form.Item>
              </Col>
              <Col lg={8} sm={12} xs={24}>
                <Form.Item label="世界观约束" name="worldRuleIds">
                  <Select
                    aria-label="世界观约束"
                    mode="multiple"
                    optionFilterProp="label"
                    options={worldRuleOptions}
                    placeholder="选择世界规则"
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label="额外约束" name="constraints">
                  <Select
                    aria-label="额外约束"
                    mode="tags"
                    options={[
                      { label: "避免现代感", value: "避免现代感" },
                      { label: "可反复出场", value: "可反复出场" },
                      { label: "适合主线冲突", value: "适合主线冲突" },
                    ]}
                    placeholder="选择或补充少量约束"
                    tokenSeparators={["，", ","]}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Space wrap>
              <Button
                aria-label="批量生成候选"
                htmlType="submit"
                icon={<ThunderboltOutlined />}
                loading={generating}
                type="primary"
              >
                批量生成候选
              </Button>
              <Button
                aria-label="采纳选中"
                disabled={selectedCandidates.length === 0}
                loading={accepting}
                onClick={async () => {
                  setAccepting(true);
                  try {
                    await onAcceptElementCandidates({ items: selectedCandidates });
                    setCandidateItems((currentItems) =>
                      currentItems.filter(
                        (candidate, index) =>
                          !selectedCandidateKeys.includes(candidateKey(candidate, index)),
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
          <CandidateList
            items={candidateItems}
            selectedKeys={selectedCandidateKeys}
            onToggle={(key, checked) => {
              setSelectedCandidateKeys((currentKeys) =>
                checked
                  ? [...currentKeys, key]
                  : currentKeys.filter((currentKey) => currentKey !== key),
              );
            }}
          />
        </section>
      </Col>

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
            <Form.Item
              label="人物名称"
              name="name"
              rules={[{ required: true, message: "请输入人物名称" }]}
            >
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
            <Form.Item
              label="规则标题"
              name="title"
              rules={[{ required: true, message: "请输入规则标题" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="规则内容"
              name="statement"
              rules={[{ required: true, message: "请输入规则内容" }]}
            >
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
          <Title level={5}>世界要素</Title>
          <CompactList
            emptyText="暂无世界要素"
            items={[
              ...locations.map((location) => ({
                description: location.description ?? undefined,
                id: location.id,
                label: location.name,
                tags: [location.type],
              })),
              ...organizations.map((organization) => ({
                description: organization.description ?? undefined,
                id: organization.id,
                label: organization.name,
                tags: [organization.type],
              })),
              ...items.map((item) => ({
                description: item.description ?? undefined,
                id: item.id,
                label: item.name,
                tags: [item.type],
              })),
            ]}
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
            <Form.Item
              label="故事线标题"
              name="title"
              rules={[{ required: true, message: "请输入故事线标题" }]}
            >
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
            <Button
              aria-label="创建故事线"
              htmlType="submit"
              icon={<PlusOutlined />}
              type="primary"
            >
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
            <Form.Item
              label="伏笔标题"
              name="title"
              rules={[{ required: true, message: "请输入伏笔标题" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="伏笔内容"
              name="description"
              rules={[{ required: true, message: "请输入伏笔内容" }]}
            >
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

function CandidateList({
  items,
  onToggle,
  selectedKeys,
}: {
  readonly items: readonly ElementCandidateItem[];
  readonly selectedKeys: readonly string[];
  onToggle(key: string, checked: boolean): void;
}) {
  if (items.length === 0) {
    return <Empty description="暂无 AI 候选" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <ul className="creative-list creative-list--candidate">
      {items.map((item, index) => {
        const key = candidateKey(item, index);
        return (
          <li className="creative-list__item" key={key}>
            <Checkbox
              aria-label={`选择候选 ${item.name}`}
              checked={selectedKeys.includes(key)}
              onChange={(event) => onToggle(key, event.target.checked)}
            />
            <div className="creative-list__content">
              <Text strong>{item.name}</Text>
              {item.description ? <Text type="secondary">{item.description}</Text> : null}
              {item.rationale ? <Text type="secondary">{item.rationale}</Text> : null}
              <Space size={6} wrap>
                <Tag>{item.type}</Tag>
                {(item.tags ?? []).map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </Space>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface CompactListItem {
  readonly description?: string | undefined;
  readonly id: string;
  readonly label: string;
  readonly tags: readonly string[];
}

function CompactList({
  emptyText,
  items,
}: {
  readonly emptyText: string;
  readonly items: readonly CompactListItem[];
}) {
  if (items.length === 0) {
    return <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <ul className="creative-list">
      {items.map((item) => (
        <li className="creative-list__item" key={item.id}>
          <div className="creative-list__content">
            <Text strong>{item.label}</Text>
            {item.description ? <Text type="secondary">{item.description}</Text> : null}
            <Space size={6} wrap>
              {item.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </Space>
          </div>
        </li>
      ))}
    </ul>
  );
}

function candidateKey(item: ElementCandidateItem, index: number): string {
  return `${index}:${item.type}:${item.name}`;
}

function normalizeCandidateResult(
  result: GenerateElementCandidatesResult | readonly ElementCandidateItem[] | void,
): readonly ElementCandidateItem[] {
  if (!result) {
    return [];
  }
  if (hasCandidateItems(result)) {
    return result.items;
  }

  return result;
}

function hasCandidateItems(value: unknown): value is GenerateElementCandidatesResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "items" in value &&
    Array.isArray((value as { readonly items?: unknown }).items)
  );
}
