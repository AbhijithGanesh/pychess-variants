import { init } from "snabbdom";
import klass from 'snabbdom/modules/class';
import attributes from 'snabbdom/modules/attributes';
import properties from 'snabbdom/modules/props';
import listeners from 'snabbdom/modules/eventlisteners';

const patch = init([klass, attributes, properties, listeners]);

import h from 'snabbdom/h';

export function chatView (ctrl, chatType) {
    function onKeyPress (e) {
        const message = (e.target as HTMLInputElement).value
        if ((e.keyCode == 13 || e.which == 13) && message.length > 0) {
            ctrl.sock.send(JSON.stringify({"type": chatType, "message": message, "gameId": ctrl.model["gameId"] }));
            (e.target as HTMLInputElement).value = "";
        }
    }

    return h(`div.${chatType}#${chatType}`, { class: {"chat": true} }, [
                h(`ol#${chatType}-messages`, [ h("div#messages")]),
                h('input#chat-entry', {
                    props: {
                        type: "text",
                        name: "entry",
                        autocomplete: "off",
                        placeholder: "Please be nice in the chat!",
                        maxlength: "140",
                    },
                    on: { keypress: (e) => onKeyPress(e) },
                })
            ])
    }

export function chatMessage (user, message, chatType) {
    const myDiv = document.getElementById(chatType + '-messages') as HTMLElement;
    // You must add border widths, padding and margins to the right.
    const isScrolled = myDiv.scrollTop == myDiv.scrollHeight - myDiv.offsetHeight;

    var container = document.getElementById('messages') as HTMLElement;
    patch(container, h('div#messages', [ h("li.message", [h("user", user), h("t", message)]) ]));

    if (isScrolled) myDiv.scrollTop = myDiv.scrollHeight;
}