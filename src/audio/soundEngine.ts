class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.16,
    delay = 0,
    endFreq?: number
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playStart(): void {
    this.playTone(523.25, 0.12, 'triangle', 0.18, 0);
    this.playTone(659.25, 0.12, 'triangle', 0.18, 0.09);
    this.playTone(783.99, 0.16, 'triangle', 0.2, 0.18);
    this.playTone(1046.5, 0.28, 'sine', 0.2, 0.28);
  }

  public playSteer(): void {
    this.playTone(340, 0.09, 'sine', 0.08, 0, 520);
  }

  public playStar(combo = 1): void {
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
    const idx = Math.min(pentatonic.length - 1, Math.max(0, (combo - 1) % pentatonic.length));
    const base = pentatonic[idx];
    this.playTone(base, 0.14, 'triangle', 0.16, 0);
    this.playTone(base * 1.5, 0.16, 'sine', 0.1, 0.04);
  }

  public playTurbo(): void {
    this.playTone(330, 0.25, 'sawtooth', 0.08, 0, 880);
    this.playTone(523.25, 0.35, 'triangle', 0.16, 0.05, 1046.5);
  }

  public playHorn(): void {
    // Cheerful cartoon Beep-Beep!
    this.playTone(440, 0.11, 'triangle', 0.18, 0, 460);
    this.playTone(554.37, 0.11, 'sine', 0.14, 0, 580);
    this.playTone(440, 0.15, 'triangle', 0.18, 0.14, 460);
    this.playTone(554.37, 0.15, 'sine', 0.14, 0.14, 580);
  }

  public playBump(): void {
    // Gentle cartoon boing rather than scary crash
    this.playTone(260, 0.22, 'sine', 0.22, 0, 110);
    this.playTone(180, 0.18, 'triangle', 0.12, 0.03, 320);
  }

  public playPowerup(): void {
    this.playTone(587.33, 0.12, 'sine', 0.15, 0);
    this.playTone(739.99, 0.12, 'sine', 0.15, 0.07);
    this.playTone(880, 0.22, 'triangle', 0.17, 0.14);
  }

  public playFinish(): void {
    this.playTone(523.25, 0.14, 'triangle', 0.18, 0);
    this.playTone(659.25, 0.14, 'triangle', 0.18, 0.11);
    this.playTone(783.99, 0.14, 'triangle', 0.18, 0.22);
    this.playTone(1046.5, 0.4, 'triangle', 0.22, 0.34);
  }
}

export const soundEngine = new SoundEngine();
