/**
 * Common English words that sound the same (v3 brief 1.3, canvas P7), written by hand for
 * American English. Each line is one group. Bundled with the app: no network at runtime.
 */

import { normalizeAnswer } from './check';

const GROUPS = `
their there they're
to too two
your you're
its it's
whose who's
write right rite wright
here hear
where wear ware
weather whether
which witch
whole hole
know no
knew new gnu
knight night
knot not
knows nose
one won
four for fore
eight ate
by buy bye
see sea
be bee
blue blew
flower flour
hour our
meat meet mete
mail male
pain pane
peace piece
plain plane
rain reign rein
read red
read reed
road rode rowed
sail sale
scene seen
sell cell
sent cent scent
some sum
son sun
stair stare
steal steel
tail tale
threw through
waist waste
wait weight
way weigh whey
week weak
wood would
die dye
dear deer
fair fare
flew flu flue
heal heel he'll
hair hare
higher hire
him hymn
hole whole
I eye aye
in inn
jeans genes
key quay
lead led
loan lone
made maid
mind mined
missed mist
morning mourning
none nun
oar or ore
pair pear pare
passed past
patience patients
pause paws
peak peek pique
pedal peddle
poor pour pore
principal principle
profit prophet
rap wrap
real reel
ring wring
role roll
root route
rose rows
sight site cite
so sew sow
sole soul
stationary stationery
storey story
suite sweet
tea tee
team teem
tide tied
toe tow
vain vane vein
wade weighed
war wore
whine wine
which witch
allowed aloud
altar alter
bare bear
base bass
berry bury
billed build
board bored
born borne
brake break
bread bred
bridal bridle
brews bruise
cache cash
capital capitol
ceiling sealing
cereal serial
cheap cheep
chews choose
chord cord
coarse course
complement compliment
council counsel
creak creek
crews cruise
currant current
days daze
desert dessert
dew do due
doe dough
dual duel
earn urn
faint feint
feat feet
find fined
fir fur
flea flee
for four
foul fowl
gait gate
gilt guilt
grate great
groan grown
guessed guest
hall haul
hay hey
heard herd
hi high
hoarse horse
holy wholly
idle idol
incite insight
it's its
kernel colonel
lain lane
lessen lesson
links lynx
locks lox
maize maze
manner manor
marshal martial
might mite
moose mousse
muscle mussel
naval navel
need knead
oh owe
pail pale
peal peel
pi pie
plum plumb
pray prey
pride pried
prince prints
rack wrack
raise rays raze
rapped rapt wrapped
right write
ring wring
roam Rome
rote wrote
rung wrung
rye wry
sees seas seize
shoe shoo
side sighed
sighs size
slay sleigh
soar sore
sole soul
stake steak
straight strait
suede swayed
tacks tax
taught taut
tear tier
there's theirs
throne thrown
thyme time
toad towed
told tolled
vary very
wail whale
warn worn
watt what
wheel we'll
wood would
yoke yolk
you ewe yew
accept except
affect effect
ad add
aid aide
ail ale
air heir
aisle isle I'll
ant aunt
arc ark
ascent assent
ball bawl
band banned
baron barren
be bee
beach beech
beat beet
beau bow
been bin
berth birth
bite byte
boar bore
bold bowled
bough bow
boy buoy
bridal bridle
cannon canon
carat carrot caret
cast caste
cede seed
cellar seller
censor sensor
chased chaste
cite sight site
claws clause
climb clime
close clothes
coward cowered
cue queue
cymbal symbol
dam damn
discreet discrete
draft draught
earn urn
ewe you
facts fax
feat feet
fisher fissure
flair flare
flecks flex
fort forte
forth fourth
gored gourd
gorilla guerrilla
grill grille
hangar hanger
hart heart
hay hey
heroin heroine
hoard horde
hostel hostile
humerus humorous
jam jamb
knap nap
knead need
knit nit
lacks lax
lam lamb
leach leech
leak leek
lie lye
lute loot
mall maul
mantel mantle
marry merry
medal meddle
metal mettle
mews muse
might mite
minor miner
moan mown
mode mowed
morn mourn
mustard mustered
nay neigh
none nun
overdo overdue
pact packed
palate palette pallet
pause paws
pea pee
pearl purl
pedal peddle
plait plate
pole poll
pore pour poor
presence presents
pros prose
quarts quartz
rain reign rein
rapped rapt
rest wrest
retch wretch
review revue
ring wring
roe row
rough ruff
sac sack
sane seine
scull skull
seam seem
serf surf
sew so sow
shear sheer
shone shown
slew slough
soared sword
sole soul
stayed staid
steal steel
sundae Sunday
tacks tax
tare tear
tense tents
the thee
tick tic
toad towed
troop troupe
undo undue
use ewes
vial vile
wade weighed
waive wave
way weigh
weak week
weather whether
which witch
whirled world
wine whine
won one
yore your you're
`;

/** Each normalised word → the index of its groups (a word can be in more than one). */
const groupsOf = new Map<string, Set<number>>();
GROUPS.trim()
  .split('\n')
  .forEach((line, index) => {
    for (const word of line.trim().split(/\s+/)) {
      const key = normalizeAnswer(word);
      groupsOf.set(key, new Set([...(groupsOf.get(key) ?? []), index]));
    }
  });

/** How many groups the list has (for tests). */
export const HOMOPHONE_GROUP_COUNT = GROUPS.trim().split('\n').length;

/**
 * Are these two different words that sound the same? (P7: "Sounds the same, count it".)
 * False when they are the same word, or not in one group together.
 */
export function soundsAlike(typed: string, word: string): boolean {
  const a = normalizeAnswer(typed);
  const b = normalizeAnswer(word);
  if (a === b) return false;
  const groupsA = groupsOf.get(a);
  const groupsB = groupsOf.get(b);
  if (!groupsA || !groupsB) return false;
  return [...groupsA].some((group) => groupsB.has(group));
}
