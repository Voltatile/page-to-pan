import { createSystem, eq, VisibilityState } from '@iwsdk/core';
import {
  BACK_LABEL,
  PALM_PRACTICE_STAGE,
  PRACTICE_STAGES,
  TITLE_PAGES,
  type TitlePage,
  type TitlePageText,
} from '../config/menu.js';
import { initialRecipe, RECIPES } from '../config/recipes/index.js';
import type { Recipe, RecipeStep } from '../config/recipes/recipe.js';
import { TUNING } from '../config/tuning.js';
import { Ingredient } from '../game-components.js';
import {
  completeStep,
  currentStep,
  type GameState,
  isPreparationComplete,
  isPreparationReady,
  startRecipe,
  TITLE_STATE,
} from '../game/steps.js';
import { SnapSystem } from './SnapSystem.js';

/** What the recipe card should show for the current game state. */
export interface StepView {
  state: GameState;
  title: string;
  instruction: string;
  /** Label for the card button, or null when there is nothing to press. */
  action: string | null;
  /** Label for the second card button, or null to hide it. */
  secondaryAction: string | null;
  /** Why the current step matters, shown under the instruction. */
  tip: string;
  /** True when the card shows the title menu row. */
  menu: boolean;
  /** True when the card shows the volume and recenter controls. */
  settings: boolean;
}

const PAUSED_TITLE = 'Paused';
const MENU_LABEL = 'Menu';
const PAUSED_INSTRUCTION = 'Take your time. The pan waits for you.';
const PAUSED_TIP = 'Turn a hand palm up and hold it to pause again.';

