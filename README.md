# JARVICI

Just A Rather Very Intelligent Car Inspection.

A working local MVP for inspecting a **2022 Subaru XV GT Edition EyeSight 2.0**: tap the microphone, describe observations, explore the Blender model in Three.js, attach evidence, correct findings, and export a report. The Subaru choice follows the source report and the user's clarification of the brief's conflicting BYD references.

## Run

Requires Node.js 22 and npm.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. For a production bundle, run `npm run build`; `npm run preview` serves that bundle. Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY` on the server. The supplied local key is already configured. The Vite dev and preview servers provide `/api/voice/session`; a static-only deployment cannot provide live voice. The endpoint is restricted to localhost; add authentication and a configured HTTPS origin before remote deployment. Use localhost or HTTPS for microphone and camera access.

```sh
npm test                 # Domain, conversation, voice and transition tests
npm run model:validate   # Compressed geometry, component IDs, and layout bounds
npm run build            # TypeScript and production bundle
```

Voice uses `OPENAI_LIVE_MODEL=gpt-live-1`; the separate tool backend uses `OPENAI_DELEGATION_MODEL=gpt-5.6-terra`. Both are server-side settings. The Live API handles speech and delegates inspection actions to the backend. The browser waits for `session.started`, processes nested tool events, and requests `session.close` when stopped. See the [official migration guide](https://developers.openai.com/api/docs/guides/live-migration).

## Inspect by voice

Choose the Subaru on the landing page, then tap the large **microphone avatar** once and allow microphone access. Speak normally; no text input or part selection is needed. Tap again, or say “pause”, to stop.

1. “Left front door is okay. Right rear door is okay.” Both exterior panel checks update automatically, including when spoken in one turn. Trim and window checks remain separate.
2. “Left rear door has a scratch.” The companion asks for severity; answer “minor”, “moderate”, “serious”, or “critical”.
3. “Actually, that was the right front door.” The finding and linked evidence move together. Say “undo” to reverse it.
4. “The driver seat is fine.” The view changes to the interior automatically.
5. “Open camera.” Allow camera access, then say “capture”, “save photo”, or “retake”. Capture/upload buttons remain available.
6. “What is left?” opens unchecked items. “Review the report” opens review and export.

The car, one compact progress indicator, and the voice avatar form the main workspace. **Report** opens the checklist on demand; tapping a component opens optional manual details. One **Assembled → Parts** slider controls all 32 parts in the same canvas. The first 45% spreads vehicle systems; the remaining 55% packs parts with their centres on z = 0. Thickness and shading remain. Near full expansion, dragging pans instead of rotating; scrolling or pinching zooms. History, sources, and prototype details are under **More → About/History**.

The companion uses GPT-Live-1 over WebRTC for speech, turn detection, spoken replies, and tool calls. Tool results update the existing inspection record and are returned to the model before it confirms an action. Disconnects stop the microphone and show a retry control; reconnecting reads the saved inspection. Audio and inspection context are sent to OpenAI while connected. Photos remain local.

Export prepares self-contained HTML with embedded photos. **Preview / print** provides a PDF route if the browser does not save the download. Finalization requires all checks assessed, severities supplied, local save completed, and inspector acknowledgement.

## Blender and Three.js

- Editable model: [`modeling/subaru-xv-inspection.blend`](modeling/subaru-xv-inspection.blend)
- Browser asset: [`public/models/subaru-xv-inspection.glb`](public/models/subaru-xv-inspection.glb)
- Studio render: [`public/models/subaru-xv-studio.png`](public/models/subaru-xv-studio.png)
- Authoring script: [`modeling/build_vehicle.py`](modeling/build_vehicle.py)

The original Blender model has **32 inspectable groups, 163 mesh groups, and 555,692 triangles**. It includes sculpted body panels, wheel arches, tyre tread, split-spoke wheels, brakes, grilles, lights, door trim, stitched seats, controls, engine and suspension geometry. Meshopt compression reduces the GLB from 26.6 MiB to 5.35 MiB. Stable `part-*` names and `partId` metadata connect geometry to checks.

This is detailed **approximate reference geometry**, inspired by the Subaru XV. It is not exact manufacturer CAD, a photogrammetric reconstruction, or evidence of a particular car's condition. Original geometry and model-authoring code are covered by [`modeling/LICENSE`](modeling/LICENSE). No downloaded third-party vehicle mesh is used.

`CarScene.tsx` uses Three.js GLTFLoader, MeshoptDecoder, OrbitControls, raycasting, orthographic projection, and animated component transforms. Exterior, cabin, engine and underbody parts share one continuously controlled scene. Part names appear on hover, focus or selection in the packed layout; annotations and evidence retain stable IDs. A labelled basic model/list fallback keeps inspection controls usable if the detailed model or WebGL is unavailable.

To rebuild on this Mac, install `uv` and Blender at `/Applications/Blender.app`, then run:

```sh
npm run model:build
```

`modeling/build.sh` reuses/creates a local Python 3.12 environment with `uv`, activates it, and syncs the lockfile. Geometry is authored with Blender's embedded `bpy` interpreter. The script saves the `.blend`, exports GLB, renders the studio image, and optimizes the browser asset. Rendering takes several minutes. Adjust the Blender executable path in `build.sh` on other systems.

## Checklist provenance and applicability

The checklist was read from the rendered [CARSOME CTNF600 report](https://www.carsome.my/buy-car/subaru/xv/2022-subaru-xv-gt-edition-eyesight-2.0/ctnf600/full-report#Exterior) on 13 September 2026, including the categories behind its tabs. There are **165 named rows**, plus **3 major-condition overview checks** and **4 tyre checks derived from the report guidance**, for **172 checks**. The source's advertised inspection count differs from its exposed named rows. Each app check records whether it is a source row or derived guidance. Source inspection outcomes were never imported.

The selected Subaru is petrol and automatic. EV-only, manual-clutch, and equipment-dependent rows show applicability guidance; inspectors confirm N/A explicitly. Nothing is silently passed or marked inapplicable. Change `VEHICLE`, `CHECKS`, `PARTS`, and the associated model mapping to add vehicle configurations. [Human Atlas](https://github.com/ashemag/human-atlas) informed selection, isolation, and the transition into a parts inventory; its source code was not copied.

## Prototype boundaries

- **Voice uses GPT-Live-1 with validated local inspection tools.** The API key stays in `.env.local` on the server and is excluded from Git and the browser bundle. The old browser-speech adapter remains only for isolated test pages. A valid funded OpenAI project and microphone access are required.
- Notes and resized photos persist in **IndexedDB in this browser**, with visible save/failure states, retry, and export of the current record. There is one active record, no account, cloud sync, collaboration, or multi-tab conflict resolution. Use one inspection tab at a time. Clearing browser data removes local progress.
- Camera capture uses `getUserMedia` and has a visible capture control, voice capture request, preview, retake, upload, and permission/error handling. Physical camera and microphone operation still need device testing. The voice workflow was exercised through a simulated recognition adapter, and the upload-to-evidence flow with an explicitly synthetic image.
- Grading is **illustrative and configurable**, based only on recorded findings. Completeness is separate; missing severity withholds the grade, serious findings cap it at C, and critical findings at D. Deductions can lower the grade further. Missing evidence remains visible for inspector review.
- Export content and embedded images were verified in the in-app preview. A browser download completion event could not be verified in the Codex in-app browser; the preview/print route is available. Hardware performance on older phones has not been profiled.

See [`docs/VALIDATION.md`](docs/VALIDATION.md) for validation evidence and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for extension points.
