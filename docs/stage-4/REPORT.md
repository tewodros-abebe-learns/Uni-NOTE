# Stage 4 — Features, Productivity & PWA Finalization

Date: 2026-10-18

Status: **Implemented and locally verified. Final live/deployment/native-install acceptance remains pending.**

The user explicitly authorized Stage 4 after disclosure of Stage 3's live-verification limits. That authorization is recorded as permission to continue implementation, not evidence that real Firebase checks passed. Stage 1–3 work was preserved on `arena/c420a555-uni-note`. No production rules were deployed, no live account data was mutated, and no commit or push was performed.

## Actual verification

| Check | Node 20.20.2 / npm 10.9.8 | Node 22.22.3 / npm 10.9.8 |
| --- | --- | --- |
| Clean `npm ci` | PASS | PASS |
| `npm run lint` | PASS | PASS |
| `npm test` | **108 passed, 0 failed** | **108 passed, 0 failed** |
| `npm run build` | PASS, no warning/error diagnostics | PASS, no warning/error diagnostics |
| `npm audit --audit-level=low` | 0 reported vulnerabilities | 0 reported vulnerabilities |

Node 20 ran in a fresh source snapshot excluding `.git`, dependencies and build output. Node 22 ran after a clean installation in the working repository. Both produced the same application bundle names. Final main chunk: **348.25 kB / 100.94 kB gzip**; bundled math chunk: **263.35 kB / 78.61 kB gzip**. PWA precache: **81 entries, 2842.40 KiB**, including math fonts and PNG icons. `git diff --check` passes.

Full, actual command logs:
- [Node 20 installation, lint, tests, build and audit](node20-verification.txt)
- [Node 22 installation, lint, tests, build and audit](node22-verification.txt)
- [All four browser suites](browser-verification.txt)

These are local checks, not verified remote CI or Vercel deployment results.

## Implemented features

### Complete import and portable export

- JSON note arrays import **every note**, rather than only the first record.
- Supports single-note/legacy content/`sectionsArray` documents, versioned vault backups, flat folder collections, and nested `folders` or `children` trees with embedded notes.
- Validates the complete plan before note/folder writes; rejects cycles, duplicate identities, malformed sections/timestamps, unsupported versions and excessive collections/nesting.
- Remaps imported note/folder IDs without overwriting existing records; remaps parent and note-folder links. Original creation/update timestamps, including ISO and Firestore-style values, survive.
- Embedded archived images are durably restored to IndexedDB before note references are published. Missing source images retain their text references and produce a visible warning, not silent removal.
- Imports remain local until explicitly kept in an account; Stage 3 isolation and migration rules remain in force.
- **Account & Settings → Export all notes & folders** offers JSON, Markdown and HTML. Individual-note export offers all sections or the current section.
- JSON archives include the original local image bytes, deduplicated by reference, plus note/folder metadata. A single-note export includes only its folder ancestry, not unrelated account folder names.
- Markdown includes all selected sections and embeds local image data URLs. HTML contains sanitized content, portable native MathML, media-layout CSS, a restrictive CSP and no editing controls or scripts.
- Missing local image Blobs block a falsely complete export. Portable files are capped at 50 MB; oversized exports fail visibly and should be split by note/section. Imports accept at most 2,000 notes, 2,000 folders, 500 sections per note and 50 nested folder levels.

### Media controls

- Image and video gears offer Left/Center/Right alignment and **Small 35%, Medium 65%, Large 85%, Full 100%**.
- Parser, serializer, sanitizer, renderer, CSS, preview popup and structured controls share the Full marker contract.
- Both legacy hyphen and colon markers remain readable; changes emit `@@align:size@@`.
- Repeated image URLs are targeted independently by ordinal identity. Layout-only changes update the existing preview and preserve the video iframe node.
- Full has a distinct accessible label in structured controls. Responsive minimum widths can make sizes converge on narrow screens to keep media readable.

### Reliable math and search

- KaTeX and auto-render are imported from the pinned installed package. CSS and fonts are bundled locally and precached; external CDN/global-script timing is no longer required.
- Inline/display math and supported environments render synchronously with trusted commands disabled and bounded expansion. Invalid formulas remain readable without throwing application errors.
- Search highlighting updates even when source text is unchanged, clears old highlights safely, and does not rebuild math or video nodes. Queries are inserted as text, never HTML.
- Vault full-text results open the matching section and carry the query into the note view. The query is preserved separately from the dropdown state, so clearing the dropdown cannot erase initial highlights.
- The preview fast path no longer collapses meaningful Markdown whitespace when deciding whether source changed.

