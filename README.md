# Ashveil

An original, offline, pixel-art action RPG for phones (played in landscape).

**Chapter I: The Bell That Tolls in Ash.** Seven winters ago a burning star fell on the city of Lumenhold, and its ash has never stopped falling. Now the bell of Greyhollow's old hill chapel rings at midnight, and each time it rings someone walks out into the ash.

Everything in this game is original: the world, story, characters, creatures, items and pixel art. It needs no server, account or internet connection after the first load, and it has no ads.

## Heroes

Each hero plays differently and has their own story through the chapter.

| Hero | Weapon | Style |
|---|---|---|
| **Kes Vane**, the Ashen Kestrel | Twin blades | Fastest hero. Shreds single targets, heals by striking, least health. |
| **Brannoc**, the Iron Oath | Greathammer | Toughest hero. Slow, huge swings that stun. |
| **Odalys Fen**, the Ash-Witch | Ember staff | Fire magic from range, big area damage, fragile. |
| **Hale Morrow**, Warden of the Ashwood | Longbow | Agile archer with traps and volleys. |

Each hero has 3 skills (unlocked at levels 1, 3 and 5) and an Ultimate that charges as you deal damage.

## What's in Chapter I

- **One connected road:** Greyhollow, Outskirts, Ashwood, Chapel Crypt and Bell Nave. Walk off the east edge of a zone to go on, or off the west edge to go back. Cleared zones fill with enemies again every time you enter, so you can farm them.
- 2 bosses: **Old Crown, the Charcoal Stag** and **The Bellwarden**. They return on later visits too, for another shot at their loot.
- Enemies that test each hero differently, including the **Ashguard**, whose shield blocks attacks from the front. Get behind it, stun it, or hit it with area attacks.
- Gear hunting: 5 slots and 5 rarities. Leftover loot is picked up when you leave a zone. Epic gear starts in the second zone, and Legendary gear only drops from bosses (or Nightmare elites).
- **Bounty board** with repeatable jobs that pay gold, shards, XP and a Rare-or-better item
- **Journal:** one lore page is hidden in each zone
- **Story:** each hero has their own path through the chapter, plus a conversation at the hearth with Maud and Brother Ansel after each zone
- The camp at Greyhollow Hearth, where you can manage gear, upgrade skills, enhance gear with Maud the smith and buy potions (carry up to 5)
- 3-star ratings per zone, and **Nightmare** difficulty after you beat the chapter

## Playing on your phone (Samsung S24 Ultra or any Android phone)

1. Open the game link in **Chrome**.
2. Tap the **three-dot menu**, then **Add to Home screen**, then **Install**.
3. Launch Ashveil from your home screen. It opens fullscreen in landscape and works offline.

Your progress is saved on your phone, in the browser's storage for this site. Clearing Chrome's site data for the game's address will erase your progress.

### Touch controls

