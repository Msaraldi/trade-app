// ============================================
// CHART DRAWINGS - Types and Utilities
// TradingView-style Drawing Tools
// ============================================

// Drawing tool types - Expanded to match TradingView
export type DrawingTool =
  // Cursor/Utility
  | "none"
  | "crosshair"
  | "eraser"
  // Line Tools
  | "trendline"
  | "ray"
  | "extended"
  | "horizontal"
  | "vertical"
  | "horizontal_ray"
  | "arrow"
  | "info_line"
  | "trend_angle"
  | "cross_line"
  // Channel Tools
  | "parallel_channel"
  | "disjoint_channel"
  | "flat_top_bottom"
  | "regression_trend"
  // Pitchfork Tools
  | "pitchfork"
  | "schiff_pitchfork"
  | "modified_schiff"
  | "inside_pitchfork"
  // Fibonacci Tools
  | "fib_retracement"
  | "fib_extension"
  | "fib_channel"
  | "fib_time_zone"
  | "fib_fan"
  | "fib_arc"
  | "fib_circles"
  | "fib_wedge"
  // Gann Tools
  | "gann_box"
  | "gann_fan"
  | "gann_square"
  // Pattern Tools
  | "xabcd"
  | "abcd"
  | "three_drives"
  | "head_shoulders"
  | "triangle_pattern"
  | "elliott_wave"
  | "cyclic_lines"
  // Shape Tools
  | "rectangle"
  | "circle"
  | "ellipse"
  | "triangle"
  | "arc"
  | "path"
  | "polyline"
  | "brush"
  // Measurement Tools
  | "date_range"
  | "price_range"
  | "date_price_range"
  | "long_position"
  | "short_position"
  // Volume Tools
  | "anchored_vwap"
  // Annotation Tools
  | "text"
  | "anchored_text"
  | "note"
  | "callout"
  | "price_label"
  | "arrow_marker"
  | "flag_marker"
  | "icon";

export type DrawingToolCategory =
  | "cursor"
  | "lines"
  | "channels"
  | "pitchfork"
  | "fibonacci"
  | "gann"
  | "patterns"
  | "shapes"
  | "measure"
  | "volume"
  | "annotation";

// Extended DrawingStyle with TradingView-like options
export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  fillColor?: string;
  fillOpacity?: number;
  showLabels?: boolean;
  text?: string;
  // Extended options
  extendLeft?: boolean;
  extendRight?: boolean;
  showPrice?: boolean;
  showPercentage?: boolean;
  showPips?: boolean;
  showBars?: boolean;
  fontSize?: number;
  fontFamily?: string;
  backgroundColor?: string;
  backgroundOpacity?: number;
  // Fibonacci specific
  fibLevels?: number[];
  fibColors?: string[];
  fibLabelsLeft?: boolean;
  // Position tool specific
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  quantity?: number;
  riskReward?: number;
  // Pitchfork specific
  pitchforkLevels?: number[];        // e.g., [0.25, 0.5, 0.75, 1]
  pitchforkColors?: string[];        // Colors for each level
  medianColor?: string;              // Median line color
  showMedian?: boolean;              // Show/hide median line
  showPitchforkLevels?: boolean;     // Show/hide level lines
  // Parallel Channel specific
  channelLevels?: number[];          // e.g., [0.25, 0.5, 0.75]
  showMiddleLine?: boolean;          // Show middle line
  // Anchored VWAP specific
  vwapSource?: "hlc3" | "hl2" | "ohlc4" | "close";
  vwapBands?: number[];              // Standard deviation multipliers [1, 2, 3]
  vwapBandColors?: string[];         // Colors for each band
  showVwapBands?: boolean;           // Show/hide bands
  // Arrow marker specific
  arrowDirection?: "up" | "down";
  arrowSize?: number;
  // Info line specific
  showPriceDiff?: boolean;
  showPercentDiff?: boolean;
  showBarCount?: boolean;
  showTimeDiff?: boolean;
}

export interface DrawingPoint {
  time: number;   // Unix timestamp in milliseconds
  price: number;  // Price value
}

