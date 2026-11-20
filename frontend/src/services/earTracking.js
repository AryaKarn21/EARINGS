/**
 * Phase 8 — real-time ear tracking for the camera and photo try-on flow.
 *
 * Wraps MediaPipe Face Landmarker in VIDEO running mode
 * (`detectForVideo`) in a requestAnimationFrame loop, feeding each frame's
 * landmarks through earGeometry.js's anatomical math to produce ear
 * anchors, scale factors, head yaw and roll, and coordinate mappings.
 */
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { computeEarAnchors, scaleRelativeToBaseline, EAR_LANDMARKS } from "./earGeometry.js";

export const TrackingStatus = {
  TRACKING: "TRACKING",       // A face is detected and anchors are fresh this frame
  NO_FACE: "NO_FACE",         // No face in current frame
  LOW_VISIBILITY: "LOW_VISIBILITY", // Face detected but key points are unreliable (poor lighting, severe occlusion)
};

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const MIN_LANDMARK_VISIBILITY = 0.4;

let videoLandmarkerPromise = null;

function loadVideoLandmarker() {
  if (!videoLandmarkerPromise) {
    videoLandmarkerPromise = FilesetResolver.forVisionTasks(WASM_BASE)
      .then(async (vision) => {
        try {
          return await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
            runningMode: "VIDEO",
            numFaces: 1,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        } catch (gpuErr) {
          console.warn("MediaPipe GPU delegate unavailable, falling back to CPU delegate:", gpuErr);
          return await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
            runningMode: "VIDEO",
            numFaces: 1,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        }
      })
      .catch(err => {
        videoLandmarkerPromise = null;
        throw err;
      });
  }
  return videoLandmarkerPromise;
}

/**
 * Starts continuous per-frame tracking against a live <video> element.
 *
 * @param {HTMLVideoElement} videoEl
 * @param {(frame: {
 *   status: string,
 *   wearerRight?: {x: number, y: number, z: number, visible: boolean},
 *   wearerLeft?: {x: number, y: number, z: number, visible: boolean},
 *   scale?: number,
 *   yawDeg?: number,
 *   rollDeg?: number,
 *   faceHeight?: number,
 *   keyLandmarks?: object,
 *   videoWidth?: number,
 *   videoHeight?: number,
 *   left?: {x: number, y: number, visible: boolean},
 *   right?: {x: number, y: number, visible: boolean}
 * }) => void} onFrame
 * @param {(error: Error) => void} onError
 * @returns {() => void} stop function
 */
export function startEarTracking(videoEl, { onFrame, onError }) {
  let stopped = false;
  let rafId = null;
  let baselineScale = null;

  loadVideoLandmarker()
    .then(landmarker => {
      if (stopped) return;

      const loop = () => {
        if (stopped) return;
        rafId = requestAnimationFrame(loop);

        if (videoEl.readyState < 2) return;

        let result;
        try {
          result = landmarker.detectForVideo(videoEl, performance.now());
        } catch {
          onFrame({ status: TrackingStatus.NO_FACE });
          return;
        }

        const faces = result.faceLandmarks || [];
        if (faces.length === 0) {
          onFrame({ status: TrackingStatus.NO_FACE });
          return;
        }

        const landmarks = faces[0];

        const {
          wearerRight,
          wearerLeft,
          necklace,
          faceHeight,
          yawDeg,
          rollDeg,
          scale,
          keyLandmarks,
          left,
          right,
        } = computeEarAnchors(landmarks, { mirrorX: true });

        if (baselineScale === null) baselineScale = scale;
        const relativeScale = scaleRelativeToBaseline(scale, baselineScale);

        onFrame({
          status: TrackingStatus.TRACKING,
          wearerRight,
          wearerLeft,
          necklace,
          scale: relativeScale,
          yawDeg,
          rollDeg,
          faceHeight,
          keyLandmarks,
          videoWidth: videoEl.videoWidth || 640,
          videoHeight: videoEl.videoHeight || 480,
          left,
          right,
        });
      };

      rafId = requestAnimationFrame(loop);
    })
    .catch(err => onError?.(err));

  return function stop() {
    stopped = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}

/**
 * Single-shot detection for uploaded-photo try-on.
 */
export async function detectEarAnchorsFromImage(imgEl) {
  const landmarker = await loadVideoLandmarker();
  let result;
  try {
    result = landmarker.detectForVideo(imgEl, performance.now());
  } catch {
    return { status: TrackingStatus.NO_FACE };
  }
  const faces = result.faceLandmarks || [];
  if (faces.length === 0) return { status: TrackingStatus.NO_FACE };

  const landmarks = faces[0];

  const {
    wearerRight,
    wearerLeft,
    necklace,
    faceHeight,
    yawDeg,
    rollDeg,
    keyLandmarks,
    left,
    right,
  } = computeEarAnchors(landmarks, { mirrorX: false });

  return {
    status: TrackingStatus.TRACKING,
    wearerRight,
    wearerLeft,
    necklace,
    scale: 1,
    yawDeg,
    rollDeg,
    faceHeight,
    keyLandmarks,
    videoWidth: imgEl.naturalWidth || imgEl.width || 640,
    videoHeight: imgEl.naturalHeight || imgEl.height || 480,
    left,
    right,
  };
}
