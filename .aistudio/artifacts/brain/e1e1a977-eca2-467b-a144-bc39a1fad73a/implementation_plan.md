# Media Sizing, Case-Insensitive Search & Mobile-Optimized Undo/Redo Engine

A comprehensive enhancement to the Uni.Note editor delivering interactive image and video sizing/alignment controls, a floating mobile-first search bar with match counts and navigation, and a reliable undo/redo history stack designed for touchscreens and frequent editing.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were clarified and confirmed based on your preferences:
> - **Search Bar UX**: A floating search bar with live match counter (`X of Y`), Previous/Next navigation buttons, and touch-friendly hitboxes designed specifically for mobile phone usage.
> - **Image & Video Sizing/Alignment**: Dual approach featuring both editor toolbar quick-toggle buttons and an interactive click-to-adjust overlay popover directly on media elements in the preview mode.
> - **Undo & Redo System**: Debounced snapshot history engine with selection preservation, immediate captures on toolbar actions/pastes, and touch-accessible controls that remain resilient across rapid back-and-forth edits.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. **Image & Video Formatting**: Enables users to configure Left, Center, or Right alignment and Small (30%), Medium (60%), or Large (100%) sizing for any embedded image, KaTeX math block, or YouTube video—either via editor toolbar controls or directly by tapping the media in the preview to bring up an interactive styling overlay.
  2. **Case-Insensitive Search**: Introduces a floating, mobile-first search panel available in both Edit and Preview modes. Displays total matches, current match index, and allows cycling through occurrences with smooth scrolling and caret positioning.
  3. **Robust Undo & Redo**: Replaces the fragile 5-second interval timer with an intelligent snapshot stack that captures typing pauses, word boundaries, and every atomic formatting/pasting action, maintaining accurate cursor position and bidirectional history traversal.
- **Target Audience / Persona**: Students, researchers, and mobile note-takers organizing academic and multimedia content primarily from mobile phones or tablets.
- **Key Value**: Fluid media formatting without fiddling with raw markdown tags, instant document search on small screens, and dependable editing history that never loses text.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Interactive Preview Media Adjustment**:
   - In preview mode, user taps an image or YouTube video.
   - An ergonomic glassmorphic pill overlay appears directly above or floating adjacent to the element with alignment (`Left`, `Center`, `Right`) and sizing (`S`, `M`, `L`) quick-action chips.
   - Tapping any option instantly updates the note's markdown marker (`@@align-size@@`), smoothly transitions the preview styling, and autosaves.
2. **Mobile Floating Search**:
   - User taps the Search icon in the editor toolbar or presses `Cmd/Ctrl+F`.
   - A floating search pill slides down smoothly into view (docked at the top below the header, or floating above the mobile virtual keyboard).
   - Typing any string or number immediately highlights all matches case-insensitively, updates the indicator (e.g. `2 / 7`), and scrolls the first match into center view.
   - User taps Next (`↓`) or Prev (`↑`) to cycle matches, and taps `✕` to dismiss and clear highlights.
3. **Smart Mobile Undo & Redo**:
   - As the user types, text changes are batched with a 600ms debounce and on punctuation/line breaks.
   - Toolbar formatting, image drops, or pastes immediately push a snapshot before mutation.
   - The user can tap Undo (`↺`) or Redo (`↻`) repeatedly; each step accurately restores both note content and selection state without wiping redo entries.

#### Visual Identity & Theme Tokens
- **Design Language**: Dark academic utilitarian with glassmorphic accents, conforming to mobile touch-target standards ($\ge 44 \times 44\text{px}$ hitboxes).
- **Color Tokens**:
  - Background: Obsidian `#131314` and slate dark surfaces `#1E1F20`.
  - Accent: Amber gold `#FBBF24` / `#F59E0B` for active states and highlights.
  - Search Highlights: Warm amber glow (`rgba(251, 191, 36, 0.35)`) with active match in high-contrast solid gold (`#FBBF24` with dark text).
  - Floating Overlays: Glassmorphic dark blur (`bg-black/85 backdrop-blur-md border border-white/15 shadow-2xl`).
