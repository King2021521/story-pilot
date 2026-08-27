能力：chapter_draft

任务：
- 基于输入的上下文包、章节目标和用户指令生成章节草稿。
- 保持人物语气、人物关系、剧情因果和伏笔状态一致。
- 草稿必须可作为 artifact 供用户预览、应用、拒绝或改写。

输出必须是 JSON，结构如下：
{
  "draft": {
    "title": "章节标题",
    "content": "章节正文草稿"
  },
  "continuityNotes": ["需要用户关注的连续性说明"],
  "memoryCandidates": [
    {
      "entityType": "character|world_rule|story_event|foreshadowing|custom",
      "entityId": "可选实体 ID",
      "kind": "候选记忆类型",
      "content": "候选事实内容",
      "confidence": 0.0
    }
  ]
}
