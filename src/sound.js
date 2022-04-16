const ALL_SOUNDS = [
  "back_001",
  "back_002",
  "back_003",
  "back_004",
  "bong_001",
  "click_001",
  "click_002",
  "click_003",
  "click_004",
  "click_005",
  "close_001",
  "close_002",
  "close_003",
  "close_004",
  "confirmation_001",
  "confirmation_002",
  "confirmation_003",
  "confirmation_004",
  "drop_001",
  "drop_002",
  "drop_003",
  "drop_004",
  "error_001",
  "error_002",
  "error_003",
  "error_004",
  "error_005",
  "error_006",
  "error_007",
  "error_008",
  "glass_001",
  "glass_002",
  "glass_003",
  "glass_004",
  "glass_005",
  "glass_006",
  "glitch_001",
  "glitch_002",
  "glitch_003",
  "glitch_004",
  "maximize_001",
  "maximize_002",
  "maximize_003",
  "maximize_004",
  "maximize_005",
  "maximize_006",
  "maximize_007",
  "maximize_008",
  "maximize_009",
  "minimize_001",
  "minimize_002",
  "minimize_003",
  "minimize_004",
  "minimize_005",
  "minimize_006",
  "minimize_007",
  "minimize_008",
  "minimize_009",
  "open_001",
  "open_002",
  "open_003",
  "open_004",
  "pluck_001",
  "pluck_002",
  "question_001",
  "question_002",
  "question_003",
  "question_004",
  "scratch_001",
  "scratch_002",
  "scratch_003",
  "scratch_004",
  "scratch_005",
  "scroll_001",
  "scroll_002",
  "scroll_003",
  "scroll_004",
  "scroll_005",
  "select_001",
  "select_002",
  "select_003",
  "select_004",
  "select_005",
  "select_006",
  "select_007",
  "select_008",
  "switch_001",
  "switch_002",
  "switch_003",
  "switch_004",
  "switch_005",
  "switch_006",
  "switch_007",
  "tick_001",
  "tick_002",
  "tick_004",
  "toggle_001",
  "toggle_002",
  "toggle_003",
  "toggle_004",
];

const SOUND_NAMES = {
  n: "question_002",
  snapPosition: "tick_002",
  realign: "tick_002",
  r: "select_006",
};

export class SoundEffects {
  constructor(enabled) {
    this.enabled = !!enabled;
    this.maxOverlap = 3;
    this.loaded = {};
    this.playingFlags = {};
  }

  play(soundName, ext) {
    let soundList = this.loaded[soundName];
    if (!soundList) {
      soundList = [];
      this.loaded[soundName] = soundList;
    }
    for (let i = 0; i < this.maxOverlap; i++) {
      if (soundList.length <= i) {
        soundList.push(new Audio(`audio/${soundName}.${ext ?? "ogg"}`));
      }
      if (soundList[i].paused) {
        soundList[i].play();
        break;
      }
    }
  }

  action(name) {
    const soundName = SOUND_NAMES[name];
    if (soundName && this.enabled) {
      this.play(soundName);
    }
  }

  continuousTrigger(name, repTimeMs) {
    repTimeMs = repTimeMs || 100;
    const soundName = SOUND_NAMES[name];
    if (soundName && this.enabled && !this.playingFlags[name]) {
      this.playingFlags[name] = true;
      this.play(soundName);
      window.setTimeout(() => {
        this.playingFlags[name] = false;
      }, repTimeMs);
    }
  }
}

document.e = new SoundEffects(true);
