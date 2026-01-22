import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChartToolbar, DrawingObjectTree, DrawingSettingsPanel, DrawingContextMenu, DrawingQuickToolbar } from "./ChartToolbar";
import { getToolInfo } from "./ChartDrawings";
import { Drawing, DrawingTool, DrawingStyle, DrawingPoint, getRequiredPoints } from "./ChartDrawings";
import { VwapConfig, VwapData, calculateAllVwaps } from "./VwapSettings";
import { SmaConfig, SmaData, calculateAllSmas } from "./SmaSettings";
import { AnchoredVwapConfig, AnchoredVwapData, calculateAllAnchoredVwaps } from "./AnchoredVwapSettings";
import { useColors, SettingsButton, ColorSettingsPopup, CandleColorPicker } from "./ColorSettings";

// ============================================
// TYPES
// ============================================

export interface Kline {
  symbol?: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartViewport {
  startIndex: number;
  endIndex: number;
  priceMin: number;
  priceMax: number;
}

export interface CustomChartProps {
  symbol: string;
  category: "spot" | "linear" | "inverse";
  interval: string;
  height?: number;
  vwapConfigs?: VwapConfig[];
  smaConfigs?: SmaConfig[];
  anchoredVwapConfigs?: AnchoredVwapConfig[];
  onAnchoredVwapConfigChange?: (configs: AnchoredVwapConfig[]) => void;
  selectingAnchor?: { configId: string; type: "start" | "end" } | null;
  onSelectingAnchorChange?: (anchor: { configId: string; type: "start" | "end" } | null) => void;
}

interface MousePosition {
  x: number;
  y: number;
  price: number;
  time: number;
  candle: Kline | null;
  rawPrice: number; // Before magnet
}

type MagnetMode = "none" | "weak" | "strong";

// ============================================
// CONSTANTS
// ============================================

const CANDLE_WIDTH_RATIO = 0.7;
const MIN_CANDLES = 20;  // Prevent too much zoom in (freezing)
const MAX_CANDLES = 300; // Prevent too much zoom out (performance)
const PADDING_TOP = 20;
const PADDING_BOTTOM = 50;
const PADDING_RIGHT = 80;
const PADDING_LEFT = 10;
const SELECTION_THRESHOLD = 10; // pixels
const HANDLE_SIZE = 6;
const TOOLBAR_HEIGHT = 48;

const STATIC_COLORS = {
  background: "#0f172a",
  grid: "rgba(51, 65, 85, 0.5)",
  gridText: "#94a3b8",
  crosshair: "rgba(148, 163, 184, 0.5)",
  crosshairText: "#e2e8f0",
  selection: "#fbbf24",
  handle: "#fbbf24",
};

const INTERVALS = [
  { value: "1", label: "1m" },
  { value: "3", label: "3m" },
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "30", label: "30m" },
  { value: "60", label: "1H" },
  { value: "120", label: "2H" },
  { value: "240", label: "4H" },
  { value: "360", label: "6H" },
  { value: "720", label: "12H" },
  { value: "D", label: "1D" },
  { value: "W", label: "1W" },
  { value: "M", label: "1M" },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.01) return price.toFixed(6);
  return price.toFixed(8);
}

function formatTime(timestamp: number, interval: string): string {
  if (!timestamp || isNaN(timestamp)) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString().slice(-2);

  // Monthly - show month/year
  if (interval === "M") {
    return `${month}/${year}`;
  }

  // Weekly - show day/month
  if (interval === "W") {
    return `${day}/${month}`;
  }

  // Daily - show day/month
  if (interval === "D") {
    return `${day}/${month}`;
  }

  // 4H and above (240+) - show day and hour
  const numInterval = parseInt(interval);
  if (!isNaN(numInterval) && numInterval >= 240) {
    return `${day}/${month} ${hours}:00`;
  }

  // 1H to 3H (60-180) - show hour, and day at midnight
  if (!isNaN(numInterval) && numInterval >= 60) {
    if (hours === "00" && minutes === "00") {
      return `${day}/${month}`;
    }
    return `${hours}:${minutes}`;
  }

  // Minutes - show hour:minute
  return `${hours}:${minutes}`;
}

function formatFullTime(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Get time label interval step in milliseconds based on chart interval
function getTimeLabelStep(interval: string, visibleDuration: number): number {
  const numInterval = parseInt(interval);

  // Calculate roughly 6-10 labels across the visible area
  const targetLabels = 8;
  const idealStep = visibleDuration / targetLabels;

  // Snap to natural time boundaries
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;

  // Find the closest natural step
  const naturalSteps = [
    minute, 5 * minute, 15 * minute, 30 * minute,
    hour, 2 * hour, 4 * hour, 6 * hour, 12 * hour,
    day, 2 * day, week, 2 * week, month, 3 * month
  ];

  let bestStep = naturalSteps[0];
  for (const step of naturalSteps) {
    if (step >= idealStep * 0.7) {
      bestStep = step;
      break;
    }
    bestStep = step;
  }

  return bestStep;
}

// Check if timestamp is on a natural boundary
function isOnBoundary(timestamp: number, step: number): boolean {
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const date = new Date(timestamp);

  if (step >= day) {
    // Day or larger: check if at 00:00
    return date.getHours() === 0 && date.getMinutes() === 0;
  } else if (step >= hour) {
    // Hour or larger: check if on hour boundary
    return date.getMinutes() === 0;
  } else if (step >= 15 * minute) {
    // 15min or larger: check if on 15-minute boundary
    return date.getMinutes() % 15 === 0;
  } else if (step >= 5 * minute) {
    // 5min: check if on 5-minute boundary
    return date.getMinutes() % 5 === 0;
  }
  // For smaller steps, any boundary works
  return true;
}

// Format time label based on boundary type (major = date, minor = time)
function formatTimeLabel(timestamp: number, step: number, prevTimestamp?: number): { label: string; isMajor: boolean } {
  const date = new Date(timestamp);
  const prevDate = prevTimestamp ? new Date(prevTimestamp) : null;

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day_ms = 24 * hour;

  // Check if this is a day change (major label)
  const isDayChange = !prevDate || date.getDate() !== prevDate.getDate() || date.getMonth() !== prevDate.getMonth();

  if (step >= day_ms) {
    // Daily or larger: show date
    return { label: `${day}/${month}`, isMajor: true };
  } else if (step >= 4 * hour) {
    // 4H or larger: show date + time for major, time for minor
    if (isDayChange || hours === "00") {
      return { label: `${day}/${month}`, isMajor: true };
    }
    return { label: `${hours}:00`, isMajor: false };
  } else if (step >= hour) {
    // Hourly: show date at midnight, time otherwise
    if (isDayChange) {
      return { label: `${day}/${month}`, isMajor: true };
    }
    return { label: `${hours}:00`, isMajor: false };
  } else {
    // Sub-hourly: show time, date at midnight
    if (isDayChange) {
      return { label: `${day}/${month}`, isMajor: true };
    }
    return { label: `${hours}:${minutes}`, isMajor: false };
  }
}

// ============================================
// CUSTOM INTERVAL HELPERS
// ============================================

interface CustomIntervalConfig {
  value: number;
  unit: "s" | "m" | "h" | "D" | "W";
}

// Parse custom interval string (e.g., "custom_7m" -> {value: 7, unit: "m"})
function parseCustomInterval(interval: string): CustomIntervalConfig | null {
  if (!interval.startsWith("custom_")) return null;
  const str = interval.replace("custom_", "");
  const match = str.match(/^(\d+)(s|m|h|D|W)$/);
  if (!match) return null;
  return {
    value: parseInt(match[1]),
    unit: match[2] as "s" | "m" | "h" | "D" | "W",
  };
}

// Get milliseconds for custom interval
function getCustomIntervalMs(config: CustomIntervalConfig): number {
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60000,
    h: 3600000,
    D: 86400000,
    W: 604800000,
  };
  return config.value * multipliers[config.unit];
}

function getIntervalMs(interval: string): number {
  // Check for custom interval first
  const customConfig = parseCustomInterval(interval);
  if (customConfig) {
    return getCustomIntervalMs(customConfig);
  }

  const mapping: Record<string, number> = {
    "1": 60000,
    "3": 180000,
    "5": 300000,
    "15": 900000,
    "30": 1800000,
    "60": 3600000,
    "120": 7200000,
    "240": 14400000,
    "360": 21600000,
    "720": 43200000,
    "D": 86400000,
    "W": 604800000,
    "M": 2592000000,
  };
  return mapping[interval] || 900000;
}

// Get the base API interval to fetch for custom intervals
function getBaseInterval(config: CustomIntervalConfig): string {
  // For seconds, we'd need tick data - use 1m as minimum
  // For minutes < 60, use 1m
  // For hours < 24, use 60m
  // For days/weeks, use D
  const ms = getCustomIntervalMs(config);

  if (ms < 60000) return "1"; // Less than 1 minute - use 1m (smallest available)
  if (ms < 3600000) return "1"; // Less than 1 hour - use 1m
  if (ms < 86400000) return "60"; // Less than 1 day - use 1h
  return "D"; // Use daily for longer periods
}

// Aggregate klines to custom interval
function aggregateKlines(klines: Kline[], targetIntervalMs: number): Kline[] {
  if (klines.length === 0) return [];

  const aggregated: Kline[] = [];
  let currentBucket: Kline | null = null;
  let bucketStart = 0;

  for (const kline of klines) {
    // Calculate which bucket this kline belongs to
    const bucket = Math.floor(kline.timestamp / targetIntervalMs) * targetIntervalMs;

    if (currentBucket === null || bucket !== bucketStart) {
      // Start a new bucket
      if (currentBucket !== null) {
        aggregated.push(currentBucket);
      }
      bucketStart = bucket;
      currentBucket = {
        timestamp: bucket,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
      };
    } else {
      // Add to current bucket
      currentBucket.high = Math.max(currentBucket.high, kline.high);
      currentBucket.low = Math.min(currentBucket.low, kline.low);
      currentBucket.close = kline.close;
      currentBucket.volume += kline.volume;
    }
  }

  // Don't forget the last bucket
  if (currentBucket !== null) {
    aggregated.push(currentBucket);
  }

  return aggregated;
}

