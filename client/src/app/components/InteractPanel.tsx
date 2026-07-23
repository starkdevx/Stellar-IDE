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

function getFriendlyError(errMsg: string, abi: any[] | null): string {
  if (!errMsg) return "Unknown execution error";

  // Check for Contract custom error pattern: e.g. "Error(Contract, #5)"
  const contractErrorMatch = errMsg.match(/Error\(Contract,\s*#(\d+)\)/);
  if (contractErrorMatch) {
    const errorCode = parseInt(contractErrorMatch[1], 10);
    
    // Attempt to search ABI for a custom error matching this code
    if (abi && Array.isArray(abi)) {
      for (const item of abi) {
        if (item.udt_error_enum_v0 && item.udt_error_enum_v0.cases) {
          const cases = item.udt_error_enum_v0.cases;
          const matchingCase = cases.find(
            (c: any) => c.value === errorCode || parseInt(c.value, 10) === errorCode
          );
          if (matchingCase) {
            return `Contract Custom Error "${matchingCase.name}" (Code #${errorCode}). This is a validation check failure built into the contract rules.`;
          }
        }
      }
    }
    
    return `Contract Error #${errorCode}: A custom validation or assertion check failed inside the contract.`;
  }

  // Check for VM trap / panic pattern
  if (errMsg.includes("UnreachableCodeReached") || errMsg.includes("InvalidAction")) {
    return "VM Execution Error (Trap): The contract panicked or hit an unreachable path (e.g. assert fail, unwrap on None, or division by zero).";
  }

  return errMsg;
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
  const mapInputToScVal = (val: string, typeStr: string): StellarSdk.xdr.ScVal => {
    const trimmed = val.trim();
    if (typeStr === "u32" || typeStr === "i32") {
      return StellarSdk.nativeToScVal(parseInt(trimmed, 10), { type: typeStr as any });
    }
    if (typeStr === "u64" || typeStr === "i64" || typeStr === "u128" || typeStr === "i128") {
      return StellarSdk.nativeToScVal(BigInt(trimmed), { type: typeStr as any });
    }
    if (typeStr === "bool") {
      return StellarSdk.nativeToScVal(trimmed.toLowerCase() === "true");
    }
    if (typeStr === "string") {
      return StellarSdk.nativeToScVal(trimmed);
    }
    if (typeStr === "address") {
      return StellarSdk.Address.fromString(trimmed).toScVal();
    }
    // Default fallback
    return StellarSdk.nativeToScVal(trimmed);
  };

  const handleInvoke = async (funcName: string, inputsList: any[]) => {
    if (!contractId || invoking[funcName]) return;
    
    setInvoking((prev) => ({ ...prev, [funcName]: true }));
    addLog(`Invoking contract method "${funcName}"...`, "info");

    try {
      const walletType = getActiveWalletType();
      let userAddress = "";
      let playgroundSecret = "";

      if (walletType === "playground") {
        playgroundSecret = getOrCreatePlaygroundSecret();
        userAddress = getPublicKeyFromSecret(playgroundSecret);
      } else {
        const userAddressFreighter = await getAddress();
        if (userAddressFreighter && typeof userAddressFreighter === "string") {
          userAddress = userAddressFreighter;
        } else if (userAddressFreighter && (userAddressFreighter as any).address) {
          userAddress = (userAddressFreighter as any).address;
        }
      }

      if (!userAddress) {
        throw new Error("No active wallet connected. Open the Deploy panel to connect.");
      }

      const rpcServer = new StellarSdk.rpc.Server(rpcUrl);
      const horizonServer = new StellarSdk.Horizon.Server(horizonUrl);

      // Build parameters ScVal vector
      const paramsScVals: StellarSdk.xdr.ScVal[] = [];
      for (const input of inputsList) {
        const val = inputValues[`${funcName}-${input.name}`] || "";
        const inputTypeStr = typeof input.type_ === "object" ? JSON.stringify(input.type_) : String(input.type_);
        paramsScVals.push(mapInputToScVal(val, inputTypeStr));
      }

      // Load source account
      const sourceAccount = await horizonServer.loadAccount(userAddress);

      // Build contract invocation operation
      let tx = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
      .addOperation(StellarSdk.Operation.invokeContractFunction({
        contract: contractId,
        function: funcName,
        args: paramsScVals,
      }))
      .setTimeout(60)
      .build();

      // Simulate transaction to get fees and resources
      tx = await rpcServer.prepareTransaction(tx);

      let signedTx;
      if (walletType === "playground") {
        addLog("Auto-signing invocation using in-browser Playground Wallet...", "info");
        tx.sign(StellarSdk.Keypair.fromSecret(playgroundSecret));
        signedTx = tx;
      } else {
        addLog("Requesting signature from Freighter wallet...", "info");
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

      addLog("Submitting transaction to Stellar ledger...", "info");
      const sendResponse = await rpcServer.sendTransaction(signedTx);

      if (sendResponse.status === "ERROR") {
        throw new Error(`Transaction submission error: ${JSON.stringify((sendResponse as any).errorResult || sendResponse)}`);
      }

      // Poll transaction status
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
      const outputString = typeof nativeValue === "object" && nativeValue !== null
        ? JSON.stringify(nativeValue, (key, value) => typeof value === "bigint" ? value.toString() : value, 2)
        : String(nativeValue);

      addLog(`Method "${funcName}" returned: ${outputString}`, "success");
      setOutputs((prev) => ({ ...prev, [funcName]: outputString }));

      // Record interaction activity securely
      fetch("/api/activity/interact", { method: "POST" }).catch(() => {});

    } catch (err: any) {
      console.error(err);
      const friendlyMsg = getFriendlyError(err.message || String(err), abi);
      addLog(`Invocation failed: ${friendlyMsg}`, "error");
      setOutputs((prev) => ({ ...prev, [funcName]: `Error: ${friendlyMsg}` }));
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
