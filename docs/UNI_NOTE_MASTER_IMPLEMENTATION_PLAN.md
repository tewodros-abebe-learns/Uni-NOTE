# Uni.Note Master Implementation Plan

> User-provided implementation brief, recorded on 2026-10-18. Formatting and HTML entities have been normalized; the roadmap is preserved below.
>
> **Execution status:** Stage 1 implemented and locally verified on 2026-10-18; Vercel deployment verification and user approval are pending. Stages 2–4 have not started. No stage is approved. See [Stage 1 report](stage-1/README.md).
>
> **Execution rule:** Work strictly in four separate stages. Do not begin the next stage until the current stage is fully tested, built, and explicitly approved by the user. The user subsequently authorized Stage 1 only. Later stages still require explicit approval.
>
> **Evidence rule:** Root-cause statements and target outcomes below are the supplied planning brief, not proof of runtime verification. Validate them against the repository and report actual test/build/deployment results without claiming unperformed checks. Work within the existing repository and session branch; do not recreate or delete the repository.

## Initial implementation prompt

> I am resetting Uni.Note to build a clean, production-grade product according to the Uni.Note Master Implementation Plan. We will execute strictly in 4 separate stages. Do not begin Stage 2 until Stage 1 is fully tested, built, and approved by me.
>
> **YOUR TASK NOW:** Implement ONLY **Stage 1: Clean Foundation, Clean Builds & Security Armor**.
>
> 1. Standardize the repository and `package-lock.json` so `npm ci` and `npm run build` pass with zero errors.
> 2. Fix Tailwind v4 `@theme inline` tokens in `src/index.css` so all themes render correctly.
> 3. Integrate DOMPurify sanitization in `renderContent` preserving YouTube embeds and LaTeX math.
> 4. Run tests and present the clean build logs for my review and approval before moving to Stage 2.

---

## 1. Executive Summary & Root Cause Diagnostic

A critical mistake in past attempts was patching individual symptom files without resolving foundational structural flaws. Uni.Note is an advanced dual-mode (rich visual renderer + raw markdown) academic note application. The reason content, images, videos, LaTeX, and formatting appeared to vanish across **switching sections, leaving notes/folders, page refresh, and logout/login** stems from three deep systemic failures that must be replaced from the ground up:

### Root Cause #1: Dual-State Split & Textarea Overwrites

When editing in "Structured Mode", text inputs only hold individual block slices. In the old codebase, save handlers, section switch handlers, and unmount listeners grabbed `textareaRef.current.value` assuming it contained the full section. This wiped out every preceding and following image, formula, video, and text block, truncating the note to a single line fragment.

### Root Cause #2: Quota Collapses & Silent Note Pruning

Images pasted into the browser were stored directly as 2–5MB Base64 strings inside `localStorage`. Since browser `localStorage` is strictly capped at ~5MB total, storing just two screenshots exceeded the quota. The legacy error handler in `demoData.ts` caught this error by silently deleting the entire media cache and permanently pruning 20% of user notes to free bytes, causing catastrophic data loss.

### Root Cause #3: Out-of-Sync Cloud/Local Race Conditions

On page refresh, Firebase's `onAuthStateChanged` fires asynchronously. If local state initialized from guest data before cloud sync finished, notes were overwritten with empty defaults or out-of-date timestamps. Additionally, without atomic transaction queuing, rapid edits triggered overlapping Firestore writes that dropped edits.

---

## 2. Foundational Target Architecture

| Component | Legacy Failing Design | Target Architecture (To Implement) |
| :--- | :--- | :--- |
| **Media Storage** | Base64 strings dumped directly into 5MB localStorage; silent pruning on quota limit. | **IndexedDB Blob Vault (`uninote_media_db`)** + Firebase Storage cloud buckets. Lightweight `media_*` references stored in Markdown. |
| **Editor Content Authority** | Dual DOM textarea pointers with race conditions on section switches. | **Pure Buffer Authority (`pendingContentRef`)** using a pure parser (`sectionContent.ts`). DOM textareas only project slices; the buffer is always whole. |
| **Cloud & Offline Sync** | Unsynchronized fire-and-forget Firestore updates; local caches overwriting cloud. | **Serialized write queues (`enqueueNoteWrite`)** with strict timestamp-based merging. Cloud strictly supersedes stale local state, never silently deleting. |
| **Security & Rendering** | Raw `marked.parse()` injected via `dangerouslySetInnerHTML` without sanitization. | **Strict DOMPurify whitelist** preserving YouTube iframes, KaTeX math blocks, and alignment markers while neutralizing XSS payloads. |
| **Styling Foundation** | Tailwind v4 without theme token declarations, causing UI buttons and colors to disappear. | **Explicit `@theme inline` block** mapping `--color-accent`, `--color-bg`, and tokens to live CSS custom properties across all 5 themes. |

