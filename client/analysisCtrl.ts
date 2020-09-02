import Module from '../static/ffish.js';
import Sockette from 'sockette';

import { init } from 'snabbdom';
import { h } from 'snabbdom/h';
import klass from 'snabbdom/modules/class';
import attributes from 'snabbdom/modules/attributes';
import properties from 'snabbdom/modules/props';
import listeners from 'snabbdom/modules/eventlisteners';

import { Chessground } from 'chessgroundx';
import { Api } from 'chessgroundx/api';
import { key2pos, pos2key } from 'chessgroundx/util';
import { Color, Dests, PiecesDiff, Role, Key, Pos, Piece, Variant, Notation } from 'chessgroundx/types';
import { DrawShape } from 'chessgroundx/draw';

import { _ } from './i18n';
import { Gating } from './gating';
import { Promotion } from './promotion';
import { dropIsValid, pocketView, updatePockets } from './pocket';
import { sound } from './sound';
import { roleToSan, grand2zero, zero2grand, VARIANTS, getPockets, isVariantClass, sanToRole } from './chess';
import { crosstableView } from './crosstable';
import { chatMessage, chatView } from './chat';
import { movelistView, updateMovelist, selectMove, povChances } from './movelist';
import resizeHandle from './resize';
//import { result } from './profile';
import { copyTextToClipboard } from './clipboard';
import { analysisChart } from './chart';
import { copyBoardToPNG } from './png'; 
import { updateCount, updatePoint } from './info';
import { boardSettings } from './boardSettings';

const patch = init([klass, attributes, properties, listeners]);

const EVAL_REGEX = new RegExp(''
  + /^info depth (\d+) seldepth \d+ multipv (\d+) /.source
  + /score (cp|mate) ([-\d]+) /.source
  + /(?:(upper|lower)bound )?nodes (\d+) nps \S+ /.source
  + /(?:hashfull \d+ )?(?:tbhits \d+ )?time (\S+) /.source
  + /pv (.+)/.source);


function download(filename, text) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}


export default class AnalysisController {
    model;
    sock;
    chessground: Api;
    fullfen: string;
    wplayer: string;
    bplayer: string;
    base: number;
    inc: number;
    mycolor: Color;
    oppcolor: Color;
    turnColor: Color;
    gameId: string;
    variant: string;
    hasPockets: boolean;
    pockets: any;
    vpocket0: any;
    vpocket1: any;
    vplayer0: any;
    vplayer1: any;
    vfen: any;
    vscore: any;
    vinfo: any;
    vpv: any;
    gameControls: any;
    moveControls: any;
    gating: any;
    promotion: any;
    dests: Dests;
    promotions: string[];
    lastmove: Key[];
    premove: any;
    predrop: any;
    preaction: boolean;
    result: string;
    flip: boolean;
    spectator: boolean;
    settings: boolean;
    status: number;
    steps;
    pgn: string;
    uci_usi: string;
    ply: number;
    players: string[];
    titles: string[];
    ratings: string[];
    clickDrop: Piece | undefined;
    clickDropEnabled: boolean;
    showDests: boolean;
    analysisChart: any;
    ctableContainer: any;
    localEngine: boolean;
    localAnalysis: boolean;
    ffish: any;
    ffishBoard: any;

