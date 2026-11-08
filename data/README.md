# Game data

The numbers and text of Ashveil live in these JSON files, so you can change them without touching the code.
The formulas that use them stay in `src/data/*.js`.

After editing, check your work:

```bash
node tools/check-data.mjs
```

It catches JSON typos (a missing comma or quote, with the line number), unknown enemy or skill names, missing story scenes and similar mistakes.
Then regenerate the offline cache so phones pick up the change:

```bash
node tools/gen-sw.mjs
```

JSON rules: text goes in "double quotes", items in a list are separated by commas, and the last item in a list has **no** comma after it. Comments are not allowed.

## heroes.json

- `order`: the order heroes appear on the hero select screen.
- `maxLevel`: the level cap.
- `heroes.<id>`:
  - `base`: starting stats and how much they grow per level:
    - `hp`/`hpL`: health and health per level.
    - `atk`/`atkL`: attack and attack per level.
    - `def`/`defL`: defense and defense per level.
    - `crit`: crit chance, where 0.15 = 15%.
    - `critDmg`: crit damage multiplier.
    - `speed`: move speed in pixels per second.
    - `atkRate`: seconds between basic attacks.
  - `dodgeCd`: seconds between dodge rolls.
  - `passive`: optional. Kes's `leech` is the share of damage healed.
  - `skills`: exactly 3. `cd` is the cooldown in seconds, `unlock` is the level it unlocks at, `dmg` is the damage multiplier (2.0 = twice the hero's attack). `id` must be one the game knows, because the code decides what the skill does.
  - `ult`: the Ultimate. `dmg` is its damage multiplier.

## enemies.json

- `scaling`: how much stronger enemies get per level above 1. For example, `hpPerLevel` 0.34 means +34% of base health per level.
- `enemies.<id>`:
  - `hp`, `atk`, `def`: base stats at level 1.
  - `speed`: pixels per second.
  - `r`: body size.
  - `xp`, `gold`: reward. `gold` is [min, max].
  - `mass`: how hard it is to knock back.
  - `boss`: true for bosses.
  - `shield`: blocks attacks from the front.
- `eliteMods`: the elite modifiers. Their effects are in the code.

## stages.json

- `nightmareBonus`: enemy levels added on Nightmare.
- `stages[]`: the zones, in road order.
  - `lvl`: enemy level.
  - `aggro`: how often enemies attack, where 1.2 = 20% more often.
  - `par`: the par time in seconds, for the third star.
  - `end`: the story scene played when the zone is first cleared.
  - `arenas[]`: the rooms in order. `w`/`h` are the size in tiles. `dy` shifts the room up or down. `story` is a scene to play on entering. `boss` is a boss id.
    - `waves`: a list of waves. Each wave is a list of `[enemyId, count]` or `[enemyId, count, "elite"]`.
- `themes`: the colours and props for each zone's look.

## story.json

- `speakers`: name and text colour for each speaker id.
- `prologue`: the shared opening narration. Put `"@prologue"` in a scene to include it.
- `scenes.<hero>.<scene>`: lists of `["speaker", "text"]` lines.
  - `intro` plays at the start.
  - `c1`–`c3` play at the hearth after the first three zones.
  - The others are named by `stages.json`.
- `campFirst`, `chapterEnd`, `anselTalk`: shared scenes. Brother Ansel's lines are picked at random.

## lore.json

`pages[]`: one hidden page per zone. `zone` is the stage id. `lines` are the paragraphs shown when it is read.

## items.json

- `slotWeights`: how often each gear slot drops.
- `rarityStatMult`: stat multiplier per rarity, in the order Common, Magic, Rare, Epic, Legendary.
- `affixCount`: bonus lines per rarity.
- `dropRates`: the rarity odds for `normal` enemies, `elite`s and `boss`es. Each list has 5 weights, in the order Common, Magic, Rare, Epic, Legendary.
  - `base`: the weight in the first zone.
  - `perTier`: added for each zone further down the road, and +2 zones on Nightmare.
  - `minTier`: the first zone, counting from 0, where that rarity can drop at all.
  - `nightmare`: extra weight on Nightmare.
  - Weights are relative. In `[64, 29, 6, 0, 0]`, Common drops 64 times in 99.
- `bases`: item names by slot and tier. Weapons have a separate list for each hero.
- `affixes`: `label` uses `{v}` for the number. A roll is either `min`–`max` at random, or `base + perLevel × item level`.
- `legendaries`: the name and text of each legendary. The `leg` id ties it to its effect in the code.
