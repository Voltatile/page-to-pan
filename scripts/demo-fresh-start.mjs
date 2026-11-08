/**
 * Forgets the best result and reloads the app, so every demo run starts like a
 * first visit and ends with the "New best!" ribbon. Runs through
 * `iwsdk browser run`.
 */
export default async function run({ frame }) {
  await frame.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('page-to-pan.')) {
        window.localStorage.removeItem(key);
      }
    }
    window.location.reload();
  });
  return { cleared: true };
}
