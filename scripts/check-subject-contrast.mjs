import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(resolve(root, "../app/design-tokens.css"), "utf8");

function blockFor(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tokens.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Theme token block not found: ${selector}`);
  return match[1];
}

function readHex(block, tokenName) {
  const match = block.match(new RegExp(`--${tokenName}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Hex token not found: --${tokenName}`);
  return match[1];
}

function luminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((channel) => parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const dark = blockFor(":root");
const light = blockFor('[data-theme="light"]');
const subjectTokens = [
  "subject-physiology",
  "subject-organic",
  "subject-physical",
  "subject-biochemistry",
  "subject-english",
];
const surfaces = {
  dark: readHex(dark, "color-surface"),
  light: readHex(light, "color-surface"),
};

console.log(`Subject accent contrast against theme surface (WCAG 2.1 AA target: 4.5:1)`);
console.log(`Subject             Dark          Light`);

let failed = false;
for (const token of subjectTokens) {
  const darkRatio = contrastRatio(readHex(dark, token), surfaces.dark);
  const lightRatio = contrastRatio(readHex(light, token), surfaces.light);
  console.log(`${token.replace("subject-", "").padEnd(19)} ${darkRatio.toFixed(2)}:1       ${lightRatio.toFixed(2)}:1`);
  if (darkRatio < 4.5 || lightRatio < 4.5) failed = true;
}

if (failed) {
  console.error("One or more subject accent colors fail the 4.5:1 contrast target.");
  process.exitCode = 1;
}
