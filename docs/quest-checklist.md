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
