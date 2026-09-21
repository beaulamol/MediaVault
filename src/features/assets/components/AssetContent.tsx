import { memo } from "react";
import { AssetDetail } from "@/features/assets/components/AssetDetail";
import { AssetGrid } from "@/features/assets/components/AssetGrid";
import type { Asset } from "@/lib/types";

export interface AssetContentProps {
  items: Asset[];
  loading: boolean;
  error: string | null;
  loadingMore: boolean;
  nextCursor: string | null;
  selectedIds: Set<string>;
  activeId: string | null;
  onToggleSelect: (id: string) => void;
  onSelectRange: (ids: string[]) => void;
  onSelectAll: () => void;
  onOpen: (id: string) => void;
  onLoadMore: () => void;
  onClose: () => void;
  onSaved: (asset: Asset) => void;
}

export const AssetContent = memo(function AssetContent({
  items,
  loading,
  error,
  loadingMore,
  nextCursor,
  selectedIds,
  activeId,
  onToggleSelect,
  onSelectRange,
  onSelectAll,
  onOpen,
  onLoadMore,
  onClose,
  onSaved,
}: AssetContentProps) {
  return (
    <main className="content">
      {loading && !items.length ? (
        <div className="state">Loading assets…</div>
      ) : error && !items.length ? (
        <div className="state state--error" role="alert">
          Could not load assets. Try again.
        </div>
      ) : items.length === 0 ? (
        <div className="state">No assets match these filters.</div>
      ) : (
        <AssetGrid
          assets={items}
          selectedIds={selectedIds}
          activeId={activeId}
          onToggleSelect={onToggleSelect}
          onSelectRange={onSelectRange}
          onSelectAll={onSelectAll}
          onOpen={onOpen}
          onLoadMore={onLoadMore}
          hasMore={Boolean(nextCursor)}
        />
      )}
      {loadingMore && <p className="page-status">Loading more assets…</p>}
      {activeId && (
        <AssetDetail id={activeId} onClose={onClose} onSaved={onSaved} />
      )}
    </main>
  );
});
