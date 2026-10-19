# Uni.Note

An academic Markdown and LaTeX note-taking application with a browser-local guest vault and optional Firebase/Google sign-in.

## Stage status

**All four stages are implemented locally. Final acceptance remains pending: live Firebase checks, native desktop/mobile installation and a verified deployment are still required. Stage 4 was explicitly authorized after the disclosed Stage 3 verification limits.**

- [Master implementation plan](docs/UNI_NOTE_MASTER_IMPLEMENTATION_PLAN.md)
- [Stage 1 implementation report and full verification logs](docs/stage-1/README.md)
- [Stage 2 persistence report and logs](docs/stage-2/REPORT.md)
- [Stage 3 cloud/auth report, logs and live verification checklist](docs/stage-3/REPORT.md)
- [Stage 4 features/PWA report, logs and final acceptance checklist](docs/stage-4/REPORT.md)

## Local development

Use Node 22 (see `.nvmrc`) and npm 10/11. Node 20.19+ is also tested.

```sh
npm ci
npm run dev
```

The Express/Vite development app listens on port 3000. Firebase web project configuration is in `firebase-applet-config.json`; that public configuration is not an admin credential. Google sign-in requires the serving domain to be authorized in the configured Firebase project. Never put server secrets in browser build variables.

## Verification

```sh
npm run lint
npm test
npm run build
npm audit --audit-level=low
```

`npm run check` combines typechecking, tests, and production build. See the Stage 1 report for the optional actual-browser smoke test and its isolation boundaries.

## Serve the production build

```sh
npm run build
NODE_ENV=production npm start
```

Vercel uses the repository root, `npm ci`, `npm run build`, and the `dist` output, as configured in `vercel.json`. This is a frontend deployment, not hosting for the Express image-upload API. Uploaded Express files require durable storage when self-hosted. The Express upload endpoint is disabled unless `ENABLE_LOCAL_UPLOADS=true` (and `UPLOAD_TOKEN` is set, if you want it authenticated); the app itself never uses it. Account media is stored as IndexedDB Blobs locally and backed up to owner-scoped, chunked Firestore media documents (`users/{uid}/media/…`); every signed-in device of the account resolves those references from that backup. Firebase Storage is not used — it is unavailable on this project's AI Studio Starter Tier. Firebase rules are versioned but must be deployed separately.

## Important scope warning

Local tests are not proof of live Google OAuth, deployed Firebase rules, or cross-device acceptance. Complete the Stage 3 live checklist before production approval. Account caches and Blob data remain in this browser unencrypted; Guest UI separation is not protection against someone with developer-tools access to the same browser profile. Stage 4 features are locally tested; native installation and final live acceptance remain unverified. Themes are Light, Dark (default) and Full Dark (true black); every older palette name migrates onto one of them. The UI font is Google Sans, bundled locally from `public/fonts` (it is not a Google Fonts family) so it works offline.

## Backups, shortcuts and installation

- Import JSON note arrays, versioned vault backups, or nested `folders`/`children` trees from the header. Markdown/text imports are also supported. Imports remain local until explicitly kept in an account.
- **Account & Settings → Export all notes & folders** offers JSON, Markdown and HTML. Note export supports all sections or the current section. JSON includes local image bytes and timestamps. External image/video URLs remain external; missing local images block a falsely complete export. Portable files are limited to 50 MB: split large exports by note/section.
- HTML uses sanitized markup and native MathML. For SVG/AVIF/other images outside the HTML raster allowlist, choose JSON or Markdown. JSON preserves the original image Blob.
- Media gears offer Left/Center/Right and Small (35%), Medium (65%), Large (85%) and Full (100%). Legacy hyphen markers remain readable; changes use `@@align:size@@`.
- Ctrl/Cmd+S saves, Ctrl/Cmd+B/I formats selections, Ctrl/Cmd+M adds block math, Ctrl/Cmd+F opens note search, and Alt+Up/Down switches sections. Vault search opens the matching section with highlighting.
- **Account & Settings → Install Uni.Note** uses the browser install prompt when available and otherwise explains browser-menu / iOS Add to Home Screen installation.
- Math scripts, CSS, fonts, icons and the application shell are bundled/pre-cached for offline use. External videos and cloud synchronization still need connectivity. Updates are offered explicitly; unsaved memory-only changes or image writes block applying an update.
