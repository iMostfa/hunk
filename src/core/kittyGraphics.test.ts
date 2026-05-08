import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  imageIdToFgColor,
  placeholderCell,
  placeholderRow,
  rgbToHex,
  terminalSupportsKittyGraphics,
} from "./kittyGraphics";

describe("imageIdToFgColor", () => {
  test("packs the lowest 24 bits into r/g/b", () => {
    expect(imageIdToFgColor(0xabcdef)).toEqual({ r: 0xab, g: 0xcd, b: 0xef });
  });

  test("ignores bits above 24 (those go on a separate diacritic)", () => {
    expect(imageIdToFgColor(0xff_abcdef)).toEqual({ r: 0xab, g: 0xcd, b: 0xef });
  });
});

describe("rgbToHex", () => {
  test("emits zero-padded hex with leading hash", () => {
    expect(rgbToHex({ r: 1, g: 2, b: 3 })).toBe("#010203");
    expect(rgbToHex({ r: 255, g: 0, b: 16 })).toBe("#ff0010");
  });
});

describe("placeholderCell", () => {
  test("starts with U+10EEEE so kitty recognises the cell as a placeholder", () => {
    expect(placeholderCell(0, 0, 1).codePointAt(0)).toBe(0x10eeee);
  });

  test("appends two diacritics for ids that fit in 24 bits", () => {
    const cell = placeholderCell(3, 7, 0xabcdef);
    // U+10EEEE is two UTF-16 code units, then two combining marks.
    expect(Array.from(cell)).toHaveLength(3);
  });

  test("appends a third diacritic when the image id spills past 24 bits", () => {
    const cell = placeholderCell(0, 0, 0x01_000000);
    expect(Array.from(cell)).toHaveLength(4);
  });
});

describe("placeholderRow", () => {
  test("emits one cell per requested column", () => {
    const row = placeholderRow(0, 5, 1);
    const cells = Array.from(row);
    // 5 cells × 3 codepoints (placeholder + row diacritic + col diacritic).
    expect(cells).toHaveLength(15);
    expect(cells[0]).toBe("\u{10EEEE}");
  });
});

describe("terminalSupportsKittyGraphics", () => {
  const previous = {
    TERM: process.env.TERM,
    TERM_PROGRAM: process.env.TERM_PROGRAM,
    HUNK_FORCE_KITTY_GRAPHICS: process.env.HUNK_FORCE_KITTY_GRAPHICS,
    HUNK_DISABLE_KITTY_GRAPHICS: process.env.HUNK_DISABLE_KITTY_GRAPHICS,
  };

  beforeEach(() => {
    delete process.env.HUNK_FORCE_KITTY_GRAPHICS;
    delete process.env.HUNK_DISABLE_KITTY_GRAPHICS;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  test("recognises Ghostty via TERM_PROGRAM", () => {
    process.env.TERM = "xterm-256color";
    process.env.TERM_PROGRAM = "ghostty";
    expect(terminalSupportsKittyGraphics()).toBe(true);
  });

  test("recognises kitty via TERM", () => {
    process.env.TERM = "xterm-kitty";
    process.env.TERM_PROGRAM = "";
    expect(terminalSupportsKittyGraphics()).toBe(true);
  });

  test("returns false for plain xterm", () => {
    process.env.TERM = "xterm";
    process.env.TERM_PROGRAM = "Apple_Terminal";
    expect(terminalSupportsKittyGraphics()).toBe(false);
  });

  test("HUNK_FORCE_KITTY_GRAPHICS overrides the env probe", () => {
    process.env.TERM = "xterm";
    process.env.TERM_PROGRAM = "Apple_Terminal";
    process.env.HUNK_FORCE_KITTY_GRAPHICS = "1";
    expect(terminalSupportsKittyGraphics()).toBe(true);
  });

  test("HUNK_DISABLE_KITTY_GRAPHICS overrides positive detection", () => {
    process.env.TERM = "xterm-kitty";
    process.env.HUNK_DISABLE_KITTY_GRAPHICS = "1";
    expect(terminalSupportsKittyGraphics()).toBe(false);
  });
});
