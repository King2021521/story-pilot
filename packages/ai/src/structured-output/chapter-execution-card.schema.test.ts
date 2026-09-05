import { describe, expect, it } from "vitest";

import { ChapterExecutionCardOutputSchema } from "./chapter-execution-card.schema.js";

const validExecutionCard = {
  card: {
    chapterIndex: 1,
    coreConflict:
      "沈砚必须在第一场冻雨前把旧堡垒的主供热回路接通，但仓库钥匙掌握在临时管委会手里，任何公开求援都会暴露他的物资储备。他既要绕开旧秩序的盘查，又不能让幸存者发现堡垒真正的能源入口。",
    emotionalTurn:
      "他从只想独自活下来，转为意识到必须挑选可信的人进入安全屋，否则堡垒会被外部秩序拖垮。这个转折让他第一次把周苓纳入计划，也埋下未来信任边界的冲突。",
    forbiddenMoves: ["不要提前揭露冰冠计划真相", "不要让安全屋在第一章完成全部升级"],
    hook: "章末让备用热泵启动，却在旧日志里出现三小时前才生成的冰冠预警编号，证明有人或某个系统仍在灾变中实时改写旧堡垒日志。",
    informationGain:
      "读者获得灾变不是普通寒潮的证据，并知道霜脊山旧堡垒拥有被隐藏的低温工程底座。这个信息把安全屋从普通避难所升级成旧计划遗产。",
    narrativeGoal:
      "建立极寒灾变、主角抢占旧堡垒、第一批资源冲突和安全屋升级目标，让读者相信这是一场长期基地经营战争。本章必须同时给出世界压力、主角能力、安全屋价值和后续谜题入口。",
    povCharacterId: "character-shen-yan",
    readerReward:
      "给出明确的安全屋爽点：热源闭环第一次点亮，同时让主角用工程判断压过混乱人群。读者应看到旧堡垒从废墟变成可守阵地的第一步。",
    relatedForeshadowingIds: ["foreshadowing-ice-crown"],
    relatedPlotDebtIds: ["debt-ice-crown-warning"],
    relatedPlotlineIds: ["plotline-main"],
    requiredCharacterIds: ["character-shen-yan", "character-zhou-ling"],
    requiredLocationIds: ["location-old-fortress"],
    sceneBriefs: [
      {
        conflictTurn: "管委会拒绝开放仓库，沈砚被迫用维修权限绕开封锁，同时避免暴露主热源入口。",
        memoryTargets: ["沈砚知道旧堡垒备用热泵的位置"],
        outcome: "热泵短暂启动，堡垒具备第一晚庇护能力，但燃料缺口被明确暴露。",
        sceneGoal: "让主角进入旧堡垒并确认灾变正在失控，同时建立安全屋第一目标。",
        sceneIndex: 1,
      },
    ],
    targetWordCount: 6000,
    title: "白灾入屋",
  },
  riskNotes: ["角色周苓的出场动机需要在人物档案里补强。"],
};

describe("ChapterExecutionCardOutputSchema", () => {
  it("accepts a complete execution card that can constrain chapter drafting", () => {
    const parsed = ChapterExecutionCardOutputSchema.safeParse(validExecutionCard);

    expect(parsed.success).toBe(true);
  });

  it("rejects a card without reader reward because chapter drafting would lose payoff", () => {
    const invalid = {
      ...validExecutionCard,
      card: {
        ...validExecutionCard.card,
        readerReward: "",
      },
    };

    expect(ChapterExecutionCardOutputSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects a card without scene briefs because the chapter has no executable shape", () => {
    const invalid = {
      ...validExecutionCard,
      card: {
        ...validExecutionCard.card,
        sceneBriefs: [],
      },
    };

    expect(ChapterExecutionCardOutputSchema.safeParse(invalid).success).toBe(false);
  });
});
