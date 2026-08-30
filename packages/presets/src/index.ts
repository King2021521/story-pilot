export type PresetCategory = "genre" | "character" | "plot" | "world" | "style";

export const SYSTEM_PRESET_SCOPE = "system";

export interface PresetOption<TValue extends string | number = string> {
  readonly label: string;
  readonly value: TValue;
}

export const GENRE_PRESETS = [
  { label: "玄幻", value: "玄幻" },
  { label: "奇幻", value: "奇幻" },
  { label: "科幻", value: "科幻" },
  { label: "都市", value: "都市" },
  { label: "悬疑", value: "悬疑" },
  { label: "仙侠", value: "仙侠" },
  { label: "武侠", value: "武侠" },
  { label: "历史", value: "历史" },
  { label: "现实", value: "现实" },
  { label: "轻小说", value: "轻小说" },
  { label: "自定义", value: "自定义" },
] as const satisfies readonly PresetOption[];

export const STYLE_PRESETS = [
  { label: "通用", value: "通用" },
  { label: "悬疑推理", value: "悬疑推理" },
  { label: "爽文", value: "爽文" },
  { label: "群像", value: "群像" },
  { label: "成长", value: "成长" },
  { label: "黑暗", value: "黑暗" },
  { label: "轻松", value: "轻松" },
  { label: "史诗", value: "史诗" },
  { label: "现实主义", value: "现实主义" },
  { label: "热血", value: "热血" },
  { label: "赛博朋克", value: "赛博朋克" },
  { label: "古典志怪", value: "古典志怪" },
  { label: "自定义", value: "自定义" },
] as const satisfies readonly PresetOption[];

export const ELEMENT_TYPE_PRESETS = [
  { label: "人物名称", value: "character_name" },
  { label: "城市", value: "city" },
  { label: "地点", value: "location" },
  { label: "组织/势力", value: "organization" },
  { label: "势力名称", value: "faction" },
  { label: "门派名称", value: "sect" },
  { label: "武器", value: "weapon" },
  { label: "功法", value: "technique" },
  { label: "道具", value: "item" },
  { label: "地名", value: "place_name" },
] as const satisfies readonly PresetOption[];

export const COUNT_PRESETS = [
  { label: "5 个", value: 5 },
  { label: "10 个", value: 10 },
  { label: "20 个", value: 20 },
] as const satisfies readonly PresetOption<number>[];

export type GenrePresetValue = (typeof GENRE_PRESETS)[number]["value"];
export type StylePresetValue = (typeof STYLE_PRESETS)[number]["value"];
export type ElementTypePresetValue = (typeof ELEMENT_TYPE_PRESETS)[number]["value"];
export type CountPresetValue = (typeof COUNT_PRESETS)[number]["value"];
