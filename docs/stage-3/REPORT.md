# Stage 3 — Cloud Sync, Auth Flow & Media Migration

Date: 2026-10-18

Status: **Implementation and local verification complete. Live Firebase acceptance and user approval pending. Stage 4 has not started.**

Stage 2 was approved by the instruction “Continue to stage 3”. Existing Stage 1–2 work was preserved on `arena/c420a555-uni-note`. No commits, pushes, production rule deployments, or live account-data mutations were performed.

## Actual verification

| Command | Node 20.20.2 / npm 10.9.8 | Node 22.22.3 / npm 10.9.8 |
| --- | --- | --- |
| Clean `npm ci` | PASS | PASS |
| `npm run lint` | PASS | PASS |
| `npm test` | **93 passed, 0 failed** | **93 passed, 0 failed** |
| `npm run build` | PASS, no warning/error diagnostics | PASS, no warning/error diagnostics |
| `npm audit --audit-level=low` | 0 reported vulnerabilities | 0 reported vulnerabilities |

Node 20 ran in a fresh source snapshot excluding `.git`, dependencies, and build output. Node 22 ran after a clean installation in the working repository. Final application chunk: 335.82 kB (96.49 kB gzip); Firestore chunk: 473.09 kB. `git diff --check` passes.

Full logs:
- [Node 20 clean installation, lint, tests, build and audit](node20-verification.txt)
- [Node 22 clean installation, lint, tests, build and audit](node22-verification.txt)
- [Production regressions and auth-adapter browser integration](browser-verification.txt)

These are local results, not remote CI or deployment evidence.

## Implemented changes

### 1. Serialized writes and recoverable cloud synchronization

- Per-account/per-document write lanes serialize note and folder mutations. UI timeouts do **not** release lanes while underlying operations can still commit.
- A persistent account-scoped outbox stages complete mutations before remote writes. Failed writes remain replayable on sign-in, browser reconnect, or **Retry cloud sync**.
- Firestore transactions compare versions before writing. Cloud versions win timestamp ties; newer cloud records and terminal deletion tombstones cannot be overwritten by stale queued edits.
- Late acknowledgements only clear the exact staged version they acknowledge. They cannot discard a newer pending edit or overwrite its cache.
- Rejected conflicting edits are retained in `uninote_conflicts_{uid}`. The warning offers **Download conflict backup**; no automatic conflict deletion occurs.
- Note/folder deletion uses tombstone documents. Recursive deletion stages every item in the known subtree before remote deletion starts, so interrupted writes can be retried. This is not a globally atomic lock against another device creating a new descendant concurrently.
- Existing cloud notes containing local media references are scheduled for repair from the original browser. Strictly newer cached versions of existing cloud notes are replayed without re-stamping them as brand-new user edits. Missing/deleted cloud IDs are not blindly re-seeded from old clean caches.

### 2. Auth observer and account boundaries

- One stable auth subscription owns migration and account transitions. Repeated callbacks for the same UID update the User object without fetching, closing the note, or resetting navigation.
- Identity epochs prevent delayed fetches from a previous account from repainting the current account.
- Flushes target the departing account before its editor closes. Account changes clear account-specific modals, selections and transient UI.
- Cached signed-in deep links restore from that account's cache immediately, without waiting for cloud requests and without falling back to Guest data.
- Account edits, kept notes and sign-out no longer mirror private note contents into the Guest vault. Account cache readers never implicitly merge Guest records.
- Known private note IDs mirrored into Guest by older versions are excluded from the Guest view and retained in `uninote_legacy_account_mirrors` before a subsequent Guest save can replace the old source. Mirrors without any surviving account cache cannot be reliably identified automatically.

### 3. Guest migration without destructive account merging

- Guest migration has one owner: the auth observer, not a second competing sign-in handler.
- Custom and modified demo notes migrate; unkept imported notes and untouched demo notes do not automatically seed the account.
- Guest IDs map to new stable account IDs recorded before upload. Folder references and required ancestors are remapped consistently, preventing guest/cloud ID collisions from overwriting account notes or resurrecting deleted demo IDs.
- Successful per-item claims prevent the same Guest source from silently migrating to a second account or reappearing after its migrated account copy was deleted. Original Guest content remains separate; later account edits do not flow back into it.

