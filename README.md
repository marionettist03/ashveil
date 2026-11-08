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
- Gear hunting: 5 slots and 5 rarities. Epic gear starts in the second zone, and Legendary gear only drops from bosses (or Nightmare elites).
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

- **Left side:** virtual joystick. It stays fixed in the corner; switch to *Floating* (appears where you touch) in the pause menu.
- **Big button:** attack (hold to keep attacking; it aims at the nearest enemy automatically)
- **Three round buttons:** skills
- **Glowing button:** Ultimate (when full)
- **Arrow button:** dodge roll (you can't be hit during it)
- **Red flask (top left):** drink a potion (8-second cooldown)
- **Falling:** *Rise again* costs 15% of your gold, or return to Greyhollow and keep your loot

Red shapes on the ground show where an enemy is about to strike. Dodge out of them.

### Keyboard (desktop)

WASD or the arrow keys to move, **J** attack, **K / L / I** skills, **U** Ultimate, **Space** dodge, **H** potion, **Esc** pause.

## Running it locally

There is no build step. Any static web server works:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

After changing any file, regenerate the offline cache list so phones pick up the update:

```bash
node tools/gen-sw.mjs
```

## Project layout

```
index.html, style.css, manifest.webmanifest, sw.js   page shell, install manifest, offline cache
src/main.js            boot, pixel-perfect scaling, main loop
src/core/              font, sprites, input, audio (synthesised), save, UI helpers
src/data/              art (ASCII pixel art), heroes, enemies, items, stages, story
src/game/              stage scene, map generator, player kits, enemy AI, combat, HUD, effects
src/scenes/            title, hero select, camp, dialogue
tools/                 sprite preview, icon generator, service-worker generator
```
