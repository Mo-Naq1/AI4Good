import { COMMON_OBJECTS } from "../data/commonObjects.js";
import {
  clearDetections,
  elements,
  setWorkspaceHint,
  showLoader
} from "../dom.js";
import { state } from "../state.js";

const FULL_PASS_MAX_SIDE = 1400;
const TILE_PASS_MAX_SIDE = 1100;
const OUTPUT_SCORE_THRESHOLD = 0.28;
const DUPLICATE_IOU_THRESHOLD = 0.44;
const CONTAINMENT_DUPLICATE_THRESHOLD = 0.72;
const SAME_CENTER_DISTANCE_THRESHOLD = 0.12;
const MIN_RENDER_SIZE = 26;

export async function loadSceneImage(src, onReady) {
  elements.sceneImage.onload = async () => {
    state.currentImage = {
      src,
      width: elements.sceneImage.naturalWidth,
      height: elements.sceneImage.naturalHeight,
      detections: []
    };
    elements.emptyState.classList.add("hidden");
    elements.workspace.classList.remove("hidden");

    if (onReady) {
      await onReady();
    }
  };

  elements.sceneImage.src = src;
}

export async function detectObjects(openLesson) {
  if (!state.currentImage) {
    return;
  }

  if (!state.model) {
    showLoader(state.modelLoading);
    return;
  }

  showLoader(true);
  clearDetections();

  try {
    const predictions = await runDetectionPasses();
    state.currentImage.detections = postProcessDetections(
      predictions
      .map(normalizePrediction)
      .filter(Boolean)
      .filter((item) => item.score >= OUTPUT_SCORE_THRESHOLD)
    );
  } catch (error) {
    console.error("Detection failed", error);
    state.currentImage.detections = [];
  } finally {
    renderDetections(openLesson);
    showLoader(false);
  }
}

export function renderDetections(openLesson) {
  clearDetections();

  if (!state.currentImage?.detections?.length) {
    if (state.currentImage) {
      setWorkspaceHint("No supported objects found. Try a different photo.");
    }
    return;
  }

  setWorkspaceHint("Tap an object box to open the lesson.");

  const frameRect = elements.detectionLayer.getBoundingClientRect();
  const naturalWidth = elements.sceneImage.naturalWidth;
  const naturalHeight = elements.sceneImage.naturalHeight;

  if (!frameRect.width || !frameRect.height || !naturalWidth || !naturalHeight) {
    return;
  }

  const scale = Math.min(frameRect.width / naturalWidth, frameRect.height / naturalHeight);
  const renderedWidth = naturalWidth * scale;
  const renderedHeight = naturalHeight * scale;
  const offsetX = Math.max(0, (frameRect.width - renderedWidth) / 2);
  const offsetY = Math.max(0, (frameRect.height - renderedHeight) / 2);

  state.currentImage.detections.forEach((item, index) => {
    const [x, y, width, height] = item.bbox;
    const clipped = clipRect(
      x * scale + offsetX,
      y * scale + offsetY,
      width * scale,
      height * scale,
      frameRect.width,
      frameRect.height
    );

    if (clipped.width < MIN_RENDER_SIZE || clipped.height < MIN_RENDER_SIZE) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "detection-hit";
    button.style.left = `${clipped.x}px`;
    button.style.top = `${clipped.y}px`;
    button.style.width = `${clipped.width}px`;
    button.style.height = `${clipped.height}px`;
    button.setAttribute("aria-label", `Learn ${item.word}`);
    const label = document.createElement("span");
    label.textContent = item.word;
    button.appendChild(label);
    button.addEventListener("click", () => openLesson(index));
    elements.detectionLayer.appendChild(button);
  });
}

function normalizePrediction(prediction) {
  const key = prediction.class.replaceAll(" ", "_");
  const commonObject = COMMON_OBJECTS[key];

  if (!commonObject) {
    return null;
  }

  return {
    key,
    rawKey: key,
    score: prediction.score,
    bbox: prediction.bbox,
    word: commonObject.word,
    beats: commonObject.beats
  };
}

function postProcessDetections(detections) {
  const scene = buildSceneContext(detections);
  return detections
    .map((item) => relabelFromContext(item, detections, scene))
    .sort((left, right) => right.score - left.score)
    .filter((item, index, items) => !isDuplicateDetection(item, items, index));
}

