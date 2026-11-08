// Lore pages hidden in each zone (data/lore.json).
import { loadJSON } from '../core/data.js';

const D = await loadJSON('lore.json');
export const LORE = D.pages;
