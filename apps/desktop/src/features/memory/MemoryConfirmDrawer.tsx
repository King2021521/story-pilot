import { Button, Drawer, Form, Input, Radio, Space } from "antd";
import { useEffect, useState } from "react";

import type { MemoryCandidateItem } from "./MemoryCandidateList";

export type MemoryDecision = "canon" | "hypothesis" | "merge";

export interface MemoryCandidateDecisionInput {
  readonly candidateId: string;
  readonly decision: MemoryDecision;
  readonly editedStatement: string;
  readonly mergeTargetMemoryId?: string;
}

export interface MemoryConfirmDrawerProps {
  readonly candidate?: MemoryCandidateItem | undefined;
  readonly open: boolean;
  onClose(): void;
  onConfirm(input: MemoryCandidateDecisionInput): void;
}

interface MemoryConfirmFormValues {
  readonly decision: MemoryDecision;
  readonly statement: string;
  readonly mergeTargetMemoryId?: string;
}

export function MemoryConfirmDrawer({
  candidate,
  onClose,
  onConfirm,
  open,
}: MemoryConfirmDrawerProps) {
  const [form] = Form.useForm<MemoryConfirmFormValues>();
  const [decision, setDecision] = useState<MemoryDecision>("canon");

  useEffect(() => {
    if (!candidate || !open) {
      return;
    }

    form.resetFields(["mergeTargetMemoryId"]);
    form.setFieldsValue({
      decision: "canon",
      statement: candidate.content,
    });
  }, [candidate, form, open]);

  return (
    <Drawer
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button onClick={() => form.submit()} type="primary">
            确认记忆
          </Button>
        </Space>
      }
      onClose={onClose}
      open={open}
      placement="right"
      size="default"
      title="确认记忆"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => {
          if (!candidate) {
            return;
          }

          onConfirm({
            candidateId: candidate.id,
            decision: values.decision,
            editedStatement: values.statement.trim(),
            ...(values.decision === "merge" && values.mergeTargetMemoryId
              ? { mergeTargetMemoryId: values.mergeTargetMemoryId.trim() }
              : {}),
          });
          onClose();
        }}
      >
        <Form.Item
          label="处理方式"
          name="decision"
          rules={[{ required: true, message: "请选择处理方式" }]}
        >
          <Radio.Group
            onChange={(event) => {
              const nextDecision = event.target.value as MemoryDecision;
              setDecision(nextDecision);
              form.setFieldValue("decision", nextDecision);
            }}
            value={decision}
          >
            <Radio value="canon">Canon</Radio>
            <Radio value="hypothesis">假设</Radio>
            <Radio value="merge">合并</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          label="记忆陈述"
          name="statement"
          rules={[{ required: true, message: "请输入记忆陈述" }]}
        >
          <Input.TextArea aria-label="记忆陈述" autoSize={{ maxRows: 10, minRows: 5 }} />
        </Form.Item>
        {decision === "merge" ? (
          <Form.Item
            label="目标记忆 ID"
            name="mergeTargetMemoryId"
            rules={[{ required: true, message: "请输入目标记忆 ID" }]}
          >
            <Input aria-label="目标记忆 ID" />
          </Form.Item>
        ) : null}
      </Form>
    </Drawer>
  );
}
