# Validation — 13 September 2026

## JARVICI landing and continuous transition

Restored a compact vehicle-selection landing page and renamed the product JARVICI. One slider replaces separate exterior/interior/parts controls. All 32 parts share the same scene: 0–45% separates vehicle systems, 45–100% blends into a packed layout. The camera approaches the front and fits the layout; rotation changes to drag-to-pan at 94%.

29 tests pass. Additional transition tests verify the 45% boundary, exact assembled restoration, uniform scale, and nonzero thickness. The shipped GLB validation also checks every packed component centre is on z=0 and that the unified 4- and 6-column layouts do not overlap.

## Voice-first revision

The default workspace now contains the car, view controls, a compact progress summary and one microphone avatar. There is no observation text field. Reports, component details, history and explanations open on demand.

**27 automated tests pass**, including seven conversation tests and five speech-session tests added to the original domain coverage. Named-door observations now record the exterior panel directly without clarification or manual selection. The new coverage verifies multiple observations in one utterance, unpunctuated speech, side aliases, spoken side/check clarification, severity answers, correction and evidence linkage, window/trim specificity, uncertain observations, queued final results, recognition restart, speech echo suppression, permission denial and preserving received words on pause.

The browser harness at `/tests/voice.html` supplies explicitly simulated recognition/synthesis events to the production voice controller and uses a separate IndexedDB database. With one microphone tap, it verified two door passes, a scratch, spoken severity, correction to another door, reconnection and a driver-seat pass. The resulting report contained 4 checked items and 1 minor issue; no typing fields or manual part selection were used. This verifies application routing, not physical microphone accuracy.

The revised 390 × 844 phone workspace was checked: document width and scroll width both measured 390, the microphone remained within the viewport, and the main page contained zero input/textarea fields. The actual inspection record remained untouched by the isolated speech harness.

The earlier validation below records the original layout and text-driven workflow; the revised voice workflow supersedes its door-clarification and text-input steps.

## Automated checks

`npm test` covers 15 cases: source inventory/mappings and unchecked defaults; rear-door alias clarification; per-check partial status; negation/uncertainty; preserving defect intent through clarification; multiple findings; correction/photo linkage/undo; restoring the source check; pass protection; grade withholding and severity caps; caps never raising a worse grade; photo destination validation; serialization and safe export; finalization invalidation; original-observation retention; and grading-rule undo. Several assertions are grouped in each test.

`npm run model:validate` decodes the shipped meshopt GLB, checks all 32 component names and `partId` metadata, verifies 555,692 triangles and nonempty geometry, and checks exterior/interior bounding boxes for overlap at three and five columns. Interior door bounds use only the visible trim surfaces.

`npm run build` type-checks and creates a production bundle. Vite reports its normal large-chunk warning for the Three.js bundle; no type or build errors remain.

## Browser flow exercised

The running local app was tested through the Codex browser UI with synthetic observations and a synthetic scratch image, never the source report's condition results.

| Step | Observed result |
| --- | --- |
| Select Subaru, start via text simulation | Workspace opens; start does not mark checks passed |
| “The left back door is fine” | Clarifies panel/trim/window; confirmed exterior check passes, component remains partial |
| Record minor scratch on left front door | Live report updates, component flags, finding detail appears |
| Upload synthetic photo and attach | Preview precedes attachment; photo links to the intended check and finding |
| Correct to right front door | Finding and photo move without duplication, notes/location update, source returns unchecked |
| Undo and repeat correction | Original association restores, then moves again consistently; edit history retained |
| Inspect driver seat | Interior item passes; dashboard and driver seat are on the right |
| Flat exterior/interior inventories | Smooth reversible transition; selectable annotations retain state |
| Select flagged component and photo | Finding and its evidence remain available through the component details |
| Outstanding checks | Unchecked filter shows the remaining 169 of 172 checks in the test scenario |
| Review | Completeness 3/172, one minor finding, one photo, provisional illustrative A/98; finalization disabled |
| Export preview | 172 report rows, corrected right-front-door notes, consistent IDs, and embedded photo rendered at source width 640 |
| Reload/resume | Saved observations, photo and corrected association restored |

Desktop and tablet layouts were visually checked in the in-app browser. A development-only wrapper at `/tests/responsive.html` verified a **390 × 844** phone viewport: no horizontal document overflow, 22 exterior/12 interior pins, no pin-box overlaps in the flat inventories, persistent voice controls, and working report/vehicle switching. Returning from a hidden viewer no longer corrupts the camera dimensions. Assembly and driver-seat isolation were also exercised on the phone layout.

After validation, the six synthetic state changes were reverted through the app's Undo control. The delivered active record is back to 0/172 checks with no findings or attached photos; the edit history retains the test and undo operations.

## Limits of validation

- Text simulation and photo upload were exercised end to end. Live microphone recognition, physical camera permissions/capture, hardware disconnections and real device performance were not exercised.
- Export HTML and embedded images were checked in the app preview. A download-completion event was not observed in the in-app browser; direct browser downloads and the operating system print/PDF dialog require a normal-browser/device check.
- Storage failure messages and camera error handling are implemented, but storage quota exhaustion was not induced. Domain serialization and corrected evidence links have automated coverage.
- Finalization gating has automated coverage. No physical vehicle was inspected or certified.

## OpenAI voice integration

Added server-only OpenAI Realtime session creation, WebRTC microphone/audio, tool calls into the existing validated inspection actions, and current-record context on reconnect. Live API configuration check returned HTTP 200 for gpt-realtime. Browser reached the speaking state with a live response; microphone was then stopped and camera closed. No inspection findings or evidence were added. A startup guard prevents example commands from running before inspector speech. 33 automated tests cover domain operations, voice tool validation, duplicate calls, startup guard, origin rejection and sanitized provider errors. Production build passes; the configured key is ignored by Git, mode 600, and absent from browser assets. This is a local prototype: a full physical walk-around, noisy-environment recognition and all spoken camera flows are not yet validated.

## GPT-Live-1 migration

Replaced Realtime session creation with POST /v1/live/sessions using gpt-live-1, plus a gpt-5.6-terra Responses delegation backend. Updated nested tool event handling, empty terminal snapshots, ordered results, cancelled batches, caption deltas, playback metering and session closure. The running server reports gpt-live-1. Browser startup reached listening and produced “JARVICI is ready”; the microphone was stopped and no findings were added. 37 automated tests and production build passed. Live speech-driven mutation end-to-end remains a physical walk-around validation task.
