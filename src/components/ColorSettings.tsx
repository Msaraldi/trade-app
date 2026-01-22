import { useState, useCallback, createContext, useContext, ReactNode } from "react";

// ============================================
// TYPES
// ============================================

export interface ChartColors {
  candle: {
    bullish: string;
    bearish: string;
  };
  drawing: {
    trendline: string;
    horizontal: string;
    vertical: string;
    ray: string;
    rectangle: string;
    fibRetracement: string;
    fibExtension: string;
  };
  indicator: {
    vwap: string;
    sma: string;
    anchoredVwap: string;
  };
}

// ============================================
// DEFAULTS & STORAGE
// ============================================

const COLORS_STORAGE_KEY = "chart_colors_v1";

export const DEFAULT_CHART_COLORS: ChartColors = {
  candle: {
    bullish: "#22c55e",
    bearish: "#ef4444",
  },
  drawing: {
    trendline: "#2962FF",
    horizontal: "#FF6D00",
    vertical: "#AA00FF",
    ray: "#2962FF",
    rectangle: "#9C27B0",
    fibRetracement: "#F7C600",
    fibExtension: "#00BCD4",
  },
  indicator: {
    vwap: "#2196F3",
    sma: "#FF9800",
    anchoredVwap: "#E91E63",
  },
};

function loadColors(): ChartColors {
  try {
    const saved = localStorage.getItem(COLORS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Deep merge with defaults to handle new color additions
      return {
        candle: { ...DEFAULT_CHART_COLORS.candle, ...parsed.candle },
        drawing: { ...DEFAULT_CHART_COLORS.drawing, ...parsed.drawing },
        indicator: { ...DEFAULT_CHART_COLORS.indicator, ...parsed.indicator },
      };
    }
  } catch (e) {
    console.error("Failed to load colors:", e);
  }
  return DEFAULT_CHART_COLORS;
}

function saveColors(colors: ChartColors) {
  try {
    localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch (e) {
    console.error("Failed to save colors:", e);
  }
}

// ============================================
// CONTEXT
// ============================================

interface ColorContextType {
  colors: ChartColors;
  setColor: (category: keyof ChartColors, key: string, value: string) => void;
  resetColors: (category?: keyof ChartColors) => void;
}

const ColorContext = createContext<ColorContextType | null>(null);

export function ColorProvider({ children }: { children: ReactNode }) {
  const [colors, setColors] = useState<ChartColors>(loadColors);

  const setColor = useCallback((category: keyof ChartColors, key: string, value: string) => {
    setColors(prev => {
      const newColors = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value,
        },
      };
      saveColors(newColors);
      return newColors;
    });
  }, []);

  const resetColors = useCallback((category?: keyof ChartColors) => {
    setColors(prev => {
      let newColors: ChartColors;
      if (category) {
        newColors = {
          ...prev,
          [category]: DEFAULT_CHART_COLORS[category],
        };
      } else {
        newColors = DEFAULT_CHART_COLORS;
      }
      saveColors(newColors);
      return newColors;
    });
  }, []);

  return (
    <ColorContext.Provider value={{ colors, setColor, resetColors }}>
      {children}
    </ColorContext.Provider>
  );
}

export function useColors() {
  const context = useContext(ColorContext);
  if (!context) {
    // Return default colors if not in provider (fallback)
    return {
      colors: loadColors(),
      setColor: () => {},
      resetColors: () => {},
    };
  }
  return context;
}

// ============================================
// COMPONENTS
// ============================================

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  size?: "sm" | "md";
}

export function ColorPicker({ value, onChange, label, size = "md" }: ColorPickerProps) {
  const sizeClass = size === "sm" ? "w-5 h-5" : "w-6 h-6";
  const inputSize = size === "sm" ? "w-6 h-6" : "w-8 h-8";

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-dark-300 min-w-[80px]">{label}</span>}
      <div className="flex items-center gap-1">
        <div
          className={`${sizeClass} rounded border border-dark-500`}
          style={{ backgroundColor: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputSize} cursor-pointer bg-transparent border-0`}
        />
      </div>
    </div>
  );
}

// Preset color themes
export const COLOR_PRESETS = {
  candle: [
    { name: "Varsayılan", bullish: "#22c55e", bearish: "#ef4444" },
    { name: "TradingView", bullish: "#26a69a", bearish: "#ef5350" },
    { name: "Parlak", bullish: "#00c853", bearish: "#ff1744" },
    { name: "Mavi/Turuncu", bullish: "#2196F3", bearish: "#FF9800" },
  ],
};

interface CandleColorPickerProps {
  bullish: string;
  bearish: string;
  onBullishChange: (color: string) => void;
  onBearishChange: (color: string) => void;
  showPresets?: boolean;
}

export function CandleColorPicker({
  bullish,
  bearish,
  onBullishChange,
  onBearishChange,
  showPresets = true,
}: CandleColorPickerProps) {
  return (
    <div className="space-y-3">
      <ColorPicker value={bullish} onChange={onBullishChange} label="Yükseliş" size="sm" />
      <ColorPicker value={bearish} onChange={onBearishChange} label="Düşüş" size="sm" />

      {showPresets && (
        <div className="border-t border-dark-600 pt-2 mt-2">
          <span className="text-xs text-dark-400 mb-2 block">Temalar</span>
          <div className="flex gap-1.5 flex-wrap">
            {COLOR_PRESETS.candle.map((preset, i) => (
              <button
                key={i}
                onClick={() => {
                  onBullishChange(preset.bullish);
                  onBearishChange(preset.bearish);
                }}
                className="p-1.5 bg-dark-700 hover:bg-dark-600 rounded flex items-center gap-1"
                title={preset.name}
              >
                <span className="w-3 h-3 rounded" style={{ backgroundColor: preset.bullish }} />
                <span className="w-3 h-3 rounded" style={{ backgroundColor: preset.bearish }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Generic settings popup wrapper
interface ColorSettingsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  position?: "top-right" | "bottom-left" | "center";
}

export function ColorSettingsPopup({
  isOpen,
  onClose,
  title,
  children,
  position = "top-right",
}: ColorSettingsPopupProps) {
  if (!isOpen) return null;

  const positionClasses = {
    "top-right": "top-10 right-2",
    "bottom-left": "bottom-10 left-2",
    "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  };

  return (
    <div className={`absolute ${positionClasses[position]} bg-dark-800 border border-dark-600 rounded-lg shadow-xl p-3 z-50 min-w-[180px]`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-white">{title}</span>
        <button onClick={onClose} className="text-dark-400 hover:text-white p-0.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {children}
    </div>
  );
}

// Settings gear button
interface SettingsButtonProps {
  onClick: () => void;
  className?: string;
  size?: "sm" | "md";
}

export function SettingsButton({ onClick, className = "", size = "md" }: SettingsButtonProps) {
  const sizeClasses = size === "sm" ? "w-6 h-6" : "w-7 h-7";
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <button
      onClick={onClick}
      className={`${sizeClasses} flex items-center justify-center bg-dark-800/90 hover:bg-dark-700 text-dark-300 hover:text-white rounded transition-colors ${className}`}
      title="Ayarlar"
    >
      <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>
  );
}