export interface Drawing {
  id: string;
  symbol: string;
  interval: string;
  drawing_type: DrawingTool;
  points: DrawingPoint[];
  style: DrawingStyle;
  visible: boolean;
  locked: boolean;
  created_at: number;
  updated_at: number;
  // Extended properties
  name?: string;           // Custom name for the drawing
  timeframes?: string[];   // Which timeframes to show this drawing on
  group_id?: string;       // Drawing group/folder ID
}

// Tool category definitions - Expanded
export const TOOL_CATEGORIES: { id: DrawingToolCategory; label: string; icon: string }[] = [
  { id: "lines", label: "Çizgiler", icon: "╱" },
  { id: "channels", label: "Kanallar", icon: "⫽" },
  { id: "pitchfork", label: "Pitchfork", icon: "Ψ" },
  { id: "fibonacci", label: "Fibonacci", icon: "F" },
  { id: "gann", label: "Gann", icon: "G" },
  { id: "patterns", label: "Formasyonlar", icon: "◇" },
  { id: "shapes", label: "Şekiller", icon: "○" },
  { id: "volume", label: "Hacim", icon: "V" },
  { id: "measure", label: "Ölçüm", icon: "📏" },
  { id: "annotation", label: "Metin", icon: "T" },
];

// Tool definitions with metadata - Complete TradingView-style tools
export const DRAWING_TOOLS: {
  id: DrawingTool;
  category: DrawingToolCategory;
  label: string;
  icon: string;
  requiredPoints: number;
  description?: string;
}[] = [
  // ========== LINE TOOLS ==========
  { id: "trendline", category: "lines", label: "Trend Çizgisi", icon: "╱", requiredPoints: 2,
    description: "İki nokta arasında çizgi çiz" },
  { id: "ray", category: "lines", label: "Işın", icon: "→", requiredPoints: 2,
    description: "Bir yönde sonsuza uzanan çizgi" },
  { id: "info_line", category: "lines", label: "Bilgi Çizgisi", icon: "ℹ", requiredPoints: 2,
    description: "Mesafe, mum sayısı ve yüzde gösteren çizgi" },
  { id: "extended", category: "lines", label: "Uzatılmış Çizgi", icon: "↔", requiredPoints: 2,
    description: "İki yönde sonsuza uzanan çizgi" },
  { id: "trend_angle", category: "lines", label: "Trend Açısı", icon: "∠", requiredPoints: 2,
    description: "Trendin açısını gösterir" },
  { id: "horizontal", category: "lines", label: "Yatay Çizgi", icon: "─", requiredPoints: 1,
    description: "Yatay fiyat seviyesi" },
  { id: "horizontal_ray", category: "lines", label: "Yatay Işın", icon: "⟶", requiredPoints: 1,
    description: "Sağa uzanan yatay çizgi" },
  { id: "vertical", category: "lines", label: "Dikey Çizgi", icon: "│", requiredPoints: 1,
    description: "Dikey zaman işareti" },
  { id: "cross_line", category: "lines", label: "Çapraz Çizgi", icon: "+", requiredPoints: 1,
    description: "Belirli bir noktada çapraz" },
  { id: "arrow", category: "lines", label: "Ok", icon: "➤", requiredPoints: 2,
    description: "Başlangıçtan bitişe ok" },

  // ========== CHANNEL TOOLS ==========
  { id: "parallel_channel", category: "channels", label: "Paralel Kanal", icon: "═", requiredPoints: 3,
    description: "Kanal oluşturan iki paralel çizgi" },
  { id: "disjoint_channel", category: "channels", label: "Ayrık Kanal", icon: "⫽", requiredPoints: 4,
    description: "Bağımsız çizgilerle paralel olmayan kanal" },
  { id: "flat_top_bottom", category: "channels", label: "Düz Üst/Alt", icon: "▭", requiredPoints: 2,
    description: "Yatay konsolidasyon bölgesi" },
  { id: "regression_trend", category: "channels", label: "Regresyon Trendi", icon: "≈", requiredPoints: 2,
    description: "İstatistiksel regresyon kanalı" },

  // ========== PITCHFORK TOOLS ==========
  { id: "pitchfork", category: "pitchfork", label: "Pitchfork", icon: "Ψ", requiredPoints: 3,
    description: "Andrew's Pitchfork" },
  { id: "schiff_pitchfork", category: "pitchfork", label: "Schiff Pitchfork", icon: "Ψs", requiredPoints: 3,
    description: "Schiff variant pitchfork" },
  { id: "modified_schiff", category: "pitchfork", label: "Modified Schiff", icon: "Ψm", requiredPoints: 3,
    description: "Modified Schiff pitchfork" },
  { id: "inside_pitchfork", category: "pitchfork", label: "Inside Pitchfork", icon: "Ψi", requiredPoints: 3,
    description: "Inside pitchfork variant" },

  // ========== FIBONACCI TOOLS ==========
  { id: "fib_retracement", category: "fibonacci", label: "Fib Retracement", icon: "FR", requiredPoints: 2,
    description: "Fibonacci retracement levels" },
  { id: "fib_extension", category: "fibonacci", label: "Trend-Based Fib Extension", icon: "FE", requiredPoints: 3,
    description: "Fibonacci extension levels" },
  { id: "fib_channel", category: "fibonacci", label: "Fib Channel", icon: "FC", requiredPoints: 3,
    description: "Fibonacci channel" },
  { id: "fib_time_zone", category: "fibonacci", label: "Fib Time Zone", icon: "FT", requiredPoints: 2,
    description: "Fibonacci time intervals" },
  { id: "fib_fan", category: "fibonacci", label: "Fib Speed Resistance Fan", icon: "FF", requiredPoints: 2,
    description: "Fibonacci fan lines" },
  { id: "fib_arc", category: "fibonacci", label: "Fib Speed Resistance Arc", icon: "FA", requiredPoints: 2,
    description: "Fibonacci arcs" },
  { id: "fib_circles", category: "fibonacci", label: "Fib Circles", icon: "F○", requiredPoints: 2,
    description: "Fibonacci circles" },
  { id: "fib_wedge", category: "fibonacci", label: "Fib Wedge", icon: "FW", requiredPoints: 3,
    description: "Fibonacci wedge pattern" },

  // ========== GANN TOOLS ==========
  { id: "gann_box", category: "gann", label: "Gann Box", icon: "GB", requiredPoints: 2,
    description: "Gann price/time grid" },
  { id: "gann_fan", category: "gann", label: "Gann Fan", icon: "GF", requiredPoints: 2,
    description: "Gann fan angles" },
  { id: "gann_square", category: "gann", label: "Gann Square", icon: "G□", requiredPoints: 2,
    description: "Gann square of nine" },

  // ========== PATTERN TOOLS ==========
  { id: "xabcd", category: "patterns", label: "XABCD Pattern", icon: "X", requiredPoints: 5,
    description: "Harmonic XABCD pattern" },
  { id: "abcd", category: "patterns", label: "ABCD Pattern", icon: "A", requiredPoints: 4,
    description: "ABCD pattern" },
  { id: "three_drives", category: "patterns", label: "Three Drives", icon: "3D", requiredPoints: 7,
    description: "Three drives pattern" },
  { id: "head_shoulders", category: "patterns", label: "Head & Shoulders", icon: "HS", requiredPoints: 7,
    description: "Head and shoulders pattern" },
  { id: "triangle_pattern", category: "patterns", label: "Triangle", icon: "△", requiredPoints: 3,
    description: "Triangle pattern" },
  { id: "elliott_wave", category: "patterns", label: "Elliott Wave", icon: "EW", requiredPoints: 6,
    description: "Elliott impulse wave (12345)" },
  { id: "cyclic_lines", category: "patterns", label: "Cyclic Lines", icon: "◎", requiredPoints: 2,
    description: "Repeating vertical lines" },

  // ========== SHAPE TOOLS ==========
  { id: "rectangle", category: "shapes", label: "Dikdörtgen", icon: "▢", requiredPoints: 2,
    description: "Dikdörtgen/bölge" },
  { id: "circle", category: "shapes", label: "Daire", icon: "○", requiredPoints: 2,
    description: "Daire şekli" },
  { id: "ellipse", category: "shapes", label: "Elips", icon: "⬭", requiredPoints: 2,
    description: "Elips şekli" },
  { id: "triangle", category: "shapes", label: "Üçgen Şekli", icon: "△", requiredPoints: 3,
    description: "Üçgen şekli" },
  { id: "arc", category: "shapes", label: "Yay", icon: "⌒", requiredPoints: 3,
    description: "Yay/eğri" },
  { id: "polyline", category: "shapes", label: "Çoklu Çizgi", icon: "⟋", requiredPoints: -1,
    description: "Bağlı çizgi parçaları" },
  { id: "path", category: "shapes", label: "Yol", icon: "〰", requiredPoints: -1,
    description: "Serbest eğri yol" },
  { id: "brush", category: "shapes", label: "Fırça", icon: "✎", requiredPoints: -1,
    description: "Serbest çizim" },

  // ========== MEASUREMENT TOOLS ==========
  { id: "date_range", category: "measure", label: "Tarih Aralığı", icon: "📅", requiredPoints: 2,
    description: "İki nokta arasındaki zamanı ölç" },
  { id: "price_range", category: "measure", label: "Fiyat Aralığı", icon: "📊", requiredPoints: 2,
    description: "Fiyat mesafesini ölç" },
  { id: "date_price_range", category: "measure", label: "Tarih ve Fiyat Aralığı", icon: "📐", requiredPoints: 2,
    description: "Hem fiyat hem zamanı ölç" },
  { id: "long_position", category: "measure", label: "Long Pozisyon", icon: "📈", requiredPoints: 2,
    description: "R:R ile long işlem pozisyonu" },
  { id: "short_position", category: "measure", label: "Short Pozisyon", icon: "📉", requiredPoints: 2,
    description: "R:R ile short işlem pozisyonu" },

  // ========== VOLUME TOOLS ==========
  { id: "anchored_vwap", category: "volume", label: "Sabitlenmiş VWAP", icon: "⚓V", requiredPoints: 1,
    description: "Belirli bir noktaya sabitlenmiş VWAP" },

  // ========== ANNOTATION TOOLS ==========
  { id: "text", category: "annotation", label: "Metin", icon: "T", requiredPoints: 1,
    description: "Basit metin etiketi" },
  { id: "anchored_text", category: "annotation", label: "Sabit Metin", icon: "⚓T", requiredPoints: 1,
    description: "Fiyat/zamana sabitlenmiş metin" },
  { id: "note", category: "annotation", label: "Not", icon: "📝", requiredPoints: 1,
    description: "Genişletilebilir not kutusu" },
  { id: "callout", category: "annotation", label: "Açıklama", icon: "💬", requiredPoints: 2,
    description: "İşaretçili açıklama" },
  { id: "price_label", category: "annotation", label: "Fiyat Etiketi", icon: "$", requiredPoints: 1,
    description: "Fiyat seviyesi etiketi" },
  { id: "arrow_marker", category: "annotation", label: "Ok İşareti", icon: "↑", requiredPoints: 1,
    description: "Yukarı/aşağı ok işareti" },
  { id: "flag_marker", category: "annotation", label: "Bayrak", icon: "🚩", requiredPoints: 1,
    description: "Bayrak işareti" },
  { id: "icon", category: "annotation", label: "İkon", icon: "☆", requiredPoints: 1,
    description: "Bir ikon yerleştir" },
];

