import { memo } from "react";
import type { AssetQuery } from "@/lib/types";

const SORTS: Array<{ value: NonNullable<AssetQuery["sort"]>; label: string }> = [
  { value: "updatedAt:desc", label: "Recently updated" },
  { value: "name:asc", label: "Name A–Z" },
  { value: "sizeBytes:desc", label: "Largest first" },
  { value: "createdAt:desc", label: "Newest" },
];

export interface HeaderProps {
  q: string;
  sort: NonNullable<AssetQuery["sort"]>;
  onQueryChange: (value: string) => void;
  onSortChange: (value: NonNullable<AssetQuery["sort"]>) => void;
}

export const Header = memo(function Header({
  q,
  sort,
  onQueryChange,
  onSortChange,
}: HeaderProps) {
  return (
    <header className="topbar">
      <h1>MediaVault</h1>
      <input
        className="search"
        type="search"
        placeholder="Search assets"
        value={q}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <select
        value={sort}
        onChange={(event) =>
          onSortChange(event.target.value as NonNullable<AssetQuery["sort"]>)
        }
      >
        {SORTS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </header>
  );
});
