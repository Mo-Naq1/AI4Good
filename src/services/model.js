import { state } from "../state.js";
import { showLoader } from "../dom.js";

export async function loadModel(onReady) {
  state.modelLoading = true;
  showLoader(true);

  try {
    state.model = await cocoSsd.load({
      base: "mobilenet_v2"
    });

    if (onReady) {
      await onReady();
    }
  } catch (error) {
    console.error("Model failed to load", error);
  } finally {
    state.modelLoading = false;
    showLoader(false);
  }
}
