"use client";

import React, { useState } from "react";
import { Cpu, Play, Terminal } from "lucide-react";

interface CompilerPanelProps {
  files: { [path: string]: string };
  onCompileSuccess: (abi: any[], wasmBase64: string) => void;
  addLog: (text: string, type?: "info" | "error" | "success" | "warning") => void;
}

export default function CompilerPanel({
  files,
  onCompileSuccess,
  addLog,
}: CompilerPanelProps) {
  const [compiling, setCompiling] = useState(false);



  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div className="panel-title">
        <span>Compiler Panel</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p style={{ fontSize: "0.75rem", color: "hsl(var(--text-secondary))", lineHeight: "1.4" }}>
          Compile the Rust workspace to WebAssembly and generate the contract metadata ABI specification.
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
              <span>Compiling Contract...</span>
            </>
          ) : (
            <>
              <Cpu size={16} />
              <span>Compile hello-world</span>
            </>
          )}
        </button>
      </div>

      <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <span className="input-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Terminal size={12} /> compiler settings
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.7rem", color: "hsl(var(--text-muted))" }}>
          <div>Target: <code style={{ color: "hsl(var(--text-secondary))" }}>wasm32v1-none</code></div>
          <div>Optimization: <code style={{ color: "hsl(var(--text-secondary))" }}>-Oz (spec-shaking v2)</code></div>
          <div>Profile: <code style={{ color: "hsl(var(--text-secondary))" }}>release</code></div>
        </div>
      </div>
    </div>
  );
}
