import {
  BranchesOutlined,
  DeploymentUnitOutlined,
  FileProtectOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Col, Row, Statistic, Tabs } from "antd";

import { ChapterEditorPage } from "../chapter/ChapterEditorPage";
import { MemoryCandidateList } from "../memory/MemoryCandidateList";

const metrics = [
  { icon: <FileProtectOutlined />, title: "故事圣经", value: 12 },
  { icon: <TeamOutlined />, title: "人物", value: 8 },
  { icon: <BranchesOutlined />, title: "故事线", value: 4 },
  { icon: <DeploymentUnitOutlined />, title: "图谱关系", value: 26 },
];

export function WorkbenchHome() {
  return (
    <div className="workbench-home">
      <Row gutter={[12, 12]}>
        {metrics.map((metric) => (
          <Col key={metric.title} lg={6} sm={12} xs={24}>
            <section className="metric-tile">
              <span className="metric-tile__icon">{metric.icon}</span>
              <Statistic title={metric.title} value={metric.value} />
            </section>
          </Col>
        ))}
      </Row>

      <Tabs
        className="workbench-tabs"
        items={[
          {
            children: (
              <ChapterEditorPage
                chapter={{
                  content: "雨水沿着旧城墙的裂缝向下流，林鸢在钟楼下拆开那封没有署名的信。",
                  id: "chapter_1",
                  title: "第一章 雨夜来信",
                  version: 1,
                }}
                onGenerateDraft={() => undefined}
                onSave={() => undefined}
              />
            ),
            key: "chapter",
            label: "章节",
          },
          {
            children: (
              <MemoryCandidateList
                candidates={[
                  {
                    confidence: 0.8,
                    content: "林鸢发现一封来历异常的旧信。",
                    id: "candidate_1",
                    kind: "event",
                    status: "pending",
                  },
                ]}
                onAccept={() => undefined}
                onReject={() => undefined}
              />
            ),
            key: "memory",
            label: "记忆确认",
          },
        ]}
      />
    </div>
  );
}
