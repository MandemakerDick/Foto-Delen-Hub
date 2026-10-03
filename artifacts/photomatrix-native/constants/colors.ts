/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#0a0a0a',
    tint: '#ff9f43',

    // Core surfaces
    background: '#0b0b0c',
    foreground: '#e7e3dc',

    // Cards / elevated surfaces
    card: '#111113',
    cardForeground: '#e7e3dc',

    // Primary action color (buttons, links, active states)
    primary: '#ff9f43',
    primaryForeground: '#201308',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#1b1b1e',
    secondaryForeground: '#e7e3dc',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#19191b',
    mutedForeground: '#96908a',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#242225',
    accentForeground: '#e7e3dc',

    // Destructive actions (delete, error states)
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#28272a',
    input: '#28272a',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
