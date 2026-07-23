"use client";

import React, { useState, useEffect } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { isConnected, getAddress } from "@stellar/freighter-api";
import { X, RefreshCw, ExternalLink, Coins, AlertCircle, Cpu, Wallet, ChevronDown, ChevronRight } from "lucide-react";
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

  // Collapsible Send States
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);

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

  const handleSendXLM = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipient = sendRecipient.trim();
    const amount = sendAmount.trim();

    if (!recipient || !amount || sending) return;
    
    if (!recipient.startsWith("G") || recipient.length !== 56) {
      alert("Invalid recipient address. Must be a 56-character Stellar public key starting with 'G'.");
      return;
    }
    
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid positive XLM amount.");
      return;
    }

    setSending(true);
    addLog(`Initiating payment of ${amount} XLM to ${recipient}...`, "info");

    try {
      const horizonServer = new StellarSdk.Horizon.Server(horizonUrl);
      const sourceAccount = await horizonServer.loadAccount(address);
      
      let tx = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
      .addOperation(StellarSdk.Operation.payment({
        destination: recipient,
        asset: StellarSdk.Asset.native(),
        amount: amount,
      }))
      .setTimeout(60)
      .build();

      let signedTx;
      if (walletType === "playground") {
        const secret = getOrCreatePlaygroundSecret();
        tx.sign(StellarSdk.Keypair.fromSecret(secret));
        signedTx = tx;
      } else {
        const { signTransaction } = await import("@stellar/freighter-api");
        const signedResult = await signTransaction(tx.toXDR(), {
          networkPassphrase: StellarSdk.Networks.TESTNET,
        });
        
        if (!signedResult || !signedResult.signedTxXdr) {
          throw new Error("Transaction signature rejected by Freighter");
        }
        
        signedTx = StellarSdk.TransactionBuilder.fromXDR(
          signedResult.signedTxXdr,
          StellarSdk.Networks.TESTNET
        );
      }

      addLog("Submitting payment transaction to Stellar network...", "info");
      const submitResponse = await horizonServer.submitTransaction(signedTx);
      
      addLog(`Successfully sent ${amount} XLM to ${recipient}! Hash: ${submitResponse.hash.slice(0, 8)}...`, "success");
      
      // Clear forms and collapse
      setSendRecipient("");
      setSendAmount("");
      setIsSendOpen(false);

      // Trigger update
      await loadWalletDetails();
      
      // Record interaction stats activity securely
      fetch("/api/activity/interact", { method: "POST" }).catch(() => {});

    } catch (err: any) {
      console.error(err);
      addLog(`Failed to send XLM: ${err.message || JSON.stringify(err)}`, "error");
      alert(`Failed to send XLM: ${err.message || "Unknown error"}`);
    } finally {
      setSending(false);
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
            <Cpu size={14} style={{ color: "#c084fc" }} />
          ) : (
            <Wallet size={14} style={{ color: "#c084fc" }} />
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
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
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

            {/* Balance (Concised) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255, 255, 255, 0.01)", border: "1px solid rgba(255, 255, 255, 0.03)", borderRadius: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Coins size={14} style={{ color: "hsl(var(--accent-cyan))" }} />
                <span style={{ fontSize: "0.74rem", color: "hsl(var(--text-secondary))" }}>Balance:</span>
              </div>
              <span style={{ fontSize: "0.85rem", fontWeight: "700", fontFamily: "var(--font-mono)", color: "#ffffff" }}>
                {balance} XLM
              </span>
            </div>

            {/* Collapsible Send Section */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderBottom: "1px solid rgba(255, 255, 255, 0.04)", paddingBottom: "12px" }}>
              <button 
                onClick={() => setIsSendOpen(!isSendOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "transparent",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "0.72rem",
                  fontWeight: "700",
                  cursor: "pointer",
                  padding: 0,
                  textAlign: "left"
                }}
              >
                {isSendOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Send</span>
              </button>

              {isSendOpen && (
                <form onSubmit={handleSendXLM} style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                  <input
                    type="text"
                    placeholder="Recipient address (starts with G)"
                    value={sendRecipient}
                    onChange={(e) => setSendRecipient(e.target.value)}
                    style={{
                      background: "rgba(0, 0, 0, 0.2)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "4px",
                      padding: "6px 10px",
                      color: "#ffffff",
                      fontSize: "0.7rem",
                      outline: "none"
                    }}
                    required
                  />
                  <input
                    type="text"
                    placeholder="XLM amount"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    style={{
                      background: "rgba(0, 0, 0, 0.2)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "4px",
                      padding: "6px 10px",
                      color: "#ffffff",
                      fontSize: "0.7rem",
                      outline: "none"
                    }}
                    required
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="btn btn-primary"
                    style={{
                      padding: "6px 10px",
                      fontSize: "0.7rem",
                      fontWeight: "700",
                      justifyContent: "center",
                      background: sending ? "rgba(168, 85, 247, 0.3)" : "hsl(var(--accent-violet))",
                      border: "none",
                      borderRadius: "4px",
                      color: "#ffffff",
                      cursor: "pointer"
                    }}
                  >
                    {sending ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className="spinner" style={{ width: "10px", height: "10px", borderWidth: "1px" }}></span>
                        Sending...
                      </span>
                    ) : (
                      "Send"
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Transactions Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.05em" }}>Transactions</span>
              <button 
                onClick={loadWalletDetails}
                disabled={loading}
                style={{ background: "transparent", border: "none", color: "#c084fc", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.68rem", fontWeight: "600" }}
              >
                <RefreshCw size={10} className={loading ? "spinner" : ""} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Transactions List */}
            <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
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
                        style={{ flex: 1.5, fontFamily: "var(--font-mono)", color: "#c084fc", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
                        onMouseOver={(e) => e.currentTarget.style.textDecoration = "underline"}
                        onMouseOut={(e) => e.currentTarget.style.textDecoration = "none"}
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
