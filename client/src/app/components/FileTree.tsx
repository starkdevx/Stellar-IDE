"use client";

import React, { useState, useEffect, useRef } from "react";
import { Folder, FolderPlus, File, Trash2, Plus, RefreshCw, Edit2, ChevronDown, ChevronRight } from "lucide-react";

interface FileTreeProps {
  files: { [path: string]: string };
  folders: string[];
  activeFile: string;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
  onCreateFolder: (path: string) => void;
  onRenameFolder: (oldPath: string, newPath: string) => void;
  onDeleteFolder: (path: string) => void;
  onResetFiles: () => void;
}

interface ContextMenu {
  x: number;
  y: number;
  visible: boolean;
  path: string;
  isFolder: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
}

// Reconstructs alphabetical tree hierarchy from flat folders array + flat files map
function buildTree(files: { [path: string]: string }, folders: string[]): TreeNode {
  const root: TreeNode = { name: "hello-world", path: "", isFolder: true, children: [] };

  const addPath = (fullPath: string, isFolder: boolean) => {
    const parts = fullPath.split("/").filter(Boolean);
    let current = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      let child = current.children.find((c) => c.name === part && c.isFolder === (i < parts.length - 1 || isFolder));
      if (!child) {
        child = {
          name: part,
          path: currentPath,
          isFolder: i < parts.length - 1 || isFolder,
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }
  };

  // Add folders and files
  folders.forEach((f) => addPath(f, true));
  Object.keys(files).forEach((f) => addPath(f, false));

  // Sort: folders first, then files, then alphabetically
  const sortNodes = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNodes);
  };
  sortNodes(root);

  return root;
}

export default function FileTree({
  files,
  folders,
  activeFile,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onResetFiles,
}: FileTreeProps) {
  const [isCreating, setIsCreating] = useState<"file" | "folder" | null>(null);
  const [newFileName, setNewFileName] = useState("");

  // Menu, rename and folding states
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ x: 0, y: 0, visible: false, path: "", isFolder: false });
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<{ [path: string]: boolean }>({});
  
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close context menu on any window click
  useEffect(() => {
    const handleWindowClick = () => {
      setContextMenu((prev) => ({ ...prev, visible: false }));
    };
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  // Autofocus rename input and select text range
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
    
    const path = newFileName.trim();
    if (isCreating === "file") {
      onCreateFile(path);
    } else if (isCreating === "folder") {
      onCreateFolder(path);
    }
    
    setNewFileName("");
    setIsCreating(null);
  };

  const handleStartRename = (path: string, isFolder: boolean) => {
    if (path === "src" || path === "src/lib.rs" || path === "Cargo.toml") return;
    setEditingPath(path);
    setEditValue(path);
    setIsEditingFolder(isFolder);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleTriggerDelete = (path: string, isFolder: boolean) => {
    if (path === "src" || path === "src/lib.rs" || path === "Cargo.toml") return;
    setContextMenu((prev) => ({ ...prev, visible: false }));
    
    const targetName = isFolder ? `folder "${path}" and all its contents` : `file "${path}"`;
    if (confirm(`Delete ${targetName}?`)) {
      if (isFolder) {
        onDeleteFolder(path);
      } else {
        onDeleteFile(path);
      }
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
    
    if (isEditingFolder) {
      onRenameFolder(oldPath, newPath);
    } else {
      onRenameFile(oldPath, newPath);
    }
    setEditingPath(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setEditingPath(null);
    }
  };

  // Recursive directory tree renderer
  const renderNode = (node: TreeNode, depth: number) => {
    // Skip root node container render, just output children
    if (node.path === "") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {node.children.map((child) => renderNode(child, depth))}
        </div>
      );
    }

    const isActive = !node.isFolder && node.path === activeFile;
    const isEditing = node.path === editingPath;
    const isCollapsed = node.isFolder && collapsedFolders[node.path];

    const handleNodeClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (node.isFolder) {
        setCollapsedFolders((prev) => ({ ...prev, [node.path]: !prev[node.path] }));
      } else {
        onSelectFile(node.path);
      }
    };

    const handleNodeContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        visible: true,
        path: node.path,
        isFolder: node.isFolder,
      });
    };

    return (
      <div key={node.path} style={{ display: "flex", flexDirection: "column" }}>
        <div
          className={`file-item ${isActive ? "active" : ""}`}
          onClick={handleNodeClick}
          onContextMenu={handleNodeContextMenu}
          style={{ paddingLeft: `${depth * 10}px` }}
        >
          <div style={{ display: "flex", alignSelf: "center", alignItems: "center", gap: "6px", width: "100%", overflow: "hidden" }}>
            {node.isFolder ? (
              <>
                {isCollapsed ? (
                  <ChevronRight size={14} style={{ color: "hsl(var(--text-muted))", flexShrink: 0 }} />
                ) : (
                  <ChevronDown size={14} style={{ color: "hsl(var(--text-muted))", flexShrink: 0 }} />
                )}
                <Folder size={16} style={{ color: "hsl(var(--accent-violet))", flexShrink: 0 }} />
              </>
            ) : (
              <File size={16} style={{ color: "hsl(var(--text-secondary))", flexShrink: 0, marginLeft: "14px" }} />
            )}

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
                {node.name}
              </span>
            )}
          </div>

          {/* Hover Actions (Delete / Rename) */}
          {node.path !== "src" && node.path !== "src/lib.rs" && !isEditing && (
            <div className="file-actions" onClick={(e) => e.stopPropagation()}>
              <button
                className="file-btn"
                onClick={() => handleStartRename(node.path, node.isFolder)}
                title="Rename"
                style={{ marginRight: "4px" }}
              >
                <Edit2 size={12} />
              </button>
              <button
                className="file-btn"
                onClick={() => handleTriggerDelete(node.path, node.isFolder)}
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Render folder children if expanded */}
        {node.isFolder && !isCollapsed && node.children.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const treeRoot = buildTree(files, folders);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
      <div className="panel-title">
        <span>Workspace Explorer</span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="file-btn"
            onClick={() => setIsCreating(isCreating === "file" ? null : "file")}
            title="New File"
            style={{ color: isCreating === "file" ? "hsl(var(--accent-cyan))" : "hsl(var(--text-primary))" }}
          >
            <Plus size={16} />
          </button>
          <button
            className="file-btn"
            onClick={() => setIsCreating(isCreating === "folder" ? null : "folder")}
            title="New Folder"
            style={{ color: isCreating === "folder" ? "hsl(var(--accent-cyan))" : "hsl(var(--text-primary))" }}
          >
            <FolderPlus size={16} />
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
            placeholder={isCreating === "file" ? "e.g. src/helper.rs" : "e.g. src/types"}
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
              onClick={() => setIsCreating(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ paddingLeft: "4px" }}>
          {renderNode(treeRoot, 0)}
        </div>
      </div>

      {/* Right Click Context Menu */}
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
            onClick={() => handleStartRename(contextMenu.path, contextMenu.isFolder)}
            disabled={contextMenu.path === "src" || contextMenu.path === "src/lib.rs"}
          >
            <Edit2 size={13} />
            <span>Rename</span>
          </button>
          <button
            className="context-menu-item delete"
            onClick={() => handleTriggerDelete(contextMenu.path, contextMenu.isFolder)}
            disabled={contextMenu.path === "src" || contextMenu.path === "src/lib.rs"}
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
