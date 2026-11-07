import { createComponent, Types } from '@iwsdk/core';

/** Tag: a hand is close enough to grab this object with a pinch. */
export const InReach = createComponent(
  'InReach',
  {},
  'A hand is close enough to grab this object',
);

/** A piece of cookware that appears on the table during certain steps. */
export const KitchenTool = createComponent(
  'KitchenTool',
  { toolId: { type: Types.String, default: '' } },
  'Cookware shown and unlocked by the recipe step',
);

/** An ingredient the player can carry to its outline on the recipe sheet. */
export const Ingredient = createComponent(
  'Ingredient',
  {
    ingredientId: { type: Types.String, default: '' },
    placed: { type: Types.Boolean, default: false },
  },
  'Ingredient that snaps to its outline on the recipe sheet',
);
