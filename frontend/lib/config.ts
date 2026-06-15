export type SuiNetwork = "testnet" | "mainnet";

const NETWORK = (process.env.NEXT_PUBLIC_NETWORK ?? "testnet") as SuiNetwork;

const WALRUS_DEFAULTS: Record<
  SuiNetwork,
  { publisher: string; aggregator: string }
> = {
  testnet: {
    publisher: "https://publisher.walrus-testnet.walrus.space",
    aggregator: "https://aggregator.walrus-testnet.walrus.space",
  },
  mainnet: {
    publisher: "https://publisher.walrus-mainnet.walrus.space",
    aggregator: "https://aggregator.walrus-mainnet.walrus.space",
  },
};

const SUI_FULLNODE_DEFAULTS: Record<SuiNetwork, string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
};

export const NARWHAL_CONFIG = {
  network: NETWORK,
  packageId:
    process.env.NEXT_PUBLIC_PACKAGE_ID ??
    "0x8acf32169489c759b612d124c339dc8fd22b77b757f05fe2fc401ec978567ae8",
  fullnodeUrl:
    process.env.NEXT_PUBLIC_SUI_FULLNODE_URL ?? SUI_FULLNODE_DEFAULTS[NETWORK],
  walrus: {
    publisher:
      process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL ??
      WALRUS_DEFAULTS[NETWORK].publisher,
    aggregator:
      process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ??
      WALRUS_DEFAULTS[NETWORK].aggregator,
    // Walrus caps a single blob at 53 epochs ahead. Testnet epochs are short
    // (1-2 days), so anything smaller expires quickly and 404s; use the max.
    defaultEpochs: 53,
  },
  seal: {
    threshold: 2,
    keyServers: [
      {
        objectId:
          "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
        weight: 1,
      },
      {
        objectId:
          "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
        weight: 1,
      },
    ],
  },
} as const;

export type NarwhalConfig = typeof NARWHAL_CONFIG;

/** Suiscan transaction URL for the configured network. Override base via NEXT_PUBLIC_SUI_EXPLORER. */
export function suiTxExplorerUrl(
  digest: string,
  network: SuiNetwork = NARWHAL_CONFIG.network,
): string {
  const base = process.env.NEXT_PUBLIC_SUI_EXPLORER ?? "https://suiscan.xyz";
  return `${base.replace(/\/$/, "")}/${network}/tx/${encodeURIComponent(digest)}`;
}

/** Sui object URL on Suiscan, useful for jumping to a Form / Cap object. */
export function suiObjectExplorerUrl(
  objectId: string,
  network: SuiNetwork = NARWHAL_CONFIG.network,
): string {
  const base = process.env.NEXT_PUBLIC_SUI_EXPLORER ?? "https://suiscan.xyz";
  return `${base.replace(/\/$/, "")}/${network}/object/${encodeURIComponent(objectId)}`;
}

/** Walruscan blob URL for the configured network. Override via NEXT_PUBLIC_WALRUS_EXPLORER. */
export function walrusBlobExplorerUrl(
  blobId: string,
  network: SuiNetwork = NARWHAL_CONFIG.network,
): string {
  const base =
    process.env.NEXT_PUBLIC_WALRUS_EXPLORER ?? "https://walruscan.com";
  return `${base.replace(/\/$/, "")}/${network}/blob/${encodeURIComponent(blobId)}`;
}
