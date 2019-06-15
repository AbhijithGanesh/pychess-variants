import Sockette from 'sockette';

import { init } from 'snabbdom';
import { h } from 'snabbdom/h';
import klass from 'snabbdom/modules/class';
import attributes from 'snabbdom/modules/attributes';
import properties from 'snabbdom/modules/props';
import listeners from 'snabbdom/modules/eventlisteners';

import { key2pos, pos2key } from 'chessgroundx/util';
import { Chessground } from 'chessgroundx';
import { Api } from 'chessgroundx/api';
import { Color, Dests, PiecesDiff, Role, Key, Pos, Piece, dimensions } from 'chessgroundx/types';

import { Clock, renderTime } from './clock';
import makeGating from './gating';
import makePromotion from './promotion';
import { dropIsValid, pocketView, updatePockets } from './pocket';
import { sound, changeCSS } from './sound';
import { hasEp, needPockets, roleToSan, uci2usi, usi2uci, VARIANTS } from './chess';
import { renderUsername } from './user';
import { chatMessage, chatView } from './chat';
import { movelistView, updateMovelist } from './movelist';
import resizeHandle from './resize';
// import { ACCEPT, BACK} from './site';

const patch = init([klass, attributes, properties, listeners]);


export default class RoundController {
    model;
    sock;
    evtHandler;
    chessground: Api;
    fullfen: string;
    wplayer: string;
    bplayer: string;
    base: number;
    inc: number;
    mycolor: Color;
    oppcolor: Color;
    turnColor: Color;
    clocks: any;
    abortable: boolean;
    gameId: string;
    variant: string;
    pockets: any;
    vpocket0: any;
    vpocket1: any;
    gameControls: any;
    moveControls: any;
    gating: any;
    promotion: any;
    dests: Dests;
    lastmove: Key[];
    premove: any;
    predrop: any;
    result: string;
    flip: boolean;
    spectator: boolean;
    tv: string;
    steps;
    ply: number;

