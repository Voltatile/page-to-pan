import { createSystem, eq } from '@iwsdk/core';
import { OMELETTE } from '../config/recipes/omelette.js';
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
  private state: GameState = TITLE_STATE;
  private readonly recipe = OMELETTE;
  private readonly placedIds = new Set<string>();
  private readonly listeners = new Set<() => void>();

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

  get view(): StepView {
    const { state, recipe } = this;
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
    const step = currentStep(state, recipe);
    const isPreparing = step?.completion === 'place-ingredients';
    return {
      state,
      title: step?.title ?? '',
      instruction: step?.instruction ?? '',
      action:
        isPreparing && !isPreparationReady(recipe, this.placedIds)
          ? null
          : 'Next',
    };
  }

  /** The recipe card button: its meaning follows the current state. */
  performAction(): void {
    if (this.view.action == null) {
      return;
    }
    if (this.state.phase === 'title') {
      this.state = startRecipe(this.recipe);
      this.advanceIfPrepared();
    } else if (this.state.phase === 'done') {
      this.world.getSystem(SnapSystem)?.reset();
      this.setState(TITLE_STATE);
    } else {
      this.setState(completeStep(this.state, this.recipe));
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
    const step = currentStep(this.state, this.recipe);
    if (
      step?.completion === 'place-ingredients' &&
      isPreparationComplete(this.recipe, this.placedIds)
    ) {
      this.state = completeStep(this.state, this.recipe);
    }
    this.notify();
  }

  private setState(state: GameState): void {
    this.state = state;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
