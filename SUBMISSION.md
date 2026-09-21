# Submission

Keep this tight. Bullet points are fine. We read this before we read your code,
and a clear account of your reasoning carries real weight — including where you
chose not to do something.

## Video walkthrough

Paste your Loom (or equivalent) link here. 5–10 minutes.

**Link:**

[Loom URL](https://www.loom.com/share/70103a8ff31a4e5b86952de6c7782be5)

## How to run it

Anything we need to know beyond `npm install && npm run dev`.

## Time spent

Approximately 10–12 hours, mostly on Sunday, including preparing the submission.


---

## Baseline defects found

| #   | Defect                                                                     | Where                                    | Fixed / left / out of scope                                               |
| --- | -------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Bulk update sends >50 ids in one call                                      | `src/pages/hooks/useBulkAssetStatus.ts`  | fixed                                                                     |
| 2   | Search requests race and are not cancelled or debounced                    | `src/features/assets/hooks/useAssets.ts` | fixed in source; race test not run                                        |
| 3   | Identical list requests are not deduplicated                               | `src/api/client.ts`                      | fixed in source; concurrency test not run                                 |
| 4   | Query state and filters are not in the URL                                 | `src/pages/AssetsPage.tsx`               | fixed for q/status/kind/tag/sort; Back/Forward not browser-tested         |
| 5   | Cursor pagination and infinite scrolling are absent                        | `useAssets.ts`, `AssetGrid.tsx`          | fixed in source; browser scroll not run                                   |
| 6   | Every loaded card is rendered and selection re-renders the grid            | `AssetGrid.tsx`                          | fixed with `react-window` and memoized cards;                             |
| 7   | Loading, empty, and error states overlap                                   | `AssetContent.tsx`                       | fixed in source                                                           |
| 8   | Bulk results, partial failures, and rollback are ignored                   | `useBulkAssetStatus.ts`                  | fixed in source; chaos-on 207 run not completed                           |
| 9   | Retry, Retry-After, offline messaging, and structured errors are absent    | `client.ts`, `AssetsPage.tsx`            | fixed in source; network/offline run not completed                        |
| 10  | Detail loads can race; version conflicts are not handled                   | `AssetDetail.tsx`                        | fixed in source; conflict flow not run                                    |
| 11  | Missing thumbnails show broken images and are not lazy                     | `AssetGrid.tsx`, `AssetDetail.tsx`       | grid fixed; detail image fallback remains a gap                           |
| 12  | Grid keyboard navigation and panel focus management are absent             | `AssetGrid.tsx`, `AssetDetail.tsx`       | implemented in source; browser/screen-reader verification pending         |
| 13  | Successful detail edits do not reconcile the list                          | `AssetsPage.tsx`                         | fixed in source                                                           |
| 14  | Paginated load errors can surface after a newer query                      | `useAssets.ts`                           | fixed during audit with generation guard                                  |
| 15  | PATCH 500 retries ignored API retry safety                                 | `client.ts`                              | fixed during audit: only `write_failed` retries                           |
| 16  | Batch fetch could exceed the API's 25-ID cap                               | `client.ts`                              | fixed during audit by chunking at 25; no current caller                   |
| 17  | Default sort was being suppressed from URL/API and broke `updatedAt:desc`  | `AssetsPage.tsx`                         | fixed: the active sort is now always written to the URL and request state |
| 18  | Keyboard focus could show duplicate blue outlines from grid wrapper + card | `AssetGrid.tsx`, `src/styles.css`        | fixed by keeping the visible focus ring on the card only                  |

---

## Pending / not yet verified

- Browser-level keyboard pass still pending for full grid navigation, focus return, and screen-reader flow.
- Network/offline behavior is intentionally not treated as a product issue because this app runs against the local seeded Node API with no external network dependency.
- Concurrency tests are still pending for retries, aborts, and stale request handling.
- Production performance measurements (DOM count, memory, long tasks, and scroll smoothness) were not captured in-browser.
- Responsive/mobile layout issues remain unverified; narrow-window behavior and panel stacking were not fully checked.
- The sort state is now consistent with the URL and API request, but the exact ordering behavior still depends on the backend response and should be verified in-browser.
- Contrast and accessibility validation were not completed with a formal audit tool.

---

## Key decisions

For each significant choice: what you did, what you rejected, and why. Three to
six of these is about right.

**Data fetching and caching**

I keep a small map of running requests, using the normalised request URL as the key. If two parts of the app need the same data, they share one request. Each can stop waiting independently; the actual request is cancelled only when nobody needs it anymore. Loaded pages stay in memory for the current query. I haven’t added caching between different searches.

**Stale response handling**

Search input is debounced for 300 ms. Query changes clear visible results immediately, abort the previous request, and use a generation guard for responses that cannot be cancelled in time.

**Virtualization approach**

`AssetGrid` uses `react-window` `FixedSizeGrid`, fixed 230 px columns and 298 px rows, with two-row overscan. This keeps mounted cards proportional to the viewport rather than loaded results, while the loaded asset array still grows with pagination.

**Optimistic updates and rollback**

Bulk IDs are chunked at 50 and processed with three workers. Successful per-item results are reconciled, failed items are restored individually, and retryable failures remain selected. Legal-hold failures are not automatically retried.

**Retry and backoff policy**

The client retries at most three attempts for GET 503/429/network failures and PATCH `write_failed` 500 responses, with exponential jitter and `Retry-After` precedence. 400, 409, 422, other PATCH 500 codes, and cancellation are never retried. No data-fetching dependency was added; `react-window` is the only runtime addition.

**State placement and URL sync**

Search, status, kind, tag, and sort are URL state using replace-state; popstate restores the view. Selection, focus, and the open detail ID remain UI state.

---

## Performance

Fill in real measurements, not estimates. Say which machine and browser.

| Metric                                          | Before                 | After        | How measured                                                                      |
| ----------------------------------------------- | ---------------------- | ------------ | --------------------------------------------------------------------------------- |
| Rendered DOM nodes at 5,000 rows loaded         | not measured           | not measured | Browser measurement still required; implementation uses `FixedSizeGrid` windowing |
| Cards re-rendered when toggling one selection   | not measured           | not measured | `Card` is memoized; no Profiler run available                                     |
| Longest task during sustained scroll            | not measured           | not measured | No performance trace captured                                                     |
| Requests fired while typing a 6-character query | not measured           | not measured | 300 ms debounce implemented; no Network recording captured                        |
| Production bundle, gzipped                      | not freshly reproduced | 56.42 kB JS  | `npm run build`, current Vite output; includes `react-window`                     |

What was the actual bottleneck, and how did you find it?

The baseline's main structural bottlenecks were rendering every loaded card and coupling request state to one page component. The current implementation addresses those with `FixedSizeGrid`, memoized cards, stable callbacks, and extracted page boundaries. A browser profiler and memory trace are still required before making a numerical performance claim.

---

## Accessibility

- The grid uses a roving tabindex with arrow and Shift-arrow movement, Enter to open, and Space to select. The detail panel receives focus, Escape closes it, and close handling returns focus to the opener when it remains connected.
- Source-level checks cover roles, labels, handlers, and live regions. I did not complete a screen-reader run or an interactive browser accessibility recording.
- Known gaps: focus/caret behavior, mounted node counts, contrast, long tasks, memory, and live-region announcements still need a browser/accessibility pass.

---

## Interface decisions

I optimised for a quiet scanning surface that remains predictable while the network misbehaves. Fixed card geometry reserves thumbnail space and makes `react-window` virtualization straightforward, while status labels remain textual rather than color-only. The bulk bar keeps failed work selected so recovery is visible instead of silently losing the user's selection. Search/filter controls, content states, and bulk mutation logic are separated into focused page components and a hook without introducing Context.

- **Responsive status.** The layout is functionally resilient, but a full visual and interaction pass at narrow widths was not completed; responsive edge cases remain a known gap.
- **Sort behavior.** The UI state, URL, and request payload are aligned for the selected sort value, but the final ordering still depends on the API result set and should be browser-checked against real data.
- **Visual system.** CSS variables in `src/styles.css` define ink, muted text, borders, background, accent, and danger colors; spacing is applied consistently across the top bar, filters, grid, cards, and panel.
- **Status treatment.** Status pills retain text labels, with progressive neutral/warm/green treatment; selection also has a checkbox and border treatment, so color is not the only signal.
- **States.** Loading, empty, error, offline notice, partial bulk failure, and retryable selection are represented in the page flow. A browser visual pass is still needed.
- **Contrast.** Not measured with a contrast tool yet; do not claim WCAG AA until checked.
- **Copy.** Rate-limit and upstream failures are rewritten in `client.ts` into human-facing service messages rather than exposing raw implementation wording.

Screenshots in the repo are welcome — link them here.

---

## Trade-offs and cuts

No automated test script exists. The integrated browser interaction was not completed in this audit, so DOM, memory, long-task, Network-panel, contrast, and screen-reader measurements remain explicitly unmeasured. Live SSE reconciliation and offline write queueing were not implemented; with another day I would add focused concurrency/rollback tests and complete a real browser accessibility/performance pass.

See `ASSESSMENT_AUDIT.md` for the requirement-by-requirement status and evidence, and `VIDEO_PLAN.md` for a five-to-six-minute walkthrough plan.

## Critique of the API

The API would benefit from a single bulk endpoint with an explicit idempotency key and a cursor replay contract. Query-bound opaque cursors force the client to discard pagination on every query change, while mixed 207 plus per-item conflict codes make mutation reconciliation more involved than a typed operation result would be.

## Anything you would like us to look at

Code you are proud of, or a decision you are unsure about and want to discuss.