    constructor(el, model, handler) {

        const onOpen = (evt) => {
            console.log("ctrl.onOpen()", evt);
            this.doSend({ type: "game_user_connected", username: this.model["username"], gameId: this.model["gameId"] });
        };

        const opts = {
            maxAttempts: 10,
            onopen: e => onOpen(e),
            onmessage: e => this.onMessage(e),
            onreconnect: e => console.log('Reconnecting...', e),
            onmaximum: e => console.log('Stop Attempting!', e),
            onclose: e => console.log('Closed!', e),
            onerror: e => console.log('Error:', e),
            };

        try {
            this.sock = new Sockette("ws://" + location.host + "/ws", opts);
        }
        catch(err) {
            this.sock = new Sockette("wss://" + location.host + "/ws", opts);
        }

        this.model = model;
        this.evtHandler = handler;
        this.variant = model["variant"] as string;
        this.fullfen = model["fen"] as string;
        this.wplayer = model["wplayer"] as string;
        this.bplayer = model["bplayer"] as string;
        this.base = model["base"] as number;
        this.inc = model["inc"] as number;
        this.tv = model["tv"] as string;
        this.steps = [];
        this.ply = 0;

        this.flip = false;

        this.spectator = this.model["username"] !== this.wplayer && this.model["username"] !== this.bplayer;
        if (this.tv) {
            window.history.pushState({}, document.title, "/tv");
        } else {
            window.history.pushState({}, document.title, "/" + this.model["gameId"]);
        }

        // orientation = this.mycolor
        if (this.spectator) {
            this.mycolor = this.variant === 'shogi' ? 'black' : 'white';
            this.oppcolor = this.variant === 'shogi' ? 'white' : 'black';
        } else {
            this.mycolor = this.model["username"] === this.wplayer ? 'white' : 'black';
            this.oppcolor = this.model["username"] === this.wplayer ? 'black' : 'white';
        }

        this.premove = null;
        this.predrop = null;

        this.result = "";
        const parts = this.fullfen.split(" ");
        this.abortable = Number(parts[parts.length - 1]) <= 1;

        const fen_placement = parts[0];
        this.turnColor = parts[1] === "w" ? "white" : "black";

        if (this.variant === "shogi") {
            this.setPieceColors(this.mycolor);
        } else {
            changeCSS('/static/' + VARIANTS[this.variant].css + '.css', 1);
        };

        this.steps.push({
            'fen': fen_placement,
            'move': undefined,
            'check': false,
            'turnColor': this.turnColor,
            });

        this.chessground = Chessground(el, {
            fen: fen_placement,
            geometry: VARIANTS[this.variant].geom,
            orientation: this.mycolor,
            turnColor: this.turnColor,
            animation: {
                enabled: true,
            },
            events: {
                insert(elements) {resizeHandle(elements);}
            }
        });

        if (this.spectator) {
            this.chessground.set({
                viewOnly: true,
                events: {
                    move: this.onMove(),
                }
            });
        } else {
            this.chessground.set({
                movable: {
                    free: false,
                    color: this.mycolor,
                    showDests: true,
                    events: {
                        after: this.onUserMove,
                        afterNewPiece: this.onUserDrop,
                    }
                },
                premovable: {
                    enabled: true,
                    events: {
                        set: this.setPremove,
                        unset: this.unsetPremove,
                        }
                },
                predroppable: {
                    enabled: true,
                    events: {
                        set: this.setPredrop,
                        unset: this.unsetPredrop,
                        }
                },
                events: {
                    move: this.onMove(),
                    dropNewPiece: this.onDrop(),
                    change: this.onChange(this.chessground.state.selected),
                    select: this.onSelect(this.chessground.state.selected),
                }
            });
        };

        this.gating = makeGating(this);
        this.promotion = makePromotion(this);

        // initialize pockets
        if (needPockets(this.variant)) {
            const pocket0 = document.getElementById('pocket0') as HTMLElement;
            const pocket1 = document.getElementById('pocket1') as HTMLElement;
            updatePockets(this, pocket0, pocket1);
        }

        // initialize clocks
        const c0 = new Clock(this.base, this.inc, document.getElementById('clock0') as HTMLElement);
        const c1 = new Clock(this.base, this.inc, document.getElementById('clock1') as HTMLElement);
        this.clocks = [c0, c1];
        this.clocks[0].onTick(renderTime);
        this.clocks[1].onTick(renderTime);

        const flagCallback = () => {
            if (this.turnColor === this.mycolor && !this.spectator) {
                this.chessground.stop();
                console.log("Flag");
                this.doSend({ type: "flag", gameId: this.model["gameId"] });
            }
        }
        this.clocks[1].onFlag(flagCallback);

        // TODO: render game info data (players, timecontrol, variant) in upper left box
        // var container = document.getElementById('game-info') as HTMLElement;
        // patch(container, h('div.game-info', this.variant));

        // flip
        // TODO: players, clocks
        const toggleOrientation = () => {
            this.flip = !this.flip;
            this.chessground.toggleOrientation();
            if (this.variant === "shogi") {
                const color = this.chessground.state.orientation === "white" ? "white" : "black";
                this.setPieceColors(color);
            };
            console.log("FLIP");
            if (needPockets(this.variant)) {
                const tmp = this.pockets[0];
                this.pockets[0] = this.pockets[1];
                this.pockets[1] = tmp;
                this.vpocket0 = patch(this.vpocket0, pocketView(this, this.flip ? this.mycolor : this.oppcolor, "top"));
                this.vpocket1 = patch(this.vpocket1, pocketView(this, this.flip ? this.oppcolor : this.mycolor, "bottom"));
            }
        }

        // TODO: add dark/light theme buttons (icon-sun-o/icon-moon-o)
        // TODO: add western pieces theme button for xiangqui, shogi, makruk, sittuyin
        var container = document.getElementById('btn-flip') as HTMLElement;
        patch(container, h('button', { on: { click: () => toggleOrientation() }, props: {title: 'Flip board'} }, [h('i', {class: {"icon": true, "icon-refresh": true} } ), ]));

        var container = document.getElementById('zoom') as HTMLElement;
        patch(container, h('input', {
            attrs: { width: '280px', type: 'range', value: 100, min: 50, max: 150 },
            on: { input: (e) => { this.setZoom(parseFloat((e.target as HTMLInputElement).value)); } } })
        );

        //const onResize = () => {console.log("onResize()");}
        //var elmnt = document.getElementById('cgwrap') as HTMLElement;
        //elmnt.addEventListener("resize", onResize);

        const abort = () => {
            // TODO: disable when ply > 2
            console.log("Abort");
            this.doSend({ type: "abort", gameId: this.model["gameId"] });
        }

        const draw = () => {
            console.log("Draw");
            this.doSend({ type: "draw", gameId: this.model["gameId"] });
        }

        const resign = () => {
            console.log("Resign");
            this.doSend({ type: "resign", gameId: this.model["gameId"] });
        }

        var container = document.getElementById('game-controls') as HTMLElement;
        if (!this.spectator) {
            this.gameControls = patch(container, h('div.btn-controls', [
                h('button#abort', { on: { click: () => abort() }, props: {title: 'Abort'} }, [h('i', {class: {"icon": true, "icon-times": true} } ), ]),
                h('button#draw', { on: { click: () => draw() }, props: {title: "Draw"} }, [h('i', {class: {"icon": true, "icon-hand-paper-o": true} } ), ]),
                h('button#resign', { on: { click: () => resign() }, props: {title: "Resign"} }, [h('i', {class: {"icon": true, "icon-flag-o": true} } ), ]),
                ])
            );
        } else {
            this.gameControls = patch(container, h('div'));
        }

        patch(document.getElementById('movelist') as HTMLElement, movelistView(this));

        patch(document.getElementById('roundchat') as HTMLElement, chatView(this, "roundchat"));
    }

