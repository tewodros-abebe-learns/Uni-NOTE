# Stage 1 — Implementation & Verification Report

Date: 2026-10-18

Status: **Implemented and locally verified; Vercel deployment verification and user approval pending. Stage 2 has not started.**

## Results

| Check | Node 20.20.2 / npm 10.9.8 | Node 22.22.3 / npm 10.9.8 |
| --- | --- | --- |
| `npm ci` | PASS, no warning/error diagnostics | PASS, no warning/error diagnostics |
| `npm run lint` | PASS | PASS |
| `npm test` | 49 passed, 0 failed | 49 passed, 0 failed |
| `npm run build` | PASS, no warnings/errors | PASS, no warnings/errors |
| `npm audit --audit-level=low` | 0 reported vulnerabilities | 0 reported vulnerabilities |

Node 20 was verified in a separate clean source snapshot, excluding `.git`, `node_modules`, and build output. Node 22 was verified after a clean `npm ci` in the working repository. These are local verification results, not claims that a remote CI run or deployment has occurred.

### Full final command logs

- [Node 22 clean installation, typecheck, tests, build, dependency audit](node22-verification.txt)
- [Node 20 clean-source installation, typecheck, tests, build, dependency audit](node20-verification.txt)
- [Production-browser smoke check](browser-verification.txt)

The production-browser check ran against the built application served by Express, using Chromium 153.0.8010.0. It verified:

- Guest application startup.
- Compiled Tailwind background, surface, text, accent, border, and accent-foreground utilities across all five themes.
- All five theme choices through the actual account-drawer UI, including persisted preferences.
- Opening a demo note with rendered KaTeX, a permitted YouTube iframe, and media gear controls.
- A hostile note fixture does not execute its image-event/script payloads, while image layout survives.
- Zero uncaught browser errors in the isolated smoke-check context.

**Browser test boundaries:** external requests were deliberately isolated. Matching installed KaTeX scripts/CSS were supplied to the CDN requests; fonts, authentication, cloud calls, and YouTube playback were not exercised. The hostile fixture existed only in a disposable browser profile. No live user account or cloud data was mutated. This is not a cross-device/authentication test or a full end-to-end persistence audit.

## Implementation

### 1. Repository, dependencies, builds, and CI

- Standardized on npm: repaired `package-lock.json` and removed the competing `bun.lock`.
- Named the package `uni-note`; declared Node 20.19+/22.12+ and npm 10/11 support, with `.nvmrc` selecting Node 22.22.3.
- Added `.npmrc` engine enforcement so incompatible dependencies fail installation rather than being ignored.
- Removed the redundant/deprecated DOMPurify types stub and unused Gemini/marked-KaTeX integration packages. Moved build tools/types to development dependencies.
- Updated locked dependencies to resolve reported advisories. Added targeted overrides for patched `@grpc/grpc-js` and Workbox's `glob`; installation, tests, and PWA generation pass on both supported Node lines. Live Firebase operations remain outside this stage's test scope.
- Pinned KaTeX to patched `0.18.2` and matched the existing CDN URLs to that version. Newer evaluated releases pulled in a CLI dependency requiring Node 22; this selection preserves the required Node 20 support without engine/deprecation warnings. KaTeX's browser delivery architecture remains unchanged for Stage 4.
- Removed the unused build-time Gemini API-key injection, which could expose a server secret if referenced by browser code later.
- Split framework, motion, and Firebase SDK modules into dependency-aligned chunks. The largest resulting JS chunk is approximately 466 KB; no bundle-warning threshold was raised or warning silenced.
- Added `.github/workflows/ci.yml`: npm install/typecheck/test/build/audit matrix for Node 20 and 22. **The remote GitHub workflow has not been run in this session.**

### 2. Tailwind v4 and theme consistency

- Added `@theme inline` mappings for `bg`, `main`, `surface`, `hover`, `text`, `muted`, `dim`, `subtle`, `accent`, `accent-blue`, `on-accent`, and the application font.
- Added one typed theme registry for **Midnight, Sunset, Forest, Royal, Paper**, shared by both theme pickers.
- Normalize existing preferences: Obsidian → Royal, Sepia → Sunset, Nord → Forest, Alabaster → Paper; Midnight is retained. Invalid values fall back to Midnight.
- Replaced hardcoded dark application panels with theme-aware surfaces, and application white foreground utilities with live text tokens.
- Added theme-specific accent-button foregrounds; synchronized the editor theme choice back to the application theme state.
- Palette tests verify primary text contrast of at least 7:1 on main/surface colors and accent-button contrast of at least 4.5:1. This is not a claim that every low-emphasis/opacity utility in the existing UI has passed a complete accessibility audit.

### 3. Markdown rendering and security

