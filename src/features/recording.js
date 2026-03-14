import { elements } from "../dom.js";
import { state } from "../state.js";
import { stopSpeaking } from "./speech.js";

export async function toggleRecording() {
  if (state.mediaRecorder?.state === "recording") {
    stopRecording();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    return;
  }

  try {
    stopSpeaking();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.recordChunks = [];
    state.mediaRecorder = new MediaRecorder(stream);
    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        state.recordChunks.push(event.data);
      }
    };
    state.mediaRecorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      elements.recordButton.classList.remove("recording");

      if (!state.recordChunks.length) {
        state.mediaRecorder = null;
        return;
      }

      const blob = new Blob(state.recordChunks, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play().catch(() => {});
      state.recordChunks = [];
      state.mediaRecorder = null;
    };

    elements.recordButton.classList.add("recording");
    state.mediaRecorder.start();
    state.recordTimeout = window.setTimeout(() => {
      stopRecording();
    }, 2500);
  } catch (error) {
    console.error("Microphone unavailable", error);
  }
}

export function stopRecording() {
  if (state.recordTimeout) {
    window.clearTimeout(state.recordTimeout);
    state.recordTimeout = null;
  }

  if (state.mediaRecorder?.state === "recording") {
    state.mediaRecorder.stop();
  } else {
    elements.recordButton.classList.remove("recording");
    state.mediaRecorder = null;
  }
}
