import type { RpfArenaArt } from '../components/RpfArena'
import ring from '../assets/rpf/ring.png'
import centaur from '../assets/rpf/characters/centaur.png'
import minotaur from '../assets/rpf/characters/minotaur.png'
import wizard from '../assets/rpf/characters/wizard.png'
import shieldPrincess from '../assets/rpf/characters/shieldPrincess.png'
import flamePrincess from '../assets/rpf/characters/flamePrincess.png'
import voidBeast from '../assets/rpf/characters/voidBeast.png'
import ogre from '../assets/rpf/characters/ogre.png'
import spider from '../assets/rpf/characters/spider.png'
import rock0 from '../assets/rpf/symbols/rock0.png'
import rock1 from '../assets/rpf/symbols/rock1.png'
import paper0 from '../assets/rpf/symbols/paper0.png'
import paper1 from '../assets/rpf/symbols/paper1.png'
import scissor0 from '../assets/rpf/symbols/scissor0.png'
import scissor1 from '../assets/rpf/symbols/scissor1.png'
import star0 from '../assets/rpf/symbols/star0.png'
import star1 from '../assets/rpf/symbols/star1.png'

/**
 * Rock Paper Flipper's art. Characters are keyed by RpfCharacter.art, so
 * which fighter plays which hand stays in the engine's config
 * (worker/src/families/rpfData.ts) and only the drawing lives here --
 * same split every other Family uses.
 *
 * The symbols come in pairs, 0 for the left of the ring and 1 for the
 * right, which is Joshua's own convention from the Processing renderer.
 */
export const RPF_ARENA_ART: RpfArenaArt = {
  ring,
  characters: { centaur, minotaur, wizard, shieldPrincess, flamePrincess, voidBeast, ogre, spider },
  symbols: {
    rock0,
    rock1,
    paper0,
    paper1,
    scissors0: scissor0,
    scissors1: scissor1,
    royalty0: star0,
    royalty1: star1,
  },
}
