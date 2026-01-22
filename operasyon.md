# AlgoTrade OS - Operasyon Dokümantasyonu

Bu doküman, AlgoTrade OS uygulamasında kullanılan tüm veri yapılarını, API'leri ve konfigürasyonları içerir.

---

## 1. Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Rust + Tauri 2.0 |
| Database | SQLite (rusqlite) |
| Exchange API | Bybit REST API v5 |
| Styling | Tailwind CSS |
| i18n | react-i18next (TR/EN) |
| Charts | Custom Canvas-based |

---

## 2. Proje Yapısı

```
trade-app/
├── src/                          # Frontend (React)
│   ├── components/
│   │   ├── CustomChart.tsx       # Ana grafik bileşeni
│   │   ├── ChartToolbar.tsx      # Çizim araç çubuğu
│   │   ├── ChartDrawings.tsx     # Çizim tipleri ve yardımcılar
│   │   ├── SymbolList.tsx        # Sembol listesi
│   │   ├── VwapSettings.tsx      # VWAP ayarları
│   │   ├── SmaSettings.tsx       # SMA ayarları
│   │   ├── AnchoredVwapSettings.tsx  # Çapalı VWAP
│   │   ├── StrategyBuilder.tsx   # Strateji oluşturucu
│   │   ├── ApiSettings.tsx       # API bağlantı ayarları
│   │   └── LanguageSwitcher.tsx  # Dil değiştirici
│   ├── i18n/
│   │   └── locales/
│   │       ├── en.json           # İngilizce çeviriler
│   │       └── tr.json           # Türkçe çeviriler
│   └── App.tsx                   # Ana uygulama
│
├── src-tauri/                    # Backend (Rust)
│   └── src/
│       ├── commands/mod.rs       # Tauri komutları
│       ├── exchange/bybit.rs     # Bybit API client
│       ├── db/mod.rs             # SQLite database
│       ├── models/mod.rs         # Veri modelleri
│       ├── modules/              # İşlem modülleri
│       │   ├── risk_calculator.rs
│       │   └── stop_loss.rs
│       └── i18n/mod.rs           # Backend çevirileri
│
└── operasyon.md                  # Bu dosya
```

---

## 3. Veritabanı Şeması

### 3.1 Drawings Tablosu

```sql
CREATE TABLE drawings (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,           -- "BTCUSDT"
    interval TEXT NOT NULL,         -- "1H", "4H", "1D"
    drawing_type TEXT NOT NULL,     -- "fib_retracement", "trendline"
    points TEXT NOT NULL,           -- JSON: [{time, price}, ...]
    style TEXT NOT NULL,            -- JSON: {color, lineWidth, ...}
    visible INTEGER DEFAULT 1,
    locked INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,    -- Unix timestamp
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_drawings_symbol_interval ON drawings(symbol, interval);
```

### 3.2 Database Lokasyonu
```
macOS: ~/Library/Application Support/algotrade-os/drawings.db
Linux: ~/.local/share/algotrade-os/drawings.db
Windows: %APPDATA%/algotrade-os/drawings.db
```

---

## 4. Backend Veri Modelleri (Rust)

### 4.1 Exchange Modelleri

```rust
// Market kategorisi
pub enum MarketCategory {
    Spot,      // Spot piyasa
    Linear,    // USDT Perpetual Futures
    Inverse,   // Coin-margined Futures
}

// Kline (Mum) verisi
pub struct Kline {
    pub timestamp: i64,    // Unix timestamp (ms)
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

// Ticker bilgisi
pub struct TickerInfo {
    pub symbol: String,
    pub last_price: f64,
    pub price_24h_pcnt: f64,
    pub high_price_24h: f64,
    pub low_price_24h: f64,
    pub volume_24h: f64,
    pub turnover_24h: f64,
    pub category: MarketCategory,
    pub max_leverage: f64,
}

// Cüzdan bakiyesi
pub struct WalletBalance {
    pub total_equity: f64,
    pub available_balance: f64,
    pub coins: Vec<CoinBalance>,
}

pub struct CoinBalance {
    pub coin: String,
    pub equity: f64,
    pub available: f64,
    pub unrealized_pnl: f64,
}

// Enstrüman bilgisi
pub struct InstrumentInfo {
    pub symbol: String,
    pub base_coin: String,
    pub quote_coin: String,
    pub status: String,
    pub category: MarketCategory,
    pub max_leverage: f64,
}
```

