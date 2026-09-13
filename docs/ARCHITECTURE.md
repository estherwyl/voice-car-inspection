# Implementation map

The application is React + TypeScript + Vite with Three.js. `App.tsx` owns the active record and transient UI selection. All saved changes go through the pure `mutate()` function in `domain.ts`; derived statuses, completeness, grade and export read the same record.

| Module | Responsibility |
| --- | --- |
| `src/checklist.ts` | Vehicle profile, 172 source-labelled checks, applicability hints, 32 component IDs and mappings |
| `src/domain.ts` | Record schema, validated mutations, undo/history, status aggregation, command parsing, grading and HTML export |
| `src/conversation.ts` | Sequential spoken observations, part aliases, spoken clarification context, automatic per-check updates |
| `src/realtime-voice.ts` | OpenAI WebRTC audio, validated tool dispatch, duplicate-event suppression and microphone lifecycle |
| `server/realtime.ts` | Server-only session creation, local-origin restriction, rate limiting and sanitized provider errors |
| `src/voice-session.ts` | Browser speech adapter retained for isolated deterministic tests |
| `src/storage.ts` | IndexedDB loading and atomic writes; App serializes writes and shows pending/error states |
| `src/App.tsx` | Minimal vehicle workspace, microphone avatar, voice action routing, report/detail drawers and companion state |
| `src/CarScene.tsx` | Blender GLB loading, orbit/raycast selection, labels, view changes, isolation and animation |
| `src/model-layout.ts` | Shared orthographic inventory orientation, normalized bounds and cell placement |
| `src/DetailPanel.tsx` | Manual checks, multiple findings, severity, notes, evidence display and reassignment |
| `src/CameraModal.tsx` | Camera/upload previews, resizing and explicit evidence association |
| `src/Review.tsx` | Outstanding checks, evidence gaps, configurable grade rules, finalization and export UI |
| `modeling/` | Reproducible Blender authoring, compression and geometry validation |

## Record rules

A check's stored status remains separate from its findings. Any unresolved finding derives To Be Rectified; all resolved findings derive Rectified. A component is partial while any of its mapped checks remain unchecked. A single passing observation never passes an entire door.

Photos reference a `checkId` and optionally a `findingId`. Finding correction updates that finding and its attached photos together, preserves the original observation, and records the move in history. Other findings remain untouched. The last 20 mutation snapshots support undo; history remains chronological. Changing a finalized inspection makes it a draft again.

Camera previews are transient until attached. Persisted photos are resized image data stored with the inspection and embedded directly in exported HTML. Save status reflects the IndexedDB transaction, not merely a button click. Export can retain the current in-memory record after a local storage failure.

## Next integrations

GPT-Live-1 now connects through a server-side SDP exchange, with provider secrets confined to `.env.local`. Model tool calls use the validated local conversation actions, preserving clarification, evidence association, and inspector-assessed severity. Remote deployment still requires authentication and an explicit HTTPS origin policy. The current main workspace has no text input; the optional detail drawer retains manual edits.

For multiple vehicles, make checklist, part mapping, model URL and applicability a vehicle definition rather than module constants. Introduce versioned record migrations before changing check IDs. A backend should add authenticated storage, photo object storage, revision checks and record retention; the current IndexedDB adapter is intentionally local and single-tab.

For slower mobile devices, add model LODs and profile GPU/frame performance. Current meshopt compression reduces transfer size without removing geometric detail. Three.js is the largest production JavaScript dependency.