    getGround = () => this.chessground;
    getDests = () => this.dests;

    private setZoom = (zoom: number) => {
        const el = document.querySelector('.cg-wrap') as HTMLElement;
        if (el) {
            const baseWidth = dimensions[VARIANTS[this.variant].geom].width * (this.variant === "shogi" ? 52 : 64);
            const baseHeight = dimensions[VARIANTS[this.variant].geom].height * (this.variant === "shogi" ? 60 : 64);
            const pxw = `${zoom / 100 * baseWidth}px`;
            const pxh = `${zoom / 100 * baseHeight}px`;
            el.style.width = pxw;
            el.style.height = pxh;
            console.log("setZoom() HEIGHT=", pxh);
            document.body.setAttribute('style', '--cgwrapheight:' + pxh);
            const ev = document.createEvent('Event');
            ev.initEvent('chessground.resize', false, false);
            document.body.dispatchEvent(ev);
        }
    }

    private onMsgGameStart = (msg) => {
        // console.log("got gameStart msg:", msg);
        if (msg.gameId !== this.model["gameId"]) return;
        if (!this.spectator) sound.genericNotify();
    }

    private onMsgAcceptSeek = (msg) => {
        console.log("GameController.onMsgAcceptSeek()", this.model["gameId"])
        // this.evtHandler({ type: ACCEPT });
        window.location.assign(this.model["home"] + '/' + msg["gameId"]);
    }

    private rematch = () => {
        console.log("REMATCH");
        this.doSend({ type: "rematch", gameId: this.model["gameId"] });
        // window.location.assign(home);
    }

    private newOpponent = (home) => {
        // this.evtHandler({ type: BACK });
        window.location.assign(home);
    }

    private gameOver = () => {
        this.gameControls = patch(this.gameControls, h('div'));

        var container = document.getElementById('after-game') as HTMLElement;
        if (this.spectator) {
            patch(container, h('div.after-game', [h('result', this.result)]));
        } else {
            patch(container, h('div.after-game', [
                h('result', this.result),
                h('button.rematch', { on: { click: () => this.rematch() } }, "REMATCH"),
                h('button.newopp', { on: { click: () => this.newOpponent(this.model["home"]) } }, "NEW OPPONENT"),
            ]));
        }
    }

    private checkStatus = (msg) => {
        if (msg.gameId !== this.model["gameId"]) return;
        if (msg.status >= 0) {
            this.clocks[0].pause(false);
            this.clocks[1].pause(false);
            this.result = msg.result;
            switch (msg.result) {
                case "1/2":
                    sound.draw();
                    break;
                case "1-0":
                    if (!this.spectator) {
                        if (this.mycolor === "white") {
                            sound.victory();
                        } else {
                            sound.defeat();
                        }
                    }
                    break;
                case "0-1":
                    if (!this.spectator) {
                        if (this.mycolor === "black") {
                            sound.victory();
                        } else {
                            sound.defeat();
                        }
                    }
                    break;
                // ABORTED
                default:
                    break;
            }
            this.gameOver();
            if (this.tv) {
                // TODO: send msg to server instead and BACK with new model["gameId"] etc. got from answer
                setTimeout(() => {window.location.assign(this.model["home"] + '/tv');}, 1000);
            }
        }
    }

