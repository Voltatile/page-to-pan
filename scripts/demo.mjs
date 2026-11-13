/**
 * Plays one full omelette in the emulator with smooth hand and head motion,
 * and fails loudly if any step does not advance. Use it as an end-to-end test,
 * or record the browser window for the demo video.
 *
 *   npm run demo
 *
 * It restarts the dev session, hides the emulator UI, counts down so you can
 * start your screen recorder, then cooks. Exit code 0 means every step passed
 * and the console stayed free of errors.
 *
 *   DEMO_DEBUG=1 npm run demo
 *
 * also opens the page with ?debug=1 and ends with the performance numbers the
 * debug overlay logged while cooking.
 *
 *   DEMO_RECIPE=nasi-goreng npm run demo
 *
 * cooks nasi goreng instead of the omelette, and DEMO_RECIPE=pancake cooks
 * the pancake.
 *
 *   DEMO_SHOTS=some/folder npm run demo
 *
 * also saves pictures of the plated dish and the result card in that folder.
 */
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOWL, STOVE } from './demo-layout.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'node_modules/@iwsdk/cli/bin/iwsdk.js');
const SYSTEM_CHROME = 'C:\\Program Files\\Google\\Chrome\\Application';
const COUNTDOWN_S = 5;
const VIDEO_LIMIT_S = 180;
const IS_DEBUG = process.env.DEMO_DEBUG === '1';
const IS_NASI_GORENG = process.env.DEMO_RECIPE === 'nasi-goreng';
const IS_PANCAKE = process.env.DEMO_RECIPE === 'pancake';
const SHOTS_DIR = process.env.DEMO_SHOTS ? resolve(process.env.DEMO_SHOTS) : null;
/** Seated eye height: the game keeps the table 42 cm under the head. */
const HEAD = { x: 0, y: 1.3, z: 0 };
/** Time on the heat after the card first says Golden, aiming for doneness 0.7. */
const GOLDEN_EXTRA_MS = 1500;
const PLATE = { x: 0, z: -0.31 };
const LEVEL = { pitch: 0, yaw: 0, roll: 0 };
const PAN_LIFTED = { x: 0.3, y: 1.04, z: -0.2 };

const env = { ...process.env };
const startedAt = Date.now();
let cardEntity = 0;
let passed = 0;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function log(message) {
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(0).padStart(3);
  console.log(`[${seconds}s] ${message}`);
}

/** Several commands at once can collide on the session lock, so retry those. */
async function runCli(args, timeoutMs) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await callCli(args, timeoutMs);
    } catch (error) {
      if (attempt >= 3 || !error.message.includes('state lock')) {
        throw error;
      }
      await sleep(400);
    }
  }
}

/** `browser logs` answers with a plain list of entries. */
function logEntries(result) {
  return Array.isArray(result) ? result : (result?.logs ?? []);
}

function callCli(args, timeoutMs = 60000) {
  return new Promise((done, fail) => {
    execFile(
      process.execPath,
      [CLI, ...args],
      { cwd: ROOT, env, timeout: timeoutMs, maxBuffer: 1 << 24 },
      (error, stdout, stderr) => {
        const output = stdout.includes('{') ? stdout : stderr;
        const text = output.slice(output.indexOf('{'));
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          // Handled below: the failure message shows the raw output.
        }
        if (parsed?.ok === true) {
          done(parsed.data?.result ?? parsed.data);
          return;
        }
        const reason = parsed?.error?.message ?? (error?.message || stderr);
        fail(new Error(`${args.slice(0, 2).join(' ')}: ${reason}`));
      },
    );
  });
}

const xr = (action, input, timeoutMs) =>
  runCli(['xr', action, '--input-json', JSON.stringify(input)], timeoutMs);

/** One smooth hand move. The head follows the hand; the body stays seated. */
function hand(device, steps) {
  return runCli(
    [
      'xr',
      'run-sequence',
      '--input-json',
      JSON.stringify({ device, idleHand: 'keep', body: 'fixed', steps }),
      '--timeout',
      '45000',
    ],
    50000,
  );
}

/** Pitch and yaw that point a device at a target, in degrees. */
function aim(from, target) {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const dz = target.z - from.z;
  const toDeg = 180 / Math.PI;
  return {
    pitch: Math.atan2(dy, Math.hypot(dx, dz)) * toDeg,
    yaw: Math.atan2(-dx, -dz) * toDeg,
    roll: 0,
  };
}

