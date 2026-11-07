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
  optional?: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  instruction: string;
  /** Sheet size in meters: width along X, depth along Z. */
  sheetSizeM: readonly [width: number, depth: number];
  ingredients: readonly RecipeIngredient[];
}
