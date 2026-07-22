import * as StellarSdk from "@stellar/stellar-sdk";

export type WalletType = "freighter" | "playground";

/**
 * Retrieves the active wallet type from localStorage
 */
export function getActiveWalletType(): WalletType {
  if (typeof window === "undefined") return "playground";
  const saved = localStorage.getItem("stellar_ide_active_wallet_type");
  return (saved === "freighter" ? "freighter" : "playground") as WalletType;
}

/**
 * Sets the active wallet type in localStorage
 */
export function setActiveWalletType(type: WalletType) {
  if (typeof window !== "undefined") {
    localStorage.setItem("stellar_ide_active_wallet_type", type);
    // Dispatch storage event to notify other components of the change
    window.dispatchEvent(new Event("stellar_wallet_change"));
  }
}

/**
 * Gets the current Playground Wallet secret key from localStorage,
 * or generates a new one if not found.
 */
export function getOrCreatePlaygroundSecret(): string {
  if (typeof window === "undefined") return "";
  let secret = localStorage.getItem("stellar_ide_playground_secret");
  if (!secret) {
    const kp = StellarSdk.Keypair.random();
    secret = kp.secret();
    localStorage.setItem("stellar_ide_playground_secret", secret);
  }
  return secret;
}

/**
 * Retrieves the public key (Address) derived from a secret key
 */
export function getPublicKeyFromSecret(secret: string): string {
  try {
    const kp = StellarSdk.Keypair.fromSecret(secret);
    return kp.publicKey();
  } catch {
    return "";
  }
}

/**
 * Signs a transaction XDR with the Playground keypair and returns the signed XDR
 */
export function signTxWithPlayground(txXdr: string, secretKey: string): string {
  const tx = StellarSdk.TransactionBuilder.fromXDR(txXdr, StellarSdk.Networks.TESTNET);
  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  tx.sign(keypair);
  return tx.toXDR();
}
