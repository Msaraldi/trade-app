# AlgoTrade OS

A modular cryptocurrency trading platform built with Tauri, React, and Rust. Features real-time charting, technical analysis tools, and risk management capabilities.

## Features

- **Advanced Charting System** - Canvas-based charts with 30+ drawing tools (Trendlines, Fibonacci, Gann, Elliott Wave, etc.)
- **Technical Indicators** - VWAP, SMA, Anchored VWAP with customizable settings
- **Risk Calculator** - Position sizing based on account balance and risk percentage
- **Strategy Builder** - Visual strategy creation with multiple conditions
- **Bybit Integration** - Real-time market data via REST API and WebSocket
- **Multi-language Support** - English and Turkish
- **Secure Storage** - AES-256-GCM encryption for sensitive data
- **Cross-platform** - macOS and Windows (Linux coming soon)

## Screenshots

<p align="center">
  <img src="docs/screenshot-chart.png" alt="Chart View" width="800"/>
</p>

## Download & Install

### Windows

1. **Download:** [AlgoTrade.OS_0.1.0_x64-setup.exe](https://github.com/Msaraldi/trade-app/releases/download/v0.1.0/AlgoTrade.OS_0.1.0_x64-setup.exe) (3.9 MB)
2. **Run** the downloaded `.exe` file
3. **Follow** the installation wizard
4. **Launch** AlgoTrade OS from Start Menu or Desktop

> Alternative: [AlgoTrade.OS_0.1.0_x64_en-US.msi](https://github.com/Msaraldi/trade-app/releases/download/v0.1.0/AlgoTrade.OS_0.1.0_x64_en-US.msi) (5.5 MB)

### macOS (Apple Silicon - M1/M2/M3)

1. **Download:** [AlgoTrade.OS_0.1.0_aarch64.dmg](https://github.com/Msaraldi/trade-app/releases/download/v0.1.0/AlgoTrade.OS_0.1.0_aarch64.dmg) (5.7 MB)
2. **Open** the `.dmg` file
3. **Drag** AlgoTrade OS to Applications folder
4. **First launch:** Right-click > Open (to bypass Gatekeeper)

### Linux

Coming soon in next release. For now, build from source (see below).

---

## First Launch

When you first open the app:

1. **Database is created automatically** - No setup needed. The app creates its SQLite database in:
   - Windows: `%APPDATA%/algotrade-os/`
   - macOS: `~/Library/Application Support/algotrade-os/`

2. **Select a trading pair** from the symbol list (e.g., BTCUSDT)

3. **Optional: Connect Bybit API** for real-time data (Settings > API Settings)

> **No API key required** to view charts with sample data. API connection is only needed for live market data.

---

## Bybit API Setup (Optional)

For live market data:

1. Create an API key at [Bybit](https://www.bybit.com/) or [Bytick](https://www.bytick.com/) (for Turkey)
2. Open AlgoTrade OS → Settings → API Settings
3. Enter your API Key and Secret
4. Select **Testnet** (for testing) or **Mainnet** (for live data)
5. Click **Test Connection**

> **Tip:** For read-only charting, only "Read" permissions are required on your API key.

---

## Build from Source

### Requirements

- **Node.js** 20.x or higher
- **Rust** 1.75 or higher
- **npm** 10.x or higher

### Platform Dependencies

<details>
<summary>macOS</summary>

```bash
xcode-select --install
```
</details>

<details>
<summary>Linux (Ubuntu/Debian)</summary>

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev
```
</details>

<details>
<summary>Windows</summary>

- [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed)
</details>

### Build Steps

```bash
# Clone repository
git clone https://github.com/Msaraldi/trade-app.git
cd trade-app

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS |
| Backend | Rust, Tauri 2.0 |
| Database | SQLite (auto-created) |
| Charts | Custom Canvas-based rendering |
| API | Bybit v5 REST + WebSocket |
| Encryption | AES-256-GCM |

## Project Structure

```
trade-app/
├── src/                    # React Frontend
│   ├── components/         # React components
│   ├── i18n/              # Internationalization (EN/TR)
│   └── App.tsx            # Main application
├── src-tauri/             # Rust Backend
│   ├── src/
│   │   ├── commands/      # Tauri IPC commands
│   │   ├── exchange/      # Bybit API client
│   │   ├── modules/       # Trading modules
│   │   ├── security/      # Encryption vault
│   │   └── db/           # SQLite database
│   └── Cargo.toml        # Rust dependencies
├── roadmap/              # Technical documentation
└── package.json          # Node.js dependencies
```

## Roadmap

- [x] Basic charting with drawing tools
- [x] Bybit API integration
- [x] Risk calculator
- [x] Multi-language support
- [ ] Trade execution
- [ ] Real-time WebSocket updates
- [ ] Position management
- [ ] Alarm system
- [ ] Linux support
- [ ] Multiple exchange support (Binance, OKX)
- [ ] Backtesting engine

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Disclaimer

This software is for educational and informational purposes only. Trading cryptocurrencies involves substantial risk of loss. The developers are not responsible for any financial losses incurred while using this software. Always do your own research and trade responsibly.

---

**Made with Tauri + React + Rust**
