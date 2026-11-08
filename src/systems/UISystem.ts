import {
  createSystem,
  UIKit,
  UIKitMLAsset,
  VisibilityState,
} from '@iwsdk/core';
import { ScoreSystem } from './ScoreSystem.js';
import { StepSystem } from './StepSystem.js';

const ENTER_VR_LABEL = 'Enter VR';
const PAUSE_HINT = 'Turn a hand palm up and hold it to pause.';

const percent = (part: number) => String(Math.round(part * 100));

function bestLine(stars: number): string {
  if (stars <= 0) {
    return PAUSE_HINT;
  }
  return `Your best: ${stars} of 3 ${stars === 1 ? 'star' : 'stars'}.`;
}

/**
 * Renders the recipe card: the step, why it matters, and at the end the score.
 * Outside XR its button can only enter VR.
 */
export class UISystem extends createSystem({}) {
  init(): void {
    const card = this.world.requireSceneObject<UIKitMLAsset>('recipe-card');
    const button = card.requireElementById('card-button');
    const label = card.requireElementById<UIKit.Text>('card-button-label');
    const secondary = card.requireElementById('card-button-secondary');
    const secondaryLabel = card.requireElementById<UIKit.Text>(
      'card-button-secondary-label',
    );
    const title = card.requireElementById<UIKit.Text>('recipe-title');
    const instruction =
      card.requireElementById<UIKit.Text>('recipe-instruction');
    const strip = card.requireElementById('card-strip');
    const tip = card.requireElementById<UIKit.Text>('card-tip');
    const stats = card.requireElementById('card-stats');
    const accuracy = card.requireElementById<UIKit.Text>('stat-accuracy');
    const timing = card.requireElementById<UIKit.Text>('stat-timing');
    const technique = card.requireElementById<UIKit.Text>('stat-technique');
    secondary.name = 'card-button-secondary';
    const steps = this.world.getSystem(StepSystem);
    const score = this.world.getSystem(ScoreSystem);
    if (steps == null || score == null) {
      throw new Error('UISystem needs StepSystem and ScoreSystem first');
    }

    const render = () => {
      const view = steps.view;
      const isFlat =
        this.world.visibilityState.peek() === VisibilityState.NonImmersive;
      const action = isFlat ? ENTER_VR_LABEL : view.action;
      const secondaryAction = isFlat ? null : view.secondaryAction;
      const result = view.state.phase === 'done' ? score.result : null;
      const tipText =
        view.state.phase === 'title' ? bestLine(score.bestStars) : view.tip;

      title.setProperties({
        text: result == null ? view.title : `Score: ${result.total}`,
      });
      instruction.setProperties({ text: result?.note ?? view.instruction });
      label.setProperties({ text: action ?? '' });
      button.setProperties({ display: action == null ? 'none' : 'flex' });
      secondaryLabel.setProperties({ text: secondaryAction ?? '' });
      secondary.setProperties({
        display: secondaryAction == null ? 'none' : 'flex',
      });
      tip.setProperties({ text: tipText });
      tip.setProperties({ display: result == null ? 'flex' : 'none' });
      stats.setProperties({ display: result == null ? 'none' : 'flex' });
      strip.setProperties({
        display: result == null && tipText === '' ? 'none' : 'flex',
      });
      if (result != null) {
        accuracy.setProperties({ text: percent(result.accuracy) });
        timing.setProperties({ text: percent(result.timing) });
        technique.setProperties({ text: percent(result.technique) });
      }
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
    const onSecondaryClick = () => steps.performSecondaryAction();

    button.addEventListener('click', onClick);
    secondary.addEventListener('click', onSecondaryClick);
    this.cleanupFuncs.push(
      () => button.removeEventListener('click', onClick),
      () => secondary.removeEventListener('click', onSecondaryClick),
      steps.subscribe(render),
      this.world.visibilityState.subscribe(render),
    );
    render();
  }
}
