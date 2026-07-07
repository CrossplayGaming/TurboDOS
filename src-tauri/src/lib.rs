mod secrets;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BindingArg {
    pub action: String,
    pub dosbox_event: String,
    pub input: String,
}

/// Per-game controller binding: maps a controller input token to a scheme action name.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CtrlGameBinding {
    pub action: String,
    pub ctrl: String, // token: "button:South", "axis:LeftStickY:neg:0.25", etc.
}

/// Resolve the bundled DOSBox executable path.
/// In dev mode it's next to src-tauri; in release it's in the app resources dir.
fn dosbox_exe() -> PathBuf {
    // Try relative to executable first (release bundle)
    if let Ok(exe) = std::env::current_exe() {
        let candidate = exe.parent().unwrap_or(std::path::Path::new("."))
            .join("dosbox")
            .join("dosbox.exe");
        if candidate.exists() {
            return candidate;
        }
    }
    // Dev mode: dosbox folder is inside src-tauri/
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("dosbox")
        .join("dosbox.exe");
    dev
}

/// DOOM-engine games that accept a -config flag and use DEFAULT.CFG for mouse settings.
fn is_doom_engine(exe_name: &str) -> bool {
    matches!(exe_name.to_lowercase().as_str(),
        "doom.exe" | "doom1.exe" | "doomsw.exe" | "doom2.exe" |
        "heretic.exe" | "hexen.exe" | "strife.exe" |
        "plutonia.exe" | "tnt.exe" | "final.exe")
}

/// Build engine games (Duke3D / Blood / Shadow Warrior) install their own INT 9h handler
/// and read raw scan codes — DOSBox mapper remapping conflicts with this. Detect by GRP file.
fn is_build_engine(install_path: &str) -> bool {
    let dir = std::path::Path::new(install_path);
    dir.join("DUKE3D.GRP").exists()
        || dir.join("BLOOD.RFF").exists()
        || dir.join("SW.GRP").exists()
}

/// Map our scheme `input` string to the key name Duke3D uses in [KeyDefinitions].
/// Returns None for mouse inputs (LMB, RMB, WheelUp, WheelDown) — those stay in [Controls].
fn input_to_duke3d_key(input: &str) -> Option<&'static str> {
    match input {
        "Up"    => Some("Up"),    "Down"  => Some("Down"),
        "Left"  => Some("Left"),  "Right" => Some("Right"),
        "W"     => Some("W"),     "A"     => Some("A"),
        "S"     => Some("S"),     "D"     => Some("D"),
        "E"     => Some("E"),     "C"     => Some("C"),
        "Z"     => Some("Z"),     "Q"     => Some("Q"),
        "R"     => Some("R"),     "F"     => Some("F"),
        "G"     => Some("G"),     "H"     => Some("H"),
        "T"     => Some("T"),     "X"     => Some("X"),
        "V"     => Some("V"),     "B"     => Some("B"),
        // Build-engine CFG key names: modifiers are the sided variants ("LCtrl"/"LAlt");
        // bare "Ctrl"/"Alt" are not valid names and make the game drop the whole keydef
        // line (Shadow Warrior rejects it outright; Duke3D salvages the alternate slot).
        "Ctrl"  => Some("LCtrl"), "Alt"   => Some("LAlt"),
        "Shift" => Some("LShift"),"Space" => Some("Space"),
        "Enter" => Some("Enter"), "Tab"   => Some("Tab"),
        "Esc"   => Some("Escape"),"BakSpc"=> Some("BakSpc"),
        "PgUp"  => Some("PgUp"),  "PgDn"  => Some("PgDn"),
        "Home"  => Some("Home"),  "End"   => Some("End"),
        "Ins"   => Some("Ins"),   "Del"   => Some("Del"),
        "1" => Some("1"), "2" => Some("2"), "3" => Some("3"),
        "4" => Some("4"), "5" => Some("5"), "6" => Some("6"),
        "7" => Some("7"), "8" => Some("8"), "9" => Some("9"),
        "0" => Some("0"), "-" => Some("-"), "=" => Some("="),
        "[" => Some("["), "]" => Some("]"), "/" => Some("/"),
        _ => None, // Mouse, wheel, unknown → skip
    }
}

/// Map our scheme `action` string to the Duke3D [KeyDefinitions] key name.
fn action_to_duke3d_def(action: &str) -> Option<&'static str> {
    match action {
        "Move forward"  => Some("Move_Forward"),
        "Move backward" => Some("Move_Backward"),
        "Turn left"     => Some("Turn_Left"),
        "Turn right"    => Some("Turn_Right"),
        "Strafe left"   => Some("Strafe_Left"),
        "Strafe right"  => Some("Strafe_Right"),
        "Fire"          => Some("Fire"),
        "Open / Use"    => Some("Open"),
        "Jump"          => Some("Jump"),
        "Crouch"        => Some("Crouch"),
        "Run"           => Some("Run"),
        "Map"           => Some("Map"),
        "Next weapon"   => Some("Next_Weapon"),
        "Prev weapon"   => Some("Previous_Weapon"),
        "Look up"       => Some("Look_Up"),
        "Look down"     => Some("Look_Down"),
        "Center view"   => Some("Center_View"),
        "AutoRun"       => Some("AutoRun"),
        _ => None,
    }
}

/// Write [KeyDefinitions] into DUKE3D.CFG based on the active scheme's bindings.
/// Preserves all other sections; replaces or appends [KeyDefinitions].
fn build_engine_cfg_name(install_path: &str) -> &'static str {
    let p = std::path::Path::new(install_path);
    if p.join("SW.GRP").exists() || p.join("SW.EXE").exists() { "SW.CFG" } else { "DUKE3D.CFG" }
}


fn write_duke3d_key_defs(install_path: &str, bindings: &[BindingArg], always_run: bool, fire_alt: Option<&str>) -> Result<(), String> {
    let cfg_path = std::path::Path::new(install_path).join(build_engine_cfg_name(install_path));
    let existing = std::fs::read_to_string(&cfg_path).unwrap_or_default();
    // If the bundled BMOUSE.EXE mouse driver is present, route mouse input through it:
    // ControllerType 3 = "Keyboard and External" + ExternalFilename = BMOUSE.EXE. This is
    // what makes Build-engine vertical mouselook work under DOSBox (the internal mouse,
    // ControllerType 1, filters out the smaller axis so aim up/down barely registers).
    // Without BMOUSE present, keep 1 (keyboard + internal mouse turning).
    let bmouse = std::path::Path::new(install_path).join("BMOUSE.EXE").exists();

    let mut out = String::new();
    let mut in_key_section = false;
    for line in existing.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') {
            in_key_section = trimmed.eq_ignore_ascii_case("[KeyDefinitions]");
        }
        if in_key_section { continue; }
        if trimmed.starts_with("ControllerType") {
            if bmouse {
                out.push_str("ControllerType = 3\n");
                out.push_str("ExternalFilename = \"BMOUSE.EXE\"\n");
            } else {
                out.push_str("ControllerType = 1\n");
            }
        } else if trimmed.starts_with("ExternalFilename") {
            // Re-emitted alongside ControllerType when BMOUSE is present; else preserve as-is.
            if !bmouse { out.push_str(line); out.push('\n'); }
        } else if trimmed.starts_with("RunMode") {
            out.push_str(&format!("RunMode = {}\n", if always_run { 1 } else { 0 }));
        } else {
            out.push_str(line);
            out.push('\n');
        }
    }
    let out = out.trim_end().to_string();

    // Default [KeyDefinitions] values — Duke3D v1.3D defaults
    let defaults: &[(&str, &str)] = &[
        ("Move_Forward",          "Up"),
        ("Move_Backward",         "Down"),
        ("Turn_Left",             "Left"),
        ("Turn_Right",            "Right"),
        ("Strafe",                "LAlt"),
        ("Fire",                  "LCtrl"),
        ("Open",                  "Space"),
        ("Run",                   "LShift"),
        ("AutoRun",               ""),
        ("Jump",                  "/"),
        ("Crouch",                "Z"),
        ("Look_Up",               "PgUp"),
        ("Look_Down",             "PgDn"),
        ("Look_Left",             ""),
        ("Look_Right",            ""),
        ("Strafe_Left",           "A"),
        ("Strafe_Right",          "Z"),
        ("Aim_Up",                ""),
        ("Aim_Down",              ""),
        ("Weapon_1",              "1"),
        ("Weapon_2",              "2"),
        ("Weapon_3",              "3"),
        ("Weapon_4",              "4"),
        ("Weapon_5",              "5"),
        ("Weapon_6",              "6"),
        ("Weapon_7",              "7"),
        ("Inventory",             "Enter"),
        ("Inventory_Left",        "["),
        ("Inventory_Right",       "]"),
        ("Holo_Duke",             "H"),
        ("Jetpack",               "J"),
        ("NightVision",           "N"),
        ("MedKit",                "M"),
        ("TurnAround",            "BakSpc"),
        ("SendMessage",           "T"),
        ("Map",                   "Tab"),
        ("Shrink_Screen",         "-"),
        ("Enlarge_Screen",        "="),
        ("Center_View",           "End"),
        ("Holster_Weapon",        ""),
        ("Show_Opponents_Weapon", ""),
        ("Map_Follow_Mode",       ""),
        ("See_Coop_View",         ""),
        ("Mouse_Aiming",          "U"),
        ("Toggle_Crosshair",      "I"),
        ("Steroids",              "R"),
        ("Quick_Kick",            "`"),
        ("Next_Weapon",           "]"),
        ("Previous_Weapon",       "["),
    ];

    // 1. Build the explicit bindings map: duke3d_def_name → key_string
    let mut explicit: HashMap<&str, &str> = HashMap::new();
    for b in bindings {
        if let (Some(def_key), Some(game_key)) = (action_to_duke3d_def(&b.action), input_to_duke3d_key(&b.input)) {
            explicit.insert(def_key, game_key);
        }
    }

    // 2. Set of keys claimed by explicit bindings — used to evict conflicting defaults
    let bound_keys: std::collections::HashSet<&str> = explicit.values().copied()
        .filter(|k| !k.is_empty())
        .collect();

    // 3. Build the final values: start from defaults, apply explicit overrides,
    //    and clear any default whose key was claimed by a different explicit binding.
    let mut final_defs: Vec<(&str, String)> = defaults.iter()
        .map(|(def, default_val)| {
            if let Some(&bound_key) = explicit.get(def) {
                // Explicitly bound action: use the bound key
                (*def, bound_key.to_string())
            } else if !default_val.is_empty() && bound_keys.contains(default_val) {
                // Default key is claimed by an explicit binding — clear to avoid conflicts
                (*def, String::new())
            } else {
                (*def, default_val.to_string())
            }
        })
        .collect();

    // 4. If we have direct Strafe_Left/Strafe_Right bindings, the Strafe modifier key
    //    is redundant and conflicts (especially when set to same key as Crouch).
    let has_direct_strafe = explicit.contains_key("Strafe_Left") || explicit.contains_key("Strafe_Right");
    if has_direct_strafe {
        for (def, val) in final_defs.iter_mut() {
            if *def == "Strafe" { *val = String::new(); break; }
        }
    }

    // Always-run trick: bind Run to BOTH the forward movement key AND the manual run key.
    // Duke3D checks Run independently per frame — if Move_Forward's key also triggers Run,
    // the player sprints whenever they move forward. LShift stays as the manual modifier.
    // e.g. for WASD: Run = "W" "LShift"; for original: Run = "Up" "LShift"
    let run_forward_key: String = if always_run {
        final_defs.iter()
            .find(|(d, _)| *d == "Move_Forward")
            .map(|(_, v)| v.clone())
            .filter(|v| !v.is_empty())
            .unwrap_or_default()
    } else {
        String::new()
    };

    // Two-key format: "Primary" "Alternate" — Duke3D v1.3D expects two quoted strings per action.
    let mut section = String::from("\n[KeyDefinitions]\n");
    for (def, val) in &final_defs {
        if *def == "Run" && !run_forward_key.is_empty() {
            // Always-run: bind Run to the forward movement key only.
            section.push_str(&format!("{} = \"{}\" \"\"\n", def, run_forward_key));
        } else if *def == "Fire" {
            let alt = fire_alt.unwrap_or("");
            let row = if val.is_empty() {
                format!("{} = \"\" \"{}\"\n", def, alt)
            } else {
                format!("{} = \"{}\" \"{}\"\n", def, val, alt)
            };
            eprintln!("[TURBODOS] KeyDef Fire line: {}", row.trim());
            section.push_str(&row);
        } else if val.is_empty() {
            section.push_str(&format!("{} = \"\" \"\"\n", def));
        } else {
            section.push_str(&format!("{} = \"{}\" \"\"\n", def, val));
        }
    }
    eprintln!("[TURBODOS] Duke3D KeyDefinitions: {} explicit, {} cleared conflicts",
        explicit.len(),
        final_defs.iter().filter(|(_, v)| v.is_empty()).count());

    let final_content = format!("{}\n{}", out, section);
    std::fs::write(&cfg_path, final_content).map_err(|e| e.to_string())?;
    eprintln!("[TURBODOS] wrote Duke3D [KeyDefinitions] done");
    Ok(())
}

/// Build DOOM's -config file by merging mouse/run settings over the game's existing DEFAULT.CFG.
/// Preserves the user's sound settings, key bindings, etc.
fn doom_game_cfg(install_path: &str, always_run: bool) -> String {
    let default_cfg_path = std::path::Path::new(install_path).join("DEFAULT.CFG");
    let base = std::fs::read_to_string(&default_cfg_path).unwrap_or_else(|_|
        "sfx_volume\t\t\t8\nmusic_volume\t\t\t8\nsnd_channels\t\t\t3\n".to_string()
    );

    let mut settings: Vec<(String, String)> = base.lines()
        .filter_map(|line| {
            let mut parts = line.splitn(2, char::is_whitespace);
            let key = parts.next()?.trim().to_string();
            let val = parts.next().unwrap_or("").trim().to_string();
            if key.is_empty() { None } else { Some((key, val)) }
        })
        .collect();

    let overrides: &[(&str, &str)] = &[
        ("mouse_sensitivity", "5"),
        ("use_mouse",         "1"),
        ("mouseb_fire",       "0"),
        ("mouseb_strafe",     "1"),
        ("mouseb_forward",    "-1"),
        ("novert",            "1"),
        // Force Sound Blaster 16 regardless of what DEFAULT.CFG was saved with.
        // DOOM writes snd_sfxdevice=0 to DEFAULT.CFG if no sound card was detected;
        // without this override every subsequent launch would also have no sound.
        ("snd_sfxdevice",     "3"),
        ("snd_musicdevice",   "3"),
    ];
    for (key, val) in overrides {
        if let Some(entry) = settings.iter_mut().find(|(k, _)| k == key) {
            entry.1 = val.to_string();
        } else {
            settings.push((key.to_string(), val.to_string()));
        }
    }
    if always_run {
        if let Some(e) = settings.iter_mut().find(|(k, _)| k == "joyb_speed") {
            e.1 = "29".to_string();
        } else {
            settings.push(("joyb_speed".to_string(), "29".to_string()));
        }
    }

    settings.iter().map(|(k, v)| format!("{}\t\t\t{}\n", k, v)).collect()
}

