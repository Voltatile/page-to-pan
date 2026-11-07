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
}

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
      };
    }
    if (state.phase === 'done') {
      return {
        state,
        title: recipe.title,
        instruction: recipe.outro,
        action: 'Again',
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
    };
  }

  /** The recipe card button: its meaning follows the current state. */
  performAction(): void {
    if (this.view.action == null) {
      return;
    }
    if (this.gameState.phase === 'title') {
      this.gameState = startRecipe(this.recipe);
      this.advanceIfPrepared();
    } else if (this.gameState.phase === 'done') {
      this.world.getSystem(SnapSystem)?.reset();
      this.setState(TITLE_STATE);
    } else {
      this.completeStep();
    }
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
