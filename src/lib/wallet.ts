/**
 * Stellar Wallets Kit, loaded on demand.
 *
 * Every import is dynamic: the kit touches `document` when it loads, so it
 * stays out of server rendering and out of pages that never connect a wallet.
 */
import { CONFIG } from "@/lib/config";

let ready = false;

async function kit() {
  const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit");
  if (ready) return StellarWalletsKit;

  const { Networks } = await import("@creit.tech/stellar-wallets-kit/types");
  const [{ FreighterModule }, { xBullModule }, { AlbedoModule }, { LobstrModule }, { HanaModule }, { RabetModule }] =
    await Promise.all([
      import("@creit.tech/stellar-wallets-kit/modules/freighter"),
      import("@creit.tech/stellar-wallets-kit/modules/xbull"),
      import("@creit.tech/stellar-wallets-kit/modules/albedo"),
      import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
      import("@creit.tech/stellar-wallets-kit/modules/hana"),
      import("@creit.tech/stellar-wallets-kit/modules/rabet"),
    ]);

  StellarWalletsKit.init({
    modules: [
      new FreighterModule(),
      new LobstrModule(),
      new xBullModule(),
      new AlbedoModule(),
      new HanaModule(),
      new RabetModule(),
    ],
    network: CONFIG.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
  });
  ready = true;
  return StellarWalletsKit;
}

export async function connectWallet(): Promise<string> {
  const k = await kit();
  const { address } = await k.authModal();
  return address;
}

export async function signWithWallet(xdr: string, address: string): Promise<string> {
  const k = await kit();
  const { signedTxXdr } = await k.signTransaction(xdr, { address, networkPassphrase: CONFIG.passphrase });
  return signedTxXdr;
}

export async function disconnectWallet(): Promise<void> {
  const k = await kit();
  await k.disconnect();
}
