import { normalizeDeadlineWidgetSettings } from "@/domain/deadlines/deadline";

export const DASHBOARD_WIDGET_IDS = ["stats", "deadlines", "projects", "hours", "task-time", "today", "recent", "done"];
export const DEFAULT_DASHBOARD_LAYOUT = [...DASHBOARD_WIDGET_IDS];

const DASHBOARD_MIN_COL_SPAN = 4;
const DASHBOARD_MAX_COL_SPAN = 12;
const DASHBOARD_MIN_ROW_SPAN = 1;
const DASHBOARD_MAX_ROW_SPAN = 6;
const DASHBOARD_GRID_COLUMNS = 12;
const LEGACY_DASHBOARD_TILE_SIZE_MAP = {
  small: { colSpan: 4, rowSpan: 1 },
  medium: { colSpan: 6, rowSpan: 2 },
  wide: { colSpan: 8, rowSpan: 2 },
  tall: { colSpan: 6, rowSpan: 3 },
  large: { colSpan: 12, rowSpan: 3 },
};
const DEFAULT_DASHBOARD_TILE_SIZES = {
  stats: { colSpan: 12, rowSpan: 1 },
  deadlines: { colSpan: 8, rowSpan: 3 },
  projects: { colSpan: 4, rowSpan: 3 },
  hours: { colSpan: 12, rowSpan: 3 },
  "task-time": { colSpan: 12, rowSpan: 3 },
  today: { colSpan: 6, rowSpan: 3 },
  recent: { colSpan: 6, rowSpan: 3 },
  done: { colSpan: 6, rowSpan: 3 },
};
const DEFAULT_DASHBOARD_TILE_LAYOUT = [
  { id: "stats", x: 0, y: 0, colSpan: 12, rowSpan: 1 },
  { id: "deadlines", x: 0, y: 1, colSpan: 8, rowSpan: 3 },
  { id: "projects", x: 8, y: 1, colSpan: 4, rowSpan: 3 },
  { id: "hours", x: 0, y: 4, colSpan: 12, rowSpan: 3 },
  { id: "task-time", x: 0, y: 7, colSpan: 12, rowSpan: 3 },
  { id: "today", x: 0, y: 10, colSpan: 6, rowSpan: 3 },
  { id: "recent", x: 6, y: 10, colSpan: 6, rowSpan: 3 },
  { id: "done", x: 0, y: 13, colSpan: 6, rowSpan: 3 },
];
export const DASHBOARD_PRESET_KEYS = ["standard", "compact", "focus", "custom"];
export const DASHBOARD_PRESET_LABELS = {
  standard: "Standard",
  compact: "Kompakt",
  focus: "Fokus",
  custom: "Benutzerdefiniert",
};
export const DASHBOARD_PRESET_DEFAULT_LAYOUTS = {
  standard: DEFAULT_DASHBOARD_TILE_LAYOUT,
  compact: [
    { id: "stats", x: 0, y: 0, colSpan: 12, rowSpan: 1 },
    { id: "deadlines", x: 0, y: 1, colSpan: 6, rowSpan: 2 },
    { id: "projects", x: 6, y: 1, colSpan: 6, rowSpan: 2 },
    { id: "today", x: 0, y: 3, colSpan: 6, rowSpan: 2 },
    { id: "recent", x: 6, y: 3, colSpan: 6, rowSpan: 2 },
    { id: "hours", x: 0, y: 5, colSpan: 6, rowSpan: 2 },
    { id: "task-time", x: 6, y: 5, colSpan: 6, rowSpan: 2 },
    { id: "done", x: 0, y: 7, colSpan: 6, rowSpan: 2 },
  ],
  focus: [
    { id: "today", x: 0, y: 0, colSpan: 8, rowSpan: 3 },
    { id: "deadlines", x: 8, y: 0, colSpan: 4, rowSpan: 3 },
    { id: "projects", x: 0, y: 3, colSpan: 4, rowSpan: 3 },
    { id: "stats", x: 4, y: 3, colSpan: 8, rowSpan: 1 },
    { id: "hours", x: 4, y: 4, colSpan: 8, rowSpan: 2 },
    { id: "task-time", x: 0, y: 6, colSpan: 12, rowSpan: 2 },
    { id: "recent", x: 0, y: 8, colSpan: 6, rowSpan: 2 },
    { id: "done", x: 6, y: 8, colSpan: 6, rowSpan: 2 },
  ],
};
export const DASHBOARD_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 0 };
export const DASHBOARD_COLS = { lg: 12, md: 12, sm: 1, xs: 1 };

function normalizeDashboardLayout(layout) {
  if (!Array.isArray(layout)) return [...DEFAULT_DASHBOARD_LAYOUT];
  const filtered = layout.filter((id) => DASHBOARD_WIDGET_IDS.includes(id));
  const missing = DASHBOARD_WIDGET_IDS.filter((id) => !filtered.includes(id));
  return [...filtered, ...missing];
}

