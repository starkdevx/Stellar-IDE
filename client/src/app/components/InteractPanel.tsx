"use client";

import React, { useState } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { getAddress } from "@stellar/freighter-api";
import { Play, Code, CheckCircle, AlertTriangle } from "lucide-react";
import { getActiveWalletType, getOrCreatePlaygroundSecret, getPublicKeyFromSecret } from "../utils/wallet";

interface InteractPanelProps {
  abi: any[] | null;
  contractId: string | null;
  onContractIdChange: (contractId: string) => void;
  addLog: (text: string, type?: "info" | "error" | "success" | "warning") => void;
  projectName?: string;
}

export default function InteractPanel({
  abi,
  contractId,
  onContractIdChange,
  addLog,
  projectName = "hello-world",
}: InteractPanelProps) {
  const [manualContractId, setManualContractId] = useState("");
  const [inputValues, setInputValues] = useState<{ [key: string]: string }>({});
  const [invoking, setInvoking] = useState<{ [funcName: string]: boolean }>({});
  const [outputs, setOutputs] = useState<{ [funcName: string]: string }>({});

  const rpcUrl = "https://soroban-testnet.stellar.org";
  const horizonUrl = "https://horizon-testnet.stellar.org";

  const handleManualContractIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualContractId.trim().startsWith("C") && manualContractId.trim().length === 56) {
      onContractIdChange(manualContractId.trim());
      addLog(`Loaded contract ID: ${manualContractId.trim()}`, "success");
      setManualContractId("");
    } else {
      alert("Invalid Contract ID. Must be a 56-character string starting with C.");
    }
  };

  const handleInputChange = (funcName: string, paramName: string, val: string) => {
    setInputValues((prev) => ({
      ...prev,
      [`${funcName}-${paramName}`]: val,
    }));
  };

  // Maps UI input to ScVal
  const parseInputToScVal = (value: any, type: any): any => {
    if (typeof type === "string") {
      switch (type.toLowerCase()) {
        case "string":
          return StellarSdk.xdr.ScVal.scvString(String(value));
        case "symbol":
          return StellarSdk.xdr.ScVal.scvSymbol(String(value));
        case "u32":
          return StellarSdk.xdr.ScVal.scvU32(Number(value));
        case "i32":
          return StellarSdk.xdr.ScVal.scvI32(Number(value));
        case "u64":
          return StellarSdk.nativeToScVal(BigInt(value));
        case "i64":
          return StellarSdk.nativeToScVal(BigInt(value));
        case "bool":
          return StellarSdk.xdr.ScVal.scvBool(value === "true" || value === true || value === "1");
        case "address":
          return StellarSdk.xdr.ScVal.scvAddress(new StellarSdk.Address(String(value)).toScAddress());
        default:
          return StellarSdk.nativeToScVal(value);
      }
    } else if (type && typeof type === "object") {
      if ("vec" in type) {
        // Handle Vector types
        try {
          const arr = Array.isArray(value) ? value : JSON.parse(value);
          const parsedElements = arr.map((item: any) => parseInputToScVal(item, type.vec.element_type));
          return StellarSdk.xdr.ScVal.scvVec(parsedElements);
        } catch {
          // If JSON parse fails, split by comma
          const arr = String(value).split(",").map(v => v.trim());
          const parsedElements = arr.map((item: any) => parseInputToScVal(item, type.vec.element_type));
          return StellarSdk.xdr.ScVal.scvVec(parsedElements);
        }
      }
    }
    return StellarSdk.nativeToScVal(value);
  };

  const handleInvoke = async (funcName: string, inputs: any[]) => {
    if (!contractId) return;
    
    setInvoking((prev) => ({ ...prev, [funcName]: true }));
    setOutputs((prev) => ({ ...prev, [funcName]: "" }));
    addLog(`Invoking contract method "${funcName}"...`, "info");

    try {
      const walletType = getActiveWalletType();
      let userAddress = "";
      let playgroundSecret = "";

      if (walletType === "playground") {
        playgroundSecret = getOrCreatePlaygroundSecret();
        userAddress = getPublicKeyFromSecret(playgroundSecret);
        if (!userAddress) {
          throw new Error("Playground wallet is not initialized.");
        }
      } else {
        const userAddressResult = await getAddress();
        userAddress = typeof userAddressResult === "string" ? userAddressResult : (userAddressResult?.address || "");
        if (!userAddress) {
          throw new Error("Freighter wallet is not connected.");
        }
      }

      const rpcServer = new StellarSdk.rpc.Server(rpcUrl);
      const horizonServer = new StellarSdk.Horizon.Server(horizonUrl);

      // Map dynamic inputs to ScVal
      const parsedArgs = inputs.map((input) => {
        const rawVal = inputValues[`${funcName}-${input.name}`];
        if (rawVal === undefined || rawVal === "") {
          throw new Error(`Input field "${input.name}" is required.`);
        }
        return parseInputToScVal(rawVal, input.type_);
      });

      // Load current account sequence from Horizon
      const sourceAccount = await horizonServer.loadAccount(userAddress);

      // Build Transaction
      let tx = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
      .addOperation(StellarSdk.Operation.invokeContractFunction({
        contract: contractId,
        function: funcName,
        args: parsedArgs,
      }))
      .setTimeout(60)
      .build();

      // Simulate and prepare resource limits
      tx = await rpcServer.prepareTransaction(tx);

      let signedTx;
      if (walletType === "playground") {
        addLog(`Auto-signing invocation using in-browser Playground Wallet...`, "info");
        tx.sign(StellarSdk.Keypair.fromSecret(playgroundSecret));
        signedTx = tx;
      } else {
        addLog(`Requesting Freighter wallet signature to call "${funcName}"...`, "info");
        const { signTransaction } = await import("@stellar/freighter-api");
        const signed = await signTransaction(tx.toXDR(), {
          networkPassphrase: StellarSdk.Networks.TESTNET,
        });

        if (!signed || !signed.signedTxXdr) {
          throw new Error("Transaction signature rejected by Freighter");
        }

        signedTx = StellarSdk.TransactionBuilder.fromXDR(
          signed.signedTxXdr,
          StellarSdk.Networks.TESTNET
        );
      }

      addLog(`Submitting transaction to Stellar ledger...`, "info");
      const sendResponse = await rpcServer.sendTransaction(signedTx);

      if (sendResponse.status === "ERROR") {
        throw new Error(`Transaction submission error: ${JSON.stringify((sendResponse as any).errorResult || sendResponse)}`);
      }

      // Poll transaction
      let txResponse = await rpcServer.getTransaction(sendResponse.hash);
      while ((txResponse.status as any) === "PENDING" || txResponse.status === "NOT_FOUND") {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        txResponse = await rpcServer.getTransaction(sendResponse.hash);
      }

      if (txResponse.status === "FAILED") {
        throw new Error(`Transaction execution failed: ${JSON.stringify((txResponse as any).resultXdr)}`);
      }

      // Parse Return Value
      const nativeValue = txResponse.returnValue 
        ? StellarSdk.scValToNative(txResponse.returnValue as any) 
        : null;
      const outputString = typeof nativeValue === "object" ? JSON.stringify(nativeValue, null, 2) : String(nativeValue);

      addLog(`Method "${funcName}" returned: ${outputString}`, "success");
      setOutputs((prev) => ({ ...prev, [funcName]: outputString }));

      // Record interaction activity securely
      fetch("/api/activity/interact", { method: "POST" }).catch(() => {});

    } catch (err: any) {
      console.error(err);
      addLog(`Invocation failed: ${err.message}`, "error");
      setOutputs((prev) => ({ ...prev, [funcName]: `Error: ${err.message}` }));
    } finally {
      setInvoking((prev) => ({ ...prev, [funcName]: false }));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div className="panel-title">
        <span>Interact with Contract</span>
      </div>

      {/* Contract ID Header / Setup */}
      {!contractId ? (
        <form onSubmit={handleManualContractIdSubmit} className="input-group">
          <label className="input-label">Load Deployed Contract ID</label>
          <input
            type="text"
            className="form-control form-control-mono"
            placeholder="e.g. CC5... or CA..."
            value={manualContractId}
            onChange={(e) => setManualContractId(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary" style={{ marginTop: "6px" }}>
            Load Contract
          </button>
        </form>
      ) : (
        <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "hsl(var(--text-secondary))" }}>
            <span style={{ fontWeight: 600 }}>Active Contract ({projectName}):</span>
            <button
              onClick={() => onContractIdChange("")}
              style={{ background: "transparent", border: "none", color: "hsl(var(--accent-error))", cursor: "pointer", fontSize: "0.7rem" }}
            >
              Clear
            </button>
          </div>
          <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "hsl(var(--accent-cyan))", wordBreak: "break-all" }}>
            {contractId}
          </span>
        </div>
      )}

      {/* Methods Area */}
      <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "14px" }}>
        {!abi || abi.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "6px", color: "hsl(var(--text-secondary))", fontSize: "0.75rem", lineHeight: "1.4" }}>
            <Code size={16} style={{ flexShrink: 0, color: "hsl(var(--accent-violet))" }} />
            <span>Compile your contract and deploy it (or load one manually) to render methods.</span>
          </div>
        ) : !contractId ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px", background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.15)", borderRadius: "6px", color: "hsl(var(--accent-warning))", fontSize: "0.75rem", lineHeight: "1.4" }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>Please deploy the contract or load its ID to execute functions.</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {abi
              .filter((item) => "function_v0" in item)
              .map((item) => {
                const func = item.function_v0;
                const isPending = invoking[func.name] || false;
                
                return (
                  <div key={func.name} className="method-card">
                    <div className="method-name">{func.name}</div>
                    
                    {/* Render inputs */}
                    {func.inputs && func.inputs.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "12px" }}>
                        {func.inputs.map((input: any) => {
                          const inputTypeStr = typeof input.type_ === "object" ? JSON.stringify(input.type_) : String(input.type_);
                          
                          return (
                            <div key={input.name} className="input-group" style={{ margin: 0 }}>
                              <label className="input-label" style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>{input.name}</span>
                                <span style={{ color: "hsl(var(--text-muted))" }}>({inputTypeStr})</span>
                              </label>
                              <input
                                type="text"
                                className="form-control form-control-mono"
                                placeholder={inputTypeStr.includes("vec") ? `e.g. ["val1", "val2"]` : `value`}
                                value={inputValues[`${func.name}-${input.name}`] || ""}
                                onChange={(e) => handleInputChange(func.name, input.name, e.target.value)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Invoke Button */}
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleInvoke(func.name, func.inputs)}
                      disabled={isPending}
                      style={{ width: "100%", justifyContent: "center", gap: "6px", padding: "6px 12px", fontSize: "0.75rem" }}
                    >
                      {isPending ? (
                        <>
                          <div className="spinner"></div>
                          <span>Executing...</span>
                        </>
                      ) : (
                        <>
                          <Play size={12} fill="currentColor" />
                          <span>Transact</span>
                        </>
                      )}
                    </button>

                    {/* Outputs display */}
                    {outputs[func.name] !== undefined && (
                      <div style={{ marginTop: "12px", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ fontSize: "0.65rem", color: "hsl(var(--text-muted))", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <CheckCircle size={10} style={{ color: "hsl(var(--accent-success))" }} /> Return Value:
                        </div>
                        <pre style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "hsl(var(--text-primary))", whiteSpace: "pre-wrap" }}>
                          {outputs[func.name]}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
