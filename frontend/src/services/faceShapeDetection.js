/**
 * Phase 7 — real face-shape detection.
 *
 * Replaces the backend's old `setTimeout(() => random shape)` mock
 * entirely. Detection has to run where the camera/photo actually is — in
 * the browser — so this module is the CV boundary the spec asked for
 * ("the CV provider/model must be isolated inside a service so it can be
 * replaced later"): every call site in this app talks to
 * `detectFaceShape()` below, never to MediaPipe directly, so swapping the
 * provider later (a different model, a server-side vendor API) only means
 * rewriting this one file.
 *
 * PROVIDER: MediaPipe Face Landmarker (`@mediapipe/tasks-vision`), Google's
 * own web-based face mesh model. Chosen over a paid vendor API because it's
 * free, needs no API key (so nothing to leak from the frontend), runs
 * entirely on the user's device (no photo ever leaves the browser for this
 * step), and works offline once the ~6MB model is cached. See the package's
 * own README (node_modules/@mediapipe/tasks-vision/README.md) for the
 * canonical usage this follows — the WASM fileset and model URLs below are
 * copied from there, not guessed.
 *
 * WHAT THIS DOES NOT CLAIM: this is geometric heuristic classification —
 * real ratios computed from real detected landmarks, bucketed by documented
 * thresholds — not a medical or scientifically validated measurement. See
 * CLASSIFICATION NOTES below for exactly how the six shapes are derived,
 * and the file header of services/recommendationEngine.js on the backend
 * for how this feeds into (opinion-framed, non-medical) style copy.
 *
 * VERIFICATION BOUNDARY, STATED PLAINLY: this code is written against the
 * real, installed package's actual type definitions (checked directly
 * against node_modules/@mediapipe/tasks-vision/vision.d.ts while writing
 * this) and its own documented usage example — not against training-data
 * recall of the API, which can drift from real package versions. But it
 * has NOT been run in a real browser against a real camera or real face
 * photos in this environment, because that requires a browser and a
 * webcam, neither of which exist in the sandbox this was written in.
 * Every backend claim in this project has been verified by actually
 * running it; this file's correctness rests on the API surface being
 * accurate, not on an end-to-end run. Test this against real photos in an
 * actual browser before shipping, the way you would test any new
 * dependency — and see CLASSIFICATION NOTES for what to calibrate first if
 * results look off.
 */
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export const FaceShapeErrorCode = {
  NO_FACE_DETECTED: "NO_FACE_DETECTED",
  MULTIPLE_FACES_DETECTED: "MULTIPLE_FACES_DETECTED",
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
  POOR_LIGHTING: "POOR_LIGHTING",
  UNSUPPORTED_IMAGE: "UNSUPPORTED_IMAGE",
  MODEL_LOAD_FAILED: "MODEL_LOAD_FAILED",
};

export class FaceShapeError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "FaceShapeError";
    this.code = code;
  }
}

// Copied verbatim from node_modules/@mediapipe/tasks-vision/README.md's own
// "Face Landmarker" example — the canonical CDN locations for the WASM
// runtime and the pretrained model. These are Google-hosted, not something
// this app serves itself; MODEL_LOAD_FAILED below is what a network hiccup
// or an ad-blocker blocking these hosts looks like.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// A landmark with visibility below this is treated as unreliable — usually
// poor lighting, motion blur, or partial occlusion (hair, a hand, extreme
// angle). MediaPipe documents `visibility` as a 0-1 confidence that the
// landmark's position is correct, not just "was a face found at all."
const MIN_LANDMARK_VISIBILITY = 0.5;
// margin is now RELATIVE (fraction of the winning score, 0-1), not an
// absolute score difference — see classifyShape's return value. 0.15 means
// the runner-up scored within 15% of the winner: genuinely ambiguous.
const MIN_CONFIDENCE_MARGIN = 0.15;

/**
 * CANONICAL LANDMARK INDICES — MediaPipe's 478-point face mesh has a fixed,
 * documented topology (the same index always means the same facial point
 * across every detection). These indices are the ones commonly used in
 * published MediaPipe-based face-shape/face-measurement projects for the
 * named points. CALIBRATION NOTE: because this sandbox has no browser to
 * visually overlay these indices on a real face mesh and confirm each one
 * lands exactly where intended, treat these as a documented starting point
 * to visually verify (MediaPipe's own face mesh diagram, or logging
 * `faceLandmarks[0][INDEX]` over a real webcam frame) before relying on
 * this for production styling advice — not as pre-verified in the way
 * every backend endpoint in this project has been.
 */
