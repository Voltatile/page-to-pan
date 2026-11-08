import { VisibilityState, type World } from '@iwsdk/core';

const READY_LABEL = 'Enter VR';
const UNSUPPORTED_LABEL = 'VR not available here';
const UNSUPPORTED_NOTE =
  "Open this page in your VR headset's browser to play.";
const FAILED_NOTE = 'Could not start VR. Please try again.';

/**
 * The 2D page a visitor sees before entering VR. It shows while no immersive
 * session runs, and hides itself as soon as one starts.
 */
export function setupLanding(world: World): void {
  const landing = document.getElementById('landing');
  const button = document.getElementById('enter-vr');
  const note = document.getElementById('landing-note');
  if (
    landing == null ||
    !(button instanceof HTMLButtonElement) ||
    note == null
  ) {
    return;
  }

  const showFor = (state: VisibilityState) => {
    landing.hidden = state !== VisibilityState.NonImmersive;
  };
  world.visibilityState.subscribe(showFor);
  showFor(world.visibilityState.peek());

  button.addEventListener('click', () => {
    note.textContent = '';
    try {
      world.launchXR();
    } catch (error) {
      console.error('Could not start VR', error);
      note.textContent = FAILED_NOTE;
    }
  });

  void checkSupport().then((isSupported) => {
    button.disabled = !isSupported;
    button.textContent = isSupported ? READY_LABEL : UNSUPPORTED_LABEL;
    note.textContent = isSupported ? '' : UNSUPPORTED_NOTE;
  });
}

async function checkSupport(): Promise<boolean> {
  try {
    return (await navigator.xr?.isSessionSupported('immersive-vr')) ?? false;
  } catch {
    return false;
  }
}
