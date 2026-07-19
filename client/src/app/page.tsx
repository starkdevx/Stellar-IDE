"use client";

import React, { useState, useEffect } from "react";
import { Folder, Cpu, Activity, Play, RefreshCw, X, ShieldAlert, ChevronUp, ChevronDown } from "lucide-react";
import FileTree from "./components/FileTree";
import Editor from "./components/Editor";
import CompilerPanel from "./components/CompilerPanel";
import DeployPanel from "./components/DeployPanel";
import InteractPanel from "./components/InteractPanel";

// Default template files
const DEFAULT_FILES = {
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
  const [folders, setFolders] = useState<string[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string>("src/lib.rs");
  const [sidebarTab, setSidebarTab] = useState<"explorer" | "compiler" | "interact">("explorer");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [abi, setAbi] = useState<any[] | null>(null);
  const [wasmBase64, setWasmBase64] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [isConsoleMinimized, setIsConsoleMinimized] = useState<boolean>(false);

  // Initialize state on client side only (avoid SSR mismatch)
  useEffect(() => {
    const savedFiles = localStorage.getItem("stellar_ide_files");
    if (savedFiles) {
      try {
        const parsed = JSON.parse(savedFiles);
        delete parsed["Cargo.toml"];
        setFiles(parsed);
      } catch {
        setFiles(DEFAULT_FILES);
      }
    } else {
      setFiles(DEFAULT_FILES);
    }

    const savedFolders = localStorage.getItem("stellar_ide_folders");
    if (savedFolders) {
      try {
        setFolders(JSON.parse(savedFolders));
      } catch {
        setFolders(["src"]);
      }
    } else {
      setFolders(["src"]);
    }

    const savedTabs = localStorage.getItem("stellar_ide_open_tabs");
    if (savedTabs) {
      try {
        setOpenTabs(JSON.parse(savedTabs));
      } catch {
        setOpenTabs(["src/lib.rs"]);
      }
    } else {
      setOpenTabs(["src/lib.rs"]);
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

  const saveFolders = (updatedFolders: string[]) => {
    setFolders(updatedFolders);
    localStorage.setItem("stellar_ide_folders", JSON.stringify(updatedFolders));
  };

  const saveTabs = (updatedTabs: string[]) => {
    setOpenTabs(updatedTabs);
    localStorage.setItem("stellar_ide_open_tabs", JSON.stringify(updatedTabs));
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
    if (!openTabs.includes(path)) {
      saveTabs([...openTabs, path]);
    }
    setActiveFile(path);
  };

  const handleCreateFile = (path: string) => {
    if (files[path] !== undefined) {
      alert("File already exists!");
      return;
    }
    const updated = { ...files, [path]: "" };
    saveFiles(updated);

    // Auto-detect and add parent directories to folders state
    const parts = path.split("/");
    if (parts.length > 1) {
      const parentDirs: string[] = [];
      let currentPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        parentDirs.push(currentPath);
      }

      let foldersUpdated = false;
      const newFolders = [...folders];
      parentDirs.forEach((dir) => {
        if (!newFolders.includes(dir)) {
          newFolders.push(dir);
          foldersUpdated = true;
        }
      });
      if (foldersUpdated) {
        saveFolders(newFolders);
      }
    }

    if (!openTabs.includes(path)) {
      saveTabs([...openTabs, path]);
    }
    setActiveFile(path);
    addLog(`Created file: ${path}`, "info");
  };

  const handleDeleteFile = (path: string) => {
    if (path === "src/lib.rs" || path === "Cargo.toml") return;
    const updated = { ...files };
    delete updated[path];
    saveFiles(updated);

    const remainingTabs = openTabs.filter((t) => t !== path);
    saveTabs(remainingTabs);

    if (activeFile === path) {
      if (remainingTabs.length > 0) {
        setActiveFile(remainingTabs[remainingTabs.length - 1]);
      } else {
        setActiveFile("");
      }
    }
    addLog(`Deleted file: ${path}`, "warning");
  };

  const handleRenameFile = (oldPath: string, newPath: string) => {
    if (oldPath === "src/lib.rs" || oldPath === "Cargo.toml") return;
    if (!newPath.trim()) return;
    if (files[newPath] !== undefined) {
      alert("A file with this name already exists!");
      return;
    }
    const updated = { ...files };
    const content = updated[oldPath];
    delete updated[oldPath];
    updated[newPath] = content;
    saveFiles(updated);

    const updatedTabs = openTabs.map((t) => (t === oldPath ? newPath : t));
    saveTabs(updatedTabs);

    if (activeFile === oldPath) {
      setActiveFile(newPath);
    }
    addLog(`Renamed file: ${oldPath} -> ${newPath}`, "info");
  };

  const handleCreateFolder = (path: string) => {
    if (!path.trim()) return;
    let finalPath = path.trim();
    if (!finalPath.startsWith("src/") && finalPath !== "src" && !finalPath.includes("/")) {
      finalPath = `src/${finalPath}`;
    }
    if (folders.includes(finalPath)) {
      alert("Folder already exists!");
      return;
    }
    const updated = [...folders, finalPath];
    saveFolders(updated);
    addLog(`Created folder: ${finalPath}`, "info");
  };

  const handleRenameFolder = (oldPath: string, newPath: string) => {
    if (oldPath === "src") return;
    if (!newPath.trim()) return;
    let finalNewPath = newPath.trim();
    if (oldPath.startsWith("src/") && !finalNewPath.startsWith("src/")) {
      finalNewPath = `src/${finalNewPath}`;
    }
    if (folders.includes(finalNewPath)) {
      alert("A folder with this name already exists!");
      return;
    }

    // 1. Rename parent folders and all subfolders
    const updatedFolders = folders.map((f) => {
      if (f === oldPath) return finalNewPath;
      if (f.startsWith(`${oldPath}/`)) {
        return f.replace(oldPath, finalNewPath);
      }
      return f;
    });
    saveFolders(updatedFolders);

    // 2. Rename all child files
    const updatedFiles = { ...files };
    let activeFileUpdated = false;
    let nextActiveFile = activeFile;

    for (const filePath of Object.keys(updatedFiles)) {
      if (filePath.startsWith(`${oldPath}/`)) {
        const newFilePath = filePath.replace(oldPath, finalNewPath);
        updatedFiles[newFilePath] = updatedFiles[filePath];
        delete updatedFiles[filePath];

        if (activeFile === filePath) {
          nextActiveFile = newFilePath;
          activeFileUpdated = true;
        }
      }
    }
    saveFiles(updatedFiles);

    // 3. Rename tabs
    const updatedTabs = openTabs.map((t) => {
      if (t.startsWith(`${oldPath}/`)) {
        return t.replace(oldPath, finalNewPath);
      }
      return t;
    });
    saveTabs(updatedTabs);

    if (activeFileUpdated) {
      setActiveFile(nextActiveFile);
    }
    addLog(`Renamed folder: ${oldPath} -> ${finalNewPath}`, "info");
  };

  const handleDeleteFolder = (path: string) => {
    if (path === "src") return;
    
    // 1. Delete matching folders and subfolders
    const updatedFolders = folders.filter((f) => f !== path && !f.startsWith(`${path}/`));
    saveFolders(updatedFolders);

    // 2. Delete child files
    const updatedFiles = { ...files };
    let activeFileUpdated = false;

    for (const filePath of Object.keys(updatedFiles)) {
      if (filePath.startsWith(`${path}/`)) {
        delete updatedFiles[filePath];
        if (activeFile === filePath) {
          activeFileUpdated = true;
        }
      }
    }
    saveFiles(updatedFiles);

    // 3. Remove child tabs
    const remainingTabs = openTabs.filter((t) => !t.startsWith(`${path}/`));
    saveTabs(remainingTabs);

    if (activeFileUpdated) {
      if (remainingTabs.length > 0) {
        setActiveFile(remainingTabs[remainingTabs.length - 1]);
      } else {
        setActiveFile("");
      }
    }
    addLog(`Deleted folder: ${path}`, "warning");
  };

  const handleCloseTab = (path: string) => {
    const remainingTabs = openTabs.filter((t) => t !== path);
    saveTabs(remainingTabs);

    if (activeFile === path) {
      if (remainingTabs.length > 0) {
        setActiveFile(remainingTabs[remainingTabs.length - 1]);
      } else {
        setActiveFile("");
      }
    }
  };

  const handleResetFiles = () => {
    saveFiles(DEFAULT_FILES);
    saveFolders(["src"]);
    saveTabs(["src/lib.rs"]);
    setActiveFile("src/lib.rs");
    setAbi(null);
    setWasmBase64(null);
    setContractId(null);
    localStorage.removeItem("stellar_ide_abi");
    localStorage.removeItem("stellar_ide_wasm");
    localStorage.removeItem("stellar_ide_contract_id");
    localStorage.removeItem("stellar_ide_folders");
    localStorage.removeItem("stellar_ide_open_tabs");
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

      {/* Main Workspace split */}
      <main className="ide-main">
        {/* Left Side: Sidebar with configuration / files */}
        <div className="sidebar">
          <div className="sidebar-brand-header">
            <Cpu size={16} style={{ color: "hsl(var(--accent-violet))", marginRight: "8px", flexShrink: 0 }} />
            <span className="brand-text">Soroban Playground</span>
          </div>
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
                folders={folders}
                activeFile={activeFile}
                onSelectFile={handleSelectFile}
                onCreateFile={handleCreateFile}
                onDeleteFile={handleDeleteFile}
                onRenameFile={handleRenameFile}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                onResetFiles={handleResetFiles}
              />
            )}
            {sidebarTab === "compiler" && (
              <>
                <CompilerPanel
                  files={files}
                  onCompileSuccess={handleCompileSuccess}
                  addLog={addLog}
                  wasmBase64={wasmBase64}
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
        <div 
          className="workspace-right"
          style={{ gridTemplateRows: isConsoleMinimized ? "1fr 35px" : "1fr 200px" }}
        >
          <div className="editor-container">
            {openTabs.length > 0 && (
              <div className="editor-tabs-bar">
                {openTabs.map((tabPath) => {
                  const isActive = tabPath === activeFile;
                  const fileName = tabPath.split("/").pop() || tabPath;
                  return (
                    <div
                      key={tabPath}
                      className={`editor-tab ${isActive ? "active" : ""}`}
                      onClick={() => handleSelectFile(tabPath)}
                      title={tabPath}
                    >
                      <span className="tab-name">{fileName}</span>
                      <button
                        className="tab-close-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseTab(tabPath);
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {activeFile && openTabs.includes(activeFile) ? (
              <Editor
                activeFile={activeFile}
                content={files[activeFile] || ""}
                onChange={handleContentChange}
              />
            ) : (
              <div className="empty-editor-placeholder">
                <Cpu size={48} className="placeholder-icon" />
                <h3>Soroban Sandbox</h3>
                <p>Select a file from the explorer sidebar or create a new one to start writing smart contracts.</p>
                <div className="placeholder-actions">
                  <button className="btn btn-primary" onClick={handleResetFiles}>Reset Workspace</button>
                </div>
              </div>
            )}
          </div>

          <div className="console-panel">
            <div className="console-header">
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Play size={12} style={{ color: "hsl(var(--accent-success))" }} />
                <span>EXECUTION LOGS</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                <div style={{ width: "1px", height: "12px", background: "rgba(255, 255, 255, 0.15)" }}></div>
                <button
                  onClick={() => setIsConsoleMinimized(!isConsoleMinimized)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "hsl(var(--text-muted))",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    padding: "2px"
                  }}
                  title={isConsoleMinimized ? "Maximize Console" : "Minimize Console"}
                >
                  {isConsoleMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>
            {!isConsoleMinimized && (
              <div className="console-body">
                {logs.map((log) => (
                  <div key={log.id} className={`console-line ${log.type}`}>
                    <span style={{ color: "hsl(var(--text-muted))", marginRight: "8px" }}>[{log.timestamp}]</span>
                    <span>{log.text}</span>
                  </div>
                ))}
              </div>
            )}
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
