import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAssets } from "@/features/assets/hooks/useAssets";
import { statusLabel } from "@/lib/format";
import type { Asset, AssetKind, AssetStatus, AssetQuery } from "@/lib/types";
import { AssetContent } from "@/features/assets/components/AssetContent";
import { Filters } from "@/features/assets/components/Filters";
import { Header } from "@/features/assets/components/Header";
import { useBulkAssetStatus } from "@/features/assets/hooks/useBulkAssetStatus";

const STATUSES: AssetStatus[] = ["draft", "in_review", "approved", "archived"];

interface UrlQueryState {
  q: string;
  status: AssetStatus[];
  kind: AssetKind[];
  tag: string;
  sort: NonNullable<AssetQuery["sort"]>;
}

function readQueryFromUrl(): UrlQueryState {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get("q") ?? "",
    status:
      (params.get("status")?.split(",").filter(Boolean) as
        | AssetStatus[]
        | undefined) ?? [],
    kind:
      (params.get("kind")?.split(",").filter(Boolean) as
        | AssetKind[]
        | undefined) ?? [],
    tag: params.get("tag") ?? "",
    sort:
      (params.get("sort") as NonNullable<AssetQuery["sort"]> | null) ??
      "updatedAt:desc",
  };
}

const ResultCount = memo(function ResultCount({
  loading,
  itemCount,
  total,
}: {
  loading: boolean;
  itemCount: number;
  total: number;
}) {
  return (
    <span className="muted">
      {loading && !itemCount
        ? "Loading…"
        : `${itemCount} of ${total.toLocaleString()} shown`}
    </span>
  );
});

