# Colmez — Landing Page

Front-end build of the Colmez landing page, coded from the Figma design
([SR007 · Colmez · Web Design](https://www.figma.com/design/2khiIGWYhHvey6iWyuhFlX/-SR007--Colmez--Web-Design?node-id=9236-1110)).

**Live preview:** https://szyna-tonik.github.io/colmez-lp/

## Stack

Plain HTML / CSS / JS — no build step, no dependencies. Two WebGL shaders and a
2D canvas handle the goo dissolve, the logo hover effect and the vector pattern.

## Structure

```
index.html            markup
styles.css            all styles (scale unit --u = 100cqw/1496, mirrors Figma px)
main.js               preloader, scroll choreography, WebGL, smooth scroll
assets/fonts/         Overused Grotesk VF
assets/img/           logo.svg, hero-bg.jpg, crisis*.jpg, screen-0*.png, team-*.png, logo-*.png, pattern.svg, seeds.json
tools-gen_pattern.py  regenerates pattern.svg + seeds.json from hero-bg.jpg
```

## Running locally

Needs a static server (the pattern is `fetch`-ed, so `file://` won't work):

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

## Sections

1. **Preloader** — logo forms centre-screen out of three goo holes, flies up, hero reveals.
2. **Hero (sticky stage)** — scroll-driven: photo rise, nav morph, headline dissolve,
   goo dissolve, vector pattern draw-in with mouse stir, waste list with counters.
3. **Crisis** — pinned three-step accordion; the three photos form out of goo together
   the moment they enter the viewport (time-driven, not scroll-scrubbed).
4. **Markets map** — scroll-driven perspective ride into the product's block map
   (d3 + topojson, `map.js`), state hover runs the logo's melt shader over the whole map.
5. **Quote** — advisor pull quote with photo goo-reveal.
6. **Screens** — white band, three product feature rows with real product mockups
   (Signals / Share of wallet / Pipeline, exported @2x from Figma); the fixed nav logo
   rides `mix-blend-mode: difference` so it inverts over the light sections.
7. **Security** — closing claim of the features block with the AICPA SOC 2 badge.
8. **Team** — pinned scroll carousel: portraits grow and re-centre, names ride along and
   activate (clickable), bios swap; inactive portraits stay visible under a washed-grey
   goo cover that the hand-over opens. Copy, roles and logos from the live colmez.com.
9. **Footer** — an underfooter: sticky behind the page, the Team band slides up off it.
   Background is the hero's own vector pattern at full colour (stir included); the wordmark
   forms like the preloader's, claim / CTA / link plate use the hero grammar; the nav fades
   once the footer owns the screen. Global CTA hover: label re-sweep, masked arrow swap,
   dark-gold plate rising from the bottom.

## Status

Work in progress. Open items: map pattern polish, photo for Crisis 001 (002 + 003 have
theirs), final advisor photo in Quote, final copy for crisis subhead 002 and the $50B figure
in 003, "© 2026 Colmez" wording, real "Book a meeting" / LinkedIn / Terms / Privacy targets,
mobile layout.
