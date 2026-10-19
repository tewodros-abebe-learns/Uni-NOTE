# Google Drive Integration & Home Layout Modernization (Two-Step Plan)

A seamless, phased integration connecting UniNote with personal Google Drive accounts to automatically backup and sync notes as clean, human-readable Markdown files inside a dedicated `UniNote` folder, alongside modernizing the homepage header and navigation into a clean collapsible drawer.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The integration is structured into **2 patient phases** as requested, with **Step 1** being implemented first for your review:

- **Confirmed Decision 1 (Storage Format & Location)**: Notes and research will be stored in a visible top-level `UniNote` Google Drive folder as standard `.md` (Markdown) files with metadata frontmatter (title, folder tag, timestamps).
- **Confirmed Decision 2 (Sync Behavior)**: Automatic background sync on creation and editing with debounced writes, non-blocking offline resilience, and a quiet sync indicator.
- **Confirmed Decision 3 (Phase 1 Scope)**:
  - **Step 1 (First Implementation)**:
    1. UI Header & Navigation overhaul (collapsible user profile sidebar on avatar click, Home label at top right, hero 2.1 and pill cleanup, subtle gradient white border).
    2. Google Drive OAuth connection (`https://www.googleapis.com/auth/drive.file` least-privilege scope).
    3. Automatic `UniNote` root folder initialization in Drive.
    4. One-way and debounced background backup sync of active/created notes to Google Drive as `.md` files with live status indicator.
  - **Step 2 (Future Phase after user review)**:
    - Bi-directional sync / conflict resolution (pulling changes edited remotely in Google Drive back into UniNote).
    - Full folder hierarchy mirroring (subfolders in Drive matching app folder tree).
    - Google Drive trash sync and attachment/media file upload handling.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms UniNote into an open-format knowledge hub backed by the user's personal Google Drive. Notes are saved locally in Firestore/cache for instant responsiveness and synchronized to Google Drive in open Markdown (`.md`) format.
- **Target Audience**: Researchers, students, and writers who desire zero vendor lock-in, effortless cloud backup, and multi-device access to their research files via Google Drive and desktop markdown editors (Obsidian, VS Code, iA Writer).
- **Key Value**:
  - **100% User Ownership**: Your data lives in your own Google Drive quota, completely accessible even if you are outside UniNote.
  - **Effortless Protection**: Real-time background sync eliminates worries about losing notes or device failures.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Top Header Contract                                                             │
│                                                                                 │
│ [ (Avatar) Tewodros ]                                           [ (Home Icon) ] │
│        │                                                                        │
│        ▼ (Click Avatar)                                                         │
│ ┌───────────────────────────┐                                                   │
│ │ Profile & Actions Drawer  │                                                   │
│ │ ───────────────────────── │                                                   │
│ │ Tewodros Abebe            │                                                   │
│ │ tewoderos7abebe@gmail.com │                                                   │
│ │                           │                                                   │
│ │ [↑ Import]   [+ Folder]   │                                                   │
│ │ [+ Note]     [⚙ Theme]    │                                                   │
│ │                           │                                                   │
│ │ Drive Sync: Connected ●   │                                                   │
│ │ [Sync Now]                │                                                   │
│ │                           │                                                   │
│ │ [↪ Logout]                │                                                   │
│ └───────────────────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

1. **Top Header & User Drawer**:
   - The cluttered top panel is replaced with a minimalist bar: clicking the user avatar in the top-left smoothly expands a sleek, backdrop-blurred drawer or popover containing user info (Tewodros Abebe, email), quick creation actions (Import, Folder, Note), theme switcher, Google Drive status, and Logout.
   - The top-right houses the `Home` text and icon anchor.
2. **Hero Section Refinement**:
   - Title updated to clean **Uni NOTE** (removing the "2.1" version number).
   - Eliminated the `3 folders • 2 notes` pill badges for zero-pill discipline.
   - Added a subtle gradient white border (`border border-white/20 shadow-[0_0_25px_rgba(255,255,255,0.06)]`) outlining the hero container.
3. **Google Drive Sync Status Indicator**:
   - In the drawer and editor status bar, a quiet indicator shows:
     - `● Synced with Drive` (emerald)
     - `◌ Syncing to UniNote folder...` (subtle pulse)
     - `Connect Google Drive` (one-click OAuth consent button if not authenticated with drive scope).

