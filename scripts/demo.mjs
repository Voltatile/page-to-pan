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
 */
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'node_modules/@iwsdk/cli/bin/iwsdk.js');
const SYSTEM_CHROME = 'C:\\Program Files\\Google\\Chrome\\Application';
const COUNTDOWN_S = 5;
const VIDEO_LIMIT_S = 180;
const HEAD = { x: 0, y: 1.6, z: 0 };
/** Time on the heat after the card first says Golden, aiming for doneness 0.7. */
const GOLDEN_EXTRA_MS = 1500;
const BOWL = { x: -0.31, z: -0.36 };
const STOVE = { x: 0.33, z: -0.35 };
const PLATE = { x: 0, z: -0.31 };
const LEVEL = { pitch: 0, yaw: 0, roll: 0 };

const env = { ...process.env };
const startedAt = Date.now();
let cardEntity = 0;
let passed = 0;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function log(message) {
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(0).padStart(3);
  console.log(`[${seconds}s] ${message}`);
}

function runCli(args, timeoutMs = 60000) {
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

async function crackEgg() {
  const y = 0.97;
  const z = -0.415;
  await hand('hand-left', [
    { anchor: 'grip', position: { x: -0.16, y, z } },
    { pinch: 1, duration: 0.25 },
  ]);
  await hand('hand-right', [
    { anchor: 'grip', position: { x: -0.04, y, z } },
    { pinch: 1, duration: 0.25 },
  ]);
  await sleep(500);
  await Promise.all([
    xr('animate-to', {
      device: 'hand-left',
      position: { x: -0.24, y, z },
      duration: 0.7,
    }),
    xr('animate-to', {
      device: 'hand-right',
      position: { x: 0.04, y, z },
      duration: 0.7,
    }),
  ]);
  await expectTitle(/^Whisk/);
  await Promise.all([
    hand('hand-left', [{ pinch: 0, duration: 0.2 }]),
    hand('hand-right', [{ pinch: 0, duration: 0.2 }]),
  ]);
}

async function whiskEggs() {
  await hand('hand-left', [
    { target: 'Whisk', approach: { distance: 0.06 }, pinch: { value: 1, at: 'arrival' } },
    { anchor: 'grasp', position: { x: BOWL.x + 0.05, y: 1.0, z: BOWL.z } },
  ]);
  const pointsPerTurn = 16;
  const circle = (turns) =>
    Array.from({ length: Math.round(turns * pointsPerTurn) }, (_, index) => {
      const angle = ((index + 1) * Math.PI * 2) / pointsPerTurn;
      return {
        anchor: 'grasp',
        position: {
          x: BOWL.x + Math.cos(angle) * 0.05,
          y: 1.0,
          z: BOWL.z + Math.sin(angle) * 0.05,
        },
        duration: 0.09,
      };
    });
  await hand('hand-left', circle(3.2));
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await waitForTitle(/^Season/, 400)) {
      break;
    }
    await hand('hand-left', circle(0.5));
  }
  await expectTitle(/^Season/);
  await hand('hand-left', [{ pinch: 0, duration: 0.2 }]);
}

async function seasonEggs() {
  await hand('hand-left', [
    { anchor: 'grasp', position: { x: BOWL.x, y: 1.03, z: BOWL.z } },
    { pinch: 1, duration: 0.2 },
    { pinch: 0, duration: 0.3 },
    { pinch: 1, duration: 0.2 },
    { pinch: 0, duration: 0.3 },
  ]);
  await expectTitle(/^Season: 2$/);
  await sleep(600);
  await pressCardButton();
  await expectTitle(/^Heat and pour/);
}