### Keyboard and UI polish

- Ctrl/Cmd+S flushes the local authoritative buffer and reports memory-only quota recovery honestly.
- Ctrl/Cmd+B and Ctrl/Cmd+I format selections; Ctrl/Cmd+M inserts block math; Ctrl/Cmd+F opens note search.
- Alt+Up/Down switches sections with a flush boundary.
- Formatting maps structured textarea slices into complete source positions. Selection restoration happens in a layout effect instead of a stale timer that could steal a later selection during rapid shortcuts.
- Dialog/input/composition guards avoid formatting unrelated form fields. Generic confirmation/prompt dialogs have accessible roles. Clipboard denial is reported instead of creating an uncaught promise rejection.

### Installation, offline use and safe updates

- Manifest declares a stable ID, root start URL/scope, standalone display, 192/512 PNG icons and a dedicated maskable PNG icon generated from the existing project SVG.
- **Install Uni.Note** in the account drawer consumes the browser install event when offered. Unsupported contexts receive browser-menu / Safari Add to Home Screen instructions; installed standalone contexts are detected.
- Real Workbox precaching covers application scripts, CSS, local math fonts and icons. Existing IndexedDB note images remain available offline.
- Service-worker updates are **offered**, not forced over an active editor. Applying an update first flushes content and refuses while image writes or memory-only failed local writes remain pending.
- Vite module-preload hints are disabled to avoid duplicate preload/cache responses and Chromium's cross-world service-worker resource-mismatch warning. ES-module loading and precaching remain intact.

## Browser evidence

Chromium **153.0.8010.0**, Node **22.22.3**:

1. Existing Stage 1 production theme/security smoke checks pass.
2. Existing Stage 2 production integrity checks pass, including >6 MB of native IndexedDB Blobs, exact section/navigation/reload integrity, delayed image completion, quota retry and legacy migration.
3. Existing Stage 3 **substituted Firebase-adapter** checks pass for same-account refresh stability, logout/second-account isolation, delayed prior-account responses, signed-in cache reload and domain diagnostics. These are not live Firebase checks.
4. New Stage 4 checks run against the actual production build, with real service workers and IndexedDB:
   - Note-array and recursive-folder imports retain all four fixture notes, timestamps and remapped relationships. Nested Root → Nested Child → Nested Two navigation works through the UI.
   - Image/video controls exercise all four sizes and alignment; duplicate source URLs remain independent; the video iframe node is not recreated.
   - Raw Ctrl+S/B/I/M and Alt+Up/Down preserve complete source and neighboring media/sections. Structured Ctrl+B maps its slice selection correctly.
   - Search changes and clearing update visible highlights without rebuilding media. Vault search finds a third-section match and opens section index 2.
   - Actual JSON/Markdown/HTML downloads contain all selected notes/sections; JSON carries image bytes; HTML contains script-free MathML.
   - Chromium reports **no manifest errors and no installability errors**. A synthetic install event verifies the drawer event flow; this is not native installation proof.
   - A **real service-worker-controlled offline reload** restores exact text, rendered math and loaded IndexedDB image Blobs.
   - A **fresh browser instance/profile** imports the portable JSON archive, reconstructs all notes/folders/images, and supports full-text search/highlighting.
   - The note fits a **390 × 844** viewport without document horizontal overflow.
   - **Zero uncaught page errors and zero console warnings/errors in the isolated Stage 4 checks.**

The Stage 4 fixtures fulfill Firebase project-config, YouTube iframe and thumbnail requests locally. External playback, real OAuth and cloud writes are not asserted. Other unexpected external requests are blocked, not silently treated as live success. This defined suite passing is not a claim that every browser, feature permutation or network failure produces zero warnings.

## Fixes found during verification

- The first bundled build exceeded Vite's 500 kB warning threshold; KaTeX was separated into its own math chunk rather than hiding the warning by raising the limit.
- Browser testing found the vault-search dropdown cleared the query before the note received it; a separate selected-query state now preserves it.
- Rapid shortcut testing exposed delayed selection restoration racing a later selection; layout-effect restoration replaced that timer.
- Actual offline testing surfaced Chromium's module-preload/service-worker response mismatch warning; preload hints were removed instead of suppressing console output.
- Early browser-test selectors assumed capitalized accessible labels and attempted to close the drawer through its obscured opener. Tests now use actual case-insensitive size names and the visible Close panel button. Final suites pass without force-clicks or retry-based result masking.

