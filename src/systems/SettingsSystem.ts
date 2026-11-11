import { createSystem } from '@iwsdk/core';
import { TUNING } from '../config/tuning.js';
import { browserStorage } from '../util/best-stars.js';
import { loadVolume, saveVolume, stepVolume } from '../util/volume.js';
import { SeatedCalibrationSystem } from './SeatedCalibrationSystem.js';
import { SoundSystem } from './SoundSystem.js';

/** Player settings: the volume, kept between visits, and table recentering. */
export class SettingsSystem extends createSystem({}) {
  private readonly storage = browserStorage();
  private sound: SoundSystem | undefined;
  private calibration: SeatedCalibrationSystem | undefined;
  private currentVolume: number = TUNING.masterVolume;
  private voiceEnabled = false;

  get volume(): number {
    return this.currentVolume;
  }

  get isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  init(): void {
    this.sound = this.world.getSystem(SoundSystem);
    this.calibration = this.world.getSystem(SeatedCalibrationSystem);
    this.currentVolume = loadVolume(this.storage, TUNING.masterVolume);
    this.sound?.setGameVolume(this.currentVolume);
  }

  /** One step louder (+1) or quieter (-1), with a tick to hear the result. */
  changeVolume(direction: 1 | -1): void {
    this.currentVolume = stepVolume(this.currentVolume, direction);
    saveVolume(this.storage, this.currentVolume);
    this.sound?.setGameVolume(this.currentVolume);
    this.sound?.playSound('snap', null);
  }

  /** Fits the table to how the player sits right now. */
  recenter(): void {
    this.calibration?.recalibrate();
    this.sound?.playSound('resume', null);
  }

  /** Toggles optional Web Speech API voice narration for cooking steps. */
  toggleVoice(): void {
    this.voiceEnabled = !this.voiceEnabled;
    this.sound?.playSound('snap', null);
    if (this.voiceEnabled) {
      this.speak('Voice guide enabled.');
    } else if (typeof globalThis.speechSynthesis !== 'undefined') {
      try {
        globalThis.speechSynthesis.cancel();
      } catch {
        // Ignore speech synthesis errors on unsupported runtimes
      }
    }
  }

  /** Speaks a short prompt aloud when the voice guide is enabled. */
  speak(text: string): void {
    if (
      !this.voiceEnabled ||
      typeof globalThis.speechSynthesis === 'undefined' ||
      typeof globalThis.SpeechSynthesisUtterance === 'undefined'
    ) {
      return;
    }
    try {
      globalThis.speechSynthesis.cancel();
      const utterance = new globalThis.SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.pitch = 1.05;
      utterance.volume = Math.max(0.1, Math.min(1, this.currentVolume));
      globalThis.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis errors in headless/unsupported browsers
    }
  }
}
