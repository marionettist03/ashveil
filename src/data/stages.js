// Chapter I zones and their look. All of it lives in data/stages.json.
// Each arena locks its gates until every wave is cleared.
// wave entry: [enemyType, count, flags?]  flags: 'elite'
import { loadJSON } from '../core/data.js';

const D = await loadJSON('stages.json');
export const CHAPTER_NAME = D.chapterName;
export const STAGES = D.stages;
export const NIGHTMARE_BONUS = D.nightmareBonus; // enemy levels added on Nightmare
export const THEMES = D.themes;
