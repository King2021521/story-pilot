import { BookOpen, Brain, ClipboardCheck, FolderOpen, Library, Sparkles } from "lucide-react";

import "./styles.css";

const projects = ["长夜序章", "镜城纪事", "未命名新作"];
const workbenchItems = [
  { label: "故事圣经", value: "12 条设定", icon: Library },
  { label: "人物库", value: "8 个角色", icon: Brain },
  { label: "章节正文", value: "3 章草稿", icon: BookOpen },
  { label: "AI 工作单", value: "2 个待确认", icon: ClipboardCheck },
];

export function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="作品管理区">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            SP
          </div>
          <div>
            <h1>Story Pilot</h1>
            <p>小说创作工作台</p>
          </div>
        </div>

        <nav className="project-list" aria-label="作品列表">
          <div className="section-title">作品空间</div>
          {projects.map((project, index) => (
            <button className={index === 0 ? "project active" : "project"} key={project} type="button">
              <FolderOpen size={18} />
              <span>{project}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace" aria-label="工作台">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">工作台</p>
            <h2>长夜序章</h2>
          </div>
          <button className="primary-action" type="button">
            <Sparkles size={18} />
            <span>生成下一步</span>
          </button>
        </header>

        <div className="workbench-grid">
          {workbenchItems.map((item) => {
            const Icon = item.icon;
            return (
              <article className="workbench-card" key={item.label}>
                <Icon size={20} />
                <div>
                  <h3>{item.label}</h3>
                  <p>{item.value}</p>
                </div>
              </article>
            );
          })}
        </div>

        <section className="editor-preview" aria-label="章节编辑区">
          <div>
            <p className="eyebrow">当前章节</p>
            <h3>第一章：雨夜来信</h3>
          </div>
          <p>
            雨水沿着旧城墙的裂缝向下流，林越在钟楼下拆开那封没有署名的信。信纸只有一行字：
            你父亲当年没有死。
          </p>
        </section>
      </section>

      <aside className="board" aria-label="项目看板">
        <div className="section-title">项目看板</div>
        <div className="board-item">
          <span>待确认记忆</span>
          <strong>5</strong>
        </div>
        <div className="board-item">
          <span>未回收伏笔</span>
          <strong>3</strong>
        </div>
        <div className="board-item">
          <span>连续性风险</span>
          <strong>1</strong>
        </div>
      </aside>
    </main>
  );
}

