const OSC_SEQUENCE = /\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g;
const CSI_SEQUENCE = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const ESCAPE_SEQUENCE = /\u001B./g;

/**
 * Convert Herdr's ANSI pane output to safe plain text for React Native.
 *
 * SGR/OSC/cursor controls are removed, and carriage-return redraws keep only the final frame on
 * each line. Styling can be layered on later without ever leaking terminal control bytes into the
 * visible transcript.
 */
export function plainTerminalText(input: string): string {
  const withoutControls = input
    .replace(OSC_SEQUENCE, "")
    .replace(CSI_SEQUENCE, "")
    .replace(ESCAPE_SEQUENCE, "")
    .replace(/\r\n/g, "\n");

  return withoutControls
    .split("\n")
    .map((line) => line.slice(line.lastIndexOf("\r") + 1))
    .join("\n");
}
