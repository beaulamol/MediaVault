import { useCallback, useEffect, useRef, useState } from "react";
import { listAssets } from "@/api/client";
import type { Asset, AssetQuery } from "@/lib/types";

interface State {
  items: Asset[];
  total: number;
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

/**
 * Baseline loader. Reviewers know this hook is wrong in several ways.
 * Replacing it wholesale is expected and encouraged.
 */
export function useAssets(query: AssetQuery) {
  const [state, setState] = useState<State>({
    items: [],
    total: 0,
    nextCursor: null,
    loading: true,
    loadingMore: false,
    error: null,
  });

  const queryKey = JSON.stringify({
    ...query,
    status: [...(query.status ?? [])].sort(),
  });
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const generation = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    generation.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setState((current) => ({
      ...current,
      items: [],
      total: 0,
      nextCursor: null,
      loading: true,
      loadingMore: false,
      error: null,
    }));
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [queryKey]);

  const loadNextPage = useCallback(() => {
    setState((current) => {
      if (current.loading || !current.nextCursor) return current;
      const controller = new AbortController();
      activeRequest.current = controller;
      const requestGeneration = generation.current;
      void listAssets(
        { ...debouncedQuery, cursor: current.nextCursor },
        controller.signal,
      )
        .then((page) => {
          if (requestGeneration !== generation.current) return; // stale req protection
          setState((latest) => ({
            ...latest,
            items: [
              ...latest.items,
              ...page.items.filter(
                (item) => !latest.items.some((old) => old.id === item.id),
              ),
            ], // protect duplication
            nextCursor: page.nextCursor,
            loading: false,
            loadingMore: false,
            error: null,
          }));
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (requestGeneration !== generation.current) return;
          setState((latest) => ({
            ...latest,
            loading: false,
            loadingMore: false,
            error: "Could not load more assets. Try again.",
          }));
        });
      return { ...current, loading: true, loadingMore: true };
    });
  }, [debouncedQuery]);

  //Main fetch effect for the initial load and query changes
  useEffect(() => {
    const controller = new AbortController();
    activeRequest.current = controller;
    const requestGeneration = ++generation.current;
    setState({
      items: [],
      total: 0,
      nextCursor: null,
      loading: true,
      loadingMore: false,
      error: null,
    });
    listAssets(debouncedQuery, controller.signal)
      .then((page) => {
        if (requestGeneration !== generation.current) return;
        setState({
          items: page.items,
          total: page.total,
          nextCursor: page.nextCursor,
          loading: false,
          loadingMore: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (requestGeneration !== generation.current) return;
        setState((s) => ({
          ...s,
          loading: false,
          loadingMore: false,
          error: err instanceof Error ? err.message : "Something went wrong",
        }));
      });
    return () => {
      controller.abort();
      if (activeRequest.current === controller) activeRequest.current = null;
    };
  }, [JSON.stringify(debouncedQuery)]);

  const updateItems = useCallback((updates: Map<string, Asset>) => {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => updates.get(item.id) ?? item),
    }));
  }, []);

  return { ...state, loadNextPage, updateItems };
}
