# Quest checklist

Things that cannot be confirmed without a physical headset. Each item matches a
`// QUEST-CHECK:` comment in the code, when one applies. The list follows one
play session from start to finish, so it can be worked through in order.

## Before the session

- Open **https://voltatile.github.io/page-to-pan/?debug=1** in Quest Browser. The
  `?debug=1` board shows the frame rate beside the table. Play once more without it
  at the end, the way judges will see the game.
- Sit on a normal chair at a desk. Hand tracking on, controllers put down.
- For each item write pass or fail and what happened. Almost every number lives in
  `src/config/tuning.ts`, so most fixes are a one-line change there.

## 1. Start and comfort

- [ ] **Landing page and Enter VR** (`index.html`, `src/landing.ts`): the 2D page must be
  readable in the browser window, its big Enter VR button must start an immersive
  session, and the page must come back after leaving VR. The card button inside the
  scene stays as a second way in.
- [ ] **Under 10 seconds**: from the page loading to holding the first ingredient
  should take less than 10 s (a contest rule).
- [ ] **Seated calibration** (`src/systems/SeatedCalibrationSystem.ts`): the player rig
  is lifted once per session so the head sits `tableBelowHeadM` above the table. The
  emulator confirms this at a 1.3 m head height. Check it on a real seated player, and
  check that the first tracked pose is already stable.
- [ ] **Neck comfort**: the table sits 42 cm under the head, like a real desk for a
  seated player (the first plan said 70 to 75 cm; the developer chose 42 cm after
  playtesting because 72 cm felt like looking down from a standing height). The
  recipe sheet is about 50 degrees below eye level. Check that this is comfortable
  for a full session and that the head is not too close to the stove.
- [ ] **Table layout**: the bowl and stove sit about 58 cm from a seated chest, at the
  edge of the 60 cm rule. Confirm they are reachable without leaning, and that the pan
  handle is easy to catch.
- [ ] **Hand ray on the card button**: the button is 12 x 7.2 cm on a card leaning back
  45 degrees, 80 cm away, pressed by pointing and pinching. The emulator's aim is exact, so confirm a real
  shaky hand can hit it without several tries. If not, make the whole card the button.
- [ ] **Label readability**: the 24-unit sheet labels and 26-unit card text must stay
  sharp at 0.8 m on the Quest 2 display.
- [ ] **Card tips**: the 24-unit tip line under each step must stay readable at 0.8 m,
  and the longest tips (about 66 characters) must fit in two lines.
- [ ] **Stuck hints**: after 20 s on a step without progress (`hintAfterS`), the tip
  line turns into a how-to hint and the card swells briefly, as it does on every new
  step. Confirm 20 s is neither nagging nor too late, and that the swell is noticed
  without being distracting.
- [ ] **Depth precision**: outlines and labels sit a few millimeters above the paper.
  Confirm there is no flicker at the near plane of 0.02 m.

## 2. Hands and gestures, in recipe order

Every threshold is tuned on the emulator, whose hands do not shake
(`src/systems/GestureSystem.ts`, values in `src/config/tuning.ts`).

- [ ] **Pinch grab**: confirm the thin green onion and small egg are easy to grab, and
  that the 7 cm snap radius feels forgiving.
- [ ] **Reach glow** (`src/systems/ReachHighlightSystem.ts`): objects glow when the grab
  pointer touches them. Confirm the glow appears before a real pinch would catch the
  object, and does not flicker when a hand hovers at the edge of range.
- [ ] **Guide rings** (`src/systems/GuideSystem.ts`): while an object is held, a ring
  pulses where it has to go and turns green once the object is over it. While whisking
  or pouring, the ring blends from orange to green as the gesture nears done. Confirm
  the ring is easy to see but not distracting, and that green really means the release
  or tilt will count.
- [ ] **Crack**: one hand holds a 6 cm egg over the bowl and the other pinches beside
  it, so hand tracking may lose a hand when they overlap. If it does, widen
  `crackReachM`. Also confirm the right hand reaches the bowl while seated.
- [ ] **Egg shells** (`src/systems/EggShellSystem.ts`): after the crack two shell halves
  tumble out in front of the bowl, rest for 6 s and shrink away. Confirm they never
  land on the whisk or the edge of the table, and that they are noticed.
- [ ] **Whisk**: 3 turns. Near the bowl the whisk tilts about 25 degrees toward the
  hand and its tip stays inside the bowl, even if the hand circles wider. Confirm this
  assist feels like stirring rather than like the whisk moving on its own.
- [ ] **Season**: the shaker stands up in the hand, then counts one dash each time its
  cap tips past 95 degrees over the bowl and lifts back under 60. Confirm the wrist
  can turn that far, and that shaky tracking near the angle adds no extra dashes.
- [ ] **Green onion**: it must be let go over the bowl. It is a thin object, so
  confirm the pinch holds it steadily on the way there.
- [ ] **Heat the pan**: the pan seats when let go within 12 cm of the stove, then the
  butter must be let go over the pan. Confirm the player finds both without help, and
  that the drops feel forgiving.
