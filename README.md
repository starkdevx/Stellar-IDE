# 🚀 Stellar Soroban Smart Contracts Playground & IDE

A powerful, modern, web-based Integrated Development Environment (IDE) built for developing, compiling, exporting, deploying, and testing **Stellar Soroban** smart contracts directly in your browser.

---

## ✨ Features

### 📁 1. Multi-Project Workspace Management
- **Independent Projects**: Create, switch, rename, and delete multiple independent Soroban Rust projects.
- **Isolated State**: Each project maintains its own isolated file tree, open tabs, active file, compiled WASM binary, ABI spec, and deployed Contract ID on Stellar Testnet.
- **Automatic Local Persistence**: Project states are saved in browser `localStorage`, ensuring zero data loss across browser reloads.

### 📝 2. Code Editor & Explorer
- **Monaco Code Editor**: Powered by VS Code's Monaco Editor with full Rust syntax highlighting, auto-formatting, and indentation.
- **File Explorer**: Create, rename, and delete custom `.rs` files and nested directories.
- **Multi-Tab Navigation**: Quick-switch tab bar at the top of the editor with close action buttons and active tab indicators.

### ⚡ 3. WebAssembly Compilation Engine
- **Soroban Rust Compiler**: One-click compilation targeting `wasm32v1-none` WebAssembly with `-Oz` size-shaking optimization profile.
- **ABI Spec Extraction**: Automatically parses compiled metadata specs into JSON ABI declarations.
- **Dynamic Project Names**: Compile action buttons, logs, and metadata specifications dynamically reflect your active project name.
- **WASM Export**: Download compiled `.wasm` bytecode binaries directly to your local computer (`[projectName].wasm`).

### 🚀 4. Stellar Testnet Deployment & Freighter Wallet Integration
- **Freighter Connection**: One-click integration with the [Freighter Browser Wallet](https://www.freighter.app/).
- **Automated Testnet Funding**: Built-in Friendbot XLM testnet account funding tool.
- **Contract Installation & Deployment**: Signs and submits `WasmHash` installation and contract deployment transactions directly to Stellar Testnet via `@stellar/stellar-sdk`.

### 🧪 5. Interactive Contract Spec Method Invocation
- **Auto-Generated Execution Cards**: Dynamically parses the contract's ABI spec and renders input forms for every exported Rust function.
- **Testnet Execution**: Invokes read/write contract functions on Testnet using Freighter wallet transaction signing.
- **Real-Time Result Viewer**: Renders method execution outputs, XDR payloads, transaction hashes, and error messages.

### 📐 6. Customizable Layout & Workspace Optimization
- **Draggable Resizable Splitter**: Click and drag the vertical divider between the left Explorer sidebar and Monaco code editor (clamped `220px` to `650px`).
- **Full Screen Code Editor Mode**: Collapse the left sidebar (`PanelLeftClose`) with one click to expand the Monaco code editor to 100% full screen width. Re-expand anytime with the floating `PanelLeftOpen` button.
- **Minimizable Execution Terminal**: Expand or collapse real-time terminal logs (`35px` minimized header or `200px` expanded terminal view).

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend Framework** | [Next.js 16](https://nextjs.org/) (App Router, React 19, TypeScript) |
| **Code Editor** | [Monaco Editor](https://github.com/suren-atoyan/monaco-react) |
| **Blockchain SDK** | [@stellar/stellar-sdk](https://github.com/stellar/js-stellar-sdk) |
| **Wallet Integration** | [@stellar/freighter-api](https://www.freighter.app/) |
| **Styling & Icons** | Vanilla CSS (Dark Mode & Glassmorphic UI), [Lucide React](https://lucide.dev/) |
| **Backend Compiler** | Node.js, Express, TypeScript |
| **Contract Toolchain** | Rust `cargo`, `wasm32v1-none` target, Soroban SDK |

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** (v18 or higher) & **npm**
- **Rust toolchain** with `wasm32v1-none` target:
  ```bash
  rustup target add wasm32v1-none
  ```

---

### Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/starkdevx/Stellar-IDE.git
   cd Stellar-IDE
   ```

2. **Setup Compiler Server (Backend)**:
   ```bash
   cd server
   npm install
   npm run dev
   ```
   *The compiler backend will start on `http://localhost:5000`.*

3. **Setup Client Application (Frontend)**:
   ```bash
   cd ../client
   npm install
   npm run dev
   ```
   *The Next.js frontend will start on `http://localhost:3000`.*

---

## 📂 Project Structure

```
Stellar-IDE/
├── client/                      # Next.js Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── CompilerPanel.tsx    # WASM Compilation & WASM Export
│   │   │   │   ├── DeployPanel.tsx      # Freighter Wallet & Testnet Deployment
│   │   │   │   ├── Editor.tsx           # Monaco Code Editor
│   │   │   │   ├── FileTree.tsx         # File Explorer Tree & Actions
│   │   │   │   ├── InteractPanel.tsx    # ABI Spec Parser & Method Invocation
│   │   │   │   └── ProjectSelector.tsx  # Multi-Project Workspace Selector
│   │   │   ├── globals.css              # Custom Theme & Responsive CSS Styles
│   │   │   ├── layout.tsx               # Root Layout with Hydration Protection
│   │   │   └── page.tsx                 # Main Workspace IDE Layout & State
│   └── package.json
│
├── server/                      # Express Compiler Backend
│   ├── src/
│   │   └── index.ts             # Rust / WASM Compilation Pipeline
│   └── package.json
│
└── README.md
```

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