const lookAt = (target, duration = 0.9) =>
  xr('animate-to', {
    device: 'headset',
    orientation: aim(HEAD, target),
    duration,
  });

/** Turns the recipe book one page forward with the right hand ray. */
async function turnBookPage() {
  const found = await runCli([
    'ecs',
    'find',
    '--input-json',
    JSON.stringify({ namePattern: '^Book Nav$' }),
  ]);
  const navEntity = found.entities[0].entityIndex;
  const { targets } = await xr('list-targets', {});
  const button = targets.find((target) => target.name === 'book-next');
  const from = { x: 0.2, y: 1.2, z: -0.25 };
  const before = await cardTitle();
  // A pinch can land while the book is still settling, so try a few times.
  for (const nudge of [0, 0.01, -0.01, 0.02, 0, 0.01, -0.01]) {
    const target = { ...button.position, x: button.position.x + nudge };
    await xr('animate-to', {
      device: 'hand-right',
      position: from,
      orientation: aim(from, target),
      duration: 0.7,
    });
    await sleep(350);
    const state = JSON.stringify(
      await runCli([
        'ui',
        'inspect',
        '--input-json',
        JSON.stringify({ entityIndex: navEntity, selector: '#book-next' }),
      ]),
    );
    if (state.includes('"hovered":true')) {
      await sleep(300);
      await xr('select', { device: 'hand-right', duration: 0.3 });
      await sleep(1200);
      if ((await cardTitle()) !== before) {
        return;
      }
    }
  }
  throw new Error('The book page did not turn');
}

async function uiElement(selector) {
  return runCli([
    'ui',
    'inspect',
    '--input-json',
    JSON.stringify({ entityIndex: cardEntity, selector }),
  ]);
}

function findText(value) {
  if (typeof value?.text === 'string') {
    return value.text;
  }
  for (const child of Object.values(value ?? {})) {
    if (child != null && typeof child === 'object') {
      const text = findText(child);
      if (text != null) {
        return text;
      }
    }
  }
  return null;
}

const cardTitle = async () => findText(await uiElement('#recipe-title')) ?? '';

async function expectTitle(pattern, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  let title = '';
  while (Date.now() < deadline) {
    title = await cardTitle();
    if (pattern.test(title)) {
      passed += 1;
      log(`PASS  ${title}`);
      return;
    }
    await sleep(300);
  }
  throw new Error(`Expected card title ${pattern}, got "${title}"`);
}

async function waitForTitle(pattern, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pattern.test(await cardTitle())) {
      return true;
    }
    await sleep(300);
  }
  return false;
}

/** Points the right hand at the card button and pinches. */
async function pressCardButton() {
  const { targets } = await xr('list-targets', {});
  const button = targets.find((target) => target.name === 'card-button');
  const from = { x: 0.2, y: 1.2, z: -0.25 };
  const nudges = [0, 0.015, -0.015, 0.03, -0.03];
  for (const nudge of nudges) {
    const target = {
      x: button.position.x + nudge,
      y: button.position.y,
      z: button.position.z,
    };
    await xr('animate-to', {
      device: 'hand-right',
      position: from,
      orientation: aim(from, target),
      duration: 0.7,
    });
    await sleep(350);
    const state = JSON.stringify(await uiElement('#card-button'));
    if (state.includes('"hovered":true')) {
      await sleep(400);
      await xr('select', { device: 'hand-right', duration: 0.3 });
      await sleep(500);
      return;
    }
  }
  throw new Error('The hand ray never reached the card button');
}

async function placeIngredient(device, target, x, z) {
  await hand(device, [
    { target, approach: { distance: 0.06 }, pinch: { value: 1, at: 'arrival' } },
    { position: { x, y: 1.0, z }, depart: { distance: 0.08 } },
    { pinch: 0, duration: 0.25 },
  ]);
  log(`      placed ${target}`);
}

