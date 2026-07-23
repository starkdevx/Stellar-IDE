"use client";

import React, { useState, useEffect } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { isConnected, getAddress } from "@stellar/freighter-api";
import { X, RefreshCw, ExternalLink, Coins, AlertCircle, Cpu, Wallet } from "lucide-react";
import { 
  getActiveWalletType, 
  getOrCreatePlaygroundSecret, 
  getPublicKeyFromSecret, 
  WalletType 
} from "../utils/wallet";

interface TransactionRecord {
  hash: string;
  ledger: number;
  created_at: string;
  successful: boolean;
}

interface WalletDropdownProps {
  onClose: () => void;
  addLog: (text: string, type?: "info" | "error" | "success" | "warning") => void;
}

export default function WalletDropdown({ onClose, addLog }: WalletDropdownProps) {
  const [walletType, setWalletType] = useState<WalletType>("playground");
  const [address, setAddress] = useState<string>("");
  const [balance, setBalance] = useState<string>("0");
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const horizonUrl = "https://horizon-testnet.stellar.org";

  const loadWalletDetails = async () => {
    setLoading(true);
    setError("");
    const activeType = getActiveWalletType();
    setWalletType(activeType);

    let activeAddr = "";

    if (activeType === "playground") {
      const secret = getOrCreatePlaygroundSecret();
      activeAddr = getPublicKeyFromSecret(secret);
    } else {
      try {
        const connected = await isConnected();
        const isCon = typeof connected === "boolean" ? connected : (connected && (connected as any).isConnected);
        if (isCon) {
          const userAddress = await getAddress();
          if (userAddress) {
            activeAddr = typeof userAddress === "string" ? userAddress : (userAddress.address || "");
          }
        }
      } catch (err) {
        console.error("Freighter address fetch error:", err);
      }
    }

    if (activeAddr) {
      setAddress(activeAddr);
      await fetchBalanceAndTransactions(activeAddr);
    } else {
      setError("No wallet connected. Open the Deploy panel to connect a wallet.");
      setLoading(false);
    }
  };

  const fetchBalanceAndTransactions = async (addr: string) => {
    try {
      const horizonServer = new StellarSdk.Horizon.Server(horizonUrl);
      
      // Fetch Balance
      try {
        const accountDetails = await horizonServer.loadAccount(addr);
        const native = accountDetails.balances.find((b) => b.asset_type === "native");
        setBalance(native ? parseFloat(native.balance).toLocaleString() : "0");
      } catch (err) {
        // 404 account unfunded
        setBalance("0 (Unfunded)");
      }

      // Fetch Transactions
      try {
        const response = await fetch(`${horizonUrl}/accounts/${addr}/transactions?order=desc&limit=10`);
        if (response.ok) {
          const data = await response.json();
          const records = data._embedded?.records || [];
          const txs: TransactionRecord[] = records.map((record: any) => ({
            hash: record.id,
            ledger: record.ledger,
            created_at: record.created_at,
            successful: record.successful,
          }));
          setTransactions(txs);
        } else {
          setTransactions([]);
        }
      } catch (txErr) {
        console.error("Failed to fetch transactions:", txErr);
        setTransactions([]);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch network data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWalletDetails();

    // Listen to wallet change events
    const handleWalletChange = () => {
      loadWalletDetails();
    };

    window.addEventListener("stellar_wallet_change", handleWalletChange);
    return () => {
      window.removeEventListener("stellar_wallet_change", handleWalletChange);
    };
  }, []);

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);

      if (diffSecs < 60) return `${diffSecs}s ago`;
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString();
    } catch {
      return "";
    }
  };

  return (
    <div 
      style={{
        position: "absolute",
        top: "40px",
        right: "10px",
        width: "350px",
        background: "#0d0f1c",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "10px",
        boxShadow: "0 15px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}
    >
      {/* Header */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {walletType === "playground" ? (
            <Cpu size={14} style={{ color: "hsl(var(--accent-violet))" }} />
          ) : (
            <Wallet size={14} style={{ color: "hsl(var(--accent-violet))" }} />
          )}
          <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "#ffffff" }}>
            {walletType === "playground" ? "Playground Wallet" : "Freighter Wallet"}
          </span>
        </div>
        <button 
          onClick={onClose}
          style={{ background: "transparent", border: "none", color: "hsl(var(--text-muted))", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {error ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px", background: "rgba(239, 68, 68, 0.04)", border: "1px solid rgba(239, 68, 68, 0.12)", borderRadius: "6px", color: "hsl(var(--accent-error))", fontSize: "0.72rem" }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        ) : (
          <>
            {/* Address */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "0.65rem", color: "hsl(var(--text-secondary))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Address</span>
              <span style={{ fontSize: "0.74rem", fontFamily: "var(--font-mono)", color: "#ffffff", wordBreak: "break-all", background: "rgba(0, 0, 0, 0.2)", padding: "6px 8px", borderRadius: "4px", border: "1px solid rgba(255, 255, 255, 0.03)" }}>
                {address}
              </span>
            </div>

            {/* Balance */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center", padding: "12px 0", background: "rgba(255, 255, 255, 0.01)", border: "1px solid rgba(255, 255, 255, 0.03)", borderRadius: "6px" }}>
              <Coins size={20} style={{ color: "hsl(var(--accent-cyan))", marginBottom: "4px" }} />
              <span style={{ fontSize: "1.2rem", fontWeight: "700", fontFamily: "var(--font-mono)", color: "#ffffff" }}>
                {balance} XLM
              </span>
              <span style={{ fontSize: "0.65rem", color: "hsl(var(--text-muted))" }}>Stellar Testnet Assets</span>
            </div>

            {/* Transactions Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.05em" }}>Transactions</span>
              <button 
                onClick={loadWalletDetails}
                disabled={loading}
                style={{ background: "transparent", border: "none", color: "hsl(var(--accent-violet))", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.68rem", fontWeight: "600" }}
              >
                <RefreshCw size={10} className={loading ? "spinner" : ""} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Transactions List */}
            <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
                  <div className="spinner" style={{ width: "16px", height: "16px" }}></div>
                </div>
              ) : transactions.length === 0 ? (
                <div style={{ textAlign: "center", fontSize: "0.7rem", color: "hsl(var(--text-muted))", padding: "20px 0" }}>
                  No transactions found on Testnet for this address.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "6px", overflow: "hidden" }}>
                  {/* Table Header */}
                  <div style={{ display: "flex", background: "rgba(255, 255, 255, 0.02)", padding: "6px 10px", fontSize: "0.65rem", color: "hsl(var(--text-secondary))", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", fontWeight: "600" }}>
                    <span style={{ flex: 1.5 }}>Signature</span>
                    <span style={{ flex: 1 }}>Ledger</span>
                    <span style={{ flex: 1, textAlign: "right" }}>Time</span>
                  </div>
                  {/* Table Body */}
                  {transactions.map((tx) => (
                    <div 
                      key={tx.hash} 
                      style={{ 
                        display: "flex", 
                        padding: "8px 10px", 
                        fontSize: "0.7rem", 
                        borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                        alignItems: "center"
                      }}
                    >
                      <a 
                        href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ flex: 1.5, fontFamily: "var(--font-mono)", color: "hsl(var(--accent-violet))", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                        <ExternalLink size={8} />
                      </a>
                      <span style={{ flex: 1, fontFamily: "var(--font-mono)", color: "hsl(var(--text-muted))" }}>{tx.ledger}</span>
                      <span style={{ flex: 1, textAlign: "right", color: "hsl(var(--text-secondary))" }}>{formatTime(tx.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
