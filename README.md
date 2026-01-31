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
- **Cross-platform** - macOS, Windows, and Linux support

## Screenshots

<p align="center">
  <img src="docs/screenshot-chart.png" alt="Chart View" width="800"/>
</p>

## Requirements

- **Node.js** 20.x or higher
- **Rust** 1.75 or higher
- **npm** 10.x or higher

### Platform-specific Dependencies

#### macOS
```bash
xcode-select --install
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

#### Windows
- [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed on Windows 10/11)

## Installation

### From Release (Recommended)

Download the latest release for your platform from [Releases](https://github.com/Msaraldi/trade-app/releases):

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `AlgoTrade.OS_x.x.x_aarch64.dmg` |
| macOS (Intel) | `AlgoTrade.OS_x.x.x_x64.dmg` |
| Windows | `AlgoTrade.OS_x.x.x_x64-setup.exe` or `.msi` |
| Linux | `AlgoTrade.OS_x.x.x_amd64.deb` or `.AppImage` |

### From Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/Msaraldi/trade-app.git
   cd trade-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run tauri dev
   ```

4. **Build for production**
   ```bash
   npm run tauri build
   ```

   The built application will be in `src-tauri/target/release/bundle/`

## Configuration

### Bybit API Setup

1. Create an API key at [Bybit](https://www.bybit.com/) (or [Bytick](https://www.bytick.com/) for Turkey)
2. Open AlgoTrade OS and go to Settings > API Settings
3. Enter your API Key and Secret
4. Select Mainnet or Testnet
5. Click "Test Connection" to verify

> **Note:** For read-only access (recommended for charting), only "Read" permissions are required.

## Project Structure

```
trade-app/
├── src/                    # React Frontend
│   ├── components/         # React components
│   ├── i18n/              # Internationalization
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

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS |
| Backend | Rust, Tauri 2.0 |
| Database | SQLite (rusqlite) |
| Charts | Custom Canvas-based rendering |
| API | Bybit v5 REST + WebSocket |
| Encryption | AES-256-GCM |

## Development

### Available Scripts

```bash
# Start development server
npm run tauri dev

# Build production app
npm run tauri build

# Run frontend only
npm run dev

# Type check
npm run build
```

### Adding New Features

See the [roadmap](./roadmap/) directory for technical documentation on:
- Backend architecture
- Module system
- Database schema
- API protocols

## Roadmap

- [x] Basic charting with drawing tools
- [x] Bybit API integration
- [x] Risk calculator
- [x] Multi-language support
- [ ] Trade execution
- [ ] Real-time WebSocket updates
- [ ] Position management
- [ ] Alarm system
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
