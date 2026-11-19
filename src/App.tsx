import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  hideMenuBanner,
  initializeAdMob,
  maybeShowBetweenRaceInterstitial,
  showMenuBanner,
} from './ads/admob';
import { soundEngine } from './audio/soundEngine';
import {
  CarPreviewSvg,
  HeartIconSvg,
  StarIconSvg,
  TitleLogoSvg,
} from './components/CarArtwork';
import { OfflineIndicator, PWAInstallButton } from './components/PWAControls';
import { RacingCanvas, RacingCanvasHandle } from './game/RacingCanvas';
import {
  CARS,
  CarConfig,
  CheerMessage,
  GameState,
  HudSnapshot,
} from './game/types';

const TITLE_BACKDROP_SRC = '/src/assets/images/title_race_backdrop_1795087675775.jpg';

const INITIAL_HUD: HudSnapshot = {
  stars: 0,
  distance: 0,
  bestStars: 0,
  hearts: 3,
  maxHearts: 3,
  turboCharge: 40,
  isTurboActive: false,
  hasShield: false,
  zoneName: 'Sunny Meadow',
  combo: 0,
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [selectedCar, setSelectedCar] = useState<CarConfig>(CARS[0]);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [backdropFailed, setBackdropFailed] = useState(false);

  const [liveCheer, setLiveCheer] = useState<CheerMessage | null>(null);
  const [finalCheer, setFinalCheer] = useState<CheerMessage | null>(null);
  const [cheerLoading, setCheerLoading] = useState(false);
  const [cheerError, setCheerError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState({ stars: 0, distance: 0, zoneName: 'Sunny Meadow' });

  const canvasRef = useRef<RacingCanvasHandle | null>(null);
  const cheerTimerRef = useRef<number | null>(null);

  const fetchCheer = useCallback(
    async (
      event: 'start' | 'milestone' | 'gameover',
      stars: number,
      distance: number,
      zone: string,
      carName: string
    ) => {
      if (event === 'gameover') {
        setCheerLoading(true);
        setCheerError(null);
      }
      try {
        const res = await fetch('/api/cheer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, carName, stars, distance, zone }),
        });
        const data = (await res.json()) as Partial<CheerMessage> & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || 'Could not load pit-crew cheer');
        }
        const msg: CheerMessage = {
          cheer: data.cheer || 'Zoom zoom! Keep going!',
          stickerTitle: data.stickerTitle || 'Star Driver',
          latencyMs: data.latencyMs,
        };
        if (event === 'gameover') {
          setFinalCheer(msg);
        } else {
          setLiveCheer(msg);
          if (cheerTimerRef.current) window.clearTimeout(cheerTimerRef.current);
          cheerTimerRef.current = window.setTimeout(() => {
            setLiveCheer(null);
          }, 3600);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Pit-crew radio unavailable';
        if (event === 'gameover') {
          setCheerError(message);
        }
      } finally {
        if (event === 'gameover') {
          setCheerLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void initializeAdMob();
    return () => {
      if (cheerTimerRef.current) window.clearTimeout(cheerTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      void hideMenuBanner();
    } else {
      void showMenuBanner();
    }
  }, [gameState]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const startGame = useCallback(() => {
    setFinalCheer(null);
    setLiveCheer(null);
    setCheerError(null);
    setGameState('PLAYING');
    void fetchCheer('start', 0, 0, 'Sunny Meadow', selectedCar.name);
  }, [fetchCheer, selectedCar.name]);

  const pauseGame = useCallback(() => {
    setGameState((prev) => (prev === 'PLAYING' ? 'PAUSED' : prev));
  }, []);

  const resumeGame = useCallback(() => {
    setGameState((prev) => (prev === 'PAUSED' ? 'PLAYING' : prev));
  }, []);

  const returnToGarage = useCallback(() => {
    setLiveCheer(null);
    setFinalCheer(null);
    setGameState('TITLE_MENU');
  }, []);

  const handleMilestone = useCallback(
    (stars: number, distance: number, zoneName: string) => {
      void fetchCheer('milestone', stars, distance, zoneName, selectedCar.name);
    },
    [fetchCheer, selectedCar.name]
  );

  const handleGameOver = useCallback(
    (finalStars: number, finalDistance: number, zoneName: string) => {
      setLiveCheer(null);
      setRunResult({ stars: finalStars, distance: finalDistance, zoneName });
      setGameState('GAME_OVER');
      void fetchCheer('gameover', finalStars, finalDistance, zoneName, selectedCar.name);
      void maybeShowBetweenRaceInterstitial();
    },
    [fetchCheer, selectedCar.name]
  );

  // Global keyboard shortcuts for shell transitions (Enter/Space on Title, Esc/P to Pause)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'TITLE_MENU') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startGame();
        }
      } else if (gameState === 'PLAYING') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          pauseGame();
        }
      } else if (gameState === 'PAUSED') {
        if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Enter') {
          e.preventDefault();
          resumeGame();
        }
      } else if (gameState === 'GAME_OVER') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startGame();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, pauseGame, resumeGame, startGame]);

  const turboReady = hud.turboCharge >= 100 && !hud.isTurboActive;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-sky-400">
      <OfflineIndicator />

      {/* Isolated 60fps Canvas Layer */}
      <div className="absolute inset-0">
        <RacingCanvas
          ref={canvasRef}
          gameState={gameState}
          selectedCar={selectedCar}
          onHudChange={setHud}
          onMilestone={handleMilestone}
          onGameOver={handleGameOver}
        />
      </div>

      {/* TITLE SCREEN OVERLAY */}
      {gameState === 'TITLE_MENU' && (
        <section
          aria-label="Zoomy Park Title Screen"
          className="absolute inset-0 z-20 flex flex-col justify-between overflow-hidden"
        >
          {/* Key-art backdrop with fallback sky/meadow gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-sky-400 via-sky-200 to-emerald-400">
            {!backdropFailed && (
              <img
                src={TITLE_BACKDROP_SRC}
                alt="Sunny countryside raceway park"
                referrerPolicy="no-referrer"
                onError={() => setBackdropFailed(true)}
                className="w-full h-full object-cover object-center"
              />
            )}
            {/* Subtle top sky & bottom readability scrim */}
            <div className="absolute inset-0 bg-gradient-to-b from-sky-900/15 via-transparent to-slate-950/55" />
          </div>

          {/* Top-left Install button + Top-right sound button */}
          <div className="relative z-10 flex items-center justify-between p-4 sm:p-6">
            <div>
              <PWAInstallButton />
            </div>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute sound' : 'Mute sound'}
              className="w-12 h-12 rounded-2xl bg-[#FFFDF7] text-slate-900 border-2 border-slate-900 shadow-md flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
            >
              {muted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </button>
          </div>

          {/* Center-Top Title Lockup over calm sky negative space */}
          <div className="relative z-10 flex flex-col items-center px-4 -mt-4 sm:-mt-8">
            <TitleLogoSvg className="w-full max-w-[440px] sm:max-w-[520px] h-auto drop-shadow-sm" />
          </div>

          {/* Bottom Interactive Garage + Single Dominant Play CTA */}
          <div className="relative z-10 flex flex-col items-center gap-4 px-4 pb-6 sm:pb-8">
            {/* Car Garage Selector */}
            <div
              role="radiogroup"
              aria-label="Choose your race car"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 w-full max-w-2xl"
            >
              {CARS.map((car) => {
                const isSelected = selectedCar.id === car.id;
                return (
                  <button
                    key={car.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setSelectedCar(car);
                      soundEngine.playSteer();
                    }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border-2 text-left transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 ${
                      isSelected
                        ? 'bg-[#FFFDF7] border-slate-900 shadow-[0_5px_0_#0F172A] -translate-y-0.5'
                        : 'bg-[#FFFDF7]/90 border-slate-700/70 hover:bg-[#FFFDF7] hover:-translate-y-0.5'
                    }`}
                  >
                    <CarPreviewSvg car={car} className="w-10 h-14 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-display font-bold text-base text-slate-900 truncate">
                        {car.name}
                      </div>
                      <div className="text-xs font-semibold text-slate-600 truncate">
                        {car.tagline}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Primary Start CTA */}
            <button
              type="button"
              onClick={startGame}
              className="group flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 active:translate-y-1 text-slate-950 font-display font-bold text-2xl sm:text-3xl border-3 border-slate-950 shadow-[0_6px_0_#0F172A] active:shadow-[0_2px_0_#0F172A] transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white"
            >
              <Play className="w-7 h-7 fill-slate-950" />
              <span>Drive Now!</span>
            </button>

            {/* Single Flat Control-Hint Line */}
            <p className="text-center text-xs sm:text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.9)] tracking-wide">
              Tap Left / Right or Arrows Steer · Space Turbo · H Horn · Esc Pause
            </p>
          </div>
        </section>
      )}

      {/* ACTIVE PLAY HUD (Pointer-events-none wrapper, no backdrop-filter over canvas, >= 85% clear!) */}
      {gameState === 'PLAYING' && (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
          {/* Top Perimeter HUD Bar */}
          <div className="flex items-start justify-between gap-3">
            {/* Top-Left: Hearts + Stars + Distance/Zone */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3 bg-[#FFFDF7] border-2 border-slate-900 rounded-2xl px-3.5 py-2 shadow-[0_4px_0_#0F172A]">
                <div className="flex items-center gap-1" aria-label={`${hud.hearts} hearts left`}>
                  {Array.from({ length: hud.maxHearts }).map((_, idx) => (
                    <HeartIconSvg
                      key={idx}
                      filled={idx < hud.hearts}
                      className="w-6 h-6 sm:w-7 sm:h-7"
                    />
                  ))}
                </div>

                <span className="h-5 w-0.5 bg-slate-200" aria-hidden="true" />

                <div className="flex items-center gap-1.5" aria-label={`${hud.stars} stars`}>
                  <StarIconSvg className="w-6 h-6" />
                  <span className="font-mono-nums font-bold text-xl text-slate-900">
                    {hud.stars}
                  </span>
                </div>
              </div>

              {/* Clean unboxed zone & distance metadata */}
              <div className="flex items-center gap-2 px-2 text-xs sm:text-sm font-bold text-white drop-shadow-[0_2px_2px_rgba(15,23,42,0.85)]">
                <span>{hud.zoneName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-nums">{hud.distance} m</span>
                {hud.hasShield && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-200">Bubble Shield</span>
                  </>
                )}
              </div>
            </div>

            {/* Top-Center: Low-Latency Pip Cheer Banner (auto-hides, non-blocking) */}
            {liveCheer && (
              <div
                role="status"
                className="hidden md:flex items-center gap-2.5 max-w-md bg-[#FFFDF7] border-2 border-slate-900 rounded-2xl px-4 py-2 shadow-[0_4px_0_#0F172A]"
              >
                <span className="font-display font-bold text-xs uppercase tracking-wider text-amber-600 shrink-0">
                  {liveCheer.stickerTitle}
                </span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="font-display font-semibold text-sm text-slate-900 truncate">
                  {liveCheer.cheer}
                </span>
              </div>
            )}

            {/* Top-Right: Mute + Pause Controls */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute sound' : 'Mute sound'}
                className="w-12 h-12 rounded-2xl bg-[#FFFDF7] text-slate-900 border-2 border-slate-900 shadow-[0_4px_0_#0F172A] active:translate-y-0.5 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
              >
                {muted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>
              <button
                type="button"
                onClick={pauseGame}
                aria-label="Pause game"
                className="w-12 h-12 rounded-2xl bg-[#FFFDF7] text-slate-900 border-2 border-slate-900 shadow-[0_4px_0_#0F172A] active:translate-y-0.5 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
              >
                <Pause className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Mobile compact cheer banner if active */}
          {liveCheer && (
            <div className="md:hidden self-center bg-[#FFFDF7] border-2 border-slate-900 rounded-2xl px-3.5 py-1.5 shadow-[0_3px_0_#0F172A] text-center max-w-[92%]">
              <span className="font-display font-bold text-sm text-slate-900">
                {liveCheer.cheer}
              </span>
            </div>
          )}

          {/* Bottom Touch Controls for Small Kids */}
          <div className="flex items-end justify-between gap-2 pb-1">
            {/* Big Left Arrow Pedal */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                canvasRef.current?.steerLeft();
              }}
              aria-label="Steer Left"
              className="pointer-events-auto w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[#FFFDF7] hover:bg-amber-50 active:bg-amber-200 active:translate-y-1 text-slate-900 border-3 border-slate-900 shadow-[0_6px_0_#0F172A] active:shadow-[0_2px_0_#0F172A] flex items-center justify-center cursor-pointer transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
            >
              <ChevronLeft className="w-12 h-12 stroke-[3]" />
            </button>

            {/* Center Fun Action Buttons: Horn + Turbo */}
            <div className="flex items-center gap-3 pointer-events-auto">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  canvasRef.current?.honkHorn();
                }}
                aria-label="Honk Horn"
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-sky-400 hover:bg-sky-300 active:translate-y-1 text-slate-950 border-3 border-slate-900 shadow-[0_5px_0_#0F172A] active:shadow-[0_2px_0_#0F172A] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white"
              >
                <Megaphone className="w-7 h-7 stroke-[2.5]" />
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  canvasRef.current?.triggerTurbo();
                }}
                aria-label="Turbo Boost"
                className={`h-14 sm:h-16 px-4 sm:px-5 rounded-2xl border-3 border-slate-900 shadow-[0_5px_0_#0F172A] active:shadow-[0_2px_0_#0F172A] active:translate-y-1 flex items-center gap-2 font-display font-bold text-base sm:text-lg cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white ${
                  hud.isTurboActive
                    ? 'bg-pink-400 text-slate-950'
                    : turboReady
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 animate-bounce'
                    : 'bg-[#FFFDF7] text-slate-800'
                }`}
              >
                <Zap
                  className={`w-6 h-6 ${
                    turboReady || hud.isTurboActive ? 'fill-slate-950' : 'text-amber-500'
                  }`}
                />
                <span className="whitespace-nowrap">
                  {hud.isTurboActive
                    ? 'ZOOMING!'
                    : turboReady
                    ? 'TURBO!'
                    : `${hud.turboCharge}%`}
                </span>
              </button>
            </div>

            {/* Big Right Arrow Pedal */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                canvasRef.current?.steerRight();
              }}
              aria-label="Steer Right"
              className="pointer-events-auto w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[#FFFDF7] hover:bg-amber-50 active:bg-amber-200 active:translate-y-1 text-slate-900 border-3 border-slate-900 shadow-[0_6px_0_#0F172A] active:shadow-[0_2px_0_#0F172A] flex items-center justify-center cursor-pointer transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
            >
              <ChevronRight className="w-12 h-12 stroke-[3]" />
            </button>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {gameState === 'PAUSED' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Game Paused"
          className="absolute inset-0 z-30 bg-slate-950/55 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm bg-[#FFFDF7] border-3 border-slate-900 rounded-3xl p-6 shadow-[0_8px_0_#0F172A] text-center flex flex-col gap-4">
            <h2 className="font-display font-bold text-3xl text-slate-900">
              Pit Stop!
            </h2>
            <p className="text-sm font-semibold text-slate-600">
              {selectedCar.name} · {hud.stars} Stars · {hud.distance} m
            </p>

            <div className="flex flex-col gap-3 mt-1">
              <button
                type="button"
                onClick={resumeGame}
                className="w-full py-3.5 px-6 rounded-2xl bg-emerald-400 hover:bg-emerald-300 active:translate-y-0.5 text-slate-950 font-display font-bold text-xl border-2 border-slate-900 shadow-[0_4px_0_#0F172A] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-6 h-6 fill-slate-950" />
                <span>Keep Driving</span>
              </button>

              <button
                type="button"
                onClick={startGame}
                className="w-full py-3 px-6 rounded-2xl bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 text-slate-950 font-display font-bold text-lg border-2 border-slate-900 shadow-[0_4px_0_#0F172A] flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
                <span>Start Fresh</span>
              </button>

              <button
                type="button"
                onClick={returnToGarage}
                className="w-full py-3 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-display font-bold text-lg border-2 border-slate-900 cursor-pointer"
              >
                Pick Another Car
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER / CELEBRATION TROPHY MODAL */}
      {gameState === 'GAME_OVER' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Race Finished"
          className="absolute inset-0 z-30 bg-slate-950/60 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-[#FFFDF7] border-3 border-slate-900 rounded-3xl p-6 sm:p-7 shadow-[0_10px_0_#0F172A] text-center flex flex-col gap-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-400 border-2 border-slate-900 flex items-center justify-center shadow-[0_4px_0_#0F172A]">
              <Trophy className="w-9 h-9 text-slate-950" />
            </div>

            <div>
              <h2 className="font-display font-bold text-3xl text-slate-900">
                Awesome Drive!
              </h2>
              <p className="text-sm font-semibold text-slate-600 mt-1">
                {selectedCar.name} reached {runResult.zoneName}
              </p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-amber-50 border-2 border-slate-900 rounded-2xl p-3">
                <div className="text-xs font-bold text-slate-600">Stars</div>
                <div className="font-mono-nums font-bold text-2xl text-slate-900 mt-0.5">
                  {runResult.stars}
                </div>
              </div>
              <div className="bg-sky-50 border-2 border-slate-900 rounded-2xl p-3">
                <div className="text-xs font-bold text-slate-600">Distance</div>
                <div className="font-mono-nums font-bold text-2xl text-slate-900 mt-0.5">
                  {runResult.distance}m
                </div>
              </div>
              <div className="bg-emerald-50 border-2 border-slate-900 rounded-2xl p-3">
                <div className="text-xs font-bold text-slate-600">Best Stars</div>
                <div className="font-mono-nums font-bold text-2xl text-slate-900 mt-0.5">
                  {hud.bestStars}
                </div>
              </div>
            </div>

            {/* Low-Latency Pit-Crew Cheer & Sticker Award */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 text-left">
              {cheerLoading ? (
                <div className="text-sm font-semibold text-slate-500">
                  Pip is making your winner sticker...
                </div>
              ) : finalCheer ? (
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-600">
                    Sticker Earned · {finalCheer.stickerTitle}
                  </div>
                  <div className="font-display font-semibold text-base text-slate-900">
                    “{finalCheer.cheer}”
                  </div>
                </div>
              ) : cheerError ? (
                <div className="text-xs font-semibold text-rose-600">
                  Pit-crew radio note: {cheerError}
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-1">
              <button
                type="button"
                onClick={startGame}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 text-slate-950 font-display font-bold text-xl border-2 border-slate-900 shadow-[0_4px_0_#0F172A] flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-5 h-5" />
                <span>Play Again</span>
              </button>

              <button
                type="button"
                onClick={returnToGarage}
                className="py-3.5 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-display font-bold text-lg border-2 border-slate-900 cursor-pointer whitespace-nowrap"
              >
                Garage
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