export function dashboardWidgetLabel(widgetId) {
  const labels = {
    stats: "Kennzahlen",
    deadlines: "Nächste Deadlines",
    projects: "Projekte",
    hours: "Lernzeit pro Fach",
    "task-time": "Lernzeit pro Aufgabe",
    today: "Heute lernen",
    recent: "Zuletzt gelernt",
    done: "Erledigte Aufgaben",
  };
  return labels[widgetId] || widgetId;
}

export function normalizeDashboardTileSizes(inputSizes) {
  const safeInput = inputSizes && typeof inputSizes === "object" ? inputSizes : {};
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
  return Object.fromEntries(
    Object.entries(DEFAULT_DASHBOARD_TILE_SIZES).map(([tileKey, defaultSize]) => {
      const savedSize = safeInput[tileKey];
      const candidate = typeof savedSize === "string"
        ? LEGACY_DASHBOARD_TILE_SIZE_MAP[savedSize]
        : savedSize && typeof savedSize === "object"
          ? savedSize
          : null;
      return [
        tileKey,
        {
          colSpan: clamp(candidate?.colSpan ?? defaultSize.colSpan, DASHBOARD_MIN_COL_SPAN, DASHBOARD_MAX_COL_SPAN),
          rowSpan: clamp(candidate?.rowSpan ?? defaultSize.rowSpan, DASHBOARD_MIN_ROW_SPAN, DASHBOARD_MAX_ROW_SPAN),
        },
      ];
    })
  );
}

function normalizeDashboardTileSize(size, fallback = DEFAULT_DASHBOARD_TILE_SIZES.projects) {
  const safeSize = size && typeof size === "object" ? size : fallback;
  const rawColSpan = safeSize.colSpan ?? safeSize.w ?? fallback.colSpan;
  const rawRowSpan = safeSize.rowSpan ?? safeSize.h ?? fallback.rowSpan;
  const colSpan = Math.min(DASHBOARD_MAX_COL_SPAN, Math.max(DASHBOARD_MIN_COL_SPAN, Number(rawColSpan) || fallback.colSpan));
  const rowSpan = Math.min(DASHBOARD_MAX_ROW_SPAN, Math.max(DASHBOARD_MIN_ROW_SPAN, Number(rawRowSpan) || fallback.rowSpan));
  return { colSpan, rowSpan };
}

export function normalizeDashboardHiddenTiles(input) {
  return Array.isArray(input)
    ? input.filter((id, index, self) => DASHBOARD_WIDGET_IDS.includes(id) && self.indexOf(id) === index)
    : [];
}

function makeDashboardLayoutItems(layout = DEFAULT_DASHBOARD_LAYOUT, sizes = DEFAULT_DASHBOARD_TILE_SIZES) {
  let cursorY = 0;
  return normalizeDashboardLayout(layout).map((id) => {
    const size = normalizeDashboardTileSize(sizes[id], DEFAULT_DASHBOARD_TILE_SIZES[id]);
    const defaultItem = DEFAULT_DASHBOARD_TILE_LAYOUT.find((item) => item.id === id);
    const item = { id, x: defaultItem?.x ?? 0, y: defaultItem?.y ?? cursorY, ...size };
    cursorY = Math.max(cursorY, item.y + item.rowSpan);
    return item;
  });
}

export function normalizeDashboardTileLayout(inputLayout, legacyLayout, legacySizes) {
  const sourceItems = Array.isArray(inputLayout) ? inputLayout : makeDashboardLayoutItems(legacyLayout, normalizeDashboardTileSizes(legacySizes));
  const normalizedItems = sourceItems
    .filter((item) => DASHBOARD_WIDGET_IDS.includes(item?.id))
    .map((item, index) => {
      const fallback = DEFAULT_DASHBOARD_TILE_SIZES[item.id];
      const size = normalizeDashboardTileSize(item, fallback);
      return {
        id: item.id,
        x: Math.min(DASHBOARD_GRID_COLUMNS - size.colSpan, Math.max(0, Number(item.x) || 0)),
        y: Math.max(0, Number(item.y) || 0),
        colSpan: size.colSpan,
        rowSpan: size.rowSpan,
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
      };
    });

  return [
    ...normalizedItems,
    ...DASHBOARD_WIDGET_IDS
      .filter((id) => !normalizedItems.some((item) => item.id === id))
      .map((id, index) => {
        const defaultItem = DEFAULT_DASHBOARD_TILE_LAYOUT.find((item) => item.id === id);
        return {
          id,
          x: defaultItem?.x ?? 0,
          y: defaultItem?.y ?? normalizedItems.length + index,
          ...normalizeDashboardTileSize(defaultItem || DEFAULT_DASHBOARD_TILE_SIZES[id], DEFAULT_DASHBOARD_TILE_SIZES[id]),
          order: normalizedItems.length + index,
        };
      }),
  ]
    .sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.order - b.order))
    .map(({ order, ...item }, index) => ({ ...item, order: index }));
}

