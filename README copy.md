# ESL Object Learner

An icon-first web app that helps non-English speakers learn object words from their own surroundings.

## What it does

1. Takes a photo with the device camera or lets the user upload one.
2. Runs object detection in the browser with the COCO-SSD model.
3. Filters detections down to common household and everyday items.
4. Lets the user tap a detected object to open a no-text lesson screen.
5. Teaches pronunciation through:
   - spoken English audio
   - slower repeated audio
   - beat-by-beat syllable playback
   - self-record and playback for imitation
6. Returns the user to the same picture so they can learn more objects or choose another image.

## Run locally

Because the app uses camera APIs, serve it from `http://localhost` instead of opening the file directly.

Example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Project structure

- `index.html`: app shell and icon-driven UI
- `app.js`: lightweight module entrypoint
- `src/main.js`: event wiring and application bootstrap
- `src/features/`: camera, detections, lessons, speech, recording
- `src/services/model.js`: TensorFlow model loading
- `src/data/commonObjects.js`: filtered vocabulary list
- `src/dom.js`: shared DOM helpers
- `src/state.js`: shared runtime state
- `styles.css`: stylesheet aggregator
- `styles/`: base, layout, components, modals, animations

## Notes

- TensorFlow.js and COCO-SSD are loaded from CDN.
- Speech depends on the browser's available English voices.
- Microphone recording uses `MediaRecorder`, so support varies slightly by browser.
