"use client";

import React, { useState, useEffect, useRef } from "react";
import { Folder, FolderPlus, File, Trash2, Plus, RefreshCw, Edit2, ChevronDown, ChevronRight, FilePlus } from "lucide-react";

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
  // Menu, rename, selected and folding states
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ x: 0, y: 0, visible: false, path: "", isFolder: false });
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<{ [path: string]: boolean }>({});
  const [selectedPath, setSelectedPath] = useState<string>("src");

  // Inline Creation States (under specific folders)
  const [creatingUnderPath, setCreatingUnderPath] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<"file" | "folder" | null>(null);
  const [creatingValue, setCreatingValue] = useState<string>("");

  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

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

  // Sync selectedPath with activeFile changes
  useEffect(() => {
    if (activeFile) {
      setSelectedPath(activeFile);
    }
  }, [activeFile]);

  // Autofocus creation input
  useEffect(() => {
    if (creatingUnderPath !== null && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [creatingUnderPath]);

  // Helper to expand all ancestor folders recursively
  const expandAncestors = (path: string) => {
    const parts = path.split("/");
    const updates: { [p: string]: boolean } = {};
    let current = "";
    for (let i = 0; i < parts.length; i++) {
      current = current ? `${current}/${parts[i]}` : parts[i];
      updates[current] = false; // false means expanded
    }
    setCollapsedFolders((prev) => ({ ...prev, ...updates }));
  };

  const handleStartCreate = (parentPath: string, type: "file" | "folder") => {
    expandAncestors(parentPath);
    setCreatingUnderPath(parentPath);
    setCreatingType(type);
    setCreatingValue("");
  };

  const handleGlobalCreate = (type: "file" | "folder") => {
    let parentDir = "src";
    if (selectedPath) {
      if (folders.includes(selectedPath) || selectedPath === "src") {
        parentDir = selectedPath;
      } else if (selectedPath.includes("/")) {
        const idx = selectedPath.lastIndexOf("/");
        parentDir = selectedPath.slice(0, idx);
      }
    }
    handleStartCreate(parentDir, type);
  };

  const handleCreateSubmit = () => {
    if (creatingUnderPath === null || creatingType === null) return;
    const name = creatingValue.trim();
    if (!name) {
      setCreatingUnderPath(null);
      setCreatingType(null);
      setCreatingValue("");
      return;
    }

    const fullPath = `${creatingUnderPath}/${name}`;

    if (creatingType === "file") {
      onCreateFile(fullPath);
    } else {
      onCreateFolder(fullPath);
    }

    setCreatingUnderPath(null);
    setCreatingType(null);
    setCreatingValue("");
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreateSubmit();
    } else if (e.key === "Escape") {
      setCreatingUnderPath(null);
      setCreatingType(null);
      setCreatingValue("");
    }
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

  const handleContextMenu = (e: React.MouseEvent, path: string, isFolder: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true,
      path,
      isFolder,
    });
  };

  // Recursive tree rendering
  const renderNode = (node: TreeNode, depth: number) => {
    if (node.path === "") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {node.children.map((child) => renderNode(child, depth))}
        </div>
      );
    }

    const isActive = node.path === selectedPath || (!node.isFolder && node.path === activeFile);
    const isEditing = node.path === editingPath;
    const isCollapsed = node.isFolder && collapsedFolders[node.path];
    const isPlaceholder = node.name === "";

    if (isPlaceholder) {
      return (
        <div
          key={node.path}
          className="file-item"
          style={{ paddingLeft: `${depth * 10}px` }}
        >
          <div style={{ display: "flex", alignSelf: "center", alignItems: "center", gap: "6px", width: "100%" }}>
            {node.isFolder ? (
              <Folder size={16} style={{ color: "hsl(var(--accent-violet))", flexShrink: 0 }} />
            ) : (
              <File size={16} style={{ color: "hsl(var(--text-secondary))", flexShrink: 0, marginLeft: "14px" }} />
            )}
            <input
              ref={createInputRef}
              type="text"
              className="inline-edit-input"
              placeholder={node.isFolder ? "folder name" : "file name.rs"}
              value={creatingValue}
              onChange={(e) => setCreatingValue(e.target.value)}
              onBlur={handleCreateSubmit}
              onKeyDown={handleCreateKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      );
    }

    const handleNodeClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedPath(node.path);
      if (node.isFolder) {
        setCollapsedFolders((prev) => ({ ...prev, [node.path]: !prev[node.path] }));
      } else {
        onSelectFile(node.path);
      }
    };

    const handleNodeContextMenu = (e: React.MouseEvent) => {
      setSelectedPath(node.path);
      handleContextMenu(e, node.path, node.isFolder);
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

          {/* Hover Actions */}
          {node.path !== "src" && node.path !== "src/lib.rs" && !isEditing && (
            <div className="file-actions" onClick={(e) => e.stopPropagation()}>
              {node.isFolder && (
                <>
                  <button
                    className="file-btn"
                    onClick={() => handleStartCreate(node.path, "file")}
                    title="New File..."
                    style={{ marginRight: "4px" }}
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    className="file-btn"
                    onClick={() => handleStartCreate(node.path, "folder")}
                    title="New Folder..."
                    style={{ marginRight: "4px" }}
                  >
                    <FolderPlus size={13} />
                  </button>
                </>
              )}
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

        {/* Render child tree nodes if not collapsed */}
        {node.isFolder && !isCollapsed && node.children.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const treeRoot = buildTree(files, folders);

  // Insert creation placeholder dynamically under parent path
  if (creatingUnderPath !== null && creatingType !== null) {
    const addPlaceholder = (node: TreeNode) => {
      if (node.path === creatingUnderPath) {
        node.children.push({
          name: "", // trigger input rendering
          path: `${creatingUnderPath}/_placeholder`,
          isFolder: creatingType === "folder",
          children: [],
        });
        return true;
      }
      for (const child of node.children) {
        if (child.isFolder) {
          if (addPlaceholder(child)) return true;
        }
      }
      return false;
    };
    addPlaceholder(treeRoot);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", height: "100%" }}>
      <div className="panel-title">
        <span>Workspace Explorer</span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="file-btn"
            onClick={() => handleGlobalCreate("file")}
            title="New File (relative to selection)"
            style={{ color: "hsl(var(--text-primary))" }}
          >
            <Plus size={16} />
          </button>
          <button
            className="file-btn"
            onClick={() => handleGlobalCreate("folder")}
            title="New Folder (relative to selection)"
            style={{ color: "hsl(var(--text-primary))" }}
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
          {contextMenu.isFolder && (
            <>
              <button
                className="context-menu-item"
                onClick={() => handleStartCreate(contextMenu.path, "file")}
              >
                <FilePlus size={13} />
                <span>New File</span>
              </button>
              <button
                className="context-menu-item"
                onClick={() => handleStartCreate(contextMenu.path, "folder")}
              >
                <FolderPlus size={13} />
                <span>New Folder</span>
              </button>
              <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.06)", margin: "4px 0" }}></div>
            </>
          )}
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
