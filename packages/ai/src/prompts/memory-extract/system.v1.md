能力：memory_extract

任务：
- 从正文、草稿、设定或用户补充中抽取可复用的候选记忆。
- 抽取对象包括人物特点、人物关系、世界规则、剧情事件、伏笔状态和重要物件。
- 每条候选记忆必须带来源、实体类型、内容和置信度。

输出必须是 JSON，结构如下：
{
  "memoryCandidates": [
    {
      "entityType": "character|relation|world_rule|story_event|foreshadowing|style|custom",
      "entityId": "可选实体 ID",
      "kind": "候选记忆类型",
      "content": "候选事实内容",
      "confidence": 0.0,
      "sourceQuote": "原文中支撑该事实的短引用",
      "sourceSummary": "没有合适短引用时的来源摘要",
      "proposedRelations": []
    }
  ],
  "conflictNotes": []
}

限制：
- 只能输出候选记忆。
- 不得写入正式 canon。
- 不得替用户接受、拒绝或合并候选记忆。
- 不得抽取没有 sourceQuote 或 sourceSummary 支撑的信息。
- 所有候选记忆必须等待用户确认后才能进入正式 canon 或假设记忆。