### 4.2 Trading Modelleri

```rust
// Pozisyon
pub struct Position {
    pub id: String,
    pub symbol: String,
    pub side: PositionSide,
    pub entry_price: f64,
    pub quantity: f64,
    pub stop_loss: Option<f64>,
    pub take_profit: Option<f64>,
    pub created_at: DateTime<Utc>,
}

pub enum PositionSide {
    Long,
    Short,
}

// Emir
pub struct Order {
    pub id: String,
    pub symbol: String,
    pub side: OrderSide,
    pub order_type: OrderType,
    pub price: Option<f64>,
    pub quantity: f64,
    pub status: OrderStatus,
}

pub enum OrderSide { Buy, Sell }
pub enum OrderType { Market, Limit, StopMarket, StopLimit }
pub enum OrderStatus { Pending, Filled, PartiallyFilled, Cancelled, Rejected }

// Risk hesaplama
pub struct RiskCalculation {
    pub position_size: f64,
    pub risk_amount: f64,
    pub risk_percent: f64,
    pub potential_loss: f64,
    pub potential_profit: f64,
    pub risk_reward_ratio: f64,
}
```

### 4.3 Drawing Modeli (Database)

```rust
pub struct Drawing {
    pub id: String,
    pub symbol: String,
    pub interval: String,
    pub drawing_type: String,
    pub points: String,      // JSON
    pub style: String,       // JSON
    pub visible: bool,
    pub locked: bool,
    pub created_at: i64,
    pub updated_at: i64,
}
```

---

## 5. Frontend Veri Modelleri (TypeScript)

### 5.1 Çizim Modelleri

```typescript
// Çizim noktası
interface DrawingPoint {
  time: number;   // Unix timestamp (ms)
  price: number;
}

// Çizim stili
interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  fillColor?: string;
  fillOpacity?: number;
  showLabels?: boolean;
  text?: string;
  extendLeft?: boolean;
  extendRight?: boolean;
  showPrice?: boolean;
  showPercentage?: boolean;
  // Fibonacci özel
  fibLevels?: number[];
  fibColors?: string[];
  fibLabelsLeft?: boolean;
  // Pozisyon özel
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
}

// Çizim objesi
interface Drawing {
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
  name?: string;
  timeframes?: string[];
}
```

### 5.2 Çizim Araçları

```typescript
type DrawingTool =
  // Cursor
  | "none" | "crosshair" | "eraser"
  // Lines
  | "trendline" | "ray" | "extended" | "horizontal" | "vertical"
  | "horizontal_ray" | "arrow" | "info_line" | "trend_angle" | "cross_line"
  // Channels
  | "parallel_channel" | "disjoint_channel" | "flat_top_bottom" | "regression_trend"
  // Pitchfork
  | "pitchfork" | "schiff_pitchfork" | "modified_schiff" | "inside_pitchfork"
  // Fibonacci
  | "fib_retracement" | "fib_extension" | "fib_channel" | "fib_time_zone"
  | "fib_fan" | "fib_arc" | "fib_circles" | "fib_wedge"
  // Gann
  | "gann_box" | "gann_fan" | "gann_square"
  // Patterns
  | "xabcd" | "abcd" | "three_drives" | "head_shoulders"
  | "triangle_pattern" | "elliott_wave" | "cyclic_lines"
  // Shapes
  | "rectangle" | "circle" | "ellipse" | "triangle" | "arc"
  | "path" | "polyline" | "brush"
  // Measure
  | "date_range" | "price_range" | "date_price_range"
  | "long_position" | "short_position"
  // Volume
  | "anchored_vwap"
  // Annotation
  | "text" | "anchored_text" | "note" | "callout"
  | "price_label" | "arrow_marker" | "flag_marker" | "icon";

type DrawingToolCategory =
  | "cursor" | "lines" | "channels" | "pitchfork"
  | "fibonacci" | "gann" | "patterns" | "shapes"
  | "measure" | "volume" | "annotation";
```

### 5.3 Gösterge Konfigürasyonları

