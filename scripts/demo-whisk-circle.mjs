/**
 * Stirs with the left hand. It runs inside the page through `iwsdk browser
 * run`, so the moves chain frame by frame with no gaps between them. Hand
 * sequences place a held object by its base, which fights the pose the game
 * gives the whisk, so this uses plain moves.
 */
import { BOWL } from './demo-layout.mjs';

const TURNS = 3.4;
const POINTS_PER_TURN = 16;
const MOVE_S = 0.1;
const HAND_CIRCLE_M = 0.07;
const HAND_HEIGHT_M = 1.13;

export default async function run({ frame }) {
  await frame.evaluate(
    async ({ bowl, points, moveS, radius, y }) => {
      const remote = window.IWER_DEVICE.remote;
      for (let index = 1; index <= points; index += 1) {
        const angle = (index / 16) * Math.PI * 2;
        await remote.dispatch('animate_to', {
          device: 'hand-left',
          position: {
            x: bowl.x + Math.cos(angle) * radius,
            y,
            z: bowl.z + Math.sin(angle) * radius,
          },
          duration: moveS,
        });
      }
    },
    {
      bowl: BOWL,
      points: Math.round(TURNS * POINTS_PER_TURN),
      moveS: MOVE_S,
      radius: HAND_CIRCLE_M,
      y: HAND_HEIGHT_M,
    },
  );
  return { turns: TURNS };
}
