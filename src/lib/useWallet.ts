"use client";

import { useCallback, useEffect, useState } from "react";

import { connectWallet, disconnectWallet } from "@/lib/wallet";

const KEY = "starjar:address";

/**
 * The connected address, remembered across page loads. Only the public key is
 * stored; signing always goes back to the wallet.
 */
export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(KEY);
    if (saved && /^G[A-Z2-7]{55}$/.test(saved)) setAddress(saved);
  }, []);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const a = await connectWallet();
      window.localStorage.setItem(KEY, a);
      setAddress(a);
      return a;
    } catch (e) {
      setError((e as Error)?.message ?? "Wallet connection was cancelled");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    window.localStorage.removeItem(KEY);
    setAddress(null);
    await disconnectWallet().catch(() => undefined);
  }, []);

  return { address, connect, disconnect, busy, error };
}
