import { useCallback, useState } from "react";
import { ApiError, bulkSetStatus } from "@/api/client";
import type { Asset, AssetStatus } from "@/lib/types";

interface UseBulkAssetStatusOptions {
  items: Asset[];
  selectedIds: Set<string>;
  updateItems: (updates: Map<string, Asset>) => void;
  setSelectedIds: (ids: Set<string>) => void;
  setNotice: (notice: string | null) => void;
}

export function useBulkAssetStatus({
  items,
  selectedIds,
  updateItems,
  setSelectedIds,
  setNotice,
}: UseBulkAssetStatusOptions) {
  const [retryableIds, setRetryableIds] = useState<string[]>([]);
  const [lastBulkStatus, setLastBulkStatus] =
    useState<AssetStatus>("in_review");

  const applyBulkStatus = useCallback(
    async (next: AssetStatus) => {
      const ids = [...selectedIds];
      if (ids.length === 0) return;
      setLastBulkStatus(next);
      setNotice(null);
      setRetryableIds([]);
      const previous = new Map(
        items
          .filter((item) => ids.includes(item.id))
          .map((item) => [item.id, item]),
      );
      updateItems(
        new Map(
          [...previous].map(([id, asset]) => [id, { ...asset, status: next }]),
        ),
      );
      const batches = Array.from(
        { length: Math.ceil(ids.length / 50) },
        (_, index) => ids.slice(index * 50, index * 50 + 50),
      );
      const results: Awaited<ReturnType<typeof bulkSetStatus>>["results"] = [];
      let cursor = 0;
      const worker = async () => {
        while (cursor < batches.length) {
          const batch = batches[cursor++] ?? [];
          try {
            const result = await bulkSetStatus(batch, next);
            results.push(...result.results);
          } catch (err) {
            results.push(
              ...batch.map((id) => ({
                id,
                ok: false as const,
                code: err instanceof ApiError ? err.code : "network_error",
                message: "The request did not complete.",
              })),
            );
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      const failed = results.filter((result) => !result.ok);
      setRetryableIds(
        failed
          .filter(
            (result) =>
              result.code === "conflict" ||
              result.code === "network_error" ||
              result.code === "upstream_unavailable" ||
              result.code === "rate_limited",
          )
          .map((result) => result.id),
      );
      const successful = new Map(
        results
          .filter(
            (result): result is Extract<typeof result, { ok: true }> =>
              result.ok,
          )
          .map((result) => [result.id, result.asset]),
      );
      const rollback = new Map<string, Asset>();
      failed.forEach((result) => {
        const asset = previous.get(result.id);
        if (asset) rollback.set(result.id, asset);
      });
      updateItems(new Map([...successful, ...rollback]));
      setSelectedIds(new Set(failed.map((result) => result.id)));
      if (failed.length) {
        const permanent = failed.filter(
          (result) => result.code === "legal_hold",
        ).length;
        setNotice(
          `${successful.size} updated. ${failed.length} failed${permanent ? ` (${permanent} on legal hold)` : ""}. Failed items remain selected.`,
        );
      } else {
        setNotice(`${successful.size} assets updated.`);
        setSelectedIds(new Set());
      }
    },
    [items, selectedIds, setNotice, setSelectedIds, updateItems],
  );

  const retryFailed = useCallback(async () => {
    const ids = retryableIds;
    if (!ids.length) return;
    setSelectedIds(new Set(ids));
    setRetryableIds([]);
    setNotice(null);
    const batches = Array.from(
      { length: Math.ceil(ids.length / 50) },
      (_, index) => ids.slice(index * 50, index * 50 + 50),
    );
    const retryResults: Awaited<ReturnType<typeof bulkSetStatus>>[] = [];
    let retryCursor = 0;
    const retryWorker = async () => {
      while (retryCursor < batches.length) {
        const batch = batches[retryCursor++] ?? [];
        try {
          retryResults.push(await bulkSetStatus(batch, lastBulkStatus));
        } catch (err) {
          retryResults.push({
            applied: 0,
            failed: batch.length,
            results: batch.map((id) => ({
              id,
              ok: false as const,
              code: err instanceof ApiError ? err.code : "network_error",
              message: "The retry request did not complete.",
            })),
          });
        }
      }
    };
    await Promise.all([retryWorker(), retryWorker(), retryWorker()]);
    const retrySuccesses = retryResults.flatMap((result) =>
      result.results.filter(
        (item): item is Extract<typeof item, { ok: true }> => item.ok,
      ),
    );
    updateItems(new Map(retrySuccesses.map((item) => [item.id, item.asset])));
    const failed = retryResults.flatMap((result) =>
      result.results.filter((item) => !item.ok),
    );
    setRetryableIds(
      failed
        .filter(
          (result) =>
            result.code === "conflict" ||
            result.code === "network_error" ||
            result.code === "upstream_unavailable" ||
            result.code === "rate_limited",
        )
        .map((result) => result.id),
    );
    setNotice(
      failed.length
        ? `${failed.length} items still need attention.`
        : `${ids.length} failed items updated.`,
    );
    if (!failed.length) setSelectedIds(new Set());
  }, [lastBulkStatus, retryableIds, setNotice, setSelectedIds, updateItems]);

  return { retryableIds, applyBulkStatus, retryFailed };
}
