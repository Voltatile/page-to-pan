import { createSystem } from '@iwsdk/core';
import { RECIPES } from '../config/recipes/index.js';
import { TUNING } from '../config/tuning.js';
import { rankUpTitle } from '../game/chef-rank.js';
import { type CookRecord, type CookScore, scoreCook } from '../game/score.js';
import {
  browserStorage,
  loadBestStars,
  saveBestStars,
  totalBestStars,
} from '../util/best-stars.js';

const RECIPE_IDS = RECIPES.map((recipe) => recipe.id);
import { CookingSystem } from './CookingSystem.js';
import { StepSystem } from './StepSystem.js';

/**
 * Collects what the player did, then scores the cook when the recipe ends.
 * The gesture system reports each moment; the score itself is a pure function.
 */
export class ScoreSystem extends createSystem({}) {
  private readonly record: CookRecord = {
    saltDashes: 0,
    servedProgress: 0,
    flipProgress: 0,
    crackOffset: 0,
    whiskTurns: 0,
  };
  private readonly storage = browserStorage();
  private steps!: StepSystem;
  private cooking!: CookingSystem;
  private lastScore: CookScore | null = null;
  private best = 0;
  private beatBest = false;
  private total = 0;
  private rankUp: string | null = null;

  /** The score of the cook that just ended, or null before the end. */
  get result(): CookScore | null {
    return this.lastScore;
  }

  /** What the player has done so far in this cook. */
  get cookRecord(): Readonly<CookRecord> {
    return this.record;
  }

  /** True when the cook that just ended earned more stars than ever before. */
  get isNewBest(): boolean {
    return this.beatBest;
  }

  /** Best stars over every recipe added up: what the chef rank counts. */
  get totalStars(): number {
    return this.total;
  }

  /** The rank the cook that just ended reached, or null without a rank up. */
  get rankUpTo(): string | null {
    return this.rankUp;
  }

  /** Best stars ever earned on this recipe, 0 before the first cook. */
  get bestStars(): number {
    return this.best;
  }

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    const cooking = this.world.getSystem(CookingSystem);
    if (steps == null || cooking == null) {
      throw new Error('ScoreSystem needs StepSystem and CookingSystem first');
    }
    this.steps = steps;
    this.cooking = cooking;
    this.best = loadBestStars(this.storage, steps.recipeId);
    this.total = totalBestStars(this.storage, RECIPE_IDS);
    this.cleanupFuncs.push(steps.subscribe(() => this.onStepChange()));
  }

  noteCrack(offset: number): void {
    this.record.crackOffset = offset;
  }

  noteWhisk(turns: number): void {
    this.record.whiskTurns = turns;
  }

  noteSalt(dashes: number): void {
    this.record.saltDashes = dashes;
  }

  noteFlip(progress: number): void {
    this.record.flipProgress = progress;
  }

  private onStepChange(): void {
    const phase = this.steps.state.phase;
    if (phase === 'title') {
      this.best = loadBestStars(this.storage, this.steps.recipeId);
      this.lastScore = null;
      this.beatBest = false;
      this.rankUp = null;
      this.total = totalBestStars(this.storage, RECIPE_IDS);
      this.record.saltDashes = 0;
      this.record.servedProgress = 0;
      this.record.flipProgress = 0;
      this.record.crackOffset = 0;
      this.record.whiskTurns = 0;
    } else if (phase === 'done' && this.lastScore == null) {
      this.record.servedProgress = this.cooking.cookProgress;
      this.lastScore = scoreCook(
        this.record,
        TUNING.whiskTargetTurns,
        this.steps.activeRecipe.chefNotes,
      );
      this.beatBest = this.lastScore.stars > this.best;
      this.best = saveBestStars(
        this.storage,
        this.steps.recipeId,
        this.lastScore.stars,
      );
      const before = this.total;
      this.total = totalBestStars(this.storage, RECIPE_IDS);
      this.rankUp = rankUpTitle(before, this.total);
    }
  }
}
