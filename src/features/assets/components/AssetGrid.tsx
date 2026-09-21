import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import {
  FixedSizeGrid,
  type GridChildComponentProps,
  type GridOnItemsRenderedProps,
} from "react-window";
import { thumbnailUrl } from "@/api/client";
import { formatBytes, formatDate, statusLabel } from "@/lib/format";
import type { Asset } from "@/lib/types";

interface Props {
  assets: Asset[];
  selectedIds: Set<string>;
  activeId: string | null;
  onToggleSelect: (id: string) => void;
  onSelectRange: (ids: string[]) => void;
  onSelectAll: () => void;
  onOpen: (id: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
}

const CARD_WIDTH = 230;
const ROW_HEIGHT = 298;

const GridOuter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function GridOuter({ className, ...props }, ref) {
  return (
    <div
      {...props}
      ref={ref}
      className={className}
      role="grid"
      aria-label="Media assets"
      aria-multiselectable="true"
    />
  );
});

const Card = memo(function Card({
  asset,
  selected,
  active,
  onToggle,
}: {
  asset: Asset;
  selected: boolean;
  active: boolean;
  onToggle: (id: string) => void;
}) {
  const [imageFailed, setImageFailed] = useState(!asset.hasThumbnail);
  return (
    <div
      className={`card${selected ? " card--selected" : ""}${active ? " card--active" : ""}`}
    >
      {imageFailed ? (
        <div className="card__thumb card__thumb--missing" aria-hidden="true">
          No preview
        </div>
      ) : (
        <img
          className="card__thumb"
          loading="lazy"
          src={thumbnailUrl(asset.id)}
          alt=""
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="card__body">
        <p className="card__name">{asset.name}</p>
        <p className="muted">
          {asset.kind} · {formatBytes(asset.sizeBytes)} ·{" "}
          {formatDate(asset.updatedAt)}
        </p>
        <span className={`pill pill--${asset.status}`}>
          {statusLabel(asset.status)}
        </span>
      </div>
      <label className="card__check-label">
        <input
          aria-label={`Select ${asset.name}`}
          type="checkbox"
          className="card__check"
          checked={selected}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onToggle(asset.id)}
        />
      </label>
    </div>
  );
});

interface GridData {
  assets: Asset[];
  columns: number;
  selectedIds: Set<string>;
  activeId: string | null;
  focusedIndex: number;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onFocus: (index: number) => void;
  onKeyDown: (event: KeyboardEvent, index: number) => void;
}

const GridCell = memo(function GridCell({
  columnIndex,
  rowIndex,
  style,
  data,
}: GridChildComponentProps<GridData>) {
  const index = rowIndex * data.columns + columnIndex; // Calculate the item's position in the assets array
  const asset = data.assets[index];
  if (!asset) return null;

  return (
    <div
      className="grid__item"
      style={style}
      data-asset-index={index} //keyboard focus
      role="gridcell"
      aria-label={asset.name} //help screen readers understand your UI
      aria-selected={data.selectedIds.has(asset.id)}
      tabIndex={data.focusedIndex === index ? 0 : -1}
      onClick={() => data.onOpen(asset.id)}
      onFocus={() => data.onFocus(index)}
      onKeyDown={(event) => data.onKeyDown(event, index)}
    >
      <Card
        asset={asset}
        selected={data.selectedIds.has(asset.id)}
        active={data.activeId === asset.id}
        onToggle={data.onToggleSelect}
      />
    </div>
  );
});

export const AssetGrid = memo(function AssetGrid({
  assets,
  selectedIds,
  activeId,
  onToggleSelect,
  onSelectRange,
  onSelectAll,
  onOpen,
  onLoadMore,
  hasMore,
}: Props) {
  const gridRef = useRef<FixedSizeGrid>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [focusedIndex, setFocusedIndex] = useState(0);
  const rangeAnchor = useRef(0);
  const gridHasFocus = useRef(false);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => {
      const styles = window.getComputedStyle(element);
      const horizontalPadding =
        parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const verticalPadding =
        parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const width = Math.max(0, element.clientWidth - horizontalPadding);
      const height = Math.max(0, element.clientHeight - verticalPadding);
      setViewport({ width, height });
      setColumns(Math.max(1, Math.floor(width / CARD_WIDTH)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setFocusedIndex((index) => Math.min(index, Math.max(0, assets.length - 1)));
  }, [assets.length]);

  useEffect(() => {
    const grid = gridRef.current;
    const viewport = viewportRef.current;
    const activeElement = document.activeElement;
    if (
      !grid ||
      !viewport ||
      !gridHasFocus.current ||
      !viewport.contains(activeElement) ||
      focusedIndex < 0 ||
      focusedIndex >= assets.length
    )
      return;
    grid.scrollToItem({
      rowIndex: Math.floor(focusedIndex / columns),
      columnIndex: focusedIndex % columns,
      align: "smart",
    });
    window.requestAnimationFrame(() => {
      viewportRef.current
        ?.querySelector<HTMLElement>(`[data-asset-index="${focusedIndex}"]`)
        ?.focus();
    });
  }, [assets.length, columns, focusedIndex]); //keeps keyboard navigation smooth and visible.

  const handleFocus = useCallback((index: number) => {
    gridHasFocus.current = true;
    setFocusedIndex(index);
    rangeAnchor.current = index;
  }, []); //This function runs whenever a grid cell receives focus.

  const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      gridHasFocus.current = false;
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent, index: number) => {
      let next = index;
      if (event.key === "ArrowRight")
        next = Math.min(assets.length - 1, index + 1);
      if (event.key === "ArrowLeft") next = Math.max(0, index - 1);
      if (event.key === "ArrowDown")
        next = Math.min(assets.length - 1, index + columns);
      if (event.key === "ArrowUp") next = Math.max(0, index - columns);
      if (next !== index) {
        event.preventDefault();
        if (event.shiftKey)
          onSelectRange(
            assets
              .slice(
                Math.min(rangeAnchor.current, next),
                Math.max(rangeAnchor.current, next) + 1,
              )
              .map((asset) => asset.id),
          );
        rangeAnchor.current = event.shiftKey ? rangeAnchor.current : next;
        setFocusedIndex(next);
      } else if (event.key === "Enter") onOpen(assets[index]!.id);
      else if (event.key === " ") {
        event.preventDefault();
        onToggleSelect(assets[index]!.id);
        rangeAnchor.current = index;
      }
    },
    [assets, columns, onOpen, onSelectRange, onToggleSelect],
  );

  const gridData: GridData = {
    assets,
    columns,
    selectedIds,
    activeId,
    focusedIndex,
    onToggleSelect,
    onOpen,
    onFocus: handleFocus,
    onKeyDown: handleKeyDown,
  };

  const handleItemsRendered = useCallback(
    ({ overscanRowStopIndex }: GridOnItemsRenderedProps) => {
      if (
        hasMore &&
        overscanRowStopIndex >= Math.ceil(assets.length / columns) - 4 //when the user is within a few rows of the end, load more
      ) {
        onLoadMore();
      }
    },
    [assets.length, columns, hasMore, onLoadMore],
  ); //virtualized rendering optimization hook.

  return (
    <div className="grid-shell">
      <div className="grid-toolbar">
        <span>{assets.length} loaded</span>
        <button type="button" onClick={onSelectAll}>
          Select all loaded
        </button>
      </div>
      <div ref={viewportRef} className="grid-viewport" onBlur={handleBlur}>
        {viewport.width > 0 && viewport.height > 0 && (
          <FixedSizeGrid
            ref={gridRef}
            width={viewport.width}
            height={viewport.height}
            columnCount={columns}
            columnWidth={viewport.width / columns}
            rowCount={Math.ceil(assets.length / columns)}
            rowHeight={ROW_HEIGHT}
            itemData={gridData}
            itemKey={({ columnIndex, rowIndex, data }) => {
              const asset = data.assets[rowIndex * data.columns + columnIndex];
              return asset?.id ?? `${rowIndex}-${columnIndex}`;
            }}
            overscanRowCount={2}
            onItemsRendered={handleItemsRendered}
            outerElementType={GridOuter}
          >
            {GridCell}
          </FixedSizeGrid>
        )}
      </div>
    </div>
  );
});
