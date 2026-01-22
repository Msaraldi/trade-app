import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";

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

interface ApiSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionChange: (state: ConnectionState) => void;
}

export function ApiSettings({ isOpen, onClose, onConnectionChange }: ApiSettingsProps) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testnet, setTestnet] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null);
  const [balance, setBalance] = useState<WalletBalance | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConnectionStatus();
    }
  }, [isOpen]);

  const loadConnectionStatus = async () => {
    try {
      const status = await invoke<ConnectionState>("get_connection_status");
      setConnectionState(status);
      onConnectionChange(status);

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
    } catch (e) {
      console.error("Failed to load balance:", e);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<ConnectionState>("connect_exchange", {
        credentials: {
          api_key: apiKey,
          api_secret: apiSecret,
          testnet,
        },
      });

      setConnectionState(result);
      onConnectionChange(result);

      if (result.is_connected) {
        loadBalance();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const result = await invoke<ConnectionState>("disconnect_exchange");
      setConnectionState(result);
      onConnectionChange(result);
      setBalance(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<boolean>("test_api_connection", {
        credentials: {
          api_key: apiKey,
          api_secret: apiSecret,
          testnet,
        },
      });

      if (result) {
        setError(null);
        alert(t("settings.api.connected"));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">{t("settings.api.title")}</h2>
          <button
            onClick={onClose}
            className="text-dark-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Connection Status */}
        {connectionState?.is_connected && (
          <div className="mb-6 p-4 bg-primary-900/20 border border-primary-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary-500 rounded-full animate-pulse"></div>
                <span className="text-primary-400 font-medium">
                  {connectionState.exchange} - {connectionState.is_demo ? "Testnet" : "Mainnet"}
                </span>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="text-sm text-danger-400 hover:text-danger-300"
              >
                {t("common.close")}
              </button>
            </div>

            {/* Balance Info */}
            {balance && (
              <div className="mt-4 pt-4 border-t border-primary-700/50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-dark-400">Total Equity:</span>
                    <span className="ml-2 text-white font-medium">
                      ${balance.total_equity.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-dark-400">Available:</span>
                    <span className="ml-2 text-primary-400 font-medium">
                      ${balance.available_balance.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Coin breakdown */}
                <div className="mt-3 space-y-1">
                  {balance.coins.filter(c => c.equity > 0).map((coin) => (
                    <div key={coin.coin} className="flex items-center justify-between text-xs text-dark-400">
                      <span>{coin.coin}</span>
                      <span>{coin.equity.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* API Form */}
        {!connectionState?.is_connected && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-dark-400 mb-1">{t("settings.api.exchange")}</label>
              <div className="px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white">
                Bybit
              </div>
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-1">{t("settings.api.apiKey")}</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API Key..."
                className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-1">{t("settings.api.apiSecret")}</label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Enter API Secret..."
                className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testnet}
                  onChange={(e) => setTestnet(e.target.checked)}
                  className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-dark-300">Testnet (Demo)</span>
              </label>
            </div>

            {error && (
              <div className="p-3 bg-danger-900/20 border border-danger-700 rounded-lg text-danger-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleTestConnection}
                disabled={loading || !apiKey || !apiSecret}
                className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {t("settings.api.testConnection")}
              </button>
              <button
                onClick={handleConnect}
                disabled={loading || !apiKey || !apiSecret}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? t("common.loading") : t("common.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
