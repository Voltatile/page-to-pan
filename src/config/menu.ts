/** Pages the title card can show besides the recipe itself. */
export type TitlePage = 'main' | 'how-to-play' | 'credits';

interface TitlePageText {
  title: string;
  /** Two lines of 26-unit text at most, about 66 characters. */
  instruction: string;
  /** Two lines of 24-unit text at most, about 70 characters. */
  tip: string;
}

export const TITLE_PAGES: Readonly<
  Record<Exclude<TitlePage, 'main'>, TitlePageText>
> = {
  'how-to-play': {
    title: 'How to Play',
    instruction:
      'Pinch to pick things up. Point at a button and pinch to press it.',
    tip: 'A ring shows where things go. Hold a palm up to pause.',
  },
  credits: {
    title: 'Credits',
    instruction: 'Made by a solo developer. Every model and sound is made in code.',
    tip: 'Thank you for playing!',
  },
};

export const BACK_LABEL = 'Back';
