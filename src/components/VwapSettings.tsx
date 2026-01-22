import { useState } from "react";
import { ColorPicker } from "./ColorSettings";

// ============================================
// TYPES
// ============================================

export type VwapAnchor = "Session" | "Week" | "Month" | "Quarter" | "Year";
export type VwapSource = "hlc3" | "hl2" | "ohlc4" | "close";

export interface VwapConfig {
  id: string;
  enabled: boolean;
  anchor: VwapAnchor;
  source: VwapSource;
  color: string;
  lineWidth: number;
  showBands: boolean;
  bandMultiplier1: number;
  bandMultiplier2: number;
  bandMultiplier3: number;
  bandsEnabled: [boolean, boolean, boolean];
}

export interface VwapDataPoint {
  timestamp: number;
  value: number;
  upperBand1?: number;
  lowerBand1?: number;
  upperBand2?: number;
  lowerBand2?: number;
  upperBand3?: number;
  lowerBand3?: number;
}

export interface VwapData {
  id: string;
  anchor: VwapAnchor;
  values: VwapDataPoint[];
  color: string;
  showBands: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const ANCHOR_OPTIONS: { id: VwapAnchor; label: string; description: string }[] = [
  { id: "Session", label: "Oturum", description: "Günlük (UTC 00:00)" },
  { id: "Week", label: "Hafta", description: "Haftalık (Pazartesi)" },
  { id: "Month", label: "Ay", description: "Aylık" },
  { id: "Quarter", label: "Çeyrek", description: "3 Aylık" },
  { id: "Year", label: "Yıl", description: "Yıllık" },
];

const SOURCE_OPTIONS: { id: VwapSource; label: string; formula: string }[] = [
  { id: "hlc3", label: "HLC3", formula: "(H+L+C)/3" },
  { id: "hl2", label: "HL2", formula: "(H+L)/2" },
  { id: "ohlc4", label: "OHLC4", formula: "(O+H+L+C)/4" },
  { id: "close", label: "Kapanış", formula: "C" },
];

const DEFAULT_COLORS = ["#2962FF", "#E91E63", "#00BCD4", "#FF9800", "#9C27B0"];

// ============================================
// DEFAULT CONFIG
// ============================================

export function getDefaultVwapConfigs(): VwapConfig[] {
  return [
    {
      id: "vwap-1",
      enabled: true,
      anchor: "Session",
      source: "hlc3",
      color: "#2962FF",
      lineWidth: 2,
      showBands: false,
      bandMultiplier1: 1,
      bandMultiplier2: 2,
      bandMultiplier3: 3,
      bandsEnabled: [true, true, false],
    },
  ];
}

// ============================================
// COMPONENT
// ============================================

interface VwapSettingsProps {
  configs: VwapConfig[];
  onConfigChange: (configs: VwapConfig[]) => void;
  isActive: boolean;
}

export function VwapSettings({ configs, onConfigChange, isActive }: VwapSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!isActive) return null;

  const updateConfig = (id: string, updates: Partial<VwapConfig>) => {
    const newConfigs = configs.map(c => c.id === id ? { ...c, ...updates } : c);
    onConfigChange(newConfigs);
  };

  const addVwap = () => {
    const newId = `vwap-${Date.now()}`;
    const colorIndex = configs.length % DEFAULT_COLORS.length;
    const newConfig: VwapConfig = {
      id: newId,
      enabled: true,
      anchor: "Session",
      source: "hlc3",
      color: DEFAULT_COLORS[colorIndex],
      lineWidth: 2,
      showBands: false,
      bandMultiplier1: 1,
      bandMultiplier2: 2,
      bandMultiplier3: 3,
      bandsEnabled: [true, true, false],
    };
    onConfigChange([...configs, newConfig]);
    setEditingId(newId);
  };

