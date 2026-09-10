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
assets/img/           logo.svg, hero-bg.jpg, crisis.jpg, pattern.svg, seeds.json
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
3. **Crisis** — pinned three-step accordion with gold-edge photo shimmer.

## Status

Work in progress. Open items: final copy for subhead 002, the $50B figure in 003,
sections after Crisis, mobile layout, real "Book a meeting" target.
