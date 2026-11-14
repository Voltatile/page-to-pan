# Page to Pan

A VR cooking game for beginners. A printed recipe sheet on the kitchen table
shows every ingredient as a life-size outline. Set each ingredient on its
outline, then cook the dish step by step with your own hands.

**Play it:** https://pagetopan.voltatile.tech/ (open in the Meta Quest
Browser and press **Enter VR**)

Made for the Meta VR Start Developer Competition 2026 (Gaming track).

## How to play

- **Sit down and use your hands.** No controllers and no walking: everything is
  within reach of a seated player.
- **Pick a recipe** from the recipe book: Omelette, Nasi Goreng or Pancake.
- **Pinch** to pick things up. Place the ingredients on their outlines, then
  follow the card: crack the egg with two hands, whisk in circles, tip the
  shaker, flick your wrist to flip.
- **Watch the pan.** Food goes from raw to golden to burnt, and you choose when
  to take it off the heat.
- **Pause** by holding an empty hand palm up for a second. The game also pauses
  by itself when you take the headset off.
- At the end you get a score, up to three stars, a note from the chef, and a
  short note on how to cook the same dish at home.

The **Mode** button on the title card switches to **Chef Exam**: cook from
memory, with no rings showing where things go.

## What is in it

- Three recipes, each built from one data file in `src/config/recipes/`.
- Every model is built in code and every sound is synthesized in code. The game
  ships no model, texture or audio files. See [CREDITS.md](CREDITS.md).
- Built with the Meta Immersive Web SDK (Three.js, ECS, Vite, TypeScript).

## Run it locally

Needs Node.js 22.

```sh
npm install
npm run dev
```

`npm run dev` opens a browser with a built-in headset emulator, so no headset
is needed to try the game.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run demo                          # plays one full omelette in the emulator
DEMO_RECIPE=nasi-goreng npm run demo  # or pancake
DEMO_DEBUG=1 npm run demo             # also prints frame rate and draw calls
```

Add `?debug=1` to the game's address to show a frame-rate board beside the
table, in the emulator or on a headset.

## Project notes

- [docs/roadmap.md](docs/roadmap.md): what was planned and what is done.
- [docs/quest-checklist.md](docs/quest-checklist.md): what still has to be
  checked on a real headset.