/// Build a minimal DOSBox config that mounts the game folder and runs the exe.
/// `game_cfg_dir` is a temp dir path to mount as T: for injecting game config files (empty = skip).
fn build_dosbox_conf(install_path: &str, executable: &str, extra_config: &str, mapper_path: &str, game_cfg_dir: &str, disable_joystick: bool) -> String {
    let mut conf = String::new();
    conf.push_str("[sdl]\n");
    conf.push_str("fullscreen=true\n");
    conf.push_str("output=texture\n");
    // capture_mouse was moved to [mouse] mouse_capture in DOSBox-Staging; keep both for compat.
    conf.push_str("capture_mouse=onstart\n");
    if !mapper_path.is_empty() {
        conf.push_str(&format!("mapperfile={}\n", mapper_path.replace('\\', "/")));
    }
    conf.push_str("\n[mouse]\nmouse_capture=onstart\n\n");
    conf.push_str("[dosbox]\nmachine=svga_s3\n\n");
    conf.push_str("[render]\nscaler=none\n\n");
    conf.push_str("[cpu]\ncycles=auto\n\n");
    conf.push_str("[mixer]\nrate=44100\n\n");
    conf.push_str("[sblaster]\nsbtype=sb16\nsbbase=220\nirq=7\ndma=1\nhdma=5\nsbmixer=true\noplmode=auto\noplemu=default\n\n");
    let joytype = if disable_joystick { "none" } else { "auto" };
    conf.push_str(&format!("[joystick]\njoysticktype={}\ntimed=true\n\n", joytype));

    if !extra_config.is_empty() {
        conf.push_str(extra_config);
        conf.push('\n');
    }

    let exe_name = std::path::Path::new(executable)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(executable);

    conf.push_str("[autoexec]\n");
    conf.push_str(&format!("mount c \"{}\"\n", install_path.replace('\\', "/")));
    if !game_cfg_dir.is_empty() {
        conf.push_str(&format!("mount t \"{}\"\n", game_cfg_dir.replace('\\', "/")));
    }
    // Mount floppy disk images as drive A if any .ima files are present (e.g. Shadow Warrior installer)
    if let Ok(entries) = std::fs::read_dir(install_path) {
        let mut ima_files: Vec<String> = entries.flatten()
            .filter(|e| e.path().extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("ima")).unwrap_or(false))
            .filter_map(|e| e.path().to_str().map(|s| format!("\"{}\"", s.replace('\\', "/"))))
            .collect();
        ima_files.sort();
        if !ima_files.is_empty() {
            conf.push_str(&format!("imgmount a {} -t floppy\n", ima_files.join(" ")));
        }
    }
    conf.push_str("c:\n");
    if !game_cfg_dir.is_empty() && is_doom_engine(exe_name) {
        // Use our mouse-enabled config; DOOM reads it instead of DEFAULT.CFG
        conf.push_str(&format!("{} -config t:\\game.cfg\n", exe_name));
    } else if exe_name.to_lowercase().ends_with(".bat") {
        // A .bat launcher (e.g. Arena's ARENA.BAT) must be CALLed so control returns
        // to autoexec and the `exit` below runs — otherwise DOSBox stays at the DOS
        // prompt after the game quits and the app never sees game-exited.
        conf.push_str(&format!("call {}\n", exe_name));
    } else {
        conf.push_str(&format!("{}\n", exe_name));
    }
    conf.push_str("exit\n");

    conf
}

/// Return the full DOSBox mapper binding string for a given friendly input name.
/// Handles keyboard, mouse, and controller (jaxis/jbutton/jhat).
/// SDL2 gamepad axes: 0=LStick X, 1=LStick Y, 2=RStick X, 3=RStick Y, 4=LT, 5=RT
fn input_to_mapper_binding(input: &str) -> Option<String> {
    match input.trim().to_lowercase().as_str() {
        // Mouse
        "lmb" | "left mouse"              => Some("mouse 0 0 0".to_string()),
        "rmb" | "right mouse"             => Some("mouse 1 0 0".to_string()),
        "mmb" | "middle mouse"            => Some("mouse 2 0 0".to_string()),
        "wheelup"   | "wheel up"          => Some("mouse 3 0 0".to_string()),
        "wheeldown" | "wheel down"        => Some("mouse 4 0 0".to_string()),
        // Controller left stick (axis 0=X, 1=Y; dir 0=neg, 1=pos)
        "lstick up"    | "lstickup"       => Some("jaxis 0 1 0 0".to_string()),
        "lstick down"  | "lstickdown"     => Some("jaxis 0 1 1 0".to_string()),
        "lstick left"  | "lstickleft"     => Some("jaxis 0 0 0 0".to_string()),
        "lstick right" | "lstickright"    => Some("jaxis 0 0 1 0".to_string()),
        // Controller right stick (axis 2=X, 3=Y)
        "rstick left"  | "rstickleft"     => Some("jaxis 0 2 0 0".to_string()),
        "rstick right" | "rstickright"    => Some("jaxis 0 2 1 0".to_string()),
        "rstick up"    | "rstickup"       => Some("jaxis 0 3 0 0".to_string()),
        "rstick down"  | "rstickdown"     => Some("jaxis 0 3 1 0".to_string()),
        // Triggers (axis 4=LT, 5=RT; positive = pressed)
        "lt" | "left trigger"             => Some("jaxis 0 4 1 0".to_string()),
        "rt" | "right trigger"            => Some("jaxis 0 5 1 0".to_string()),
        // Gamepad buttons (Btn_ prefix avoids collision with keyboard A/B/X/Y)
        "btn_a" | "gamepad_a"             => Some("jbutton 0 0 0 0".to_string()),
        "btn_b" | "gamepad_b"             => Some("jbutton 0 1 0 0".to_string()),
        "btn_x" | "gamepad_x"             => Some("jbutton 0 2 0 0".to_string()),
        "btn_y" | "gamepad_y"             => Some("jbutton 0 3 0 0".to_string()),
        "lb" | "l1"                       => Some("jbutton 0 4 0 0".to_string()),
        "rb" | "r1"                       => Some("jbutton 0 5 0 0".to_string()),
        "select" | "back" | "view"        => Some("jbutton 0 6 0 0".to_string()),
        "start" | "menu"                  => Some("jbutton 0 7 0 0".to_string()),
        "ls" | "l3"                       => Some("jbutton 0 8 0 0".to_string()),
        "rs" | "r3"                       => Some("jbutton 0 9 0 0".to_string()),
        // D-pad (hat 0; SDL hat mask: 1=up, 2=right, 4=down, 8=left)
        "dpad_up"    | "dpup"             => Some("jhat 0 0 1 0".to_string()),
        "dpad_down"  | "dpdown"           => Some("jhat 0 0 4 0".to_string()),
        "dpad_left"  | "dpleft"           => Some("jhat 0 0 8 0".to_string()),
        "dpad_right" | "dpright"          => Some("jhat 0 0 2 0".to_string()),
        // Keyboard
        other => input_to_sdl2_scancode(other).map(|sc| format!("key {} 0 0", sc)),
    }
}

fn is_controller_input(input: &str) -> bool {
    matches!(input.trim().to_lowercase().as_str(),
        "lstick up" | "lstickup" |
        "lstick down" | "lstickdown" |
        "lstick left" | "lstickleft" |
        "lstick right" | "lstickright" |
        "rstick left" | "rstickleft" |
        "rstick right" | "rstickright" |
        "rstick up" | "rstickup" |
        "rstick down" | "rstickdown" |
        "lt" | "left trigger" |
        "rt" | "right trigger" |
        "lb" | "l1" |
        "rb" | "r1" |
        "btn_a" | "gamepad_a" |
        "btn_b" | "gamepad_b" |
        "btn_x" | "gamepad_x" |
        "btn_y" | "gamepad_y" |
        "select" | "back" | "view" |
        "start" | "menu" |
        "ls" | "l3" |
        "rs" | "r3" |
        "dpad_up" | "dpup" |
        "dpad_down" | "dpdown" |
        "dpad_left" | "dpleft" |
        "dpad_right" | "dpright"
    )
}

/// Map a friendly key name to its SDL2 scancode (used in DOSBox Staging mapper files).
fn input_to_sdl2_scancode(input: &str) -> Option<u32> {
    match input.trim().to_lowercase().as_str() {
        "a" => Some(4),  "b" => Some(5),  "c" => Some(6),  "d" => Some(7),
        "e" => Some(8),  "f" => Some(9),  "g" => Some(10), "h" => Some(11),
        "i" => Some(12), "j" => Some(13), "k" => Some(14), "l" => Some(15),
        "m" => Some(16), "n" => Some(17), "o" => Some(18), "p" => Some(19),
        "q" => Some(20), "r" => Some(21), "s" => Some(22), "t" => Some(23),
        "u" => Some(24), "v" => Some(25), "w" => Some(26), "x" => Some(27),
        "y" => Some(28), "z" => Some(29),
        "1" => Some(30), "2" => Some(31), "3" => Some(32), "4" => Some(33),
        "5" => Some(34), "6" => Some(35), "7" => Some(36), "8" => Some(37),
        "9" => Some(38), "0" => Some(39),
        "enter" => Some(40), "esc" => Some(41), "backspace" => Some(42),
        "tab" => Some(43),   "space" => Some(44),
        "up" => Some(82),    "down" => Some(81),
        "left" => Some(80),  "right" => Some(79),
        "ctrl" | "lctrl"  => Some(224),
        "shift" | "lshift" => Some(225),
        "alt" | "lalt"    => Some(226),
        "[" => Some(47), "]" => Some(48),
        "," => Some(54), "." => Some(55),
        // Function keys
        "f1" => Some(58),  "f2" => Some(59),  "f3" => Some(60),  "f4" => Some(61),
        "f5" => Some(62),  "f6" => Some(63),  "f7" => Some(64),  "f8" => Some(65),
        "f9" => Some(66),  "f10" => Some(67), "f11" => Some(68), "f12" => Some(69),
        // Navigation cluster
        "delete" | "del"               => Some(76),
        "insert" | "ins"               => Some(73),
        "home"                         => Some(74),
        "end"                          => Some(77),
        "pageup"   | "pgup"  | "page up"   => Some(75),
        "pagedown" | "pgdn"  | "page down" => Some(78),
        _ => None,
    }
}

/// Build a complete DOSBox Staging mapper file.
/// Uses a unified event→bindings map: defaults cover all keyboard + mouse events,
/// user bindings (keyboard, mouse, or controller) replace defaults by event name.
///
/// dosbox_event may use "+" to fire multiple DOSBox events from one physical key
/// (e.g. "key_lalt+key_left" so pressing A sends Alt+Left for Wolf3D strafe).
/// Each mapped physical key is added as a trigger for its target event(s) and stripped
/// from every other event it defaulted to — so a remapped key never fires its original
/// action too (e.g. A used for strafe stops also triggering key_a / Stand High).
///
/// DOSBox Staging mapper format: each binding is a separate quoted token on the line.
///   key_lalt "key 226 0 0" "key 4 0 0"
/// Putting both in one quoted string is a parse error DOSBox silently ignores.
fn build_mapper(bindings: &[BindingArg]) -> String {
    // event → list of physical-key binding strings
    let mut event_map: std::collections::HashMap<String, Vec<String>> = [
        // Letters
        ("key_a","key 4 0 0"),("key_b","key 5 0 0"),("key_c","key 6 0 0"),("key_d","key 7 0 0"),
        ("key_e","key 8 0 0"),("key_f","key 9 0 0"),("key_g","key 10 0 0"),("key_h","key 11 0 0"),
        ("key_i","key 12 0 0"),("key_j","key 13 0 0"),("key_k","key 14 0 0"),("key_l","key 15 0 0"),
        ("key_m","key 16 0 0"),("key_n","key 17 0 0"),("key_o","key 18 0 0"),("key_p","key 19 0 0"),
        ("key_q","key 20 0 0"),("key_r","key 21 0 0"),("key_s","key 22 0 0"),("key_t","key 23 0 0"),
        ("key_u","key 24 0 0"),("key_v","key 25 0 0"),("key_w","key 26 0 0"),("key_x","key 27 0 0"),
        ("key_y","key 28 0 0"),("key_z","key 29 0 0"),
        // Number row
        ("key_1","key 30 0 0"),("key_2","key 31 0 0"),("key_3","key 32 0 0"),("key_4","key 33 0 0"),
        ("key_5","key 34 0 0"),("key_6","key 35 0 0"),("key_7","key 36 0 0"),("key_8","key 37 0 0"),
        ("key_9","key 38 0 0"),("key_0","key 39 0 0"),
        // Common
        ("key_enter","key 40 0 0"),("key_esc","key 41 0 0"),("key_backspace","key 42 0 0"),
        ("key_tab","key 43 0 0"),("key_space","key 44 0 0"),
        // Punctuation
        ("key_minus","key 45 0 0"),("key_equals","key 46 0 0"),
        ("key_lbracket","key 47 0 0"),("key_rbracket","key 48 0 0"),
        ("key_backslash","key 49 0 0"),("key_semicolon","key 51 0 0"),
        ("key_quote","key 52 0 0"),("key_grave","key 53 0 0"),
        ("key_comma","key 54 0 0"),("key_period","key 55 0 0"),("key_slash","key 56 0 0"),
        // Function keys
        ("key_f1","key 58 0 0"),("key_f2","key 59 0 0"),("key_f3","key 60 0 0"),
        ("key_f4","key 61 0 0"),("key_f5","key 62 0 0"),("key_f6","key 63 0 0"),
        ("key_f7","key 64 0 0"),("key_f8","key 65 0 0"),("key_f9","key 66 0 0"),
        ("key_f10","key 67 0 0"),("key_f11","key 68 0 0"),("key_f12","key 69 0 0"),
        // Navigation cluster
        ("key_printscr","key 70 0 0"),("key_scrolllock","key 71 0 0"),("key_pause","key 72 0 0"),
        ("key_insert","key 73 0 0"),("key_home","key 74 0 0"),("key_pageup","key 75 0 0"),
        ("key_delete","key 76 0 0"),("key_end","key 77 0 0"),("key_pagedown","key 78 0 0"),
        // Arrow keys
        ("key_right","key 79 0 0"),("key_left","key 80 0 0"),("key_down","key 81 0 0"),("key_up","key 82 0 0"),
        // Modifiers
        ("key_lctrl","key 224 0 0"),("key_lshift","key 225 0 0"),("key_lalt","key 226 0 0"),
        ("key_rctrl","key 228 0 0"),("key_rshift","key 229 0 0"),("key_ralt","key 230 0 0"),
        // Numpad
        ("key_numlock","key 83 0 0"),("key_kp_divide","key 84 0 0"),("key_kp_multiply","key 85 0 0"),
        ("key_kp_minus","key 86 0 0"),("key_kp_plus","key 87 0 0"),("key_kp_enter","key 88 0 0"),
        ("key_kp1","key 89 0 0"),("key_kp2","key 90 0 0"),("key_kp3","key 91 0 0"),
        ("key_kp4","key 92 0 0"),("key_kp5","key 93 0 0"),("key_kp6","key 94 0 0"),
        ("key_kp7","key 95 0 0"),("key_kp8","key 96 0 0"),("key_kp9","key 97 0 0"),
        ("key_kp0","key 98 0 0"),("key_kp_period","key 99 0 0"),
        // Mouse defaults (must be explicit — mapper is a complete replacement).
        // Physical mouse buttons must be listed or they stop working when a mapper is loaded.
        // "key 135/136/137 0 0" are appended below as extra triggers (international keys
        // no US keyboard can produce) so the XInput mapper can also fire mouse events.
        ("mouse_left","mouse 0 0 0"),("mouse_right","mouse 1 0 0"),("mouse_middle","mouse 2 0 0"),
        ("mouse_wheelup","mouse 3 0 0"),("mouse_wheeldown","mouse 4 0 0"),
    ].iter().map(|&(k,v)| (k.to_string(), vec![v.to_string()])).collect();

    // Add international-key controller routes for mouse buttons (alongside the physical mouse defaults).
    for (event, scan_token) in [
        ("mouse_left",   "key 135 0 0"),
        ("mouse_right",  "key 136 0 0"),
        ("mouse_middle", "key 137 0 0"),
    ] {
        event_map.entry(event.to_string()).or_default().push(scan_token.to_string());
    }

    // Track which physical-key binding strings were explicitly claimed by user single-event
    // overrides, and which DOSBox events were overridden. Used below to clear conflicting
    // default mappings (e.g. remapping Fire to F must also remove the default key_f → F
    // entry, otherwise pressing F fires both key_lctrl AND key_f in the DOS VM).
    let mut claimed_keys: std::collections::HashSet<String> = std::collections::HashSet::new();
    // (event, physical-key) pairs the user explicitly bound. A claimed key survives the
    // cleanup only on the event(s) it was bound to — so Q→key_a keeps Q on Stand High,
    // while A (reused for the strafe combo) is stripped off key_a.
    let mut user_bindings: std::collections::HashSet<(String, String)> = std::collections::HashSet::new();

    for b in bindings {
        if b.dosbox_event.is_empty() || b.input.is_empty() { continue; }
        if is_controller_input(&b.input) { continue; }
        if let Some(binding) = input_to_mapper_binding(&b.input) {
            // Split on '+' so a combo (key_rctrl+key_left) adds the physical key as a
            // trigger for each target event; a single event is just the one-element case.
            // The event's default physical key is kept (so the XInput controller mapper,
            // which injects an event's default scancode, still triggers it).
            let events: Vec<&str> = b.dosbox_event.split('+')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .collect();
            for event in events {
                event_map.entry(event.to_string())
                    .or_insert_with(Vec::new)
                    .push(binding.clone());
                user_bindings.insert((event.to_string(), binding.clone()));
            }
            claimed_keys.insert(binding);
        }
    }

    // Strip each claimed physical key from every event EXCEPT the one(s) the user bound
    // it to. Prevents a remapped key from also firing its original default event — e.g.
    // A now strafes (key_rctrl+key_left), so it must stop firing key_a (Stand High), even
    // though key_a is a user event (Q was bound to it).
    for (event, bs) in event_map.iter_mut() {
        bs.retain(|b| !claimed_keys.contains(b) || user_bindings.contains(&(event.clone(), b.clone())));
    }

    // Each binding is its own quoted token: key_lalt "key 226 0 0" "key 4 0 0"
    let mut lines: Vec<String> = event_map.iter()
        .map(|(event, bs)| {
            let tokens: String = bs.iter()
                .map(|b| format!("\"{}\"", b))
                .collect::<Vec<_>>()
                .join(" ");
            format!("{} {}", event, tokens)
        })
        .collect();
    lines.sort();
    lines.join("\n")
}

