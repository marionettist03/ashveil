// Chapter I script. Every hero sees the same world through their own story.
// Each line: [speaker, text]. Speakers: narr, kes, brannoc, odalys, hale, maud, stag, warden, voice
export const SPEAKERS = {
  narr: { name: '', col: '#b8a99a' },
  kes: { name: 'Kes', col: '#35b8a8' },
  brannoc: { name: 'Brannoc', col: '#e0605a' },
  odalys: { name: 'Odalys', col: '#ff9a3c' },
  hale: { name: 'Hale', col: '#9fb46a' },
  maud: { name: 'Maud', col: '#d9a46a' },
  ansel: { name: 'Brother Ansel', col: '#b8b0c8' },
  stag: { name: 'Old Crown', col: '#ffb347' },
  warden: { name: 'The Bellwarden', col: '#e8b862' },
  voice: { name: '???', col: '#c06bff' },
};

const PROLOGUE = [
  ['narr', 'Seven winters ago, the Cinder Star fell on Lumenhold, the city of lamps.'],
  ['narr', 'It never burned out. Somewhere under the ruins it burns still, and its ash has not stopped falling since.'],
  ['narr', 'Where the ash lies deep, things walk that should not. People call them the Hollowed.'],
  ['narr', 'Greyhollow is the last lit hearth on the Ember Road. For three nights, the bell of its old hill chapel has rung at midnight, though no one has climbed that tower in years.'],
  ['narr', 'And each time it rings, someone in Greyhollow rises from bed and walks out into the ash.'],
];

