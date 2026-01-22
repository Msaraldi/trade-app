import { useState } from "react";

// Anchored VWAP types
export interface AnchoredVwapConfig {
  id: string;
  name: string;
  startTime: number | null;  // Unix timestamp - null means not set yet
  endTime: number | null;    // Unix timestamp - null means current/live
  color: string;
  showBands: boolean;
  bandMultiplier: number;
  enabled: boolean;
}

interface AnchoredVwapSettingsProps {
  configs: AnchoredVwapConfig[];
  onConfigChange: (configs: AnchoredVwapConfig[]) => void;
  isActive: boolean;
  onSelectAnchor: (configId: string, type: "start" | "end") => void;
  selectingAnchor: { configId: string; type: "start" | "end" } | null;
}

const DEFAULT_COLORS = [
  "#FF6B6B",   // Red
  "#4ECDC4",   // Teal
  "#45B7D1",   // Blue
  "#96CEB4",   // Green
  "#FFEAA7",   // Yellow
  "#DDA0DD",   // Plum
  "#98D8C8",   // Mint
  "#F7DC6F",   // Gold
];

export function getDefaultAnchoredVwapConfigs(): AnchoredVwapConfig[] {
  return [{
    id: "avwap_1",
    name: "Anchored VWAP 1",
    startTime: null,
    endTime: null,
    color: DEFAULT_COLORS[0],
    showBands: false,
    bandMultiplier: 2,
    enabled: true,
  }];
}