async function crackEgg(next = /^Whisk/) {
  const y = 1.03;
  await hand('hand-left', [
    { target: 'Egg', approach: { distance: 0.06 }, pinch: { value: 1, at: 'arrival' } },
    { position: { x: BOWL.x, y, z: BOWL.z }, depart: { distance: 0.06 } },
  ]);
  await hand('hand-right', [
    { anchor: 'grasp', position: { x: BOWL.x + 0.06, y: y + 0.02, z: BOWL.z } },
    { pinch: 1, duration: 0.25 },
  ]);
  await sleep(500);
  const leftAt = await xr('get-transform', { device: 'hand-left' });
  const rightAt = await xr('get-transform', { device: 'hand-right' });
  await Promise.all([
    xr('animate-to', {
      device: 'hand-left',
      position: { ...leftAt.position, x: leftAt.position.x - 0.06 },
      duration: 0.7,
    }),
    xr('animate-to', {
      device: 'hand-right',
      position: { ...rightAt.position, x: rightAt.position.x + 0.06 },
      duration: 0.7,
    }),
  ]);
  await expectTitle(next);
  await Promise.all([
    hand('hand-left', [{ pinch: 0, duration: 0.2 }]),
    hand('hand-right', [{ pinch: 0, duration: 0.2 }]),
  ]);
}

async function whiskEggs(next = /^Season/) {
  await hand('hand-left', [
    { target: 'Whisk', approach: { distance: 0.06 }, pinch: { value: 1, at: 'arrival' } },
    { anchor: 'grasp', position: { x: BOWL.x + 0.07, y: 1.1, z: BOWL.z } },
  ]);
  await saveShot('hold-whisk');
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await runCli(['browser', 'run', 'scripts/demo-whisk-circle.mjs']);
    if (await waitForTitle(next, 400)) {
      break;
    }
  }
  await expectTitle(next);
  await hand('hand-left', [{ pinch: 0, duration: 0.2 }]);
}

async function seasonEggs() {
  const position = { x: BOWL.x + 0.09, y: 1.08, z: BOWL.z };
  // Positive roll turns the top of the shaker to the left, toward the bowl.
  const tipped = { pitch: 0, yaw: 0, roll: 105 };
  const move = (orientation) => ({
    anchor: 'grip',
    position,
    orientation,
    duration: 0.4,
  });
  await hand('hand-right', [
    {
      target: 'Salt',
      approach: { distance: 0.06 },
      orientation: LEVEL,
      pinch: { value: 1, at: 'arrival' },
    },
    { anchor: 'grip', position, orientation: LEVEL },
    move(tipped),
    move(LEVEL),
    move(tipped),
    move(LEVEL),
  ]);
  await expectTitle(/^Season: 2$/);
  await hand('hand-right', [{ pinch: 0, duration: 0.2 }]);
  await sleep(600);
  await pressCardButton();
  await expectTitle(/^Green onion/);
}

async function addGreenOnion() {
  await hand('hand-right', [
    {
      target: 'Green Onion',
      approach: { distance: 0.06 },
      pinch: { value: 1, at: 'arrival' },
    },
    {
      position: { x: BOWL.x + 0.09, y: 1.03, z: BOWL.z },
      depart: { distance: 0.06 },
    },
    { pinch: 0, duration: 0.25 },
  ]);
  await expectTitle(/^Heat the pan/);
}

async function heatPan(next = /^Pour/) {
  await hand('hand-right', [
    { target: 'Pan', approach: { distance: 0.06 }, orientation: LEVEL, pinch: { value: 1, at: 'arrival' } },
    // The pan hangs from its handle, so the hand stops where the handle goes.
    { anchor: 'grasp', position: { x: STOVE.x, y: 0.97, z: STOVE.z + 0.175 }, orientation: LEVEL },
    { pinch: 0, duration: 0.25 },
  ]);
  log('      pan on the stove');
  await hand('hand-right', [
    { target: 'Butter', approach: { distance: 0.06 }, pinch: { value: 1, at: 'arrival' } },
    { position: { x: STOVE.x, y: 1.0, z: STOVE.z }, depart: { distance: 0.06 } },
    { pinch: 0, duration: 0.25 },
  ]);
  await expectTitle(next);
  await sleep(1500);
  await hand('hand-right', [
    { anchor: 'grip', position: { x: 0.45, y: 1.12, z: -0.2 } },
  ]);
}

