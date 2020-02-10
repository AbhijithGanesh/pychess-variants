//import { h } from "snabbdom"
import { h, init } from "snabbdom";
import klass from 'snabbdom/modules/class';
import attributes from 'snabbdom/modules/attributes';
import properties from 'snabbdom/modules/props';
import listeners from 'snabbdom/modules/eventlisteners';

const patch = init([klass, attributes, properties, listeners]);

function countString(fen) {
    const parts = fen.split(" ");
    if (parts[3] === "-") return "";
    const maxPlies = parseInt(parts[3]);
    const currentPlies = parseInt(parts[4]);
    return `${Math.floor(currentPlies/2) + 1}/${maxPlies/2}`;
}

export function updateCount(fen) {
    var container = document.getElementById('count') as HTMLElement;
    console.log(container);
    var count = countString(fen);
    patch(container, h('div.count#count',`${count}`));
}