## Outstanding acceptance — do not mark production complete yet

- [ ] Complete the [Stage 3 live checklist](../stage-3/REPORT.md): deploy/review Firebase rules, real Google sign-in, uploads, sign-out/sign-in preservation, two-account enforcement and loading on a separate device with no shared browser storage.
- [ ] Verify a real Vercel deployment and its exact Firebase-authorized hostname.
- [ ] Install from the browser UI on a real supported desktop and Android device; test Safari Add to Home Screen on iOS/iPadOS. Confirm standalone launch, icon cropping, offline reopen, uninstall/reinstall and upgrade behavior. Headless manifest eligibility and synthetic events do not certify this.
- [ ] Exercise a real old-version → new-version service-worker upgrade with active edits, pending images and storage failures; verify the update prompt never loses data. Unit tests cover the update state machine. The pending-write guard is implemented, but the complete release-upgrade boundary still needs live verification.
- [ ] Run the complete live cross-device acceptance flow with non-sensitive fixture notes, then review backups/conflicts before clearing site data.
- [ ] User explicitly approves final product acceptance.

## Boundaries and data cautions

- JSON backs up **local** Blobs. Remote image/video URLs remain external; exports do not fetch and archive arbitrary remote websites. External YouTube playback and cloud operations require connectivity.
- HTML uses the existing raster-data allowlist: PNG, JPEG, GIF and WebP. SVG/AVIF/other archived images cause an explicit HTML export refusal directing the user to JSON or Markdown, rather than silently omitting them.
- JSON is the structural restoration format. Markdown/HTML are document exports, not a promise of lossless folder-tree roundtrip. The import UI accepts Markdown/text/JSON, not HTML.
- Imported IDs are intentionally remapped to avoid collisions. Section IDs/source content and timestamps are retained; embedded application-specific links containing old note IDs are not automatically rewritten.
- Backups exceeding 50 MB must be split; very large individual sections/media collections may need to be reduced or separately preserved before a portable export can be generated.
- Files are validated before note/folder writes, but browsers do not provide a transaction spanning localStorage and IndexedDB. Failed storage writes use the existing in-tab recovery path; quota warnings still mean exporting/reviewing data before closing.
- Account caches/outboxes and the media vault are unencrypted browser-profile storage. Guest UI separation is not protection against local developer-tools access. Firebase download-token URLs remain bearer links.
- Client-clock skew, old clients outside this implementation, concurrent subtree creation during deletion, unavailable third-party services and previously deleted original image data remain limitations described in Stage 3.

## Principal Stage 4 files

`src/App.tsx`, `src/lib/{vaultBackup,htmlExport,math,searchHighlight,pwa}.ts`, parser/renderer/sanitizer Full support, `src/lib/localPersistence.ts`, offline preflight handling in `src/firebase.ts`, `src/main.tsx`, `src/index.css`, `index.html`, `vite.config.ts`, three PNG icon assets, `tests/stage4.test.ts`, `scripts/stage4-browser-check.mjs`, package scripts, README and master-plan tracking.

### Reproduce checks

```sh
npm ci
npm run lint
npm test
npm run build
npm audit --audit-level=low
# Production app: NODE_ENV=production npm start (port 3000)
BROWSER_EXECUTABLE_PATH=/path/to/chromium npm run test:browser
BROWSER_EXECUTABLE_PATH=/path/to/chromium npm run test:stage2:browser
BROWSER_EXECUTABLE_PATH=/path/to/chromium npm run test:stage4:browser
```

Stage 3 adapter checks additionally require a source server on port 3001:
```sh
DISABLE_HMR=true npm exec vite -- --host 0.0.0.0 --port 3001
# Separate shell:
BROWSER_EXECUTABLE_PATH=/path/to/chromium npm run test:stage3:browser
```

This sandbox's Chromium also required `LD_LIBRARY_PATH=/tmp/al2023/lib`; that temporary binary/library setup is not a portable project dependency. Capture logs outside the Vite-watched repository and copy them into the evidence folder after checks finish.