async function pourEggs(next = /^Cook: Raw/) {
  await hand('hand-left', [
    { target: 'Bowl', approach: { distance: 0.06 }, pinch: { value: 1, at: 'arrival' } },
    { position: { x: 0.2, y: 1.02, z: -0.33 }, depart: { distance: 0.05 } },
  ]);
  await hand('hand-left', [
    {
      anchor: 'grip',
      position: { x: 0.2, y: 1.04, z: -0.33 },
      orientation: { pitch: 0, yaw: 0, roll: -85 },
      duration: 0.8,
    },
  ]);
  if (!(await waitForTitle(next, 4000))) {
    throw new Error('Pouring did not finish');
  }
  await expectTitle(next);
  await hand('hand-left', [
    { pinch: 0, duration: 0.2 },
    {
      anchor: 'grip',
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      position: { x: -0.3, y: 1.1, z: -0.2 },
    },
  ]);
}

async function grabPanOffStove() {
  await hand('hand-right', [
    {
      anchor: 'grasp',
      position: { x: STOVE.x, y: 0.948, z: STOVE.z + 0.175 },
      orientation: LEVEL,
      pinch: { value: 1, at: 'arrival' },
    },
    { anchor: 'grip', position: PAN_LIFTED, orientation: LEVEL },
  ]);
}

/** Points the right hand at the Pause Modal Resume button and pinches. */
async function pressPauseResume() {
  const found = await runCli([
    'ecs',
    'find',
    '--input-json',
    JSON.stringify({ namePattern: '^Pause Modal$' }),
  ]);
  const modalEntity = found.entities[0].entityIndex;
  const { targets } = await xr('list-targets', {});
  const button = targets.find((target) => target.name === 'pause-resume');
  const from = { x: 0.2, y: 1.2, z: -0.25 };
  for (const nudge of [0, 0.015, -0.015, 0.03, -0.03]) {
    const target = {
      x: button.position.x + nudge,
      y: button.position.y,
      z: button.position.z,
    };
    await xr('animate-to', {
      device: 'hand-right',
      position: from,
      orientation: aim(from, target),
      duration: 0.7,
    });
    await sleep(350);
    const state = JSON.stringify(
      await runCli([
        'ui',
        'inspect',
        '--input-json',
        JSON.stringify({ entityIndex: modalEntity, selector: '#pause-resume' }),
      ]),
    );
    if (state.includes('"hovered":true')) {
      await sleep(400);
      await xr('select', { device: 'hand-right', duration: 0.3 });
      await sleep(500);
      return;
    }
  }
  throw new Error('The hand ray never reached the pause resume button');
}

/** Turns the free left hand palm up until the ring fills, then resumes. */
async function pauseAndResume(resumedTitle) {
  await lookAt({ x: -0.05, y: 1.0, z: -0.5 });
  await hand('hand-left', [
    {
      anchor: 'grip',
      position: { x: -0.12, y: 1.12, z: -0.3 },
      orientation: { pitch: 0, yaw: 0, roll: 180 },
      duration: 0.6,
    },
  ]);
  await expectTitle(/^Paused$/);
  await sleep(1500);
  await hand('hand-left', [
    {
      anchor: 'grip',
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      position: { x: -0.3, y: 1.1, z: -0.2 },
      duration: 0.6,
    },
  ]);
  await pressPauseResume();
  await expectTitle(resumedTitle);
}

async function cookFirstSide(next = /^Flip/) {
  await lookAt({ x: STOVE.x, y: 0.92, z: STOVE.z });
  if (!(await waitForTitle(/Cook: Ready/, 20000))) {
    throw new Error('The omelette never got ready to flip');
  }
  await expectTitle(/^Cook: Ready/);
  await sleep(1000);
  await saveShot('cook-ready');
  await grabPanOffStove();
  await expectTitle(next);
  await saveShot('hold-pan');
}

async function flipOmelette(next = /^Finish/) {
  const position = PAN_LIFTED;
  await sleep(500);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await hand('hand-right', [
      {
        anchor: 'grip',
        position,
        orientation: { pitch: -14, yaw: 0, roll: 0 },
        duration: 0.5,
      },
      {
        anchor: 'grip',
        position,
        orientation: { pitch: 26, yaw: 0, roll: 0 },
        duration: 0.16,
      },
      { anchor: 'grip', position, orientation: LEVEL, duration: 0.6 },
    ]);
    if (await waitForTitle(next, 2500)) {
      break;
    }
  }
  await expectTitle(next);
}

async function finishOmelette() {
  await hand('hand-right', [
    {
      anchor: 'grasp',
      position: { x: STOVE.x, y: 0.97, z: STOVE.z + 0.175 },
      orientation: LEVEL,
    },
    { pinch: 0, duration: 0.25 },
  ]);
  await finishAndServe();
}

