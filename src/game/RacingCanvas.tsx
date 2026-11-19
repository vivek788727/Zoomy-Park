import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { soundEngine } from '../audio/soundEngine';
import { CarConfig, GameState, HudSnapshot, ZONES, ZoneTheme } from './types';

export interface RacingCanvasHandle {
  steerLeft: () => void;
  steerRight: () => void;
  triggerTurbo: () => void;
  honkHorn: () => void;
}

interface RacingCanvasProps {
  gameState: GameState;
  selectedCar: CarConfig;
  onHudChange: (hud: HudSnapshot) => void;
  onMilestone: (stars: number, distance: number, zoneName: string) => void;
  onGameOver: (finalStars: number, finalDistance: number, zoneName: string) => void;
}

type ObstacleKind = 'cone' | 'bus' | 'ball';
type PickupKind = 'star' | 'turbo' | 'shield' | 'heart';

interface Obstacle {
  id: number;
  kind: ObstacleKind;
  lane: number;
  xOffset: number;
  y: number;
  speedFactor: number;
  phase: number;
  width: number;
  height: number;
  smashed: boolean;
}

interface Pickup {
  id: number;
  kind: PickupKind;
  lane: number;
  y: number;
  phase: number;
  collected: boolean;
}

interface Puddle {
  id: number;
  lane: number;
  y: number;
  splashed: boolean;
}

interface RoadsideProp {
  y: number;
  side: -1 | 1;
  offset: number;
  variant: number;
  scale: number;
  wiggle: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  shape: 'circle' | 'star' | 'note';
  rotation: number;
}