    constructor(el, model) {
        const onOpen = (evt) => {
            console.log("ctrl.onOpen()", evt);
            this.doSend({ type: "game_user_connected", username: this.model["username"], gameId: this.model["gameId"] });
        };

        const opts = {
            maxAttempts: 10,
            onopen: e => onOpen(e),
            onmessage: e => this.onMessage(e),
            onreconnect: e => console.log('Reconnecting in round...', e),
            onmaximum: e => console.log('Stop Attempting!', e),
            onclose: e => console.log('Closed!', e),
            onerror: e => console.log('Error:', e),
            };

        const ws = (location.host.indexOf('pychess') === -1) ? 'ws://' : 'wss://';
        this.sock = new Sockette(ws + location.host + "/wsr", opts);

        this.localEngine = false;
        this.localAnalysis = false;
        this.ffish = null;
        this.ffishBoard = null;

        this.model = model;
        this.gameId = model["gameId"] as string;
        this.variant = model["variant"] as string;
        this.fullfen = model["fen"] as string;
        this.wplayer = model["wplayer"] as string;
        this.bplayer = model["bplayer"] as string;
        this.base = model["base"] as number;
        this.inc = model["inc"] as number;
        this.status = model["status"] as number;
        this.steps = [];
        this.pgn = "";
        this.ply = 0;

        this.flip = false;
        this.settings = true;
        this.clickDropEnabled = true;
        this.showDests = localStorage.showDests === undefined ? true : localStorage.showDests === "true";

        this.spectator = this.model["username"] !== this.wplayer && this.model["username"] !== this.bplayer;
        this.hasPockets = isVariantClass(this.variant, 'pocket');

        // orientation = this.mycolor
        if (this.spectator) {
            this.mycolor = 'white';
            this.oppcolor = 'black';
        } else {
            this.mycolor = this.model["username"] === this.wplayer ? 'white' : 'black';
            this.oppcolor = this.model["username"] === this.wplayer ? 'black' : 'white';
        }

        // players[0] is top player, players[1] is bottom player
        this.players = [
            this.mycolor === "white" ? this.bplayer : this.wplayer,
            this.mycolor === "white" ? this.wplayer : this.bplayer
        ];
        this.titles = [
            this.mycolor === "white" ? this.model['btitle'] : this.model['wtitle'],
            this.mycolor === "white" ? this.model['wtitle'] : this.model['btitle']
        ];
        this.ratings = [
            this.mycolor === "white" ? this.model['brating'] : this.model['wrating'],
            this.mycolor === "white" ? this.model['wrating'] : this.model['brating']
        ];

        this.result = "";
        const parts = this.fullfen.split(" ");

        const fen_placement = parts[0];
        this.turnColor = parts[1] === "w" ? "white" : "black";

        this.steps.push({
            'fen': this.fullfen,
            'move': undefined,
            'check': false,
            'turnColor': this.turnColor,
            });

        this.chessground = Chessground(el, {
            fen: fen_placement,
            variant: this.variant as Variant,
            geometry: VARIANTS[this.variant].geometry,
            notation: (this.variant === 'janggi') ? Notation.JANGGI : Notation.DEFAULT,
            orientation: this.mycolor,
            turnColor: this.turnColor,
            animation: {
                enabled: true,
            },
            events: {
                insert(elements) {resizeHandle(elements);}
            }
        });

        this.chessground.set({
            movable: {
                free: false,
                color: this.mycolor,
                showDests: this.showDests,
                events: {
                    after: this.onUserMove,
                    afterNewPiece: this.onUserDrop,
                }
            },
            events: {
                move: this.onMove(),
                dropNewPiece: this.onDrop(),
                select: this.onSelect(),
            }
        });

        this.gating = new Gating(this);
        this.promotion = new Promotion(this);

        // initialize pockets
        if (this.hasPockets) {
            const pocket0 = document.getElementById('pocket0') as HTMLElement;
            const pocket1 = document.getElementById('pocket1') as HTMLElement;
            updatePockets(this, pocket0, pocket1);
        }

        this.ctableContainer = document.getElementById('ctable-container') as HTMLElement;

        const element = document.getElementById('chart') as HTMLElement;
        element.style.display = 'none';

        patch(document.getElementById('movelist') as HTMLElement, movelistView(this));

        patch(document.getElementById('roundchat') as HTMLElement, chatView(this, "roundchat"));

        patch(document.getElementById('ceval') as HTMLElement, h('div#ceval', this.renderCeval()));

        this.vscore = document.getElementById('score') as HTMLElement;
        this.vinfo = document.getElementById('info') as HTMLElement;
        this.vpv = document.getElementById('pv') as HTMLElement;

        if (isVariantClass(this.variant, 'showMaterialPoint')) {
            const miscW = document.getElementById('misc-infow') as HTMLElement;
            const miscB = document.getElementById('misc-infob') as HTMLElement;
            miscW.style.textAlign = 'right';
            miscB.style.textAlign = 'left';
            miscW.style.width = '100px';
            miscB.style.width = '100px';
            patch(document.getElementById('misc-info-center') as HTMLElement, h('div#misc-info-center', '-'));
            (document.getElementById('misc-info') as HTMLElement).style.justifyContent = 'space-around';
        }

        if (isVariantClass(this.variant, 'showCount')) {
            (document.getElementById('misc-infow') as HTMLElement).style.textAlign = 'center';
            (document.getElementById('misc-infob') as HTMLElement).style.textAlign = 'center';
        }


        boardSettings.ctrl = this;
        const boardFamily = VARIANTS[this.variant].board;
        const pieceFamily = VARIANTS[this.variant].piece;
        boardSettings.updateBoardStyle(boardFamily);
        boardSettings.updatePieceStyle(pieceFamily);
        boardSettings.updateZoom(boardFamily);


        new (Module as any)().then(loadedModule => {
            this.ffish = loadedModule;

            if (this.ffish !== null) {
                this.ffishBoard = new this.ffish.Board(this.variant, this.fullfen, this.model.chess960 === 'True');
                this.dests = this.getDests();
            }
        });

    }

    getGround = () => this.chessground;

    private pass = () => {
        let passKey = 'z0';
        const pieces = this.chessground.state.pieces;
        const dests = this.chessground.state.movable.dests;
        for (let key in pieces) {
            if (pieces[key]!.role === 'king' && pieces[key]!.color === this.turnColor) {
                if ((key in dests!) && (dests![key].indexOf(key as Key) >= 0)) passKey = key;
            }
        }
        if (passKey !== 'z0') {
            // prevent calling pass() again by selectSquare() -> onSelect()
            this.chessground.state.movable.dests = undefined;
            this.chessground.selectSquare(passKey as Key);
            sound.move();
            this.sendMove(passKey, passKey, '');
        }
    }

