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

/** Which detector finishes a step. */
export type StepCompletion =
  | 'place-ingredients'
  | 'crack'
  | 'whisk'
  | 'season'
  | 'garnish'
  | 'heat'
  | 'pour'
  | 'cook'
  | 'flip'
  | 'finish'
  | 'plate';

export type ToolId = 'bowl' | 'whisk' | 'pan' | 'stove' | 'plate';

export interface RecipeStep {
  id: string;
  title: string;
  instruction: string;
  /** Short note on why the step matters, shown on the tips card. */
  tip: string;
  completion: StepCompletion;
  /** Tools on the table during this step. */
  tools: readonly ToolId[];
  /** Tools the player may pick up during this step. */
  grabbableTools: readonly ToolId[];
  /** Ingredients still on the table during this step. */
  ingredients: readonly string[];
  /** Ingredients the player may pick up during this step. */
  grabbableIngredients: readonly string[];
  /** Skip this step unless this optional ingredient was set out. */
  onlyIfPlaced?: string;
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
