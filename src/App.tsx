import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { ApiSettings } from "./components/ApiSettings";
import { PriceChart } from "./components/PriceChart";
import { SymbolList } from "./components/SymbolList";
import { VwapSettings, VwapConfig, getDefaultVwapConfigs } from "./components/VwapSettings";
import { SmaSettings, SmaConfig, getDefaultSmaConfigs } from "./components/SmaSettings";
import { AnchoredVwapSettings, AnchoredVwapConfig, getDefaultAnchoredVwapConfigs } from "./components/AnchoredVwapSettings";
import { StrategyBuilder, Strategy, getDefaultStrategies } from "./components/StrategyBuilder";
import { ColorProvider } from "./components/ColorSettings";
import { ResizablePanel } from "./components/ResizablePanel";

// Types
interface RiskCalculation {
  position_size: number;
  risk_amount: number;
  risk_percent: number;
  potential_loss: number;
  potential_profit: number;
  risk_reward_ratio: number;
}

interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  can_trade: boolean;
}

interface ConnectionState {
  is_connected: boolean;
  is_demo: boolean;
  exchange: string;
  error: string | null;
}

interface WalletBalance {
  total_equity: number;
  available_balance: number;
  coins: Array<{
    coin: string;
    equity: number;
    available: number;
    unrealized_pnl: number;
  }>;
}

// Module ID to translation key mapping
const moduleTranslationKeys: Record<string, string> = {
  stop_loss: "stopLoss",
  batch_trading: "batchTrading",
  vwap_analyzer: "vwapAnalyzer",
  risk_monitor: "riskMonitor",
  sma_analyzer: "smaAnalyzer",
  anchored_vwap: "anchoredVwap",
  strategy_builder: "strategyBuilder",
};

