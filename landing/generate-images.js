// Generates OG share card (1200x630) and Apple touch icon (180x180) from SVG.
// Run: node generate-images.js
// Requires: sharp (globally installed with pptxgenjs, or `npm i -g sharp`).

const sharp = require("sharp");
const path = require("path");

// OG Share Card (1200 x 630)
const ogSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1A1A2E"/>
      <stop offset="1" stop-color="#2A2A45"/>
    </linearGradient>
    <radialGradient id="glow1" cx="1000" cy="120" r="400" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#7A8B6F" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#7A8B6F" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="150" cy="550" r="350" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#C97B5C" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#C97B5C" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>

  <!-- Wordmark -->
  <text x="80" y="220" font-family="Georgia, serif" font-size="140" font-weight="700" fill="#F5F0E8" letter-spacing="4">
    Vela
  </text>

  <!-- Tagline -->
  <text x="80" y="320" font-family="Georgia, serif" font-size="54" fill="#D4A574" letter-spacing="1">
    Your body, finally understood.
  </text>

  <!-- Subtitle -->
  <text x="80" y="385" font-family="Calibri, 'Helvetica Neue', Arial, sans-serif" font-size="26" fill="#B8B0A4">
    Track perimenopause and menopause symptoms.
  </text>
  <text x="80" y="420" font-family="Calibri, 'Helvetica Neue', Arial, sans-serif" font-size="26" fill="#B8B0A4">
    Discover personal patterns. Walk into your doctor's office prepared.
  </text>

  <!-- Feature pills -->
  <g font-family="Calibri, 'Helvetica Neue', Arial, sans-serif" font-size="20" fill="#F5F0E8">
    <rect x="80" y="490" width="220" height="52" rx="26" fill="#7A8B6F" fill-opacity="0.25" stroke="#7A8B6F" stroke-width="1.5"/>
    <text x="108" y="524">On-device only</text>

    <rect x="320" y="490" width="240" height="52" rx="26" fill="#7A8B6F" fill-opacity="0.25" stroke="#7A8B6F" stroke-width="1.5"/>
    <text x="350" y="524">Personal patterns</text>

    <rect x="580" y="490" width="260" height="52" rx="26" fill="#7A8B6F" fill-opacity="0.25" stroke="#7A8B6F" stroke-width="1.5"/>
    <text x="610" y="524">Doctor reports</text>
  </g>

  <!-- URL bottom right -->
  <text x="1120" y="595" font-family="Calibri, 'Helvetica Neue', Arial, sans-serif" font-size="22" fill="#8A8378" text-anchor="end">
    velahealth.health
  </text>
</svg>`;

// Apple Touch Icon (180 x 180)
const touchIconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="180" y2="180" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#C4856C"/>
      <stop offset="1" stop-color="#7A9E87"/>
    </linearGradient>
  </defs>
  <rect width="180" height="180" rx="40" fill="url(#bg)"/>
  <!-- Stylized V / leaf mark -->
  <path d="M50 56 L90 124 L130 56 L113 56 L90 95 L67 56 Z" fill="#FAF6F1"/>
</svg>`;

async function run() {
  const outDir = __dirname;

  await sharp(Buffer.from(ogSvg))
    .png({ quality: 90 })
    .toFile(path.join(outDir, "og-image.png"));
  console.log("✓ og-image.png (1200×630)");

  await sharp(Buffer.from(touchIconSvg))
    .png({ quality: 90 })
    .toFile(path.join(outDir, "apple-touch-icon.png"));
  console.log("✓ apple-touch-icon.png (180×180)");

  // Also 512×512 PNG for Android/PWA manifest (future)
  await sharp(Buffer.from(touchIconSvg))
    .resize(512, 512)
    .png({ quality: 90 })
    .toFile(path.join(outDir, "icon-512.png"));
  console.log("✓ icon-512.png (512×512)");
}

run().catch(err => { console.error(err); process.exit(1); });
