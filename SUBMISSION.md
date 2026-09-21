# Submission

Keep this tight. Bullet points are fine. We read this before we read your code,
and a clear account of your reasoning carries real weight — including where you
chose not to do something.

## Diployed Links

[Front-End](https://mediavault-zeta.vercel.app/)
[Back-end](https://mediavault-8ue6.onrender.com)


## Video walkthrough

Paste your Loom (or equivalent) link here. 5–10 minutes.

**Link:**

[Loom URL](https://www.loom.com/share/3d3c2ad44cf0433c8391a8834dc3cd6f)


## How to run it

Anything we need to know beyond `npm install && npm run dev`.

## Time spent

Approximately 10–12 hours, mostly on Sunday, including preparing the submission.


---

## Baseline defects found

| #   | Defect                                                                     | Where                                    | Fixed / left / out of scope                                               |
| --- | -------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Bulk update sends >50 ids in one call                                      | `src/pages/hooks/useBulkAssetStatus.ts`  | fixed                                                                     |
| 2   | Search requests race and are not cancelled or debounced                    | `src/features/assets/hooks/useAssets.ts` | fixed in source;tested                                     |
| 3   | Identical list requests are not deduplicated                               | `src/api/client.ts`                      | fixed in source; concurrency test not run                                 |
| 4   | Query state and filters are not in the URL                                 | `src/pages/AssetsPage.tsx`               | fixed for q/status/kind/tag/sort; Back/Forward test in my browser only         |
| 5   | Cursor pagination and infinite scrolling are absent                        | `useAssets.ts`, `AssetGrid.tsx`          | fixed in source;                               |
| 6   | Bulk select  option   missing                           |    `AssetGrid.tsx`                 | `useAssets.ts`, `AssetGrid.tsx`          | fixed in 
| 7   | Loading, empty, and error states overlap                                   | `AssetContent.tsx`                       | fixed in source                                                           |                       |                   |                         |
| 8  | Missing thumbnails show broken images and are not lazy                     | `AssetGrid.tsx`, `AssetDetail.tsx`       | grid fixed; detail image fallback remains a gap                           |
| 9  | Grid keyboard navigation/shift selection and panel focus management are absent             | `AssetGrid.tsx`, `AssetDetail.tsx`,`AssetPage.tsx`       | implemented in source;          |
| 10  | Successful detail edits do not reconcile the list                          | `AssetsPage.tsx`                         | fixed in source                                                           |
| 11  | Responsiveness needs improvement.                         | `AssetGrid.tsx`                         | partialy fixed in source  
| 12  | Labels are missing.                       | `Style.css`,`AssetGrid.tsx`                         |  fixed in source  
| 13  | Toggling one card also re-renders other cards.                         | `AssetGrid.tsx`                         | partialy fixed in source  



---

## Pending / not yet verified

- Browser-level keyboard pass still pending for full grid navigation, focus return, and screen-reader flow.
- Concurrency tests are still pending for retries, aborts, and stale request handling.
- Production performance measurements (DOM count, memory, long tasks, and scroll smoothness) were not captured in-browser.
- Responsive/mobile layout issues remain unverified; narrow-window behavior and panel stacking were not fully checked.
- The sort state is now consistent with the URL and API request, but the exact ordering behavior still depends on the backend response and should be verified in-browser.

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

Bulk updates are split into batches of up to 50 IDs, with three requests running at a time. Successful updates keep the data returned by the server, while failed items return to their previous state. Items that can be retried remain selected. Legal-hold failures are not retried automatically because the server blocks those changes.


**Retry and backoff policy**

When the API returns `429`, the client treats it as temporary rate limiting, waits for the server's `Retry-After` delay, and retries within the attempt limit. If the service remains busy, the user sees a clear message asking them to try again shortly instead of the raw technical error.

**State placement and URL sync**

Search, status, kind, tag, and sort are URL state using replace-state; popstate restores the view. Selection, focus, and the open detail ID remain UI state.

---

## Performance

Fill in real measurements, not estimates. Say which machine and browser.

| Metric                                          | Before                 | After        | How measured                                                                      |
| ----------------------------------------------- | ---------------------- | ------------ | --------------------------------------------------------------------------------- |
| Rendered DOM nodes at 5,000 rows loaded         | not measured           | not measured  | Profiled with 3,000 assets, but DOM nodes were not counted. The 5,000-asset check is pending. |
| Cards re-rendered when toggling one selection   | not measured           | 1 card observed | `Card` is memoized;Tested with React DevTools Profiler.                                     |
| Longest task during sustained scroll            | not measured           | not measured | No performance trace captured                                                     |
| Requests fired while typing a 6-character query | not measured           | not measured | A 300 ms debounce is implemented; request count has not been recorded.                        |
| Production bundle, gzipped                      | not freshly reproduced | 56.45 kB JS  | `npm run build`, current Vite output; includes `react-window`                     |

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

No automated test script exists.Responsiveness partialy fixed not checked throughly.Image handling in detail page.



## Critique of the API

The API would be easier to use if bulk requests supported idempotency keys, so retries could not apply the same update twice. Pagination cursors are tied to the current query, so the client must discard them whenever a filter or sort changes. Bulk responses can also contain both successes and failures, which means the client must process each asset separately.

## Anything you would like us to look at

Code you are proud of, or a decision you are unsure about and want to discuss.
