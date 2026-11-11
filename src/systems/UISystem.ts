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
  private isPauseSettingsOpen = false;

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
    const modeToggle = card.requireElementById('menu-mode-toggle');
    const modeLabel = card.requireElementById<UIKit.Text>('menu-mode-label');
    const credits = card.requireElementById('menu-credits');
    const settingsButton = card.requireElementById('menu-settings');
    const settingsRow = card.requireElementById('card-settings');
    const volumeText = card.requireElementById<UIKit.Text>('settings-volume');
    const volumeDown = card.requireElementById('settings-volume-down');
    const volumeUp = card.requireElementById('settings-volume-up');
    const recenter = card.requireElementById('settings-recenter');
    const voiceToggle = card.requireElementById('settings-voice-toggle');
    const voiceLabel = card.requireElementById<UIKit.Text>(
      'settings-voice-label',
    );
    const settings = this.world.getSystem(SettingsSystem);
    const bookNav = this.world.requireSceneEntity('book-nav');
    const bookPanel = this.world.requireSceneObject<UIKitMLAsset>('book-nav');
    const bookPrev = bookPanel.requireElementById('book-prev');
    const bookNext = bookPanel.requireElementById('book-next');
    const bookPage = bookPanel.requireElementById<UIKit.Text>('book-page');
    const pauseModalEntity = this.world.requireSceneEntity('pause-modal');
    const pauseModal =
      this.world.requireSceneObject<UIKitMLAsset>('pause-modal');
    const pauseCard = pauseModal.requireElementById('pause-card');
    const pauseTitle = pauseModal.requireElementById<UIKit.Text>('pause-title');
    const pauseSubtitle =
      pauseModal.requireElementById<UIKit.Text>('pause-subtitle');
    const pauseMainActions = pauseModal.requireElementById(
      'pause-main-actions',
    );
    const pauseSettingsActions = pauseModal.requireElementById(
      'pause-settings-actions',
    );
    const pauseResume = pauseModal.requireElementById('pause-resume');
    const pauseSettings = pauseModal.requireElementById('pause-settings');
    const pauseExit = pauseModal.requireElementById('pause-exit');
    const pauseVolDown = pauseModal.requireElementById('pause-vol-down');
    const pauseVolText =
      pauseModal.requireElementById<UIKit.Text>('pause-vol-text');
    const pauseVolUp = pauseModal.requireElementById('pause-vol-up');
    const pauseRecenter = pauseModal.requireElementById('pause-recenter');
    const pauseVoiceToggle = pauseModal.requireElementById(
      'pause-voice-toggle',
    );
    const pauseVoiceLabel =
      pauseModal.requireElementById<UIKit.Text>('pause-voice-label');
    const pauseSettingsBack = pauseModal.requireElementById(
      'pause-settings-back',
    );

    bookPrev.name = 'book-prev';
    bookNext.name = 'book-next';
    const logo = this.world.requireSceneEntity('title-logo');
    secondary.name = 'card-button-secondary';
    howToPlay.name = 'menu-how-to-play';
    modeToggle.name = 'menu-mode-toggle';
    credits.name = 'menu-credits';
    settingsButton.name = 'menu-settings';
    volumeDown.name = 'settings-volume-down';
    volumeUp.name = 'settings-volume-up';
    recenter.name = 'settings-recenter';
    voiceToggle.name = 'settings-voice-toggle';
    pauseResume.name = 'pause-resume';
    pauseSettings.name = 'pause-settings';
    pauseExit.name = 'pause-exit';
    pauseVolDown.name = 'pause-vol-down';
    pauseVolUp.name = 'pause-vol-up';
    pauseRecenter.name = 'pause-recenter';
    pauseVoiceToggle.name = 'pause-voice-toggle';
    pauseSettingsBack.name = 'pause-settings-back';
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
      const isPaused = steps.isGamePaused;
      if (!isPaused) {
        this.isPauseSettingsOpen = false;
      }
      const key = [
        state.phase === 'cooking' ? state.stepIndex : state.phase,
        isPaused,
        steps.isHinting,
        state.phase === 'title' ? view.title : '',
      ].join(':');
      const keyChanged = key !== this.nudgeKey;
      if (keyChanged) {
        this.nudgeKey = key;
        this.nudgeS = 0;
        if (!isPaused && state.phase === 'cooking') {
          settings?.speak(`${view.title}. ${view.instruction}`);
        }
      }
      const isFlat =
        this.world.visibilityState.peek() === VisibilityState.NonImmersive;
      const showPauseModal = isPaused && !isFlat;
      pauseModalEntity.setValue(Visibility, 'isVisible', showPauseModal);
      pauseCard.setProperties({ display: showPauseModal ? 'flex' : 'none' });
      if (showPauseModal) {
        pauseTitle.setProperties({
          text: this.isPauseSettingsOpen ? 'Pause Settings' : 'Game Paused',
        });
        pauseSubtitle.setProperties({
          text: this.isPauseSettingsOpen
            ? 'Adjust volume, recenter table, or toggle voice guide.'
            : 'Take a breath. Resume cooking, adjust settings, or exit to the cookbook.',
        });
        pauseMainActions.setProperties({
          display: this.isPauseSettingsOpen ? 'none' : 'flex',
        });
        pauseSettingsActions.setProperties({
          display: this.isPauseSettingsOpen ? 'flex' : 'none',
        });
        pauseVolText.setProperties({
          text: `Vol ${Math.round((settings?.volume ?? 0) * 100)}%`,
        });
        pauseVoiceLabel.setProperties({
          text: `Voice: ${settings?.isVoiceEnabled ? 'On' : 'Off'}`,
        });
      }

      const action = isFlat
        ? ENTER_VR_LABEL
        : showPauseModal
          ? null
          : view.action;
      const secondaryAction =
        isFlat || showPauseModal ? null : view.secondaryAction;
      const result = view.state.phase === 'done' ? score.result : null;
      const tipText = view.tip;
      const showMenu = view.menu && !isFlat;
      const showSettings = view.settings && !isFlat;
      const instructionText = view.menu
        ? titleLine(view.instruction, score.bestStars)
        : view.instruction;

      logo.setValue(Visibility, 'isVisible', state.phase === 'title');
      const { index, count } = steps.recipePage;
      bookNav.setValue(Visibility, 'isVisible', showMenu && count > 1);
      bookPage.setProperties({ text: `Recipe ${index + 1} of ${count}` });
      modeLabel.setProperties({
        text: steps.isChallengeMode ? 'Mode: Chef Exam' : 'Mode: Guided',
      });
      voiceLabel.setProperties({
        text: `Voice: ${settings?.isVoiceEnabled ? 'On' : 'Off'}`,
      });
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
    const onModeToggle = () => steps.toggleChallengeMode();
    const onCredits = () => steps.openTitlePage('credits');
    const onSettings = () => steps.openTitlePage('settings');
    const onBookPrev = () => steps.turnRecipePage(-1);
    const onBookNext = () => steps.turnRecipePage(1);
    const onVolumeDown = () => {
      settings?.changeVolume(-1);
      render();
    };
    const onVolumeUp = () => {
      settings?.changeVolume(1);
      render();
    };
    const onRecenter = () => settings?.recenter();
    const onVoiceToggle = () => {
      settings?.toggleVoice();
      render();
    };
    const onPauseResume = () => steps.resumeGame();
    const onPauseSettings = () => {
      this.isPauseSettingsOpen = true;
      render();
    };
    const onPauseSettingsBack = () => {
      this.isPauseSettingsOpen = false;
      render();
    };
    const onPauseExit = () => {
      this.isPauseSettingsOpen = false;
      steps.exitToMenu();
    };

    button.addEventListener('click', onClick);
    secondary.addEventListener('click', onSecondaryClick);
    howToPlay.addEventListener('click', onHowToPlay);
    modeToggle.addEventListener('click', onModeToggle);
    credits.addEventListener('click', onCredits);
    settingsButton.addEventListener('click', onSettings);
    bookPrev.addEventListener('click', onBookPrev);
    bookNext.addEventListener('click', onBookNext);
    volumeDown.addEventListener('click', onVolumeDown);
    volumeUp.addEventListener('click', onVolumeUp);
    recenter.addEventListener('click', onRecenter);
    voiceToggle.addEventListener('click', onVoiceToggle);
    pauseResume.addEventListener('click', onPauseResume);
    pauseSettings.addEventListener('click', onPauseSettings);
    pauseExit.addEventListener('click', onPauseExit);
    pauseVolDown.addEventListener('click', onVolumeDown);
    pauseVolUp.addEventListener('click', onVolumeUp);
    pauseRecenter.addEventListener('click', onRecenter);
    pauseVoiceToggle.addEventListener('click', onVoiceToggle);
    pauseSettingsBack.addEventListener('click', onPauseSettingsBack);
    this.cleanupFuncs.push(
      () => button.removeEventListener('click', onClick),
      () => secondary.removeEventListener('click', onSecondaryClick),
      () => howToPlay.removeEventListener('click', onHowToPlay),
      () => modeToggle.removeEventListener('click', onModeToggle),
      () => credits.removeEventListener('click', onCredits),
      () => settingsButton.removeEventListener('click', onSettings),
      () => bookPrev.removeEventListener('click', onBookPrev),
      () => bookNext.removeEventListener('click', onBookNext),
      () => volumeDown.removeEventListener('click', onVolumeDown),
      () => volumeUp.removeEventListener('click', onVolumeUp),
      () => recenter.removeEventListener('click', onRecenter),
      () => voiceToggle.removeEventListener('click', onVoiceToggle),
      () => pauseResume.removeEventListener('click', onPauseResume),
      () => pauseSettings.removeEventListener('click', onPauseSettings),
      () => pauseExit.removeEventListener('click', onPauseExit),
      () => pauseVolDown.removeEventListener('click', onVolumeDown),
      () => pauseVolUp.removeEventListener('click', onVolumeUp),
      () => pauseRecenter.removeEventListener('click', onRecenter),
      () => pauseVoiceToggle.removeEventListener('click', onVoiceToggle),
      () => pauseSettingsBack.removeEventListener('click', onPauseSettingsBack),
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