---

## 3. Four-Stage Phased Implementation Roadmap

To guarantee zero regression and ensure each component is thoroughly tested before moving forward, execute the build across **four distinct stages**. The user will inspect and approve each stage before the next begins.

## Stage 1: Clean Foundation, Clean Builds & Security Armor

**Goal:** Error-free baseline, clean CI/CD, XSS neutralized.

- **Clean Repo & Lockfile Standardization:** Initialize fresh repository with aligned `package.json` and `package-lock.json`. Ensure `npm ci`, `npm run build`, and `npm run lint` execute with zero errors on Node 20/22.
- **Vercel Project Configuration:** Verify `vercel.json`, build command (`vite build`), and root directory. Confirm Vercel deployments produce clean green checks without caching stale dependencies.
- **Tailwind v4 Theme System:** Inject the required `@theme inline` declaration in `src/index.css` so that all color tokens (`bg-accent`, `text-accent`, `border-accent`, `bg-bg`, `bg-surface`) resolve dynamically across Midnight, Sunset, Forest, Royal, and Paper themes.
- **Input Sanitization & XSS Neutralization:** Integrate `dompurify` into the markdown renderer. Configure strict attribute hooks allowing YouTube nocookie embeds and layout markers while stripping malicious scripts, base-uri injection, and form action hijacking.
- **Cycle Detection for Nested Folders:** Implement parent-child cycle guard in folder navigation to permanently prevent infinite loops when nesting or moving folders.

### Stage 1 Approval Gate

- [x] `npm ci` and `npm run build` pass with 0 warnings/errors locally on Node 20 and 22 (Node 20 uses a clean source snapshot; see verification logs).
- [ ] All 5 color themes render properly with crisp contrast and no blank white boxes.
- [x] XSS audit script passes for all 29 defined attack cases; this is not a claim of exhaustive security coverage.
- [ ] Vercel deploys a live preview link successfully.
- [x] User explicitly approved continuing to Stage 2 ("Continue to stage 2"). Vercel verification remains outstanding.

## Stage 2: Ironclad Note & Media Persistence Engine

**Goal:** Zero content loss across all 4 critical actions.

- **Unified Content Buffer (`pendingContentRef`):** Re-architect `NoteEditor` so all edits, keystrokes, and mode switches write directly to an authoritative in-memory buffer. Eliminates the legacy bug where the editor read partial text from focused input slices.
- **Pure Parser Extraction (`sectionContent.ts`):** Separate segment parsing, marker modification (`@@left:small`, `@@center:large`), and serialization from the React component tree into a pure tested module.
- **IndexedDB Media Vault (`uninote_media_db`):** Relocate all pasted images and large screenshots out of localStorage into IndexedDB. Notes only keep lightweight `media_*` tokens in text, keeping the note payload tiny (<50KB).
- **Comprehensive Flush Triggers:** Wire `flushPendingContent()` into all lifecycle events: section clicks, folder switches, route changes, browser `popstate` (back/forward buttons), page reload (`beforeunload`), and modal transitions.
- **Non-Destructive Local Storage Fallback:** Eradicate the legacy pruning code in `demoData.ts`. If local quota is ever reached, raise a clean non-destructive warning toast rather than silently deleting the user's notes or media caches.

### Stage 2 Approval Gate

- [x] Create a note with Markdown, LaTeX math ($E=mc^2$), an image, and a YouTube video.
- [x] **Test 1:** Switch between 3 different sections → all formatting and media remain intact.
- [x] **Test 2:** Navigate back to Root Folder, open another note, and return → 100% intact.
- [x] **Test 3:** Hard-refresh browser (Ctrl+F5) → image, video, and LaTeX render instantly.
- [x] All automated local content integrity assertions pass; see `docs/stage-2/REPORT.md` for tested scope and limitations.
- [x] User explicitly approved continuing to Stage 3 ("Continue to stage 3").

## Stage 3: Cloud Sync, Auth Flow & Media Migration