/**
 * Waits for Golden with the pan on the stove, then lifts it and serves.
 * `extraMs` is the time left on the heat after Golden, aiming for doneness 0.7.
 */
async function finishAndServe(extraMs = GOLDEN_EXTRA_MS) {
  if (!(await waitForTitle(/Golden/, 25000))) {
    throw new Error('The omelette never turned golden');
  }
  await expectTitle(/^Finish: Golden/);
  await sleep(extraMs);
  await grabPanOffStove();
  await expectTitle(/^Serve/);
  await sleep(500);
  await hand('hand-right', [
    { anchor: 'grip', position: { x: PLATE.x + 0.02, y: 1.05, z: PLATE.z + 0.175 } },
  ]);
  await expectTitle(/^Score: \d+$/);
  await hand('hand-right', [{ pinch: 0, duration: 0.25 }]);
}

/** Stirs the pan with the spatula until the card moves on to `next`. */
async function stirPan(next) {
  // The pan sits on the right, so the right hand stirs, as a seated cook would.
  await hand('hand-right', [
    { target: 'Spatula', approach: { distance: 0.06 }, pinch: { value: 1, at: 'arrival' } },
    { anchor: 'grasp', position: { x: STOVE.x - 0.07, y: 1.1, z: STOVE.z } },
  ]);
  await saveShot('hold-spatula');
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await runCli(['browser', 'run', 'scripts/demo-stir-pan.mjs']);
    if (await waitForTitle(next, 400)) {
      break;
    }
  }
  await expectTitle(next);
  await hand('hand-right', [
    { pinch: 0, duration: 0.2 },
    { anchor: 'grip', position: { x: 0.45, y: 1.12, z: -0.2 } },
  ]);
}

/** Lets go of `target` over the pan, then expects the card to show `next`. */
async function dropIntoPan(device, target, next) {
  await hand(device, [
    { target, approach: { distance: 0.06 }, pinch: { value: 1, at: 'arrival' } },
    { position: { x: STOVE.x + 0.03, y: 1.05, z: STOVE.z }, depart: { distance: 0.06 } },
    { pinch: 0, duration: 0.25 },
  ]);
  await expectTitle(next);
}

