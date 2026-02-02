import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import '@tensorflow/tfjs';
// We need to import the backend. The prompt mentioned @mediapipe/hands but tfjs-core + mediator usually handles it.
// Assuming 'mediapipe' runtime is preferred if available, or 'tfjs'
import { GAME_CONSTANTS } from './constants';
import { HandInput, Vector2 } from './types';

let detector: handPoseDetection.HandDetector | null = null;
let lastCursor: Vector2 | null = null;
let isPinched = false;
let lastHandTime = 0;

export async function initHandTracking() {
    const model = handPoseDetection.SupportedModels.MediaPipeHands;
    const detectorConfig: handPoseDetection.MediaPipeHandsMediaPipeModelConfig = {
        runtime: 'mediapipe', // or 'tfjs'
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
        modelType: 'full',
    };
    detector = await handPoseDetection.createDetector(model, detectorConfig);
}

export async function updateHandInput(
    video: HTMLVideoElement,
    canvasWidth: number,
    canvasHeight: number
): Promise<HandInput> {
    if (!detector || !video || video.readyState < 2) {
        return { hasHand: false, cursor: lastCursor, isPinched };
    }

    const now = performance.now();
    let hands: handPoseDetection.Hand[] = [];

    try {
        hands = await detector.estimateHands(video, { flipHorizontal: true });
    } catch (e) {
        console.error('Hand detection failed:', e);
        return { hasHand: false, cursor: lastCursor, isPinched };
    }

    if (hands.length === 0) {
        if (now - lastHandTime > GAME_CONSTANTS.HAND_TIMEOUT) {
            return { hasHand: false, cursor: lastCursor, isPinched: false }; // Lost hand
        }
        return { hasHand: true, cursor: lastCursor, isPinched }; // Keep last known state briefly
    }

    lastHandTime = now;
    const hand = hands[0]; // Tracking first hand

    // Keypoints: 
    // 0: Wrist
    // 4: Thumb Tip
    // 5: Index Finger MCP
    // 8: Index Finger Tip

    const wrist = hand.keypoints[0];
    const thumbTip = hand.keypoints[4];
    const indexMCP = hand.keypoints[5];
    const indexTip = hand.keypoints[8];

    // 1. Map Coordinates (Video -> Canvas)
    // Assuming video fills screen or we scale purely by ratio
    // Video keypoints are in video pixel space.
    const scaleX = canvasWidth / video.videoWidth;
    const scaleY = canvasHeight / video.videoHeight;

    // Note: keypoints are already flipped if flipHorizontal: true in estimateHands? 
    // Usually estimateHands flips the IMAGE data logic, so x grows left-to-right as expected for a mirror?
    // Let's assume standard behavior: result x is 0..videoWidth.
    // BUT we passed flipHorizontal: true, so let's verify. 
    // Standard TFJS behavior: flipHorizontal mirrors the input so output coords match the mirrored image. 
    // So we just scale directly.

    const targetXRaw = indexTip.x * scaleX;
    const targetYRaw = indexTip.y * scaleY;

    // Center-based scaling for sensitivity
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    const sensitivity = GAME_CONSTANTS.INPUT_SENSITIVITY;

    const targetX = cx + (targetXRaw - cx) * sensitivity;
    const targetY = cy + (targetYRaw - cy) * sensitivity;

    // 2. Smooth Cursor
    if (!lastCursor) {
        lastCursor = { x: targetX, y: targetY };
    } else {
        const alpha = GAME_CONSTANTS.CURSOR_SMOOTHING;
        lastCursor.x = lastCursor.x * (1 - alpha) + targetX * alpha;
        lastCursor.y = lastCursor.y * (1 - alpha) + targetY * alpha;
    }

    // 3. Adaptive Pinch Detection
    const dx = indexTip.x - thumbTip.x;
    const dy = indexTip.y - thumbTip.y;
    const pinchDist = Math.sqrt(dx * dx + dy * dy);

    const wx = wrist.x - indexMCP.x;
    const wy = wrist.y - indexMCP.y;
    const handSize = Math.sqrt(wx * wx + wy * wy);

    const ratio = handSize > 0 ? pinchDist / handSize : 1;

    if (!isPinched && ratio < GAME_CONSTANTS.PINCH_ON_RATIO) {
        isPinched = true;
    } else if (isPinched && ratio > GAME_CONSTANTS.PINCH_OFF_RATIO) {
        isPinched = false;
    }

    return {
        hasHand: true,
        cursor: { ...lastCursor },
        isPinched,
        rawPinchRatio: ratio,
    };
}