export const STORY = {
  kes: {
    c1: [
      ['maud', 'You found her ribbon? Then she was alive when she passed that fence. Hollowed don\'t stop to snag on things.'],
      ['ansel', 'The Vane boy. I knew your mother\'s footsteps. You walk like her: like the ground owes you money.'],
      ['kes', 'Brother Ansel. You rang that bell for forty years. Who\'s ringing it now?'],
      ['ansel', 'No one in Greyhollow, child. Bells answer bells. Find out what this one is answering.'],
    ],
    c2: [
      ['kes', 'At the end the stag stopped looking at me. It looked at the hill. Like it was sorry.'],
      ['ansel', 'Old Crown kept the boundary between our wood and what lies past it. With him gone, the north road is open both ways.'],
      ['maud', 'Then we\'d best make sure only the right things walk it. Give me those blades, Kestrel. They\'re dull.'],
    ],
    c3: [
      ['kes', 'Someone wrote on the crypt wall. Fresh. Something about the dead wearing the living.'],
      ['ansel', '...The Choir\'s words. A sect of the old chapel. They believed the Star was not a disaster, but a door.'],
      ['kes', 'And Pip? Why her?'],
      ['ansel', 'Children hear bells the clearest. I am sorry. Go up to the nave and stop the ringing before it calls her farther.'],
    ],
    intro: [
      ...PROLOGUE,
      ['kes', 'Pip? ...Pip! Her blanket\'s still warm.'],
      ['kes', 'She doesn\'t sleepwalk. Not once in eleven years.'],
      ['kes', 'Three tolls. Three people gone. I\'m not waiting around for a fourth.'],
      ['maud', 'Kestrel Vane. If you mean to go after her, you won\'t do it with a pair of kitchen knives.'],
      ['maud', 'Take these. They were my husband\'s. He\'d want them cutting something that deserves it.'],
      ['kes', 'Thanks, Maud. Keep the hearth lit for us. Both of us.'],
    ],
    s1_start: [
      ['kes', 'Small footprints in the ash, heading for the old fields. That\'s her. Has to be.'],
      ['kes', 'And something else walking beside them. Lots of somethings.'],
    ],
    s1_mid: [
      ['kes', 'That coat... that\'s old Jory\'s coat. He went at the first toll.'],
      ['kes', 'Sorry, Jory. I\'ll bring the rest of them home if I can.'],
    ],
    s1_end: [
      ['kes', 'Her ribbon, caught on the fence. The blue one I bought her at the spring fair.'],
      ['kes', 'The trail goes into the Ashwood. Fine. Into the Ashwood it is.'],
    ],
    s2_start: [
      ['kes', 'Everyone says never go into the Ashwood after dark.'],
      ['kes', 'It\'s always after dark now. So I suppose everyone can stop saying it.'],
    ],
    s2_boss: [
      ['narr', 'Something vast moves between the burnt trees. It wears a crown of burning antlers.'],
      ['kes', 'That\'s a stag the size of a hay cart. With its antlers on fire.'],
      ['kes', 'Great. Wonderful. Just what tonight needed.'],
    ],
    s2_end: [
      ['kes', 'It was looking at the hill the whole time. At the chapel. Right up until the end.'],
      ['kes', 'Hang on, Pip. I\'m nearly there.'],
    ],
    s3_start: [
      ['kes', 'The chapel doors are bricked shut. But the crypt door underneath is wide open.'],
      ['kes', 'Of course it is. Why would anything be easy.'],
    ],
    s3_mid: [
      ['narr', 'Words are scratched into the wall, fresh, the stone dust still pale: THE BELL DOES NOT CALL THE DEAD. IT CALLS THE LIVING, SO THE DEAD MAY WEAR THEM.'],
      ['kes', '...I didn\'t read that. I didn\'t read that. Keep moving.'],
    ],
    s3_end: [
      ['kes', 'Stairs. Going up. I can hear it now, humming in the stone even when it isn\'t ringing.'],
    ],
    s4_start: [
      ['kes', 'The nave. There are people in here, standing in rows like they\'re waiting for a sermon.'],
      ['kes', 'Pip? Pip, are you here?'],
    ],
    s4_boss: [
      ['warden', 'WHO CLIMBS. THE BELL MUST RING. IT MUST RING UNTIL THEY ALL COME HOME.'],
      ['kes', 'Where is my sister?!'],
      ['warden', 'SHE WALKS THE ROAD HOME. ALL OF THEM WALK HOME.'],
      ['kes', 'Then I\'ll take her home myself. Out of my way.'],
    ],
    s4_phase: [
      ['warden', 'THE BELL... CRACKS...'],
      ['kes', 'Good. Let\'s break the rest of it.'],
    ],
    s4_end: [
      ['warden', '...the rope... it was never in my hands... the bell was answering another bell... in Lumenhold...'],
      ['narr', 'The bell falls silent. One by one, the people standing in the nave blink, shiver, and wake.'],
      ['kes', 'Jory. Tam. Old Neve... they\'re waking up. They\'re all waking up.'],
      ['kes', 'But she\'s not here. Pip isn\'t here.'],
      ['maud', 'The ones who came back say they heard a second bell, far off. North, they say. Toward the city.'],
      ['kes', 'Then I go north. Keep the hearth lit, Maud. I\'m bringing her home.'],
    ],
  },

  brannoc: {
    c1: [
      ['maud', 'You fight like a man trying to be forgiven.'],
      ['brannoc', 'Is it that plain?'],
      ['ansel', 'Brannoc of the Watch. I would know that tread anywhere. Aldren spoke of you, the night before the Star.'],
      ['brannoc', 'What did he say?'],
      ['ansel', 'That you were the only one he trusted to get the townsfolk home. Remember that, when you reach him.'],
    ],
    c2: [
      ['brannoc', 'I remember that stag. The night we fled, he walked beside the carts until dawn.'],
      ['ansel', 'He guided you home then. You guided him home now. That is a debt paid, not a debt made.'],
      ['maud', 'Sit. Eat. You\'ll do your captain no good fainting on the stairs.'],
    ],
    c3: [
      ['brannoc', 'The relics are gone from the crypt. Aldren swore they would keep the bell quiet.'],
      ['ansel', 'Then someone wanted it loud. The Choir took them, I would wager, before the first toll.'],
      ['brannoc', 'Then this was never his doing.'],
      ['ansel', 'No. He is only the hand on the rope. Free the hand, and you will learn who holds the other end.'],
    ],
    intro: [
      ...PROLOGUE,
      ['brannoc', 'That bell. I would know that bell in my grave.'],
      ['brannoc', 'Seven years of walking, and the road brings me back to the one door I swore to guard.'],
      ['maud', 'You\'re the old soldier sleeping in my stable. You know something about that chapel.'],
      ['brannoc', 'I know who rang that bell the night Lumenhold fell. Ser Aldren Vey. He was my captain.'],
      ['brannoc', 'He held the hill so the townsfolk could run. I was meant to hold it beside him.'],
      ['brannoc', 'I ran instead.'],
      ['maud', 'Then you\'d best not run tonight. There\'s an old maul over the forge. It\'s yours.'],
    ],
    s1_start: [
      ['brannoc', 'These fields were green once. I remember wheat up to my belt.'],
      ['brannoc', 'Now look at them. Ash and the walking dead. Come then. I\'m slow, but I\'m certain.'],
    ],
    s1_mid: [
      ['brannoc', 'These Hollowed wear Greyhollow coats. Farmers. Weavers.'],
      ['brannoc', 'Forgive me. I will make it quick.'],
    ],
    s1_end: [
      ['brannoc', 'The chapel road runs through the Ashwood. As it did that night.'],
      ['brannoc', 'I walked this path the other way, seven years ago. Running.'],
    ],
    s2_start: [
      ['brannoc', 'The trees remember fire. You can smell it in them still.'],
    ],
    s2_boss: [
      ['narr', 'Something vast moves between the burnt trees. It wears a crown of burning antlers.'],
      ['brannoc', 'A noble beast, turned. The bell spares nothing it touches.'],
      ['brannoc', 'I am sorry, old one. Come. Let us both be finished with this.'],
    ],
    s2_end: [
      ['brannoc', 'Rest. You kept this wood longer than I kept my oath.'],
    ],
    s3_start: [
      ['brannoc', 'The crypt. We stored the city\'s relics here after the fall. Aldren insisted.'],
      ['brannoc', 'He said if the bell ever woke, the relics would hold it quiet.'],
    ],
    s3_mid: [
      ['narr', 'Words are scratched into the wall, fresh, the stone dust still pale: THE BELL DOES NOT CALL THE DEAD. IT CALLS THE LIVING, SO THE DEAD MAY WEAR THEM.'],
      ['brannoc', 'This is not Aldren\'s hand. Someone else has been down here.'],
    ],
    s3_end: [
      ['brannoc', 'The relic shelves are empty. Someone took them before the bell began ringing.'],
      ['brannoc', 'Up, then. To the nave. To him.'],
    ],
    s4_start: [
      ['brannoc', 'He\'s standing them in rows. Like a muster. He always did love a straight line.'],
    ],
    s4_boss: [
      ['warden', 'WHO CLIMBS. THE BELL MUST RING. IT MUST RING UNTIL THEY ALL COME HOME.'],
      ['brannoc', 'Aldren. Captain. It\'s Brannoc.'],
      ['warden', 'BRANNOC. ...YOU RAN.'],
      ['brannoc', 'I did. I\'ve come back to finish the watch.'],
    ],
    s4_phase: [
      ['warden', 'THE BELL... CRACKS...'],
      ['brannoc', 'Let go of the rope, Aldren. Let go!'],
    ],
    s4_end: [
      ['warden', '...Brannoc... the rope was never in my hands... the bell answers another bell... in Lumenhold...'],
      ['warden', '...hold the line... this time...'],
      ['narr', 'The bell falls silent. One by one, the people standing in the nave blink, shiver, and wake.'],
      ['brannoc', 'Rest, Captain. The watch is mine now.'],
      ['narr', 'Brannoc pries the cracked clapper from the great bell and ties it across his back.'],
      ['brannoc', 'Lumenhold, then. Seven years I\'ve walked away from it. Time to walk toward it.'],
    ],
  },

  odalys: {
    c1: [
      ['maud', 'Folk are whispering that the witch is fighting for Greyhollow.'],
      ['odalys', 'Let them whisper. Whispers are cheaper than gratitude, and they keep longer.'],
      ['ansel', 'Odalys. Mother Ilse\'s best pupil. I heard you scrubbing the crypt floors every dawn for six years.'],
      ['odalys', 'And you never once told me why she threw me out.'],
      ['ansel', 'Because I did not know. I only know she wept that night, and she did not weep easily.'],
    ],
    c2: [
      ['odalys', 'There\'s old ash in that wood, older than the Star. Something burned there long before Lumenhold.'],
      ['ansel', 'The first chapel stood in the wood, before the hill. It burned in the year the bells were cast.'],
      ['odalys', 'Bells. More than one.'],
      ['ansel', '...Go carefully, child. Some doors were shut for good reason.'],
    ],
    c3: [
      ['odalys', 'The words on the crypt wall come from the forbidden rite. Only three people ever held its key.'],
      ['ansel', 'Myself, the Abbot, and Mother Ilse. The Abbot is seven years dead.'],
      ['odalys', 'And you are blind, Brother. You could not have written them.'],
      ['ansel', 'No. Which leaves the one you least want it to be.'],
    ],
    intro: [
      ...PROLOGUE,
      ['odalys', 'Listen. Under the bell. The ash is singing with it.'],
      ['maud', 'Witch. Folk say you walked out of the ash with your eyes lit up like coals.'],
      ['odalys', 'Folk say a great many things. I was an acolyte of that chapel before they threw me out of it.'],
      ['odalys', 'Whoever is ringing that bell is using an old rite. One I was forbidden to read.'],
      ['odalys', 'Which makes me the only person in this town who can guess how to stop it.'],
      ['maud', '...Then go and stop it. I\'ll not complain about who does the saving.'],
    ],
    s1_start: [
      ['odalys', 'The Hollowed are thick here. The bell has been feeding them.'],
      ['odalys', 'Good. Fire needs fuel.'],
    ],
    s1_mid: [
      ['odalys', 'They\'re not empty. That\'s the cruel part. Something is still in there, listening to the song.'],
    ],
    s1_end: [
      ['odalys', 'Into the wood, then. The singing is louder that way.'],
    ],
    s2_start: [
      ['odalys', 'The ash here is old. Older than the Star. Something burned here long before Lumenhold.'],
    ],
    s2_boss: [
      ['narr', 'Something vast moves between the burnt trees. It wears a crown of burning antlers.'],
      ['odalys', 'Its heart is still beating under all that ash. That\'s what makes it cruel.'],
      ['odalys', 'Hold still, old one. I\'ll make the fire quick.'],
    ],
    s2_end: [
      ['odalys', 'There. The song let go of it. It\'s quiet now.'],
    ],
    s3_start: [
      ['odalys', 'The crypt. I scrubbed these floors for six years. I know every crack in them.'],
      ['odalys', 'Including the ones that weren\'t here before.'],
    ],
    s3_mid: [
      ['narr', 'Words are scratched into the wall, fresh, the stone dust still pale: THE BELL DOES NOT CALL THE DEAD. IT CALLS THE LIVING, SO THE DEAD MAY WEAR THEM.'],
      ['odalys', 'That\'s a line from the forbidden rite. Word for word.'],
      ['odalys', 'Only three people ever had the key to that book. I was never one of them.'],
    ],
    s3_end: [
      ['odalys', 'The stairs to the nave. The song is so loud now I can barely hear myself think.'],
    ],
    s4_start: [
      ['odalys', 'They\'re standing in rows like a choir. Waiting for a hymn.'],
    ],
    s4_boss: [
      ['warden', 'WHO CLIMBS. THE BELL MUST RING. IT MUST RING UNTIL THEY ALL COME HOME.'],
      ['odalys', 'You\'re not ringing it. Something is ringing it through you.'],
      ['warden', 'THE STAR SINGS. I ONLY HOLD THE ROPE.'],
      ['odalys', 'Then I\'ll burn the rope.'],
    ],
    s4_phase: [
      ['warden', 'THE BELL... CRACKS...'],
      ['odalys', 'The song is breaking. Keep going!'],
    ],
    s4_end: [
      ['warden', '...the rope was never in my hands... the bell answers another bell... in Lumenhold...'],
      ['narr', 'The bell falls silent. One by one, the people standing in the nave blink, shiver, and wake.'],
      ['narr', 'Beneath the bell lies a torn page from the forbidden rite. It is signed.'],
      ['odalys', 'Mother Ilse. My teacher. The one who threw me out.'],
      ['odalys', 'You didn\'t cast me out to keep me from the rite, did you? You cast me out to keep me away from you.'],
      ['odalys', 'Lumenhold, then. Let\'s see what song you\'re singing, Mother.'],
    ],
  },

  hale: {
    c1: [
      ['maud', 'You smell of pine smoke and wet fur. Sit by the fire before you catch your death.'],
      ['hale', 'Every track in those fields leads to the wood. All of them. Like water running downhill.'],
      ['ansel', 'Then the bell has tilted the land itself. Your wood is the slope, girl, and everything is sliding into it.'],
    ],
    c2: [
      ['hale', 'I planted a seed where Old Crown fell.'],
      ['ansel', 'Your grandmother did the same, when the warden before him died. That is how the wood chooses its keeper.'],
      ['hale', '...She never told me that.'],
      ['ansel', 'She told me. Wardens are poor at speaking of themselves. It must run in the family.'],
    ],
    c3: [
      ['hale', 'Everything under that chapel smells wrong. Not death. Something waiting to be born.'],
      ['ansel', 'The Choir would call it the same. A door. Go up to the nave, Hale, and close it.'],
      ['maud', 'And come back down after. I\'ve grown used to you tracking mud through my forge.'],
    ],
    intro: [
      ...PROLOGUE,
      ['hale', 'The Ashwood\'s gone quiet. No crows. No foxes. Nothing.'],
      ['hale', 'Last night I saw Old Crown at the treeline. The great stag. Warden of the wood since before my grandmother was born.'],
      ['hale', 'His eyes were burning. He was walking toward the bell.'],
      ['maud', 'Then the forest has lost its keeper too.'],
      ['hale', 'No. It still has me. I\'ll put him to rest if I have to. Then I\'ll find whoever is ringing that bell.'],
    ],
    s1_start: [
      ['hale', 'Deer tracks and people tracks, side by side. Like they\'re being led on a leash.'],
    ],
    s1_mid: [
      ['hale', 'The Hollowed don\'t hunt like animals. They hunt like they\'re being told where to go.'],
    ],
    s1_end: [
      ['hale', 'My wood. Whatever\'s in there now, it\'s walking on my ground.'],
    ],
    s2_start: [
      ['hale', 'This was a green place when I was small. Moss so thick you could sleep on it.'],
      ['hale', 'I\'ll make it green again. One fire at a time.'],
    ],
    s2_boss: [
      ['narr', 'Something vast moves between the burnt trees. It wears a crown of burning antlers.'],
      ['hale', 'Old Crown...'],
      ['hale', 'I\'m sorry. I\'m so sorry. I\'ll make it quick. I promise I\'ll make it quick.'],
    ],
    s2_end: [
      ['hale', 'Rest now. I\'ll keep the wood for you.'],
      ['narr', 'Hale presses a single seed into the warm ash where the stag fell.'],
    ],
    s3_start: [
      ['hale', 'I hate places with roofs.'],
    ],
    s3_mid: [
      ['narr', 'Words are scratched into the wall, fresh, the stone dust still pale: THE BELL DOES NOT CALL THE DEAD. IT CALLS THE LIVING, SO THE DEAD MAY WEAR THEM.'],
      ['hale', 'Then it can find someone else to wear. Not me. Not my wood.'],
    ],
    s3_end: [
      ['hale', 'Stairs up. I can feel the bell in my teeth.'],
    ],
    s4_start: [
      ['hale', 'All these people, just standing. Like deer frozen in torchlight.'],
    ],
    s4_boss: [
      ['warden', 'WHO CLIMBS. THE BELL MUST RING. IT MUST RING UNTIL THEY ALL COME HOME.'],
      ['hale', 'You took the heart out of my forest.'],
      ['warden', 'THE WOOD WILL BURN AS THE CITY BURNED. EVERYTHING WALKS HOME.'],
      ['hale', 'Not while I\'m still drawing breath.'],
    ],
    s4_phase: [
      ['warden', 'THE BELL... CRACKS...'],
      ['hale', 'There\'s the weak spot. Keep loosing!'],
    ],
    s4_end: [
      ['warden', '...the rope was never in my hands... the bell answers another bell... in Lumenhold...'],
      ['narr', 'The bell falls silent. One by one, the people standing in the nave blink, shiver, and wake.'],
      ['narr', 'At dawn, Hale returns to the place where Old Crown fell.'],
      ['narr', 'In the ash, a single green shoot has broken through. The first green thing in seven years.'],
      ['hale', 'Look at that. You\'re still keeping the wood after all.'],
      ['hale', 'Another bell, in the city. Then that\'s where the rot starts. I\'m going to cut it out at the root.'],
    ],
  },
};