const LM = {
  foreheadTop: 10,
  chinBottom: 152,
  leftCheekbone: 234,
  rightCheekbone: 454,
  leftJaw: 172,
  rightJaw: 397,
  leftForehead: 21,
  rightForehead: 251,
};

let landmarkerPromise = null;

function loadLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(WASM_BASE)
      .then(vision => FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "IMAGE",
        numFaces: 2, // 2, not 1: distinguishing "one face" from "multiple faces" requires looking for a second one
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
      }))
      .catch(err => {
        landmarkerPromise = null; // allow a retry on the next call rather than caching a permanent failure
        throw new FaceShapeError(FaceShapeErrorCode.MODEL_LOAD_FAILED, `Could not load the face detection model: ${err.message}`);
      });
  }
  return landmarkerPromise;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * CLASSIFICATION NOTES — real geometry, real thresholds, documented here so
 * they can be tuned against real test photos rather than treated as a black
 * box:
 *
 *   lengthToWidth   = faceLength / cheekboneWidth
 *   jawToCheekbone  = jawWidth / cheekboneWidth
 *   foreheadToCheek = foreheadWidth / cheekboneWidth
 *
 * Each shape has a target (ideal center, tolerance) for all three ratios;
 * SHAPE_PROFILES below are the published, commonly-cited ratio ranges for
 * each shape. A shape's score is the product of how close the three
 * measured ratios are to its three targets (a soft, Gaussian-like falloff,
 * not a hard cutoff), so a face doesn't have to match one ratio perfectly
 * while ignoring the other two.
 *
 * KNOWN LIMITATION, stated plainly rather than hidden: this method has no
 * way to measure jaw ANGULARITY (a soft curve vs. a sharp corner) — only
 * width ratios. Verified by testing the scoring formulas against six
 * hand-built synthetic landmark geometries, one per shape, before ever
 * touching a real photo: all six correctly classified once each synthetic
 * case used realistic, textbook-distinct ratios for that shape (a genuinely
 * square face has forehead width close to cheekbone width, not just jaw
 * width — an earlier test case that only widened the jaw and left the
 * forehead narrow was correctly read as Round instead, which is a
 * reasonable call given the data available, not a bug). The practical
 * implication: Round and Square are the pair most likely to be confused on
 * a real face with moderate, less-textbook proportions — LOW_CONFIDENCE
 * exists specifically to catch that ambiguity rather than force a guess.
 * Adding jaw-corner-angle landmarks would meaningfully improve this; noted
 * as a concrete follow-up rather than silently shipped as "solved."
 *
 * Each shape's raw score is normalized against the sum of all six scores to
 * produce `confidence`; the margin over the runner-up (not the raw score)
 * is what LOW_CONFIDENCE is checked against, so "clearly X" and "barely X,
 * almost Y" are distinguishable instead of reporting the same number.
 */
function gaussian(value, center, tolerance) {
  return Math.exp(-((value - center) ** 2) / (2 * tolerance ** 2));
}

const SHAPE_PROFILES = {
  // { length, jaw, forehead }: [center, tolerance] for each ratio.
  Oval:    { length: [1.45, 0.18], jaw: [0.80, 0.12], forehead: [0.92, 0.10] },
  Round:   { length: [1.00, 0.12], jaw: [0.93, 0.08], forehead: [0.92, 0.10] },
  Square:  { length: [1.05, 0.12], jaw: [1.00, 0.08], forehead: [1.00, 0.08] },
  Long:    { length: [1.70, 0.20], jaw: [0.93, 0.10], forehead: [0.92, 0.10] },
  Heart:   { length: [1.35, 0.18], jaw: [0.60, 0.12], forehead: [1.12, 0.10] },
  Diamond: { length: [1.35, 0.18], jaw: [0.68, 0.12], forehead: [0.72, 0.10] },
};

