/* ─────────────────────────────────────────────────────────────────────────
 * lib/activity-store.ts — permanent activity history (server only)
 *
 * The public testnet RPC keeps about seven days of contract events. This
 * keeps every pool and receivables event since deployment in one JSON file
 * and tops it up from the RPC on each read: events newer than the stored
 * `syncedTo` ledger are fetched, merged and, when anything changed, written
 * back. A daily cron (vercel.json) runs the same sync, so history is captured
 * even if nobody opens the app for a week.
 *
 * On Vercel the file lives in a private Blob store; the SDK authenticates
 * with OIDC through BLOB_STORE_ID, which connecting the store to the project
 * adds. Without it (local development) the file is kept under .next/cache.
 * ───────────────────────────────────────────────────────────────────────── */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BlobNotFoundError, BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { DEPLOY_LEDGER, POOL_CONTRACT_ID, RECEIVABLES_CONTRACT_ID } from "@/lib/config";
import { fetchContractEvents, toStoredEvent, type StoredEvent } from "@/lib/contracts";

/** One file per deployment, so a redeploy starts a fresh history. */
const FILENAME = `${POOL_CONTRACT_ID.slice(0, 8)}-${RECEIVABLES_CONTRACT_ID.slice(0, 8)}.json`;
/** About a day of ledgers: advance the stored sync point at least this often. */
const DAY_OF_LEDGERS = 17_000;
/** How long a warm function reuses the file it last read. */
const MEMO_MS = 20_000;

type HistoryFile = {
  version: 1;
  pool: string;
  receivables: string;
  fromLedger: number;
  /** Last ledger fully read from the RPC. */
  syncedTo: number;
  /** False if a gap opened (the sync fell more than the RPC window behind). */
  complete: boolean;
  updatedAt: string;
  /** Newest first, one per transaction. */
  events: StoredEvent[];
};

export type History = {
  events: StoredEvent[];
  fromLedger: number;
  syncedTo: number;
  complete: boolean;
  /** Where the history is kept: "blob" on Vercel, "file" in local development. */
  store: "blob" | "file";
};

// ─── Storage ────────────────────────────────────────────────────────────────

/** Raised when the file changed since it was read. */
class ConflictError extends Error {}

type Store = {
  kind: History["store"];
  read(): Promise<{ text: string; etag: string } | null>;
  /** Writes only if the file still has `ifMatch` (or does not exist, when omitted). */
  write(text: string, ifMatch?: string): Promise<string>;
};

const blobStore: Store = {
  kind: "blob",
  async read() {
    const pathname = `activity/${FILENAME}`;
    try {
      // Bypass the CDN cache: this file is overwritten in place.
      const res = await get(pathname, { access: "private", useCache: false });
      if (!res || res.statusCode !== 200) return null;
      return { text: await new Response(res.stream).text(), etag: res.blob.etag };
    } catch (err) {
      if (err instanceof BlobNotFoundError) return null;
      throw err;
    }
  },
  async write(text, ifMatch) {
    try {
      const res = await put(`activity/${FILENAME}`, text, {
        access: "private",
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
        ...(ifMatch ? { ifMatch } : {}),
      });
      return res.etag;
    } catch (err) {
      if (err instanceof BlobPreconditionFailedError) throw new ConflictError();
      throw err;
    }
  },
};

const fileStore: Store = {
  kind: "file",
  async read() {
    try {
      const text = await readFile(localPath(), "utf8");
      return { text, etag: hash(text) };
    } catch {
      return null;
    }
  },
  async write(text, ifMatch) {
    const current = await this.read();
    if (current && ifMatch && current.etag !== ifMatch) throw new ConflictError();
    await mkdir(path.dirname(localPath()), { recursive: true });
    await writeFile(localPath(), text);
    return hash(text);
  },
};

const localPath = () => path.join(process.cwd(), ".next", "cache", "sanwo-activity", FILENAME);
const hash = (text: string) => createHash("sha1").update(text).digest("hex");
const store = (): Store => (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN ? blobStore : fileStore);

// ─── Sync ───────────────────────────────────────────────────────────────────

let memo: { file: HistoryFile; etag: string; at: number } | null = null;

async function load(s: Store, fresh: boolean): Promise<{ file: HistoryFile | null; etag?: string }> {
  if (!fresh && memo && Date.now() - memo.at < MEMO_MS) return memo;
  const res = await s.read();
  if (!res) return { file: null };
  memo = { file: JSON.parse(res.text) as HistoryFile, etag: res.etag, at: Date.now() };
  return memo;
}

function merge(a: StoredEvent[], b: StoredEvent[]): StoredEvent[] {
  const byTx = new Map<string, StoredEvent>();
  for (const e of [...a, ...b]) byTx.set(e.txHash, e);
  return [...byTx.values()].sort((x, y) => y.ledger - x.ledger || y.id.localeCompare(x.id));
}

/** Every event since deployment, topped up from the RPC and saved when it changed. */
export async function syncActivity(): Promise<History> {
  const s = store();
  for (let attempt = 0; ; attempt++) {
    const { file, etag } = await load(s, attempt > 0);
    const tail = await fetchContractEvents(file ? file.syncedTo + 1 : DEPLOY_LEDGER);
    const next: HistoryFile = {
      version: 1,
      pool: POOL_CONTRACT_ID,
      receivables: RECEIVABLES_CONTRACT_ID,
      fromLedger: DEPLOY_LEDGER,
      syncedTo: Math.max(tail.scannedTo, file?.syncedTo ?? 0),
      complete: (file?.complete ?? true) && !tail.gap,
      updatedAt: new Date().toISOString(),
      events: merge(file?.events ?? [], tail.events.map(toStoredEvent)),
    };
    const history: History = {
      events: next.events,
      fromLedger: next.fromLedger,
      syncedTo: next.syncedTo,
      complete: next.complete,
      store: s.kind,
    };

    const changed = !file || next.events.length !== file.events.length;
    const behind = !file || next.syncedTo - file.syncedTo > DAY_OF_LEDGERS;
    if (!changed && !behind) {
      // Nothing new to save. Remember how far this instance has read.
      if (memo) memo.file = { ...memo.file, syncedTo: next.syncedTo };
      return history;
    }

    try {
      const newEtag = await s.write(JSON.stringify(next), etag);
      memo = { file: next, etag: newEtag, at: Date.now() };
      return history;
    } catch (err) {
      // Another request saved first: read theirs and merge on top, once.
      if (err instanceof ConflictError && attempt === 0) continue;
      console.error("activity-store: could not save history", err);
      return history;
    }
  }
}
