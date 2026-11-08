# Quest checklist

Things that cannot be confirmed without a physical headset. Each item matches a
`// QUEST-CHECK:` comment in the code, when one applies.

- [ ] **Seated calibration** (`src/systems/SeatedCalibrationSystem.ts`): the player rig
  is lifted once per session so the head sits `tableBelowHeadM` above the table. The
  emulator confirms this at a 1.2 m head height. Check it on a real seated player, and
  check that the first tracked pose is already stable.
- [ ] **Hand ray on the card button**: the button is about 13 x 6 cm at 75 cm, pressed
  by pointing and pinching. The emulator's aim is exact, so confirm a real shaky hand
  can hit it without several tries. If not, make the whole card the button.
- [ ] **Pinch grab**: confirm the thin green onion and small egg are easy to grab, and
  that the 7 cm snap radius feels forgiving.
- [ ] **Reach glow** (`src/systems/ReachHighlightSystem.ts`): objects glow when the grab
  pointer touches them. Confirm the glow appears before a real pinch would catch the
  object, and does not flicker when a hand hovers at the edge of range.
- [ ] **Gesture thresholds** (`src/systems/GestureSystem.ts`, values in
  `src/config/tuning.ts`): every threshold below is tuned on the emulator, whose hands
  do not shake. Each one needs a real hand:
  - **Crack:** one hand holds a 6 cm egg over the bowl and the other pinches beside
    it, so hand tracking may lose a hand when they overlap. If it does, widen
    `crackReachM`. Also confirm the right hand reaches the bowl while seated.
  - **Whisk:** 3 turns. Near the bowl the whisk tilts about 25 degrees toward the hand
    and its tip stays inside the bowl, even if the hand circles wider. Confirm this assist feels like
    stirring rather than like the whisk moving on its own.
  - **Season:** the shaker stands up in the hand, then counts one dash each time its
    cap tips past 95 degrees over the bowl and lifts back under 60. Confirm the wrist
    can turn that far, and that shaky tracking near the angle adds no extra dashes.
  - **Green onion:** it must be let go over the bowl. It is a thin object, so confirm
    the pinch holds it steadily on the way there.
  - **Butter:** it must be let go over the pan on the stove. Confirm the player
    finds this without help, and that the drop feels forgiving.
  - **Pour:** the bowl must tilt 55 degrees for 1.2 s. Confirm the wrist can do this
    while seated, without losing the pinch.
  - **Held pan:** it eases toward the hand to soften jolts. Confirm the lag does not
    feel like the pan is disconnected from the hand.
  - **Flip:** the pan must turn at 4.5 rad/s, then the omelette stays in the air for
    1.4 s. Confirm a real flick reaches that speed, that lifting the pan does not
    trigger it by accident, and that the toss is easy to follow in a headset.
- [ ] **Table layout**: the bowl and stove sit about 58 cm from a seated chest, at the
  edge of the 60 cm rule. Confirm they are reachable without leaning, and that the pan
  handle is easy to catch.
- [ ] **Cook time**: 25 s from raw (0) to the start of burnt (1) was
  picked on paper. Confirm the wait feels right in a headset.
- [ ] **Neck comfort**: the table sits 42 cm under the head, like a real desk for a
  seated player (the brief asks for 70 to 75 cm; the developer chose 42 cm after
  playtesting because 72 cm felt like looking down from a standing height). The
  recipe sheet is about 50 degrees below eye level. Check that this is comfortable
  for a full session and that the head is not too close to the stove.
- [ ] **Label readability**: the 24-unit sheet labels and 26-unit card text must stay
  sharp at 0.8 m on the Quest 2 display.
- [ ] **Depth precision**: outlines and labels sit a few millimeters above the paper.
  Confirm there is no flicker at the near plane of 0.02 m.
- [ ] **Frame rate**: minimum 60 fps on Quest 2. The emulator only proves draw call
  and triangle counts, not real GPU time. Open the game with `?debug=1`: a board left
  of the table shows FPS, the worst frame, draw calls and triangles, turning red past
  the budget. The same numbers go to the console every 5 s with a list of the scenery
  holding the most meshes. In the emulator the busiest moment was 76 draw calls (both
  eyes counted together) and about 11k scene triangles. Check what the board says on
  a Quest 2 during the cook step, when the pan steams.
- [ ] **Enter VR**: the card button must start an immersive session from Quest Browser.
- [ ] **Palm-up pause** (`src/systems/PauseSystem.ts`): the palm direction in grip space
  (+X for the left hand, -X for the right) was read from the emulator hands. Confirm a
  real palm turned up fills the ring, that the 1 s hold and the 0.75 / 0.6 thresholds
  in `src/config/tuning.ts` do not fire while cooking normally, and flip the signs if
  the ring shows with the palm down.
- [ ] **Auto pause**: open the Quest system menu or take the headset off mid-recipe. The
  card must say Paused with Resume when you come back. The emulator could not blur
  the session, so this path is untested.
- [ ] **Card tips**: the 24-unit tip line under each step must stay readable at 0.8 m,
  and the longest tips (about 66 characters) must fit in two lines.
- [ ] **Sound** (`src/systems/SoundSystem.ts`): every sound is synthesized at load and
  tuned on desktop speakers. On a Quest, check that the audio starts after Enter VR,
  that the sizzle follows the pan in space and rises as the egg browns, that it goes
  quiet on pause and when the system menu opens, and that no sound is too loud.
- [ ] **Particles** (`src/systems/EffectsSystem.ts`): salt grains, yolk and onion bits,
  steam, smoke and star sparkles are camera-facing quads. Check that they face both
  eyes without looking flat, that the 4 to 5 mm salt grains are visible, and that two
  extra draw calls while they show keep the frame rate.
