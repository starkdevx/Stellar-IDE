"use client";

import React, { useState } from "react";
import { Box, Plus, Edit3, Trash2, FolderKanban, ChevronDown, Check, X } from "lucide-react";

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  files: { [path: string]: string };
  folders: string[];
  openTabs: string[];
  activeFile: string;
  abi: any[] | null;
  wasmBase64: string | null;
  contractId: string | null;
}

interface ProjectSelectorProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string) => void;
  onRenameProject: (id: string, newName: string) => void;
  onDeleteProject: (id: string) => void;
}

export default function ProjectSelector({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
}: ProjectSelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [newProjectName, setNewProjectName] = useState("");
  const [renameInput, setRenameInput] = useState("");

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const handleOpenCreateModal = () => {
    setNewProjectName(`project-${projects.length + 1}`);
    setIsCreateModalOpen(true);
    setIsDropdownOpen(false);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onCreateProject(newProjectName.trim());
    setIsCreateModalOpen(false);
  };

  const handleOpenRenameModal = () => {
    if (!activeProject) return;
    setRenameInput(activeProject.name);
    setIsRenameModalOpen(true);
    setIsDropdownOpen(false);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameInput.trim() || !activeProject) return;
    onRenameProject(activeProject.id, renameInput.trim());
    setIsRenameModalOpen(false);
  };

  const handleOpenDeleteModal = () => {
    if (projects.length <= 1) return;
    setIsDeleteModalOpen(true);
    setIsDropdownOpen(false);
  };

  const handleDeleteConfirm = () => {
    if (!activeProject) return;
    onDeleteProject(activeProject.id);
    setIsDeleteModalOpen(false);
  };

  return (
    <div className="project-selector-container">
      <div className="project-selector-bar">
        <button
          className="project-dropdown-btn"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          title="Switch Project Workspace"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
            <Box size={14} style={{ color: "hsl(var(--accent-cyan))", flexShrink: 0 }} />
            <span className="project-name-text">{activeProject?.name || "Select Project"}</span>
          </div>
          <ChevronDown size={12} style={{ color: "hsl(var(--text-muted))" }} />
        </button>

        <div className="project-actions-group">
          <button
            className="project-action-icon-btn"
            onClick={handleOpenCreateModal}
            title="Create New Project"
          >
            <Plus size={14} />
          </button>
          <button
            className="project-action-icon-btn"
            onClick={handleOpenRenameModal}
            title="Rename Active Project"
          >
            <Edit3 size={13} />
          </button>
          <button
            className={`project-action-icon-btn ${projects.length <= 1 ? "disabled" : ""}`}
            onClick={handleOpenDeleteModal}
            disabled={projects.length <= 1}
            title={projects.length <= 1 ? "Cannot delete the only remaining project" : "Delete Active Project"}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Project Dropdown Menu */}
      {isDropdownOpen && (
        <>
          <div className="dropdown-overlay" onClick={() => setIsDropdownOpen(false)}></div>
          <div className="project-dropdown-menu">
            <div className="dropdown-header">Workspaces ({projects.length})</div>
            <div className="dropdown-list">
              {projects.map((proj) => {
                const isSelected = proj.id === activeProjectId;
                return (
                  <div
                    key={proj.id}
                    className={`dropdown-item ${isSelected ? "active" : ""}`}
                    onClick={() => {
                      onSelectProject(proj.id);
                      setIsDropdownOpen(false);
                    }}
                  >
                    <FolderKanban size={14} style={{ color: isSelected ? "hsl(var(--accent-violet))" : "hsl(var(--text-muted))" }} />
                    <span className="dropdown-item-name">{proj.name}</span>
                    {isSelected && <Check size={12} style={{ color: "hsl(var(--accent-violet))", marginLeft: "auto" }} />}
                  </div>
                );
              })}
            </div>
            <div className="dropdown-footer" onClick={handleOpenCreateModal}>
              <Plus size={14} />
              <span>New Project Workspace</span>
            </div>
          </div>
        </>
      )}

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Create New Project Workspace</h3>
              <button className="modal-close-btn" onClick={() => setIsCreateModalOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="modal-body">
              <p style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))", marginBottom: "12px" }}>
                Creates a fresh Soroban smart contract workspace pre-configured with Cargo.toml and hello-world Rust source files.
              </p>
              <label className="input-label">Project Name</label>
              <input
                type="text"
                className="modal-input"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. token-contract"
                autoFocus
              />
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newProjectName.trim()}>
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Project Modal */}
      {isRenameModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Rename Project Workspace</h3>
              <button className="modal-close-btn" onClick={() => setIsRenameModalOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit} className="modal-body">
              <label className="input-label">New Project Name</label>
              <input
                type="text"
                className="modal-input"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                placeholder="e.g. my-awesome-contract"
                autoFocus
              />
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsRenameModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!renameInput.trim()}>
                  Save Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Modal */}
      {isDeleteModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ color: "hsl(var(--accent-danger))" }}>Delete Project Workspace</h3>
              <button className="modal-close-btn" onClick={() => setIsDeleteModalOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: "0.8rem", color: "hsl(var(--text-secondary))", lineHeight: "1.5" }}>
                Are you sure you want to permanently delete project <strong style={{ color: "hsl(var(--text-primary))" }}>"{activeProject?.name}"</strong>? All associated files, build WASM binaries, and contract ABI state will be deleted.
              </p>
              <div className="modal-footer" style={{ marginTop: "16px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={handleDeleteConfirm}>
                  Delete Workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
