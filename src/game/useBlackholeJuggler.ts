import { useEffect, useRef, useState, RefObject } from 'react';
import { GAME_CONSTANTS } from './constants';
import { initHandTracking, updateHandInput } from './handInput';
import { updatePhysics } from './physics';
import { renderGame } from './render';
import { createInitialState, resetRound } from './state';
import { GameState } from './types';

export function useBlackholeJuggler(
    canvasRef: RefObject<HTMLCanvasElement>,
    videoRef: RefObject<HTMLVideoElement>
) {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [debugInfo, setDebugInfo] = useState<string>('');

    // Refs for loop state to avoid closure staleness in RAF
    const stateRef = useRef<GameState | null>(null);
    const requestRef = useRef<number>();
    const lastTimeRef = useRef<number>(0);

    // Initialize on mount
    useEffect(() => {
        const init = async () => {
            if (!canvasRef.current || !videoRef.current) return;

            const { width, height } = canvasRef.current.getBoundingClientRect();
            // Set canvas internal resolution to match display size for sharpness
            canvasRef.current.width = width;
            canvasRef.current.height = height;

            // Create initial state
            const initial = createInitialState(width, height);
            stateRef.current = initial;
            setGameState(initial);

            // Start Webcam
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, frameRate: 30 }
                });
                videoRef.current.srcObject = stream;
                await new Promise((resolve) => {
                    if (videoRef.current) {
                        videoRef.current.onloadedmetadata = () => {
                            videoRef.current?.play().then(resolve);
                        };
                    }
                });

                await initHandTracking();
                console.log('Hand tracking initialized');

                // Start Loop
                requestRef.current = requestAnimationFrame(loop);
            } catch (err) {
                console.error('Failed to init game/webcam:', err);
                setDebugInfo('Error: ' + err);
            }
        };

        init();

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            // Clean up stream?
            if (videoRef.current?.srcObject) {
                const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
                tracks.forEach(track => track.stop());
            }
            // Clean up resize listener
            window.removeEventListener('resize', handleResize);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handle window resize to fix fullscreen distortion
    const handleResize = () => {
        if (!canvasRef.current) return;
        const { width, height } = canvasRef.current.getBoundingClientRect();
        canvasRef.current.width = width;
        canvasRef.current.height = height;
    };

    // Add resize listener on mount
    useEffect(() => {
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const loop = async (time: number) => {
        if (!stateRef.current || !canvasRef.current || !videoRef.current) return;

        // Calculate DT
        let dt = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;
        if (dt > 0.05) dt = 0.05; // Cap dt for lag spikes

        const width = canvasRef.current.width;
        const height = canvasRef.current.height;
        const ctx = canvasRef.current.getContext('2d');

        // 1. Input
        const hand = await updateHandInput(videoRef.current, width, height);

        // 2. State Updates
        let nextState = { ...stateRef.current };

        // Handle Hand Interaction
        if (hand.hasHand) {
            // INIT -> START transition
            if (nextState.phase === 'INIT') {
                nextState.phase = 'START';
            }

            // Update Hole Position
            if (hand.cursor) {
                nextState.hole.pos = hand.cursor;
            }

            // Update Hole Mode (Pinch)
            nextState.hole.mode = hand.isPinched ? 'REPEL' : 'ATTRACT';

            // START -> PLAYING transition (Pinch to start)
            // RESULT -> START transition (Pinch to retry)
            // We detect "just pinched" edge cases in the logic or simply:
            // If we are in START and pinching, start game.
            if (nextState.phase === 'START' && hand.isPinched) {
                nextState = resetRound(nextState, width, height);
            } else if ((nextState.phase === 'RESULT' || nextState.phase === 'VICTORY') && hand.isPinched) {
                // Restart from START
                const fresh = createInitialState(width, height);
                nextState = { ...fresh, phase: 'START', bestScore: nextState.bestScore };
            }
        } else {
            // If tracking lost, maybe pause? Or just let gravity continue at last known point?
            // For now, let it run.
        }

        // Physics Update
        nextState = updatePhysics(nextState, dt, width, height);

        // Save best time on VICTORY
        if (nextState.phase === 'VICTORY' && stateRef.current.phase === 'PLAYING') {
            const currentTime = nextState.elapsedTime;
            const bestTime = parseFloat(localStorage.getItem('blackhole_juggler_best_time') || '999999');
            if (currentTime < bestTime) {
                localStorage.setItem('blackhole_juggler_best_time', currentTime.toString());
                nextState.bestScore = currentTime; // Re-use bestScore for best time display
            }
            console.log('VICTORY! Time:', currentTime.toFixed(2), 'Best:', Math.min(currentTime, bestTime).toFixed(2));
        }

        // Handle game over (legacy score handling)
        if (nextState.phase === 'RESULT' && stateRef.current.phase === 'PLAYING') {
            console.log('GAME OVER - Hit wall');
        }

        stateRef.current = nextState;
        // Sync to React state occasionally for HUD (e.g. every frame or throttled? Every frame is fine for simple HUD)
        setGameState(nextState);
        setDebugInfo(`FPS: ${Math.round(1 / dt)} | Hand: ${hand.hasHand ? 'Yes' : 'No'} | Pinch: ${hand.isPinched ? 'ON' : 'OFF'} (Ratio: ${hand.rawPinchRatio?.toFixed(2) ?? 'N/A'})`);

        // 3. Render
        if (ctx) {
            renderGame(ctx, nextState, width, height);
        }

        requestRef.current = requestAnimationFrame(loop);
    };

    return {
        gameState,
        debugInfo
    };
}
