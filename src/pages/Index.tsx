import { useEffect, useRef, useCallback, useState } from 'react';

// ============ TYPES ============
type GameState = 'start' | 'playing' | 'gameover';
type GravityMode = 'attract' | 'repel';
type TrackingStatus = 'loading' | 'active' | 'no-hand' | 'mouse';

interface Vec2 {
  x: number;
  y: number;
}

interface Orb {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  trail: Vec2[];
  hue: number;
}

interface Crack {
  x: number;
  y: number;
  edge: 'top' | 'bottom' | 'left' | 'right';
  timer: number;
  segments: { x1: number; y1: number; x2: number; y2: number }[];
}

interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
}

// ============ CONSTANTS ============
const GRAVITY_CONSTANT = 8000;
const SOFTENING = 50;
const VELOCITY_DAMPING = 0.985;
const ORB_COUNT = 7; // Increased from 4
const ORB_MIN_RADIUS = 14; // Slightly larger
const ORB_MAX_RADIUS = 22; // Slightly larger
const TRAIL_LENGTH = 15;
const ORBIT_INNER = 60;
const ORBIT_OUTER = 180;
// Scaled pinch thresholds - more forgiving
const PINCH_ON_THRESHOLD = 55;
const PINCH_OFF_THRESHOLD = 85;
const LERP_FACTOR = 0.15;
const MAX_DT = 0.05;
const CRACK_DURATION = 0.5;
const MAX_CRACKS = 3;
const STAR_COUNT = 150;
const MODE_SWITCH_DURATION = 0.4;