// ─── Controller → keyboard mapper (runs in background while DOSBox is open) ───

use std::sync::{Arc, OnceLock, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};

static CTRL_STOP: OnceLock<Mutex<Option<Arc<AtomicBool>>>> = OnceLock::new();
fn ctrl_stop_global() -> &'static Mutex<Option<Arc<AtomicBool>>> {
    CTRL_STOP.get_or_init(|| Mutex::new(None))
}

#[derive(Clone)]
enum PhysicalInput {
    AxisNeg(gilrs::Axis, f32),
    AxisPos(gilrs::Axis, f32),
    Button(gilrs::Button),
}

struct CtrlInput(Vec<PhysicalInput>);

struct CtrlMapping { ctrl_input: CtrlInput, vks: Vec<u16> }

fn axis_neg(axis: gilrs::Axis) -> PhysicalInput { PhysicalInput::AxisNeg(axis, 0.25) }
fn axis_pos(axis: gilrs::Axis) -> PhysicalInput { PhysicalInput::AxisPos(axis, 0.25) }
fn axis_neg_threshold(axis: gilrs::Axis, threshold: f32) -> PhysicalInput { PhysicalInput::AxisNeg(axis, threshold) }
fn axis_pos_threshold(axis: gilrs::Axis, threshold: f32) -> PhysicalInput { PhysicalInput::AxisPos(axis, threshold) }
fn button(button: gilrs::Button) -> PhysicalInput { PhysicalInput::Button(button) }

fn calibrated_axis_threshold(value: f32) -> f32 {
    (value.abs() * 0.6).clamp(0.035, 0.25)
}

fn parse_axis(name: &str) -> Option<gilrs::Axis> {
    match name {
        "LeftStickX" => Some(gilrs::Axis::LeftStickX),
        "LeftStickY" => Some(gilrs::Axis::LeftStickY),
        "LeftZ" => Some(gilrs::Axis::LeftZ),
        "RightStickX" => Some(gilrs::Axis::RightStickX),
        "RightStickY" => Some(gilrs::Axis::RightStickY),
        "RightZ" => Some(gilrs::Axis::RightZ),
        "DPadX" => Some(gilrs::Axis::DPadX),
        "DPadY" => Some(gilrs::Axis::DPadY),
        _ => None,
    }
}

fn parse_button(name: &str) -> Option<gilrs::Button> {
    match name {
        "South" => Some(gilrs::Button::South),
        "East" => Some(gilrs::Button::East),
        "West" => Some(gilrs::Button::West),
        "North" => Some(gilrs::Button::North),
        "LeftTrigger" => Some(gilrs::Button::LeftTrigger),
        "LeftTrigger2" => Some(gilrs::Button::LeftTrigger2),
        "RightTrigger" => Some(gilrs::Button::RightTrigger),
        "RightTrigger2" => Some(gilrs::Button::RightTrigger2),
        "Select" => Some(gilrs::Button::Select),
        "Start" => Some(gilrs::Button::Start),
        "DPadUp" => Some(gilrs::Button::DPadUp),
        "DPadDown" => Some(gilrs::Button::DPadDown),
        "DPadLeft" => Some(gilrs::Button::DPadLeft),
        "DPadRight" => Some(gilrs::Button::DPadRight),
        "LeftThumb" => Some(gilrs::Button::LeftThumb),
        "RightThumb" => Some(gilrs::Button::RightThumb),
        _ => None,
    }
}

fn web_button_index_to_gilrs(index: u8) -> Option<gilrs::Button> {
    match index {
        0  => Some(gilrs::Button::South),
        1  => Some(gilrs::Button::East),
        2  => Some(gilrs::Button::West),
        3  => Some(gilrs::Button::North),
        4  => Some(gilrs::Button::LeftTrigger),
        5  => Some(gilrs::Button::RightTrigger),
        6  => Some(gilrs::Button::LeftTrigger2),
        7  => Some(gilrs::Button::RightTrigger2),
        8  => Some(gilrs::Button::Select),
        9  => Some(gilrs::Button::Start),
        10 => Some(gilrs::Button::LeftThumb),
        11 => Some(gilrs::Button::RightThumb),
        12 => Some(gilrs::Button::DPadUp),
        13 => Some(gilrs::Button::DPadDown),
        14 => Some(gilrs::Button::DPadLeft),
        15 => Some(gilrs::Button::DPadRight),
        _  => None,
    }
}

fn web_axis_index_to_gilrs(index: u8) -> Option<gilrs::Axis> {
    match index {
        0 => Some(gilrs::Axis::LeftStickX),
        1 => Some(gilrs::Axis::LeftStickY),
        2 => Some(gilrs::Axis::RightStickX),
        3 => Some(gilrs::Axis::RightStickY),
        _ => None,
    }
}

fn parse_profile_token(token: &str) -> Option<PhysicalInput> {
    let parts: Vec<&str> = token.split(':').collect();
    match parts.as_slice() {
        // gilrs-native tokens (from captureControllerInput)
        ["axis", axis, "neg"] => parse_axis(axis).map(axis_neg),
        ["axis", axis, "pos"] => parse_axis(axis).map(axis_pos),
        ["axis", axis, "neg", threshold] => {
            let threshold = threshold.parse::<f32>().ok()?.clamp(0.025, 0.8);
            parse_axis(axis).map(|axis| axis_neg_threshold(axis, threshold))
        }
        ["axis", axis, "pos", threshold] => {
            let threshold = threshold.parse::<f32>().ok()?.clamp(0.025, 0.8);
            parse_axis(axis).map(|axis| axis_pos_threshold(axis, threshold))
        }
        ["button", button_name] => parse_button(button_name).map(button),
        // browser Gamepad API tokens (webbutton:pad:index / webaxis:pad:axis:dir[:threshold])
        ["webbutton", _pad, idx] => {
            let idx: u8 = idx.parse().ok()?;
            web_button_index_to_gilrs(idx).map(button)
        }
        ["webaxis", _pad, axis_idx, dir] => {
            let idx: u8 = axis_idx.parse().ok()?;
            let axis = web_axis_index_to_gilrs(idx)?;
            if *dir == "neg" { Some(axis_neg(axis)) } else { Some(axis_pos(axis)) }
        }
        ["webaxis", _pad, axis_idx, dir, threshold] => {
            let idx: u8 = axis_idx.parse().ok()?;
            let axis = web_axis_index_to_gilrs(idx)?;
            let t = threshold.parse::<f32>().ok()?.clamp(0.025, 0.8);
            if *dir == "neg" { Some(axis_neg_threshold(axis, t)) } else { Some(axis_pos_threshold(axis, t)) }
        }
        _ => None,
    }
}

fn normalized_ctrl_name(input: &str) -> String {
    input.trim().to_lowercase().replace(' ', "").replace('_', "")
}

fn parse_ctrl_input(input: &str, profile: Option<&HashMap<String, Vec<String>>>) -> Option<CtrlInput> {
    let key = normalized_ctrl_name(input);
    let profile_tokens = profile.and_then(|p| {
        p.get(&key).or_else(|| {
            p.iter()
                .find(|(profile_key, _)| normalized_ctrl_name(profile_key) == key)
                .map(|(_, tokens)| tokens)
        })
    });

    if let Some(tokens) = profile_tokens {
        let physical: Vec<PhysicalInput> = tokens
            .iter()
            .filter_map(|token| parse_profile_token(token))
            .filter(|physical| match (key.as_str(), physical) {
                // Require RightStickX AND a minimum threshold of 0.12 so Y-axis crosstalk
                // (which can be as high as 0.05–0.10 on analog sticks) can't trigger turning.
                ("rstickleft" | "rstickright", PhysicalInput::AxisNeg(axis, t) | PhysicalInput::AxisPos(axis, t)) => {
                    *axis == gilrs::Axis::RightStickX && *t >= 0.12
                }
                ("lstickleft" | "lstickright", PhysicalInput::AxisNeg(axis, _) | PhysicalInput::AxisPos(axis, _)) => {
                    *axis == gilrs::Axis::LeftStickX || *axis == gilrs::Axis::DPadX
                }
                ("lstickup" | "lstickdown", PhysicalInput::AxisNeg(axis, _) | PhysicalInput::AxisPos(axis, _)) => {
                    *axis == gilrs::Axis::LeftStickY
                }
                _ => true,
            })
            .collect();
        if !physical.is_empty() {
            return Some(CtrlInput(physical));
        }
    }

    match input.trim().to_lowercase().as_str() {
        "lstick up"    | "lstickup"    => Some(CtrlInput(vec![axis_pos(gilrs::Axis::LeftStickY)])),
        "lstick down"  | "lstickdown"  => Some(CtrlInput(vec![axis_neg(gilrs::Axis::LeftStickY)])),
        "lstick left"  | "lstickleft"  => Some(CtrlInput(vec![axis_neg(gilrs::Axis::LeftStickX), axis_neg(gilrs::Axis::DPadX)])),
        "lstick right" | "lstickright" => Some(CtrlInput(vec![axis_pos(gilrs::Axis::LeftStickX), axis_pos(gilrs::Axis::DPadX)])),
        "rstick left"  | "rstickleft"  => Some(CtrlInput(vec![axis_neg(gilrs::Axis::RightStickX)])),
        "rstick right" | "rstickright" => Some(CtrlInput(vec![axis_pos(gilrs::Axis::RightStickX)])),
        "rstick up"    | "rstickup"    => Some(CtrlInput(vec![axis_pos(gilrs::Axis::RightStickY)])),
        "rstick down"  | "rstickdown"  => Some(CtrlInput(vec![axis_neg(gilrs::Axis::RightStickY)])),
        "lt" | "left trigger"          => Some(CtrlInput(vec![button(gilrs::Button::LeftTrigger2), axis_pos(gilrs::Axis::LeftZ)])),
        "rt" | "right trigger"         => Some(CtrlInput(vec![button(gilrs::Button::RightTrigger2), axis_pos(gilrs::Axis::RightZ)])),
        "lb" | "l1"                    => Some(CtrlInput(vec![button(gilrs::Button::LeftTrigger)])),
        "rb" | "r1"                    => Some(CtrlInput(vec![button(gilrs::Button::RightTrigger)])),
        "btn_a"                        => Some(CtrlInput(vec![button(gilrs::Button::South)])),
        "btn_b"                        => Some(CtrlInput(vec![button(gilrs::Button::East)])),
        "btn_x"                        => Some(CtrlInput(vec![button(gilrs::Button::West)])),
        "btn_y"                        => Some(CtrlInput(vec![button(gilrs::Button::North)])),
        "select" | "back" | "view"     => Some(CtrlInput(vec![button(gilrs::Button::Select)])),
        "start"  | "menu"              => Some(CtrlInput(vec![button(gilrs::Button::Start)])),
        "dpad_up"    | "dpup"          => Some(CtrlInput(vec![button(gilrs::Button::DPadUp), axis_pos(gilrs::Axis::DPadY)])),
        "dpad_down"  | "dpdown"        => Some(CtrlInput(vec![button(gilrs::Button::DPadDown), axis_neg(gilrs::Axis::DPadY)])),
        "dpad_left"  | "dpleft"        => Some(CtrlInput(vec![button(gilrs::Button::DPadLeft), axis_neg(gilrs::Axis::DPadX)])),
        "dpad_right" | "dpright"       => Some(CtrlInput(vec![button(gilrs::Button::DPadRight), axis_pos(gilrs::Axis::DPadX)])),
        "ls" | "l3"                    => Some(CtrlInput(vec![button(gilrs::Button::LeftThumb)])),
        "rs" | "r3"                    => Some(CtrlInput(vec![button(gilrs::Button::RightThumb)])),
        _ => None,
    }
}

fn dosbox_event_to_vk(event: &str) -> Option<u16> {
    Some(match event {
        "key_up"        => 0x26u16, "key_down"      => 0x28, "key_left"      => 0x25,
        "key_right"     => 0x27,    "key_space"     => 0x20, "key_lctrl"     => 0xA2,
        "key_rctrl"     => 0xA3,    "key_lshift"    => 0xA0, "key_rshift"    => 0xA1,
        "key_lalt"      => 0xA4,    "key_ralt"      => 0xA5, "key_esc"       => 0x1B,
        "key_tab"       => 0x09,    "key_enter"     => 0x0D, "key_backspace" => 0x08,
        "key_comma"     => 0xBC,    "key_period"    => 0xBE, "key_slash"     => 0xBF,
        "key_semicolon" => 0xBA,    "key_quote"     => 0xDE, "key_lbracket"  => 0xDB,
        "key_rbracket"  => 0xDD,    "key_backslash" => 0xDC, "key_minus"     => 0xBD,
        "key_equals"    => 0xBB,    "key_grave"     => 0xC0, "key_insert"    => 0x2D,
        "key_delete"    => 0x2E,    "key_home"      => 0x24, "key_end"       => 0x23,
        "key_pageup"    => 0x21,    "key_pagedown"  => 0x22, "key_printscr"  => 0x2C,
        "key_scrolllock"=> 0x91,    "key_pause"     => 0x13, "key_numlock"   => 0x90,
        "key_f1" => 0x70, "key_f2" => 0x71, "key_f3" => 0x72, "key_f4"  => 0x73,
        "key_f5" => 0x74, "key_f6" => 0x75, "key_f7" => 0x76, "key_f8"  => 0x77,
        "key_f9" => 0x78, "key_f10"=> 0x79, "key_f11"=> 0x7A, "key_f12" => 0x7B,
        "key_a" => 0x41, "key_b" => 0x42, "key_c" => 0x43, "key_d" => 0x44,
        "key_e" => 0x45, "key_f" => 0x46, "key_g" => 0x47, "key_h" => 0x48,
        "key_i" => 0x49, "key_j" => 0x4A, "key_k" => 0x4B, "key_l" => 0x4C,
        "key_m" => 0x4D, "key_n" => 0x4E, "key_o" => 0x4F, "key_p" => 0x50,
        "key_q" => 0x51, "key_r" => 0x52, "key_s" => 0x53, "key_t" => 0x54,
        "key_u" => 0x55, "key_v" => 0x56, "key_w" => 0x57, "key_x" => 0x58,
        "key_y" => 0x59, "key_z" => 0x5A,
        "key_0" => 0x30, "key_1" => 0x31, "key_2" => 0x32, "key_3" => 0x33,
        "key_4" => 0x34, "key_5" => 0x35, "key_6" => 0x36, "key_7" => 0x37,
        "key_8" => 0x38, "key_9" => 0x39,
        // Mouse button sentinels — not real VKs for keyboard SendInput;
        // send_vk intercepts these and uses MOUSE input type instead.
        "mouse_left"   => 0x01,  // VK_LBUTTON sentinel
        "mouse_right"  => 0x02,  // VK_RBUTTON sentinel
        "mouse_middle" => 0x04,  // VK_MBUTTON sentinel
        _ => return None,
    })
}

