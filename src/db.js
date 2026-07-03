// Database layer — brain side, DOSBox-agnostic

let _db = null;
let _mem = null;

export function inTauri() {
  return typeof window.__TAURI__ !== 'undefined';
}

// ─── Seed data for first run ───
const SEED_GAMES = [
  { title: "DOOM (Shareware)", genre_tag: "fps", subtype: "idtech1", engine: "doom", description: "The shareware episode of id Software's landmark FPS. Fight through Phobos Base against the demonic hordes of Hell.", art_path: null, dosbox_config: "", install_path: "", executable: "DOOM.EXE", verified: 1, source_type: "bundled",
    folder_name: "DOOM",
    download_url: "https://archive.org/download/doom_20230531/doom_dos.ZIP",
    buy_url: "https://www.gog.com/en/game/doom_1993" },
  { title: "Commander Keen 1", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Episode 1 of id Software's side-scrolling platformer. Billy Blaze saves the galaxy armed with a pogo stick and a ray gun.", art_path: null, dosbox_config: "", install_path: "", executable: "KEEN1.EXE", verified: 1, source_type: "bundled",
    folder_name: "KEEN1",
    download_url: "https://archive.org/download/keen1-sw/keen1.zip",
    buy_url: "https://www.gog.com/en/game/commander_keen_complete_pack" },
  { title: "Heretic (Shareware)", genre_tag: "fps", subtype: "idtech1", engine: "doom", description: "Raven Software's dark fantasy FPS on the DOOM engine. Episode 1: City of the Damned — battle undead armies as the elven warrior Corvus.", art_path: null, dosbox_config: "", install_path: "", executable: "HERETIC.EXE", verified: 1, source_type: "bundled",
    folder_name: "HERETIC",
    download_url: "https://archive.org/download/heretic-dos/HTC_BOX.ZIP",
    buy_url: "https://www.gog.com/en/game/heretic_shadow_of_the_serpent_riders" },
  { title: "Wolfenstein 3D (Shareware)", genre_tag: "fps", subtype: "raycaster", engine: "wolf3d", description: "The grandfather of the FPS genre. Escape Castle Wolfenstein and bring down the Nazi war machine.", art_path: null, dosbox_config: "", install_path: "", executable: "WOLF3D.EXE", verified: 1, source_type: "bundled",
    folder_name: "WOLF3D",
    download_url: "https://archive.org/download/Wolfenstein3d/Wolfenstein3dV14sw.ZIP",
    buy_url: "https://www.gog.com/en/game/wolfenstein_3d" },
  { title: "Duke Nukem 3D", genre_tag: "fps", subtype: "build-engine", engine: "build", description: "Duke Nukem is back and the aliens have invaded. Destroy them with extreme prejudice and plenty of one-liners.", art_path: null, dosbox_config: "", install_path: "", executable: "DUKE3D.EXE", verified: 1, source_type: "referenced",
    folder_name: "DUKE3D",
    download_url: "https://archive.org/download/3D_Realms_Duke_Nukem_3D_Shareware/3D%20Realms%20-%20Duke%20Nukem%203D%20%28Shareware%20Version%29.zip",
    buy_url: "https://www.zoom-platform.com/product/duke-nukem-3d-atomic-edition" },
  { title: "Tyrian 2000", genre_tag: "shooter", subtype: "vertical-shmup", engine: "generic", description: "The definitive DOS vertical shoot-em-up with stunning visuals and a legendary soundtrack by Alexander Brandon.", art_path: null, dosbox_config: "", install_path: "", executable: "TYRIAN.EXE", verified: 1, source_type: "referenced",
    folder_name: "TYRIAN",
    download_url: "https://archive.org/download/Tyrian2000/tyrian2000.zip",
    buy_url: null },
  { title: "Crystal Caves", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Rescue Clyde the crystal miner in Apogee's classic side-scrolling platformer.", art_path: null, dosbox_config: "", install_path: "", executable: "CC1.EXE", setup_exe: "SETUP.EXE", verified: 1, source_type: "bundled",
    folder_name: "CC1",
    download_url: "https://archive.org/download/Crystal-cave-sw1/crystal.zip",
    buy_url: "https://store.steampowered.com/app/358260/Crystal_Caves/" },
  { title: "Duke Nukem (Shareware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Episode 1 of Apogee's side-scrolling classic. Duke takes on Dr. Proton and his Techbot army across three action-packed levels.", art_path: null, dosbox_config: "", install_path: "", executable: "DN1.EXE", setup_exe: "SETUP.EXE", verified: 1, source_type: "bundled",
    folder_name: "DUKE1",
    download_url: "https://archive.org/download/duke-nukum1-sw/duke1.zip",
    buy_url: "https://www.zoom-platform.com/product/duke-nukem-1" },
  { title: "Duke Nukem II (Shareware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Episode 1 of Duke's bigger, more explosive sequel. Dr. Proton returns with an alien army — and Duke's got a score to settle.", art_path: null, dosbox_config: "", install_path: "", executable: "NUKEM2.EXE", setup_exe: "SETUP.EXE", verified: 0, source_type: "bundled",
    folder_name: "DUKE2",
    download_url: "https://archive.org/download/msdos_DUKE2_shareware/DUKE2.zip",
    buy_url: "https://www.zoom-platform.com/product/duke-nukem-2" },

  // ── Batch 1 expansion ────────────────────────────────────────────────────────
  { title: "Raptor: Call of the Shadows (Shareware)", genre_tag: "shooter", subtype: "vertical-shmup", engine: "generic", description: "Apogee's definitive vertical shoot-em-up. Pilot a futuristic gunship through 9 shareware missions of escalating aerial carnage.", art_path: null, dosbox_config: "", install_path: "", executable: "RAP.EXE", setup_exe: "SETUP.EXE", verified: 1, source_type: "bundled",
    folder_name: "RAPTOR",
    download_url: "https://archive.org/download/Raptor-sw1/raptor.zip",
    buy_url: "https://www.gog.com/game/raptor_call_of_the_shadows_2010_edition" },

  { title: "Jazz Jackrabbit (Shareware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Epic MegaGames' blazing fast side-scrolling platformer. Jazz the rabbit races through alien worlds blasting turtles at Sonic-rivalling speed.", art_path: null, dosbox_config: "", install_path: "", executable: "JAZZ.EXE", setup_exe: "SETUP.EXE", verified: 1, source_type: "bundled",
    folder_name: "JAZZ",
    download_url: "https://archive.org/download/JazzJackrabbit/jazz11.zip",
    buy_url: null },

  { title: "Cosmo's Cosmic Adventure (Shareware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Episode 1 of Apogee's alien platformer. Young Cosmo crash-lands on a monster-filled planet and must survive using his suction-cup hands.", art_path: null, dosbox_config: "", install_path: "", executable: "COSMO1.EXE", setup_exe: "SETUP.EXE", verified: 1, source_type: "bundled",
    folder_name: "COSMO",
    download_url: "https://archive.org/download/CosmosCosmicAdventure/cosmo.ZIP",
    buy_url: null },

  { title: "Bio Menace (Freeware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "CIA agent Snake Logan battles a mutant invasion across all 3 episodes. Released as freeware by 3D Realms in 2005.", art_path: null, dosbox_config: "", install_path: "", executable: "BMENACE1.EXE", episodes: '[{"label":"Episode 1","exe":"BMENACE1.EXE"},{"label":"Episode 2","exe":"BMENACE2.EXE"},{"label":"Episode 3","exe":"BMENACE3.EXE"}]', verified: 1, source_type: "bundled",
    folder_name: "BIOMEN",
    download_url: "https://archive.org/download/BioMenace/bmfreew.zip",
    buy_url: null },

  { title: "Monster Bash (Shareware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Episode 1 of Apogee's Halloween platformer. Johnny Dash must rescue his dog from the clutches of Count Chuck and his monster horde.", art_path: null, dosbox_config: "", install_path: "", executable: "BASH1.EXE", setup_exe: "SETUP.EXE", verified: 1, source_type: "bundled",
    folder_name: "MBASH",
    download_url: "https://archive.org/download/monster-bash1-sw/bash.zip",
    buy_url: null },

  { title: "Hocus Pocus (Shareware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Episode 1 of Apogee's wizard platformer. Young Hocus must prove himself to the Council of Wizards by surviving four treacherous worlds.", art_path: null, dosbox_config: "", install_path: "", executable: "HOCUS.EXE", verified: 1, source_type: "bundled",
    folder_name: "HOCUS",
    download_url: "https://archive.org/download/hocus-pocus_202304/Hocus%20Pocus.7z",
    buy_url: null },

  { title: "Halloween Harry (Freeware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Apogee's jetpack-fuelled platformer. Harry blasts his way through alien-infested malls and military bases to rescue hostages. Released as freeware.", art_path: null, dosbox_config: "", install_path: "", executable: "HH1.EXE", verified: 1, source_type: "bundled",
    folder_name: "HHARRY",
    download_url: "https://archive.org/download/halloween-harry/Halloween_Harry.zip",
    buy_url: null },

  { title: "Major Stryker (Freeware)", genre_tag: "shooter", subtype: "vertical-shmup", engine: "generic", description: "Apogee's vertical space shooter across three alien worlds. The full game was released as freeware by 3D Realms in 2006.", art_path: null, dosbox_config: "", install_path: "", executable: "STRYKER.EXE", setup_exe: "SETUP.EXE", verified: 1, source_type: "bundled",
    folder_name: "MSTRYKE",
    download_url: "https://archive.org/download/strykerfw/strykerfw.zip",
    buy_url: null },

  { title: "Monuments of Mars (Freeware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "All 4 episodes of Apogee's Martian platformer. An astronaut explores ancient alien ruins filled with deadly traps. Released freeware by 3D Realms in 2009.", art_path: null, dosbox_config: "", install_path: "", executable: "MARS1.EXE", episodes: '[{"label":"Episode 1","exe":"MARS1.EXE"},{"label":"Episode 2","exe":"MARS2.EXE"},{"label":"Episode 3","exe":"MARS3.EXE"},{"label":"Episode 4","exe":"MARS4.EXE"}]', verified: 1, source_type: "bundled",
    folder_name: "MARS",
    download_url: "https://archive.org/download/MonumentsOfMars/marsfree.zip",
    buy_url: null },

  { title: "Dark Ages (Freeware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Prince Gareth must reclaim his kingdom across three episodes of medieval action platforming. Released as freeware by 3D Realms in 2009.", art_path: null, dosbox_config: "", install_path: "", executable: "DA1.EXE", episodes: '[{"label":"Episode 1","exe":"DA1.EXE"},{"label":"Episode 2","exe":"DA2.EXE"},{"label":"Episode 3","exe":"DA3.EXE"}]', verified: 1, source_type: "bundled",
    folder_name: "DARKAGE",
    download_url: "https://archive.org/download/DarkAges_696/da_freew.zip",
    buy_url: null },

  { title: "Stargunner (Freeware)", genre_tag: "shooter", subtype: "horizontal-shmup", engine: "generic", description: "Apogee's horizontal space shoot-em-up with 34 levels of relentless alien combat. The full game was released as freeware by 3D Realms in 2005.", art_path: null, dosbox_config: "", install_path: "", executable: "STARGUN.EXE", verified: 1, source_type: "bundled",
    folder_name: "STARGN",
    download_url: "https://archive.org/download/Stargunner/stargunnerfreeware.zip",
    buy_url: null },

  { title: "Arctic Adventure (Freeware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Pharaoh Percy must survive icy puzzles and traps across the Arctic. Released as freeware by 3D Realms in 2009.", art_path: null, dosbox_config: "", install_path: "", executable: "AA1.EXE", episodes: '[{"label":"Episode 1","exe":"AA1.EXE"},{"label":"Episode 2","exe":"AA2.EXE"},{"label":"Episode 3","exe":"AA3.EXE"},{"label":"Episode 4","exe":"AA4.EXE"}]', verified: 1, source_type: "bundled",
    folder_name: "ARCTIC",
    download_url: "https://archive.org/download/ArcticAdventure/aa_freew.zip",
    buy_url: null },

  { title: "Pharaoh's Tomb (Freeware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Archaeologist Nevada Smith explores a deadly Egyptian tomb across 20 levels of action platforming. Released as freeware by 3D Realms in 2009.", art_path: null, dosbox_config: "", install_path: "", executable: "PTOMB1.EXE", episodes: '[{"label":"Episode 1","exe":"PTOMB1.EXE"},{"label":"Episode 2","exe":"PTOMB2.EXE"},{"label":"Episode 3","exe":"PTOMB3.EXE"},{"label":"Episode 4","exe":"PTOMB4.EXE"}]', verified: 1, source_type: "bundled",
    folder_name: "PHARAOH",
    download_url: "https://archive.org/download/PharaohsTomb/tombfree.ZIP",
    buy_url: null },

  { title: "Wacky Wheels (Shareware)", genre_tag: "racing", subtype: "kart", engine: "generic", description: "Apogee's kart racing game with a twist — your competitors are wild animals. Race across 5 shareware tracks with hedgehogs, sharks, and bears.", art_path: null, dosbox_config: "", install_path: "", executable: "WW.EXE", verified: 1, source_type: "bundled",
    folder_name: "WWHEEL",
    download_url: "https://archive.org/download/WackyWheels/1wacky.zip",
    buy_url: null },

  { title: "Death Rally (Shareware)", genre_tag: "racing", subtype: "top-down", engine: "generic", description: "Remedy's top-down car combat racer. Destroy opponents and win prize money to upgrade your vehicle. 3 of 6 cars available in the shareware.", art_path: null, dosbox_config: "", install_path: "", executable: "RALLY.EXE", verified: 1, source_type: "bundled",
    folder_name: "DRALLY",
    download_url: "https://archive.org/download/DRALLYSW/DRALLYSW.zip",
    buy_url: "https://store.steampowered.com/app/270550/Death_Rally_Classic/" },

  { title: "Jill of the Jungle (Shareware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Episode 1 of Epic MegaGames' jungle platformer. Jill carves through prehistoric wilderness armed with throwing stars and a sharp blade.", art_path: null, dosbox_config: "", install_path: "", executable: "JJFILE1.EXE", verified: 1, source_type: "bundled",
    folder_name: "JILL",
    download_url: "https://archive.org/download/jill1-sw/jill.zip",
    buy_url: null },

  { title: "Secret Agent (Shareware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Episode 1 of Apogee's spy platformer. Agent SAM infiltrates enemy facilities on a series of gadget-filled side-scrolling missions.", art_path: null, dosbox_config: "", install_path: "", executable: "SAM1.EXE", setup_exe: "SETUP.EXE", verified: 1, source_type: "bundled",
    folder_name: "SAGENT",
    download_url: "https://archive.org/download/SecretAgent_945/AGENT.ZIP",
    buy_url: "https://www.gog.com/game/secret_agent" },

  { title: "Jetpack (Freeware)", genre_tag: "platform", subtype: "gravity", engine: "generic", description: "400 levels of gravity-based jetpack platforming. Collect gems and navigate hazards across a massive hand-crafted world. Released freeware in 1998.", art_path: null, dosbox_config: "", install_path: "", executable: "JETPACK.EXE", verified: 1, source_type: "bundled",
    folder_name: "JETPAK",
    download_url: "https://archive.org/download/Jetpack/jetpak15.zip",
    buy_url: null },

  { title: "God of Thunder (Freeware)", genre_tag: "action", subtype: "top-down", engine: "generic", description: "All 3 episodes of Norse mythology action RPG. Thor battles giants and monsters armed with Mjolnir. Full game released freeware; source code public domain.", art_path: null, dosbox_config: "", install_path: "", executable: "GOT.EXE", verified: 1, source_type: "bundled",
    folder_name: "GODT",
    download_url: "https://archive.org/download/god_of_thunder_free/god_of_thunder_free.zip",
    buy_url: null },

  { title: "Xargon (Freeware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "All 4 episodes of Epic MegaGames' alien platformer. Explorer Malvineous Havershim battles strange creatures across bizarre alien landscapes. Released freeware by original developer.", art_path: null, dosbox_config: "", install_path: "", executable: "XRFILE01.EXE", episodes: '[{"label":"Episode 1","exe":"XRFILE01.EXE"},{"label":"Episode 2","exe":"XRFILE02.EXE"},{"label":"Episode 3","exe":"XRFILE03.EXE"},{"label":"Episode 4","exe":"XRFILE04.EXE"}]', verified: 1, source_type: "bundled",
    folder_name: "XARGON",
    download_url: "https://archive.org/download/Xargon_Trilogy/Xargon.zip",
    buy_url: null },

  // ── Batch 2 expansion ────────────────────────────────────────────────────────
  { title: "Commander Keen 4 (Shareware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Episode 4 'Secret of the Oracle' — the most celebrated Commander Keen episode. Billy Blaze explores a strange alien world to rescue the Oracle council from Mortimer McMire.", art_path: null, dosbox_config: "", install_path: "", executable: "KEEN4E.EXE", setup_exe: "SETUP.EXE", verified: 1, source_type: "bundled",
    folder_name: "KEEN4",
    download_url: "https://archive.org/download/Keen4e-sw/keen4.zip",
    buy_url: "https://www.gog.com/en/game/commander_keen_complete_pack" },

  { title: "Keen Dreams (Freeware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "The lost Commander Keen episode — officially released as freeware. Bobbin Threadbare battles the vegetable army of Boobus Tuber across a bizarre dream world.", art_path: null, dosbox_config: "", install_path: "", executable: "START.EXE", verified: 1, source_type: "bundled",
    folder_name: "KDREAMS",
    download_url: "https://archive.org/download/CommanderKeenKeenDreams/CommanderKeenInKeenDreamsV1.13Egasw1992softdiskPublishingaction.ZIP",
    buy_url: null },

  { title: "Blake Stone: Aliens of Gold (Shareware)", genre_tag: "fps", subtype: "raycaster", engine: "wolf3d", description: "1993's Wolf3D-engine sci-fi shooter. Special agent Blake Stone infiltrates a mad scientist's alien factory — Episode 1 of 6 in this shareware release.", art_path: null, dosbox_config: "", install_path: "", executable: "BS_AOG.EXE", setup_exe: "SETUP.EXE", verified: 1, source_type: "bundled",
    folder_name: "BLAKE",
    download_url: "https://archive.org/download/Bs-aog-sw1/bstone.zip",
    buy_url: null },

  { title: "Hexen (Shareware)", genre_tag: "fps", subtype: "idtech1", engine: "doom", description: "Raven Software's dark medieval FPS on the DOOM engine. Choose Fighter, Cleric, or Mage and battle the Serpent Rider Korax across the haunted world of Cronos.", art_path: null, dosbox_config: "", install_path: "", executable: "HEXEN.EXE", verified: 1, source_type: "bundled",
    folder_name: "HEXEN",
    download_url: "https://archive.org/download/HexenBeyondHeretic/Hexen.ZIP",
    buy_url: "https://www.gog.com/game/hexen_beyond_heretic" },

  { title: "Rise of the Triad (Shareware)", genre_tag: "fps", subtype: "raycaster", engine: "generic", description: "'The HUNT Begins' shareware episode of Apogee's cult-classic FPS. The H.U.N.T. team battles a doomsday cult on a fortified island with a wild arsenal of weapons.", art_path: null, dosbox_config: "", install_path: "", executable: "ROTT.EXE", setup_exe: "SETUP.EXE", verified: 0, source_type: "bundled",
    folder_name: "ROTT",
    download_url: "https://archive.org/download/rott_shareware/ROTT.zip",
    buy_url: "https://store.steampowered.com/app/308400/Rise_of_the_Triad_2013/" },

  { title: "Shadow Warrior (Shareware)", genre_tag: "fps", subtype: "build-engine", engine: "build", description: "3D Realms' 1997 Build-engine action FPS. Lo Wang tears through ninja armies with katanas, shurikens, and rocket launchers across the shareware episode.", art_path: null, dosbox_config: "", install_path: "", executable: "SW.EXE", verified: 0, source_type: "bundled",
    folder_name: "SWARS",
    download_url: "https://github.com/CrossplayGaming/dosdeck-packs/releases/download/v1/shadow-warrior.zip",
    buy_url: "https://store.steampowered.com/app/238070/Shadow_Warrior_Classic_Redux/" },

  { title: "One Must Fall: 2097 (Shareware)", genre_tag: "fighting", subtype: "2d-fighter", engine: "generic", description: "Epic MegaGames' legendary DOS fighting game. Pilot combat robots called HAR in one-on-one tournament battles — the finest 2D fighter ever made for DOS.", art_path: null, dosbox_config: "", install_path: "", executable: "OMF.EXE", verified: 0, source_type: "bundled",
    folder_name: "OMF2097",
    download_url: "https://archive.org/download/omf20_zip/omf20.zip",
    buy_url: null },

  { title: "Terminal Velocity (Shareware)", genre_tag: "shooter", subtype: "3d-flight", engine: "generic", description: "3D Realms' 1995 high-speed 3D flight shooter. Pilot a fighter through alien worlds at breakneck speed, destroying everything in sight across 3 shareware missions.", art_path: null, dosbox_config: "", install_path: "", executable: "TV.EXE", verified: 0, source_type: "bundled",
    folder_name: "TVELO",
    download_url: "https://archive.org/download/TerminalVelocity/TVplay.ZIP",
    buy_url: null },

  // Descent: original dcnt12-1.zip was a broken DEICE installer; switched to a pre-extracted
  // v1.4 shareware pack (DCNTSHR.EXE + HOG + PIG). Confirmed working with sound, zero setup.
  { title: "Descent (Shareware)", genre_tag: "fps", subtype: "6dof", engine: "generic", description: "Interplay's legendary 6-degrees-of-freedom shooter. Navigate fully 3D mine shafts, destroy robot enemies, and rescue hostages in true zero-gravity tunnel combat.", art_path: null, dosbox_config: "", install_path: "", executable: "DCNTSHR.EXE", verified: 0, source_type: "bundled",
    folder_name: "DESCENT",
    download_url: "https://github.com/CrossplayGaming/dosdeck-packs/releases/download/v1/descent.zip",
    buy_url: "https://www.gog.com/game/descent" },

  { title: "Quake (Shareware)", genre_tag: "fps", subtype: "idtech2", engine: "generic", description: "id Software's 1996 masterpiece — the first true fully-3D FPS. Fight through gothic nightmare levels armed with 8 weapons against Quake's eldritch monster hordes.", art_path: null, dosbox_config: "", install_path: "", executable: "QUAKE.EXE", verified: 0, source_type: "bundled",
    folder_name: "QUAKE",
    download_url: "https://archive.org/download/Quake_802/quake106.zip",
    buy_url: "https://store.steampowered.com/app/2310/Quake/" },

  { title: "Solar Winds: The Escape (Shareware)", genre_tag: "action", subtype: "space-shooter", engine: "generic", description: "Epic MegaGames' space RPG-shooter. Pilot mercenary Jake Stone through a galaxy-spanning adventure mixing free-roaming space combat with story-driven missions.", art_path: null, dosbox_config: "", install_path: "", executable: "SOLAR1.EXE", verified: 0, source_type: "bundled",
    folder_name: "SOLAR",
    download_url: "https://archive.org/download/SolarWindsTheEscape/SolarWinds.ZIP",
    buy_url: null },

  // ── Batch 3 expansion (download-first; packs deferred until tested) ───────────
  // Sourced from archive.org direct zips. verified:0 until tested in-app; NOT in
  // PACK_GAMES yet (confirm-then-pack gate). Exe names are best-effort hints — the
  // post-download scan auto-detects the real executable. Fills the empty RPG +
  // Adventure categories and adds picks across FPS / platform / action / shooter.
  // Launches via ARENA.BAT (sets up sound/ULTRAMID then runs A.EXE) — running A.EXE
  // directly gives no sound. The app CALLs .bat launchers so DOSBox exits cleanly.
  { title: "The Elder Scrolls: Arena (Freeware)", genre_tag: "rpg", subtype: "first-person-rpg", engine: "generic", description: "Bethesda's 1994 open-world RPG — the first Elder Scrolls. Roam the continent of Tamriel, delve dungeons, and stop the imperial battlemage Jagar Tharn. Released as freeware by Bethesda.", art_path: null, dosbox_config: "", install_path: "", executable: "ARENA.BAT", verified: 1, source_type: "bundled",
    folder_name: "ARENA",
    download_url: "https://archive.org/download/ARENA_201902/ARENA.zip",
    buy_url: null },

  { title: "Beneath a Steel Sky (Freeware)", genre_tag: "adventure", subtype: "point-and-click", engine: "generic", description: "Revolution Software's 1994 cyberpunk point-and-click adventure with comic art by Dave Gibbons. Robert Foster fights to survive the dystopian Union City. Released as freeware.", art_path: null, dosbox_config: "", install_path: "", executable: "SKY.EXE", verified: 0, source_type: "bundled",
    folder_name: "STEELSKY",
    download_url: "https://www.classicdosgames.com/files/games/revolution/sky-disk.zip",
    buy_url: null },

  { title: "Hugo's House of Horrors (Shareware)", genre_tag: "adventure", subtype: "parser-adventure", engine: "generic", description: "David P. Gray's 1990 shareware parser adventure. Hugo explores a spooky mansion to rescue his girlfriend Penelope from a mad scientist and a house full of monsters.", art_path: null, dosbox_config: "", install_path: "", executable: "HHH.EXE", verified: 0, source_type: "bundled",
    folder_name: "HUGO",
    download_url: "https://archive.org/download/msdos_Hugos_House_of_Horrors_1990/Hugos_House_of_Horrors_1990.zip",
    buy_url: null },

  { title: "Ken's Labyrinth (Shareware)", genre_tag: "fps", subtype: "raycaster", engine: "generic", description: "Ken Silverman's 1993 Epic MegaGames raycaster FPS — the precursor to his Build engine. Author's free full v2.1 release (fixes the v2.0 digitized-sound crash). Escape a labyrinth of monsters and slot machines to rescue your dog Sparky.", art_path: null, dosbox_config: "[cpu]\ncore=normal\ncycles=fixed 20000\n", install_path: "", executable: "KENSBFIX.EXE", setup_exe: "SETUP.EXE", verified: 0, source_type: "bundled",
    folder_name: "KENLAB",
    download_url: "https://advsys.net/ken/klab/labfull.zip",
    buy_url: null },

  // Pre-extracted PACK: ROCSW.EXE is the game (SB sound via bundled ROC.CFG). The raw
  // shareware download was installer-based (INSTALL.EXE + ROCSW10.SHR) — those are
  // stripped from the pack.
  { title: "Realms of Chaos (Shareware)", genre_tag: "platform", subtype: "side-scroller", engine: "generic", description: "Apogee's 1995 fantasy platformer. Tag-team between warrior Endrick and sorceress Elandra across a dark medieval world of monsters and magic. Music by Bobby Prince.", art_path: null, dosbox_config: "", install_path: "", executable: "ROCSW.EXE", setup_exe: null, verified: 1, source_type: "bundled",
    folder_name: "ROC",
    download_url: "https://www.classicdosgames.com/files/games/apogee/1roc.zip",
    buy_url: null },

  { title: "Epic Pinball (Shareware)", genre_tag: "action", subtype: "pinball", engine: "generic", description: "Epic MegaGames' 1993 pinball smash by James Schmalz — silky physics and a legendary Robert Allen soundtrack. The shareware 'Android' table in high-speed glory.", art_path: null, dosbox_config: "", install_path: "", executable: "PINBALL.EXE", setup_exe: "SETUP.EXE", verified: 0, source_type: "bundled",
    folder_name: "EPICPIN",
    download_url: "https://archive.org/download/Epic_Pinball_Shareware/Gold%20Medallion%20Software%20-%20Epic%20MegaGames%20-%20Epic%20Pinball.zip",
    buy_url: null },

  // Pre-extracted PACK: TOWERS.EXE is the real game exe (there is no MYSTIC.EXE; the raw
  // download's INSTALL.EXE/MTSW11.EXE self-extractor are stripped). Sound via TOWERS.CFG.
  { title: "Mystic Towers (Shareware)", genre_tag: "action", subtype: "isometric-action", engine: "generic", description: "Apogee's 1994 isometric action-adventure. Baron Baldric explores seven monster-infested towers, juggling health, hunger, and magic to cleanse each of its evil.", art_path: null, dosbox_config: "", install_path: "", executable: "TOWERS.EXE", setup_exe: "SETUP.EXE", verified: 1, source_type: "bundled",
    folder_name: "MYSTIC",
    download_url: "https://www.classicdosgames.com/files/games/animationfx/1mystic.zip",
    buy_url: null },

  // PART2.EXE is the game. PART1.EXE is just the intro (crashes in DOSBox), and
  // TUBWORLD.BAT runs checkms+part1+part2 so it inherits that crash — run PART2 directly.
  { title: "Tubular Worlds (Shareware)", genre_tag: "shooter", subtype: "horizontal-shmup", engine: "generic", description: "Creative Game Design's 1994 horizontal shoot-em-up published by Epic MegaGames. Blast through nine alien worlds with a deep weapon-upgrade arsenal and lush pixel art.", art_path: null, dosbox_config: "", install_path: "", executable: "PART2.EXE", setup_exe: null, verified: 1, source_type: "bundled",
    folder_name: "TUBULAR",
    download_url: "https://archive.org/download/msdos_Tubular_Worlds_1994/Tubular_Worlds_1994.zip",
    buy_url: null },

  { title: "Nitemare-3D (Shareware)", genre_tag: "fps", subtype: "raycaster", engine: "generic", description: "David P. Gray's 1994 horror FPS — a Wolf3D-style romp through a haunted mansion battling zombies, mummies, and monsters. A gruesome spin-off of the Hugo series.", art_path: null, dosbox_config: "", install_path: "", executable: "N3D.EXE", verified: 1, source_type: "bundled",
    folder_name: "NITE3D",
    download_url: "https://archive.org/download/msdos_Nitemare-3D_1994/Nitemare-3D_1994.zip",
    buy_url: null },

  { title: "Boppin' (Freeware)", genre_tag: "platform", subtype: "puzzle-platformer", engine: "generic", description: "Accursed Toys' 1994 Apogee puzzle-platformer. Yeet and Boik hurl each other to smash blocks across 300+ fiendish arcade puzzle levels. Released as freeware.", art_path: null, dosbox_config: "", install_path: "", executable: "BOPPIN.EXE", setup_exe: "SETUP.EXE", verified: 0, source_type: "bundled",
    folder_name: "BOPPIN",
    download_url: "https://archive.org/download/msdos_Boppin_1994/Boppin_1994.zip",
    buy_url: null },
];

