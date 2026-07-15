"use client";

import React, { useState } from "react";
import { Folder, File, Trash2, Plus, RefreshCw } from "lucide-react";

interface FileTreeProps {
  files: { [path: string]: string };
  activeFile: string;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onResetFiles: () => void;
}

export default function FileTree({
  files,
  activeFile,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onResetFiles,
}: FileTreeProps) {
  const [newFileName, setNewFileName] = useState("");
  const [isCreating, setIsCreating] = useState(false);





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
    </div>
  );
}
