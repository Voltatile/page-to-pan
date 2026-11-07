import { createComponent, Types } from '@iwsdk/core';

/** An ingredient the player can carry to its outline on the recipe sheet. */
export const Ingredient = createComponent(
  'Ingredient',
  {
    ingredientId: { type: Types.String, default: '' },
    placed: { type: Types.Boolean, default: false },
  },
  'Ingredient that snaps to its outline on the recipe sheet',
);