// Distance from point to line segment
function pointToLineDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CustomChart({
  symbol,
  category,
  interval: defaultInterval,
  height: _height = 600,
  vwapConfigs = [],
  smaConfigs = [],
  anchoredVwapConfigs = [],
  onAnchoredVwapConfigChange,
  selectingAnchor,
  onSelectingAnchorChange,
}: CustomChartProps) {
  void _height; // Reserved for future use
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [klines, setKlines] = useState<Kline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interval, setChartInterval] = useState(defaultInterval || "15");

  // Viewport state
  const [viewport, setViewport] = useState<ChartViewport>({
    startIndex: 0,
    endIndex: 100,
    priceMin: 0,
    priceMax: 0,
  });

  // Interaction state
  const [mousePos, setMousePos] = useState<MousePosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    startIndex: number;
    priceMin: number;
    priceMax: number;
  } | null>(null);
  const [shiftPressed, setShiftPressed] = useState(false);

  // Drawing state
  const [activeTool, setActiveTool] = useState<DrawingTool>("none");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [currentStyle, setCurrentStyle] = useState<DrawingStyle>({
    color: "#2962FF",
    lineWidth: 2,
    lineStyle: "solid",
  });
  const [pendingPoints, setPendingPoints] = useState<{ time: number; price: number }[]>([]);
  const [magnetMode, setMagnetMode] = useState<MagnetMode>("weak");

  // Selection state
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [isDraggingDrawing, setIsDraggingDrawing] = useState(false);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);
  const [dragDrawingStart, setDragDrawingStart] = useState<{ time: number; price: number } | null>(null);

  // Overlapping drawings cycling state
  const [overlappingDrawings, setOverlappingDrawings] = useState<string[]>([]);
  const [overlappingIndex, setOverlappingIndex] = useState(0);
  const [lastClickPos, setLastClickPos] = useState<{ x: number; y: number } | null>(null);

  // Toolbar features state
  const [stayInDrawingMode, setStayInDrawingMode] = useState(false);
  const [allLocked, setAllLocked] = useState(false);
  const [allHidden, setAllHidden] = useState(false);
  const [showObjectTree, setShowObjectTree] = useState(false);

  // Settings panel and context menu state
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; drawingId: string } | null>(null);

  // Undo/Redo history
  const [history, setHistory] = useState<Drawing[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [clipboard, setClipboard] = useState<Drawing | null>(null);

  // Axis scaling state
  const [isDraggingYAxis, setIsDraggingYAxis] = useState(false);
  const [isDraggingXAxis, setIsDraggingXAxis] = useState(false);
  const [axisDragStart, setAxisDragStart] = useState<{ y: number; x: number; priceRange: number; visibleCount: number } | null>(null);
  const [autoPriceScale, setAutoPriceScale] = useState(true);
  const [hoverAxis, setHoverAxis] = useState<"none" | "y" | "x">("none");
  const [autoScroll, setAutoScroll] = useState(true); // Auto-scroll to latest candle

  // Centralized color settings
  const { colors: chartColors, setColor } = useColors();
  const [showColorSettings, setShowColorSettings] = useState(false);

  // Create COLORS object merging static and dynamic colors
  const COLORS = useMemo(() => ({
    ...STATIC_COLORS,
    bullish: chartColors.candle.bullish,
    bearish: chartColors.candle.bearish,
  }), [chartColors.candle]);

  // Selected drawing (for quick toolbar)
  const selectedDrawing = useMemo(() => {
    if (!selectedDrawingId) return null;
    return drawings.find(d => d.id === selectedDrawingId) || null;
  }, [drawings, selectedDrawingId]);

  // Canvas dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // Computed chart area
  const chartArea = useMemo(() => ({
    left: PADDING_LEFT,
    right: dimensions.width - PADDING_RIGHT,
    top: PADDING_TOP,
    bottom: dimensions.height - PADDING_BOTTOM,
    width: dimensions.width - PADDING_LEFT - PADDING_RIGHT,
    height: dimensions.height - PADDING_TOP - PADDING_BOTTOM,
  }), [dimensions]);

  // ============================================
  // KEYBOARD HANDLERS
  // ============================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setShiftPressed(true);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedDrawingId) {
          deleteDrawing(selectedDrawingId);
          setSelectedDrawingId(null);
        }
      }
      if (e.key === "Escape") {
        setSelectedDrawingId(null);
        setActiveTool("none");
        setPendingPoints([]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setShiftPressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedDrawingId]);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadKlines = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if it's a custom interval
      const customConfig = parseCustomInterval(interval);
      let fetchInterval = interval;
      let fetchLimit = 500;

      if (customConfig) {
        // Get the base interval for fetching
        fetchInterval = getBaseInterval(customConfig);
        // Calculate how many base candles we need for ~500 aggregated candles
        const targetMs = getCustomIntervalMs(customConfig);
        const baseMs = getIntervalMs(fetchInterval);
        const candlesPerAggregated = Math.ceil(targetMs / baseMs);
        fetchLimit = Math.min(1000, 500 * candlesPerAggregated); // Fetch more for aggregation
      }

      const data = await invoke<Kline[]>("get_klines", {
        symbol,
        category,
        interval: fetchInterval,
        limit: fetchLimit,
      });

      let sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);

      // Aggregate if custom interval
      if (customConfig) {
        const targetMs = getCustomIntervalMs(customConfig);
        sorted = aggregateKlines(sorted, targetMs);
      }

      setKlines(sorted);

      if (sorted.length > 0) {
        const endIdx = sorted.length;
        const startIdx = Math.max(0, endIdx - 100);

        const visibleKlines = sorted.slice(startIdx, endIdx);
        const prices = visibleKlines.flatMap(k => [k.high, k.low]);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const padding = (max - min) * 0.1;

        setViewport({
          startIndex: startIdx,
          endIndex: endIdx,
          priceMin: min - padding,
          priceMax: max + padding,
        });
      }

    } catch (e) {
      console.error("Failed to load klines:", e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [symbol, category, interval]);

  const loadDrawings = useCallback(async () => {
    try {
      // Load all drawings for the symbol (regardless of interval)
      const data = await invoke<Drawing[]>("get_all_drawings_for_symbol", { symbol });
      const parsed = data.map(d => ({
        ...d,
        points: typeof d.points === 'string' ? JSON.parse(d.points) : d.points,
        style: typeof d.style === 'string' ? JSON.parse(d.style) : d.style,
      }));
      setDrawings(parsed);
    } catch (e) {
      console.error("Failed to load drawings:", e);
    }
  }, [symbol]);

  // Filter drawings based on timeframes setting and current interval
  const visibleDrawings = useMemo(() => {
    // Map interval values to display labels for timeframe matching
    const intervalToLabel: Record<string, string> = {
      "1": "1m", "3": "3m", "5": "5m", "15": "15m", "30": "30m",
      "60": "1H", "120": "2H", "240": "4H", "360": "6H", "720": "12H",
      "D": "1D", "W": "1W", "M": "1M"
    };
    const currentLabel = intervalToLabel[interval] || interval;

    return drawings.filter(d => {
      // If timeframes is undefined or empty, show on all timeframes (like "All")
      if (!d.timeframes || d.timeframes.length === 0) {
        return true;
      }
      // Otherwise, check if current interval is in the allowed timeframes
      return d.timeframes.includes(currentLabel) || d.timeframes.includes(interval);
    });
  }, [drawings, interval]);

  // Calculate VWAP values for enabled configs
  const vwapData = useMemo<VwapData[]>(() => {
    if (klines.length === 0 || vwapConfigs.length === 0) return [];

    // Convert Kline format for VWAP calculation
    const klinesForVwap = klines.map(k => ({
      open_time: k.timestamp,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
    }));

    return calculateAllVwaps(klinesForVwap, vwapConfigs);
  }, [klines, vwapConfigs]);

  // Calculate SMA values for enabled configs
  const smaData = useMemo<SmaData[]>(() => {
    if (klines.length === 0 || smaConfigs.length === 0) return [];
    // Convert interval to minutes
    const intervalMs = getIntervalMs(interval);
    const intervalMinutes = intervalMs / 60000;
    return calculateAllSmas(klines, smaConfigs, intervalMinutes);
  }, [klines, smaConfigs, interval]);

  // Calculate Anchored VWAP values for enabled configs
  const anchoredVwapData = useMemo<AnchoredVwapData[]>(() => {
    if (klines.length === 0 || anchoredVwapConfigs.length === 0) return [];
    return calculateAllAnchoredVwaps(klines, anchoredVwapConfigs);
  }, [klines, anchoredVwapConfigs]);

  // Real-time update - fetch latest candle and update
  const updateLatestCandle = useCallback(async () => {
    if (klines.length === 0) return;

    try {
      // Check if it's a custom interval
      const customConfig = parseCustomInterval(interval);
      let fetchInterval = interval;

      if (customConfig) {
        fetchInterval = getBaseInterval(customConfig);
      }

      // Fetch just the latest 2 candles
      const data = await invoke<Kline[]>("get_klines", {
        symbol,
        category,
        interval: fetchInterval,
        limit: customConfig ? Math.max(10, Math.ceil(customConfig.value * 2)) : 2,
      });

      if (data.length === 0) return;

      let newCandles = [...data].sort((a, b) => a.timestamp - b.timestamp);

      // Aggregate if custom interval
      if (customConfig) {
        const targetMs = getCustomIntervalMs(customConfig);
        newCandles = aggregateKlines(newCandles, targetMs);
      }

      if (newCandles.length === 0) return;

      setKlines(prev => {
        if (prev.length === 0) return prev;

        const updated = [...prev];
        const lastExistingTime = updated[updated.length - 1]?.timestamp;
        let newCandleAdded = false;

        for (const candle of newCandles) {
          const existingIdx = updated.findIndex(k => k.timestamp === candle.timestamp);
          if (existingIdx >= 0) {
            // Update existing candle
            updated[existingIdx] = candle;
          } else if (candle.timestamp > lastExistingTime) {
            // Add new candle
            updated.push(candle);
            newCandleAdded = true;
          }
        }

        // Auto-scroll to show new candle if at the edge
        if (newCandleAdded && autoScroll) {
          setViewport(v => {
            const visibleCount = v.endIndex - v.startIndex;
            const newEndIdx = updated.length;
            const newStartIdx = Math.max(0, newEndIdx - visibleCount);

            // Recalculate price range for auto-scale
            if (autoPriceScale) {
              const visibleKlines = updated.slice(Math.floor(newStartIdx), Math.ceil(newEndIdx));
              if (visibleKlines.length > 0) {
                const prices = visibleKlines.flatMap(k => [k.high, k.low]);
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                const padding = (max - min) * 0.1;
                return {
                  startIndex: newStartIdx,
                  endIndex: newEndIdx,
                  priceMin: min - padding,
                  priceMax: max + padding,
                };
              }
            }

            return {
              ...v,
              startIndex: newStartIdx,
              endIndex: newEndIdx,
            };
          });
        }

        return updated;
      });
    } catch (e) {
      // Silently fail for real-time updates
      console.debug("Real-time update failed:", e);
    }
  }, [symbol, category, interval, klines.length, autoScroll, autoPriceScale]);

  useEffect(() => {
    loadKlines();
    loadDrawings();
  }, [loadKlines, loadDrawings]);

  // Real-time polling - update every 1 second
  useEffect(() => {
    const intervalId = setInterval(updateLatestCandle, 1000);
    return () => clearInterval(intervalId);
  }, [updateLatestCandle]);

  // ============================================
  // RESIZE HANDLING
  // ============================================

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current && containerRef.current.parentElement) {
        const parent = containerRef.current.parentElement;
        const rect = parent.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({
            width: Math.floor(rect.width),
            height: Math.floor(rect.height) - TOOLBAR_HEIGHT,
          });
        }
      }
    };

    // Initial size
    updateDimensions();

    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // ============================================
  // COORDINATE CONVERSION
  // ============================================

  const priceToY = useCallback((price: number): number => {
    const { priceMin, priceMax } = viewport;
    if (priceMax === priceMin) return chartArea.top + chartArea.height / 2;
    const ratio = (price - priceMin) / (priceMax - priceMin);
    return chartArea.bottom - ratio * chartArea.height;
  }, [viewport, chartArea]);

  const yToPrice = useCallback((y: number): number => {
    const { priceMin, priceMax } = viewport;
    const ratio = (chartArea.bottom - y) / chartArea.height;
    return priceMin + ratio * (priceMax - priceMin);
  }, [viewport, chartArea]);

  const indexToX = useCallback((index: number): number => {
    const { startIndex, endIndex } = viewport;
    const visibleCount = endIndex - startIndex;
    if (visibleCount === 0) return chartArea.left;
    const candleWidth = chartArea.width / visibleCount;
    return chartArea.left + (index - startIndex + 0.5) * candleWidth;
  }, [viewport, chartArea]);

  const xToIndex = useCallback((x: number): number => {
    const { startIndex, endIndex } = viewport;
    const visibleCount = endIndex - startIndex;
    if (visibleCount === 0) return 0;
    const candleWidth = chartArea.width / visibleCount;
    return Math.floor((x - chartArea.left) / candleWidth + startIndex);
  }, [viewport, chartArea]);

  const xToTime = useCallback((x: number): number => {
    const index = xToIndex(x);
    if (index >= 0 && index < klines.length) {
      return klines[index].timestamp;
    }
    const intervalMs = getIntervalMs(interval);
    if (klines.length > 0) {
      if (index < 0) {
        return klines[0].timestamp + index * intervalMs;
      }
      const lastKline = klines[klines.length - 1];
      return lastKline.timestamp + (index - klines.length + 1) * intervalMs;
    }
    return Date.now();
  }, [xToIndex, klines, interval]);

  const timeToX = useCallback((time: number): number => {
    if (klines.length === 0) return chartArea.left;

    let closestIdx = 0;
    let minDiff = Math.abs(klines[0].timestamp - time);

    for (let i = 1; i < klines.length; i++) {
      const diff = Math.abs(klines[i].timestamp - time);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    const intervalMs = getIntervalMs(interval);
    const timeDiff = time - klines[closestIdx].timestamp;
    const indexOffset = timeDiff / intervalMs;

    return indexToX(closestIdx + indexOffset);
  }, [klines, interval, indexToX, chartArea]);

  // ============================================
  // MAGNET FUNCTION
  // ============================================

  const applyMagnet = useCallback((rawPrice: number, time: number): number => {
    if (magnetMode === "none") return rawPrice;

    const index = xToIndex(timeToX(time));
    if (index < 0 || index >= klines.length) return rawPrice;

    const candle = klines[index];
    const levels = [candle.open, candle.high, candle.low, candle.close];
    const priceRange = viewport.priceMax - viewport.priceMin;
    const threshold = magnetMode === "strong" ? priceRange * 0.05 : priceRange * 0.02;

    let closestLevel = rawPrice;
    let closestDistance = Infinity;

    for (const level of levels) {
      const distance = Math.abs(rawPrice - level);
      if (distance < closestDistance && distance < threshold) {
        closestDistance = distance;
        closestLevel = level;
      }
    }

    return closestLevel;
  }, [magnetMode, klines, viewport, xToIndex, timeToX]);

  // ============================================
  // SHIFT CONSTRAINT
  // ============================================

  const applyShiftConstraint = useCallback((
    newPoint: { time: number; price: number },
    firstPoint: { time: number; price: number } | null
  ): { time: number; price: number } => {
    if (!shiftPressed || !firstPoint) return newPoint;

    const dy = newPoint.price - firstPoint.price;

    // Convert to pixel space for angle calculation
    const pxDx = timeToX(newPoint.time) - timeToX(firstPoint.time);
    const pxDy = priceToY(newPoint.price) - priceToY(firstPoint.price);

    const angle = Math.abs(Math.atan2(pxDy, pxDx) * 180 / Math.PI);

    // Snap to horizontal (0°), vertical (90°), or 45°
    if (angle < 22.5 || angle > 157.5) {
      // Horizontal
      return { time: newPoint.time, price: firstPoint.price };
    } else if (angle > 67.5 && angle < 112.5) {
      // Vertical
      return { time: firstPoint.time, price: newPoint.price };
    } else {
      // 45 degree - adjust price to match the angle
      const sign = dy > 0 ? 1 : -1;
      const pricePerPixel = (viewport.priceMax - viewport.priceMin) / chartArea.height;
      const adjustedPrice = firstPoint.price + sign * Math.abs(pxDx) * pricePerPixel;
      return { time: newPoint.time, price: adjustedPrice };
    }
  }, [shiftPressed, timeToX, priceToY, viewport, chartArea]);

  // ============================================
  // HIT DETECTION
  // ============================================

  const findDrawingAtPoint = useCallback((x: number, y: number): Drawing | null => {
    for (let i = visibleDrawings.length - 1; i >= 0; i--) {
      const drawing = visibleDrawings[i];
      if (!drawing.visible) continue;

      const points = drawing.points.map(p => ({
        x: timeToX(p.time),
        y: priceToY(p.price),
      }));

      // Check if clicking on a control point
      for (const p of points) {
        const dist = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
        if (dist < SELECTION_THRESHOLD) return drawing;
      }

      // Check based on drawing type
      switch (drawing.drawing_type) {
        case "horizontal": {
          if (points.length >= 1) {
            const dist = Math.abs(y - points[0].y);
            if (dist < SELECTION_THRESHOLD) return drawing;
          }
          break;
        }
        case "vertical": {
          if (points.length >= 1) {
            const dist = Math.abs(x - points[0].x);
            if (dist < SELECTION_THRESHOLD) return drawing;
          }
          break;
        }
        case "trendline":
        case "ray":
        case "extended":
        case "arrow": {
          if (points.length >= 2) {
            const dist = pointToLineDistance(x, y, points[0].x, points[0].y, points[1].x, points[1].y);
            if (dist < SELECTION_THRESHOLD) return drawing;
          }
          break;
        }
        case "rectangle": {
          if (points.length >= 2) {
            const minX = Math.min(points[0].x, points[1].x);
            const maxX = Math.max(points[0].x, points[1].x);
            const minY = Math.min(points[0].y, points[1].y);
            const maxY = Math.max(points[0].y, points[1].y);

            // Check edges
            if (x >= minX - SELECTION_THRESHOLD && x <= maxX + SELECTION_THRESHOLD) {
              if (Math.abs(y - minY) < SELECTION_THRESHOLD || Math.abs(y - maxY) < SELECTION_THRESHOLD) {
                return drawing;
              }
            }
            if (y >= minY - SELECTION_THRESHOLD && y <= maxY + SELECTION_THRESHOLD) {
              if (Math.abs(x - minX) < SELECTION_THRESHOLD || Math.abs(x - maxX) < SELECTION_THRESHOLD) {
                return drawing;
              }
            }
          }
          break;
        }
        case "fib_retracement": {
          if (points.length >= 2) {
            const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            const startPrice = drawing.points[0].price;
            const endPrice = drawing.points[1].price;
            const diff = endPrice - startPrice;

            for (const level of FIB_LEVELS) {
              const price = startPrice + diff * level;
              const lineY = priceToY(price);
              if (Math.abs(y - lineY) < SELECTION_THRESHOLD) return drawing;
            }
          }
          break;
        }
        case "fib_extension": {
          if (points.length >= 3) {
            const EXT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2];
            const aPrice = drawing.points[0].price;
            const bPrice = drawing.points[1].price;
            const cPrice = drawing.points[2].price;
            const diff = bPrice - aPrice;

            // Check trend lines A->B and B->C
            const distAB = pointToLineDistance(x, y, points[0].x, points[0].y, points[1].x, points[1].y);
            const distBC = pointToLineDistance(x, y, points[1].x, points[1].y, points[2].x, points[2].y);
            if (distAB < SELECTION_THRESHOLD || distBC < SELECTION_THRESHOLD) return drawing;

            // Check extension levels
            for (const level of EXT_LEVELS) {
              const price = cPrice + diff * level;
              const lineY = priceToY(price);
              if (Math.abs(y - lineY) < SELECTION_THRESHOLD && x >= points[2].x) return drawing;
            }
          }
          break;
        }
        case "fib_time_zone": {
          if (points.length >= 2) {
            const TIME_LEVELS = [0, 1, 2, 3, 5, 8, 13, 21, 34];
            const startTime = drawing.points[0].time;
            const endTime = drawing.points[1].time;
            const timeDiff = endTime - startTime;

            for (const level of TIME_LEVELS) {
              const time = startTime + timeDiff * level;
              const lineX = timeToX(time);
              if (Math.abs(x - lineX) < SELECTION_THRESHOLD) return drawing;
            }
          }
          break;
        }
        case "horizontal_ray": {
          if (points.length >= 1) {
            const dist = Math.abs(y - points[0].y);
            if (dist < SELECTION_THRESHOLD && x >= points[0].x - SELECTION_THRESHOLD) return drawing;
          }
          break;
        }
        case "cross_line": {
          if (points.length >= 1) {
            const distH = Math.abs(y - points[0].y);
            const distV = Math.abs(x - points[0].x);
            if (distH < SELECTION_THRESHOLD || distV < SELECTION_THRESHOLD) return drawing;
          }
          break;
        }
        case "circle": {
          if (points.length >= 2) {
            const cx = (points[0].x + points[1].x) / 2;
            const cy = (points[0].y + points[1].y) / 2;
            const radius = Math.sqrt(
              Math.pow(points[1].x - points[0].x, 2) + Math.pow(points[1].y - points[0].y, 2)
            ) / 2;
            const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            if (Math.abs(distFromCenter - radius) < SELECTION_THRESHOLD) return drawing;
          }
          break;
        }
        case "ellipse": {
          if (points.length >= 2) {
            const cx = (points[0].x + points[1].x) / 2;
            const cy = (points[0].y + points[1].y) / 2;
            const rx = Math.abs(points[1].x - points[0].x) / 2;
            const ry = Math.abs(points[1].y - points[0].y) / 2;
            if (rx > 0 && ry > 0) {
              // Check normalized distance to ellipse
              const nx = (x - cx) / rx;
              const ny = (y - cy) / ry;
              const dist = Math.sqrt(nx * nx + ny * ny);
              if (Math.abs(dist - 1) < SELECTION_THRESHOLD / Math.min(rx, ry)) return drawing;
            }
          }
          break;
        }
        case "long_position":
        case "short_position": {
          if (points.length >= 2) {
            const entryY = points[0].y;
            const targetY = points[1].y;
            const stopY = drawing.drawing_type === "long_position"
              ? entryY + (entryY - targetY)
              : entryY - (targetY - entryY);

            // Check entry, target, or stop lines
            if (Math.abs(y - entryY) < SELECTION_THRESHOLD ||
                Math.abs(y - targetY) < SELECTION_THRESHOLD ||
                Math.abs(y - stopY) < SELECTION_THRESHOLD) {
              return drawing;
            }
          }
          break;
        }
        case "text":
        case "anchored_text":
        case "price_label":
        case "arrow_marker":
        case "flag_marker":
        case "icon":
        case "note": {
          // For single-point annotations, check within a reasonable box
          if (points.length >= 1) {
            const dist = Math.sqrt((x - points[0].x) ** 2 + (y - points[0].y) ** 2);
            if (dist < SELECTION_THRESHOLD * 2) return drawing;
          }
          break;
        }
        case "info_line":
        case "trend_angle": {
          if (points.length >= 2) {
            const dist = pointToLineDistance(x, y, points[0].x, points[0].y, points[1].x, points[1].y);
            if (dist < SELECTION_THRESHOLD) return drawing;
          }
          break;
        }
        case "triangle": {
          if (points.length >= 3) {
            // Check all three edges including the closing edge
            const dist01 = pointToLineDistance(x, y, points[0].x, points[0].y, points[1].x, points[1].y);
            const dist12 = pointToLineDistance(x, y, points[1].x, points[1].y, points[2].x, points[2].y);
            const dist20 = pointToLineDistance(x, y, points[2].x, points[2].y, points[0].x, points[0].y);
            if (dist01 < SELECTION_THRESHOLD || dist12 < SELECTION_THRESHOLD || dist20 < SELECTION_THRESHOLD) {
              return drawing;
            }
          }
          break;
        }
        case "parallel_channel": {
          if (points.length >= 3) {
            // Main line
            const dist01 = pointToLineDistance(x, y, points[0].x, points[0].y, points[1].x, points[1].y);
            if (dist01 < SELECTION_THRESHOLD) return drawing;

            // Parallel line (offset by third point)
            const offsetY = points[2].y - points[0].y;
            const p0y = points[0].y + offsetY;
            const p1y = points[1].y + offsetY;
            const distParallel = pointToLineDistance(x, y, points[0].x, p0y, points[1].x, p1y);
            if (distParallel < SELECTION_THRESHOLD) return drawing;
          }
          break;
        }
        default: {
          // Generic check for multi-point drawings
          for (let j = 0; j < points.length - 1; j++) {
            const dist = pointToLineDistance(x, y, points[j].x, points[j].y, points[j + 1].x, points[j + 1].y);
            if (dist < SELECTION_THRESHOLD) return drawing;
          }
        }
      }
    }
    return null;
  }, [visibleDrawings, timeToX, priceToY]);

  // Find ALL drawings at a point (for cycling through overlapping drawings)
  const findAllDrawingsAtPoint = useCallback((x: number, y: number): Drawing[] => {
    const result: Drawing[] = [];

    for (let i = visibleDrawings.length - 1; i >= 0; i--) {
      const drawing = visibleDrawings[i];
      if (!drawing.visible) continue;

      const points = drawing.points.map(p => ({
        x: timeToX(p.time),
        y: priceToY(p.price),
      }));

      let isHit = false;

      // Check if clicking on a control point
      for (const p of points) {
        const dist = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
        if (dist < SELECTION_THRESHOLD) {
          isHit = true;
          break;
        }
      }

      if (!isHit) {
        // Check based on drawing type
        switch (drawing.drawing_type) {
          case "horizontal": {
            if (points.length >= 1) {
              const dist = Math.abs(y - points[0].y);
              if (dist < SELECTION_THRESHOLD) isHit = true;
            }
            break;
          }
          case "vertical": {
            if (points.length >= 1) {
              const dist = Math.abs(x - points[0].x);
              if (dist < SELECTION_THRESHOLD) isHit = true;
            }
            break;
          }
          case "trendline":
          case "ray":
          case "extended":
          case "arrow": {
            if (points.length >= 2) {
              const dist = pointToLineDistance(x, y, points[0].x, points[0].y, points[1].x, points[1].y);
              if (dist < SELECTION_THRESHOLD) isHit = true;
            }
            break;
          }
          case "rectangle": {
            if (points.length >= 2) {
              const minX = Math.min(points[0].x, points[1].x);
              const maxX = Math.max(points[0].x, points[1].x);
              const minY = Math.min(points[0].y, points[1].y);
              const maxY = Math.max(points[0].y, points[1].y);

              // Check edges
              if (x >= minX - SELECTION_THRESHOLD && x <= maxX + SELECTION_THRESHOLD) {
                if (Math.abs(y - minY) < SELECTION_THRESHOLD || Math.abs(y - maxY) < SELECTION_THRESHOLD) {
                  isHit = true;
                }
              }
              if (!isHit && y >= minY - SELECTION_THRESHOLD && y <= maxY + SELECTION_THRESHOLD) {
                if (Math.abs(x - minX) < SELECTION_THRESHOLD || Math.abs(x - maxX) < SELECTION_THRESHOLD) {
                  isHit = true;
                }
              }
            }
            break;
          }
          case "fib_retracement": {
            if (points.length >= 2) {
              const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
              const startPrice = drawing.points[0].price;
              const endPrice = drawing.points[1].price;
              const diff = endPrice - startPrice;

              for (const level of FIB_LEVELS) {
                const price = startPrice + diff * level;
                const lineY = priceToY(price);
                if (Math.abs(y - lineY) < SELECTION_THRESHOLD) {
                  isHit = true;
                  break;
                }
              }
            }
            break;
          }
          case "fib_extension": {
            if (points.length >= 3) {
              const EXT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2];
              const aPrice = drawing.points[0].price;
              const bPrice = drawing.points[1].price;
              const cPrice = drawing.points[2].price;
              const diff = bPrice - aPrice;

              // Check trend lines
              const distAB = pointToLineDistance(x, y, points[0].x, points[0].y, points[1].x, points[1].y);
              const distBC = pointToLineDistance(x, y, points[1].x, points[1].y, points[2].x, points[2].y);
              if (distAB < SELECTION_THRESHOLD || distBC < SELECTION_THRESHOLD) {
                isHit = true;
              } else {
                // Check extension levels
                for (const level of EXT_LEVELS) {
                  const price = cPrice + diff * level;
                  const lineY = priceToY(price);
                  if (Math.abs(y - lineY) < SELECTION_THRESHOLD && x >= points[2].x) {
                    isHit = true;
                    break;
                  }
                }
              }
            }
            break;
          }
          case "fib_time_zone": {
            if (points.length >= 2) {
              const TIME_LEVELS = [0, 1, 2, 3, 5, 8, 13, 21, 34];
              const startTime = drawing.points[0].time;
              const endTime = drawing.points[1].time;
              const timeDiff = endTime - startTime;

              for (const level of TIME_LEVELS) {
                const time = startTime + timeDiff * level;
                const lineX = timeToX(time);
                if (Math.abs(x - lineX) < SELECTION_THRESHOLD) {
                  isHit = true;
                  break;
                }
              }
            }
            break;
          }
          case "horizontal_ray": {
            if (points.length >= 1) {
              const dist = Math.abs(y - points[0].y);
              if (dist < SELECTION_THRESHOLD && x >= points[0].x - SELECTION_THRESHOLD) isHit = true;
            }
            break;
          }
          case "cross_line": {
            if (points.length >= 1) {
              const distH = Math.abs(y - points[0].y);
              const distV = Math.abs(x - points[0].x);
              if (distH < SELECTION_THRESHOLD || distV < SELECTION_THRESHOLD) isHit = true;
            }
            break;
          }
          case "circle": {
            if (points.length >= 2) {
              const cx = (points[0].x + points[1].x) / 2;
              const cy = (points[0].y + points[1].y) / 2;
              const radius = Math.sqrt(
                Math.pow(points[1].x - points[0].x, 2) + Math.pow(points[1].y - points[0].y, 2)
              ) / 2;
              const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
              if (Math.abs(distFromCenter - radius) < SELECTION_THRESHOLD) isHit = true;
            }
            break;
          }
          case "ellipse": {
            if (points.length >= 2) {
              const cx = (points[0].x + points[1].x) / 2;
              const cy = (points[0].y + points[1].y) / 2;
              const rx = Math.abs(points[1].x - points[0].x) / 2;
              const ry = Math.abs(points[1].y - points[0].y) / 2;
              if (rx > 0 && ry > 0) {
                const nx = (x - cx) / rx;
                const ny = (y - cy) / ry;
                const dist = Math.sqrt(nx * nx + ny * ny);
                if (Math.abs(dist - 1) < SELECTION_THRESHOLD / Math.min(rx, ry)) isHit = true;
              }
            }
            break;
          }
          case "long_position":
          case "short_position": {
            if (points.length >= 2) {
              const entryY = points[0].y;
              const targetY = points[1].y;
              const stopY = drawing.drawing_type === "long_position"
                ? entryY + (entryY - targetY)
                : entryY - (targetY - entryY);

              if (Math.abs(y - entryY) < SELECTION_THRESHOLD ||
                  Math.abs(y - targetY) < SELECTION_THRESHOLD ||
                  Math.abs(y - stopY) < SELECTION_THRESHOLD) {
                isHit = true;
              }
            }
            break;
          }
          case "text":
          case "anchored_text":
          case "price_label":
          case "arrow_marker":
          case "flag_marker":
          case "icon":
          case "note": {
            if (points.length >= 1) {
              const dist = Math.sqrt((x - points[0].x) ** 2 + (y - points[0].y) ** 2);
              if (dist < SELECTION_THRESHOLD * 2) isHit = true;
            }
            break;
          }
          case "info_line":
          case "trend_angle": {
            if (points.length >= 2) {
              const dist = pointToLineDistance(x, y, points[0].x, points[0].y, points[1].x, points[1].y);
              if (dist < SELECTION_THRESHOLD) isHit = true;
            }
            break;
          }
          case "triangle": {
            if (points.length >= 3) {
              const dist01 = pointToLineDistance(x, y, points[0].x, points[0].y, points[1].x, points[1].y);
              const dist12 = pointToLineDistance(x, y, points[1].x, points[1].y, points[2].x, points[2].y);
              const dist20 = pointToLineDistance(x, y, points[2].x, points[2].y, points[0].x, points[0].y);
              if (dist01 < SELECTION_THRESHOLD || dist12 < SELECTION_THRESHOLD || dist20 < SELECTION_THRESHOLD) {
                isHit = true;
              }
            }
            break;
          }
          case "parallel_channel": {
            if (points.length >= 3) {
              const dist01 = pointToLineDistance(x, y, points[0].x, points[0].y, points[1].x, points[1].y);
              if (dist01 < SELECTION_THRESHOLD) {
                isHit = true;
              } else {
                const offsetY = points[2].y - points[0].y;
                const p0y = points[0].y + offsetY;
                const p1y = points[1].y + offsetY;
                const distParallel = pointToLineDistance(x, y, points[0].x, p0y, points[1].x, p1y);
                if (distParallel < SELECTION_THRESHOLD) isHit = true;
              }
            }
            break;
          }
          default: {
            // Generic check for multi-point drawings
            for (let j = 0; j < points.length - 1; j++) {
              const dist = pointToLineDistance(x, y, points[j].x, points[j].y, points[j + 1].x, points[j + 1].y);
              if (dist < SELECTION_THRESHOLD) {
                isHit = true;
                break;
              }
            }
          }
        }
      }

      if (isHit) {
        result.push(drawing);
      }
    }

    return result;
  }, [visibleDrawings, timeToX, priceToY]);

  const findPointIndexAtPosition = useCallback((drawing: Drawing, x: number, y: number): number | null => {
    const points = drawing.points.map(p => ({
      x: timeToX(p.time),
      y: priceToY(p.price),
    }));

    for (let i = 0; i < points.length; i++) {
      const dist = Math.sqrt((x - points[i].x) ** 2 + (y - points[i].y) ** 2);
      if (dist < HANDLE_SIZE + 4) return i;
    }
    return null;
  }, [timeToX, priceToY]);

  // ============================================
  // RENDERING
  // ============================================

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Draw X-axis background area (slightly lighter than main background)
    ctx.fillStyle = "#131c2e";
    ctx.fillRect(0, dimensions.height - PADDING_BOTTOM, dimensions.width, PADDING_BOTTOM);

    // Draw separator line between chart and X-axis
    ctx.strokeStyle = "rgba(71, 85, 105, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, dimensions.height - PADDING_BOTTOM);
    ctx.lineTo(dimensions.width - PADDING_RIGHT, dimensions.height - PADDING_BOTTOM);
    ctx.stroke();

    if (klines.length === 0) {
      ctx.fillStyle = "#64748b";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Loading data...", dimensions.width / 2, dimensions.height / 2);
      return;
    }

    const { startIndex, endIndex, priceMin, priceMax } = viewport;
    const visibleStartIdx = Math.max(0, Math.floor(startIndex));
    const visibleEndIdx = Math.min(klines.length, Math.ceil(endIndex));
    const visibleKlines = klines.slice(visibleStartIdx, visibleEndIdx);

    if (visibleKlines.length === 0) return;

    const visibleCount = endIndex - startIndex;
    const candleWidth = chartArea.width / visibleCount;
    const bodyWidth = candleWidth * CANDLE_WIDTH_RATIO;

    // Draw grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;

    const priceRange = priceMax - priceMin;
    const priceStep = calculateStep(priceRange, 8);
    const startPrice = Math.ceil(priceMin / priceStep) * priceStep;

    ctx.fillStyle = COLORS.gridText;
    ctx.font = "11px monospace";
    ctx.textAlign = "left";

    for (let price = startPrice; price <= priceMax; price += priceStep) {
      const y = priceToY(price);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      ctx.fillText(formatPrice(price), chartArea.right + 5, y + 4);
    }

    // Draw time grid lines and labels (TradingView style)
    ctx.textAlign = "center";

    // Simple approach: evenly space labels based on visible candles
    const targetLabelCount = Math.min(10, Math.max(4, Math.floor(chartArea.width / 100)));
    const labelStep = Math.max(1, Math.floor(visibleCount / targetLabelCount));

    let lastLabelX = -Infinity;
    const minLabelSpacing = 80; // Minimum pixels between labels
    let prevDay = -1;

    for (let i = visibleStartIdx; i < visibleEndIdx; i += labelStep) {
      if (i >= klines.length) continue;

      const kline = klines[i];
      const timestamp = kline.timestamp;
      const date = new Date(timestamp);
      const x = indexToX(i);

      // Skip if too close to previous label or outside chart area
      if (x - lastLabelX < minLabelSpacing) continue;
      if (x < chartArea.left + 30 || x > chartArea.right - 30) continue;

      // Draw vertical grid line
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();

      // Determine if this is a major label (day change)
      const currentDay = date.getDate();
      const isDayChange = prevDay !== -1 && currentDay !== prevDay;
      const isMidnight = date.getHours() === 0 && date.getMinutes() === 0;

      // Format label
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const dayStr = date.getDate().toString();
      const monthStr = (date.getMonth() + 1).toString().padStart(2, "0");

      let label: string;
      let isMajor = false;

      if (interval === "D" || interval === "W" || interval === "M") {
        // Daily/weekly/monthly: always show date
        label = `${dayStr}`;
        isMajor = true;
      } else if (isDayChange || isMidnight) {
        // Day change or midnight: show date
        label = `${dayStr}`;
        isMajor = true;
      } else {
        // Regular time label
        label = `${hours}:${minutes}`;
      }

      // Draw label with appropriate style
      ctx.fillStyle = isMajor ? "#ffffff" : "#b8c5d6";
      ctx.font = isMajor ? "bold 12px sans-serif" : "12px sans-serif";
      ctx.fillText(label, x, chartArea.bottom + 20);

      lastLabelX = x;
      prevDay = currentDay;
    }

    // Fallback: If no labels were drawn, draw basic labels
    if (lastLabelX === -Infinity) {
      const gridStep = Math.max(1, Math.floor(visibleCount / 8));
      for (let i = visibleStartIdx; i < visibleEndIdx; i += gridStep) {
        const x = indexToX(i);

        // Draw grid line
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();

        // Draw label
        if (i < klines.length) {
          ctx.fillStyle = "#b8c5d6";
          ctx.font = "12px sans-serif";
          const timeLabel = formatTime(klines[i].timestamp, interval);
          ctx.fillText(timeLabel, x, chartArea.bottom + 20);
        }
      }
    }

    // Draw candlesticks
    for (let i = 0; i < visibleKlines.length; i++) {
      const kline = visibleKlines[i];
      const actualIndex = visibleStartIdx + i;
      const x = indexToX(actualIndex);

      const isBullish = kline.close >= kline.open;
      const color = isBullish ? COLORS.bullish : COLORS.bearish;

      const openY = priceToY(kline.open);
      const closeY = priceToY(kline.close);
      const highY = priceToY(kline.high);
      const lowY = priceToY(kline.low);

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1, Math.abs(closeY - openY));

      ctx.fillStyle = color;
      ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    }

    // Draw current price line (TradingView style - dashed line with price tag)
    if (klines.length > 0) {
      const lastCandle = klines[klines.length - 1];
      const currentPrice = lastCandle.close;
      const currentPriceY = priceToY(currentPrice);

      // Only draw if price is visible
      if (currentPriceY >= chartArea.top && currentPriceY <= chartArea.bottom) {
        const isBullish = lastCandle.close >= lastCandle.open;
        const priceColor = isBullish ? COLORS.bullish : COLORS.bearish;

        ctx.save();

        // Draw dashed horizontal line across the chart
        ctx.strokeStyle = priceColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(chartArea.left, currentPriceY);
        ctx.lineTo(chartArea.right, currentPriceY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw price tag on Y-axis (right side)
        const tagHeight = 20;
        const tagWidth = PADDING_RIGHT - 4;
        const tagY = currentPriceY - tagHeight / 2;

        // Arrow/pointer shape on left side of tag
        ctx.fillStyle = priceColor;
        ctx.beginPath();
        ctx.moveTo(chartArea.right, currentPriceY);
        ctx.lineTo(chartArea.right + 6, currentPriceY - 6);
        ctx.lineTo(chartArea.right + 6, tagY);
        ctx.lineTo(chartArea.right + tagWidth, tagY);
        ctx.lineTo(chartArea.right + tagWidth, tagY + tagHeight);
        ctx.lineTo(chartArea.right + 6, tagY + tagHeight);
        ctx.lineTo(chartArea.right + 6, currentPriceY + 6);
        ctx.closePath();
        ctx.fill();

        // Draw price text
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "left";
        ctx.fillText(formatPrice(currentPrice), chartArea.right + 10, currentPriceY + 4);

        ctx.restore();
      }
    }

    // Draw VWAP lines (moving volume weighted average)
    if (vwapData.length > 0) {
      ctx.save();

      vwapData.forEach(vwap => {
        if (!vwap.values || vwap.values.length < 2) return;

        // Draw main VWAP line
        ctx.strokeStyle = vwap.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();

        let firstPoint = true;
        let lastValue = 0;
        let lastY = 0;

        for (const point of vwap.values) {
          const x = timeToX(point.timestamp);
          const y = priceToY(point.value);

          if (x < chartArea.left - 10 || x > chartArea.right + 10) continue;

          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
          lastValue = point.value;
          lastY = y;
        }
        ctx.stroke();

        // Draw price tag on Y-axis (right side) - TradingView style
        if (!firstPoint && lastY > chartArea.top - 10 && lastY < chartArea.bottom + 10) {
          const tagHeight = 18;
          const tagY = Math.max(chartArea.top, Math.min(chartArea.bottom - tagHeight, lastY - tagHeight / 2));

          // Draw colored background tag
          ctx.fillStyle = vwap.color;
          ctx.fillRect(chartArea.right + 1, tagY, PADDING_RIGHT - 6, tagHeight);

          // Draw price text
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "left";
          ctx.fillText(formatPrice(lastValue), chartArea.right + 4, tagY + 13);

          // Draw small label above or below
          ctx.fillStyle = vwap.color;
          ctx.font = "9px monospace";
          const labelY = tagY > chartArea.top + 15 ? tagY - 3 : tagY + tagHeight + 10;
          ctx.fillText(`VWAP`, chartArea.right + 4, labelY);
        }

        // Draw bands if enabled (up to 3 band pairs)
        if (vwap.showBands) {
          ctx.strokeStyle = vwap.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);

          // Helper function to draw a band line
          const drawBandLine = (bandKey: 'upperBand1' | 'lowerBand1' | 'upperBand2' | 'lowerBand2' | 'upperBand3' | 'lowerBand3') => {
            ctx.beginPath();
            let isFirst = true;
            for (const point of vwap.values) {
              const bandValue = point[bandKey];
              if (bandValue === undefined) continue;
              const x = timeToX(point.timestamp);
              const y = priceToY(bandValue);
              if (x < chartArea.left - 10 || x > chartArea.right + 10) continue;
              if (isFirst) {
                ctx.moveTo(x, y);
                isFirst = false;
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.stroke();
          };

          // Draw all enabled band pairs
          drawBandLine('upperBand1');
          drawBandLine('lowerBand1');
          drawBandLine('upperBand2');
          drawBandLine('lowerBand2');
          drawBandLine('upperBand3');
          drawBandLine('lowerBand3');

          ctx.setLineDash([]);
        }
      });

      ctx.restore();
    }

    // Draw SMA lines (moving averages)
    if (smaData.length > 0) {
      ctx.save();
      ctx.setLineDash([]);

      const periodLabels: Record<string, string> = {
        "200D": "200D",
        "50W": "50W",
        "100W": "100W",
        "200W": "200W",
      };

      smaData.forEach(sma => {
        if (!sma.values || sma.values.length < 2) return;

        ctx.strokeStyle = sma.color;
        ctx.lineWidth = sma.lineWidth;
        ctx.beginPath();

        let firstPoint = true;
        let lastValue = 0;
        let lastY = 0;

        // Draw the SMA line through all data points
        for (const point of sma.values) {
          const x = timeToX(point.timestamp);
          const y = priceToY(point.value);

          // Skip points outside visible X range
          if (x < chartArea.left - 10 || x > chartArea.right + 10) continue;

          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
          lastValue = point.value;
          lastY = y;
        }

        ctx.stroke();

        // Draw price tag on Y-axis (right side) - TradingView style
        if (!firstPoint && lastY > chartArea.top - 10 && lastY < chartArea.bottom + 10) {
          const tagHeight = 18;
          const tagY = Math.max(chartArea.top, Math.min(chartArea.bottom - tagHeight, lastY - tagHeight / 2));

          // Draw colored background tag
          ctx.fillStyle = sma.color;
          ctx.fillRect(chartArea.right + 1, tagY, PADDING_RIGHT - 6, tagHeight);

          // Draw price text
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "left";
          ctx.fillText(formatPrice(lastValue), chartArea.right + 4, tagY + 13);

          // Draw small label above or below
          ctx.fillStyle = sma.color;
          ctx.font = "9px monospace";
          const labelY = tagY > chartArea.top + 15 ? tagY - 3 : tagY + tagHeight + 10;
          ctx.fillText(`SMA ${periodLabels[sma.period] || sma.period}`, chartArea.right + 4, labelY);
        }
      });

      ctx.restore();
    }

    // Draw Anchored VWAP lines
    if (anchoredVwapData.length > 0) {
      ctx.save();

      anchoredVwapData.forEach(avwap => {
        if (!avwap.values || avwap.values.length < 2) return;

        // Draw anchor marker at start point
        const startPoint = avwap.values[0];
        if (startPoint) {
          const anchorX = timeToX(startPoint.timestamp);
          const anchorY = priceToY(startPoint.value);
          if (anchorX >= chartArea.left && anchorX <= chartArea.right) {
            ctx.fillStyle = avwap.color;
            ctx.beginPath();
            ctx.arc(anchorX, anchorY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // Draw main VWAP line
        ctx.strokeStyle = avwap.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();

        let firstPoint = true;
        let lastValue = 0;
        let lastY = 0;

        for (const point of avwap.values) {
          const x = timeToX(point.timestamp);
          const y = priceToY(point.value);

          if (x < chartArea.left - 10 || x > chartArea.right + 10) continue;

          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
          lastValue = point.value;
          lastY = y;
        }
        ctx.stroke();

        // Draw price tag on Y-axis with anchor indicator
        if (!firstPoint && lastY > chartArea.top - 10 && lastY < chartArea.bottom + 10) {
          const tagHeight = 18;
          const tagY = Math.max(chartArea.top, Math.min(chartArea.bottom - tagHeight, lastY - tagHeight / 2));

          // Draw colored background tag
          ctx.fillStyle = avwap.color;
          ctx.fillRect(chartArea.right + 1, tagY, PADDING_RIGHT - 6, tagHeight);

          // Draw price text
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "left";
          ctx.fillText(formatPrice(lastValue), chartArea.right + 4, tagY + 13);

          // Draw anchor icon
          ctx.fillStyle = avwap.color;
          ctx.font = "8px sans-serif";
          const labelY = tagY > chartArea.top + 15 ? tagY - 3 : tagY + tagHeight + 10;
          ctx.fillText(`⚓ ${avwap.name}`, chartArea.right + 4, labelY);
        }

        // Draw bands if enabled
        if (avwap.showBands) {
          ctx.strokeStyle = avwap.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);

          // Upper band
          ctx.beginPath();
          firstPoint = true;
          for (const point of avwap.values) {
            if (point.upperBand === undefined) continue;
            const x = timeToX(point.timestamp);
            const y = priceToY(point.upperBand);
            if (x < chartArea.left - 10 || x > chartArea.right + 10) continue;
            if (firstPoint) {
              ctx.moveTo(x, y);
              firstPoint = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();

          // Lower band
          ctx.beginPath();
          firstPoint = true;
          for (const point of avwap.values) {
            if (point.lowerBand === undefined) continue;
            const x = timeToX(point.timestamp);
            const y = priceToY(point.lowerBand);
            if (x < chartArea.left - 10 || x > chartArea.right + 10) continue;
            if (firstPoint) {
              ctx.moveTo(x, y);
              firstPoint = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();

          ctx.setLineDash([]);
        }
      });

      ctx.restore();
    }

    // Show anchor selection mode indicator
    if (selectingAnchor) {
      ctx.save();
      ctx.fillStyle = "rgba(0, 200, 200, 0.1)";
      ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);

      ctx.fillStyle = "#00c8c8";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        selectingAnchor.type === "start" ? "⚓ Başlangıç noktası seçin..." : "🏁 Bitiş noktası seçin...",
        chartArea.left + chartArea.width / 2,
        chartArea.top + 30
      );
      ctx.restore();
    }

    // Draw drawings (filtered by current timeframe)
    visibleDrawings.forEach(drawing => {
      if (!drawing.visible) return;
      const isSelected = drawing.id === selectedDrawingId;
      renderSingleDrawing(ctx, drawing, isSelected);
    });

    // Draw pending drawing preview
    if (pendingPoints.length > 0 && activeTool !== "none" && mousePos) {
      ctx.strokeStyle = currentStyle.color;
      ctx.lineWidth = currentStyle.lineWidth;
      ctx.setLineDash([5, 5]);

      const points = pendingPoints.map(p => ({
        x: timeToX(p.time),
        y: priceToY(p.price),
      }));

      // Apply shift constraint for preview
      let previewPoint = { time: mousePos.time, price: mousePos.price };
      if (pendingPoints.length > 0) {
        previewPoint = applyShiftConstraint(previewPoint, pendingPoints[0]);
      }

      const previewX = timeToX(previewPoint.time);
      const previewY = priceToY(previewPoint.price);

      // ========== HORIZONTAL LINE ==========
      if (activeTool === "horizontal") {
        ctx.beginPath();
        ctx.moveTo(chartArea.left, previewY);
        ctx.lineTo(chartArea.right, previewY);
        ctx.stroke();
        // Price label
        ctx.fillStyle = currentStyle.color;
        ctx.font = "11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(formatPrice(previewPoint.price), chartArea.right + 5, previewY + 4);
      }
      // ========== HORIZONTAL RAY ==========
      else if (activeTool === "horizontal_ray") {
        ctx.beginPath();
        ctx.moveTo(previewX, previewY);
        ctx.lineTo(chartArea.right + 1000, previewY);
        ctx.stroke();
        // Price label
        ctx.fillStyle = currentStyle.color;
        ctx.font = "11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(formatPrice(previewPoint.price), chartArea.right + 5, previewY + 4);
      }
      // ========== VERTICAL LINE ==========
      else if (activeTool === "vertical") {
        ctx.beginPath();
        ctx.moveTo(previewX, chartArea.top);
        ctx.lineTo(previewX, chartArea.bottom);
        ctx.stroke();
      }
      // ========== CROSS LINE ==========
      else if (activeTool === "cross_line") {
        ctx.beginPath();
        ctx.moveTo(chartArea.left, previewY);
        ctx.lineTo(chartArea.right, previewY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(previewX, chartArea.top);
        ctx.lineTo(previewX, chartArea.bottom);
        ctx.stroke();
      }
      // ========== FIBONACCI RETRACEMENT ==========
      else if (activeTool === "fib_retracement" && points.length >= 1) {
        const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const FIB_COLORS = ["#787B86", "#F23645", "#FF9800", "#4CAF50", "#089981", "#00BCD4", "#787B86"];

        const startPrice = pendingPoints[0].price;
        const endPrice = previewPoint.price;
        const diff = endPrice - startPrice;

        const minY = Math.min(points[0].y, previewY);
        const maxY = Math.max(points[0].y, previewY);
        ctx.fillStyle = "rgba(100, 100, 100, 0.1)";
        ctx.fillRect(chartArea.left, minY, chartArea.width, maxY - minY);

        FIB_LEVELS.forEach((level, i) => {
          const price = startPrice + diff * level;
          const y = priceToY(price);

          ctx.strokeStyle = FIB_COLORS[i];
          ctx.lineWidth = level === 0 || level === 1 ? 1.5 : 1;
          ctx.setLineDash(level === 0.5 ? [5, 5] : []);
          ctx.beginPath();
          ctx.moveTo(chartArea.left, y);
          ctx.lineTo(chartArea.right, y);
          ctx.stroke();

          ctx.fillStyle = FIB_COLORS[i];
          ctx.font = "11px sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(`${level} (${formatPrice(price)})`, chartArea.right + 5, y + 4);
        });

        ctx.setLineDash([5, 5]);
        ctx.lineWidth = currentStyle.lineWidth;
      }
      // ========== RAY (extends to right) ==========
      else if (activeTool === "ray" && points.length >= 1) {
        const dx = previewX - points[0].x;
        const dy = previewY - points[0].y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
          const extendFactor = 3000 / length;
          const endX = points[0].x + dx * extendFactor;
          const endY = points[0].y + dy * extendFactor;

          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Start point marker
          ctx.fillStyle = currentStyle.color;
          ctx.beginPath();
          ctx.arc(points[0].x, points[0].y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // ========== EXTENDED LINE (extends both directions) ==========
      else if (activeTool === "extended" && points.length >= 1) {
        const dx = previewX - points[0].x;
        const dy = previewY - points[0].y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
          const extendFactor = 3000 / length;
          const startExtX = points[0].x - dx * extendFactor;
          const startExtY = points[0].y - dy * extendFactor;
          const endExtX = points[0].x + dx * extendFactor;
          const endExtY = points[0].y + dy * extendFactor;

          ctx.beginPath();
          ctx.moveTo(startExtX, startExtY);
          ctx.lineTo(endExtX, endExtY);
          ctx.stroke();
        }
      }
      // ========== TRENDLINE ==========
      else if (activeTool === "trendline" && points.length >= 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(previewX, previewY);
        ctx.stroke();

        // Point markers
        ctx.fillStyle = currentStyle.color;
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(previewX, previewY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // ========== ARROW ==========
      else if (activeTool === "arrow" && points.length >= 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(previewX, previewY);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(previewY - points[0].y, previewX - points[0].x);
        const headLength = 15;
        ctx.beginPath();
        ctx.moveTo(previewX, previewY);
        ctx.lineTo(
          previewX - headLength * Math.cos(angle - Math.PI / 6),
          previewY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(previewX, previewY);
        ctx.lineTo(
          previewX - headLength * Math.cos(angle + Math.PI / 6),
          previewY - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      }
      // ========== RECTANGLE ==========
      else if (activeTool === "rectangle" && points.length >= 1) {
        const x = Math.min(points[0].x, previewX);
        const y = Math.min(points[0].y, previewY);
        const w = Math.abs(previewX - points[0].x);
        const h = Math.abs(previewY - points[0].y);

        // Fill
        ctx.fillStyle = currentStyle.fillColor || currentStyle.color;
        ctx.globalAlpha = currentStyle.fillOpacity || 0.1;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;

        // Stroke
        ctx.strokeRect(x, y, w, h);
      }
      // ========== INFO LINE (with measurements) ==========
      else if (activeTool === "info_line" && points.length >= 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(previewX, previewY);
        ctx.stroke();

        // Calculate info
        const priceDiff = previewPoint.price - pendingPoints[0].price;
        const percentage = (priceDiff / pendingPoints[0].price) * 100;
        const timeDiffMs = Math.abs(previewPoint.time - pendingPoints[0].time);
        const bars = Math.round(timeDiffMs / 60000); // Assuming 1m

        // Draw info box
        const midX = (points[0].x + previewX) / 2;
        const midY = (points[0].y + previewY) / 2;
        const infoText = `${priceDiff >= 0 ? "+" : ""}${formatPrice(priceDiff)} (${percentage >= 0 ? "+" : ""}${percentage.toFixed(2)}%) ${bars} bars`;

        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(midX - 80, midY - 12, 160, 24);
        ctx.fillStyle = priceDiff >= 0 ? "#22c55e" : "#ef4444";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(infoText, midX, midY + 4);
      }
      // ========== TREND ANGLE ==========
      else if (activeTool === "trend_angle" && points.length >= 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(previewX, previewY);
        ctx.stroke();

        // Draw horizontal reference line
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(previewX, points[0].y);
        ctx.stroke();
        ctx.setLineDash([5, 5]);

        // Calculate and show angle
        const dx = previewX - points[0].x;
        const dy = points[0].y - previewY; // Inverted because Y grows downward
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        ctx.fillStyle = currentStyle.color;
        ctx.font = "12px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${angle.toFixed(1)}°`, points[0].x + 30, points[0].y - 10);
      }
      // ========== CIRCLE ==========
      else if (activeTool === "circle" && points.length >= 1) {
        const dx = previewX - points[0].x;
        const dy = previewY - points[0].y;
        const radius = Math.sqrt(dx * dx + dy * dy);

        ctx.fillStyle = currentStyle.fillColor || currentStyle.color;
        ctx.globalAlpha = currentStyle.fillOpacity || 0.1;
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      // ========== ELLIPSE ==========
      else if (activeTool === "ellipse" && points.length >= 1) {
        const radiusX = Math.abs(previewX - points[0].x);
        const radiusY = Math.abs(previewY - points[0].y);
        const centerX = (points[0].x + previewX) / 2;
        const centerY = (points[0].y + previewY) / 2;

        ctx.fillStyle = currentStyle.fillColor || currentStyle.color;
        ctx.globalAlpha = currentStyle.fillOpacity || 0.1;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX / 2, radiusY / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX / 2, radiusY / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // ========== PARALLEL CHANNEL (needs 3 points) ==========
      else if (activeTool === "parallel_channel" && points.length >= 1) {
        if (points.length === 1) {
          // First line being drawn
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(previewX, previewY);
          ctx.stroke();
        } else if (points.length === 2) {
          // Draw first line
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.stroke();

          // Draw parallel line through preview point
          const dx = points[1].x - points[0].x;
          const dy = points[1].y - points[0].y;
          ctx.beginPath();
          ctx.moveTo(previewX, previewY);
          ctx.lineTo(previewX + dx, previewY + dy);
          ctx.stroke();

          // Fill channel
          ctx.fillStyle = currentStyle.fillColor || currentStyle.color;
          ctx.globalAlpha = 0.1;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.lineTo(previewX + dx, previewY + dy);
          ctx.lineTo(previewX, previewY);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      // ========== PITCHFORK (needs 3 points) ==========
      else if ((activeTool === "pitchfork" || activeTool === "schiff_pitchfork" || activeTool === "modified_schiff" || activeTool === "inside_pitchfork") && points.length >= 1) {
        if (points.length === 1) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(previewX, previewY);
          ctx.stroke();
        } else if (points.length === 2) {
          // Draw lines from first point to second and to preview
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(previewX, previewY);
          ctx.stroke();

          // Draw median line preview
          const midX = (points[1].x + previewX) / 2;
          const midY = (points[1].y + previewY) / 2;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(midX + (midX - points[0].x) * 2, midY + (midY - points[0].y) * 2);
          ctx.stroke();
          ctx.setLineDash([5, 5]);
        }
      }
      // ========== LONG/SHORT POSITION ==========
      else if ((activeTool === "long_position" || activeTool === "short_position") && points.length >= 1) {
        const isLong = activeTool === "long_position";
        const entryY = points[0].y;
        const targetY = previewY;

        const minY = Math.min(entryY, targetY);
        const maxY = Math.max(entryY, targetY);
        const width = Math.max(100, Math.abs(previewX - points[0].x));
        const x = Math.min(points[0].x, previewX);

        // Profit zone
        ctx.fillStyle = isLong ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)";
        ctx.fillRect(x, minY, width, maxY - minY);

        // Entry line
        ctx.strokeStyle = "#ffffff";
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x, entryY);
        ctx.lineTo(x + width, entryY);
        ctx.stroke();

        // Target line
        ctx.strokeStyle = isLong ? "#22c55e" : "#ef4444";
        ctx.beginPath();
        ctx.moveTo(x, targetY);
        ctx.lineTo(x + width, targetY);
        ctx.stroke();

        // Info
        const priceDiff = Math.abs(previewPoint.price - pendingPoints[0].price);
        const percentage = (priceDiff / pendingPoints[0].price) * 100;
        ctx.fillStyle = "#ffffff";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${isLong ? "Long" : "Short"}: ${percentage.toFixed(2)}%`, x + 5, (minY + maxY) / 2);

        ctx.setLineDash([5, 5]);
      }
      // ========== DEFAULT: Simple line ==========
      else if (points.length >= 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(previewX, previewY);
        ctx.stroke();

        // Point markers for multi-point tools
        ctx.fillStyle = currentStyle.color;
        for (const p of points) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.setLineDash([]);
    }

    // Draw axis hover highlight
    if (hoverAxis === "y" || isDraggingYAxis) {
      ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
      ctx.fillRect(chartArea.right, chartArea.top, PADDING_RIGHT, chartArea.height);

      // Draw resize indicator
      ctx.fillStyle = "#3b82f6";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⇕ Drag to scale", chartArea.right + PADDING_RIGHT / 2, chartArea.top + chartArea.height / 2);
    }

    if (hoverAxis === "x" || isDraggingXAxis) {
      ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
      ctx.fillRect(chartArea.left, chartArea.bottom, chartArea.width, PADDING_BOTTOM);

      // Draw resize indicator
      ctx.fillStyle = "#3b82f6";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⇔ Drag to scale", chartArea.left + chartArea.width / 2, chartArea.bottom + PADDING_BOTTOM / 2 + 3);
    }

    // Draw auto price scale indicator
    if (!autoPriceScale) {
      ctx.fillStyle = "#f59e0b";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Manual", chartArea.right + PADDING_RIGHT / 2, chartArea.top + 10);
    }

    // Draw crosshair
    if (mousePos && !isDragging && !isDraggingDrawing) {
      ctx.strokeStyle = COLORS.crosshair;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      ctx.beginPath();
      ctx.moveTo(mousePos.x, chartArea.top);
      ctx.lineTo(mousePos.x, chartArea.bottom);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(chartArea.left, mousePos.y);
      ctx.lineTo(chartArea.right, mousePos.y);
      ctx.stroke();

      ctx.setLineDash([]);

      // Price label
      ctx.fillStyle = "#334155";
      ctx.fillRect(chartArea.right, mousePos.y - 10, PADDING_RIGHT - 5, 20);
      ctx.fillStyle = COLORS.crosshairText;
      ctx.font = "11px monospace";
      ctx.textAlign = "left";

      // Show magnet indicator
      const displayPrice = mousePos.price;
      const magnetIndicator = mousePos.price !== mousePos.rawPrice ? " ⊙" : "";
      ctx.fillText(formatPrice(displayPrice) + magnetIndicator, chartArea.right + 5, mousePos.y + 4);

      // Time label
      const timeText = formatFullTime(mousePos.time);
      const textWidth = ctx.measureText(timeText).width;
      ctx.fillStyle = "#334155";
      ctx.fillRect(mousePos.x - textWidth / 2 - 5, chartArea.bottom + 2, textWidth + 10, 20);
      ctx.fillStyle = COLORS.crosshairText;
      ctx.textAlign = "center";
      ctx.font = "11px sans-serif";
      ctx.fillText(timeText, mousePos.x, chartArea.bottom + 16);
    }

  }, [dimensions, klines, viewport, mousePos, isDragging, isDraggingDrawing, chartArea, priceToY, indexToX, visibleDrawings, pendingPoints, activeTool, currentStyle, timeToX, interval, selectedDrawingId, applyShiftConstraint, hoverAxis, isDraggingYAxis, isDraggingXAxis, autoPriceScale, vwapData, smaData, anchoredVwapData, selectingAnchor]);

  const renderSingleDrawing = useCallback((ctx: CanvasRenderingContext2D, drawing: Drawing, isSelected: boolean) => {
    const style = drawing.style;
    // Always use original color, don't change to yellow when selected
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;

    if (style.lineStyle === "dashed") {
      ctx.setLineDash([8, 4]);
    } else if (style.lineStyle === "dotted") {
      ctx.setLineDash([2, 2]);
    } else {
      ctx.setLineDash([]);
    }

    const points = drawing.points.map(p => ({
      x: timeToX(p.time),
      y: priceToY(p.price),
    }));

    ctx.font = "11px monospace";

    switch (drawing.drawing_type) {
      case "horizontal":
        if (points.length >= 1) {
          const y = points[0].y;
          ctx.beginPath();
          ctx.moveTo(chartArea.left, y);
          ctx.lineTo(chartArea.right, y);
          ctx.stroke();

          ctx.fillStyle = style.color;
          ctx.textAlign = "left";
          ctx.fillText(formatPrice(drawing.points[0].price), chartArea.right + 5, y + 4);
        }
        break;

      case "vertical":
        if (points.length >= 1) {
          const x = points[0].x;
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
        }
        break;

      case "trendline":
      case "arrow":
        if (points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.stroke();

          if (drawing.drawing_type === "arrow") {
            const angle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
            const headLen = 12;
            ctx.beginPath();
            ctx.moveTo(points[1].x, points[1].y);
            ctx.lineTo(
              points[1].x - headLen * Math.cos(angle - Math.PI / 6),
              points[1].y - headLen * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(points[1].x, points[1].y);
            ctx.lineTo(
              points[1].x - headLen * Math.cos(angle + Math.PI / 6),
              points[1].y - headLen * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
          }
        }
        break;

      case "ray":
        if (points.length >= 2) {
          const dx = points[1].x - points[0].x;
          const dy = points[1].y - points[0].y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            const extendLen = dimensions.width * 2;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(
              points[0].x + (dx / len) * extendLen,
              points[0].y + (dy / len) * extendLen
            );
            ctx.stroke();
          }
        }
        break;

      case "extended":
        if (points.length >= 2) {
          const dx = points[1].x - points[0].x;
          const dy = points[1].y - points[0].y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            const extendLen = dimensions.width * 2;
            ctx.beginPath();
            ctx.moveTo(
              points[0].x - (dx / len) * extendLen,
              points[0].y - (dy / len) * extendLen
            );
            ctx.lineTo(
              points[0].x + (dx / len) * extendLen,
              points[0].y + (dy / len) * extendLen
            );
            ctx.stroke();
          }
        }
        break;

      case "rectangle":
        if (points.length >= 2) {
          const x = Math.min(points[0].x, points[1].x);
          const y = Math.min(points[0].y, points[1].y);
          const w = Math.abs(points[1].x - points[0].x);
          const h = Math.abs(points[1].y - points[0].y);

          ctx.fillStyle = (style.color) + "20";
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
        }
        break;

      case "fib_retracement":
        if (points.length >= 2) {
          // Use custom levels/colors from style or defaults
          const DEFAULT_FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          const DEFAULT_FIB_COLORS = ["#787B86", "#F23645", "#FF9800", "#4CAF50", "#089981", "#00BCD4", "#787B86"];

          const fibLevels = style.fibLevels || DEFAULT_FIB_LEVELS;
          const fibColors = style.fibColors || DEFAULT_FIB_COLORS;
          const labelsLeft = style.fibLabelsLeft || false;
          const showPrice = style.showPrice !== false;
          const extendLeft = style.extendLeft || false;
          const extendRight = style.extendRight || false;

          const startPrice = drawing.points[0].price;
          const endPrice = drawing.points[1].price;
          const diff = endPrice - startPrice;

          // Calculate x boundaries based on extend settings
          const startX = drawing.points[0].time;
          const endX = drawing.points[1].time;
          const leftX = extendLeft ? chartArea.left : Math.min(timeToX(startX), timeToX(endX));
          const rightX = extendRight ? chartArea.right : Math.max(timeToX(startX), timeToX(endX));

          // Draw semi-transparent background between 0 and 1 levels
          const y0 = priceToY(startPrice);
          const y1 = priceToY(endPrice);
          ctx.fillStyle = (style.color) + "10";
          ctx.fillRect(leftX, Math.min(y0, y1), rightX - leftX, Math.abs(y1 - y0));

          fibLevels.forEach((level, i) => {
            const price = startPrice + diff * level;
            const y = priceToY(price);
            const color = fibColors[i] || DEFAULT_FIB_COLORS[i % DEFAULT_FIB_COLORS.length];

            // Draw horizontal line
            ctx.strokeStyle = color;
            ctx.lineWidth = (level === 0 || level === 1) ? 1.5 : 1;
            ctx.setLineDash(level === 0.5 ? [5, 5] : []);
            ctx.beginPath();
            ctx.moveTo(leftX, y);
            ctx.lineTo(rightX, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineWidth = style.lineWidth;

            // Draw label
            ctx.fillStyle = color;
            ctx.font = "11px sans-serif";

            if (labelsLeft) {
              ctx.textAlign = "right";
              const labelText = showPrice ? `${level} (${formatPrice(price)})` : `${level}`;
              ctx.fillText(labelText, leftX - 5, y + 4);
            } else {
              ctx.textAlign = "left";
              const labelText = showPrice ? `${level} (${formatPrice(price)})` : `${level}`;
              ctx.fillText(labelText, rightX + 5, y + 4);
            }
          });
        }
        break;

      // Fibonacci Extension (3 points)
      case "fib_extension":
        if (points.length >= 3) {
          const EXT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2];
          const EXT_COLORS = ["#787B86", "#F23645", "#FF9800", "#4CAF50", "#089981", "#00BCD4", "#787B86", "#2962FF", "#9C27B0", "#E91E63", "#673AB7"];

          // Point A (start), B (end), C (extension base)
          const aPrice = drawing.points[0].price;
          const bPrice = drawing.points[1].price;
          const cPrice = drawing.points[2].price;
          const diff = bPrice - aPrice;

          // Draw trend lines A->B and B->C
          ctx.strokeStyle = style.color;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.lineTo(points[2].x, points[2].y);
          ctx.stroke();

          // Draw extension levels from point C
          const rightX = chartArea.right;

          EXT_LEVELS.forEach((level, i) => {
            const price = cPrice + diff * level;
            const y = priceToY(price);
            const color = EXT_COLORS[i] || "#787B86";

            ctx.strokeStyle = color;
            ctx.lineWidth = level === 0 || level === 1 ? 1.5 : 1;
            ctx.setLineDash(level === 0.5 ? [5, 5] : []);
            ctx.beginPath();
            ctx.moveTo(points[2].x, y);
            ctx.lineTo(rightX, y);
            ctx.stroke();

            // Label
            ctx.fillStyle = color;
            ctx.textAlign = "left";
            ctx.font = "11px sans-serif";
            ctx.fillText(`${level} (${formatPrice(price)})`, rightX + 5, y + 4);
          });

          ctx.setLineDash([]);
          ctx.lineWidth = style.lineWidth;
          ctx.strokeStyle = style.color;
        }
        break;

      // Fibonacci Time Zone
      case "fib_time_zone":
        if (points.length >= 2) {
          const TIME_LEVELS = [0, 1, 2, 3, 5, 8, 13, 21, 34];
          const startTime = drawing.points[0].time;
          const endTime = drawing.points[1].time;
          const timeDiff = endTime - startTime;

          TIME_LEVELS.forEach((level, i) => {
            const time = startTime + timeDiff * level;
            const x = timeToX(time);

            if (x >= chartArea.left && x <= chartArea.right) {
              ctx.strokeStyle = i === 0 || i === 1 ? style.color : `${style.color}80`;
              ctx.beginPath();
              ctx.moveTo(x, chartArea.top);
              ctx.lineTo(x, chartArea.bottom);
              ctx.stroke();

              ctx.fillStyle = style.color;
              ctx.textAlign = "center";
              ctx.fillText(`${level}`, x, chartArea.bottom + 12);
            }
          });
        }
        break;

      // Horizontal Ray - extends only to the right
      case "horizontal_ray":
        if (points.length >= 1) {
          const y = points[0].y;
          const x = points[0].x;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(chartArea.right, y);
          ctx.stroke();

          ctx.fillStyle = style.color;
          ctx.textAlign = "left";
          ctx.fillText(formatPrice(drawing.points[0].price), chartArea.right + 5, y + 4);
        }
        break;

      // Info Line - shows price diff, percentage, bars
      case "info_line":
        if (points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.stroke();

          const priceDiff = drawing.points[1].price - drawing.points[0].price;
          const pct = (priceDiff / drawing.points[0].price) * 100;
          const timeDiff = Math.abs(drawing.points[1].time - drawing.points[0].time);
          const bars = Math.round(timeDiff / getIntervalMs(interval));

          const midX = (points[0].x + points[1].x) / 2;
          const midY = (points[0].y + points[1].y) / 2;

          ctx.fillStyle = "#1e293b";
          ctx.fillRect(midX - 60, midY - 25, 120, 50);
          ctx.strokeRect(midX - 60, midY - 25, 120, 50);

          ctx.fillStyle = style.color;
          ctx.textAlign = "center";
          ctx.fillText(`${priceDiff >= 0 ? "+" : ""}${formatPrice(priceDiff)}`, midX, midY - 10);
          ctx.fillText(`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`, midX, midY + 5);
          ctx.fillText(`${bars} bars`, midX, midY + 20);
        }
        break;

      // Trend Angle - shows angle
      case "trend_angle":
        if (points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.stroke();

          // Calculate angle
          const dx = points[1].x - points[0].x;
          const dy = points[1].y - points[0].y;
          const angle = Math.atan2(-dy, dx) * (180 / Math.PI);

          // Draw angle arc
          ctx.beginPath();
          ctx.arc(points[0].x, points[0].y, 30, 0, -angle * Math.PI / 180, angle > 0);
          ctx.stroke();

          // Show angle text
          ctx.fillStyle = style.color;
          ctx.textAlign = "left";
          ctx.fillText(`${angle.toFixed(1)}°`, points[0].x + 35, points[0].y - 5);
        }
        break;

      // Cross Line - horizontal + vertical at a point
      case "cross_line":
        if (points.length >= 1) {
          ctx.beginPath();
          ctx.moveTo(chartArea.left, points[0].y);
          ctx.lineTo(chartArea.right, points[0].y);
          ctx.moveTo(points[0].x, chartArea.top);
          ctx.lineTo(points[0].x, chartArea.bottom);
          ctx.stroke();

          ctx.fillStyle = style.color;
          ctx.textAlign = "left";
          ctx.fillText(formatPrice(drawing.points[0].price), chartArea.right + 5, points[0].y + 4);
        }
        break;

      // Parallel Channel
      case "parallel_channel":
        if (points.length >= 3) {
          // Main line
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.stroke();

          // Parallel line offset
          const offsetY = points[2].y - points[0].y;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y + offsetY);
          ctx.lineTo(points[1].x, points[1].y + offsetY);
          ctx.stroke();

          // Fill channel
          ctx.fillStyle = (style.color) + "15";
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.lineTo(points[1].x, points[1].y + offsetY);
          ctx.lineTo(points[0].x, points[0].y + offsetY);
          ctx.closePath();
          ctx.fill();
        }
        break;

      // Pitchfork
      case "pitchfork":
      case "schiff_pitchfork":
      case "modified_schiff":
      case "inside_pitchfork":
        if (points.length >= 3) {
          // Determine median start based on variant
          let medianStartX = points[0].x;
          let medianStartY = points[0].y;

          if (drawing.drawing_type === "schiff_pitchfork") {
            medianStartY = (points[0].y + points[1].y) / 2;
          } else if (drawing.drawing_type === "modified_schiff") {
            medianStartX = (points[0].x + points[1].x) / 2;
            medianStartY = (points[0].y + points[1].y) / 2;
          } else if (drawing.drawing_type === "inside_pitchfork") {
            medianStartX = points[0].x + (points[1].x - points[0].x) * 0.5;
            medianStartY = points[0].y + (points[1].y - points[0].y) * 0.5;
          }

          // Median line end (midpoint of points 2 and 3)
          const medianEndX = (points[1].x + points[2].x) / 2;
          const medianEndY = (points[1].y + points[2].y) / 2;

          // Draw median line
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(medianStartX, medianStartY);
          ctx.lineTo(medianEndX, medianEndY);
          ctx.stroke();

          // Extend median line
          const mdx = medianEndX - medianStartX;
          const mdy = medianEndY - medianStartY;
          const mlen = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mlen > 0) {
            ctx.beginPath();
            ctx.moveTo(medianEndX, medianEndY);
            ctx.lineTo(medianEndX + (mdx / mlen) * 1000, medianEndY + (mdy / mlen) * 1000);
            ctx.stroke();
          }

          // Draw upper parallel
          ctx.strokeStyle = "#22c55e";
          const upperOffsetX = points[1].x - medianEndX;
          const upperOffsetY = points[1].y - medianEndY;
          ctx.beginPath();
          ctx.moveTo(medianStartX + upperOffsetX, medianStartY + upperOffsetY);
          ctx.lineTo(medianEndX + upperOffsetX + (mdx / mlen) * 1000, medianEndY + upperOffsetY + (mdy / mlen) * 1000);
          ctx.stroke();

          // Draw lower parallel
          ctx.strokeStyle = "#ef4444";
          const lowerOffsetX = points[2].x - medianEndX;
          const lowerOffsetY = points[2].y - medianEndY;
          ctx.beginPath();
          ctx.moveTo(medianStartX + lowerOffsetX, medianStartY + lowerOffsetY);
          ctx.lineTo(medianEndX + lowerOffsetX + (mdx / mlen) * 1000, medianEndY + lowerOffsetY + (mdy / mlen) * 1000);
          ctx.stroke();

          ctx.strokeStyle = style.color;
        }
        break;

      // Circle
      case "circle":
        if (points.length >= 2) {
          const cx = (points[0].x + points[1].x) / 2;
          const cy = (points[0].y + points[1].y) / 2;
          const radius = Math.sqrt(
            Math.pow(points[1].x - points[0].x, 2) + Math.pow(points[1].y - points[0].y, 2)
          ) / 2;

          ctx.fillStyle = (style.color) + "20";
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        break;

      // Ellipse
      case "ellipse":
        if (points.length >= 2) {
          const cx = (points[0].x + points[1].x) / 2;
          const cy = (points[0].y + points[1].y) / 2;
          const rx = Math.abs(points[1].x - points[0].x) / 2;
          const ry = Math.abs(points[1].y - points[0].y) / 2;

          ctx.fillStyle = (style.color) + "20";
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        break;

      // Triangle shape
      case "triangle":
        if (points.length >= 3) {
          ctx.fillStyle = (style.color) + "20";
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.lineTo(points[2].x, points[2].y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        break;

      // Long Position
      case "long_position":
        if (points.length >= 2) {
          const entryY = points[0].y;
          const targetY = points[1].y;
          const entry = drawing.points[0].price;
          const target = drawing.points[1].price;

          // Determine if profit or loss
          const isProfit = target > entry;
          const stopY = entryY + (entryY - targetY); // Mirror for stop loss
          const stop = entry - (target - entry);

          // Draw entry line
          ctx.strokeStyle = "#3b82f6";
          ctx.beginPath();
          ctx.moveTo(chartArea.left, entryY);
          ctx.lineTo(chartArea.right, entryY);
          ctx.stroke();

          // Draw take profit zone
          ctx.fillStyle = isProfit ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)";
          ctx.fillRect(points[0].x, Math.min(entryY, targetY), chartArea.right - points[0].x, Math.abs(targetY - entryY));
          ctx.strokeStyle = "#22c55e";
          ctx.beginPath();
          ctx.moveTo(points[0].x, targetY);
          ctx.lineTo(chartArea.right, targetY);
          ctx.stroke();

          // Draw stop loss zone
          ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
          ctx.fillRect(points[0].x, Math.min(entryY, stopY), chartArea.right - points[0].x, Math.abs(stopY - entryY));
          ctx.strokeStyle = "#ef4444";
          ctx.beginPath();
          ctx.moveTo(points[0].x, stopY);
          ctx.lineTo(chartArea.right, stopY);
          ctx.stroke();

          // Calculate R:R
          const risk = Math.abs(entry - stop);
          const reward = Math.abs(target - entry);
          const rr = risk > 0 ? (reward / risk).toFixed(2) : "0";

          // Labels
          ctx.fillStyle = "#22c55e";
          ctx.textAlign = "right";
          ctx.fillText(`TP: ${formatPrice(target)} (+${((target - entry) / entry * 100).toFixed(2)}%)`, chartArea.right - 5, targetY - 5);

          ctx.fillStyle = "#ef4444";
          ctx.fillText(`SL: ${formatPrice(stop)} (-${((entry - stop) / entry * 100).toFixed(2)}%)`, chartArea.right - 5, stopY + 15);

          ctx.fillStyle = "#3b82f6";
          ctx.fillText(`Entry: ${formatPrice(entry)}`, chartArea.right - 5, entryY - 5);
          ctx.fillText(`R:R = 1:${rr}`, chartArea.right - 5, entryY + 15);
        }
        break;

      // Short Position
      case "short_position":
        if (points.length >= 2) {
          const entryY = points[0].y;
          const targetY = points[1].y;
          const entry = drawing.points[0].price;
          const target = drawing.points[1].price;

          const isProfit = target < entry;
          const stopY = entryY - (targetY - entryY);
          const stop = entry + (entry - target);

          // Draw entry line
          ctx.strokeStyle = "#3b82f6";
          ctx.beginPath();
          ctx.moveTo(chartArea.left, entryY);
          ctx.lineTo(chartArea.right, entryY);
          ctx.stroke();

          // Draw take profit zone
          ctx.fillStyle = isProfit ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)";
          ctx.fillRect(points[0].x, Math.min(entryY, targetY), chartArea.right - points[0].x, Math.abs(targetY - entryY));
          ctx.strokeStyle = "#22c55e";
          ctx.beginPath();
          ctx.moveTo(points[0].x, targetY);
          ctx.lineTo(chartArea.right, targetY);
          ctx.stroke();

          // Draw stop loss zone
          ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
          ctx.fillRect(points[0].x, Math.min(entryY, stopY), chartArea.right - points[0].x, Math.abs(stopY - entryY));
          ctx.strokeStyle = "#ef4444";
          ctx.beginPath();
          ctx.moveTo(points[0].x, stopY);
          ctx.lineTo(chartArea.right, stopY);
          ctx.stroke();

          // Calculate R:R
          const risk = Math.abs(stop - entry);
          const reward = Math.abs(entry - target);
          const rr = risk > 0 ? (reward / risk).toFixed(2) : "0";

          // Labels
          ctx.fillStyle = "#22c55e";
          ctx.textAlign = "right";
          ctx.fillText(`TP: ${formatPrice(target)} (+${((entry - target) / entry * 100).toFixed(2)}%)`, chartArea.right - 5, targetY + 15);

          ctx.fillStyle = "#ef4444";
          ctx.fillText(`SL: ${formatPrice(stop)} (-${((stop - entry) / entry * 100).toFixed(2)}%)`, chartArea.right - 5, stopY - 5);

          ctx.fillStyle = "#3b82f6";
          ctx.fillText(`Entry: ${formatPrice(entry)}`, chartArea.right - 5, entryY - 5);
          ctx.fillText(`R:R = 1:${rr}`, chartArea.right - 5, entryY + 15);
        }
        break;

      // Text annotation
      case "text":
      case "anchored_text":
      case "price_label":
        if (points.length >= 1) {
          const text = style.text || (drawing.drawing_type === "price_label" ? formatPrice(drawing.points[0].price) : "Text");
          const fontSize = style.fontSize || 12;

          ctx.font = `${fontSize}px sans-serif`;
          const textWidth = ctx.measureText(text).width;

          ctx.fillStyle = "#1e293b";
          ctx.fillRect(points[0].x - 5, points[0].y - fontSize - 5, textWidth + 10, fontSize + 10);

          ctx.fillStyle = style.color;
          ctx.textAlign = "left";
          ctx.fillText(text, points[0].x, points[0].y);
        }
        break;

      // Arrow Marker
      case "arrow_marker":
        if (points.length >= 1) {
          const size = 15;
          ctx.fillStyle = style.color;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[0].x - size / 2, points[0].y + size);
          ctx.lineTo(points[0].x + size / 2, points[0].y + size);
          ctx.closePath();
          ctx.fill();
        }
        break;

      // Flag Marker
      case "flag_marker":
        if (points.length >= 1) {
          ctx.fillStyle = style.color;
          // Flag pole
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[0].x, points[0].y - 25);
          ctx.stroke();
          // Flag
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y - 25);
          ctx.lineTo(points[0].x + 15, points[0].y - 20);
          ctx.lineTo(points[0].x, points[0].y - 15);
          ctx.closePath();
          ctx.fill();
        }
        break;

      // Path / Polyline / Brush (freehand)
      case "path":
      case "polyline":
      case "brush":
        if (points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
        }
        break;

      // ABCD Pattern
      case "abcd":
        if (points.length >= 4) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();

          // Labels
          const labels = ["A", "B", "C", "D"];
          ctx.fillStyle = style.color;
          points.forEach((p, i) => {
            if (i < labels.length) {
              ctx.fillText(labels[i], p.x + 5, p.y - 5);
            }
          });
        }
        break;

      // XABCD Pattern
      case "xabcd":
        if (points.length >= 5) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();

          // Labels
          const xabcdLabels = ["X", "A", "B", "C", "D"];
          ctx.fillStyle = style.color;
          points.forEach((p, i) => {
            if (i < xabcdLabels.length) {
              ctx.fillText(xabcdLabels[i], p.x + 5, p.y - 5);
            }
          });
        }
        break;

      // Head & Shoulders
      case "head_shoulders":
        if (points.length >= 7) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();

          // Neckline
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(points[1].x, points[1].y);
          ctx.lineTo(points[5].x, points[5].y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;

      // Triangle Pattern
      case "triangle_pattern":
        if (points.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.lineTo(points[2].x, points[2].y);
          ctx.closePath();
          ctx.stroke();

          ctx.fillStyle = (style.color) + "15";
          ctx.fill();
        }
        break;

      // Anchored VWAP
      case "anchored_vwap":
        if (points.length >= 1 && klines.length > 0) {
          const anchorTime = drawing.points[0].time;

          // Find klines from anchor point forward
          const anchorIdx = klines.findIndex(k => k.timestamp >= anchorTime);
          if (anchorIdx >= 0) {
            const relevantKlines = klines.slice(anchorIdx);

            if (relevantKlines.length > 0) {
              // Calculate cumulative VWAP
              let sumTPV = 0;  // Sum of (Typical Price * Volume)
              let sumVolume = 0;
              const vwapPoints: { x: number; y: number; vwap: number }[] = [];

              for (const kline of relevantKlines) {
                const typicalPrice = (kline.high + kline.low + kline.close) / 3;
                sumTPV += typicalPrice * kline.volume;
                sumVolume += kline.volume;

                if (sumVolume > 0) {
                  const vwap = sumTPV / sumVolume;
                  vwapPoints.push({
                    x: timeToX(kline.timestamp),
                    y: priceToY(vwap),
                    vwap,
                  });
                }
              }

              // Draw anchor point marker
              ctx.fillStyle = style.color;
              ctx.beginPath();
              ctx.arc(points[0].x, points[0].y, 5, 0, Math.PI * 2);
              ctx.fill();

              // Draw VWAP line
              if (vwapPoints.length > 1) {
                ctx.beginPath();
                ctx.moveTo(vwapPoints[0].x, vwapPoints[0].y);
                for (let i = 1; i < vwapPoints.length; i++) {
                  ctx.lineTo(vwapPoints[i].x, vwapPoints[i].y);
                }
                ctx.stroke();

                // Draw price tag on Y-axis (like regular VWAP)
                const lastPoint = vwapPoints[vwapPoints.length - 1];
                const tagY = lastPoint.y;
                const tagX = chartArea.right;

                // Draw background box
                ctx.fillStyle = style.color;
                ctx.fillRect(tagX + 2, tagY - 8, PADDING_RIGHT - 6, 16);

                // Draw price text
                ctx.fillStyle = "#000";
                ctx.font = "10px monospace";
                ctx.textAlign = "left";
                ctx.fillText(formatPrice(lastPoint.vwap), tagX + 5, tagY + 4);

                // Draw small "A" marker to indicate anchored
                ctx.fillStyle = "#000";
                ctx.font = "bold 8px sans-serif";
                ctx.fillText("A", tagX + PADDING_RIGHT - 14, tagY + 3);
              }
            }
          }
        }
        break;

      default:
        if (points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
        }
    }

    ctx.setLineDash([]);

    // Draw control handles if selected
    if (isSelected) {
      ctx.fillStyle = COLORS.handle;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;

      points.forEach(p => {
        ctx.beginPath();
        ctx.rect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        ctx.fill();
        ctx.stroke();
      });
    }
  }, [priceToY, timeToX, chartArea, dimensions, klines]);

  // Render on state changes
  useEffect(() => {
    render();
  }, [render]);

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const updateViewportPriceRange = useCallback((newStartIndex: number, newEndIndex: number) => {
    const visibleStartIdx = Math.max(0, Math.floor(newStartIndex));
    const visibleEndIdx = Math.min(klines.length, Math.ceil(newEndIndex));
    const visibleKlines = klines.slice(visibleStartIdx, visibleEndIdx);

    // Disable auto-scroll if user scrolled away from the right edge
    const isAtRightEdge = newEndIndex >= klines.length - 1;
    if (!isAtRightEdge) {
      setAutoScroll(false);
    }

    if (autoPriceScale && visibleKlines.length > 0) {
      // Auto scale: adjust price range to fit visible candles
      const prices = visibleKlines.flatMap(k => [k.high, k.low]);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const padding = (max - min) * 0.1;

      setViewport({
        startIndex: newStartIndex,
        endIndex: newEndIndex,
        priceMin: min - padding,
        priceMax: max + padding,
      });
    } else {
      // Manual scale: keep current price range
      setViewport(prev => ({
        ...prev,
        startIndex: newStartIndex,
        endIndex: newEndIndex,
      }));
    }
  }, [klines, autoPriceScale]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if mouse is on Y-axis (price scale) area - right side
    const isOnYAxis = x > chartArea.right && x <= dimensions.width && y >= chartArea.top && y <= chartArea.bottom;
    // Check if mouse is on X-axis (time scale) area - bottom
    const isOnXAxis = y > chartArea.bottom && y <= dimensions.height && x >= chartArea.left && x <= chartArea.right;

    // Handle Y-axis dragging (price scale)
    if (isDraggingYAxis && axisDragStart) {
      const deltaY = y - axisDragStart.y;
      const scaleFactor = 1 + (deltaY / chartArea.height) * 2; // More sensitive scaling

      const currentRange = viewport.priceMax - viewport.priceMin;
      const midPrice = (viewport.priceMax + viewport.priceMin) / 2;
      const newRange = axisDragStart.priceRange * scaleFactor;

      // Limit the range
      const minRange = currentRange * 0.1;
      const maxRange = currentRange * 10;
      const clampedRange = Math.max(minRange, Math.min(maxRange, newRange));

      setViewport(prev => ({
        ...prev,
        priceMin: midPrice - clampedRange / 2,
        priceMax: midPrice + clampedRange / 2,
      }));
      setAutoPriceScale(false);
      return;
    }

    // Handle X-axis dragging (time scale)
    if (isDraggingXAxis && axisDragStart) {
      const deltaX = x - axisDragStart.x;
      const scaleFactor = 1 - (deltaX / chartArea.width) * 2; // Drag right = zoom in

      const newVisibleCount = Math.max(MIN_CANDLES, Math.min(MAX_CANDLES, Math.round(axisDragStart.visibleCount * scaleFactor)));
      const midIndex = (viewport.startIndex + viewport.endIndex) / 2;

      const newStart = midIndex - newVisibleCount / 2;
      const newEnd = midIndex + newVisibleCount / 2;

      updateViewportPriceRange(newStart, newEnd);
      return;
    }

    // Update hover state for axes
    if (isOnYAxis) {
      setHoverAxis("y");
      canvas.style.cursor = "ns-resize";
    } else if (isOnXAxis) {
      setHoverAxis("x");
      canvas.style.cursor = "ew-resize";
    } else {
      setHoverAxis("none");
    }

    // Don't process chart area mouse position if on axes
    if (isOnYAxis || isOnXAxis) {
      if (!isDragging && !isDraggingDrawing) {
        setMousePos(null);
      }
      return;
    }

    if (x < chartArea.left || x > chartArea.right || y < chartArea.top || y > chartArea.bottom) {
      setMousePos(null);
      setHoverAxis("none");
      return;
    }

    const rawPrice = yToPrice(y);
    const index = xToIndex(x);
    const time = xToTime(x);
    const candle = index >= 0 && index < klines.length ? klines[index] : null;

    // Apply magnet
    const price = applyMagnet(rawPrice, time);

    setMousePos({ x, y: priceToY(price), price, time, candle, rawPrice });

    // Handle dragging drawing point
    if (isDraggingDrawing && selectedDrawingId && draggingPointIndex !== null) {
      setDrawings(prev => prev.map(d => {
        if (d.id !== selectedDrawingId) return d;

        const newPoints = [...d.points];
        let newPoint = { time, price };

        // Apply shift constraint
        if (draggingPointIndex > 0) {
          newPoint = applyShiftConstraint(newPoint, newPoints[0]);
        }

        newPoints[draggingPointIndex] = newPoint;
        return { ...d, points: newPoints, updated_at: Date.now() };
      }));
      return;
    }

    // Handle dragging entire drawing
    if (isDraggingDrawing && selectedDrawingId && dragDrawingStart) {
      const deltaTime = time - dragDrawingStart.time;
      const deltaPrice = price - dragDrawingStart.price;

      setDrawings(prev => prev.map(d => {
        if (d.id !== selectedDrawingId) return d;

        const newPoints = d.points.map(p => ({
          time: p.time + deltaTime,
          price: p.price + deltaPrice,
        }));

        return { ...d, points: newPoints, updated_at: Date.now() };
      }));

      setDragDrawingStart({ time, price });
      return;
    }

    // Handle pan (both X and Y axes)
    if (isDragging && dragStart) {
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;

      // X axis pan (time)
      const candleWidth = chartArea.width / (viewport.endIndex - viewport.startIndex);
      const indexDelta = -dx / candleWidth;

      const visibleCount = viewport.endIndex - viewport.startIndex;
      let newStart = dragStart.startIndex + indexDelta;
      let newEnd = newStart + visibleCount;

      // Allow panning far into the future (up to 10x visible range)
      const minStart = -visibleCount * 10;
      const maxEnd = klines.length + visibleCount * 10;

      if (newStart < minStart) {
        newStart = minStart;
        newEnd = newStart + visibleCount;
      }
      if (newEnd > maxEnd) {
        newEnd = maxEnd;
        newStart = newEnd - visibleCount;
      }

      // Y axis pan (price)
      const priceRange = dragStart.priceMax - dragStart.priceMin;
      const priceDelta = (dy / chartArea.height) * priceRange;

      const newPriceMin = dragStart.priceMin + priceDelta;
      const newPriceMax = dragStart.priceMax + priceDelta;

      // Disable auto price scale when panning
      setAutoPriceScale(false);

      setViewport({
        startIndex: newStart,
        endIndex: newEnd,
        priceMin: newPriceMin,
        priceMax: newPriceMax,
      });
    }

    // Update cursor based on hover and drag state
    if (isDragging) {
      canvas.style.cursor = "grabbing";
    } else if (!isDraggingDrawing && activeTool === "none") {
      const hoveredDrawing = findDrawingAtPoint(x, y);
      if (hoveredDrawing) {
        canvas.style.cursor = "pointer";

        if (hoveredDrawing.id === selectedDrawingId) {
          const pointIdx = findPointIndexAtPosition(hoveredDrawing, x, y);
          if (pointIdx !== null) {
            canvas.style.cursor = "move";
          }
        }
      } else {
        // Show grab cursor when hovering on empty chart area (pan ready)
        canvas.style.cursor = "grab";
      }
    } else if (activeTool !== "none" && activeTool !== "crosshair") {
      canvas.style.cursor = "crosshair";
    }
  }, [chartArea, yToPrice, xToIndex, xToTime, klines, isDragging, isDraggingDrawing, dragStart, viewport, updateViewportPriceRange, applyMagnet, priceToY, selectedDrawingId, draggingPointIndex, dragDrawingStart, activeTool, findDrawingAtPoint, findPointIndexAtPosition, applyShiftConstraint, isDraggingYAxis, isDraggingXAxis, axisDragStart, dimensions]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on Y-axis (price scale)
    const isOnYAxis = x > chartArea.right && x <= dimensions.width && y >= chartArea.top && y <= chartArea.bottom;
    if (isOnYAxis && e.button === 0) {
      setIsDraggingYAxis(true);
      setAxisDragStart({
        y,
        x,
        priceRange: viewport.priceMax - viewport.priceMin,
        visibleCount: viewport.endIndex - viewport.startIndex,
      });
      return;
    }

    // Check if clicking on X-axis (time scale)
    const isOnXAxis = y > chartArea.bottom && y <= dimensions.height && x >= chartArea.left && x <= chartArea.right;
    if (isOnXAxis && e.button === 0) {
      setIsDraggingXAxis(true);
      setAxisDragStart({
        y,
        x,
        priceRange: viewport.priceMax - viewport.priceMin,
        visibleCount: viewport.endIndex - viewport.startIndex,
      });
      return;
    }

    if (x < chartArea.left || x > chartArea.right || y < chartArea.top || y > chartArea.bottom) {
      return;
    }

    // Handle Anchored VWAP anchor point selection
    if (selectingAnchor && mousePos && onAnchoredVwapConfigChange && onSelectingAnchorChange && e.button === 0) {
      const clickedTime = mousePos.time;
      const updatedConfigs = anchoredVwapConfigs.map(config => {
        if (config.id === selectingAnchor.configId) {
          if (selectingAnchor.type === "start") {
            return { ...config, startTime: clickedTime };
          } else {
            return { ...config, endTime: clickedTime };
          }
        }
        return config;
      });
      onAnchoredVwapConfigChange(updatedConfigs);
      onSelectingAnchorChange(null);
      return;
    }

    if (e.button === 0) {
      // Check if clicking on selected drawing's control point
      if (selectedDrawingId && activeTool === "none") {
        const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);
        if (selectedDrawing) {
          const pointIdx = findPointIndexAtPosition(selectedDrawing, x, y);
          if (pointIdx !== null) {
            setIsDraggingDrawing(true);
            setDraggingPointIndex(pointIdx);
            return;
          }
        }
      }

      // Check if clicking on a drawing to select it
      if (activeTool === "none") {
        const allDrawingsAtPoint = findAllDrawingsAtPoint(x, y);

        if (allDrawingsAtPoint.length > 0) {
          // Check if we're clicking in the same spot as last time (within threshold)
          const isSameSpot = lastClickPos &&
            Math.abs(x - lastClickPos.x) < SELECTION_THRESHOLD &&
            Math.abs(y - lastClickPos.y) < SELECTION_THRESHOLD;

          if (isSameSpot && allDrawingsAtPoint.length > 1) {
            // Cycling through overlapping drawings
            const currentIds = allDrawingsAtPoint.map(d => d.id);
            const currentSelectedIndex = currentIds.indexOf(selectedDrawingId || "");

            if (currentSelectedIndex >= 0) {
              // If current selection is in the overlapping list, go to next
              const nextIndex = (currentSelectedIndex + 1) % allDrawingsAtPoint.length;
              setSelectedDrawingId(allDrawingsAtPoint[nextIndex].id);
              setOverlappingDrawings(currentIds);
              setOverlappingIndex(nextIndex);
            } else {
              // Start from first drawing
              setSelectedDrawingId(allDrawingsAtPoint[0].id);
              setOverlappingDrawings(currentIds);
              setOverlappingIndex(0);
            }
          } else {
            // New click position or single drawing
            const clickedDrawing = allDrawingsAtPoint[0];

            if (clickedDrawing.id === selectedDrawingId) {
              // Start dragging the drawing
              setIsDraggingDrawing(true);
              setDraggingPointIndex(null);
              setDragDrawingStart({ time: mousePos?.time || 0, price: mousePos?.price || 0 });
            } else {
              // Select the first drawing
              setSelectedDrawingId(clickedDrawing.id);
              setOverlappingDrawings(allDrawingsAtPoint.map(d => d.id));
              setOverlappingIndex(0);
            }
          }

          setLastClickPos({ x, y });
          return;
        } else {
          setSelectedDrawingId(null);
          setOverlappingDrawings([]);
          setOverlappingIndex(0);
          setLastClickPos(null);
        }
      }

      // Drawing mode
      if (activeTool !== "none" && activeTool !== "crosshair") {
        if (mousePos) {
          handleDrawingClick(mousePos);
        }
      } else {
        // Pan mode - store both X/Y position and viewport state
        setIsDragging(true);
        setDragStart({
          x,
          y,
          startIndex: viewport.startIndex,
          priceMin: viewport.priceMin,
          priceMax: viewport.priceMax,
        });
      }
    }
  }, [activeTool, mousePos, viewport, chartArea, selectedDrawingId, drawings, findAllDrawingsAtPoint, findPointIndexAtPosition, dimensions, selectingAnchor, anchoredVwapConfigs, onAnchoredVwapConfigChange, onSelectingAnchorChange, lastClickPos]);

  const handleMouseUp = useCallback(() => {
    // Save drawing if it was being dragged
    if (isDraggingDrawing && selectedDrawingId) {
      const drawing = drawings.find(d => d.id === selectedDrawingId);
      if (drawing) {
        saveDrawingToDb(drawing);
      }
    }

    setIsDragging(false);
    setDragStart(null);
    setIsDraggingDrawing(false);
    setDraggingPointIndex(null);
    setDragDrawingStart(null);
    setIsDraggingYAxis(false);
    setIsDraggingXAxis(false);
    setAxisDragStart(null);
  }, [isDraggingDrawing, selectedDrawingId, drawings]);

  const handleMouseLeave = useCallback(() => {
    setMousePos(null);
    setIsDragging(false);
    setDragStart(null);
    setIsDraggingDrawing(false);
    setDraggingPointIndex(null);
    setDragDrawingStart(null);
    setIsDraggingYAxis(false);
    setIsDraggingXAxis(false);
    setAxisDragStart(null);
    setHoverAxis("none");
  }, []);

  // Use ref for wheel handler to use with native event listener
  const wheelHandler = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Smooth zoom like TradingView (3% per tick instead of 10%)
    const zoomFactor = e.deltaY > 0 ? 1.03 : 0.97;
    const { startIndex, endIndex } = viewport;
    const visibleCount = endIndex - startIndex;

    const newVisibleCount = Math.max(MIN_CANDLES, Math.min(MAX_CANDLES, Math.round(visibleCount * zoomFactor)));

    const mouseIndex = mousePos ? xToIndex(mousePos.x) : (startIndex + endIndex) / 2;
    const ratio = visibleCount > 0 ? (mouseIndex - startIndex) / visibleCount : 0.5;

    const newStart = mouseIndex - newVisibleCount * ratio;
    const newEnd = newStart + newVisibleCount;

    updateViewportPriceRange(newStart, newEnd);
  }, [viewport, mousePos, xToIndex, updateViewportPriceRange]);

  // Native wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', wheelHandler, { passive: false });
    return () => canvas.removeEventListener('wheel', wheelHandler);
  }, [wheelHandler]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || klines.length === 0) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if double-clicking on Y-axis - reset to auto price scale
    const isOnYAxis = x > chartArea.right && x <= dimensions.width && y >= chartArea.top && y <= chartArea.bottom;
    if (isOnYAxis) {
      setAutoPriceScale(true);
      // Recalculate price range
      const visibleStartIdx = Math.max(0, Math.floor(viewport.startIndex));
      const visibleEndIdx = Math.min(klines.length, Math.ceil(viewport.endIndex));
      const visibleKlines = klines.slice(visibleStartIdx, visibleEndIdx);

      if (visibleKlines.length > 0) {
        const prices = visibleKlines.flatMap(k => [k.high, k.low]);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const padding = (max - min) * 0.1;

        setViewport(prev => ({
          ...prev,
          priceMin: min - padding,
          priceMax: max + padding,
        }));
      }
      return;
    }

    // Check if double-clicking on X-axis - reset to fit all data
    const isOnXAxis = y > chartArea.bottom && y <= dimensions.height && x >= chartArea.left && x <= chartArea.right;
    if (isOnXAxis) {
      const endIdx = klines.length;
      const startIdx = Math.max(0, endIdx - 100);
      updateViewportPriceRange(startIdx, endIdx);
      return;
    }

    // Check if double-clicking on a drawing - open settings panel
    const clickedDrawing = findDrawingAtPoint(x, y);
    if (clickedDrawing) {
      setSelectedDrawingId(clickedDrawing.id);
      setShowSettingsPanel(true);
      return;
    }

    // Double-click in chart area - reset to default view
    const endIdx = klines.length;
    const startIdx = Math.max(0, endIdx - 100);
    updateViewportPriceRange(startIdx, endIdx);
  }, [klines, updateViewportPriceRange, chartArea, dimensions, viewport, findDrawingAtPoint]);

  // ============================================
  // DRAWING HANDLERS
  // ============================================

  const deleteDrawing = useCallback(async (id: string) => {
    try {
      await invoke("delete_drawing", { id });
      setDrawings(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      console.error("Failed to delete drawing:", e);
    }
  }, []);

  const updateDrawing = useCallback((id: string, updates: Partial<Drawing>) => {
    setDrawings(prev => prev.map(d => {
      if (d.id !== id) return d;
      const updated = { ...d, ...updates, updated_at: Date.now() };
      // If style is being updated, merge it properly
      if (updates.style) {
        updated.style = { ...d.style, ...updates.style };
      }
      return updated;
    }));
  }, []);

  const handleDrawingClick = useCallback((pos: MousePosition) => {
    if (activeTool === "none" || activeTool === "crosshair") return;

    if (activeTool === "eraser") {
      let closestDrawingId: string | null = null;
      let minDistance = Infinity;

      // Only erase visible drawings in current timeframe
      visibleDrawings.forEach(d => {
        if (d.locked) return;
        d.points.forEach(p => {
          const distance = Math.abs(p.price - pos.price);
          if (distance < minDistance) {
            minDistance = distance;
            closestDrawingId = d.id;
          }
        });
      });

      const priceRange = viewport.priceMax - viewport.priceMin;
      if (closestDrawingId && minDistance < priceRange * 0.1) {
        deleteDrawing(closestDrawingId);
      }
      return;
    }

    let point = { time: pos.time, price: pos.price };

    // Apply shift constraint
    if (pendingPoints.length > 0) {
      point = applyShiftConstraint(point, pendingPoints[0]);
    }

    const newPoints = [...pendingPoints, point];
    const requiredPoints = getRequiredPoints(activeTool);

    if (newPoints.length >= requiredPoints) {
      const drawingId = `drawing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const drawing: Drawing = {
        id: drawingId,
        symbol,
        interval,
        drawing_type: activeTool,
        points: newPoints,
        style: currentStyle,
        visible: true,
        locked: false,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      setDrawings(prev => [...prev, drawing]);
      saveDrawingToDb(drawing);
      setPendingPoints([]);

      // Always reset tool and select the new drawing
      setActiveTool("none");
      setSelectedDrawingId(drawingId);
    } else {
      setPendingPoints(newPoints);
    }
  }, [activeTool, pendingPoints, currentStyle, symbol, interval, visibleDrawings, viewport, deleteDrawing, applyShiftConstraint]);

  const saveDrawingToDb = useCallback(async (drawing: Drawing) => {
    try {
      await invoke("save_drawing", {
        request: {
          id: drawing.id,
          symbol: drawing.symbol,
          interval: drawing.interval,
          drawing_type: drawing.drawing_type,
          points: JSON.stringify(drawing.points),
          style: JSON.stringify(drawing.style),
          visible: drawing.visible,
          locked: drawing.locked,
        },
      });
    } catch (e) {
      console.error("Failed to save drawing:", e);
    }
  }, []);

  const clearAllDrawings = useCallback(async () => {
    try {
      await invoke("clear_drawings", { symbol, interval });
      setDrawings([]);
      setSelectedDrawingId(null);
    } catch (e) {
      console.error("Failed to clear drawings:", e);
    }
  }, [symbol, interval]);

  // ============================================
  // UNDO/REDO/COPY/PASTE
  // ============================================

  // Save to history when drawings change
  const pushToHistory = useCallback((newDrawings: Drawing[]) => {
    setHistory(prev => {
      // Remove any redo history after current index
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newDrawings)));
      // Keep max 50 history states
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;

    const prevState = history[historyIndex - 1];
    if (prevState) {
      setDrawings(prevState);
      setHistoryIndex(prev => prev - 1);
      // Sync with database
      prevState.forEach(d => saveDrawingToDb(d));
    }
  }, [history, historyIndex, saveDrawingToDb]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    const nextState = history[historyIndex + 1];
    if (nextState) {
      setDrawings(nextState);
      setHistoryIndex(prev => prev + 1);
      // Sync with database
      nextState.forEach(d => saveDrawingToDb(d));
    }
  }, [history, historyIndex, saveDrawingToDb]);

  const copyDrawing = useCallback(() => {
    if (!selectedDrawingId) return;
    const drawing = drawings.find(d => d.id === selectedDrawingId);
    if (drawing) {
      setClipboard(JSON.parse(JSON.stringify(drawing)));
    }
  }, [selectedDrawingId, drawings]);

  const pasteDrawing = useCallback(() => {
    if (!clipboard) return;

    const pasted: Drawing = {
      ...clipboard,
      id: `drawing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      interval,
      // Offset pasted drawing slightly
      points: clipboard.points.map(p => ({
        ...p,
        price: p.price * 1.005,
        time: p.time + 60000, // 1 minute offset
      })),
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const newDrawings = [...drawings, pasted];
    setDrawings(newDrawings);
    pushToHistory(newDrawings);
    saveDrawingToDb(pasted);
    setSelectedDrawingId(pasted.id);
  }, [clipboard, symbol, interval, drawings, pushToHistory, saveDrawingToDb]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      // Undo: Ctrl+Z / Cmd+Z
      if (ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z / Cmd+Shift+Z
      if (ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // Copy: Ctrl+C / Cmd+C
      if (ctrlKey && e.key === 'c') {
        if (selectedDrawingId) {
          e.preventDefault();
          copyDrawing();
        }
        return;
      }

      // Paste: Ctrl+V / Cmd+V
      if (ctrlKey && e.key === 'v') {
        if (clipboard) {
          e.preventDefault();
          pasteDrawing();
        }
        return;
      }

      // Delete selected drawing
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId) {
        e.preventDefault();
        const newDrawings = drawings.filter(d => d.id !== selectedDrawingId);
        deleteDrawing(selectedDrawingId);
        pushToHistory(newDrawings);
        setSelectedDrawingId(null);
        return;
      }

      // Escape: cancel current drawing or deselect
      if (e.key === 'Escape') {
        if (pendingPoints.length > 0) {
          setPendingPoints([]);
        } else if (activeTool !== 'none') {
          setActiveTool('none');
        } else if (selectedDrawingId) {
          setSelectedDrawingId(null);
        }
        setShowSettingsPanel(false);
        setContextMenu(null);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, copyDrawing, pasteDrawing, selectedDrawingId, clipboard, drawings, deleteDrawing, pushToHistory, pendingPoints, activeTool]);

  // ============================================
  // SETTINGS PANEL HANDLERS
  // ============================================

  const handleUpdateDrawing = useCallback((updates: Partial<Drawing>) => {
    if (!selectedDrawingId) return;

    setDrawings(prev => prev.map(d => {
      if (d.id !== selectedDrawingId) return d;
      const updated = { ...d, ...updates, updated_at: Date.now() };
      saveDrawingToDb(updated);
      return updated;
    }));
  }, [selectedDrawingId, saveDrawingToDb]);

  const handleUpdateStyle = useCallback((updates: Partial<DrawingStyle>) => {
    if (!selectedDrawingId) return;

    setDrawings(prev => prev.map(d => {
      if (d.id !== selectedDrawingId) return d;
      const updated = { ...d, style: { ...d.style, ...updates }, updated_at: Date.now() };
      saveDrawingToDb(updated);
      return updated;
    }));
  }, [selectedDrawingId, saveDrawingToDb]);

  const handleUpdatePoint = useCallback((index: number, point: DrawingPoint) => {
    if (!selectedDrawingId) return;

    setDrawings(prev => prev.map(d => {
      if (d.id !== selectedDrawingId) return d;
      const newPoints = [...d.points];
      newPoints[index] = point;
      const updated = { ...d, points: newPoints, updated_at: Date.now() };
      saveDrawingToDb(updated);
      return updated;
    }));
  }, [selectedDrawingId, saveDrawingToDb]);

  const handleCloneDrawing = useCallback(() => {
    if (!selectedDrawingId) return;

    const original = drawings.find(d => d.id === selectedDrawingId);
    if (!original) return;

    const cloned: Drawing = {
      ...original,
      id: `drawing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: original.name ? `${original.name} (copy)` : undefined,
      // Offset the cloned drawing slightly
      points: original.points.map(p => ({
        ...p,
        price: p.price * 1.01, // 1% offset
      })),
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    setDrawings(prev => [...prev, cloned]);
    saveDrawingToDb(cloned);
    setSelectedDrawingId(cloned.id);
    setShowSettingsPanel(false);
  }, [selectedDrawingId, drawings, saveDrawingToDb]);

  const handleBringToFront = useCallback(() => {
    if (!selectedDrawingId) return;

    setDrawings(prev => {
      const drawing = prev.find(d => d.id === selectedDrawingId);
      if (!drawing) return prev;
      return [...prev.filter(d => d.id !== selectedDrawingId), drawing];
    });
  }, [selectedDrawingId]);

  const handleSendToBack = useCallback(() => {
    if (!selectedDrawingId) return;

    setDrawings(prev => {
      const drawing = prev.find(d => d.id === selectedDrawingId);
      if (!drawing) return prev;
      return [drawing, ...prev.filter(d => d.id !== selectedDrawingId)];
    });
  }, [selectedDrawingId]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if right-clicking on a drawing
    const clickedDrawing = findDrawingAtPoint(x, y);
    if (clickedDrawing) {
      setSelectedDrawingId(clickedDrawing.id);
      setContextMenu({ x: e.clientX, y: e.clientY, drawingId: clickedDrawing.id });
    } else {
      setContextMenu(null);
    }
  }, [findDrawingAtPoint]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div ref={containerRef} className="flex flex-col w-full h-full">
      <ChartToolbar
        interval={interval}
        intervals={INTERVALS}
        onIntervalChange={setChartInterval}
        activeTool={activeTool}
        onToolChange={(tool) => {
          setActiveTool(tool);
          setPendingPoints([]);
          if (tool !== "none") {
            setSelectedDrawingId(null);
          }
        }}
        currentStyle={currentStyle}
        onStyleChange={(updates) => setCurrentStyle(prev => ({ ...prev, ...updates }))}
        drawingCount={drawings.length}
        onClearAll={clearAllDrawings}
        magnetMode={magnetMode}
        onMagnetChange={setMagnetMode}
        stayInDrawingMode={stayInDrawingMode}
        onStayInDrawingModeChange={setStayInDrawingMode}
        allLocked={allLocked}
        onLockAllChange={(locked) => {
          setAllLocked(locked);
          setDrawings(prev => prev.map(d => ({ ...d, locked })));
        }}
        allHidden={allHidden}
        onHideAllChange={(hidden) => {
          setAllHidden(hidden);
          setDrawings(prev => prev.map(d => ({ ...d, visible: !hidden })));
        }}
        onToggleObjectTree={() => setShowObjectTree(prev => !prev)}
        showObjectTree={showObjectTree}
      />

      <div className="relative bg-[#0f172a]" style={{ height: dimensions.height }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80 z-10">
            <div className="text-white">Loading chart data...</div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80 z-10">
            <div className="text-danger-400">{error}</div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{
            width: dimensions.width,
            height: dimensions.height,
            display: 'block',
            touchAction: 'none',  // Prevent touch scroll
          }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          tabIndex={0}
        />

        {/* OHLC Display */}
        {(() => {
          // Show hovered candle when mouse is over a candle, otherwise always show last candle
          const lastCandle = klines.length > 0 ? klines[klines.length - 1] : null;
          const candle = mousePos?.candle || lastCandle;
          if (!candle) return null;

          const change = candle.close - candle.open;
          const changePercent = (change / candle.open) * 100;
          const isUp = change >= 0;
          const changeColor = isUp ? "text-primary-400" : "text-danger-400";
          const isLiveCandle = candle === lastCandle;

          return (
            <div className="absolute top-2 left-2 flex items-center gap-3 text-xs font-mono bg-dark-800/90 px-3 py-1.5 rounded">
              {isLiveCandle && <span className="text-amber-400 animate-pulse">●</span>}
              <span className="text-dark-400">O <span className="text-white">{formatPrice(candle.open)}</span></span>
              <span className="text-dark-400">H <span className="text-primary-400">{formatPrice(candle.high)}</span></span>
              <span className="text-dark-400">L <span className="text-danger-400">{formatPrice(candle.low)}</span></span>
              <span className="text-dark-400">C <span className={changeColor}>{formatPrice(candle.close)}</span></span>
              <span className="border-l border-dark-600 pl-3">
                <span className={changeColor}>
                  {isUp ? "+" : ""}{formatPrice(change)} ({isUp ? "+" : ""}{changePercent.toFixed(2)}%)
                </span>
              </span>
              <span className="text-dark-500">Vol {(candle.volume / 1000).toFixed(1)}K</span>
            </div>
          );
        })()}

        {/* Drawing Quick Toolbar - TradingView style */}
        <div className="absolute top-12 left-2 z-40">
          <DrawingQuickToolbar
            activeTool={activeTool}
            selectedDrawing={selectedDrawing}
            currentStyle={currentStyle}
            onStyleChange={(updates) => {
              setCurrentStyle(prev => ({ ...prev, ...updates }));
              // Also update selected drawing if exists
              if (selectedDrawing) {
                updateDrawing(selectedDrawing.id, {
                  style: { ...selectedDrawing.style, ...updates }
                });
              }
            }}
            onDeleteDrawing={() => {
              if (selectedDrawingId) {
                deleteDrawing(selectedDrawingId);
                setSelectedDrawingId(null);
                setOverlappingDrawings([]);
                setOverlappingIndex(0);
              }
            }}
            onCloneDrawing={() => {
              if (selectedDrawing) {
                const cloned: Drawing = {
                  ...selectedDrawing,
                  id: crypto.randomUUID(),
                  points: selectedDrawing.points.map(p => ({
                    time: p.time + 60000, // Offset by 1 minute
                    price: p.price * 1.001 // Slight price offset
                  })),
                  created_at: Date.now(),
                  updated_at: Date.now(),
                };
                setDrawings(prev => [...prev, cloned]);
                setSelectedDrawingId(cloned.id);
              }
            }}
            onLockDrawing={() => {
              if (selectedDrawing) {
                updateDrawing(selectedDrawing.id, { locked: !selectedDrawing.locked });
              }
            }}
            onOpenSettings={() => setShowSettingsPanel(true)}
            toolInfo={getToolInfo(selectedDrawing?.drawing_type || activeTool) || null}
            overlappingCount={overlappingDrawings.length}
            overlappingIndex={overlappingIndex}
            onCycleOverlapping={() => {
              if (overlappingDrawings.length > 1) {
                const nextIndex = (overlappingIndex + 1) % overlappingDrawings.length;
                setOverlappingIndex(nextIndex);
                setSelectedDrawingId(overlappingDrawings[nextIndex]);
              }
            }}
          />
        </div>

        {/* Status indicators - positioned above time labels */}
        <div className="absolute left-2 flex gap-2" style={{ bottom: PADDING_BOTTOM + 8 }}>
          {activeTool !== "none" && activeTool !== "crosshair" && (
            <div className="text-xs text-primary-400 bg-dark-800/90 px-2 py-1 rounded">
              {activeTool} {pendingPoints.length > 0 && `(${pendingPoints.length}/${getRequiredPoints(activeTool)})`}
            </div>
          )}
          {shiftPressed && (
            <div className="text-xs text-amber-400 bg-dark-800/90 px-2 py-1 rounded">
              SHIFT: Constrain
            </div>
          )}
          {selectedDrawingId && (
            <div className="text-xs text-yellow-400 bg-dark-800/90 px-2 py-1 rounded">
              Selected (Del to remove)
            </div>
          )}
        </div>

        {/* Magnet indicator */}
        {magnetMode !== "none" && mousePos && mousePos.price !== mousePos.rawPrice && (
          <div className="absolute top-2 right-24 text-xs text-amber-400 bg-dark-800/90 px-2 py-1 rounded">
            Magnet: {formatPrice(mousePos.price)}
          </div>
        )}

        {/* Candle Color Settings Button */}
        <SettingsButton
          onClick={() => setShowColorSettings(!showColorSettings)}
          className="absolute top-2 right-2"
        />

        {/* Candle Color Settings Panel */}
        <ColorSettingsPopup
          isOpen={showColorSettings}
          onClose={() => setShowColorSettings(false)}
          title="Mum Renkleri"
        >
          <CandleColorPicker
            bullish={chartColors.candle.bullish}
            bearish={chartColors.candle.bearish}
            onBullishChange={(c) => setColor("candle", "bullish", c)}
            onBearishChange={(c) => setColor("candle", "bearish", c)}
          />
        </ColorSettingsPopup>

        {/* Go to live button - shows when not at the latest candle */}
        {!autoScroll && klines.length > 0 && (
          <button
            onClick={() => {
              const visibleCount = viewport.endIndex - viewport.startIndex;
              const newEndIdx = klines.length;
              const newStartIdx = Math.max(0, newEndIdx - visibleCount);
              updateViewportPriceRange(newStartIdx, newEndIdx);
              setAutoScroll(true);
            }}
            className="absolute right-4 flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white text-xs rounded-lg shadow-lg transition-all animate-pulse"
            style={{ bottom: PADDING_BOTTOM + 16 }}
          >
            <span>▶▶</span>
            <span>Canlıya Git</span>
          </button>
        )}

        {/* Live indicator */}
        {autoScroll && (
          <div
            className="absolute right-4 flex items-center gap-1.5 px-2 py-1 bg-dark-800/80 text-xs rounded"
            style={{ bottom: PADDING_BOTTOM + 16 }}
          >
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-green-400">Canlı</span>
          </div>
        )}

        {/* Drawing Object Tree */}
        {showObjectTree && (
          <DrawingObjectTree
            drawings={drawings.map(d => ({
              id: d.id,
              drawing_type: d.drawing_type,
              visible: d.visible,
              locked: d.locked,
              name: d.name,
            }))}
            selectedDrawingId={selectedDrawingId}
            onSelectDrawing={(id) => {
              setSelectedDrawingId(id);
              setActiveTool("none");
            }}
            onToggleVisibility={(id) => {
              setDrawings(prev => prev.map(d =>
                d.id === id ? { ...d, visible: !d.visible } : d
              ));
            }}
            onToggleLock={(id) => {
              setDrawings(prev => prev.map(d =>
                d.id === id ? { ...d, locked: !d.locked } : d
              ));
            }}
            onDeleteDrawing={(id) => {
              deleteDrawing(id);
              if (selectedDrawingId === id) {
                setSelectedDrawingId(null);
              }
            }}
            onRenameDrawing={(id, name) => {
              setDrawings(prev => prev.map(d =>
                d.id === id ? { ...d, name } : d
              ));
            }}
            onClose={() => setShowObjectTree(false)}
          />
        )}

        {/* Drawing Settings Panel */}
        {showSettingsPanel && selectedDrawingId && (() => {
          const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);
          if (!selectedDrawing) return null;
          return (
            <DrawingSettingsPanel
              drawing={selectedDrawing}
              onUpdateDrawing={handleUpdateDrawing}
              onUpdateStyle={handleUpdateStyle}
              onUpdatePoint={handleUpdatePoint}
              onClone={handleCloneDrawing}
              onDelete={() => {
                deleteDrawing(selectedDrawingId);
                setSelectedDrawingId(null);
                setShowSettingsPanel(false);
              }}
              onClose={() => setShowSettingsPanel(false)}
              formatPrice={formatPrice}
            />
          );
        })()}

        {/* Context Menu */}
        {contextMenu && (() => {
          const menuDrawing = drawings.find(d => d.id === contextMenu.drawingId);
          if (!menuDrawing) return null;
          return (
            <DrawingContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              drawing={menuDrawing}
              onOpenSettings={() => {
                setShowSettingsPanel(true);
                setContextMenu(null);
              }}
              onClone={handleCloneDrawing}
              onDelete={() => {
                deleteDrawing(contextMenu.drawingId);
                if (selectedDrawingId === contextMenu.drawingId) {
                  setSelectedDrawingId(null);
                }
                setContextMenu(null);
              }}
              onLock={() => {
                setDrawings(prev => prev.map(d =>
                  d.id === contextMenu.drawingId ? { ...d, locked: !d.locked } : d
                ));
              }}
              onHide={() => {
                setDrawings(prev => prev.map(d =>
                  d.id === contextMenu.drawingId ? { ...d, visible: !d.visible } : d
                ));
              }}
              onBringToFront={handleBringToFront}
              onSendToBack={handleSendToBack}
              onClose={() => setContextMenu(null)}
            />
          );
        })()}
      </div>
    </div>
  );
}

function calculateStep(range: number, targetLines: number): number {
  if (range <= 0) return 1;
  const rough = range / targetLines;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / magnitude;

  if (residual >= 5) return 5 * magnitude;
  if (residual >= 2) return 2 * magnitude;
  return magnitude;
}
