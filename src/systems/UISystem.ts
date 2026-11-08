import {
  createSystem,
  UIKit,
  UIKitMLAsset,
  type Object3D,
  Visibility,
  VisibilityState,
} from '@iwsdk/core';
import { ScoreSystem } from './ScoreSystem.js';
import { SettingsSystem } from './SettingsSystem.js';
import { StepSystem } from './StepSystem.js';

const ENTER_VR_LABEL = 'Enter VR';
/** Title size, smaller when two buttons share the header with it. */
const TITLE_FONT_SIZE = 46;
const CROWDED_TITLE_FONT_SIZE = 40;

/** A short swell of the card that draws the eye to new text. */
const NUDGE_S = 0.4;
const NUDGE_GROWTH = 0.05;

const percent = (part: number) => String(Math.round(part * 100));

/** The intro, plus the best result once there is one. */
function titleLine(intro: string, stars: number): string {
  if (stars <= 0) {
    return intro;
  }
  return `${intro} Your best: ${stars} of 3 ${stars === 1 ? 'star' : 'stars'}.`;
}

/**
 * Renders the recipe card: the step, why it matters, and at the end the score.
 * Outside XR its button can only enter VR.
 */
export class UISystem extends createSystem({}) {
  private cardObject: Object3D | undefined;
  private cardScale = 1;
  private nudgeS = -1;
  private nudgeKey = '';

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
    const menu = card.requireElementById('card-menu');
    const howToPlay = card.requireElementById('menu-how-to-play');
    const credits = card.requireElementById('menu-credits');
    const settingsButton = card.requireElementById('menu-settings');
    const settingsRow = card.requireElementById('card-settings');
    const volumeText = card.requireElementById<UIKit.Text>('settings-volume');
    const volumeDown = card.requireElementById('settings-volume-down');
    const volumeUp = card.requireElementById('settings-volume-up');
    const recenter = card.requireElementById('settings-recenter');
    const settings = this.world.getSystem(SettingsSystem);
    const logo = this.world.requireSceneEntity('title-logo');
    secondary.name = 'card-button-secondary';
    howToPlay.name = 'menu-how-to-play';
    credits.name = 'menu-credits';
    settingsButton.name = 'menu-settings';
    volumeDown.name = 'settings-volume-down';
    volumeUp.name = 'settings-volume-up';
    recenter.name = 'settings-recenter';
    this.cardObject = this.world.requireSceneEntity('recipe-card').object3D;
    this.cardScale = this.cardObject?.scale.x ?? 1;
    const steps = this.world.getSystem(StepSystem);
    const score = this.world.getSystem(ScoreSystem);
    if (steps == null || score == null) {
      throw new Error('UISystem needs StepSystem and ScoreSystem first');
    }

    const render = () => {
      const view = steps.view;
      const state = view.state;
      const key = [
        state.phase === 'cooking' ? state.stepIndex : state.phase,
        steps.isGamePaused,
        steps.isHinting,
        state.phase === 'title' ? view.title : '',
      ].join(':');
      if (key !== this.nudgeKey) {
        this.nudgeKey = key;
        this.nudgeS = 0;
      }
      const isFlat =
        this.world.visibilityState.peek() === VisibilityState.NonImmersive;
      const action = isFlat ? ENTER_VR_LABEL : view.action;
      const secondaryAction = isFlat ? null : view.secondaryAction;
      const result = view.state.phase === 'done' ? score.result : null;
      const tipText = view.tip;
      const showMenu = view.menu && !isFlat;
      const showSettings = view.settings && !isFlat;
      const instructionText = view.menu
        ? titleLine(view.instruction, score.bestStars)
        : view.instruction;

      logo.setValue(Visibility, 'isVisible', state.phase === 'title');
      title.setProperties({
        text: result == null ? view.title : `Score: ${result.total}`,
        fontSize:
          secondaryAction == null ? TITLE_FONT_SIZE : CROWDED_TITLE_FONT_SIZE,
      });
      instruction.setProperties({ text: result?.note ?? instructionText });
      label.setProperties({ text: action ?? '' });
      button.setProperties({ display: action == null ? 'none' : 'flex' });
      secondaryLabel.setProperties({ text: secondaryAction ?? '' });
      secondary.setProperties({
        display: secondaryAction == null ? 'none' : 'flex',
      });
      tip.setProperties({ text: tipText });
      tip.setProperties({
        display: result == null && tipText !== '' ? 'flex' : 'none',
      });
      menu.setProperties({ display: showMenu ? 'flex' : 'none' });
      settingsRow.setProperties({ display: showSettings ? 'flex' : 'none' });
      volumeText.setProperties({
        text: `Volume ${Math.round((settings?.volume ?? 0) * 100)}%`,
      });
      stats.setProperties({ display: result == null ? 'none' : 'flex' });
      strip.setProperties({
        display:
          result == null && tipText === '' && !showMenu && !showSettings
            ? 'none'
            : 'flex',
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
    const onHowToPlay = () => steps.openTitlePage('how-to-play');
    const onCredits = () => steps.openTitlePage('credits');
    const onSettings = () => steps.openTitlePage('settings');
    const onVolumeDown = () => {
      settings?.changeVolume(-1);
      render();
    };
    const onVolumeUp = () => {
      settings?.changeVolume(1);
      render();
    };
    const onRecenter = () => settings?.recenter();

    button.addEventListener('click', onClick);
    secondary.addEventListener('click', onSecondaryClick);
    howToPlay.addEventListener('click', onHowToPlay);
    credits.addEventListener('click', onCredits);
    settingsButton.addEventListener('click', onSettings);
    volumeDown.addEventListener('click', onVolumeDown);
    volumeUp.addEventListener('click', onVolumeUp);
    recenter.addEventListener('click', onRecenter);
    this.cleanupFuncs.push(
      () => button.removeEventListener('click', onClick),
      () => secondary.removeEventListener('click', onSecondaryClick),
      () => howToPlay.removeEventListener('click', onHowToPlay),
      () => credits.removeEventListener('click', onCredits),
      () => settingsButton.removeEventListener('click', onSettings),
      () => volumeDown.removeEventListener('click', onVolumeDown),
      () => volumeUp.removeEventListener('click', onVolumeUp),
      () => recenter.removeEventListener('click', onRecenter),
      steps.subscribe(render),
      this.world.visibilityState.subscribe(render),
    );
    render();
  }

  update(delta: number): void {
    if (this.nudgeS < 0 || this.cardObject == null) {
      return;
    }
    this.nudgeS = Math.min(this.nudgeS + delta, NUDGE_S);
    const swell = Math.sin((Math.PI * this.nudgeS) / NUDGE_S);
    this.cardObject.scale.setScalar(this.cardScale * (1 + NUDGE_GROWTH * swell));
    if (this.nudgeS >= NUDGE_S) {
      this.nudgeS = -1;
    }
  }
}
