"use client";

import React, { useState, useEffect } from "react";
import { Folder, Cpu, Activity, Play, RefreshCw, X, ShieldAlert, ChevronUp, ChevronDown } from "lucide-react";
import FileTree from "./components/FileTree";
import Editor from "./components/Editor";
import CompilerPanel from "./components/CompilerPanel";
import DeployPanel from "./components/DeployPanel";
import InteractPanel from "./components/InteractPanel";
import ProjectSelector, { Project } from "./components/ProjectSelector";

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
use soroban_sdk::Env;

#[test]
fn test() {
    let env = Env::default();
    let contract_id = env.register_contract(None, Contract);
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [sidebarTab, setSidebarTab] = useState<"explorer" | "compiler" | "interact">("explorer");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isConsoleMinimized, setIsConsoleMinimized] = useState<boolean>(false);

  // Initialize projects & state on client side only (avoid SSR mismatch)
  useEffect(() => {
    let initialProjects: Project[] = [];
    let initialActiveId = "";

    const savedProjects = localStorage.getItem("stellar_ide_projects_v1");
    if (savedProjects) {
      try {
        initialProjects = JSON.parse(savedProjects);
      } catch {
        initialProjects = [];
      }
    }

    // Migrate legacy data or create default initial project if none exists
    if (!initialProjects || initialProjects.length === 0) {
      const savedFiles = localStorage.getItem("stellar_ide_files");
      const savedFolders = localStorage.getItem("stellar_ide_folders");
      const savedTabs = localStorage.getItem("stellar_ide_open_tabs");
      const savedContractId = localStorage.getItem("stellar_ide_contract_id");
      const savedAbi = localStorage.getItem("stellar_ide_abi");
      const savedWasm = localStorage.getItem("stellar_ide_wasm");

      let filesData = DEFAULT_FILES;
      if (savedFiles) {
        try {
          const parsed = JSON.parse(savedFiles);
          delete parsed["Cargo.toml"];
          filesData = parsed;
        } catch {}
      }

      let foldersData = ["src"];
      if (savedFolders) {
        try {
          foldersData = JSON.parse(savedFolders);
        } catch {}
      }

      let tabsData = ["src/lib.rs"];
      if (savedTabs) {
        try {
          tabsData = JSON.parse(savedTabs);
        } catch {}
      }

      let abiData = null;
      if (savedAbi) {
        try {
          abiData = JSON.parse(savedAbi);
        } catch {}
      }

      const defaultProject: Project = {
        id: "proj_default",
        name: "hello-world",
        createdAt: Date.now(),
        files: filesData,
        folders: foldersData,
        openTabs: tabsData,
        activeFile: "src/lib.rs",
        abi: abiData,
        wasmBase64: savedWasm || null,
        contractId: savedContractId || null,
      };

      initialProjects = [defaultProject];
      initialActiveId = defaultProject.id;
      localStorage.setItem("stellar_ide_projects_v1", JSON.stringify(initialProjects));
      localStorage.setItem("stellar_ide_active_project_id", initialActiveId);
    } else {
      const savedActiveId = localStorage.getItem("stellar_ide_active_project_id");
      if (savedActiveId && initialProjects.some((p) => p.id === savedActiveId)) {
        initialActiveId = savedActiveId;
      } else {
        initialActiveId = initialProjects[0].id;
      }
    }

    setProjects(initialProjects);
    setActiveProjectId(initialActiveId);
    setMounted(true);

    const now = new Date().toLocaleTimeString();
    setLogs([
      {
        id: "init",
        text: "Stellar Soroban Multi-Project IDE initialized. Ready to build contracts.",
        type: "success",
        timestamp: now,
      },
    ]);
  }, []);

  // Derive active project state dynamically
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];
  const activeProjectName = activeProject?.name || "hello-world";
  const files = activeProject?.files || DEFAULT_FILES;
  const folders = activeProject?.folders || ["src"];
  const openTabs = activeProject?.openTabs || ["src/lib.rs"];
  const activeFile = activeProject?.activeFile || "src/lib.rs";
  const abi = activeProject?.abi || null;
  const wasmBase64 = activeProject?.wasmBase64 || null;
  const contractId = activeProject?.contractId || null;

  // Persistence helper for updating active project attributes
  const updateActiveProject = (updatedFields: Partial<Project>) => {
    setProjects((prevProjects) => {
      const nextProjects = prevProjects.map((p) => {
        if (p.id === activeProjectId) {
          return { ...p, ...updatedFields };
        }
        return p;
      });
      localStorage.setItem("stellar_ide_projects_v1", JSON.stringify(nextProjects));
      return nextProjects;
    });
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

  // Multi-Project Handlers
  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    localStorage.setItem("stellar_ide_active_project_id", id);
    const target = projects.find((p) => p.id === id);
    if (target) {
      addLog(`Switched active workspace to project "${target.name}"`, "info");
    }
  };

  const handleCreateProject = (name: string) => {
    const newProj: Project = {
      id: `proj_${Date.now()}`,
      name: name.trim() || "untitled-project",
      createdAt: Date.now(),
      files: { ...DEFAULT_FILES },
      folders: ["src"],
      openTabs: ["src/lib.rs"],
      activeFile: "src/lib.rs",
      abi: null,
      wasmBase64: null,
      contractId: null,
    };
    const nextProjects = [...projects, newProj];
    setProjects(nextProjects);
    setActiveProjectId(newProj.id);
    localStorage.setItem("stellar_ide_projects_v1", JSON.stringify(nextProjects));
    localStorage.setItem("stellar_ide_active_project_id", newProj.id);
    addLog(`Created new project workspace "${newProj.name}"`, "success");
  };

  const handleRenameProject = (id: string, newName: string) => {
    setProjects((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, name: newName } : p));
      localStorage.setItem("stellar_ide_projects_v1", JSON.stringify(updated));
      return updated;
    });
    addLog(`Renamed project workspace to "${newName}"`, "info");
  };

  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) return;
    const remaining = projects.filter((p) => p.id !== id);
    setProjects(remaining);
    let nextActiveId = activeProjectId;
    if (activeProjectId === id) {
      nextActiveId = remaining[0].id;
      setActiveProjectId(nextActiveId);
    }
    localStorage.setItem("stellar_ide_projects_v1", JSON.stringify(remaining));
    localStorage.setItem("stellar_ide_active_project_id", nextActiveId);
    addLog(`Deleted project workspace`, "warning");
  };

  // File system and tab handlers for active project
  const handleSelectFile = (path: string) => {
    const newTabs = openTabs.includes(path) ? openTabs : [...openTabs, path];
    updateActiveProject({ openTabs: newTabs, activeFile: path });
  };

  const handleCreateFile = (path: string) => {
    if (files[path] !== undefined) {
      alert("File already exists!");
      return;
    }
    const updatedFiles = { ...files, [path]: "" };

    const parts = path.split("/");
    let updatedFolders = [...folders];
    if (parts.length > 1) {
      const parentDirs: string[] = [];
      let currentPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        parentDirs.push(currentPath);
      }
      parentDirs.forEach((dir) => {
        if (!updatedFolders.includes(dir)) {
          updatedFolders.push(dir);
        }
      });
    }

    const updatedTabs = openTabs.includes(path) ? openTabs : [...openTabs, path];
    updateActiveProject({
      files: updatedFiles,
      folders: updatedFolders,
      openTabs: updatedTabs,
      activeFile: path,
    });
    addLog(`Created file: ${path}`, "info");
  };

  const handleDeleteFile = (path: string) => {
    if (path === "src/lib.rs" || path === "Cargo.toml") return;
    const updatedFiles = { ...files };
    delete updatedFiles[path];

    const remainingTabs = openTabs.filter((t) => t !== path);
    let nextActiveFile = activeFile;
    if (activeFile === path) {
      nextActiveFile = remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1] : "";
    }

    updateActiveProject({
      files: updatedFiles,
      openTabs: remainingTabs,
      activeFile: nextActiveFile,
    });
    addLog(`Deleted file: ${path}`, "warning");
  };

  const handleRenameFile = (oldPath: string, newPath: string) => {
    if (oldPath === "src/lib.rs" || oldPath === "Cargo.toml") return;
    if (!newPath.trim()) return;
    if (files[newPath] !== undefined) {
      alert("A file with this name already exists!");
      return;
    }
    const updatedFiles = { ...files };
    const content = updatedFiles[oldPath];
    delete updatedFiles[oldPath];
    updatedFiles[newPath] = content;

    const updatedTabs = openTabs.map((t) => (t === oldPath ? newPath : t));
    const nextActiveFile = activeFile === oldPath ? newPath : activeFile;

    updateActiveProject({
      files: updatedFiles,
      openTabs: updatedTabs,
      activeFile: nextActiveFile,
    });
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
    updateActiveProject({ folders: [...folders, finalPath] });
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

    const updatedFolders = folders.map((f) => {
      if (f === oldPath) return finalNewPath;
      if (f.startsWith(`${oldPath}/`)) {
        return f.replace(oldPath, finalNewPath);
      }
      return f;
    });

    const updatedFiles = { ...files };
    let nextActiveFile = activeFile;
    for (const filePath of Object.keys(updatedFiles)) {
      if (filePath.startsWith(`${oldPath}/`)) {
        const newFilePath = filePath.replace(oldPath, finalNewPath);
        updatedFiles[newFilePath] = updatedFiles[filePath];
        delete updatedFiles[filePath];
        if (activeFile === filePath) {
          nextActiveFile = newFilePath;
        }
      }
    }

    const updatedTabs = openTabs.map((t) => {
      if (t.startsWith(`${oldPath}/`)) {
        return t.replace(oldPath, finalNewPath);
      }
      return t;
    });

    updateActiveProject({
      folders: updatedFolders,
      files: updatedFiles,
      openTabs: updatedTabs,
      activeFile: nextActiveFile,
    });
    addLog(`Renamed folder: ${oldPath} -> ${finalNewPath}`, "info");
  };

  const handleDeleteFolder = (path: string) => {
    if (path === "src") return;

    const updatedFolders = folders.filter((f) => f !== path && !f.startsWith(`${path}/`));
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

    const remainingTabs = openTabs.filter((t) => !t.startsWith(`${path}/`));
    let nextActiveFile = activeFile;
    if (activeFileUpdated) {
      nextActiveFile = remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1] : "";
    }

    updateActiveProject({
      folders: updatedFolders,
      files: updatedFiles,
      openTabs: remainingTabs,
      activeFile: nextActiveFile,
    });
    addLog(`Deleted folder: ${path}`, "warning");
  };

  const handleCloseTab = (path: string) => {
    const remainingTabs = openTabs.filter((t) => t !== path);
    let nextActiveFile = activeFile;
    if (activeFile === path) {
      nextActiveFile = remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1] : "";
    }
    updateActiveProject({ openTabs: remainingTabs, activeFile: nextActiveFile });
  };

  const handleResetFiles = () => {
    updateActiveProject({
      files: DEFAULT_FILES,
      folders: ["src"],
      openTabs: ["src/lib.rs"],
      activeFile: "src/lib.rs",
      abi: null,
      wasmBase64: null,
      contractId: null,
    });
    addLog(`Reset project "${activeProject?.name}" files to default template.`, "info");
  };

  const handleContentChange = (val: string | undefined) => {
    if (val === undefined || !activeFile) return;
    const updatedFiles = { ...files, [activeFile]: val };
    updateActiveProject({ files: updatedFiles });
  };

  const handleCompileSuccess = (newAbi: any[], wasm: string) => {
    updateActiveProject({ abi: newAbi, wasmBase64: wasm });
    setSidebarTab("compiler");
  };

  const handleDeploySuccess = (id: string) => {
    updateActiveProject({ contractId: id });
    setSidebarTab("interact");
  };

  const handleContractIdChange = (id: string) => {
    updateActiveProject({ contractId: id || null });
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
              <>
                <ProjectSelector
                  projects={projects}
                  activeProjectId={activeProjectId}
                  onSelectProject={handleSelectProject}
                  onCreateProject={handleCreateProject}
                  onRenameProject={handleRenameProject}
                  onDeleteProject={handleDeleteProject}
                />
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
              </>
            )}
            {sidebarTab === "compiler" && (
              <>
                <CompilerPanel
                  files={files}
                  onCompileSuccess={handleCompileSuccess}
                  addLog={addLog}
                  wasmBase64={wasmBase64}
                  projectName={activeProjectName}
                />
                <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", margin: "4px 0" }}></div>
                <DeployPanel
                  wasmBase64={wasmBase64}
                  onDeploySuccess={handleDeploySuccess}
                  addLog={addLog}
                  projectName={activeProjectName}
                />
              </>
            )}
            {sidebarTab === "interact" && (
              <InteractPanel
                abi={abi}
                contractId={contractId}
                onContractIdChange={handleContractIdChange}
                addLog={addLog}
                projectName={activeProjectName}
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
                <h3>{activeProject?.name || "Soroban Sandbox"}</h3>
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