    private renderCeval = () => {
        return [
            h('div.engine', [
                h('score#score', ''),
                h('div.info', ['Fairy-Stockfish 11+', h('br'), h('info#info', 'in local browser')]),
                h('label.switch', [
                    h('input#input', {
                        props: {
                            name: "engine",
                            type: "checkbox",
                        },
                        attrs: {
                            disabled: !this.localEngine,
                        },
                        on: {change: () => {
                            this.localAnalysis = !this.localAnalysis;
                            if (this.localAnalysis) {
                                this.engineGo();
                            } else {
                                window.fsf.postMessage('stop');
                            }
                        }}
                    }),
                    h('span.sw-slider'),
                ]),
            ]),
        ];
    }

    private drawAnalysisChart = (withRequest: boolean) => {
        if (withRequest) {
            if (this.model["anon"] === 'True') {
                alert(_('You need an account to do that.'));
                return;
            }
            const element = document.getElementById('request-analysis') as HTMLElement;
            if (element !== null) element.style.display = 'none';

            this.doSend({ type: "analysis", username: this.model["username"], gameId: this.gameId });
            const loaderEl = document.getElementById('loader') as HTMLElement;
            loaderEl.style.display = 'block';
        }
        const chartEl = document.getElementById('chart') as HTMLElement;
        chartEl.style.display = 'block';
        analysisChart(this);
    }

    private checkStatus = (msg) => {
        if (msg.gameId !== this.gameId) return;
        if (msg.status >= 0 && this.result === "") {
            this.result = msg.result;
            this.status = msg.status;

            this.pgn = msg.pgn;
            this.uci_usi = msg.uci_usi;

            let container = document.getElementById('copyfen') as HTMLElement;
            const buttons = [
                h('a.i-pgn', { on: { click: () => download("pychess-variants_" + this.gameId, this.pgn) } }, [
                    h('i', {props: {title: _('Download game to PGN file')}, class: {"icon": true, "icon-download": true} }, _(' Download PGN'))]),
                h('a.i-pgn', { on: { click: () => copyTextToClipboard(this.uci_usi) } }, [
                    h('i', {props: {title: _('Copy USI/UCI to clipboard')}, class: {"icon": true, "icon-clipboard": true} }, _(' Copy UCI/USI'))]),
                h('a.i-pgn', { on: { click: () => copyBoardToPNG(this.fullfen) } }, [
                    h('i', {props: {title: _('Download position to PNG image file')}, class: {"icon": true, "icon-download": true} }, _(' PNG image'))]),
                ]
            if (this.steps[0].analysis === undefined) {
                buttons.push(h('button#request-analysis', { on: { click: () => this.drawAnalysisChart(true) } }, [
                    h('i', {props: {title: _('Request Computer Analysis')}, class: {"icon": true, "icon-bar-chart": true} }, _(' Request Analysis'))])
                );
            }
            patch(container, h('div', buttons));

            container = document.getElementById('fen') as HTMLElement;
            this.vfen = patch(container, h('div#fen', this.fullfen));

            container = document.getElementById('pgntext') as HTMLElement;
            patch(container, h('textarea', { attrs: { rows: 13, readonly: true, spellcheck: false} }, msg.pgn));

            selectMove(this, this.ply);
        }
    }

