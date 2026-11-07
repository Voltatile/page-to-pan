/** Outline family used to draw an ingredient on the recipe sheet. */
export type SilhouetteKind = 'egg' | 'shaker' | 'block' | 'stalks';

export interface RecipeIngredient {
  id: string;
  label: string;
  silhouette: SilhouetteKind;
  /** Real-world outline size in meters: length along X, width along Z. */
  lengthM: number;
  widthM: number;
  /** Outline center on the sheet, in meters from the sheet center. */
  sheetPosition: readonly [x: number, z: number];
  /** Height of the object center above the sheet when snapped. */
  restHeightM: number;
  /** Roll around Z applied when snapped, so the model matches its outline. */
  snapRollDeg?: number;
  optional?: boolean;
}

/**
 * How a step finishes. `manual` is a stand-in for the gesture steps: the card
 * button advances them until gesture detection replaces it.
 */
export type StepCompletion = 'place-ingredients' | 'manual';

export interface RecipeStep {
  id: string;
  title: string;
  instruction: string;
  /** Short note on why the step matters, shown on the tips card. */
  tip: string;
  completion: StepCompletion;
}

export interface Recipe {
  id: string;
  title: string;
  /** Shown on the title card before the recipe starts. */
  intro: string;
  /** Shown on the card when every step is finished. */
  outro: string;
  /** Sheet size in meters: width along X, depth along Z. */
  sheetSizeM: readonly [width: number, depth: number];
  ingredients: readonly RecipeIngredient[];
  steps: readonly RecipeStep[];
}
