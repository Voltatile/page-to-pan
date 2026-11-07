import {
  createSystem,
  UIKit,
  UIKitMLAsset,
  VisibilityState,
} from '@iwsdk/core';
import { StepSystem } from './StepSystem.js';

const ENTER_VR_LABEL = 'Enter VR';

/** Renders the recipe card. Outside XR its button can only enter VR. */
export class UISystem extends createSystem({}) {
  init(): void {
    const card = this.world.requireSceneObject<UIKitMLAsset>('recipe-card');
    const button = card.requireElementById('card-button');
    const label = card.requireElementById<UIKit.Text>('card-button-label');
    const title = card.requireElementById<UIKit.Text>('recipe-title');
    const instruction =
      card.requireElementById<UIKit.Text>('recipe-instruction');
    const steps = this.world.getSystem(StepSystem);
    if (steps == null) {
      throw new Error('UISystem needs StepSystem registered first');
    }

    const render = () => {
      const view = steps.view;
      const isFlat =
        this.world.visibilityState.peek() === VisibilityState.NonImmersive;
      const action = isFlat ? ENTER_VR_LABEL : view.action;
      title.setProperties({ text: view.title });
      instruction.setProperties({ text: view.instruction });
      label.setProperties({ text: action ?? '' });
      button.setProperties({ display: action == null ? 'none' : 'flex' });
    };

    const onClick = () => {
      if (
        this.world.visibilityState.peek() === VisibilityState.NonImmersive
      ) {
        this.world.launchXR();
      } else {
        steps.performAction();
      }
    };

    button.addEventListener('click', onClick);
    this.cleanupFuncs.push(
      () => button.removeEventListener('click', onClick),
      steps.subscribe(render),
      this.world.visibilityState.subscribe(render),
    );
    render();
  }
}