function App() {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    is_connected: false,
    is_demo: true,
    exchange: "",
    error: null,
  });
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [selectedCategory, setSelectedCategory] = useState<"spot" | "linear" | "inverse">("linear");

  // Risk Calculator State
  const [accountBalance, setAccountBalance] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [entryPrice, setEntryPrice] = useState(100);
  const [stopPrice, setStopPrice] = useState(95);
  const [takeProfitPrice, setTakeProfitPrice] = useState(110);
  const [riskResult, setRiskResult] = useState<RiskCalculation | null>(null);

  // Active tab for right panel
  const [activeTab, setActiveTab] = useState<"modules" | "risk">("modules");

  // VWAP Configuration
  const [vwapConfigs, setVwapConfigs] = useState<VwapConfig[]>(getDefaultVwapConfigs());

  // SMA Configuration
  const [smaConfigs, setSmaConfigs] = useState<SmaConfig[]>(getDefaultSmaConfigs());

  // Anchored VWAP Configuration
  const [anchoredVwapConfigs, setAnchoredVwapConfigs] = useState<AnchoredVwapConfig[]>(getDefaultAnchoredVwapConfigs());
  const [selectingAnchor, setSelectingAnchor] = useState<{ configId: string; type: "start" | "end" } | null>(null);

  // Strategy Builder Configuration
  const [strategies, setStrategies] = useState<Strategy[]>(getDefaultStrategies());

  // Sidebar collapse state
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  useEffect(() => {
    // Get version and modules on mount
    invoke<string>("get_version").then(setVersion);
    invoke<ModuleInfo[]>("list_modules").then(setModules);
    loadConnectionStatus();
  }, []);

  // Keyboard shortcut: Ctrl+R / Cmd+R to refresh
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        window.location.reload();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadConnectionStatus = async () => {
    try {
      const status = await invoke<ConnectionState>("get_connection_status");
      setConnectionState(status);

      if (status.is_connected) {
        loadBalance();
      }
    } catch (e) {
      console.error("Failed to load connection status:", e);
    }
  };

  const loadBalance = async () => {
    try {
      const bal = await invoke<WalletBalance>("get_wallet_balance");
      setBalance(bal);
      // Update account balance in risk calculator
      setAccountBalance(bal.total_equity);
    } catch (e) {
      console.error("Failed to load balance:", e);
    }
  };

  async function calculateRisk() {
    const result = await invoke<RiskCalculation>("calculate_risk", {
      request: {
        account_balance: accountBalance,
        risk_percent: riskPercent,
        entry_price: entryPrice,
        stop_price: stopPrice,
        take_profit_price: takeProfitPrice,
      },
    });
    setRiskResult(result);
  }

  async function toggleModule(moduleId: string, active: boolean) {
    await invoke("toggle_module", { moduleId, active });
    const updatedModules = await invoke<ModuleInfo[]>("list_modules");
    setModules(updatedModules);
  }

  const handleConnectionChange = (state: ConnectionState) => {
    setConnectionState(state);
    if (state.is_connected) {
      loadBalance();
    } else {
      setBalance(null);
    }
  };

  // Get translated module info
  const getModuleTranslation = (moduleId: string) => {
    const key = moduleTranslationKeys[moduleId];
    if (key) {
      return {
        name: t(`modules.${key}.name`),
        description: t(`modules.${key}.description`),
      };
    }
    return null;
  };

  return (
    <ColorProvider>
    <div className="h-screen bg-dark-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-dark-900 border-b border-dark-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-primary-400">{t("app.name")}</h1>
            <span className="text-xs text-dark-500">v{version}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Balance display */}
            {connectionState.is_connected && balance && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-dark-400">{t("balance.totalEquity")}:</span>
                  <span className="text-white font-medium">${balance.total_equity.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-dark-400">{t("balance.available")}:</span>
                  <span className="text-primary-400 font-medium">${balance.available_balance.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Sidebar Toggle Buttons */}
            <div className="flex items-center gap-1 border-r border-dark-700 pr-4 mr-2">
              <button
                onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
                className={`p-1.5 rounded-lg transition-colors ${
                  leftSidebarOpen
                    ? "bg-primary-600 text-white"
                    : "bg-dark-700 text-dark-400 hover:text-white hover:bg-dark-600"
                }`}
                title={leftSidebarOpen ? "Sembol Listesini Gizle" : "Sembol Listesini Göster"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                </svg>
              </button>
              <button
                onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                className={`p-1.5 rounded-lg transition-colors ${
                  rightSidebarOpen
                    ? "bg-primary-600 text-white"
                    : "bg-dark-700 text-dark-400 hover:text-white hover:bg-dark-600"
                }`}
                title={rightSidebarOpen ? "Paneli Gizle" : "Paneli Göster"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M15 3v18" />
                </svg>
              </button>
            </div>

            <LanguageSwitcher />

            {/* Connection status / API button */}
            <button
              onClick={() => setShowApiSettings(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                connectionState.is_connected
                  ? "bg-primary-900/30 text-primary-400 hover:bg-primary-900/50"
                  : "bg-dark-700 text-dark-300 hover:bg-dark-600"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${
                connectionState.is_connected ? "bg-primary-500" : "bg-dark-500"
              }`}></div>
              {connectionState.is_connected
                ? `${connectionState.exchange} ${connectionState.is_demo ? "(Testnet)" : ""}`
                : t("app.demoMode")}
            </button>

            {/* Refresh button */}
            <button
              onClick={() => window.location.reload()}
              className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
              title={t("common.refresh")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar - Symbol List */}
        <ResizablePanel
          side="left"
          defaultWidth={256}
          minWidth={200}
          maxWidth={400}
          isOpen={leftSidebarOpen}
          onToggle={() => setLeftSidebarOpen(!leftSidebarOpen)}
          title="Semboller"
          floatable={true}
          className="border-r border-dark-700"
        >
          <SymbolList
            selectedSymbol={selectedSymbol}
            selectedCategory={selectedCategory}
            onSelectSymbol={(symbol, category) => {
              setSelectedSymbol(symbol);
              setSelectedCategory(category);
            }}
          />
        </ResizablePanel>

        {/* Center - Chart */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <PriceChart
            symbol={selectedSymbol}
            category={selectedCategory}
            vwapConfigs={modules.find(m => m.id === "vwap_analyzer")?.is_active ? vwapConfigs : []}
            smaConfigs={modules.find(m => m.id === "sma_analyzer")?.is_active ? smaConfigs : []}
            anchoredVwapConfigs={modules.find(m => m.id === "anchored_vwap")?.is_active ? anchoredVwapConfigs : []}
            onAnchoredVwapConfigChange={setAnchoredVwapConfigs}
            selectingAnchor={selectingAnchor}
            onSelectingAnchorChange={setSelectingAnchor}
          />
        </main>

        {/* Right Sidebar - Modules & Risk Calculator */}
        <ResizablePanel
          side="right"
          defaultWidth={320}
          minWidth={280}
          maxWidth={500}
          isOpen={rightSidebarOpen}
          onToggle={() => setRightSidebarOpen(!rightSidebarOpen)}
          title={activeTab === "modules" ? t("moduleStore.title") : t("riskCalculator.title")}
          floatable={true}
          className="border-l border-dark-700"
        >
          <div className="flex flex-col h-full">
            {/* Tabs */}
            <div className="flex border-b border-dark-700 flex-shrink-0">
              <button
                onClick={() => setActiveTab("modules")}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "modules"
                    ? "text-primary-400 border-b-2 border-primary-400"
                    : "text-dark-400 hover:text-white"
                }`}
              >
                {t("moduleStore.title")}
              </button>
              <button
                onClick={() => setActiveTab("risk")}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "risk"
                    ? "text-primary-400 border-b-2 border-primary-400"
                    : "text-dark-400 hover:text-white"
                }`}
              >
                {t("riskCalculator.title")}
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "modules" ? (
              /* Module Store */
              <div className="space-y-3">
                {modules.map((module, index) => {
                  const translation = getModuleTranslation(module.id);
                  // Find previous module to check if we need separator
                  const prevModule = index > 0 ? modules[index - 1] : null;
                  const needsSeparator = module.id === "strategy_builder" && prevModule?.id !== "strategy_builder";

                  return (
                    <div key={module.id}>
                      {/* Visual separator before Strategy Builder */}
                      {needsSeparator && (
                        <div className="flex items-center gap-2 mb-3 mt-4">
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent"></div>
                          <span className="text-xs text-dark-500 uppercase tracking-wider">Custom</span>
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent"></div>
                        </div>
                      )}
                      <div
                        className="bg-dark-800 rounded-lg p-3 border border-dark-700 hover:border-dark-600 transition-colors"
                      >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-medium text-white text-sm truncate">
                            {translation?.name || module.name}
                          </h3>
                          <p className="text-xs text-dark-400 mt-1 line-clamp-2">
                            {translation?.description || module.description}
                          </p>
                          {module.can_trade && (
                            <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-danger-900/30 text-danger-400 rounded">
                              {t("moduleStore.tradingAccess")}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => toggleModule(module.id, !module.is_active)}
                          className={`px-2 py-1 rounded text-xs transition-colors flex-shrink-0 ${
                            module.is_active
                              ? "bg-primary-600 text-white"
                              : "bg-dark-700 text-dark-300 hover:bg-dark-600"
                          }`}
                        >
                          {module.is_active ? t("common.active") : t("common.inactive")}
                        </button>
                      </div>

                      {/* VWAP Settings - show when vwap_analyzer is active */}
                      {module.id === "vwap_analyzer" && (
                        <VwapSettings
                          configs={vwapConfigs}
                          onConfigChange={setVwapConfigs}
                          isActive={module.is_active}
                        />
                      )}

                      {/* SMA Settings - show when sma_analyzer is active */}
                      {module.id === "sma_analyzer" && (
                        <SmaSettings
                          configs={smaConfigs}
                          onConfigChange={setSmaConfigs}
                          isActive={module.is_active}
                        />
                      )}

                      {/* Anchored VWAP Settings - show when anchored_vwap is active */}
                      {module.id === "anchored_vwap" && (
                        <AnchoredVwapSettings
                          configs={anchoredVwapConfigs}
                          onConfigChange={setAnchoredVwapConfigs}
                          isActive={module.is_active}
                          onSelectAnchor={(configId, type) => setSelectingAnchor({ configId, type })}
                          selectingAnchor={selectingAnchor}
                        />
                      )}

                      {/* Strategy Builder - show when strategy_builder is active */}
                      {module.id === "strategy_builder" && (
                        <StrategyBuilder
                          strategies={strategies}
                          onStrategiesChange={setStrategies}
                          isActive={module.is_active}
                        />
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Risk Calculator */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-dark-400 mb-1">
                      {t("riskCalculator.accountBalance")} ($)
                    </label>
                    <input
                      type="number"
                      value={accountBalance}
                      onChange={(e) => setAccountBalance(Number(e.target.value))}
                      className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">
                      {t("riskCalculator.riskPercent")} (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(Number(e.target.value))}
                      className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">
                      {t("riskCalculator.entryPrice")} ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={entryPrice}
                      onChange={(e) => setEntryPrice(Number(e.target.value))}
                      className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">
                      {t("riskCalculator.stopLoss")} ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={stopPrice}
                      onChange={(e) => setStopPrice(Number(e.target.value))}
                      className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">
                      {t("riskCalculator.takeProfit")} ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={takeProfitPrice}
                      onChange={(e) => setTakeProfitPrice(Number(e.target.value))}
                      className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                </div>

                <button
                  onClick={calculateRisk}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                >
                  {t("riskCalculator.calculate")}
                </button>

                {riskResult && (
                  <div className="bg-dark-800 rounded-lg p-3 border border-dark-700">
                    <h3 className="font-medium mb-3 text-primary-400 text-sm">
                      {t("riskCalculator.results.title")}
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-dark-400">{t("riskCalculator.results.positionSize")}:</span>
                        <span className="text-white font-medium">
                          {riskResult.position_size.toFixed(4)} {t("riskCalculator.results.units")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-400">{t("riskCalculator.results.riskAmount")}:</span>
                        <span className="text-danger-400 font-medium">
                          ${riskResult.risk_amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-400">{t("riskCalculator.results.potentialLoss")}:</span>
                        <span className="text-danger-400 font-medium">
                          ${riskResult.potential_loss.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-400">{t("riskCalculator.results.potentialProfit")}:</span>
                        <span className="text-primary-400 font-medium">
                          ${riskResult.potential_profit.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-dark-700">
                        <span className="text-dark-400">{t("riskCalculator.results.riskRewardRatio")}:</span>
                        <span
                          className={`font-medium ${
                            riskResult.risk_reward_ratio >= 2 ? "text-primary-400" : "text-yellow-400"
                          }`}
                        >
                          1:{riskResult.risk_reward_ratio.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

            {/* Global Risk Bar */}
            <div className="p-4 border-t border-dark-700 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-dark-400">{t("globalRisk.title")}</span>
                <span className="text-xs text-primary-400">
                  0% / 10% {t("globalRisk.max").toLowerCase()}
                </span>
              </div>
              <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                <div className="h-full w-0 bg-primary-500 rounded-full transition-all"></div>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </div>

      {/* API Settings Modal */}
      <ApiSettings
        isOpen={showApiSettings}
        onClose={() => setShowApiSettings(false)}
        onConnectionChange={handleConnectionChange}
      />
    </div>
    </ColorProvider>
  );
}

export default App;