async function cookNasiGoreng() {
  log('Title');
  await sleep(1500);
  await turnBookPage();
  await expectTitle(/^Nasi Goreng$/);
  await sleep(800);
  await pressCardButton();
  await expectTitle(/^Ingredients$/);

  await placeIngredient('hand-right', 'Sweet Soy', 0.1, -0.415);
  await placeIngredient('hand-left', 'Egg', -0.1, -0.415);
  await placeIngredient('hand-left', 'Rice', -0.1, -0.245);
  await placeIngredient('hand-right', 'Green Onion', 0.1, -0.245);
  await expectTitle(/^Heat the pan$/);
  await sleep(800);

  await hand('hand-right', [
    { target: 'Pan', approach: { distance: 0.06 }, orientation: LEVEL, pinch: { value: 1, at: 'arrival' } },
    // The pan hangs from its handle, so the hand stops where the handle goes.
    { anchor: 'grasp', position: { x: STOVE.x, y: 0.97, z: STOVE.z + 0.175 }, orientation: LEVEL },
    { pinch: 0, duration: 0.25 },
    { anchor: 'grip', position: { x: 0.45, y: 1.12, z: -0.2 } },
  ]);
  await expectTitle(/^Crack the egg$/);
  await lookAt({ x: STOVE.x - 0.1, y: 0.95, z: STOVE.z });

  const y = 1.03;
  await hand('hand-left', [
    { target: 'Egg', approach: { distance: 0.06 }, pinch: { value: 1, at: 'arrival' } },
    { position: { x: STOVE.x, y, z: STOVE.z }, depart: { distance: 0.06 } },
  ]);
  await hand('hand-right', [
    { anchor: 'grasp', position: { x: STOVE.x + 0.06, y: y + 0.02, z: STOVE.z } },
    { pinch: 1, duration: 0.25 },
  ]);
  await sleep(500);
  const leftAt = await xr('get-transform', { device: 'hand-left' });
  const rightAt = await xr('get-transform', { device: 'hand-right' });
  await Promise.all([
    xr('animate-to', {
      device: 'hand-left',
      position: { ...leftAt.position, x: leftAt.position.x - 0.06 },
      duration: 0.7,
    }),
    xr('animate-to', {
      device: 'hand-right',
      position: { ...rightAt.position, x: rightAt.position.x + 0.06 },
      duration: 0.7,
    }),
  ]);
  await expectTitle(/^Scramble/);
  await Promise.all([
    hand('hand-left', [{ pinch: 0, duration: 0.2 }]),
    hand('hand-right', [
      { pinch: 0, duration: 0.2 },
      { anchor: 'grip', position: { x: 0.45, y: 1.12, z: -0.2 } },
    ]),
  ]);
  await sleep(600);

  await stirPan(/^Add the rice$/);
  await sleep(600);
  await dropIntoPan('hand-right', 'Rice', /^Season/);
  await sleep(600);

  const position = { x: STOVE.x + 0.11, y: 1.1, z: STOVE.z };
  const tipped = { pitch: 0, yaw: 0, roll: 105 };
  const move = (orientation) => ({ anchor: 'grip', position, orientation, duration: 0.4 });
  await hand('hand-right', [
    { target: 'Sweet Soy', approach: { distance: 0.06 }, orientation: LEVEL, pinch: { value: 1, at: 'arrival' } },
    { anchor: 'grip', position, orientation: LEVEL },
    move(tipped),
    move(LEVEL),
    move(tipped),
    move(LEVEL),
  ]);
  await expectTitle(/^Season: 2$/);
  await hand('hand-right', [
    { pinch: 0, duration: 0.2 },
    { anchor: 'grip', position: { x: 0.45, y: 1.12, z: -0.2 } },
  ]);
  await sleep(600);
  await pressCardButton();
  await expectTitle(/^Stir-fry/);
  await lookAt({ x: STOVE.x - 0.1, y: 0.95, z: STOVE.z });

  await stirPan(/^Green onion/);
  await sleep(600);
  await dropIntoPan('hand-right', 'Green Onion', /^Finish/);

  await hand('hand-right', [
    {
      anchor: 'grasp',
      position: { x: STOVE.x, y: 0.97, z: STOVE.z + 0.175 },
      orientation: LEVEL,
    },
  ]);
  if (!(await waitForTitle(/Golden/, 30000))) {
    throw new Error('The rice never turned golden');
  }
  // The rice is often golden already while the onion goes in, so lift at once.
  await expectTitle(/^Finish: Golden/);
  await grabPanOffStove();
  await expectTitle(/^Serve/);
  await sleep(500);
  await hand('hand-right', [
    { anchor: 'grip', position: { x: PLATE.x + 0.02, y: 1.05, z: PLATE.z + 0.175 } },
  ]);
  await expectTitle(/^Score: \d+$/);
  await hand('hand-right', [{ pinch: 0, duration: 0.25 }]);
  await lookAt({ x: PLATE.x, y: 0.9, z: PLATE.z }, 1.2);
  await sleep(4000);
}

