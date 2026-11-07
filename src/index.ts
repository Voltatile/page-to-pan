import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { CookingSystem } from './systems/CookingSystem.js';
import { GestureSystem } from './systems/GestureSystem.js';
import { KitchenSystem } from './systems/KitchenSystem.js';
import { ReachHighlightSystem } from './systems/ReachHighlightSystem.js';
import { SeatedCalibrationSystem } from './systems/SeatedCalibrationSystem.js';
import { SnapSystem } from './systems/SnapSystem.js';
import { StepSystem } from './systems/StepSystem.js';
import { UISystem } from './systems/UISystem.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(SeatedCalibrationSystem);
  world.registerSystem(SnapSystem);
  world.registerSystem(StepSystem);
  world.registerSystem(KitchenSystem);
  world.registerSystem(CookingSystem);
  world.registerSystem(GestureSystem);
  world.registerSystem(UISystem);
  world.registerSystem(ReachHighlightSystem);
});