interface FloatingLabel {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

const LANE_COUNT = 3;
const MAX_HEARTS = 3;
const ZONE_STEP_METERS = 300;
const BEST_STARS_KEY = 'zoomy_park_best_stars';

function getStoredBestStars(): number {
  try {
    const val = Number(localStorage.getItem(BEST_STARS_KEY) || '0');
    return Number.isFinite(val) ? val : 0;
  } catch {
    return 0;
  }
}

function saveBestStars(stars: number): void {
  try {
    localStorage.setItem(BEST_STARS_KEY, String(stars));
  } catch {
    // ignore storage errors
  }
}

export const RacingCanvas = forwardRef<RacingCanvasHandle, RacingCanvasProps>(
  ({ gameState, selectedCar, onHudChange, onMilestone, onGameOver }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const gameStateRef = useRef<GameState>(gameState);
    const carRef = useRef<CarConfig>(selectedCar);
    const callbacksRef = useRef({ onHudChange, onMilestone, onGameOver });

    useEffect(() => {
      gameStateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
      carRef.current = selectedCar;
    }, [selectedCar]);

    useEffect(() => {
      callbacksRef.current = { onHudChange, onMilestone, onGameOver };
    }, [onHudChange, onMilestone, onGameOver]);

    const simRef = useRef({
      width: 900,
      height: 700,
      targetLane: 1,
      lanePos: 1, // smooth 0..2
      carTilt: 0,
      squashX: 1,
      squashY: 1,
      speed: 310, // px/s base
      distance: 0,
      stars: 0,
      bestStars: getStoredBestStars(),
      hearts: MAX_HEARTS,
      invulnTimer: 0,
      hitFlashTimer: 0,
      hitstopTimer: 0,
      shakeAmount: 0,
      hasShield: false,
      turboCharge: 40, // start nearly half charged so kids get turbo fast!
      turboTimer: 0,
      combo: 0,
      comboTimer: 0,
      nextMilestoneStars: 10,
      roadScroll: 0,
      spawnTimer: 0.7,
      pickupTimer: 0.45,
      puddleTimer: 2.2,
      nextId: 1,
      obstacles: [] as Obstacle[],
      pickups: [] as Pickup[],
      puddles: [] as Puddle[],
      props: [] as RoadsideProp[],
      particles: [] as Particle[],
      labels: [] as FloatingLabel[],
      heldLeft: false,
      heldRight: false,
      holdRepeatTimer: 0,
      bufferedSteer: 0 as -1 | 0 | 1,
      lastHudKey: '',
      touchStartX: null as number | null,
      touchStartY: null as number | null,
      touchSwiped: false,
    });

    const getRoadMetrics = (w: number) => {
      const roadWidth = Math.min(Math.max(w * 0.68, 250), 470);
      const roadLeft = (w - roadWidth) / 2;
      const laneWidth = roadWidth / LANE_COUNT;
      return { roadWidth, roadLeft, laneWidth };
    };

    const getLaneCenterX = (laneFloat: number, w: number) => {
      const { roadLeft, laneWidth } = getRoadMetrics(w);
      return roadLeft + laneWidth * (laneFloat + 0.5);
    };

    const spawnParticles = (
      x: number,
      y: number,
      count: number,
      colors: string[],
      shape: 'circle' | 'star' | 'note' = 'circle',
      speedScale = 1
    ) => {
      const s = simRef.current;
      for (let i = 0; i < count; i++) {
        if (s.particles.length > 160) s.particles.shift();
        const angle = Math.random() * Math.PI * 2;
        const mag = (50 + Math.random() * 140) * speedScale;
        s.particles.push({
          x,
          y,
          vx: Math.cos(angle) * mag,
          vy: Math.sin(angle) * mag - 30,
          size: shape === 'note' ? 14 : 4 + Math.random() * 5,
          color: colors[i % colors.length],
          life: 0.45 + Math.random() * 0.35,
          maxLife: 0.8,
          shape,
          rotation: Math.random() * Math.PI * 2,
        });
      }
    };

    const spawnLabel = (x: number, y: number, text: string, color: string) => {
      const s = simRef.current;
      if (s.labels.length > 16) s.labels.shift();
      s.labels.push({
        x,
        y,
        vy: -72,
        text,
        color,
        life: 0.85,
        maxLife: 0.85,
      });
    };

    const initRoadsideProps = () => {
      const s = simRef.current;
      s.props = [];
      for (let i = 0; i < 18; i++) {
        s.props.push({
          y: (i / 18) * (s.height + 160) - 80,
          side: i % 2 === 0 ? -1 : 1,
          offset: 36 + Math.random() * 90,
          variant: Math.floor(Math.random() * 3),
          scale: 0.82 + Math.random() * 0.36,
          wiggle: 0,
        });
      }
    };

    const resetSimulation = () => {
      const s = simRef.current;
      s.targetLane = 1;
      s.lanePos = 1;
      s.carTilt = 0;
      s.squashX = 1;
      s.squashY = 1;
      s.speed = 320;
      s.distance = 0;
      s.stars = 0;
      s.bestStars = getStoredBestStars();
      s.hearts = MAX_HEARTS;
      s.invulnTimer = 0;
      s.hitFlashTimer = 0;
      s.hitstopTimer = 0;
      s.shakeAmount = 0;
      s.hasShield = false;
      s.turboCharge = 40;
      s.turboTimer = 0;
      s.combo = 0;
      s.comboTimer = 0;
      s.nextMilestoneStars = 10;
      s.roadScroll = 0;
      s.spawnTimer = 0.85;
      s.pickupTimer = 0.3;
      s.puddleTimer = 2.0;
      s.obstacles = [];
      s.pickups = [];
      s.puddles = [];
      s.particles = [];
      s.labels = [];
      s.bufferedSteer = 0;
      s.lastHudKey = '';
      initRoadsideProps();
      emitHud(true);
    };

    const getCurrentZone = (): ZoneTheme => {
      const s = simRef.current;
      const idx = Math.floor(s.distance / ZONE_STEP_METERS) % ZONES.length;
      return ZONES[idx];
    };

    const emitHud = (force = false) => {
      const s = simRef.current;
      const zone = getCurrentZone();
      const distInt = Math.floor(s.distance);
      const turboInt = Math.round(s.turboCharge);
      const isTurbo = s.turboTimer > 0;
      const key = `${s.stars}|${distInt}|${s.hearts}|${turboInt}|${isTurbo}|${s.hasShield}|${zone.name}|${s.combo}`;
      if (!force && key === s.lastHudKey) return;
      s.lastHudKey = key;
      callbacksRef.current.onHudChange({
        stars: s.stars,
        distance: distInt,
        bestStars: s.bestStars,
        hearts: s.hearts,
        maxHearts: MAX_HEARTS,
        turboCharge: turboInt,
        isTurboActive: isTurbo,
        hasShield: s.hasShield,
        zoneName: zone.name,
        combo: s.combo,
      });
    };

    const performSteer = (dir: -1 | 1) => {
      if (gameStateRef.current !== 'PLAYING') return;
      const s = simRef.current;
      const next = Math.max(0, Math.min(LANE_COUNT - 1, s.targetLane + dir));
      if (next !== s.targetLane) {
        s.targetLane = next;
        s.squashX = 0.86;
        s.squashY = 1.14;
        soundEngine.playSteer();
      } else {
        s.bufferedSteer = dir;
      }
    };

    const triggerTurbo = () => {
      if (gameStateRef.current !== 'PLAYING') return;
      const s = simRef.current;
      if (s.turboTimer > 0) return;

      if (s.turboCharge >= 100) {
        s.turboCharge = 0;
        s.turboTimer = 4.2;
        s.squashX = 0.8;
        s.squashY = 1.25;
        s.shakeAmount = Math.max(s.shakeAmount, 5);
        soundEngine.playTurbo();
        const carX = getLaneCenterX(s.lanePos, s.width);
        const carY = s.height * 0.77;
        spawnParticles(carX, carY, 18, carRef.current.trailColors, 'star', 1.3);
        spawnLabel(carX, carY - 56, 'TURBO ZOOM!', '#FACC15');
        emitHud(true);
      } else {
        // Mini cheerful hop-boost even before full 100% so little kids always feel response!
        s.squashX = 1.15;
        s.squashY = 0.88;
        soundEngine.playSteer();
        const carX = getLaneCenterX(s.lanePos, s.width);
        const carY = s.height * 0.77;
        spawnLabel(carX, carY - 52, 'Need More ★!', '#38BDF8');
      }
    };

    const honkHorn = () => {
      if (gameStateRef.current !== 'PLAYING') return;
      const s = simRef.current;
      soundEngine.playHorn();
      s.squashX = 1.14;
      s.squashY = 0.9;
      const carX = getLaneCenterX(s.lanePos, s.width);
      const carY = s.height * 0.77;
      spawnParticles(carX, carY - 30, 6, ['#FACC15', '#38BDF8', '#F472B6'], 'note', 0.8);
      spawnLabel(carX, carY - 62, 'BEEP BEEP!', '#FFFFFF');
      for (const p of s.props) {
        p.wiggle = 0.6;
      }
    };

    useImperativeHandle(ref, () => ({
      steerLeft: () => performSteer(-1),
      steerRight: () => performSteer(1),
      triggerTurbo,
      honkHorn,
    }));

    // Reset simulation when entering PLAYING from TITLE_MENU or GAME_OVER
    const prevStateRef = useRef<GameState>(gameState);
    useEffect(() => {
      const prev = prevStateRef.current;
      if (gameState === 'PLAYING' && (prev === 'TITLE_MENU' || prev === 'GAME_OVER')) {
        resetSimulation();
        soundEngine.playStart();
      }
      prevStateRef.current = gameState;
    }, [gameState]);

    // Keyboard controls & blur clearing
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if (gameStateRef.current !== 'PLAYING') return;
        const s = simRef.current;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          e.preventDefault();
          if (!e.repeat) {
            performSteer(-1);
            s.holdRepeatTimer = 0.25;
          }
          s.heldLeft = true;
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          e.preventDefault();
          if (!e.repeat) {
            performSteer(1);
            s.holdRepeatTimer = 0.25;
          }
          s.heldRight = true;
        } else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          if (!e.repeat) triggerTurbo();
        } else if (e.code === 'KeyH') {
          e.preventDefault();
          if (!e.repeat) honkHorn();
        }
      };

      const onKeyUp = (e: KeyboardEvent) => {
        const s = simRef.current;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') s.heldLeft = false;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') s.heldRight = false;
      };

      const onBlur = () => {
        const s = simRef.current;
        s.heldLeft = false;
        s.heldRight = false;
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
      };
    }, []);

    // ResizeObserver & Main 60fps Canvas Loop
    useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const resize = () => {
        const rect = container.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(320, Math.floor(rect.width));
        const h = Math.max(360, Math.floor(rect.height));
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        simRef.current.width = w;
        simRef.current.height = h;
      };

      resize();
      initRoadsideProps();
      const ro = new ResizeObserver(resize);
      ro.observe(container);

      let rafId = 0;
      let lastTime = performance.now();

      const spawnObstacleWave = () => {
        const s = simRef.current;
        const difficulty = Math.min(1, s.distance / 1800);
        const roll = Math.random();
        let kind: ObstacleKind = 'cone';
        if (roll > 0.68 && s.distance > 90) {
          kind = 'bus';
        } else if (roll > 0.42 && s.distance > 40) {
          kind = 'ball';
        }

        const lane = Math.floor(Math.random() * LANE_COUNT);
        // Ensure we never block all 3 lanes at the same vertical slice!
        const nearbyLanes = new Set(
          s.obstacles.filter((o) => o.y < 180).map((o) => o.lane)
        );
        if (nearbyLanes.size >= 2 && !nearbyLanes.has(lane)) {
          return;
        }

        s.obstacles.push({
          id: s.nextId++,
          kind,
          lane,
          xOffset: 0,
          y: -90,
          speedFactor: kind === 'bus' ? 0.62 + difficulty * 0.14 : 1,
          phase: Math.random() * Math.PI * 2,
          width: kind === 'bus' ? 58 : kind === 'ball' ? 46 : 42,
          height: kind === 'bus' ? 86 : kind === 'ball' ? 46 : 44,
          smashed: false,
        });
      };

      const spawnPickupWave = () => {
        const s = simRef.current;
        const lane = Math.floor(Math.random() * LANE_COUNT);
        // Avoid spawning directly inside an active obstacle
        const blocked = s.obstacles.some((o) => o.y < 80 && o.lane === lane);
        const safeLane = blocked ? (lane + 1) % LANE_COUNT : lane;

        const roll = Math.random();
        if (roll < 0.08 && s.hearts < MAX_HEARTS) {
          s.pickups.push({
            id: s.nextId++,
            kind: 'heart',
            lane: safeLane,
            y: -60,
            phase: Math.random() * 6,
            collected: false,
          });
        } else if (roll < 0.15 && !s.hasShield) {
          s.pickups.push({
            id: s.nextId++,
            kind: 'shield',
            lane: safeLane,
            y: -60,
            phase: Math.random() * 6,
            collected: false,
          });
        } else if (roll < 0.22) {
          s.pickups.push({
            id: s.nextId++,
            kind: 'turbo',
            lane: safeLane,
            y: -60,
            phase: Math.random() * 6,
            collected: false,
          });
        } else {
          // Spawn a cheerful line of 2-3 golden stars!
          const count = Math.random() < 0.55 ? 3 : 2;
          for (let i = 0; i < count; i++) {
            s.pickups.push({
              id: s.nextId++,
              kind: 'star',
              lane: safeLane,
              y: -50 - i * 62,
              phase: i * 0.4,
              collected: false,
            });
          }
        }
      };

      const stepSimulation = (dt: number) => {
        const s = simRef.current;

        if (s.hitstopTimer > 0) {
          s.hitstopTimer = Math.max(0, s.hitstopTimer - dt);
          s.shakeAmount = Math.max(0, s.shakeAmount - dt * 28);
          return;
        }

        // Smooth held steering repeat for kids holding down Left/Right
        if (s.heldLeft || s.heldRight) {
          s.holdRepeatTimer -= dt;
          if (s.holdRepeatTimer <= 0) {
            if (s.heldLeft && !s.heldRight) performSteer(-1);
            if (s.heldRight && !s.heldLeft) performSteer(1);
            s.holdRepeatTimer = 0.24;
          }
        }

        // Apply buffered steer once car nears current target
        if (s.bufferedSteer !== 0 && Math.abs(s.lanePos - s.targetLane) < 0.18) {
          const dir = s.bufferedSteer;
          s.bufferedSteer = 0;
          performSteer(dir);
        }

        // Difficulty & Speed ramp (gentle and friendly!)
        const difficultySpeedBonus = Math.min(210, s.distance * 0.085);
        const turboMultiplier = s.turboTimer > 0 ? 1.65 : 1;
        const currentSpeed = (315 + difficultySpeedBonus) * turboMultiplier;
        s.speed = currentSpeed;
        s.roadScroll = (s.roadScroll + currentSpeed * dt) % 120;
        s.distance += (currentSpeed * dt) / 28;

        // Timers
        if (s.invulnTimer > 0) s.invulnTimer = Math.max(0, s.invulnTimer - dt);
        if (s.hitFlashTimer > 0) s.hitFlashTimer = Math.max(0, s.hitFlashTimer - dt);
        if (s.shakeAmount > 0) s.shakeAmount = Math.max(0, s.shakeAmount - dt * 24);
        if (s.comboTimer > 0) {
          s.comboTimer -= dt;
          if (s.comboTimer <= 0) s.combo = 0;
        }
        if (s.turboTimer > 0) {
          s.turboTimer = Math.max(0, s.turboTimer - dt);
          if (Math.random() < 0.65) {
            const cx = getLaneCenterX(s.lanePos, s.width);
            const cy = s.height * 0.77 + 44;
            spawnParticles(cx + (Math.random() - 0.5) * 20, cy, 1, carRef.current.trailColors, 'circle', 0.45);
          }
        }

        // Smooth lane spring + tilt + squash recovery
        const laneDiff = s.targetLane - s.lanePos;
        s.lanePos += laneDiff * Math.min(1, dt * 13);
        s.carTilt += (laneDiff * 0.34 - s.carTilt) * Math.min(1, dt * 14);
        s.squashX += (1 - s.squashX) * Math.min(1, dt * 12);
        s.squashY += (1 - s.squashY) * Math.min(1, dt * 12);

        // Roadside props scrolling
        for (const prop of s.props) {
          prop.y += currentSpeed * dt;
          if (prop.wiggle > 0) prop.wiggle = Math.max(0, prop.wiggle - dt);
          if (prop.y > s.height + 90) {
            prop.y = -80 - Math.random() * 40;
            prop.offset = 34 + Math.random() * 95;
            prop.variant = Math.floor(Math.random() * 3);
          }
        }

        // Spawners
        const spawnInterval = Math.max(0.62, 1.38 - Math.min(0.65, s.distance / 2200));
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          spawnObstacleWave();
          s.spawnTimer = spawnInterval * (0.85 + Math.random() * 0.35);
        }

        s.pickupTimer -= dt;
        if (s.pickupTimer <= 0) {
          spawnPickupWave();
          s.pickupTimer = 1.15 + Math.random() * 0.65;
        }

        s.puddleTimer -= dt;
        if (s.puddleTimer <= 0) {
          s.puddles.push({
            id: s.nextId++,
            lane: Math.floor(Math.random() * LANE_COUNT),
            y: -70,
            splashed: false,
          });
          s.puddleTimer = 3.2 + Math.random() * 2.5;
        }

        const carX = getLaneCenterX(s.lanePos, s.width);
        const carY = s.height * 0.77;
        const carHitW = 42;
        const carHitH = 68;
        const { laneWidth } = getRoadMetrics(s.width);

        // Update puddles (harmless splash joy!)
        for (const p of s.puddles) {
          p.y += currentSpeed * dt;
          const px = getLaneCenterX(p.lane, s.width);
          if (
            !p.splashed &&
            Math.abs(px - carX) < 36 &&
            Math.abs(p.y - carY) < 42
          ) {
            p.splashed = true;
            spawnParticles(carX, carY + 14, 12, ['#38BDF8', '#BAE6FD', '#FFFFFF'], 'circle', 0.9);
            spawnLabel(carX, carY - 46, 'SPLASH!', '#38BDF8');
            soundEngine.playSteer();
          }
        }
        s.puddles = s.puddles.filter((p) => p.y < s.height + 100);

        // Update pickups
        for (const item of s.pickups) {
          item.y += currentSpeed * dt;
          item.phase += dt * 4.2;
          if (item.collected) continue;
          const ix = getLaneCenterX(item.lane, s.width);
          if (Math.abs(ix - carX) < 42 && Math.abs(item.y - carY) < 52) {
            item.collected = true;
            s.squashX = 1.16;
            s.squashY = 0.88;

            if (item.kind === 'star') {
              s.stars += 1;
              s.combo += 1;
              s.comboTimer = 2.1;
              s.turboCharge = Math.min(100, s.turboCharge + 14);
              if (s.stars > s.bestStars) {
                s.bestStars = s.stars;
                saveBestStars(s.bestStars);
              }
              soundEngine.playStar(s.combo);
              spawnParticles(ix, item.y, 9, ['#FACC15', '#FEF08A', '#F97316'], 'star', 0.85);
              spawnLabel(ix, item.y - 24, s.combo >= 3 ? `+1 ★ x${s.combo}` : '+1 ★', '#FACC15');

              if (s.stars >= s.nextMilestoneStars) {
                const zone = getCurrentZone();
                callbacksRef.current.onMilestone(s.stars, Math.floor(s.distance), zone.name);
                s.nextMilestoneStars += 12;
              }
            } else if (item.kind === 'turbo') {
              s.turboCharge = 100;
              s.turboTimer = 4.2;
              soundEngine.playTurbo();
              spawnParticles(ix, item.y, 18, carRef.current.trailColors, 'star', 1.25);
              spawnLabel(ix, item.y - 32, 'RAINBOW TURBO!', '#F472B6');
            } else if (item.kind === 'shield') {
              s.hasShield = true;
              soundEngine.playPowerup();
              spawnParticles(ix, item.y, 14, ['#38BDF8', '#E0F2FE', '#FFFFFF'], 'circle', 1);
              spawnLabel(ix, item.y - 30, 'BUBBLE SHIELD!', '#38BDF8');
            } else if (item.kind === 'heart') {
              s.hearts = Math.min(MAX_HEARTS, s.hearts + 1);
              soundEngine.playPowerup();
              spawnParticles(ix, item.y, 14, ['#F43F5E', '#FDA4AF', '#FFFFFF'], 'circle', 1);
              spawnLabel(ix, item.y - 30, '+1 HEART!', '#FB7185');
            }
          }
        }
        s.pickups = s.pickups.filter((p) => !p.collected && p.y < s.height + 90);

        // Update obstacles
        for (const obs of s.obstacles) {
          obs.y += currentSpeed * obs.speedFactor * dt;
          obs.phase += dt * 4;
          if (obs.kind === 'ball') {
            obs.xOffset = Math.sin(obs.phase) * Math.min(26, laneWidth * 0.22);
          }
          if (obs.smashed) continue;

          const ox = getLaneCenterX(obs.lane, s.width) + obs.xOffset;
          const hitDistX = (carHitW + obs.width) * 0.42;
          const hitDistY = (carHitH + obs.height) * 0.4;

          if (Math.abs(ox - carX) < hitDistX && Math.abs(obs.y - carY) < hitDistY) {
            obs.smashed = true;
            if (s.turboTimer > 0) {
              // Turbo smashes obstacles into bonus stars!
              s.stars += 2;
              if (s.stars > s.bestStars) {
                s.bestStars = s.stars;
                saveBestStars(s.bestStars);
              }
              s.shakeAmount = 4;
              soundEngine.playStar(5);
              spawnParticles(ox, obs.y, 14, ['#FACC15', '#FB923C', '#FFFFFF'], 'star', 1.2);
              spawnLabel(ox, obs.y - 28, 'SMASH +2 ★', '#FACC15');
            } else if (s.hasShield) {
              s.hasShield = false;
              s.invulnTimer = 1.2;
              s.shakeAmount = 5;
              soundEngine.playPowerup();
              spawnParticles(carX, carY, 16, ['#38BDF8', '#BAE6FD', '#FFFFFF'], 'circle', 1.1);
              spawnLabel(carX, carY - 46, 'SHIELD POP!', '#38BDF8');
            } else if (s.invulnTimer <= 0) {
              s.hearts -= 1;
              s.invulnTimer = 1.9;
              s.hitFlashTimer = 0.22;
              s.hitstopTimer = 0.05; // 50ms crisp hitstop
              s.shakeAmount = 9;
              s.squashX = 1.28;
              s.squashY = 0.76;
              s.combo = 0;
              soundEngine.playBump();
              spawnParticles(ox, obs.y, 14, ['#FB923C', '#FDE047', '#FFFFFF'], 'circle', 1.1);
              spawnLabel(carX, carY - 48, 'BOING!', '#FB7185');

              if (s.hearts <= 0) {
                emitHud(true);
                soundEngine.playFinish();
                const zone = getCurrentZone();
                callbacksRef.current.onGameOver(s.stars, Math.floor(s.distance), zone.name);
                return;
              }
            }
          }
        }
        s.obstacles = s.obstacles.filter((o) => !o.smashed && o.y < s.height + 120);

        // Update particles
        for (const pt of s.particles) {
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.vy += 120 * dt;
          pt.life -= dt;
          pt.rotation += dt * 4;
        }
        s.particles = s.particles.filter((pt) => pt.life > 0);

        // Update floating labels
        for (const lb of s.labels) {
          lb.y += lb.vy * dt;
          lb.life -= dt;
        }
        s.labels = s.labels.filter((lb) => lb.life > 0);

        emitHud(false);
      };

      const drawStarShape = (
        c: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        rOuter: number,
        rInner: number,
        points = 5
      ) => {
        c.beginPath();
        for (let i = 0; i < points * 2; i++) {
          const r = i % 2 === 0 ? rOuter : rInner;
          const angle = (i * Math.PI) / points - Math.PI / 2;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.closePath();
      };

      const drawRoadsideProp = (
        c: CanvasRenderingContext2D,
        prop: RoadsideProp,
        x: number,
        zone: ZoneTheme
      ) => {
        c.save();
        const wiggleAngle = prop.wiggle > 0 ? Math.sin(prop.wiggle * 30) * 0.14 : 0;
        c.translate(x, prop.y);
        c.rotate(wiggleAngle);
        c.scale(prop.scale, prop.scale);

        if (zone.propType === 'meadow') {
          if (prop.variant === 0 || prop.variant === 1) {
            // Fluffy rounded cartoon tree
            c.fillStyle = '#92400E';
            c.fillRect(-7, 4, 14, 24);
            c.fillStyle = '#15803D';
            c.beginPath();
            c.arc(0, -10, 26, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#22C55E';
            c.beginPath();
            c.arc(-6, -15, 19, 0, Math.PI * 2);
            c.fill();
            if (prop.variant === 1) {
              // Red apples on tree
              c.fillStyle = '#EF4444';
              c.beginPath();
              c.arc(-10, -10, 4, 0, Math.PI * 2);
              c.arc(9, -16, 4, 0, Math.PI * 2);
              c.arc(4, -2, 4, 0, Math.PI * 2);
              c.fill();
            }
          } else {
            // Cheerful flower patch
            const petals = ['#F43F5E', '#FACC15', '#38BDF8', '#A855F7'];
            for (let i = 0; i < 4; i++) {
              const fx = (i - 1.5) * 11;
              const fy = (i % 2) * 8;
              c.fillStyle = petals[i];
              c.beginPath();
              c.arc(fx, fy, 6, 0, Math.PI * 2);
              c.fill();
              c.fillStyle = '#FEF08A';
              c.beginPath();
              c.arc(fx, fy, 2.5, 0, Math.PI * 2);
              c.fill();
            }
          }
        } else if (zone.propType === 'beach') {
          if (prop.variant === 0) {
            // Beach umbrella
            c.fillStyle = 'rgba(15,23,42,0.16)';
            c.beginPath();
            c.ellipse(5, 8, 22, 12, 0, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#EF4444';
            c.beginPath();
            c.arc(0, 0, 24, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#FFFFFF';
            c.beginPath();
            c.moveTo(0, 0);
            c.arc(0, 0, 24, 0, Math.PI / 3);
            c.closePath();
            c.moveTo(0, 0);
            c.arc(0, 0, 24, (Math.PI * 2) / 3, Math.PI);
            c.closePath();
            c.moveTo(0, 0);
            c.arc(0, 0, 24, (Math.PI * 4) / 3, (Math.PI * 5) / 3);
            c.closePath();
            c.fill();
            c.fillStyle = '#FACC15';
            c.beginPath();
            c.arc(0, 0, 4, 0, Math.PI * 2);
            c.fill();
          } else {
            // Palm cluster
            c.fillStyle = '#16A34A';
            for (let a = 0; a < 5; a++) {
              c.save();
              c.rotate((a * Math.PI * 2) / 5);
              c.beginPath();
              c.ellipse(16, 0, 16, 6, 0, 0, Math.PI * 2);
              c.fill();
              c.restore();
            }
            c.fillStyle = '#92400E';
            c.beginPath();
            c.arc(0, 0, 6, 0, Math.PI * 2);
            c.fill();
          }
        } else if (zone.propType === 'candy') {
          // Giant swirl lollipop
          c.fillStyle = '#FFFFFF';
          c.fillRect(-3, 0, 6, 28);
          c.fillStyle = prop.variant === 0 ? '#EC4899' : '#38BDF8';
          c.beginPath();
          c.arc(0, -10, 20, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = '#FFFFFF';
          c.lineWidth = 4;
          c.beginPath();
          c.arc(0, -10, 11, 0, Math.PI * 1.5);
          c.stroke();
        } else {
          // Firefly park glowing lantern
          c.fillStyle = '#064E3B';
          c.beginPath();
          c.arc(0, 0, 20, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = 'rgba(250, 204, 21, 0.35)';
          c.beginPath();
          c.arc(0, 0, 15, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#FEF08A';
          c.beginPath();
          c.arc(0, 0, 6, 0, Math.PI * 2);
          c.fill();
        }

        c.restore();
      };

      const drawPlayerCar = (
        c: CanvasRenderingContext2D,
        x: number,
        y: number,
        car: CarConfig
      ) => {
        const s = simRef.current;
        if (s.invulnTimer > 0 && Math.floor(s.invulnTimer * 14) % 2 === 1) {
          c.globalAlpha = 0.45;
        }

        c.save();
        c.translate(x, y);
        c.rotate(s.carTilt);
        c.scale(s.squashX, s.squashY);

        // Soft ground shadow
        c.fillStyle = 'rgba(15, 23, 42, 0.28)';
        c.beginPath();
        c.roundRect(-29, -40, 58, 92, 20);
        c.fill();

        // Rainbow aura when Turbo is active
        if (s.turboTimer > 0) {
          c.strokeStyle = '#FACC15';
          c.lineWidth = 6;
          c.beginPath();
          c.roundRect(-34, -52, 68, 104, 24);
          c.stroke();
        }

        // Wheels
        c.fillStyle = '#0F172A';
        c.beginPath();
        c.roundRect(-31, -34, 10, 22, 4);
        c.roundRect(21, -34, 10, 22, 4);
        c.roundRect(-31, 14, 10, 22, 4);
        c.roundRect(21, 14, 10, 22, 4);
        c.fill();

        // Main Car Body
        c.fillStyle = s.hitFlashTimer > 0 ? '#FFFFFF' : car.bodyColor;
        c.strokeStyle = '#0F172A';
        c.lineWidth = 3.5;
        c.beginPath();
        c.roundRect(-25, -45, 50, 90, 17);
        c.fill();
        c.stroke();

        // Racing Stripe
        if (s.hitFlashTimer <= 0) {
          c.fillStyle = car.stripeColor;
          c.beginPath();
          c.roundRect(-6, -43, 12, 86, 4);
          c.fill();
        }

        // Windshield
        c.fillStyle = '#BAE6FD';
        c.strokeStyle = '#0F172A';
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(-17, -18);
        c.quadraticCurveTo(0, -28, 17, -18);
        c.lineTo(14, -4);
        c.lineTo(-14, -4);
        c.closePath();
        c.fill();
        c.stroke();

        // Roof
        c.fillStyle = car.roofColor;
        c.beginPath();
        c.roundRect(-16, -6, 32, 28, 8);
        c.fill();
        c.stroke();

        // Roof special feature
        if (car.id === 'blue_siren') {
          const blink = Math.floor(performance.now() / 160) % 2 === 0;
          c.fillStyle = blink ? '#EF4444' : '#38BDF8';
          c.fillRect(-10, 3, 10, 7);
          c.fillStyle = blink ? '#38BDF8' : '#EF4444';
          c.fillRect(0, 3, 10, 7);
        } else if (car.id === 'minty_cone') {
          c.fillStyle = '#FFFDF7';
          c.beginPath();
          c.arc(0, 8, 8, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        }

        // Friendly bright headlights
        c.fillStyle = '#FEF08A';
        c.beginPath();
        c.ellipse(-15, -39, 5, 3.5, 0, 0, Math.PI * 2);
        c.ellipse(15, -39, 5, 3.5, 0, 0, Math.PI * 2);
        c.fill();

        // Bubble shield overlay
        if (s.hasShield) {
          c.strokeStyle = '#38BDF8';
          c.fillStyle = 'rgba(56, 189, 248, 0.22)';
          c.lineWidth = 3.5;
          c.beginPath();
          c.arc(0, 0, 52, 0, Math.PI * 2);
          c.fill();
          c.stroke();
          c.fillStyle = 'rgba(255,255,255,0.6)';
          c.beginPath();
          c.ellipse(-20, -24, 9, 4, -0.7, 0, Math.PI * 2);
          c.fill();
        }

        c.restore();
        c.globalAlpha = 1;
      };

      const renderScene = () => {
        const s = simRef.current;
        const w = s.width;
        const h = s.height;
        const zone = getCurrentZone();
        const { roadWidth, roadLeft, laneWidth } = getRoadMetrics(w);

        ctx.save();
        if (s.shakeAmount > 0.2) {
          const sx = (Math.random() - 0.5) * s.shakeAmount * 1.4;
          const sy = (Math.random() - 0.5) * s.shakeAmount * 1.4;
          ctx.translate(sx, sy);
        }

        // Grass / Terrain backdrop
        ctx.fillStyle = zone.grassLight;
        ctx.fillRect(0, 0, w, h);

        // Alternating mowing stripes for speed sensation!
        const stripeH = 60;
        const offset = s.roadScroll % (stripeH * 2);
        ctx.fillStyle = zone.grassDark;
        for (let y = -stripeH * 2 + offset; y < h + stripeH; y += stripeH * 2) {
          ctx.fillRect(0, y, w, stripeH);
        }

        // Roadside Props
        for (const prop of s.props) {
          const px =
            prop.side === -1
              ? Math.max(24, roadLeft - prop.offset)
              : Math.min(w - 24, roadLeft + roadWidth + prop.offset);
          if (px > 12 && px < w - 12) {
            drawRoadsideProp(ctx, prop, px, zone);
          }
        }

        // Soft shoulder
        ctx.fillStyle = zone.shoulderColor;
        ctx.fillRect(roadLeft - 14, 0, roadWidth + 28, h);

        // Main Road Asphalt
        ctx.fillStyle = zone.roadColor;
        ctx.fillRect(roadLeft, 0, roadWidth, h);

        // Colorful Racing Kerbs (left & right)
        const kerbSeg = 40;
        const kerbOffset = s.roadScroll % (kerbSeg * 2);
        for (let y = -kerbSeg * 2 + kerbOffset; y < h + kerbSeg; y += kerbSeg) {
          const idx = Math.floor((y - kerbOffset) / kerbSeg);
          ctx.fillStyle = Math.abs(idx) % 2 === 0 ? zone.kerbA : zone.kerbB;
          ctx.fillRect(roadLeft - 10, y, 10, kerbSeg);
          ctx.fillRect(roadLeft + roadWidth, y, 10, kerbSeg);
        }

        // Lane Divider Dashes
        ctx.fillStyle = zone.stripeColor;
        ctx.globalAlpha = 0.85;
        const dashOffset = s.roadScroll % 80;
        for (let l = 1; l < LANE_COUNT; l++) {
          const lx = roadLeft + l * laneWidth - 4;
          for (let y = -80 + dashOffset; y < h + 80; y += 80) {
            ctx.beginPath();
            ctx.roundRect(lx, y, 8, 42, 4);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;

        // Water Puddles
        for (const p of s.puddles) {
          const px = getLaneCenterX(p.lane, w);
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.ellipse(px, p.y, 34, 20, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#E0F2FE';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(px - 6, p.y - 3, 20, 10, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Pickups
        for (const item of s.pickups) {
          const ix = getLaneCenterX(item.lane, w);
          const bob = Math.sin(item.phase) * 4;
          ctx.save();
          ctx.translate(ix, item.y + bob);

          if (item.kind === 'star') {
            ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
            ctx.beginPath();
            ctx.arc(0, 0, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.rotate(Math.sin(item.phase * 0.5) * 0.22);
            ctx.fillStyle = '#FACC15';
            ctx.strokeStyle = '#B45309';
            ctx.lineWidth = 2.8;
            drawStarShape(ctx, 0, 0, 17, 8, 5);
            ctx.fill();
            ctx.stroke();
          } else if (item.kind === 'turbo') {
            ctx.fillStyle = '#F472B6';
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 21, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#FEF08A';
            ctx.beginPath();
            ctx.moveTo(3, -12);
            ctx.lineTo(-7, 1);
            ctx.lineTo(0, 1);
            c_bolt(ctx);
          } else if (item.kind === 'shield') {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(0, 0, 21, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            c_shield(ctx);
          } else if (item.kind === 'heart') {
            ctx.fillStyle = '#EF4444';
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 13);
            ctx.bezierCurveTo(-20, 0, -18, -16, 0, -6);
            ctx.bezierCurveTo(18, -16, 20, 0, 0, 13);
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }

        // Obstacles
        for (const obs of s.obstacles) {
          const ox = getLaneCenterX(obs.lane, w) + obs.xOffset;
          ctx.save();
          ctx.translate(ox, obs.y);

          if (obs.kind === 'cone') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
            ctx.beginPath();
            ctx.ellipse(0, 16, 20, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#F97316';
            ctx.strokeStyle = '#0F172A';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(-18, 8, 36, 10, 4);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            c_cone(ctx);
          } else if (obs.kind === 'ball') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
            ctx.beginPath();
            ctx.ellipse(0, 22, 20, 7, 0, 0, Math.PI * 2);
            ctx.fill();

            const bounceY = -Math.abs(Math.sin(obs.phase * 1.4)) * 10;
            ctx.translate(0, bounceY);
            ctx.rotate(obs.phase * 0.6);
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#0F172A';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 21, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#EF4444';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, 19, 0, Math.PI * 0.65);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#38BDF8';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, 19, Math.PI * 0.65, Math.PI * 1.35);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#FACC15';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, 19, Math.PI * 1.35, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
          } else if (obs.kind === 'bus') {
            // Friendly slow yellow school-style mini bus
            ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
            ctx.beginPath();
            ctx.roundRect(-27, -38, 54, 84, 14);
            ctx.fill();

            ctx.fillStyle = '#FBBF24';
            ctx.strokeStyle = '#0F172A';
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.roundRect(-26, -42, 52, 84, 13);
            ctx.fill();
            ctx.stroke();

            // Roof & Windows
            c_busDetails(ctx, obs.phase);

            // Clear windup telegraph badge while entering
            if (obs.y < 140) {
              ctx.fillStyle = '#EF4444';
              ctx.beginPath();
              ctx.arc(0, -56, 13, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#FFFFFF';
              ctx.font = '700 16px Fredoka, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('!', 0, -55);
            }
          }

          ctx.restore();
        }

        // Player Car
        const playerX = getLaneCenterX(s.lanePos, w);
        const playerY = h * 0.77;
        drawPlayerCar(ctx, playerX, playerY, carRef.current);

        // Particles
        for (const pt of s.particles) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
          ctx.translate(pt.x, pt.y);
          ctx.rotate(pt.rotation);
          ctx.fillStyle = pt.color;
          if (pt.shape === 'star') {
            drawStarShape(ctx, 0, 0, pt.size, pt.size * 0.45, 5);
            ctx.fill();
          } else if (pt.shape === 'note') {
            ctx.font = '700 20px Fredoka, sans-serif';
            ctx.fillText('♪', -6, 6);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, pt.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // Floating Comic Labels
        for (const lb of s.labels) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, (lb.life / lb.maxLife) * 1.4);
          ctx.font = '700 22px Fredoka, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#0F172A';
          ctx.strokeText(lb.text, lb.x, lb.y);
          ctx.fillStyle = lb.color;
          ctx.fillText(lb.text, lb.x, lb.y);
          ctx.restore();
        }

        ctx.restore();
      };

      const loop = (now: number) => {
        const rawDt = (now - lastTime) / 1000;
        lastTime = now;
        const dt = Math.min(Math.max(rawDt, 0), 0.05);

        if (gameStateRef.current === 'PLAYING') {
          stepSimulation(dt);
        } else if (gameStateRef.current === 'TITLE_MENU') {
          // Gentle scenic live road drift behind title backdrop if visible
          simRef.current.roadScroll = (simRef.current.roadScroll + 120 * dt) % 120;
        }

        renderScene();
        rafId = requestAnimationFrame(loop);
      };

      rafId = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(rafId);
        ro.disconnect();
      };
    }, []);

    // Direct canvas touch / click steering (tap left side -> steer left, tap right side -> steer right, or swipe!)
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (gameStateRef.current !== 'PLAYING') return;
      const s = simRef.current;
      s.touchStartX = e.clientX;
      s.touchStartY = e.clientY;
      s.touchSwiped = false;
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (gameStateRef.current !== 'PLAYING') return;
      const s = simRef.current;
      if (s.touchStartX === null || s.touchSwiped) return;
      const dx = e.clientX - s.touchStartX;
      if (Math.abs(dx) >= 24) {
        s.touchSwiped = true;
        performSteer(dx < 0 ? -1 : 1);
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (gameStateRef.current !== 'PLAYING') return;
      const s = simRef.current;
      if (!s.touchSwiped && s.touchStartX !== null) {
        const rect = e.currentTarget.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        if (relX < rect.width * 0.5) {
          performSteer(-1);
        } else {
          performSteer(1);
        }
      }
      s.touchStartX = null;
      s.touchStartY = null;
      s.touchSwiped = false;
    };

    return (
      <div ref={containerRef} className="relative w-full h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="block w-full h-full touch-none cursor-pointer"
          aria-label="Zoomy Park racing track"
        />
      </div>
    );
  }
);

RacingCanvas.displayName = 'RacingCanvas';

function c_bolt(ctx: CanvasRenderingContext2D) {
  ctx.lineTo(-3, 12);
  ctx.lineTo(8, -1);
  ctx.lineTo(1, -1);
  ctx.closePath();
  ctx.fill();
}

function c_shield(ctx: CanvasRenderingContext2D) {
  ctx.moveTo(0, -10);
  ctx.lineTo(9, -6);
  ctx.quadraticCurveTo(9, 6, 0, 11);
  ctx.quadraticCurveTo(-9, 6, -9, -6);
  ctx.closePath();
  ctx.fill();
}

function c_cone(ctx: CanvasRenderingContext2D) {
  ctx.moveTo(-13, 10);
  ctx.lineTo(-4, -18);
  ctx.lineTo(4, -18);
  ctx.lineTo(13, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(-6, -8);
  ctx.lineTo(6, -8);
  ctx.lineTo(9, 0);
  ctx.closePath();
  ctx.fill();
}

function c_busDetails(ctx: CanvasRenderingContext2D, phase: number) {
  // Top & bottom windows
  ctx.fillStyle = '#BAE6FD';
  ctx.beginPath();
  ctx.roundRect(-19, -32, 38, 14, 5);
  ctx.roundRect(-19, 20, 38, 12, 4);
  ctx.fill();

  // Roof stripes
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.roundRect(-18, -12, 36, 26, 6);
  ctx.fill();

  // Blinking rear hazard lights
  const blink = Math.sin(phase * 2.5) > 0;
  ctx.fillStyle = blink ? '#EF4444' : '#991B1B';
  ctx.beginPath();
  ctx.arc(-16, 37, 4, 0, Math.PI * 2);
  ctx.arc(16, 37, 4, 0, Math.PI * 2);
  ctx.fill();
}
