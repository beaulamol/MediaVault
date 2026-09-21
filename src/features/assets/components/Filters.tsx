import { memo } from "react";
import { statusLabel } from "@/lib/format";
import type { AssetKind, AssetStatus } from "@/lib/types";

const STATUSES: AssetStatus[] = ["draft", "in_review", "approved", "archived"];
const KINDS: AssetKind[] = ["image", "video", "document"];

export interface FiltersProps {
  status: AssetStatus[];
  kind: AssetKind[];
  tag: string;
  onStatusChange: (value: AssetStatus, checked: boolean) => void;
  onKindChange: (value: AssetKind, checked: boolean) => void;
  onTagChange: (value: string) => void;
}

export const Filters = memo(function Filters({
  status,
  kind,
  tag,
  onStatusChange,
  onKindChange,
  onTagChange,
}: FiltersProps) {
  return (
    <>
      {STATUSES.map((value) => (
        <label key={value}>
          <input
            type="checkbox"
            checked={status.includes(value)}
            onChange={(event) => onStatusChange(value, event.target.checked)}
          />
          {statusLabel(value)}
        </label>
      ))}
      {KINDS.map((value) => (
        <label key={value}>
          <input
            type="checkbox"
            checked={kind.includes(value)}
            onChange={(event) => onKindChange(value, event.target.checked)}
          />
          {value}
        </label>
      ))}
      <label className="tag-filter">
        Tags{" "}
        <input
          value={tag}
          onChange={(event) => onTagChange(event.target.value)}
          placeholder="hero, campaign"
        />
      </label>
    </>
  );
});