    private onMsgBoard = (msg) => {
        if (msg.gameId !== this.gameId) return;

        const pocketsChanged = this.hasPockets && (getPockets(this.fullfen) !== getPockets(msg.fen));

        // console.log("got board msg:", msg);
        this.ply = msg.ply
        this.fullfen = msg.fen;
        this.dests = msg.dests;
        // list of legal promotion moves
        this.promotions = msg.promo;

        const parts = msg.fen.split(" ");
        this.turnColor = parts[1] === "w" ? "white" : "black";

        if (msg.steps.length > 1) {
            this.steps = [];
            const container = document.getElementById('movelist') as HTMLElement;
            patch(container, h('div#movelist'));

            msg.steps.forEach((step, ply) => {
                if (step.analysis !== undefined) {
                    step['ceval'] = step.analysis;
                    const scoreStr = this.buildScoreStr(ply % 2 === 0 ? "w" : "b", step.analysis);
                    step['scoreStr'] = scoreStr;
                }
                this.steps.push(step);
                });
            updateMovelist(this, 1, this.steps.length);

            if (this.steps[0].analysis !== undefined) {
                this.drawAnalysisChart(false);
            };
        } else {
            if (msg.ply === this.steps.length) {
                const step = {
                    'fen': msg.fen,
                    'move': msg.lastMove,
                    'check': msg.check,
                    'turnColor': this.turnColor,
                    'san': msg.steps[0].san,
                    };
                this.steps.push(step);
                updateMovelist(this, this.steps.length - 1, this.steps.length);
            }
        }

        let lastMove = msg.lastMove;
        if (lastMove !== null) {
            if (isVariantClass(this.variant, 'tenRanks')) {
                lastMove = grand2zero(lastMove);
            }
            // drop lastMove causing scrollbar flicker,
            // so we remove from part to avoid that
            lastMove = lastMove.indexOf('@') > -1 ? [lastMove.slice(-2)] : [lastMove.slice(0, 2), lastMove.slice(2, 4)];
        }
        // save capture state before updating chessground
        // 960 king takes rook castling is not capture
        const step = this.steps[this.steps.length - 1];
        const capture = (lastMove !== null) && ((this.chessground.state.pieces[lastMove[1]] && step.san.slice(0, 2) !== 'O-') || (step.san.slice(1, 2) === 'x'));

        if (lastMove !== null && (this.turnColor === this.mycolor || this.spectator)) {
            if (isVariantClass(this.variant, 'shogiSound')) {
                sound.shogimove();
            } else {
                if (capture) {
                    sound.capture();
                } else {
                    sound.move();
                }
            }
        } else {
            lastMove = [];
        }
        this.checkStatus(msg);

        if (this.spectator) {
            this.chessground.set({
                fen: parts[0],
                turnColor: this.turnColor,
                check: msg.check,
                lastMove: lastMove,
            });
            if (pocketsChanged) updatePockets(this, this.vpocket0, this.vpocket1);
        };
        if (this.model["ply"]) {
            this.ply = parseInt(this.model["ply"])
            selectMove(this, this.ply);
        }
    }

    moveIndex = (ply) => {
      return Math.floor((ply - 1) / 2) + 1 + (ply % 2 === 1 ? '.' : '...');
    }

    onFSFline = (line) => {
        console.log(line);
        if (!this.localEngine) {
            if (this.model.variant === 'chess' || (line.includes('UCI_Variant') && line.includes(this.model.variant))) {
                this.localEngine = true;
                patch(document.getElementById('input') as HTMLElement, h('input#input', {attrs: {disabled: false}}));
            }
        }

        if (!this.localAnalysis) return;

        const matches = line.match(EVAL_REGEX);
        if (!matches) {
            if (line.includes('mate 0')) {
                const msg = {type: 'local-analysis', ply: this.ply, color: this.turnColor.slice(0, 1), ceval: {d: 0, s: {mate: 0}}};
                this.onMsgAnalysis(msg);
            }
            return;
        }

        const depth = parseInt(matches[1]),
            multiPv = parseInt(matches[2]),
            isMate = matches[3] === 'mate',
            povEv = parseInt(matches[4]),
            evalType = matches[5],
            nodes = parseInt(matches[6]),
            elapsedMs: number = parseInt(matches[7]),
            moves = matches[8];
        console.log("---", depth, multiPv, isMate, povEv, evalType, nodes, elapsedMs, moves);

        // Sometimes we get #0. Let's just skip it.
        if (isMate && !povEv) return;

        // For now, ignore most upperbound/lowerbound messages.
        // The exception is for multiPV, sometimes non-primary PVs
        // only have an upperbound.
        // See: https://github.com/ddugovic/Stockfish/issues/228
        if (evalType && multiPv === 1) return;

        let score;
        if (isMate) {
            score = {mate: povEv};
        } else {
            score = {cp: povEv};
        }
        const knps = nodes / elapsedMs;

        // TODO: this can be simplified with https://github.com/ianfab/Fairy-Stockfish/issues/177
        const ply = this.ply;
        let sanMoves = moves.split(' ');
        this.ffishBoard.setFen(this.fullfen);
        sanMoves.forEach((move, index) => {
            let prefix = '';
            if (index === 0 || (ply + index +1) % 2 === 1) prefix = this.moveIndex(ply + index + 1);
            sanMoves[index] = prefix + ' ' + this.ffishBoard.sanMove(move);
            this.ffishBoard.push(move);
        });
        this.ffishBoard.setFen(this.fullfen);
        sanMoves = sanMoves.join(' ');

        const msg = {type: 'local-analysis', ply: this.ply, color: this.turnColor.slice(0, 1), ceval: {d: depth, m: moves, p: sanMoves, s: score, k: knps}};
        this.onMsgAnalysis(msg);
    };

