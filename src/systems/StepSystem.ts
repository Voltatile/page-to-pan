import { createSystem, eq } from '@iwsdk/core';
import { OMELETTE } from '../config/recipes/omelette.js';
import type { RecipeStep } from '../config/recipes/recipe.js';
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
}

const PAUSED_TITLE = 'Paused';
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
  private readonly recipe = OMELETTE;
  private readonly placedIds = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private progress = '';
  private isActionReady = false;
  private isPausedNow = false;

  init(): void {
    const onPlacedChange = () => this.onPlacedChange();
    this.cleanupFuncs.push(
      this.queries.placed.subscribe('qualify', onPlacedChange),
      this.queries.placed.subscribe('disqualify', onPlacedChange),
    );
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

  get recipeId(): string {
    return this.recipe.id;
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
      return {
        state,
        title: recipe.title,
        instruction: recipe.intro,
        action: 'Start',
        secondaryAction: null,
        tip: '',
      };
    }
    if (state.phase === 'done') {
      return {
        state,
        title: recipe.title,
        instruction: recipe.outro,
        action: 'Again',
        secondaryAction: null,
        tip: '',
      };
    }
    if (this.isPausedNow) {
      return {
        state,
        title: PAUSED_TITLE,
        instruction: PAUSED_INSTRUCTION,
        action: 'Resume',
        secondaryAction: 'Restart',
        tip: PAUSED_TIP,
      };
    }
    const step = this.step;
    const isPreparing = step?.completion === 'place-ingredients';
    const isReady = isPreparing
      ? isPreparationReady(recipe, this.placedIds)
      : this.isActionReady;
    const title = step?.title ?? '';
    return {
      state,
      title: this.progress === '' ? title : `${title}: ${this.progress}`,
      instruction: step?.instruction ?? '',
      action: isReady ? 'Next' : null,
      secondaryAction: null,
      tip: step?.tip ?? '',
    };
  }

  /** The recipe card button: its meaning follows the current state. */
  performAction(): void {
    if (this.view.action == null) {
      return;
    }
    if (this.isPausedNow) {
      this.resumeGame();
    } else if (this.gameState.phase === 'title') {
      this.gameState = startRecipe(this.recipe);
      this.advanceIfPrepared();
    } else if (this.gameState.phase === 'done') {
      this.restart();
    } else {
      this.completeStep();
    }
  }

  /** The second card button. While paused it starts the recipe over. */
  performSecondaryAction(): void {
    if (this.isPausedNow) {
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
    if (state.phase !== 'cooking') {
      this.isPausedNow = false;
    }
    this.progress = '';
    this.isActionReady = false;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