export function AssetPage() {
  const [initialQuery] = useState(readQueryFromUrl);
  const [q, setQ] = useState(initialQuery.q);
  const [status, setStatus] = useState<AssetStatus[]>(initialQuery.status);
  const [kind, setKind] = useState<AssetKind[]>(initialQuery.kind);
  const [tag, setTag] = useState(initialQuery.tag);
  const [sort, setSort] = useState<NonNullable<AssetQuery["sort"]>>(
    initialQuery.sort,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const openerRef = useRef<HTMLElement | null>(null);
  // Keep the query stable when only selection, detail, or notice state changes.
  const query = useMemo<AssetQuery>(
    () => ({
      q,
      status,
      kind,
      tag: tag
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      sort,
      limit: 48,
    }),
    [q, status, kind, tag, sort],
  );
  const {
    items,
    total,
    loading,
    loadingMore,
    error,
    nextCursor,
    loadNextPage,
    updateItems,
  } = useAssets(query);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    for (const name of ["q", "status", "kind", "tag", "sort"]) {
      params.delete(name);
    }
    if (q) params.set("q", q);
    if (status.length) params.set("status", status.join(","));
    if (kind.length) params.set("kind", kind.join(","));
    if (tag) params.set("tag", tag);
    if (sort !== "updatedAt:desc") params.set("sort", sort);
    const search = params.toString();
    const nextUrl = `${location.pathname}${search ? `?${search}` : ""}${location.hash}`;
    if (nextUrl !== `${location.pathname}${location.search}${location.hash}`) {
      history.replaceState(history.state, "", nextUrl);
    }
  }, [q, status, kind, tag, sort]);
  const syncQueryFromUrl = useCallback(() => {
    const nextQuery = readQueryFromUrl();
    setQ(nextQuery.q);
    setStatus(nextQuery.status);
    setKind(nextQuery.kind);
    setTag(nextQuery.tag);
    setSort(nextQuery.sort);
  }, []);

  useEffect(() => {
    addEventListener("popstate", syncQueryFromUrl);
    addEventListener("pageshow", syncQueryFromUrl);
    return () => {
      removeEventListener("popstate", syncQueryFromUrl);
      removeEventListener("pageshow", syncQueryFromUrl);
    };
  }, [syncQueryFromUrl]); // Back/forward support
  useEffect(() => {
    if (loading || error) return;
    const timer = window.setTimeout(() => {
      setAnnouncement(
        items.length === 0
          ? "No assets match these filters."
          : `${items.length} of ${total.toLocaleString()} assets shown.`,
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [error, items.length, loading, total]);
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const handleStatusChange = useCallback(
    (value: AssetStatus, checked: boolean) => {
      setStatus((previous) =>
        checked
          ? [...previous, value]
          : previous.filter((item) => item !== value),
      );
    },
    [],
  );
  const handleKindChange = useCallback((value: AssetKind, checked: boolean) => {
    setKind((previous) =>
      checked
        ? [...previous, value]
        : previous.filter((item) => item !== value),
    );
  }, []);
  const handleTagChange = useCallback((value: string) => setTag(value), []);
  const selectRange = useCallback((ids: string[]) => {
    setSelectedIds((previous) => new Set([...previous, ...ids]));
  }, []);
  const selectAllLoaded = useCallback(
    () => setSelectedIds(new Set(items.map((item) => item.id))),
    [items],
  );
  const { retryableIds, applyBulkStatus, retryFailed } = useBulkAssetStatus({
    items,
    selectedIds,
    updateItems,
    setSelectedIds,
    setNotice,
  });
  const handleSaved = useCallback(
    (asset: Asset) => updateItems(new Map([[asset.id, asset]])),
    [updateItems],
  );
  const openDetail = useCallback((id: string) => {
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setActiveId(id);
  }, []);
  const closeDetail = useCallback(() => {
    const opener = openerRef.current;
    setActiveId(null);
    window.requestAnimationFrame(() => {
      if (opener?.isConnected) {
        opener.focus();
        return;
      }
      document
        .querySelector<HTMLElement>('[data-asset-index="0"], [role="grid"]')
        ?.focus();
    });
  }, []);
  const goHome = useCallback(() => {
    setQ("");
    setStatus([]);
    setKind([]);
    setTag("");
    setSort("updatedAt:desc");
    setSelectedIds(new Set());
    setActiveId(null);
    setNotice(null);
    const params = new URLSearchParams(location.search);
    for (const name of ["q", "status", "kind", "tag", "sort"]) {
      params.delete(name);
    }
    const search = params.toString();
    history.replaceState(
      history.state,
      "",
      `${location.pathname}${search ? `?${search}` : ""}${location.hash}`,
    );
  }, []);
  return (
    <div className="app">
      <Header
        q={q}
        sort={sort}
        onQueryChange={setQ}
        onSortChange={setSort}
        onHome={goHome}
      />
      <div className="filters">
        <Filters
          status={status}
          kind={kind}
          tag={tag}
          onStatusChange={handleStatusChange}
          onKindChange={handleKindChange}
          onTagChange={handleTagChange}
        />
        <ResultCount loading={loading} itemCount={items.length} total={total} />
      </div>
      {selectedIds.size > 0 && (
        <div className="bulkbar">
          <span>{selectedIds.size} selected</span>
          {STATUSES.map((s) => (
            <button key={s} onClick={() => applyBulkStatus(s)}>
              Set {statusLabel(s).toLowerCase()}
            </button>
          ))}
          {retryableIds.length > 0 && (
            <button onClick={retryFailed}>
              Retry {retryableIds.length} retryable
            </button>
          )}
          <button onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </button>
        </div>
      )}
      {notice && (
        <p className="notice" role="status" aria-live="polite">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error.includes("429")
            ? "The service is busy. Please try again shortly."
            : error}
        </p>
      )}
      <p className="announcement" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <AssetContent
        items={items}
        loading={loading}
        error={error}
        loadingMore={loadingMore}
        nextCursor={nextCursor}
        selectedIds={selectedIds}
        activeId={activeId}
        onToggleSelect={toggleSelect}
        onSelectRange={selectRange}
        onSelectAll={selectAllLoaded}
        onOpen={openDetail}
        onLoadMore={loadNextPage}
        onClose={closeDetail}
        onSaved={handleSaved}
      />
    </div>
  );
}
