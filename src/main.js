import { elements } from "./dom.js";
import { closeCamera, captureFromCamera, openCamera } from "./features/camera.js";
import { detectObjects, loadSceneImage, renderDetections } from "./features/detections.js";
import { closeLesson, openLesson, playLesson } from "./features/lessons.js";
import {
  stopRecording,
  toggleRecording,
  updateRecordingAvailability
} from "./features/recording.js";
import { stopSpeaking } from "./features/speech.js";
import { state } from "./state.js";
import { loadModel } from "./services/model.js";
import { defaultImages } from "./data/defaultImages.js";

export function initializeApp() {
  wireEvents();
  updateRecordingAvailability();
  loadModel(async () => {
    if (state.currentImage) {
      await detectObjects(openLesson);
    }
  });
}

function wireEvents() {
  const fallbackToUpload = () => elements.uploadInput.click();

  elements.cameraButton.addEventListener("click", () => openCamera(fallbackToUpload));
  elements.uploadButton.addEventListener("click", () => elements.uploadInput.click());
  elements.replaceCameraButton.addEventListener("click", () => openCamera(fallbackToUpload));
  elements.replaceUploadButton.addEventListener("click", () => elements.uploadInput.click());
  elements.resetButton.addEventListener("click", resetScene);
  elements.uploadInput.addEventListener("change", handleImageUpload);
  elements.closeCameraButton.addEventListener("click", closeCamera);
  elements.captureButton.addEventListener("click", () => captureFromCamera(handleSceneImage));
  elements.closeTeachButton.addEventListener("click", closeLesson);
  elements.speakButton.addEventListener("click", () => playLesson("normal"));
  elements.slowSpeakButton.addEventListener("click", () => playLesson("slow"));
  elements.beatsButton.addEventListener("click", () => playLesson("beats"));
  elements.recordButton.addEventListener("click", toggleRecording);

  defaultImages.forEach((src) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "Default sample photo";
    img.className = "default-image-thumb";
    img.addEventListener("click", () => handleSceneImage(src));
    if (elements.defaultImagesGrid) {
      elements.defaultImagesGrid.appendChild(img);
    }
  });

  window.addEventListener("resize", () => renderDetections(openLesson));
  window.addEventListener("beforeunload", () => {
    closeCamera();
    closeLesson();
    stopRecording();
    stopSpeaking();
  });
}

function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => handleSceneImage(reader.result);
  reader.readAsDataURL(file);
  elements.uploadInput.value = "";
}

function handleSceneImage(src) {
  closeLesson();
  loadSceneImage(src, async () => {
    await detectObjects(openLesson);
  });
}

function resetScene() {
  closeCamera();
  closeLesson();
  stopRecording();
  stopSpeaking();
  state.currentImage = null;
  state.currentLesson = null;
  elements.sceneImage.removeAttribute("src");
  elements.emptyState.classList.remove("hidden");
  elements.workspace.classList.add("hidden");
  renderDetections(openLesson);
}