### 4. Owner-scoped media promotion

- Uploads commit Blobs locally first. Authenticated uploads use `users/{uid}/images/...` in Firebase Storage; guest/offline failures retain durable local references.
- The outbox promotes remaining local tokens before committing cloud note documents. Inline base64 is first converted to durable Blobs. Failed promotion prevents publication of a falsely permanent reference.
- Upload lanes and per-user URL mappings deduplicate work. Existing cloud objects are reused rather than overwritten unnecessarily, avoiding download-token churn.
- Token replacement preserves surrounding Markdown, alignment markers and math. Already-promoted HTTPS URLs are never scanned and nested inside themselves on later saves.
- Local Blobs and source data are retained after promotion.
- `storage.rules` now limits access to the owner path and image writes of at most 25 MB. `firebase.json` identifies the configured named Firestore database and versioned rules. **Neither rules file was deployed in this session.**

### 5. Authorized-domain diagnostics

- A non-blocking Firebase project-config preflight checks the exact current hostname where available. Failed network access is not misclassified as an unauthorized domain.
- The sign-in click preserves popup user activation: no network await is inserted before opening the popup.
- Unauthorized-domain errors name the hostname and link to Firebase Authentication settings. Network errors, blocked popups and user cancellation have separate handling.
- Cloud warnings link to the configured bucket's Storage rules.

## Test coverage and limits

The 93-test suite includes queue independence/order/failure recovery, timeout lane safety, reload/replay of staged writes, immutable snapshots, late acknowledgements, account-switch guards, cloud ties/newer versions/tombstones, conflict retention, corrupt outbox preservation, media promotion, HTTPS enforcement, already-promoted URL handling, exact hostname matching, local account isolation and known legacy-mirror recovery, plus all Stage 1–2 regressions.

Chromium 153.0.8010.0 / Node 22.22.3:

- **Production build:** existing Stage 1 and Stage 2 suites pass, including >6 MB of real IndexedDB image Blobs, content/section/navigation/reload integrity, delayed image insertion, quota recovery and legacy migration.
- **Stage 3 component integration:** the real React app runs against a deliberately substituted Firebase adapter on a Vite source server. Checks pass for same-UID refresh stability, logout isolation, a second account's isolation, one-time Guest claims, delayed old-account responses, signed-in cached reload and actionable unauthorized-domain errors.
- Zero uncaught page errors in the final browser suites. External services are isolated.

**The Stage 3 adapter tests are not real OAuth, real Firebase Storage, real Firestore transactions, or a substitute for deployed-rule/emulator acceptance.** The pure sync service tests use a deterministic in-memory transport. Firebase rule compilation/emulator enforcement has not been verified here.

An earlier combined evidence capture wrote its log inside the watched Vite project, triggering a development-page reload during the test. The final run used HMR disabled and wrote the capture outside the watched tree before copying it here; all three browser suites then passed. No application workaround was used to hide that test-environment failure.

## Live acceptance checklist — still required

Use a test account and non-sensitive fixture first. Do not clear browser storage before exporting/reviewing any pending or conflicting data.