// Default drawing style
export const DEFAULT_DRAWING_STYLE: DrawingStyle = {
  color: "#2962FF",
  lineWidth: 2,
  lineStyle: "solid",
  fillColor: "#2962FF",
  fillOpacity: 0.1,
  showLabels: true,
  extendLeft: false,
  extendRight: false,
  showPrice: true,
  showPercentage: false,
  fontSize: 12,
};

// Preset colors for drawing tools
export const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#ffffff", // white
  "#94a3b8", // gray
  "#64748b", // slate
  "#000000", // black
];

// Fibonacci levels and colors (TradingView default)
export const FIBONACCI_LEVELS = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1,
  1.272, 1.414, 1.618, 2, 2.272, 2.618, 3.618, 4.236
];

export const FIBONACCI_COLORS = [
  "#787B86", // 0
  "#F23645", // 0.236
  "#FF9800", // 0.382
  "#4CAF50", // 0.5
  "#089981", // 0.618
  "#00BCD4", // 0.786
  "#787B86", // 1
  "#2962FF", // 1.272
  "#9C27B0", // 1.414
  "#E91E63", // 1.618
  "#673AB7", // 2
  "#3F51B5", // 2.272
  "#009688", // 2.618
  "#795548", // 3.618
  "#607D8B", // 4.236
];