export function AnchoredVwapSettings({
  configs,
  onConfigChange,
  isActive,
  onSelectAnchor,
  selectingAnchor,
}: AnchoredVwapSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isActive) return null;

  const addNewConfig = () => {
    const newId = `avwap_${Date.now()}`;
    const colorIndex = configs.length % DEFAULT_COLORS.length;
    const newConfigs = [...configs, {
      id: newId,
      name: `Anchored VWAP ${configs.length + 1}`,
      startTime: null,
      endTime: null,
      color: DEFAULT_COLORS[colorIndex],
      showBands: false,
      bandMultiplier: 2,
      enabled: true,
    }];
    onConfigChange(newConfigs);
  };

  const removeConfig = (id: string) => {
    const newConfigs = configs.filter(c => c.id !== id);
    onConfigChange(newConfigs);
  };

  const updateConfig = (id: string, updates: Partial<AnchoredVwapConfig>) => {
    const newConfigs = configs.map(c =>
      c.id === id ? { ...c, ...updates } : c
    );
    onConfigChange(newConfigs);
  };

  const toggleEnabled = (id: string) => {
    const newConfigs = configs.map(c =>
      c.id === id ? { ...c, enabled: !c.enabled } : c
    );
    onConfigChange(newConfigs);
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return "Seçilmedi";
    const date = new Date(timestamp);
    return date.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const enabledCount = configs.filter(c => c.enabled && c.startTime).length;

  return (
    <div className="mt-2 bg-dark-700/50 rounded-lg overflow-hidden">
      {/* Header - Click to expand */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-dark-600/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">⚓ Çapalı VWAP Ayarları</span>
          {enabledCount > 0 && (
            <span className="px-1.5 py-0.5 bg-cyan-600/30 text-cyan-400 rounded text-[10px]">
              {enabledCount} aktif
            </span>
          )}
        </div>
        <span className="text-dark-400">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Info text */}
          <div className="text-[10px] text-dark-400 pb-2 border-b border-dark-600 mb-2">
            Belirli bir noktadan itibaren VWAP hesaplar. Grafikte başlangıç noktası seçin.
          </div>

          {configs.map((config) => (
            <div
              key={config.id}
              className={`p-2 rounded transition-colors ${
                config.enabled ? "bg-dark-600/50" : "bg-transparent"
              } ${selectingAnchor?.configId === config.id ? "ring-1 ring-cyan-400" : ""}`}
            >
              {/* Row 1: Enable, Color, Name, Delete */}
              <div className="flex items-center gap-2 mb-2">
                {/* Checkbox */}
                <button
                  onClick={() => toggleEnabled(config.id)}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                    config.enabled
                      ? "bg-cyan-600 border-cyan-600"
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
                  onChange={(e) => updateConfig(config.id, { color: e.target.value })}
                  className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 flex-shrink-0"
                  title="Renk seç"
                />

                {/* Name input */}
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => updateConfig(config.id, { name: e.target.value })}
                  className="flex-1 bg-dark-700 border border-dark-600 rounded px-1.5 py-0.5 text-[10px] text-white min-w-0"
                  placeholder="İsim"
                />

                {/* Band toggle */}
                <button
                  onClick={() => updateConfig(config.id, { showBands: !config.showBands })}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors flex-shrink-0 ${
                    config.showBands
                      ? "bg-cyan-600/30 text-cyan-400"
                      : "bg-dark-600 text-dark-400 hover:text-dark-300"
                  }`}
                  title="Standart sapma bantları"
                >
                  ±σ
                </button>

                {/* Delete button */}
                {configs.length > 1 && (
                  <button
                    onClick={() => removeConfig(config.id)}
                    className="text-dark-400 hover:text-danger-400 transition-colors flex-shrink-0"
                    title="Sil"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Row 2: Anchor point selectors */}
              {config.enabled && (
                <div className="flex items-center gap-2">
                  {/* Start point */}
                  <button
                    onClick={() => onSelectAnchor(config.id, "start")}
                    className={`flex-1 px-2 py-1 rounded text-[10px] transition-colors ${
                      selectingAnchor?.configId === config.id && selectingAnchor?.type === "start"
                        ? "bg-cyan-600 text-white animate-pulse"
                        : config.startTime
                          ? "bg-dark-600 text-dark-200"
                          : "bg-dark-700 text-dark-400 border border-dashed border-dark-500 hover:border-cyan-400 hover:text-cyan-400"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span>📍</span>
                      <span className="truncate">
                        {selectingAnchor?.configId === config.id && selectingAnchor?.type === "start"
                          ? "Grafikte tıklayın..."
                          : config.startTime
                            ? formatTime(config.startTime)
                            : "Başlangıç Seç"}
                      </span>
                    </div>
                  </button>

                  <span className="text-dark-500 text-[10px]">→</span>

                  {/* End point */}
                  <button
                    onClick={() => onSelectAnchor(config.id, "end")}
                    className={`flex-1 px-2 py-1 rounded text-[10px] transition-colors ${
                      selectingAnchor?.configId === config.id && selectingAnchor?.type === "end"
                        ? "bg-cyan-600 text-white animate-pulse"
                        : config.endTime
                          ? "bg-dark-600 text-dark-200"
                          : "bg-dark-700 text-dark-400 border border-dashed border-dark-500 hover:border-cyan-400 hover:text-cyan-400"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span>🏁</span>
                      <span className="truncate">
                        {selectingAnchor?.configId === config.id && selectingAnchor?.type === "end"
                          ? "Grafikte tıklayın..."
                          : config.endTime
                            ? formatTime(config.endTime)
                            : "Şimdiki (Canlı)"}
                      </span>
                    </div>
                  </button>

                  {/* Clear end time button */}
                  {config.endTime && (
                    <button
                      onClick={() => updateConfig(config.id, { endTime: null })}
                      className="text-dark-400 hover:text-white transition-colors"
                      title="Bitiş noktasını temizle (canlı yap)"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add new button */}
          <button
            onClick={addNewConfig}
            className="w-full py-1.5 text-[10px] rounded bg-dark-600 text-dark-300 hover:text-white hover:bg-dark-500 transition-colors flex items-center justify-center gap-1"
          >
            <span>+</span> Yeni Çapalı VWAP Ekle
          </button>

          {/* Help text */}
          <div className="text-[9px] text-dark-500 pt-2 border-t border-dark-600">
            💡 Başlangıç noktası seçtikten sonra grafikte tıklayın. Bitiş boş bırakılırsa canlı VWAP hesaplanır.
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// ANCHORED VWAP CALCULATION
// ============================================

export interface AnchoredVwapDataPoint {
  timestamp: number;
  value: number;
  upperBand?: number;
  lowerBand?: number;
}

export interface AnchoredVwapData {
  id: string;
  name: string;
  values: AnchoredVwapDataPoint[];
  color: string;
  showBands: boolean;
}

interface Kline {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Calculate Anchored VWAP for a single config
export function calculateAnchoredVwap(
  klines: Kline[],
  config: AnchoredVwapConfig
): AnchoredVwapData | null {
  if (!config.enabled || !config.startTime || klines.length === 0) return null;

  // Find klines within the range
  const startIdx = klines.findIndex(k => k.timestamp >= config.startTime!);
  if (startIdx < 0) return null;

  let endIdx = klines.length;
  if (config.endTime) {
    const foundEndIdx = klines.findIndex(k => k.timestamp > config.endTime!);
    if (foundEndIdx >= 0) {
      endIdx = foundEndIdx;
    }
  }

  const relevantKlines = klines.slice(startIdx, endIdx);
  if (relevantKlines.length === 0) return null;

  const values: AnchoredVwapDataPoint[] = [];
  let sumTPV = 0;  // Cumulative sum of (Typical Price * Volume)
  let sumVolume = 0;
  let sumSquaredDiff = 0;

  for (const kline of relevantKlines) {
    const typicalPrice = (kline.high + kline.low + kline.close) / 3;
    sumTPV += typicalPrice * kline.volume;
    sumVolume += kline.volume;

    if (sumVolume === 0) continue;

    const vwap = sumTPV / sumVolume;

    let upperBand: number | undefined;
    let lowerBand: number | undefined;

    if (config.showBands) {
      sumSquaredDiff += Math.pow(typicalPrice - vwap, 2) * kline.volume;
      const variance = sumSquaredDiff / sumVolume;
      const stdDev = Math.sqrt(variance);
      upperBand = vwap + stdDev * config.bandMultiplier;
      lowerBand = vwap - stdDev * config.bandMultiplier;
    }

    values.push({
      timestamp: kline.timestamp,
      value: vwap,
      upperBand,
      lowerBand,
    });
  }

  if (values.length === 0) return null;

  return {
    id: config.id,
    name: config.name,
    values,
    color: config.color,
    showBands: config.showBands,
  };
}

// Calculate all enabled Anchored VWAPs
export function calculateAllAnchoredVwaps(
  klines: Kline[],
  configs: AnchoredVwapConfig[]
): AnchoredVwapData[] {
  if (klines.length === 0) return [];

  const results: AnchoredVwapData[] = [];

  for (const config of configs) {
    const vwap = calculateAnchoredVwap(klines, config);
    if (vwap) {
      results.push(vwap);
    }
  }

  return results;
}
