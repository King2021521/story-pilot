import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CharacterRepository,
  createProjectDatabase,
  CreativePathRepository,
  LongformPlanRepository,
  OutlineRepository,
  PlotRepository,
  ProjectRepository,
  PROJECT_DATABASE_FILE,
  runProjectMigrations,
  WorldbuildingRepository,
  type ProjectDatabase,
  type WorldbuildingFields,
} from "@story-pilot/db";
import { afterEach, describe, expect, it } from "vitest";

import { buildCreativeContextItems, creativeContextText } from "./creative-context.js";

describe("creative context", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("includes manual planning facts that later AI generation must respect", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "story-pilot-creative-context-"));
    tempDirs.push(tempDir);
    const projectDatabase = createProjectDatabase(join(tempDir, PROJECT_DATABASE_FILE));

    try {
      await runProjectMigrations(projectDatabase);
      seedManualPlanning(projectDatabase, tempDir);

      const contextItems = buildCreativeContextItems({
        includeLongformPlans: true,
        projectDatabase,
        projectId: "project_1",
      });
      const contextText = creativeContextText(contextItems);

      expect(contextText).toContain("entityRelations");
      expect(contextText).toContain("庇护与互信");
      expect(contextText).toContain("storyEvents");
      expect(contextText).toContain("完成安全屋封闭启动");
      expect(contextText).toContain("eventRelations");
      expect(contextText).toContain("foreshadows");
      expect(contextText).toContain("conflicts");
      expect(contextText).toContain("热源暴露危机");
      expect(contextText).toContain("outlinePlans");
      expect(contextText).toContain("第一卷 极寒降临");
      expect(contextText).toContain("scenePlans");
      expect(contextText).toContain("门外求救");
    } finally {
      projectDatabase.close();
    }
  });
});