// ── TURBODOS optimized packs ────────────────────────────────────────────────
// Pre-extracted, pre-configured game packs hosted on our own repo so the app just
// downloads → extracts → runs (no DOS installer, no manual sound setup). Packs are
// uploaded as release assets to github.com/CrossplayGaming/dosdeck-packs and served
// from PACK_BASE below.
//
// INCREMENTAL ROLLOUT: only list a game in PACK_GAMES *after* it is (1) verified
// working in-app and (2) its zip is uploaded to the v1 release. Listing a game flips
// its download_url to the pack; games not listed keep their existing source. This is
// the confirm-then-pack gate (see docs/PACK_STATUS.md) — never point a game at a pack
// that isn't uploaded yet, or its download will 404.
const PACK_BASE = "https://github.com/CrossplayGaming/dosdeck-packs/releases/download/v1";

// title → pack zip filename. Grows alphabetically as each game is confirmed + uploaded.
const PACK_GAMES = [
  { title: "Arctic Adventure (Freeware)",             file: "arctic-adventure.zip" },
  { title: "Bio Menace (Freeware)",                   file: "bio-menace.zip" },
  { title: "Blake Stone: Aliens of Gold (Shareware)", file: "blake-stone.zip" },
  { title: "Wolfenstein 3D (Shareware)",              file: "wolfenstein-3d.zip" },
  { title: "Crystal Caves",                           file: "crystal-caves.zip" },
  { title: "Cosmo's Cosmic Adventure (Shareware)",    file: "cosmos-cosmic-adventure.zip" },
  { title: "Dark Ages (Freeware)",                    file: "dark-ages.zip" },
  { title: "Death Rally (Shareware)",                 file: "death-rally.zip" },
  { title: "Duke Nukem (Shareware)",                  file: "duke-nukem.zip" },
  { title: "Duke Nukem II (Shareware)",               file: "duke-nukem-2.zip" },
  { title: "God of Thunder (Freeware)",               file: "god-of-thunder.zip" },
  { title: "Halloween Harry (Freeware)",              file: "halloween-harry.zip" },
  { title: "Hocus Pocus (Shareware)",                 file: "hocus-pocus.zip" },
  { title: "Jazz Jackrabbit (Shareware)",             file: "jazz-jackrabbit.zip" },
  { title: "Jetpack (Freeware)",                      file: "jetpack.zip" },
  { title: "Commander Keen 1",                        file: "commander-keen-1.zip" },
  { title: "Monuments of Mars (Freeware)",            file: "monuments-of-mars.zip" },
  { title: "Monster Bash (Shareware)",                file: "monster-bash.zip" },
  { title: "Major Stryker (Freeware)",                file: "major-stryker.zip" },
  { title: "Pharaoh's Tomb (Freeware)",               file: "pharaohs-tomb.zip" },
  { title: "Raptor: Call of the Shadows (Shareware)", file: "raptor.zip" },
  { title: "Secret Agent (Shareware)",                file: "secret-agent.zip" },
  { title: "Solar Winds: The Escape (Shareware)",     file: "solar-winds.zip" },
  { title: "Stargunner (Freeware)",                   file: "stargunner.zip" },
  { title: "Terminal Velocity (Shareware)",           file: "terminal-velocity.zip" },
  { title: "Tyrian 2000",                             file: "tyrian-2000.zip" },
  { title: "Wacky Wheels (Shareware)",                file: "wacky-wheels.zip" },
  { title: "Xargon (Freeware)",                       file: "xargon.zip" },
  { title: "Quake (Shareware)",                       file: "quake-sw.zip" },
  { title: "One Must Fall: 2097 (Shareware)",         file: "one-must-fall-2097.zip" },
  { title: "Descent (Shareware)",                     file: "descent.zip" },
  { title: "Keen Dreams (Freeware)",                  file: "keen-dreams.zip" },
  { title: "Jill of the Jungle (Shareware)",          file: "jill-of-the-jungle.zip" },
  { title: "Hexen (Shareware)",                       file: "hexen.zip" },
  { title: "Shadow Warrior (Shareware)",              file: "shadow-warrior.zip" },
  { title: "DOOM (Shareware)",                        file: "doom.zip" },
  { title: "Heretic (Shareware)",                     file: "heretic.zip" },
  { title: "Duke Nukem 3D",                           file: "duke-nukem-3d.zip" },
  { title: "Rise of the Triad (Shareware)",           file: "rise-of-the-triad.zip" },
  { title: "Commander Keen 4 (Shareware)",            file: "commander-keen-4.zip" },
  // Batch 3 — packed 2026-07-02 (verified + configured, uploaded to v1)
  { title: "Boppin' (Freeware)",                      file: "boppin.zip" },
  { title: "Epic Pinball (Shareware)",                file: "epic-pinball.zip" },
  { title: "Hugo's House of Horrors (Shareware)",     file: "hugos-house-of-horrors.zip" },
  { title: "Ken's Labyrinth (Shareware)",             file: "kens-labyrinth.zip" },
  { title: "Beneath a Steel Sky (Freeware)",          file: "beneath-a-steel-sky.zip" },
  // Batch 3 (round 2) — packed 2026-07-03 (verified + configured, uploaded to v1)
  { title: "Realms of Chaos (Shareware)",             file: "realms-of-chaos.zip" },
  { title: "Tubular Worlds (Shareware)",              file: "tubular-worlds.zip" },
  { title: "Nitemare-3D (Shareware)",                 file: "nitemare-3d.zip" },
  { title: "The Elder Scrolls: Arena (Freeware)",     file: "arena.zip" },
  { title: "Mystic Towers (Shareware)",               file: "mystic-towers.zip" },
];

// Patch SEED_GAMES in-place so fresh installs seed pack URLs and the existing
// "always overwrite download_url" migration propagates them to existing users.
if (PACK_BASE) {
  for (const p of PACK_GAMES) {
    const g = SEED_GAMES.find(g => g.title === p.title);
    if (g) {
      g.download_url = `${PACK_BASE}/${p.file}`;
      g.setup_exe = null; // packs are pre-configured — no manual setup step
    }
  }
}

