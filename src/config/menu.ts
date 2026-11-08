/** Pages the title card can show besides the recipe itself. */
export type TitlePage = 'main' | 'how-to-play' | 'settings' | 'credits';

export interface TitlePageText {
  title: string;
  /** Two lines of 26-unit text at most, about 66 characters. */
  instruction: string;
  /** Two lines of 24-unit text at most, about 70 characters. */
  tip: string;
}

export const TITLE_PAGES: Readonly<
  Record<Exclude<TitlePage, 'main' | 'how-to-play'>, TitlePageText>
> = {
  settings: {
    title: 'Settings',
    instruction:
      'Change the sound, or recenter if the table feels too high or low.',
    tip: '',
  },
  credits: {
    title: 'Credits',
    instruction:
      'Made by a solo developer. Every model and sound is made in code.',
    tip: 'Thank you for playing!',
  },
};

/**
 * How to Play is a short hands-on practice. Each stage moves on by itself
 * once the player does it: grab, let go, then hold a palm up.
 */
export const PRACTICE_STAGES: readonly TitlePageText[] = [
  {
    title: 'Practice 1/3',
    instruction: 'Pinch the egg and lift it off the table.',
    tip: 'To pinch, touch your thumb to your index finger.',
  },
  {
    title: 'Practice 2/3',
    instruction: 'Open your fingers to let it go. It glides back home.',
    tip: 'Later, a ring on the table shows where things go.',
  },
  {
    title: 'Practice 3/3',
    instruction: 'Turn a hand palm up and hold it until the ring fills.',
    tip: 'That pauses the game whenever you need a break.',
  },
  {
    title: "You're ready!",
    instruction: 'Point at a button and pinch to press it, like Back here.',
    tip: '',
  },
];

/** The stage where the palm-up ring is practiced. */
export const PALM_PRACTICE_STAGE = 2;

export const BACK_LABEL = 'Back';