async function cookPancake() {
  log('Title');
  await sleep(1500);
  await turnBookPage();
  await expectTitle(/^Nasi Goreng$/);
  await turnBookPage();
  await expectTitle(/^Pancake$/);
  await sleep(800);
  await pressCardButton();
  await expectTitle(/^Ingredients$/);

  await placeIngredient('hand-right', 'Maple Syrup', 0.1, -0.415);
  await placeIngredient('hand-left', 'Egg', -0.1, -0.415);
  await placeIngredient('hand-left', 'Flour', -0.1, -0.245);
  await placeIngredient('hand-left', 'Butter', 0.1, -0.245);
  await expectTitle(/^Add the flour$/);
  await sleep(1000);

  await hand('hand-left', [
    { target: 'Flour', approach: { distance: 0.06 }, pinch: { value: 1, at: 'arrival' } },
    { position: { x: BOWL.x, y: 1.03, z: BOWL.z }, depart: { distance: 0.06 } },
    { pinch: 0, duration: 0.25 },
  ]);
  await expectTitle(/^Crack the egg$/);
  await sleep(800);

  await crackEgg(/^Mix batter/);
  await sleep(800);
  await whiskEggs(/^Butter the pan$/);
  await sleep(800);
  await heatPan(/^Pour batter$/);
  await pourEggs(/^Spread batter/);
  await sleep(600);
  await stirPan(/^Cook/);
  await cookFirstSide(/^Toss & flip/);
  await flipOmelette(/^Drizzle syrup/);
  // The step takes the pan out of the hand and slides it back to the stove.
  await hand('hand-right', [
    { pinch: 0, duration: 0.2 },
    { anchor: 'grip', position: { x: 0.45, y: 1.12, z: -0.2 } },
  ]);
  await sleep(1200);

  const position = { x: STOVE.x + 0.11, y: 1.1, z: STOVE.z };
  const tipped = { pitch: 0, yaw: 0, roll: 105 };
  const move = (orientation) => ({ anchor: 'grip', position, orientation, duration: 0.4 });
  await hand('hand-right', [
    { target: 'Maple Syrup', approach: { distance: 0.06 }, orientation: LEVEL, pinch: { value: 1, at: 'arrival' } },
    { anchor: 'grip', position, orientation: LEVEL },
    move(tipped),
    move(LEVEL),
    move(tipped),
    move(LEVEL),
  ]);
  await expectTitle(/^Drizzle syrup: 2$/);
  await hand('hand-right', [
    { pinch: 0, duration: 0.2 },
    { anchor: 'grip', position: { x: 0.45, y: 1.12, z: -0.2 } },
  ]);
  await sleep(600);
  await pressCardButton();
  await expectTitle(/^Finish/);
  await lookAt({ x: STOVE.x, y: 0.92, z: STOVE.z });
  // The pancake browns faster than the omelette, so lift it at once.
  await finishAndServe(0);

  await lookAt({ x: PLATE.x, y: 0.9, z: PLATE.z }, 1.2);
  await sleep(4000);
}

/**
 * The bundled browser downloads very slowly on some connections, so an
 * installed Chrome stands in for it when the bundled one is missing.
 */
function useSystemChromeIfNeeded() {
  const require = createRequire(join(ROOT, 'package.json'));
  const bundled = require('playwright-core').chromium.executablePath();
  if (existsSync(bundled) || !existsSync(SYSTEM_CHROME)) {
    return;
  }
  const folder = bundled.split(/[\\/]/).find((part) => /^chromium-\d+$/.test(part));
  const browsers = join(ROOT, '.demo-browser');
  const link = join(browsers, folder, 'chrome-win64');
  env.PLAYWRIGHT_BROWSERS_PATH = browsers;
  if (!existsSync(link)) {
    mkdirSync(join(browsers, folder), { recursive: true });
    execFileSync('cmd', ['/c', 'mklink', '/J', link, SYSTEM_CHROME]);
    writeFileSync(join(browsers, folder, 'INSTALLATION_COMPLETE'), '');
  }
  log('Using the installed Chrome.');
}

async function prepareStage() {
  useSystemChromeIfNeeded();
  log('Starting a fresh session...');
  await runCli(
    ['dev', 'restart', '--allow-browser-automation', '--headed', '--open', '--timeout', '90000'],
    120000,
  );
  await runCli(['runtime', 'wait'], 90000);
  await runCli(['browser', 'run', 'scripts/demo-fresh-start.mjs']);
  await sleep(2000);
  await runCli(['runtime', 'wait'], 90000);
  if (IS_DEBUG) {
    await runCli(['browser', 'run', 'scripts/demo-debug-view.mjs']);
    await sleep(2000);
    await runCli(['runtime', 'wait'], 90000);
  }
  await runCli(['browser', 'run', 'scripts/demo-clean-view.mjs']);
  const status = await xr('status', {});
  if (!status.sessionActive) {
    await xr('enter', {});
  }
  // The game calibrates from the head height on entry, so the hand positions
  // below are true room positions only when the head starts at HEAD. The
  // emulator keeps the head pose across sessions, so set it and enter again.
  await xr('animate-to', { device: 'headset', position: HEAD, duration: 0.1 });
  await xr('exit', {});
  await xr('enter', {});
  await xr('set-input-mode', { mode: 'hand' });
  const found = await runCli([
    'ecs',
    'find',
    '--input-json',
    JSON.stringify({ namePattern: '^Recipe Card$' }),
  ]);
  cardEntity = found.entities[0].entityIndex;
  await xr('animate-to', {
    device: 'hand-left',
    position: { x: -0.3, y: 1.1, z: -0.2 },
    duration: 0.1,
  });
  await lookAt({ x: 0, y: 0.92, z: -0.5 }, 0.1);
}

