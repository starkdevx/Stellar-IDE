"use client";

import React, { useState } from "react";
import { Cpu, Play, Terminal, Download, ChevronDown, ChevronRight } from "lucide-react";

interface CompilerPanelProps {
  files: { [path: string]: string };
  onCompileSuccess: (abi: any[], wasmBase64: string) => void;
  addLog: (text: string, type?: "info" | "error" | "success" | "warning") => void;
  wasmBase64: string | null;
  projectName?: string;
}

export default function CompilerPanel({
  files,
  onCompileSuccess,
  addLog,
  wasmBase64,
  projectName = "hello-world",
}: CompilerPanelProps) {
  const [compiling, setCompiling] = useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  const handleCompile = async () => {
    if (compiling) return;
    setCompiling(true);
    addLog(`Initiating compilation for "${projectName}"...`, "info");

    let endpoint = "/api/compile";
    if (process.env.NEXT_PUBLIC_COMPILER_URL) {
      let raw = process.env.NEXT_PUBLIC_COMPILER_URL.trim();
      if (!raw.startsWith("http://") && !raw.startsWith("https://") && !raw.startsWith("/")) {
        raw = `http://${raw}`;
      }
      raw = raw.replace(/\/+$/, "");
      endpoint = raw.endsWith("/api/compile") ? raw : `${raw}/api/compile`;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ files }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setCompiling(false);
        addLog("Compilation failed!", "error");
        if (data.logs) {
          addLog(data.logs, "error");
        }
        if (data.error) {
          addLog(`Error Detail: ${data.error}`, "error");
        }
        return;
      }

      addLog(`Compilation of "${projectName}" complete!`, "success");
      if (data.logs) {
        addLog(data.logs, "info");
      }
      
      onCompileSuccess(data.abi, data.wasm);
      addLog(`Contract Spec loaded successfully. ${data.abi.length} functions exported.`, "success");
      
    } catch (err: any) {
      console.error(err);
      addLog(`Failed to communicate with compiler backend: ${err.message}`, "error");
    } finally {
      setCompiling(false);
    }
  };

  const handleDownloadWasm = () => {
    if (!wasmBase64) return;
    try {
      const binaryString = atob(wasmBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/wasm" });
      const url = URL.createObjectURL(blob);
      
      const fileName = `${projectName || "contract"}.wasm`;
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addLog(`Exported ${fileName} successfully.`, "success");
    } catch (err: any) {
      addLog(`Failed to export WASM: ${err.message}`, "error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div className="panel-title">
        <span>Compiler Panel</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p style={{ fontSize: "0.75rem", color: "hsl(var(--text-secondary))", lineHeight: "1.4" }}>
          Compile the <code style={{ color: "hsl(var(--accent-cyan))" }}>{projectName}</code> Rust workspace to WebAssembly and generate ABI spec.
        </p>

        <button
          className="btn btn-primary"
          onClick={handleCompile}
          disabled={compiling}
          style={{ width: "100%" }}
        >
          {compiling ? (
            <>
              <div className="spinner"></div>
              <span>Compiling {projectName}...</span>
            </>
          ) : (
            <>
              <Cpu size={16} />
              <span>Compile {projectName}</span>
            </>
          )}
        </button>

        {wasmBase64 && (
          <button
            className="btn btn-secondary"
            onClick={handleDownloadWasm}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginTop: "4px"
            }}
          >
            <Download size={15} />
            <span>Export {projectName}.wasm</span>
          </button>
        )}
      </div>

      <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <span 
          className="input-label" 
          onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
          style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", userSelect: "none" }}
        >
          {isSettingsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Terminal size={12} /> compiler settings
        </span>
        {isSettingsExpanded && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.7rem", color: "hsl(var(--text-muted))", paddingLeft: "20px" }}>
            <div>Target: <code style={{ color: "hsl(var(--text-secondary))" }}>wasm32v1-none</code></div>
            <div>Optimization: <code style={{ color: "hsl(var(--text-secondary))" }}>-Oz (spec-shaking v2)</code></div>
            <div>Profile: <code style={{ color: "hsl(var(--text-secondary))" }}>release</code></div>
          </div>
        )}
      </div>
    </div>
  );
}
