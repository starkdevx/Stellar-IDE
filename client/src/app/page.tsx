"use client";

import React, { useState, useEffect } from "react";
import { Folder, Cpu, Activity, Play, RefreshCw, X, ShieldAlert } from "lucide-react";
import FileTree from "./components/FileTree";
import Editor from "./components/Editor";
import CompilerPanel from "./components/CompilerPanel";
import DeployPanel from "./components/DeployPanel";
import InteractPanel from "./components/InteractPanel";

// Default template files
const DEFAULT_FILES = {
  "Cargo.toml": `[package]
name = "hello-world"
version = "0.0.0"
edition = "2021"
publish = false

[lib]
crate-type = ["lib", "cdylib"]
doctest = false

[dependencies]
soroban-sdk = { workspace = true }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
`,
  "src/lib.rs": `#![no_std]
use soroban_sdk::{contract, contractimpl, vec, Env, String, Vec};

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn hello(env: Env, to: String) -> Vec<String> {
        vec![&env, String::from_str(&env, "Hello"), to]
    }
}

mod test;
`,
  "src/test.rs": `#![cfg(test)]

use super::*;
use soroban_sdk::{vec, Env, String};

#[test]
fn test() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let words = client.hello(&String::from_str(&env, "Dev"));
    assert_eq!(
        words,
        vec![
            &env,
            String::from_str(&env, "Hello"),
            String::from_str(&env, "Dev"),
        ]
    );
}
`,
};