**Goal:** Seamless cross-device sync & Google Auth.

- **Atomic Serialized Writes (`enqueueNoteWrite`):** Implement per-note write queues in `firebase.ts` to serialize Firestore syncs, preventing out-of-order document collisions when typing quickly.
- **Auth Observer Refresh Guard:** Guard `onAuthStateChanged` with `lastUserUidRef` and active note pointers so background token refreshes never kick the user back to the homepage or reset the open note.
- **Cloud Media Bucket Promotion:** Hook `uploadImageFile` into Firebase Storage so local IndexedDB blobs are uploaded to permanent user storage URLs (`users/{uid}/images/...`) on save, making notes shareable and permanent across devices.
- **Safe Account Merge & Guest Migration:** Ensure guest notes are migrated seamlessly when logging into Google for the first time without overwriting existing cloud notes or resurrecting deleted demo items.
- **Authorized Domain Diagnostic:** Add pre-flight checks for Firebase authorized domains with direct dashboard links, giving clear error messages if deployed on an unregistered Vercel preview domain.

### Stage 3 Approval Gate

- [ ] Sign in with Google Account → authenticate smoothly without domain errors.
- [ ] Add media to a note, log out to Guest Mode → verify guest mode isolation.
- [ ] Log back into the Google Account → note, image, alignment, and video persist accurately.
- [ ] Open the note on a second device/browser → note and media load from cloud correctly.
- [x] User authorized Stage 4 implementation ("Continue to stage 4"). Outstanding live Firebase acceptance checks above remain unverified.

## Stage 4: Complete Feature Suite, Polish & PWA Finalization

**Goal:** Flawless academic experience, export & install.

- **Multi-Note JSON Import & Full Export:** Fix the legacy import bug where only the first note in a JSON array was imported. Implement recursive note & folder import with timestamp preservation and multi-format export (Markdown, JSON, HTML).
- **Media Gear Adjustment Controls:** Ensure every image and YouTube embed has an intuitive floating gear popup to toggle Alignment (Left / Center / Right) and Size (Small / Medium / Large / Full) that writes `@@align:size` directly to text.
- **Live LaTeX Math Preview (KaTeX):** Ensure inline (`$x$`) and block (`$$...$$`) math formulas render reliably in preview and reading modes without KaTeX script race conditions.
- **PWA Installation & Service Worker:** Configure `vite-plugin-pwa` with offline cache, Web App Manifest icons, and an "Install Uni.Note" action button inside the user profile drawer.
- **Keyboard Shortcuts & Productivity Polish:** Add shortcuts for Save (Ctrl+S), Bold (Ctrl+B), Italic (Ctrl+I), LaTeX Block (Ctrl+M), Section Switching (Alt+Up/Down), and full-text search highlighting.

### Stage 4 Approval Gate — Final Product Acceptance

- [x] Import a multi-note JSON backup → all notes/folders import, and nested folder navigation works in production Chromium.
- [x] Image/video gears update alignment and Small/Medium/Large/Full size in production Chromium without reloading the video node.
- [ ] Test PWA install banner in browser → installs seamlessly as desktop/mobile standalone app.
- [ ] Perform complete end-to-end stress test across all 4 stages → zero console warnings or bugs.
- [ ] User explicitly approves final product acceptance.

---

## Stage Tracking

| Stage | Implementation | Verification | User approval |
| :--- | :--- | :--- | :--- |
| 1 — Foundation & security | Implemented locally | Original 49-test evidence retained; browser regression passes; Vercel pending | Approved to continue to Stage 2 |
| 2 — Persistence | Implemented locally | Node 20/22: clean install, lint, 73 tests, build, audit pass; production Chromium integrity checks pass | Approved to continue to Stage 3 |
| 3 — Cloud & authentication | Implemented locally | Node 20/22: clean install, lint, 93 tests, build, audit pass; production regressions and auth-adapter browser checks pass; live Firebase acceptance pending | Authorized to continue implementation to Stage 4; live acceptance still pending |
| 4 — Features & PWA | Implemented locally | Node 20/22: install, lint, 108 tests, build and audit pass; production import/export, media, search, shortcuts and offline SW checks pass; native install/live end-to-end pending | Final acceptance pending |

For each stage, record changed files, commands and environment versions, test/build logs, manual checks, deployment evidence, outstanding blockers, and the user's explicit approval before advancing.
