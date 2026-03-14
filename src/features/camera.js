import { elements } from "../dom.js";
import { state } from "../state.js";

export async function openCamera(fallbackToUpload) {
  if (!navigator.mediaDevices?.getUserMedia) {
    fallbackToUpload();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: "environment"
        }
      },
      audio: false
    });
    state.activeStream = stream;
    elements.cameraPreview.srcObject = stream;
    elements.cameraSheet.classList.remove("hidden");
  } catch (error) {
    console.error("Camera unavailable", error);
    fallbackToUpload();
  }
}

export function closeCamera() {
  if (state.activeStream) {
    state.activeStream.getTracks().forEach((track) => track.stop());
    state.activeStream = null;
  }

  elements.cameraPreview.srcObject = null;
  elements.cameraSheet.classList.add("hidden");
}

export function captureFromCamera(onCapture) {
  const video = elements.cameraPreview;
  if (!video.videoWidth || !video.videoHeight) {
    return;
  }

  const canvas = elements.captureCanvas;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  closeCamera();
  onCapture(dataUrl);
}
