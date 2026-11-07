import { createSystem, UIKitMLAsset, VisibilityState } from '@iwsdk/core';

/** Wires the recipe card. The Enter VR button only exists outside XR. */
export class UISystem extends createSystem({}) {
  init(): void {
    const card = this.world.requireSceneObject<UIKitMLAsset>('recipe-card');
    const enterButton = card.requireElementById('enter-vr-button');
    if (!this.world.xrEnabled) {
      enterButton.setProperties({ display: 'none' });
      return;
    }

    const enterXR = () => this.world.launchXR();
    enterButton.addEventListener('click', enterXR);
    this.cleanupFuncs.push(
      () => enterButton.removeEventListener('click', enterXR),
      this.world.visibilityState.subscribe((visibilityState) => {
        const is2D = visibilityState === VisibilityState.NonImmersive;
        enterButton.setProperties({ display: is2D ? 'flex' : 'none' });
      }),
    );
  }
}
