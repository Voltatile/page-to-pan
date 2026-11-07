# Quest checklist

Things that cannot be confirmed without a physical headset. Each item matches a
`// QUEST-CHECK:` comment in the code, when one applies.

- [ ] **Seated table height** (`src/scene-assets/kitchen.scene-asset.ts`): the table
  top sits at a fixed 0.88 m, which is 72 cm under the emulator's standing head
  (about 1.6 m). A seated head on Quest is closer to 1.2 m, so the table would sit
  too high. Planned fix for days 2-3: measure the head height when the XR session
  starts and move the station to 72 cm under it.
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