// Pitchfork levels and colors (TradingView default)
export const PITCHFORK_LEVELS = [0.25, 0.5, 0.75, 1, 1.5, 1.75, 2];
export const PITCHFORK_COLORS = [
  "#787B86", // 0.25
  "#2962FF", // 0.5 (median parallel)
  "#787B86", // 0.75
  "#089981", // 1 (upper/lower)
  "#787B86", // 1.5
  "#787B86", // 1.75
  "#787B86", // 2
];
export const PITCHFORK_MEDIAN_COLOR = "#FF9800"; // Orange for median

// Parallel Channel levels
export const CHANNEL_LEVELS = [0.25, 0.5, 0.75];
export const CHANNEL_COLORS = ["#787B86", "#2962FF", "#787B86"];

// VWAP Band settings
export const VWAP_BAND_MULTIPLIERS = [1, 2, 3]; // Standard deviations
export const VWAP_BAND_COLORS = ["#2962FF40", "#2962FF25", "#2962FF15"];

// Gann angles (price/time ratios)
export const GANN_ANGLES = [
  { ratio: 8, label: "8×1" },
  { ratio: 4, label: "4×1" },
  { ratio: 3, label: "3×1" },
  { ratio: 2, label: "2×1" },
  { ratio: 1, label: "1×1" },
  { ratio: 0.5, label: "1×2" },
  { ratio: 0.333, label: "1×3" },
  { ratio: 0.25, label: "1×4" },
  { ratio: 0.125, label: "1×8" },
];