    // Updates PV, score, gauge and the best move arrow
    drawEval = (ceval, scoreStr, turnColor) => {
        let shapes0: DrawShape[] = [];
        this.chessground.setAutoShapes(shapes0);
        const arrow = localStorage.arrow === undefined ? "true" : localStorage.arrow;

        const gaugeEl = document.getElementById('gauge') as HTMLElement;
        if (gaugeEl) {
            const blackEl = gaugeEl.querySelector('div.black') as HTMLElement | undefined;
            if (blackEl && ceval !== undefined) {
                const score = ceval['s'];
                const color = (this.variant.endsWith('shogi')) ? turnColor === 'black' ? 'white' : 'black' : turnColor;
                if (score !== undefined) {
                    const ev = povChances(color, score);
                    blackEl.style.height = String(100 - (ev + 1) * 50) + '%';
                }
                else {
                    blackEl.style.height = '50%';
                }
            }
        }

        if (ceval?.p !== undefined) {
            let pv_move = ceval["m"].split(" ")[0];
            if (isVariantClass(this.variant, "tenRanks")) pv_move = grand2zero(pv_move);
            if (arrow === 'true') {
                const atPos = pv_move.indexOf('@');
                if (atPos > -1) {
                    const d = pv_move.slice(atPos + 1, atPos + 3);
                    let color = turnColor;
                    if (this.variant.endsWith("shogi"))
                        if (this.flip !== (this.mycolor === "black"))
                            color = (color === 'white') ? 'black' : 'white';
                    shapes0 = [{
                        orig: d,
                        brush: 'paleGreen',
                        piece: {
                            color: color,
                            role: sanToRole[pv_move.slice(0, atPos)]
                        }},
                        { orig: d, brush: 'paleGreen'}
                    ];
                } else {
                    const o = pv_move.slice(0, 2);
                    const d = pv_move.slice(2, 4);
                    shapes0 = [{ orig: o, dest: d, brush: 'paleGreen', piece: undefined },];
                }
            };
            this.vscore = patch(this.vscore, h('score#score', scoreStr));
            // TODO: add '/16' when local engine enabled only
            this.vinfo = patch(this.vinfo, h('info#info', _('Depth') + ' ' + String(ceval.d) + '/16' + ', ' + Math.round(ceval.k) + ' knodes/s'));
            this.vpv = patch(this.vpv, h('div#pv', [h('pvline', ceval.p !== undefined ? ceval.p : ceval.m)]));
            document.documentElement.style.setProperty('--pvheight', '37px');
        } else {
            this.vscore = patch(this.vscore, h('score#score', ''));
            this.vinfo = patch(this.vinfo, h('info#info', 'in local browser'));
            this.vpv = patch(this.vpv, h('div#pv'));
            document.documentElement.style.setProperty('--pvheight', '0px'); 
        }

        // console.log(shapes0);
        this.chessground.set({
            drawable: {autoShapes: shapes0},
        });
    }

    // Updates chart and score in movelist
    drawServerEval = (ply, scoreStr) => {
        if (ply > 0) {
            const evalEl = document.getElementById('ply' + String(ply)) as HTMLElement;
            patch(evalEl, h('eval#ply' + String(ply), scoreStr));
        }

        analysisChart(this);
        const hc = this.analysisChart;
        if (hc !== undefined) {
            const hcPt = hc.series[0].data[ply];
            if (hcPt !== undefined) hcPt.select();
        }
    }

    engineGo = () => {
        window.fsf.postMessage('stop');
        if (this.model.chess960 === 'True') {
            window.fsf.postMessage('setoption name UCI_Chess960 value true');
        }
        if (this.model.variant !== 'chess') {
            window.fsf.postMessage('setoption name UCI_Variant value ' + this.model.variant);
        }
        console.log('position fen ', this.fullfen);
        window.fsf.postMessage('position fen ' + this.fullfen);
        window.fsf.postMessage('go movetime 90000 depth 16');
    }

    getDests = () => {
        const legalMoves = this.ffishBoard.legalMoves().split(" ");
        // console.log(legalMoves);
        const bigBoard = isVariantClass(this.variant, 'tenRanks');
        const dests: Dests = {};
        legalMoves.forEach((move) => {
            if (bigBoard) move = grand2zero(move);
            const source = move.slice(0, 2);
            const dest = move.slice(2, 4);
            if (source in dests) {
                dests[source].push(dest);
            } else {
                dests[source] = [dest];
            }

            this.promotions = [];
            const tail = move.slice(-1);
            if (tail > '9') {
                if (!(this.variant in ["seirawan", "shouse"]) && (move.slice(1, 2) === '1' || move.slice(1, 2) === '8')) {
                    this.promotions.push(move);
                }
            }
            if (this.variant === "kyotoshogi" && move.slice(0, 1) === "+") {
                this.promotions.push(move);
            }
        });

        this.chessground.set({ movable: { dests: dests }});
        return dests;
    }