    // change shogi piece colors according to board orientation
    private setPieceColors = (color) => {
        if (color === "white") {
            changeCSS('/static/shogi0.css', 1);
        } else {
            changeCSS('/static/shogi1.css', 1);
        };
    }

    // In Capablanca we have to finelize castling because
    // chessground autoCastle works for standard chess only
    private castleRook = (kingDest, color) => {
        const diff: PiecesDiff = {};
        if (kingDest === "c") {
            diff[color === 'white' ? "a1" : "a8"] = undefined;
            diff[color === 'white' ? "d1" : "d8"] = {color: color, role: "rook"};
            this.chessground.setPieces(diff);
        };
        if (kingDest === "i") {
            diff[color === 'white' ? "j1" : "j8"] = undefined;
            diff[color === 'white' ? "h1" : "h8"] = {color: color, role: "rook"};
            this.chessground.setPieces(diff);
        };
    }

    private onMsgBoard = (msg) => {
        if (msg.gameId !== this.model["gameId"]) return;
        // Game aborted.
        if (msg["status"] === 0) return;

        // console.log("got board msg:", msg);
        this.ply = msg.ply
        this.fullfen = msg.fen;
        this.dests = msg.dests;
        const clocks = msg.clocks;

        const parts = msg.fen.split(" ");
        this.turnColor = parts[1] === "w" ? "white" : "black";

        if (msg.ply === this.steps.length) {
            const step = {
                'fen': msg.fen,
                'move': msg.lastMove[0] + msg.lastMove[1],
                'check': msg.check,
                'turnColor': this.turnColor,
                'san': msg.san,
                };
            this.steps.push(step);
            updateMovelist(this);
        }

        this.abortable = Number(parts[parts.length - 1]) <= 1;
        if (!this.spectator && !this.abortable && this.result === "") {
            var container = document.getElementById('abort') as HTMLElement;
            patch(container, h('button#abort', { props: {disabled: true} }));
        }

        var lastMove = msg.lastMove;
        if (lastMove !== null && this.variant === "shogi") {
            lastMove = usi2uci(lastMove[0] + lastMove[1]);
            lastMove = [lastMove.slice(0,2), lastMove.slice(2,4)];
        }
        // drop lastMove causing scrollbar flicker,
        // so we remove from part to avoid that
        if (lastMove !== null && lastMove[0][1] === '@') lastMove = [lastMove[1]];
        // save capture state before updating chessground
        const capture = lastMove !== null && this.chessground.state.pieces[lastMove[1]]

        if (lastMove !== null && (this.turnColor === this.mycolor || this.spectator)) {
            if (capture) {
                sound.capture();
            } else {
                sound.move();
            }
        } else {
            lastMove = [];
        }
        this.checkStatus(msg);
        if (msg.check) {
            sound.check();
        }

        const oppclock = !this.flip ? 0 : 1;
        const myclock = 1 - oppclock;

        if (this.spectator) {
            this.chessground.set({
                fen: parts[0],
                turnColor: this.turnColor,
                check: msg.check,
                lastMove: lastMove,
            });
            updatePockets(this, this.vpocket0, this.vpocket1);
            this.clocks[0].pause(false);
            this.clocks[1].pause(false);
            this.clocks[oppclock].setTime(clocks[this.oppcolor]);
            this.clocks[myclock].setTime(clocks[this.mycolor]);
            if (!this.abortable && msg.status < 0) {
                if (this.turnColor === this.mycolor) {
                    this.clocks[myclock].start();
                } else {
                    this.clocks[oppclock].start();
                }
            }
        } else {
            if (this.turnColor === this.mycolor) {
                this.chessground.set({
                    fen: parts[0],
                    turnColor: this.turnColor,
                    movable: {
                        free: false,
                        color: this.mycolor,
                        dests: msg.dests,
                    },
                    check: msg.check,
                    lastMove: lastMove,
                });
                updatePockets(this, this.vpocket0, this.vpocket1);
                this.clocks[oppclock].pause(false);
                this.clocks[oppclock].setTime(clocks[this.oppcolor]);
                if (!this.abortable && msg.status < 0) {
                    this.clocks[myclock].start(clocks[this.mycolor]);
                    console.log('MY CLOCK STARTED');
                }
                // console.log("trying to play premove....");
                if (this.premove) this.performPremove();
                if (this.predrop) this.performPredrop();
            } else {
                this.chessground.set({
                    turnColor: this.turnColor,
                    premovable: {
                        dests: msg.dests,
                    },
                    check: msg.check,
                });
                this.clocks[myclock].pause(false);
                this.clocks[myclock].setTime(clocks[this.mycolor]);
                if (!this.abortable && msg.status < 0) {
                    this.clocks[oppclock].start(clocks[this.oppcolor]);
                    console.log('OPP CLOCK  STARTED');
                }
            };
        };
    }

