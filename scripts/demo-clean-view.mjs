/**
 * Prepares the managed browser for recording: a 1920 x 1080 view with the
 * emulator toolbars, gizmos, floor ring, and status badge hidden. Runs through
 * `iwsdk browser run`, which needs --allow-browser-automation. A page reload
 * brings everything back.
 */
const HIDE_INTERVAL_MS = 250;
const APP_CANVAS_Z_INDEX = '2';

export default async function run({ page, frame }) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addStyleTag({
    content:
      '.workspace-view-switcher, body > div:not(#root) { display: none !important; }',
  });
  await frame.evaluate(
    ({ intervalMs, appCanvasZIndex }) => {
      const hideOverlays = () => {
        for (const element of document.querySelectorAll('body > div')) {
          if (element.id === 'scene-container') {
            continue;
          }
          const canvas = [...element.children].find(
            (child) =>
              child.tagName === 'CANVAS' &&
              getComputedStyle(child).zIndex === appCanvasZIndex,
          );
          if (canvas == null) {
            element.style.display = 'none';
            continue;
          }
          for (const child of element.children) {
            if (child !== canvas) {
              child.style.display = 'none';
            }
          }
        }
      };
      setInterval(hideOverlays, intervalMs);
      hideOverlays();
    },
    { intervalMs: HIDE_INTERVAL_MS, appCanvasZIndex: APP_CANVAS_Z_INDEX },
  );
  return { viewport: '1920x1080' };
}