    goPly = (ply) => {
        const step = this.steps[ply];

        let move = step.move;
        let capture = false;
        if (move !== undefined) {
            if (isVariantClass(this.variant, 'tenRanks')) move = grand2zero(move);
            move = move.indexOf('@') > -1 ? [move.slice(-2)] : [move.slice(0, 2), move.slice(2, 4)];
            // 960 king takes rook castling is not capture
            capture = (this.chessground.state.pieces[move[move.length - 1]] !== undefined && step.san.slice(0, 2) !== 'O-') || (step.san.slice(1, 2) === 'x');
        }

        this.chessground.set({
            fen: step.fen,
            turnColor: step.turnColor,
            movable: {
                color: step.turnColor,
                dests: this.dests,
                },
            check: step.check,
            lastMove: move,
        });

        this.drawEval(step.ceval, step.scoreStr, step.turnColor);
        this.drawServerEval(ply, step.scoreStr);

        this.fullfen = step.fen;

        updatePockets(this, this.vpocket0, this.vpocket1);

        if (isVariantClass(this.variant, 'showCount')) {
            updateCount(step.fen, document.getElementById('misc-infow') as HTMLElement, document.getElementById('misc-infob') as HTMLElement);
        }

        if (isVariantClass(this.variant, 'showMaterialPoint')) {
            updatePoint(step.fen, document.getElementById('misc-infow') as HTMLElement, document.getElementById('misc-infob') as HTMLElement);
        }

        if (ply === this.ply + 1) {
            if (isVariantClass(this.variant, 'shogiSound')) {
                sound.shogimove();
            } else {
                if (capture) {
                    sound.capture();
                } else {
                    sound.move();
                }
            }
        }

        this.ply = ply
        this.turnColor = step.turnColor;

        if (this.ffishBoard !== null) {
            this.ffishBoard.setFen(this.fullfen);
            this.dests = this.getDests();
        }

        // TODO
        // "+" button (Go deeper)
        // multi PV
        if (this.localAnalysis) this.engineGo();

        this.vfen = patch(this.vfen, h('div#fen', this.fullfen));
        window.history.replaceState({}, this.model['title'], this.model["home"] + '/' + this.gameId + '?ply=' + ply.toString());
    }

    private doSend = (message) => {
        // console.log("---> doSend():", message);
        this.sock.send(JSON.stringify(message));
    }

    private onMove = () => {
        return (orig, dest, capturedPiece) => {
            console.log("   ground.onMove()", orig, dest, capturedPiece);
            if (isVariantClass(this.variant, 'shogiSound')) {
                sound.shogimove();
            } else {
                if (capturedPiece) {
                    sound.capture();
                } else {
                    sound.move();
                }
            }
        }
    }

    private onDrop = () => {
        return (piece, dest) => {
            // console.log("ground.onDrop()", piece, dest);
            if (dest != 'z0' && piece.role && dropIsValid(this.dests, piece.role, dest)) {
                if (isVariantClass(this.variant, 'shogiSound')) {
                    sound.shogimove();
                } else {
                    sound.move();
                }
            } else if (this.clickDropEnabled) {
                this.clickDrop = piece;
            }
        }
    }

    private sendMove = (orig, dest, promo) => {
        const uci_move = orig + dest + promo;
        const move = (isVariantClass(this.variant, 'tenRanks')) ? zero2grand(uci_move) : uci_move;

        // Instead of sending moves to the server we can get new FEN and dests from ffishjs
        this.ffishBoard.push(move);
        this.dests = this.getDests();
        const msg = {
            gameId: this.gameId,
            fen: this.ffishBoard.fen(),
            ply: this.ffishBoard.gamePly(),
            lastMove: uci_move,
            dests: this.dests,
            promo: this.promotions,
            check: false, // TODO: add isCheck() to ffishjs (and isBikjang() also)
        }
        this.onMsgAnalysisBoard(msg);

        // TODO: But sending moves to the server will be useful to implement shared live analysis!
        // this.doSend({ type: "analysis_move", gameId: this.gameId, move: move, fen: this.fullfen, ply: this.ply + 1 });
    }

    private onMsgAnalysisBoard = (msg) => {
        // console.log("got analysis_board msg:", msg);
        if (msg.gameId !== this.gameId) return;

        const pocketsChanged = this.hasPockets && (getPockets(this.fullfen) !== getPockets(msg.fen));

        this.fullfen = msg.fen;
        this.dests = msg.dests;
        // list of legal promotion moves
        this.promotions = msg.promo;
        this.ply = msg.ply

        const parts = msg.fen.split(" ");
        this.turnColor = parts[1] === "w" ? "white" : "black";
        let lastMove = msg.lastMove;
        if (lastMove !== null) {
            if (isVariantClass(this.variant, 'tenRanks')) {
                lastMove = grand2zero(lastMove);
            }
            // drop lastMove causing scrollbar flicker,
            // so we remove from part to avoid that
            lastMove = lastMove.indexOf('@') > -1 ? [lastMove.slice(-2)] : [lastMove.slice(0, 2), lastMove.slice(2, 4)];
        }

        this.chessground.set({
            fen: this.fullfen,
            turnColor: this.turnColor,
            lastMove: lastMove,
            check: msg.check,
            movable: {
                color: this.turnColor,
                dests: this.dests,
            },
        });

        if (pocketsChanged) updatePockets(this, this.vpocket0, this.vpocket1);

        if (this.localAnalysis) this.engineGo();
    }

