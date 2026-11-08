/**
 * Stirs the pan on the stove with the right hand, for the nasi goreng demo.
 * Like the whisk circle it runs inside the page through `iwsdk browser run`,
 * so the moves chain frame by frame with no gaps between them.
 */
import { STOVE } from './demo-layout.mjs';

const TURNS = 3.4;
const POINTS_PER_TURN = 16;
const MOVE_S = 0.1;
const HAND_CIRCLE_M = 0.07;
const HAND_HEIGHT_M = 1.1;

export default async function run({ frame }) {
  await frame.evaluate(
    async ({ pan, points, moveS, radius, y }) => {
      const remote = window.IWER_DEVICE.remote;
      for (let index = 1; index <= points; index += 1) {
        const angle = (index / 16) * Math.PI * 2;
        await remote.dispatch('animate_to', {
          device: 'hand-right',
          position: {
            x: pan.x + Math.cos(angle) * radius,
            y,
            z: pan.z + Math.sin(angle) * radius,
          },
          duration: moveS,
        });
      }
    },
    {
      pan: STOVE,
      points: Math.round(TURNS * POINTS_PER_TURN),
      moveS: MOVE_S,
      radius: HAND_CIRCLE_M,
      y: HAND_HEIGHT_M,
    },
  );
  return { turns: TURNS };
}
