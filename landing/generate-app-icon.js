// Generates the Vela app icon at 1024×1024, no alpha, RGB.
//
// Writes to two places:
//   1. landing/icon-1024.png            — source-of-truth file checked
//                                          into the repo
//   2. ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
//                                        — what Xcode bakes into the IPA
//
// App Store Connect requires the 1024×1024 PNG to be flat RGB (no alpha
// channel). Apple applies the rounded-rect mask themselves, so the icon
// is rendered edge-to-edge with no corner radius.
//
// Run:  node landing/generate-app-icon.js
// Deps: sharp (devDependency).

const sharp = require("sharp");
const path = require("path");

// Vela mark: clay→sage gradient background, cream "V" leaf-stem glyph.
// 1024×1024 SVG; sharp rasterizes it down to a flat RGB PNG.
const iconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#C4856C"/>
      <stop offset="0.55" stop-color="#B0856F"/>
      <stop offset="1" stop-color="#7A9E87"/>
    </linearGradient>
    <radialGradient id="highlight" cx="340" cy="280" r="450" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.20"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background (no corner radius — Apple masks icons) -->
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#highlight)"/>

  <!-- Stylized V/leaf mark, centered, cream colored -->
  <g transform="translate(512, 512)">
    <path d="M -240 -180 L 0 240 L 240 -180 L 140 -180 L 0 60 L -140 -180 Z"
          fill="#FAF6F1"/>
    <!-- Accent line echoing growth/leaf stem -->
    <path d="M 0 60 L 0 240"
          stroke="#FAF6F1"
          stroke-width="0"
          stroke-linecap="round"/>
  </g>
</svg>`;

// Flatten any transparency against the background gradient's starting
// clay tone. Belt-and-suspenders — `.removeAlpha()` already strips the
// alpha channel, but `flatten()` first composites onto a solid color so
// any semi-transparent pixels render correctly instead of going black.
const FLATTEN_AGAINST = { r: 196, g: 133, b: 108 }; // #C4856C — clay

const landingOutPath = path.join(__dirname, "icon-1024.png");
const xcodeOutPath = path.join(
  __dirname,
  "..",
  "ios",
  "App",
  "App",
  "Assets.xcassets",
  "AppIcon.appiconset",
  "AppIcon-512@2x.png"
);

async function render(outPath) {
  await sharp(Buffer.from(iconSvg))
    .flatten({ background: FLATTEN_AGAINST })
    .removeAlpha()
    .toColorspace("srgb")
    .png({ compressionLevel: 9, palette: false })
    .toFile(outPath);
  console.log("✓ " + outPath);
}

async function run() {
  await render(landingOutPath);
  await render(xcodeOutPath);
  console.log("Done. Verify with: file " + landingOutPath);
}

run().catch((err) => { console.error(err); process.exit(1); });
