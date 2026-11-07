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
  - **Crack:** both hands pinch close together near a 6 cm egg, so hand tracking may
    lose a hand when they overlap. If it does, widen `crackReachM`.
  - **Whisk:** 3 turns over the bowl. Confirm jitter neither adds false turns nor
    stops the count, and that tracing a circle in the air feels natural.
  - **Season:** each pinch over the bowl counts once. Confirm a shaky pinch is not
    counted twice.
  - **Pour:** the bowl must tilt 55 degrees for 1.2 s. Confirm the wrist can do this
    while seated, without losing the pinch.
  - **Flip:** the pan must turn at 6 rad/s. Confirm a real flick reaches that, and
    that carrying the pan to the plate does not trigger it by accident.
- [ ] **Table layout**: the bowl and stove sit about 58 cm from a seated chest, at the
  edge of the 60 cm rule. Confirm they are reachable without leaning, and that the pan
  handle is easy to catch.
- [ ] **Cook time**: 25 s from raw (0) to the start of burnt (1) was
  picked on paper. Confirm the wait feels right in a headset.
- [ ] **Neck comfort**: with the table 72 cm under the head, the recipe sheet is about
  65 degrees below eye level and only the card's top edge shows at a level gaze.
  Check that this is comfortable for a full session.
- [ ] **Label readability**: the 24-unit sheet labels and 26-unit card text must stay
  sharp at 0.8 m on the Quest 2 display.
- [ ] **Depth precision**: outlines and labels sit a few millimeters above the paper.
  Confirm there is no flicker at the near plane of 0.02 m.
- [ ] **Frame rate**: minimum 60 fps on Quest 2. The emulator only proves draw call
  and triangle counts, not real GPU time.
- [ ] **Enter VR**: the card button must start an immersive session from Quest Browser.
