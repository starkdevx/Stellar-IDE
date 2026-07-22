"use client";

import React, { useState, useEffect } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { X, Download, Upload, Cpu, Wallet, AlertTriangle } from "lucide-react";
import { WalletType, getPublicKeyFromSecret } from "../utils/wallet";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWalletType: WalletType;
  playgroundSecret: string;
  onWalletUpdated: (newSecret: string) => void;
  onConfirmSelection: (type: WalletType) => void;
  handleConnectFreighter: () => Promise<void>;
}

export default function WalletModal({
  isOpen,
  onClose,
  activeWalletType,
  playgroundSecret,
  onWalletUpdated,
  onConfirmSelection,
  handleConnectFreighter,
}: WalletModalProps) {
  const [modalTab, setModalTab] = useState<WalletType>("playground");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importSecretInput, setImportSecretInput] = useState("");

  useEffect(() => {
    if (isOpen) {
      setModalTab(activeWalletType);
      setIsImportOpen(false);
      setImportSecretInput("");
    }
  }, [isOpen, activeWalletType]);

  if (!isOpen) return null;

  const address = getPublicKeyFromSecret(playgroundSecret);

  // Playground helper: download backup keypair file
  const handleSaveKeypair = () => {
    if (!playgroundSecret) return;
    const pubKey = getPublicKeyFromSecret(playgroundSecret);
    const text = `Stellar Soroban Playground Wallet Keypair\n==========================================\nPublic Key (Address): ${pubKey}\nSecret Key (Private): ${playgroundSecret}\n\nWARNING: Keep this secret key secure. Do not share it with anyone!`;
    const element = document.createElement("a");
    const file = new Blob([text], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "stellar-keypair.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Playground helper: import secret key
  const handleImportKeypair = (e: React.FormEvent) => {
    e.preventDefault();
    const input = importSecretInput.trim();
    if (!input.startsWith("S") || input.length !== 56) {
      alert("Invalid secret key. Must be a 56-character Stellar secret key starting with 'S'.");
      return;
    }

    try {
      const kp = StellarSdk.Keypair.fromSecret(input);
      localStorage.setItem("stellar_ide_playground_secret", input);
      onWalletUpdated(input);
      setIsImportOpen(false);
      setImportSecretInput("");
    } catch (err: any) {
      alert(`Failed to import secret key: ${err.message}`);
    }
  };

  // Playground helper: generate brand new wallet
  const handleGenerateNewWallet = () => {
    if (!confirm("Are you sure you want to generate a new Playground Wallet? This will overwrite the current keypair stored in browser localStorage. Make sure you have downloaded/saved the current keypair if it contains funds!")) {
      return;
    }
    const kp = StellarSdk.Keypair.random();
    const secret = kp.secret();
    localStorage.setItem("stellar_ide_playground_secret", secret);
    onWalletUpdated(secret);
  };

  return (
    <div className="wallet-modal-overlay">
      <div className="wallet-modal-content">
        <div className="wallet-modal-header">
          <span className="wallet-modal-title">Select Wallet Connection</span>
          <button className="wallet-modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div style={{ display: "flex", gap: "2px", background: "rgba(255, 255, 255, 0.02)", padding: "4px 12px 0 12px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
          <button
            onClick={() => setModalTab("playground")}
            style={{
              flex: 1,
              background: modalTab === "playground" ? "rgba(139, 92, 246, 0.08)" : "transparent",
              border: "none",
              borderBottom: modalTab === "playground" ? "2px solid hsl(var(--accent-violet))" : "2px solid transparent",
              color: modalTab === "playground" ? "#ffffff" : "hsl(var(--text-muted))",
              padding: "10px",
              fontSize: "0.76rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            Playground Wallet
          </button>
          <button
            onClick={() => setModalTab("freighter")}
            style={{
              flex: 1,
              background: modalTab === "freighter" ? "rgba(139, 92, 246, 0.08)" : "transparent",
              border: "none",
              borderBottom: modalTab === "freighter" ? "2px solid hsl(var(--accent-violet))" : "2px solid transparent",
              color: modalTab === "freighter" ? "#ffffff" : "hsl(var(--text-muted))",
              padding: "10px",
              fontSize: "0.76rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            Freighter Wallet
          </button>
        </div>

        <div className="wallet-modal-body">
          {modalTab === "playground" ? (
            <>
              <div>
                <div className="wallet-modal-section-title">What is it?</div>
                <div className="wallet-modal-section-text">
                  Playground wallet is a native wallet that speeds up development by auto-approving transactions.
                </div>
              </div>

              <div>
                <div className="wallet-modal-section-title">How to setup?</div>
                <div className="wallet-modal-section-text">
                  You don't need to do anything other than saving the keypair for future use. You can also choose to import an existing wallet.
                </div>
              </div>

              {/* Warning Box */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px", background: "rgba(245, 158, 11, 0.03)", border: "1px solid rgba(245, 158, 11, 0.12)", borderRadius: "6px", color: "hsl(var(--accent-warning))", fontSize: "0.7rem", lineHeight: "1.4" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700" }}>
                  <AlertTriangle size={14} style={{ color: "hsl(var(--accent-warning))" }} />
                  <span>Warning: Private Local Storage</span>
                </div>
                <span>Wallet information is stored securely in your browser's local storage. You will lose this wallet if you clear your browser history unless you save the keypair backup.</span>
              </div>

              {/* Keypair Details */}
              <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.06)", display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.72rem" }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <strong style={{ color: "hsl(var(--text-secondary))" }}>Address:</strong> <span style={{ fontFamily: "var(--font-mono)", userSelect: "all", color: "#ffffff" }}>{address || "Not Generated"}</span>
                </div>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <strong style={{ color: "hsl(var(--text-secondary))" }}>Secret:</strong> <span style={{ fontFamily: "var(--font-mono)", color: "hsl(var(--text-muted))" }}>{playgroundSecret ? `S••••••••••••••••••••••••••••••••••••••••••••••••••••${playgroundSecret.slice(-4)}` : "None"}</span>
                </div>
              </div>

              {/* Keypair actions */}
              <div style={{ display: "flex", gap: "6px" }}>
                <button 
                  onClick={handleSaveKeypair} 
                  style={{ flex: 1, minWidth: "80px", background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "4px", color: "#ffffff", padding: "6px 8px", fontSize: "0.68rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                >
                  <Download size={11} /> Save keypair
                </button>
                <button 
                  onClick={() => setIsImportOpen(!isImportOpen)} 
                  style={{ flex: 1, minWidth: "80px", background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "4px", color: "#ffffff", padding: "6px 8px", fontSize: "0.68rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                >
                  <Upload size={11} /> Import keypair
                </button>
                <button 
                  onClick={handleGenerateNewWallet} 
                  style={{ flex: 1, minWidth: "80px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "4px", color: "hsl(var(--accent-error))", padding: "6px 8px", fontSize: "0.68rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                >
                  Generate new
                </button>
              </div>

              {/* Import form */}
              {isImportOpen && (
                <form onSubmit={handleImportKeypair} style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "10px", marginTop: "4px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.65rem", color: "hsl(var(--text-secondary))" }}>Enter Private Key (starts with S)</label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="password"
                        placeholder="Secret key (56 characters)"
                        value={importSecretInput}
                        onChange={(e) => setImportSecretInput(e.target.value)}
                        style={{ flex: 1, background: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "4px", padding: "6px 10px", color: "#ffffff", fontSize: "0.7rem", outline: "none" }}
                      />
                      <button 
                        type="submit" 
                        style={{ background: "hsl(var(--accent-violet))", border: "none", borderRadius: "4px", color: "#ffffff", padding: "6px 12px", fontSize: "0.7rem", fontWeight: "600", cursor: "pointer" }}
                      >
                        Import
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </>
          ) : (
            <>
              <div>
                <div className="wallet-modal-section-title">What is it?</div>
                <div className="wallet-modal-section-text">
                  Freighter Wallet is a secure browser extension for Stellar network. Connecting your Freighter wallet allows you to sign transactions using keys securely stored in your extension.
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
                <button 
                  className="btn btn-primary" 
                  onClick={async () => {
                    await handleConnectFreighter();
                    onConfirmSelection("freighter");
                  }}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <Wallet size={16} />
                  <span>Connect Freighter Wallet</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="wallet-modal-footer">
          <button 
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "hsl(var(--text-secondary))", padding: "8px 16px", fontSize: "0.78rem", fontWeight: "600", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button 
            onClick={() => onConfirmSelection(modalTab)}
            className="btn btn-primary"
            style={{ padding: "8px 20px", fontSize: "0.78rem" }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