/** Runs the recipe as a state machine driven by the recipe data. */
export class StepSystem extends createSystem({
  placed: {
    required: [Ingredient],
    where: [eq(Ingredient, 'placed', true)],
  },
}) {
  private gameState: GameState = TITLE_STATE;
  private recipe: Recipe = initialRecipe();
  private readonly placedIds = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private progress = '';
  private isActionReady = false;
  private isPausedNow = false;
  private titlePage: TitlePage = 'main';
  private pageTurn: 1 | -1 = 1;
  private practiceStageNow = 0;
  private challengeMode = false;
  /** Seconds of play since the step started or last showed progress. */
  private idleS = 0;
  private isHintingNow = false;

  init(): void {
    this.world.getSystem(SnapSystem)?.setRecipe(this.recipe);
    const onPlacedChange = () => this.onPlacedChange();
    this.cleanupFuncs.push(
      this.queries.placed.subscribe('qualify', onPlacedChange),
      this.queries.placed.subscribe('disqualify', onPlacedChange),
    );
  }

  update(delta: number): void {
    if (
      this.gameState.phase !== 'cooking' ||
      this.isPausedNow ||
      this.isHintingNow ||
      this.world.visibilityState.peek() !== VisibilityState.Visible
    ) {
      return;
    }
    this.idleS += delta;
    if (this.idleS >= TUNING.hintAfterS) {
      this.isHintingNow = true;
      this.notify();
    }
  }

  /** True once the player has spent a while on a step without progress. */
  get isHinting(): boolean {
    return this.isHintingNow;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get state(): GameState {
    return this.gameState;
  }

  /** True while the player has stepped away. Gameplay systems freeze. */
  get isGamePaused(): boolean {
    return this.isPausedNow;
  }

  /** True when on the main recipe selection page of the title screen. */
  get isMainTitlePage(): boolean {
    return this.gameState.phase === 'title' && this.titlePage === 'main';
  }

  /** Which subpage of the title card is currently shown. */
  get activeTitlePage(): TitlePage {
    return this.titlePage;
  }

  /** True when the player opted into Chef Exam (memory challenge) mode. */
  get isChallengeMode(): boolean {
    return this.challengeMode;
  }

  toggleChallengeMode(): void {
    this.challengeMode = !this.challengeMode;
    this.notify();
  }

  /** Ends the current cooking session and returns to the main cookbook menu. */
  exitToMenu(): void {
    this.restart();
  }

  get recipeId(): string {
    return this.recipe.id;
  }

  /** The recipe being cooked, or shown on the title card. */
  get activeRecipe(): Recipe {
    return this.recipe;
  }

  /** Where the active recipe sits in the book, and how many there are. */
  get recipePage(): { index: number; count: number } {
    return { index: RECIPES.indexOf(this.recipe), count: RECIPES.length };
  }

  /** The way the recipe book last turned: forward (+1) or back (-1). */
  get lastPageTurn(): 1 | -1 {
    return this.pageTurn;
  }

  /** Turns the recipe book one page forward (+1) or back (-1), wrapping. */
  turnRecipePage(direction: 1 | -1): void {
    this.pageTurn = direction;
    const index = RECIPES.indexOf(this.recipe);
    const next = RECIPES[(index + direction + RECIPES.length) % RECIPES.length];
    if (next != null) {
      this.selectRecipe(next);
    }
  }

  /** Switches the recipe while the title card is up. */
  selectRecipe(recipe: Recipe): void {
    if (this.gameState.phase !== 'title' || recipe === this.recipe) {
      return;
    }
    this.recipe = recipe;
    this.titlePage = 'main';
    const snap = this.world.getSystem(SnapSystem);
    snap?.setRecipe(recipe);
    snap?.reset();
    this.notify();
  }

  /** Only a recipe in progress can pause. */
  pauseGame(): void {
    if (this.gameState.phase === 'cooking' && !this.isPausedNow) {
      this.isPausedNow = true;
      this.notify();
    }
  }

  resumeGame(): void {
    if (this.isPausedNow) {
      this.isPausedNow = false;
      this.notify();
    }
  }

  get step(): RecipeStep | null {
    return currentStep(this.gameState, this.recipe);
  }

  get view(): StepView {
    const { gameState: state, recipe } = this;
    if (state.phase === 'title') {
      if (this.titlePage !== 'main') {
        const page: TitlePageText =
          this.titlePage === 'how-to-play'
            ? (PRACTICE_STAGES[this.practiceStageNow] ?? PRACTICE_STAGES[0])
            : TITLE_PAGES[this.titlePage];
        return {
          state,
          title: page.title,
          instruction: page.instruction,
          action: BACK_LABEL,
          secondaryAction: null,
          tip: page.tip,
          menu: false,
          settings: this.titlePage === 'settings',
        };
      }
      return {
        state,
        title: recipe.title,
        instruction: recipe.intro,
        action: 'Start',
        secondaryAction: null,
        tip: '',
        menu: true,
        settings: false,
      };
    }
    if (state.phase === 'done') {
      return {
        state,
        title: recipe.title,
        instruction: recipe.outro,
        action: 'Again',
        secondaryAction: MENU_LABEL,
        tip: '',
        menu: false,
        settings: false,
      };
    }
    if (this.isPausedNow) {
      return {
        state,
        title: PAUSED_TITLE,
        instruction: PAUSED_INSTRUCTION,
        action: 'Resume',
        secondaryAction: null,
        tip: PAUSED_TIP,
        menu: false,
        settings: false,
      };
    }
    const step = this.step;
    const isPreparing = step?.completion === 'place-ingredients';
    const isReady = isPreparing
      ? isPreparationReady(recipe, this.placedIds)
      : this.isActionReady;
    const title = step?.title ?? '';
    const defaultTip = this.challengeMode
      ? 'Chef Exam: cook from memory without target rings!'
      : (step?.tip ?? '');
    return {
      state,
      title: this.progress === '' ? title : `${title}: ${this.progress}`,
      instruction: step?.instruction ?? '',
      action: isReady ? 'Next' : null,
      secondaryAction: null,
      tip: (this.isHintingNow ? step?.hint : defaultTip) ?? '',
      menu: false,
      settings: false,
    };
  }

  /** The recipe card button: its meaning follows the current state. */
  performAction(): void {
    if (this.view.action == null) {
      return;
    }
    if (this.isPausedNow) {
      this.resumeGame();
    } else if (this.gameState.phase === 'title' && this.titlePage !== 'main') {
      this.openTitlePage('main');
    } else if (this.gameState.phase === 'title') {
      this.gameState = startRecipe(this.recipe);
      this.advanceIfPrepared();
    } else if (this.gameState.phase === 'done') {
      // A fresh cook: clear the table through the title, then start at once.
      this.restart();
      this.performAction();
    } else {
      this.completeStep();
    }
  }

  /** Shows How to Play, Settings, Credits, or the recipe on the title card. */
  openTitlePage(page: TitlePage): void {
    if (this.gameState.phase === 'title' && page !== this.titlePage) {
      this.pageTurn = page === 'main' ? -1 : 1;
      this.titlePage = page;
      this.practiceStageNow = 0;
      this.notify();
    }
  }

  /** True while the How to Play practice waits for the player's hands. */
  get isPracticing(): boolean {
    return (
      this.gameState.phase === 'title' &&
      this.titlePage === 'how-to-play' &&
      this.practiceStageNow < PRACTICE_STAGES.length - 1
    );
  }

  get practiceStage(): number {
    return this.practiceStageNow;
  }

  /** True while the practice asks for a palm held up. */
  get wantsPalmPractice(): boolean {
    return this.isPracticing && this.practiceStageNow === PALM_PRACTICE_STAGE;
  }

  /** The player did what the practice asked, so show the next stage. */
  advancePractice(): void {
    if (this.isPracticing) {
      this.practiceStageNow += 1;
      this.notify();
    }
  }

  /** The second card button. While paused or at the end it opens the menu. */
  performSecondaryAction(): void {
    if (this.isPausedNow || this.gameState.phase === 'done') {
      this.restart();
    }
  }

  /** Back to the title card with every ingredient home again. */
  private restart(): void {
    this.isPausedNow = false;
    this.world.getSystem(SnapSystem)?.reset();
    this.setState(TITLE_STATE);
  }

  /** A gesture or the card button finished the current step. */
  completeStep(): void {
    this.setState(completeStep(this.gameState, this.recipe, this.placedIds));
  }

  /** Short status shown after the step title, such as a turn count. */
  setProgress(progress: string): void {
    if (progress !== this.progress) {
      this.progress = progress;
      this.clearIdle();
      this.notify();
    }
  }

  /** Lets the player end the current step with the card button. */
  setActionReady(isReady: boolean): void {
    if (isReady !== this.isActionReady) {
      this.isActionReady = isReady;
      this.notify();
    }
  }

  private onPlacedChange(): void {
    this.placedIds.clear();
    for (const entity of this.queries.placed.entities) {
      this.placedIds.add(entity.getValue(Ingredient, 'ingredientId') ?? '');
    }
    this.advanceIfPrepared();
  }

  /** Moves past preparation once every ingredient, optional too, is placed. */
  private advanceIfPrepared(): void {
    if (
      this.step?.completion === 'place-ingredients' &&
      isPreparationComplete(this.recipe, this.placedIds)
    ) {
      this.gameState = completeStep(this.gameState, this.recipe);
    }
    this.notify();
  }

  private setState(state: GameState): void {
    this.gameState = state;
    this.titlePage = 'main';
    if (state.phase !== 'cooking') {
      this.isPausedNow = false;
    }
    this.progress = '';
    this.isActionReady = false;
    this.clearIdle();
    this.notify();
  }

  /** Progress shows the player is on track, so the hint can wait again. */
  private clearIdle(): void {
    this.idleS = 0;
    this.isHintingNow = false;
  }

  private notify(): void {
    // One broken listener must not leave the card or the table out of date.
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.error('Step listener failed', error);
      }
    }
  }
}
