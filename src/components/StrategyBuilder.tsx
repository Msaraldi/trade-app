import { useState } from "react";

// ============================================
// TYPES
// ============================================

export type IndicatorType =
  | "price"
  | "vwap_1D" | "vwap_1W" | "vwap_1M"
  | "sma_200D" | "sma_50W" | "sma_100W" | "sma_200W"
  | "fib_0" | "fib_236" | "fib_382" | "fib_5" | "fib_618" | "fib_786" | "fib_1"
  | "volume"
  | "rsi"
  | "anchored_vwap";

export type ComparisonOperator =
  | "crosses_above"  // Yukarı kesiyor
  | "crosses_below"  // Aşağı kesiyor
  | "above"          // Üzerinde
  | "below"          // Altında
  | "equals"         // Eşit
  | "between";       // Arasında

export interface StrategyCondition {
  id: string;
  indicator1: IndicatorType;
  operator: ComparisonOperator;
  indicator2: IndicatorType | "value";
  value?: number;
  value2?: number; // For "between" operator
  enabled: boolean;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  conditions: StrategyCondition[];
  logic: "AND" | "OR"; // Tüm koşullar mı yoksa herhangi biri mi
  alertEnabled: boolean;
  alertSound: boolean;
  alertPopup: boolean;
  color: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// ============================================
// CONSTANTS
// ============================================

const INDICATORS: { id: IndicatorType; label: string; category: string }[] = [
  // Price
  { id: "price", label: "Fiyat", category: "Fiyat" },

  // VWAP
  { id: "vwap_1D", label: "VWAP (Günlük)", category: "VWAP" },
  { id: "vwap_1W", label: "VWAP (Haftalık)", category: "VWAP" },
  { id: "vwap_1M", label: "VWAP (Aylık)", category: "VWAP" },
  { id: "anchored_vwap", label: "Çapalı VWAP", category: "VWAP" },

  // SMA
  { id: "sma_200D", label: "SMA 200 Günlük", category: "SMA" },
  { id: "sma_50W", label: "SMA 50 Haftalık", category: "SMA" },
  { id: "sma_100W", label: "SMA 100 Haftalık", category: "SMA" },
  { id: "sma_200W", label: "SMA 200 Haftalık", category: "SMA" },

  // Fibonacci
  { id: "fib_0", label: "Fib %0", category: "Fibonacci" },
  { id: "fib_236", label: "Fib %23.6", category: "Fibonacci" },
  { id: "fib_382", label: "Fib %38.2", category: "Fibonacci" },
  { id: "fib_5", label: "Fib %50", category: "Fibonacci" },
  { id: "fib_618", label: "Fib %61.8", category: "Fibonacci" },
  { id: "fib_786", label: "Fib %78.6", category: "Fibonacci" },
  { id: "fib_1", label: "Fib %100", category: "Fibonacci" },

  // Other
  { id: "volume", label: "Hacim", category: "Diğer" },
  { id: "rsi", label: "RSI (14)", category: "Diğer" },
];

const OPERATORS: { id: ComparisonOperator; label: string; icon: string }[] = [
  { id: "crosses_above", label: "Yukarı Kesiyor", icon: "↗" },
  { id: "crosses_below", label: "Aşağı Kesiyor", icon: "↘" },
  { id: "above", label: "Üzerinde", icon: ">" },
  { id: "below", label: "Altında", icon: "<" },
  { id: "equals", label: "Eşit", icon: "=" },
  { id: "between", label: "Arasında", icon: "↔" },
];

const DEFAULT_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getDefaultStrategy(): Strategy {
  return {
    id: generateId(),
    name: "Yeni Strateji",
    description: "",
    conditions: [],
    logic: "AND",
    alertEnabled: true,
    alertSound: true,
    alertPopup: true,
    color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function getDefaultCondition(): StrategyCondition {
  return {
    id: generateId(),
    indicator1: "price",
    operator: "crosses_above",
    indicator2: "vwap_1D",
    enabled: true,
  };
}

// ============================================
// COMPONENTS
// ============================================

interface StrategyBuilderProps {
  strategies: Strategy[];
  onStrategiesChange: (strategies: Strategy[]) => void;
  isActive: boolean;
}

export function getDefaultStrategies(): Strategy[] {
  return [];
}

export function StrategyBuilder({ strategies, onStrategiesChange, isActive }: StrategyBuilderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  if (!isActive) return null;

  const activeCount = strategies.filter(s => s.enabled).length;

  const addStrategy = () => {
    const newStrategy = getDefaultStrategy();
    setEditingStrategy(newStrategy);
    setShowEditor(true);
  };

  const saveStrategy = (strategy: Strategy) => {
    const exists = strategies.find(s => s.id === strategy.id);
    if (exists) {
      onStrategiesChange(strategies.map(s => s.id === strategy.id ? { ...strategy, updatedAt: Date.now() } : s));
    } else {
      onStrategiesChange([...strategies, strategy]);
    }
    setShowEditor(false);
    setEditingStrategy(null);
  };

  const deleteStrategy = (id: string) => {
    onStrategiesChange(strategies.filter(s => s.id !== id));
  };

  const toggleStrategy = (id: string) => {
    onStrategiesChange(strategies.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const duplicateStrategy = (strategy: Strategy) => {
    const newStrategy = {
      ...strategy,
      id: generateId(),
      name: `${strategy.name} (Kopya)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onStrategiesChange([...strategies, newStrategy]);
  };

  const exportStrategies = () => {
    const data = JSON.stringify(strategies, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `barbar-strategies-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importStrategies = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        try {
          const imported = JSON.parse(text) as Strategy[];
          // Assign new IDs to avoid conflicts
          const withNewIds = imported.map(s => ({
            ...s,
            id: generateId(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }));
          onStrategiesChange([...strategies, ...withNewIds]);
        } catch {
          alert("Geçersiz dosya formatı");
        }
      }
    };
    input.click();
  };

  return (
    <div className="mt-2 bg-dark-700/50 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-dark-600/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-purple-400">🎯 Strateji Oluşturucu</span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 bg-purple-600/30 text-purple-400 rounded text-[10px]">
              {activeCount} aktif
            </span>
          )}
        </div>
        <span className="text-dark-400">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Info */}
          <div className="text-[10px] text-dark-400 pb-2 border-b border-dark-600">
            Birden fazla göstergeyi birleştirerek özel işlem sinyalleri oluşturun
          </div>

          {/* Strategy List */}
          {strategies.length > 0 ? (
            <div className="space-y-1.5">
              {strategies.map(strategy => (
                <div
                  key={strategy.id}
                  className={`p-2 rounded border transition-colors ${
                    strategy.enabled
                      ? "bg-dark-600/50 border-dark-500"
                      : "bg-transparent border-dark-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Color indicator */}
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: strategy.color }}
                      />

                      {/* Enable toggle */}
                      <button
                        onClick={() => toggleStrategy(strategy.id)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                          strategy.enabled
                            ? "bg-purple-600 border-purple-600"
                            : "border-dark-500 hover:border-dark-400"
                        }`}
                      >
                        {strategy.enabled && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>

                      {/* Name */}
                      <div className="min-w-0">
                        <div className={`text-xs truncate ${strategy.enabled ? "text-white" : "text-dark-400"}`}>
                          {strategy.name}
                        </div>
                        <div className="text-[9px] text-dark-500">
                          {strategy.conditions.length} koşul • {strategy.logic === "AND" ? "Tümü" : "Herhangi biri"}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Alert indicator */}
                      {strategy.alertEnabled && (
                        <span className="text-amber-400 text-[10px]" title="Bildirim aktif">
                          🔔
                        </span>
                      )}

                      {/* Edit */}
                      <button
                        onClick={() => {
                          setEditingStrategy(strategy);
                          setShowEditor(true);
                        }}
                        className="p-1 text-dark-400 hover:text-white transition-colors"
                        title="Düzenle"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {/* Duplicate */}
                      <button
                        onClick={() => duplicateStrategy(strategy)}
                        className="p-1 text-dark-400 hover:text-white transition-colors"
                        title="Kopyala"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteStrategy(strategy.id)}
                        className="p-1 text-dark-400 hover:text-danger-400 transition-colors"
                        title="Sil"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-dark-500 text-xs">
              Henüz strateji oluşturulmadı
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-dark-600">
            <button
              onClick={addStrategy}
              className="flex-1 py-1.5 text-[10px] rounded bg-purple-600 text-white hover:bg-purple-500 transition-colors flex items-center justify-center gap-1"
            >
              <span>+</span> Yeni Strateji
            </button>
            {strategies.length > 0 && (
              <>
                <button
                  onClick={exportStrategies}
                  className="px-2 py-1.5 text-[10px] rounded bg-dark-600 text-dark-300 hover:text-white transition-colors"
                  title="Dışa Aktar"
                >
                  📤
                </button>
                <button
                  onClick={importStrategies}
                  className="px-2 py-1.5 text-[10px] rounded bg-dark-600 text-dark-300 hover:text-white transition-colors"
                  title="İçe Aktar"
                >
                  📥
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Strategy Editor Modal */}
      {showEditor && editingStrategy && (
        <StrategyEditorModal
          strategy={editingStrategy}
          onSave={saveStrategy}
          onCancel={() => {
            setShowEditor(false);
            setEditingStrategy(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================
// STRATEGY EDITOR MODAL
// ============================================

interface StrategyEditorModalProps {
  strategy: Strategy;
  onSave: (strategy: Strategy) => void;
  onCancel: () => void;
}

function StrategyEditorModal({ strategy, onSave, onCancel }: StrategyEditorModalProps) {
  const [editedStrategy, setEditedStrategy] = useState<Strategy>(strategy);

  const updateStrategy = (updates: Partial<Strategy>) => {
    setEditedStrategy(prev => ({ ...prev, ...updates }));
  };

  const addCondition = () => {
    const newCondition = getDefaultCondition();
    updateStrategy({
      conditions: [...editedStrategy.conditions, newCondition],
    });
  };

  const updateCondition = (id: string, updates: Partial<StrategyCondition>) => {
    updateStrategy({
      conditions: editedStrategy.conditions.map(c =>
        c.id === id ? { ...c, ...updates } : c
      ),
    });
  };

  const removeCondition = (id: string) => {
    updateStrategy({
      conditions: editedStrategy.conditions.filter(c => c.id !== id),
    });
  };

  const groupedIndicators = INDICATORS.reduce((acc, ind) => {
    if (!acc[ind.category]) acc[ind.category] = [];
    acc[ind.category].push(ind);
    return acc;
  }, {} as Record<string, typeof INDICATORS>);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-600 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white">
            {strategy.id === editedStrategy.id && !strategy.name.includes("Kopya")
              ? "Strateji Düzenle"
              : "Yeni Strateji"}
          </h2>
          <button
            onClick={onCancel}
            className="text-dark-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-dark-400 mb-1">Strateji Adı</label>
              <input
                type="text"
                value={editedStrategy.name}
                onChange={(e) => updateStrategy({ name: e.target.value })}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                placeholder="Örn: VWAP + SMA Kesişimi"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-dark-400 mb-1">Açıklama (Opsiyonel)</label>
              <textarea
                value={editedStrategy.description}
                onChange={(e) => updateStrategy({ description: e.target.value })}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500 resize-none"
                rows={2}
                placeholder="Bu strateji ne zaman sinyal verir?"
              />
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-dark-400">Koşullar</label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-dark-500">Mantık:</span>
                <select
                  value={editedStrategy.logic}
                  onChange={(e) => updateStrategy({ logic: e.target.value as "AND" | "OR" })}
                  className="px-2 py-1 bg-dark-700 border border-dark-600 rounded text-xs text-white"
                >
                  <option value="AND">Tümü Sağlanmalı (VE)</option>
                  <option value="OR">Herhangi Biri (VEYA)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              {editedStrategy.conditions.map((condition, index) => (
                <div
                  key={condition.id}
                  className="p-3 bg-dark-700/50 rounded-lg border border-dark-600"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-dark-500 w-4">{index + 1}.</span>
                    <button
                      onClick={() => updateCondition(condition.id, { enabled: !condition.enabled })}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        condition.enabled
                          ? "bg-purple-600 border-purple-600"
                          : "border-dark-500"
                      }`}
                    >
                      {condition.enabled && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    <span className="flex-1 text-xs text-dark-300">Koşul {index + 1}</span>
                    <button
                      onClick={() => removeCondition(condition.id)}
                      className="text-dark-400 hover:text-danger-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Indicator 1 */}
                    <select
                      value={condition.indicator1}
                      onChange={(e) => updateCondition(condition.id, { indicator1: e.target.value as IndicatorType })}
                      className="px-2 py-1.5 bg-dark-600 border border-dark-500 rounded text-xs text-white"
                    >
                      {Object.entries(groupedIndicators).map(([category, indicators]) => (
                        <optgroup key={category} label={category}>
                          {indicators.map(ind => (
                            <option key={ind.id} value={ind.id}>{ind.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    {/* Operator */}
                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(condition.id, { operator: e.target.value as ComparisonOperator })}
                      className="px-2 py-1.5 bg-dark-600 border border-dark-500 rounded text-xs text-white"
                    >
                      {OPERATORS.map(op => (
                        <option key={op.id} value={op.id}>{op.icon} {op.label}</option>
                      ))}
                    </select>

                    {/* Indicator 2 or Value */}
                    {condition.operator === "between" ? (
                      <div className="flex gap-1">
                        <input
                          type="number"
                          value={condition.value || ""}
                          onChange={(e) => updateCondition(condition.id, { value: parseFloat(e.target.value), indicator2: "value" })}
                          className="w-1/2 px-2 py-1.5 bg-dark-600 border border-dark-500 rounded text-xs text-white"
                          placeholder="Min"
                        />
                        <input
                          type="number"
                          value={condition.value2 || ""}
                          onChange={(e) => updateCondition(condition.id, { value2: parseFloat(e.target.value) })}
                          className="w-1/2 px-2 py-1.5 bg-dark-600 border border-dark-500 rounded text-xs text-white"
                          placeholder="Max"
                        />
                      </div>
                    ) : (
                      <select
                        value={condition.indicator2}
                        onChange={(e) => updateCondition(condition.id, { indicator2: e.target.value as IndicatorType | "value" })}
                        className="px-2 py-1.5 bg-dark-600 border border-dark-500 rounded text-xs text-white"
                      >
                        <option value="value">Sabit Değer</option>
                        {Object.entries(groupedIndicators).map(([category, indicators]) => (
                          <optgroup key={category} label={category}>
                            {indicators.map(ind => (
                              <option key={ind.id} value={ind.id}>{ind.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Value input if comparing to value */}
                  {condition.indicator2 === "value" && condition.operator !== "between" && (
                    <div className="mt-2">
                      <input
                        type="number"
                        value={condition.value || ""}
                        onChange={(e) => updateCondition(condition.id, { value: parseFloat(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-dark-600 border border-dark-500 rounded text-xs text-white"
                        placeholder="Karşılaştırma değeri"
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Add Condition Button */}
              <button
                onClick={addCondition}
                className="w-full py-2 border-2 border-dashed border-dark-600 rounded-lg text-xs text-dark-400 hover:text-white hover:border-dark-500 transition-colors"
              >
                + Koşul Ekle
              </button>
            </div>
          </div>

          {/* Alert Settings */}
          <div>
            <label className="block text-xs text-dark-400 mb-2">Bildirim Ayarları</label>
            <div className="p-3 bg-dark-700/50 rounded-lg border border-dark-600 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editedStrategy.alertEnabled}
                  onChange={(e) => updateStrategy({ alertEnabled: e.target.checked })}
                  className="rounded"
                />
                <span className="text-xs text-white">Bildirim Aktif</span>
              </label>

              {editedStrategy.alertEnabled && (
                <div className="pl-6 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editedStrategy.alertSound}
                      onChange={(e) => updateStrategy({ alertSound: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-xs text-dark-300">🔊 Sesli Uyarı</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editedStrategy.alertPopup}
                      onChange={(e) => updateStrategy({ alertPopup: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-xs text-dark-300">💬 Popup Bildirimi</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs text-dark-400 mb-2">Renk</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editedStrategy.color}
                onChange={(e) => updateStrategy({ color: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
              />
              <div className="flex gap-1">
                {DEFAULT_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => updateStrategy({ color })}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      editedStrategy.color === color ? "ring-2 ring-white ring-offset-2 ring-offset-dark-800 scale-110" : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-dark-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-dark-300 hover:text-white transition-colors"
          >
            İptal
          </button>
          <button
            onClick={() => onSave(editedStrategy)}
            disabled={!editedStrategy.name.trim() || editedStrategy.conditions.length === 0}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
