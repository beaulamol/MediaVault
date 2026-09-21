import type { Asset, AssetPage, AssetQuery, BulkResult } from "@/lib/types";

/**
 * Baseline client. It works on a good network and falls apart on a bad one.
 *
 * Known gaps, all of which are yours to close:
 *   - no request cancellation
 *   - no retry, no backoff, no handling of Retry-After
 *   - no de-duplication of concurrent identical requests
 *   - error information is flattened into a string
 *   - callers cannot distinguish "retry this" from "do not retry this"
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toSearchParams(query: AssetQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status?.length) params.set("status", query.status.join(","));
  if (query.kind?.length) params.set("kind", query.kind.join(","));
  if (query.tag?.length) params.set("tag", query.tag.join(","));
  if (query.collectionId) params.set("collectionId", query.collectionId);
  if (query.owner) params.set("owner", query.owner);
  if (query.sort) params.set("sort", query.sort);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.cursor) params.set("cursor", query.cursor);
  return params.toString();
}

function retryDelay(attempt: number, retryAfterMs?: number) {
  if (retryAfterMs !== undefined) return retryAfterMs;
  const ceiling = Math.min(8000, 400 * 2 ** attempt);
  return Math.round(ceiling * (0.5 + Math.random()));
}

function isRetryable(error: unknown, method: string) {
  if (error instanceof DOMException && error.name === "AbortError")
    return false;
  if (error instanceof ApiError) {
    return (
      error.status === 429 ||
      error.status === 503 ||
      (error.status === 500 &&
        method === "PATCH" &&
        error.code === "write_failed")
    );
  }
  return error instanceof TypeError;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? "GET";
  const maxAttempts = 3;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const res = await fetch(path, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok) {
        let code = "request_failed";
        let detail = res.statusText || "The request failed.";
        try {
          const body = await res.json();
          code = body?.error?.code ?? code;
          detail = body?.error?.message ?? detail;
        } catch {
          /* Preserve the HTTP status when the body is not JSON. */
        }
        const retryAfter = Number(res.headers.get("retry-after"));
        const userMessage =
          code === "rate_limited"
            ? "The service is busy. Please try again shortly."
            : code === "upstream_unavailable"
              ? "The search service is temporarily unavailable."
              : detail;
        throw new ApiError(
          userMessage,
          res.status,
          code,
          Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined,
        );
      }
      return res.json() as Promise<T>;
    } catch (error) {
      if (!isRetryable(error, method) || attempt >= maxAttempts - 1)
        throw error;
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(
          resolve,
          retryDelay(
            attempt,
            error instanceof ApiError ? error.retryAfterMs : undefined,
          ),
        );
        init.signal?.addEventListener(
          "abort",
          () => {
            window.clearTimeout(timer);
            reject(new DOMException("Request cancelled", "AbortError"));
          },
          { once: true },
        );
      });
    }
  }
}

interface ListEntry {
  controller: AbortController;
  promise: Promise<AssetPage>;
  consumers: number;
}
const inFlightLists = new Map<string, ListEntry>();

export function listAssets(
  query: AssetQuery,
  signal?: AbortSignal,
): Promise<AssetPage> {
  const path = `/api/assets?${toSearchParams(query)}`;
  const existing = inFlightLists.get(path);
  // Strict Mode can clean up one consumer and remount another before the
  // aborted promise settles. Never attach a new consumer to that request.
  if (existing?.controller.signal.aborted) inFlightLists.delete(path);
  const entry =
    existing && !existing.controller.signal.aborted
      ? existing
      : (() => {
          const controller = new AbortController();
          const created: ListEntry = {
            controller,
            consumers: 0,
            promise: request<AssetPage>(path, {
              signal: controller.signal,
            }).finally(() => inFlightLists.delete(path)),
          };
          inFlightLists.set(path, created);
          return created;
        })();
  entry.consumers += 1;
  return new Promise<AssetPage>((resolve, reject) => {
    let settled = false;
    const release = () => {
      if (settled) return;
      settled = true;
      entry.consumers -= 1;
      if (entry.consumers === 0) entry.controller.abort();
    };
    const onAbort = () => {
      release();
      reject(new DOMException("Request cancelled", "AbortError"));
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
    entry.promise.then(
      (page) => {
        if (settled) return;
        settled = true;
        entry.consumers -= 1;
        signal?.removeEventListener("abort", onAbort);
        resolve(page);
      },
      (error) => {
        if (settled) return;
        settled = true;
        entry.consumers -= 1;
        signal?.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

export function getAsset(id: string, signal?: AbortSignal): Promise<Asset> {
  return request<Asset>(`/api/assets/${id}`, { signal });
}

export function getAssetsByIds(
  ids: string[],
): Promise<{ items: Asset[]; missing: string[] }> {
  const batches = Array.from(
    { length: Math.ceil(ids.length / 25) },
    (_, index) => ids.slice(index * 25, index * 25 + 25),
  );
  return Promise.all(
    batches.map((batch) =>
      request<{ items: Asset[]; missing: string[] }>(
        `/api/assets/batch?ids=${batch.join(",")}`,
      ),
    ),
  ).then((pages) => ({
    items: pages.flatMap((page) => page.items),
    missing: pages.flatMap((page) => page.missing),
  }));
}

export function updateAsset(
  id: string,
  version: number,
  patch: Partial<Pick<Asset, "name" | "status" | "tags">>,
  signal?: AbortSignal,
): Promise<Asset> {
  return request<Asset>(`/api/assets/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ version, patch }),
    signal,
  });
}

export function bulkSetStatus(
  ids: string[],
  status: Asset["status"],
): Promise<BulkResult> {
  // Note: the endpoint rejects more than 50 ids per call.
  return request<BulkResult>("/api/assets/bulk-status", {
    method: "POST",
    body: JSON.stringify({ ids, status }),
  });
}

export const thumbnailUrl = (id: string) => `/api/thumb/${id}.svg`;
