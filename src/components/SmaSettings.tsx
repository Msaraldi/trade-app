import { useState } from "react";

// SMA types
export type SmaPeriod = "200D" | "50W" | "100W" | "200W";

export interface SmaConfig {
  period: SmaPeriod;
  enabled: boolean;
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
}

interface SmaSettingsProps {
  configs: SmaConfig[];
  onConfigChange: (configs: SmaConfig[]) => void;
  isActive: boolean;
}

const SMA_PERIODS: { id: SmaPeriod; label: string; description: string; tooltip: string }[] = [
  {
    id: "200D",
    label: "200 Günlük SMA",
    description: "Ana Trend",
    tooltip: "Ana trendi belirleyen en temel gösterge"
  },
  {
    id: "50W",
    label: "50 Haftalık SMA",
    description: "Orta Vade",
    tooltip: "Orta vadeli trend takibi için kullanılır"
  },
  {
    id: "100W",
    label: "100 Haftalık SMA",
    description: "Destek/Direnç",
    tooltip: "Güçlü bir destek/direnç bölgesi"
  },
  {
    id: "200W",
    label: "200 Haftalık SMA",
    description: "Ölüm Çubuğu",
    tooltip: "Piyasanın en kritik ve en büyük destek noktası"
  },
];

const DEFAULT_COLORS: Record<SmaPeriod, string> = {
  "200D": "#F59E0B",   // Amber - 200 Günlük
  "50W": "#3B82F6",    // Blue - 50 Haftalık
  "100W": "#8B5CF6",   // Purple - 100 Haftalık
  "200W": "#EF4444",   // Red - 200 Haftalık (Ölüm çubuğu)
};

export function getDefaultSmaConfigs(): SmaConfig[] {
  return SMA_PERIODS.map(period => ({
    period: period.id,
    enabled: period.id === "200D", // Default: sadece 200 günlük aktif
    color: DEFAULT_COLORS[period.id],
    lineWidth: period.id === "200W" ? 3 : 2, // Ölüm çubuğu daha kalın
    lineStyle: "solid" as const,
  }));
}

