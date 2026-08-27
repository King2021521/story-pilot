import { Drawer, Form, Input, Space, Button } from "antd";

export interface MemoryConfirmDrawerProps {
  readonly open: boolean;
  readonly statement: string;
  onClose(): void;
  onConfirm(statement: string): void;
}

export function MemoryConfirmDrawer({
  onClose,
  onConfirm,
  open,
  statement,
}: MemoryConfirmDrawerProps) {
  return (
    <Drawer onClose={onClose} open={open} placement="right" size="default" title="确认记忆">
      <Form
        initialValues={{ statement }}
        layout="vertical"
        onFinish={(values: { statement: string }) => onConfirm(values.statement)}
      >
        <Form.Item label="记忆陈述" name="statement" rules={[{ required: true, message: "请输入记忆陈述" }]}>
          <Input.TextArea aria-label="记忆陈述" autoSize={{ maxRows: 10, minRows: 5 }} />
        </Form.Item>
        <Space>
          <Button htmlType="submit" type="primary">
            确认
          </Button>
          <Button onClick={onClose}>取消</Button>
        </Space>
      </Form>
    </Drawer>
  );
}