async function runDetectionPasses() {
  const passes = buildDetectionPasses(
    state.currentImage.width,
    state.currentImage.height
  );
  const detections = [];

  for (const pass of passes) {
    const { canvas, scaleX, scaleY } = buildPassCanvas(pass);
    const predictions = await state.model.detect(
      canvas,
      pass.maxPredictions,
      pass.minScore
    );

    predictions.forEach((prediction) => {
      detections.push({
        class: prediction.class,
        score: prediction.score,
        bbox: [
          pass.x + prediction.bbox[0] * scaleX,
          pass.y + prediction.bbox[1] * scaleY,
          prediction.bbox[2] * scaleX,
          prediction.bbox[3] * scaleY
        ]
      });
    });
  }

  return detections;
}

function buildDetectionPasses(width, height) {
  const tileWidth = Math.min(width, Math.round(width * 0.62));
  const tileHeight = Math.min(height, Math.round(height * 0.62));
  const xPositions = buildAxisPositions(width, tileWidth);
  const yPositions = buildAxisPositions(height, tileHeight);
  const passes = [
    {
      x: 0,
      y: 0,
      width,
      height,
      maxSide: FULL_PASS_MAX_SIDE,
      maxPredictions: 30,
      minScore: 0.14
    }
  ];

  xPositions.forEach((x) => {
    yPositions.forEach((y) => {
      if (x === 0 && y === 0 && tileWidth === width && tileHeight === height) {
        return;
      }

      passes.push({
        x,
        y,
        width: tileWidth,
        height: tileHeight,
        maxSide: TILE_PASS_MAX_SIDE,
        maxPredictions: 18,
        minScore: 0.1
      });
    });
  });

  return passes;
}

function buildAxisPositions(total, windowSize) {
  if (windowSize >= total) {
    return [0];
  }

  const end = total - windowSize;
  const middle = Math.round(end / 2);
  return [...new Set([0, middle, end])];
}

function buildPassCanvas(pass) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const scale = Math.min(1, pass.maxSide / Math.max(pass.width, pass.height));

  canvas.width = Math.max(1, Math.round(pass.width * scale));
  canvas.height = Math.max(1, Math.round(pass.height * scale));
  context.drawImage(
    elements.sceneImage,
    pass.x,
    pass.y,
    pass.width,
    pass.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return {
    canvas,
    scaleX: pass.width / canvas.width,
    scaleY: pass.height / canvas.height
  };
}

function isDuplicateDetection(item, items, index) {
  for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
    const previous = items[previousIndex];
    if (shouldMergeDetections(previous, item)) {
      return true;
    }
  }

  return false;
}

function shouldMergeDetections(left, right) {
  if (left.key !== right.key && !areContextuallyEquivalent(left.key, right.key)) {
    return false;
  }

  const iou = intersectionOverUnion(left.bbox, right.bbox);
  if (iou >= DUPLICATE_IOU_THRESHOLD) {
    return true;
  }

  const containment = containmentRatio(left.bbox, right.bbox);
  if (containment >= CONTAINMENT_DUPLICATE_THRESHOLD) {
    return true;
  }

  const centerDistance = normalizedCenterDistance(left.bbox, right.bbox);
  const areaRatio = areaSimilarity(left.bbox, right.bbox);
  return centerDistance <= SAME_CENTER_DISTANCE_THRESHOLD && areaRatio >= 0.52;
}

function areContextuallyEquivalent(leftKey, rightKey) {
  return (
    (leftKey === "chair" && rightKey === "couch") ||
    (leftKey === "couch" && rightKey === "chair") ||
    (leftKey === "cup" && rightKey === "bottle") ||
    (leftKey === "bottle" && rightKey === "cup") ||
    (leftKey === "trash_can" && rightKey === "cup") ||
    (leftKey === "cup" && rightKey === "trash_can")
  );
}

function intersectionOverUnion(leftBox, rightBox) {
  const [leftX, leftY, leftWidth, leftHeight] = leftBox;
  const [rightX, rightY, rightWidth, rightHeight] = rightBox;
  const overlapX = Math.max(
    0,
    Math.min(leftX + leftWidth, rightX + rightWidth) - Math.max(leftX, rightX)
  );
  const overlapY = Math.max(
    0,
    Math.min(leftY + leftHeight, rightY + rightHeight) - Math.max(leftY, rightY)
  );
  const overlapArea = overlapX * overlapY;

  if (!overlapArea) {
    return 0;
  }

  const leftArea = leftWidth * leftHeight;
  const rightArea = rightWidth * rightHeight;
  return overlapArea / (leftArea + rightArea - overlapArea);
}

