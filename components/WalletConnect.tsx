"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type EthereumProvider = {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, cb: (...args: any[]) => void) => void;
  removeListener?: (event: string, cb: (...args: any[]) => void) => void;
};

function isHexAddress(s: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(s || "");
}
function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function WalletConnect() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const eth = (typeof window !== "undefined" ? (window as any).ethereum : null) as EthereumProvider | null;

  async function refreshAccounts() {
    if (!eth) return;
    try {
      const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
      const a = accounts?.[0];
      if (a && isHexAddress(a)) {
        setAddress(a);
        router.push(`/relic/${a}`);
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refreshAccounts();
    if (!eth || !eth.on) return;
    const onChange = (accs: string[]) => {
      const a = accs?.[0];
      if (a && isHexAddress(a)) {
        setAddress(a);
        router.push(`/relic/${a}`);
      } else {
        setAddress(null);
      }
    };
    eth.on("accountsChanged", onChange);
    return () => eth.removeListener?.("accountsChanged", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    if (!eth) {
      setMsg("No wallet found. Install Coinbase Wallet or MetaMask.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const a = accounts?.[0];
      if (a && isHexAddress(a)) {
        setAddress(a);
        router.push(`/relic/${a}`);
      } else {
        setMsg("Could not get a valid address.");
      }
    } catch (e: any) {
      setMsg(e?.message || "Connection rejected.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={connect}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-5 py-3 text-sm font-semibold"
      >
        {loading ? "Connecting…" : address ? `Connected: ${short(address)}` : "Connect Wallet"}
      </button>
      {msg && <div className="text-xs text-zinc-400">{msg}</div>}
    </div>
  );
}
