import React, { useRef } from 'react';
import { useBlackholeJuggler } from '@/game/useBlackholeJuggler';
import { THEME_COLORS } from '@/game/constants';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { gameState, debugInfo } = useBlackholeJuggler(canvasRef, videoRef);

  // Deriving state values safely
  const phase = gameState?.phase;
  const score = gameState?.score ?? 0;
  const bestScore = gameState?.bestScore ?? 0;
  const cracks = gameState?.cracks ?? 0;
  const holeMode = gameState?.hole.mode ?? 'ATTRACT';
  const lives = 3 - cracks;

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden select-none cursor-none font-game">
      {/* 1. Underlying Game Canvas - Always rendered so Ref exists */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />

      {/* 2. Hidden Video (Input Source) - Always rendered so Ref exists */}
      <video
        ref={videoRef}
        className="absolute top-0 left-0 opacity-0 pointer-events-none"
        playsInline
        autoPlay
        muted
        width="640"
        height="480"
      />

      {/* Loading Overlay */}
      {!gameState && (
        <div className="absolute inset-0 bg-slate-950 text-white flex items-center justify-center z-50">
          <div className="text-center animate-pulse">
            <h1 className="text-4xl mb-4">Initializing Neural Link...</h1>
            <p className="text-slate-400">Please allow camera access</p>
          </div>
        </div>
      )}

      {/* 3. HUD Overlay - Only show when game is ready/initialized */}
      {gameState && (
        <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between text-white z-10">

          {/* Top Bar */}
          {/* Top Bar */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 shadow-glow">
                GRAVITY JUGGLER
              </h1>
              {bestScore < 999999 && (
                <div className="mt-2 text-sm text-slate-400 font-mono">
                  BEST: {Math.floor(bestScore / 60).toString().padStart(2, '0')}:{Math.floor(bestScore % 60).toString().padStart(2, '0')}.{Math.floor((bestScore % 1) * 100).toString().padStart(2, '0')}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className={cn(
                "px-4 py-1 rounded border shadow-lg transition-colors border-current",
                holeMode === 'ATTRACT' ? "text-attract border-attract bg-attract/10" : "text-repel border-repel bg-repel/10"
              )}>
                MODE: {holeMode}
              </div>
            </div>
          </div>

          {/* Center Messages */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {(phase === 'START' || phase === 'INIT') && (
              <div className="text-center space-y-4 bg-black/60 p-8 rounded-xl backdrop-blur-md border border-slate-800 animate-in fade-in zoom-in duration-300">
                <h2 className="text-2xl text-cyan-300 mb-2">Ready?</h2>
                <div className="space-y-2 text-slate-300">
                  <p>1. Move hand to control the Black Hole</p>
                  <p>2. <span className="text-white font-bold">PINCH</span> to Repel / Release to Attract</p>
                  <p>3. Keep orbs in bounds!</p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-700 text-purple-300 animate-pulse font-bold text-lg uppercase">
                  PINCH TO START
                </div>
              </div>
            )}

            {phase === 'RESULT' && (
              <div className="text-center space-y-6 bg-black/80 p-12 rounded-2xl backdrop-blur-xl border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.2)] animate-in fade-in slide-in-from-bottom-10 duration-500">
                <h2 className="text-5xl font-black text-red-500 tracking-wider">SURVIVAL ENDED</h2>
                <div className="py-4">
                  {gameState?.deathReason === 'BOMB' ? (
                    <>
                      <div className="text-red-400 text-sm tracking-widest uppercase">FATAL ERROR: BOMB ABSORBED</div>
                      <div className="text-2xl text-slate-300 mt-2">Core destabilized!</div>
                    </>
                  ) : (
                    <>
                      <div className="text-slate-400 text-sm tracking-widest uppercase">Collision Detected</div>
                      <div className="text-2xl text-slate-300 mt-2">Gravity well collapsed.</div>
                    </>
                  )}
                  <div className="mt-6">
                    <div className="text-slate-500 text-xs uppercase tracking-widest">Time Survived</div>
                    <div className="text-4xl font-mono text-white">
                      {gameState ? `${Math.floor(gameState.elapsedTime / 60).toString().padStart(2, '0')}:${Math.floor(gameState.elapsedTime % 60).toString().padStart(2, '0')}.${Math.floor((gameState.elapsedTime % 1) * 100).toString().padStart(2, '0')}` : '00:00.00'}
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-800 text-cyan-400 animate-pulse font-bold tracking-widest text-xl uppercase">
                  Pinch to Restart
                </div>
              </div>
            )}
          </div>

          {/* Debug / Footer */}
          <div className="text-slate-600 font-mono text-xs max-w-lg truncate">
            {debugInfo}
          </div>
        </div>
      )
      }

      <Toaster />
      <Sonner />
    </div >
  );
};

export default App;
