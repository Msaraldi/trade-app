import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";

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
  max_leverage: number;
}

type SortOption = "volume" | "change" | "name";
type SortDirection = "desc" | "asc";

interface SymbolListProps {
  selectedSymbol: string;
  selectedCategory: MarketCategory;
  onSelectSymbol: (symbol: string, category: MarketCategory) => void;
}

const CATEGORIES: { id: MarketCategory; label: string }[] = [
  { id: "linear", label: "Futures" },
  { id: "spot", label: "Spot" },
  { id: "inverse", label: "Inverse" },
];

export function SymbolList({ selectedSymbol, selectedCategory, onSelectSymbol }: SymbolListProps) {
  const { t } = useTranslation();
  const [tickers, setTickers] = useState<TickerInfo[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<MarketCategory>(selectedCategory);
  const [sortBy, setSortBy] = useState<SortOption>("volume");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const loadTickers = useCallback(async () => {
    try {
      const allTickers = await invoke<TickerInfo[]>("get_all_tickers", {
        category: activeCategory
      });

      // Filter based on category - USDT pairs for spot/linear, USD for inverse
      const filtered = allTickers
        .filter(t => {
          if (activeCategory === "inverse") {
            return t.symbol.endsWith("USD");
          }
          return t.symbol.endsWith("USDT");
        })
        // Sort by turnover (USD volume) first to get top coins
        .sort((a, b) => b.turnover_24h - a.turnover_24h)
        .slice(0, 100); // Get top 100 by USD volume

      setTickers(filtered);
      setLoading(false);
    } catch (e) {
      console.error("Failed to load tickers:", e);
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    setLoading(true);
    loadTickers();

    // Refresh every 10 seconds
    const interval = window.setInterval(loadTickers, 10000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadTickers]);

  const handleCategoryChange = (cat: MarketCategory) => {
    setActiveCategory(cat);
    setSearch("");
  };

  // Handle sort option click - toggle direction if same option clicked
  const handleSortClick = (option: SortOption) => {
    if (sortBy === option) {
      // Toggle direction
      setSortDirection(prev => prev === "desc" ? "asc" : "desc");
    } else {
      // New option - start with desc
      setSortBy(option);
      setSortDirection("desc");
    }
  };

  // Sort tickers based on selected option and direction
  const sortedTickers = [...tickers].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "volume":
        // Use turnover (USD volume) for more meaningful sorting
        comparison = b.turnover_24h - a.turnover_24h;
        break;
      case "change":
        // Sort by actual change value, not absolute
        comparison = b.price_24h_pcnt - a.price_24h_pcnt;
        break;
      case "name":
        comparison = a.symbol.localeCompare(b.symbol);
        break;
      default:
        comparison = 0;
    }
    // Apply direction
    return sortDirection === "desc" ? comparison : -comparison;
  });

  const filteredTickers = sortedTickers.filter((ticker) =>
    ticker.symbol.toLowerCase().includes(search.toLowerCase())
  );

  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (price >= 1) {
      return price.toFixed(4);
    } else {
      return price.toFixed(6);
    }
  };

  const getQuoteCoin = (symbol: string) => {
    if (symbol.endsWith("USDT")) return "/USDT";
    if (symbol.endsWith("USD")) return "/USD";
    if (symbol.endsWith("USDC")) return "/USDC";
    return "";
  };

  const getBaseCoin = (symbol: string) => {
    return symbol
      .replace("USDT", "")
      .replace("USDC", "")
      .replace(/USD$/, "");
  };

  return (
    <div className="bg-dark-900 h-full flex flex-col">
      {/* Category Tabs */}
      <div className="flex border-b border-dark-700">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
              activeCategory === cat.id
                ? "text-primary-400 border-b-2 border-primary-400 bg-dark-800"
                : "text-dark-400 hover:text-white"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="p-2 border-b border-dark-700">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("common.search") + "..."}
          className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
        />
      </div>

      {/* Sort Options */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-dark-700 bg-dark-850">
        <span className="text-xs text-dark-500 mr-1">{t("common.sortBy") || "Sort"}:</span>
        {[
          { id: "volume" as SortOption, label: "Vol" },
          { id: "change" as SortOption, label: "%" },
          { id: "name" as SortOption, label: "A-Z" },
        ].map((option) => (
          <button
            key={option.id}
            onClick={() => handleSortClick(option.id)}
            className={`px-2 py-0.5 text-xs rounded transition-colors flex items-center gap-0.5 ${
              sortBy === option.id
                ? "bg-primary-600 text-white"
                : "text-dark-400 hover:text-white hover:bg-dark-700"
            }`}
          >
            {option.label}
            {sortBy === option.id && (
              <span className="text-[10px]">{sortDirection === "desc" ? "↓" : "↑"}</span>
            )}
          </button>
        ))}
      </div>

      {/* Symbol list - max ~15 items visible, scroll for more */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
        {loading ? (
          <div className="flex items-center justify-center h-32 text-dark-400">
            {t("common.loading")}
          </div>
        ) : filteredTickers.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-dark-500 text-sm">
            {t("common.noData") || "No data"}
          </div>
        ) : (
          <div className="divide-y divide-dark-800">
            {filteredTickers.map((ticker) => {
              const isSelected = ticker.symbol === selectedSymbol && activeCategory === selectedCategory;
              const priceChange = ticker.price_24h_pcnt || 0;
              const changeColor = priceChange >= 0 ? "text-primary-400" : "text-danger-400";

              return (
                <button
                  key={ticker.symbol}
                  onClick={() => onSelectSymbol(ticker.symbol, activeCategory)}
                  className={`w-full px-3 py-2 flex items-center justify-between hover:bg-dark-800 transition-colors ${
                    isSelected ? "bg-dark-800" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <div className="w-1 h-4 bg-primary-500 rounded-full"></div>
                    )}
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-1">
                        <span className={`text-sm font-medium ${isSelected ? "text-white" : "text-dark-200"}`}>
                          {getBaseCoin(ticker.symbol)}
                        </span>
                        <span className="text-xs text-dark-500">{getQuoteCoin(ticker.symbol)}</span>
                      </div>
                      {/* Show leverage for futures */}
                      {activeCategory !== "spot" && ticker.max_leverage > 0 && (
                        <span className="text-[10px] px-1 py-0.5 bg-yellow-900/40 text-yellow-400 rounded">
                          {ticker.max_leverage}x
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-white font-medium">
                      ${formatPrice(ticker.last_price)}
                    </div>
                    <div className={`text-xs ${changeColor}`}>
                      {priceChange >= 0 ? "+" : ""}
                      {(priceChange * 100).toFixed(2)}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
