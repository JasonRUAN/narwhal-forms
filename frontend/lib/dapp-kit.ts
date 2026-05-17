"use client";

import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";

import { NARWHAL_CONFIG } from "./config";

const GRPC_URLS: Record<string, string> = {
  testnet: NARWHAL_CONFIG.fullnodeUrl,
  mainnet: "https://fullnode.mainnet.sui.io:443",
};

function build() {
  return createDAppKit({
    networks: ["testnet", "mainnet"] as const,
    defaultNetwork: NARWHAL_CONFIG.network,
    createClient: (network) =>
      new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] ?? GRPC_URLS.testnet }),
  });
}

export type NarwhalDAppKit = ReturnType<typeof build>;

let _instance: NarwhalDAppKit | null = null;

/**
 * Lazily construct the DAppKit instance. We avoid running this at module load
 * so Next.js can statically prerender pages without window/document.
 */
export function getDAppKit(): NarwhalDAppKit {
  if (!_instance) _instance = build();
  return _instance;
}

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: NarwhalDAppKit;
  }
}