async function cook() {
  log('Title');
  await sleep(2000);
  await pressCardButton();
  await expectTitle(/^Ingredients$/);

  await placeIngredient('hand-right', 'Salt', 0.1, -0.415);
  await placeIngredient('hand-left', 'Egg', -0.1, -0.415);
  await placeIngredient('hand-left', 'Butter', -0.1, -0.245);
  await placeIngredient('hand-right', 'Green Onion', 0.1, -0.245);
  await expectTitle(/^Crack the egg$/);
  await sleep(1200);

  await crackEgg();
  await sleep(800);
  await whiskEggs();
  await sleep(800);
  await seasonEggs();
  await sleep(800);
  await addGreenOnion();
  await sleep(800);
  await pauseAndResume(/^Heat the pan$/);
  await heatPan();
  await pourEggs();
  await cookFirstSide();
  await flipOmelette();
  await finishOmelette();

  await lookAt({ x: PLATE.x, y: 0.9, z: PLATE.z }, 1.2);
  await sleep(4000);
}

/** Saves a picture of the view, when DEMO_SHOTS names a folder. */
async function saveShot(name) {
  if (SHOTS_DIR == null) {
    return;
  }
  mkdirSync(SHOTS_DIR, { recursive: true });
  const file = join(SHOTS_DIR, `${name}.png`);
  await runCli(['browser', 'screenshot', '--output-file', file]);
  log(`      saved ${file}`);
}

/** Again must clear the table and start a second cook from the beginning. */
async function cookAgain() {
  await saveShot('result-plate');
  await lookAt({ x: 0, y: 1.0, z: -0.6 }, 0.6);
  await sleep(900);
  await saveShot('result-card');
  await pressCardButton();
  await expectTitle(/^Ingredients$/);
}

async function main() {
  await prepareStage();
  const cookingFrom = Date.now();
  console.log('\nStart your screen recorder now.');
  for (let seconds = COUNTDOWN_S; seconds > 0; seconds -= 1) {
    console.log(`  ${seconds}...`);
    await sleep(1000);
  }
  if (IS_PANCAKE) {
    await cookPancake();
  } else {
    await (IS_NASI_GORENG ? cookNasiGoreng() : cook());
  }
  const seconds = Math.round((Date.now() - cookingFrom) / 1000) - COUNTDOWN_S;
  await cookAgain();

  const logs = await runCli([
    'browser',
    'logs',
    '--input-json',
    JSON.stringify({ count: 100, level: 'error', since: cookingFrom }),
  ]);
  const errors = logEntries(logs).filter(
    (entry) => entry.level === 'error' && !entry.message.includes('net::ERR'),
  );
  if (errors.length > 0) {
    throw new Error(`Console errors: ${errors[0].message.slice(0, 200)}`);
  }
  console.log(`\nPASS: ${passed} checks, no console errors, ${seconds} s of video.`);
  if (seconds > VIDEO_LIMIT_S) {
    console.log(`Note: longer than the ${VIDEO_LIMIT_S} s video limit.`);
  }
  if (IS_DEBUG) {
    await reportPerformance(cookingFrom);
  }
}

/** Worst numbers the debug overlay logged while cooking. */
async function reportPerformance(since) {
  const logs = await runCli([
    'browser',
    'logs',
    '--input-json',
    JSON.stringify({ count: 200, pattern: '^\\[debug\\]', since }),
  ]);
  const samples = logEntries(logs)
    .map((entry) => Object.fromEntries(
      [...entry.message.matchAll(/(\w+)=(\d+)/g)].map(([, key, value]) => [key, Number(value)]),
    ))
    .filter((sample) => sample.calls != null);
  if (samples.length === 0) {
    console.log('No debug samples were logged.');
    return;
  }
  const most = (key) => Math.max(...samples.map((sample) => sample[key]));
  const least = (key) => Math.min(...samples.map((sample) => sample[key]));
  console.log(
    `Performance over ${samples.length} samples (emulator GPU, not a Quest):
` +
      `  fps min ${least('fps')}, worst frame ${most('worstMs')} ms
` +
      `  draw calls max ${most('calls')} (budget < 100)
` +
      `  scene triangles max ${most('sceneTris')} (budget < 100000)
` +
      `  drawn triangles max ${most('drawnTris')}`,
  );
}

main().catch((error) => {
  console.error(`\nFAIL: ${error.message}`);
  process.exitCode = 1;
});
