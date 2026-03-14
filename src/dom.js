export const elements = {
  emptyState: document.getElementById("emptyState"),
  workspace: document.getElementById("workspace"),
  workspaceHint: document.getElementById("workspaceHint"),
  sceneImage: document.getElementById("sceneImage"),
  detectionLayer: document.getElementById("detectionLayer"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  uploadInput: document.getElementById("uploadInput"),
  cameraButton: document.getElementById("cameraButton"),
  uploadButton: document.getElementById("uploadButton"),
  replaceCameraButton: document.getElementById("replaceCameraButton"),
  replaceUploadButton: document.getElementById("replaceUploadButton"),
  resetButton: document.getElementById("resetButton"),
  cameraSheet: document.getElementById("cameraSheet"),
  cameraPreview: document.getElementById("cameraPreview"),
  closeCameraButton: document.getElementById("closeCameraButton"),
  captureButton: document.getElementById("captureButton"),
  captureCanvas: document.getElementById("captureCanvas"),
  teachSheet: document.getElementById("teachSheet"),
  closeTeachButton: document.getElementById("closeTeachButton"),
  lessonTitle: document.getElementById("lessonTitle"),
  lessonDescription: document.getElementById("lessonDescription"),
  lessonCrop: document.getElementById("lessonCrop"),
  beatRow: document.getElementById("beatRow"),
  speakButton: document.getElementById("speakButton"),
  slowSpeakButton: document.getElementById("slowSpeakButton"),
  beatsButton: document.getElementById("beatsButton"),
  recordButton: document.getElementById("recordButton"),
  defaultImagesGrid: document.getElementById("defaultImagesGrid")
};

export function showLoader(visible) {
  elements.loadingOverlay.classList.toggle("hidden", !visible);
}

export function clearDetections() {
  elements.detectionLayer.replaceChildren();
}

export function renderBeats(count) {
  const dots = Array.from({ length: count }, () => {
    const dot = document.createElement("span");
    dot.className = "beat";
    return dot;
  });
  elements.beatRow.replaceChildren(...dots);
}

export function setTalking(active) {
  setLessonDescription(
    active ? "Playing audio..." : "Choose an action below."
  );
}

export function activateBeat(index) {
  Array.from(elements.beatRow.children).forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === index);
  });
}

export function clearBeatHighlights() {
  Array.from(elements.beatRow.children).forEach((dot) => dot.classList.remove("active"));
}

export function setWorkspaceHint(message) {
  elements.workspaceHint.textContent = message;
}

export function setLessonDescription(message, tone = "neutral", icon = "") {
  elements.lessonDescription.className = `lesson-description ${tone}`;
  if (icon) {
    elements.lessonDescription.innerHTML = `<span class="feedback-icon">${icon}</span> <span>${message}</span>`;
  } else {
    elements.lessonDescription.textContent = message;
  }

  const teachCard = elements.teachSheet?.querySelector(".teach-card");
  if (teachCard) {
    teachCard.classList.remove("success-card", "error-card");
    if (tone === "success") {
      teachCard.classList.add("success-card");
    } else if (tone === "error") {
      teachCard.classList.add("error-card");
    }
  }
}

export function buildCropDataUrl(bbox) {
  const [x, y, width, height] = bbox;
  const source = elements.sceneImage;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const padding = Math.max(width, height) * 0.15;
  const sx = Math.max(0, x - padding);
  const sy = Math.max(0, y - padding);
  const sw = Math.min(source.naturalWidth - sx, width + padding * 2);
  const sh = Math.min(source.naturalHeight - sy, height + padding * 2);

  canvas.width = sw;
  canvas.height = sh;
  context.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
