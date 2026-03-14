import {
  buildCropDataUrl,
  elements,
  renderBeats
} from "../dom.js";
import { state } from "../state.js";
import { stopRecording } from "./recording.js";
import { playBeats, playWord, stopSpeaking } from "./speech.js";

export function openLesson(index) {
  const lesson = state.currentImage?.detections?.[index];
  if (!lesson) {
    return;
  }

  state.currentLesson = lesson;
  elements.lessonCrop.src = buildCropDataUrl(lesson.bbox);
  elements.lessonTitle.textContent = lesson.word;
  elements.lessonDescription.textContent = "Choose an action below.";
  renderBeats(lesson.beats.length);
  elements.teachSheet.classList.remove("hidden");
  playLesson("normal");
}

export function closeLesson() {
  stopSpeaking();
  stopRecording();
  state.currentLesson = null;
  elements.teachSheet.classList.add("hidden");
}

export async function playLesson(mode) {
  if (!state.currentLesson) {
    return;
  }

  if (mode === "beats") {
    await playBeats(state.currentLesson);
    return;
  }

  const rate = mode === "slow" ? 0.62 : 0.9;
  await playWord(state.currentLesson.word, rate);
}