- [ ] **Pour**: the bowl must tilt 55 degrees for 1.2 s. Confirm the wrist can do this
  while seated, without losing the pinch.
- [ ] **Cook time**: 25 s from raw (0) to the start of burnt (1) was picked on paper.
  Confirm the wait for Ready feels right in a headset.
- [ ] **Held pan**: it eases toward the hand to soften jolts. Confirm the lag does not
  feel like the pan is disconnected from the hand.
- [ ] **Flip**: the hand must turn at 4.5 rad/s, then the omelette rises 32 cm and
  stays in the air for 1.5 s. Confirm a real flick reaches that speed, that lifting
  the pan does not trigger it by accident, and that the toss is easy to follow.
- [ ] **Finish and serve**: the pan goes back on the stove until Golden, is lifted
  5 cm, then served by bringing it over the plate. Confirm the plate zone is easy to
  hit without the pan bumping the table.

- [ ] **Praise popups** (`src/systems/PraiseSystem.ts`): after each step a short cheer
  floats up over the bowl, pan or plate for 2.5 s, turned toward the head. Confirm it
  is readable while the hands are busy and never hides the food being worked on.

## 3. Pause

- [ ] **Palm-up pause** (`src/systems/PauseSystem.ts`): the palm direction in grip
  space (+X for the left hand, -X for the right) was read from the emulator hands.
  Confirm a real palm turned up fills the ring, that the 1 s hold and the 0.75 / 0.6
  thresholds in `src/config/tuning.ts` do not fire while cooking normally, and flip
  the signs if the ring shows with the palm down.
- [ ] **Auto pause**: open the Quest system menu or take the headset off mid-recipe.
  The card must say Paused with Resume and Menu when you come back. The emulator could not blur
  the session, so this path is untested.
- [ ] **Resume and Menu**: Resume continues where the recipe stopped, with the pan
  still at the same doneness. Menu sends every ingredient home and shows the title.

## 4. Sound and effects

- [ ] **Sound** (`src/systems/SoundSystem.ts`): every sound is synthesized at load and
  tuned on desktop speakers. Check that the audio starts after Enter VR, that the
  sizzle follows the pan in space and rises as the egg browns, that it goes quiet on
  pause and when the system menu opens, and that no sound is too loud
  (`masterVolume`, `sizzleVolume`).
- [ ] **Music**: an 11 s loop of C, Am, F and G, synthesized at load (about 50 ms on a
  desktop). Confirm the load does not stutter on a Quest 2, the loop has no audible
  seam, and the music sits under the kitchen sounds (`musicVolume`).
- [ ] **Particles** (`src/systems/EffectsSystem.ts`): salt grains, yolk and onion bits,
  steam, smoke and star sparkles are camera-facing quads. Check that they face both
  eyes without looking flat, that the 4 to 5 mm salt grains are visible, and that the
  steam reads as steam rather than as grey dots.

## 5. Performance

- [ ] **Frame rate**: minimum 60 fps on Quest 2. The emulator only proves draw call
  and triangle counts, not real GPU time. The `?debug=1` board shows FPS, the worst
  frame, draw calls and triangles, turning red past the budget. The same numbers go to
  the console every 5 s with a list of the scenery holding the most meshes. In the
  emulator the busiest moment was 76 draw calls and about 11k scene triangles. Read
  the board during the cook step, when the pan steams and the particles show.
- [ ] **Draw call count** (`src/systems/DebugOverlaySystem.ts`): in the emulator
  `renderer.info` counts both eyes of one XR frame together. If Quest Browser renders
  with multiview, the board may show about half as many. Note which it is, so the
  budget is read the same way.

## 6. After the cook

- [ ] **Title sign and menu**: the "Page to Pan" sign floats at eye height over the card,
  and the How to Play and Credits buttons (56 units tall, smaller than the main button)
  must be easy to hit with a hand ray. Each page returns with Back.
- [ ] **Settings** (`src/systems/SettingsSystem.ts`): the - and + buttons are 56 units
  square, the smallest on the card. Confirm a hand ray hits them, that the volume
  change is heard at once and kept after a reload, and that Recenter fits the table to
  a player who moved in the chair.
- [ ] **Title preview** (`src/systems/TitlePreviewSystem.ts`): a finished omelette turns
  above the card on the title screen. Confirm it reads as an omelette and does not
  hide the card text.
- [ ] **Results**: the score, the chef note and the three stars must be readable from
  the seat, and the stars must pop in one by one with their chime.
- [ ] **Again and Menu**: Again clears the table and starts a second cook at the
  ingredients step at once (the emulator demo proves the logic). Menu returns to the
  title. In pause, Menu leaves the recipe for the title.
- [ ] **New best ribbon**: after a record, the "New best!" ribbon pops over the stars.
  Confirm it is in view from the seat and does not cover the stars.
- [ ] **Best stars**: close the tab and open the game again. The title card must still
  say "Your best: N of 3 stars", which proves Quest Browser keeps localStorage.