export const CAMP_FIRST = [
  ['maud', 'This hearth is the last warm place this side of the hills. Come back to it whenever you need mending.'],
  ['maud', 'Bring me what you find out there. Good steel I can sharpen. The rest I\'ll melt down and pay you for.'],
  ['maud', 'Now go on. The Ember Road won\'t walk itself.'],
];

export const CHAPTER_END = [
  ['narr', 'END OF CHAPTER I'],
  ['narr', 'The Road to Lumenhold is still to come.'],
  ['narr', 'Nightmare difficulty is now open. Stronger enemies, better gear.'],
];

// Things Brother Ansel says when you sit with him (lore and gentle tips).
export const ANSEL_TALK = [
  'A shield guards only the front. A wise hunter walks around a wall instead of through it.',
  'Elites carry better goods. You can see the spite glowing on them.',
  'The deeper the road, the sharper the steel. Legendary work comes only from the strongest foes.',
  'The bounties on the board pay well, if you are willing to walk old roads twice.',
  'Red on the ground is a warning. Heed it, and roll aside.',
  'The ash forgets nothing. But it forgives everything, eventually.',
  'Maud\'s husband forged the hinges on the chapel door. She has not climbed that hill since he died.',
  'Lumenhold had a thousand lamps. On clear nights I still hear the glass singing in the wind.',
];
