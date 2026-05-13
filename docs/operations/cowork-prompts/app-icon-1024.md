# Cowork prompt: 1024×1024 no-alpha app icon

Self-contained prompt for generating the App Store-compliant 1024×1024
icon and dropping it into Xcode's asset catalog. Copy everything below
the `---` line into a new Cowork session.

---

Generate the 1024×1024 PNG app icon that App Store Connect requires for the public-facing App Store listing, and wire it into the iOS asset catalog. Common rejection cause if missed.

## Context

Read `docs/HANDOFF.md` for orientation. The existing icons are at:

- `landing/icon-512.png` — 512×512, used on the landing page. May have alpha.
- `landing/apple-touch-icon.png` — smaller, for web favicon
- `landing/generate-app-icon.js` — the generator script. Uses node-canvas or similar — read it to see exact output dimensions.

For the App Store you need **1024×1024 PNG, no alpha channel, no transparency, no rounded corners** (Apple applies the rounded mask themselves). RGB color space, sRGB profile.

## What needs to be true when you're done

1. A new file `landing/icon-1024.png` exists at exactly 1024×1024 pixels, RGB (no alpha), under ~500KB.
2. The same file (or a copy) is placed at the correct path in the Xcode asset catalog. Inspect the existing catalog to find the right slot:
   - Path: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
   - There's a `Contents.json` describing each icon slot. The "App Store" slot is the 1024×1024 one. Filename convention varies — match what's already there.
3. The asset catalog `Contents.json` references the new file. If it already references a 1024×1024 entry, just overwrite that file in place. If it doesn't, add the entry.

## How to do it

### Step 1: inspect what's there
```
ls -la landing/*.png
file landing/icon-512.png            # check for alpha
file landing/apple-touch-icon.png    # same
cat landing/generate-app-icon.js     # read the generator
ls ios/App/App/Assets.xcassets/AppIcon.appiconset/
cat ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json
```

### Step 2: modify `generate-app-icon.js` if needed
The generator probably outputs a single size right now. You need it to also output 1024×1024 without alpha. Two ways:

- **Easier:** modify the script to add a 1024×1024 output target alongside whatever it currently produces. Use sharp or node-canvas to render flat (no alpha). Common pattern with sharp: `.removeAlpha().toFormat('png', { alphaQuality: 100 })`.
- **Quickest:** keep the script as-is, then add a single-purpose script that scales up the 512 to 1024 and strips alpha. Less ideal because upscaling loses fidelity; only acceptable if the source design is vector-based already.

Inspect the generator first — if the underlying design source is a vector or higher-resolution raster, generate fresh at 1024×1024.

### Step 3: produce the PNG
```
node landing/generate-app-icon.js
```

Verify:
```
file landing/icon-1024.png
# expected output: "PNG image data, 1024 x 1024, 8-bit/color RGB, non-interlaced"
# CRUCIAL: it must say "RGB" not "RGBA". RGBA means alpha is present.
```

If `file` reports RGBA, fix the script and regenerate. **Do not** check in an RGBA icon — Apple rejects it.

### Step 4: place into the asset catalog
- Find the AppIcon.appiconset directory.
- Read its Contents.json to see the existing icon slot definitions.
- The "App Store" slot is `"idiom": "ios-marketing"`, `"size": "1024x1024"`, `"scale": "1x"`. Filename will be something like `AppIcon-1024x1024@1x.png` or similar — match whatever convention Contents.json already uses.
- Copy `landing/icon-1024.png` to that slot's filename in the asset catalog.
- Verify Contents.json references the file (no edit needed if the entry already exists; add an entry if not).

### Step 5: sanity check the final state
```
file ios/App/App/Assets.xcassets/AppIcon.appiconset/<the 1024 file>
# again: must be RGB, 1024x1024, PNG
```

## Definition of done

1. `landing/icon-1024.png` exists, RGB, 1024×1024, PNG, no alpha. Verified via `file` command.
2. Same file copied into `ios/App/App/Assets.xcassets/AppIcon.appiconset/` at the App Store slot. Contents.json references it.
3. The generator script (`landing/generate-app-icon.js`) is updated to produce this output going forward — so if the design changes, Kris can regenerate by running the script once.
4. Single commit. Title format matches recent history. Body should mention:
   - The 1024×1024 PNG file was added
   - Alpha channel was stripped (or confirmed already absent)
   - The Xcode asset catalog Contents.json was updated to reference it
   - `landing/generate-app-icon.js` was updated to produce 1024 outputs alongside the existing sizes
   End with `Co-Authored-By:` line.
5. Push to origin/main directly.

## Constraints

- **Don't** invent a new logo design. Use the existing Vela mark (Ve*la* wordmark, clay color). The generator script should already encode this — your job is just to produce the 1024×1024 version of what's already there.
- **Don't** add rounded corners or shadows in the PNG — Apple applies the rounded mask on the App Store.
- **Don't** use ImageMagick if a native Node solution (sharp, jimp) is already in package.json or used by the existing generator. Match what's there.
- If you need to add a new dependency, prefer `sharp` (most reliable PNG handling) and explain why in the commit body. Otherwise stay with whatever's already wired.

## Report when done

- Final file paths and sizes
- Output of `file` on each PNG (proving no alpha)
- Whether you added any dependency
- New commit hash