const SEED_SCHEMES = [
  // ── DOOM (Shareware) ──────────────────────────────────────────────────────
  // Shareware has 3 weapons: Fist(1), Pistol(2), Shotgun(3)
  // Strafe modifier: hold Alt + Left/Right. Direct strafe: , and . (no modifier needed).
  { game_title: "DOOM (Shareware)", name: "Original 1993", input_style: "original", source: "core", bindings: [
    { action: "Move forward",       input: "Up",    dosbox_event: "key_up",        order: 1 },
    { action: "Move backward",      input: "Down",  dosbox_event: "key_down",      order: 2 },
    { action: "Turn left",          input: "Left",  dosbox_event: "key_left",      order: 3 },
    { action: "Turn right",         input: "Right", dosbox_event: "key_right",     order: 4 },
    { action: "Fire",               input: "Ctrl",  dosbox_event: "key_lctrl",     order: 5 },
    { action: "Use / Open",         input: "Space", dosbox_event: "key_space",     order: 6 },
    { action: "Strafe modifier",    input: "Alt",   dosbox_event: "key_lalt",      order: 7 },
    { action: "Strafe left",        input: ",",     dosbox_event: "key_comma",     order: 8 },
    { action: "Strafe right",       input: ".",     dosbox_event: "key_period",    order: 9 },
    { action: "Run",                input: "Shift", dosbox_event: "key_lshift",    order: 10 },
    { action: "Automap",            input: "Tab",   dosbox_event: "key_tab",       order: 11 },
    { action: "Weapon 1",           input: "1",     dosbox_event: "key_1",         order: 12 },
    { action: "Weapon 2",           input: "2",     dosbox_event: "key_2",         order: 13 },
    { action: "Weapon 3",           input: "3",     dosbox_event: "key_3",         order: 14 },
    { action: "Next weapon",        input: "]",     dosbox_event: "key_rbracket",  order: 15 },
    { action: "Prev weapon",        input: "[",     dosbox_event: "key_lbracket",  order: 16 },
    { action: "Save game",          input: "F2",    dosbox_event: "key_f2",        order: 17 },
    { action: "Load game",          input: "F3",    dosbox_event: "key_f3",        order: 18 },
    { action: "Quit",               input: "F10",   dosbox_event: "key_f10",       order: 19 },
    { action: "Pause / Menu",       input: "Esc",   dosbox_event: "key_esc",       order: 20 },
  ]},
  { game_title: "DOOM (Shareware)", name: "Modern WASD", input_style: "modern-kb", source: "core", always_run: 1, bindings: [
    { action: "Move forward",  input: "W",         dosbox_event: "key_up",       order: 1 },
    { action: "Move backward", input: "S",         dosbox_event: "key_down",     order: 2 },
    { action: "Strafe left",   input: "A",         dosbox_event: "key_comma",    order: 3 },
    { action: "Strafe right",  input: "D",         dosbox_event: "key_period",   order: 4 },
    { action: "Fire",          input: "LMB",       dosbox_event: "mouse_left",   order: 5 },
    { action: "Use / Open",    input: "E",         dosbox_event: "key_space",    order: 6 },
    { action: "Run",           input: "Shift",     dosbox_event: "key_lshift",   order: 7 },
    { action: "Weapon 1",      input: "1",         dosbox_event: "key_1",        order: 8 },
    { action: "Weapon 2",      input: "2",         dosbox_event: "key_2",        order: 9 },
    { action: "Weapon 3",      input: "3",         dosbox_event: "key_3",        order: 10 },
    { action: "Next weapon",   input: "WheelUp",   dosbox_event: "key_lbracket", order: 11 },
    { action: "Prev weapon",   input: "WheelDown", dosbox_event: "key_rbracket", order: 12 },
    { action: "Automap",       input: "Tab",       dosbox_event: "key_tab",      order: 13 },
    { action: "Pause / Menu",  input: "Esc",       dosbox_event: "key_esc",      order: 14 },
  ]},
  { game_title: "DOOM (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Heretic (Shareware) ───────────────────────────────────────────────────
  // id Tech 1 engine (same as DOOM). Unique additions: 7 weapons, inventory artifacts.
  // Inventory: [ = prev artifact, ] = next artifact, Enter = use artifact.
  // Weapons use number keys 1-7; no bracket weapon cycling like DOOM.
  { game_title: "Heretic (Shareware)", name: "Original", input_style: "original", source: "core", always_run: 1, bindings: [
    { action: "Move forward",       input: "Up",    dosbox_event: "key_up",       order: 1 },
    { action: "Move backward",      input: "Down",  dosbox_event: "key_down",     order: 2 },
    { action: "Turn left",          input: "Left",  dosbox_event: "key_left",     order: 3 },
    { action: "Turn right",         input: "Right", dosbox_event: "key_right",    order: 4 },
    { action: "Fire",               input: "Ctrl",  dosbox_event: "key_lctrl",    order: 5 },
    { action: "Use / Open",         input: "Space", dosbox_event: "key_space",    order: 6 },
    { action: "Strafe modifier",    input: "Alt",   dosbox_event: "key_lalt",     order: 7 },
    { action: "Strafe left",        input: ",",     dosbox_event: "key_comma",    order: 8 },
    { action: "Strafe right",       input: ".",     dosbox_event: "key_period",   order: 9 },
    { action: "Run",                input: "Shift", dosbox_event: "key_lshift",   order: 10 },
    { action: "Automap",            input: "Tab",   dosbox_event: "key_tab",      order: 11 },
    { action: "Weapon 1",           input: "1",     dosbox_event: "key_1",        order: 12 },
    { action: "Weapon 2",           input: "2",     dosbox_event: "key_2",        order: 13 },
    { action: "Weapon 3",           input: "3",     dosbox_event: "key_3",        order: 14 },
    { action: "Weapon 4",           input: "4",     dosbox_event: "key_4",        order: 15 },
    { action: "Weapon 5",           input: "5",     dosbox_event: "key_5",        order: 16 },
    { action: "Weapon 6",           input: "6",     dosbox_event: "key_6",        order: 17 },
    { action: "Weapon 7",           input: "7",     dosbox_event: "key_7",        order: 18 },
    { action: "Prev artifact",      input: "[",     dosbox_event: "key_lbracket", order: 19 },
    { action: "Next artifact",      input: "]",     dosbox_event: "key_rbracket", order: 20 },
    { action: "Use artifact",       input: "Enter", dosbox_event: "key_enter",    order: 21 },
    { action: "Save game",          input: "F2",    dosbox_event: "key_f2",       order: 22 },
    { action: "Load game",          input: "F3",    dosbox_event: "key_f3",       order: 23 },
    { action: "Quit",               input: "F10",   dosbox_event: "key_f10",      order: 24 },
    { action: "Pause / Menu",       input: "Esc",   dosbox_event: "key_esc",      order: 25 },
  ]},
  { game_title: "Heretic (Shareware)", name: "Modern WASD", input_style: "modern-kb", source: "core", bindings: [
    { action: "Move forward",       input: "W",         dosbox_event: "key_up",       order: 1 },
    { action: "Move backward",      input: "S",         dosbox_event: "key_down",     order: 2 },
    { action: "Strafe left",        input: "A",         dosbox_event: "key_comma",    order: 3 },
    { action: "Strafe right",       input: "D",         dosbox_event: "key_period",   order: 4 },
    { action: "Fire",               input: "LMB",       dosbox_event: "mouse_left",   order: 5 },
    { action: "Use / Open",         input: "E",         dosbox_event: "key_space",    order: 6 },
    { action: "Run",                input: "Shift",     dosbox_event: "key_lshift",   order: 7 },
    { action: "Automap",            input: "Tab",       dosbox_event: "key_tab",      order: 8 },
    { action: "Weapon 1",           input: "1",         dosbox_event: "key_1",        order: 9 },
    { action: "Weapon 2",           input: "2",         dosbox_event: "key_2",        order: 10 },
    { action: "Weapon 3",           input: "3",         dosbox_event: "key_3",        order: 11 },
    { action: "Weapon 4",           input: "4",         dosbox_event: "key_4",        order: 12 },
    { action: "Weapon 5",           input: "5",         dosbox_event: "key_5",        order: 13 },
    { action: "Weapon 6",           input: "6",         dosbox_event: "key_6",        order: 14 },
    { action: "Weapon 7",           input: "7",         dosbox_event: "key_7",        order: 15 },
    { action: "Prev artifact",      input: "[",         dosbox_event: "key_lbracket", order: 16 },
    { action: "Next artifact",      input: "]",         dosbox_event: "key_rbracket", order: 17 },
    { action: "Use artifact",       input: "Enter",     dosbox_event: "key_enter",    order: 18 },
    { action: "Pause / Menu",       input: "Esc",       dosbox_event: "key_esc",      order: 19 },
  ]},
  { game_title: "Heretic (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Wolfenstein 3D (Shareware) ────────────────────────────────────────────
  // Weapons: Knife(1), Pistol(2), Machine Gun(3), Chaingun(4)
  { game_title: "Wolfenstein 3D (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move forward",       input: "Up",    dosbox_event: "key_up",    order: 1 },
    { action: "Move backward",      input: "Down",  dosbox_event: "key_down",  order: 2 },
    { action: "Turn left",          input: "Left",  dosbox_event: "key_left",  order: 3 },
    { action: "Turn right",         input: "Right", dosbox_event: "key_right", order: 4 },
    { action: "Fire",               input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Open door",          input: "Space", dosbox_event: "key_space", order: 6 },
    { action: "Run",                input: "Shift", dosbox_event: "key_lshift",order: 7 },
    { action: "Strafe modifier",    input: "Alt",   dosbox_event: "key_lalt",  order: 8 },
    { action: "Weapon 1",           input: "1",     dosbox_event: "key_1",     order: 9 },
    { action: "Weapon 2",           input: "2",     dosbox_event: "key_2",     order: 10 },
    { action: "Weapon 3",           input: "3",     dosbox_event: "key_3",     order: 11 },
    { action: "Weapon 4",           input: "4",     dosbox_event: "key_4",     order: 12 },
    { action: "Help",               input: "F1",    dosbox_event: "key_f1",    order: 13 },
    { action: "Save game",          input: "F2",    dosbox_event: "key_f2",    order: 14 },
    { action: "Load game",          input: "F3",    dosbox_event: "key_f3",    order: 15 },
    { action: "Quit",               input: "F10",   dosbox_event: "key_f10",   order: 16 },
    { action: "Pause / Menu",       input: "Esc",   dosbox_event: "key_esc",   order: 17 },
  ]},
  // Modern WASD: mouse turns; A/D strafe by firing Alt+arrow simultaneously.
  // DOSBox fires both key_lalt and key_left when A is pressed, giving Wolf3D Alt+Left = strafe left.
  { game_title: "Wolfenstein 3D (Shareware)", name: "Modern WASD", input_style: "modern-kb", source: "core", bindings: [
    { action: "Move forward",  input: "W",     dosbox_event: "key_up",              order: 1 },
    { action: "Move backward", input: "S",     dosbox_event: "key_down",            order: 2 },
    { action: "Strafe left",   input: "A",     dosbox_event: "key_lalt+key_left",   order: 3 },
    { action: "Strafe right",  input: "D",     dosbox_event: "key_lalt+key_right",  order: 4 },
    { action: "Fire",          input: "LMB",   dosbox_event: "mouse_left",          order: 5 },
    { action: "Open door",     input: "E",     dosbox_event: "key_space",           order: 6 },
    { action: "Run",           input: "Shift", dosbox_event: "key_lshift",          order: 7 },
    { action: "Weapon 1",      input: "1",     dosbox_event: "key_1",               order: 8 },
    { action: "Weapon 2",      input: "2",     dosbox_event: "key_2",               order: 9 },
    { action: "Weapon 3",      input: "3",     dosbox_event: "key_3",               order: 10 },
    { action: "Weapon 4",      input: "4",     dosbox_event: "key_4",               order: 11 },
    { action: "Pause / Menu",  input: "Esc",   dosbox_event: "key_esc",             order: 12 },
  ]},
  { game_title: "Wolfenstein 3D (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Duke Nukem 3D ─────────────────────────────────────────────────────────
  // Original defaults: arrows turn/move, A/Z strafe, Ctrl fire, Space open, Enter jump, Alt crouch
  { game_title: "Duke Nukem 3D", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move forward",  input: "Up",    dosbox_event: "key_up",      order: 1 },
    { action: "Move backward", input: "Down",  dosbox_event: "key_down",    order: 2 },
    { action: "Turn left",     input: "Left",  dosbox_event: "key_left",    order: 3 },
    { action: "Turn right",    input: "Right", dosbox_event: "key_right",   order: 4 },
    { action: "Strafe left",   input: "A",     dosbox_event: "key_a",       order: 5 },
    { action: "Strafe right",  input: "Z",     dosbox_event: "key_z",       order: 6 },
    { action: "Fire",          input: "Ctrl",  dosbox_event: "key_lctrl",   order: 7 },
    { action: "Open / Use",    input: "Space", dosbox_event: "key_space",   order: 8 },
    { action: "Jump",          input: "Enter", dosbox_event: "key_enter",   order: 9 },
    { action: "Crouch",        input: "Alt",   dosbox_event: "key_lalt",    order: 10 },
    { action: "Run",           input: "Shift", dosbox_event: "key_lshift",  order: 11 },
    { action: "Look up",       input: "PgUp",  dosbox_event: "key_pageup",  order: 12 },
    { action: "Look down",     input: "PgDn",  dosbox_event: "key_pagedown",order: 13 },
    { action: "Center view",   input: "End",   dosbox_event: "key_end",     order: 14 },
    { action: "Automap",       input: "Tab",   dosbox_event: "key_tab",     order: 15 },
    { action: "Weapon 1",      input: "1",     dosbox_event: "key_1",       order: 16 },
    { action: "Weapon 2",      input: "2",     dosbox_event: "key_2",       order: 17 },
    { action: "Weapon 3",      input: "3",     dosbox_event: "key_3",       order: 18 },
    { action: "Weapon 4",      input: "4",     dosbox_event: "key_4",       order: 19 },
    { action: "Weapon 5",      input: "5",     dosbox_event: "key_5",       order: 20 },
    { action: "Weapon 6",      input: "6",     dosbox_event: "key_6",       order: 21 },
    { action: "Weapon 7",      input: "7",     dosbox_event: "key_7",       order: 22 },
    { action: "Next weapon",   input: "]",     dosbox_event: "key_rbracket", order: 23 },
    { action: "Prev weapon",   input: "[",     dosbox_event: "key_lbracket", order: 24 },
    { action: "Save game",     input: "F2",    dosbox_event: "key_f2",      order: 25 },
    { action: "Load game",     input: "F3",    dosbox_event: "key_f3",      order: 26 },
    { action: "Quit",          input: "F10",   dosbox_event: "key_f10",     order: 27 },
    { action: "Pause / Menu",  input: "Esc",   dosbox_event: "key_esc",     order: 28 },
  ]},
  // Modern WASD: W/S move, A/D strafe (A→key_a already strafe-left; D→key_z strafe-right in-game)
  { game_title: "Duke Nukem 3D", name: "Modern WASD", input_style: "modern-kb", source: "core", always_run: 1, bindings: [
    { action: "Move forward",  input: "W",         dosbox_event: "key_up",      order: 1 },
    { action: "Move backward", input: "S",         dosbox_event: "key_down",    order: 2 },
    { action: "Strafe left",   input: "A",         dosbox_event: "key_a",       order: 3 },
    { action: "Strafe right",  input: "D",         dosbox_event: "key_z",       order: 4 },
    { action: "Fire",          input: "LMB",       dosbox_event: "mouse_left",  order: 5 },
    { action: "Open / Use",    input: "E",         dosbox_event: "key_space",   order: 6 },
    { action: "Jump",          input: "Space",     dosbox_event: "key_enter",   order: 7 },
    { action: "Crouch",        input: "C",         dosbox_event: "key_lalt",    order: 8 },
    { action: "Run",           input: "Shift",     dosbox_event: "key_lshift",  order: 9 },
    { action: "Weapon 1",      input: "1",         dosbox_event: "key_1",       order: 10 },
    { action: "Weapon 2",      input: "2",         dosbox_event: "key_2",       order: 11 },
    { action: "Weapon 3",      input: "3",         dosbox_event: "key_3",       order: 12 },
    { action: "Weapon 4",      input: "4",         dosbox_event: "key_4",       order: 13 },
    { action: "Weapon 5",      input: "5",         dosbox_event: "key_5",       order: 14 },
    { action: "Weapon 6",      input: "6",         dosbox_event: "key_6",       order: 15 },
    { action: "Weapon 7",      input: "7",         dosbox_event: "key_7",       order: 16 },
    { action: "Next weapon",   input: "WheelUp",   dosbox_event: "key_lbracket",order: 17 },
    { action: "Prev weapon",   input: "WheelDown", dosbox_event: "key_rbracket",order: 18 },
    { action: "Look up",       input: "PgUp",      dosbox_event: "",            order: 19 },
    { action: "Look down",     input: "PgDn",      dosbox_event: "",            order: 20 },
    { action: "Center view",   input: "End",       dosbox_event: "",            order: 21 },
    { action: "Automap",       input: "Tab",       dosbox_event: "key_tab",     order: 22 },
    { action: "Pause / Menu",  input: "Esc",       dosbox_event: "key_esc",     order: 23 },
  ]},
  { game_title: "Duke Nukem 3D", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Commander Keen 1 ──────────────────────────────────────────────────────
  // Ctrl=Jump; Alt=Pogo; Ctrl+Alt simultaneously=Fire raygun (chord, not a separate binding)
  { game_title: "Commander Keen 1", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",       input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",      input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Look up / Enter", input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Move down",       input: "Down",  dosbox_event: "key_down",  order: 4 },
    { action: "Jump",            input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Pogo stick",      input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
    { action: "Status screen",   input: "Space", dosbox_event: "key_space", order: 7 },
    { action: "Help",            input: "F1",    dosbox_event: "key_f1",    order: 8 },
    { action: "Sound on/off",    input: "F2",    dosbox_event: "key_f2",    order: 9 },
    { action: "Save game",       input: "F5",    dosbox_event: "key_f5",    order: 10 },
    { action: "Quit",            input: "Esc",   dosbox_event: "key_esc",   order: 11 },
  ]},
  { game_title: "Commander Keen 1", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── The Secret of Monkey Island ───────────────────────────────────────────
  // Mouse-driven SCUMM game. LMB selects verbs/objects; RMB walks. No examine on RMB.
  // ── Tyrian 2000 ───────────────────────────────────────────────────────────
  // Arrow keys move ship; Ctrl = front weapon; Alt = rear weapon; Delete = sidekick/bomb
  { game_title: "Tyrian 2000", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move up",             input: "Up",     dosbox_event: "key_up",     order: 1 },
    { action: "Move down",           input: "Down",   dosbox_event: "key_down",   order: 2 },
    { action: "Move left",           input: "Left",   dosbox_event: "key_left",   order: 3 },
    { action: "Move right",          input: "Right",  dosbox_event: "key_right",  order: 4 },
    { action: "Fire front",          input: "Ctrl",   dosbox_event: "key_lctrl",  order: 5 },
    { action: "Fire rear",           input: "Alt",    dosbox_event: "key_lalt",   order: 6 },
    { action: "Sidekick / Special",  input: "Delete", dosbox_event: "key_delete", order: 7 },
    { action: "Pause / Menu",        input: "Esc",    dosbox_event: "key_esc",    order: 8 },
  ]},
  { game_title: "Tyrian 2000", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Crystal Caves ─────────────────────────────────────────────────────────
  // Arrow keys move; Up also climbs ladders; Alt jumps; Ctrl shoots; Esc pauses
  { game_title: "Crystal Caves", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",         input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",        input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Climb / Look up",   input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Jump",              input: "Ctrl",  dosbox_event: "key_lctrl", order: 4 },
    { action: "Shoot",             input: "Alt",   dosbox_event: "key_lalt",  order: 5 },
    { action: "Help",              input: "F1",    dosbox_event: "key_f1",    order: 6 },
    { action: "Save game",         input: "F5",    dosbox_event: "key_f5",    order: 7 },
    { action: "Quit",              input: "F10",   dosbox_event: "key_f10",   order: 8 },
    { action: "Pause",             input: "Esc",   dosbox_event: "key_esc",   order: 9 },
  ]},
  { game_title: "Crystal Caves", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Duke Nukem (Shareware) ────────────────────────────────────────────────
  // Apogee engine default: Ctrl=Jump, Alt=Fire (same as Crystal Caves). Space=bomb.
  { game_title: "Duke Nukem (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",   input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",  input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Duck",        input: "Down",  dosbox_event: "key_down",  order: 3 },
    { action: "Jump",        input: "Ctrl",  dosbox_event: "key_lctrl", order: 4 },
    { action: "Fire",        input: "Alt",   dosbox_event: "key_lalt",  order: 5 },
    { action: "Throw bomb",  input: "Space", dosbox_event: "key_space", order: 6 },
    { action: "Help",        input: "F1",    dosbox_event: "key_f1",    order: 7 },
    { action: "Save game",   input: "F5",    dosbox_event: "key_f5",    order: 8 },
    { action: "Quit",        input: "F10",   dosbox_event: "key_f10",   order: 9 },
    { action: "Pause",       input: "P",     dosbox_event: "key_p",     order: 10 },
    { action: "Status",      input: "Esc",   dosbox_event: "key_esc",   order: 11 },
  ]},
  { game_title: "Duke Nukem (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Duke Nukem II (Shareware) ─────────────────────────────────────────────
  // Same Apogee engine as DN1 and Crystal Caves: Ctrl=Jump, Alt=Fire. Space cycles weapons.
  { game_title: "Duke Nukem II (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",    input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",   input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Duck",         input: "Down",  dosbox_event: "key_down",  order: 3 },
    { action: "Jump",         input: "Ctrl",  dosbox_event: "key_lctrl", order: 4 },
    { action: "Fire",         input: "Alt",   dosbox_event: "key_lalt",  order: 5 },
    { action: "Cycle weapon", input: "Space", dosbox_event: "key_space", order: 6 },
    { action: "Help",         input: "F1",    dosbox_event: "key_f1",    order: 7 },
    { action: "Save game",    input: "F5",    dosbox_event: "key_f5",    order: 8 },
    { action: "Quit",         input: "F10",   dosbox_event: "key_f10",   order: 9 },
    { action: "Pause",        input: "P",     dosbox_event: "key_p",     order: 10 },
    { action: "Status",       input: "Esc",   dosbox_event: "key_esc",   order: 11 },
  ]},
  { game_title: "Duke Nukem II (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Secret Agent (Shareware) ──────────────────────────────────────────────
  // Same Apogee engine as Crystal Caves / Duke Nukem 1. Verified in-game.
  // Screenshot confirmed: Arrow Keys = Move, Alt = Fire, Ctrl = Jump.
  // F1 during game opens key redefine / joystick config screen.
  { game_title: "Secret Agent (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",   input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",  input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Move up",     input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Duck",        input: "Down",  dosbox_event: "key_down",  order: 4 },
    { action: "Jump",        input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Fire",        input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
    { action: "Redefine keys / Joystick", input: "F1",  dosbox_event: "key_f1",  order: 7 },
    { action: "Save game",   input: "F5",    dosbox_event: "key_f5",    order: 8 },
    { action: "Quit",        input: "F10",   dosbox_event: "key_f10",   order: 9 },
    { action: "Pause",       input: "Esc",   dosbox_event: "key_esc",   order: 10 },
  ]},
  { game_title: "Secret Agent (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Cosmo's Cosmic Adventure (Shareware) ──────────────────────────────────
  // Same Apogee engine as Crystal Caves / Duke Nukem 1. Confirmed identical control layout.
  { game_title: "Cosmo's Cosmic Adventure (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",       input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",      input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Look up / Climb", input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Duck",            input: "Down",  dosbox_event: "key_down",  order: 4 },
    { action: "Jump",            input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Shoot",           input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
    { action: "Help",            input: "F1",    dosbox_event: "key_f1",    order: 7 },
    { action: "Save game",       input: "F5",    dosbox_event: "key_f5",    order: 8 },
    { action: "Quit",            input: "F10",   dosbox_event: "key_f10",   order: 9 },
    { action: "Pause",           input: "Esc",   dosbox_event: "key_esc",   order: 10 },
  ]},
  { game_title: "Cosmo's Cosmic Adventure (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Monster Bash (Shareware) ───────────────────────────────────────────────
  // Same Apogee engine as Crystal Caves. Ctrl=Jump, Alt=Shoot.
  { game_title: "Monster Bash (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",   input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",  input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Look up",     input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Duck",        input: "Down",  dosbox_event: "key_down",  order: 4 },
    { action: "Jump",        input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Shoot",       input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
    { action: "Help",        input: "F1",    dosbox_event: "key_f1",    order: 7 },
    { action: "Save game",   input: "F5",    dosbox_event: "key_f5",    order: 8 },
    { action: "Quit",        input: "F10",   dosbox_event: "key_f10",   order: 9 },
    { action: "Pause",       input: "Esc",   dosbox_event: "key_esc",   order: 10 },
  ]},
  { game_title: "Monster Bash (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Bio Menace (Freeware) ─────────────────────────────────────────────────
  // Same Apogee engine as Duke Nukem 1. Ctrl=Jump, Alt=Fire, Space=Grenade.
  { game_title: "Bio Menace (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",    input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",   input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Up / Climb",   input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Duck",         input: "Down",  dosbox_event: "key_down",  order: 4 },
    { action: "Jump",         input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Fire",         input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
    { action: "Throw grenade",input: "Space", dosbox_event: "key_space", order: 7 },
    { action: "Help",         input: "F1",    dosbox_event: "key_f1",    order: 8 },
    { action: "Save game",    input: "F5",    dosbox_event: "key_f5",    order: 9 },
    { action: "Quit",         input: "F10",   dosbox_event: "key_f10",   order: 10 },
    { action: "Pause",        input: "P",     dosbox_event: "key_p",     order: 11 },
    { action: "Status",       input: "Esc",   dosbox_event: "key_esc",   order: 12 },
  ]},
  { game_title: "Bio Menace (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Hocus Pocus (Shareware) ───────────────────────────────────────────────
  // Apogee engine. Ctrl=Jump, Alt=Cast spell.
  { game_title: "Hocus Pocus (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",   input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",  input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Duck",        input: "Down",  dosbox_event: "key_down",  order: 3 },
    { action: "Jump",        input: "Ctrl",  dosbox_event: "key_lctrl", order: 4 },
    { action: "Cast spell",  input: "Alt",   dosbox_event: "key_lalt",  order: 5 },
    { action: "Help",        input: "F1",    dosbox_event: "key_f1",    order: 6 },
    { action: "Save game",   input: "F5",    dosbox_event: "key_f5",    order: 7 },
    { action: "Quit",        input: "F10",   dosbox_event: "key_f10",   order: 8 },
    { action: "Pause",       input: "Esc",   dosbox_event: "key_esc",   order: 9 },
  ]},
  { game_title: "Hocus Pocus (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Halloween Harry (Freeware) ────────────────────────────────────────────
  // Apogee engine. Left/Right=move, Ctrl=Jump/Jetpack, Alt=Fire.
  { game_title: "Halloween Harry (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",      input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",     input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Duck",           input: "Down",  dosbox_event: "key_down",  order: 3 },
    { action: "Jump / Jetpack", input: "Ctrl",  dosbox_event: "key_lctrl", order: 4 },
    { action: "Fire",           input: "Alt",   dosbox_event: "key_lalt",  order: 5 },
    { action: "Help",           input: "F1",    dosbox_event: "key_f1",    order: 6 },
    { action: "Save game",      input: "F5",    dosbox_event: "key_f5",    order: 7 },
    { action: "Quit",           input: "F10",   dosbox_event: "key_f10",   order: 8 },
    { action: "Pause",          input: "Esc",   dosbox_event: "key_esc",   order: 9 },
  ]},
  { game_title: "Halloween Harry (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Arctic Adventure (Freeware) ───────────────────────────────────────────
  // Early Apogee engine (1990). Arrow keys move; Space=Jump, Alt=Fire. (Ctrl is NOT jump — verified from in-game instructions.)
  { game_title: "Arctic Adventure (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",   input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",  input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Climb / Jump",input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Crouch",      input: "Down",  dosbox_event: "key_down",  order: 4 },
    { action: "Jump",        input: "Space", dosbox_event: "key_space", order: 5 },
    { action: "Fire",        input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
    { action: "Pause",       input: "Esc",   dosbox_event: "key_esc",   order: 7 },
  ]},
  { game_title: "Arctic Adventure (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Pharaoh's Tomb (Freeware) ─────────────────────────────────────────────
  // Early Apogee engine (1990). Same control scheme as Arctic Adventure.
  { game_title: "Pharaoh's Tomb (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",   input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",  input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Climb / Jump",input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Crouch",      input: "Down",  dosbox_event: "key_down",  order: 4 },
    { action: "Jump",        input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Fire",        input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
    { action: "Pause",       input: "Esc",   dosbox_event: "key_esc",   order: 7 },
  ]},
  { game_title: "Pharaoh's Tomb (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Monuments of Mars (Freeware) ──────────────────────────────────────────
  // Early Apogee engine (1991). Arrow keys move; Ctrl=Jump, Alt=Fire.
  { game_title: "Monuments of Mars (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",   input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",  input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Climb / Jump",input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Crouch",      input: "Down",  dosbox_event: "key_down",  order: 4 },
    { action: "Jump",        input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Fire",        input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
    { action: "Pause",       input: "Esc",   dosbox_event: "key_esc",   order: 7 },
  ]},
  { game_title: "Monuments of Mars (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Dark Ages (Freeware) ──────────────────────────────────────────────────
  // Early Apogee engine (1991). Same control layout as other early Apogee platformers.
  { game_title: "Dark Ages (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",   input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",  input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Climb",       input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Duck",        input: "Down",  dosbox_event: "key_down",  order: 4 },
    { action: "Jump",        input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Attack",      input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
    { action: "Pause",       input: "Esc",   dosbox_event: "key_esc",   order: 7 },
  ]},
  { game_title: "Dark Ages (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Raptor: Call of the Shadows (Shareware) ───────────────────────────────
  { game_title: "Raptor: Call of the Shadows (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Up",                    input: "Up",    dosbox_event: "key_up",     order: 1 },
    { action: "Down",                  input: "Down",  dosbox_event: "key_down",   order: 2 },
    { action: "Left",                  input: "Left",  dosbox_event: "key_left",   order: 3 },
    { action: "Right",                 input: "Right", dosbox_event: "key_right",  order: 4 },
    { action: "Dumbfire Missiles",     input: "1",     dosbox_event: "key_1",      order: 5 },
    { action: "Mini-Gun",              input: "2",     dosbox_event: "key_2",      order: 6 },
    { action: "Laser Turret",          input: "3",     dosbox_event: "key_3",      order: 7 },
    { action: "Missile Pod",           input: "4",     dosbox_event: "key_4",      order: 8 },
    { action: "Air/Air Missiles",      input: "5",     dosbox_event: "key_5",      order: 9 },
    { action: "Air/Ground Missiles",   input: "6",     dosbox_event: "key_6",      order: 10 },
    { action: "Bomb",                  input: "7",     dosbox_event: "key_7",      order: 11 },
    { action: "Power Disrupter",       input: "8",     dosbox_event: "key_8",      order: 12 },
    { action: "Pulse Cannon",          input: "9",     dosbox_event: "key_9",      order: 13 },
    { action: "Deathray",              input: "0",     dosbox_event: "key_0",      order: 14 },
    { action: "Twin Laser",            input: "-",     dosbox_event: "key_-",      order: 15 },
    { action: "Megabomb",              input: "Space", dosbox_event: "key_space",  order: 16 },
    { action: "Fire",                  input: "Ctrl",  dosbox_event: "key_lctrl",  order: 17 },
    { action: "Cycle Weapons",         input: "Alt",   dosbox_event: "key_lalt",   order: 18 },
  ]},
  { game_title: "Raptor: Call of the Shadows (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Jazz Jackrabbit (Shareware) ───────────────────────────────────────────
  { game_title: "Jazz Jackrabbit (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Left",    input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Right",   input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Up",      input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Down",    input: "Down",  dosbox_event: "key_down",  order: 4 },
    { action: "Jump",    input: "Alt",   dosbox_event: "key_lalt",  order: 5 },
    { action: "Fire",    input: "Space", dosbox_event: "key_space", order: 6 },
    { action: "Special", input: "Ctrl",  dosbox_event: "key_lctrl", order: 7 },
  ]},
  { game_title: "Jazz Jackrabbit (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Major Stryker (Freeware) ──────────────────────────────────────────────
  { game_title: "Major Stryker (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Up",           input: "Up",    dosbox_event: "key_up",    order: 1 },
    { action: "Down",         input: "Down",  dosbox_event: "key_down",  order: 2 },
    { action: "Left",         input: "Left",  dosbox_event: "key_left",  order: 3 },
    { action: "Right",        input: "Right", dosbox_event: "key_right", order: 4 },
    { action: "Fire",         input: "Alt",   dosbox_event: "key_lalt",  order: 5 },
    { action: "Zap Bomb",     input: "Space", dosbox_event: "key_space", order: 6 },
    { action: "Pause",        input: "P",     dosbox_event: "key_p",     order: 7 },
    { action: "Music Toggle", input: "M",     dosbox_event: "key_m",     order: 8 },
    { action: "Toggle Sound", input: "S",     dosbox_event: "key_s",     order: 9 },
    { action: "Help",         input: "F1",    dosbox_event: "key_f1",    order: 10 },
  ]},
  { game_title: "Major Stryker (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Stargunner (Freeware) ─────────────────────────────────────────────────
  { game_title: "Stargunner (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Up",    input: "Up",    dosbox_event: "key_up",    order: 1 },
    { action: "Down",  input: "Down",  dosbox_event: "key_down",  order: 2 },
    { action: "Left",  input: "Left",  dosbox_event: "key_left",  order: 3 },
    { action: "Right", input: "Right", dosbox_event: "key_right", order: 4 },
    { action: "Fire",  input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Bomb",  input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
  ]},
  { game_title: "Stargunner (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Wacky Wheels (Shareware) ──────────────────────────────────────────────
  { game_title: "Wacky Wheels (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Left",           input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Right",          input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Accelerate",     input: "Alt",   dosbox_event: "key_lalt",  order: 3 },
    { action: "Fire",           input: "Ctrl",  dosbox_event: "key_lctrl", order: 4 },
    { action: "Brake",          input: "Down",  dosbox_event: "key_down",  order: 5 },
    { action: "Hand Brake Turn",input: "Space", dosbox_event: "key_space", order: 6 },
  ]},
  { game_title: "Wacky Wheels (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Death Rally (Shareware) ───────────────────────────────────────────────
  { game_title: "Death Rally (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Accelerate",  input: "Up",    dosbox_event: "key_up",    order: 1 },
    { action: "Brake",       input: "Down",  dosbox_event: "key_down",  order: 2 },
    { action: "Steer Left",  input: "Left",  dosbox_event: "key_left",  order: 3 },
    { action: "Steer Right", input: "Right", dosbox_event: "key_right", order: 4 },
    { action: "Turbo Boost", input: "Space", dosbox_event: "key_space", order: 5 },
    { action: "Machine Gun", input: "Z",     dosbox_event: "key_z",     order: 6 },
    { action: "Drop Mine",   input: "X",     dosbox_event: "key_x",     order: 7 },
    { action: "Horn",        input: "H",     dosbox_event: "key_h",     order: 8 },
  ]},
  { game_title: "Death Rally (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Jill of the Jungle (Shareware) ───────────────────────────────────────
  { game_title: "Jill of the Jungle (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Left",              input: "Left",  dosbox_event: "key_left",   order: 1 },
    { action: "Right",             input: "Right", dosbox_event: "key_right",  order: 2 },
    { action: "Jump",              input: "Shift", dosbox_event: "key_lshift", order: 3 },
    { action: "Attack",            input: "Alt",   dosbox_event: "key_lalt",   order: 4 },
    { action: "Help",              input: "F1",    dosbox_event: "key_f1",     order: 5 },
    { action: "Noise",             input: "N",     dosbox_event: "key_n",      order: 6 },
    { action: "Quit",              input: "Q",     dosbox_event: "key_q",      order: 7 },
    { action: "Save",              input: "S",     dosbox_event: "key_s",      order: 8 },
    { action: "Restore",           input: "R",     dosbox_event: "key_r",      order: 9 },
    { action: "Turtle",            input: "T",     dosbox_event: "key_t",      order: 10 },
    { action: "Look Up",           input: "Up",    dosbox_event: "key_up",     order: 11 },
    { action: "Crouch / Look Down",input: "Down",  dosbox_event: "key_down",   order: 12 },
  ]},
  { game_title: "Jill of the Jungle (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Jetpack (Freeware) ────────────────────────────────────────────────────
  { game_title: "Jetpack (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Left",     input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Right",    input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Thrust",   input: "Ctrl",  dosbox_event: "key_lctrl", order: 3 },
    { action: "Faster",   input: "+",     dosbox_event: "key_+",     order: 4 },
    { action: "Slower",   input: "-",     dosbox_event: "key_-",     order: 5 },
    { action: "Status",   input: "Space", dosbox_event: "key_space", order: 6 },
    { action: "Help",     input: "F1",    dosbox_event: "key_f1",    order: 7 },
    { action: "Boss Key", input: "F10",   dosbox_event: "key_f10",   order: 8 },
  ]},
  { game_title: "Jetpack (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── God of Thunder (Freeware) ─────────────────────────────────────────────
  { game_title: "God of Thunder (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Up",             input: "Up",    dosbox_event: "key_up",    order: 1 },
    { action: "Down",           input: "Down",  dosbox_event: "key_down",  order: 2 },
    { action: "Left",           input: "Left",  dosbox_event: "key_left",  order: 3 },
    { action: "Right",          input: "Right", dosbox_event: "key_right", order: 4 },
    { action: "Throw Hammer",   input: "Alt",   dosbox_event: "key_lalt",  order: 5 },
    { action: "Select Item",    input: "Space", dosbox_event: "key_space", order: 6 },
    { action: "Use Item",       input: "Ctrl",  dosbox_event: "key_lctrl", order: 7 },
    { action: "Die",            input: "D",     dosbox_event: "key_d",     order: 8 },
    { action: "Save Game",      input: "S",     dosbox_event: "key_s",     order: 9 },
    { action: "Load Game",      input: "L",     dosbox_event: "key_l",     order: 10 },
    { action: "Hint Reference", input: "2",     dosbox_event: "key_2",     order: 11 },
  ]},
  { game_title: "God of Thunder (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Xargon (Freeware) ────────────────────────────────────────────────────
  { game_title: "Xargon (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Up",                  input: "Up",    dosbox_event: "key_up",     order: 1 },
    { action: "Down",                input: "Down",  dosbox_event: "key_down",   order: 2 },
    { action: "Left",                input: "Left",  dosbox_event: "key_left",   order: 3 },
    { action: "Right",               input: "Right", dosbox_event: "key_right",  order: 4 },
    { action: "Jump",                input: "Ctrl",  dosbox_event: "key_lctrl",  order: 5 },
    { action: "Fire",                input: "Shift", dosbox_event: "key_lshift", order: 6 },
    { action: "Help",                input: "F1",    dosbox_event: "key_f1",     order: 7 },
    { action: "Save",                input: "S",     dosbox_event: "key_s",      order: 8 },
    { action: "Load",                input: "L",     dosbox_event: "key_l",      order: 9 },
    { action: "Pause",               input: "P",     dosbox_event: "key_p",      order: 10 },
    { action: "Granny Mode Toggle",  input: "G",     dosbox_event: "key_g",      order: 11 },
    { action: "Sound Toggle",        input: "N",     dosbox_event: "key_n",      order: 12 },
    { action: "Buy Extra Items",     input: "B",     dosbox_event: "key_b",      order: 13 },
    { action: "Inventory",           input: "Enter", dosbox_event: "key_enter",  order: 14 },
  ]},
  { game_title: "Xargon (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Commander Keen 4 (Shareware) ──────────────────────────────────────────
  // Galaxy engine (Keen 4-6) — UNLIKE Vorticons Keen 1, it has a dedicated Fire
  // button. In-game defaults (verified): Jump=Ctrl, Pogo=Alt, Fire=Space.
  { game_title: "Commander Keen 4 (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",    input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",   input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Move up",      input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Move down",    input: "Down",  dosbox_event: "key_down",  order: 4 },
    { action: "Jump",         input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Pogo stick",   input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
    { action: "Fire",         input: "Space", dosbox_event: "key_space", order: 7 },
    { action: "Help",         input: "F1",    dosbox_event: "key_f1",    order: 8 },
    { action: "Save game",    input: "F5",    dosbox_event: "key_f5",    order: 9 },
    { action: "Quit",         input: "F10",   dosbox_event: "key_f10",   order: 10 },
    { action: "Pause",        input: "Esc",   dosbox_event: "key_esc",   order: 11 },
  ]},
  { game_title: "Commander Keen 4 (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Keen Dreams (Freeware) ────────────────────────────────────────────────
  // Same engine as Keen 1-3. Ctrl=Jump, Alt=throw flower bomb.
  { game_title: "Keen Dreams (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",    input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",   input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Move up",      input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Duck",         input: "Down",  dosbox_event: "key_down",  order: 4 },
    { action: "Jump",         input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Throw flower", input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
    { action: "Status",       input: "Space", dosbox_event: "key_space", order: 7 },
    { action: "Help",         input: "F1",    dosbox_event: "key_f1",    order: 8 },
    { action: "Save game",    input: "F5",    dosbox_event: "key_f5",    order: 9 },
    { action: "Quit",         input: "F10",   dosbox_event: "key_f10",   order: 10 },
    { action: "Pause",        input: "Esc",   dosbox_event: "key_esc",   order: 11 },
  ]},
  { game_title: "Keen Dreams (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Blake Stone: Aliens of Gold (Shareware) ───────────────────────────────
  // Wolf3D engine. Same movement/fire scheme as Wolf3D but 7 weapons.
  { game_title: "Blake Stone: Aliens of Gold (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move forward",    input: "Up",    dosbox_event: "key_up",      order: 1 },
    { action: "Move backward",   input: "Down",  dosbox_event: "key_down",    order: 2 },
    { action: "Turn left",       input: "Left",  dosbox_event: "key_left",    order: 3 },
    { action: "Turn right",      input: "Right", dosbox_event: "key_right",   order: 4 },
    { action: "Fire",            input: "Ctrl",  dosbox_event: "key_lctrl",   order: 5 },
    { action: "Open / Activate", input: "Space", dosbox_event: "key_space",   order: 6 },
    { action: "Run",             input: "Shift", dosbox_event: "key_lshift",  order: 7 },
    { action: "Strafe modifier", input: "Alt",   dosbox_event: "key_lalt",    order: 8 },
    { action: "Weapon 1",        input: "1",     dosbox_event: "key_1",       order: 9 },
    { action: "Weapon 2",        input: "2",     dosbox_event: "key_2",       order: 10 },
    { action: "Weapon 3",        input: "3",     dosbox_event: "key_3",       order: 11 },
    { action: "Weapon 4",        input: "4",     dosbox_event: "key_4",       order: 12 },
    { action: "Weapon 5",        input: "5",     dosbox_event: "key_5",       order: 13 },
    { action: "Weapon 6",        input: "6",     dosbox_event: "key_6",       order: 14 },
    { action: "Weapon 7",        input: "7",     dosbox_event: "key_7",       order: 15 },
    { action: "Save game",       input: "F2",    dosbox_event: "key_f2",      order: 16 },
    { action: "Load game",       input: "F3",    dosbox_event: "key_f3",      order: 17 },
    { action: "Quit",            input: "F10",   dosbox_event: "key_f10",     order: 18 },
    { action: "Pause / Menu",    input: "Esc",   dosbox_event: "key_esc",     order: 19 },
  ]},
  // Modern WASD: mouse turns; A/D strafe via Alt+arrow combo (same engine/approach as Wolf3D).
  { game_title: "Blake Stone: Aliens of Gold (Shareware)", name: "Modern WASD", input_style: "modern-kb", source: "core", bindings: [
    { action: "Move forward",    input: "W",     dosbox_event: "key_up",             order: 1 },
    { action: "Move backward",   input: "S",     dosbox_event: "key_down",           order: 2 },
    { action: "Strafe left",     input: "A",     dosbox_event: "key_lalt+key_left",  order: 3 },
    { action: "Strafe right",    input: "D",     dosbox_event: "key_lalt+key_right", order: 4 },
    { action: "Fire",            input: "LMB",   dosbox_event: "mouse_left",         order: 5 },
    { action: "Open / Activate", input: "E",     dosbox_event: "key_space",          order: 6 },
    { action: "Run",             input: "Shift", dosbox_event: "key_lshift",         order: 7 },
    { action: "Weapon 1",        input: "1",     dosbox_event: "key_1",              order: 8 },
    { action: "Weapon 2",        input: "2",     dosbox_event: "key_2",              order: 9 },
    { action: "Weapon 3",        input: "3",     dosbox_event: "key_3",              order: 10 },
    { action: "Weapon 4",        input: "4",     dosbox_event: "key_4",              order: 11 },
    { action: "Weapon 5",        input: "5",     dosbox_event: "key_5",              order: 12 },
    { action: "Weapon 6",        input: "6",     dosbox_event: "key_6",              order: 13 },
    { action: "Weapon 7",        input: "7",     dosbox_event: "key_7",              order: 14 },
    { action: "Pause / Menu",    input: "Esc",   dosbox_event: "key_esc",            order: 15 },
  ]},
  { game_title: "Blake Stone: Aliens of Gold (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Hexen (Shareware) ─────────────────────────────────────────────────────
  // DOOM engine (heavily modified). 3 character classes, 4 weapons each, artifact inventory.
  { game_title: "Hexen (Shareware)", name: "Original", input_style: "original", source: "core", always_run: 1, bindings: [
    { action: "Move forward",   input: "Up",    dosbox_event: "key_up",       order: 1 },
    { action: "Move backward",  input: "Down",  dosbox_event: "key_down",     order: 2 },
    { action: "Turn left",      input: "Left",  dosbox_event: "key_left",     order: 3 },
    { action: "Turn right",     input: "Right", dosbox_event: "key_right",    order: 4 },
    { action: "Attack",         input: "Ctrl",  dosbox_event: "key_lctrl",    order: 5 },
    { action: "Use",            input: "Space", dosbox_event: "key_space",    order: 6 },
    { action: "Strafe modifier",input: "Alt",   dosbox_event: "key_lalt",     order: 7 },
    { action: "Strafe left",    input: ",",     dosbox_event: "key_comma",    order: 8 },
    { action: "Strafe right",   input: ".",     dosbox_event: "key_period",   order: 9 },
    { action: "Run",            input: "Shift", dosbox_event: "key_lshift",   order: 10 },
    { action: "Automap",        input: "Tab",   dosbox_event: "key_tab",      order: 11 },
    { action: "Weapon 1",       input: "1",     dosbox_event: "key_1",        order: 12 },
    { action: "Weapon 2",       input: "2",     dosbox_event: "key_2",        order: 13 },
    { action: "Weapon 3",       input: "3",     dosbox_event: "key_3",        order: 14 },
    { action: "Weapon 4",       input: "4",     dosbox_event: "key_4",        order: 15 },
    { action: "Prev artifact",  input: "[",     dosbox_event: "key_lbracket", order: 16 },
    { action: "Next artifact",  input: "]",     dosbox_event: "key_rbracket", order: 17 },
    { action: "Use artifact",   input: "Enter", dosbox_event: "key_enter",    order: 18 },
    { action: "Save game",      input: "F2",    dosbox_event: "key_f2",       order: 19 },
    { action: "Load game",      input: "F3",    dosbox_event: "key_f3",       order: 20 },
    { action: "Quit",           input: "F10",   dosbox_event: "key_f10",      order: 21 },
    { action: "Pause / Menu",   input: "Esc",   dosbox_event: "key_esc",      order: 22 },
  ]},
  // Modern WASD (DOOM-engine: mouse turns, novert keeps mouse-Y from moving). always_run on.
  { game_title: "Hexen (Shareware)", name: "Modern WASD", input_style: "modern-kb", source: "core", always_run: 1, bindings: [
    { action: "Move forward",  input: "W",     dosbox_event: "key_up",       order: 1 },
    { action: "Move backward", input: "S",     dosbox_event: "key_down",     order: 2 },
    { action: "Strafe left",   input: "A",     dosbox_event: "key_comma",    order: 3 },
    { action: "Strafe right",  input: "D",     dosbox_event: "key_period",   order: 4 },
    { action: "Attack",        input: "LMB",   dosbox_event: "mouse_left",   order: 5 },
    { action: "Use",           input: "E",     dosbox_event: "key_space",    order: 6 },
    { action: "Run",           input: "Shift", dosbox_event: "key_lshift",   order: 7 },
    { action: "Weapon 1",      input: "1",     dosbox_event: "key_1",        order: 8 },
    { action: "Weapon 2",      input: "2",     dosbox_event: "key_2",        order: 9 },
    { action: "Weapon 3",      input: "3",     dosbox_event: "key_3",        order: 10 },
    { action: "Weapon 4",      input: "4",     dosbox_event: "key_4",        order: 11 },
    { action: "Prev artifact", input: "[",     dosbox_event: "key_lbracket", order: 12 },
    { action: "Next artifact", input: "]",     dosbox_event: "key_rbracket", order: 13 },
    { action: "Use artifact",  input: "Enter", dosbox_event: "key_enter",    order: 14 },
    { action: "Automap",       input: "Tab",   dosbox_event: "key_tab",      order: 15 },
    { action: "Pause / Menu",  input: "Esc",   dosbox_event: "key_esc",      order: 16 },
  ]},
  { game_title: "Hexen (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Rise of the Triad (Shareware) ─────────────────────────────────────────
  // Wolf3D-derived engine with jumping, mouselook, dedicated strafe keys.
  // Verified from in-game Customize Keyboard screen.
  { game_title: "Rise of the Triad (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move forward",    input: "Up",    dosbox_event: "key_up",        order: 1 },
    { action: "Move backward",   input: "Down",  dosbox_event: "key_down",      order: 2 },
    { action: "Turn left",       input: "Left",  dosbox_event: "key_left",      order: 3 },
    { action: "Turn right",      input: "Right", dosbox_event: "key_right",     order: 4 },
    { action: "Run",             input: "Shift", dosbox_event: "key_lshift",    order: 5 },
    { action: "Use / Open",      input: "Space", dosbox_event: "key_space",     order: 6 },
    { action: "Fire",            input: "Ctrl",  dosbox_event: "key_lctrl",     order: 7 },
    { action: "Strafe modifier", input: "Alt",   dosbox_event: "key_lalt",      order: 8 },
    { action: "Strafe left",     input: ",",     dosbox_event: "key_comma",     order: 9 },
    { action: "Strafe right",    input: ".",     dosbox_event: "key_period",    order: 10 },
    { action: "Look/Fly up",     input: "PgUp",  dosbox_event: "key_pageup",    order: 11 },
    { action: "Look/Fly down",   input: "PgDn",  dosbox_event: "key_pagedown",  order: 12 },
    { action: "Aim",             input: "A",     dosbox_event: "key_a",         order: 13 },
    { action: "Aim up",          input: "Home",  dosbox_event: "key_home",      order: 14 },
    { action: "Aim down",        input: "End",   dosbox_event: "key_end",       order: 15 },
    { action: "Toggle weapon",   input: "Enter", dosbox_event: "key_enter",     order: 16 },
    { action: "Drop weapon",     input: "Del",   dosbox_event: "key_delete",    order: 17 },
    { action: "Volte-face",      input: "BkSp",  dosbox_event: "key_backspace", order: 18 },
    { action: "Save game",       input: "F2",    dosbox_event: "key_f2",        order: 19 },
    { action: "Load game",       input: "F3",    dosbox_event: "key_f3",        order: 20 },
    { action: "Quit",            input: "F10",   dosbox_event: "key_f10",       order: 21 },
    { action: "Pause / Menu",    input: "Esc",   dosbox_event: "key_esc",       order: 22 },
  ]},
  // WASD sends ROTT's native bound keys (Up/Down/,/.) so no CONFIG.ROT edits needed.
  // W→Up, S→Down, A→strafe-left(,), D→strafe-right(.)
  { game_title: "Rise of the Triad (Shareware)", name: "WASD", input_style: "original", source: "core", bindings: [
    { action: "Move forward",    input: "W",     dosbox_event: "key_up",        order: 1 },
    { action: "Move backward",   input: "S",     dosbox_event: "key_down",      order: 2 },
    { action: "Strafe left",     input: "A",     dosbox_event: "key_comma",     order: 3 },
    { action: "Strafe right",    input: "D",     dosbox_event: "key_period",    order: 4 },
    { action: "Run",             input: "Shift", dosbox_event: "key_lshift",    order: 5 },
    { action: "Use / Open",      input: "Space", dosbox_event: "key_space",     order: 6 },
    { action: "Fire",            input: "Ctrl",  dosbox_event: "key_lctrl",     order: 7 },
    { action: "Look/Fly up",     input: "PgUp",  dosbox_event: "key_pageup",    order: 8 },
    { action: "Look/Fly down",   input: "PgDn",  dosbox_event: "key_pagedown",  order: 9 },
    { action: "Aim up",          input: "Home",  dosbox_event: "key_home",      order: 10 },
    { action: "Aim down",        input: "End",   dosbox_event: "key_end",       order: 11 },
    { action: "Toggle weapon",   input: "Enter", dosbox_event: "key_enter",     order: 12 },
    { action: "Drop weapon",     input: "Del",   dosbox_event: "key_delete",    order: 13 },
    { action: "Volte-face",      input: "BkSp",  dosbox_event: "key_backspace", order: 14 },
    { action: "Save game",       input: "F2",    dosbox_event: "key_f2",        order: 15 },
    { action: "Load game",       input: "F3",    dosbox_event: "key_f3",        order: 16 },
    { action: "Quit",            input: "F10",   dosbox_event: "key_f10",       order: 17 },
    { action: "Pause / Menu",    input: "Esc",   dosbox_event: "key_esc",       order: 18 },
  ]},
  { game_title: "Rise of the Triad (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Shadow Warrior (Shareware) ────────────────────────────────────────────
  // Build engine (same as Duke Nukem 3D). Default layout mirrors DN3D.
  // Controller fire uses key_g workaround (same as DN3D). Needs in-game verification.
  { game_title: "Shadow Warrior (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move forward",   input: "Up",    dosbox_event: "key_up",      order: 1 },
    { action: "Move backward",  input: "Down",  dosbox_event: "key_down",    order: 2 },
    { action: "Turn left",      input: "Left",  dosbox_event: "key_left",    order: 3 },
    { action: "Turn right",     input: "Right", dosbox_event: "key_right",   order: 4 },
    { action: "Strafe left",    input: "A",     dosbox_event: "key_a",       order: 5 },
    { action: "Strafe right",   input: "Z",     dosbox_event: "key_z",       order: 6 },
    { action: "Fire",           input: "Ctrl",  dosbox_event: "key_lctrl",   order: 7 },
    { action: "Open / Use",     input: "Space", dosbox_event: "key_space",   order: 8 },
    { action: "Jump",           input: "Enter", dosbox_event: "key_enter",   order: 9 },
    { action: "Crouch",         input: "Alt",   dosbox_event: "key_lalt",    order: 10 },
    { action: "Run",            input: "Shift", dosbox_event: "key_lshift",  order: 11 },
    { action: "Look up",        input: "PgUp",  dosbox_event: "key_pageup",  order: 12 },
    { action: "Look down",      input: "PgDn",  dosbox_event: "key_pagedown",order: 13 },
    { action: "Center view",    input: "End",   dosbox_event: "key_end",     order: 14 },
    { action: "Automap",        input: "Tab",   dosbox_event: "key_tab",     order: 15 },
    { action: "Weapon 1",       input: "1",     dosbox_event: "key_1",       order: 16 },
    { action: "Weapon 2",       input: "2",     dosbox_event: "key_2",       order: 17 },
    { action: "Weapon 3",       input: "3",     dosbox_event: "key_3",       order: 18 },
    { action: "Weapon 4",       input: "4",     dosbox_event: "key_4",       order: 19 },
    { action: "Next weapon",    input: "]",     dosbox_event: "key_rbracket", order: 20 },
    { action: "Prev weapon",    input: "[",     dosbox_event: "key_lbracket", order: 21 },
    { action: "Save game",      input: "F2",    dosbox_event: "key_f2",      order: 22 },
    { action: "Load game",      input: "F3",    dosbox_event: "key_f3",      order: 23 },
    { action: "Quit",           input: "F10",   dosbox_event: "key_f10",     order: 24 },
    { action: "Pause / Menu",   input: "Esc",   dosbox_event: "key_esc",     order: 25 },
  ]},
  { game_title: "Shadow Warrior (Shareware)", name: "Modern WASD", input_style: "modern-kb", source: "core", always_run: 1, bindings: [
    { action: "Move forward",   input: "W",     dosbox_event: "key_up",      order: 1 },
    { action: "Move backward",  input: "S",     dosbox_event: "key_down",    order: 2 },
    { action: "Strafe left",    input: "A",     dosbox_event: "key_a",       order: 3 },
    { action: "Strafe right",   input: "D",     dosbox_event: "key_d",       order: 4 },
    { action: "Fire",           input: "Ctrl",  dosbox_event: "key_lctrl",   order: 5 },
    { action: "Open / Use",     input: "E",     dosbox_event: "key_e",       order: 6 },
    { action: "Jump",           input: "Space", dosbox_event: "key_space",   order: 7 },
    { action: "Crouch",         input: "C",     dosbox_event: "key_c",       order: 8 },
    { action: "Run",            input: "Shift", dosbox_event: "key_lshift",  order: 9 },
    { action: "Look up",        input: "PgUp",  dosbox_event: "key_pageup",  order: 10 },
    { action: "Look down",      input: "PgDn",  dosbox_event: "key_pagedown",order: 11 },
    { action: "Center view",    input: "End",   dosbox_event: "key_end",     order: 12 },
    { action: "Automap",        input: "Tab",   dosbox_event: "key_tab",     order: 13 },
    { action: "Weapon 1",       input: "1",     dosbox_event: "key_1",       order: 14 },
    { action: "Weapon 2",       input: "2",     dosbox_event: "key_2",       order: 15 },
    { action: "Weapon 3",       input: "3",     dosbox_event: "key_3",       order: 16 },
    { action: "Weapon 4",       input: "4",     dosbox_event: "key_4",       order: 17 },
    { action: "Next weapon",    input: "]",     dosbox_event: "key_rbracket", order: 18 },
    { action: "Prev weapon",    input: "[",     dosbox_event: "key_lbracket", order: 19 },
    { action: "Save game",      input: "F2",    dosbox_event: "key_f2",      order: 20 },
    { action: "Load game",      input: "F3",    dosbox_event: "key_f3",      order: 21 },
    { action: "Quit",           input: "F10",   dosbox_event: "key_f10",     order: 22 },
    { action: "Pause / Menu",   input: "Esc",   dosbox_event: "key_esc",     order: 23 },
  ]},
  { game_title: "Shadow Warrior (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── One Must Fall: 2097 (Shareware) ──────────────────────────────────────
  // 2D robot fighting game. Arrow keys move, two action buttons per player.
  // Default Player 1 bindings — needs in-game verification.
  // Player 1 defaults (2-player game; P2 uses a separate key set). Movement =
  // arrows (Up=jump, Down=crouch/block, hold Up+Left/Right = jump diagonally).
  // Special moves are directional + Punch/Kick combos, fighting-game style.
  { game_title: "One Must Fall: 2097 (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",      input: "Left",    dosbox_event: "key_left",   order: 1 },
    { action: "Move right",     input: "Right",   dosbox_event: "key_right",  order: 2 },
    { action: "Jump (up)",      input: "Up",      dosbox_event: "key_up",     order: 3 },
    { action: "Crouch / Block", input: "Down",    dosbox_event: "key_down",   order: 4 },
    { action: "Punch",          input: "Enter",   dosbox_event: "key_enter",  order: 5 },
    { action: "Kick",           input: "R-Shift", dosbox_event: "key_rshift", order: 6 },
    { action: "Pause / Menu",   input: "Esc",     dosbox_event: "key_esc",    order: 7 },
  ]},
  { game_title: "One Must Fall: 2097 (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Terminal Velocity (Shareware) ─────────────────────────────────────────
  // 3D flight shooter. Pitch/yaw on arrows, throttle on A/Z, fire on Ctrl.
  // Needs in-game verification.
  { game_title: "Terminal Velocity (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Pitch up",       input: "Up",    dosbox_event: "key_up",      order: 1 },
    { action: "Pitch down",     input: "Down",  dosbox_event: "key_down",    order: 2 },
    { action: "Turn left",      input: "Left",  dosbox_event: "key_left",    order: 3 },
    { action: "Turn right",     input: "Right", dosbox_event: "key_right",   order: 4 },
    { action: "Throttle up",    input: "A",     dosbox_event: "key_a",       order: 5 },
    { action: "Throttle down",  input: "Z",     dosbox_event: "key_z",       order: 6 },
    { action: "Fire",           input: "Ctrl",  dosbox_event: "key_lctrl",   order: 7 },
    { action: "Afterburner",    input: "Space", dosbox_event: "key_space",   order: 8 },
    { action: "Switch weapon",  input: "Tab",   dosbox_event: "key_tab",     order: 9 },
    { action: "Pause / Menu",   input: "Esc",   dosbox_event: "key_esc",     order: 10 },
  ]},
  { game_title: "Terminal Velocity (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Descent (Shareware) ───────────────────────────────────────────────────
  // True 6DOF — arrow keys for pitch/heading, numpad for thrust and banking.
  // Controls are complex; this scheme covers the core essentials only.
  // Verified from the in-game Keyboard config. 6DOF: pitch/turn on arrows, thrust on
  // A/Z, slides on the numpad (or hold L-Alt + arrow), bank on Q/E.
  { game_title: "Descent (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Pitch forward",   input: "Up",    dosbox_event: "key_up",       order: 1 },
    { action: "Pitch backward",  input: "Down",  dosbox_event: "key_down",     order: 2 },
    { action: "Turn left",       input: "Left",  dosbox_event: "key_left",     order: 3 },
    { action: "Turn right",      input: "Right", dosbox_event: "key_right",    order: 4 },
    { action: "Accelerate",      input: "A",     dosbox_event: "key_a",        order: 5 },
    { action: "Reverse",         input: "Z",     dosbox_event: "key_z",        order: 6 },
    { action: "Slide modifier",  input: "L-Alt", dosbox_event: "key_lalt",     order: 7 },
    { action: "Slide left",      input: "Num 1", dosbox_event: "key_kp1",      order: 8 },
    { action: "Slide right",     input: "Num 3", dosbox_event: "key_kp3",      order: 9 },
    { action: "Slide up",        input: "Num -", dosbox_event: "key_kp_minus", order: 10 },
    { action: "Slide down",      input: "Num +", dosbox_event: "key_kp_plus",  order: 11 },
    { action: "Bank left",       input: "Q",     dosbox_event: "key_q",        order: 12 },
    { action: "Bank right",      input: "E",     dosbox_event: "key_e",        order: 13 },
    { action: "Fire primary",    input: "Ctrl",  dosbox_event: "key_lctrl",    order: 14 },
    { action: "Fire secondary",  input: "Space", dosbox_event: "key_space",    order: 15 },
    { action: "Fire flare",      input: "F",     dosbox_event: "key_f",        order: 16 },
    { action: "Drop bomb",       input: "B",     dosbox_event: "key_b",        order: 17 },
    { action: "Rear view",       input: "R",     dosbox_event: "key_r",        order: 18 },
    { action: "Automap",         input: "Tab",   dosbox_event: "key_tab",      order: 19 },
  ]},
  // WASD + mouse for 6DOF. Remaps onto Descent's existing bindings: W/S = thrust
  // (A/Z), A/D = slide (numpad 1/3), Space/L-Shift = slide up/down, Q/E = bank, arrows
  // still pitch/turn. LMB/RMB fire. For aiming, enable Mouse in Descent's own options.
  { game_title: "Descent (Shareware)", name: "Modern WASD", input_style: "modern-kb", source: "core", bindings: [
    { action: "Accelerate",     input: "W",       dosbox_event: "key_a",        order: 1 },
    { action: "Reverse",        input: "S",       dosbox_event: "key_z",        order: 2 },
    { action: "Slide left",     input: "A",       dosbox_event: "key_kp1",      order: 3 },
    { action: "Slide right",    input: "D",       dosbox_event: "key_kp3",      order: 4 },
    { action: "Slide up",       input: "Space",   dosbox_event: "key_kp_minus", order: 5 },
    { action: "Slide down",     input: "L-Shift", dosbox_event: "key_kp_plus",  order: 6 },
    { action: "Bank left",      input: "Q",       dosbox_event: "key_q",        order: 7 },
    { action: "Bank right",     input: "E",       dosbox_event: "key_e",        order: 8 },
    { action: "Turn left",      input: "Left",    dosbox_event: "key_left",     order: 9 },
    { action: "Turn right",     input: "Right",   dosbox_event: "key_right",    order: 10 },
    { action: "Pitch forward",  input: "Up",      dosbox_event: "key_up",       order: 11 },
    { action: "Pitch backward", input: "Down",    dosbox_event: "key_down",     order: 12 },
    { action: "Fire primary",   input: "LMB",     dosbox_event: "key_lctrl",    order: 13 },
    { action: "Fire secondary", input: "RMB",     dosbox_event: "key_space",    order: 14 },
    { action: "Fire flare",     input: "F",       dosbox_event: "key_f",        order: 15 },
    { action: "Drop bomb",      input: "B",       dosbox_event: "key_b",        order: 16 },
    { action: "Rear view",      input: "R",       dosbox_event: "key_r",        order: 17 },
    { action: "Automap",        input: "Tab",     dosbox_event: "key_tab",      order: 18 },
  ]},
  { game_title: "Descent (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Quake (Shareware) ─────────────────────────────────────────────────────
  // id Tech 2. Arrow key movement, Ctrl fire, Space jump — similar to DOOM defaults.
  // Needs in-game verification; DOS Quake performance may vary by system.
  { game_title: "Quake (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move forward",   input: "Up",    dosbox_event: "key_up",      order: 1 },
    { action: "Move backward",  input: "Down",  dosbox_event: "key_down",    order: 2 },
    { action: "Turn left",      input: "Left",  dosbox_event: "key_left",    order: 3 },
    { action: "Turn right",     input: "Right", dosbox_event: "key_right",   order: 4 },
    { action: "Fire",           input: "Ctrl",  dosbox_event: "key_lctrl",   order: 5 },
    { action: "Jump",           input: "Space", dosbox_event: "key_space",   order: 6 },
    { action: "Run / Sprint",   input: "Shift", dosbox_event: "key_lshift",  order: 7 },
    { action: "Strafe left",    input: ",",     dosbox_event: "key_comma",   order: 8 },
    { action: "Strafe right",   input: ".",     dosbox_event: "key_period",  order: 9 },
    { action: "Weapon 1",       input: "1",     dosbox_event: "key_1",       order: 10 },
    { action: "Weapon 2",       input: "2",     dosbox_event: "key_2",       order: 11 },
    { action: "Weapon 3",       input: "3",     dosbox_event: "key_3",       order: 12 },
    { action: "Weapon 4",       input: "4",     dosbox_event: "key_4",       order: 13 },
    { action: "Weapon 5",       input: "5",     dosbox_event: "key_5",       order: 14 },
    { action: "Weapon 6",       input: "6",     dosbox_event: "key_6",       order: 15 },
    { action: "Weapon 7",       input: "7",     dosbox_event: "key_7",       order: 16 },
    { action: "Weapon 8",       input: "8",     dosbox_event: "key_8",       order: 17 },
    { action: "Next weapon",    input: "]",     dosbox_event: "key_rbracket", order: 18 },
    { action: "Prev weapon",    input: "[",     dosbox_event: "key_lbracket", order: 19 },
    { action: "Look up",        input: "PgUp",  dosbox_event: "key_pageup",   order: 20 },
    { action: "Look down",      input: "PgDn",  dosbox_event: "key_pagedown", order: 21 },
    { action: "Pause / Menu",   input: "Esc",   dosbox_event: "key_esc",     order: 22 },
  ]},
  // WASD + mouse-look layout. config.cfg written on install pre-binds WASD movement so
  // this scheme works without any in-game setup.
  { game_title: "Quake (Shareware)", name: "WASD", input_style: "original", source: "core", bindings: [
    { action: "Move forward",   input: "W",     dosbox_event: "key_w",       order: 1 },
    { action: "Move backward",  input: "S",     dosbox_event: "key_s",       order: 2 },
    { action: "Strafe left",    input: "A",     dosbox_event: "key_a",       order: 3 },
    { action: "Strafe right",   input: "D",     dosbox_event: "key_d",       order: 4 },
    { action: "Fire",           input: "Ctrl",  dosbox_event: "key_lctrl",   order: 5 },
    { action: "Jump",           input: "Space", dosbox_event: "key_space",   order: 6 },
    { action: "Run / Sprint",   input: "Shift", dosbox_event: "key_lshift",  order: 7 },
    { action: "Use / Interact", input: "E",     dosbox_event: "key_e",       order: 8 },
    { action: "Weapon 1",       input: "1",     dosbox_event: "key_1",       order: 9 },
    { action: "Weapon 2",       input: "2",     dosbox_event: "key_2",       order: 10 },
    { action: "Weapon 3",       input: "3",     dosbox_event: "key_3",       order: 11 },
    { action: "Weapon 4",       input: "4",     dosbox_event: "key_4",       order: 12 },
    { action: "Weapon 5",       input: "5",     dosbox_event: "key_5",       order: 13 },
    { action: "Weapon 6",       input: "6",     dosbox_event: "key_6",       order: 14 },
    { action: "Weapon 7",       input: "7",     dosbox_event: "key_7",       order: 15 },
    { action: "Weapon 8",       input: "8",     dosbox_event: "key_8",       order: 16 },
    { action: "Next weapon",    input: "]",     dosbox_event: "key_rbracket", order: 17 },
    { action: "Prev weapon",    input: "[",     dosbox_event: "key_lbracket", order: 18 },
    { action: "Look up",        input: "PgUp",  dosbox_event: "key_pageup",   order: 19 },
    { action: "Look down",      input: "PgDn",  dosbox_event: "key_pagedown", order: 20 },
    { action: "Pause / Menu",   input: "Esc",   dosbox_event: "key_esc",     order: 21 },
  ]},
  { game_title: "Quake (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Solar Winds: The Escape (Shareware) ───────────────────────────────────
  // Mouse-driven space RPG-shooter. LMB fires/navigates; keyboard is minimal.
  { game_title: "Solar Winds: The Escape (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Fire / Navigate", input: "LMB",   dosbox_event: "mouse_left",  order: 1 },
    { action: "Target / Select", input: "RMB",   dosbox_event: "mouse_right", order: 2 },
    { action: "Pause / Menu",    input: "Esc",   dosbox_event: "key_esc",     order: 3 },
  ]},
  { game_title: "Solar Winds: The Escape (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Batch 3 schemes (approximate defaults — refine per game after testing) ────
  // ── The Elder Scrolls: Arena (Freeware) ───────────────────────────────────
  { game_title: "The Elder Scrolls: Arena (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move forward",  input: "Up",    dosbox_event: "key_up",     order: 1 },
    { action: "Move backward", input: "Down",  dosbox_event: "key_down",   order: 2 },
    { action: "Turn left",     input: "Left",  dosbox_event: "key_left",   order: 3 },
    { action: "Turn right",    input: "Right", dosbox_event: "key_right",  order: 4 },
    { action: "Attack",        input: "LMB",   dosbox_event: "mouse_left", order: 5 },
    { action: "Use / Interact",input: "RMB",   dosbox_event: "mouse_right",order: 6 },
    { action: "Menu / Pause",  input: "Esc",   dosbox_event: "key_esc",    order: 7 },
  ]},
  { game_title: "The Elder Scrolls: Arena (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Beneath a Steel Sky (Freeware) ────────────────────────────────────────
  { game_title: "Beneath a Steel Sky (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Walk / Interact", input: "LMB",   dosbox_event: "mouse_left",  order: 1 },
    { action: "Examine / Verb",  input: "RMB",   dosbox_event: "mouse_right", order: 2 },
    { action: "Skip text",       input: "Space", dosbox_event: "key_space",   order: 3 },
    { action: "Menu",            input: "F5",    dosbox_event: "key_f5",      order: 4 },
  ]},
  { game_title: "Beneath a Steel Sky (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Hugo's House of Horrors (Shareware) ───────────────────────────────────
  { game_title: "Hugo's House of Horrors (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move up",       input: "Up",    dosbox_event: "key_up",    order: 1 },
    { action: "Move down",     input: "Down",  dosbox_event: "key_down",  order: 2 },
    { action: "Move left",     input: "Left",  dosbox_event: "key_left",  order: 3 },
    { action: "Move right",    input: "Right", dosbox_event: "key_right", order: 4 },
    { action: "Enter command", input: "Enter", dosbox_event: "key_enter", order: 5 },
    { action: "Pause",         input: "Esc",   dosbox_event: "key_esc",   order: 6 },
  ]},
  { game_title: "Hugo's House of Horrors (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Ken's Labyrinth (Shareware) — verified from in-game Custom Key Menu ─────
  { game_title: "Ken's Labyrinth (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move forward",             input: "Up",        dosbox_event: "key_up",        order: 1 },
    { action: "Move backward",            input: "Down",      dosbox_event: "key_down",      order: 2 },
    { action: "Turn left",                input: "Left",      dosbox_event: "key_left",      order: 3 },
    { action: "Turn right",               input: "Right",     dosbox_event: "key_right",     order: 4 },
    { action: "Strafe (walk sideways)",   input: "R-Ctrl",    dosbox_event: "key_rctrl",     order: 5 },
    { action: "Stand high",               input: "A",         dosbox_event: "key_a",         order: 6 },
    { action: "Stand low",                input: "Z",         dosbox_event: "key_z",         order: 7 },
    { action: "Run",                      input: "L-Shift",   dosbox_event: "key_lshift",    order: 8 },
    { action: "Fire",                     input: "L-Ctrl",    dosbox_event: "key_lctrl",     order: 9 },
    { action: "Select fireballs (red)",   input: "F1",        dosbox_event: "key_f1",        order: 10 },
    { action: "Select bouncy-bullets",    input: "F2",        dosbox_event: "key_f2",        order: 11 },
    { action: "Select heat-seeking",      input: "F3",        dosbox_event: "key_f3",        order: 12 },
    { action: "Unlock / Open / Use",      input: "Space",     dosbox_event: "key_space",     order: 13 },
    { action: "Raise / lower status bar", input: "Enter",     dosbox_event: "key_enter",     order: 14 },
    { action: "Pause game",               input: "P",         dosbox_event: "key_p",         order: 15 },
    { action: "Mute",                     input: "M",         dosbox_event: "key_m",         order: 16 },
    { action: "Show menu (save/load/quit)", input: "Esc",     dosbox_event: "key_esc",       order: 17 },
  ]},
  // WASD + mouse. Ken's has no dedicated strafe-left/right keys — like Wolfenstein it
  // uses a strafe MODIFIER (R-Ctrl). The mapper sends R-Ctrl+turn as one key so A/D
  // strafe. (Fire=L-Ctrl and Strafe=R-Ctrl are distinct keys the game reads separately.)
  { game_title: "Ken's Labyrinth (Shareware)", name: "Modern WASD", input_style: "modern-kb", source: "core", bindings: [
    { action: "Move forward",           input: "W",       dosbox_event: "key_up",              order: 1 },
    { action: "Move backward",          input: "S",       dosbox_event: "key_down",            order: 2 },
    { action: "Strafe left",            input: "A",       dosbox_event: "key_rctrl+key_left",  order: 3 },
    { action: "Strafe right",           input: "D",       dosbox_event: "key_rctrl+key_right", order: 4 },
    { action: "Turn left",              input: "Left",    dosbox_event: "key_left",            order: 5 },
    { action: "Turn right",             input: "Right",   dosbox_event: "key_right",           order: 6 },
    { action: "Stand high",             input: "Q",       dosbox_event: "key_a",               order: 7 },
    { action: "Stand low",              input: "E",       dosbox_event: "key_z",               order: 8 },
    { action: "Fire",                   input: "LMB",     dosbox_event: "key_lctrl",           order: 9 },
    { action: "Unlock / Open / Use",    input: "Space",   dosbox_event: "key_space",           order: 10 },
    { action: "Run",                    input: "L-Shift", dosbox_event: "key_lshift",          order: 11 },
    { action: "Select fireballs (red)", input: "1",       dosbox_event: "key_f1",              order: 12 },
    { action: "Select bouncy-bullets",  input: "2",       dosbox_event: "key_f2",              order: 13 },
    { action: "Select heat-seeking",    input: "3",       dosbox_event: "key_f3",              order: 14 },
    { action: "Menu",                   input: "Esc",     dosbox_event: "key_esc",             order: 15 },
  ]},
  { game_title: "Ken's Labyrinth (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Realms of Chaos (Shareware) — Apogee platformer (Ctrl=Jump, Alt=Fire) ──
  { game_title: "Realms of Chaos (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",  input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right", input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Look up",    input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Duck",       input: "Down",  dosbox_event: "key_down",  order: 4 },
    { action: "Jump",       input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Fire",       input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
    { action: "Pause",      input: "Esc",   dosbox_event: "key_esc",   order: 7 },
  ]},
  { game_title: "Realms of Chaos (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Epic Pinball (Shareware) ──────────────────────────────────────────────
  { game_title: "Epic Pinball (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Left flipper",  input: "L-Shift", dosbox_event: "key_lshift", order: 1 },
    { action: "Right flipper", input: "R-Shift", dosbox_event: "key_rshift", order: 2 },
    { action: "Launch ball",   input: "Space",   dosbox_event: "key_space",  order: 3 },
    { action: "Nudge",         input: "Up",      dosbox_event: "key_up",     order: 4 },
    { action: "Pause / Menu",  input: "Esc",     dosbox_event: "key_esc",    order: 5 },
  ]},
  { game_title: "Epic Pinball (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Mystic Towers (Shareware) ─────────────────────────────────────────────
  // Verified from the in-game Help pages. Move = arrows (also numpad/Home-End for
  // diagonals); Jump=Alt, Action/cast=Ctrl, Pull=Backspace, cycle spell=Space,
  // 1-5 weapon spells / 6-0 tactical spells.
  { game_title: "Mystic Towers (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move up",             input: "Up",        dosbox_event: "key_up",        order: 1 },
    { action: "Move down",           input: "Down",      dosbox_event: "key_down",      order: 2 },
    { action: "Move left",           input: "Left",      dosbox_event: "key_left",      order: 3 },
    { action: "Move right",          input: "Right",     dosbox_event: "key_right",     order: 4 },
    { action: "Jump",                input: "Alt",       dosbox_event: "key_lalt",      order: 5 },
    { action: "Action / cast spell", input: "Ctrl",      dosbox_event: "key_lctrl",     order: 6 },
    { action: "Pull",                input: "Backspace", dosbox_event: "key_backspace", order: 7 },
    { action: "Cycle spell",         input: "Space",     dosbox_event: "key_space",     order: 8 },
    { action: "Spell: Ice",          input: "1",         dosbox_event: "key_1",         order: 9 },
    { action: "Spell: Sulfur",       input: "2",         dosbox_event: "key_2",         order: 10 },
    { action: "Spell: Venom",        input: "3",         dosbox_event: "key_3",         order: 11 },
    { action: "Spell: Fireball",     input: "4",         dosbox_event: "key_4",         order: 12 },
    { action: "Spell: Lightning",    input: "5",         dosbox_event: "key_5",         order: 13 },
    { action: "Spell: Reveal",       input: "6",         dosbox_event: "key_6",         order: 14 },
    { action: "Spell: Heal",         input: "7",         dosbox_event: "key_7",         order: 15 },
    { action: "Spell: Teleport",     input: "8",         dosbox_event: "key_8",         order: 16 },
    { action: "Spell: Levitate",     input: "9",         dosbox_event: "key_9",         order: 17 },
    { action: "Spell: Bomb",         input: "0",         dosbox_event: "key_0",         order: 18 },
    { action: "Help / game keys",    input: "F1",        dosbox_event: "key_f1",        order: 19 },
    { action: "Menu / exit",         input: "Esc",       dosbox_event: "key_esc",       order: 20 },
  ]},
  { game_title: "Mystic Towers (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Tubular Worlds (Shareware) ────────────────────────────────────────────
  { game_title: "Tubular Worlds (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move up",     input: "Up",    dosbox_event: "key_up",    order: 1 },
    { action: "Move down",   input: "Down",  dosbox_event: "key_down",  order: 2 },
    { action: "Move left",   input: "Left",  dosbox_event: "key_left",  order: 3 },
    { action: "Move right",  input: "Right", dosbox_event: "key_right", order: 4 },
    { action: "Fire",        input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Special",     input: "Space", dosbox_event: "key_space", order: 6 },
    { action: "Pause",       input: "Esc",   dosbox_event: "key_esc",   order: 7 },
  ]},
  { game_title: "Tubular Worlds (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Nitemare-3D (Shareware) ───────────────────────────────────────────────
  // Verified from the in-game Quick Help. Wolf3D-style: Alt+Left/Right = strafe.
  { game_title: "Nitemare-3D (Shareware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move forward",   input: "Up",      dosbox_event: "key_up",     order: 1 },
    { action: "Move backward",  input: "Down",    dosbox_event: "key_down",   order: 2 },
    { action: "Turn left",      input: "Left",    dosbox_event: "key_left",   order: 3 },
    { action: "Turn right",     input: "Right",   dosbox_event: "key_right",  order: 4 },
    { action: "Fire",           input: "Ctrl",    dosbox_event: "key_lctrl",  order: 5 },
    { action: "Open / Use",     input: "Space",   dosbox_event: "key_space",  order: 6 },
    { action: "Strafe modifier",input: "Alt",     dosbox_event: "key_lalt",   order: 7 },
    { action: "Go faster",      input: "R-Shift", dosbox_event: "key_rshift", order: 8 },
    { action: "Go slower",      input: "L-Shift", dosbox_event: "key_lshift", order: 9 },
    { action: "Weapon 1",       input: "1",       dosbox_event: "key_1",      order: 10 },
    { action: "Weapon 2",       input: "2",       dosbox_event: "key_2",      order: 11 },
    { action: "Weapon 3",       input: "3",       dosbox_event: "key_3",      order: 12 },
    { action: "Weapon 4",       input: "4",       dosbox_event: "key_4",      order: 13 },
    { action: "Quick save",     input: "F4",      dosbox_event: "key_f4",     order: 14 },
    { action: "Quick load",     input: "F5",      dosbox_event: "key_f5",     order: 15 },
    { action: "Status report",  input: "Tab",     dosbox_event: "key_tab",    order: 16 },
    { action: "Help",           input: "F1",      dosbox_event: "key_f1",     order: 17 },
    { action: "Menu / exit",    input: "Esc",     dosbox_event: "key_esc",    order: 18 },
  ]},
  // WASD + mouse, Wolf3D-style: A/D strafe via the Alt modifier combo.
  { game_title: "Nitemare-3D (Shareware)", name: "Modern WASD", input_style: "modern-kb", source: "core", bindings: [
    { action: "Move forward",  input: "W",       dosbox_event: "key_up",             order: 1 },
    { action: "Move backward", input: "S",       dosbox_event: "key_down",           order: 2 },
    { action: "Strafe left",   input: "A",       dosbox_event: "key_lalt+key_left",  order: 3 },
    { action: "Strafe right",  input: "D",       dosbox_event: "key_lalt+key_right", order: 4 },
    { action: "Turn left",     input: "Left",    dosbox_event: "key_left",           order: 5 },
    { action: "Turn right",    input: "Right",   dosbox_event: "key_right",          order: 6 },
    { action: "Fire",          input: "LMB",     dosbox_event: "key_lctrl",          order: 7 },
    { action: "Open / Use",    input: "Space",   dosbox_event: "key_space",          order: 8 },
    { action: "Run",           input: "R-Shift", dosbox_event: "key_rshift",         order: 9 },
    { action: "Weapon 1",      input: "1",       dosbox_event: "key_1",              order: 10 },
    { action: "Weapon 2",      input: "2",       dosbox_event: "key_2",              order: 11 },
    { action: "Weapon 3",      input: "3",       dosbox_event: "key_3",              order: 12 },
    { action: "Weapon 4",      input: "4",       dosbox_event: "key_4",              order: 13 },
    { action: "Menu / exit",   input: "Esc",     dosbox_event: "key_esc",            order: 14 },
  ]},
  { game_title: "Nitemare-3D (Shareware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },

  // ── Boppin' (Freeware) ────────────────────────────────────────────────────
  { game_title: "Boppin' (Freeware)", name: "Original", input_style: "original", source: "core", bindings: [
    { action: "Move left",     input: "Left",  dosbox_event: "key_left",  order: 1 },
    { action: "Move right",    input: "Right", dosbox_event: "key_right", order: 2 },
    { action: "Aim up",        input: "Up",    dosbox_event: "key_up",    order: 3 },
    { action: "Aim down",      input: "Down",  dosbox_event: "key_down",  order: 4 },
    { action: "Throw / Action",input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
    { action: "Swap character",input: "Space", dosbox_event: "key_space", order: 6 },
    { action: "Pause",         input: "Esc",   dosbox_event: "key_esc",   order: 7 },
  ]},
  { game_title: "Boppin' (Freeware)", name: "Custom Controls", input_style: "custom", source: "core", bindings: [] },
];

const SEED_TEMPLATES = [
  {
    genre_tag: "fps", subtype: null,
    action_list: ["Move forward","Move backward","Strafe left","Strafe right","Fire","Use / Open","Jump","Crouch","Run","Next weapon","Prev weapon","Map"],
    default_modern_kb: {"Move forward":"W","Move backward":"S","Strafe left":"A","Strafe right":"D","Fire":"LMB","Use / Open":"E","Jump":"Space","Crouch":"C","Run":"Shift","Next weapon":"WheelUp","Prev weapon":"WheelDown"},
    default_controller: {"Move / strafe":"Left Stick","Turn":"Right Stick","Fire":"RT","Use / Open":"X","Jump":"A","Crouch":"B","Run":"RB"},
  },
  {
    genre_tag: "adventure", subtype: "adventure-verb-cursor",
    action_list: ["Examine","Pick up","Use","Talk to","Push","Pull","Open","Close","Give"],
    default_modern_kb: {"Examine":"E","Pick up":"F","Use":"Enter","Talk to":"T"},
    default_controller: {"Confirm":"A","Cancel":"B","Inventory":"Y"},
  },
  {
    genre_tag: "platform", subtype: null,
    action_list: ["Move left","Move right","Jump","Duck","Shoot","Use","Pause"],
    default_modern_kb: {"Move left":"A","Move right":"D","Jump":"Space","Duck":"S","Shoot":"X"},
    default_controller: {"Move":"Left Stick","Jump":"A","Shoot":"X"},
  },
  {
    genre_tag: "shooter", subtype: "vertical-shmup",
    action_list: ["Move","Fire","Bomb","Shield","Pause"],
    default_modern_kb: {"Move":"Arrow Keys","Fire":"Z","Bomb":"X"},
    default_controller: {"Move":"Left Stick","Fire":"A","Bomb":"B"},
  },
  {
    genre_tag: "rpg", subtype: null,
    action_list: ["Move","Attack","Use item","Inventory","Map","Pause"],
    default_modern_kb: {"Move":"Arrow Keys","Attack":"Z","Use item":"X","Inventory":"I","Map":"M"},
    default_controller: {"Move":"Left Stick","Attack":"A","Use item":"X","Inventory":"Y"},
  },
  {
    genre_tag: "strategy", subtype: null,
    action_list: ["Select","Move unit","Attack","Build","Cancel","Map","Pause"],
    default_modern_kb: {"Select":"LMB","Move unit":"RMB","Cancel":"Esc","Map":"M"},
    default_controller: {"Select":"A","Cancel":"B","Map":"Y"},
  },
];

// ─── In-memory fallback (browser preview only) ───
function createMemStore() {
  let nextGameId = 1;
  let nextSchemeId = 1;
  let nextBindingId = 1;

  const games = [];
  const schemes = [];
  const bindings = [];
  const templates = [];

  // Seed templates
  for (const t of SEED_TEMPLATES) {
    templates.push({ id: templates.length + 1, ...t });
  }

  // Seed games
  for (const g of SEED_GAMES) {
    const game = { id: nextGameId++, ...g };
    games.push(game);
  }

  // Seed schemes + bindings
  for (const s of SEED_SCHEMES) {
    const game = games.find(g => g.title === s.game_title);
    if (!game) continue;
    const scheme = { id: nextSchemeId++, game_id: game.id, name: s.name, input_style: s.input_style, source: s.source, always_run: s.always_run ? 1 : 0 };
    schemes.push(scheme);
    for (const b of s.bindings) {
      bindings.push({ id: nextBindingId++, scheme_id: scheme.id, ...b });
    }
  }

  return {
    getGames: (f = {}) => {
      let list = [...games];
      if (f.genre)  list = list.filter(g => g.genre_tag === f.genre);
      if (f.source === 'included') list = list.filter(g => g.source_type !== 'copied');
      if (f.source === 'user')     list = list.filter(g => g.source_type === 'copied');
      if (f.search) list = list.filter(g => g.title.toLowerCase().includes(f.search.toLowerCase()));
      return Promise.resolve(list);
    },
    getGame: (id) => Promise.resolve(games.find(g => g.id === id) || null),
    addGame: (data) => {
      const g = { id: nextGameId++, ...data };
      games.push(g);
      return Promise.resolve(g);
    },
    updateGame: (id, data) => {
      const g = games.find(g => g.id === id);
      if (g) Object.assign(g, data);
      return Promise.resolve();
    },
    deleteGame: (id) => {
      const idx = games.findIndex(g => g.id === id);
      if (idx !== -1) games.splice(idx, 1);
      return Promise.resolve();
    },
    getSchemes: (gameId) => Promise.resolve(schemes.filter(s => s.game_id === gameId)),
    addScheme: (data) => {
      const s = { id: nextSchemeId++, always_run: 0, ...data };
      schemes.push(s);
      return Promise.resolve(s);
    },
    updateScheme: (id, data) => {
      const s = schemes.find(s => s.id === id);
      if (s) Object.assign(s, data);
      return Promise.resolve();
    },
    getBindings: (schemeId) => Promise.resolve(bindings.filter(b => b.scheme_id === schemeId).sort((a,b) => a.order - b.order)),
    addBinding: (data) => {
      const b = { id: nextBindingId++, ...data };
      bindings.push(b);
      return Promise.resolve(b);
    },
    updateBinding: (id, input) => {
      const b = bindings.find(b => b.id === id);
      if (b) b.input = input;
      return Promise.resolve();
    },
    deleteBindings: (schemeId) => {
      const idx = bindings.filter(b => b.scheme_id !== schemeId);
      bindings.length = 0;
      bindings.push(...idx);
      return Promise.resolve();
    },
    getGenreTemplate: (genre) => Promise.resolve(templates.find(t => t.genre_tag === genre) || templates[0]),
    getAllGenreTemplates: () => Promise.resolve(templates),
    markSeededGameRemoved: (_title) => Promise.resolve(),
    restoreAllSeededGames: () => { games.length = 0; for (const g of SEED_GAMES) games.push({ id: games.length + 1, ...g }); return Promise.resolve(); },
  };
}

// ─── SQLite store (Tauri) ───
async function createSqlStore() {
  const { default: Database } = await import('@tauri-apps/plugin-sql');
  const db = await Database.load('sqlite:dosdeck.db');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      genre_tag TEXT,
      subtype TEXT,
      description TEXT,
      art_path TEXT,
      dosbox_config TEXT DEFAULT '',
      install_path TEXT DEFAULT '',
      executable TEXT DEFAULT '',
      engine TEXT DEFAULT '',
      episodes TEXT DEFAULT NULL,
      setup_exe TEXT DEFAULT NULL,
      controller_bindings TEXT DEFAULT NULL,
      verified INTEGER DEFAULT 0,
      source_type TEXT DEFAULT 'copied',
      download_url TEXT DEFAULT NULL,
      buy_url TEXT DEFAULT NULL,
      folder_name TEXT DEFAULT NULL
    );
    CREATE TABLE IF NOT EXISTS schemes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      input_style TEXT DEFAULT 'modern-kb',
      source TEXT DEFAULT 'user',
      always_run INTEGER DEFAULT 0,
      FOREIGN KEY(game_id) REFERENCES games(id)
    );
    CREATE TABLE IF NOT EXISTS bindings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheme_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      input TEXT DEFAULT '',
      dosbox_event TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY(scheme_id) REFERENCES schemes(id)
    );
    CREATE TABLE IF NOT EXISTS genre_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      genre_tag TEXT NOT NULL,
      subtype TEXT,
      action_list TEXT,
      default_modern_kb TEXT,
      default_controller TEXT
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Migrate: add always_run column to existing DBs (safe to run every time)
  try { await db.execute('ALTER TABLE schemes ADD COLUMN always_run INTEGER DEFAULT 0'); } catch (_) {}
  try { await db.execute('ALTER TABLE games ADD COLUMN download_url TEXT DEFAULT NULL'); } catch (_) {}
  try { await db.execute('ALTER TABLE games ADD COLUMN buy_url TEXT DEFAULT NULL'); } catch (_) {}
  try { await db.execute('ALTER TABLE games ADD COLUMN folder_name TEXT DEFAULT NULL'); } catch (_) {}
  try { await db.execute("ALTER TABLE games ADD COLUMN engine TEXT DEFAULT ''"); } catch (_) {}
  try { await db.execute("ALTER TABLE games ADD COLUMN episodes TEXT DEFAULT NULL"); } catch (_) {}
  try { await db.execute("ALTER TABLE games ADD COLUMN setup_exe TEXT DEFAULT NULL"); } catch (_) {}
  try { await db.execute("ALTER TABLE games ADD COLUMN controller_bindings TEXT DEFAULT NULL"); } catch (_) {}
  // Fix Arctic Adventure Jump: was incorrectly set to key_lctrl (Ctrl); verified from in-game instructions it's key_space (Space).
  try {
    await db.execute(`UPDATE bindings SET input='Space', dosbox_event='key_space' WHERE action='Jump' AND dosbox_event='key_lctrl' AND scheme_id IN (SELECT s.id FROM schemes s JOIN games g ON g.id=s.game_id WHERE g.title='Arctic Adventure (Freeware)' AND s.name='Original')`);
  } catch (_) {}
  // Backfill engine for existing rows that have none
  await db.execute(`UPDATE games SET engine='doom'    WHERE engine='' AND LOWER(executable) IN ('doom.exe','doom1.exe','doomsw.exe','doom2.exe','heretic.exe','hexen.exe','strife.exe','plutonia.exe','tnt.exe','final.exe')`);
  await db.execute(`UPDATE games SET engine='build'   WHERE engine='' AND LOWER(executable) IN ('duke3d.exe','blood.exe','sw.exe')`);
  await db.execute(`UPDATE games SET engine='wolf3d'  WHERE engine='' AND LOWER(executable) IN ('wolf3d.exe','spear.exe','spear3d.exe')`);
  await db.execute(`UPDATE games SET engine='generic' WHERE engine=''`);
  // Always overwrite download_url / buy_url / folder_name / engine so corrections take effect on existing DBs
  for (const g of SEED_GAMES) {
    await db.execute(
      `UPDATE games SET download_url=?, buy_url=?, folder_name=?, engine=? WHERE title=?`,
      [g.download_url||null, g.buy_url||null, g.folder_name||null, g.engine||'generic', g.title]
    );
  }
  // When optimized packs are enabled, clear setup_exe on pack games for existing
  // users (the download_url above already switched them to the pre-configured pack).
  if (PACK_BASE) {
    for (const p of PACK_GAMES) {
      await db.execute(`UPDATE games SET setup_exe=NULL WHERE title=?`, [p.title]);
    }
  }
  // Migrate: correct executables where the raw-download exe differed from the real game
  // exe (Realms installer→game; Mystic's non-existent MYSTIC.EXE→the actual TOWERS.EXE).
  await db.execute(`UPDATE games SET executable='ROCSW.EXE'  WHERE title='Realms of Chaos (Shareware)' AND executable='INSTALL.EXE'`);
  await db.execute(`UPDATE games SET executable='TOWERS.EXE' WHERE title='Mystic Towers (Shareware)'   AND executable='MYSTIC.EXE'`);
  // Migrate: set always_run=1 on existing Modern WASD schemes for DOOM-engine games
  await db.execute(`
    UPDATE schemes SET always_run=1
    WHERE name='Modern WASD'
    AND game_id IN (SELECT id FROM games WHERE executable IN ('DOOM.EXE','DOOM1.EXE','DOOM2.EXE','HERETIC.EXE','HEXEN.EXE','STRIFE.EXE'))
    AND always_run=0
  `);
  // Migrate: set always_run=1 on existing Duke3D Modern WASD scheme
  await db.execute(`
    UPDATE schemes SET always_run=1
    WHERE name='Modern WASD'
    AND game_id IN (SELECT id FROM games WHERE executable='DUKE3D.EXE')
    AND always_run=0
  `);

  // Migrate: fully rebuild Wolf3D Modern WASD bindings so A/D fire combo events (Alt+arrow)
  // that give Wolf3D simultaneous Alt+Left / Alt+Right = true strafe.
  {
    const wolfModern = await db.select(`
      SELECT s.id FROM schemes s
      JOIN games g ON g.id = s.game_id
      WHERE g.title='Wolfenstein 3D (Shareware)' AND s.name='Modern WASD'
      LIMIT 1
    `);
    if (wolfModern.length) {
      const sid = wolfModern[0].id;
      await db.execute('DELETE FROM bindings WHERE scheme_id=?', [sid]);
      for (const b of [
        { action: "Move forward",  input: "W",     dosbox_event: "key_up",             order: 1 },
        { action: "Move backward", input: "S",     dosbox_event: "key_down",           order: 2 },
        { action: "Strafe left",   input: "A",     dosbox_event: "key_lalt+key_left",  order: 3 },
        { action: "Strafe right",  input: "D",     dosbox_event: "key_lalt+key_right", order: 4 },
        { action: "Fire",          input: "LMB",   dosbox_event: "mouse_left",         order: 5 },
        { action: "Open door",     input: "E",     dosbox_event: "key_space",          order: 6 },
        { action: "Run",           input: "Shift", dosbox_event: "key_lshift",         order: 7 },
        { action: "Weapon 1",      input: "1",     dosbox_event: "key_1",              order: 8 },
        { action: "Weapon 2",      input: "2",     dosbox_event: "key_2",              order: 9 },
        { action: "Weapon 3",      input: "3",     dosbox_event: "key_3",              order: 10 },
        { action: "Weapon 4",      input: "4",     dosbox_event: "key_4",              order: 11 },
        { action: "Pause / Menu",  input: "Esc",   dosbox_event: "key_esc",            order: 12 },
      ]) {
        await db.execute(
          'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
          [sid, b.action, b.input, b.dosbox_event, b.order]
        );
      }
    }
  }

  // Migrate: fold any user-created extra schemes (e.g. "My Setup") into Custom Controls, then delete them
  {
    const coreNames = `('Original', 'Original 1993', 'Modern WASD', 'WASD', 'Custom Controls')`;
    const extraSchemes = await db.select(`SELECT id, game_id FROM schemes WHERE name NOT IN ${coreNames}`);
    for (const extra of extraSchemes) {
      const customRow = await db.select(
        `SELECT id FROM schemes WHERE game_id=? AND name='Custom Controls' LIMIT 1`, [extra.game_id]
      );
      if (customRow.length) {
        const hasBindings = await db.select('SELECT id FROM bindings WHERE scheme_id=? LIMIT 1', [customRow[0].id]);
        if (!hasBindings.length) {
          await db.execute('UPDATE bindings SET scheme_id=? WHERE scheme_id=?', [customRow[0].id, extra.id]);
        } else {
          await db.execute('DELETE FROM bindings WHERE scheme_id=?', [extra.id]);
        }
      } else {
        await db.execute('DELETE FROM bindings WHERE scheme_id=?', [extra.id]);
      }
      await db.execute('DELETE FROM schemes WHERE id=?', [extra.id]);
    }
  }

  // Migrate: remove all Controller schemes (controller support shelved)
  {
    const ctrlSchemes = await db.select("SELECT id FROM schemes WHERE name='Controller'");
    for (const s of ctrlSchemes) {
      await db.execute('DELETE FROM bindings WHERE scheme_id=?', [s.id]);
    }
    if (ctrlSchemes.length) {
      await db.execute("DELETE FROM schemes WHERE name='Controller'");
    }
  }

  // Migrate: remove Monkey Island — no free shareware exists, shouldn't be seeded
  {
    const miRow = await db.select("SELECT id FROM games WHERE title='The Secret of Monkey Island' LIMIT 1");
    if (miRow.length) {
      const gid = miRow[0].id;
      const schemes = await db.select('SELECT id FROM schemes WHERE game_id=?', [gid]);
      for (const s of schemes) {
        await db.execute('DELETE FROM bindings WHERE scheme_id=?', [s.id]);
      }
      await db.execute('DELETE FROM schemes WHERE game_id=?', [gid]);
      await db.execute('DELETE FROM games WHERE id=?', [gid]);
    }
  }

  // Migrate: ensure every seeded game has a Custom Controls scheme
  for (const g of SEED_GAMES) {
    const gameRow = await db.select('SELECT id FROM games WHERE title=? LIMIT 1', [g.title]);
    if (!gameRow.length) continue;
    const gameId = gameRow[0].id;
    const existing = await db.select(
      "SELECT id FROM schemes WHERE game_id=? AND name='Custom Controls' LIMIT 1", [gameId]
    );
    if (!existing.length) {
      await db.execute(
        "INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,'Custom Controls','custom','core',0)",
        [gameId]
      );
    }
  }

  // Migrate: ensure Duke Nukem 3D has Original and Modern WASD schemes
  {
    const dukeRow = await db.select("SELECT id FROM games WHERE title='Duke Nukem 3D' LIMIT 1");
    if (dukeRow.length) {
      const gid = dukeRow[0].id;
      const hasOriginal = await db.select("SELECT id FROM schemes WHERE game_id=? AND name='Original' LIMIT 1", [gid]);
      if (!hasOriginal.length) {
        const sr = await db.execute(
          "INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,'Original','original','core',0)", [gid]
        );
        const sid = sr.lastInsertId;
        for (const b of [
          { action: "Move forward",  input: "Up",    dosbox_event: "key_up",    order: 1 },
          { action: "Move backward", input: "Down",  dosbox_event: "key_down",  order: 2 },
          { action: "Turn left",     input: "Left",  dosbox_event: "key_left",  order: 3 },
          { action: "Turn right",    input: "Right", dosbox_event: "key_right", order: 4 },
          { action: "Strafe left",   input: "A",     dosbox_event: "key_a",     order: 5 },
          { action: "Strafe right",  input: "Z",     dosbox_event: "key_z",     order: 6 },
          { action: "Fire",          input: "Ctrl",  dosbox_event: "key_lctrl", order: 7 },
          { action: "Open / Use",    input: "Space", dosbox_event: "key_space", order: 8 },
          { action: "Jump",          input: "Enter", dosbox_event: "key_enter", order: 9 },
          { action: "Crouch",        input: "Alt",   dosbox_event: "key_lalt",  order: 10 },
          { action: "Run",           input: "Shift", dosbox_event: "key_lshift",order: 11 },
          { action: "Map",           input: "Tab",   dosbox_event: "key_tab",   order: 12 },
        ]) await db.execute('INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
          [sid, b.action, b.input, b.dosbox_event, b.order]);
      }
      const hasWasd = await db.select("SELECT id FROM schemes WHERE game_id=? AND name='Modern WASD' LIMIT 1", [gid]);
      if (!hasWasd.length) {
        const sr = await db.execute(
          "INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,'Modern WASD','modern-kb','core',1)", [gid]
        );
        const sid = sr.lastInsertId;
        for (const b of [
          { action: "Move forward",  input: "W",         dosbox_event: "key_up",       order: 1 },
          { action: "Move backward", input: "S",         dosbox_event: "key_down",     order: 2 },
          { action: "Strafe left",   input: "A",         dosbox_event: "key_a",        order: 3 },
          { action: "Strafe right",  input: "D",         dosbox_event: "key_z",        order: 4 },
          { action: "Fire",          input: "LMB",       dosbox_event: "mouse_left",   order: 5 },
          { action: "Open / Use",    input: "E",         dosbox_event: "key_space",    order: 6 },
          { action: "Jump",          input: "Space",     dosbox_event: "key_enter",    order: 7 },
          { action: "Crouch",        input: "C",         dosbox_event: "key_lalt",     order: 8 },
          { action: "Run",           input: "Shift",     dosbox_event: "key_lshift",   order: 9 },
          { action: "Next weapon",   input: "WheelUp",   dosbox_event: "key_lbracket", order: 10 },
          { action: "Prev weapon",   input: "WheelDown", dosbox_event: "key_rbracket", order: 11 },
          { action: "Look up",       input: "PgUp",      dosbox_event: "",             order: 12 },
          { action: "Look down",     input: "PgDn",      dosbox_event: "",             order: 13 },
          { action: "Center view",   input: "End",       dosbox_event: "",             order: 14 },
          { action: "Map",           input: "Tab",       dosbox_event: "key_tab",      order: 15 },
        ]) await db.execute('INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
          [sid, b.action, b.input, b.dosbox_event, b.order]);
      }
    }
  }

  // Migrate: add Look up/Look down to existing Duke3D Modern WASD schemes that predate these bindings
  {
    const dukeRow = await db.select("SELECT id FROM games WHERE title='Duke Nukem 3D' LIMIT 1");
    if (dukeRow.length) {
      const wasd = await db.select(
        "SELECT id FROM schemes WHERE game_id=? AND name='Modern WASD' LIMIT 1", [dukeRow[0].id]
      );
      if (wasd.length) {
        const sid = wasd[0].id;
        const hasLook = await db.select(
          "SELECT id FROM bindings WHERE scheme_id=? AND action='Look up' LIMIT 1", [sid]
        );
        if (!hasLook.length) {
          const maxOrder = await db.select(
            "SELECT MAX(sort_order) as m FROM bindings WHERE scheme_id=?", [sid]
          );
          const base = (maxOrder[0]?.m ?? 0);
          await db.execute(
            'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
            [sid, 'Look up', 'PgUp', '', base + 1]
          );
          await db.execute(
            'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
            [sid, 'Look down', 'PgDn', '', base + 2]
          );
          await db.execute(
            'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
            [sid, 'Center view', 'End', '', base + 3]
          );
        }
      }
    }
  }

  // Migrate: correct Commander Keen 1 Original controls (Ctrl=Jump, Alt=Pogo, Space=Status)
  // Previous seed had these backwards (Ctrl=Fire, Alt=Jump, Space=Pogo).
  {
    const keenRow = await db.select("SELECT id FROM games WHERE title='Commander Keen 1' LIMIT 1");
    if (keenRow.length) {
      const origScheme = await db.select(
        "SELECT id FROM schemes WHERE game_id=? AND input_style='original' LIMIT 1", [keenRow[0].id]
      );
      if (origScheme.length) {
        const sid = origScheme[0].id;
        await db.execute('DELETE FROM bindings WHERE scheme_id=?', [sid]);
        for (const b of [
          { action: "Move left",       input: "Left",  dosbox_event: "key_left",  order: 1 },
          { action: "Move right",      input: "Right", dosbox_event: "key_right", order: 2 },
          { action: "Look up / Enter", input: "Up",    dosbox_event: "key_up",    order: 3 },
          { action: "Move down",       input: "Down",  dosbox_event: "key_down",  order: 4 },
          { action: "Jump",            input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
          { action: "Pogo stick",      input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
          { action: "Status screen",   input: "Space", dosbox_event: "key_space", order: 7 },
          { action: "Help",            input: "F1",    dosbox_event: "key_f1",    order: 8 },
          { action: "Sound on/off",    input: "F2",    dosbox_event: "key_f2",    order: 9 },
          { action: "Save game",       input: "F5",    dosbox_event: "key_f5",    order: 10 },
          { action: "Quit",            input: "Esc",   dosbox_event: "key_esc",   order: 11 },
        ]) {
          await db.execute(
            'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
            [sid, b.action, b.input, b.dosbox_event, b.order]
          );
        }
      }
    }
  }

  // Migrate: correct Commander Keen 4 Original controls. Galaxy engine has a real
  // Fire button — old seed wrongly copied Keen 1 (Fire=Alt, Space=Status). Real
  // in-game defaults: Jump=Ctrl, Pogo=Alt, Fire=Space.
  {
    const keenRow = await db.select("SELECT id FROM games WHERE title='Commander Keen 4 (Shareware)' LIMIT 1");
    if (keenRow.length) {
      const origScheme = await db.select(
        "SELECT id FROM schemes WHERE game_id=? AND input_style='original' LIMIT 1", [keenRow[0].id]
      );
      if (origScheme.length) {
        const sid = origScheme[0].id;
        await db.execute('DELETE FROM bindings WHERE scheme_id=?', [sid]);
        for (const b of [
          { action: "Move left",    input: "Left",  dosbox_event: "key_left",  order: 1 },
          { action: "Move right",   input: "Right", dosbox_event: "key_right", order: 2 },
          { action: "Move up",      input: "Up",    dosbox_event: "key_up",    order: 3 },
          { action: "Move down",    input: "Down",  dosbox_event: "key_down",  order: 4 },
          { action: "Jump",         input: "Ctrl",  dosbox_event: "key_lctrl", order: 5 },
          { action: "Pogo stick",   input: "Alt",   dosbox_event: "key_lalt",  order: 6 },
          { action: "Fire",         input: "Space", dosbox_event: "key_space", order: 7 },
          { action: "Help",         input: "F1",    dosbox_event: "key_f1",    order: 8 },
          { action: "Save game",    input: "F5",    dosbox_event: "key_f5",    order: 9 },
          { action: "Quit",         input: "F10",   dosbox_event: "key_f10",   order: 10 },
          { action: "Pause",        input: "Esc",   dosbox_event: "key_esc",   order: 11 },
        ]) {
          await db.execute(
            'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
            [sid, b.action, b.input, b.dosbox_event, b.order]
          );
        }
      }
    }
  }

  // Migrate: point Beneath a Steel Sky at the lean floppy build (SKY.EXE at root).
  // The old source was a 139MB CD archive whose exe wasn't detected — reset the
  // install so it re-downloads the clean ~8MB version that runs directly.
  {
    const done = await db.select("SELECT value FROM meta WHERE key='bass_floppy_source_v1'");
    if (!done.length) {
      await db.execute(
        "UPDATE games SET download_url=?, install_path='', executable='SKY.EXE' WHERE title='Beneath a Steel Sky (Freeware)'",
        ["https://www.classicdosgames.com/files/games/revolution/sky-disk.zip"]
      );
      await db.execute("INSERT INTO meta (key,value) VALUES ('bass_floppy_source_v1','1')");
    }
  }

  // Migrate: point the other 3 heavy Batch-3 games at lean floppy/shareware builds.
  // The original archive.org msdos_* items were bloated CD/registered versions whose
  // exes weren't detected. Reset install_path so they re-download the clean zips.
  {
    const done = await db.select("SELECT value FROM meta WHERE key='heavy_games_lean_source_v1'");
    if (!done.length) {
      const fixes = [
        ['Realms of Chaos (Shareware)', 'https://www.classicdosgames.com/files/games/apogee/1roc.zip'],
        ['Mystic Towers (Shareware)',   'https://www.classicdosgames.com/files/games/animationfx/1mystic.zip'],
        ['The Elder Scrolls: Arena (Freeware)', 'https://archive.org/download/ARENA_201902/ARENA.zip'],
      ];
      for (const [title, url] of fixes) {
        await db.execute("UPDATE games SET download_url=?, install_path='' WHERE title=?", [url, title]);
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('heavy_games_lean_source_v1','1')");
    }
  }

  // Migrate: Ken's Labyrinth — pin DOSBox cycles (fixes the run-too-fast freeze) and
  // replace the Original controls with the verified in-game defaults.
  {
    const done = await db.select("SELECT value FROM meta WHERE key='kens_labyrinth_fix_v1'");
    if (!done.length) {
      await db.execute("UPDATE games SET dosbox_config=? WHERE title=?",
        ["[cpu]\ncore=normal\ncycles=fixed 20000\n", "Ken's Labyrinth (Shareware)"]);
      const gameRow = await db.select("SELECT id FROM games WHERE title=? LIMIT 1", ["Ken's Labyrinth (Shareware)"]);
      const s = SEED_SCHEMES.find(s => s.game_title === "Ken's Labyrinth (Shareware)" && s.name === 'Original');
      if (gameRow.length && s) {
        const origScheme = await db.select("SELECT id FROM schemes WHERE game_id=? AND input_style='original' LIMIT 1", [gameRow[0].id]);
        if (origScheme.length) {
          const sid = origScheme[0].id;
          await db.execute('DELETE FROM bindings WHERE scheme_id=?', [sid]);
          for (const b of s.bindings) {
            await db.execute('INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [sid, b.action, b.input, b.dosbox_event, b.order]);
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('kens_labyrinth_fix_v1','1')");
    }
  }

  // Migrate: Ken's Labyrinth freeze was the v2.0 "Digitized Sound" crash bug — swap
  // to the author's fixed v2.1 full release and reset install so it re-downloads.
  {
    const done = await db.select("SELECT value FROM meta WHERE key='kens_labyrinth_v21_v1'");
    if (!done.length) {
      await db.execute("UPDATE games SET download_url=?, install_path='' WHERE title=?",
        ["https://advsys.net/ken/klab/labfull.zip", "Ken's Labyrinth (Shareware)"]);
      await db.execute("INSERT INTO meta (key,value) VALUES ('kens_labyrinth_v21_v1','1')");
    }
  }

  // Migrate: add the new "Modern WASD" scheme to existing Ken's Labyrinth installs.
  {
    const done = await db.select("SELECT value FROM meta WHERE key='kens_wasd_scheme_v1'");
    if (!done.length) {
      const gameRow = await db.select("SELECT id FROM games WHERE title=? LIMIT 1", ["Ken's Labyrinth (Shareware)"]);
      const s = SEED_SCHEMES.find(s => s.game_title === "Ken's Labyrinth (Shareware)" && s.name === "Modern WASD");
      if (gameRow.length && s) {
        const existing = await db.select("SELECT id FROM schemes WHERE game_id=? AND name='Modern WASD' LIMIT 1", [gameRow[0].id]);
        if (!existing.length) {
          const sr = await db.execute(
            'INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,?,?,?,?)',
            [gameRow[0].id, s.name, s.input_style, s.source, s.always_run ? 1 : 0]
          );
          const schemeId = sr.lastInsertId;
          for (const b of s.bindings) {
            await db.execute('INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [schemeId, b.action, b.input, b.dosbox_event, b.order]);
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('kens_wasd_scheme_v1','1')");
    }
  }

  // Migrate: One Must Fall 2097 — correct Player-1 controls (Enter=punch, R-Shift=kick).
  {
    const done = await db.select("SELECT value FROM meta WHERE key='omf2097_controls_v1'");
    if (!done.length) {
      const gameRow = await db.select("SELECT id FROM games WHERE title=? LIMIT 1", ["One Must Fall: 2097 (Shareware)"]);
      const s = SEED_SCHEMES.find(s => s.game_title === "One Must Fall: 2097 (Shareware)" && s.name === "Original");
      if (gameRow.length && s) {
        const os = await db.select("SELECT id FROM schemes WHERE game_id=? AND input_style='original' LIMIT 1", [gameRow[0].id]);
        if (os.length) {
          await db.execute('DELETE FROM bindings WHERE scheme_id=?', [os[0].id]);
          for (const b of s.bindings) {
            await db.execute('INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [os[0].id, b.action, b.input, b.dosbox_event, b.order]);
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('omf2097_controls_v1','1')");
    }
  }

  // Migrate: Descent — accurate Original controls (from in-game Keyboard config) + WASD.
  {
    const done = await db.select("SELECT value FROM meta WHERE key='descent_controls_v1'");
    if (!done.length) {
      const gameRow = await db.select("SELECT id FROM games WHERE title=? LIMIT 1", ["Descent (Shareware)"]);
      if (gameRow.length) {
        const gid = gameRow[0].id;
        const orig = SEED_SCHEMES.find(s => s.game_title === "Descent (Shareware)" && s.name === "Original");
        const os = await db.select("SELECT id FROM schemes WHERE game_id=? AND input_style='original' LIMIT 1", [gid]);
        if (orig && os.length) {
          await db.execute('DELETE FROM bindings WHERE scheme_id=?', [os[0].id]);
          for (const b of orig.bindings) {
            await db.execute('INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [os[0].id, b.action, b.input, b.dosbox_event, b.order]);
          }
        }
        const wasd = SEED_SCHEMES.find(s => s.game_title === "Descent (Shareware)" && s.name === "Modern WASD");
        const has = await db.select("SELECT id FROM schemes WHERE game_id=? AND name='Modern WASD' LIMIT 1", [gid]);
        if (wasd && !has.length) {
          const sr = await db.execute('INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,?,?,?,?)',
            [gid, wasd.name, wasd.input_style, wasd.source, 0]);
          for (const b of wasd.bindings) {
            await db.execute('INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [sr.lastInsertId, b.action, b.input, b.dosbox_event, b.order]);
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('descent_controls_v1','1')");
    }
  }

  // Migrate: Tubular Worlds runs PART2.EXE (the game); PART1 is the intro that crashes,
  // and there is no SETUP.EXE. Fix the phantom exe/setup.
  {
    const done = await db.select("SELECT value FROM meta WHERE key='tubular_part2_exe_v1'");
    if (!done.length) {
      await db.execute("UPDATE games SET setup_exe=NULL WHERE title='Tubular Worlds (Shareware)'");
      await db.execute("UPDATE games SET executable='PART2.EXE' WHERE title='Tubular Worlds (Shareware)' AND (executable='TW.EXE' OR executable IS NULL OR executable='')");
      await db.execute("INSERT INTO meta (key,value) VALUES ('tubular_part2_exe_v1','1')");
    }
  }

  // Migrate: Elder Scrolls Arena launches via ARENA.BAT (sound setup) not A.EXE.
  {
    const done = await db.select("SELECT value FROM meta WHERE key='arena_bat_exe_v1'");
    if (!done.length) {
      await db.execute("UPDATE games SET executable='ARENA.BAT' WHERE title=? AND (executable='ARENA.EXE' OR executable IS NULL OR executable='')",
        ["The Elder Scrolls: Arena (Freeware)"]);
      await db.execute("INSERT INTO meta (key,value) VALUES ('arena_bat_exe_v1','1')");
    }
  }

  // Migrate: Realms of Chaos launches its installer (INSTALL.EXE) — the shareware is
  // installer-based, so registering INSTALL.EXE lets the folder mount + unpack.
  {
    const done = await db.select("SELECT value FROM meta WHERE key='realms_installer_exe_v1'");
    if (!done.length) {
      await db.execute("UPDATE games SET executable='INSTALL.EXE', setup_exe=NULL WHERE title=? AND (executable='ROC.EXE' OR executable IS NULL OR executable='')",
        ["Realms of Chaos (Shareware)"]);
      await db.execute("INSERT INTO meta (key,value) VALUES ('realms_installer_exe_v1','1')");
    }
  }

  // Migrate: Nitemare-3D — accurate Original controls + add the Modern WASD scheme.
  {
    const done = await db.select("SELECT value FROM meta WHERE key='nitemare3d_controls_v1'");
    if (!done.length) {
      const gameRow = await db.select("SELECT id FROM games WHERE title=? LIMIT 1", ["Nitemare-3D (Shareware)"]);
      if (gameRow.length) {
        const gid = gameRow[0].id;
        const orig = SEED_SCHEMES.find(s => s.game_title === "Nitemare-3D (Shareware)" && s.name === "Original");
        const os = await db.select("SELECT id FROM schemes WHERE game_id=? AND input_style='original' LIMIT 1", [gid]);
        if (orig && os.length) {
          await db.execute('DELETE FROM bindings WHERE scheme_id=?', [os[0].id]);
          for (const b of orig.bindings) {
            await db.execute('INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [os[0].id, b.action, b.input, b.dosbox_event, b.order]);
          }
        }
        const wasd = SEED_SCHEMES.find(s => s.game_title === "Nitemare-3D (Shareware)" && s.name === "Modern WASD");
        const has = await db.select("SELECT id FROM schemes WHERE game_id=? AND name='Modern WASD' LIMIT 1", [gid]);
        if (wasd && !has.length) {
          const sr = await db.execute('INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,?,?,?,?)',
            [gid, wasd.name, wasd.input_style, wasd.source, 0]);
          for (const b of wasd.bindings) {
            await db.execute('INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [sr.lastInsertId, b.action, b.input, b.dosbox_event, b.order]);
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('nitemare3d_controls_v1','1')");
    }
  }

  // Migrate: correct Mystic Towers Original controls from the verified in-game Help.
  {
    const done = await db.select("SELECT value FROM meta WHERE key='mystic_towers_controls_v1'");
    if (!done.length) {
      const gameRow = await db.select("SELECT id FROM games WHERE title=? LIMIT 1", ["Mystic Towers (Shareware)"]);
      const s = SEED_SCHEMES.find(s => s.game_title === "Mystic Towers (Shareware)" && s.name === "Original");
      if (gameRow.length && s) {
        const origScheme = await db.select("SELECT id FROM schemes WHERE game_id=? AND input_style='original' LIMIT 1", [gameRow[0].id]);
        if (origScheme.length) {
          const sid = origScheme[0].id;
          await db.execute('DELETE FROM bindings WHERE scheme_id=?', [sid]);
          for (const b of s.bindings) {
            await db.execute('INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [sid, b.action, b.input, b.dosbox_event, b.order]);
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('mystic_towers_controls_v1','1')");
    }
  }

  // Migrate: Ken's Labyrinth — launch via KENSBFIX.EXE (patches the digitized-sound
  // crash then runs), and re-sync the Modern WASD scheme (moves Stand High/Low off the
  // A key, which now strafes, onto Q/E).
  {
    const done = await db.select("SELECT value FROM meta WHERE key='kens_wasd_qe_exe_v1'");
    if (!done.length) {
      await db.execute("UPDATE games SET executable='KENSBFIX.EXE' WHERE title=? AND executable='KEN.EXE'",
        ["Ken's Labyrinth (Shareware)"]);
      const gameRow = await db.select("SELECT id FROM games WHERE title=? LIMIT 1", ["Ken's Labyrinth (Shareware)"]);
      const s = SEED_SCHEMES.find(s => s.game_title === "Ken's Labyrinth (Shareware)" && s.name === "Modern WASD");
      if (gameRow.length && s) {
        const sch = await db.select("SELECT id FROM schemes WHERE game_id=? AND name='Modern WASD' LIMIT 1", [gameRow[0].id]);
        if (sch.length) {
          await db.execute('DELETE FROM bindings WHERE scheme_id=?', [sch[0].id]);
          for (const b of s.bindings) {
            await db.execute('INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [sch[0].id, b.action, b.input, b.dosbox_event, b.order]);
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('kens_wasd_qe_exe_v1','1')");
    }
  }

  // Migrate: wipe any Custom Controls bindings saved by the old genre-picker wizard.
  // Those bindings may have had wrong dosbox_events or stale inputs. The new direct
  // wizard will regenerate them correctly on next use.
  {
    const wiped = await db.select("SELECT value FROM meta WHERE key='custom_controls_wiped_v2'");
    if (!wiped.length) {
      const customSchemes = await db.select("SELECT id FROM schemes WHERE name='Custom Controls'");
      for (const s of customSchemes) {
        await db.execute('DELETE FROM bindings WHERE scheme_id=?', [s.id]);
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('custom_controls_wiped_v2','1')");
    }
  }

  // Migrate: re-seed all Original scheme bindings with audited/expanded action lists
  {
    const done = await db.select("SELECT value FROM meta WHERE key='original_schemes_reseeded_v1'");
    if (!done.length) {
      for (const s of SEED_SCHEMES.filter(s => s.input_style === 'original')) {
        const gameRow = await db.select('SELECT id FROM games WHERE title=? LIMIT 1', [s.game_title]);
        if (!gameRow.length) continue;
        const schemeRow = await db.select(
          "SELECT id FROM schemes WHERE game_id=? AND input_style='original' LIMIT 1",
          [gameRow[0].id]
        );
        if (!schemeRow.length) continue;
        const sid = schemeRow[0].id;
        await db.execute('DELETE FROM bindings WHERE scheme_id=?', [sid]);
        for (const b of s.bindings) {
          await db.execute(
            'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
            [sid, b.action, b.input, b.dosbox_event, b.order]
          );
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('original_schemes_reseeded_v1','1')");
    }
  }

  // Migrate v2: re-seed Original schemes again to pick up DN1/DN2/Crystal Caves control fixes
  {
    const done = await db.select("SELECT value FROM meta WHERE key='original_schemes_reseeded_v2'");
    if (!done.length) {
      for (const s of SEED_SCHEMES.filter(s => s.input_style === 'original')) {
        const gameRow = await db.select('SELECT id FROM games WHERE title=? LIMIT 1', [s.game_title]);
        if (!gameRow.length) continue;
        const schemeRow = await db.select(
          "SELECT id FROM schemes WHERE game_id=? AND input_style='original' LIMIT 1",
          [gameRow[0].id]
        );
        if (!schemeRow.length) continue;
        const sid = schemeRow[0].id;
        await db.execute('DELETE FROM bindings WHERE scheme_id=?', [sid]);
        for (const b of s.bindings) {
          await db.execute(
            'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
            [sid, b.action, b.input, b.dosbox_event, b.order]
          );
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('original_schemes_reseeded_v2','1')");
    }
  }

  // Migrate v3: add Original schemes for batch 1 Apogee-engine games + mark all seeded games verified
  {
    const done = await db.select("SELECT value FROM meta WHERE key='original_schemes_reseeded_v3'");
    if (!done.length) {
      for (const s of SEED_SCHEMES.filter(s => s.input_style === 'original')) {
        const gameRow = await db.select('SELECT id FROM games WHERE title=? LIMIT 1', [s.game_title]);
        if (!gameRow.length) continue;
        const gameId = gameRow[0].id;
        // Create Original scheme if it doesn't exist yet (batch 1 games won't have one)
        let schemeRow = await db.select(
          "SELECT id FROM schemes WHERE game_id=? AND input_style='original' LIMIT 1", [gameId]
        );
        let sid;
        if (!schemeRow.length) {
          const sr = await db.execute(
            "INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,?,?,?,?)",
            [gameId, s.name, s.input_style, s.source, s.always_run ? 1 : 0]
          );
          sid = sr.lastInsertId;
        } else {
          sid = schemeRow[0].id;
        }
        await db.execute('DELETE FROM bindings WHERE scheme_id=?', [sid]);
        for (const b of s.bindings) {
          await db.execute(
            'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
            [sid, b.action, b.input, b.dosbox_event, b.order]
          );
        }
      }
      // Ensure every seeded game now has a Custom Controls scheme
      for (const g of SEED_GAMES) {
        const gameRow = await db.select('SELECT id FROM games WHERE title=? LIMIT 1', [g.title]);
        if (!gameRow.length) continue;
        const gameId = gameRow[0].id;
        const existing = await db.select(
          "SELECT id FROM schemes WHERE game_id=? AND name='Custom Controls' LIMIT 1", [gameId]
        );
        if (!existing.length) {
          await db.execute(
            "INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,'Custom Controls','custom','core',0)",
            [gameId]
          );
        }
      }
      // Mark all seeded (non-user-added) games as verified
      await db.execute("UPDATE games SET verified=1 WHERE source_type IN ('bundled','referenced')");
      await db.execute("INSERT INTO meta (key,value) VALUES ('original_schemes_reseeded_v3','1')");
    }
  }

  // Migrate v4: add Move up to Secret Agent Original scheme (hub/map navigation needs Up)
  {
    const done = await db.select("SELECT value FROM meta WHERE key='original_schemes_reseeded_v4'");
    if (!done.length) {
      const gameRow = await db.select("SELECT id FROM games WHERE title='Secret Agent (Shareware)' LIMIT 1");
      if (gameRow.length) {
        const schemeRow = await db.select(
          "SELECT id FROM schemes WHERE game_id=? AND input_style='original' LIMIT 1", [gameRow[0].id]
        );
        if (schemeRow.length) {
          const sid = schemeRow[0].id;
          const s = SEED_SCHEMES.find(s => s.game_title === 'Secret Agent (Shareware)' && s.input_style === 'original');
          if (s) {
            await db.execute('DELETE FROM bindings WHERE scheme_id=?', [sid]);
            for (const b of s.bindings) {
              await db.execute(
                'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
                [sid, b.action, b.input, b.dosbox_event, b.order]
              );
            }
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('original_schemes_reseeded_v4','1')");
    }
  }

  // Migrate v5: add Up / Climb to Bio Menace Original scheme (ladders/doors need Up,
  // distinct from Jump). Without it, controller/custom setup never offered an Up binding.
  {
    const done = await db.select("SELECT value FROM meta WHERE key='original_schemes_reseeded_v5'");
    if (!done.length) {
      const gameRow = await db.select("SELECT id FROM games WHERE title='Bio Menace (Freeware)' LIMIT 1");
      if (gameRow.length) {
        const schemeRow = await db.select(
          "SELECT id FROM schemes WHERE game_id=? AND input_style='original' LIMIT 1", [gameRow[0].id]
        );
        if (schemeRow.length) {
          const sid = schemeRow[0].id;
          const s = SEED_SCHEMES.find(s => s.game_title === 'Bio Menace (Freeware)' && s.input_style === 'original');
          if (s) {
            await db.execute('DELETE FROM bindings WHERE scheme_id=?', [sid]);
            for (const b of s.bindings) {
              await db.execute(
                'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
                [sid, b.action, b.input, b.dosbox_event, b.order]
              );
            }
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('original_schemes_reseeded_v5','1')");
    }
  }

  // Migrate: add Modern WASD preset to Blake Stone (Wolf3D engine — mouse turn, A/D strafe
  // via Alt+arrow combos). It shipped with only Original + Custom, so add the preset button.
  {
    const done = await db.select("SELECT value FROM meta WHERE key='blakestone_wasd_v1'");
    if (!done.length) {
      const gameRow = await db.select("SELECT id FROM games WHERE title='Blake Stone: Aliens of Gold (Shareware)' LIMIT 1");
      if (gameRow.length) {
        const gid = gameRow[0].id;
        const has = await db.select("SELECT id FROM schemes WHERE game_id=? AND name='Modern WASD' LIMIT 1", [gid]);
        if (!has.length) {
          const s = SEED_SCHEMES.find(s => s.game_title === 'Blake Stone: Aliens of Gold (Shareware)' && s.input_style === 'modern-kb');
          if (s) {
            const sr = await db.execute(
              "INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,?,?,?,?)",
              [gid, s.name, s.input_style, s.source, s.always_run ? 1 : 0]
            );
            const sid = sr.lastInsertId;
            for (const b of s.bindings) {
              await db.execute(
                'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
                [sid, b.action, b.input, b.dosbox_event, b.order]
              );
            }
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('blakestone_wasd_v1','1')");
    }
  }

  // Migrate: add Modern WASD preset to Hexen (DOOM engine — same as DOOM/Heretic) for existing users.
  {
    const done = await db.select("SELECT value FROM meta WHERE key='hexen_wasd_v1'");
    if (!done.length) {
      const gameRow = await db.select("SELECT id FROM games WHERE title='Hexen (Shareware)' LIMIT 1");
      if (gameRow.length) {
        const gid = gameRow[0].id;
        const has = await db.select("SELECT id FROM schemes WHERE game_id=? AND name='Modern WASD' LIMIT 1", [gid]);
        if (!has.length) {
          const s = SEED_SCHEMES.find(s => s.game_title === 'Hexen (Shareware)' && s.input_style === 'modern-kb');
          if (s) {
            const sr = await db.execute(
              "INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,?,?,?,?)",
              [gid, s.name, s.input_style, s.source, s.always_run ? 1 : 0]
            );
            const sid = sr.lastInsertId;
            for (const b of s.bindings) {
              await db.execute(
                'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
                [sid, b.action, b.input, b.dosbox_event, b.order]
              );
            }
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('hexen_wasd_v1','1')");
    }
  }

  // Migrate: swap Shadow Warrior WASD Jump/Use so E=Use, Space=Jump (was E=Jump, Space=Use).
  {
    const done = await db.select("SELECT value FROM meta WHERE key='sw_wasd_jumpuse_swap_v1'");
    if (!done.length) {
      const rows = await db.select(
        `SELECT b.id, b.action FROM bindings b
         JOIN schemes s ON s.id=b.scheme_id JOIN games g ON g.id=s.game_id
         WHERE g.title='Shadow Warrior (Shareware)' AND s.name='Modern WASD'
         AND b.action IN ('Open / Use','Jump')`
      );
      for (const r of rows) {
        if (r.action === 'Open / Use') await db.execute("UPDATE bindings SET input='E', dosbox_event='key_e' WHERE id=?", [r.id]);
        else if (r.action === 'Jump')  await db.execute("UPDATE bindings SET input='Space', dosbox_event='key_space' WHERE id=?", [r.id]);
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('sw_wasd_jumpuse_swap_v1','1')");
    }
  }

  // Migrate: add Look up/down + Next/Prev weapon to Quake's Original and WASD schemes
  // (backed by autoexec.cfg binds: PGUP/PGDN=+lookup/+lookdown, ]/[=impulse 10/12).
  {
    const done = await db.select("SELECT value FROM meta WHERE key='quake_look_weapons_v1'");
    if (!done.length) {
      const gameRow = await db.select("SELECT id FROM games WHERE title='Quake (Shareware)' LIMIT 1");
      if (gameRow.length) {
        for (const schemeName of ['Original', 'WASD']) {
          const schemeRow = await db.select(
            "SELECT id FROM schemes WHERE game_id=? AND name=? LIMIT 1", [gameRow[0].id, schemeName]
          );
          if (!schemeRow.length) continue;
          const s = SEED_SCHEMES.find(s => s.game_title === 'Quake (Shareware)' && s.name === schemeName);
          if (!s) continue;
          const sid = schemeRow[0].id;
          await db.execute('DELETE FROM bindings WHERE scheme_id=?', [sid]);
          for (const b of s.bindings) {
            await db.execute(
              'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [sid, b.action, b.input, b.dosbox_event, b.order]
            );
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('quake_look_weapons_v1','1')");
    }
  }

  // Migrate: add Next/Prev weapon to Shadow Warrior's Original and Modern WASD schemes
  // (maps to Build-engine Next_Weapon/Previous_Weapon keydefs via ]/[).
  {
    const done = await db.select("SELECT value FROM meta WHERE key='sw_next_prev_weapon_v1'");
    if (!done.length) {
      const gameRow = await db.select("SELECT id FROM games WHERE title='Shadow Warrior (Shareware)' LIMIT 1");
      if (gameRow.length) {
        for (const schemeName of ['Original', 'Modern WASD']) {
          const schemeRow = await db.select(
            "SELECT id FROM schemes WHERE game_id=? AND name=? LIMIT 1", [gameRow[0].id, schemeName]
          );
          if (!schemeRow.length) continue;
          const s = SEED_SCHEMES.find(s => s.game_title === 'Shadow Warrior (Shareware)' && s.name === schemeName);
          if (!s) continue;
          const sid = schemeRow[0].id;
          await db.execute('DELETE FROM bindings WHERE scheme_id=?', [sid]);
          for (const b of s.bindings) {
            await db.execute(
              'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [sid, b.action, b.input, b.dosbox_event, b.order]
            );
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('sw_next_prev_weapon_v1','1')");
    }
  }

  // Migrate: add Next/Prev weapon to Duke Nukem 3D's Original scheme (WASD already has them).
  {
    const done = await db.select("SELECT value FROM meta WHERE key='duke3d_next_prev_weapon_v1'");
    if (!done.length) {
      const gameRow = await db.select("SELECT id FROM games WHERE title='Duke Nukem 3D' LIMIT 1");
      if (gameRow.length) {
        const schemeRow = await db.select(
          "SELECT id FROM schemes WHERE game_id=? AND name='Original' LIMIT 1", [gameRow[0].id]
        );
        const s = SEED_SCHEMES.find(s => s.game_title === 'Duke Nukem 3D' && s.name === 'Original');
        if (schemeRow.length && s) {
          const sid = schemeRow[0].id;
          await db.execute('DELETE FROM bindings WHERE scheme_id=?', [sid]);
          for (const b of s.bindings) {
            await db.execute(
              'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [sid, b.action, b.input, b.dosbox_event, b.order]
            );
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('duke3d_next_prev_weapon_v1','1')");
    }
  }

  // Migrate: mark all audited seeded games as verified (Tuned badge)
  {
    const done = await db.select("SELECT value FROM meta WHERE key='seeded_games_verified_v1'");
    if (!done.length) {
      const titles = [
        'DOOM (Shareware)', 'Heretic (Shareware)', 'Commander Keen 1', 'Wolfenstein 3D (Shareware)',
        'Duke Nukem 3D', 'Tyrian 2000', 'Crystal Caves',
        'Duke Nukem (Shareware)', 'Duke Nukem II (Shareware)',
        'Raptor: Call of the Shadows (Shareware)', 'Jazz Jackrabbit (Shareware)',
        "Cosmo's Cosmic Adventure (Shareware)", 'Bio Menace (Freeware)',
        'Monster Bash (Shareware)', 'Hocus Pocus (Shareware)', 'Halloween Harry (Freeware)',
        'Major Stryker (Freeware)', 'Monuments of Mars (Freeware)', 'Dark Ages (Freeware)',
        'Stargunner (Freeware)', 'Arctic Adventure (Freeware)', "Pharaoh's Tomb (Freeware)",
        'Wacky Wheels (Shareware)', 'Death Rally (Shareware)', 'Jill of the Jungle (Shareware)',
        'Secret Agent (Shareware)', 'Jetpack (Freeware)', 'God of Thunder (Freeware)',
        'Xargon (Freeware)',
      ];
      for (const title of titles) {
        await db.execute("UPDATE games SET verified=1 WHERE title=?", [title]);
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('seeded_games_verified_v1','1')");
    }
  }

  // Migrate: clear stale install_path for Duke Nukem 3D (game not bundled; old scans may have set it)
  {
    const done = await db.select("SELECT value FROM meta WHERE key='duke3d_install_cleared_v1'");
    if (!done.length) {
      await db.execute(
        "UPDATE games SET install_path='', executable='DUKE3D.EXE', verified=0 WHERE title='Duke Nukem 3D' AND source_type='referenced'"
      );
      await db.execute("INSERT INTO meta (key,value) VALUES ('duke3d_install_cleared_v1','1')");
    }
  }

  // Migrate: remove orphan scanner entry created before FOLDER_TITLE_MAP had 'heretic'
  {
    const done = await db.select("SELECT value FROM meta WHERE key='heretic_orphan_removed_v1'");
    if (!done.length) {
      await db.execute("DELETE FROM games WHERE title='HERETIC' AND source_type='copied'");
      await db.execute("INSERT INTO meta (key,value) VALUES ('heretic_orphan_removed_v1','1')");
    }
  }

  // Migrate: seed Batch 2 games (11 new titles) for existing users only.
  // Fresh installs get these via SEED_GAMES in the initial seed block below;
  // running this unconditionally on a fresh install (before 'seeded' is set)
  // double-inserted these 11 titles.
  {
    const seededAlready = await db.select("SELECT value FROM meta WHERE key='seeded'");
    const done = await db.select("SELECT value FROM meta WHERE key='batch2_games_seeded_v1'");
    if (seededAlready.length && !done.length) {
      const batch2Titles = [
        'Commander Keen 4 (Shareware)', 'Keen Dreams (Freeware)',
        'Blake Stone: Aliens of Gold (Shareware)', 'Hexen (Shareware)',
        'Rise of the Triad (Shareware)', 'Shadow Warrior (Shareware)',
        'One Must Fall: 2097 (Shareware)', 'Terminal Velocity (Shareware)',
        'Descent (Shareware)', 'Quake (Shareware)',
        'Solar Winds: The Escape (Shareware)',
      ];
      for (const title of batch2Titles) {
        const existing = await db.select('SELECT id FROM games WHERE title=? LIMIT 1', [title]);
        if (existing.length) continue;
        const g = SEED_GAMES.find(g => g.title === title);
        if (!g) continue;
        const res = await db.execute(
          'INSERT INTO games (title,genre_tag,subtype,description,art_path,dosbox_config,install_path,executable,engine,episodes,setup_exe,verified,source_type,download_url,buy_url,folder_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [g.title, g.genre_tag, g.subtype, g.description, g.art_path, g.dosbox_config, g.install_path, g.executable, g.engine||'generic', g.episodes||null, g.setup_exe||null, g.verified, g.source_type, g.download_url||null, g.buy_url||null, g.folder_name||null]
        );
        const gameId = res.lastInsertId;
        for (const s of SEED_SCHEMES.filter(s => s.game_title === title)) {
          const sr = await db.execute(
            'INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,?,?,?,?)',
            [gameId, s.name, s.input_style, s.source, s.always_run ? 1 : 0]
          );
          const schemeId = sr.lastInsertId;
          for (const b of s.bindings) {
            await db.execute(
              'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [schemeId, b.action, b.input, b.dosbox_event, b.order]
            );
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('batch2_games_seeded_v1','1')");
    }
  }

  // Batch 3 (download-first expansion): insert the 10 new games into EXISTING DBs.
  // Fresh installs get them via the initial seed; this backfills current libraries.
  {
    const seededAlready = await db.select("SELECT value FROM meta WHERE key='seeded'");
    const done = await db.select("SELECT value FROM meta WHERE key='batch3_games_seeded_v1'");
    if (seededAlready.length && !done.length) {
      const batch3Titles = [
        'The Elder Scrolls: Arena (Freeware)', 'Beneath a Steel Sky (Freeware)',
        "Hugo's House of Horrors (Shareware)", "Ken's Labyrinth (Shareware)",
        'Realms of Chaos (Shareware)', 'Epic Pinball (Shareware)',
        'Mystic Towers (Shareware)', 'Tubular Worlds (Shareware)',
        'Nitemare-3D (Shareware)', "Boppin' (Freeware)",
      ];
      for (const title of batch3Titles) {
        const existing = await db.select('SELECT id FROM games WHERE title=? LIMIT 1', [title]);
        if (existing.length) continue;
        const g = SEED_GAMES.find(g => g.title === title);
        if (!g) continue;
        const res = await db.execute(
          'INSERT INTO games (title,genre_tag,subtype,description,art_path,dosbox_config,install_path,executable,engine,episodes,setup_exe,verified,source_type,download_url,buy_url,folder_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [g.title, g.genre_tag, g.subtype, g.description, g.art_path, g.dosbox_config, g.install_path, g.executable, g.engine||'generic', g.episodes||null, g.setup_exe||null, g.verified, g.source_type, g.download_url||null, g.buy_url||null, g.folder_name||null]
        );
        const gameId = res.lastInsertId;
        for (const s of SEED_SCHEMES.filter(s => s.game_title === title)) {
          const sr = await db.execute(
            'INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,?,?,?,?)',
            [gameId, s.name, s.input_style, s.source, s.always_run ? 1 : 0]
          );
          const schemeId = sr.lastInsertId;
          for (const b of s.bindings) {
            await db.execute(
              'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [schemeId, b.action, b.input, b.dosbox_event, b.order]
            );
          }
        }
      }
      await db.execute("INSERT INTO meta (key,value) VALUES ('batch3_games_seeded_v1','1')");
    }
  }

  // Ensure ROTT Original has bindings and WASD scheme exists.
  // Unconditional (no guard key) so it self-heals each startup if schemes were deleted.
  {
    const gameRow = await db.select("SELECT id FROM games WHERE title='Rise of the Triad (Shareware)' LIMIT 1");
    if (gameRow.length) {
      const gameId = gameRow[0].id;
      const origRow = await db.select("SELECT id FROM schemes WHERE game_id=? AND name='Original' LIMIT 1", [gameId]);
      if (origRow.length) {
        const sid = origRow[0].id;
        const hasBindings = await db.select('SELECT id FROM bindings WHERE scheme_id=? LIMIT 1', [sid]);
        if (!hasBindings.length) {
          const origBindings = [
            ['Move forward','Up','key_up',1], ['Move backward','Down','key_down',2],
            ['Turn left','Left','key_left',3], ['Turn right','Right','key_right',4],
            ['Run','Shift','key_lshift',5], ['Use / Open','Space','key_space',6],
            ['Fire','Ctrl','key_lctrl',7], ['Strafe modifier','Alt','key_lalt',8],
            ['Strafe left',',','key_comma',9], ['Strafe right','.','key_period',10],
            ['Look/Fly up','PgUp','key_pageup',11], ['Look/Fly down','PgDn','key_pagedown',12],
            ['Aim','A','key_a',13], ['Aim up','Home','key_home',14],
            ['Aim down','End','key_end',15], ['Toggle weapon','Enter','key_enter',16],
            ['Drop weapon','Del','key_delete',17], ['Volte-face','BkSp','key_backspace',18],
            ['Save game','F2','key_f2',19], ['Load game','F3','key_f3',20],
            ['Quit','F10','key_f10',21], ['Pause / Menu','Esc','key_esc',22],
          ];
          for (const [action, input, event, order] of origBindings) {
            await db.execute('INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)', [sid, action, input, event, order]);
          }
        }
      }
      const wasdRow = await db.select("SELECT id FROM schemes WHERE game_id=? AND name='WASD' LIMIT 1", [gameId]);
      if (!wasdRow.length) {
        const sr = await db.execute("INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,'WASD','original','core',0)", [gameId]);
        const sid = sr.lastInsertId;
        const wasdBindings = [
          ['Move forward','W','key_up',1], ['Move backward','S','key_down',2],
          ['Strafe left','A','key_comma',3], ['Strafe right','D','key_period',4],
          ['Run','Shift','key_lshift',5], ['Use / Open','Space','key_space',6],
          ['Fire','Ctrl','key_lctrl',7], ['Look/Fly up','PgUp','key_pageup',8],
          ['Look/Fly down','PgDn','key_pagedown',9], ['Aim up','Home','key_home',10],
          ['Aim down','End','key_end',11], ['Toggle weapon','Enter','key_enter',12],
          ['Drop weapon','Del','key_delete',13], ['Volte-face','BkSp','key_backspace',14],
          ['Save game','F2','key_f2',15], ['Load game','F3','key_f3',16],
          ['Quit','F10','key_f10',17], ['Pause / Menu','Esc','key_esc',18],
        ];
        for (const [action, input, event, order] of wasdBindings) {
          await db.execute('INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)', [sid, action, input, event, order]);
        }
      }
    }
  }

  // Ensure Quake WASD scheme exists. Unconditional self-heal.
  {
    const gameRow = await db.select("SELECT id FROM games WHERE title='Quake (Shareware)' LIMIT 1");
    if (gameRow.length) {
      const gameId = gameRow[0].id;
      const existing = await db.select("SELECT id FROM schemes WHERE game_id=? AND name='WASD' LIMIT 1", [gameId]);
      if (!existing.length) {
        const sr = await db.execute(
          "INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,'WASD','original','core',0)",
          [gameId]
        );
        const sid = sr.lastInsertId;
        const bindings = [
          ['Move forward','W','key_w',1], ['Move backward','S','key_s',2],
          ['Strafe left','A','key_a',3],  ['Strafe right','D','key_d',4],
          ['Fire','Ctrl','key_lctrl',5],  ['Jump','Space','key_space',6],
          ['Run / Sprint','Shift','key_lshift',7], ['Use / Interact','E','key_e',8],
          ['Weapon 1','1','key_1',9],  ['Weapon 2','2','key_2',10],
          ['Weapon 3','3','key_3',11], ['Weapon 4','4','key_4',12],
          ['Weapon 5','5','key_5',13], ['Weapon 6','6','key_6',14],
          ['Weapon 7','7','key_7',15], ['Weapon 8','8','key_8',16],
          ['Pause / Menu','Esc','key_esc',17],
        ];
        for (const [action, input, event, order] of bindings) {
          await db.execute(
            'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
            [sid, action, input, event, order]
          );
        }
      }
    }
  }

  // Fix Hocus Pocus: switch to pre-installed/preconfigured 7z (dosbox-ready, no SETUP.EXE step).
  // The new archive ships sound already configured, so clear the manual setup requirement.
  await db.execute(
    "UPDATE games SET setup_exe=NULL, download_url='https://archive.org/download/hocus-pocus_202304/Hocus%20Pocus.7z' WHERE title='Hocus Pocus (Shareware)'"
  );

  // Fix Terminal Velocity: old source (3dtv12.zip) was an INSTALL.EXE+.SHR installer that forced a
  // manual decompress step. TVplay.ZIP is pre-extracted with TV.EXE + SETUP.CFG (sound preconfigured).
  await db.execute(
    "UPDATE games SET setup_exe=NULL, download_url='https://archive.org/download/TerminalVelocity/TVplay.ZIP' WHERE title='Terminal Velocity (Shareware)'"
  );

  // Shadow Warrior: use the pre-configured pack (working SW.CFG baked in — FXDevice=0,
  // 8-bit/22kHz, SB type 1) so no SETMAIN run is needed. The launcher no longer overwrites
  // SW.CFG, so this baked sound config survives and FX work out of the box.
  await db.execute(
    "UPDATE games SET setup_exe=NULL, download_url='https://github.com/CrossplayGaming/dosdeck-packs/releases/download/v1/shadow-warrior.zip' WHERE title='Shadow Warrior (Shareware)'"
  );
  // Ensure Shadow Warrior Modern WASD scheme exists (self-healing, unconditional)
  {
    const swRow = await db.select("SELECT id FROM games WHERE title='Shadow Warrior (Shareware)' LIMIT 1");
    if (swRow.length) {
      const gid = swRow[0].id;
      const hasWasd = await db.select("SELECT id FROM schemes WHERE game_id=? AND name='Modern WASD' LIMIT 1", [gid]);
      if (!hasWasd.length) {
        const sr = await db.execute(
          "INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,'Modern WASD','modern-kb','core',1)", [gid]
        );
        const sid = sr.lastInsertId;
        const bindings = [
          ['Move forward','W','key_up',1], ['Move backward','S','key_down',2],
          ['Strafe left','A','key_a',3], ['Strafe right','D','key_d',4],
          ['Fire','Ctrl','key_lctrl',5], ['Open / Use','Space','key_space',6],
          ['Jump','E','key_e',7], ['Crouch','C','key_c',8],
          ['Run','Shift','key_lshift',9],
          ['Look up','PgUp','key_pageup',10], ['Look down','PgDn','key_pagedown',11],
          ['Center view','End','key_end',12], ['Automap','Tab','key_tab',13],
          ['Weapon 1','1','key_1',14], ['Weapon 2','2','key_2',15],
          ['Weapon 3','3','key_3',16], ['Weapon 4','4','key_4',17],
          ['Save game','F2','key_f2',18], ['Load game','F3','key_f3',19],
          ['Quit','F10','key_f10',20], ['Pause / Menu','Esc','key_esc',21],
        ];
        for (const [action, input, event, order] of bindings) {
          await db.execute(
            'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
            [sid, action, input, event, order]
          );
        }
      }
    }
  }

  // Dedup: remove duplicate game titles, keeping the copy with install_path (or lowest id).
  // Can happen if AppData folders are merged during testing.
  {
    const dupes = await db.select(`
      SELECT title FROM games GROUP BY title HAVING COUNT(*) > 1
    `);
    for (const { title } of dupes) {
      const rows = await db.select(
        `SELECT id, install_path FROM games WHERE title=? ORDER BY CASE WHEN install_path!='' THEN 0 ELSE 1 END, id ASC`,
        [title]
      );
      // Keep the first (installed or lowest id), delete the rest
      for (const row of rows.slice(1)) {
        const schemes = await db.select('SELECT id FROM schemes WHERE game_id=?', [row.id]);
        for (const s of schemes) {
          await db.execute('DELETE FROM bindings WHERE scheme_id=?', [s.id]);
        }
        await db.execute('DELETE FROM schemes WHERE game_id=?', [row.id]);
        await db.execute('DELETE FROM games WHERE id=?', [row.id]);
      }
    }
  }

  // Seed on first run
  const seeded = await db.select("SELECT value FROM meta WHERE key='seeded'");
  if (!seeded.length) {
    for (const t of SEED_TEMPLATES) {
      await db.execute(
        'INSERT INTO genre_templates (genre_tag, subtype, action_list, default_modern_kb, default_controller) VALUES (?,?,?,?,?)',
        [t.genre_tag, t.subtype || null, JSON.stringify(t.action_list), JSON.stringify(t.default_modern_kb), JSON.stringify(t.default_controller)]
      );
    }
    for (const g of SEED_GAMES) {
      const res = await db.execute(
        'INSERT INTO games (title,genre_tag,subtype,description,art_path,dosbox_config,install_path,executable,engine,episodes,setup_exe,verified,source_type,download_url,buy_url,folder_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [g.title, g.genre_tag, g.subtype, g.description, g.art_path, g.dosbox_config, g.install_path, g.executable, g.engine||'generic', g.episodes||null, g.setup_exe||null, g.verified, g.source_type, g.download_url||null, g.buy_url||null, g.folder_name||null]
      );
      const gameId = res.lastInsertId;
      for (const s of SEED_SCHEMES.filter(s => s.game_title === g.title)) {
        const sr = await db.execute(
          'INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,?,?,?,?)',
          [gameId, s.name, s.input_style, s.source, s.always_run ? 1 : 0]
        );
        const schemeId = sr.lastInsertId;
        for (const b of s.bindings) {
          await db.execute(
            'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
            [schemeId, b.action, b.input, b.dosbox_event, b.order]
          );
        }
      }
    }
    await db.execute("INSERT INTO meta (key,value) VALUES ('seeded','1')");
  }

  // Migrate: update buy_urls to point to original DOS versions, not remasters
  await db.execute("UPDATE games SET buy_url='https://www.gog.com/en/game/heretic_shadow_of_the_serpent_riders' WHERE title='Heretic (Shareware)'");
  await db.execute("UPDATE games SET buy_url='https://www.zoom-platform.com/product/duke-nukem-3d-atomic-edition' WHERE title='Duke Nukem 3D'");
  await db.execute("UPDATE games SET buy_url='https://www.gog.com/en/game/commander_keen_complete_pack' WHERE title='Commander Keen 1'");

  // Migrate: set verified=1 for games whose original controls are now confirmed
  await db.execute("UPDATE games SET verified=1 WHERE title='Secret Agent (Shareware)'");

  // Migrate: restore Duke Nukem 3D Original scheme bindings if the user cleared them
  {
    const dukeRow = await db.select("SELECT id FROM games WHERE title='Duke Nukem 3D' LIMIT 1");
    if (dukeRow.length) {
      const gid = dukeRow[0].id;
      const origScheme = await db.select("SELECT id FROM schemes WHERE game_id=? AND input_style='original' LIMIT 1", [gid]);
      if (origScheme.length) {
        const sid = origScheme[0].id;
        const bindCount = await db.select("SELECT COUNT(*) as n FROM bindings WHERE scheme_id=?", [sid]);
        if ((bindCount[0]?.n ?? 0) < 20) {
          await db.execute("DELETE FROM bindings WHERE scheme_id=?", [sid]);
          for (const b of [
            { action: "Move forward",  input: "Up",    dosbox_event: "key_up",       order: 1 },
            { action: "Move backward", input: "Down",  dosbox_event: "key_down",     order: 2 },
            { action: "Turn left",     input: "Left",  dosbox_event: "key_left",     order: 3 },
            { action: "Turn right",    input: "Right", dosbox_event: "key_right",    order: 4 },
            { action: "Strafe left",   input: "A",     dosbox_event: "key_a",        order: 5 },
            { action: "Strafe right",  input: "Z",     dosbox_event: "key_z",        order: 6 },
            { action: "Fire",          input: "Ctrl",  dosbox_event: "key_lctrl",    order: 7 },
            { action: "Open / Use",    input: "Space", dosbox_event: "key_space",    order: 8 },
            { action: "Jump",          input: "Enter", dosbox_event: "key_enter",    order: 9 },
            { action: "Crouch",        input: "Alt",   dosbox_event: "key_lalt",     order: 10 },
            { action: "Run",           input: "Shift", dosbox_event: "key_lshift",   order: 11 },
            { action: "Look up",       input: "PgUp",  dosbox_event: "key_pageup",   order: 12 },
            { action: "Look down",     input: "PgDn",  dosbox_event: "key_pagedown", order: 13 },
            { action: "Center view",   input: "End",   dosbox_event: "key_end",      order: 14 },
            { action: "Automap",       input: "Tab",   dosbox_event: "key_tab",      order: 15 },
            { action: "Weapon 1",      input: "1",     dosbox_event: "key_1",        order: 16 },
            { action: "Weapon 2",      input: "2",     dosbox_event: "key_2",        order: 17 },
            { action: "Weapon 3",      input: "3",     dosbox_event: "key_3",        order: 18 },
            { action: "Weapon 4",      input: "4",     dosbox_event: "key_4",        order: 19 },
            { action: "Weapon 5",      input: "5",     dosbox_event: "key_5",        order: 20 },
            { action: "Weapon 6",      input: "6",     dosbox_event: "key_6",        order: 21 },
            { action: "Weapon 7",      input: "7",     dosbox_event: "key_7",        order: 22 },
            { action: "Save game",     input: "F2",    dosbox_event: "key_f2",       order: 23 },
            { action: "Load game",     input: "F3",    dosbox_event: "key_f3",       order: 24 },
            { action: "Quit",          input: "F10",   dosbox_event: "key_f10",      order: 25 },
            { action: "Pause / Menu",  input: "Esc",   dosbox_event: "key_esc",      order: 26 },
          ]) await db.execute('INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
            [sid, b.action, b.input, b.dosbox_event, b.order]);
        }
      }
    }
  }

  // Migrate: correct executables that were wrong in earlier seeds
  await db.execute("UPDATE games SET executable='DN1.EXE' WHERE title='Duke Nukem (Shareware)'");
  await db.execute("UPDATE games SET executable='WOLF3D.EXE' WHERE title='Wolfenstein 3D (Shareware)'"  );

  // Always sync seeded game executables and episodes — scanner must never overwrite a known seed exe
  for (const g of SEED_GAMES) {
    if (g.executable) {
      await db.execute(
        'UPDATE games SET executable=?, episodes=?, setup_exe=? WHERE title=? AND source_type=?',
        [g.executable, g.episodes || null, g.setup_exe || null, g.title, g.source_type]
      );
    }
  }

  // Ensure all seeded games exist — re-inserts any that were deleted, unless the user
  // deliberately removed them (tracked in removed_seeded_titles meta entry).
  const removedRow = await db.select("SELECT value FROM meta WHERE key='removed_seeded_titles' LIMIT 1");
  const removedTitles = removedRow.length ? JSON.parse(removedRow[0].value) : [];

  for (const g of SEED_GAMES) {
    if (removedTitles.includes(g.title)) continue;
    const existing = await db.select('SELECT id FROM games WHERE title=? LIMIT 1', [g.title]);
    if (!existing.length) {
      const res = await db.execute(
        'INSERT INTO games (title,genre_tag,subtype,description,art_path,dosbox_config,install_path,executable,engine,episodes,setup_exe,verified,source_type,download_url,buy_url,folder_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [g.title, g.genre_tag, g.subtype, g.description, g.art_path, g.dosbox_config, g.install_path, g.executable, g.engine||'generic', g.episodes||null, g.setup_exe||null, g.verified, g.source_type, g.download_url||null, g.buy_url||null, g.folder_name||null]
      );
      const gameId = res.lastInsertId;
      for (const s of SEED_SCHEMES.filter(s => s.game_title === g.title)) {
        const sr = await db.execute(
          'INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,?,?,?,?)',
          [gameId, s.name, s.input_style, s.source, s.always_run ? 1 : 0]
        );
        const schemeId = sr.lastInsertId;
        for (const b of s.bindings) {
          await db.execute(
            'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
            [schemeId, b.action, b.input, b.dosbox_event, b.order]
          );
        }
      }
    }
  }

  return {
    getGames: async (f = {}) => {
      let rows = await db.select('SELECT * FROM games ORDER BY title');
      if (f.genre)  rows = rows.filter(g => g.genre_tag === f.genre);
      if (f.source === 'included') rows = rows.filter(g => g.source_type !== 'copied');
      if (f.source === 'user')     rows = rows.filter(g => g.source_type === 'copied');
      if (f.search) rows = rows.filter(g => g.title.toLowerCase().includes(f.search.toLowerCase()));
      return rows;
    },
    getGame: async (id) => {
      const rows = await db.select('SELECT * FROM games WHERE id=?', [id]);
      return rows[0] || null;
    },
    addGame: async (data) => {
      const res = await db.execute(
        'INSERT INTO games (title,genre_tag,subtype,description,art_path,dosbox_config,install_path,executable,engine,verified,source_type) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [data.title, data.genre_tag, data.subtype||'', data.description||'', data.art_path||null, data.dosbox_config||'', data.install_path||'', data.executable||'', data.engine||'generic', data.verified?1:0, data.source_type||'copied']
      );
      return { id: res.lastInsertId, ...data };
    },
    updateGame: async (id, data) => {
      const fields = Object.keys(data).map(k => `${k}=?`).join(',');
      await db.execute(`UPDATE games SET ${fields} WHERE id=?`, [...Object.values(data), id]);
    },
    deleteGame: async (id) => {
      const schemes = await db.select('SELECT id FROM schemes WHERE game_id=?', [id]);
      for (const s of schemes) {
        await db.execute('DELETE FROM bindings WHERE scheme_id=?', [s.id]);
      }
      await db.execute('DELETE FROM schemes WHERE game_id=?', [id]);
      await db.execute('DELETE FROM games WHERE id=?', [id]);
    },
    getSchemes: (gameId) => db.select('SELECT * FROM schemes WHERE game_id=? ORDER BY id', [gameId]),
    addScheme: async (data) => {
      const res = await db.execute(
        'INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,?,?,?,?)',
        [data.game_id, data.name, data.input_style||'modern-kb', data.source||'user', data.always_run ? 1 : 0]
      );
      return { id: res.lastInsertId, ...data };
    },
    updateScheme: async (id, data) => {
      const fields = Object.keys(data).map(k => `${k}=?`).join(',');
      await db.execute(`UPDATE schemes SET ${fields} WHERE id=?`, [...Object.values(data), id]);
    },
    getBindings: (schemeId) => db.select('SELECT * FROM bindings WHERE scheme_id=? ORDER BY sort_order', [schemeId]),
    addBinding: (data) => db.execute(
      'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
      [data.scheme_id, data.action, data.input||'', data.dosbox_event||'', data.order||0]
    ),
    updateBinding: (id, input) => db.execute('UPDATE bindings SET input=? WHERE id=?', [input, id]),
    deleteBindings: (schemeId) => db.execute('DELETE FROM bindings WHERE scheme_id=?', [schemeId]),
    getGenreTemplate: async (genre) => {
      const rows = await db.select('SELECT * FROM genre_templates WHERE genre_tag=? LIMIT 1', [genre]);
      if (!rows[0]) return null;
      const t = rows[0];
      return {
        ...t,
        action_list: JSON.parse(t.action_list || '[]'),
        default_modern_kb: JSON.parse(t.default_modern_kb || '{}'),
        default_controller: JSON.parse(t.default_controller || '{}'),
      };
    },
    getAllGenreTemplates: async () => {
      const rows = await db.select('SELECT * FROM genre_templates');
      return rows.map(t => ({
        ...t,
        action_list: JSON.parse(t.action_list || '[]'),
        default_modern_kb: JSON.parse(t.default_modern_kb || '{}'),
        default_controller: JSON.parse(t.default_controller || '{}'),
      }));
    },

    markSeededGameRemoved: async (title) => {
      const row = await db.select("SELECT value FROM meta WHERE key='removed_seeded_titles' LIMIT 1");
      const list = row.length ? JSON.parse(row[0].value) : [];
      if (!list.includes(title)) list.push(title);
      if (row.length) {
        await db.execute("UPDATE meta SET value=? WHERE key='removed_seeded_titles'", [JSON.stringify(list)]);
      } else {
        await db.execute("INSERT INTO meta (key,value) VALUES ('removed_seeded_titles',?)", [JSON.stringify(list)]);
      }
    },

    restoreAllSeededGames: async () => {
      await db.execute("DELETE FROM meta WHERE key='removed_seeded_titles'");
      for (const g of SEED_GAMES) {
        const existing = await db.select('SELECT id FROM games WHERE title=? LIMIT 1', [g.title]);
        if (existing.length) continue;
        const res = await db.execute(
          'INSERT INTO games (title,genre_tag,subtype,description,art_path,dosbox_config,install_path,executable,engine,episodes,verified,source_type,download_url,buy_url,folder_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [g.title, g.genre_tag, g.subtype, g.description, g.art_path, g.dosbox_config, g.install_path, g.executable, g.engine||'generic', g.episodes||null, g.verified, g.source_type, g.download_url||null, g.buy_url||null, g.folder_name||null]
        );
        const gameId = res.lastInsertId;
        for (const s of SEED_SCHEMES.filter(s => s.game_title === g.title)) {
          const sr = await db.execute(
            'INSERT INTO schemes (game_id,name,input_style,source,always_run) VALUES (?,?,?,?,?)',
            [gameId, s.name, s.input_style, s.source, s.always_run ? 1 : 0]
          );
          const schemeId = sr.lastInsertId;
          for (const b of s.bindings) {
            await db.execute(
              'INSERT INTO bindings (scheme_id,action,input,dosbox_event,sort_order) VALUES (?,?,?,?,?)',
              [schemeId, b.action, b.input, b.dosbox_event, b.order]
            );
          }
        }
      }
    },
  };
}

export async function initDb() {
  if (inTauri()) {
    try {
      _db = await createSqlStore();
    } catch (e) {
      console.error('SQLite init failed, falling back to in-memory store:', e);
      _mem = createMemStore();
    }
  } else {
    _mem = createMemStore();
  }
}

function store() {
  return _db || _mem;
}

export const db = {
  getGames:           (f)        => store().getGames(f),
  getGame:            (id)       => store().getGame(id),
  addGame:            (data)     => store().addGame(data),
  updateGame:         (id, data) => store().updateGame(id, data),
  deleteGame:         (id)       => store().deleteGame(id),
  getSchemes:         (gameId)   => store().getSchemes(gameId),
  addScheme:          (data)     => store().addScheme(data),
  updateScheme:       (id, data) => store().updateScheme(id, data),
  getBindings:        (schemeId) => store().getBindings(schemeId),
  addBinding:         (data)     => store().addBinding(data),
  updateBinding:      (id, inp)  => store().updateBinding(id, inp),
  deleteBindings:     (schemeId) => store().deleteBindings(schemeId),
  getGenreTemplate:        (genre)  => store().getGenreTemplate(genre),
  getAllGenreTemplates:     ()       => store().getAllGenreTemplates(),
  markSeededGameRemoved:   (title)  => store().markSeededGameRemoved(title),
  restoreAllSeededGames:   ()       => store().restoreAllSeededGames(),
};
