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

  get volume(): number {
    return this.currentVolume;
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
}
