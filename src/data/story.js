// Chapter I script (data/story.json). Every hero sees the same world through their own story.
// Each line: [speaker, text]. "@prologue" pulls in the shared opening narration.
import { loadJSON } from '../core/data.js';

const D = await loadJSON('story.json');
const expand = (lines) => lines.flatMap((l) => (l === '@prologue' ? D.prologue : [l]));
export const SPEAKERS = D.speakers;
export const STORY = {};
for (const [hero, scenes] of Object.entries(D.scenes)) {
  STORY[hero] = {};
  for (const [k, lines] of Object.entries(scenes)) STORY[hero][k] = expand(lines);
}
export const CAMP_FIRST = expand(D.campFirst);
export const CHAPTER_END = expand(D.chapterEnd);
export const ANSEL_TALK = D.anselTalk;
