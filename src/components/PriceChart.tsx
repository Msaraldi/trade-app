import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CustomChart } from "./CustomChart";
import { VwapConfig } from "./VwapSettings";
import { SmaConfig } from "./SmaSettings";
import { AnchoredVwapConfig } from "./AnchoredVwapSettings";

type MarketCategory = "spot" | "linear" | "inverse";

interface TickerInfo {
  symbol: string;
  last_price: number;
  price_24h_pcnt: number;
  high_price_24h: number;
  low_price_24h: number;
  volume_24h: number;
  turnover_24h: number;
  category: MarketCategory;
}

interface PriceChartProps {
  symbol: string;
  category: MarketCategory;
  vwapConfigs?: VwapConfig[];
  smaConfigs?: SmaConfig[];
  anchoredVwapConfigs?: AnchoredVwapConfig[];
  onAnchoredVwapConfigChange?: (configs: AnchoredVwapConfig[]) => void;
  selectingAnchor?: { configId: string; type: "start" | "end" } | null;
  onSelectingAnchorChange?: (anchor: { configId: string; type: "start" | "end" } | null) => void;
}

export function PriceChart({
  symbol,
  category,
  vwapConfigs = [],
  smaConfigs = [],
  anchoredVwapConfigs = [],
  onAnchoredVwapConfigChange,
  selectingAnchor,
  onSelectingAnchorChange,
}: PriceChartProps) {
  const [ticker, setTicker] = useState<TickerInfo | null>(null);

  // Load ticker for header
  const loadTicker = useCallback(async () => {
    try {
      const data = await invoke<TickerInfo>("get_ticker", { symbol, category });
      setTicker(data);
    } catch (e) {
      console.error("Ticker error:", e);
    }
  }, [symbol, category]);

  useEffect(() => {
    loadTicker();
    const interval = setInterval(loadTicker, 3000);
    return () => clearInterval(interval);
  }, [loadTicker]);

  const priceColor = ticker && ticker.price_24h_pcnt >= 0 ? "text-primary-400" : "text-danger-400";

  return (
    <div className="bg-dark-900 rounded-xl border border-dark-700 h-full flex flex-col min-h-0">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-dark-700">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">{symbol}</span>
          {ticker && (
            <>
              <span className="text-lg font-medium text-white">
                ${ticker.last_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-sm ${priceColor}`}>
                {ticker.price_24h_pcnt >= 0 ? "+" : ""}
                {(ticker.price_24h_pcnt * 100).toFixed(2)}%
              </span>
            </>
          )}
        </div>

        {ticker && (
          <div className="flex items-center gap-4 text-xs text-dark-400">
            <span>H: <span className="text-white">${ticker.high_price_24h.toLocaleString()}</span></span>
            <span>L: <span className="text-white">${ticker.low_price_24h.toLocaleString()}</span></span>
            <span>Vol: <span className="text-white">{(ticker.turnover_24h / 1000000).toFixed(1)}M</span></span>
          </div>
        )}
      </div>

      {/* Custom Chart with Drawing Support */}
      <div className="flex-1 min-h-0">
        <CustomChart
          symbol={symbol}
          category={category}
          interval="15"
          vwapConfigs={vwapConfigs}
          smaConfigs={smaConfigs}
          anchoredVwapConfigs={anchoredVwapConfigs}
          onAnchoredVwapConfigChange={onAnchoredVwapConfigChange}
          selectingAnchor={selectingAnchor}
          onSelectingAnchorChange={onSelectingAnchorChange}
        />
      </div>
    </div>
  );
}