function containmentRatio(leftBox, rightBox) {
  const [leftX, leftY, leftWidth, leftHeight] = leftBox;
  const [rightX, rightY, rightWidth, rightHeight] = rightBox;
  const overlapX = Math.max(
    0,
    Math.min(leftX + leftWidth, rightX + rightWidth) - Math.max(leftX, rightX)
  );
  const overlapY = Math.max(
    0,
    Math.min(leftY + leftHeight, rightY + rightHeight) - Math.max(leftY, rightY)
  );
  const overlapArea = overlapX * overlapY;

  if (!overlapArea) {
    return 0;
  }

  const leftArea = leftWidth * leftHeight;
  const rightArea = rightWidth * rightHeight;
  return overlapArea / Math.min(leftArea, rightArea);
}

function normalizedCenterDistance(leftBox, rightBox) {
  const leftCenterX = leftBox[0] + leftBox[2] / 2;
  const leftCenterY = leftBox[1] + leftBox[3] / 2;
  const rightCenterX = rightBox[0] + rightBox[2] / 2;
  const rightCenterY = rightBox[1] + rightBox[3] / 2;
  const dx = leftCenterX - rightCenterX;
  const dy = leftCenterY - rightCenterY;
  const diagonal = Math.hypot(state.currentImage.width, state.currentImage.height);
  return Math.hypot(dx, dy) / diagonal;
}

function areaSimilarity(leftBox, rightBox) {
  const leftArea = leftBox[2] * leftBox[3];
  const rightArea = rightBox[2] * rightBox[3];
  return Math.min(leftArea, rightArea) / Math.max(leftArea, rightArea);
}

function buildSceneContext(detections) {
  const counts = new Map();
  detections.forEach((item) => {
    counts.set(item.key, (counts.get(item.key) || 0) + 1);
  });

  return {
    counts,
    imageArea: state.currentImage.width * state.currentImage.height
  };
}

function relabelFromContext(item, detections, scene) {
  if (item.key === "clock" && looksLikeSmokeDetector(item, scene)) {
    return {
      ...item,
      key: "smoke_detector",
      word: COMMON_OBJECTS.smoke_detector.word,
      beats: COMMON_OBJECTS.smoke_detector.beats,
      score: Math.min(0.99, item.score + 0.04)
    };
  }

  if (item.key !== "cup") {
    return item;
  }

  const itemArea = item.bbox[2] * item.bbox[3];
  const areaRatio = itemArea / scene.imageArea;
  const aspectRatio = item.bbox[3] / Math.max(item.bbox[2], 1);
  const nearKitchenObject = hasNearbyLabel(item, detections, ["sink", "refrigerator", "microwave"]);
  const nearDiningObject = hasNearbyLabel(item, detections, ["dining_table", "chair"]);

  if (
    aspectRatio > 1.15 &&
    areaRatio > 0.045 &&
    nearKitchenObject &&
    !nearDiningObject
  ) {
    return {
      ...item,
      key: "trash_can",
      word: COMMON_OBJECTS.trash_can.word,
      beats: COMMON_OBJECTS.trash_can.beats,
      score: Math.min(0.99, item.score + 0.06)
    };
  }

  if (aspectRatio > 1.45 && areaRatio > 0.02) {
    return {
      ...item,
      key: "bottle",
      word: COMMON_OBJECTS.bottle.word,
      beats: COMMON_OBJECTS.bottle.beats,
      score: Math.min(0.99, item.score + 0.04)
    };
  }

  return item;
}

function hasNearbyLabel(item, detections, labels) {
  return detections.some((other) => {
    if (!labels.includes(other.key) || other === item) {
      return false;
    }

    return normalizedCenterDistance(item.bbox, other.bbox) <= 0.22;
  }) || false;
}

function looksLikeSmokeDetector(item, scene) {
  const [x, y, width, height] = item.bbox;
  const areaRatio = (width * height) / scene.imageArea;
  const aspectRatio = width / Math.max(height, 1);
  const centerYRatio = (y + height / 2) / state.currentImage.height;
  const topEdgeRatio = y / state.currentImage.height;
  const rightEdgeRatio = (x + width) / state.currentImage.width;

  return (
    areaRatio <= 0.02 &&
    aspectRatio >= 0.75 &&
    aspectRatio <= 1.33 &&
    centerYRatio <= 0.22 &&
    topEdgeRatio <= 0.14 &&
    rightEdgeRatio >= 0.18 &&
    rightEdgeRatio <= 0.92
  );
}

function clipRect(x, y, width, height, maxWidth, maxHeight) {
  const clippedX = Math.max(0, x);
  const clippedY = Math.max(0, y);
  const clippedWidth = Math.max(
    0,
    Math.min(x + width, maxWidth) - clippedX
  );
  const clippedHeight = Math.max(
    0,
    Math.min(y + height, maxHeight) - clippedY
  );

  return {
    x: clippedX,
    y: clippedY,
    width: clippedWidth,
    height: clippedHeight
  };
}
