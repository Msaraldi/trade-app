import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  DrawingTool,
  DrawingToolCategory,
  DrawingStyle,
  DrawingPoint,
  Drawing,
  TOOL_CATEGORIES,
  PRESET_COLORS,
  FIBONACCI_LEVELS,
  FIBONACCI_COLORS,
  getToolInfo,
  getCategoryTools,
} from "./ChartDrawings";

// ============================================
// LOCAL STORAGE KEYS
// ============================================
const FAVORITE_TOOLS_KEY = "chart_favorite_tools";
const FAVORITE_INTERVALS_KEY = "chart_favorite_intervals";

// Default favorite tools
const DEFAULT_FAVORITES: DrawingTool[] = ["trendline", "horizontal", "fib_retracement", "rectangle"];

// Default favorite intervals
const DEFAULT_FAVORITE_INTERVALS: string[] = ["1", "5", "15", "60", "240", "D"];

// ============================================
// TYPES
// ============================================

interface IntervalOption {
  value: string;
  label: string;
}

type MagnetMode = "none" | "weak" | "strong";

interface ChartToolbarProps {
  // Interval
  interval: string;
  intervals: IntervalOption[];
  onIntervalChange: (interval: string) => void;

  // Drawing tools
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;

  // Style
  currentStyle: DrawingStyle;
  onStyleChange: (updates: Partial<DrawingStyle>) => void;

  // Drawing management
  drawingCount: number;
  onClearAll: () => void;

  // Magnet
  magnetMode: MagnetMode;
  onMagnetChange: (mode: MagnetMode) => void;

  // Stay in drawing mode
  stayInDrawingMode: boolean;
  onStayInDrawingModeChange: (stay: boolean) => void;

  // Lock/Hide all
  allLocked: boolean;
  onLockAllChange: (locked: boolean) => void;
  allHidden: boolean;
  onHideAllChange: (hidden: boolean) => void;

  // Object tree toggle
  onToggleObjectTree?: () => void;
  showObjectTree?: boolean;
}

// ============================================
// TOOLBAR COMPONENT
// ============================================

