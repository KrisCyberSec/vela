# Pitch Deck

## Files

| File | When to use |
|------|-------------|
| `/Users/kristopher/Vela/Vela-Pitch-Deck.pptx` | Editable source (Keynote / PowerPoint / LibreOffice) |
| `/Users/kristopher/Vela/Vela-Pitch-Deck.pdf` | Easier to share/email; visual export |
| `/Users/kristopher/Vela/pitch-deck.js` | Generator script (Node + pptxgenjs) |

## Slide structure

1. **Title** — Vela branding + tagline
2. **The Problem** — menopause market stats (1.1B women, 75% symptomatic, 73% untreated)
3. **The Solution** — 4 feature cards (30-sec log, pattern detection, doctor reports, AI companion)
4. **What Makes Vela Different** — 8 differentiators in 2 columns
5. **Competitive Landscape** — feature comparison table (Vela vs Midday, Caria, Balance, Flo)
6. **Business Model** — Free vs Premium cards with pricing
7. **Market & Financials** — TAM/SAM/SOM + unit economics + 3 revenue scenarios
8. **Go-to-Market** — 3-phase timeline (Foundation → Growth → Scale)
9. **Where We Stand** — Built checklist + Next steps + cost structure
10. **Closing** — Vision + CTA

## Design language

- **Palette:** dark navy (`#1A1A2E`), sage (`#7A8B6F`), clay/copper (`#C97B5C`), gold (`#D4A574`), cream (`#F5F0E8`)
- **Headings:** Georgia serif
- **Body:** Calibri sans-serif
- **Layout:** Card-based with shadows, consistent padding, no stock photos

## Regenerating the deck

If you update financials, features, or positioning, edit `pitch-deck.js` and re-run it:

```bash
cd /Users/kristopher/Vela
node pitch-deck.js
# → Vela-Pitch-Deck.pptx regenerated
```

To also regenerate the PDF:

```bash
/opt/homebrew/bin/soffice --headless --convert-to pdf Vela-Pitch-Deck.pptx
```

(Requires LibreOffice; `brew install --cask libreoffice` if it's not there.)

## Sources that fed the deck

- [../business/financial-model.md](financial-model.md) — pricing, unit economics, revenue scenarios
- [../product/app-store-listing.md](../product/app-store-listing.md) — positioning, competitive analysis
- [../product/launch-strategy.md](../product/launch-strategy.md) — phased GTM timeline
- [../product/overview.md](../product/overview.md) — feature list, current stage

If any of these change materially, the deck should be regenerated to stay in sync.

## Sharing

- **Ad-hoc sharing:** send the PDF. Most people can open PDFs anywhere.
- **Editable:** send the PPTX. Works in PowerPoint, Keynote (with import), Google Slides (via upload), LibreOffice.
- **Online view:** Upload the PPTX to Google Slides (File → Import slides) and share a view-only link.

## Related docs

- [../operations/infrastructure.md](../operations/infrastructure.md) — services referenced in the deck
- [financial-model.md](financial-model.md) — numbers source of truth