    goPly = (ply) => {
        const step = this.steps[ply];
        // TODO: update pockets !!!
        this.chessground.set({
            fen: step.fen,
            turnColor: step.turnColor,
            movable: {
                free: false,
                color: this.spectator ? undefined : step.turnColor,
                dests: this.result === "" && ply === this.steps.length - 1 ? this.dests : undefined,
                },
            check: step.check,
            lastMove: step.move === undefined ? undefined : [step.move.slice(0, 2), step.move.slice(2, 4)],
        });
        // TODO: play sound if ply == this.ply + 1
        this.ply = ply
    }

    private doSend = (message) => {
        console.log("---> doSend():", message);
        this.sock.send(JSON.stringify(message));
    }

    private sendMove = (orig, dest, promo) => {
        // pause() will add increment!
        const oppclock = !this.flip ? 0 : 1
        const myclock = 1 - oppclock;
        const movetime = (this.clocks[myclock].running) ? Date.now() - this.clocks[myclock].startTime : 0;
        this.clocks[myclock].pause(true);
        // console.log("sendMove(orig, dest, prom)", orig, dest, promo);
        const uci_move = orig + dest + promo;
        const move = this.variant === "shogi" ? uci2usi(uci_move) : uci_move;
        // console.log("sendMove(move)", move);
        // TODO: if premoved, send 0 time
        let bclock, clocks;
        if (!this.flip) {
            bclock = this.mycolor === "black" ? 1 : 0;
        } else {
            bclock = this.mycolor === "black" ? 0 : 1;
        }
        const wclock = 1 - bclock
        clocks = {movetime: movetime, black: this.clocks[bclock].duration, white: this.clocks[wclock].duration};
        this.doSend({ type: "move", gameId: this.model["gameId"], move: move, clocks: clocks });
        if (!this.abortable) this.clocks[oppclock].start();
    }

    private onMove = () => {
        return (orig, dest, capturedPiece) => {
            console.log("   ground.onMove()", orig, dest, capturedPiece);
            if (capturedPiece) {
                sound.capture();
            } else {
                sound.move();
            }
        }
    }

    private onDrop = () => {
        return (piece, dest) => {
            // console.log("ground.onDrop()", piece, dest);
            if (dest != "a0" && piece.role) {
                sound.move();
            }
        }
    }

    private setPremove = (orig, dest, meta) => {
        this.premove = { orig, dest, meta };
        console.log("setPremove() to:", orig, dest, meta);
    }

    private unsetPremove = () => {
        this.premove = null;
    }

    private setPredrop = (role, key) => {
        this.predrop = { role, key };
        console.log("setPredrop() to:", role, key);
    }

    private unsetPredrop = () => {
        this.predrop = null;
    }

    private performPremove = () => {
        const { orig, dest, meta } = this.premove;
        // TODO: promotion?
        console.log("performPremove()", orig, dest, meta);
        this.chessground.playPremove();
        this.premove = null;
    }

    private performPredrop = () => {
        const { role, key } = this.predrop;
        console.log("performPredrop()", role, key);
        this.chessground.playPredrop(drop => { return dropIsValid(this.dests, drop.role, drop.key); });
        this.predrop = null;
    }

