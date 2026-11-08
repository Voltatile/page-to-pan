/**
 * Reloads the app with ?recipe=nasi-goreng, keeping any other query such as
 * ?debug=1. Runs through `iwsdk browser run`.
 */
export default async function run({ frame }) {
  const url = await frame.evaluate(() => {
    const next = new URL(window.location.href);
    next.searchParams.set('recipe', 'nasi-goreng');
    window.location.href = next.toString();
    return next.toString();
  });
  return { url };
}