function seedManualPlanning(projectDatabase: ProjectDatabase, rootPath: string): void {
  new ProjectRepository(projectDatabase).createProject({
    defaultVolumeId: "volume_1",
    genre: "冰雪末世安全屋",
    projectId: "project_1",
    rootPath,
    style: "末世爽文",
    title: "极寒堡垒",
    workId: "work_1",
    wordCountGoal: 5_000_000,
  });

  new CreativePathRepository(projectDatabase).saveBrief({
    briefId: "brief_1",
    emotionalRewards: ["囤货安全感", "防御升级", "秩序重建"],
    estimatedChapterCount: 1500,
    estimatedWordCount: 5_000_000,
    genre: "冰雪末世",
    initialIdea: "全球极寒降临，主角提前打造安全屋。",
    lengthProfile: "500 万字长篇",
    platformProfile: "强情节网文",
    projectId: "project_1",
    subgenres: ["安全屋", "囤货", "末世经营"],
  });
  new CreativePathRepository(projectDatabase).saveBlueprintForm({
    blueprintId: "blueprint_1",
    fields: {
      antagonistForce: "极寒灾害、资源掠夺者和旧秩序残余。",
      corePromise: "每个阶段都让安全屋更强，同时让外部威胁更近。",
      differentiators: ["安全屋工程细节", "资源运营", "秩序博弈"],
      emotionalAxes: ["爽感", "压迫", "掌控"],
      logline: "极寒末世前，陆沉打造安全屋并在秩序崩塌中重建规则。",
      mainConflict: "个人生存堡垒与末世群体秩序之间的冲突。",
      mainGoal: "守住并升级安全屋。",
      premise: "全球进入冰雪末世，主角提前打造安全屋。",
      protagonistArc: "从只求自保到建立可执行的新秩序。",
      risks: ["升级重复", "外部威胁单一"],
      stakes: "安全屋失守意味着主角失去所有生存优势。",
      storyDriver: "survival",
    },
    projectId: "project_1",
  });
  new WorldbuildingRepository(projectDatabase).saveProfile({
    fields: worldbuildingFields({
      economy: "热源、燃料、药品和可食用水成为硬通货。",
      powerSystem: "安全屋通过能源、防御、监控和生产模块持续升级。",
      worldBase: "冰雪末世，城市被极寒封锁。",
    }),
    projectId: "project_1",
  });

  const characterRepository = new CharacterRepository(projectDatabase);
  characterRepository.createCharacter({
    characterId: "character_lu_chen",
    importance: "core",
    motivation: "守住安全屋并控制资源分配权。",
    name: "陆沉",
    projectId: "project_1",
    role: "protagonist",
    storyTask: "推动安全屋建设、资源分配与防御升级。",
    traits: [],
  });
  characterRepository.createCharacter({
    characterId: "character_shen",
    importance: "major",
    motivation: "用医疗能力换取庇护。",
    name: "沈砚秋",
    projectId: "project_1",
    role: "support",
    storyTask: "制造医疗线和内部信任冲突。",
    traits: [],
  });
  characterRepository.createRelation({
    description: "陆沉提供庇护，沈砚秋提供医疗能力。",
    polarity: 1,
    projectId: "project_1",
    relationId: "relation_1",
    relationType: "庇护与互信",
    sourceEntityId: "character_lu_chen",
    sourceEntityType: "character",
    strength: 0.9,
    targetEntityId: "character_shen",
    targetEntityType: "character",
  });

  const plotRepository = new PlotRepository(projectDatabase);
  const plotline = plotRepository.createPlotline({
    centralQuestion: "安全屋能否从个人避难所升级为秩序核心？",
    driver: "极寒、资源、邻里围困和掠夺势力层层升级。",
    emotionalPromise: "每次升级都带来安全感和更大代价。",
    importance: "core",
    kind: "main",
    narrativeRole: "main_drive",
    payoffPlan: "终局安全屋成为极寒城市的新规则中心。",
    plotlineId: "plotline_1",
    priority: 1,
    projectId: "project_1",
    relatedCharacterIds: ["character_lu_chen"],
    relatedForeshadowingIds: [],
    relatedStoryEventIds: [],
    relatedWorldRuleIds: [],
    startState: "主角只想保护自己。",
    status: "active",
    summary: "围绕安全屋建设、扩张、防守和秩序重建推进。",
    title: "安全屋升级主线",
  });
  plotRepository.createConflict({
    conflictId: "conflict_1",
    conflictType: "survival",
    escalationPath: ["暴雪断电", "热源暴露", "邻里围门"],
    opposingForces: ["安全屋小队", "失控幸存者"],
    projectId: "project_1",
    relatedPlotlineId: plotline.id,
    stakes: "安全屋一旦失守，主角会失去全部生存优势。",
    status: "active",
    title: "热源暴露危机",
  });
  plotRepository.createStoryEvent({
    description: "陆沉抢在断电前完成最后一批囤货。",
    eventId: "event_warning",
    eventType: "discovery",
    outcome: "完成安全屋封闭启动，也埋下热源被侦测的伏笔。",
    participants: [],
    projectId: "project_1",
    status: "canon",
    storyTime: "第 1 章",
    title: "极寒预警",
  });
  plotRepository.createStoryEvent({
    description: "热成像暴露安全屋位置。",
    eventId: "event_siege",
    eventType: "conflict",
    outcome: "门禁守住，但安全屋存在被公开确认。",
    participants: [],
    projectId: "project_1",
    status: "planned",
    storyTime: "第 12 章",
    title: "第一次围门",
  });
  plotRepository.createEventRelation({
    description: "极寒预警导致安全屋封闭，也让热源暴露成为必然。",
    eventRelationId: "event_relation_1",
    projectId: "project_1",
    relationType: "foreshadows",
    sourceEventId: "event_warning",
    targetEventId: "event_siege",
  });

  const outlineRepository = new OutlineRepository(projectDatabase);
  const outline = outlineRepository.saveOutlineDraft({
    basis: { targetWordCount: 5_000_000 },
    outlineId: "outline_1",
    projectId: "project_1",
    scope: "full_book",
    status: "draft",
    title: "极寒堡垒全书大纲",
  });
  const volumeOutline = outlineRepository.saveVolumeOutline({
    majorConflict: "安全屋热源暴露后，周边幸存者持续逼近。",
    outlineId: outline.id,
    projectId: "project_1",
    purpose: "完成极寒降临、安全屋启动和首次攻防。",
    sortOrder: 1,
    status: "draft",
    title: "第一卷 极寒降临",
    volumeOutlineId: "volume_outline_1",
    wordCountGoal: 600_000,
  });
  const chapterOutline = outlineRepository.saveChapterOutline({
    chapterGoal: "主角启动安全屋改造。",
    chapterOutlineId: "chapter_outline_1",
    conflict: "断电前必须完成最后加固。",
    hook: "天气预警从三天变成三小时。",
    informationGain: "极寒不是普通寒潮。",
    outlineId: outline.id,
    projectId: "project_1",
    relatedForeshadowingIds: [],
    relatedPlotlineNodeIds: [],
    requiredCharacterIds: ["character_lu_chen"],
    requiredLocationIds: [],
    sortOrder: 1,
    status: "draft",
    targetWordCount: 3500,
    title: "第 1 章 暴雪预警",
    volumeOutlineId: volumeOutline.id,
  });
  outlineRepository.saveSceneOutline({
    beatType: "opening_hook",
    chapterOutlineId: chapterOutline.id,
    conflict: "门禁短暂失效。",
    entryState: "主角以为关门即可自保。",
    exitState: "主角守住门禁却留下人情债。",
    projectId: "project_1",
    purpose: "展示安全屋优势和道德压力。",
    sceneOutlineId: "scene_outline_1",
    sortOrder: 1,
    status: "draft",
    title: "门外求救",
  });

  const longformRepository = new LongformPlanRepository(projectDatabase);
  const bookPlan = longformRepository.saveBookPlanDraft({
    bookPlanId: "book_plan_1",
    corePromise: "每卷完成一次安全屋升级和一次秩序挑战。",
    endingDirection: "安全屋成为极寒城市规则中心。",
    mainPlotlineId: plotline.id,
    projectId: "project_1",
    status: "draft",
    targetWordCount: 5_000_000,
    title: "极寒堡垒全书规划",
  });
  const volumePlan = longformRepository.saveVolumePlan({
    bookPlanId: bookPlan.id,
    climax: "击退第一次掠夺联盟。",
    majorConflict: "热源暴露危机。",
    projectId: "project_1",
    purpose: "建立安全屋启动和第一次攻防。",
    status: "draft",
    targetWordCount: 600_000,
    title: "第一卷 极寒降临",
    volumeIndex: 1,
    volumePlanId: "volume_plan_1",
  });
  const chapterPlan = longformRepository.saveChapterPlan({
    arcPlanId: null,
    chapterGoal: "主角启动安全屋。",
    chapterIndex: 1,
    chapterPlanId: "chapter_plan_1",
    conflict: "断电和求助者同时逼近。",
    emotionalTurn: "从怀疑到确认灾难。",
    hook: "热成像设备第一次报警。",
    informationGain: "安全屋能源系统会被外部侦测。",
    projectId: "project_1",
    relatedCharacterIds: ["character_lu_chen"],
    relatedForeshadowingIds: [],
    relatedPlotlineIds: [plotline.id],
    status: "draft",
    targetWordCount: 3500,
    title: "第 1 章 暴雪预警",
  });
  longformRepository.saveScenePlan({
    chapterPlanId: chapterPlan.id,
    conflictTurn: "求助者发现门廊热源。",
    memoryTargets: ["门外求救"],
    outcome: "主角拒绝开门但留下监控证据。",
    projectId: "project_1",
    sceneGoal: "门外求救",
    sceneIndex: 1,
    scenePlanId: "scene_plan_1",
    status: "draft",
  });

  void volumePlan;
}

function worldbuildingFields(overrides: Partial<WorldbuildingFields> = {}): WorldbuildingFields {
  return {
    coreConflict: "生存效率与人性伦理冲突。",
    culture: "幸存者围绕热源、食物和庇护形成新价值观。",
    economy: "热源、药品、水和食物决定交换价值。",
    factions: "楼栋互助会、掠夺者、旧物业和临时救援队并存。",
    geography: "城市被暴雪切割成社区、地下通道和安全屋节点。",
    history: "极寒从异常寒潮升级为全球灾变。",
    powerOrder: "掌握能源、武器和稳定住所的人拥有话语权。",
    powerSystem: "安全屋以工程模块、资源库存和监控防御形成优势。",
    rules: "低温、断电、资源腐败和外部窥探共同限制行动。",
    socialStructure: "幸存者按资源、技能和依附关系重组。",
    specialMechanism: "极寒周期性增强，逼迫安全屋持续升级。",
    worldBase: "冰雪末世，城市被极寒封锁。",
    ...overrides,
  };
}