    private onUserMove = (orig, dest, meta) => {
        this.preaction = meta.premove === true;
        // chessground doesn't knows about ep, so we have to remove ep captured pawn
        const pieces = this.chessground.state.pieces;
        const geom = this.chessground.state.geometry;
        // console.log("ground.onUserMove()", orig, dest, meta);
        let moved = pieces[dest];
        // Fix king to rook 960 castling case
        if (moved === undefined) moved = {role: 'king', color: this.mycolor} as Piece;
        const firstRankIs0 = this.chessground.state.dimensions.height === 10;
        if (meta.captured === undefined && moved !== undefined && moved.role === "pawn" && orig[0] != dest[0] && isVariantClass(this.variant, 'enPassant')) {
            const pos = key2pos(dest, firstRankIs0),
            pawnPos: Pos = [pos[0], pos[1] + (this.mycolor === 'white' ? -1 : 1)];
            const diff: PiecesDiff = {};
            diff[pos2key(pawnPos, geom)] = undefined;
            this.chessground.setPieces(diff);
            meta.captured = {role: "pawn"};
        };
        // increase pocket count
        if (isVariantClass(this.variant, 'drop') && meta.captured) {
            let role = meta.captured.role
            if (meta.captured.promoted) role = (this.variant.endsWith('shogi')|| this.variant === 'shogun') ? meta.captured.role.slice(1) as Role : "pawn";

            let position = (this.turnColor === this.mycolor) ? "bottom": "top";
            if (this.flip) position = (position === "top") ? "bottom" : "top";
            if (position === "top") {
                this.pockets[0][role]++;
                this.vpocket0 = patch(this.vpocket0, pocketView(this, this.turnColor, "top"));
            } else {
                this.pockets[1][role]++;
                this.vpocket1 = patch(this.vpocket1, pocketView(this, this.turnColor, "bottom"));
            }
        };

        //  gating elephant/hawk
        if (isVariantClass(this.variant, 'gate')) {
            if (!this.promotion.start(moved.role, orig, dest) && !this.gating.start(this.fullfen, orig, dest)) this.sendMove(orig, dest, '');
        } else {
            if (!this.promotion.start(moved.role, orig, dest)) this.sendMove(orig, dest, '');
        this.preaction = false;
        };
    }

    private onUserDrop = (role, dest, meta) => {
        this.preaction = meta.predrop === true;
        // console.log("ground.onUserDrop()", role, dest, meta);
        // decrease pocket count
        if (dropIsValid(this.dests, role, dest)) {
            let position = (this.turnColor === this.mycolor) ? "bottom": "top";
            if (this.flip) position = (position === "top") ? "bottom" : "top";
            if (position === "top") {
                this.pockets[0][role]--;
                this.vpocket0 = patch(this.vpocket0, pocketView(this, this.turnColor, "top"));
            } else {
                this.pockets[1][role]--;
                this.vpocket1 = patch(this.vpocket1, pocketView(this, this.turnColor, "bottom"));
            }
            if (this.variant === "kyotoshogi") {
                if (!this.promotion.start(role, 'z0', dest, undefined)) this.sendMove(roleToSan[role] + "@", dest, '');
            } else {
                this.sendMove(roleToSan[role] + "@", dest, '')
            }
            // console.log("sent move", move);
        } else {
            // console.log("!!! invalid move !!!", role, dest);
            // restore board
            this.clickDrop = undefined;
            this.chessground.set({
                fen: this.fullfen,
                lastMove: this.lastmove,
                turnColor: this.mycolor,
                movable: {
                    dests: this.dests,
                    showDests: this.showDests,
                    },
                }
            );
        }
        this.preaction = false;
    }

    private onSelect = () => {
        return (key) => {
            console.log("ground.onSelect()", key, this.chessground.state);
            console.log("dests", this.chessground.state.movable.dests);
            // If drop selection was set dropDests we have to restore dests here
            if (this.chessground.state.movable.dests === undefined) return;
            if (key != 'z0' && 'z0' in this.chessground.state.movable.dests) {
                if (this.clickDropEnabled && this.clickDrop !== undefined && dropIsValid(this.dests, this.clickDrop.role, key)) {
                    this.chessground.newPiece(this.clickDrop, key);
                    this.onUserDrop(this.clickDrop.role, key, {predrop: this.predrop});
                }
                this.clickDrop = undefined;
                //cancelDropMode(this.chessground.state);
                this.chessground.set({ movable: { dests: this.dests }});
            };
            // Sittuyin in place promotion on Ctrl+click
            if (this.chessground.state.stats.ctrlKey && 
                (key in this.chessground.state.movable.dests) &&
                (this.chessground.state.movable.dests[key].indexOf(key) >= 0)
                ) {
                const piece = this.chessground.state.pieces[key];
                if (this.variant === 'sittuyin') {
                    // console.log("Ctrl in place promotion", key);
                    const pieces = {};
                    pieces[key] = {
                        color: piece!.color,
                        role: 'ferz',
                        promoted: true
                    };
                    this.chessground.setPieces(pieces);
                    this.sendMove(key, key, 'f');
                } else if (isVariantClass(this.variant, 'pass') && piece!.role === 'king') {
                    this.pass();
                }
            };
        }
    }