export function ChartToolbar({
  interval,
  intervals,
  onIntervalChange,
  activeTool,
  onToolChange,
  currentStyle,
  onStyleChange,
  drawingCount,
  onClearAll,
  magnetMode,
  onMagnetChange,
  stayInDrawingMode,
  onStayInDrawingModeChange,
  allLocked,
  onLockAllChange,
  allHidden,
  onHideAllChange,
  onToggleObjectTree,
  showObjectTree,
}: ChartToolbarProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<DrawingToolCategory | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [customValue, setCustomValue] = useState("7");
  const [customUnit, setCustomUnit] = useState<"s" | "m" | "h" | "D" | "W">("m");
  const [showAllToolsModal, setShowAllToolsModal] = useState(false);
  const [showAllIntervalsModal, setShowAllIntervalsModal] = useState(false);
  const [favoriteTools, setFavoriteTools] = useState<DrawingTool[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITE_TOOLS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_FAVORITES;
    } catch {
      return DEFAULT_FAVORITES;
    }
  });
  const [favoriteIntervals, setFavoriteIntervals] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITE_INTERVALS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_FAVORITE_INTERVALS;
    } catch {
      return DEFAULT_FAVORITE_INTERVALS;
    }
  });

  // Track last selected tool per category for TradingView-style grouping
  const [selectedToolPerCategory, setSelectedToolPerCategory] = useState<Record<string, DrawingTool>>(() => {
    try {
      const saved = localStorage.getItem("chart_selected_tools_per_category");
      return saved ? JSON.parse(saved) : {
        lines: "trendline",
        channels: "parallel_channel",
        pitchfork: "pitchfork",
        fibonacci: "fib_retracement",
        gann: "gann_box",
        patterns: "xabcd_pattern",
        shapes: "rectangle",
        volume: "anchored_vwap",
        measure: "price_range",
        annotation: "text",
      };
    } catch {
      return {
        lines: "trendline",
        channels: "parallel_channel",
        pitchfork: "pitchfork",
        fibonacci: "fib_retracement",
        gann: "gann_box",
        patterns: "xabcd_pattern",
        shapes: "rectangle",
        volume: "anchored_vwap",
        measure: "price_range",
        annotation: "text",
      };
    }
  });

  // Save selected tools per category
  useEffect(() => {
    localStorage.setItem("chart_selected_tools_per_category", JSON.stringify(selectedToolPerCategory));
  }, [selectedToolPerCategory]);

  // Update selected tool per category when tool changes
  const handleToolChangeWithCategory = useCallback((tool: DrawingTool) => {
    const toolInfo = getToolInfo(tool);
    if (toolInfo) {
      setSelectedToolPerCategory(prev => ({
        ...prev,
        [toolInfo.category]: tool
      }));
    }
    onToolChange(tool);
  }, [onToolChange]);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem(FAVORITE_TOOLS_KEY, JSON.stringify(favoriteTools));
  }, [favoriteTools]);

  useEffect(() => {
    localStorage.setItem(FAVORITE_INTERVALS_KEY, JSON.stringify(favoriteIntervals));
  }, [favoriteIntervals]);

  // Toggle favorite tool
  const toggleFavorite = useCallback((tool: DrawingTool) => {
    setFavoriteTools(prev => {
      if (prev.includes(tool)) {
        return prev.filter(t => t !== tool);
      } else {
        return [...prev, tool];
      }
    });
  }, []);

  // Toggle favorite interval
  const toggleFavoriteInterval = useCallback((intervalValue: string) => {
    setFavoriteIntervals(prev => {
      if (prev.includes(intervalValue)) {
        return prev.filter(i => i !== intervalValue);
      } else {
        return [...prev, intervalValue];
      }
    });
  }, []);

  // Check if current interval is custom
  const isCustomInterval = interval.startsWith("custom_");
  const customIntervalDisplay = isCustomInterval ? interval.replace("custom_", "") : null;

  const activeToolInfo = getToolInfo(activeTool);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".toolbar-dropdown")) {
        setActiveCategory(null);
        setShowSettings(false);
        setShowAdvancedSettings(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col bg-dark-800 border-b border-dark-700">
      {/* Main Toolbar Row */}
      <div className="flex items-center gap-1 px-2 py-1">
        {/* Interval Selector */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-dark-600">
          {favoriteIntervals.map((intValue) => {
            const intOption = intervals.find(i => i.value === intValue);
            if (!intOption) return null;
            return (
              <button
                key={intOption.value}
                onClick={() => onIntervalChange(intOption.value)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  interval === intOption.value
                    ? "bg-primary-600 text-white"
                    : "text-dark-300 hover:bg-dark-700 hover:text-white"
                }`}
              >
                {intOption.label}
              </button>
            );
          })}
          {isCustomInterval && (
            <button className="px-2 py-1 text-xs rounded bg-primary-600 text-white">
              {customIntervalDisplay}
            </button>
          )}
          <button
            onClick={() => setShowAllIntervalsModal(true)}
            className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
            title="Tüm Süreler"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        {/* Cursor & Crosshair */}
        <div className="flex items-center gap-0.5 px-1">
          <button
            onClick={() => onToolChange("none")}
            className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-all ${
              activeTool === "none"
                ? "bg-primary-600 text-white"
                : "text-dark-300 hover:bg-dark-700 hover:text-white"
            }`}
            title="Seç / Kaydır (V)"
          >
            ↖
          </button>
          <button
            onClick={() => onToolChange(activeTool === "crosshair" ? "none" : "crosshair")}
            className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-all ${
              activeTool === "crosshair"
                ? "bg-primary-600 text-white"
                : "text-dark-300 hover:bg-dark-700 hover:text-white"
            }`}
            title="Artı İmleç"
          >
            +
          </button>
        </div>

        <div className="w-px h-6 bg-dark-600" />

        {/* Drawing Tool Categories - Grouped */}
        <div className="flex items-center gap-0.5">
        {TOOL_CATEGORIES.map((category, index) => {
          const categoryTools = getCategoryTools(category.id);
          const hasActiveTool = categoryTools.some((t) => t.id === activeTool);
          const selectedTool = selectedToolPerCategory[category.id];
          const selectedToolInfo = getToolInfo(selectedTool as DrawingTool);
          const displayIcon = selectedToolInfo?.icon || category.icon;
          const displayLabel = selectedToolInfo?.label || category.label;

          // Add separator after certain groups for visual organization
          const showSeparatorAfter = ["pitchfork", "gann", "shapes"].includes(category.id);

          return (
            <div key={category.id} className="flex items-center">
              <div className="relative toolbar-dropdown">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedTool) {
                      handleToolChangeWithCategory(selectedTool as DrawingTool);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveCategory(activeCategory === category.id ? null : category.id);
                    setShowSettings(false);
                    setShowAdvancedSettings(false);
                  }}
                  className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-all relative group ${
                    hasActiveTool
                      ? "bg-primary-600 text-white"
                      : "text-dark-300 hover:bg-dark-700 hover:text-white"
                  }`}
                  title={`${displayLabel} (sağ tık: diğer araçlar)`}
                >
                  <span>{displayIcon}</span>
                  <span className="absolute bottom-0 right-0.5 text-[7px] opacity-50">▾</span>
                </button>

                {/* Category Dropdown */}
                {activeCategory === category.id && (
                  <div className="absolute top-full left-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-50 min-w-[180px] max-h-[350px] overflow-y-auto">
                    <div className="sticky top-0 bg-dark-800 px-3 py-1.5 border-b border-dark-600 flex items-center justify-between">
                      <span className="text-xs text-dark-400 font-medium flex items-center gap-1.5">
                        <span>{category.icon}</span> {category.label}
                      </span>
                    </div>
                    {categoryTools.map((tool) => {
                      const isFavorite = favoriteTools.includes(tool.id);
                      return (
                        <button
                          key={tool.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToolChangeWithCategory(tool.id);
                            if (!stayInDrawingMode) {
                              setActiveCategory(null);
                            }
                          }}
                          className={`w-full px-3 py-1.5 flex items-center gap-2 text-left text-xs transition-colors group/item ${
                            activeTool === tool.id
                              ? "bg-primary-600/20 text-primary-400"
                              : "text-dark-200 hover:bg-dark-700"
                          }`}
                          title={tool.description}
                        >
                          <span className="w-5 text-center">{tool.icon}</span>
                          <span className="flex-1">{tool.label}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(tool.id);
                            }}
                            className={`text-xs transition-opacity ${
                              isFavorite ? "text-yellow-400" : "text-dark-500 opacity-0 group-hover/item:opacity-100 hover:text-yellow-400"
                            }`}
                          >
                            {isFavorite ? "★" : "☆"}
                          </button>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Separator between groups */}
              {showSeparatorAfter && <div className="w-px h-5 bg-dark-600 mx-1" />}
            </div>
          );
        })}
      </div>

      <div className="w-px h-6 bg-dark-600" />

      {/* Utility Tools */}
      <div className="flex items-center gap-0.5 px-1">
        {/* Eraser */}
        <button
          onClick={() => onToolChange(activeTool === "eraser" ? "none" : "eraser")}
          className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-all ${
            activeTool === "eraser"
              ? "bg-danger-600 text-white"
              : "text-dark-300 hover:bg-dark-700 hover:text-white"
          }`}
          title="Silgi"
        >
          ⌫
        </button>

        {/* Clear All */}
        {drawingCount > 0 && (
          <button
            onClick={onClearAll}
            className="px-2 h-8 flex items-center gap-1 rounded text-xs bg-danger-900/30 text-danger-400 hover:bg-danger-900/50 transition-all"
            title="Tüm Çizimleri Sil"
          >
            🗑 {drawingCount}
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-dark-600 mx-1" />

      {/* Utility Tools Group */}
      <div className="flex items-center gap-0.5">
        {/* Magnet Mode - 3 colors: gray (off), blue (weak), orange (strong) */}
        <button
          onClick={() => {
            const modes: MagnetMode[] = ["none", "weak", "strong"];
            const currentIndex = modes.indexOf(magnetMode);
            const nextIndex = (currentIndex + 1) % modes.length;
            onMagnetChange(modes[nextIndex]);
          }}
          className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-all duration-150
            active:scale-95 focus:outline-none ${
            magnetMode === "strong"
              ? "bg-orange-600 text-white"
              : magnetMode === "weak"
              ? "bg-blue-600 text-white"
              : "bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-white"
          }`}
          title={`Mıknatıs: ${magnetMode === "none" ? "Kapalı" : magnetMode === "weak" ? "Zayıf (Mavi)" : "Güçlü (Turuncu)"}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 7v6a9 9 0 0018 0V7h-4v6a5 5 0 01-10 0V7H3zm4-4h4v8a1 1 0 11-2 0V3H7zm10 0h4v8a1 1 0 11-2 0V3h-2z"/>
          </svg>
        </button>

        {/* Lock All Drawings */}
        <button
          onClick={() => onLockAllChange(!allLocked)}
          className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-all duration-150
            active:scale-95 focus:outline-none ${
            allLocked
              ? "bg-amber-600 text-white"
              : "bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-white"
          }`}
          title={allLocked ? "Kilidi Aç" : "Kilitle"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {allLocked ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            )}
          </svg>
        </button>

        {/* Hide All Drawings */}
        <button
          onClick={() => onHideAllChange(!allHidden)}
          className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-all duration-150
            active:scale-95 focus:outline-none ${
            allHidden
              ? "bg-dark-600 text-dark-500"
              : "bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-white"
          }`}
          title={allHidden ? "Göster" : "Gizle"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {allHidden ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            ) : (
              <>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-dark-600 mx-0.5" />

      {/* Style Settings */}
      <div className="relative toolbar-dropdown">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowSettings(!showSettings);
            setActiveCategory(null);
            setShowAdvancedSettings(false);
          }}
          className={`h-8 px-2 flex items-center gap-1.5 rounded-lg text-xs transition-all duration-150
            active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500/50 ${
            showSettings
              ? "bg-gradient-to-b from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/30"
              : "bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-white hover:shadow-lg"
          }`}
          title="Çizim Stili"
        >
          <span
            className="w-4 h-4 rounded border-2 border-dark-400"
            style={{ backgroundColor: currentStyle.color }}
          />
          <span>⚙</span>
        </button>

        {/* Style Dropdown */}
        {showSettings && (
          <div className="absolute top-full right-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-50 p-3 min-w-[240px] max-w-[calc(100vw-1rem)]">
            {/* Color Picker */}
            <div className="mb-3">
              <label className="text-xs text-dark-400 mb-1.5 block">Renk</label>
              <div className="grid grid-cols-9 gap-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStyleChange({ color, fillColor: color });
                    }}
                    className={`w-5 h-5 rounded border-2 transition-colors ${
                      currentStyle.color === color ? "border-white scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Line Width */}
            <div className="mb-3">
              <label className="text-xs text-dark-400 mb-1.5 block">Çizgi Kalınlığı</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((width) => (
                  <button
                    key={width}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStyleChange({ lineWidth: width });
                    }}
                    className={`flex-1 h-7 flex items-center justify-center rounded transition-colors ${
                      currentStyle.lineWidth === width
                        ? "bg-primary-600 text-white"
                        : "bg-dark-700 text-dark-300 hover:bg-dark-600"
                    }`}
                  >
                    <div
                      className="bg-current rounded-full"
                      style={{ width: `${width * 4}px`, height: `${width}px` }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Line Style */}
            <div className="mb-3">
              <label className="text-xs text-dark-400 mb-1.5 block">Çizgi Stili</label>
              <div className="flex items-center gap-1">
                {([{ id: "solid", label: "━━━" }, { id: "dashed", label: "╌╌╌" }, { id: "dotted", label: "┄┄┄" }] as const).map((style) => (
                  <button
                    key={style.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStyleChange({ lineStyle: style.id });
                    }}
                    className={`flex-1 h-7 flex items-center justify-center rounded text-xs transition-colors ${
                      currentStyle.lineStyle === style.id
                        ? "bg-primary-600 text-white"
                        : "bg-dark-700 text-dark-300 hover:bg-dark-600"
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fill Opacity */}
            <div className="mb-3">
              <label className="text-xs text-dark-400 mb-1.5 flex items-center justify-between">
                <span>Dolgu Opaklığı</span>
                <span className="text-dark-500">{Math.round((currentStyle.fillOpacity || 0.1) * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={(currentStyle.fillOpacity || 0.1) * 100}
                onChange={(e) => {
                  e.stopPropagation();
                  onStyleChange({ fillOpacity: parseInt(e.target.value) / 100 });
                }}
                className="w-full h-1.5 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
            </div>

            {/* Toggle Row */}
            <div className="flex items-center gap-3 mb-3">
              {/* Show Labels Toggle */}
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs text-dark-400">Etiket</label>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStyleChange({ showLabels: !currentStyle.showLabels });
                  }}
                  className={`w-8 h-4 rounded-full transition-colors relative ${
                    currentStyle.showLabels ? "bg-primary-600" : "bg-dark-600"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      currentStyle.showLabels ? "left-4" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Show Price Toggle */}
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs text-dark-400">Fiyat</label>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStyleChange({ showPrice: !currentStyle.showPrice });
                  }}
                  className={`w-8 h-4 rounded-full transition-colors relative ${
                    currentStyle.showPrice ? "bg-primary-600" : "bg-dark-600"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      currentStyle.showPrice ? "left-4" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Text Input - Always Visible */}
            <div className="mb-3">
              <label className="text-xs text-dark-400 mb-1.5 block">Metin / Not</label>
              <textarea
                value={currentStyle.text || ""}
                onChange={(e) => {
                  e.stopPropagation();
                  onStyleChange({ text: e.target.value });
                }}
                onKeyDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                placeholder="Çizime not ekle..."
                className="w-full px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-white placeholder-dark-500 outline-none focus:border-primary-500 resize-none"
                rows={2}
              />
            </div>

            {/* Advanced Settings Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAdvancedSettings(!showAdvancedSettings);
              }}
              className="w-full text-xs text-dark-400 hover:text-white flex items-center justify-center gap-1 py-1"
            >
              <span>{showAdvancedSettings ? "▲" : "▼"}</span>
              <span>Gelişmiş Ayarlar</span>
            </button>

            {/* Advanced Settings Panel */}
            {showAdvancedSettings && (
              <div className="mt-2 pt-2 border-t border-dark-600">
                {/* Extend Options */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs text-dark-400">Sola Uzat</label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStyleChange({ extendLeft: !currentStyle.extendLeft });
                      }}
                      className={`w-8 h-4 rounded-full transition-colors relative ${
                        currentStyle.extendLeft ? "bg-primary-600" : "bg-dark-600"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                          currentStyle.extendLeft ? "left-4" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs text-dark-400">Sağa Uzat</label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStyleChange({ extendRight: !currentStyle.extendRight });
                      }}
                      className={`w-8 h-4 rounded-full transition-colors relative ${
                        currentStyle.extendRight ? "bg-primary-600" : "bg-dark-600"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                          currentStyle.extendRight ? "left-4" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Show Percentage */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs text-dark-400">Percentage</label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStyleChange({ showPercentage: !currentStyle.showPercentage });
                      }}
                      className={`w-8 h-4 rounded-full transition-colors relative ${
                        currentStyle.showPercentage ? "bg-primary-600" : "bg-dark-600"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                          currentStyle.showPercentage ? "left-4" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs text-dark-400">Bars</label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStyleChange({ showBars: !currentStyle.showBars });
                      }}
                      className={`w-8 h-4 rounded-full transition-colors relative ${
                        currentStyle.showBars ? "bg-primary-600" : "bg-dark-600"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                          currentStyle.showBars ? "left-4" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Font Size */}
                <div className="mb-3">
                  <label className="text-xs text-dark-400 mb-1.5 flex items-center justify-between">
                    <span>Font Size</span>
                    <span className="text-dark-500">{currentStyle.fontSize || 12}px</span>
                  </label>
                  <input
                    type="range"
                    min="8"
                    max="24"
                    value={currentStyle.fontSize || 12}
                    onChange={(e) => {
                      e.stopPropagation();
                      onStyleChange({ fontSize: parseInt(e.target.value) });
                    }}
                    className="w-full h-1.5 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                </div>

              </div>
            )}
          </div>
        )}
      </div>

      {/* Object Tree Toggle */}
      {onToggleObjectTree && (
        <button
          onClick={onToggleObjectTree}
          className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-all duration-150
            active:scale-95 focus:outline-none ${
            showObjectTree
              ? "bg-primary-600 text-white"
              : "bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-white"
          }`}
          title="Çizim Nesneleri"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Active Tool Indicator */}
      {activeTool !== "none" && activeTool !== "crosshair" && activeTool !== "eraser" && activeToolInfo && (
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-primary-400 flex items-center gap-1">
            <span>{activeToolInfo.icon}</span>
            <span>{activeToolInfo.label}</span>
          </span>
          <span className="text-dark-500">
            ({activeToolInfo.requiredPoints === -1 ? "∞" : activeToolInfo.requiredPoints} nokta)
          </span>
          <button
            onClick={() => onToolChange("none")}
            className="text-dark-400 hover:text-white ml-1"
            title="İptal (Esc)"
          >
            ✕
          </button>
        </div>
      )}
      </div>

      {/* All Tools Modal */}
      {showAllToolsModal && (
        <AllToolsModal
          onClose={() => setShowAllToolsModal(false)}
          activeTool={activeTool}
          onToolChange={(tool) => {
            handleToolChangeWithCategory(tool);
            if (!stayInDrawingMode) {
              setShowAllToolsModal(false);
            }
          }}
          favoriteTools={favoriteTools}
          onToggleFavorite={toggleFavorite}
          customValue={customValue}
          customUnit={customUnit}
          onCustomValueChange={setCustomValue}
          onCustomUnitChange={setCustomUnit}
          onApplyCustomInterval={(val, unit) => {
            const v = parseInt(val);
            if (v > 0) {
              onIntervalChange(`custom_${v}${unit}`);
            }
          }}
          currentInterval={interval}
        />
      )}

      {/* All Intervals Modal */}
      {showAllIntervalsModal && (
        <AllIntervalsModal
          onClose={() => setShowAllIntervalsModal(false)}
          intervals={intervals}
          currentInterval={interval}
          onIntervalChange={(val) => {
            onIntervalChange(val);
            setShowAllIntervalsModal(false);
          }}
          favoriteIntervals={favoriteIntervals}
          onToggleFavorite={toggleFavoriteInterval}
          customValue={customValue}
          customUnit={customUnit}
          onCustomValueChange={setCustomValue}
          onCustomUnitChange={setCustomUnit}
          onApplyCustomInterval={(val, unit) => {
            const v = parseInt(val);
            if (v > 0) {
              onIntervalChange(`custom_${v}${unit}`);
              setShowAllIntervalsModal(false);
            }
          }}
        />
      )}
    </div>
  );
}

// ============================================
// DRAWING OBJECT TREE COMPONENT WITH GROUPING
// ============================================

interface DrawingGroup {
  id: string;
  name: string;
  color?: string;
  visible: boolean;
  collapsed: boolean;
}

interface DrawingObjectTreeProps {
  drawings: Array<{
    id: string;
    drawing_type: DrawingTool;
    visible: boolean;
    locked: boolean;
    name?: string;
    group_id?: string;
  }>;
  groups: DrawingGroup[];
  selectedDrawingId: string | null;
  onSelectDrawing: (id: string | null) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDeleteDrawing: (id: string) => void;
  onRenameDrawing: (id: string, name: string) => void;
  onMoveToGroup: (drawingId: string, groupId: string | null) => void;
  onCreateGroup: (name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onToggleGroupVisibility: (groupId: string) => void;
  onToggleGroupCollapse: (groupId: string) => void;
  onClose: () => void;
}

export function DrawingObjectTree({
  drawings,
  groups,
  selectedDrawingId,
  onSelectDrawing,
  onToggleVisibility,
  onToggleLock,
  onDeleteDrawing,
  onRenameDrawing,
  onMoveToGroup,
  onCreateGroup,
  onDeleteGroup,
  onRenameGroup,
  onToggleGroupVisibility,
  onToggleGroupCollapse,
  onClose,
}: DrawingObjectTreeProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [moveMenuOpenFor, setMoveMenuOpenFor] = useState<string | null>(null);

  // Mouse-based drag state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedDrawingId, setDraggedDrawingId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Mouse move handler for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });

      // Check which group we're over
      let foundGroup: string | null = null;
      groupRefs.current.forEach((el, groupId) => {
        const rect = el.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          foundGroup = groupId;
        }
      });
      setDragOverGroupId(foundGroup);
    };

    const handleMouseUp = () => {
      if (draggedDrawingId && dragOverGroupId !== null) {
        // Move to group (dragOverGroupId can be "ungrouped" for removing from group)
        const targetGroup = dragOverGroupId === "ungrouped" ? null : dragOverGroupId;
        onMoveToGroup(draggedDrawingId, targetGroup);
      }
      setIsDragging(false);
      setDraggedDrawingId(null);
      setDragOverGroupId(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, draggedDrawingId, dragOverGroupId, onMoveToGroup]);

  // Start dragging
  const handleDragStart = (e: React.MouseEvent, drawingId: string) => {
    e.preventDefault();
    setIsDragging(true);
    setDraggedDrawingId(drawingId);
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  // Get ungrouped drawings
  const ungroupedDrawings = drawings.filter(d => !d.group_id);

  // Get drawings by group
  const getGroupDrawings = (groupId: string) => drawings.filter(d => d.group_id === groupId);

  // Handle creating new group
  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      onCreateGroup(newGroupName.trim());
      setNewGroupName("");
      setShowNewGroupInput(false);
    }
  };


  // Render a single drawing item
  const renderDrawingItem = (drawing: typeof drawings[0], inGroup: boolean = false) => {
    const toolInfo = getToolInfo(drawing.drawing_type);
    const isBeingDragged = isDragging && draggedDrawingId === drawing.id;

    return (
      <div
        key={drawing.id}
        onMouseDown={(e) => {
          // Only start drag on left click and not on buttons
          if (e.button === 0 && groups.length > 0) {
            handleDragStart(e, drawing.id);
          }
        }}
        className={`flex items-center gap-2 px-3 py-1.5 hover:bg-dark-700 ${
          groups.length > 0 ? "cursor-grab" : "cursor-pointer"
        } ${
          selectedDrawingId === drawing.id ? "bg-primary-600/20" : ""
        } ${inGroup ? "pl-6" : ""} ${isBeingDragged ? "opacity-50 bg-primary-600/30" : ""}`}
        onClick={() => !isDragging && onSelectDrawing(drawing.id)}
      >
        {/* Icon */}
        <span className="w-5 text-center text-xs">
          {toolInfo?.icon || "?"}
        </span>

        {/* Name */}
        {editingId === drawing.id ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => {
              onRenameDrawing(drawing.id, editName);
              setEditingId(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRenameDrawing(drawing.id, editName);
                setEditingId(null);
              } else if (e.key === "Escape") {
                setEditingId(null);
              }
            }}
            className="flex-1 bg-dark-600 text-xs px-1 py-0.5 rounded text-white outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-xs text-dark-200 truncate"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingId(drawing.id);
              setEditName(drawing.name || toolInfo?.label || "Çizim");
            }}
          >
            {drawing.name || toolInfo?.label || "Çizim"}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(drawing.id);
            }}
            className={`w-5 h-5 flex items-center justify-center rounded ${
              drawing.visible ? "text-dark-300 hover:text-white" : "text-dark-500"
            }`}
            title={drawing.visible ? "Gizle" : "Göster"}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {drawing.visible ? (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </>
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              )}
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock(drawing.id);
            }}
            className={`w-5 h-5 flex items-center justify-center rounded ${
              drawing.locked ? "text-amber-400" : "text-dark-300 hover:text-white"
            }`}
            title={drawing.locked ? "Kilidi Aç" : "Kilitle"}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {drawing.locked ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              )}
            </svg>
          </button>
          {/* Move to Group Button */}
          {groups.length > 0 && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMoveMenuOpenFor(moveMenuOpenFor === drawing.id ? null : drawing.id);
                }}
                className={`w-5 h-5 flex items-center justify-center rounded ${
                  drawing.group_id ? "text-primary-400" : "text-dark-300 hover:text-white"
                }`}
                title="Gruba Taşı"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </button>
              {/* Dropdown Menu */}
              {moveMenuOpenFor === drawing.id && (
                <div className="absolute right-0 top-6 w-40 bg-dark-700 border border-dark-600 rounded shadow-lg z-50">
                  {/* Option to remove from group */}
                  {drawing.group_id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveToGroup(drawing.id, null);
                        setMoveMenuOpenFor(null);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-dark-300 hover:bg-dark-600 hover:text-white"
                    >
                      ✕ Gruptan Çıkar
                    </button>
                  )}
                  {/* List of groups */}
                  {groups.map(group => (
                    <button
                      key={group.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveToGroup(drawing.id, group.id);
                        setMoveMenuOpenFor(null);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs hover:bg-dark-600 flex items-center gap-2 ${
                        drawing.group_id === group.id ? "text-primary-400" : "text-dark-300 hover:text-white"
                      }`}
                    >
                      <span className="w-2 h-2 rounded" style={{ backgroundColor: group.color || "#6366f1" }} />
                      {group.name}
                      {drawing.group_id === group.id && " ✓"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteDrawing(drawing.id);
            }}
            className="w-5 h-5 flex items-center justify-center rounded text-dark-300 hover:text-danger-400"
            title="Sil"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute top-12 right-2 w-72 bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dark-600">
        <span className="text-sm font-medium text-white">Çizimler ({drawings.length})</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNewGroupInput(true)}
            className="p-1 text-dark-400 hover:text-white hover:bg-dark-700 rounded"
            title="Yeni Grup Oluştur"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1 text-dark-400 hover:text-white hover:bg-dark-700 rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* New Group Input */}
      {showNewGroupInput && (
        <div className="px-3 py-2 border-b border-dark-600 flex gap-2">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateGroup();
              if (e.key === "Escape") {
                setShowNewGroupInput(false);
                setNewGroupName("");
              }
            }}
            placeholder="Grup adı..."
            className="flex-1 bg-dark-700 text-xs px-2 py-1.5 rounded text-white outline-none focus:ring-1 focus:ring-primary-500"
            autoFocus
          />
          <button
            onClick={handleCreateGroup}
            className="px-2 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-500"
          >
            Ekle
          </button>
        </div>
      )}

      {/* Drawing List with Groups */}
      <div className="max-h-96 overflow-y-auto">
        {drawings.length === 0 && groups.length === 0 ? (
          <div className="px-3 py-4 text-xs text-dark-400 text-center">
            Henüz çizim yok
          </div>
        ) : (
          <>
            {/* Groups */}
            {groups.map((group) => {
              const groupDrawings = getGroupDrawings(group.id);
              const isDragOver = isDragging && dragOverGroupId === group.id;
              return (
                <div
                  key={group.id}
                  ref={(el) => {
                    if (el) groupRefs.current.set(group.id, el);
                    else groupRefs.current.delete(group.id);
                  }}
                  className={`transition-all duration-150 ${
                    isDragOver
                      ? "bg-primary-600/30 ring-2 ring-primary-500 ring-inset"
                      : isDragging
                        ? "bg-primary-600/10 ring-1 ring-primary-500/30 ring-inset"
                        : ""
                  }`}
                >
                  {/* Group Header */}
                  <div className={`flex items-center gap-2 px-3 py-2 border-b border-dark-600 transition-colors ${
                    isDragOver
                      ? "bg-primary-600 text-white"
                      : isDragging
                        ? "bg-primary-700/50 text-white"
                        : "bg-dark-750 hover:bg-dark-700"
                  }`}>
                    <button
                      onClick={() => onToggleGroupCollapse(group.id)}
                      className="text-dark-400 hover:text-white"
                    >
                      <svg className={`w-3 h-3 transition-transform ${group.collapsed ? "" : "rotate-90"}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>

                    <span
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: group.color || "#6366f1" }}
                    />

                    {editingGroupId === group.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => {
                          onRenameGroup(group.id, editName);
                          setEditingGroupId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onRenameGroup(group.id, editName);
                            setEditingGroupId(null);
                          } else if (e.key === "Escape") {
                            setEditingGroupId(null);
                          }
                        }}
                        className="flex-1 bg-dark-600 text-xs px-1 py-0.5 rounded text-white outline-none"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="flex-1 text-xs text-dark-200 font-medium cursor-pointer"
                        onDoubleClick={() => {
                          setEditingGroupId(group.id);
                          setEditName(group.name);
                        }}
                      >
                        {group.name} ({groupDrawings.length})
                      </span>
                    )}

                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => onToggleGroupVisibility(group.id)}
                        className={`w-5 h-5 flex items-center justify-center rounded ${
                          group.visible ? "text-dark-300 hover:text-white" : "text-dark-500"
                        }`}
                        title={group.visible ? "Grubu Gizle" : "Grubu Göster"}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {group.visible ? (
                            <>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </>
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" />
                          )}
                        </svg>
                      </button>
                      <button
                        onClick={() => onDeleteGroup(group.id)}
                        className="w-5 h-5 flex items-center justify-center rounded text-dark-300 hover:text-danger-400"
                        title="Grubu Sil"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Group Drawings */}
                  {!group.collapsed && groupDrawings.map((drawing) => renderDrawingItem(drawing, true))}
                </div>
              );
            })}

            {/* Ungrouped Drawings */}
            {(ungroupedDrawings.length > 0 || groups.length > 0) && (
              <div
                ref={(el) => {
                  if (el) groupRefs.current.set("ungrouped", el);
                  else groupRefs.current.delete("ungrouped");
                }}
                className={`transition-colors ${
                  isDragging && dragOverGroupId === "ungrouped"
                    ? "bg-dark-600/50"
                    : isDragging
                      ? "bg-dark-700/30"
                      : ""
                }`}
              >
                {groups.length > 0 && (
                  <div className={`px-3 py-1.5 border-b border-dark-600 transition-colors ${
                    isDragging && dragOverGroupId === "ungrouped" ? "bg-dark-600" : "bg-dark-750"
                  }`}>
                    <span className="text-xs text-dark-400">Grupsuz ({ungroupedDrawings.length})</span>
                  </div>
                )}
                {ungroupedDrawings.map((drawing) => renderDrawingItem(drawing))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-dark-600 text-[10px] text-dark-500">
        {groups.length > 0
          ? "Sürükle-bırak ile gruplara taşı"
          : "Grup oluşturmak için + butonuna tıklayın"
        }
      </div>

      {/* Drag indicator */}
      {isDragging && draggedDrawingId && (
        <div
          className="fixed pointer-events-none z-[100] bg-dark-700 border border-primary-500 rounded px-2 py-1 text-xs text-white shadow-lg"
          style={{
            left: mousePos.x + 10,
            top: mousePos.y + 10,
          }}
        >
          {(() => {
            const drawing = drawings.find(d => d.id === draggedDrawingId);
            const toolInfo = drawing ? getToolInfo(drawing.drawing_type) : null;
            return (
              <span className="flex items-center gap-1">
                <span>{toolInfo?.icon || "?"}</span>
                <span>{drawing?.name || toolInfo?.label || "Çizim"}</span>
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ============================================
// DRAWING SETTINGS PANEL COMPONENT
// ============================================

interface DrawingSettingsPanelProps {
  drawing: Drawing;
  onUpdateDrawing: (updates: Partial<Drawing>) => void;
  onUpdateStyle: (updates: Partial<DrawingStyle>) => void;
  onUpdatePoint: (index: number, point: DrawingPoint) => void;
  onClone: () => void;
  onDelete: () => void;
  onClose: () => void;
  formatPrice: (price: number) => string;
}

export function DrawingSettingsPanel({
  drawing,
  onUpdateDrawing,
  onUpdateStyle,
  onUpdatePoint,
  onClone,
  onDelete,
  onClose,
  formatPrice,
}: DrawingSettingsPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"style" | "coordinates" | "visibility" | "levels">("style");

  // Draggable modal state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Safety checks
  if (!drawing || !drawing.drawing_type) {
    return null;
  }

  const toolInfo = getToolInfo(drawing.drawing_type);
  const drawingStyle = drawing.style || {};

  const isFibonacci = drawing.drawing_type.startsWith("fib_");
  const isPitchfork = ["pitchfork", "schiff_pitchfork", "modified_schiff", "inside_pitchfork"].includes(drawing.drawing_type);
  const isPosition = drawing.drawing_type === "long_position" || drawing.drawing_type === "short_position";
  const isLine = ["trendline", "ray", "extended", "horizontal", "vertical", "horizontal_ray", "info_line", "trend_angle", "arrow"].includes(drawing.drawing_type);
  const isAnchoredVwap = drawing.drawing_type === "anchored_vwap";
  const isParallelChannel = drawing.drawing_type === "parallel_channel";

  // Get Fibonacci levels from style or use defaults
  const fibLevels = drawingStyle.fibLevels || FIBONACCI_LEVELS.slice(0, 7);
  const fibColors = drawingStyle.fibColors || FIBONACCI_COLORS.slice(0, 7);

  // Get Pitchfork levels from style or use defaults
  const pitchforkLevels = drawingStyle.pitchforkLevels || [0.25, 0.5, 0.75];
  const pitchforkColors = drawingStyle.pitchforkColors || ["#787B86", "#2962FF", "#787B86"];

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 16);
  };

  const parseDateTime = (value: string) => {
    return new Date(value).getTime();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[100]" onClick={onClose}>
      <div
        ref={modalRef}
        className="absolute bg-dark-800 border border-dark-600 rounded-lg shadow-2xl w-[400px] max-h-[80vh] overflow-hidden"
        style={{
          left: `calc(50% + ${position.x}px)`,
          top: `calc(50% + ${position.y}px)`,
          transform: "translate(-50%, -50%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Draggable */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-dark-600 bg-dark-700 cursor-move select-none"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{toolInfo?.icon}</span>
            <span className="text-sm font-medium text-white">{toolInfo?.label || "Çizim"} Ayarları</span>
          </div>
          <button
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-dark-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-600">
          <button
            onClick={() => setActiveTab("style")}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === "style"
                ? "text-primary-400 border-b-2 border-primary-400"
                : "text-dark-400 hover:text-white"
            }`}
          >
            Stil
          </button>
          <button
            onClick={() => setActiveTab("coordinates")}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === "coordinates"
                ? "text-primary-400 border-b-2 border-primary-400"
                : "text-dark-400 hover:text-white"
            }`}
          >
            Koordinat
          </button>
          {(isFibonacci || isPitchfork || isAnchoredVwap || isParallelChannel) && (
            <button
              onClick={() => setActiveTab("levels")}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === "levels"
                  ? "text-primary-400 border-b-2 border-primary-400"
                  : "text-dark-400 hover:text-white"
              }`}
            >
              Seviyeler
            </button>
          )}
          <button
            onClick={() => setActiveTab("visibility")}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === "visibility"
                ? "text-primary-400 border-b-2 border-primary-400"
                : "text-dark-400 hover:text-white"
            }`}
          >
            Görünürlük
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[400px] overflow-y-auto">
          {/* Style Tab */}
          {activeTab === "style" && (
            <div className="space-y-4">
              {/* Line Color */}
              <div>
                <label className="text-xs text-dark-400 mb-2 block">Çizgi Rengi</label>
                <div className="grid grid-cols-9 gap-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => onUpdateStyle({ color })}
                      className={`w-6 h-6 rounded border-2 transition-all ${
                        drawingStyle.color === color ? "border-white scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Line Width */}
              <div>
                <label className="text-xs text-dark-400 mb-2 block">Çizgi Kalınlığı</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((width) => (
                    <button
                      key={width}
                      onClick={() => onUpdateStyle({ lineWidth: width })}
                      className={`flex-1 h-8 flex items-center justify-center rounded transition-colors ${
                        drawingStyle.lineWidth === width
                          ? "bg-primary-600 text-white"
                          : "bg-dark-700 text-dark-300 hover:bg-dark-600"
                      }`}
                    >
                      <div className="bg-current rounded-full" style={{ width: width * 4, height: width }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Line Style */}
              <div>
                <label className="text-xs text-dark-400 mb-2 block">Çizgi Stili</label>
                <div className="flex gap-1">
                  {[
                    { id: "solid" as const, label: "━━━" },
                    { id: "dashed" as const, label: "╌╌╌" },
                    { id: "dotted" as const, label: "┄┄┄" },
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => onUpdateStyle({ lineStyle: style.id })}
                      className={`flex-1 h-8 flex items-center justify-center rounded text-sm transition-colors ${
                        drawingStyle.lineStyle === style.id
                          ? "bg-primary-600 text-white"
                          : "bg-dark-700 text-dark-300 hover:bg-dark-600"
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fill Color & Opacity (for shapes) */}
              {["rectangle", "circle", "ellipse", "triangle", "parallel_channel"].includes(drawing.drawing_type) && (
                <>
                  <div>
                    <label className="text-xs text-dark-400 mb-2 block">Dolgu Rengi</label>
                    <div className="grid grid-cols-9 gap-1">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => onUpdateStyle({ fillColor: color })}
                          className={`w-6 h-6 rounded border-2 transition-all ${
                            drawingStyle.fillColor === color ? "border-white scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-dark-400 mb-2 flex justify-between">
                      <span>Dolgu Opaklığı</span>
                      <span className="text-dark-500">{Math.round((drawingStyle.fillOpacity || 0.1) * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={(drawingStyle.fillOpacity || 0.1) * 100}
                      onChange={(e) => onUpdateStyle({ fillOpacity: parseInt(e.target.value) / 100 })}
                      className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
                    />
                  </div>
                </>
              )}

              {/* Extend Options (for lines) */}
              {isLine && (
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-dark-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={drawingStyle.extendLeft || false}
                      onChange={(e) => onUpdateStyle({ extendLeft: e.target.checked })}
                      className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500"
                    />
                    Sola Uzat
                  </label>
                  <label className="flex items-center gap-2 text-xs text-dark-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={drawingStyle.extendRight || false}
                      onChange={(e) => onUpdateStyle({ extendRight: e.target.checked })}
                      className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500"
                    />
                    Sağa Uzat
                  </label>
                </div>
              )}

              {/* Display Options */}
              <div className="space-y-2">
                <label className="text-xs text-dark-400 block">Görünüm Seçenekleri</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-xs text-dark-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={drawingStyle.showLabels !== false}
                      onChange={(e) => onUpdateStyle({ showLabels: e.target.checked })}
                      className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500"
                    />
                    Etiket Göster
                  </label>
                  <label className="flex items-center gap-2 text-xs text-dark-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={drawingStyle.showPrice !== false}
                      onChange={(e) => onUpdateStyle({ showPrice: e.target.checked })}
                      className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500"
                    />
                    Fiyat Göster
                  </label>
                  <label className="flex items-center gap-2 text-xs text-dark-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={drawingStyle.showPercentage || false}
                      onChange={(e) => onUpdateStyle({ showPercentage: e.target.checked })}
                      className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500"
                    />
                    % Göster
                  </label>
                  <label className="flex items-center gap-2 text-xs text-dark-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={drawingStyle.showBars || false}
                      onChange={(e) => onUpdateStyle({ showBars: e.target.checked })}
                      className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500"
                    />
                    Mum Sayısı
                  </label>
                </div>
              </div>

              {/* Text / Note Input - Always Visible */}
              <div>
                <label className="text-xs text-dark-400 mb-2 block">Metin / Not</label>
                <textarea
                  value={drawingStyle.text || ""}
                  onChange={(e) => onUpdateStyle({ text: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded text-sm text-white resize-none focus:border-primary-500 outline-none"
                  rows={2}
                  placeholder="Çizime not ekleyebilirsiniz..."
                />
              </div>

              {/* Font Size */}
              <div>
                <label className="text-xs text-dark-400 mb-2 flex justify-between">
                  <span>Yazı Boyutu</span>
                  <span className="text-dark-500">{drawingStyle.fontSize || 12}px</span>
                </label>
                <input
                  type="range"
                  min="8"
                  max="24"
                  value={drawingStyle.fontSize || 12}
                  onChange={(e) => onUpdateStyle({ fontSize: parseInt(e.target.value) })}
                  className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
              </div>
            </div>
          )}

          {/* Coordinates Tab */}
          {activeTab === "coordinates" && (
            <div className="space-y-4">
              {drawing.points.map((point, index) => (
                <div key={index} className="p-3 bg-dark-700 rounded-lg">
                  <div className="text-xs text-dark-400 mb-2 font-medium">
                    Nokta {index + 1}
                    {drawing.drawing_type === "fib_retracement" && (index === 0 ? " (Başlangıç)" : " (Bitiş)")}
                    {drawing.drawing_type === "abcd" && (["A", "B", "C", "D"][index] ? ` (${["A", "B", "C", "D"][index]})` : "")}
                    {drawing.drawing_type === "xabcd" && (["X", "A", "B", "C", "D"][index] ? ` (${["X", "A", "B", "C", "D"][index]})` : "")}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-dark-500 block mb-1">Fiyat</label>
                      <input
                        type="number"
                        step="0.00000001"
                        value={point.price}
                        onChange={(e) => onUpdatePoint(index, { ...point, price: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 bg-dark-600 border border-dark-500 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-dark-500 block mb-1">Tarih/Saat</label>
                      <input
                        type="datetime-local"
                        value={formatDateTime(point.time)}
                        onChange={(e) => onUpdatePoint(index, { ...point, time: parseDateTime(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-dark-600 border border-dark-500 rounded text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Position Tool Specific */}
              {isPosition && (
                <div className="p-3 bg-dark-700 rounded-lg space-y-2">
                  <div className="text-xs text-dark-400 font-medium">Pozisyon Ayarları</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-dark-500 block mb-1">Giriş</label>
                      <input
                        type="number"
                        step="0.00000001"
                        value={drawing.points[0]?.price || 0}
                        onChange={(e) => {
                          if (drawing.points[0]) {
                            onUpdatePoint(0, { ...drawing.points[0], price: parseFloat(e.target.value) || 0 });
                          }
                        }}
                        className="w-full px-2 py-1.5 bg-dark-600 border border-dark-500 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-dark-500 block mb-1">Hedef</label>
                      <input
                        type="number"
                        step="0.00000001"
                        value={drawing.points[1]?.price || 0}
                        onChange={(e) => {
                          if (drawing.points[1]) {
                            onUpdatePoint(1, { ...drawing.points[1], price: parseFloat(e.target.value) || 0 });
                          }
                        }}
                        className="w-full px-2 py-1.5 bg-dark-600 border border-dark-500 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-dark-500 block mb-1">Zarar Durdur</label>
                      <div className="text-xs text-dark-400 py-1.5">
                        {drawing.points[0] && drawing.points[1] ? formatPrice(
                          drawing.drawing_type === "long_position"
                            ? drawing.points[0].price - (drawing.points[1].price - drawing.points[0].price)
                            : drawing.points[0].price + (drawing.points[0].price - drawing.points[1].price)
                        ) : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fibonacci Levels Tab */}
          {activeTab === "levels" && isFibonacci && (
            <div className="space-y-2">
              <div className="text-xs text-dark-400 mb-3">{t("drawingTools.settings.editLevels")}</div>
              {fibLevels.map((level, index) => {
                const priceValue = drawing.points.length >= 2
                  ? drawing.points[0].price + (drawing.points[1].price - drawing.points[0].price) * level
                  : 0;

                return (
                  <div key={index} className="flex items-center gap-2 p-2 bg-dark-700 rounded">
                    {/* Enable/Disable */}
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => {
                        const newLevels = fibLevels.filter((_, i) => i !== index);
                        const newColors = fibColors.filter((_, i) => i !== index);
                        onUpdateStyle({ fibLevels: newLevels, fibColors: newColors });
                      }}
                      className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500"
                    />

                    {/* Level Input (0-1 format) */}
                    <input
                      type="number"
                      step="0.001"
                      value={level}
                      onChange={(e) => {
                        const newValue = parseFloat(e.target.value);
                        if (!isNaN(newValue)) {
                          const newLevels = [...fibLevels];
                          newLevels[index] = newValue;
                          onUpdateStyle({ fibLevels: newLevels.sort((a, b) => a - b) });
                        }
                      }}
                      className="w-20 px-1.5 py-0.5 bg-dark-600 border border-dark-500 rounded text-xs text-white text-center"
                    />

                    {/* Color Picker */}
                    <input
                      type="color"
                      value={fibColors[index] || FIBONACCI_COLORS[index % FIBONACCI_COLORS.length]}
                      onChange={(e) => {
                        const newColors = [...fibColors];
                        newColors[index] = e.target.value;
                        onUpdateStyle({ fibColors: newColors });
                      }}
                      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                    />

                    {/* Price Value (calculated) */}
                    <span className="text-xs text-dark-400 flex-1 text-right font-mono">
                      {drawing.points.length >= 2 ? formatPrice(priceValue) : "-"}
                    </span>

                    {/* Delete button */}
                    <button
                      onClick={() => {
                        const newLevels = fibLevels.filter((_, i) => i !== index);
                        const newColors = fibColors.filter((_, i) => i !== index);
                        onUpdateStyle({ fibLevels: newLevels, fibColors: newColors });
                      }}
                      className="text-dark-500 hover:text-danger-400 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              {/* Add Custom Level */}
              <button
                onClick={() => {
                  let newLevel = 0.5;
                  while (fibLevels.includes(newLevel)) {
                    newLevel = Math.round((newLevel + 0.1) * 1000) / 1000;
                  }
                  const newLevels = [...fibLevels, newLevel].sort((a, b) => a - b);
                  const newColors = [...fibColors, FIBONACCI_COLORS[fibLevels.length % FIBONACCI_COLORS.length]];
                  onUpdateStyle({ fibLevels: newLevels, fibColors: newColors });
                }}
                className="w-full py-1.5 text-xs text-primary-400 hover:text-primary-300 bg-dark-600 hover:bg-dark-500 rounded transition-colors flex items-center justify-center gap-1"
              >
                <span>+</span> {t("drawingTools.settings.addLevel")}
              </button>

              {/* Preset Levels - Categorized */}
              <div className="pt-2 border-t border-dark-600 space-y-2">
                <div className="text-[10px] text-dark-500 mb-1">{t("drawingTools.settings.presetLevels")}</div>

                {/* Internal Levels (0-1) */}
                <div>
                  <div className="text-[9px] text-dark-500 mb-1">{t("drawingTools.settings.internalLevels")}</div>
                  <div className="flex flex-wrap gap-1">
                    {[0, 0.236, 0.382, 0.5, 0.618, 0.65, 0.786, 1].map(preset => (
                      <button
                        key={preset}
                        onClick={() => {
                          if (!fibLevels.includes(preset)) {
                            const newLevels = [...fibLevels, preset].sort((a, b) => a - b);
                            const newColors = [...fibColors, FIBONACCI_COLORS[fibLevels.length % FIBONACCI_COLORS.length]];
                            onUpdateStyle({ fibLevels: newLevels, fibColors: newColors });
                          }
                        }}
                        disabled={fibLevels.includes(preset)}
                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                          fibLevels.includes(preset)
                            ? "bg-primary-600/30 text-primary-400"
                            : "bg-dark-600 text-dark-300 hover:bg-primary-600/30 hover:text-primary-400"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* External Levels (>1) */}
                <div>
                  <div className="text-[9px] text-dark-500 mb-1">{t("drawingTools.settings.externalLevels")}</div>
                  <div className="flex flex-wrap gap-1">
                    {[1.272, 1.414, 1.618, 2, 2.272, 2.618, 3.618, 4.236].map(preset => (
                      <button
                        key={preset}
                        onClick={() => {
                          if (!fibLevels.includes(preset)) {
                            const newLevels = [...fibLevels, preset].sort((a, b) => a - b);
                            const newColors = [...fibColors, FIBONACCI_COLORS[fibLevels.length % FIBONACCI_COLORS.length]];
                            onUpdateStyle({ fibLevels: newLevels, fibColors: newColors });
                          }
                        }}
                        disabled={fibLevels.includes(preset)}
                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                          fibLevels.includes(preset)
                            ? "bg-primary-600/30 text-primary-400"
                            : "bg-dark-600 text-dark-300 hover:bg-primary-600/30 hover:text-primary-400"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Extension Levels (<0) */}
                <div>
                  <div className="text-[9px] text-dark-500 mb-1">{t("drawingTools.settings.extensionLevels")}</div>
                  <div className="flex flex-wrap gap-1">
                    {[-0.272, -0.618, -1, -1.618, -2.618].map(preset => (
                      <button
                        key={preset}
                        onClick={() => {
                          if (!fibLevels.includes(preset)) {
                            const newLevels = [...fibLevels, preset].sort((a, b) => a - b);
                            const newColors = [...fibColors, FIBONACCI_COLORS[fibLevels.length % FIBONACCI_COLORS.length]];
                            onUpdateStyle({ fibLevels: newLevels, fibColors: newColors });
                          }
                        }}
                        disabled={fibLevels.includes(preset)}
                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                          fibLevels.includes(preset)
                            ? "bg-primary-600/30 text-primary-400"
                            : "bg-dark-600 text-dark-300 hover:bg-primary-600/30 hover:text-primary-400"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fibo Display Options */}
              <div className="pt-3 border-t border-dark-600 space-y-2">
                <label className="flex items-center gap-2 text-xs text-dark-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={drawingStyle.fibLabelsLeft || false}
                    onChange={(e) => onUpdateStyle({ fibLabelsLeft: e.target.checked })}
                    className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500"
                  />
                  {t("drawingTools.settings.labelsLeft")}
                </label>
                <label className="flex items-center gap-2 text-xs text-dark-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={drawingStyle.showPrice !== false}
                    onChange={(e) => onUpdateStyle({ showPrice: e.target.checked })}
                    className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500"
                  />
                  {t("drawingTools.settings.showPrice")}
                </label>
                <label className="flex items-center gap-2 text-xs text-dark-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={drawingStyle.extendLeft || false}
                    onChange={(e) => onUpdateStyle({ extendLeft: e.target.checked })}
                    className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500"
                  />
                  {t("drawingTools.settings.extendLeft")}
                </label>
                <label className="flex items-center gap-2 text-xs text-dark-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={drawingStyle.extendRight || false}
                    onChange={(e) => onUpdateStyle({ extendRight: e.target.checked })}
                    className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500"
                  />
                  {t("drawingTools.settings.extendRight")}
                </label>
              </div>
            </div>
          )}

          {/* Pitchfork Levels Tab */}
          {activeTab === "levels" && isPitchfork && (
            <div className="space-y-3">
              <div className="text-xs text-dark-400 mb-2">Pitchfork Seviye Ayarları</div>

              {/* Median Line Settings */}
              <div className="p-3 bg-dark-700 rounded-lg space-y-2">
                <div className="text-xs text-white font-medium mb-2">Median Çizgisi</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-dark-300">Göster</span>
                  <button
                    onClick={() => onUpdateStyle({ showMedian: !(drawingStyle.showMedian !== false) })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      drawingStyle.showMedian !== false ? "bg-primary-500" : "bg-dark-600"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      drawingStyle.showMedian !== false ? "left-5" : "left-0.5"
                    }`} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-dark-300">Renk</span>
                  <input
                    type="color"
                    value={drawingStyle.medianColor || "#FF9800"}
                    onChange={(e) => onUpdateStyle({ medianColor: e.target.value })}
                    className="w-8 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                </div>
              </div>

              {/* Level Lines Settings */}
              <div className="p-3 bg-dark-700 rounded-lg space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white font-medium">Seviye Çizgileri</span>
                  <button
                    onClick={() => onUpdateStyle({ showPitchforkLevels: !(drawingStyle.showPitchforkLevels !== false) })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      drawingStyle.showPitchforkLevels !== false ? "bg-primary-500" : "bg-dark-600"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      drawingStyle.showPitchforkLevels !== false ? "left-5" : "left-0.5"
                    }`} />
                  </button>
                </div>

                {pitchforkLevels.map((level, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-dark-600 rounded">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="2"
                      value={level}
                      onChange={(e) => {
                        const newValue = parseFloat(e.target.value);
                        if (!isNaN(newValue)) {
                          const newLevels = [...pitchforkLevels];
                          newLevels[index] = newValue;
                          onUpdateStyle({ pitchforkLevels: newLevels.sort((a, b) => a - b) });
                        }
                      }}
                      className="w-16 px-1.5 py-0.5 bg-dark-700 border border-dark-500 rounded text-xs text-white text-center"
                    />
                    <span className="text-xs text-dark-400">{Math.round(level * 100)}%</span>
                    <input
                      type="color"
                      value={pitchforkColors[index] || "#787B86"}
                      onChange={(e) => {
                        const newColors = [...pitchforkColors];
                        newColors[index] = e.target.value;
                        onUpdateStyle({ pitchforkColors: newColors });
                      }}
                      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                    />
                    <button
                      onClick={() => {
                        const newLevels = pitchforkLevels.filter((_, i) => i !== index);
                        const newColors = pitchforkColors.filter((_, i) => i !== index);
                        onUpdateStyle({ pitchforkLevels: newLevels, pitchforkColors: newColors });
                      }}
                      className="text-dark-500 hover:text-danger-400 transition-colors ml-auto"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Add Level Button */}
                <button
                  onClick={() => {
                    let newLevel = 0.5;
                    while (pitchforkLevels.includes(newLevel)) {
                      newLevel = Math.round((newLevel + 0.25) * 100) / 100;
                    }
                    const newLevels = [...pitchforkLevels, newLevel].sort((a, b) => a - b);
                    const newColors = [...pitchforkColors, "#787B86"];
                    onUpdateStyle({ pitchforkLevels: newLevels, pitchforkColors: newColors });
                  }}
                  className="w-full py-1.5 text-xs text-primary-400 hover:text-primary-300 bg-dark-700 hover:bg-dark-600 rounded transition-colors flex items-center justify-center gap-1"
                >
                  <span>+</span> Seviye Ekle
                </button>

                {/* Preset Levels */}
                <div className="pt-2 border-t border-dark-500">
                  <div className="text-[10px] text-dark-500 mb-1">Hızlı Ekle</div>
                  <div className="flex flex-wrap gap-1">
                    {[0.25, 0.5, 0.75, 1.25, 1.5, 1.75, 2].map(preset => (
                      <button
                        key={preset}
                        onClick={() => {
                          if (!pitchforkLevels.includes(preset)) {
                            const newLevels = [...pitchforkLevels, preset].sort((a, b) => a - b);
                            const newColors = [...pitchforkColors, "#787B86"];
                            onUpdateStyle({ pitchforkLevels: newLevels, pitchforkColors: newColors });
                          }
                        }}
                        disabled={pitchforkLevels.includes(preset)}
                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                          pitchforkLevels.includes(preset)
                            ? "bg-primary-600/30 text-primary-400"
                            : "bg-dark-700 text-dark-300 hover:bg-primary-600/30 hover:text-primary-400"
                        }`}
                      >
                        {Math.round(preset * 100)}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Show Labels */}
              <div className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                <span className="text-xs text-dark-300">Etiketleri Göster</span>
                <button
                  onClick={() => onUpdateStyle({ showLabels: !(drawingStyle.showLabels !== false) })}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    drawingStyle.showLabels !== false ? "bg-primary-500" : "bg-dark-600"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    drawingStyle.showLabels !== false ? "left-5" : "left-0.5"
                  }`} />
                </button>
              </div>
            </div>
          )}

          {/* Anchored VWAP Settings Tab */}
          {activeTab === "levels" && isAnchoredVwap && (
            <div className="space-y-3">
              <div className="text-xs text-dark-400 mb-2">VWAP Ayarları</div>

              {/* Source Selection */}
              <div className="p-3 bg-dark-700 rounded-lg">
                <div className="text-xs text-white font-medium mb-2">Kaynak</div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: "hlc3", label: "HLC3" },
                    { id: "hl2", label: "HL2" },
                    { id: "ohlc4", label: "OHLC4" },
                    { id: "close", label: "Close" },
                  ].map((src) => (
                    <button
                      key={src.id}
                      onClick={() => onUpdateStyle({ vwapSource: src.id as "hlc3" | "hl2" | "ohlc4" | "close" })}
                      className={`px-2 py-1.5 text-[10px] rounded transition-colors ${
                        (drawingStyle.vwapSource || "hlc3") === src.id
                          ? "bg-primary-600 text-white"
                          : "bg-dark-600 text-dark-300 hover:bg-dark-500"
                      }`}
                    >
                      {src.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Band Settings */}
              <div className="p-3 bg-dark-700 rounded-lg space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white font-medium">Standart Sapma Bantları</span>
                  <button
                    onClick={() => onUpdateStyle({ showVwapBands: !(drawingStyle.showVwapBands || false) })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      drawingStyle.showVwapBands ? "bg-primary-500" : "bg-dark-600"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      drawingStyle.showVwapBands ? "left-5" : "left-0.5"
                    }`} />
                  </button>
                </div>

                {(drawingStyle.vwapBands || [1, 2, 3]).map((mult, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-dark-600 rounded">
                    <span className="text-xs text-dark-300 w-8">{mult}σ</span>
                    <input
                      type="color"
                      value={(drawingStyle.vwapBandColors || ["#2962FF40", "#2962FF25", "#2962FF15"])[index] || "#2962FF40"}
                      onChange={(e) => {
                        const newColors = [...(drawingStyle.vwapBandColors || ["#2962FF40", "#2962FF25", "#2962FF15"])];
                        newColors[index] = e.target.value;
                        onUpdateStyle({ vwapBandColors: newColors });
                      }}
                      className="w-8 h-6 rounded cursor-pointer bg-transparent border-0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parallel Channel Settings Tab */}
          {activeTab === "levels" && isParallelChannel && (
            <div className="space-y-3">
              <div className="text-xs text-dark-400 mb-2">Kanal Ayarları</div>

              {/* Middle Line */}
              <div className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                <span className="text-xs text-dark-300">Orta Çizgiyi Göster</span>
                <button
                  onClick={() => onUpdateStyle({ showMiddleLine: !(drawingStyle.showMiddleLine || false) })}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    drawingStyle.showMiddleLine ? "bg-primary-500" : "bg-dark-600"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    drawingStyle.showMiddleLine ? "left-5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* Channel Levels */}
              <div className="p-3 bg-dark-700 rounded-lg space-y-2">
                <div className="text-xs text-white font-medium mb-2">Ara Seviyeler</div>
                <div className="flex flex-wrap gap-1">
                  {[0.25, 0.5, 0.75].map(level => {
                    const currentLevels = drawingStyle.channelLevels || [];
                    const isActive = currentLevels.includes(level);
                    return (
                      <button
                        key={level}
                        onClick={() => {
                          const newLevels = isActive
                            ? currentLevels.filter(l => l !== level)
                            : [...currentLevels, level].sort((a, b) => a - b);
                          onUpdateStyle({ channelLevels: newLevels });
                        }}
                        className={`px-3 py-1.5 text-xs rounded transition-colors ${
                          isActive
                            ? "bg-primary-600 text-white"
                            : "bg-dark-600 text-dark-300 hover:bg-dark-500"
                        }`}
                      >
                        {Math.round(level * 100)}%
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Extend Options */}
              <div className="p-3 bg-dark-700 rounded-lg space-y-2">
                <div className="text-xs text-white font-medium mb-2">Uzatma</div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-dark-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={drawingStyle.extendLeft || false}
                      onChange={(e) => onUpdateStyle({ extendLeft: e.target.checked })}
                      className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500"
                    />
                    Sola
                  </label>
                  <label className="flex items-center gap-2 text-xs text-dark-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={drawingStyle.extendRight || false}
                      onChange={(e) => onUpdateStyle({ extendRight: e.target.checked })}
                      className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500"
                    />
                    Sağa
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Visibility Tab */}
          {activeTab === "visibility" && (
            <div className="space-y-4">
              {/* Lock Drawing */}
              <div className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                <div>
                  <div className="text-xs text-white font-medium">{t("drawingTools.settings.lockDrawing")}</div>
                  <div className="text-[10px] text-dark-400">{t("drawingTools.settings.lockDescription")}</div>
                </div>
                <button
                  onClick={() => onUpdateDrawing({ locked: !drawing.locked })}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    drawing.locked ? "bg-amber-500" : "bg-dark-600"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    drawing.locked ? "left-5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* Hide Drawing */}
              <div className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                <div>
                  <div className="text-xs text-white font-medium">{t("drawingTools.settings.hideDrawing")}</div>
                  <div className="text-[10px] text-dark-400">{t("drawingTools.settings.hideDescription")}</div>
                </div>
                <button
                  onClick={() => onUpdateDrawing({ visible: !drawing.visible })}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    drawing.visible ? "bg-primary-500" : "bg-dark-600"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    drawing.visible ? "left-5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* Drawing Name */}
              <div>
                <label className="text-xs text-dark-400 mb-2 block">{t("drawingTools.settings.drawingName")}</label>
                <input
                  type="text"
                  value={drawing.name || ""}
                  onChange={(e) => onUpdateDrawing({ name: e.target.value })}
                  placeholder={toolInfo?.label || "Drawing"}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded text-sm text-white"
                />
              </div>

              {/* Timeframe Visibility */}
              <div>
                <label className="text-xs text-dark-400 mb-2 block">{t("drawingTools.settings.showOnTimeframes")}</label>
                <div className="grid grid-cols-4 gap-1">
                  {["1m", "5m", "15m", "1H", "4H", "1D", "1W", "All"].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => {
                        const current = drawing.timeframes || [];
                        if (tf === "All") {
                          onUpdateDrawing({ timeframes: undefined });
                        } else {
                          const newTfs = current.includes(tf)
                            ? current.filter(t => t !== tf)
                            : [...current, tf];
                          onUpdateDrawing({ timeframes: newTfs.length > 0 ? newTfs : undefined });
                        }
                      }}
                      className={`px-2 py-1.5 text-[10px] rounded transition-colors ${
                        (tf === "All" && !drawing.timeframes) || drawing.timeframes?.includes(tf)
                          ? "bg-primary-600 text-white"
                          : "bg-dark-700 text-dark-400 hover:bg-dark-600"
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-dark-600 bg-dark-700">
          <div className="flex gap-2">
            <button
              onClick={onClone}
              className="px-3 py-1.5 text-xs bg-dark-600 text-dark-300 hover:text-white rounded transition-colors"
            >
              Kopyala
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-1.5 text-xs bg-danger-900/30 text-danger-400 hover:bg-danger-900/50 rounded transition-colors"
            >
              Sil
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs bg-primary-600 text-white hover:bg-primary-500 rounded transition-colors"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CONTEXT MENU COMPONENT
// ============================================

interface DrawingContextMenuProps {
  x: number;
  y: number;
  drawing: Drawing;
  onOpenSettings: () => void;
  onClone: () => void;
  onDelete: () => void;
  onLock: () => void;
  onHide: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onClose: () => void;
}

export function DrawingContextMenu({
  x,
  y,
  drawing,
  onOpenSettings,
  onClone,
  onDelete,
  onLock,
  onHide,
  onBringToFront,
  onSendToBack,
  onClose,
}: DrawingContextMenuProps) {
  const toolInfo = getToolInfo(drawing.drawing_type);

  useEffect(() => {
    const handleClick = () => onClose();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-[100] py-1 min-w-[160px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-dark-600 flex items-center gap-2">
        <span>{toolInfo?.icon}</span>
        <span className="text-xs text-dark-300">{drawing.name || toolInfo?.label}</span>
      </div>

      {/* Menu Items */}
      <button
        onClick={() => { onOpenSettings(); onClose(); }}
        className="w-full px-3 py-1.5 text-left text-xs text-dark-200 hover:bg-dark-700 flex items-center gap-2"
      >
        <span>⚙️</span> Ayarlar...
      </button>

      <div className="border-t border-dark-700 my-1" />

      <button
        onClick={() => { onClone(); onClose(); }}
        className="w-full px-3 py-1.5 text-left text-xs text-dark-200 hover:bg-dark-700 flex items-center gap-2"
      >
        <span>📋</span> Kopyala
      </button>

      <button
        onClick={() => { onLock(); onClose(); }}
        className="w-full px-3 py-1.5 text-left text-xs text-dark-200 hover:bg-dark-700 flex items-center gap-2"
      >
        {drawing.locked ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
        {drawing.locked ? "Kilidi Aç" : "Kilitle"}
      </button>

      <button
        onClick={() => { onHide(); onClose(); }}
        className="w-full px-3 py-1.5 text-left text-xs text-dark-200 hover:bg-dark-700 flex items-center gap-2"
      >
        <span>{drawing.visible ? "👁️‍🗨️" : "👁️"}</span> {drawing.visible ? "Gizle" : "Göster"}
      </button>

      <div className="border-t border-dark-700 my-1" />

      <button
        onClick={() => { onBringToFront(); onClose(); }}
        className="w-full px-3 py-1.5 text-left text-xs text-dark-200 hover:bg-dark-700 flex items-center gap-2"
      >
        <span>⬆️</span> Öne Getir
      </button>

      <button
        onClick={() => { onSendToBack(); onClose(); }}
        className="w-full px-3 py-1.5 text-left text-xs text-dark-200 hover:bg-dark-700 flex items-center gap-2"
      >
        <span>⬇️</span> Arkaya Gönder
      </button>

      <div className="border-t border-dark-700 my-1" />

      <button
        onClick={() => { onDelete(); onClose(); }}
        className="w-full px-3 py-1.5 text-left text-xs text-danger-400 hover:bg-dark-700 flex items-center gap-2"
      >
        <span>🗑️</span> Sil
      </button>
    </div>
  );
}

// ============================================
// ALL TOOLS MODAL COMPONENT
// ============================================

interface AllToolsModalProps {
  onClose: () => void;
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  favoriteTools: DrawingTool[];
  onToggleFavorite: (tool: DrawingTool) => void;
  customValue: string;
  customUnit: "s" | "m" | "h" | "D" | "W";
  onCustomValueChange: (value: string) => void;
  onCustomUnitChange: (unit: "s" | "m" | "h" | "D" | "W") => void;
  onApplyCustomInterval: (value: string, unit: "s" | "m" | "h" | "D" | "W") => void;
  currentInterval: string;
}

function AllToolsModal({
  onClose,
  activeTool,
  onToolChange,
  favoriteTools,
  onToggleFavorite,
  customValue,
  customUnit,
  onCustomValueChange,
  onCustomUnitChange,
  onApplyCustomInterval,
  currentInterval,
}: AllToolsModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const filterTools = (tools: ReturnType<typeof getCategoryTools>) => {
    if (!searchTerm) return tools;
    const lower = searchTerm.toLowerCase();
    return tools.filter(
      (t) =>
        t.label.toLowerCase().includes(lower) ||
        (t.description && t.description.toLowerCase().includes(lower))
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white">Çizim Araçları</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white text-xl">
            X
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-dark-700">
          <input
            type="text"
            placeholder="Araç ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white placeholder-dark-400 outline-none focus:border-primary-500"
            autoFocus
          />
        </div>

        {/* Tools Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Favorites Section */}
          {favoriteTools.length > 0 && !searchTerm && (
            <div className="mb-6">
              <h3 className="text-xs font-medium text-primary-400 mb-2 flex items-center gap-2">
                <span>*</span> Favoriler
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {favoriteTools.map((toolId) => {
                  const toolInfo = getToolInfo(toolId);
                  if (!toolInfo) return null;
                  return (
                    <ToolButton
                      key={toolId}
                      tool={toolInfo}
                      isActive={activeTool === toolId}
                      isFavorite={true}
                      onSelect={() => onToolChange(toolId)}
                      onToggleFavorite={() => onToggleFavorite(toolId)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Categories */}
          {TOOL_CATEGORIES.map((category) => {
            const tools = filterTools(getCategoryTools(category.id));
            if (tools.length === 0) return null;

            return (
              <div key={category.id} className="mb-6">
                <h3 className="text-xs font-medium text-dark-400 mb-2 flex items-center gap-2">
                  <span>{category.icon}</span> {category.label}
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {tools.map((tool) => (
                    <ToolButton
                      key={tool.id}
                      tool={tool}
                      isActive={activeTool === tool.id}
                      isFavorite={favoriteTools.includes(tool.id)}
                      onSelect={() => onToolChange(tool.id)}
                      onToggleFavorite={() => onToggleFavorite(tool.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Interval Section */}
        <div className="border-t border-dark-700 px-4 py-3">
          <h3 className="text-xs font-medium text-dark-400 mb-2 flex items-center gap-2">
            <span>T</span> Ozel Zaman Dilimi
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="999"
              value={customValue}
              onChange={(e) => onCustomValueChange(e.target.value)}
              className="w-20 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-sm text-white"
              placeholder="Deger"
            />
            <select
              value={customUnit}
              onChange={(e) => onCustomUnitChange(e.target.value as "s" | "m" | "h" | "D" | "W")}
              className="px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-sm text-white"
            >
              <option value="s">Saniye</option>
              <option value="m">Dakika</option>
              <option value="h">Saat</option>
              <option value="D">Gun</option>
              <option value="W">Hafta</option>
            </select>
            <button
              onClick={() => onApplyCustomInterval(customValue, customUnit)}
              className="px-4 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-500 transition-colors"
            >
              Uygula
            </button>
            {currentInterval.startsWith("custom_") && (
              <span className="text-xs text-primary-400 ml-2">
                Aktif: {currentInterval.replace("custom_", "")}
              </span>
            )}
          </div>
          {/* Quick Presets */}
          <div className="flex items-center gap-1 mt-2">
            <span className="text-[10px] text-dark-500 mr-1">Hizli:</span>
            {[
              { v: 2, u: "m", l: "2dk" },
              { v: 7, u: "m", l: "7dk" },
              { v: 10, u: "m", l: "10dk" },
              { v: 45, u: "m", l: "45dk" },
              { v: 3, u: "h", l: "3sa" },
              { v: 8, u: "h", l: "8sa" },
              { v: 2, u: "D", l: "2G" },
              { v: 3, u: "D", l: "3G" },
            ].map(({ v, u, l }) => (
              <button
                key={`${v}${u}`}
                onClick={() => onApplyCustomInterval(String(v), u as "s" | "m" | "h" | "D" | "W")}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  currentInterval === `custom_${v}${u}`
                    ? "bg-primary-600 text-white"
                    : "bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-white"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tool Button Component
interface ToolButtonProps {
  tool: ReturnType<typeof getToolInfo>;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

function ToolButton({ tool, isActive, isFavorite, onSelect, onToggleFavorite }: ToolButtonProps) {
  if (!tool) return null;

  return (
    <div
      className={`relative group flex items-center gap-2 px-2 py-2 rounded-lg border transition-all cursor-pointer ${
        isActive
          ? "bg-primary-600/20 border-primary-500 text-primary-400"
          : "bg-dark-700/50 border-dark-600 text-dark-200 hover:bg-dark-700 hover:border-dark-500"
      }`}
      onClick={onSelect}
    >
      <span className="text-lg">{tool.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{tool.label}</div>
        <div className="text-[10px] text-dark-500 truncate">{tool.requiredPoints}pt</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={`absolute top-1 right-1 text-xs transition-opacity ${
          isFavorite ? "text-yellow-400" : "text-dark-500 opacity-0 group-hover:opacity-100 hover:text-yellow-400"
        }`}
        title={isFavorite ? "Favorilerden Kaldir" : "Favorilere Ekle"}
      >
        {isFavorite ? "★" : "☆"}
      </button>
    </div>
  );
}

// ============================================
// ALL INTERVALS MODAL COMPONENT
// ============================================

interface AllIntervalsModalProps {
  onClose: () => void;
  intervals: { value: string; label: string }[];
  currentInterval: string;
  onIntervalChange: (value: string) => void;
  favoriteIntervals: string[];
  onToggleFavorite: (value: string) => void;
  customValue: string;
  customUnit: "s" | "m" | "h" | "D" | "W";
  onCustomValueChange: (value: string) => void;
  onCustomUnitChange: (unit: "s" | "m" | "h" | "D" | "W") => void;
  onApplyCustomInterval: (value: string, unit: "s" | "m" | "h" | "D" | "W") => void;
}

function AllIntervalsModal({
  onClose,
  intervals,
  currentInterval,
  onIntervalChange,
  favoriteIntervals,
  onToggleFavorite,
  customValue,
  customUnit,
  onCustomValueChange,
  onCustomUnitChange,
  onApplyCustomInterval,
}: AllIntervalsModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Group intervals by category
  const minuteIntervals = intervals.filter(i => ["1", "3", "5", "15", "30"].includes(i.value));
  const hourIntervals = intervals.filter(i => ["60", "120", "240", "360", "720"].includes(i.value));
  const dayIntervals = intervals.filter(i => ["D", "W", "M"].includes(i.value));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl w-[500px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white">Zaman Dilimleri</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white text-xl">
            X
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Favorites */}
          {favoriteIntervals.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-medium text-primary-400 mb-2 flex items-center gap-2">
                <span>*</span> Favoriler
              </h3>
              <div className="grid grid-cols-6 gap-2">
                {favoriteIntervals.map((intValue) => {
                  const intOption = intervals.find(i => i.value === intValue);
                  if (!intOption) return null;
                  return (
                    <IntervalButton
                      key={intValue}
                      interval={intOption}
                      isActive={currentInterval === intValue}
                      isFavorite={true}
                      onSelect={() => onIntervalChange(intValue)}
                      onToggleFavorite={() => onToggleFavorite(intValue)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Minutes */}
          <div className="mb-6">
            <h3 className="text-xs font-medium text-dark-400 mb-2">Dakika</h3>
            <div className="grid grid-cols-6 gap-2">
              {minuteIntervals.map((int) => (
                <IntervalButton
                  key={int.value}
                  interval={int}
                  isActive={currentInterval === int.value}
                  isFavorite={favoriteIntervals.includes(int.value)}
                  onSelect={() => onIntervalChange(int.value)}
                  onToggleFavorite={() => onToggleFavorite(int.value)}
                />
              ))}
            </div>
          </div>

          {/* Hours */}
          <div className="mb-6">
            <h3 className="text-xs font-medium text-dark-400 mb-2">Saat</h3>
            <div className="grid grid-cols-6 gap-2">
              {hourIntervals.map((int) => (
                <IntervalButton
                  key={int.value}
                  interval={int}
                  isActive={currentInterval === int.value}
                  isFavorite={favoriteIntervals.includes(int.value)}
                  onSelect={() => onIntervalChange(int.value)}
                  onToggleFavorite={() => onToggleFavorite(int.value)}
                />
              ))}
            </div>
          </div>

          {/* Days */}
          <div className="mb-6">
            <h3 className="text-xs font-medium text-dark-400 mb-2">Gun / Hafta / Ay</h3>
            <div className="grid grid-cols-6 gap-2">
              {dayIntervals.map((int) => (
                <IntervalButton
                  key={int.value}
                  interval={int}
                  isActive={currentInterval === int.value}
                  isFavorite={favoriteIntervals.includes(int.value)}
                  onSelect={() => onIntervalChange(int.value)}
                  onToggleFavorite={() => onToggleFavorite(int.value)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Custom Interval Section */}
        <div className="border-t border-dark-700 px-4 py-3">
          <h3 className="text-xs font-medium text-dark-400 mb-2">Ozel Zaman Dilimi</h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="999"
              value={customValue}
              onChange={(e) => onCustomValueChange(e.target.value)}
              className="w-20 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-sm text-white"
              placeholder="Deger"
            />
            <select
              value={customUnit}
              onChange={(e) => onCustomUnitChange(e.target.value as "s" | "m" | "h" | "D" | "W")}
              className="px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-sm text-white"
            >
              <option value="s">Saniye</option>
              <option value="m">Dakika</option>
              <option value="h">Saat</option>
              <option value="D">Gun</option>
              <option value="W">Hafta</option>
            </select>
            <button
              onClick={() => onApplyCustomInterval(customValue, customUnit)}
              className="px-4 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-500 transition-colors"
            >
              Uygula
            </button>
            {currentInterval.startsWith("custom_") && (
              <span className="text-xs text-primary-400 ml-2">
                Aktif: {currentInterval.replace("custom_", "")}
              </span>
            )}
          </div>
          {/* Quick Presets */}
          <div className="flex items-center gap-1 mt-2">
            <span className="text-[10px] text-dark-500 mr-1">Hizli:</span>
            {[
              { v: 2, u: "m", l: "2dk" },
              { v: 7, u: "m", l: "7dk" },
              { v: 10, u: "m", l: "10dk" },
              { v: 45, u: "m", l: "45dk" },
              { v: 3, u: "h", l: "3sa" },
              { v: 8, u: "h", l: "8sa" },
            ].map(({ v, u, l }) => (
              <button
                key={`${v}${u}`}
                onClick={() => onApplyCustomInterval(String(v), u as "s" | "m" | "h" | "D" | "W")}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  currentInterval === `custom_${v}${u}`
                    ? "bg-primary-600 text-white"
                    : "bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-white"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Interval Button Component
interface IntervalButtonProps {
  interval: { value: string; label: string };
  isActive: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

function IntervalButton({ interval, isActive, isFavorite, onSelect, onToggleFavorite }: IntervalButtonProps) {
  return (
    <div
      className={`relative group flex items-center justify-center px-2 py-2 rounded-lg border transition-all cursor-pointer ${
        isActive
          ? "bg-primary-600/20 border-primary-500 text-primary-400"
          : "bg-dark-700/50 border-dark-600 text-dark-200 hover:bg-dark-700 hover:border-dark-500"
      }`}
      onClick={onSelect}
    >
      <span className="text-sm font-medium">{interval.label}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={`absolute top-0.5 right-0.5 text-[10px] transition-opacity ${
          isFavorite ? "text-yellow-400" : "text-dark-500 opacity-0 group-hover:opacity-100 hover:text-yellow-400"
        }`}
        title={isFavorite ? "Favorilerden Kaldir" : "Favorilere Ekle"}
      >
        {isFavorite ? "★" : "☆"}
      </button>
    </div>
  );
}

// ============================================
// DRAWING QUICK TOOLBAR
// Floating toolbar below OHLC display (TradingView style)
// ============================================

// Quick access colors (subset of PRESET_COLORS for quick access)
const QUICK_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ffffff", // white
];

interface DrawingQuickToolbarProps {
  // Active tool or selected drawing
  activeTool: DrawingTool;
  selectedDrawing: Drawing | null;

  // Style management
  currentStyle: DrawingStyle;
  onStyleChange: (updates: Partial<DrawingStyle>) => void;

  // Drawing management
  onDeleteDrawing?: () => void;
  onCloneDrawing?: () => void;
  onLockDrawing?: () => void;
  onOpenSettings?: () => void;

  // Tool info
  toolInfo: { icon: string; label: string } | null;

  // Overlapping drawings indicator
  overlappingCount?: number;
  overlappingIndex?: number;
  onCycleOverlapping?: () => void;
}

export function DrawingQuickToolbar({
  activeTool,
  selectedDrawing,
  currentStyle,
  onStyleChange,
  onDeleteDrawing,
  onCloneDrawing,
  onLockDrawing,
  onOpenSettings,
  toolInfo,
  overlappingCount = 0,
  overlappingIndex = 0,
  onCycleOverlapping,
}: DrawingQuickToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showMoreColors, setShowMoreColors] = useState(false);

  // Only show when a tool is active or a drawing is selected
  const isVisible = (activeTool !== "none" && activeTool !== "crosshair" && activeTool !== "eraser") || selectedDrawing !== null;

  if (!isVisible) return null;

  const displayTool = selectedDrawing?.drawing_type || activeTool;
  const displayStyle = selectedDrawing?.style || currentStyle;
  const displayInfo = toolInfo || getToolInfo(displayTool);

  // Determine which controls to show based on tool type
  const isShape = ["rectangle", "circle", "ellipse", "triangle", "parallel_channel"].includes(displayTool);
  const hasExtend = ["trendline", "ray", "extended"].includes(displayTool);

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-dark-800/95 border border-dark-600 rounded-lg shadow-lg backdrop-blur-sm">
      {/* Tool Icon & Name */}
      <div className="flex items-center gap-1.5 pr-2 border-r border-dark-600">
        <span className="text-sm">{displayInfo?.icon}</span>
        <span className="text-[10px] text-dark-300 max-w-[60px] truncate">{displayInfo?.label}</span>
        {/* Overlapping drawings indicator */}
        {overlappingCount > 1 && selectedDrawing && (
          <button
            onClick={onCycleOverlapping}
            className="flex items-center gap-0.5 px-1 py-0.5 bg-primary-600/30 hover:bg-primary-600/50 rounded text-[9px] text-primary-300 transition-colors"
            title={`${overlappingCount} çizim üst üste - tıkla değiştir`}
          >
            <span>{overlappingIndex + 1}/{overlappingCount}</span>
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>

      {/* Quick Color Picker */}
      <div className="relative flex items-center gap-0.5 px-1">
        {/* Current color indicator */}
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="w-5 h-5 rounded border border-dark-500 hover:border-dark-400 transition-colors flex items-center justify-center"
          style={{ backgroundColor: displayStyle.color }}
          title="Renk"
        >
          {showColorPicker && (
            <span className="text-[8px] text-white drop-shadow">▼</span>
          )}
        </button>

        {/* Quick color swatches */}
        {QUICK_COLORS.slice(0, 6).map((color) => (
          <button
            key={color}
            onClick={() => onStyleChange({ color })}
            className={`w-4 h-4 rounded transition-all ${
              displayStyle.color === color ? "ring-1 ring-white ring-offset-1 ring-offset-dark-800 scale-110" : "hover:scale-110"
            }`}
            style={{ backgroundColor: color }}
          />
        ))}

        {/* More colors dropdown */}
        <button
          onClick={() => setShowMoreColors(!showMoreColors)}
          className="w-4 h-4 rounded bg-gradient-to-br from-red-500 via-green-500 to-blue-500 hover:scale-110 transition-all flex items-center justify-center"
          title="Daha fazla renk"
        >
          <span className="text-[8px] text-white drop-shadow">+</span>
        </button>

        {/* Extended color picker dropdown */}
        {showMoreColors && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-50 max-w-[calc(100vw-1rem)]">
            <div className="grid grid-cols-6 gap-1 mb-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    onStyleChange({ color });
                    setShowMoreColors(false);
                  }}
                  className={`w-5 h-5 rounded transition-all ${
                    displayStyle.color === color ? "ring-2 ring-white scale-110" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <input
              type="color"
              value={displayStyle.color}
              onChange={(e) => onStyleChange({ color: e.target.value })}
              className="w-full h-6 rounded cursor-pointer bg-transparent border-0"
            />
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-dark-600" />

      {/* Line Width */}
      <div className="flex items-center gap-0.5 px-1">
        {[1, 2, 3, 4].map((width) => (
          <button
            key={width}
            onClick={() => onStyleChange({ lineWidth: width })}
            className={`w-5 h-5 flex items-center justify-center rounded transition-all ${
              displayStyle.lineWidth === width
                ? "bg-primary-600"
                : "bg-dark-700 hover:bg-dark-600"
            }`}
            title={`Kalınlık: ${width}px`}
          >
            <div
              className="bg-white rounded-full"
              style={{ width: 2 + width * 2, height: width }}
            />
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-dark-600" />

      {/* Line Style */}
      <div className="flex items-center gap-0.5 px-1">
        {[
          { id: "solid" as const, icon: "━" },
          { id: "dashed" as const, icon: "╌" },
          { id: "dotted" as const, icon: "┄" },
        ].map((style) => (
          <button
            key={style.id}
            onClick={() => onStyleChange({ lineStyle: style.id })}
            className={`w-5 h-5 flex items-center justify-center rounded text-[10px] transition-all ${
              displayStyle.lineStyle === style.id
                ? "bg-primary-600 text-white"
                : "bg-dark-700 text-dark-300 hover:bg-dark-600"
            }`}
            title={style.id}
          >
            {style.icon}
          </button>
        ))}
      </div>

      {/* Extend Options (for applicable tools) */}
      {hasExtend && (
        <>
          <div className="w-px h-4 bg-dark-600" />
          <div className="flex items-center gap-0.5 px-1">
            <button
              onClick={() => onStyleChange({ extendLeft: !displayStyle.extendLeft })}
              className={`px-1.5 h-5 flex items-center justify-center rounded text-[9px] transition-all ${
                displayStyle.extendLeft
                  ? "bg-primary-600 text-white"
                  : "bg-dark-700 text-dark-400 hover:bg-dark-600"
              }`}
              title="Sola uzat"
            >
              ←
            </button>
            <button
              onClick={() => onStyleChange({ extendRight: !displayStyle.extendRight })}
              className={`px-1.5 h-5 flex items-center justify-center rounded text-[9px] transition-all ${
                displayStyle.extendRight
                  ? "bg-primary-600 text-white"
                  : "bg-dark-700 text-dark-400 hover:bg-dark-600"
              }`}
              title="Sağa uzat"
            >
              →
            </button>
          </div>
        </>
      )}

      {/* Fill options for shapes */}
      {isShape && (
        <>
          <div className="w-px h-4 bg-dark-600" />
          <div className="flex items-center gap-0.5 px-1">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-5 h-5 rounded border border-dark-500 hover:border-dark-400 transition-colors"
              style={{
                backgroundColor: displayStyle.fillColor || displayStyle.color,
                opacity: displayStyle.fillOpacity || 0.2
              }}
              title="Dolgu rengi"
            />
          </div>
        </>
      )}

      {/* Actions for selected drawing */}
      {selectedDrawing && (
        <>
          <div className="w-px h-4 bg-dark-600" />
          <div className="flex items-center gap-0.5 px-1">
            {/* Lock */}
            <button
              onClick={onLockDrawing}
              className={`w-5 h-5 flex items-center justify-center rounded text-[10px] transition-all ${
                selectedDrawing.locked
                  ? "bg-amber-600 text-white"
                  : "bg-dark-700 text-dark-400 hover:bg-dark-600"
              }`}
              title={selectedDrawing.locked ? "Kilidi aç" : "Kilitle"}
            >
              {selectedDrawing.locked ? "🔒" : "🔓"}
            </button>

            {/* Clone */}
            <button
              onClick={onCloneDrawing}
              className="w-5 h-5 flex items-center justify-center rounded text-[10px] bg-dark-700 text-dark-400 hover:bg-dark-600 transition-all"
              title="Kopyala"
            >
              📋
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="w-5 h-5 flex items-center justify-center rounded text-[10px] bg-dark-700 text-dark-400 hover:bg-dark-600 transition-all"
              title="Ayarlar"
            >
              ⚙️
            </button>

            {/* Delete */}
            <button
              onClick={onDeleteDrawing}
              className="w-5 h-5 flex items-center justify-center rounded text-[10px] bg-dark-700 text-danger-400 hover:bg-danger-600 hover:text-white transition-all"
              title="Sil"
            >
              🗑
            </button>
          </div>
        </>
      )}
    </div>
  );
}
