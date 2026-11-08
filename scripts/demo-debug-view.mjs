/**
 * Reloads the app with ?debug=1, so the performance overlay shows and its
 * numbers reach the console. Runs through `iwsdk browser run`.
 */
export default async function run({ frame }) {
  const url = await frame.evaluate(() => {
    const next = new URL(window.location.href);
    next.searchParams.set('debug', '1');
    window.location.href = next.toString();
    return next.toString();
  });
  return { url };
}