    private buildScoreStr = (color, analysis) => {
        const score = analysis['s'];
        let scoreStr = '';
        let ceval = '';
        if (score['mate'] !== undefined) {
            ceval = score['mate']
            const sign = ((color === 'b' && Number(ceval) > 0) || (color === 'w' && Number(ceval) < 0)) ? '-': '';
            scoreStr = '#' + sign + Math.abs(Number(ceval));
        } else {
            ceval = score['cp']
            let nscore = Number(ceval) / 100.0;
            if (color === 'b') nscore = -nscore;
            scoreStr = nscore.toFixed(1);
        }
        return scoreStr;
    }

    private onMsgAnalysis = (msg) => {
        // console.log(msg);
        if (msg['ceval']['s'] === undefined) return;

        const scoreStr = this.buildScoreStr(msg.color, msg.ceval);

        if (msg.type === 'analysis') {
            this.steps[msg.ply]['ceval'] = msg.ceval;
            this.steps[msg.ply]['scoreStr'] = scoreStr;

            if (this.steps.every((step) => {return step.scoreStr !== undefined;})) {
                const element = document.getElementById('loader-wrapper') as HTMLElement;
                element.style.display = 'none';
            }
        }
        const turnColor = msg.color === 'w' ? 'white' : 'black';
        this.drawEval(msg.ceval, scoreStr, turnColor);
    }

    // User running a fishnet worker asked new server side analysis with chat message: !analysis
    private onMsgRequestAnalysis = () => {
        this.steps.forEach((step) => {
            step.analysis = undefined;
            step.ceval = undefined;
            step.score = undefined;
        });
        this.drawAnalysisChart(true);
    }

    private onMsgUserConnected = (msg) => {
        this.model["username"] = msg["username"];
        // we want to know lastMove and check status
        this.doSend({ type: "board", gameId: this.gameId });
    }

    private onMsgSpectators = (msg) => {
        const container = document.getElementById('spectators') as HTMLElement;
        patch(container, h('under-left#spectators', _('Spectators: ') + msg.spectators));
    }

    private onMsgChat = (msg) => {
        if ((this.spectator && msg.room === 'spectator') || (!this.spectator && msg.room !== 'spectator') || msg.user.length === 0) {
            chatMessage(msg.user, msg.message, "roundchat");
        }
    }

    private onMsgFullChat = (msg) => {
        // To prevent multiplication of messages we have to remove old messages div first
        patch(document.getElementById('messages') as HTMLElement, h('div#messages-clear'));
        // then create a new one
        patch(document.getElementById('messages-clear') as HTMLElement, h('div#messages'));
        msg.lines.forEach((line) => {
            if ((this.spectator && line.room === 'spectator') || (!this.spectator && line.room !== 'spectator') || line.user.length === 0) {
                chatMessage(line.user, line.message, "roundchat");
            }
        });
    }

    private onMsgGameNotFound = (msg) => {
        alert(_("Requested game %1 not found!", msg['gameId']));
        window.location.assign(this.model["home"]);
    }

    private onMsgShutdown = (msg) => {
        alert(msg.message);
    }

    private onMsgCtable = (ct, gameId) => {
        if (ct !== "") {
            this.ctableContainer = patch(this.ctableContainer, h('div#ctable-container'));
            this.ctableContainer = patch(this.ctableContainer, crosstableView(ct, gameId));
        }
    }

    private onMessage = (evt) => {
        // console.log("<+++ onMessage():", evt.data);
        const msg = JSON.parse(evt.data);
        switch (msg.type) {
            case "board":
                this.onMsgBoard(msg);
                break;
            case "analysis_board":
                this.onMsgAnalysisBoard(msg);
                break
            case "crosstable":
                this.onMsgCtable(msg.ct, this.gameId);
                break
            case "analysis":
                this.onMsgAnalysis(msg);
                break;
            case "game_user_connected":
                this.onMsgUserConnected(msg);
                break;
            case "spectators":
                this.onMsgSpectators(msg);
                break
            case "roundchat":
                this.onMsgChat(msg);
                break;
            case "fullchat":
                this.onMsgFullChat(msg);
                break;
            case "game_not_found":
                this.onMsgGameNotFound(msg);
                break
            case "shutdown":
                this.onMsgShutdown(msg);
                break;
            case "logout":
                this.doSend({type: "logout"});
                break;
            case "request_analysis":
                this.onMsgRequestAnalysis()
                break;
        }
    }
}