// Icon options for the icon tool
export const ICON_OPTIONS = [
  "⭐", "🔥", "💰", "📍", "🎯", "⚠️", "✅", "❌",
  "🔴", "🟢", "🔵", "🟡", "⬆️", "⬇️", "➡️", "⬅️",
  "💎", "🚀", "📊", "💹", "📈", "📉", "🔔", "💡"
];

// Helper functions
export function getToolInfo(tool: DrawingTool) {
  return DRAWING_TOOLS.find((t) => t.id === tool);
}

export function getCategoryTools(category: DrawingToolCategory) {
  return DRAWING_TOOLS.filter((t) => t.category === category);
}

export function getRequiredPoints(tool: DrawingTool): number {
  const toolInfo = getToolInfo(tool);
  return toolInfo?.requiredPoints || 2;
}

export function createDrawingId(): string {
  return `drawing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Drawing validation
export function isDrawingComplete(tool: DrawingTool, pointCount: number): boolean {
  const required = getRequiredPoints(tool);
  if (required === -1) return false; // Unlimited points (path, polyline, brush)
  return pointCount >= required;
}

// Snap price to OHLC levels (magnet mode)
export function snapToOHLC(
  price: number,
  candle: { open: number; high: number; low: number; close: number } | null,
  strength: "none" | "weak" | "strong"
): number {
  if (!candle || strength === "none") return price;

  const levels = [candle.open, candle.high, candle.low, candle.close];
  const range = candle.high - candle.low;
  const threshold = strength === "strong" ? Infinity : range * 0.3;

  let closestLevel = price;
  let closestDistance = Infinity;

  for (const level of levels) {
    const distance = Math.abs(price - level);
    if (distance < closestDistance && distance < threshold) {
      closestDistance = distance;
      closestLevel = level;
    }
  }

  return closestLevel;
}

// Calculate Fibonacci level prices
export function calculateFibLevels(
  startPrice: number,
  endPrice: number,
  levels: number[] = FIBONACCI_LEVELS
): { level: number; price: number }[] {
  const range = endPrice - startPrice;
  return levels.map(level => ({
    level,
    price: startPrice + range * level
  }));
}

// Calculate Gann angles from a point
export function calculateGannAngles(
  startPoint: DrawingPoint,
  pricePerBar: number,
  direction: "up" | "down"
): { ratio: number; label: string; endPoint: (bars: number) => DrawingPoint }[] {
  return GANN_ANGLES.map(angle => ({
    ...angle,
    endPoint: (bars: number) => ({
      time: startPoint.time + bars * 60000, // Assuming 1 minute bars
      price: direction === "up"
        ? startPoint.price + bars * pricePerBar * angle.ratio
        : startPoint.price - bars * pricePerBar * angle.ratio
    })
  }));
}

// Calculate distance, bars, and percentage for info line
export function calculateInfoLine(
  p1: DrawingPoint,
  p2: DrawingPoint,
  intervalMs: number = 60000
): { priceDiff: number; percentage: number; bars: number; timeDiff: string } {
  const priceDiff = p2.price - p1.price;
  const percentage = (priceDiff / p1.price) * 100;
  const timeDiffMs = Math.abs(p2.time - p1.time);
  const bars = Math.round(timeDiffMs / intervalMs);

  // Format time difference
  const hours = Math.floor(timeDiffMs / 3600000);
  const minutes = Math.floor((timeDiffMs % 3600000) / 60000);
  const timeDiff = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return { priceDiff, percentage, bars, timeDiff };
}

// Calculate pitchfork median line and parallels
export function calculatePitchfork(
  p1: DrawingPoint, // Start point
  p2: DrawingPoint, // Left shoulder
  p3: DrawingPoint, // Right shoulder
  variant: "standard" | "schiff" | "modified_schiff" | "inside" = "standard"
): { median: [DrawingPoint, DrawingPoint]; upper: [DrawingPoint, DrawingPoint]; lower: [DrawingPoint, DrawingPoint] } {
  // Calculate median line start point based on variant
  let medianStart: DrawingPoint;

  switch (variant) {
    case "schiff":
      medianStart = {
        time: p1.time,
        price: (p1.price + p2.price) / 2
      };
      break;
    case "modified_schiff":
      medianStart = {
        time: (p1.time + p2.time) / 2,
        price: (p1.price + p2.price) / 2
      };
      break;
    case "inside":
      medianStart = {
        time: p1.time + (p2.time - p1.time) * 0.5,
        price: p1.price + (p2.price - p1.price) * 0.5
      };
      break;
    default:
      medianStart = p1;
  }

  // Median line end point (midpoint of p2 and p3)
  const medianEnd: DrawingPoint = {
    time: (p2.time + p3.time) / 2,
    price: (p2.price + p3.price) / 2
  };

  // Calculate parallel offset
  const upperOffset = {
    time: p2.time - medianEnd.time,
    price: p2.price - medianEnd.price
  };
  const lowerOffset = {
    time: p3.time - medianEnd.time,
    price: p3.price - medianEnd.price
  };

  return {
    median: [medianStart, medianEnd],
    upper: [
      { time: medianStart.time + upperOffset.time, price: medianStart.price + upperOffset.price },
      { time: medianEnd.time + upperOffset.time, price: medianEnd.price + upperOffset.price }
    ],
    lower: [
      { time: medianStart.time + lowerOffset.time, price: medianStart.price + lowerOffset.price },
      { time: medianEnd.time + lowerOffset.time, price: medianEnd.price + lowerOffset.price }
    ]
  };
}

// Calculate risk/reward for position tools
export function calculatePositionRR(
  entry: number,
  stopLoss: number,
  takeProfit: number,
  _isLong: boolean // Used for validation in the future
): { risk: number; reward: number; ratio: number; riskPercent: number; rewardPercent: number } {
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  const ratio = risk > 0 ? reward / risk : 0;
  const riskPercent = (risk / entry) * 100;
  const rewardPercent = (reward / entry) * 100;

  return { risk, reward, ratio, riskPercent, rewardPercent };
}

// Get angle in degrees between two points (for trend angle tool)
export function calculateTrendAngle(
  p1: DrawingPoint,
  p2: DrawingPoint,
  priceScale: number, // pixels per price unit
  timeScale: number   // pixels per time unit
): number {
  const dx = (p2.time - p1.time) * timeScale;
  const dy = (p2.price - p1.price) * priceScale;
  return Math.atan2(-dy, dx) * (180 / Math.PI);
}