- **Typography & Hierarchy**: Clean monospace and geometric sans pairing (`var(--font-gemini)`), high contrast, with clear text indicators rather than decorative badges.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual Control for Media Sizing & Alignment (Toolbar + Preview Overlay)**
  - *Chosen Approach*: Maintain markdown marker syntax `@@align-size@@` while providing both editor toolbar buttons (active line detection) and a click-to-edit floating overlay in the preview.
  - *Why*: In preview mode, users want to tap what they see and resize it without switching into edit mode and finding the exact line of code. In edit mode, the toolbar remains fast for keyboard users.
  - *Alternatives Considered*: Modal dialogs (too disruptive on mobile) or drag handles (unreliable on mobile touch devices).
- **Decision 2: Case-Insensitive Highlight & Navigation Architecture**
  - *Chosen Approach*: In preview mode, dynamically wrap matched substrings in `<mark>` elements during search and use `.scrollIntoView({ behavior: 'smooth', block: 'center' })`. In edit mode, update `textarea.setSelectionRange()` and scroll textarea to the matched line.
  - *Why*: Provides native mobile search feedback across both viewing and editing states without damaging the underlying raw text.
- **Decision 3: Debounced State Snapshotting with Selection Preservation**
  - *Chosen Approach*: Store `{ content: string, selectionStart: number, selectionEnd: number }` in the history stack, triggered on debounced typing (600ms), word/line boundaries, and atomic actions.
  - *Why*: Eliminates the previous 5-second lag bug while avoiding storing every individual keystroke (which would require hundreds of undo taps).

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                              NoteEditor                                │
│                                                                        │
│  ┌───────────────────────┐  ┌──────────────────────┐  ┌─────────────┐  │
│  │  Undo/Redo Engine     │  │  Floating Search Bar │  │  Sync State │  │
│  │  - History Stack (40) │  │  - Case-Insensitive  │  │  - Local    │  │
│  │  - Redo Stack (40)    │  │  - Match Counter     │  │  - Cloud    │  │
│  │  - Caret Preservation │  │  - Next/Prev Nav     │  │             │  │
│  └───────────┬───────────┘  └──────────┬───────────┘  └─────────────┘  │
│              │                         │                               │
│              ▼                         ▼                               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Mode Switching: Edit Mode vs. View Mode                          │  │
│  │                                                                  │  │
│  │  [ EDIT MODE ]                                                   │  │
│  │  - Sticky Mobile Toolbar (Undo/Redo, Align, Size, Search, etc.)  │  │
│  │  - Auto-expanding Textarea with Selection Tracking               │  │
│  │                                                                  │  │
│  │  [ VIEW MODE ]                                                   │  │
│  │  - MarkdownPreview with KaTeX & YouTube Embeds                   │  │
│  │  - Interactive Tap Overlay on Images & Videos                    │  │
│  │    (Size: 30%, 60%, 100% | Align: Left, Center, Right)           │  │
│  │  - Search Highlight Overlay (<mark class="active-match">)        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Data Model & State Additions
- **History Snapshot**:
  ```ts
  interface HistorySnapshot {
    content: string;
    selectionStart?: number;
    selectionEnd?: number;
    timestamp: number;
  }
  ```
- **Search State**:
  ```ts
  interface SearchState {
    isOpen: boolean;
    query: string;
    currentMatchIndex: number;
    totalMatches: number;
  }
  ```
- **Interactive Media Overlay State**:
  ```ts
  interface MediaTargetOverlay {
    targetId: string;
    rawMarker: string; // e.g. @@center-medium@@
    currentAlign: 'left' | 'center' | 'right';
    currentSize: 'small' | 'medium' | 'large';
    position: { top: number; left: number };
    mediaType: 'image' | 'video';
  }
  ```

#### Component & State Mapping
1. `useEditorHistory`: Custom hook encapsulating push, undo, redo, and keyboard shortcuts (`Cmd+Z`, `Cmd+Shift+Z` / `Ctrl+Y`), ensuring max stack limit of 40, proper stack pruning on new edits, and cursor position restoration.
2. `FloatingSearchBar`: Self-contained mobile-responsive search bar component rendered over NoteEditor with input field, match count badge, upward/downward navigation chevrons (44px hitboxes), and close button.
3. `MarkdownPreview`: Augmented to assign unique data attributes to images and videos during parsing, attaching a click/tap handler that displays `MediaControlOverlay` with alignment & size selectors.
4. `MediaControlOverlay`: Touch-optimized popover with tactile buttons for instant alignment and size manipulation that mutates the target section's markdown and calls `onSave`.