fn dosbox_event_combo_to_vks(event: &str) -> Option<Vec<u16>> {
    let vks: Vec<u16> = event
        .split('+')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .filter_map(dosbox_event_to_vk)
        .collect();

    if vks.is_empty() { None } else { Some(vks) }
}

#[cfg(windows)]
unsafe fn send_vk(vk: u16, pressed: bool) {
    use winapi::um::winuser::*;

    // Mouse button sentinels: PostMessage WM_LBUTTON*/WM_RBUTTON*/WM_MBUTTON* directly to
    // the SDL2/DOSBox window. SendInput MOUSEEVENTF_* is blocked by SDL2's raw-input
    // registration (RIDEV_NOLEGACY). PostMessage bypasses the OS input subsystem and inserts
    // the message directly into the window's queue, which SDL2 processes normally.
    if matches!(vk, 0x01 | 0x02 | 0x04) {
        use std::os::windows::ffi::OsStrExt;
        let class: Vec<u16> = std::ffi::OsStr::new("SDL_app")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let hwnd = FindWindowW(class.as_ptr(), std::ptr::null_mut());
        if !hwnd.is_null() {
            let (msg_down, msg_up, wparam): (u32, u32, usize) = match vk {
                0x01 => (WM_LBUTTONDOWN, WM_LBUTTONUP, MK_LBUTTON as usize),
                0x02 => (WM_RBUTTONDOWN, WM_RBUTTONUP, MK_RBUTTON as usize),
                _    => (WM_MBUTTONDOWN, WM_MBUTTONUP, MK_MBUTTON as usize),
            };
            if pressed {
                PostMessageW(hwnd, msg_down, wparam, 0);
            } else {
                PostMessageW(hwnd, msg_up, 0, 0);
            }
        }
        return;
    }

    // Inject keyboard as hardware scan codes via SendInput — the same mechanism the
    // working mouse-motion path uses. DOSBox-Staging (SDL2) consumes SendInput-generated
    // hardware input reliably; PostMessage(WM_KEYDOWN) to the SDL window was ignored by
    // this build (mouse via SendInput worked while keyboard via PostMessage did nothing).
    // Alt (VK_LMENU 0xA4 / VK_MENU 0x12): use scan 0x38 directly.
    let scan: u16 = if vk == 0xA4 || vk == 0x12 {
        0x38
    } else {
        MapVirtualKeyW(vk as u32, 0 /* MAPVK_VK_TO_VSC */) as u16
    };
    if scan == 0 {
        // No scan code — fall back to virtual-key SendInput.
        let mut input: INPUT = std::mem::zeroed();
        input.type_ = INPUT_KEYBOARD;
        let ki = input.u.ki_mut();
        ki.wVk = vk;
        ki.dwFlags = if pressed { 0 } else { KEYEVENTF_KEYUP };
        SendInput(1, &mut input, std::mem::size_of::<INPUT>() as i32);
        return;
    }

    let extended: bool = matches!(vk,
        0x25 | 0x26 | 0x27 | 0x28 |  // arrow keys
        0x21 | 0x22 | 0x23 | 0x24 |  // PgUp/PgDn/End/Home
        0x2D | 0x2E                   // Ins/Del
    );
    let mut input: INPUT = std::mem::zeroed();
    input.type_ = INPUT_KEYBOARD;
    let ki = input.u.ki_mut();
    ki.wScan = scan;
    let mut flags = KEYEVENTF_SCANCODE;
    if extended { flags |= KEYEVENTF_EXTENDEDKEY; }
    if !pressed { flags |= KEYEVENTF_KEYUP; }
    ki.dwFlags = flags;
    SendInput(1, &mut input, std::mem::size_of::<INPUT>() as i32);
}

#[cfg(windows)]
unsafe fn send_mouse_delta(dx: i32, dy: i32) {
    use winapi::um::winuser::*;
    let mut input: INPUT = std::mem::zeroed();
    input.type_ = INPUT_MOUSE;
    let mi = input.u.mi_mut();
    mi.dx = dx;
    mi.dy = dy;
    mi.dwFlags = MOUSEEVENTF_MOVE;
    SendInput(1, &mut input, std::mem::size_of::<INPUT>() as i32);
}

fn apply_deadzone(value: f32, deadzone: f32) -> f32 {
    if value.abs() < deadzone { return 0.0; }
    let scaled = (value.abs() - deadzone) / (1.0 - deadzone);
    scaled * value.signum()
}


fn set_vk_state(held: &mut std::collections::HashMap<u16, bool>, vk: u16, want_pressed: bool) {
    let is_pressed = *held.get(&vk).unwrap_or(&false);
    if want_pressed != is_pressed {
        held.insert(vk, want_pressed);
        #[cfg(windows)]
        unsafe { send_vk(vk, want_pressed); }
    }
}

fn physical_input_pressed(gamepad: &gilrs::Gamepad<'_>, input: &PhysicalInput) -> bool {
    const BTN_THRESH: f32 = 0.5;

    match input {
        PhysicalInput::AxisNeg(axis, threshold) => gamepad.value(*axis) < -*threshold,
        PhysicalInput::AxisPos(axis, threshold) => gamepad.value(*axis) > *threshold,
        PhysicalInput::Button(button) => {
            gamepad.is_pressed(*button)
                || gamepad
                    .button_data(*button)
                    .map(|data| data.value() >= BTN_THRESH)
                    .unwrap_or(false)
        }
    }
}

fn ctrl_input_pressed(gilrs: &gilrs::Gilrs, input: &CtrlInput) -> bool {
    for (_id, gamepad) in gilrs.gamepads() {
        for physical in &input.0 {
            if physical_input_pressed(&gamepad, physical) {
                return true;
            }
        }
    }

    false
}

fn run_controller_mapper(
    mappings: Vec<CtrlMapping>,
    stop: Arc<AtomicBool>,
    fps_mouse: bool,
    fps_sensitivity: f32,
) {
    let mut gilrs = match gilrs::Gilrs::new() {
        Ok(g) => g,
        Err(e) => { eprintln!("[TURBODOS] gilrs init error: {}", e); return; }
    };

    let mut held: std::collections::HashMap<u16, bool> = std::collections::HashMap::new();

    let all_vks: std::collections::HashSet<u16> = mappings.iter()
        .flat_map(|m| m.vks.iter().copied())
        .collect();

    while !stop.load(Ordering::Relaxed) {
        while gilrs.next_event().is_some() {}

        let mut want_pressed: std::collections::HashSet<u16> = std::collections::HashSet::new();
        for m in &mappings {
            if ctrl_input_pressed(&gilrs, &m.ctrl_input) {
                for &vk in &m.vks {
                    want_pressed.insert(vk);
                }
            }
        }

        for &vk in &want_pressed {
            if !*held.get(&vk).unwrap_or(&false) {
                eprintln!("[TURBODOS] vk_press: 0x{:02X}", vk);
            }
        }

        for &vk in &all_vks {
            set_vk_state(&mut held, vk, want_pressed.contains(&vk));
        }

        // FPS right-stick mouse: read axes directly from first connected gamepad.
        if fps_mouse {
            let mut rx = 0.0f32;
            let mut ry = 0.0f32;
            for (_id, gamepad) in gilrs.gamepads() {
                rx = gamepad.value(gilrs::Axis::RightStickX);
                ry = gamepad.value(gilrs::Axis::RightStickY);
                break;
            }
            let rx = apply_deadzone(rx, 0.12);
            let ry = apply_deadzone(ry, 0.12);
            if rx != 0.0 || ry != 0.0 {
                // Exponential curve for precision at low values.
                let curve = |v: f32| v * v.abs() * fps_sensitivity * 20.0;
                let dx = curve(rx).round() as i32;
                let dy = curve(ry).round() as i32;
                if dx != 0 || dy != 0 {
                    #[cfg(windows)]
                    unsafe { send_mouse_delta(dx, dy); }
                }
            }
        }

        std::thread::sleep(std::time::Duration::from_millis(8)); // ~120 Hz
    }

    let vks: Vec<u16> = held.iter().filter(|(_, &v)| v).map(|(&k, _)| k).collect();
    for vk in vks {
        #[cfg(windows)]
        unsafe { send_vk(vk, false); }
    }
}

/// XInput-based controller mapper for per-game ctrl_bindings.
/// Uses XInputGetState directly — works regardless of window focus.
/// mappings: Vec<(token_string, vks)>
#[cfg(windows)]
fn xinput_token_pressed(token: &str, pad: &winapi::um::xinput::XINPUT_GAMEPAD) -> bool {
    use winapi::um::xinput::*;
    let parts: Vec<&str> = token.split(':').collect();
    match parts.as_slice() {
        ["webbutton", _pad, idx] => {
            let Ok(i) = idx.parse::<u8>() else { return false; };
            let mask: Option<u16> = match i {
                0  => Some(XINPUT_GAMEPAD_A),
                1  => Some(XINPUT_GAMEPAD_B),
                2  => Some(XINPUT_GAMEPAD_X),
                3  => Some(XINPUT_GAMEPAD_Y),
                4  => Some(XINPUT_GAMEPAD_LEFT_SHOULDER),
                5  => Some(XINPUT_GAMEPAD_RIGHT_SHOULDER),
                6  => { return pad.bLeftTrigger > 30; }
                7  => { return pad.bRightTrigger > 30; }
                8  => Some(XINPUT_GAMEPAD_BACK),
                9  => Some(XINPUT_GAMEPAD_START),
                10 => Some(XINPUT_GAMEPAD_LEFT_THUMB),
                11 => Some(XINPUT_GAMEPAD_RIGHT_THUMB),
                12 => Some(XINPUT_GAMEPAD_DPAD_UP),
                13 => Some(XINPUT_GAMEPAD_DPAD_DOWN),
                14 => Some(XINPUT_GAMEPAD_DPAD_LEFT),
                15 => Some(XINPUT_GAMEPAD_DPAD_RIGHT),
                _  => None,
            };
            mask.map_or(false, |m| pad.wButtons & m != 0)
        }
        ["webaxis", _pad_i, axis_idx, dir] | ["webaxis", _pad_i, axis_idx, dir, _] => {
            let Ok(i) = axis_idx.parse::<u8>() else { return false; };
            // Browser Gamepad API Y-axes (1=leftStickY, 3=rightStickY) are inverted vs XInput:
            // browser neg = stick up; XInput sThumbLY positive = stick up.
            let (raw, effective_dir) = match i {
                0 => (pad.sThumbLX as f32 / 32767.0, *dir),
                1 => (pad.sThumbLY as f32 / 32767.0, if *dir == "neg" { "pos" } else { "neg" }),
                2 => (pad.sThumbRX as f32 / 32767.0, *dir),
                3 => (pad.sThumbRY as f32 / 32767.0, if *dir == "neg" { "pos" } else { "neg" }),
                _ => return false,
            };
            let threshold = parts.get(4).and_then(|t| t.parse::<f32>().ok()).unwrap_or(0.25);
            if effective_dir == "neg" { raw < -threshold } else { raw > threshold }
        }
        // gilrs-native tokens (axis:LeftStickX:neg:0.25, button:South, etc.)
        // Let gilrs handle these via the other mapper; here just return false.
        _ => false,
    }
}

/// True when the DOSBox (SDL) window is in the foreground. The XInput mapper injects
/// keystrokes globally via SendInput — without this gate, inputs held during launch
/// (before DOSBox grabs focus) get typed into the TURBODOS window instead, e.g. an
/// injected Enter re-clicking the focused Play button and spawning extra instances.
#[cfg(windows)]
fn dosbox_foreground() -> bool {
    use winapi::um::winuser::{GetForegroundWindow, GetClassNameW};
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() { return false; }
        let mut buf = [0u16; 32];
        let len = GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if len <= 0 { return false; }
        let class = String::from_utf16_lossy(&buf[..len as usize]);
        class == "SDL_app"
    }
}

#[cfg(windows)]
fn xinput_get_first_pad() -> Option<winapi::um::xinput::XINPUT_GAMEPAD> {
    for i in 0u32..4 {
        let mut state: winapi::um::xinput::XINPUT_STATE = unsafe { std::mem::zeroed() };
        if unsafe { winapi::um::xinput::XInputGetState(i, &mut state) } == 0 {
            return Some(state.Gamepad);
        }
    }
    None
}

