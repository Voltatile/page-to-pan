# Submission text (draft)

Draft for the competition entry form. Edit freely; nothing here is in the game.

- **Title:** Page to Pan
- **Track:** Gaming
- **Play link:** https://voltatile.github.io/page-to-pan/
- **Video:** (add the YouTube link, under 3 minutes)

## One line

Learn to cook with your own hands: set real-size ingredients on a printed
recipe sheet, then crack, whisk, flip and serve.

## Description

Page to Pan is a seated, hands-only VR cooking game for people who have never
cooked. A recipe sheet lies on the kitchen table with every ingredient printed
as a life-size outline. You place each ingredient on its outline, the way a
careful cook sets everything out first, and then the sheet walks you through
the dish one step at a time.

Each step is a real kitchen motion. You crack an egg by pulling it apart with
two hands, whisk in circles, tip a shaker to season, and flick your wrist to
flip. The food changes color on the heat, the sizzle changes pitch, and you
decide when to lift the pan. A card beside the table says why each step
matters, so the game teaches the reason as well as the motion.

When you serve, you get a score, up to three stars, one sentence from the chef
about what to do better, and a short note on how to cook the same dish in a
real kitchen.

There are three recipes: an omelette, nasi goreng and a pancake. Chef Exam mode
removes the guide rings for players who want to cook from memory.

## How it meets the brief

- **Hands first:** the whole game is played with hand tracking: pinch to hold,
  natural wrist and arm motions for every step.
- **Seated:** everything sits within reach of a chair. There is no walking and
  no turning around. The table height is set from your head height when you
  enter.
- **Easy in, easy out:** you can be holding the first ingredient within
  seconds. Hold a palm up to pause, and the game pauses by itself when the
  headset comes off.
- **Original:** every model is built in code and every sound is synthesized in
  code. There are no third-party assets and no brands.

## Technical notes

- Built with the Meta Immersive Web SDK (Three.js, ECS, TypeScript, Vite).
- Recipes are data: a new dish is one data file plus a few models.
- Measured in the headset emulator: at most 88 draw calls and about 15,000
  triangles in the scene.
- An end-to-end script plays every recipe from the title to the score and fails
  if any step does not advance.

## Still to do before submitting

- [ ] Record the video and add its link above.
- [ ] Play once on a real Quest and work through `docs/quest-checklist.md`.
