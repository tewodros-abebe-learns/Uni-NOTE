# Stage 2 — Note & Media Persistence

Date: 2026-10-18

Status: **Implemented and locally verified. Awaiting your approval; Stage 3 has not started.**

## Verification results

| Check | Node 20.20.2 | Node 22.22.3 |
| --- | --- | --- |
| Clean `npm ci` (npm 10.9.8) | PASS | PASS |
| `npm run lint` | PASS | PASS |
| `npm test` | 73 passed, 0 failed | 73 passed, 0 failed |
| `npm run build` | PASS, no warning/error diagnostics | PASS, no warning/error diagnostics |
| `npm audit --audit-level=low` | 0 reported vulnerabilities | 0 reported vulnerabilities |

Node 20 ran in a separate clean source snapshot, excluding `.git`, dependencies and build output. Node 22 ran after a clean installation in the working repository. Both produced the same production bundle filenames. Final main application chunk: 333.43 kB (94.82 kB gzip).

**Actual full command logs:**
- [Node 20 verification](node20-verification.txt)
- [Node 22 verification](node22-verification.txt)
- [Production Chromium checks](browser-verification.txt)

## Implemented

- **Whole-content authority:** `pendingContentRef` and the section collection update synchronously. Structured textareas modify source spans rather than replacing the document with their slice. Save callbacks target a note ID; delayed own-save prop echoes cannot roll back newer edits.
- **Pure parser:** `src/lib/sectionContent.ts` owns segmentation, exact source spans, serialization, source-preserving edits/deletion, layout-marker updates and selection-aware insertion. Both legacy hyphen and colon markers are readable; updates emit colon markers. Fenced code remains literal. Nested and single-line LaTeX environments have regression coverage.
- **Durable media vault:** `uninote_media_db` stores image Blobs in IndexedDB. New note references are SHA-256-based `media_*` identifiers, returned only after transaction completion. Pasting and dropping images no longer embed large base64 strings in localStorage. Images above 25 MB or with invalid MIME types are rejected.
- **Hydration and compatibility:** reading and editing views resolve persisted references to vault-issued Blob URLs. Sanitization rejects forged Blob URLs. Legacy media-cache IDs remain valid, and inline base64 images migrate without rewriting surrounding Markdown. Migration sources are retained on failure and retired only after durable writes.
- **Flush boundaries:** edits flush on section/mode changes, note/folder navigation, browser history, modal transitions, pagehide, hidden visibility, beforeunload and unmount, in addition to debounced saving. Pending image writes display a status and request unload confirmation where the browser permits it.
- **Async insertion ownership:** an image finishing after navigation returns to its original note/section and merges with current content; it cannot overwrite the next note or resurrect a deleted destination.
- **Non-destructive failure handling:** removed quota-based note pruning/media clearing and unconditional startup deletion of the old Firestore cache. Failed note writes retain the complete latest value in memory, leave the old disk copy untouched, and expose a persistent warning with Retry saving. Intentional empty local note/folder arrays remain empty.

Principal Stage 2 files: `src/App.tsx`, `src/lib/sectionContent.ts`, `src/lib/localPersistence.ts`, `src/utils/mediaStore.ts`, `src/hooks/useMediaRevision.ts`, `src/demoData.ts`, local persistence integration in `src/firebase.ts`, `src/main.tsx`, renderer/sanitizer integration, three new unit-test modules, renderer assertions and `scripts/stage2-browser-check.mjs`. The existing uncommitted Stage 1 work was preserved.

## Browser acceptance evidence

Tests ran against the actual production build served locally, using Chromium 153.0.8010.0 / Node 22.22.3. The existing Stage 1 browser regression suite also passed.

1. Created a three-section fixture containing Markdown, inline and block LaTeX, an image and a YouTube embed.
2. Dispatched actual drag/drop and clipboard-paste events for PNG files exceeding 6 MB combined. Verified real IndexedDB Blob records while the serialized local note collection stayed below 50 KB.
3. Edited structured middle-text slices, switched among all three sections, and compared the complete saved source exactly. Tested structured toolbar selection mapping as well.
4. Navigated to root, opened another note, and returned: exact source and loaded images survived.
5. Disabled browser cache and reloaded immediately after an edit: latest source survived; Blob images loaded, YouTube iframe attributes persisted, and KaTeX rendered.
6. Browser back/forward flushed the departing note and restored the intended note.
7. Delayed an actual image hash until after navigating away and editing another note: insertion landed only in the original note/section, with the other edit unchanged.
8. Injected localStorage quota failure: old disk JSON stayed unchanged, full edits remained in memory, the persistent warning appeared, and Retry saving persisted the complete note after storage recovered.
9. Injected an IndexedDB image-write failure: no broken media reference was inserted and existing note content remained unchanged.
10. Seeded legacy cache and inline base64 images, started a fresh page, and reloaded again: both migrated images loaded from real IndexedDB on both startups.
11. Zero uncaught page errors in either browser suite.

Unit tests additionally cover failed migration source retention, large Blob durability/deduplication, storage retry without pruning ten notes, parser roundtrip/CRLF/source spans, nested math, stale-selection insertion, invalid uploads and minted-versus-forged Blob URL sanitization.

## Boundaries and remaining verification

- These are local results, **not a verified Vercel deployment or remote CI run**. Vercel remains unverified.
- Browser tests isolate external services, use a local KaTeX fixture and block service workers. They verify persisted YouTube embeds, not external video playback. No real authentication, cloud-data mutation, cross-device sync, offline/PWA acceptance, or mobile-browser certification was performed.
- The <50 KB result is measured for the media-heavy acceptance fixture; arbitrary long text or very large note collections can still exceed localStorage quota.
- If storage remains full, latest failed note writes survive only in the current tab's memory. Export a backup before closing/reloading; no implementation can make a rejected disk write durable. Failed image insertions must be retried after freeing storage.
- IndexedDB media is local to this browser/profile. Clearing browser site data can remove it; existing references whose original data was previously deleted cannot be reconstructed. Cloud promotion and cross-device media are explicitly Stage 3 work.
- Browser unload prompts depend on browser policy/user activation and are not protection against process termination or device failure.
- Cloud write queues, authentication refresh guards, safe account/guest merging and cloud media promotion remain deferred to Stage 3. Stage 2's local checks do not certify logout/login preservation.

**Approval gate:** review the report/logs and approve Stage 2 before any Stage 3 work begins.
