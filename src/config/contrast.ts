/**
 * Colors of the text panels in the normal look and in high contrast, where
 * light text sits on black. The normal values match the UIKitML styles.
 */
export interface PanelColors {
  background: string;
  border: string;
  heading: string;
  body: string;
  accent: string;
}

export const NORMAL_COLORS: PanelColors = {
  background: '#f6f0e2',
  border: '#d8ceb8',
  heading: '#1c1d20',
  body: '#3a3b40',
  accent: '#8a5a14',
};

export const HIGH_CONTRAST_COLORS: PanelColors = {
  background: '#000000',
  border: '#ffffff',
  heading: '#ffffff',
  body: '#ffffff',
  accent: '#ffd54a',
};

export const panelColors = (isHigh: boolean): PanelColors =>
  isHigh ? HIGH_CONTRAST_COLORS : NORMAL_COLORS;

/** The minimum a UIKit element needs to be recolored. */
interface Paintable {
  setProperties(properties: Record<string, unknown>): void;
}

/**
 * Sets one color property, also under `dark`: the app runs the dark color
 * scheme, and a style's `:dark` color would otherwise win over it.
 */
export function paint(element: Paintable, property: string, color: string): void {
  element.setProperties({ [property]: color, dark: { [property]: color } });
}