export function SmaSettings({ configs, onConfigChange, isActive }: SmaSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isActive) return null;

  const togglePeriod = (period: SmaPeriod) => {
    const newConfigs = configs.map(c =>
      c.period === period ? { ...c, enabled: !c.enabled } : c
    );
    onConfigChange(newConfigs);
  };

  const updateColor = (period: SmaPeriod, color: string) => {
    const newConfigs = configs.map(c =>
      c.period === period ? { ...c, color } : c
    );
    onConfigChange(newConfigs);
  };

  const updateLineWidth = (period: SmaPeriod, lineWidth: number) => {
    const newConfigs = configs.map(c =>
      c.period === period ? { ...c, lineWidth } : c
    );
    onConfigChange(newConfigs);
  };

  const enabledCount = configs.filter(c => c.enabled).length;

  return (
    <div className="mt-2 bg-dark-700/50 rounded-lg overflow-hidden">
      {/* Header - Click to expand */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-dark-600/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-400">SMA Ayarları</span>
          {enabledCount > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-600/30 text-amber-400 rounded text-[10px]">
              {enabledCount} aktif
            </span>
          )}
        </div>
        <span className="text-dark-400">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-1">
          {/* Info text */}
          <div className="text-[10px] text-dark-400 pb-2 border-b border-dark-600 mb-2">
            Milyar dolarlık fonların ve büyük algoritmaların takip ettiği temel seviyeler
          </div>

          {SMA_PERIODS.map(period => {
            const config = configs.find(c => c.period === period.id);
            if (!config) return null;

            return (
              <div
                key={period.id}
                className={`flex items-center justify-between p-2 rounded transition-colors ${
                  config.enabled ? "bg-dark-600/50" : "bg-transparent"
                }`}
                title={period.tooltip}
              >
                <div className="flex items-center gap-2">
                  {/* Checkbox */}
                  <button
                    onClick={() => togglePeriod(period.id)}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      config.enabled
                        ? "bg-amber-600 border-amber-600"
                        : "border-dark-500 hover:border-dark-400"
                    }`}
                  >
                    {config.enabled && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>

                  {/* Color indicator */}
                  <input
                    type="color"
                    value={config.color}
                    onChange={(e) => updateColor(period.id, e.target.value)}
                    className="w-4 h-4 rounded cursor-pointer bg-transparent border-0"
                    title="Renk seç"
                  />

                  {/* Label */}
                  <div className="flex flex-col">
                    <span className={`text-xs ${config.enabled ? "text-white" : "text-dark-400"}`}>
                      {period.label}
                    </span>
                    <span className="text-[9px] text-dark-500">
                      {period.description}
                    </span>
                  </div>
                </div>

                {/* Line width (only if enabled) */}
                {config.enabled && (
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map(width => (
                      <button
                        key={width}
                        onClick={() => updateLineWidth(period.id, width)}
                        className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                          config.lineWidth === width
                            ? "bg-amber-600/30 text-amber-400"
                            : "bg-dark-600 text-dark-400 hover:text-dark-300"
                        }`}
                        title={`${width}px kalınlık`}
                      >
                        <div
                          className="rounded-full bg-current"
                          style={{ width: width * 3, height: width }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Quick actions */}
          <div className="flex gap-2 pt-2 border-t border-dark-600">
            <button
              onClick={() => {
                const newConfigs = configs.map(c => ({ ...c, enabled: true }));
                onConfigChange(newConfigs);
              }}
              className="flex-1 text-[10px] py-1 rounded bg-dark-600 text-dark-300 hover:text-white transition-colors"
            >
              Tümünü Aç
            </button>
            <button
              onClick={() => {
                const newConfigs = configs.map(c => ({ ...c, enabled: false }));
                onConfigChange(newConfigs);
              }}
              className="flex-1 text-[10px] py-1 rounded bg-dark-600 text-dark-300 hover:text-white transition-colors"
            >
              Tümünü Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// SMA Calculation utilities
export interface SmaDataPoint {
  timestamp: number;
  value: number;
}

export interface SmaData {
  period: SmaPeriod;
  values: SmaDataPoint[];  // Array of SMA values for each candle
  color: string;
  lineWidth: number;
}

interface Kline {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Get the number of candles needed for each SMA period
// Based on current chart interval
function getPeriodCandles(period: SmaPeriod, intervalMinutes: number): number {
  const minutesPerDay = 24 * 60;
  const minutesPerWeek = 7 * minutesPerDay;

  switch (period) {
    case "200D":
      return Math.ceil((200 * minutesPerDay) / intervalMinutes);
    case "50W":
      return Math.ceil((50 * minutesPerWeek) / intervalMinutes);
    case "100W":
      return Math.ceil((100 * minutesPerWeek) / intervalMinutes);
    case "200W":
      return Math.ceil((200 * minutesPerWeek) / intervalMinutes);
    default:
      return 200;
  }
}

// Calculate rolling SMA for all candles
export function calculateSma(
  klines: Kline[],
  config: SmaConfig,
  intervalMinutes: number = 15
): SmaData | null {
  if (!config.enabled || klines.length === 0) return null;

  const periodCandles = getPeriodCandles(config.period, intervalMinutes);
  const values: SmaDataPoint[] = [];

  // Calculate SMA for each candle starting from when we have enough data
  for (let i = 0; i < klines.length; i++) {
    // We need at least 'periodCandles' candles to calculate SMA
    // But we can start earlier with partial data for smoother appearance
    const startIdx = Math.max(0, i - periodCandles + 1);
    const endIdx = i + 1;
    const slice = klines.slice(startIdx, endIdx);

    // Only calculate if we have at least some data (e.g., 10% of period)
    if (slice.length < Math.min(20, periodCandles * 0.1)) continue;

    const sum = slice.reduce((acc, k) => acc + k.close, 0);
    const sma = sum / slice.length;

    values.push({
      timestamp: klines[i].timestamp,
      value: sma,
    });
  }

  if (values.length === 0) return null;

  return {
    period: config.period,
    values,
    color: config.color,
    lineWidth: config.lineWidth,
  };
}

// Calculate all enabled SMAs
export function calculateAllSmas(
  klines: Kline[],
  configs: SmaConfig[],
  intervalMinutes: number = 15
): SmaData[] {
  if (klines.length === 0) return [];

  const results: SmaData[] = [];

  for (const config of configs) {
    const sma = calculateSma(klines, config, intervalMinutes);
    if (sma) {
      results.push(sma);
    }
  }

  return results;
}
