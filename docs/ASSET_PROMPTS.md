# TURBODOS asset generation — prompt pack

Copy-paste prompts for ChatGPT (image gen) and SUNO (music). Save results where noted;
I wire them in afterward. Strategy: AI draws the *organic* stuff (grime, wear, plating)
— the crisp structural frame stays procedural underneath, so nothing has to line up
pixel-perfectly.

**Paste this style preamble at the start of EVERY image prompt:**

> 16-bit pixel art texture for a retro-industrial sci-fi game UI. Dark cool palette:
> near-black navy base (#0d1322), gunmetal blue-grey metal (#232c44), pale steel
> highlights (#3b4763). Flat and orthographic, no perspective, no lighting gradients,
> no text, no logos, no characters. Crisp hard pixels, no anti-aliasing, no
> photorealism, no blur.

---

## Image 1 — panel grime (highest impact)
**Save as:** `public/textures/panel-grime.png`

> [preamble] A seamless, tileable square texture of subtle surface grime on dark
> metal: faint dust speckle, very soft mottled stains, tiny flecks of lighter grey.
> Extremely low contrast — the texture should read as almost solid dark navy from a
> distance, with the grime only visible up close. Evenly distributed with no obvious
> repeating shapes, no borders, edges must tile seamlessly.

## Image 2 — wear & damage decal (NEEDS REGEN — v1 came back with an opaque
olive backdrop instead of transparency, which would tint every panel)
**Save as:** `public/textures/wear-decal.png` (overwrite)

**Regen prompt — transparency stated three ways so it can't miss it:**

> Transparent PNG with alpha channel. The background must be 100% transparent —
> no backdrop, no gradient, no color fill, only the marks themselves on empty
> transparency. 16-bit pixel art: scattered wear marks for a dark metal game UI —
> thin pale-steel scratches, small near-black chips and gouges, a few rust-brown
> streaks. Sparse and irregular, clustered unevenly near the canvas edges and
> corners, large fully empty areas between clusters. No symmetry, no text.

Original prompt kept below for reference:

> [preamble] Scattered wear and damage marks on a fully TRANSPARENT background
> (transparent PNG, no backdrop): thin scratches exposing pale steel, small dark
> chips and gouges, a few rust-brown streaks and grime stains. Sparse and irregular
> — marks clustered unevenly near the edges and corners of the canvas, with large
> completely empty areas between them. No symmetry, no pattern, no repetition.

## Image 3 — riveted metal frame (experimental — may need retries)
**Save as:** `public/textures/metal-frame.png`

> [preamble] A square ornamental FRAME (hollow center, fully transparent middle):
> a thick riveted gunmetal border, about 12% of the canvas width thick on all four
> sides. Reinforced corner gusset plates with visible rivets, evenly spaced smaller
> rivets along the edges, subtle plating seams, worn highlight along the top-left
> bevel edge. Battle-worn: small chips and scratches in the plating. The frame
> border must be uniform thickness and perfectly straight.

*(This one fights AI weaknesses — straight uniform geometry. If after 2–3 attempts
the borders come out wobbly or the center isn't clean, skip it; the procedural frame
stays and Images 1–2 still deliver most of the grunge.)*

## Image 4 — brushed plating strip (nav + status bar surface)
**Save as:** `public/textures/plating.png`

> [preamble] A seamless, horizontally tileable texture of dark brushed gunmetal
> plating: faint horizontal brush grain, occasional vertical panel seam lines with
> tiny screws, very subtle tonal variation between plates. Low contrast, dark,
> utilitarian. Left and right edges must tile seamlessly.

## Image 5 (optional flavor) — pixel mascot vignette
**Save as:** `public/textures/mascot.png`

> Detailed 16-bit pixel art illustration, transparent background PNG: a chunky
> beige 1990s desktop PC tower with a CRT monitor showing a glowing green C:\>
> prompt, mechanical keyboard in front, a joystick beside it. Dark cool navy/grey
> shading with warm amber glow from the screen. No text other than the prompt
> symbol, no humans. Suitable as a small decorative corner illustration for a dark
> retro launcher UI.

### Generation tips
- 1024×1024, PNG. For #2/#3/#5 explicitly say "transparent background" — if it still
  renders a backdrop, re-ask: "same image, backdrop fully transparent."
- Generate 2–3 variants of each and keep the ones with the least "AI mush."
- Don't worry about them being too high-res or too detailed — I downscale and
  pixel-quantize on integration so everything lands crisp at UI scale.

---

# SUNO — menu music (REVISED — v1 prompts came out too happy/polished)

Target: **one looping instrumental**, dropped in as `public/audio/menu-theme.mp3`.

Why v1 failed: words like *nostalgic, warm, melody, adventure* steer SUNO toward
polished retrowave-pop. The fix: anchor on genuinely dark genres it knows, describe
the production as *degraded*, and use the **Exclude Styles** field aggressively.

**Put this in Exclude Styles on every attempt:**
> pop, synthwave, EDM, orchestral, epic, cinematic, lush pads, polished, modern
> production, vocals, shimmering, uplifting

**Track A — dark FPS vibe (Doom/Blood-era soundtrack):**
> Style: dark 1990s DOS shooter game soundtrack, gritty FM synth, MIDI metal riff,
> minor key, ominous droning bassline, sparse mechanical drums, lo-fi soundchip,
> raw and unpolished, muffled, tape hiss, slow menacing groove, instrumental,
> seamless loop

**Track B — dungeon synth ambient (moodier, better for browsing):**
> Style: dark dungeon synth, eerie 1990s DOS game dungeon ambience, primitive FM
> synthesis, minor key drone, sparse cold melody, industrial hum, lo-fi, tape
> hiss, hypnotic and unresolved, instrumental, seamless loop

**Track C — dark demoscene tracker (rhythmic middle ground):**
> Style: dark 1990s Amiga tracker module, demoscene electro, crunchy 8-bit
> samples, minor key, brooding driving bassline, restrained percussion, cold and
> mechanical, lo-fi, instrumental, seamless loop

### Music tips
- Ask SUNO to avoid a big intro/outro — loops feel better when the energy is flat
  across the track. If it fades out at the end, trim the fade before dropping it in.
- MP3 download → rename to `menu-theme.mp3` → drop into `public/audio/`. That's it —
  no code changes needed, the player picks it up on next launch.
- If you later want a short "launch stinger" (2-second flourish when a game starts),
  generate a tiny clip and we'll wire it as `launch-stinger.mp3`.
