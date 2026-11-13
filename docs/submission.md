# Submission text (draft)

Draft for the Devpost entry form. The rules ask the text to cover four things:
inspiration, how it was built, future plans, and a target launch date. Lines
marked **CONFIRM** are guesses that only the developer can check. Nothing here
is in the game.

- **Title:** Page to Pan
- **Track:** Gaming
- **Division:** New Experience (first commit 7 Nov 2026, inside the contest window)
- **Play link:** https://voltatile.github.io/page-to-pan/
- **Video:** (add the YouTube or Vimeo link, public, under 3 minutes)

## One line

Learn to cook with your own hands: set real-size ingredients on a printed
recipe sheet, then crack, whisk, flip and serve.

## Inspiration

**CONFIRM: rewrite this in your own words. It should be your real reason.**

Cooking videos show what to do, but not how it feels to do it. A beginner
watching one still does not know how hard to crack an egg, how long a flip
takes, or when "golden" has arrived. Those are things hands learn, and VR is
the one screen that has hands in it.

The printed sheet came from a simple idea: if every ingredient is drawn at its
real size, the page stops being a list to read and becomes a place to put
things. Setting the table teaches the recipe before the stove is even on.

## What it does

Page to Pan is a seated, hands-only VR cooking game for people who have never
cooked. A recipe sheet lies on the kitchen table with every ingredient printed
as a life-size outline. You place each ingredient on its outline, the way a
careful cook sets everything out first, and then the game walks you through
the dish one step at a time.

Each step is a real kitchen motion. You crack an egg by pulling it apart with
two hands, whisk in circles, tip a shaker to season, and flick your wrist to
flip. The whisk, the spatula and the pan sit in your fingers by their handles.
The food changes color on the heat, the sizzle changes pitch, and you decide
when to lift the pan. A card beside the table says why each step matters, so
the game teaches the reason as well as the motion.

When you serve, you get a score, up to three stars, one sentence from the chef
about what to do better, and a short note on how to cook the same dish in a
real kitchen.

There are three recipes: an omelette, nasi goreng and a pancake. Chef Exam mode
removes the guide rings for players who want to cook from memory, and the best
star count for each recipe is kept between sessions.

## How it was built

- Built with the Meta Immersive Web SDK (Three.js, an entity-component system,
  TypeScript, Vite) and served as a web page, so it opens from a link in the
  Meta Quest Browser with nothing to install.
- Hand tracking only. Objects are held with a pinch, and each gesture is read
  from smoothed hand motion: how far two hands pull apart, how many circles a
  hand draws, how far a wrist tips, how fast it flicks.
- Every model is built in code and every sound is synthesized in code. The game
  ships no model, texture or audio files, which keeps the download small and
  the start fast.
- Recipes are data. A new dish is one data file plus a few models; the systems
  that run the steps, gestures, cooking and scoring do not change.
- Scoring and gesture logic are plain functions with unit tests. A script also
  plays every recipe from the title to the score in the headset emulator and
  fails if any step does not advance.
- Measured in the emulator: at most 88 draw calls and about 15,000 triangles in
  the scene, against a budget of 100 draw calls for Meta Quest 2.

## How it meets the brief

- **Hands first:** the whole game is played without ever pairing a controller.
- **Seated:** everything sits within reach of a chair. There is no walking and
  no turning around. The table height is set from your head height on entry.
- **Easy in, easy out:** you can be holding the first ingredient within
  seconds, and one dish takes two to three minutes. Hold a palm up to pause;
  the game also pauses by itself when the headset comes off.
- **Original, not a wrapper:** there is no third-party service or asset in it.

## What is next

**CONFIRM: keep only the plans you really intend to do.**

- Test and tune every gesture on a real headset. The game was developed in the
  emulator, where hands do not shake.
- Adapt the layout for the narrower view of Meta VR Glasses, so the card, the
  sheet and the stove fit in view together.
- More recipes, grouped into short courses that build one skill at a time.
- A gaze-and-pinch way to press the card buttons.
- Voice lines for each step, so the card does not have to be read.

## Target launch date

**CONFIRM: the rules ask for a date if the game is not on the Meta store yet.
Replace this with your real plan.**

The game is playable now at the link above. A packaged release on the Meta
store is planned for (month, year).

## Still to do before submitting

- [ ] Confirm Meta VR Start Program membership and Developer Access on the Meta
  account. Both are required by the time of submission.
- [ ] Record the video, upload it as public, and add its link above.
- [ ] Fill in the three **CONFIRM** sections.
- [ ] Play once on a real Quest and work through `docs/quest-checklist.md`.
- [ ] Submit the form yourself before 18 Nov 2026, 12:00 PM PT (19 Nov, 03:00
  WIB). Do not push to `main` after that: every push redeploys the game, and
  the rules forbid changes after the deadline.