- **Left side:** virtual joystick. It stays fixed in the corner; switch to *Floating* (appears where you touch) in Settings.
- **Big button:** attack (hold to keep attacking; it aims at the nearest enemy automatically)
- **Three round buttons:** skills
- **Glowing button:** Ultimate (when full)
- **Arrow button:** dodge roll (you can't be hit during it)
- **Red flask (top left):** drink a potion (8-second cooldown)
- **Falling:** *Rise again* costs 15% of your gold, or return to Greyhollow and keep your loot

Red shapes on the ground show where an enemy is about to strike. Dodge out of them.
Loot you leave on the ground is picked up automatically when you leave a zone.

### Keyboard and mouse (computers)

The game switches by itself: touch the screen and the touch buttons appear; press a key or use the mouse and they hide, with key names shown on each button instead. You can force one mode in **Settings**.

| Action | Keys |
|---|---|
| Move | WASD or arrow keys |
| Attack | J, or hold the left mouse button |
| Skills 1 / 2 / 3 | 1 / 2 / 3 (or K / L / I) |
| Ultimate | R (or U) |
| Dodge roll | Space or Shift, or right-click |
| Potion | Q (or H) |
| Pause | Esc or P |

Every key can be changed in **Settings → Keyboard keys**. A skill pressed a moment too early (mid-swing or mid-roll) still fires.

### Settings and saves

**Settings** is on the title screen, at the hearth and in the pause menu. It has the controls, sound and saving options:

- **Back up save / Restore from file:** download your progress as a file and load it on another device. This works anywhere, including the GitHub Pages version.
- **Cloud save:** available only when the game is opened from an Ashveil server (see below). Sign in with a name and password, and your progress uploads a few seconds after each save. If two devices both changed the save, the game asks which copy to keep.

## Running it locally

There is no build step. Any static web server works for playing:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

After changing any file, regenerate the offline cache list so phones pick up the update:

```bash
node tools/gen-sw.mjs
```

## Hosting it yourself (with cloud saves)

`server.py` serves the game and stores cloud saves. It needs Python 3.8 or newer and nothing else. It replaces `python3 -m http.server`.

```bash
cd /home/cae/project/ashveil
nohup python3 server.py > /tmp/cae-ashveil-server.log 2>&1 < /dev/null &
```

- It listens on `0.0.0.0:6767` by default. Change this with `--host`, `--port`, or `ASHVEIL_HOST` / `ASHVEIL_PORT`.
- Saves go in `~/.local/share/ashveil/users/`, one JSON file per account. Change this with `--data` or `ASHVEIL_DATA`.
  - The folder is outside the game folder, so `git pull` never touches it and browsers can never download it.
  - Back this folder up to keep everyone's progress.
- Passwords are stored only as salted PBKDF2 hashes. After 5 wrong passwords, that name is locked for 10 minutes.
- Stop the server:

  ```bash
  pkill -f 'python3 server.py'
  ```

- A `git pull` updates the game files immediately. Restart the server only when `server.py` itself changes.

Things to know:

- **Other devices** reach it at `http://<the computer's address>:6767`, and only when they can reach that computer, for example on the same Wi-Fi.
  - On a Chromebook running Linux in its built-in container (Crostini), ChromeOS may also need **port forwarding** for port 6767. Look under ChromeOS Settings, in the Linux development environment section. A Chromebook with Ubuntu installed directly does not need this.
  - From outside your home network, a private network tool such as Tailscale is the simple, safe option. Don't open the port on your router.
- **Offline mode and installing** need HTTPS (or `localhost`). Opened as plain `http://192.168...` on a phone, the game works but needs the connection, and it cannot install as an app.
  - Putting HTTPS in front of the server fixes this, for example with Tailscale's HTTPS certificates or a reverse proxy.
- **Each address keeps its own local progress.** The GitHub Pages copy, `localhost:6767` and `192.168...:6767` don't share saves by themselves. Cloud save, or a backup file, moves progress between them.

## Editing the game data

Hero stats, skills, enemies, zones, waves, loot odds, item names, the story and the lore pages are JSON files in [`data/`](data/). [`data/README.md`](data/README.md) explains every field. After editing, run:

```bash
node tools/check-data.mjs
```

It catches typos (with the line number) and broken names between files.

## Project layout

```
index.html, style.css, manifest.webmanifest, sw.js   page shell, install manifest, offline cache
server.py              optional self-hosting server with cloud saves
data/*.json            editable game data (stats, zones, loot, story) - see data/README.md
src/main.js            boot, pixel-perfect scaling, main loop
src/core/              font, sprites, input, key bindings, audio (synthesised), save, cloud save, UI helpers
src/data/              pixel art (ASCII grids) and the code that reads data/*.json
src/game/              stage scene, map generator, player kits, enemy AI, combat, HUD, effects
src/scenes/            title, hero select, camp, dialogue, settings
tools/                 sprite preview, icon generator, service-worker generator, data checker
```
