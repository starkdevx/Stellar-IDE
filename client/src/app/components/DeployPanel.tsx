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

  const fetchBalance = async (userAddress: string) => {
    try {
      const horizonServer = new StellarSdk.Horizon.Server(horizonUrl);
      const accountDetails = await horizonServer.loadAccount(userAddress);
      const native = accountDetails.balances.find((b) => b.asset_type === "native");
      setBalance(native ? parseFloat(native.balance).toLocaleString() : "0");
    } catch (err: any) {
      // 404 means account is not created/funded yet
      setBalance("0 (Unfunded)");
    }
  };

  const handleConnectWallet = async () => {
    try {
      const hasFreighter = await isConnected();
      const isCon = typeof hasFreighter === "boolean" ? hasFreighter : (hasFreighter && (hasFreighter as any).isConnected);
      if (!isCon) {
        alert("Freighter Wallet extension is not installed or enabled in this browser.");
        return;
      }
      
      addLog("Requesting access from Freighter Wallet...", "info");
      const accessRes = await requestAccess();
      if (accessRes && (accessRes as any).error) {
        throw new Error((accessRes as any).error);
      }
      
      const addrStr = typeof accessRes === "string" ? accessRes : (accessRes && (accessRes as any).address);
      if (addrStr) {
        setAddress(addrStr);
        setWalletConnected(true);
        addLog(`Connected Freighter Wallet: ${addrStr}`, "success");
        fetchBalance(addrStr);
      } else {
        throw new Error("Could not retrieve wallet address. Make sure Freighter is unlocked and authorized.");
      }
    } catch (err: any) {
      console.error(err);
      addLog(`Wallet connection failed: ${err.message}`, "error");
    }
  };

  const handleFundAccount = async () => {
    if (!address || funding) return;
    setFunding(true);
    addLog(`Requesting Testnet Friendbot funding for ${address}...`, "info");
    
    try {
      const rpcServer = new StellarSdk.rpc.Server(rpcUrl);
      await rpcServer.fundAddress(address);
      addLog("Account successfully funded with 10,000 XLM!", "success");
      await fetchBalance(address);
    } catch (err: any) {
      // Fallback direct HTTP Friendbot request
      try {
        const response = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`);
        if (response.ok) {
          addLog("Account successfully funded with 10,000 XLM (via Friendbot fallback)!", "success");
          await fetchBalance(address);
        } else {
          throw new Error("Friendbot API returned an error");
        }
      } catch (fallbackErr: any) {
        addLog(`Friendbot funding failed: ${fallbackErr.message}`, "error");
      }
    } finally {
      setFunding(false);
    }
  };

  const handleDeploy = async () => {
    if (!wasmBase64 || deploying || !walletConnected || !address) return;
    setDeploying(true);
    setDeployStep("Converting WASM...");
    addLog("Starting deployment process...", "info");

    try {
      const rpcServer = new StellarSdk.rpc.Server(rpcUrl);
      const horizonServer = new StellarSdk.Horizon.Server(horizonUrl);

      // Decode WASM base64 safely in browser
      const binaryString = window.atob(wasmBase64);
      const wasmBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        wasmBytes[i] = binaryString.charCodeAt(i);
      }

      // STEP 1: Upload WASM bytecode
      setDeployStep("Uploading WASM (1/2)...");
      addLog("Preparing transaction to upload WASM bytecode...", "info");

      const sourceAccount = await horizonServer.loadAccount(address);
      
      let uploadTx = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: "100", // base fee (will be adjusted during simulation)
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
      .addOperation(StellarSdk.Operation.uploadContractWasm({
        wasm: wasmBytes,
      }))
      .setTimeout(60)
      .build();

      // Simulate and prepare resource parameters
      uploadTx = await rpcServer.prepareTransaction(uploadTx);

      addLog("Requesting signature from Freighter wallet to upload WASM...", "info");
      const { signTransaction } = await import("@stellar/freighter-api");
      const uploadSigned = await signTransaction(uploadTx.toXDR(), {
        networkPassphrase: StellarSdk.Networks.TESTNET,
      });

      if (!uploadSigned || !uploadSigned.signedTxXdr) {
        throw new Error("Transaction signature rejected by Freighter");
      }

      const uploadSignedTx = StellarSdk.TransactionBuilder.fromXDR(
        uploadSigned.signedTxXdr,
        StellarSdk.Networks.TESTNET
      );

      addLog("Submitting WASM upload transaction to Stellar ledger...", "info");
      const uploadSendResponse = await rpcServer.sendTransaction(uploadSignedTx);
      
      if (uploadSendResponse.status === "ERROR") {
        throw new Error(`WASM upload submission error: ${JSON.stringify((uploadSendResponse as any).errorResult || uploadSendResponse)}`);
      }

      // Poll transaction
      let uploadTxResponse = await rpcServer.getTransaction(uploadSendResponse.hash);
      while ((uploadTxResponse.status as any) === "PENDING" || uploadTxResponse.status === "NOT_FOUND") {
        setDeployStep("Uploading WASM (pending)...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        uploadTxResponse = await rpcServer.getTransaction(uploadSendResponse.hash);
      }

      if (uploadTxResponse.status === "FAILED") {
        throw new Error(`WASM upload transaction failed: ${JSON.stringify((uploadTxResponse as any).resultXdr)}`);
      }

      // Extract WASM Hash
      const successResponse = uploadTxResponse as any;
      const uploadResultXDR = StellarSdk.xdr.TransactionResult.fromXDR(
        successResponse.resultXdr,
        "base64"
      );
      const wasmHashVal = uploadResultXDR.result().results()[0].tr().invokeHostFunctionResult().success();
      const parsedWasmHashVal = StellarSdk.xdr.ScVal.fromXDR(wasmHashVal);
      const wasmHash = StellarSdk.scValToNative(parsedWasmHashVal);
      const wasmHashHex = Buffer.from(wasmHash).toString("hex");
      
      addLog(`WASM successfully uploaded. WASM Hash: ${wasmHashHex}`, "success");

      // STEP 2: Instantiate Contract
      setDeployStep("Instantiating Contract (2/2)...");
      addLog("Preparing transaction to instantiate contract...", "info");

      // Refresh source account sequence number
      const sourceAccount2 = await horizonServer.loadAccount(address);
      const deployer = new StellarSdk.Address(address);
      const salt = crypto.getRandomValues(new Uint8Array(32));

      let createTx = new StellarSdk.TransactionBuilder(sourceAccount2, {
        fee: "100",
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
      .addOperation(StellarSdk.Operation.createCustomContract({
        wasmHash: wasmHash,
        address: deployer,
        salt,
      } as any))
      .setTimeout(60)
      .build();

      createTx = await rpcServer.prepareTransaction(createTx);

      addLog("Requesting signature from Freighter wallet to create contract...", "info");
      const createSigned = await signTransaction(createTx.toXDR(), {
        networkPassphrase: StellarSdk.Networks.TESTNET,
      });

      if (!createSigned || !createSigned.signedTxXdr) {
        throw new Error("Contract creation signature rejected by Freighter");
      }

      const createSignedTx = StellarSdk.TransactionBuilder.fromXDR(
        createSigned.signedTxXdr,
        StellarSdk.Networks.TESTNET
      );

      addLog("Submitting contract instantiation transaction...", "info");
      const createSendResponse = await rpcServer.sendTransaction(createSignedTx);

      if (createSendResponse.status === "ERROR") {
        throw new Error(`Contract instantiation error: ${JSON.stringify((createSendResponse as any).errorResult || createSendResponse)}`);
      }

      let createTxResponse = await rpcServer.getTransaction(createSendResponse.hash);
      while ((createTxResponse.status as any) === "PENDING" || createTxResponse.status === "NOT_FOUND") {
        setDeployStep("Creating Contract (pending)...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        createTxResponse = await rpcServer.getTransaction(createSendResponse.hash);
      }

      if (createTxResponse.status === "FAILED") {
        throw new Error(`Contract creation failed: ${JSON.stringify((createTxResponse as any).resultXdr)}`);
      }

      const createSuccessResp = createTxResponse as any;
      const createResultXDR = StellarSdk.xdr.TransactionResult.fromXDR(
        createSuccessResp.resultXdr,
        "base64"
      );
      const contractAddressVal = createResultXDR.result().results()[0].tr().invokeHostFunctionResult().success();
      const parsedContractVal = StellarSdk.xdr.ScVal.fromXDR(contractAddressVal);
      const contractId = StellarSdk.scValToNative(parsedContractVal).toString();

      addLog(`Contract successfully instantiated! ID: ${contractId}`, "success");
      onDeploySuccess(contractId);
      await fetchBalance(address);

    } catch (err: any) {
      console.error(err);
      addLog(`Deployment failed: ${err.message}`, "error");
    } finally {
      setDeploying(false);
      setDeployStep("");
    }
  };

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