interface LogLine {
  id: string;
  text: string;
  type: "info" | "error" | "success" | "warning";
  timestamp: string;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [files, setFiles] = useState<{ [path: string]: string }>({});
  const [activeFile, setActiveFile] = useState<string>("src/lib.rs");
  const [sidebarTab, setSidebarTab] = useState<"explorer" | "compiler" | "interact">("explorer");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [abi, setAbi] = useState<any[] | null>(null);
  const [wasmBase64, setWasmBase64] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);

  // Initialize state on client side only (avoid SSR mismatch)
  useEffect(() => {
    const savedFiles = localStorage.getItem("stellar_ide_files");
    if (savedFiles) {
      try {
        setFiles(JSON.parse(savedFiles));
      } catch {
        setFiles(DEFAULT_FILES);
      }
    } else {
      setFiles(DEFAULT_FILES);
    }

    const savedContractId = localStorage.getItem("stellar_ide_contract_id");
    if (savedContractId) {
      setContractId(savedContractId);
    }

    const savedAbi = localStorage.getItem("stellar_ide_abi");
    if (savedAbi) {
      try {
        setAbi(JSON.parse(savedAbi));
      } catch {}
    }

    const savedWasm = localStorage.getItem("stellar_ide_wasm");
    if (savedWasm) {
      setWasmBase64(savedWasm);
    }

    setMounted(true);
    
    // Add initial greeting log
    const now = new Date().toLocaleTimeString();
    setLogs([
      {
        id: "init",
        text: "Stellar Soroban Browser IDE initialized. Ready to build contracts.",
        type: "success",
        timestamp: now,
      },
    ]);
  }, []);

  // Save files to localStorage on modification
  const saveFiles = (updatedFiles: { [path: string]: string }) => {
    setFiles(updatedFiles);
    localStorage.setItem("stellar_ide_files", JSON.stringify(updatedFiles));
  };

  const addLog = (text: string, type: "info" | "error" | "success" | "warning" = "info") => {
    const now = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        text,
        type,
        timestamp: now,
      },
    ]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleSelectFile = (path: string) => {
    setActiveFile(path);
  };

  const handleCreateFile = (path: string) => {
    if (files[path] !== undefined) {
      alert("File already exists!");
      return;
    }
    const updated = { ...files, [path]: "" };
    saveFiles(updated);
    setActiveFile(path);
    addLog(`Created file: ${path}`, "info");
  };

  const handleDeleteFile = (path: string) => {
    if (path === "src/lib.rs" || path === "Cargo.toml") return;
    const updated = { ...files };
    delete updated[path];
    saveFiles(updated);
    if (activeFile === path) {
      setActiveFile("src/lib.rs");
    }
    addLog(`Deleted file: ${path}`, "warning");
  };

  const handleResetFiles = () => {
    saveFiles(DEFAULT_FILES);
    setActiveFile("src/lib.rs");
    setAbi(null);
    setWasmBase64(null);
    setContractId(null);
    localStorage.removeItem("stellar_ide_abi");
    localStorage.removeItem("stellar_ide_wasm");
    localStorage.removeItem("stellar_ide_contract_id");
    addLog("Workspace files reset to default template.", "info");
  };

  const handleContentChange = (val: string | undefined) => {
    if (val === undefined) return;
    const updated = { ...files, [activeFile]: val };
    saveFiles(updated);
  };

  const handleCompileSuccess = (newAbi: any[], wasm: string) => {
    setAbi(newAbi);
    setWasmBase64(wasm);
    localStorage.setItem("stellar_ide_abi", JSON.stringify(newAbi));
    localStorage.setItem("stellar_ide_wasm", wasm);
    
    // Automatically switch tab to deploy/interact to guide user flow
    setSidebarTab("compiler");
  };

  const handleDeploySuccess = (id: string) => {
    setContractId(id);
    localStorage.setItem("stellar_ide_contract_id", id);
    setSidebarTab("interact");
  };

  const handleContractIdChange = (id: string) => {
    setContractId(id || null);
    if (id) {
      localStorage.setItem("stellar_ide_contract_id", id);
    } else {
      localStorage.removeItem("stellar_ide_contract_id");
    }
  };

  if (!mounted) {
    return (
      <div style={{
        display: "flex",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "12px",
        backgroundColor: "#060814",
        color: "#white"
      }}>
        <div className="spinner" style={{ width: "24px", height: "24px" }}></div>
        <span style={{ fontSize: "0.9rem", color: "hsl(var(--text-secondary))" }}>Loading workspace environment...</span>
      </div>
    );
  }

  return (
    <div className="ide-container">
      {/* Header */}
      <header className="ide-header">
        <div className="brand">
          <Cpu size={20} style={{ color: "hsl(var(--accent-violet))" }} />
          <span>Soroban Playground</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))" }}>Stellar Smart Contracts Sandbox</span>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "hsl(var(--accent-success))" }}></div>
        </div>
      </header>

      {/* Main Workspace split */}
      <main className="ide-main">
        {/* Left Side: Sidebar with configuration / files */}
        <div className="sidebar">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${sidebarTab === "explorer" ? "active" : ""}`}
              onClick={() => setSidebarTab("explorer")}
            >
              <Folder size={18} />
              <span>Files</span>
            </button>
            <button
              className={`sidebar-tab ${sidebarTab === "compiler" ? "active" : ""}`}
              onClick={() => setSidebarTab("compiler")}
            >
              <Cpu size={18} />
              <span>Build & Deploy</span>
            </button>
            <button
              className={`sidebar-tab ${sidebarTab === "interact" ? "active" : ""}`}
              onClick={() => setSidebarTab("interact")}
            >
              <Activity size={18} />
              <span>Interact</span>
            </button>
          </div>

          <div className="sidebar-content">
            {sidebarTab === "explorer" && (
              <FileTree
                files={files}
                activeFile={activeFile}
                onSelectFile={handleSelectFile}
                onCreateFile={handleCreateFile}
                onDeleteFile={handleDeleteFile}
                onResetFiles={handleResetFiles}
              />
            )}
            {sidebarTab === "compiler" && (
              <>
                <CompilerPanel
                  files={files}
                  onCompileSuccess={handleCompileSuccess}
                  addLog={addLog}
                />
                <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", margin: "4px 0" }}></div>
                <DeployPanel
                  wasmBase64={wasmBase64}
                  onDeploySuccess={handleDeploySuccess}
                  addLog={addLog}
                />
              </>
            )}
            {sidebarTab === "interact" && (
              <InteractPanel
                abi={abi}
                contractId={contractId}
                onContractIdChange={handleContractIdChange}
                addLog={addLog}
              />
            )}
          </div>
        </div>

        {/* Right Side: Monaco Editor + Bottom Console Logs */}
        <div className="workspace-right">
          <Editor
            activeFile={activeFile}
            content={files[activeFile] || ""}
            onChange={handleContentChange}
          />

          <div className="console-panel">
            <div className="console-header">
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Play size={12} style={{ color: "hsl(var(--accent-success))" }} />
                <span>EXECUTION LOGS</span>
              </div>
              <button
                onClick={clearLogs}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "hsl(var(--text-muted))",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <X size={10} /> Clear Logs
              </button>
            </div>
            <div className="console-body">
              {logs.map((log) => (
                <div key={log.id} className={`console-line ${log.type}`}>
                  <span style={{ color: "hsl(var(--text-muted))", marginRight: "8px" }}>[{log.timestamp}]</span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer bar */}
      <footer className="footer-status">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>Network:</span>
          <span style={{ color: "hsl(var(--accent-cyan))", fontWeight: "600" }}>Testnet</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>RPC Status:</span>
          <span style={{ color: "hsl(var(--accent-success))", fontWeight: "600" }}>Online</span>
        </div>
      </footer>
    </div>
  );
}