1. Confirm the configured Firebase project, Google provider, named Firestore database and Storage bucket exist and are enabled. Check billing/provisioning requirements for the bucket.
2. Add the **exact hostname** serving the app to [Firebase authorized domains](https://console.firebase.google.com/project/steadfast-rigging-g2w8r/authentication/settings). Each Vercel or Arena preview hostname may require a separate entry; a parent domain is not a wildcard authorization.
3. Review and deploy `firestore.rules` and `storage.rules` to the intended project/database/bucket using your existing Firebase admin workflow. For an already-authenticated Firebase CLI, the project is explicitly selected with:
   ```sh
   firebase deploy --only firestore:rules,storage --project steadfast-rigging-g2w8r
   ```
   This is an administrative deployment step, **not a command executed here**. Verify the named database in `firebase.json` and the project's default Storage bucket match `firebase-applet-config.json` before deploying.
4. Verify rules with two test users: user B and anonymous requests must not read/write user A's Firestore or Storage paths; reject non-image and >25 MB uploads. Verify the owner can read/write/delete permitted records.
5. Sign in with Google. Create a three-section note with Markdown, math, an image, layout markers and YouTube. Wait until cloud synchronization finishes, then confirm its cloud note contains HTTPS media URLs and its Storage object is under the correct UID.
6. Edit rapidly and reload; repeat offline/online. Verify pending changes remain local, reconnect completes the outbox, and the current note is not closed by same-account refresh callbacks.
7. Sign out: verify private account notes and edited private contents are absent from Guest. Sign back into the same account and verify complete source, image, layout and video restoration.
8. Open the same note in a **separate browser profile or second device with no shared IndexedDB/localStorage**. Sign into the same account and verify media loads from the cloud. Repeat with another account to check isolation.
9. Test deletion and conflicting edits from two sessions; inspect warnings and download a conflict backup where applicable. Verify queued old writes cannot resurrect a tombstone.
10. Record deployment URL, browser/device, rule-deployment evidence and results; approve Stage 3 only after these live checks pass.

## Remaining boundaries

- No actual Google sign-in, live uploads, cloud mutation, rules deployment or second-device test was performed. Sandbox outbound access is restricted; the acceptance gate remains open.
- Vercel deployment remains unverified. Stage 4 import/export, feature polish and final offline/PWA acceptance remain untouched.
- Browser caches/outboxes are unencrypted and local to the profile. Guest UI isolation is **not** protection against someone using developer tools or reading that same browser profile's storage.
- Firebase download URLs contain bearer tokens: possession of a valid token URL can grant image access independently of signed-in UI state. Do not publish private image URLs; token revocation is an administrative operation not implemented here.
- Last-writer comparison uses client timestamps; significant device clock skew can affect ordering. Tombstones remain terminal, and conflicting rejected attempts are retained rather than merged character-by-character.
- Outbox durability depends on successful local storage writes. When quota/storage is unavailable, the Stage 2 in-memory recovery warning still applies; closing the tab can lose unpersisted changes. Conflict JSON can contain local image IDs, not embedded image Blobs: retain the original browser vault until media is confirmed durable elsewhere.
- Old account-local-only records with no durable outbox and no matching cloud record are not automatically uploaded, since absence could mean an old deletion. They remain in the account cache for deliberate review/save.

## Principal files

`src/firebase.ts`, `src/App.tsx`, `src/demoData.ts`, `src/utils/mediaStore.ts`, `src/lib/{accountSync,cloudSync,cloudStatus,mediaPromotion,authDiagnostics,localPersistence}.ts`, `storage.rules`, `firebase.json`, `tests/cloudSync.test.ts`, `tests/localPersistence.test.ts`, `tests/fixtures/firebaseAdapter.mjs`, `scripts/stage3-browser-check.mjs`, package scripts, CI naming, README and master-plan tracking.

**Stop here. Stage 4 requires completed Stage 3 acceptance and explicit approval.**

### Reproducing browser checks

With an installed Chromium executable and the production app already serving `dist` on port 3000:
```sh
BROWSER_EXECUTABLE_PATH=/path/to/chromium npm run test:browser
BROWSER_EXECUTABLE_PATH=/path/to/chromium npm run test:stage2:browser
```
For the isolated auth-adapter integration, start a separate source server:
```sh
DISABLE_HMR=true npm exec vite -- --host 0.0.0.0 --port 3001
# In another shell:
BROWSER_EXECUTABLE_PATH=/path/to/chromium npm run test:stage3:browser
```
This sandbox additionally required `LD_LIBRARY_PATH=/tmp/al2023/lib` for its Chromium binary. Those scratch browser binaries/libraries are environment-specific and not committed dependencies. Capture live output outside the Vite-watched repository, then copy it into `docs/stage-3/` after the test finishes.
