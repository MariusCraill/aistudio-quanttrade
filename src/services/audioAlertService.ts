/**
 * Audio Alert Synthesizer for TradeQuant
 * Generates clean, crisp, synthesized real-time audio alerts using the Web Audio API.
 * Zero external audio files or network requests required.
 */

const AUDIO_MUTE_STORAGE_KEY = 'tradequant_audio_alerts_enabled';

// Listeners for audio state change
type AudioStateListener = (enabled: boolean) => void;
const listeners: Set<AudioStateListener> = new Set();

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    console.warn('Web Audio API not supported or blocked:', e);
    return null;
  }
}

/**
 * Checks if sound alerts are currently enabled (default: true)
 */
export function isSoundAlertsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = localStorage.getItem(AUDIO_MUTE_STORAGE_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
    return true; // default ON
  } catch {
    return true;
  }
}

/**
 * Sets the sound alert enabled state and notifies listeners
 */
export function setSoundAlertsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUDIO_MUTE_STORAGE_KEY, enabled.toString());
    // Also resume audio context if turned on
    if (enabled) {
      getAudioContext();
    }
  } catch (e) {
    console.warn('Failed to save audio preference:', e);
  }
  listeners.forEach(fn => fn(enabled));
}

/**
 * Toggles sound alerts ON / OFF
 */
export function toggleSoundAlerts(): boolean {
  const current = isSoundAlertsEnabled();
  const next = !current;
  setSoundAlertsEnabled(next);
  if (next) {
    // Play a brief affirmative confirmation click
    playAffirmativeChime();
  }
  return next;
}

/**
 * Subscribes to sound state changes
 */
export function subscribeToSoundAlerts(listener: AudioStateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Plays the BUY NOW Alert Sound:
 * An energetic, bright, ascending arpeggio chord (C5 -> E5 -> G5 -> C6) with resonant shimmer.
 */
export function playBuyAlertSound(): void {
  if (!isSoundAlertsEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 4 rising harmonic notes
    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.20 }, // C5
      { freq: 659.25, time: 0.08, dur: 0.22 }, // E5
      { freq: 783.99, time: 0.16, dur: 0.26 }, // G5
      { freq: 1046.50, time: 0.24, dur: 0.45 }, // C6 (climax tone)
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const oscHarmonic = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      oscHarmonic.type = 'triangle';

      osc.frequency.setValueAtTime(freq, now + time);
      oscHarmonic.frequency.setValueAtTime(freq * 2, now + time);

      const noteStart = now + time;
      gain.gain.setValueAtTime(0.001, noteStart);
      gain.gain.linearRampToValueAtTime(0.18, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + dur);

      osc.connect(gain);
      oscHarmonic.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteStart);
      oscHarmonic.start(noteStart);
      osc.stop(noteStart + dur + 0.05);
      oscHarmonic.stop(noteStart + dur + 0.05);
    });
  } catch (err) {
    console.warn('Error playing Buy Alert sound:', err);
  }
}

/**
 * Plays the SELL NOW Alert Sound:
 * An authoritative, sharp descending alarm sequence (A5 -> F5 -> D5 -> B4) with warning modulation.
 */
export function playSellAlertSound(): void {
  if (!isSoundAlertsEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 4 descending alert notes with rapid staccato
    const notes = [
      { freq: 880.00, time: 0.00, dur: 0.16 }, // A5
      { freq: 698.46, time: 0.09, dur: 0.16 }, // F5
      { freq: 587.33, time: 0.18, dur: 0.18 }, // D5
      { freq: 493.88, time: 0.27, dur: 0.40 }, // B4 (caution resolution)
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      // Low-pass filter to make sawtooth warm rather than harsh
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now + time);

      osc.frequency.setValueAtTime(freq, now + time);

      const noteStart = now + time;
      gain.gain.setValueAtTime(0.001, noteStart);
      gain.gain.linearRampToValueAtTime(0.16, noteStart + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + dur + 0.05);
    });
  } catch (err) {
    console.warn('Error playing Sell Alert sound:', err);
  }
}

/**
 * Plays a quick subtle confirmation chime (for toggles or neutral actions)
 */
export function playAffirmativeChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, now);
    osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.08);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch (e) {
    console.warn('Error playing affirmative chime:', e);
  }
}