- Extracted the existing renderer to `src/lib/renderContent.ts` so the actual production rendering path can be tested independently. This is **not** the Stage 2 content parser or editor-buffer redesign.
- Sanitize the complete rendered HTML with DOMPurify after Markdown and all placeholder reinsertion, including the renderer's fallback path.
- Use explicit tag/attribute allowlists; block scripts, forms, base elements, objects, embeds, redirects, event handlers, `srcdoc`, DOM-clobbering names/IDs, and arbitrary CSS.
- Allow iframe sources only at the exact HTTPS `www.youtube-nocookie.com/embed/<11-character ID>` endpoint, optionally with a numeric start time. Add constrained sandbox, referrer, loading, and media policies.
- Retain media gear SVGs, validated alignment/size metadata, safe image links/references, Markdown tables/formatting, and the editor's narrowly validated highlight-color style.
- Escape interpolated image/video attributes before constructing HTML.
- Preserve LaTeX text by escaping it before HTML insertion and using replacement callbacks. This also fixes the preexisting `String.replace` bug where `$$` in replacement strings collapsed to `$`.
- Moved the shared YouTube helper out of `App.tsx` to remove the renderer/media-cache circular import.

The regression suite includes **29 hostile payload cases**, all passing, plus allowed-content and LaTeX preservation checks. Passing these cases is evidence for the tested policy, **not a guarantee against every possible XSS attack**.

### 4. Folder-cycle armor

- Added pure, tested graph helpers for move validation, ancestor navigation, and descendant collection.
- Reject self/descendant destinations, missing parents, and already-cyclic destination chains in the UI move handler and Firebase helper.
- Filter unsafe destinations from the move picker.
- Use visited-node guards in breadcrumbs, navigation, recursive tree rendering, and deletion traversals, including existing corrupted data.
- These changes do not redesign folder synchronization or update descendant level metadata after moves.

## Vercel configuration — external verification pending

Added `vercel.json` with:

- Framework: Vite.
- Install: `npm ci`.
- Build: `npm run build` (runs `vite build`).
- Output: `dist`.
- SPA fallback excluding API, uploads, and asset namespaces.
- Response security headers and a non-stale service-worker cache policy.

Use the **repository root** as the Vercel project's Root Directory and Node **22.x**. For the first verification deployment, redeploy without the existing build cache.

**No Vercel deployment was performed or verified.** This environment's outbound access does not include Vercel, and no linked Vercel project/deployment result was available to verify. A Vercel preview URL and green deployment checks therefore remain an outstanding Stage 1 gate. A local Arena live preview is available, but it is not a Vercel deployment.

**Hosting limitation:** this Vercel configuration deploys the Vite frontend. It does not turn `server.ts` into a serverless upload service or provide durable server filesystem storage. `/api/upload-image` is an Express-hosted capability; on a static deployment, the existing Firebase/local fallback remains necessary. Do not treat local `/uploads/...` URLs as cross-host cloud media. That storage/sync architecture is reserved for later stages.

## Reproduction

```sh
npm ci
npm run lint
npm test
npm run build
npm audit --audit-level=low
```

Run only the renderer/security regression suite:

```sh
npm run test:xss
```

For the production-browser smoke check, install Chromium separately (Playwright Core intentionally does not download browser binaries), then use two terminals:

```sh
# Terminal 1
NODE_ENV=production npm start

# Terminal 2: set this to your actual Chromium executable
BROWSER_EXECUTABLE_PATH=/path/to/chromium npm run test:browser
```

`APP_ORIGIN` optionally overrides the default `http://localhost:3000` for the test runner. `BROWSER_SCREENSHOT_DIR` optionally records local theme screenshots. The sandbox verification used an externally installed Chromium binary and its shared-library path; no browser binaries or generated build outputs are committed.

## Approval gate and remaining scope

- [x] Clean local npm installs/builds with no warning/error diagnostics on Node 20 and 22.
- [x] Automated theme palette/contrast checks and actual-browser utility/UI checks for all five themes.
- [x] All 29 defined XSS payload cases neutralized; allowed media/math regression checks pass.
- [ ] User visual review of all five themes and overall Stage 1 acceptance.
- [ ] Actual Vercel preview deployment and green deployment checks.
- [ ] Explicit user authorization to proceed to Stage 2 after Stage 1 approval.

**Not implemented in this stage:** authoritative editor buffer, IndexedDB media migration, quota/pruning redesign, cloud write queues, account/guest isolation redesign, multi-note import, or PWA/keyboard feature completion. Existing account-isolation, upload authorization, Firebase Storage ownership rules, and persistence concerns identified in the initial review remain unresolved; Stage 1 is not a declaration that the entire application is production-safe for sensitive data.
