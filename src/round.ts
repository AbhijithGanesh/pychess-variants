import { h } from "snabbdom";
import { VNode } from 'snabbdom/vnode';
import RoundController from './ctrl';
import { VARIANTS } from './chess';


function runGround(vnode: VNode, model, handler) {
    const el = vnode.elm as HTMLElement;
    const ctrl = new RoundController(el, model, handler);
    const cg = ctrl.chessground;
    window['cg'] = cg;
}

export function roundView(model, handler): VNode[] {
    // console.log(".......roundView(model, handler)", model, handler);
    var playerTop, playerBottom;
    if (model["username"] !== model["wplayer"] && model["username"] !== model["bplayer"]) {
        // spectator game view
        playerTop = model["variant"] === 'shogi' ? model["wplayer"] : model["bplayer"];
        playerBottom = model["variant"] === 'shogi' ? model["bplayer"] : model["wplayer"];
    } else {
        playerTop = model["username"] === model["wplayer"] ? model["bplayer"] : model["wplayer"];
        playerBottom = model["username"];
    }
    return [h('aside.sidebar-first', [ h('div.roundchat#roundchat') ]),
            h('main.main', [
                h(`selection.${VARIANTS[model["variant"]].board}.${VARIANTS[model["variant"]].pieces}`, [
                    h(`div.cg-wrap.${VARIANTS[model["variant"]].cg}`,
                        { hook: { insert: (vnode) => runGround(vnode, model, handler)},
                    }),
                ]),
            ]),
            h('aside.sidebar-second', [
                h('div#pocket-wrapper', [
                    h(`div.${VARIANTS[model["variant"]].pieces}`, [
                        h('div.cg-wrap.pocket', [
                            h('div#pocket0'),
                        ]),
                    ]),
                ]),
                h('div#clock0'),
                h('div.round-data', [
                    h('player', playerTop + " (1500?)"),
                    h('div#move-controls'),
                    h('div#movelist'),
                    h('div#after-game'),
                    h('div#game-controls'),
                    h('player', playerBottom + " (1500?)"),
                ]),
                h('div#clock1'),
                h('div#pocket-wrapper', [
                    h(`div.${VARIANTS[model["variant"]].pieces}`, [
                        h('div.cg-wrap.pocket', [
                            h('div#pocket1'),
                        ]),
                    ]),
                ]),
                h('div#flip'),
                h('div#zoom'),
            ]),
        ];
}