fn run_xinput_mapper(
    mappings: Vec<(String, Vec<u16>)>,
    stop: Arc<AtomicBool>,
    fps_mouse: bool,
    fps_sensitivity: f32,
    // Wolf3D-engine games (Wolfenstein 3D, Blake Stone) read vertical mouse motion as
    // forward/backward *movement*, not look — so a right-stick "look" would push the player
    // forward/back. Suppress mouse Y for these; the right stick then only turns (mouse X).
    suppress_mouse_y: bool,
) {
    let mut held: std::collections::HashMap<u16, bool> = std::collections::HashMap::new();
    let all_vks: std::collections::HashSet<u16> = mappings.iter()
        .flat_map(|(_, vks)| vks.iter().copied())
        .collect();

    while !stop.load(Ordering::Relaxed) {
        #[cfg(windows)]
        let pad_opt = xinput_get_first_pad();
        #[cfg(not(windows))]
        let pad_opt: Option<()> = None;

        let mut want_pressed: std::collections::HashSet<u16> = std::collections::HashSet::new();

        #[cfg(windows)]
        if let Some(ref pad) = pad_opt {
            // Inject only while DOSBox is focused; otherwise want_pressed stays empty,
            // which also releases any keys still held when focus changes.
            if !dosbox_foreground() {
                for &vk in &all_vks {
                    set_vk_state(&mut held, vk, false);
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
                continue;
            }
            for (token, vks) in &mappings {
                if xinput_token_pressed(token, pad) {
                    for &vk in vks { want_pressed.insert(vk); }
                }
            }

            // FPS right-stick mouse via XInput
            if fps_mouse {
                let rx = apply_deadzone(pad.sThumbRX as f32 / 32767.0, 0.12);
                let ry = apply_deadzone(pad.sThumbRY as f32 / 32767.0, 0.12);
                if rx != 0.0 || ry != 0.0 {
                    let curve = |v: f32| v * v.abs() * fps_sensitivity * 20.0;
                    let dx = curve(rx).round() as i32;
                    // Wolf3D games: vertical mouse = move, not look — zero it so the right
                    // stick only turns. Other engines keep vertical look.
                    let dy = if suppress_mouse_y { 0 } else { curve(-ry).round() as i32 };
                    if dx != 0 || dy != 0 {
                        unsafe { send_mouse_delta(dx, dy); }
                    }
                }
            }
        }

        for &vk in &all_vks {
            let was = *held.get(&vk).unwrap_or(&false);
            let now = want_pressed.contains(&vk);
            if now && !was {
                eprintln!("[TURBODOS] xinput PRESS vk=0x{:02X}", vk);
            } else if !now && was {
                eprintln!("[TURBODOS] xinput RELEASE vk=0x{:02X}", vk);
            }
            set_vk_state(&mut held, vk, now);
        }

        std::thread::sleep(std::time::Duration::from_millis(8));
    }

    for (&vk, &held) in &held {
        if held { #[cfg(windows)] unsafe { send_vk(vk, false); } }
    }
}

pub mod cmd_launch {
    use super::*;

    #[tauri::command]
    pub fn launch_game(
        app: tauri::AppHandle,
        install_path: String,
        executable: String,
        engine: String,
        dosbox_config: String,
        bindings: Vec<BindingArg>,
        always_run: bool,
        controller_profile: Option<HashMap<String, Vec<String>>>,
        ctrl_bindings: Option<Vec<CtrlGameBinding>>,
        fps_mode: bool,
        fps_sensitivity: Option<f32>,
    ) -> Result<String, String> {
        let dosbox = dosbox_exe();
        if !dosbox.exists() {
            return Err(format!(
                "DOSBox not found at {}",
                dosbox.display()
            ));
        }

        let tmp = std::env::temp_dir().join("turbodos");
        std::fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;

        let mapper_path = tmp.join("mapper.map");

        let exe_name = std::path::Path::new(&executable)
            .file_name().and_then(|n| n.to_str()).unwrap_or(&executable);

        // Resolve engine: stored field takes precedence; fall back to file-presence detection
        // for user-added games that predate the engine column.
        let resolved_engine = if !engine.is_empty() {
            engine.as_str().to_string()
        } else if is_build_engine(&install_path) {
            "build".to_string()
        } else if is_doom_engine(exe_name) {
            "doom".to_string()
        } else {
            "generic".to_string()
        };

        let build_engine = resolved_engine == "build";
        eprintln!("[TURBODOS] resolved_engine={:?} build_engine={}", resolved_engine, build_engine);
        if build_engine {
            // Shadow Warrior owns its own SW.CFG (written by SETMAIN, or baked into the pack).
            // We must NOT overwrite it: an earlier hardcoded template used wrong device numbers
            // (FXDevice=5 = General MIDI, BlasterType=6 = AWE32) which crashed sound init. Same
            // lesson as Quake's config.cfg — let the game's setup own the sound config; we only
            // inject the [KeyDefinitions] for controls below.
            write_duke3d_key_defs(&install_path, &bindings, always_run, Some("G"))?;

            // Build engine games read raw scan codes from port 60h, so user keyboard remapping
            // would conflict. Use an identity mapper (all defaults, no user remapping) so
            // keyboard works normally.
            let mapper_content = build_mapper(&[]);
            std::fs::write(&mapper_path, &mapper_content).map_err(|e| e.to_string())?;
        } else {
            let mapper_content = build_mapper(&bindings);
            std::fs::write(&mapper_path, &mapper_content).map_err(|e| e.to_string())?;
        }

        // ROTT: patch AutoRun flag in CONFIG.ROT on every launch to match scheme setting.
        if resolved_engine == "generic" {
            let config_rot = std::path::Path::new(&install_path).join("CONFIG.ROT");
            if config_rot.exists() {
                if let Ok(text) = std::fs::read_to_string(&config_rot) {
                    let mut patched = false;
                    let new_text: String = text.lines().map(|line| {
                        // First AutoRun entry (around line 84) is the on/off flag; second is the key scan code.
                        // We only want to patch the on/off flag, which has a value of 0 or 1.
                        if !patched && line.trim_start().starts_with("AutoRun") {
                            let val = line.trim_end().split_whitespace().last().unwrap_or("0");
                            if val == "0" || val == "1" {
                                patched = true;
                                return format!("AutoRun            {}\r\n", if always_run { 1 } else { 0 });
                            }
                        }
                        format!("{}\r\n", line)
                    }).collect();
                    std::fs::write(&config_rot, new_text).ok();
                }
            }
        }

        let game_cfg_dir = if resolved_engine == "doom" {
            let cfg_path = tmp.join("game.cfg");
            std::fs::write(&cfg_path, doom_game_cfg(&install_path, always_run)).map_err(|e| e.to_string())?;
            tmp.to_str().unwrap_or("").to_string()
        } else {
            String::new()
        };

        let conf_path = tmp.join("game.conf");
        let mapper_str = mapper_path.to_str().unwrap_or("");
        let conf_content = build_dosbox_conf(&install_path, &executable, &dosbox_config, mapper_str, &game_cfg_dir, build_engine);
        std::fs::write(&conf_path, &conf_content).map_err(|e| e.to_string())?;

        let sensitivity = fps_sensitivity.unwrap_or(5.0);
        let stop_flag = Arc::new(AtomicBool::new(false));

        // Stop any previous controller thread.
        {
            let mut guard = ctrl_stop_global().lock().unwrap();
            if let Some(old) = guard.take() { old.store(true, Ordering::Relaxed); }
        }

        if let Some(ref cb) = ctrl_bindings {
            // Per-game ctrl_bindings → XInput mapper. Works regardless of window focus.
            let event_map: HashMap<String, String> = bindings.iter()
                .map(|b| (b.action.clone(), b.dosbox_event.clone()))
                .collect();
            let xinput_mappings: Vec<(String, Vec<u16>)> = cb.iter()
                .filter_map(|cgb| {
                    let dosbox_event = event_map.get(&cgb.action)?;
                    // Mouse-button injection (PostMessage WM_LBUTTONDOWN) is unreliable on this
                    // SDL2/DOSBox build, so remap a controller "Fire" bound to mouse_left onto a
                    // keyboard key that SendInput delivers reliably:
                    //  - Build engine (DN3D etc.): key_g (DUKE3D.CFG maps Fire = "Ctrl" "G").
                    //  - Wolf3D engine (Wolfenstein 3D, Blake Stone): key_lctrl — the engine's
                    //    default fire key, so no config change is needed.
                    let effective_event = if dosbox_event == "mouse_left" {
                        if build_engine {
                            "key_g"
                        } else if resolved_engine == "wolf3d" {
                            "key_lctrl"
                        } else {
                            dosbox_event.as_str()
                        }
                    } else {
                        dosbox_event.as_str()
                    };
                    let vks = dosbox_event_combo_to_vks(effective_event)?;
                    eprintln!("[TURBODOS] xinput_mapping: action={:?} ctrl={:?} event={:?} vks={:?}",
                        cgb.action, cgb.ctrl, effective_event, vks);
                    Some((cgb.ctrl.clone(), vks))
                })
                .collect();
            eprintln!("[TURBODOS] {} XInput mappings built", xinput_mappings.len());
            if !xinput_mappings.is_empty() || fps_mode {
                let mut guard = ctrl_stop_global().lock().unwrap();
                *guard = Some(Arc::clone(&stop_flag));
                let stop = Arc::clone(&stop_flag);
                drop(guard);
                let wolf3d = resolved_engine == "wolf3d";
                std::thread::spawn(move || run_xinput_mapper(xinput_mappings, stop, fps_mode, sensitivity, wolf3d));
            }
        } else {
            // Legacy profile-based approach → gilrs mapper.
            let ctrl_mappings: Vec<CtrlMapping> = bindings.iter()
                .filter_map(|b| {
                    let ctrl_input = parse_ctrl_input(&b.input, controller_profile.as_ref())?;
                    let vks = dosbox_event_combo_to_vks(&b.dosbox_event)?;
                    Some(CtrlMapping { ctrl_input, vks })
                })
                .collect();
            if !ctrl_mappings.is_empty() {
                let mut guard = ctrl_stop_global().lock().unwrap();
                *guard = Some(Arc::clone(&stop_flag));
                let stop = Arc::clone(&stop_flag);
                drop(guard);
                std::thread::spawn(move || run_controller_mapper(ctrl_mappings, stop, false, sensitivity));
            }
        }

        let dosbox_dir = dosbox.parent().unwrap_or(std::path::Path::new("."));
        let child = std::process::Command::new(&dosbox)
            .current_dir(dosbox_dir)
            .arg("-conf")
            .arg(conf_path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| format!("Failed to start DOSBox: {}", e))?;

        // Monitor DOSBox; when it exits, stop the controller thread and tell the
        // frontend (music resume + UI controller-nav resume listen for this).
        let stop = stop_flag;
        std::thread::spawn(move || {
            let mut c = child;
            let _ = c.wait();
            stop.store(true, Ordering::Relaxed);
            use tauri::Emitter;
            let _ = app.emit("game-exited", ());
        });

        Ok("DOSBox launched".into())
    }

    #[tauri::command]
    pub fn launch_dosbox_shell() -> Result<String, String> {
        let dosbox = dosbox_exe();
        if !dosbox.exists() {
            return Err(format!("DOSBox not found at {}", dosbox.display()));
        }
        let tmp = std::env::temp_dir().join("turbodos");
        std::fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;
        let conf_path = tmp.join("shell.conf");
        std::fs::write(&conf_path,
            "[sdl]\nfullscreen=false\noutput=texture\n\n[render]\nscaler=none\n\n[autoexec]\n"
        ).map_err(|e| e.to_string())?;
        let dosbox_dir = dosbox.parent().unwrap_or(std::path::Path::new("."));
        std::process::Command::new(&dosbox)
            .current_dir(dosbox_dir)
            .arg("-conf")
            .arg(conf_path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| format!("Failed to start DOSBox: {}", e))?;
        Ok("DOSBox shell launched".into())
    }
}

pub mod cmd_window {
    #[tauri::command]
    pub fn toggle_fullscreen(window: tauri::Window) -> Result<(), String> {
        let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
        let going_fullscreen = !is_fullscreen;
        window.set_fullscreen(going_fullscreen).map_err(|e| e.to_string())?;
        // Show decorations in windowed mode so the user can drag/resize the window
        window.set_decorations(!going_fullscreen).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Hard-exit the whole process. Used by the shutdown flow after the goodbye
    /// splash — window close()/destroy() can leave the app alive if a background
    /// thread (e.g. the controller mapper) is still running; process::exit is final.
    #[tauri::command]
    pub fn exit_app() {
        std::process::exit(0);
    }
}

pub mod cmd_install {
    /// After a manual setup/installer exe runs, flatten any single game subfolder
    /// up to the install dir root (e.g. INSTALL.EXE created C:\SW\ inside the SWARS folder).
    #[tauri::command]
    pub fn flatten_install_dir(install_path: String) -> Result<bool, String> {
        let dest_dir = std::path::Path::new(&install_path);
        const SKIP: &[&str] = &["install", "setup", "uninst", "instmain", "deice", "patch", "update"];
        let has_top_game_exe = std::fs::read_dir(dest_dir).ok()
            .map(|entries| entries.flatten().any(|e| {
                let n = e.file_name().to_string_lossy().to_lowercase();
                e.path().is_file() && n.ends_with(".exe") && !SKIP.iter().any(|s| n.contains(s))
            }))
            .unwrap_or(false);
        if has_top_game_exe { return Ok(false); }
        let subdirs: Vec<_> = std::fs::read_dir(dest_dir).ok()
            .map(|entries| entries.flatten().filter(|e| e.path().is_dir()).collect())
            .unwrap_or_default();
        if let Some(subdir) = subdirs.into_iter().find(|e| {
            let dname = e.file_name().to_string_lossy().to_lowercase();
            !SKIP.iter().any(|s| dname.contains(s))
                && std::fs::read_dir(e.path()).ok()
                    .map(|sub| sub.flatten().any(|f| {
                        f.path().is_file() && f.file_name().to_string_lossy().to_lowercase().ends_with(".exe")
                    }))
                    .unwrap_or(false)
        }) {
            if let Ok(sub_entries) = std::fs::read_dir(subdir.path()) {
                for entry in sub_entries.flatten() {
                    let src = entry.path();
                    let dst = dest_dir.join(entry.file_name());
                    if !dst.exists() { std::fs::rename(&src, &dst).ok(); }
                }
            }
            std::fs::remove_dir_all(subdir.path()).ok();
            return Ok(true);
        }
        Ok(false)
    }
}

pub mod cmd_reset {
    #[tauri::command]
    pub fn reset_library() -> Result<(), String> {
        // AppData\Roaming\com.dosdeck.app\dosdeck.db on Windows
        let db_path = dirs::data_dir()
            .ok_or("Cannot find data dir")?
            .join("com.dosdeck.app")
            .join("dosdeck.db");
        if db_path.exists() {
            std::fs::remove_file(&db_path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

pub mod cmd_art {
    #[tauri::command]
    pub fn save_art_file(game_id: i64, ext: String, bytes: Vec<u8>) -> Result<String, String> {
        let ext = match ext.to_lowercase().as_str() {
            "png" => "png",
            "jpg" | "jpeg" => "jpg",
            _ => return Err("Unsupported art file type".into()),
        };
        let art_dir = dirs::data_dir()
            .ok_or("Cannot find data dir")?
            .join("com.dosdeck.app")
            .join("art");
        std::fs::create_dir_all(&art_dir).map_err(|e| e.to_string())?;
        let path = art_dir.join(format!("{}.{}", game_id, ext));
        std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
        Ok(path.to_string_lossy().to_string())
    }

    /// Download a zip of cover art (keyed by title slug, e.g. "doom-shareware.png") and
    /// extract it into the art dir. Returns [{key, path}] so the frontend can map each
    /// cover to its game by slug. One fast download replaces dozens of per-game scrapes on
    /// first run; user-added games still scrape live via the normal path.
    #[tauri::command]
    pub async fn install_art_pack(url: String) -> Result<Vec<serde_json::Value>, String> {
        let art_dir = dirs::data_dir()
            .ok_or("Cannot find data dir")?
            .join("com.dosdeck.app")
            .join("art");
        std::fs::create_dir_all(&art_dir).map_err(|e| e.to_string())?;

        let client = reqwest::Client::builder()
            .user_agent("TURBODOS/1.0")
            .build()
            .map_err(|e| e.to_string())?;
        let resp = client.get(&url).send().await.map_err(|e| format!("Art pack download failed: {}", e))?;
        if !resp.status().is_success() {
            return Err(format!("Art pack download failed: HTTP {}", resp.status()));
        }
        let bytes = resp.bytes().await.map_err(|e| e.to_string())?;

        let cursor = std::io::Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("Bad art zip: {}", e))?;
        let mut out = Vec::new();
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            if file.is_dir() { continue; }
            let name = std::path::Path::new(file.name())
                .file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
            let ext = std::path::Path::new(&name).extension()
                .and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            if name.is_empty() || (ext != "png" && ext != "jpg" && ext != "jpeg") { continue; }
            let dest = art_dir.join(&name);
            let mut buf = Vec::new();
            std::io::copy(&mut file, &mut buf).map_err(|e| e.to_string())?;
            std::fs::write(&dest, &buf).map_err(|e| e.to_string())?;
            let key = std::path::Path::new(&name).file_stem()
                .and_then(|s| s.to_str()).unwrap_or("").to_string();
            out.push(serde_json::json!({ "key": key, "path": dest.to_string_lossy().to_string() }));
        }
        Ok(out)
    }

    #[tauri::command]
    pub fn load_art_file(art_path: String) -> Result<Vec<u8>, String> {
        let path = std::path::PathBuf::from(&art_path);
        let app_art_dir = dirs::data_dir()
            .ok_or("Cannot find data dir")?
            .join("com.dosdeck.app")
            .join("art");
        let canonical_path = path.canonicalize().map_err(|e| e.to_string())?;
        let canonical_art_dir = app_art_dir.canonicalize().map_err(|e| e.to_string())?;
        if !canonical_path.starts_with(&canonical_art_dir) {
            return Err("Art path is outside the TURBODOS art directory".into());
        }
        std::fs::read(canonical_path).map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn copy_local_art(src_path: String, game_id: i64) -> Result<String, String> {
        let src = std::path::PathBuf::from(&src_path);
        let ext = src.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .ok_or("File has no extension")?;
        let ext = match ext.as_str() {
            "png" => "png",
            "jpg" | "jpeg" => "jpg",
            _ => return Err("Unsupported art file type — use PNG or JPG".into()),
        };
        let art_dir = dirs::data_dir()
            .ok_or("Cannot find data dir")?
            .join("com.dosdeck.app")
            .join("art");
        std::fs::create_dir_all(&art_dir).map_err(|e| e.to_string())?;
        let dest = art_dir.join(format!("{}.{}", game_id, ext));
        std::fs::copy(&src, &dest).map_err(|e| e.to_string())?;
        Ok(dest.to_string_lossy().to_string())
    }

    #[tauri::command]
    pub async fn download_and_save_art(url: String, game_id: i64) -> Result<String, String> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| e.to_string())?;
        let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("Art download failed: HTTP {}", resp.status()));
        }
        let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
        let ext = if url.contains(".png") { "png" } else { "jpg" };
        let art_dir = dirs::data_dir()
            .ok_or("Cannot find data dir")?
            .join("com.dosdeck.app")
            .join("art");
        std::fs::create_dir_all(&art_dir).map_err(|e| e.to_string())?;
        let path = art_dir.join(format!("{}.{}", game_id, ext));
        std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
        Ok(path.to_string_lossy().to_string())
    }
}

pub mod cmd_controller {
    use std::collections::HashMap;

    fn known_axes() -> [gilrs::Axis; 8] {
        [
            gilrs::Axis::LeftStickX,
            gilrs::Axis::LeftStickY,
            gilrs::Axis::LeftZ,
            gilrs::Axis::RightStickX,
            gilrs::Axis::RightStickY,
            gilrs::Axis::RightZ,
            gilrs::Axis::DPadX,
            gilrs::Axis::DPadY,
        ]
    }

    fn known_buttons() -> [gilrs::Button; 16] {
        [
            gilrs::Button::South,
            gilrs::Button::East,
            gilrs::Button::West,
            gilrs::Button::North,
            gilrs::Button::LeftTrigger,
            gilrs::Button::LeftTrigger2,
            gilrs::Button::RightTrigger,
            gilrs::Button::RightTrigger2,
            gilrs::Button::Select,
            gilrs::Button::Start,
            gilrs::Button::DPadUp,
            gilrs::Button::DPadDown,
            gilrs::Button::DPadLeft,
            gilrs::Button::DPadRight,
            gilrs::Button::LeftThumb,
            gilrs::Button::RightThumb,
        ]
    }

    #[tauri::command]
    pub fn controller_snapshot() -> Result<serde_json::Value, String> {
        let mut gilrs = gilrs::Gilrs::new().map_err(|e| e.to_string())?;
        while gilrs.next_event().is_some() {}

        let axes = known_axes();
        let buttons = known_buttons();

        let gamepads: Vec<serde_json::Value> = gilrs.gamepads()
            .map(|(id, gamepad)| {
                let axis_values: Vec<serde_json::Value> = axes.iter()
                    .map(|axis| serde_json::json!({
                        "axis": format!("{:?}", axis),
                        "value": gamepad.value(*axis)
                    }))
                    .collect();
                let button_values: Vec<serde_json::Value> = buttons.iter()
                    .map(|button| serde_json::json!({
                        "button": format!("{:?}", button),
                        "pressed": gamepad.is_pressed(*button),
                        "value": gamepad.button_data(*button).map(|data| data.value()).unwrap_or(0.0)
                    }))
                    .collect();
                serde_json::json!({
                    "id": format!("{:?}", id),
                    "name": gamepad.name(),
                    "axes": axis_values,
                    "buttons": button_values
                })
            })
            .collect();

        Ok(serde_json::json!({ "gamepads": gamepads }))
    }

    #[tauri::command]
    pub fn capture_controller_input(duration_ms: Option<u64>) -> Result<serde_json::Value, String> {
        let mut gilrs = gilrs::Gilrs::new().map_err(|e| e.to_string())?;
        let axes = known_axes();
        let buttons = known_buttons();
        let deadline = std::time::Instant::now()
            + std::time::Duration::from_millis(duration_ms.unwrap_or(3000));

        let mut best_axis: Option<(String, f32)> = None;
        let mut best_button: Option<(String, f32, bool)> = None;
        let mut seen_events: Vec<serde_json::Value> = Vec::new();
        let mut best_axes: HashMap<String, f32> = HashMap::new();
        let mut best_buttons: HashMap<String, f32> = HashMap::new();

        while std::time::Instant::now() < deadline {
            while let Some(gilrs::Event { event, .. }) = gilrs.next_event() {
                match event {
                    gilrs::EventType::AxisChanged(axis, value, _) => {
                        let axis_name = format!("{:?}", axis);
                        let current = best_axes.get(&axis_name).copied().unwrap_or(0.0);
                        if value.abs() > current.abs() {
                            best_axes.insert(axis_name.clone(), value);
                        }
                        if value.abs() > 0.04 {
                            seen_events.push(serde_json::json!({
                                "kind": "axis",
                                "name": axis_name,
                                "value": value
                            }));
                        }
                        if value.abs() > best_axis.as_ref().map(|(_, v)| v.abs()).unwrap_or(0.0) {
                            best_axis = Some((format!("{:?}", axis), value));
                        }
                    }
                    gilrs::EventType::ButtonPressed(button, _) => {
                        let button_name = format!("{:?}", button);
                        best_buttons.insert(button_name.clone(), 1.0);
                        let candidates = vec![serde_json::json!({
                            "kind": "button",
                            "name": button_name,
                            "value": 1.0,
                            "token": format!("button:{:?}", button)
                        })];
                        return Ok(serde_json::json!({
                            "token": format!("button:{:?}", button),
                            "kind": "button",
                            "name": format!("{:?}", button),
                            "value": 1.0,
                            "candidates": candidates
                        }));
                    }
                    gilrs::EventType::ButtonChanged(button, value, _) if value > 0.20 => {
                        let button_name = format!("{:?}", button);
                        let current = best_buttons.get(&button_name).copied().unwrap_or(0.0);
                        if value > current {
                            best_buttons.insert(button_name.clone(), value);
                        }
                        seen_events.push(serde_json::json!({
                            "kind": "button",
                            "name": button_name,
                            "value": value
                        }));
                        let candidates = vec![serde_json::json!({
                            "kind": "button",
                            "name": format!("{:?}", button),
                            "value": value,
                            "token": format!("button:{:?}", button)
                        })];
                        return Ok(serde_json::json!({
                            "token": format!("button:{:?}", button),
                            "kind": "button",
                            "name": format!("{:?}", button),
                            "value": value,
                            "candidates": candidates
                        }));
                    }
                    _ => {}
                }
            }

            for (_id, gamepad) in gilrs.gamepads() {
                for axis in &axes {
                    let value = gamepad.value(*axis);
                    let axis_name = format!("{:?}", axis);
                    let current = best_axes.get(&axis_name).copied().unwrap_or(0.0);
                    if value.abs() > current.abs() {
                        best_axes.insert(axis_name.clone(), value);
                    }
                    if value.abs() > best_axis.as_ref().map(|(_, v)| v.abs()).unwrap_or(0.0) {
                        best_axis = Some((axis_name, value));
                    }
                }

                for button in &buttons {
                    let pressed = gamepad.is_pressed(*button);
                    let value = gamepad
                        .button_data(*button)
                        .map(|data| data.value())
                        .unwrap_or(if pressed { 1.0 } else { 0.0 });
                    let button_name = format!("{:?}", button);
                    let current = best_buttons.get(&button_name).copied().unwrap_or(0.0);
                    if value > current {
                        best_buttons.insert(button_name, value);
                    }
                    if pressed || value > best_button.as_ref().map(|(_, v, _)| *v).unwrap_or(0.0) {
                        best_button = Some((format!("{:?}", button), value, pressed));
                    }
                }
            }

            std::thread::sleep(std::time::Duration::from_millis(8));
        }

        let mut candidates: Vec<serde_json::Value> = best_axes
            .iter()
            .filter(|(_, value)| value.abs() > 0.02)
            .map(|(name, value)| serde_json::json!({
                "kind": "axis",
                "name": name,
                "value": value,
                "token": format!("axis:{}:{}", name, if *value < 0.0 { "neg" } else { "pos" })
            }))
            .chain(best_buttons.iter()
                .filter(|(_, value)| **value > 0.02)
                .map(|(name, value)| serde_json::json!({
                    "kind": "button",
                    "name": name,
                    "value": value,
                    "token": format!("button:{}", name)
                })))
            .collect();
        candidates.sort_by(|a, b| {
            let av = a.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0).abs();
            let bv = b.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0).abs();
            bv.partial_cmp(&av).unwrap_or(std::cmp::Ordering::Equal)
        });
        candidates.truncate(8);

        if let Some((button, value, pressed)) = best_button {
            if pressed || value > 0.35 {
                return Ok(serde_json::json!({
                    "token": format!("button:{}", button),
                    "kind": "button",
                    "name": button,
                    "value": value,
                    "candidates": candidates
                }));
            }
        }

        if let Some((axis, value)) = best_axis {
            if value.abs() > 0.045 {
                let threshold = super::calibrated_axis_threshold(value);
                return Ok(serde_json::json!({
                    "token": format!("axis:{}:{}:{:.3}", axis, if value < 0.0 { "neg" } else { "pos" }, threshold),
                    "kind": "axis",
                    "name": axis,
                    "value": value,
                    "threshold": threshold,
                    "candidates": candidates
                }));
            }
        }

        Ok(serde_json::json!({
            "token": null,
            "error": "No active controller input detected",
            "events": seen_events,
            "candidates": candidates
        }))
    }

    #[tauri::command]
    pub fn send_controller_keys(dosbox_event: String, pressed: bool) -> Result<(), String> {
        let Some(vks) = super::dosbox_event_combo_to_vks(&dosbox_event) else {
            return Ok(());
        };

        if pressed {
            for vk in vks {
                #[cfg(windows)]
                unsafe { super::send_vk(vk, true); }
            }
        } else {
            for vk in vks.into_iter().rev() {
                #[cfg(windows)]
                unsafe { super::send_vk(vk, false); }
            }
        }

        Ok(())
    }
}

