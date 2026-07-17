"use client";

import React, { useState, useEffect, useRef } from "react";
import { Folder, File, Trash2, Plus, RefreshCw, Edit2 } from "lucide-react";

interface FileTreeProps {
  files: { [path: string]: string };
  activeFile: string;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
  onResetFiles: () => void;
}

interface ContextMenu {
  x: number;
  y: number;
  visible: boolean;
  path: string;
}

export default function FileTree({
  files,
  activeFile,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
  onResetFiles,
}: FileTreeProps) {
  const [newFileName, setNewFileName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Context Menu and Rename States
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ x: 0, y: 0, visible: false, path: "" });
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close context menu on any window click
  useEffect(() => {
    const handleWindowClick = () => {
      setContextMenu((prev) => ({ ...prev, visible: false }));
    };
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  // Autofocus rename input and select input text
  useEffect(() => {
    if (editingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      const input = renameInputRef.current;
      const startSelect = editingPath.startsWith("src/") ? 4 : 0;
      input.setSelectionRange(startSelect, input.value.length);
    }
  }, [editingPath]);

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    
    // Default to src/ if no folder specified and name is a rust file (except Cargo.toml)
    let path = newFileName.trim();
    if (!path.startsWith("src/") && path !== "Cargo.toml" && !path.includes("/")) {
      path = `src/${path}`;
    }
    
    onCreateFile(path);
    setNewFileName("");
    setIsCreating(false);
  };

  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true,
      path,
    });
  };

  const handleStartRename = (path: string) => {
    if (path === "src/lib.rs" || path === "Cargo.toml") return;
    setEditingPath(path);
    setEditValue(path);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleTriggerDelete = (path: string) => {
    if (path === "src/lib.rs" || path === "Cargo.toml") return;
    setContextMenu((prev) => ({ ...prev, visible: false }));
    if (confirm(`Delete ${path}?`)) {
      onDeleteFile(path);
    }
  };

  const handleRenameSubmit = () => {
    if (!editingPath) return;
    const oldPath = editingPath;
    const rawVal = editValue.trim();
    
    if (!rawVal || rawVal === oldPath) {
      setEditingPath(null);
      return;
    }
    
    let newPath = rawVal;
    if (oldPath.startsWith("src/") && !newPath.startsWith("src/")) {
      newPath = `src/${newPath}`;
    }
    
    onRenameFile(oldPath, newPath);
    setEditingPath(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setEditingPath(null);
    }
  };

  // Group files by directory
  const renderFileTree = () => {
    const filePaths = Object.keys(files).filter((path) => path !== "Cargo.toml").sort();
    
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {filePaths.map((path) => {
          const isActive = path === activeFile;
          const isEditing = path === editingPath;
          
          return (
            <div
              key={path}
              className={`file-item ${isActive ? "active" : ""}`}
              onClick={() => !isEditing && onSelectFile(path)}
              onContextMenu={(e) => handleContextMenu(e, path)}
            >
              <div style={{ display: "flex", alignSelf: "center", alignItems: "center", gap: "8px", width: "100%", overflow: "hidden" }}>
                <File size={16} style={{ color: "hsl(var(--text-secondary))", flexShrink: 0 }} />
                {isEditing ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    className="inline-edit-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={handleRenameKeyDown}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span style={{ fontSize: "0.8rem", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {path}
                  </span>
                )}
              </div>
              
              {/* Actions on Hover */}
              {path !== "src/lib.rs" && !isEditing && (
                <div className="file-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="file-btn"
                    onClick={() => handleStartRename(path)}
                    title="Rename File"
                    style={{ marginRight: "4px" }}
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    className="file-btn"
                    onClick={() => handleTriggerDelete(path)}
                    title="Delete File"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
      <div className="panel-title">
        <span>Workspace Explorer</span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="file-btn"
            onClick={() => setIsCreating(!isCreating)}
            title="New File"
            style={{ color: "hsl(var(--text-primary))" }}
          >
            <Plus size={16} />
          </button>
          <button
            className="file-btn"
            onClick={() => {
              if (confirm("Reset workspace files to default Hello World contract?")) {
                onResetFiles();
              }
            }}
            title="Reset Workspace"
            style={{ color: "hsl(var(--text-primary))" }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {isCreating && (
        <form onSubmit={handleSubmitCreate} className="input-group" style={{ margin: 0 }}>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. src/helper.rs"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            autoFocus
          />
          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
            <button type="submit" className="btn btn-primary" style={{ padding: "6px 12px", fontSize: "0.75rem", flex: 1 }}>
              Add
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: "0.75rem", flex: 1 }}
              onClick={() => setIsCreating(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", color: "hsl(var(--text-muted))" }}>
          <Folder size={14} />
          <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>hello-world</span>
        </div>
        <div style={{ paddingLeft: "12px" }}>
          {renderFileTree()}
        </div>
      </div>

      {/* Custom Context Menu */}
      {contextMenu.visible && (
        <div
          className="custom-context-menu"
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={() => handleStartRename(contextMenu.path)}
            disabled={contextMenu.path === "src/lib.rs"}
          >
            <Edit2 size={13} />
            <span>Rename</span>
          </button>
          <button
            className="context-menu-item delete"
            onClick={() => handleTriggerDelete(contextMenu.path)}
            disabled={contextMenu.path === "src/lib.rs"}
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