  const removeVwap = (id: string) => {
    onConfigChange(configs.filter(c => c.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const enabledCount = configs.filter(c => c.enabled).length;

  return (
    <div className="mt-2 bg-dark-700/50 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-dark-600/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-primary-400">VWAP</span>
          {enabledCount > 0 && (
            <span className="px-1.5 py-0.5 bg-primary-600/30 text-primary-400 rounded text-[10px]">
              {enabledCount} aktif
            </span>
          )}
        </div>
        <span className="text-dark-400">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* VWAP List */}
          {configs.map((config) => (
            <div key={config.id} className="bg-dark-800 rounded-lg overflow-hidden">
              {/* VWAP Header Row */}
              <div className="flex items-center gap-2 p-2">
                {/* Enable/Disable */}
                <button
                  onClick={() => updateConfig(config.id, { enabled: !config.enabled })}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                    config.enabled ? "bg-primary-600 border-primary-600" : "border-dark-500 hover:border-dark-400"
                  }`}
                >
                  {config.enabled && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Color */}
                <input
                  type="color"
                  value={config.color}
                  onChange={(e) => updateConfig(config.id, { color: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 flex-shrink-0"
                />

                {/* Label */}
                <span className={`text-xs flex-1 ${config.enabled ? "text-white" : "text-dark-400"}`}>
                  VWAP ({ANCHOR_OPTIONS.find(a => a.id === config.anchor)?.label})
                </span>

                {/* Bands Toggle */}
                <button
                  onClick={() => updateConfig(config.id, { showBands: !config.showBands })}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    config.showBands ? "bg-primary-600/30 text-primary-400" : "bg-dark-600 text-dark-400 hover:text-dark-300"
                  }`}
                  title="Standart Sapma Bantları"
                >
                  ±σ
                </button>

                {/* Settings */}
                <button
                  onClick={() => setEditingId(editingId === config.id ? null : config.id)}
                  className={`p-1 rounded transition-colors ${
                    editingId === config.id ? "bg-primary-600/30 text-primary-400" : "text-dark-400 hover:text-white"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {/* Delete */}
                {configs.length > 1 && (
                  <button
                    onClick={() => removeVwap(config.id)}
                    className="p-1 text-dark-400 hover:text-danger-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Settings Panel */}
              {editingId === config.id && (
                <div className="px-3 pb-3 space-y-3 border-t border-dark-700">
                  {/* Girdiler Header */}
                  <div className="pt-3 pb-1 border-b border-dark-600">
                    <span className="text-[10px] text-dark-400 uppercase tracking-wider">Girdiler</span>
                  </div>

                  {/* Anchor Period */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-300">Anchor Periyodu</span>
                    <select
                      value={config.anchor}
                      onChange={(e) => updateConfig(config.id, { anchor: e.target.value as VwapAnchor })}
                      className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary-500"
                    >
                      {ANCHOR_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Source */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-300">Kaynak</span>
                    <select
                      value={config.source}
                      onChange={(e) => updateConfig(config.id, { source: e.target.value as VwapSource })}
                      className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary-500"
                    >
                      {SOURCE_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label} {opt.formula}</option>
                      ))}
                    </select>
                  </div>

                  {/* Bands Section */}
                  {config.showBands && (
                    <>
                      <div className="pt-2 pb-1 border-b border-dark-600">
                        <span className="text-[10px] text-dark-400 uppercase tracking-wider">Bantlar (Standart Sapma)</span>
                      </div>

                      {/* Band 1 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const newBands = [...config.bandsEnabled] as [boolean, boolean, boolean];
                            newBands[0] = !newBands[0];
                            updateConfig(config.id, { bandsEnabled: newBands });
                          }}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            config.bandsEnabled[0] ? "bg-primary-600 border-primary-600" : "border-dark-500"
                          }`}
                        >
                          {config.bandsEnabled[0] && <span className="text-white text-[10px]">✓</span>}
                        </button>
                        <span className="text-xs text-dark-300 w-16">Çarpan 1</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="10"
                          value={config.bandMultiplier1}
                          onChange={(e) => updateConfig(config.id, { bandMultiplier1: parseFloat(e.target.value) || 1 })}
                          className="flex-1 bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs text-white w-16"
                          disabled={!config.bandsEnabled[0]}
                        />
                      </div>

                      {/* Band 2 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const newBands = [...config.bandsEnabled] as [boolean, boolean, boolean];
                            newBands[1] = !newBands[1];
                            updateConfig(config.id, { bandsEnabled: newBands });
                          }}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            config.bandsEnabled[1] ? "bg-primary-600 border-primary-600" : "border-dark-500"
                          }`}
                        >
                          {config.bandsEnabled[1] && <span className="text-white text-[10px]">✓</span>}
                        </button>
                        <span className="text-xs text-dark-300 w-16">Çarpan 2</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="10"
                          value={config.bandMultiplier2}
                          onChange={(e) => updateConfig(config.id, { bandMultiplier2: parseFloat(e.target.value) || 2 })}
                          className="flex-1 bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs text-white w-16"
                          disabled={!config.bandsEnabled[1]}
                        />
                      </div>

                      {/* Band 3 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const newBands = [...config.bandsEnabled] as [boolean, boolean, boolean];
                            newBands[2] = !newBands[2];
                            updateConfig(config.id, { bandsEnabled: newBands });
                          }}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            config.bandsEnabled[2] ? "bg-primary-600 border-primary-600" : "border-dark-500"
                          }`}
                        >
                          {config.bandsEnabled[2] && <span className="text-white text-[10px]">✓</span>}
                        </button>
                        <span className="text-xs text-dark-300 w-16">Çarpan 3</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="10"
                          value={config.bandMultiplier3}
                          onChange={(e) => updateConfig(config.id, { bandMultiplier3: parseFloat(e.target.value) || 3 })}
                          className="flex-1 bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs text-white w-16"
                          disabled={!config.bandsEnabled[2]}
                        />
                      </div>
                    </>
                  )}

                  {/* Style Section */}
                  <div className="pt-2 pb-1 border-b border-dark-600">
                    <span className="text-[10px] text-dark-400 uppercase tracking-wider">Stil</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-300">Çizgi Kalınlığı</span>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={config.lineWidth}
                      onChange={(e) => updateConfig(config.id, { lineWidth: parseInt(e.target.value) || 2 })}
                      className="w-16 bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add VWAP Button */}
          <button
            onClick={addVwap}
            className="w-full py-2 text-xs text-primary-400 hover:text-primary-300 bg-dark-800 hover:bg-dark-700 rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            VWAP Ekle
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// CALCULATION
// ============================================

interface Kline {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function getSourcePrice(kline: Kline, source: VwapSource): number {
  switch (source) {
    case "hlc3":
      return (kline.high + kline.low + kline.close) / 3;
    case "hl2":
      return (kline.high + kline.low) / 2;
    case "ohlc4":
      return (kline.open + kline.high + kline.low + kline.close) / 4;
    case "close":
      return kline.close;
    default:
      return (kline.high + kline.low + kline.close) / 3;
  }
}

function getAnchorStart(timestamp: number, anchor: VwapAnchor): number {
  const date = new Date(timestamp);

  switch (anchor) {
    case "Session":
      // Daily reset at UTC 00:00
      date.setUTCHours(0, 0, 0, 0);
      return date.getTime();
    case "Week":
      // Weekly reset on Monday UTC 00:00
      date.setUTCHours(0, 0, 0, 0);
      const day = date.getUTCDay();
      const diff = day === 0 ? 6 : day - 1; // Monday = 0
      date.setUTCDate(date.getUTCDate() - diff);
      return date.getTime();
    case "Month":
      date.setUTCDate(1);
      date.setUTCHours(0, 0, 0, 0);
      return date.getTime();
    case "Quarter":
      date.setUTCDate(1);
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCMonth(Math.floor(date.getUTCMonth() / 3) * 3);
      return date.getTime();
    case "Year":
      date.setUTCMonth(0, 1);
      date.setUTCHours(0, 0, 0, 0);
      return date.getTime();
    default:
      return date.getTime();
  }
}

export function calculateVwap(klines: Kline[], config: VwapConfig): VwapData | null {
  if (!config.enabled || klines.length === 0) return null;

  const values: VwapDataPoint[] = [];
  let currentAnchorStart = -1;
  let sumTPV = 0;
  let sumVolume = 0;
  let prices: { price: number; volume: number }[] = [];

  for (const kline of klines) {
    const anchorStart = getAnchorStart(kline.open_time, config.anchor);

    // Reset on new anchor period
    if (anchorStart !== currentAnchorStart) {
      currentAnchorStart = anchorStart;
      sumTPV = 0;
      sumVolume = 0;
      prices = [];
    }

    const sourcePrice = getSourcePrice(kline, config.source);
    sumTPV += sourcePrice * kline.volume;
    sumVolume += kline.volume;

    if (sumVolume === 0) continue;

    const vwap = sumTPV / sumVolume;
    prices.push({ price: sourcePrice, volume: kline.volume });

    // Calculate bands if enabled
    let upperBand1: number | undefined;
    let lowerBand1: number | undefined;
    let upperBand2: number | undefined;
    let lowerBand2: number | undefined;
    let upperBand3: number | undefined;
    let lowerBand3: number | undefined;

    if (config.showBands && prices.length > 1) {
      // Volume-weighted standard deviation
      let sumSquaredDiff = 0;
      for (const p of prices) {
        sumSquaredDiff += Math.pow(p.price - vwap, 2) * p.volume;
      }
      const variance = sumSquaredDiff / sumVolume;
      const stdDev = Math.sqrt(variance);

      if (config.bandsEnabled[0]) {
        upperBand1 = vwap + stdDev * config.bandMultiplier1;
        lowerBand1 = vwap - stdDev * config.bandMultiplier1;
      }
      if (config.bandsEnabled[1]) {
        upperBand2 = vwap + stdDev * config.bandMultiplier2;
        lowerBand2 = vwap - stdDev * config.bandMultiplier2;
      }
      if (config.bandsEnabled[2]) {
        upperBand3 = vwap + stdDev * config.bandMultiplier3;
        lowerBand3 = vwap - stdDev * config.bandMultiplier3;
      }
    }

    values.push({
      timestamp: kline.open_time,
      value: vwap,
      upperBand1,
      lowerBand1,
      upperBand2,
      lowerBand2,
      upperBand3,
      lowerBand3,
    });
  }

  if (values.length === 0) return null;

  return {
    id: config.id,
    anchor: config.anchor,
    values,
    color: config.color,
    showBands: config.showBands,
  };
}

export function calculateAllVwaps(klines: Kline[], configs: VwapConfig[]): VwapData[] {
  if (klines.length === 0) return [];

  const results: VwapData[] = [];
  for (const config of configs) {
    const vwap = calculateVwap(klines, config);
    if (vwap) results.push(vwap);
  }
  return results;
}