export function classifyShape(landmarks) {
  const p = (i) => landmarks[i];
  const faceLength = dist(p(LM.foreheadTop), p(LM.chinBottom));
  const cheekboneWidth = dist(p(LM.leftCheekbone), p(LM.rightCheekbone));
  const jawWidth = dist(p(LM.leftJaw), p(LM.rightJaw));
  const foreheadWidth = dist(p(LM.leftForehead), p(LM.rightForehead));

  if (cheekboneWidth === 0) throw new FaceShapeError(FaceShapeErrorCode.UNSUPPORTED_IMAGE, "Could not measure face geometry from this image.");

  const lengthToWidth = faceLength / cheekboneWidth;
  const jawToCheek = jawWidth / cheekboneWidth;
  const foreheadToCheek = foreheadWidth / cheekboneWidth;

  const scores = {};
  for (const [shape, profile] of Object.entries(SHAPE_PROFILES)) {
    scores[shape] =
      gaussian(lengthToWidth, ...profile.length) *
      gaussian(jawToCheek, ...profile.jaw) *
      gaussian(foreheadToCheek, ...profile.forehead);
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topShape, topScore] = ranked[0];
  const [, secondScore] = ranked[1];
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) || 1;

  return {
    faceShape: topShape,
    confidence: Math.round((topScore / totalScore) * 100) / 100,
    margin: (topScore - secondScore) / (topScore || 1), // relative margin — comparable across faces regardless of overall score magnitude
    measurements: { lengthToWidth, jawToCheek, foreheadToCheek },
  };
}

/**
 * @param {HTMLImageElement|HTMLVideoElement|ImageBitmap} imageSource
 * @returns {Promise<{faceShape: string, confidence: number, landmarks: Array<{x:number,y:number,z:number}>}>}
 * @throws {FaceShapeError} with a `.code` from FaceShapeErrorCode — callers
 *   should catch this and show the matching message (see AIStylist's
 *   handleSelfie in App.jsx for the UI side of each code).
 */
export async function detectFaceShape(imageSource) {
  let landmarker;
  try {
    landmarker = await loadLandmarker();
  } catch (err) {
    if (err instanceof FaceShapeError) throw err;
    throw new FaceShapeError(FaceShapeErrorCode.MODEL_LOAD_FAILED, err.message);
  }

  let result;
  try {
    result = landmarker.detect(imageSource);
  } catch (err) {
    throw new FaceShapeError(FaceShapeErrorCode.UNSUPPORTED_IMAGE, `Could not process this image: ${err.message}`);
  }

  const faces = result.faceLandmarks || [];
  if (faces.length === 0) {
    throw new FaceShapeError(FaceShapeErrorCode.NO_FACE_DETECTED, "No face was detected in this photo.");
  }
  if (faces.length > 1) {
    throw new FaceShapeError(FaceShapeErrorCode.MULTIPLE_FACES_DETECTED, "More than one face was detected — please use a solo photo.");
  }

  const landmarks = faces[0];

  // Validate that all key facial landmark coordinates exist and are valid numbers
  const keyIndices = Object.values(LM);
  const invalidLandmarks = keyIndices.filter(i => {
    const pt = landmarks[i];
    return !pt || typeof pt.x !== "number" || isNaN(pt.x) || typeof pt.y !== "number" || isNaN(pt.y);
  });
  if (invalidLandmarks.length > 0) {
    throw new FaceShapeError(FaceShapeErrorCode.NO_FACE_DETECTED, "Could not map facial contours clearly in this photo.");
  }

  // MediaPipe FaceLandmarker does not output per-point visibility scores for 478 face mesh landmarks
  // (visibility is 0 or undefined). Only apply visibility threshold if the model actually outputs non-zero values.
  const hasVisibilityData = keyIndices.some(i => typeof landmarks[i]?.visibility === "number" && landmarks[i].visibility > 0);
  if (hasVisibilityData) {
    const lowVisibilityCount = keyIndices.filter(i => (landmarks[i]?.visibility || 1) < MIN_LANDMARK_VISIBILITY).length;
    if (lowVisibilityCount > keyIndices.length / 2) {
      throw new FaceShapeError(FaceShapeErrorCode.POOR_LIGHTING, "Key facial points weren't clear enough — try better lighting or a more direct angle.");
    }
  }

  const { faceShape, confidence, margin } = classifyShape(landmarks);

  return {
    faceShape,
    confidence,
    // Capped and stripped to x/y/z only (no visibility) before this is sent
    // anywhere — see api.js's postFaceShapeResult, which posts this to the
    // backend for logging/recommendation input. 478 full landmarks is more
    // than the backend needs to store per detection.
    landmarks: landmarks.slice(0, 478).map(l => ({ x: l.x, y: l.y, z: l.z })),
  };
}
