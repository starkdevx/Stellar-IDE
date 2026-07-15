"use client";

import React, { useState, useEffect } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { isConnected, requestAccess, getAddress } from "@stellar/freighter-api";
import { Wallet, Coins, Rocket, ShieldCheck, AlertCircle } from "lucide-react";

interface DeployPanelProps {
  wasmBase64: string | null;
  onDeploySuccess: (contractId: string) => void;
  addLog: (text: string, type?: "info" | "error" | "success" | "warning") => void;
}

export default function DeployPanel({
  wasmBase64,
  onDeploySuccess,
  addLog,
}: DeployPanelProps) {
  const [walletConnected, setWalletConnected] = useState(false);
  const [address, setAddress] = useState<string>("");
  const [balance, setBalance] = useState<string>("0");
  const [network, setNetwork] = useState<string>("TESTNET");
  const [funding, setFunding] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState<string>("");

  const rpcUrl = "https://soroban-testnet.stellar.org";
  const horizonUrl = "https://horizon-testnet.stellar.org";

  // Check connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connected = await isConnected();
        const isCon = typeof connected === "boolean" ? connected : (connected && (connected as any).isConnected);
        if (isCon) {
          // Check if already allowed
          const userAddress = await getAddress();
          if (userAddress) {
            const addrStr = typeof userAddress === "string" ? userAddress : (userAddress.address || "");
            if (addrStr) {
              setAddress(addrStr);
              setWalletConnected(true);
              fetchBalance(addrStr);
            }
          }
        }
      } catch (err) {
        console.error("Wallet connection check failed:", err);
      }
    };
    checkConnection();
  }, []);





  

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div className="panel-title">
        <span>Deploy Contract</span>
      </div>

      {/* Connection State */}
      {!walletConnected ? (
        <button className="btn btn-primary" onClick={handleConnectWallet} style={{ width: "100%" }}>
          <Wallet size={16} />
          <span>Connect Freighter Wallet</span>
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Connected state header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="status-badge connected">
              <span className="status-indicator"></span>
              Connected
            </span>
            <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "hsl(var(--text-secondary))" }}>
              {address.slice(0, 6)}...{address.slice(-6)}
            </span>
          </div>

          {/* Account Balance */}
          <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem" }}>
              <Coins size={14} style={{ color: "hsl(var(--accent-cyan))" }} />
              <span>Balance:</span>
            </div>
            <span style={{ fontSize: "0.85rem", fontWeight: "700", fontFamily: "var(--font-mono)" }}>
              {balance} XLM
            </span>
          </div>

          {/* Faucet Action */}
          <button
            className="btn btn-secondary"
            onClick={handleFundAccount}
            disabled={funding || deploying}
            style={{ width: "100%" }}
          >
            {funding ? (
              <>
                <div className="spinner"></div>
                <span>Funding Account...</span>
              </>
            ) : (
              <span>Get Testnet Faucet XLM</span>
            )}
          </button>

          {/* Deploy Action */}
          <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", marginTop: "8px", paddingTop: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {!wasmBase64 ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.15)", borderRadius: "6px", color: "hsl(var(--accent-error))", fontSize: "0.7rem" }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>Compile your Rust contract first to enable deployment.</span>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px", background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.15)", borderRadius: "6px", color: "hsl(var(--accent-success))", fontSize: "0.7rem" }}>
                  <ShieldCheck size={14} style={{ flexShrink: 0 }} />
                  <span>Contract compiled. Ready to deploy.</span>
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={handleDeploy}
                disabled={deploying || !wasmBase64}
                style={{ width: "100%" }}
              >
                {deploying ? (
                  <>
                    <div className="spinner"></div>
                    <span>{deployStep}</span>
                  </>
                ) : (
                  <>
                    <Rocket size={16} />
                    <span>Deploy to Testnet</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