pub mod cmd_scrape {
    use super::*;

    async fn try_steamgriddb(
        client: &reqwest::Client,
        title: &str,
        api_key: &str,
    ) -> Result<serde_json::Value, String> {
        let search_url = format!(
            "https://www.steamgriddb.com/api/v2/search/autocomplete/{}",
            urlencoding::encode(title)
        );
        let search_resp = client
            .get(&search_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send().await
            .map_err(|e| format!("SGDB network error: {}", e))?;
        let search_status = search_resp.status();
        let search_body = search_resp.text().await.unwrap_or_default();
        eprintln!("[TURBODOS] SGDB search status={} body={}", search_status, &search_body[..search_body.len().min(300)]);
        if !search_status.is_success() {
            return Err(format!("SGDB search HTTP {}: {}", search_status, &search_body[..search_body.len().min(200)]));
        }
        let search: serde_json::Value = serde_json::from_str(&search_body)
            .map_err(|e| format!("SGDB search JSON parse: {}", e))?;

        let game_id = search["data"].as_array()
            .and_then(|a| a.first())
            .and_then(|g| g["id"].as_u64())
            .ok_or_else(|| format!("SGDB: no game found for '{}'", title))?;

        let grids_url = format!(
            "https://www.steamgriddb.com/api/v2/grids/game/{}?dimensions=600x900&limit=5&nsfw=false",
            game_id
        );
        let grids_resp = client
            .get(&grids_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send().await
            .map_err(|e| format!("SGDB grids network error: {}", e))?;
        let grids_status = grids_resp.status();
        let grids_body = grids_resp.text().await.unwrap_or_default();
        eprintln!("[TURBODOS] SGDB grids status={} body={}", grids_status, &grids_body[..grids_body.len().min(300)]);
        let grids: serde_json::Value = serde_json::from_str(&grids_body)
            .map_err(|e| format!("SGDB grids JSON parse: {}", e))?;

        let art_url = grids["data"].as_array()
            .and_then(|a| a.first())
            .and_then(|g| g["url"].as_str())
            .ok_or_else(|| "SGDB: no grid art found".to_string())?
            .to_string();

        Ok(serde_json::json!({
            "title": title,
            "description": "",
            "art_url": art_url,
            "genre": "",
            "source": "steamgriddb"
        }))
    }

    #[tauri::command]
    pub async fn scrape_game_metadata(
        title: String,
        steamgriddb_key: Option<String>,
        screenscraper_user: Option<String>,
        screenscraper_pass: Option<String>,
    ) -> Result<serde_json::Value, String> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())?;

        // Use user-provided key if set, otherwise fall back to bundled developer key
        let effective_key = steamgriddb_key
            .as_deref()
            .filter(|k| !k.is_empty())
            .unwrap_or(crate::secrets::SGDB_API_KEY);

        if !effective_key.is_empty() {
            let key = effective_key;
            match try_steamgriddb(&client, &title, key).await {
                Ok(result) => {
                    // Merge with builtin description/genre if SteamGridDB only has art
                    let builtin = builtin_catalog(&title);
                    let desc = result["description"].as_str().filter(|s| !s.is_empty())
                        .unwrap_or_else(|| builtin["description"].as_str().unwrap_or(""));
                    let genre = result["genre"].as_str().filter(|s| !s.is_empty())
                        .unwrap_or_else(|| builtin["genre"].as_str().unwrap_or(""));
                    return Ok(serde_json::json!({
                        "title": title,
                        "description": desc,
                        "art_url": result["art_url"],
                        "genre": genre,
                        "source": "steamgriddb"
                    }));
                }
                Err(e) => {
                    eprintln!("[TURBODOS] SteamGridDB failed: {}", e);
                    return Ok(serde_json::json!({
                        "source": "sgdb_error",
                        "error": e
                    }));
                }
            }
        }

        // Try ScreenScraper if credentials provided
        let user = screenscraper_user.unwrap_or_default();
        let pass = screenscraper_pass.unwrap_or_default();
        if !user.is_empty() && !pass.is_empty() {
            let query = urlencoding::encode(&title).into_owned();
            let url = format!(
                "https://www.screenscraper.fr/api2/jeuInfos.php?devid=dosdeck&devpassword=dosdeck&softname=dosdeck&output=json&ssid={}&sspassword={}&recherche={}&systemeid=135",
                user, pass, query
            );
            if let Ok(resp) = client.get(&url).send().await {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                if status.is_success() {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                        let game_data = &json["response"]["jeu"];
                        if !game_data.is_null() {
                            let description = game_data["synopsis"].as_array()
                                .and_then(|a| a.iter().find(|s| s["langue"] == "en"))
                                .and_then(|s| s["texte"].as_str()).unwrap_or("").to_string();
                            let art_url = game_data["medias"].as_array()
                                .and_then(|a| a.iter().find(|m| m["type"] == "box-2D"))
                                .and_then(|m| m["url"].as_str()).unwrap_or("").to_string();
                            let genre = game_data["genres"].as_array()
                                .and_then(|a| a.first())
                                .and_then(|g| g["noms"].as_array())
                                .and_then(|a| a.iter().find(|n| n["langue"] == "en"))
                                .and_then(|n| n["text"].as_str()).unwrap_or("").to_string();
                            return Ok(serde_json::json!({
                                "title": title, "description": description,
                                "art_url": art_url, "genre": genre,
                                "source": "screenscraper"
                            }));
                        }
                    }
                }
            }
        }

        // Fallback — builtin descriptions, no art
        Ok(builtin_catalog(&title))
    }
} // end mod cmd_scrape