async function pourEggs() {
  await hand('hand-right', [
    { target: 'Pan', approach: { distance: 0.06 }, pinch: { value: 1, at: 'arrival' } },
    { position: { x: STOVE.x, y: 0.96, z: STOVE.z }, depart: { distance: 0.06 } },
    { pinch: 0, duration: 0.25 },
  ]);
  log('      pan on the stove');
  await hand('hand-right', [
    { anchor: 'grip', position: { x: 0.45, y: 1.12, z: -0.2 } },
  ]);
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
  if (!(await waitForTitle(/^Cook/, 4000))) {
    throw new Error('Pouring did not finish');
  }
  await expectTitle(/^Cook: Raw/);
  await hand('hand-left', [
    { pinch: 0, duration: 0.2 },
    {
      anchor: 'grip',
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      position: { x: -0.3, y: 1.1, z: -0.2 },
    },
  ]);
}

async function cookOmelette() {
  await lookAt({ x: STOVE.x, y: 0.92, z: STOVE.z });
  if (!(await waitForTitle(/Golden/, 25000))) {
    throw new Error('The omelette never turned golden');
  }
  await expectTitle(/^Cook: Golden/);
  await sleep(GOLDEN_EXTRA_MS);
  await hand('hand-right', [
    {
      anchor: 'grasp',
      position: { x: STOVE.x, y: 0.935, z: STOVE.z + 0.175 },
      orientation: LEVEL,
      pinch: { value: 1, at: 'arrival' },
    },
    { anchor: 'grip', position: { x: 0.3, y: 1.04, z: -0.2 } },
  ]);
  await expectTitle(/^Flip and plate: Golden/);
}

async function flipAndPlate() {
  const position = { x: 0.3, y: 1.04, z: -0.2 };
  await hand('hand-right', [
    { anchor: 'grip', position, orientation: LEVEL, duration: 0.5 },
  ]);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await hand('hand-right', [
      {
        anchor: 'grip',
        position,
        orientation: { pitch: 60, yaw: 0, roll: 0 },
        duration: 0.1,
      },
      {
        anchor: 'grip',
        position,
        orientation: { pitch: -30, yaw: 0, roll: 0 },
        duration: 0.1,
      },
      { anchor: 'grip', position, orientation: LEVEL, duration: 0.25 },
    ]);
    if (await waitForTitle(/Flipped/, 500)) {
      break;
    }
  }
  await expectTitle(/^Flip and plate: Flipped/);
  await sleep(700);
  await hand('hand-right', [
    { anchor: 'grip', position: { x: PLATE.x + 0.02, y: 1.05, z: PLATE.z + 0.175 } },
  ]);
  await expectTitle(/^Omelette$/);
  await hand('hand-right', [{ pinch: 0, duration: 0.25 }]);
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
  await runCli(['browser', 'run', 'scripts/demo-clean-view.mjs']);
  const status = await xr('status', {});
  if (!status.sessionActive) {
    await xr('enter', {});
  }
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
  await pourEggs();
  await cookOmelette();
  await flipAndPlate();

  await lookAt({ x: PLATE.x, y: 0.9, z: PLATE.z }, 1.2);
  await sleep(4000);
}

async function main() {
  await prepareStage();
  const cookingFrom = Date.now();
  console.log('\nStart your screen recorder now.');
  for (let seconds = COUNTDOWN_S; seconds > 0; seconds -= 1) {
    console.log(`  ${seconds}...`);
    await sleep(1000);
  }
  await cook();

  const logs = await runCli([
    'browser',
    'logs',
    '--input-json',
    JSON.stringify({ count: 100, level: 'error', since: cookingFrom }),
  ]);
  const errors = (logs.logs ?? []).filter(
    (entry) => entry.level === 'error' && !entry.message.includes('net::ERR'),
  );
  if (errors.length > 0) {
    throw new Error(`Console errors: ${errors[0].message.slice(0, 200)}`);
  }
  const seconds = Math.round((Date.now() - cookingFrom) / 1000) - COUNTDOWN_S;
  console.log(`\nPASS: ${passed} checks, no console errors, ${seconds} s of video.`);
  if (seconds > VIDEO_LIMIT_S) {
    console.log(`Note: longer than the ${VIDEO_LIMIT_S} s video limit.`);
  }
}

main().catch((error) => {
  console.error(`\nFAIL: ${error.message}`);
  process.exitCode = 1;
});
