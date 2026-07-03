TURBODOS MASCOT — asset drop folder
====================================

The app probes this folder by STATE NAME and uses whatever exists. Missing
states are skipped gracefully; with no files at all the mascot stays hidden.
Start with just idle.png and grow from there — every state below already has a
live trigger wired in the app, so anything you drop in "just works."

TIER 1 — CORE (do these first; he feels alive with just these)
  FILE NAME    WHEN IT PLAYS                              LOOP?   SUGGESTED POSE
  ---------    -------------------------------------      -----   ---------------------
  idle.*       default (REQUIRED to appear at all)        loop    standing, subtle breathe
  greet.*      app start / clicked / back from a game     once    wave
  bye.*        app is quitting (on the shutdown splash)   once    wave goodbye
  launch.*     a game launches                            once    cheer / thumbs up
  celebrate.*  download finished                          once    fist pump
  error.*      launch or download failed                  once    facepalm

TIER 2 — AMBIENT LIFE (idle variety; fire on their own during idle)
  sleep.*        user idle 2+ minutes                     loop    dozing, Zzz
  idle-look.*    occasional, mid-idle                     once    glance around
  idle-stretch.* occasional, mid-idle                     once    arms-up stretch
  idle-yawn.*    occasional, mid-idle                     once    yawn
  idle-scratch.* occasional, mid-idle                     once    scratch head / beard

TIER 3 — INTERACTION FLAVOR
  working.*    download in progress                       loop    typing / wrench
  dance.*      music switched on                          once    head-bob / groove
  select.*     a game is highlighted/selected             once    point at the game

TIER 4 — GENRE REACTIONS (optional; override generic select.* per genre)
  react-fps.*        selected an FPS                       once    aim / dual pistols
  react-shooter.*    selected a shmup/shooter              once    finger-guns
  react-platform.*   selected a platformer                once    little hop
  react-racing.*     selected a racing game               once    steering wheel
  react-fighting.*   selected a fighting game             once    fists up / jab
  react-action.*     selected an action game              once    action pose
  react-adventure.*  selected an adventure game           once    map / spyglass
  react-rpg.*        selected an RPG                       once    sword raise

FORMATS (first match wins): .webm  .apng  .png  .gif
  - webm = VP9 with alpha — the format for ANIMATIONS. The app can't play
    MOV/MP4-with-alpha; hand your source videos to Claude for conversion:
      * transparent MOV (ProRes 4444)  -> converted directly (best source)
      * regular MP4 on GREEN/MAGENTA   -> chroma-keyed then converted
      (never put him on black — his shirt is black)
  - png/gif/apng = fine for static poses or simple loops. Black-background
    stills can be cleaned (edge flood-fill keeps the black shirt intact).

RULES FOR GENERATING POSES
  - Same character size + same foot baseline on every canvas, or he'll
    jump around when switching states. Easiest: always generate on the
    same square canvas (e.g. 1024x1024) with him centered at the same scale.
  - One-shot reactions: ~1-3 seconds. Loops (idle/working/sleep): make the
    last frame flow into the first.
  - He renders at ~96px wide in-app with pixelated scaling, so chunky
    readable poses beat fine detail.

The mascot can be switched off in Settings -> Display.