```typescript
// VWAP Konfigürasyonu
interface VwapConfig {
  id: string;
  enabled: boolean;
  type: "session" | "daily" | "weekly" | "monthly";
  showBands: boolean;
  bandMultiplier: number;
  lineColor: string;
  bandColor: string;
}

// SMA Konfigürasyonu
interface SmaConfig {
  id: string;
  enabled: boolean;
  period: number;
  timeframe: "D" | "W";  // Daily veya Weekly
  color: string;
  lineWidth: number;
}

// Anchored VWAP Konfigürasyonu
interface AnchoredVwapConfig {
  id: string;
  enabled: boolean;
  name: string;
  startTime: number | null;
  endTime: number | null;
  color: string;
  showBands: boolean;
  bandMultiplier: number;
}

// Strateji
interface Strategy {
  id: string;
  name: string;
  enabled: boolean;
  conditions: StrategyCondition[];
  logic: "AND" | "OR";
  alertSound: boolean;
  alertPopup: boolean;
}

interface StrategyCondition {
  id: string;
  indicator: string;
  operator: string;
  value: string | number;
}
```

---

## 6. Tauri Komutları (IPC)

### 6.1 Exchange Komutları

```typescript
// Bağlantı
connect_exchange(credentials: ApiCredentials) -> ConnectionState
disconnect_exchange() -> ConnectionState
get_connection_status() -> ConnectionState
test_api_connection(credentials: ApiCredentials) -> boolean

// Market Data
get_ticker(symbol: string, category?: string) -> TickerInfo
get_all_tickers(category?: string) -> TickerInfo[]
get_instruments(category?: string) -> InstrumentInfo[]
get_all_instruments() -> AllInstruments
get_klines(symbol, category, interval, limit) -> Kline[]
get_all_klines(symbol, category, interval, start?, end?) -> Kline[]

// Cüzdan
get_wallet_balance() -> WalletBalance
```

### 6.2 Drawing Komutları

```typescript
save_drawing(request: SaveDrawingRequest) -> Drawing
get_drawings(symbol: string, interval: string) -> Drawing[]
delete_drawing(id: string) -> boolean
clear_drawings(symbol: string, interval: string) -> number
get_all_drawings_for_symbol(symbol: string) -> Drawing[]
```

### 6.3 Diğer Komutlar

```typescript
// Risk
calculate_risk(request: CalculateRiskRequest) -> RiskCalculation

// Modüller
list_modules() -> ModuleInfo[]
toggle_module(moduleId: string, active: boolean) -> boolean

// Ayarlar
get_settings() -> UserSettings
get_version() -> string

// Dil
set_language(language_code: string) -> LanguageInfo
get_current_language() -> LanguageInfo
get_available_languages() -> LanguageInfo[]
```

---

## 7. Fibonacci Seviyeleri

### 7.1 Varsayılan Seviyeler

```typescript
// Dahili Seviyeler (0-1)
const INTERNAL_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.65, 0.786, 1];

// Harici Seviyeler (>1)
const EXTERNAL_LEVELS = [1.272, 1.414, 1.618, 2, 2.272, 2.618, 3.618, 4.236];

// Uzatma Seviyeleri (<0)
const EXTENSION_LEVELS = [-0.272, -0.618, -1, -1.618, -2.618];
```

### 7.2 Varsayılan Renkler

```typescript
const FIBONACCI_COLORS = [
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
```

---

## 8. Grafik Zaman Dilimleri

### 8.1 Standart Aralıklar

```typescript
const INTERVALS = [
  { value: "1", label: "1m" },
  { value: "3", label: "3m" },
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "30", label: "30m" },
  { value: "60", label: "1H" },
  { value: "120", label: "2H" },
  { value: "240", label: "4H" },
  { value: "360", label: "6H" },
  { value: "720", label: "12H" },
  { value: "D", label: "1D" },
  { value: "W", label: "1W" },
  { value: "M", label: "1M" },
];
```

### 8.2 Özel Aralıklar

```typescript
// Format: "custom_{value}{unit}"
// Örnek: "custom_7m" = 7 dakika
// Birimler: s (saniye), m (dakika), h (saat), D (gün), W (hafta)
```

---

