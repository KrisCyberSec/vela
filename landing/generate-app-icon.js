// Generates iOS app icon at 1024x1024 for AppIcon.appiconset.
// Run: node generate-app-icon.js

const sharp = require("sharp");
const path = require("path");

// Larger, more refined mark for the 1024 icon
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

async function run() {
  const outPath = path.join(
    __dirname,
    "..",
    "ios",
    "App",
    "App",
    "Assets.xcassets",
    "AppIcon.appiconset",
    "AppIcon-512@2x.png"
  );

  await sharp(Buffer.from(iconSvg))
    .png({ quality: 100 })
    .toFile(outPath);

  console.log("✓ App icon regenerated at " + outPath);
}

run().catch(err => { console.error(err); process.exit(1); });