export function toReactGridLayout(layoutItems) {
  return layoutItems.map((item) => ({
    i: item.id,
    x: item.x,
    y: item.y,
    w: item.colSpan,
    h: item.rowSpan,
    minW: DASHBOARD_MIN_COL_SPAN,
    maxW: DASHBOARD_MAX_COL_SPAN,
    minH: DASHBOARD_MIN_ROW_SPAN,
    maxH: DASHBOARD_MAX_ROW_SPAN,
  }));
}

export function fromReactGridLayout(layoutItems) {
  return normalizeDashboardTileLayout(layoutItems.map((item, index) => ({
    id: item.i,
    x: item.x,
    y: item.y,
    colSpan: item.w,
    rowSpan: item.h,
    order: index,
  })));
}

export function normalizeDashboardPresetKey(value) {
  return DASHBOARD_PRESET_KEYS.includes(value) ? value : "standard";
}

function makeDashboardPresetValue(tileLayout = DEFAULT_DASHBOARD_TILE_LAYOUT, hiddenTiles = []) {
  const normalizedTileLayout = normalizeDashboardTileLayout(tileLayout);
  return { tileLayout: normalizedTileLayout, hiddenTiles: normalizeDashboardHiddenTiles(hiddenTiles) };
}

function makeDefaultDashboardPresetLayouts(customSource) {
  const customLayout = customSource?.tileLayout || customSource?.dashboardTileLayout || DEFAULT_DASHBOARD_TILE_LAYOUT;
  const customHiddenTiles = customSource?.hiddenTiles || customSource?.dashboardHiddenTiles || [];
  return {
    standard: makeDashboardPresetValue(DASHBOARD_PRESET_DEFAULT_LAYOUTS.standard, []),
    compact: makeDashboardPresetValue(DASHBOARD_PRESET_DEFAULT_LAYOUTS.compact, []),
    focus: makeDashboardPresetValue(DASHBOARD_PRESET_DEFAULT_LAYOUTS.focus, []),
    custom: makeDashboardPresetValue(customLayout, customHiddenTiles),
  };
}

export function normalizeDashboardPresetLayouts(inputLayouts, activeLayout, activeHiddenTiles) {
  const defaults = makeDefaultDashboardPresetLayouts({ tileLayout: activeLayout, hiddenTiles: activeHiddenTiles });
  const safeInput = inputLayouts && typeof inputLayouts === "object" ? inputLayouts : {};
  return Object.fromEntries(DASHBOARD_PRESET_KEYS.map((presetKey) => {
    const savedPreset = safeInput[presetKey];
    return [
      presetKey,
      makeDashboardPresetValue(
        savedPreset?.tileLayout || savedPreset?.dashboardTileLayout || defaults[presetKey].tileLayout,
        savedPreset?.hiddenTiles || savedPreset?.dashboardHiddenTiles || defaults[presetKey].hiddenTiles
      ),
    ];
  }));
}

export function applyDashboardPresetToSettings(settings, presetKey, presetLayouts) {
  const safePresetKey = normalizeDashboardPresetKey(presetKey);
  const normalizedPresetLayouts = normalizeDashboardPresetLayouts(
    presetLayouts,
    settings?.dashboardTileLayout,
    settings?.dashboardHiddenTiles
  );
  const preset = normalizedPresetLayouts[safePresetKey] || normalizedPresetLayouts.standard;
  const tileLayout = normalizeDashboardTileLayout(preset.tileLayout);
  const hiddenTiles = normalizeDashboardHiddenTiles(preset.hiddenTiles);
  return {
    ...settings,
    dashboardSelectedPreset: safePresetKey,
    dashboardPresetLayouts: normalizedPresetLayouts,
    dashboardLayout: tileLayout.map((item) => item.id),
    dashboardTileSizes: Object.fromEntries(tileLayout.map((item) => [item.id, { colSpan: item.colSpan, rowSpan: item.rowSpan }])),
    dashboardTileLayout: tileLayout,
    dashboardHiddenTiles: hiddenTiles,
  };
}

export function normalizeAppSettings(rawSettings = {}) {
  const dashboardTileLayout = normalizeDashboardTileLayout(
    rawSettings.dashboardTileLayout,
    rawSettings.dashboardLayout,
    rawSettings.dashboardTileSizes
  );
  const dashboardHiddenTiles = normalizeDashboardHiddenTiles(rawSettings.dashboardHiddenTiles);
  const dashboardPresetLayouts = normalizeDashboardPresetLayouts(
    rawSettings.dashboardPresetLayouts,
    dashboardTileLayout,
    dashboardHiddenTiles
  );
  const selectedPreset = normalizeDashboardPresetKey(rawSettings.dashboardSelectedPreset);
  return {
    appearance: rawSettings.appearance || "light",
    sidebarCollapsed: rawSettings.sidebarCollapsed || false,
    dashboardLayout: normalizeDashboardLayout(rawSettings.dashboardLayout),
    dashboardTileSizes: normalizeDashboardTileSizes(rawSettings.dashboardTileSizes),
    dashboardTileLayout,
    dashboardHiddenTiles,
    dashboardSelectedPreset: selectedPreset,
    dashboardPresetLayouts,
    deadlineWidget: normalizeDeadlineWidgetSettings(rawSettings.deadlineWidget),
  };
}