    private onUserMove = (orig, dest, meta) => {
        // chessground doesn't knows about ep, so we have to remove ep captured pawn
        const pieces = this.chessground.state.pieces;
        const geom = this.chessground.state.geometry;
        console.log("ground.onUserMove()", orig, dest, meta, pieces);
        const moved = pieces[dest] as Piece;
        const firstRankIs0 = this.chessground.state.dimensions.height === 10;
        if (meta.captured === undefined && moved.role === "pawn" && orig[0] != dest[0] && hasEp(this.variant)) {
            const pos = key2pos(dest, firstRankIs0),
            pawnPos: Pos = [pos[0], pos[1] + (this.mycolor === 'white' ? -1 : 1)];
            const diff: PiecesDiff = {};
            diff[pos2key(pawnPos, geom)] = undefined;
            this.chessground.setPieces(diff);
            meta.captured = {role: "pawn"};
        };
        // increase pocket count
        if ((this.variant === "crazyhouse" || this.variant === "shogi") && meta.captured) {
            var role = meta.captured.role
            if (meta.captured.promoted) role = this.variant === "shogi" ? meta.captured.role.slice(1) as Role : "pawn";

            if (this.flip) {
                this.pockets[0][role]++;
                this.vpocket0 = patch(this.vpocket0, pocketView(this, this.mycolor, "top"));
            } else {
                this.pockets[1][role]++;
                this.vpocket1 = patch(this.vpocket1, pocketView(this, this.mycolor, "bottom"));
            }
        };
        // chessground autoCastle works for standard chess only
        if (this.variant === "capablanca" && moved.role === "king" && orig[0] === "f") this.castleRook(dest[0], this.mycolor);

        //  gating elephant/hawk
        if (this.variant === "seirawan") {
            if (!this.promotion.start(orig, dest, meta) && !this.gating.start(this.fullfen, orig, dest, meta)) this.sendMove(orig, dest, '');
        } else {
            if (!this.promotion.start(orig, dest, meta)) this.sendMove(orig, dest, '');
        };
    }

    private onUserDrop = (role, dest) => {
        // console.log("ground.onUserDrop()", role, dest);
        // decrease pocket count
        if (dropIsValid(this.dests, role, dest)) {
            if (this.flip) {
                this.pockets[0][role]--;
                this.vpocket0 = patch(this.vpocket0, pocketView(this, this.mycolor, "top"));
            } else {
                this.pockets[1][role]--;
                this.vpocket1 = patch(this.vpocket1, pocketView(this, this.mycolor, "bottom"));
            }
            this.sendMove(roleToSan[role] + "@", dest, '')
            // console.log("sent move", move);
        } else {
            const diff: PiecesDiff = {};
            diff[dest] = undefined;
            this.chessground.setPieces(diff);
            console.log("!!! invalid move !!!", role, dest);
            // restore lastMove set by invalid drop
            this.chessground.set({
                lastMove: this.lastmove,
                turnColor: this.mycolor,
                movable: {
                    dests: this.dests,
                    showDests: true,
                    },
                }
            );
        }
    }

    // use this for sittuyin in place promotion ?
    // Or implement ondblclick handler to emit move in chessground?
    // https://www.w3schools.com/jsref/event_ondblclick.asp
    private onChange = (selected) => {
        return () => {
            console.log("   ground.onChange()", selected);
        }
    }

    // use this for sittuyin in place promotion ?
    private onSelect = (selected) => {
        return (key) => {
            console.log("   ground.onSelect()", key, selected);
            // If drop selection was set dropDests we have to restore dests here
            if (this.chessground.state.movable.dests! === undefined) return;
            if (key != "a0" && "a0" in this.chessground.state.movable.dests!) {
                this.chessground.set({ movable: { dests: this.dests }});
            };
        }
    }

    private onMsgUserConnected = (msg) => {
        this.model["username"] = msg["username"];
        renderUsername(this.model["home"], this.model["username"]);
        if (this.spectator) {
            // we want to know lastMove and check status
            this.doSend({ type: "board", gameId: this.model["gameId"] });
        } else {
            this.doSend({ type: "ready", gameId: this.model["gameId"] });
            this.doSend({ type: "board", gameId: this.model["gameId"] });
        }
    }

    private onMsgChat = (msg) => {
        chatMessage(msg.user, msg.message, "roundchat");
    }

    private onMsgOffer = (msg) => {
        chatMessage("", msg.message, "roundchat");
    }


    private onMessage = (evt) => {
        console.log("<+++ onMessage():", evt.data);
        var msg = JSON.parse(evt.data);
        switch (msg.type) {
            case "board":
                this.onMsgBoard(msg);
                break;
            case "gameEnd":
                this.checkStatus(msg);
                break;
            case "gameStart":
                this.onMsgGameStart(msg);
                break;
            case "game_user_connected":
                this.onMsgUserConnected(msg);
                break;
            case "roundchat":
                this.onMsgChat(msg);
                break;
            case "accept_seek":
                this.onMsgAcceptSeek(msg);
                break;
            case "offer":
                this.onMsgOffer(msg);
                break;
        }
    }
}