fn builtin_catalog(title: &str) -> serde_json::Value {
    let t = title.to_lowercase();
    let (desc, genre) = if t.contains("doom") {
        ("The shareware episode of id Software's landmark FPS. Fight through Phobos Base against the demonic hordes of Hell.", "fps")
    } else if t.contains("commander keen") || t.contains("keen") {
        ("id Software's beloved side-scrolling platformer series. Billy Blaze saves the galaxy armed with a pogo stick and a ray gun.", "platform")
    } else if t.contains("wolfenstein") || t.contains("wolf3d") {
        ("The grandfather of the FPS genre. Escape Castle Wolfenstein and bring down the Nazi war machine.", "fps")
    } else if t.contains("duke nukem") {
        ("Duke Nukem is back and the aliens have invaded. Destroy them with extreme prejudice and plenty of one-liners.", "fps")
    } else if t.contains("monkey island") {
        ("Become Guybrush Threepwood, a young man who wants nothing more than to be a pirate, in LucasArts' legendary adventure.", "adventure")
    } else if t.contains("tyrian") {
        ("The definitive DOS vertical shoot-em-up. Stunning visuals, an epic storyline, and a legendary soundtrack by Alexander Brandon.", "shooter")
    } else if t.contains("raptor") {
        ("A fast-paced vertical scrolling shoot-em-up where you pilot a mercenary fighter through waves of enemy aircraft.", "shooter")
    } else if t.contains("heretic") {
        ("A fantasy-themed Doom-engine FPS where you battle the Iron Lich and the three Serpent Riders.", "fps")
    } else if t.contains("blake stone") {
        ("A Wolfenstein 3D engine FPS set in a futuristic sci-fi universe. Fight through Dr. Goldfire's research facilities.", "fps")
    } else {
        ("A classic DOS game.", "")
    };

    serde_json::json!({
        "title": title,
        "description": desc,
        "art_url": "",
        "genre": genre,
        "source": "builtin"
    })
}

pub mod cmd_music {
    use std::path::PathBuf;

    fn music_dir() -> PathBuf {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("com.dosdeck.app")
            .join("music")
    }

    /// User-supplied menu music: every audio file in the music folder, sorted by
    /// name (played in sequence by the frontend). Empty = fall back to bundled tracks.
    #[tauri::command]
    pub fn list_music_files() -> Result<Vec<String>, String> {
        let dir = music_dir();
        std::fs::create_dir_all(&dir).ok();
        let mut files: Vec<String> = std::fs::read_dir(&dir)
            .map_err(|e| e.to_string())?
            .flatten()
            .filter_map(|e| {
                let p = e.path();
                let ext = p.extension()?.to_str()?.to_lowercase();
                if matches!(ext.as_str(), "mp3" | "ogg" | "wav" | "flac" | "m4a") {
                    Some(p.to_string_lossy().to_string())
                } else {
                    None
                }
            })
            .collect();
        files.sort_by_key(|s| s.to_lowercase());
        Ok(files)
    }