// ============ HELPERS ============
const vec2 = (x: number, y: number): Vec2 => ({ x, y });
const vecAdd = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
const vecSub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const vecMul = (v: Vec2, s: number): Vec2 => ({ x: v.x * s, y: v.y * s });
const vecLen = (v: Vec2): number => Math.sqrt(v.x * v.x + v.y * v.y);
const vecNorm = (v: Vec2): Vec2 => {
  const len = vecLen(v);
  return len > 0 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

const generateCrackSegments = (x: number, y: number, edge: Crack['edge'], canvasWidth: number, canvasHeight: number) => {
  const segments: Crack['segments'] = [];
  const numSegments = 5 + Math.floor(Math.random() * 4);
  let cx = x, cy = y;
  
  for (let i = 0; i < numSegments; i++) {
    const length = 15 + Math.random() * 25;
    let angle: number;
    
    if (edge === 'top' || edge === 'bottom') {
      angle = (edge === 'top' ? Math.PI / 2 : -Math.PI / 2) + (Math.random() - 0.5) * 0.8;
    } else {
      angle = (edge === 'left' ? 0 : Math.PI) + (Math.random() - 0.5) * 0.8;
    }
    
    const nx = cx + Math.cos(angle) * length;
    const ny = cy + Math.sin(angle) * length;
    
    segments.push({ x1: cx, y1: cy, x2: nx, y2: ny });
    cx = nx;
    cy = ny;
  }
  
  return segments;
};

// ============ MAIN COMPONENT ============
const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<any>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  
  // Game state refs (using refs for animation loop performance)
  const gameStateRef = useRef<GameState>('start');
  const modeRef = useRef<GravityMode>('attract');
  const scoreRef = useRef<number>(0);
  const bestScoreRef = useRef<number>(0);
  const cracksRef = useRef<number>(0);
  const survivalTimeRef = useRef<number>(0);
  const orbitComboRef = useRef<number>(0);
  
  const cursorRef = useRef<Vec2>({ x: 0, y: 0 });
  const targetCursorRef = useRef<Vec2>({ x: 0, y: 0 });
  const isPinchingRef = useRef<boolean>(false);
  const trackingStatusRef = useRef<TrackingStatus>('loading');
  const usingMouseRef = useRef<boolean>(true);
  
  // Mode switch animation
  const modeSwitchAnimRef = useRef<{ timer: number; mode: GravityMode; pos: Vec2 }>({ 
    timer: 0, 
    mode: 'attract',
    pos: { x: 0, y: 0 }
  });
  
  const orbsRef = useRef<Orb[]>([]);
  const cracksVisualRef = useRef<Crack[]>([]);
  const starsRef = useRef<Star[]>([]);
  const shakeRef = useRef<{ x: number; y: number; timer: number }>({ x: 0, y: 0, timer: 0 });
  const blackHoleParticlesRef = useRef<{ angle: number; distance: number; speed: number }[]>([]);
  
  // React state for UI updates
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');

  // Initialize stars
  const initStars = useCallback((width: number, height: number) => {
    starsRef.current = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.5,
      brightness: Math.random() * 0.5 + 0.3,
    }));
  }, []);

  // Initialize orbs
  const initOrbs = useCallback((width: number, height: number) => {
    orbsRef.current = Array.from({ length: ORB_COUNT }, (_, i) => {
      const angle = (i / ORB_COUNT) * Math.PI * 2;
      const dist = 120 + Math.random() * 80;
      return {
        pos: {
          x: width / 2 + Math.cos(angle) * dist,
          y: height / 2 + Math.sin(angle) * dist,
        },
        vel: {
          x: (Math.random() - 0.5) * 80,
          y: (Math.random() - 0.5) * 80,
        },
        radius: ORB_MIN_RADIUS + Math.random() * (ORB_MAX_RADIUS - ORB_MIN_RADIUS),
        trail: [],
        hue: 170 + Math.random() * 60, // Wider hue range
      };
    });
  }, []);

  // Initialize black hole particles
  const initBlackHoleParticles = useCallback(() => {
    blackHoleParticlesRef.current = Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      distance: 28 + Math.random() * 12,
      speed: 1.2 + Math.random() * 0.6,
    }));
  }, []);

  // Reset game
  const resetGame = useCallback((width: number, height: number) => {
    scoreRef.current = 0;
    cracksRef.current = 0;
    survivalTimeRef.current = 0;
    orbitComboRef.current = 0;
    cracksVisualRef.current = [];
    shakeRef.current = { x: 0, y: 0, timer: 0 };
    modeRef.current = 'attract';
    initOrbs(width, height);
    initBlackHoleParticles();
  }, [initOrbs, initBlackHoleParticles]);

  // Trigger mode switch animation
  const triggerModeSwitch = useCallback(() => {
    const newMode = modeRef.current === 'attract' ? 'repel' : 'attract';
    modeRef.current = newMode;
    modeSwitchAnimRef.current = {
      timer: MODE_SWITCH_DURATION,
      mode: newMode,
      pos: { ...cursorRef.current }
    };
  }, []);

  // Setup camera and hand detection (async, non-blocking)
  useEffect(() => {
    let mounted = true;

    const setupHandTracking = async () => {
      try {
        trackingStatusRef.current = 'loading';
        setLoadingStatus('Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
        });
        
        if (!mounted || !videoRef.current) return;
        
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        setLoadingStatus('Loading hand tracking model...');
        
        // Dynamically import TensorFlow.js to avoid blocking initial render
        const [tf, handPoseDetection] = await Promise.all([
          import('@tensorflow/tfjs'),
          import('@tensorflow-models/hand-pose-detection')
        ]);
        
        if (!mounted) return;
        
        // Initialize hand detector
        const model = handPoseDetection.SupportedModels.MediaPipeHands;
        const detector = await handPoseDetection.createDetector(model, {
          runtime: 'tfjs',
          modelType: 'lite',
        });
        
        if (mounted) {
          detectorRef.current = detector;
          usingMouseRef.current = false;
          trackingStatusRef.current = 'no-hand';
          setLoadingStatus('Hand tracking ready! Show your hand.');
        }
      } catch (error) {
        console.warn('Camera not available, using mouse fallback:', error);
        if (mounted) {
          usingMouseRef.current = true;
          trackingStatusRef.current = 'mouse';
        }
      }
    };

    // Start hand tracking in background, don't block game
    setupHandTracking();

    return () => {
      mounted = false;
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // Mouse fallback handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetCursorRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleClick = () => {
      if (gameStateRef.current === 'start') {
        gameStateRef.current = 'playing';
        resetGame(canvas.width, canvas.height);
      } else if (gameStateRef.current === 'gameover') {
        gameStateRef.current = 'start';
      } else if (gameStateRef.current === 'playing') {
        // Toggle mode with animation
        triggerModeSwitch();
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [resetGame, triggerModeSwitch]);

  // Helper to safely create radial gradients
  const safeRadialGradient = (
    ctx: CanvasRenderingContext2D,
    x0: number, y0: number, r0: number,
    x1: number, y1: number, r1: number,
    fallbackColor: string
  ): CanvasGradient | string => {
    if (!isFinite(x0) || !isFinite(y0) || !isFinite(r0) || 
        !isFinite(x1) || !isFinite(y1) || !isFinite(r1) ||
        r0 < 0 || r1 < 0) {
      return fallbackColor;
    }
    return ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  };

  // Helper to safely create linear gradients
  const safeLinearGradient = (
    ctx: CanvasRenderingContext2D,
    x0: number, y0: number,
    x1: number, y1: number,
    fallbackColor: string
  ): CanvasGradient | string => {
    if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) {
      return fallbackColor;
    }
    return ctx.createLinearGradient(x0, y0, x1, y1);
  };

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    
    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars(canvas.width, canvas.height);
      // Always re-center cursor on resize if not playing
      if (gameStateRef.current !== 'playing') {
        cursorRef.current = { x: canvas.width / 2, y: canvas.height / 2 };
        targetCursorRef.current = { x: canvas.width / 2, y: canvas.height / 2 };
      }
    };
    
    resize();
    window.addEventListener('resize', resize);
    
    // Initialize cursor to center immediately
    cursorRef.current = { x: canvas.width / 2, y: canvas.height / 2 };
    targetCursorRef.current = { x: canvas.width / 2, y: canvas.height / 2 };
    
    // Initialize orbs so they appear on start screen (demo preview)
    initOrbs(canvas.width, canvas.height);
    initBlackHoleParticles();
    setIsLoading(false);

    let prevPinch = false;

    const gameLoop = async (timestamp: number) => {
      // Guard against first-frame dt spike
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, MAX_DT);
      lastTimeRef.current = timestamp;

      const { width, height } = canvas;

      // Hand detection (if available)
      if (!usingMouseRef.current && detectorRef.current && video && video.readyState >= 2) {
        try {
          const hands = await detectorRef.current.estimateHands(video);
          
          if (hands.length > 0) {
            const keypoints = hands[0].keypoints;
            const indexTip = keypoints[8];
            const thumbTip = keypoints[4];
            
            const scaleX = width / video.videoWidth;
            const scaleY = height / video.videoHeight;
            
            targetCursorRef.current = {
              x: width - indexTip.x * scaleX,
              y: indexTip.y * scaleY,
            };
            
            // Scale pinch distance relative to video dimensions for consistency
            const pinchDist = Math.sqrt(
              Math.pow(indexTip.x - thumbTip.x, 2) + Math.pow(indexTip.y - thumbTip.y, 2)
            );
            
            if (!isPinchingRef.current && pinchDist < PINCH_ON_THRESHOLD) {
              isPinchingRef.current = true;
            } else if (isPinchingRef.current && pinchDist > PINCH_OFF_THRESHOLD) {
              isPinchingRef.current = false;
            }
            
            if (isPinchingRef.current && !prevPinch) {
              if (gameStateRef.current === 'start') {
                gameStateRef.current = 'playing';
                resetGame(width, height);
              } else if (gameStateRef.current === 'gameover') {
                gameStateRef.current = 'start';
              } else {
                triggerModeSwitch();
              }
            }
            prevPinch = isPinchingRef.current;
            
            trackingStatusRef.current = 'active';
          } else {
            trackingStatusRef.current = 'no-hand';
          }
        } catch (e) {
          // Silent fail on detection errors
        }
      }

      // Smooth cursor
      cursorRef.current = {
        x: lerp(cursorRef.current.x, targetCursorRef.current.x, LERP_FACTOR),
        y: lerp(cursorRef.current.y, targetCursorRef.current.y, LERP_FACTOR),
      };

      cursorRef.current.x = clamp(cursorRef.current.x, 0, width);
      cursorRef.current.y = clamp(cursorRef.current.y, 0, height);

      // Update screen shake
      if (shakeRef.current.timer > 0) {
        shakeRef.current.timer -= dt;
        shakeRef.current.x = (Math.random() - 0.5) * 10 * (shakeRef.current.timer / 0.3);
        shakeRef.current.y = (Math.random() - 0.5) * 10 * (shakeRef.current.timer / 0.3);
      } else {
        shakeRef.current.x = 0;
        shakeRef.current.y = 0;
      }

      // Update mode switch animation
      if (modeSwitchAnimRef.current.timer > 0) {
        modeSwitchAnimRef.current.timer -= dt;
      }

      // Update cracks
      cracksVisualRef.current = cracksVisualRef.current.filter(c => {
        c.timer -= dt;
        return c.timer > 0;
      });

      // Demo mode physics for start screen - gentle floating
      if (gameStateRef.current === 'start') {
        const centerX = width / 2;
        const centerY = height / 2;
        
        for (const orb of orbsRef.current) {
          // Gentle attraction toward center
          const toCenter = vecSub({ x: centerX, y: centerY }, orb.pos);
          const dist = vecLen(toCenter);
          const attraction = vecMul(vecNorm(toCenter), 30 * dt);
          orb.vel = vecAdd(orb.vel, attraction);
          
          // Add some orbital motion
          const perpendicular = { x: -toCenter.y, y: toCenter.x };
          const orbital = vecMul(vecNorm(perpendicular), 20 * dt);
          orb.vel = vecAdd(orb.vel, orbital);
          
          // Heavy damping for smooth floating
          orb.vel = vecMul(orb.vel, 0.98);
          
          // Apply velocity
          orb.pos = vecAdd(orb.pos, vecMul(orb.vel, dt));
          
          // Keep within bounds with soft bounce
          const margin = orb.radius + 50;
          if (orb.pos.x < margin) { orb.pos.x = margin; orb.vel.x *= -0.3; }
          if (orb.pos.x > width - margin) { orb.pos.x = width - margin; orb.vel.x *= -0.3; }
          if (orb.pos.y < margin) { orb.pos.y = margin; orb.vel.y *= -0.3; }
          if (orb.pos.y > height - margin) { orb.pos.y = height - margin; orb.vel.y *= -0.3; }
          
          // Update trail
          orb.trail.unshift({ ...orb.pos });
          if (orb.trail.length > TRAIL_LENGTH / 2) orb.trail.pop();
        }
      }

      // Game logic
      if (gameStateRef.current === 'playing') {
        survivalTimeRef.current += dt;
        scoreRef.current += dt;

        const holePos = cursorRef.current;
        const gravitySign = modeRef.current === 'attract' ? 1 : -1;

        let orbitsActive = 0;
        
        for (const orb of orbsRef.current) {
          const d = vecSub(holePos, orb.pos);
          const dist = vecLen(d);
          const forceMag = (gravitySign * GRAVITY_CONSTANT) / (dist * dist + SOFTENING);
          const force = vecMul(vecNorm(d), forceMag);
          
          orb.vel = vecAdd(orb.vel, vecMul(force, dt));
          orb.vel = vecMul(orb.vel, VELOCITY_DAMPING);
          
          const speed = vecLen(orb.vel);
          if (speed > 800) {
            orb.vel = vecMul(vecNorm(orb.vel), 800);
          }
          if (isNaN(orb.vel.x) || isNaN(orb.vel.y)) {
            orb.vel = { x: 0, y: 0 };
          }
          
          orb.pos = vecAdd(orb.pos, vecMul(orb.vel, dt));
          
          orb.trail.unshift({ ...orb.pos });
          if (orb.trail.length > TRAIL_LENGTH) orb.trail.pop();
          
          if (dist >= ORBIT_INNER && dist <= ORBIT_OUTER) {
            orbitsActive++;
          }
          
          const margin = orb.radius;
          let hitEdge: Crack['edge'] | null = null;
          let hitX = 0, hitY = 0;
          
          if (orb.pos.x - margin < 0) {
            hitEdge = 'left';
            hitX = 0;
            hitY = orb.pos.y;
            orb.pos.x = margin;
            orb.vel.x = Math.abs(orb.vel.x) * 0.5;
          } else if (orb.pos.x + margin > width) {
            hitEdge = 'right';
            hitX = width;
            hitY = orb.pos.y;
            orb.pos.x = width - margin;
            orb.vel.x = -Math.abs(orb.vel.x) * 0.5;
          }
          
          if (orb.pos.y - margin < 0) {
            hitEdge = 'top';
            hitX = orb.pos.x;
            hitY = 0;
            orb.pos.y = margin;
            orb.vel.y = Math.abs(orb.vel.y) * 0.5;
          } else if (orb.pos.y + margin > height) {
            hitEdge = 'bottom';
            hitX = orb.pos.x;
            hitY = height;
            orb.pos.y = height - margin;
            orb.vel.y = -Math.abs(orb.vel.y) * 0.5;
          }
          
          if (hitEdge) {
            cracksRef.current++;
            shakeRef.current = { x: 0, y: 0, timer: 0.3 };
            cracksVisualRef.current.push({
              x: hitX,
              y: hitY,
              edge: hitEdge,
              timer: CRACK_DURATION,
              segments: generateCrackSegments(hitX, hitY, hitEdge, width, height),
            });
            
            if (cracksRef.current > MAX_CRACKS) {
              gameStateRef.current = 'gameover';
              if (scoreRef.current > bestScoreRef.current) {
                bestScoreRef.current = scoreRef.current;
              }
            }
          }
        }
        
        if (orbitsActive >= 2) {
          orbitComboRef.current += dt;
          scoreRef.current += dt * orbitsActive;
        }
      }

      // Update black hole particles
      for (const p of blackHoleParticlesRef.current) {
        p.angle += p.speed * dt;
      }

      // ============ RENDERING ============
      ctx.save();
      ctx.translate(shakeRef.current.x, shakeRef.current.y);
      
      // Background
      const bgGrad = safeRadialGradient(ctx, width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7, 'hsl(240, 20%, 3%)');
      if (typeof bgGrad !== 'string') {
        bgGrad.addColorStop(0, 'hsl(240, 30%, 8%)');
        bgGrad.addColorStop(1, 'hsl(240, 20%, 3%)');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(-20, -20, width + 40, height + 40);

      // Stars
      for (const star of starsRef.current) {
        const twinkle = Math.sin(timestamp * 0.002 + star.x) * 0.2 + 0.8;
        ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness * twinkle})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cracks
      for (const crack of cracksVisualRef.current) {
        const alpha = crack.timer / CRACK_DURATION;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(0, 200, 255, 0.8)';
        ctx.shadowBlur = 15;
        
        for (const seg of crack.segments) {
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }

      // Orbs with trails (BRIGHTER)
      for (const orb of orbsRef.current) {
        // Validate orb position - reset if invalid
        if (!isFinite(orb.pos.x) || !isFinite(orb.pos.y)) {
          orb.pos = { x: width / 2, y: height / 2 };
          orb.vel = { x: 0, y: 0 };
          orb.trail = [];
        }

        if (orb.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(orb.trail[0].x, orb.trail[0].y);
          for (let i = 1; i < orb.trail.length; i++) {
            ctx.lineTo(orb.trail[i].x, orb.trail[i].y);
          }
          const gradient = safeLinearGradient(
            ctx,
            orb.trail[0].x, orb.trail[0].y,
            orb.trail[orb.trail.length - 1].x, orb.trail[orb.trail.length - 1].y,
            `hsla(${orb.hue}, 100%, 70%, 0.5)`
          );
          if (typeof gradient !== 'string') {
            gradient.addColorStop(0, `hsla(${orb.hue}, 100%, 75%, 0.9)`);
            gradient.addColorStop(1, `hsla(${orb.hue}, 100%, 70%, 0)`);
          }
          ctx.strokeStyle = gradient;
          ctx.lineWidth = orb.radius * 0.8;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        
        // Outer glow (brighter)
        ctx.shadowColor = `hsla(${orb.hue}, 100%, 60%, 0.8)`;
        ctx.shadowBlur = 25;
        
        const orbGlow = safeRadialGradient(ctx, orb.pos.x, orb.pos.y, 0, orb.pos.x, orb.pos.y, orb.radius * 2.5, `hsla(${orb.hue}, 100%, 65%, 0.4)`);
        if (typeof orbGlow !== 'string') {
          orbGlow.addColorStop(0, `hsla(${orb.hue}, 100%, 75%, 0.7)`);
          orbGlow.addColorStop(0.5, `hsla(${orb.hue}, 100%, 55%, 0.3)`);
          orbGlow.addColorStop(1, 'transparent');
        }
        ctx.fillStyle = orbGlow;
        ctx.beginPath();
        ctx.arc(orb.pos.x, orb.pos.y, orb.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Core (brighter)
        const orbCore = safeRadialGradient(
          ctx,
          orb.pos.x - orb.radius * 0.3, orb.pos.y - orb.radius * 0.3, 0,
          orb.pos.x, orb.pos.y, orb.radius,
          `hsl(${orb.hue}, 100%, 70%)`
        );
        if (typeof orbCore !== 'string') {
          orbCore.addColorStop(0, `hsl(${orb.hue}, 100%, 95%)`);
          orbCore.addColorStop(0.6, `hsl(${orb.hue}, 100%, 70%)`);
          orbCore.addColorStop(1, `hsl(${orb.hue}, 90%, 50%)`);
        }
        ctx.fillStyle = orbCore;
        ctx.beginPath();
        ctx.arc(orb.pos.x, orb.pos.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
      }

      // Start screen overlay (drawn before black hole so hole is on top)
      if (gameStateRef.current === 'start') {
        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(5, 5, 15, 0.75)';
        ctx.fillRect(0, 0, width, height);
        
        ctx.textAlign = 'center';
        
        // Title
        ctx.font = 'bold 48px Orbitron, sans-serif';
        ctx.fillStyle = 'hsl(195, 100%, 70%)';
        ctx.shadowColor = 'hsl(195, 100%, 50%)';
        ctx.shadowBlur = 30;
        ctx.fillText('BLACKHOLE JUGGLER', width / 2, height / 2 - 120);
        ctx.shadowBlur = 0;
        
        // Objective (prominent!)
        ctx.font = 'bold 22px Orbitron, sans-serif';
        ctx.fillStyle = 'hsl(50, 100%, 70%)';
        ctx.fillText('🎯 GOAL: Keep orbs away from the edges!', width / 2, height / 2 - 60);
        
        // Lives indicator
        ctx.font = '18px Orbitron, sans-serif';
        ctx.fillStyle = 'hsl(0, 80%, 65%)';
        ctx.fillText('LIVES: ◆ ◆ ◆ (3 edge hits = game over)', width / 2, height / 2 - 25);
        
        // Controls
        ctx.font = '16px Orbitron, sans-serif';
        ctx.fillStyle = 'hsl(200, 60%, 75%)';
        ctx.fillText('🖱️ Move = Control the black hole', width / 2, height / 2 + 15);
        ctx.fillText('🖱️ Click = Switch between ATTRACT ↔ REPEL', width / 2, height / 2 + 40);
        
        // Hand tracking status indicator
        const status = trackingStatusRef.current;
        let statusText = '';
        let statusColor = '';
        
        if (status === 'loading') {
          statusText = '⏳ Camera loading...';
          statusColor = 'hsl(50, 100%, 60%)';
        } else if (status === 'active') {
          statusText = '✋ Hand Tracking ACTIVE - Pinch to toggle mode!';
          statusColor = 'hsl(120, 80%, 60%)';
        } else if (status === 'no-hand') {
          statusText = '👋 Show your hand to the camera!';
          statusColor = 'hsl(30, 100%, 60%)';
        } else {
          statusText = '🖱️ Using Mouse Controls';
          statusColor = 'hsl(195, 100%, 60%)';
        }
        
        ctx.font = '14px Orbitron, sans-serif';
        ctx.fillStyle = statusColor;
        ctx.fillText(statusText, width / 2, height / 2 + 80);
        
        // Start prompt
        ctx.font = '24px Orbitron, sans-serif';
        const pulse = Math.sin(timestamp * 0.005) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(0, 220, 255, ${pulse})`;
        ctx.shadowColor = 'hsl(195, 100%, 50%)';
        ctx.shadowBlur = 15;
        ctx.fillText('[ CLICK TO START ]', width / 2, height / 2 + 140);
        ctx.shadowBlur = 0;
        
        ctx.textAlign = 'left';
      }

      // Game over screen
      if (gameStateRef.current === 'gameover') {
        ctx.fillStyle = 'rgba(5, 5, 15, 0.9)';
        ctx.fillRect(0, 0, width, height);
        
        ctx.textAlign = 'center';
        ctx.font = 'bold 56px Orbitron, sans-serif';
        ctx.fillStyle = 'hsl(320, 100%, 60%)';
        ctx.shadowColor = 'hsl(320, 100%, 50%)';
        ctx.shadowBlur = 30;
        ctx.fillText('SPACE SHATTERED', width / 2, height / 2 - 60);
        ctx.shadowBlur = 0;
        
        ctx.font = '24px Orbitron, sans-serif';
        ctx.fillStyle = 'hsl(200, 80%, 80%)';
        ctx.fillText(`SCORE: ${Math.floor(scoreRef.current)}`, width / 2, height / 2);
        ctx.fillText(`BEST: ${Math.floor(bestScoreRef.current)}`, width / 2, height / 2 + 35);
        ctx.fillText(`TIME: ${survivalTimeRef.current.toFixed(1)}s`, width / 2, height / 2 + 70);
        
        ctx.font = '20px Orbitron, sans-serif';
        const pulse = Math.sin(timestamp * 0.005) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 100, 200, ${pulse})`;
        ctx.fillText('[ CLICK TO RETRY ]', width / 2, height / 2 + 130);
        
        ctx.textAlign = 'left';
      }

      // Black hole (ALWAYS rendered on top, visible on all screens)
      const holePos = cursorRef.current;
      const holeRadius = 25; // Slightly larger
      const isAttract = modeRef.current === 'attract';
      const ringColor = isAttract ? 'hsl(195, 100%, 50%)' : 'hsl(320, 100%, 60%)';
      const ringGlow = isAttract ? 'rgba(0, 200, 255, 0.6)' : 'rgba(255, 50, 150, 0.6)';
      
      // Only render black hole if position is valid
      if (isFinite(holePos.x) && isFinite(holePos.y)) {
        // Mode switch shockwave animation
        if (modeSwitchAnimRef.current.timer > 0) {
          const progress = 1 - (modeSwitchAnimRef.current.timer / MODE_SWITCH_DURATION);
          const ringRadius = holeRadius + progress * 150;
          const animMode = modeSwitchAnimRef.current.mode;
          const animColor = animMode === 'attract' ? 'rgba(0, 200, 255,' : 'rgba(255, 50, 150,';
          
          ctx.beginPath();
          ctx.arc(modeSwitchAnimRef.current.pos.x, modeSwitchAnimRef.current.pos.y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `${animColor} ${(1 - progress) * 0.8})`;
          ctx.lineWidth = 4 * (1 - progress);
          ctx.stroke();
        }
        
        // Outer glow
        ctx.shadowColor = ringGlow;
        ctx.shadowBlur = 40;
        
        const bhGlow = safeRadialGradient(ctx, holePos.x, holePos.y, holeRadius, holePos.x, holePos.y, holeRadius * 3.5, ringGlow);
        if (typeof bhGlow !== 'string') {
          bhGlow.addColorStop(0, ringGlow);
          bhGlow.addColorStop(1, 'transparent');
        }
        ctx.fillStyle = bhGlow;
        ctx.beginPath();
        ctx.arc(holePos.x, holePos.y, holeRadius * 3.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Orbiting particles
        for (const p of blackHoleParticlesRef.current) {
          const px = holePos.x + Math.cos(p.angle) * p.distance;
          const py = holePos.y + Math.sin(p.angle) * p.distance;
          ctx.fillStyle = ringColor;
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Ring
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 4;
        ctx.shadowColor = ringGlow;
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(holePos.x, holePos.y, holeRadius + 8, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner ring
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(holePos.x, holePos.y, holeRadius + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Core
        const coreGrad = safeRadialGradient(ctx, holePos.x, holePos.y, 0, holePos.x, holePos.y, holeRadius, 'hsl(240, 20%, 5%)');
        if (typeof coreGrad !== 'string') {
          coreGrad.addColorStop(0, 'hsl(240, 20%, 2%)');
          coreGrad.addColorStop(0.8, 'hsl(240, 30%, 5%)');
          coreGrad.addColorStop(1, 'hsl(240, 20%, 12%)');
        }
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(holePos.x, holePos.y, holeRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Mode indicator in center
        ctx.font = 'bold 10px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = ringColor;
        ctx.fillText(isAttract ? '◉' : '◎', holePos.x, holePos.y + 4);
        ctx.textAlign = 'left';
      }

      // HUD (playing state)
      if (gameStateRef.current === 'playing') {
        // Score box
        ctx.fillStyle = 'rgba(10, 10, 20, 0.8)';
        ctx.fillRect(10, 10, 200, 90);
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(10, 10, 200, 90);
        
        ctx.font = '16px Orbitron, sans-serif';
        ctx.fillStyle = 'hsl(200, 100%, 90%)';
        ctx.fillText(`SCORE: ${Math.floor(scoreRef.current)}`, 20, 35);
        ctx.fillText(`TIME: ${survivalTimeRef.current.toFixed(1)}s`, 20, 55);
        
        ctx.fillText('LIVES: ', 20, 75);
        for (let i = 0; i < MAX_CRACKS; i++) {
          const hasLife = i < (MAX_CRACKS - cracksRef.current);
          ctx.fillStyle = hasLife ? 'hsl(195, 100%, 60%)' : 'hsl(0, 70%, 40%)';
          ctx.fillText('◆', 85 + i * 22, 75);
        }
        
        // Mode indicator (top right, prominent)
        const modeColor = modeRef.current === 'attract' ? 'hsl(195, 100%, 60%)' : 'hsl(320, 100%, 60%)';
        const modeBg = modeRef.current === 'attract' ? 'rgba(0, 150, 200, 0.3)' : 'rgba(200, 50, 150, 0.3)';
        
        ctx.fillStyle = modeBg;
        ctx.fillRect(width - 160, 10, 150, 50);
        ctx.strokeStyle = modeColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(width - 160, 10, 150, 50);
        
        ctx.font = 'bold 20px Orbitron, sans-serif';
        ctx.fillStyle = modeColor;
        ctx.textAlign = 'center';
        ctx.fillText(modeRef.current.toUpperCase(), width - 85, 42);
        ctx.textAlign = 'left';
        
        // Hand tracking status (small, bottom right)
        const status = trackingStatusRef.current;
        let statusIcon = '🖱️';
        let statusColor = 'hsl(195, 100%, 60%)';
        
        if (status === 'active') {
          statusIcon = '✋';
          statusColor = 'hsl(120, 80%, 60%)';
        } else if (status === 'no-hand') {
          statusIcon = '👋';
          statusColor = 'hsl(30, 100%, 60%)';
        }
        
        ctx.font = '12px Orbitron, sans-serif';
        ctx.fillStyle = statusColor;
        ctx.textAlign = 'right';
        ctx.fillText(`${statusIcon} ${status === 'active' ? 'Hand Active' : status === 'no-hand' ? 'Show Hand' : 'Mouse'}`, width - 15, height - 15);
        ctx.textAlign = 'left';
      }

      // Hand not detected overlay (only when hand tracking is enabled but no hand visible)
      if (trackingStatusRef.current === 'no-hand' && !usingMouseRef.current && gameStateRef.current === 'playing') {
        // Just a subtle indicator, not a blocking overlay
        ctx.fillStyle = 'rgba(255, 150, 50, 0.2)';
        ctx.fillRect(0, 0, width, 40);
        
        ctx.textAlign = 'center';
        ctx.font = '14px Orbitron, sans-serif';
        ctx.fillStyle = 'hsl(30, 100%, 70%)';
        ctx.fillText('👋 Show your hand to the camera for hand controls', width / 2, 26);
        ctx.textAlign = 'left';
      }

      ctx.restore();

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    // Initialize lastTimeRef to 0 so the first frame guard in gameLoop handles it
    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [initStars, initBlackHoleParticles, initOrbs, resetGame, triggerModeSwitch]);

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: 'hsl(240, 20%, 3%)' }}>
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'hsl(240, 20%, 3%)' }}>
          <div className="text-center">
            <div className="text-2xl font-bold mb-4" style={{ color: 'hsl(195, 100%, 70%)', fontFamily: 'Orbitron, sans-serif' }}>
              Loading...
            </div>
            <div className="text-sm" style={{ color: 'hsl(200, 60%, 60%)', fontFamily: 'Orbitron, sans-serif' }}>
              {loadingStatus}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