## 9. API Endpoints (Bybit)

### 9.1 Base URLs

```
Production: https://api.bytick.com
Testnet: https://api-testnet.bybit.com
WebSocket: wss://stream.bytick.com/v5/public/linear
```

### 9.2 Endpoints

| Endpoint | Açıklama |
|----------|----------|
| `/v5/account/wallet-balance` | Cüzdan bakiyesi |
| `/v5/market/tickers` | Ticker bilgileri |
| `/v5/market/instruments-info` | Enstrüman bilgileri |
| `/v5/market/kline` | Kline/mum verileri |

---

## 10. Klavye Kısayolları

| Kısayol | İşlev |
|---------|-------|
| `Ctrl/Cmd + R` | Uygulamayı yenile |
| `Ctrl/Cmd + Z` | Geri al |
| `Ctrl/Cmd + Shift + Z` | Yinele |
| `Ctrl/Cmd + C` | Çizimi kopyala |
| `Ctrl/Cmd + V` | Çizimi yapıştır |
| `Delete/Backspace` | Seçili çizimi sil |
| `Escape` | Araç seçimini iptal et |
| `Shift` (çizim sırasında) | 45° açı kilidi |

---

## 11. Modüller (Barbar Tools)

### 11.1 Grafik Göstergeleri
- **SMA Analyzer**: 200D, 50W, 100W, 200W hareketli ortalamalar
- **VWAP Analyzer**: Session/Daily/Weekly/Monthly VWAP
- **Anchored VWAP**: Çapalı VWAP hesaplama

### 11.2 Risk ve İzleme
- **Risk Monitor**: Kümülatif risk takibi

### 11.3 İşlem Araçları
- **Smart Stop-Loss**: Otomatik breakeven
- **Batch Trading**: Toplu işlem yönetimi

### 11.4 Strateji
- **Strategy Builder**: Özel strateji oluşturucu (Pine Script benzeri)

---

## 12. Renk Paleti

```typescript
const PRESET_COLORS = [
  "#2962FF", // Birincil mavi
  "#FF6D00", // Turuncu
  "#00C853", // Yeşil
  "#D50000", // Kırmızı
  "#AA00FF", // Mor
  "#00B8D4", // Cyan
  "#FFD600", // Sarı
  "#FF4081", // Pembe
  "#E91E63", // Magenta
  "#9C27B0", // Koyu mor
  "#673AB7", // Derin mor
  "#3F51B5", // İndigo
  "#2196F3", // Açık mavi
  "#00BCD4", // Teal
  "#009688", // Koyu teal
  "#4CAF50", // Orta yeşil
  "#8BC34A", // Açık yeşil
  "#CDDC39", // Lime
  "#FFEB3B", // Parlak sarı
  "#FFC107", // Amber
  "#FF9800", // Koyu turuncu
  "#FF5722", // Derin turuncu
  "#795548", // Kahverengi
  "#9E9E9E", // Gri
  "#607D8B", // Mavi-gri
  "#FFFFFF", // Beyaz
  "#64748b", // Slate
  "#000000", // Siyah
];
```

---

## 13. Grafik Sabitleri

```typescript
// Zoom limitleri
const MIN_CANDLES = 20;   // Minimum görünür mum
const MAX_CANDLES = 300;  // Maksimum görünür mum

// Mum boyutları
const CANDLE_WIDTH_RATIO = 0.7;  // Mum genişliği oranı

// Padding
const PADDING_TOP = 20;
const PADDING_RIGHT = 80;
const PADDING_BOTTOM = 30;
const PADDING_LEFT = 10;

// Renkler
const COLORS = {
  background: "#0f172a",
  grid: "#1e293b",
  text: "#94a3b8",
  crosshair: "#64748b",
  bullCandle: "#22c55e",
  bearCandle: "#ef4444",
  volume: "#334155",
  selection: "#3b82f6",
};
```

---

## 14. Versiyon Bilgisi

- **Uygulama**: AlgoTrade OS
- **Versiyon**: 0.1.0
- **Framework**: Tauri 2.0
- **Son Güncelleme**: 2026-01-22

---

*Bu doküman otomatik olarak oluşturulmuştur ve uygulama geliştikçe güncellenmelidir.*
