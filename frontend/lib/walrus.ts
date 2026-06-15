import { NARWHAL_CONFIG } from "./config";

interface BlobInfo {
  blobId: string;
  size: number;
  endEpoch?: number;
  alreadyCertified: boolean;
}

interface PublisherResponse {
  newlyCreated?: {
    blobObject: { blobId: string; size: number; storage?: { endEpoch: number } };
  };
  alreadyCertified?: {
    blobId: string;
    endEpoch: number;
  };
}

const PUBLISHER = NARWHAL_CONFIG.walrus.publisher.replace(/\/$/, "");
const AGGREGATOR = NARWHAL_CONFIG.walrus.aggregator.replace(/\/$/, "");
const DEFAULT_EPOCHS = NARWHAL_CONFIG.walrus.defaultEpochs;

/**
 * Thrown when the aggregator returns 404 for a blob. On Walrus this almost
 * always means the blob's storage period elapsed and it was garbage-collected
 * (testnet epochs are short), not that the aggregator URL is wrong.
 */
export class BlobNotFoundError extends Error {
  readonly blobId: string;
  constructor(blobId: string) {
    super(`Walrus blob not found (expired or never stored): ${blobId}`);
    this.name = "BlobNotFoundError";
    this.blobId = blobId;
  }
}

/** Whether an error originates from a missing/expired Walrus blob. */
export function isBlobNotFound(err: unknown): err is BlobNotFoundError {
  return err instanceof BlobNotFoundError;
}

/** Upload raw bytes to Walrus and return the resulting blob info. */
export async function putBlob(
  data: Uint8Array | Blob,
  opts: { epochs?: number } = {},
): Promise<BlobInfo> {
  const epochs = opts.epochs ?? DEFAULT_EPOCHS;
  const url = `${PUBLISHER}/v1/blobs?epochs=${epochs}`;
  const body =
    data instanceof Blob ? data : new Blob([new Uint8Array(data)], { type: "application/octet-stream" });
  const res = await fetch(url, { method: "PUT", body });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Walrus publisher ${res.status}: ${text || res.statusText}`);
  }
  const json = (await res.json()) as PublisherResponse;
  if (json.newlyCreated) {
    const obj = json.newlyCreated.blobObject;
    return {
      blobId: obj.blobId,
      size: obj.size,
      endEpoch: obj.storage?.endEpoch,
      alreadyCertified: false,
    };
  }
  if (json.alreadyCertified) {
    return {
      blobId: json.alreadyCertified.blobId,
      size: 0,
      endEpoch: json.alreadyCertified.endEpoch,
      alreadyCertified: true,
    };
  }
  throw new Error(`Unexpected Walrus publisher response: ${JSON.stringify(json)}`);
}

/** Download bytes from Walrus aggregator. */
export async function getBlob(blobId: string): Promise<Uint8Array> {
  const res = await fetch(`${AGGREGATOR}/v1/blobs/${encodeURIComponent(blobId)}`);
  if (res.status === 404) {
    throw new BlobNotFoundError(blobId);
  }
  if (!res.ok) {
    throw new Error(`Walrus aggregator ${res.status}: ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/** Convenience: upload a JSON-serialisable value as utf-8. */
export async function uploadJSON<T>(value: T, opts?: { epochs?: number }): Promise<BlobInfo> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return putBlob(bytes, opts);
}

/** Convenience: fetch and JSON-parse a blob's bytes. */
export async function fetchJSON<T>(blobId: string): Promise<T> {
  const bytes = await getBlob(blobId);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/** Upload a browser File (image/video/etc) and return blob info + media type. */
export async function uploadFile(file: File, opts?: { epochs?: number }): Promise<BlobInfo & { mediaType: string }> {
  const info = await putBlob(file, opts);
  return { ...info, mediaType: file.type || "application/octet-stream" };
}

/** Build the public aggregator URL for a blob (handy for <img src> / <video src>). */
export function blobUrl(blobId: string): string {
  return `${AGGREGATOR}/v1/blobs/${encodeURIComponent(blobId)}`;
}