    #[tauri::command]
    pub fn open_music_folder() -> Result<(), String> {
        let dir = music_dir();
        std::fs::create_dir_all(&dir).ok();
        std::process::Command::new("explorer")
            .arg(&dir)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Write one track into the music folder (used to seed/restore the bundled
    /// tracks so everything lives in one user-managed folder). `name` must be a
    /// bare filename — no path separators or traversal.
    #[tauri::command]
    pub fn save_music_file(name: String, bytes: Vec<u8>) -> Result<(), String> {
        if name.trim().is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
            return Err("Invalid file name".into());
        }
        let dir = music_dir();
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        std::fs::write(dir.join(&name), &bytes).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Read one music file's bytes (frontend turns it into a blob URL). Path must
    /// resolve inside the music folder.
    #[tauri::command]
    pub fn load_music_file(path: String) -> Result<Vec<u8>, String> {
        let p = PathBuf::from(&path).canonicalize().map_err(|e| e.to_string())?;
        let dir = music_dir().canonicalize().map_err(|e| e.to_string())?;
        if !p.starts_with(&dir) {
            return Err("Path is outside the music folder".into());
        }
        std::fs::read(&p).map_err(|e| e.to_string())
    }
}

pub mod cmd_settings {
    use std::path::PathBuf;

    fn app_data_dir() -> PathBuf {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("com.dosdeck.app")
    }

    fn override_file() -> PathBuf {
        app_data_dir().join("games_folder_override.txt")
    }

    fn default_games_dir() -> PathBuf {
        app_data_dir().join("GAMES")
    }

    /// Resolves the effective games install directory: a user-configured override
    /// if one is set and still valid, otherwise the default under AppData.
    pub fn games_dir() -> PathBuf {
        if let Ok(path) = std::fs::read_to_string(override_file()) {
            let trimmed = path.trim();
            if !trimmed.is_empty() {
                return PathBuf::from(trimmed);
            }
        }
        default_games_dir()
    }

    #[tauri::command]
    pub fn get_games_folder() -> Result<String, String> {
        Ok(games_dir().to_string_lossy().to_string())
    }

    #[tauri::command]
    pub fn get_default_games_folder() -> Result<String, String> {
        Ok(default_games_dir().to_string_lossy().to_string())
    }

    /// Sets (or clears, if `path` is None) the games folder override.
    /// Returns the new effective path. Does not move any existing game files.
    #[tauri::command]
    pub fn set_games_folder(path: Option<String>) -> Result<String, String> {
        std::fs::create_dir_all(app_data_dir()).map_err(|e| e.to_string())?;
        match path {
            Some(p) if !p.trim().is_empty() => {
                let dir = PathBuf::from(p.trim());
                std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot use that folder: {}", e))?;
                std::fs::write(override_file(), dir.to_string_lossy().as_bytes())
                    .map_err(|e| e.to_string())?;
            }
            _ => {
                std::fs::remove_file(override_file()).ok();
            }
        }
        Ok(games_dir().to_string_lossy().to_string())
    }
}

pub mod cmd_games_folder {
    fn games_dir() -> std::path::PathBuf {
        crate::cmd_settings::games_dir()
    }

    fn find_best_exe(dir: &std::path::Path, folder_name: &str) -> Option<String> {
        const SKIP: &[&str] = &["setup", "install", "uninstall", "uninst", "instmain", "inst", "patch", "update", "redist", "vcredist", "directx", "catalog", "order", "register", "readme", "read", "help", "config", "snd", "sound", "intro", "bwsb", "sbsnd", "launch", "launcher", "run", "start", "pkunzip", "arj", "lha", "pkzip", "deice"];
        let folder_lower = folder_name.to_lowercase().replace(['-', '_', ' '], "");
        let mut exes: Vec<String> = std::fs::read_dir(dir).ok()?
            .flatten()
            .filter_map(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                let low = name.to_lowercase();
                if low.ends_with(".exe") || low.ends_with(".bat") || low.ends_with(".com") {
                    Some(name)
                } else {
                    None
                }
            })
            .collect();
        exes.sort();

        let norm_stem = |n: &str| -> String {
            n.to_lowercase()
             .trim_end_matches(".exe").trim_end_matches(".bat").trim_end_matches(".com")
             .replace(['-', '_', ' '], "")
             .to_string()
        };

        // Tier 1: exact stem == folder name
        for name in &exes {
            if norm_stem(name) == folder_lower {
                return Some(name.clone());
            }
        }

        // Tier 2: folder name starts with exe stem (e.g. "doomshareware" starts with "doom")
        for name in &exes {
            let stem = norm_stem(name);
            if stem.len() >= 3 && !SKIP.iter().any(|s| stem.contains(s)) && folder_lower.starts_with(&stem) {
                return Some(name.clone());
            }
        }

        // Tier 3: first non-skip exe alphabetically
        for name in &exes {
            let stem = norm_stem(name);
            if !SKIP.iter().any(|s| stem.contains(s)) {
                return Some(name.clone());
            }
        }

        None
    }

    #[tauri::command]
    pub fn scan_games_folder() -> Result<Vec<serde_json::Value>, String> {
        let games_dir = games_dir();
        std::fs::create_dir_all(&games_dir).ok();
        let mut results = vec![];
        let entries = match std::fs::read_dir(&games_dir) {
            Ok(e) => e,
            Err(_) => return Ok(results),
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() { continue; }
            let folder_name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) if !n.starts_with('.') => n.to_string(),
                _ => continue,
            };
            if let Some(exe) = find_best_exe(&path, &folder_name) {
                let title = folder_name.replace('_', " ").replace('-', " ");
                results.push(serde_json::json!({
                    "title": title,
                    "folder_name": folder_name,
                    "install_path": path.to_string_lossy(),
                    "executable": exe,
                }));
            }
        }
        Ok(results)
    }

    #[tauri::command]
    pub fn delete_game_folder(folder_name: String) -> Result<(), String> {
        let dir = games_dir().join(&folder_name);
        if dir.exists() {
            std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    #[tauri::command]
    pub fn open_games_folder() -> Result<(), String> {
        let games_dir = games_dir();
        std::fs::create_dir_all(&games_dir).ok();
        std::process::Command::new("explorer")
            .arg(&games_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

pub mod cmd_download {
    use std::path::PathBuf;
    use std::io::Read;

    fn games_dir() -> PathBuf {
        crate::cmd_settings::games_dir()
    }

    #[tauri::command]
    pub async fn download_and_extract_game(url: String, folder_name: String) -> Result<String, String> {
        // Download the zip
        let client = reqwest::Client::builder()
            .user_agent("TURBODOS/1.0")
            .build()
            .map_err(|e| e.to_string())?;

        let resp = client.get(&url).send().await.map_err(|e| format!("Download failed: {}", e))?;
        if !resp.status().is_success() {
            return Err(format!("Download failed: HTTP {}", resp.status()));
        }
        let bytes = resp.bytes().await.map_err(|e| format!("Read failed: {}", e))?;

        // Extract to GAMES/<folder_name>/
        let dest_dir = games_dir().join(&folder_name);
        std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

        let url_lower = url.to_lowercase();
        if url_lower.ends_with(".7z") {
            // 7z extraction
            let tmp_7z = dest_dir.join("_download.7z");
            std::fs::write(&tmp_7z, &bytes).map_err(|e| e.to_string())?;
            sevenz_rust::decompress_file(&tmp_7z, &dest_dir).map_err(|e| format!("Bad 7z: {}", e))?;
            std::fs::remove_file(&tmp_7z).ok();
        } else {
            let cursor = std::io::Cursor::new(bytes);
            let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("Bad zip: {}", e))?;

            // Determine how many leading path components are shared by every file
            // so we can strip the entire wrapper-folder chain (handles 1 or 2+ levels).
            let mut all_names: Vec<String> = Vec::new();
            for i in 0..archive.len() {
                if let Ok(file) = archive.by_index(i) {
                    if !file.is_dir() {
                        all_names.push(file.name().to_string());
                    }
                }
            }

            let strip_depth = {
                let mut depth = 0usize;
                'outer: loop {
                    let mut common: Option<&str> = None;
                    for name in &all_names {
                        let part = name.splitn(depth + 2, '/').nth(depth);
                        match (common, part) {
                            (_, None) => break 'outer,
                            (None, Some(p)) => common = Some(p),
                            (Some(c), Some(p)) if c != p => break 'outer,
                            _ => {}
                        }
                    }
                    // Only count this level as strippable if it looks like a folder (no dot = no extension)
                    if let Some(c) = common {
                        if !c.is_empty() && !c.contains('.') { depth += 1; } else { break; }
                    } else { break; }
                }
                depth
            };

            for i in 0..archive.len() {
                let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
                let name = file.name().to_string();
                let parts: Vec<&str> = name.split('/').collect();
                let relative = parts[strip_depth..].join("/");
                if relative.is_empty() || relative == "/" { continue; }

                let out_path = dest_dir.join(&relative);

                if file.is_dir() {
                    std::fs::create_dir_all(&out_path).ok();
                } else {
                    if let Some(parent) = out_path.parent() {
                        std::fs::create_dir_all(parent).ok();
                    }
                    let mut buf = Vec::new();
                    file.read_to_end(&mut buf).map_err(|e| e.to_string())?;
                    std::fs::write(&out_path, &buf).map_err(|e| e.to_string())?;
                }
            }
        }

        // Flatten one level of nesting when game content ends up in a subfolder.
        // Happens when the ZIP has a mix of root-level wrapper files + a content subfolder,
        // so the common-prefix strip doesn't fire. Find the subfolder that contains game EXEs
        // and move everything from it up into dest_dir.
        {
            const FLATTEN_SKIP: &[&str] = &["install", "setup", "uninst", "instmain", "deice", "patch", "update"];
            let has_top_game_exe = std::fs::read_dir(&dest_dir).ok()
                .map(|entries| entries.flatten().any(|e| {
                    let n = e.file_name().to_string_lossy().to_lowercase();
                    e.path().is_file() && n.ends_with(".exe")
                        && !FLATTEN_SKIP.iter().any(|s| n.contains(s))
                }))
                .unwrap_or(false);

            if !has_top_game_exe {
                // Find a single subfolder that contains EXEs
                let subdirs: Vec<_> = std::fs::read_dir(&dest_dir).ok()
                    .map(|entries| entries.flatten().filter(|e| e.path().is_dir()).collect())
                    .unwrap_or_default();

                if let Some(subdir) = subdirs.into_iter().find(|e| {
                    std::fs::read_dir(e.path()).ok()
                        .map(|sub| sub.flatten().any(|f| {
                            f.path().is_file() && f.file_name().to_string_lossy().to_lowercase().ends_with(".exe")
                        }))
                        .unwrap_or(false)
                }) {
                    // Move all files from subdir into dest_dir
                    if let Ok(sub_entries) = std::fs::read_dir(subdir.path()) {
                        for entry in sub_entries.flatten() {
                            let src = entry.path();
                            let dst = dest_dir.join(entry.file_name());
                            if !dst.exists() {
                                std::fs::rename(&src, &dst).ok();
                            }
                        }
                    }
                    std::fs::remove_dir_all(subdir.path()).ok();
                }
            }
        }

        // Detect DEICE installer pattern (e.g. Heretic shareware v1.2):
        // DEICE.EXE + HTIC_V12.1/.2/.DAT → run DEICE then the self-extractor.
        // Only needed if the game EXE doesn't already exist in the destination.
        const INSTALLER_EXE_NAMES: &[&str] = &["deice", "setup", "install", "uninst"];
        let game_already_extracted = std::fs::read_dir(&dest_dir).ok()
            .map(|entries| entries.flatten().any(|e| {
                let n = e.file_name().to_string_lossy().to_lowercase();
                n.ends_with(".exe") && !INSTALLER_EXE_NAMES.iter().any(|s| n.contains(s))
            }))
            .unwrap_or(false);
        let deice_path = dest_dir.join("DEICE.EXE");
        if !game_already_extracted && deice_path.exists() {
            // Find the .1 file to determine the archive base name (e.g. HTIC_V12)
            let archive_base = std::fs::read_dir(&dest_dir)
                .ok()
                .and_then(|entries| {
                    entries.flatten().find_map(|e| {
                        let name = e.file_name().to_string_lossy().to_string();
                        if name.to_lowercase().ends_with(".1") {
                            Some(name[..name.len() - 2].to_uppercase())
                        } else {
                            None
                        }
                    })
                });

            if let Some(base) = archive_base {
                let self_extractor = format!("{}.EXE", base);
                let dest_str = dest_dir.to_string_lossy().replace('\\', "/");
                let dosbox = super::dosbox_exe();

                let temp_dir = std::env::temp_dir().join("turbodos");
                std::fs::create_dir_all(&temp_dir).ok();
                let conf_path = temp_dir.join("install.conf");
                let conf_content = format!(
                    "[sdl]\nfullscreen=false\n\n[autoexec]\nmount c \"{dest}\"\nc:\nDEICE.EXE {base}\n{ext}\nexit\n",
                    dest = dest_str,
                    base = base,
                    ext = self_extractor
                );
                std::fs::write(&conf_path, &conf_content).map_err(|e| e.to_string())?;

                let conf_str = conf_path.to_string_lossy().to_string();
                tauri::async_runtime::spawn_blocking(move || {
                    std::process::Command::new(&dosbox)
                        .args(["-conf", &conf_str, "-exit"])
                        .status()
                        .ok();
                })
                .await
                .ok();
            }
        }

        // Post-installer flatten: DEICE (and similar) may create a named subfolder
        // (e.g. QUAKE_SW/) for its output. Move that subfolder's contents up to dest_dir.
        // This mirrors the pre-extraction flatten above but runs after all installer steps.
        {
            const POST_FLATTEN_SKIP: &[&str] = &["install", "setup", "uninst", "instmain", "deice", "patch", "update"];
            let has_top_game_exe = std::fs::read_dir(&dest_dir).ok()
                .map(|entries| entries.flatten().any(|e| {
                    let n = e.file_name().to_string_lossy().to_lowercase();
                    e.path().is_file() && n.ends_with(".exe")
                        && !POST_FLATTEN_SKIP.iter().any(|s| n.contains(s))
                }))
                .unwrap_or(false);

            if !has_top_game_exe {
                let subdirs: Vec<_> = std::fs::read_dir(&dest_dir).ok()
                    .map(|entries| entries.flatten().filter(|e| e.path().is_dir()).collect())
                    .unwrap_or_default();

                if let Some(subdir) = subdirs.into_iter().find(|e| {
                    let dname = e.file_name().to_string_lossy().to_lowercase();
                    !POST_FLATTEN_SKIP.iter().any(|s| dname.contains(s))
                        && std::fs::read_dir(e.path()).ok()
                            .map(|sub| sub.flatten().any(|f| {
                                f.path().is_file()
                                    && f.file_name().to_string_lossy().to_lowercase().ends_with(".exe")
                            }))
                            .unwrap_or(false)
                }) {
                    if let Ok(sub_entries) = std::fs::read_dir(subdir.path()) {
                        for entry in sub_entries.flatten() {
                            let src = entry.path();
                            let dst = dest_dir.join(entry.file_name());
                            if !dst.exists() {
                                std::fs::rename(&src, &dst).ok();
                            }
                        }
                    }
                    std::fs::remove_dir_all(subdir.path()).ok();
                }
            }
        }

        // Detect RESOURCE.*/SETUP.EXE installer pattern (e.g. Quake shareware):
        // SETUP.EXE decompresses RESOURCE.1/.2/.3 into the final game tree.
        // We mount the GAMES root as C: so the installer's default target path
        // (C:\<FOLDER>) maps directly to dest_dir — no extra subfolder nesting.
        {
            let has_resource_blobs = std::fs::read_dir(&dest_dir).ok()
                .map(|entries| entries.flatten().any(|e| {
                    let n = e.file_name().to_string_lossy().to_lowercase();
                    n.starts_with("resource.") && n.chars().last().map_or(false, |c| c.is_ascii_digit())
                }))
                .unwrap_or(false);
            let setup_exe = dest_dir.join("SETUP.EXE");

            if !game_already_extracted && has_resource_blobs && setup_exe.exists() {
                let games_root = dest_dir.parent().unwrap_or(dest_dir.as_path());
                let games_root_str = games_root.to_string_lossy().replace('\\', "/");
                let dosbox = super::dosbox_exe();

                let temp_dir = std::env::temp_dir().join("turbodos");
                std::fs::create_dir_all(&temp_dir).ok();
                let conf_path = temp_dir.join("resource_install.conf");
                // User completes installer interactively; DOSBox exits when SETUP finishes.
                // Accepting the default install path (C:\<FOLDER>) puts files in dest_dir.
                let conf_content = format!(
                    "[sdl]\nfullscreen=false\n\n[autoexec]\nmount c \"{games_root}\"\nc:\ncd {folder}\nSETUP.EXE\nexit\n",
                    games_root = games_root_str,
                    folder = folder_name.to_uppercase()
                );
                std::fs::write(&conf_path, &conf_content).map_err(|e| e.to_string())?;
                let conf_str = conf_path.to_string_lossy().to_string();

                tauri::async_runtime::spawn_blocking(move || {
                    std::process::Command::new(&dosbox)
                        .args(["-conf", &conf_str, "-exit"])
                        .status()
                        .ok();
                })
                .await
                .ok();

                // Post-install flatten: if SETUP created a subfolder with game EXEs, move them up.
                let subdirs: Vec<_> = std::fs::read_dir(&dest_dir).ok()
                    .map(|entries| entries.flatten().filter(|e| e.path().is_dir()).collect())
                    .unwrap_or_default();
                for subdir in subdirs {
                    let subdir_name = subdir.file_name().to_string_lossy().to_lowercase();
                    let subdir_path = subdir.path();
                    let has_exe = std::fs::read_dir(&subdir_path).ok()
                        .map(|sub| sub.flatten().any(|f| {
                            f.path().is_file() && f.file_name().to_string_lossy().to_lowercase().ends_with(".exe")
                                && !INSTALLER_EXE_NAMES.iter().any(|s| f.file_name().to_string_lossy().to_lowercase().contains(s))
                        }))
                        .unwrap_or(false);
                    if has_exe && !INSTALLER_EXE_NAMES.iter().any(|s| subdir_name.contains(s)) {
                        if let Ok(sub_entries) = std::fs::read_dir(&subdir_path) {
                            for entry in sub_entries.flatten() {
                                let src = entry.path();
                                let dst = dest_dir.join(entry.file_name());
                                if !dst.exists() {
                                    std::fs::rename(&src, &dst).ok();
                                }
                            }
                        }
                        std::fs::remove_dir_all(&subdir_path).ok();
                    }
                }
            }
        }

        // Write a default Quake config.cfg with WASD + arrow-key bindings.
        // Quake starts without any config on a fresh install; the in-game wizard
        // is invasive. Writing config.cfg pre-configures sane defaults so both
        // the WASD scheme and the Original (arrow key) scheme work out of the box.
        {
            let quake_exe = dest_dir.join("QUAKE.EXE");
            let id1_dir = dest_dir.join("id1");
            // Quake owns config.cfg — it rewrites it on exit and on the in-game
            // "reset to defaults", clobbering anything we put there (losing WASD and
            // dropping +mlook so freelook stops working). autoexec.cfg runs every launch
            // AFTER config.cfg and is never overwritten by the engine, so our control
            // preset lives here and survives in-game resets.
            let autoexec = id1_dir.join("autoexec.cfg");
            if quake_exe.exists() && !autoexec.exists() {
                std::fs::create_dir_all(&id1_dir).ok();
                let cfg = "\
// TURBODOS Quake control preset (runs every launch; survives in-game resets).\n\
bind \"w\" \"+forward\"\n\
bind \"s\" \"+back\"\n\
bind \"a\" \"+moveleft\"\n\
bind \"d\" \"+moveright\"\n\
bind \"e\" \"+use\"\n\
bind \"UPARROW\" \"+forward\"\n\
bind \"DOWNARROW\" \"+back\"\n\
bind \"LEFTARROW\" \"+left\"\n\
bind \"RIGHTARROW\" \"+right\"\n\
bind \",\" \"+moveleft\"\n\
bind \".\" \"+moveright\"\n\
bind \"SPACE\" \"+jump\"\n\
bind \"CTRL\" \"+attack\"\n\
bind \"SHIFT\" \"+speed\"\n\
bind \"1\" \"impulse 1\"\n\
bind \"2\" \"impulse 2\"\n\
bind \"3\" \"impulse 3\"\n\
bind \"4\" \"impulse 4\"\n\
bind \"5\" \"impulse 5\"\n\
bind \"6\" \"impulse 6\"\n\
bind \"7\" \"impulse 7\"\n\
bind \"8\" \"impulse 8\"\n\
bind \"]\" \"impulse 10\"\n\
bind \"[\" \"impulse 12\"\n\
bind \"PGUP\" \"+lookup\"\n\
bind \"PGDN\" \"+lookdown\"\n\
bind \"ESCAPE\" \"togglemenu\"\n\
sensitivity \"3\"\n\
lookspring \"0\"\n\
lookstrafe \"0\"\n\
m_pitch \"0.022\"\n\
+mlook\n\
";
                std::fs::write(&autoexec, cfg).ok();
            }
        }

        // Write a default SOUND.ROT for Rise of the Triad.
        // ROTT ships with MusicMode/FXMode=0 (Off); DOSBox needs them set to 2 (Sound Blaster).
        // Port/IRQ/DMA values already match DOSBox defaults so only the mode fields need fixing.
        let rott_wad = dest_dir.join("HUNTBGIN.WAD");
        let rott_snd = dest_dir.join("SOUND.ROT");
        if rott_wad.exists() && !rott_snd.exists() {
            let cfg = "\
;Rise of the Triad Sound File\r\n\
;                  (c) 1995\r\n\
\r\n\
Version            13\r\n\
\r\n\
MusicMode          2\r\n\
FXMode             2\r\n\
MusicVolume      196\r\n\
FXVolume         196\r\n\
NumVoices          8\r\n\
NumChannels        2\r\n\
NumBits           16\r\n\
MidiAddress        $330\r\n\
StereoReverse        0\r\n\
SBType             6\r\n\
SBPort             $220\r\n\
SBIrq              7\r\n\
SBDma8             1\r\n\
SBDma16            5\r\n\
SBMidi             $ffffffff\r\n\
SBEmu              $ffffffff\r\n\
";
            std::fs::write(&rott_snd, cfg).ok();
        }

        // Patch SW.CFG after extraction: the pre-extracted 7z includes SW.CFG but is missing
        // [Misc] Executions=1 (required for SW.EXE to skip the "run setup first" gate) and
        // the SoundToggle/VoiceToggle fields (required for FX to be enabled in the in-game menu).
        {
            let sw_grp = dest_dir.join("SW.GRP");
            let sw_cfg = dest_dir.join("SW.CFG");
            if sw_grp.exists() {
                let existing = std::fs::read_to_string(&sw_cfg).unwrap_or_default();
                let mut patched = existing.clone();

                // Inject [Misc] section if absent — SW.EXE checks Executions to skip setup gate.
                if !patched.contains("[Misc]") {
                    patched.push_str("\n[Misc]\nExecutions = 1\nRunMode = 0\n");
                }

                // Inject sound toggle fields if absent — without these FX is greyed out in-game.
                fn inject_after_section(text: &str, section: &str, fields: &[(&str, &str)]) -> String {
                    let mut out = String::new();
                    let mut in_section = false;
                    let mut injected = std::collections::HashSet::new();
                    // Collect which fields already exist anywhere in the section
                    let mut existing_keys: std::collections::HashSet<String> = std::collections::HashSet::new();
                    let mut cur_section = String::new();
                    for line in text.lines() {
                        let trimmed = line.trim();
                        if trimmed.starts_with('[') {
                            cur_section = trimmed.to_lowercase();
                        }
                        if cur_section == section.to_lowercase() {
                            if let Some(key) = trimmed.split('=').next() {
                                existing_keys.insert(key.trim().to_lowercase());
                            }
                        }
                    }
                    for line in text.lines() {
                        let trimmed = line.trim();
                        if trimmed.starts_with('[') {
                            // Before leaving the target section, inject missing fields
                            if in_section {
                                for (k, v) in fields {
                                    if !existing_keys.contains(&k.to_lowercase()) && injected.insert(k.to_lowercase()) {
                                        out.push_str(&format!("{} = {}\n", k, v));
                                    }
                                }
                            }
                            in_section = trimmed.to_lowercase() == format!("[{}]", section.to_lowercase());
                        }
                        out.push_str(line);
                        out.push('\n');
                    }
                    // Handle target section at end of file
                    if in_section {
                        for (k, v) in fields {
                            if !existing_keys.contains(&k.to_lowercase()) && injected.insert(k.to_lowercase()) {
                                out.push_str(&format!("{} = {}\n", k, v));
                            }
                        }
                    }
                    out
                }

                let sound_fields = &[
                    ("SoundToggle", "1"),
                    ("VoiceToggle", "1"),
                    ("AmbienceToggle", "1"),
                    ("MusicToggle", "1"),
                ];
                patched = inject_after_section(&patched, "Sound Setup", sound_fields);

                if patched != existing {
                    std::fs::write(&sw_cfg, patched).ok();
                }
            }
        }

        // Write a default DUKE3D.CFG if Duke Nukem 3D was extracted without one.
        // Duke3D exits immediately on first run without this file; it needs sound card settings.
        // DOSBox emulates SB16 at port 220, IRQ 7, DMA 1/5 — match those here.
        let duke_grp = dest_dir.join("DUKE3D.GRP");
        let duke_cfg = dest_dir.join("DUKE3D.CFG");
        if duke_grp.exists() && !duke_cfg.exists() {
            let cfg = "\
[Setup]\n\
SetupVersion = \"1.3D\"\n\
\n\
[Screen Setup]\n\
ScreenMode = 2\n\
ScreenWidth = 320\n\
ScreenHeight = 200\n\
Shadows = 1\n\
Detail = 1\n\
Tilt = 1\n\
Messages = 1\n\
Out = 0\n\
ScreenSize = 8\n\
ScreenGamma = 0\n\
\n\
[Sound Setup]\n\
FXDevice = 0\n\
MusicDevice = 0\n\
FXVolume = 220\n\
MusicVolume = 200\n\
NumVoices = 8\n\
NumChannels = 2\n\
NumBits = 16\n\
MixRate = 22000\n\
MidiPort = 0x330\n\
BlasterAddress = 0x220\n\
BlasterType = 6\n\
BlasterInterrupt = 7\n\
BlasterDma8 = 1\n\
BlasterDma16 = 5\n\
BlasterEmu = 0x620\n\
ReverseStereo = 0\n\
SoundToggle = 1\n\
VoiceToggle = 1\n\
AmbienceToggle = 1\n\
MusicToggle = 1\n\
\n\
[Controls]\n\
ControllerType = 1\n\
JoystickPort = 0\n\
MouseSensitivity = 32768\n\
MouseAiming = 1\n\
MouseButton0 = \"Fire\"\n\
MouseButtonClicked0 = \"\"\n\
MouseButton1 = \"Strafe\"\n\
MouseButtonClicked1 = \"Open\"\n\
MouseButton2 = \"Move_Forward\"\n\
MouseButtonClicked2 = \"\"\n\
MouseAnalogAxes0 = \"analog_turning\"\n\
MouseAnalogScale0 = 65536\n\
MouseAnalogAxes1 = \"analog_looking\"\n\
MouseAnalogScale1 = 65536\n\
\n\
[Misc]\n\
Executions = 1\n\
RunMode = 0\n\
Crosshairs = 0\n\
\n\
[Comm Setup]\n\
NumberPlayers = 2\n\
PlayerName = \"DUKE\"\n\
RTSName = \"DUKE.RTS\"\n\
ConnectType = 0\n\
";
            std::fs::write(&duke_cfg, cfg).ok();
        }

        Ok(dest_dir.to_string_lossy().to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![cmd_window::toggle_fullscreen, cmd_window::exit_app, cmd_launch::launch_game, cmd_launch::launch_dosbox_shell, cmd_reset::reset_library, cmd_install::flatten_install_dir, cmd_scrape::scrape_game_metadata, cmd_art::save_art_file, cmd_art::load_art_file, cmd_art::download_and_save_art, cmd_art::copy_local_art, cmd_art::install_art_pack, cmd_controller::controller_snapshot, cmd_controller::capture_controller_input, cmd_controller::send_controller_keys, cmd_games_folder::scan_games_folder, cmd_games_folder::open_games_folder, cmd_games_folder::delete_game_folder, cmd_download::download_and_extract_game, cmd_settings::get_games_folder, cmd_settings::get_default_games_folder, cmd_settings::set_games_folder, cmd_music::list_music_files, cmd_music::open_music_folder, cmd_music::load_music_file, cmd_music::save_music_file])
        .run(tauri::generate_context!())
        .expect("error while running TURBODOS");
}
