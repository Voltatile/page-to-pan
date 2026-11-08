import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { setupLanding } from './landing.js';
import { CookingSystem } from './systems/CookingSystem.js';
import {
  DebugOverlaySystem,
  isDebugEnabled,
} from './systems/DebugOverlaySystem.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { EggShellSystem } from './systems/EggShellSystem.js';
import { GestureSystem } from './systems/GestureSystem.js';
import { GuideSystem } from './systems/GuideSystem.js';
import { KitchenSystem } from './systems/KitchenSystem.js';
import { PauseSystem } from './systems/PauseSystem.js';
import { PraiseSystem } from './systems/PraiseSystem.js';
import { PracticeSystem } from './systems/PracticeSystem.js';
import { ReachHighlightSystem } from './systems/ReachHighlightSystem.js';
import { ResultStarsSystem } from './systems/ResultStarsSystem.js';
import { ScoreSystem } from './systems/ScoreSystem.js';
import { SeatedCalibrationSystem } from './systems/SeatedCalibrationSystem.js';
import { SettingsSystem } from './systems/SettingsSystem.js';
import { SnapSystem } from './systems/SnapSystem.js';
import { SoundSystem } from './systems/SoundSystem.js';
import { StepSystem } from './systems/StepSystem.js';
import { TitlePreviewSystem } from './systems/TitlePreviewSystem.js';
import { UISystem } from './systems/UISystem.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  setupLanding(world);
  world.registerSystem(SeatedCalibrationSystem);
  world.registerSystem(SnapSystem);
  world.registerSystem(StepSystem);
  world.registerSystem(KitchenSystem);
  world.registerSystem(CookingSystem);
  world.registerSystem(ScoreSystem);
  world.registerSystem(SoundSystem);
  world.registerSystem(EffectsSystem);
  world.registerSystem(GuideSystem);
  world.registerSystem(EggShellSystem);
  world.registerSystem(GestureSystem);
  world.registerSystem(PauseSystem);
  world.registerSystem(SettingsSystem);
  world.registerSystem(PracticeSystem);
  world.registerSystem(UISystem);
  world.registerSystem(ResultStarsSystem);
  world.registerSystem(PraiseSystem);
  world.registerSystem(TitlePreviewSystem);
  world.registerSystem(ReachHighlightSystem);
  if (isDebugEnabled()) {
    world.registerSystem(DebugOverlaySystem);
  }
});