---

## 3. Key Product Decisions & Trade-Offs

- **Drive Scope Strategy (`drive.file` vs `drive`)**:
  - *Chosen Approach*: `https://www.googleapis.com/auth/drive.file`.
  - *Why*: Adheres to the principle of least privilege. UniNote only requests access to files and folders created by UniNote itself, ensuring maximum user trust and privacy without broad access to personal files in the user's Drive.
- **Dual-Layer Storage Architecture**:
  - *Chosen Approach*: Firestore + Local state serves as the fast, real-time working database; Google Drive serves as the open-format backup and document export sink.
  - *Why*: Google Drive's REST API has rate limits and latency (~300–800ms per file upload). Using Drive as an asynchronous sync sink gives instant zero-latency note editing locally while ensuring persistent cloud files in Drive.
- **File Format Specification**:
  - *Chosen Approach*: Markdown (`.md`) with YAML frontmatter:
    ```markdown
    ---
    id: note_123
    title: Quantum Computing Notes
    folder: Physics
    updatedAt: 2026-10-14T13:30:00Z
    ---
    # Quantum Computing Notes
    Content here...
    ```
  - *Why*: Fully human-readable in Google Drive preview, mobile devices, and standard text tools.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ UniNote Client Architecture                                                            │
│                                                                                        │
│ ┌─────────────────────────┐         ┌────────────────────────────────────────────────┐ │
│ │   UI & Drawer Views     │         │            Note Editor & Home View             │ │
│ │  (Header / Left Drawer) │         │     (Auto-Save Trigger: onEdit / onCreate)     │ │
│ └────────────┬────────────┘         └───────────────────────┬────────────────────────┘ │
│              │                                              │                          │
│              ▼                                              ▼                          │
│ ┌─────────────────────────┐         ┌────────────────────────────────────────────────┐ │
│ │  Firebase Auth + Token  │◄────────┤             Drive Sync Coordinator             │ │
│ │  (GoogleAuthProvider   │         │  - Debounce queue (1500ms)                     │ │
│ │   drive.file scope)     │         │  - Check / Create "UniNote" Root Folder        │ │
│ └────────────┬────────────┘         │  - Multipart REST Upload (Metadata + MD body)  │ │
│              │                      └───────────────────────┬────────────────────────┘ │
│              ▼                                              │                          │
└──────────────┼──────────────────────────────────────────────┼──────────────────────────┘
               │ Bearer AccessToken                           │
               ▼                                              ▼
┌───────────────────────────────┐              ┌───────────────────────────────┐
│     Google Identity OAuth     │              │     Google Drive REST v3      │
│  (Token Refresh & Permissions)│              │  POST /drive/v3/files (create)│
│                               │              │  PATCH /drive/v3/files/:id    │
└───────────────────────────────┘              └───────────────────────────────┘
```

### Step 1 Detailed Implementation Checklist

1. **OAuth Setup & Token Management**:
   - Register the Google Drive scope `https://www.googleapis.com/auth/drive.file` via `set_up_oauth`.
   - Ensure the Google Auth Provider attaches the scope and stores the access token in memory.
2. **Drive REST Service (`src/services/driveService.ts`)**:
   - `findOrCreateAppFolder(token, folderName = 'UniNote')`: Checks if the folder exists in Drive root (`mimeType = 'application/vnd.google-apps.folder' and name = 'UniNote' and trashed = false`), creates it if missing, and caches the `folderId`.
   - `syncNoteToDrive(token, note, parentFolderId)`: Formats the note into Markdown with frontmatter. Checks if a file with name `${note.title || 'Untitled'}.md` exists in the folder; uses multipart upload or `PATCH` to update content and metadata.
   - `syncAllNotes(token, notes)`: Batch sync trigger for initial backup.
3. **UI Updates (Home, Header, Sidebar)**:
   - Transform top bar into:
     - Top-left: Interactive user avatar button with subtle ring hover.
     - Top-right: Clean `Home` navigation marker.
     - Collapsible floating drawer / sheet displaying Tewodros Abebe's info, quick action buttons, theme switch, Drive sync card, and logout.
   - Clean up hero: remove `"2.1"`, remove `"3 folders • 2 notes"`, add subtle white gradient border styling.
4. **Verification & Testing**:
   - Verify build compilation (`compile_applet`), OAuth flow validation, and initial folder/file creation in Drive.
