"use client";

import React from "react";
import MonacoEditor from "@monaco-editor/react";

interface EditorProps {
  activeFile: string;
  content: string;
  onChange: (value: string | undefined) => void;
}

export default function Editor({ activeFile, content, onChange }: EditorProps) {
  const fileExtension = activeFile.split(".").pop();
  
  // Map extension to language for Monaco syntax highlighting
  const getLanguage = () => {
    switch (fileExtension) {
      case "rs":
        return "rust";
      case "toml":
        return "ini"; // Cargo.toml can be styled as ini
      case "json":
        return "json";
      default:
        return "plaintext";
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    onChange(value);
  };

  return (
    <div className="editor-wrapper">
      <div style={{ flex: 1, position: "relative" }}>
        <MonacoEditor
          height="100%"
          language={getLanguage()}
          theme="vs-dark"
          value={content}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            lineNumbersMinChars: 3,
            padding: { top: 10 },
          }}
          loading={
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "hsl(var(--text-secondary))",
              gap: "8px"
            }}>
              <div className="spinner"></div>
              <span>Initializing Monaco Editor...</span>
            </div>
          }
        />
      </div>
    </div>
  );
}
