(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.PychessVariants = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("./util");
function anim(mutation, state) {
    return state.animation.enabled ? animate(mutation, state) : render(mutation, state);
}
exports.anim = anim;
function render(mutation, state) {
    const result = mutation(state);
    state.dom.redraw();
    return result;
}
exports.render = render;
function makePiece(key, piece, firstRankIs0) {
    return {
        key: key,
        pos: util.key2pos(key, firstRankIs0),
        piece: piece
    };
}
function closer(piece, pieces) {
    return pieces.sort((p1, p2) => {
        return util.distanceSq(piece.pos, p1.pos) - util.distanceSq(piece.pos, p2.pos);
    })[0];
}
function computePlan(prevPieces, current) {
    const firstRankIs0 = current.dimensions.height === 10;
    const anims = {}, animedOrigs = [], fadings = {}, missings = [], news = [], prePieces = {};
    let curP, preP, i, vector;
    for (i in prevPieces) {
        prePieces[i] = makePiece(i, prevPieces[i], firstRankIs0);
    }
    for (const key of util.allKeys[current.geometry]) {
        curP = current.pieces[key];
        preP = prePieces[key];
        if (curP) {
            if (preP) {
                if (!util.samePiece(curP, preP.piece)) {
                    missings.push(preP);
                    news.push(makePiece(key, curP, firstRankIs0));
                }
            }
            else
                news.push(makePiece(key, curP, firstRankIs0));
        }
        else if (preP)
            missings.push(preP);
    }
    news.forEach(newP => {
        preP = closer(newP, missings.filter(p => util.samePiece(newP.piece, p.piece)));
        if (preP) {
            vector = [preP.pos[0] - newP.pos[0], preP.pos[1] - newP.pos[1]];
            anims[newP.key] = vector.concat(vector);
            animedOrigs.push(preP.key);
        }
    });
    missings.forEach(p => {
        if (!util.containsX(animedOrigs, p.key))
            fadings[p.key] = p.piece;
    });
    return {
        anims: anims,
        fadings: fadings
    };
}
function step(state, now) {
    const cur = state.animation.current;
    if (cur === undefined) {
        if (!state.dom.destroyed)
            state.dom.redrawNow();
        return;
    }
    const rest = 1 - (now - cur.start) * cur.frequency;
    if (rest <= 0) {
        state.animation.current = undefined;
        state.dom.redrawNow();
    }
    else {
        const ease = easing(rest);
        for (let i in cur.plan.anims) {
            const cfg = cur.plan.anims[i];
            cfg[2] = cfg[0] * ease;
            cfg[3] = cfg[1] * ease;
        }
        state.dom.redrawNow(true);
        requestAnimationFrame((now = performance.now()) => step(state, now));
    }
}
function animate(mutation, state) {
    const prevPieces = Object.assign({}, state.pieces);
    const result = mutation(state);
    const plan = computePlan(prevPieces, state);
    if (!isObjectEmpty(plan.anims) || !isObjectEmpty(plan.fadings)) {
        const alreadyRunning = state.animation.current && state.animation.current.start;
        state.animation.current = {
            start: performance.now(),
            frequency: 1 / state.animation.duration,
            plan: plan
        };
        if (!alreadyRunning)
            step(state, performance.now());
    }
    else {
        state.dom.redraw();
    }
    return result;
}
function isObjectEmpty(o) {
    for (let _ in o)
        return false;
    return true;
}
function easing(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

},{"./util":17}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const board = require("./board");
const fen_1 = require("./fen");
const config_1 = require("./config");
const anim_1 = require("./anim");
const drag_1 = require("./drag");
const explosion_1 = require("./explosion");
function start(state, redrawAll) {
    function toggleOrientation() {
        board.toggleOrientation(state);
        redrawAll();
    }
    ;
    return {
        set(config) {
            if (config.orientation && config.orientation !== state.orientation)
                toggleOrientation();
            (config.fen ? anim_1.anim : anim_1.render)(state => config_1.configure(state, config), state);
        },
        state,
        getFen: () => fen_1.write(state.pieces, state.geometry),
        toggleOrientation,
        setPieces(pieces) {
            anim_1.anim(state => board.setPieces(state, pieces), state);
        },
        selectSquare(key, force) {
            if (key)
                anim_1.anim(state => board.selectSquare(state, key, force), state);
            else if (state.selected) {
                board.unselect(state);
                state.dom.redraw();
            }
        },
        move(orig, dest) {
            anim_1.anim(state => board.baseMove(state, orig, dest), state);
        },
        newPiece(piece, key) {
            anim_1.anim(state => board.baseNewPiece(state, piece, key), state);
        },
        playPremove() {
            if (state.premovable.current) {
                if (anim_1.anim(board.playPremove, state))
                    return true;
                state.dom.redraw();
            }
            return false;
        },
        playPredrop(validate) {
            if (state.predroppable.current) {
                const result = board.playPredrop(state, validate);
                state.dom.redraw();
                return result;
            }
            return false;
        },
        cancelPremove() {
            anim_1.render(board.unsetPremove, state);
        },
        cancelPredrop() {
            anim_1.render(board.unsetPredrop, state);
        },
        cancelMove() {
            anim_1.render(state => { board.cancelMove(state); drag_1.cancel(state); }, state);
        },
        stop() {
            anim_1.render(state => { board.stop(state); drag_1.cancel(state); }, state);
        },
        explode(keys) {
            explosion_1.default(state, keys);
        },
        setAutoShapes(shapes) {
            anim_1.render(state => state.drawable.autoShapes = shapes, state);
        },
        setShapes(shapes) {
            anim_1.render(state => state.drawable.shapes = shapes, state);
        },
        getKeyAtDomPos(pos) {
            return board.getKeyAtDomPos(pos, board.whitePov(state), state.dom.bounds(), state.geometry);
        },
        redrawAll,
        dragNewPiece(piece, event, force) {
            drag_1.dragNewPiece(state, piece, event, force);
        },
        destroy() {
            board.stop(state);
            state.dom.unbind && state.dom.unbind();
            state.dom.destroyed = true;
        }
    };
}
exports.start = start;

},{"./anim":1,"./board":3,"./config":5,"./drag":6,"./explosion":10,"./fen":11}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const premove_1 = require("./premove");
const cg = require("./types");
function callUserFunction(f, ...args) {
    if (f)
        setTimeout(() => f(...args), 1);
}
exports.callUserFunction = callUserFunction;
function toggleOrientation(state) {
    state.orientation = util_1.opposite(state.orientation);
    state.animation.current =
        state.draggable.current =
            state.selected = undefined;
}
exports.toggleOrientation = toggleOrientation;
function reset(state) {
    state.lastMove = undefined;
    unselect(state);
    unsetPremove(state);
    unsetPredrop(state);
}
exports.reset = reset;
function setPieces(state, pieces) {
    for (let key in pieces) {
        const piece = pieces[key];
        if (piece)
            state.pieces[key] = piece;
        else
            delete state.pieces[key];
    }
}
exports.setPieces = setPieces;
function setCheck(state, color) {
    state.check = undefined;
    if (color === true)
        color = state.turnColor;
    if (color)
        for (let k in state.pieces) {
            if (state.pieces[k].role === 'king' && state.pieces[k].color === color) {
                state.check = k;
            }
        }
}
exports.setCheck = setCheck;
function setPremove(state, orig, dest, meta) {
    unsetPredrop(state);
    state.premovable.current = [orig, dest];
    callUserFunction(state.premovable.events.set, orig, dest, meta);
}
function unsetPremove(state) {
    if (state.premovable.current) {
        state.premovable.current = undefined;
        callUserFunction(state.premovable.events.unset);
    }
}
exports.unsetPremove = unsetPremove;
function setPredrop(state, role, key) {
    unsetPremove(state);
    state.predroppable.current = { role, key };
    callUserFunction(state.predroppable.events.set, role, key);
}
function unsetPredrop(state) {
    const pd = state.predroppable;
    if (pd.current) {
        pd.current = undefined;
        callUserFunction(pd.events.unset);
    }
}
exports.unsetPredrop = unsetPredrop;
function tryAutoCastle(state, orig, dest) {
    if (!state.autoCastle)
        return false;
    const king = state.pieces[orig];
    if (!king || king.role !== 'king')
        return false;
    const firstRankIs0 = state.dimensions.height === 10;
    const origPos = util_1.key2pos(orig, firstRankIs0);
    if (origPos[0] !== 5)
        return false;
    if (origPos[1] !== 1 && origPos[1] !== 8)
        return false;
    const destPos = util_1.key2pos(dest, firstRankIs0);
    let oldRookPos, newRookPos, newKingPos;
    if (destPos[0] === 7 || destPos[0] === 8) {
        oldRookPos = util_1.pos2key([8, origPos[1]], state.geometry);
        newRookPos = util_1.pos2key([6, origPos[1]], state.geometry);
        newKingPos = util_1.pos2key([7, origPos[1]], state.geometry);
    }
    else if (destPos[0] === 3 || destPos[0] === 1) {
        oldRookPos = util_1.pos2key([1, origPos[1]], state.geometry);
        newRookPos = util_1.pos2key([4, origPos[1]], state.geometry);
        newKingPos = util_1.pos2key([3, origPos[1]], state.geometry);
    }
    else
        return false;
    const rook = state.pieces[oldRookPos];
    if (!rook || rook.role !== 'rook')
        return false;
    delete state.pieces[orig];
    delete state.pieces[oldRookPos];
    state.pieces[newKingPos] = king;
    state.pieces[newRookPos] = rook;
    return true;
}
function baseMove(state, orig, dest) {
    const origPiece = state.pieces[orig], destPiece = state.pieces[dest];
    if (orig === dest || !origPiece)
        return false;
    const captured = (destPiece && destPiece.color !== origPiece.color) ? destPiece : undefined;
    if (dest == state.selected)
        unselect(state);
    callUserFunction(state.events.move, orig, dest, captured);
    if (!tryAutoCastle(state, orig, dest)) {
        state.pieces[dest] = origPiece;
        delete state.pieces[orig];
    }
    state.lastMove = [orig, dest];
    state.check = undefined;
    callUserFunction(state.events.change);
    return captured || true;
}
exports.baseMove = baseMove;
function baseNewPiece(state, piece, key, force) {
    if (state.pieces[key]) {
        if (force)
            delete state.pieces[key];
        else
            return false;
    }
    callUserFunction(state.events.dropNewPiece, piece, key);
    state.pieces[key] = piece;
    state.lastMove = [key];
    state.check = undefined;
    callUserFunction(state.events.change);
    state.movable.dests = undefined;
    state.turnColor = util_1.opposite(state.turnColor);
    return true;
}
exports.baseNewPiece = baseNewPiece;
function baseUserMove(state, orig, dest) {
    const result = baseMove(state, orig, dest);
    if (result) {
        state.movable.dests = undefined;
        state.turnColor = util_1.opposite(state.turnColor);
        state.animation.current = undefined;
    }
    return result;
}
function userMove(state, orig, dest) {
    if (canMove(state, orig, dest)) {
        const result = baseUserMove(state, orig, dest);
        if (result) {
            const holdTime = state.hold.stop();
            unselect(state);
            const metadata = {
                premove: false,
                ctrlKey: state.stats.ctrlKey,
                holdTime
            };
            if (result !== true)
                metadata.captured = result;
            callUserFunction(state.movable.events.after, orig, dest, metadata);
            return true;
        }
    }
    else if (canPremove(state, orig, dest)) {
        setPremove(state, orig, dest, {
            ctrlKey: state.stats.ctrlKey
        });
        unselect(state);
        return true;
    }
    unselect(state);
    return false;
}
exports.userMove = userMove;
function dropNewPiece(state, orig, dest, force) {
    if (canDrop(state, orig, dest) || force) {
        const piece = state.pieces[orig];
        delete state.pieces[orig];
        baseNewPiece(state, piece, dest, force);
        callUserFunction(state.movable.events.afterNewPiece, piece.role, dest, {
            predrop: false
        });
    }
    else if (canPredrop(state, orig, dest)) {
        setPredrop(state, state.pieces[orig].role, dest);
    }
    else {
        unsetPremove(state);
        unsetPredrop(state);
    }
    delete state.pieces[orig];
    unselect(state);
}
exports.dropNewPiece = dropNewPiece;
function selectSquare(state, key, force) {
    callUserFunction(state.events.select, key);
    if (state.selected) {
        if (state.selected === key && !state.draggable.enabled) {
            unselect(state);
            state.hold.cancel();
            return;
        }
        else if ((state.selectable.enabled || force) && state.selected !== key) {
            if (userMove(state, state.selected, key)) {
                state.stats.dragged = false;
                return;
            }
        }
    }
    if (isMovable(state, key) || isPremovable(state, key)) {
        setSelected(state, key);
        state.hold.start();
    }
}
exports.selectSquare = selectSquare;
function setSelected(state, key) {
    state.selected = key;
    if (isPremovable(state, key)) {
        state.premovable.dests = premove_1.default(state.pieces, key, state.premovable.castle, state.geometry);
    }
    else
        state.premovable.dests = undefined;
}
exports.setSelected = setSelected;
function unselect(state) {
    state.selected = undefined;
    state.premovable.dests = undefined;
    state.hold.cancel();
}
exports.unselect = unselect;
function isMovable(state, orig) {
    const piece = state.pieces[orig];
    return !!piece && (state.movable.color === 'both' || (state.movable.color === piece.color &&
        state.turnColor === piece.color));
}
function canMove(state, orig, dest) {
    return orig !== dest && isMovable(state, orig) && (state.movable.free || (!!state.movable.dests && util_1.containsX(state.movable.dests[orig], dest)));
}
exports.canMove = canMove;
function canDrop(state, orig, dest) {
    const piece = state.pieces[orig];
    return !!piece && dest && (orig === dest || !state.pieces[dest]) && (state.movable.color === 'both' || (state.movable.color === piece.color &&
        state.turnColor === piece.color));
}
function isPremovable(state, orig) {
    const piece = state.pieces[orig];
    return !!piece && state.premovable.enabled &&
        state.movable.color === piece.color &&
        state.turnColor !== piece.color;
}
function canPremove(state, orig, dest) {
    return orig !== dest &&
        isPremovable(state, orig) &&
        util_1.containsX(premove_1.default(state.pieces, orig, state.premovable.castle, state.geometry), dest);
}
function canPredrop(state, orig, dest) {
    const piece = state.pieces[orig];
    const destPiece = state.pieces[dest];
    return !!piece && dest &&
        (!destPiece || destPiece.color !== state.movable.color) &&
        state.predroppable.enabled &&
        (piece.role !== 'pawn' || (dest[1] !== '1' && dest[1] !== '8')) &&
        state.movable.color === piece.color &&
        state.turnColor !== piece.color;
}
function isDraggable(state, orig) {
    const piece = state.pieces[orig];
    return !!piece && state.draggable.enabled && (state.movable.color === 'both' || (state.movable.color === piece.color && (state.turnColor === piece.color || state.premovable.enabled)));
}
exports.isDraggable = isDraggable;
function playPremove(state) {
    const move = state.premovable.current;
    if (!move)
        return false;
    const orig = move[0], dest = move[1];
    let success = false;
    if (canMove(state, orig, dest)) {
        const result = baseUserMove(state, orig, dest);
        if (result) {
            const metadata = { premove: true };
            if (result !== true)
                metadata.captured = result;
            callUserFunction(state.movable.events.after, orig, dest, metadata);
            success = true;
        }
    }
    unsetPremove(state);
    return success;
}
exports.playPremove = playPremove;
function playPredrop(state, validate) {
    let drop = state.predroppable.current, success = false;
    if (!drop)
        return false;
    if (validate(drop)) {
        const piece = {
            role: drop.role,
            color: state.movable.color
        };
        if (baseNewPiece(state, piece, drop.key)) {
            callUserFunction(state.movable.events.afterNewPiece, drop.role, drop.key, {
                predrop: true
            });
            success = true;
        }
    }
    unsetPredrop(state);
    return success;
}
exports.playPredrop = playPredrop;
function cancelMove(state) {
    unsetPremove(state);
    unsetPredrop(state);
    unselect(state);
}
exports.cancelMove = cancelMove;
function stop(state) {
    state.movable.color =
        state.movable.dests =
            state.animation.current = undefined;
    cancelMove(state);
}
exports.stop = stop;
function getKeyAtDomPos(pos, asWhite, bounds, geom) {
    const bd = cg.dimensions[geom];
    let file = Math.ceil(bd.width * ((pos[0] - bounds.left) / bounds.width));
    if (!asWhite)
        file = bd.width + 1 - file;
    let rank = Math.ceil(bd.height - (bd.height * ((pos[1] - bounds.top) / bounds.height)));
    if (!asWhite)
        rank = bd.height + 1 - rank;
    return (file > 0 && file < bd.width + 1 && rank > 0 && rank < bd.height + 1) ? util_1.pos2key([file, rank], geom) : undefined;
}
exports.getKeyAtDomPos = getKeyAtDomPos;
function whitePov(s) {
    return s.orientation === 'white';
}
exports.whitePov = whitePov;

},{"./premove":12,"./types":16,"./util":17}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("./api");
const config_1 = require("./config");
const state_1 = require("./state");
const wrap_1 = require("./wrap");
const events = require("./events");
const render_1 = require("./render");
const svg = require("./svg");
const util = require("./util");
function Chessground(element, config) {
    const state = state_1.defaults();
    config_1.configure(state, config || {});
    function redrawAll() {
        let prevUnbind = state.dom && state.dom.unbind;
        const relative = state.viewOnly && !state.drawable.visible, elements = wrap_1.default(element, state, relative), bounds = util.memo(() => elements.board.getBoundingClientRect()), redrawNow = (skipSvg) => {
            render_1.default(state);
            if (!skipSvg && elements.svg)
                svg.renderSvg(state, elements.svg);
        };
        state.dom = {
            elements,
            bounds,
            redraw: debounceRedraw(redrawNow),
            redrawNow,
            unbind: prevUnbind,
            relative
        };
        state.drawable.prevSvgHash = '';
        redrawNow(false);
        events.bindBoard(state);
        if (!prevUnbind)
            state.dom.unbind = events.bindDocument(state, redrawAll);
        state.events.insert && state.events.insert(elements);
    }
    redrawAll();
    return api_1.start(state, redrawAll);
}
exports.Chessground = Chessground;
;
function debounceRedraw(redrawNow) {
    let redrawing = false;
    return () => {
        if (redrawing)
            return;
        redrawing = true;
        requestAnimationFrame(() => {
            redrawNow();
            redrawing = false;
        });
    };
}

},{"./api":2,"./config":5,"./events":9,"./render":13,"./state":14,"./svg":15,"./util":17,"./wrap":18}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const board_1 = require("./board");
const fen_1 = require("./fen");
const cg = require("./types");
function configure(state, config) {
    if (config.movable && config.movable.dests)
        state.movable.dests = undefined;
    merge(state, config);
    if (config.geometry)
        state.dimensions = cg.dimensions[config.geometry];
    if (config.fen) {
        state.pieces = fen_1.read(config.fen, state.geometry);
        state.drawable.shapes = [];
    }
    if (config.hasOwnProperty('check'))
        board_1.setCheck(state, config.check || false);
    if (config.hasOwnProperty('lastMove') && !config.lastMove)
        state.lastMove = undefined;
    else if (config.lastMove)
        state.lastMove = config.lastMove;
    if (state.selected)
        board_1.setSelected(state, state.selected);
    if (!state.animation.duration || state.animation.duration < 100)
        state.animation.enabled = false;
    if (!state.movable.rookCastle && state.movable.dests) {
        const rank = state.movable.color === 'white' ? 1 : 8, kingStartPos = 'e' + rank, dests = state.movable.dests[kingStartPos], king = state.pieces[kingStartPos];
        if (!dests || !king || king.role !== 'king')
            return;
        state.movable.dests[kingStartPos] = dests.filter(d => !((d === 'a' + rank) && dests.indexOf('c' + rank) !== -1) &&
            !((d === 'h' + rank) && dests.indexOf('g' + rank) !== -1));
    }
}
exports.configure = configure;
;
function merge(base, extend) {
    for (let key in extend) {
        if (isObject(base[key]) && isObject(extend[key]))
            merge(base[key], extend[key]);
        else
            base[key] = extend[key];
    }
}
function isObject(o) {
    return typeof o === 'object';
}

},{"./board":3,"./fen":11,"./types":16}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const board = require("./board");
const util = require("./util");
const draw_1 = require("./draw");
const anim_1 = require("./anim");
function start(s, e) {
    if (e.button !== undefined && e.button !== 0)
        return;
    if (e.touches && e.touches.length > 1)
        return;
    const bounds = s.dom.bounds(), position = util.eventPosition(e), orig = board.getKeyAtDomPos(position, board.whitePov(s), bounds, s.geometry);
    if (!orig)
        return;
    const piece = s.pieces[orig];
    const previouslySelected = s.selected;
    if (!previouslySelected && s.drawable.enabled && (s.drawable.eraseOnClick || (!piece || piece.color !== s.turnColor)))
        draw_1.clear(s);
    if (e.cancelable !== false &&
        (!e.touches || !s.movable.color || piece || previouslySelected || pieceCloseTo(s, position)))
        e.preventDefault();
    const hadPremove = !!s.premovable.current;
    const hadPredrop = !!s.predroppable.current;
    s.stats.ctrlKey = e.ctrlKey;
    if (s.selected && board.canMove(s, s.selected, orig)) {
        anim_1.anim(state => board.selectSquare(state, orig), s);
    }
    else {
        board.selectSquare(s, orig);
    }
    const stillSelected = s.selected === orig;
    const element = pieceElementByKey(s, orig);
    const firstRankIs0 = s.dimensions.height === 10;
    if (piece && element && stillSelected && board.isDraggable(s, orig)) {
        const squareBounds = computeSquareBounds(orig, board.whitePov(s), bounds, s.dimensions);
        s.draggable.current = {
            orig,
            origPos: util.key2pos(orig, firstRankIs0),
            piece,
            rel: position,
            epos: position,
            pos: [0, 0],
            dec: s.draggable.centerPiece ? [
                position[0] - (squareBounds.left + squareBounds.width / 2),
                position[1] - (squareBounds.top + squareBounds.height / 2)
            ] : [0, 0],
            started: s.draggable.autoDistance && s.stats.dragged,
            element,
            previouslySelected,
            originTarget: e.target
        };
        element.cgDragging = true;
        element.classList.add('dragging');
        const ghost = s.dom.elements.ghost;
        if (ghost) {
            ghost.className = `ghost ${piece.color} ${piece.role}`;
            util.translateAbs(ghost, util.posToTranslateAbs(bounds, s.dimensions)(util.key2pos(orig, firstRankIs0), board.whitePov(s)));
            util.setVisible(ghost, true);
        }
        processDrag(s);
    }
    else {
        if (hadPremove)
            board.unsetPremove(s);
        if (hadPredrop)
            board.unsetPredrop(s);
    }
    s.dom.redraw();
}
exports.start = start;
function pieceCloseTo(s, pos) {
    const asWhite = board.whitePov(s), bounds = s.dom.bounds(), radiusSq = Math.pow(bounds.width / 8, 2);
    for (let key in s.pieces) {
        const squareBounds = computeSquareBounds(key, asWhite, bounds, s.dimensions), center = [
            squareBounds.left + squareBounds.width / 2,
            squareBounds.top + squareBounds.height / 2
        ];
        if (util.distanceSq(center, pos) <= radiusSq)
            return true;
    }
    return false;
}
exports.pieceCloseTo = pieceCloseTo;
function dragNewPiece(s, piece, e, force) {
    const key = 'z0';
    s.pieces[key] = piece;
    s.dom.redraw();
    const position = util.eventPosition(e), asWhite = board.whitePov(s), bounds = s.dom.bounds(), squareBounds = computeSquareBounds(key, asWhite, bounds, s.dimensions);
    const rel = [
        (asWhite ? 0 : s.dimensions.width - 1) * squareBounds.width + bounds.left,
        (asWhite ? s.dimensions.height : -1) * squareBounds.height + bounds.top
    ];
    const firstRankIs0 = s.geometry === 3;
    s.draggable.current = {
        orig: key,
        origPos: util.key2pos('a0', firstRankIs0),
        piece,
        rel,
        epos: position,
        pos: [position[0] - rel[0], position[1] - rel[1]],
        dec: [-squareBounds.width / 2, -squareBounds.height / 2],
        started: true,
        element: () => pieceElementByKey(s, key),
        originTarget: e.target,
        newPiece: true,
        force: !!force
    };
    processDrag(s);
}
exports.dragNewPiece = dragNewPiece;
function processDrag(s) {
    requestAnimationFrame(() => {
        const cur = s.draggable.current;
        if (!cur)
            return;
        if (s.animation.current && s.animation.current.plan.anims[cur.orig])
            s.animation.current = undefined;
        const origPiece = s.pieces[cur.orig];
        if (!origPiece || !util.samePiece(origPiece, cur.piece))
            cancel(s);
        else {
            if (!cur.started && util.distanceSq(cur.epos, cur.rel) >= Math.pow(s.draggable.distance, 2))
                cur.started = true;
            if (cur.started) {
                if (typeof cur.element === 'function') {
                    const found = cur.element();
                    if (!found)
                        return;
                    found.cgDragging = true;
                    found.classList.add('dragging');
                    cur.element = found;
                }
                cur.pos = [
                    cur.epos[0] - cur.rel[0],
                    cur.epos[1] - cur.rel[1]
                ];
                const translation = util.posToTranslateAbs(s.dom.bounds(), s.dimensions)(cur.origPos, board.whitePov(s));
                translation[0] += cur.pos[0] + cur.dec[0];
                translation[1] += cur.pos[1] + cur.dec[1];
                util.translateAbs(cur.element, translation);
            }
        }
        processDrag(s);
    });
}
function move(s, e) {
    if (s.draggable.current && (!e.touches || e.touches.length < 2)) {
        s.draggable.current.epos = util.eventPosition(e);
    }
}
exports.move = move;
function end(s, e) {
    const cur = s.draggable.current;
    if (!cur)
        return;
    if (e.type === 'touchend' && e.cancelable !== false)
        e.preventDefault();
    if (e.type === 'touchend' && cur && cur.originTarget !== e.target && !cur.newPiece) {
        s.draggable.current = undefined;
        return;
    }
    board.unsetPremove(s);
    board.unsetPredrop(s);
    const eventPos = util.eventPosition(e) || cur.epos;
    const dest = board.getKeyAtDomPos(eventPos, board.whitePov(s), s.dom.bounds(), s.geometry);
    if (dest && cur.started && cur.orig !== dest) {
        if (cur.newPiece)
            board.dropNewPiece(s, cur.orig, dest, cur.force);
        else {
            s.stats.ctrlKey = e.ctrlKey;
            if (board.userMove(s, cur.orig, dest))
                s.stats.dragged = true;
        }
    }
    else if (cur.newPiece) {
        delete s.pieces[cur.orig];
    }
    else if (s.draggable.deleteOnDropOff && !dest) {
        delete s.pieces[cur.orig];
        board.callUserFunction(s.events.change);
    }
    if (cur && cur.orig === cur.previouslySelected && (cur.orig === dest || !dest))
        board.unselect(s);
    else if (!s.selectable.enabled)
        board.unselect(s);
    removeDragElements(s);
    s.draggable.current = undefined;
    s.dom.redraw();
}
exports.end = end;
function cancel(s) {
    const cur = s.draggable.current;
    if (cur) {
        if (cur.newPiece)
            delete s.pieces[cur.orig];
        s.draggable.current = undefined;
        board.unselect(s);
        removeDragElements(s);
        s.dom.redraw();
    }
}
exports.cancel = cancel;
function removeDragElements(s) {
    const e = s.dom.elements;
    if (e.ghost)
        util.setVisible(e.ghost, false);
}
function computeSquareBounds(key, asWhite, bounds, bd) {
    const firstRankIs0 = bd.height === 10;
    const pos = util.key2pos(key, firstRankIs0);
    if (!asWhite) {
        pos[0] = bd.width + 1 - pos[0];
        pos[1] = bd.height + 1 - pos[1];
    }
    return {
        left: bounds.left + bounds.width * (pos[0] - 1) / bd.width,
        top: bounds.top + bounds.height * (bd.height - pos[1]) / bd.height,
        width: bounds.width / bd.width,
        height: bounds.height / bd.height
    };
}
function pieceElementByKey(s, key) {
    let el = s.dom.elements.board.firstChild;
    while (el) {
        if (el.cgKey === key && el.tagName === 'PIECE')
            return el;
        el = el.nextSibling;
    }
    return undefined;
}

},{"./anim":1,"./board":3,"./draw":7,"./util":17}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const board_1 = require("./board");
const util_1 = require("./util");
const brushes = ['green', 'red', 'blue', 'yellow'];
function start(state, e) {
    if (e.touches && e.touches.length > 1)
        return;
    e.stopPropagation();
    e.preventDefault();
    e.ctrlKey ? board_1.unselect(state) : board_1.cancelMove(state);
    const pos = util_1.eventPosition(e), orig = board_1.getKeyAtDomPos(pos, board_1.whitePov(state), state.dom.bounds(), state.geometry);
    if (!orig)
        return;
    state.drawable.current = {
        orig,
        pos,
        brush: eventBrush(e)
    };
    processDraw(state);
}
exports.start = start;
function processDraw(state) {
    requestAnimationFrame(() => {
        const cur = state.drawable.current;
        if (cur) {
            const mouseSq = board_1.getKeyAtDomPos(cur.pos, board_1.whitePov(state), state.dom.bounds(), state.geometry);
            if (mouseSq !== cur.mouseSq) {
                cur.mouseSq = mouseSq;
                cur.dest = mouseSq !== cur.orig ? mouseSq : undefined;
                state.dom.redrawNow();
            }
            processDraw(state);
        }
    });
}
exports.processDraw = processDraw;
function move(state, e) {
    if (state.drawable.current)
        state.drawable.current.pos = util_1.eventPosition(e);
}
exports.move = move;
function end(state) {
    const cur = state.drawable.current;
    if (cur) {
        if (cur.mouseSq)
            addShape(state.drawable, cur);
        cancel(state);
    }
}
exports.end = end;
function cancel(state) {
    if (state.drawable.current) {
        state.drawable.current = undefined;
        state.dom.redraw();
    }
}
exports.cancel = cancel;
function clear(state) {
    if (state.drawable.shapes.length) {
        state.drawable.shapes = [];
        state.dom.redraw();
        onChange(state.drawable);
    }
}
exports.clear = clear;
function eventBrush(e) {
    return brushes[(e.shiftKey && util_1.isRightButton(e) ? 1 : 0) + (e.altKey ? 2 : 0)];
}
function addShape(drawable, cur) {
    const sameShape = (s) => s.orig === cur.orig && s.dest === cur.dest;
    const similar = drawable.shapes.filter(sameShape)[0];
    if (similar)
        drawable.shapes = drawable.shapes.filter(s => !sameShape(s));
    if (!similar || similar.brush !== cur.brush)
        drawable.shapes.push(cur);
    onChange(drawable);
}
function onChange(drawable) {
    if (drawable.onChange)
        drawable.onChange(drawable.shapes);
}

},{"./board":3,"./util":17}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const board = require("./board");
const util = require("./util");
const drag_1 = require("./drag");
function setDropMode(s, piece) {
    s.dropmode = {
        active: true,
        piece
    };
    drag_1.cancel(s);
}
exports.setDropMode = setDropMode;
function cancelDropMode(s) {
    s.dropmode = {
        active: false
    };
}
exports.cancelDropMode = cancelDropMode;
function drop(s, e) {
    if (!s.dropmode.active)
        return;
    board.unsetPremove(s);
    board.unsetPredrop(s);
    const piece = s.dropmode.piece;
    if (piece) {
        s.pieces.z0 = piece;
        const position = util.eventPosition(e);
        const dest = position && board.getKeyAtDomPos(position, board.whitePov(s), s.dom.bounds(), s.geometry);
        if (dest)
            board.dropNewPiece(s, 'z0', dest);
    }
    s.dom.redraw();
}
exports.drop = drop;

},{"./board":3,"./drag":6,"./util":17}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const drag = require("./drag");
const draw = require("./draw");
const drop_1 = require("./drop");
const util_1 = require("./util");
function bindBoard(s) {
    if (s.viewOnly)
        return;
    const boardEl = s.dom.elements.board, onStart = startDragOrDraw(s);
    boardEl.addEventListener('touchstart', onStart, { passive: false });
    boardEl.addEventListener('mousedown', onStart, { passive: false });
    if (s.disableContextMenu || s.drawable.enabled) {
        boardEl.addEventListener('contextmenu', e => e.preventDefault());
    }
}
exports.bindBoard = bindBoard;
function bindDocument(s, redrawAll) {
    const unbinds = [];
    if (!s.dom.relative && s.resizable) {
        const onResize = () => {
            s.dom.bounds.clear();
            requestAnimationFrame(redrawAll);
        };
        unbinds.push(unbindable(document.body, 'chessground.resize', onResize));
    }
    if (!s.viewOnly) {
        const onmove = dragOrDraw(s, drag.move, draw.move);
        const onend = dragOrDraw(s, drag.end, draw.end);
        ['touchmove', 'mousemove'].forEach(ev => unbinds.push(unbindable(document, ev, onmove)));
        ['touchend', 'mouseup'].forEach(ev => unbinds.push(unbindable(document, ev, onend)));
        const onScroll = () => s.dom.bounds.clear();
        unbinds.push(unbindable(window, 'scroll', onScroll, { passive: true }));
        unbinds.push(unbindable(window, 'resize', onScroll, { passive: true }));
    }
    return () => unbinds.forEach(f => f());
}
exports.bindDocument = bindDocument;
function unbindable(el, eventName, callback, options) {
    el.addEventListener(eventName, callback, options);
    return () => el.removeEventListener(eventName, callback);
}
function startDragOrDraw(s) {
    return e => {
        if (s.draggable.current)
            drag.cancel(s);
        else if (s.drawable.current)
            draw.cancel(s);
        else if (e.shiftKey || util_1.isRightButton(e)) {
            if (s.drawable.enabled)
                draw.start(s, e);
        }
        else if (!s.viewOnly) {
            if (s.dropmode.active)
                drop_1.drop(s, e);
            else
                drag.start(s, e);
        }
    };
}
function dragOrDraw(s, withDrag, withDraw) {
    return e => {
        if (e.shiftKey || util_1.isRightButton(e)) {
            if (s.drawable.enabled)
                withDraw(s, e);
        }
        else if (!s.viewOnly)
            withDrag(s, e);
    };
}

},{"./drag":6,"./draw":7,"./drop":8,"./util":17}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function explosion(state, keys) {
    state.exploding = { stage: 1, keys };
    state.dom.redraw();
    setTimeout(() => {
        setStage(state, 2);
        setTimeout(() => setStage(state, undefined), 120);
    }, 120);
}
exports.default = explosion;
function setStage(state, stage) {
    if (state.exploding) {
        if (stage)
            state.exploding.stage = stage;
        else
            state.exploding = undefined;
        state.dom.redraw();
    }
}

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const cg = require("./types");
exports.initial = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const roles8 = {
    p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', q: 'queen', k: 'king', m: 'met', f: 'ferz', s: 'silver', c: 'cancellor', a: 'archbishop', h: 'hawk', e: 'elephant'
};
const roles9 = {
    p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', k: 'king', g: 'gold', s: 'silver', l: 'lance'
};
const roles10 = {
    p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', k: 'king', c: 'cannon', a: 'advisor'
};
const letters8 = {
    pawn: 'p', rook: 'r', knight: 'n', bishop: 'b', queen: 'q', king: 'k', met: 'm', ferz: 'f', silver: 's', cancellor: 'c', archbishop: 'a', hawk: 'h', elephant: 'e'
};
const letters9 = {
    pawn: 'p', rook: 'r', knight: 'n', bishop: 'b', king: 'k', gold: 'g', silver: 's', lance: 'l',
    ppawn: '+p', pknight: '+n', pbishop: '+b', prook: '+r', psilver: '+s', plance: '+l'
};
const letters10 = {
    pawn: 'p', rook: 'r', knight: 'n', bishop: 'b', king: 'k', cannon: 'c', advisor: 'a'
};
function read(fen, geom) {
    if (fen === 'start')
        fen = exports.initial;
    if (fen.indexOf('[') !== -1)
        fen = fen.slice(0, fen.indexOf('['));
    const pieces = {};
    let row = fen.split("/").length;
    let col = 0;
    let promoted = false;
    const roles = (geom === 3) ? roles10 : (geom === 1) ? roles9 : roles8;
    const firstRankIs0 = row === 10;
    const shogi = row === 9;
    for (const c of fen) {
        switch (c) {
            case ' ': return pieces;
            case '/':
                --row;
                if (row === 0)
                    return pieces;
                col = 0;
                break;
            case '+':
                promoted = true;
                break;
            case '~':
                const piece = pieces[cg.files[col] + cg.ranks[firstRankIs0 ? row : row + 1]];
                if (piece)
                    piece.promoted = true;
                break;
            default:
                const nb = c.charCodeAt(0);
                if (nb < 58)
                    col += (c === '0') ? 9 : nb - 48;
                else {
                    ++col;
                    const role = c.toLowerCase();
                    let piece = {
                        role: roles[role],
                        color: (c === role ? shogi ? 'white' : 'black' : shogi ? 'black' : 'white')
                    };
                    if (promoted) {
                        piece.role = 'p' + piece.role;
                        piece.promoted = true;
                        promoted = false;
                    }
                    ;
                    if (shogi) {
                        pieces[cg.files[10 - col - 1] + cg.ranks[10 - row]] = piece;
                    }
                    else {
                        pieces[cg.files[col - 1] + cg.ranks[firstRankIs0 ? row - 1 : row]] = piece;
                    }
                    ;
                }
        }
    }
    return pieces;
}
exports.read = read;
function write(pieces, geom) {
    var letters = {};
    switch (geom) {
        case 3:
            letters = letters10;
            break;
        case 1:
            letters = letters9;
            break;
        default:
            letters = letters8;
            break;
    }
    ;
    return util_1.invNRanks.map(y => util_1.NRanks.map(x => {
        const piece = pieces[util_1.pos2key([x, y], geom)];
        if (piece) {
            const letter = letters[piece.role];
            return piece.color === 'white' ? letter.toUpperCase() : letter;
        }
        else
            return '1';
    }).join('')).join('/').replace(/1{2,}/g, s => s.length.toString());
}
exports.write = write;

},{"./types":16,"./util":17}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("./util");
const cg = require("./types");
function diff(a, b) {
    return Math.abs(a - b);
}
function pawn(color) {
    return (x1, y1, x2, y2) => diff(x1, x2) < 2 && (color === 'white' ? (y2 === y1 + 1 || (y1 <= 2 && y2 === (y1 + 2) && x1 === x2)) : (y2 === y1 - 1 || (y1 >= 7 && y2 === (y1 - 2) && x1 === x2)));
}
const knight = (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return (xd === 1 && yd === 2) || (xd === 2 && yd === 1);
};
const bishop = (x1, y1, x2, y2) => {
    return diff(x1, x2) === diff(y1, y2);
};
const rook = (x1, y1, x2, y2) => {
    return x1 === x2 || y1 === y2;
};
const queen = (x1, y1, x2, y2) => {
    return bishop(x1, y1, x2, y2) || rook(x1, y1, x2, y2);
};
function king(color, rookFiles, canCastle) {
    return (x1, y1, x2, y2) => (diff(x1, x2) < 2 && diff(y1, y2) < 2) || (canCastle && y1 === y2 && y1 === (color === 'white' ? 1 : 8) && ((x1 === 5 && (x2 === 3 || x2 === 7)) || util.containsX(rookFiles, x2)));
}
const met = (x1, y1, x2, y2) => {
    return diff(x1, x2) === diff(y1, y2) && diff(x1, x2) === 1;
};
const archbishop = (x1, y1, x2, y2) => {
    return bishop(x1, y1, x2, y2) || knight(x1, y1, x2, y2);
};
const cancellor = (x1, y1, x2, y2) => {
    return rook(x1, y1, x2, y2) || knight(x1, y1, x2, y2);
};
function lance(color) {
    return (x1, y1, x2, y2) => (x2 === x1 && (color === 'white' ? y2 > y1 : y2 < y1));
}
function silver(color) {
    return (x1, y1, x2, y2) => (met(x1, y1, x2, y2) || (x1 === x2 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1)));
}
function gold(color) {
    return (x1, y1, x2, y2) => (diff(x1, x2) < 2 && diff(y1, y2) < 2 && (color === 'white' ?
        !((x2 === x1 - 1 && y2 === y1 - 1) || (x2 === x1 + 1 && y2 === y1 - 1)) :
        !((x2 === x1 + 1 && y2 === y1 + 1) || (x2 === x1 - 1 && y2 === y1 + 1))));
}
function spawn(color) {
    return (x1, y1, x2, y2) => (x2 === x1 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1));
}
function sknight(color) {
    return (x1, y1, x2, y2) => color === 'white' ?
        (y2 === y1 + 2 && x2 === x1 - 1 || y2 === y1 + 2 && x2 === x1 + 1) :
        (y2 === y1 - 2 && x2 === x1 - 1 || y2 === y1 - 2 && x2 === x1 + 1);
}
const prook = (x1, y1, x2, y2) => {
    return rook(x1, y1, x2, y2) || (diff(x1, x2) < 2 && diff(y1, y2) < 2);
};
const pbishop = (x1, y1, x2, y2) => {
    return bishop(x1, y1, x2, y2) || (diff(x1, x2) < 2 && diff(y1, y2) < 2);
};
const sking = (x1, y1, x2, y2) => {
    return diff(x1, x2) < 2 && diff(y1, y2) < 2;
};
function xpawn(color) {
    return (x1, y1, x2, y2) => ((x2 === x1 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1)) ||
        (y2 === y1 && (x2 === x1 + 1 || x2 === x1 - 1) && (color === 'white' ? y1 > 5 : y1 < 6)));
}
const xbishop = (x1, y1, x2, y2) => {
    return diff(x1, x2) === diff(y1, y2) && diff(x1, x2) === 2;
};
const advisor = (x1, y1, x2, y2) => {
    return diff(x1, x2) === diff(y1, y2) && diff(x1, x2) === 1;
};
const xking = (x1, y1, x2, y2) => {
    return (x1 === x2 || y1 === y2) && diff(x1, x2) === 1;
};
function rookFilesOf(pieces, color, firstRankIs0) {
    return Object.keys(pieces).filter(key => {
        const piece = pieces[key];
        return piece && piece.color === color && piece.role === 'rook';
    }).map((key) => util.key2pos(key, firstRankIs0)[0]);
}
function premove(pieces, key, canCastle, geom) {
    const firstRankIs0 = cg.dimensions[geom].height === 10;
    const piece = pieces[key], pos = util.key2pos(key, firstRankIs0);
    let mobility;
    switch (geom) {
        case 3:
            switch (piece.role) {
                case 'pawn':
                    mobility = xpawn(piece.color);
                    break;
                case 'cannon':
                case 'rook':
                    mobility = rook;
                    break;
                case 'knight':
                    mobility = knight;
                    break;
                case 'bishop':
                    mobility = xbishop;
                    break;
                case 'advisor':
                    mobility = advisor;
                    break;
                case 'king':
                    mobility = xking;
                    break;
            }
            ;
            break;
        case 1:
            switch (piece.role) {
                case 'pawn':
                    mobility = spawn(piece.color);
                    break;
                case 'knight':
                    mobility = sknight(piece.color);
                    break;
                case 'bishop':
                    mobility = bishop;
                    break;
                case 'rook':
                    mobility = rook;
                    break;
                case 'king':
                    mobility = sking;
                    break;
                case 'silver':
                    mobility = silver(piece.color);
                    break;
                case 'ppawn':
                case 'plance':
                case 'pknight':
                case 'psilver':
                case 'gold':
                    mobility = gold(piece.color);
                    break;
                case 'lance':
                    mobility = lance(piece.color);
                    break;
                case 'prook':
                    mobility = prook;
                    break;
                case 'pbishop':
                    mobility = pbishop;
                    break;
            }
            ;
            break;
        default:
            switch (piece.role) {
                case 'pawn':
                    mobility = pawn(piece.color);
                    break;
                case 'knight':
                    mobility = knight;
                    break;
                case 'bishop':
                    mobility = bishop;
                    break;
                case 'rook':
                    mobility = rook;
                    break;
                case 'queen':
                    mobility = queen;
                    break;
                case 'king':
                    mobility = king(piece.color, rookFilesOf(pieces, piece.color, firstRankIs0), canCastle);
                    break;
                case 'hawk':
                case 'archbishop':
                    mobility = archbishop;
                    break;
                case 'elephant':
                case 'cancellor':
                    mobility = cancellor;
                    break;
                case 'met':
                case 'ferz':
                    mobility = met;
                    break;
                case 'silver':
                    mobility = silver(piece.color);
                    break;
            }
            ;
            break;
    }
    ;
    const allkeys = util.allKeys[geom];
    const pos2keyGeom = (geom) => ((pos) => util.pos2key(pos, geom));
    const pos2key = pos2keyGeom(geom);
    const key2posRank0 = (firstrank0) => ((key) => util.key2pos(key, firstrank0));
    const key2pos = key2posRank0(firstRankIs0);
    return allkeys.map(key2pos).filter(pos2 => {
        return (pos[0] !== pos2[0] || pos[1] !== pos2[1]) && mobility(pos[0], pos[1], pos2[0], pos2[1]);
    }).map(pos2key);
}
exports.default = premove;
;

},{"./types":16,"./util":17}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const board_1 = require("./board");
const util = require("./util");
function render(s) {
    const firstRankIs0 = s.dimensions.height === 10;
    const asWhite = board_1.whitePov(s), posToTranslate = s.dom.relative ? util.posToTranslateRel : util.posToTranslateAbs(s.dom.bounds(), s.dimensions), translate = s.dom.relative ? util.translateRel : util.translateAbs, boardEl = s.dom.elements.board, pieces = s.pieces, curAnim = s.animation.current, anims = curAnim ? curAnim.plan.anims : {}, fadings = curAnim ? curAnim.plan.fadings : {}, curDrag = s.draggable.current, squares = computeSquareClasses(s), samePieces = {}, sameSquares = {}, movedPieces = {}, movedSquares = {}, piecesKeys = Object.keys(pieces);
    let k, p, el, pieceAtKey, elPieceName, anim, fading, pMvdset, pMvd, sMvdset, sMvd;
    el = boardEl.firstChild;
    while (el) {
        k = el.cgKey;
        if (isPieceNode(el)) {
            pieceAtKey = pieces[k];
            anim = anims[k];
            fading = fadings[k];
            elPieceName = el.cgPiece;
            if (el.cgDragging && (!curDrag || curDrag.orig !== k)) {
                el.classList.remove('dragging');
                translate(el, posToTranslate(util_1.key2pos(k, firstRankIs0), asWhite, s.dimensions));
                el.cgDragging = false;
            }
            if (!fading && el.cgFading) {
                el.cgFading = false;
                el.classList.remove('fading');
            }
            if (pieceAtKey) {
                if (anim && el.cgAnimating && elPieceName === pieceNameOf(pieceAtKey)) {
                    const pos = util_1.key2pos(k, firstRankIs0);
                    pos[0] += anim[2];
                    pos[1] += anim[3];
                    el.classList.add('anim');
                    translate(el, posToTranslate(pos, asWhite, s.dimensions));
                }
                else if (el.cgAnimating) {
                    el.cgAnimating = false;
                    el.classList.remove('anim');
                    translate(el, posToTranslate(util_1.key2pos(k, firstRankIs0), asWhite, s.dimensions));
                    if (s.addPieceZIndex)
                        el.style.zIndex = posZIndex(util_1.key2pos(k, firstRankIs0), asWhite);
                }
                if (elPieceName === pieceNameOf(pieceAtKey) && (!fading || !el.cgFading)) {
                    samePieces[k] = true;
                }
                else {
                    if (fading && elPieceName === pieceNameOf(fading)) {
                        el.classList.add('fading');
                        el.cgFading = true;
                    }
                    else {
                        if (movedPieces[elPieceName])
                            movedPieces[elPieceName].push(el);
                        else
                            movedPieces[elPieceName] = [el];
                    }
                }
            }
            else {
                if (movedPieces[elPieceName])
                    movedPieces[elPieceName].push(el);
                else
                    movedPieces[elPieceName] = [el];
            }
        }
        else if (isSquareNode(el)) {
            const cn = el.className;
            if (squares[k] === cn)
                sameSquares[k] = true;
            else if (movedSquares[cn])
                movedSquares[cn].push(el);
            else
                movedSquares[cn] = [el];
        }
        el = el.nextSibling;
    }
    for (const sk in squares) {
        if (!sameSquares[sk]) {
            sMvdset = movedSquares[squares[sk]];
            sMvd = sMvdset && sMvdset.pop();
            const translation = posToTranslate(util_1.key2pos(sk, firstRankIs0), asWhite, s.dimensions);
            if (sMvd) {
                sMvd.cgKey = sk;
                translate(sMvd, translation);
            }
            else {
                const squareNode = util_1.createEl('square', squares[sk]);
                squareNode.cgKey = sk;
                translate(squareNode, translation);
                boardEl.insertBefore(squareNode, boardEl.firstChild);
            }
        }
    }
    for (const j in piecesKeys) {
        k = piecesKeys[j];
        p = pieces[k];
        anim = anims[k];
        if (!samePieces[k]) {
            pMvdset = movedPieces[pieceNameOf(p)];
            pMvd = pMvdset && pMvdset.pop();
            if (pMvd) {
                pMvd.cgKey = k;
                if (pMvd.cgFading) {
                    pMvd.classList.remove('fading');
                    pMvd.cgFading = false;
                }
                const pos = util_1.key2pos(k, firstRankIs0);
                if (s.addPieceZIndex)
                    pMvd.style.zIndex = posZIndex(pos, asWhite);
                if (anim) {
                    pMvd.cgAnimating = true;
                    pMvd.classList.add('anim');
                    pos[0] += anim[2];
                    pos[1] += anim[3];
                }
                translate(pMvd, posToTranslate(pos, asWhite, s.dimensions));
            }
            else {
                const pieceName = pieceNameOf(p), pieceNode = util_1.createEl('piece', pieceName), pos = util_1.key2pos(k, firstRankIs0);
                pieceNode.cgPiece = pieceName;
                pieceNode.cgKey = k;
                if (anim) {
                    pieceNode.cgAnimating = true;
                    pos[0] += anim[2];
                    pos[1] += anim[3];
                }
                translate(pieceNode, posToTranslate(pos, asWhite, s.dimensions));
                if (s.addPieceZIndex)
                    pieceNode.style.zIndex = posZIndex(pos, asWhite);
                boardEl.appendChild(pieceNode);
            }
        }
    }
    for (const i in movedPieces)
        removeNodes(s, movedPieces[i]);
    for (const i in movedSquares)
        removeNodes(s, movedSquares[i]);
}
exports.default = render;
function isPieceNode(el) {
    return el.tagName === 'PIECE';
}
function isSquareNode(el) {
    return el.tagName === 'SQUARE';
}
function removeNodes(s, nodes) {
    for (const i in nodes)
        s.dom.elements.board.removeChild(nodes[i]);
}
function posZIndex(pos, asWhite) {
    let z = 2 + (pos[1] - 1) * 8 + (8 - pos[0]);
    if (asWhite)
        z = 67 - z;
    return z + '';
}
function pieceNameOf(piece) {
    return `${piece.color} ${piece.role}`;
}
function computeSquareClasses(s) {
    const squares = {};
    let i, k;
    if (s.lastMove && s.highlight.lastMove)
        for (i in s.lastMove) {
            if (s.lastMove[i] != 'z0') {
                addSquare(squares, s.lastMove[i], 'last-move');
            }
        }
    if (s.check && s.highlight.check)
        addSquare(squares, s.check, 'check');
    if (s.selected) {
        if (s.selected != 'z0') {
            addSquare(squares, s.selected, 'selected');
        }
        if (s.movable.showDests) {
            const dests = s.movable.dests && s.movable.dests[s.selected];
            if (dests)
                for (i in dests) {
                    k = dests[i];
                    addSquare(squares, k, 'move-dest' + (s.pieces[k] ? ' oc' : ''));
                }
            const pDests = s.premovable.dests;
            if (pDests)
                for (i in pDests) {
                    k = pDests[i];
                    addSquare(squares, k, 'premove-dest' + (s.pieces[k] ? ' oc' : ''));
                }
        }
    }
    const premove = s.premovable.current;
    if (premove)
        for (i in premove)
            addSquare(squares, premove[i], 'current-premove');
    else if (s.predroppable.current)
        addSquare(squares, s.predroppable.current.key, 'current-premove');
    const o = s.exploding;
    if (o)
        for (i in o.keys)
            addSquare(squares, o.keys[i], 'exploding' + o.stage);
    return squares;
}
function addSquare(squares, key, klass) {
    if (squares[key])
        squares[key] += ' ' + klass;
    else
        squares[key] = klass;
}

},{"./board":3,"./util":17}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fen = require("./fen");
const util_1 = require("./util");
function defaults() {
    return {
        pieces: fen.read(fen.initial, 0),
        orientation: 'white',
        turnColor: 'white',
        coordinates: true,
        autoCastle: true,
        viewOnly: false,
        disableContextMenu: false,
        resizable: true,
        addPieceZIndex: false,
        pieceKey: false,
        highlight: {
            lastMove: true,
            check: true
        },
        animation: {
            enabled: true,
            duration: 200
        },
        movable: {
            free: true,
            color: 'both',
            showDests: true,
            events: {},
            rookCastle: true
        },
        premovable: {
            enabled: true,
            showDests: true,
            castle: true,
            events: {}
        },
        predroppable: {
            enabled: false,
            events: {}
        },
        draggable: {
            enabled: true,
            distance: 3,
            autoDistance: true,
            centerPiece: true,
            showGhost: true,
            deleteOnDropOff: false
        },
        dropmode: {
            active: false
        },
        selectable: {
            enabled: true
        },
        stats: {
            dragged: !('ontouchstart' in window)
        },
        events: {},
        drawable: {
            enabled: true,
            visible: true,
            eraseOnClick: true,
            shapes: [],
            autoShapes: [],
            brushes: {
                green: { key: 'g', color: '#15781B', opacity: 1, lineWidth: 10 },
                red: { key: 'r', color: '#882020', opacity: 1, lineWidth: 10 },
                blue: { key: 'b', color: '#003088', opacity: 1, lineWidth: 10 },
                yellow: { key: 'y', color: '#e68f00', opacity: 1, lineWidth: 10 },
                paleBlue: { key: 'pb', color: '#003088', opacity: 0.4, lineWidth: 15 },
                paleGreen: { key: 'pg', color: '#15781B', opacity: 0.4, lineWidth: 15 },
                paleRed: { key: 'pr', color: '#882020', opacity: 0.4, lineWidth: 15 },
                paleGrey: { key: 'pgr', color: '#4a4a4a', opacity: 0.35, lineWidth: 15 }
            },
            pieces: {
                baseUrl: 'https://lichess1.org/assets/piece/cburnett/'
            },
            prevSvgHash: ''
        },
        hold: util_1.timer(),
        dimensions: { width: 8, height: 8 },
        geometry: 0,
    };
}
exports.defaults = defaults;

},{"./fen":11,"./util":17}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
function createElement(tagName) {
    return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}
exports.createElement = createElement;
function renderSvg(state, root) {
    const d = state.drawable, curD = d.current, cur = curD && curD.mouseSq ? curD : undefined, arrowDests = {};
    d.shapes.concat(d.autoShapes).concat(cur ? [cur] : []).forEach(s => {
        if (s.dest)
            arrowDests[s.dest] = (arrowDests[s.dest] || 0) + 1;
    });
    const shapes = d.shapes.concat(d.autoShapes).map((s) => {
        return {
            shape: s,
            current: false,
            hash: shapeHash(s, arrowDests, false)
        };
    });
    if (cur)
        shapes.push({
            shape: cur,
            current: true,
            hash: shapeHash(cur, arrowDests, true)
        });
    const fullHash = shapes.map(sc => sc.hash).join('');
    if (fullHash === state.drawable.prevSvgHash)
        return;
    state.drawable.prevSvgHash = fullHash;
    const defsEl = root.firstChild;
    syncDefs(d, shapes, defsEl);
    syncShapes(state, shapes, d.brushes, arrowDests, root, defsEl);
}
exports.renderSvg = renderSvg;
function syncDefs(d, shapes, defsEl) {
    const brushes = {};
    let brush;
    shapes.forEach(s => {
        if (s.shape.dest) {
            brush = d.brushes[s.shape.brush];
            if (s.shape.modifiers)
                brush = makeCustomBrush(brush, s.shape.modifiers);
            brushes[brush.key] = brush;
        }
    });
    const keysInDom = {};
    let el = defsEl.firstChild;
    while (el) {
        keysInDom[el.getAttribute('cgKey')] = true;
        el = el.nextSibling;
    }
    for (let key in brushes) {
        if (!keysInDom[key])
            defsEl.appendChild(renderMarker(brushes[key]));
    }
}
function syncShapes(state, shapes, brushes, arrowDests, root, defsEl) {
    const bounds = state.dom.bounds(), hashesInDom = {}, toRemove = [];
    shapes.forEach(sc => { hashesInDom[sc.hash] = false; });
    let el = defsEl.nextSibling, elHash;
    while (el) {
        elHash = el.getAttribute('cgHash');
        if (hashesInDom.hasOwnProperty(elHash))
            hashesInDom[elHash] = true;
        else
            toRemove.push(el);
        el = el.nextSibling;
    }
    toRemove.forEach(el => root.removeChild(el));
    shapes.forEach(sc => {
        if (!hashesInDom[sc.hash])
            root.appendChild(renderShape(state, sc, brushes, arrowDests, bounds));
    });
}
function shapeHash({ orig, dest, brush, piece, modifiers }, arrowDests, current) {
    return [current, orig, dest, brush, dest && arrowDests[dest] > 1,
        piece && pieceHash(piece),
        modifiers && modifiersHash(modifiers)
    ].filter(x => x).join('');
}
function pieceHash(piece) {
    return [piece.color, piece.role, piece.scale].filter(x => x).join('');
}
function modifiersHash(m) {
    return '' + (m.lineWidth || '');
}
function renderShape(state, { shape, current, hash }, brushes, arrowDests, bounds) {
    const firstRankIs0 = state.dimensions.height === 10;
    let el;
    if (shape.piece)
        el = renderPiece(state.drawable.pieces.baseUrl, orient(util_1.key2pos(shape.orig, firstRankIs0), state.orientation, state.dimensions), shape.piece, bounds, state.dimensions);
    else {
        const orig = orient(util_1.key2pos(shape.orig, firstRankIs0), state.orientation, state.dimensions);
        if (shape.orig && shape.dest) {
            let brush = brushes[shape.brush];
            if (shape.modifiers)
                brush = makeCustomBrush(brush, shape.modifiers);
            el = renderArrow(brush, orig, orient(util_1.key2pos(shape.dest, firstRankIs0), state.orientation, state.dimensions), current, arrowDests[shape.dest] > 1, bounds, state.dimensions);
        }
        else
            el = renderCircle(brushes[shape.brush], orig, current, bounds, state.dimensions);
    }
    el.setAttribute('cgHash', hash);
    return el;
}
function renderCircle(brush, pos, current, bounds, bd) {
    const o = pos2px(pos, bounds, bd), widths = circleWidth(bounds, bd), radius = (bounds.width / bd.width) / 2;
    return setAttributes(createElement('circle'), {
        stroke: brush.color,
        'stroke-width': widths[current ? 0 : 1],
        fill: 'none',
        opacity: opacity(brush, current),
        cx: o[0],
        cy: o[1],
        r: radius - widths[1] / 2
    });
}
function renderArrow(brush, orig, dest, current, shorten, bounds, bd) {
    const m = arrowMargin(bounds, shorten && !current, bd), a = pos2px(orig, bounds, bd), b = pos2px(dest, bounds, bd), dx = b[0] - a[0], dy = b[1] - a[1], angle = Math.atan2(dy, dx), xo = Math.cos(angle) * m, yo = Math.sin(angle) * m;
    return setAttributes(createElement('line'), {
        stroke: brush.color,
        'stroke-width': lineWidth(brush, current, bounds, bd),
        'stroke-linecap': 'round',
        'marker-end': 'url(#arrowhead-' + brush.key + ')',
        opacity: opacity(brush, current),
        x1: a[0],
        y1: a[1],
        x2: b[0] - xo,
        y2: b[1] - yo
    });
}
function renderPiece(baseUrl, pos, piece, bounds, bd) {
    const o = pos2px(pos, bounds, bd), width = bounds.width / bd.width * (piece.scale || 1), height = bounds.width / bd.height * (piece.scale || 1), name = piece.color[0] + (piece.role === 'knight' ? 'n' : piece.role[0]).toUpperCase();
    return setAttributes(createElement('image'), {
        className: `${piece.role} ${piece.color}`,
        x: o[0] - width / 2,
        y: o[1] - height / 2,
        width: width,
        height: height,
        href: baseUrl + name + '.svg'
    });
}
function renderMarker(brush) {
    const marker = setAttributes(createElement('marker'), {
        id: 'arrowhead-' + brush.key,
        orient: 'auto',
        markerWidth: 4,
        markerHeight: 8,
        refX: 2.05,
        refY: 2.01
    });
    marker.appendChild(setAttributes(createElement('path'), {
        d: 'M0,0 V4 L3,2 Z',
        fill: brush.color
    }));
    marker.setAttribute('cgKey', brush.key);
    return marker;
}
function setAttributes(el, attrs) {
    for (let key in attrs)
        el.setAttribute(key, attrs[key]);
    return el;
}
function orient(pos, color, bd) {
    return color === 'white' ? pos : [bd.width + 1 - pos[0], bd.height + 1 - pos[1]];
}
function makeCustomBrush(base, modifiers) {
    const brush = {
        color: base.color,
        opacity: Math.round(base.opacity * 10) / 10,
        lineWidth: Math.round(modifiers.lineWidth || base.lineWidth)
    };
    brush.key = [base.key, modifiers.lineWidth].filter(x => x).join('');
    return brush;
}
function circleWidth(bounds, bd) {
    const base = bounds.width / (bd.width * 64);
    return [3 * base, 4 * base];
}
function lineWidth(brush, current, bounds, bd) {
    return (brush.lineWidth || 10) * (current ? 0.85 : 1) / (bd.width * 64) * bounds.width;
}
function opacity(brush, current) {
    return (brush.opacity || 1) * (current ? 0.9 : 1);
}
function arrowMargin(bounds, shorten, bd) {
    return (shorten ? 20 : 10) / (bd.width * 64) * bounds.width;
}
function pos2px(pos, bounds, bd) {
    return [(pos[0] - 0.5) * bounds.width / bd.width, (bd.height + 0.5 - pos[1]) * bounds.height / bd.height];
}

},{"./util":17}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
exports.ranks = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
;
exports.dimensions = [{ width: 8, height: 8 }, { width: 9, height: 9 }, { width: 10, height: 8 }, { width: 9, height: 10 }, { width: 10, height: 10 }];

},{}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cg = require("./types");
exports.colors = ['white', 'black'];
exports.NRanks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
exports.invNRanks = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const files8 = cg.files.slice(0, 8);
const files9 = cg.files.slice(0, 9);
const files10 = cg.files.slice(0, 10);
const ranks8 = cg.ranks.slice(1, 9);
const ranks9 = cg.ranks.slice(1, 10);
const ranks10 = cg.ranks.slice(0, 10);
const allKeys8x8 = Array.prototype.concat(...files8.map(c => ranks8.map(r => c + r)));
const allKeys9x9 = Array.prototype.concat(...files9.map(c => ranks9.map(r => c + r)));
const allKeys10x8 = Array.prototype.concat(...files10.map(c => ranks8.map(r => c + r)));
const allKeys9x10 = Array.prototype.concat(...files9.map(c => ranks10.map(r => c + r)));
const allKeys10x10 = Array.prototype.concat(...files10.map(c => ranks10.map(r => c + r)));
exports.allKeys = [allKeys8x8, allKeys9x9, allKeys10x8, allKeys9x10, allKeys10x10];
function pos2key(pos, geom) {
    const bd = cg.dimensions[geom];
    return exports.allKeys[geom][bd.height * pos[0] + pos[1] - bd.height - 1];
}
exports.pos2key = pos2key;
function key2pos(k, firstRankIs0) {
    const shift = firstRankIs0 ? 1 : 0;
    return [k.charCodeAt(0) - 96, k.charCodeAt(1) - 48 + shift];
}
exports.key2pos = key2pos;
function memo(f) {
    let v;
    const ret = () => {
        if (v === undefined)
            v = f();
        return v;
    };
    ret.clear = () => { v = undefined; };
    return ret;
}
exports.memo = memo;
exports.timer = () => {
    let startAt;
    return {
        start() { startAt = performance.now(); },
        cancel() { startAt = undefined; },
        stop() {
            if (!startAt)
                return 0;
            const time = performance.now() - startAt;
            startAt = undefined;
            return time;
        }
    };
};
exports.opposite = (c) => c === 'white' ? 'black' : 'white';
function containsX(xs, x) {
    return xs !== undefined && xs.indexOf(x) !== -1;
}
exports.containsX = containsX;
exports.distanceSq = (pos1, pos2) => {
    return Math.pow(pos1[0] - pos2[0], 2) + Math.pow(pos1[1] - pos2[1], 2);
};
exports.samePiece = (p1, p2) => p1.role === p2.role && p1.color === p2.color;
const posToTranslateBase = (pos, asWhite, xFactor, yFactor, bt) => [
    (asWhite ? pos[0] - 1 : bt.width - pos[0]) * xFactor,
    (asWhite ? bt.height - pos[1] : pos[1] - 1) * yFactor
];
exports.posToTranslateAbs = (bounds, bt) => {
    const xFactor = bounds.width / bt.width, yFactor = bounds.height / bt.height;
    return (pos, asWhite) => posToTranslateBase(pos, asWhite, xFactor, yFactor, bt);
};
exports.posToTranslateRel = (pos, asWhite, bt) => posToTranslateBase(pos, asWhite, 100 / bt.width, 100 / bt.height, bt);
exports.translateAbs = (el, pos) => {
    el.style.transform = `translate(${pos[0]}px,${pos[1]}px)`;
};
exports.translateRel = (el, percents) => {
    el.style.left = percents[0] + '%';
    el.style.top = percents[1] + '%';
};
exports.setVisible = (el, v) => {
    el.style.visibility = v ? 'visible' : 'hidden';
};
exports.eventPosition = e => {
    if (e.clientX || e.clientX === 0)
        return [e.clientX, e.clientY];
    if (e.touches && e.targetTouches[0])
        return [e.targetTouches[0].clientX, e.targetTouches[0].clientY];
    return undefined;
};
exports.isRightButton = (e) => e.buttons === 2 || e.button === 2;
exports.createEl = (tagName, className) => {
    const el = document.createElement(tagName);
    if (className)
        el.className = className;
    return el;
};

},{"./types":16}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const types_1 = require("./types");
const svg_1 = require("./svg");
function wrap(element, s, relative) {
    element.innerHTML = '';
    element.classList.add('cg-wrap');
    util_1.colors.forEach(c => element.classList.toggle('orientation-' + c, s.orientation === c));
    element.classList.toggle('manipulable', !s.viewOnly);
    const helper = util_1.createEl('cg-helper');
    element.appendChild(helper);
    const container = util_1.createEl('cg-container');
    helper.appendChild(container);
    const extension = util_1.createEl('extension');
    container.appendChild(extension);
    const board = util_1.createEl('cg-board');
    container.appendChild(board);
    let svg;
    if (s.drawable.visible && !relative) {
        svg = svg_1.createElement('svg');
        svg.appendChild(svg_1.createElement('defs'));
        container.appendChild(svg);
    }
    if (s.coordinates) {
        const orientClass = s.orientation === 'black' ? ' black' : '';
        const firstRankIs0 = s.geometry === 3;
        const shift = firstRankIs0 ? 0 : 1;
        container.appendChild(renderCoords(types_1.ranks.slice(shift, s.dimensions.height + shift), 'ranks' + orientClass));
        container.appendChild(renderCoords(types_1.files.slice(0, s.dimensions.width), 'files' + orientClass));
    }
    let ghost;
    if (s.draggable.showGhost && !relative) {
        ghost = util_1.createEl('piece', 'ghost');
        util_1.setVisible(ghost, false);
        container.appendChild(ghost);
    }
    return {
        board,
        container,
        ghost,
        svg
    };
}
exports.default = wrap;
function renderCoords(elems, className) {
    const el = util_1.createEl('coords', className);
    let f;
    for (let i in elems) {
        f = util_1.createEl('coord');
        f.textContent = elems[i];
        el.appendChild(f);
    }
    return el;
}

},{"./svg":15,"./types":16,"./util":17}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vnode_1 = require("./vnode");
var is = require("./is");
function addNS(data, children, sel) {
    data.ns = 'http://www.w3.org/2000/svg';
    if (sel !== 'foreignObject' && children !== undefined) {
        for (var i = 0; i < children.length; ++i) {
            var childData = children[i].data;
            if (childData !== undefined) {
                addNS(childData, children[i].children, children[i].sel);
            }
        }
    }
}
function h(sel, b, c) {
    var data = {}, children, text, i;
    if (c !== undefined) {
        data = b;
        if (is.array(c)) {
            children = c;
        }
        else if (is.primitive(c)) {
            text = c;
        }
        else if (c && c.sel) {
            children = [c];
        }
    }
    else if (b !== undefined) {
        if (is.array(b)) {
            children = b;
        }
        else if (is.primitive(b)) {
            text = b;
        }
        else if (b && b.sel) {
            children = [b];
        }
        else {
            data = b;
        }
    }
    if (children !== undefined) {
        for (i = 0; i < children.length; ++i) {
            if (is.primitive(children[i]))
                children[i] = vnode_1.vnode(undefined, undefined, undefined, children[i], undefined);
        }
    }
    if (sel[0] === 's' && sel[1] === 'v' && sel[2] === 'g' &&
        (sel.length === 3 || sel[3] === '.' || sel[3] === '#')) {
        addNS(data, children, sel);
    }
    return vnode_1.vnode(sel, data, children, text, undefined);
}
exports.h = h;
;
exports.default = h;

},{"./is":21,"./vnode":29}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function createElement(tagName) {
    return document.createElement(tagName);
}
function createElementNS(namespaceURI, qualifiedName) {
    return document.createElementNS(namespaceURI, qualifiedName);
}
function createTextNode(text) {
    return document.createTextNode(text);
}
function createComment(text) {
    return document.createComment(text);
}
function insertBefore(parentNode, newNode, referenceNode) {
    parentNode.insertBefore(newNode, referenceNode);
}
function removeChild(node, child) {
    node.removeChild(child);
}
function appendChild(node, child) {
    node.appendChild(child);
}
function parentNode(node) {
    return node.parentNode;
}
function nextSibling(node) {
    return node.nextSibling;
}
function tagName(elm) {
    return elm.tagName;
}
function setTextContent(node, text) {
    node.textContent = text;
}
function getTextContent(node) {
    return node.textContent;
}
function isElement(node) {
    return node.nodeType === 1;
}
function isText(node) {
    return node.nodeType === 3;
}
function isComment(node) {
    return node.nodeType === 8;
}
exports.htmlDomApi = {
    createElement: createElement,
    createElementNS: createElementNS,
    createTextNode: createTextNode,
    createComment: createComment,
    insertBefore: insertBefore,
    removeChild: removeChild,
    appendChild: appendChild,
    parentNode: parentNode,
    nextSibling: nextSibling,
    tagName: tagName,
    setTextContent: setTextContent,
    getTextContent: getTextContent,
    isElement: isElement,
    isText: isText,
    isComment: isComment,
};
exports.default = exports.htmlDomApi;

},{}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.array = Array.isArray;
function primitive(s) {
    return typeof s === 'string' || typeof s === 'number';
}
exports.primitive = primitive;

},{}],22:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var xlinkNS = 'http://www.w3.org/1999/xlink';
var xmlNS = 'http://www.w3.org/XML/1998/namespace';
var colonChar = 58;
var xChar = 120;
function updateAttrs(oldVnode, vnode) {
    var key, elm = vnode.elm, oldAttrs = oldVnode.data.attrs, attrs = vnode.data.attrs;
    if (!oldAttrs && !attrs)
        return;
    if (oldAttrs === attrs)
        return;
    oldAttrs = oldAttrs || {};
    attrs = attrs || {};
    // update modified attributes, add new attributes
    for (key in attrs) {
        var cur = attrs[key];
        var old = oldAttrs[key];
        if (old !== cur) {
            if (cur === true) {
                elm.setAttribute(key, "");
            }
            else if (cur === false) {
                elm.removeAttribute(key);
            }
            else {
                if (key.charCodeAt(0) !== xChar) {
                    elm.setAttribute(key, cur);
                }
                else if (key.charCodeAt(3) === colonChar) {
                    // Assume xml namespace
                    elm.setAttributeNS(xmlNS, key, cur);
                }
                else if (key.charCodeAt(5) === colonChar) {
                    // Assume xlink namespace
                    elm.setAttributeNS(xlinkNS, key, cur);
                }
                else {
                    elm.setAttribute(key, cur);
                }
            }
        }
    }
    // remove removed attributes
    // use `in` operator since the previous `for` iteration uses it (.i.e. add even attributes with undefined value)
    // the other option is to remove all attributes with value == undefined
    for (key in oldAttrs) {
        if (!(key in attrs)) {
            elm.removeAttribute(key);
        }
    }
}
exports.attributesModule = { create: updateAttrs, update: updateAttrs };
exports.default = exports.attributesModule;

},{}],23:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function updateClass(oldVnode, vnode) {
    var cur, name, elm = vnode.elm, oldClass = oldVnode.data.class, klass = vnode.data.class;
    if (!oldClass && !klass)
        return;
    if (oldClass === klass)
        return;
    oldClass = oldClass || {};
    klass = klass || {};
    for (name in oldClass) {
        if (!klass[name]) {
            elm.classList.remove(name);
        }
    }
    for (name in klass) {
        cur = klass[name];
        if (cur !== oldClass[name]) {
            elm.classList[cur ? 'add' : 'remove'](name);
        }
    }
}
exports.classModule = { create: updateClass, update: updateClass };
exports.default = exports.classModule;

},{}],24:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function invokeHandler(handler, vnode, event) {
    if (typeof handler === "function") {
        // call function handler
        handler.call(vnode, event, vnode);
    }
    else if (typeof handler === "object") {
        // call handler with arguments
        if (typeof handler[0] === "function") {
            // special case for single argument for performance
            if (handler.length === 2) {
                handler[0].call(vnode, handler[1], event, vnode);
            }
            else {
                var args = handler.slice(1);
                args.push(event);
                args.push(vnode);
                handler[0].apply(vnode, args);
            }
        }
        else {
            // call multiple handlers
            for (var i = 0; i < handler.length; i++) {
                invokeHandler(handler[i], vnode, event);
            }
        }
    }
}
function handleEvent(event, vnode) {
    var name = event.type, on = vnode.data.on;
    // call event handler(s) if exists
    if (on && on[name]) {
        invokeHandler(on[name], vnode, event);
    }
}
function createListener() {
    return function handler(event) {
        handleEvent(event, handler.vnode);
    };
}
function updateEventListeners(oldVnode, vnode) {
    var oldOn = oldVnode.data.on, oldListener = oldVnode.listener, oldElm = oldVnode.elm, on = vnode && vnode.data.on, elm = (vnode && vnode.elm), name;
    // optimization for reused immutable handlers
    if (oldOn === on) {
        return;
    }
    // remove existing listeners which no longer used
    if (oldOn && oldListener) {
        // if element changed or deleted we remove all existing listeners unconditionally
        if (!on) {
            for (name in oldOn) {
                // remove listener if element was changed or existing listeners removed
                oldElm.removeEventListener(name, oldListener, false);
            }
        }
        else {
            for (name in oldOn) {
                // remove listener if existing listener removed
                if (!on[name]) {
                    oldElm.removeEventListener(name, oldListener, false);
                }
            }
        }
    }
    // add new listeners which has not already attached
    if (on) {
        // reuse existing listener or create new
        var listener = vnode.listener = oldVnode.listener || createListener();
        // update vnode for listener
        listener.vnode = vnode;
        // if element changed or added we add all needed listeners unconditionally
        if (!oldOn) {
            for (name in on) {
                // add listener if element was changed or new listeners added
                elm.addEventListener(name, listener, false);
            }
        }
        else {
            for (name in on) {
                // add listener if new listener added
                if (!oldOn[name]) {
                    elm.addEventListener(name, listener, false);
                }
            }
        }
    }
}
exports.eventListenersModule = {
    create: updateEventListeners,
    update: updateEventListeners,
    destroy: updateEventListeners
};
exports.default = exports.eventListenersModule;

},{}],25:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function updateProps(oldVnode, vnode) {
    var key, cur, old, elm = vnode.elm, oldProps = oldVnode.data.props, props = vnode.data.props;
    if (!oldProps && !props)
        return;
    if (oldProps === props)
        return;
    oldProps = oldProps || {};
    props = props || {};
    for (key in oldProps) {
        if (!props[key]) {
            delete elm[key];
        }
    }
    for (key in props) {
        cur = props[key];
        old = oldProps[key];
        if (old !== cur && (key !== 'value' || elm[key] !== cur)) {
            elm[key] = cur;
        }
    }
}
exports.propsModule = { create: updateProps, update: updateProps };
exports.default = exports.propsModule;

},{}],26:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vnode_1 = require("./vnode");
var is = require("./is");
var htmldomapi_1 = require("./htmldomapi");
function isUndef(s) { return s === undefined; }
function isDef(s) { return s !== undefined; }
var emptyNode = vnode_1.default('', {}, [], undefined, undefined);
function sameVnode(vnode1, vnode2) {
    return vnode1.key === vnode2.key && vnode1.sel === vnode2.sel;
}
function isVnode(vnode) {
    return vnode.sel !== undefined;
}
function createKeyToOldIdx(children, beginIdx, endIdx) {
    var i, map = {}, key, ch;
    for (i = beginIdx; i <= endIdx; ++i) {
        ch = children[i];
        if (ch != null) {
            key = ch.key;
            if (key !== undefined)
                map[key] = i;
        }
    }
    return map;
}
var hooks = ['create', 'update', 'remove', 'destroy', 'pre', 'post'];
var h_1 = require("./h");
exports.h = h_1.h;
var thunk_1 = require("./thunk");
exports.thunk = thunk_1.thunk;
function init(modules, domApi) {
    var i, j, cbs = {};
    var api = domApi !== undefined ? domApi : htmldomapi_1.default;
    for (i = 0; i < hooks.length; ++i) {
        cbs[hooks[i]] = [];
        for (j = 0; j < modules.length; ++j) {
            var hook = modules[j][hooks[i]];
            if (hook !== undefined) {
                cbs[hooks[i]].push(hook);
            }
        }
    }
    function emptyNodeAt(elm) {
        var id = elm.id ? '#' + elm.id : '';
        var c = elm.className ? '.' + elm.className.split(' ').join('.') : '';
        return vnode_1.default(api.tagName(elm).toLowerCase() + id + c, {}, [], undefined, elm);
    }
    function createRmCb(childElm, listeners) {
        return function rmCb() {
            if (--listeners === 0) {
                var parent_1 = api.parentNode(childElm);
                api.removeChild(parent_1, childElm);
            }
        };
    }
    function createElm(vnode, insertedVnodeQueue) {
        var i, data = vnode.data;
        if (data !== undefined) {
            if (isDef(i = data.hook) && isDef(i = i.init)) {
                i(vnode);
                data = vnode.data;
            }
        }
        var children = vnode.children, sel = vnode.sel;
        if (sel === '!') {
            if (isUndef(vnode.text)) {
                vnode.text = '';
            }
            vnode.elm = api.createComment(vnode.text);
        }
        else if (sel !== undefined) {
            // Parse selector
            var hashIdx = sel.indexOf('#');
            var dotIdx = sel.indexOf('.', hashIdx);
            var hash = hashIdx > 0 ? hashIdx : sel.length;
            var dot = dotIdx > 0 ? dotIdx : sel.length;
            var tag = hashIdx !== -1 || dotIdx !== -1 ? sel.slice(0, Math.min(hash, dot)) : sel;
            var elm = vnode.elm = isDef(data) && isDef(i = data.ns) ? api.createElementNS(i, tag)
                : api.createElement(tag);
            if (hash < dot)
                elm.setAttribute('id', sel.slice(hash + 1, dot));
            if (dotIdx > 0)
                elm.setAttribute('class', sel.slice(dot + 1).replace(/\./g, ' '));
            for (i = 0; i < cbs.create.length; ++i)
                cbs.create[i](emptyNode, vnode);
            if (is.array(children)) {
                for (i = 0; i < children.length; ++i) {
                    var ch = children[i];
                    if (ch != null) {
                        api.appendChild(elm, createElm(ch, insertedVnodeQueue));
                    }
                }
            }
            else if (is.primitive(vnode.text)) {
                api.appendChild(elm, api.createTextNode(vnode.text));
            }
            i = vnode.data.hook; // Reuse variable
            if (isDef(i)) {
                if (i.create)
                    i.create(emptyNode, vnode);
                if (i.insert)
                    insertedVnodeQueue.push(vnode);
            }
        }
        else {
            vnode.elm = api.createTextNode(vnode.text);
        }
        return vnode.elm;
    }
    function addVnodes(parentElm, before, vnodes, startIdx, endIdx, insertedVnodeQueue) {
        for (; startIdx <= endIdx; ++startIdx) {
            var ch = vnodes[startIdx];
            if (ch != null) {
                api.insertBefore(parentElm, createElm(ch, insertedVnodeQueue), before);
            }
        }
    }
    function invokeDestroyHook(vnode) {
        var i, j, data = vnode.data;
        if (data !== undefined) {
            if (isDef(i = data.hook) && isDef(i = i.destroy))
                i(vnode);
            for (i = 0; i < cbs.destroy.length; ++i)
                cbs.destroy[i](vnode);
            if (vnode.children !== undefined) {
                for (j = 0; j < vnode.children.length; ++j) {
                    i = vnode.children[j];
                    if (i != null && typeof i !== "string") {
                        invokeDestroyHook(i);
                    }
                }
            }
        }
    }
    function removeVnodes(parentElm, vnodes, startIdx, endIdx) {
        for (; startIdx <= endIdx; ++startIdx) {
            var i_1 = void 0, listeners = void 0, rm = void 0, ch = vnodes[startIdx];
            if (ch != null) {
                if (isDef(ch.sel)) {
                    invokeDestroyHook(ch);
                    listeners = cbs.remove.length + 1;
                    rm = createRmCb(ch.elm, listeners);
                    for (i_1 = 0; i_1 < cbs.remove.length; ++i_1)
                        cbs.remove[i_1](ch, rm);
                    if (isDef(i_1 = ch.data) && isDef(i_1 = i_1.hook) && isDef(i_1 = i_1.remove)) {
                        i_1(ch, rm);
                    }
                    else {
                        rm();
                    }
                }
                else {
                    api.removeChild(parentElm, ch.elm);
                }
            }
        }
    }
    function updateChildren(parentElm, oldCh, newCh, insertedVnodeQueue) {
        var oldStartIdx = 0, newStartIdx = 0;
        var oldEndIdx = oldCh.length - 1;
        var oldStartVnode = oldCh[0];
        var oldEndVnode = oldCh[oldEndIdx];
        var newEndIdx = newCh.length - 1;
        var newStartVnode = newCh[0];
        var newEndVnode = newCh[newEndIdx];
        var oldKeyToIdx;
        var idxInOld;
        var elmToMove;
        var before;
        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
            if (oldStartVnode == null) {
                oldStartVnode = oldCh[++oldStartIdx]; // Vnode might have been moved left
            }
            else if (oldEndVnode == null) {
                oldEndVnode = oldCh[--oldEndIdx];
            }
            else if (newStartVnode == null) {
                newStartVnode = newCh[++newStartIdx];
            }
            else if (newEndVnode == null) {
                newEndVnode = newCh[--newEndIdx];
            }
            else if (sameVnode(oldStartVnode, newStartVnode)) {
                patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue);
                oldStartVnode = oldCh[++oldStartIdx];
                newStartVnode = newCh[++newStartIdx];
            }
            else if (sameVnode(oldEndVnode, newEndVnode)) {
                patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue);
                oldEndVnode = oldCh[--oldEndIdx];
                newEndVnode = newCh[--newEndIdx];
            }
            else if (sameVnode(oldStartVnode, newEndVnode)) {
                patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
                api.insertBefore(parentElm, oldStartVnode.elm, api.nextSibling(oldEndVnode.elm));
                oldStartVnode = oldCh[++oldStartIdx];
                newEndVnode = newCh[--newEndIdx];
            }
            else if (sameVnode(oldEndVnode, newStartVnode)) {
                patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue);
                api.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
                oldEndVnode = oldCh[--oldEndIdx];
                newStartVnode = newCh[++newStartIdx];
            }
            else {
                if (oldKeyToIdx === undefined) {
                    oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
                }
                idxInOld = oldKeyToIdx[newStartVnode.key];
                if (isUndef(idxInOld)) {
                    api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
                    newStartVnode = newCh[++newStartIdx];
                }
                else {
                    elmToMove = oldCh[idxInOld];
                    if (elmToMove.sel !== newStartVnode.sel) {
                        api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
                    }
                    else {
                        patchVnode(elmToMove, newStartVnode, insertedVnodeQueue);
                        oldCh[idxInOld] = undefined;
                        api.insertBefore(parentElm, elmToMove.elm, oldStartVnode.elm);
                    }
                    newStartVnode = newCh[++newStartIdx];
                }
            }
        }
        if (oldStartIdx <= oldEndIdx || newStartIdx <= newEndIdx) {
            if (oldStartIdx > oldEndIdx) {
                before = newCh[newEndIdx + 1] == null ? null : newCh[newEndIdx + 1].elm;
                addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx, insertedVnodeQueue);
            }
            else {
                removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx);
            }
        }
    }
    function patchVnode(oldVnode, vnode, insertedVnodeQueue) {
        var i, hook;
        if (isDef(i = vnode.data) && isDef(hook = i.hook) && isDef(i = hook.prepatch)) {
            i(oldVnode, vnode);
        }
        var elm = vnode.elm = oldVnode.elm;
        var oldCh = oldVnode.children;
        var ch = vnode.children;
        if (oldVnode === vnode)
            return;
        if (vnode.data !== undefined) {
            for (i = 0; i < cbs.update.length; ++i)
                cbs.update[i](oldVnode, vnode);
            i = vnode.data.hook;
            if (isDef(i) && isDef(i = i.update))
                i(oldVnode, vnode);
        }
        if (isUndef(vnode.text)) {
            if (isDef(oldCh) && isDef(ch)) {
                if (oldCh !== ch)
                    updateChildren(elm, oldCh, ch, insertedVnodeQueue);
            }
            else if (isDef(ch)) {
                if (isDef(oldVnode.text))
                    api.setTextContent(elm, '');
                addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
            }
            else if (isDef(oldCh)) {
                removeVnodes(elm, oldCh, 0, oldCh.length - 1);
            }
            else if (isDef(oldVnode.text)) {
                api.setTextContent(elm, '');
            }
        }
        else if (oldVnode.text !== vnode.text) {
            if (isDef(oldCh)) {
                removeVnodes(elm, oldCh, 0, oldCh.length - 1);
            }
            api.setTextContent(elm, vnode.text);
        }
        if (isDef(hook) && isDef(i = hook.postpatch)) {
            i(oldVnode, vnode);
        }
    }
    return function patch(oldVnode, vnode) {
        var i, elm, parent;
        var insertedVnodeQueue = [];
        for (i = 0; i < cbs.pre.length; ++i)
            cbs.pre[i]();
        if (!isVnode(oldVnode)) {
            oldVnode = emptyNodeAt(oldVnode);
        }
        if (sameVnode(oldVnode, vnode)) {
            patchVnode(oldVnode, vnode, insertedVnodeQueue);
        }
        else {
            elm = oldVnode.elm;
            parent = api.parentNode(elm);
            createElm(vnode, insertedVnodeQueue);
            if (parent !== null) {
                api.insertBefore(parent, vnode.elm, api.nextSibling(elm));
                removeVnodes(parent, [oldVnode], 0, 0);
            }
        }
        for (i = 0; i < insertedVnodeQueue.length; ++i) {
            insertedVnodeQueue[i].data.hook.insert(insertedVnodeQueue[i]);
        }
        for (i = 0; i < cbs.post.length; ++i)
            cbs.post[i]();
        return vnode;
    };
}
exports.init = init;

},{"./h":19,"./htmldomapi":20,"./is":21,"./thunk":27,"./vnode":29}],27:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var h_1 = require("./h");
function copyToThunk(vnode, thunk) {
    thunk.elm = vnode.elm;
    vnode.data.fn = thunk.data.fn;
    vnode.data.args = thunk.data.args;
    thunk.data = vnode.data;
    thunk.children = vnode.children;
    thunk.text = vnode.text;
    thunk.elm = vnode.elm;
}
function init(thunk) {
    var cur = thunk.data;
    var vnode = cur.fn.apply(undefined, cur.args);
    copyToThunk(vnode, thunk);
}
function prepatch(oldVnode, thunk) {
    var i, old = oldVnode.data, cur = thunk.data;
    var oldArgs = old.args, args = cur.args;
    if (old.fn !== cur.fn || oldArgs.length !== args.length) {
        copyToThunk(cur.fn.apply(undefined, args), thunk);
        return;
    }
    for (i = 0; i < args.length; ++i) {
        if (oldArgs[i] !== args[i]) {
            copyToThunk(cur.fn.apply(undefined, args), thunk);
            return;
        }
    }
    copyToThunk(oldVnode, thunk);
}
exports.thunk = function thunk(sel, key, fn, args) {
    if (args === undefined) {
        args = fn;
        fn = key;
        key = undefined;
    }
    return h_1.h(sel, {
        key: key,
        hook: { init: init, prepatch: prepatch },
        fn: fn,
        args: args
    });
};
exports.default = exports.thunk;

},{"./h":19}],28:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vnode_1 = require("./vnode");
var htmldomapi_1 = require("./htmldomapi");
function toVNode(node, domApi) {
    var api = domApi !== undefined ? domApi : htmldomapi_1.default;
    var text;
    if (api.isElement(node)) {
        var id = node.id ? '#' + node.id : '';
        var cn = node.getAttribute('class');
        var c = cn ? '.' + cn.split(' ').join('.') : '';
        var sel = api.tagName(node).toLowerCase() + id + c;
        var attrs = {};
        var children = [];
        var name_1;
        var i = void 0, n = void 0;
        var elmAttrs = node.attributes;
        var elmChildren = node.childNodes;
        for (i = 0, n = elmAttrs.length; i < n; i++) {
            name_1 = elmAttrs[i].nodeName;
            if (name_1 !== 'id' && name_1 !== 'class') {
                attrs[name_1] = elmAttrs[i].nodeValue;
            }
        }
        for (i = 0, n = elmChildren.length; i < n; i++) {
            children.push(toVNode(elmChildren[i], domApi));
        }
        return vnode_1.default(sel, { attrs: attrs }, children, undefined, node);
    }
    else if (api.isText(node)) {
        text = api.getTextContent(node);
        return vnode_1.default(undefined, undefined, undefined, text, node);
    }
    else if (api.isComment(node)) {
        text = api.getTextContent(node);
        return vnode_1.default('!', {}, [], text, node);
    }
    else {
        return vnode_1.default('', {}, [], undefined, node);
    }
}
exports.toVNode = toVNode;
exports.default = toVNode;

},{"./htmldomapi":20,"./vnode":29}],29:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function vnode(sel, data, children, text, elm) {
    var key = data === undefined ? undefined : data.key;
    return { sel: sel, data: data, children: children,
        text: text, elm: elm, key: key };
}
exports.vnode = vnode;
exports.default = vnode;

},{}],30:[function(require,module,exports){
function noop() {}

module.exports = function (url, opts) {
	opts = opts || {};

	var ws, num=0, timer=1, $={};
	var max = opts.maxAttempts || Infinity;

	$.open = function () {
		ws = new WebSocket(url, opts.protocols || []);

		ws.onmessage = opts.onmessage || noop;

		ws.onopen = function (e) {
			(opts.onopen || noop)(e);
			num = 0;
		};

		ws.onclose = function (e) {
			e.code === 1e3 || e.code === 1001 || e.code === 1005 || $.reconnect(e);
			(opts.onclose || noop)(e);
		};

		ws.onerror = function (e) {
			(e && e.code==='ECONNREFUSED') ? $.reconnect(e) : (opts.onerror || noop)(e);
		};
	};

	$.reconnect = function (e) {
		if (timer && num++ < max) {
			timer = setTimeout(function () {
				(opts.onreconnect || noop)(e);
				$.open();
			}, opts.timeout || 1e3);
		} else {
			(opts.onmaximum || noop)(e);
		}
	};

	$.json = function (x) {
		ws.send(JSON.stringify(x));
	};

	$.send = function (x) {
		ws.send(x);
	};

	$.close = function (x, y) {
		timer = clearTimeout(timer);
		ws.close(x || 1e3, y);
	};

	$.open(); // init

	return $;
}

},{}],31:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const h_1 = __importDefault(require("snabbdom/h"));
function chatView(ctrl, chatType) {
    function onKeyPress(e) {
        const message = e.target.value;
        if ((e.keyCode == 13 || e.which == 13) && message.length > 0) {
            chatMessage(ctrl.model['username'], message, chatType);
            ctrl.sock.send(JSON.stringify({ "type": chatType, "message": message, "gameId": ctrl.model["gameId"] }));
            e.target.value = "";
        }
    }
    return h_1.default(`div.${chatType}#${chatType}`, { class: { "chat": true } }, [
        h_1.default(`ol#${chatType}-messages`, [h_1.default("div#messages")]),
        h_1.default('input#chat-entry', {
            props: {
                type: "text",
                name: "entry",
                autocomplete: "off",
                placeholder: "Please be nice in the chat!",
                maxlength: "140",
            },
            on: { keypress: (e) => onKeyPress(e) },
        })
    ]);
}
exports.chatView = chatView;
function chatMessage(user, message, chatType) {
    const myDiv = document.getElementById(chatType + '-messages');
    // You must add border widths, padding and margins to the right.
    const isScrolled = myDiv.scrollTop == myDiv.scrollHeight - myDiv.offsetHeight;
    var container = document.getElementById('messages');
    if (user.length === 0) {
        patch(container, h_1.default('div#messages', [h_1.default("li.message.offer", [h_1.default("t", message)])]));
    }
    else if (user === '_server') {
        patch(container, h_1.default('div#messages', [h_1.default("li.message.server", [h_1.default("user", 'Server'), h_1.default("t", message)])]));
    }
    else {
        patch(container, h_1.default('div#messages', [h_1.default("li.message", [h_1.default("user", user), h_1.default("t", message)])]));
    }
    ;
    if (isScrolled)
        myDiv.scrollTop = myDiv.scrollHeight;
}
exports.chatMessage = chatMessage;

},{"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],32:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("chessgroundx/util");
exports.variants = ["makruk", "sittuyin", "placement", "crazyhouse", "standard", "shogi", "xiangqi", "capablanca", "seirawan", "capahouse", "shouse", "grand", "grandhouse"];
exports.variants960 = ["crazyhouse", "standard", "capablanca", "capahouse"];
exports.VARIANTS = {
    makruk: { geom: 0 /* dim8x8 */, cg: "cg-512", board: "grid", pieces: "makruk", css: ["makruk"], icon: "Q" },
    sittuyin: { geom: 0 /* dim8x8 */, cg: "cg-512", board: "gridx", pieces: "makruk", css: ["makruk", "makruks"], icon: "R" },
    shogi: { geom: 1 /* dim9x9 */, cg: "cg-576", board: "grid9x9", pieces: "shogi", css: ["shogi0k", "shogi0", "shogi0w", "shogi0p"], icon: "K" },
    xiangqi: { geom: 3 /* dim9x10 */, cg: "cg-576-640", board: "river", pieces: "xiangqi", css: ["xiangqi", "xiangqie", "xiangqict2", "xiangqihnz"], icon: "O" },
    placement: { geom: 0 /* dim8x8 */, cg: "cg-512", board: "brown", pieces: "standard", css: ["standard", "green"], icon: "S" },
    crazyhouse: { geom: 0 /* dim8x8 */, cg: "cg-512", board: "brown", pieces: "standard", css: ["standard", "green"], icon: "H" },
    capablanca: { geom: 2 /* dim10x8 */, cg: "cg-640", board: "capablanca", pieces: "standard", css: ["capasei0", "capasei1", "capasei2"], icon: "P" },
    capahouse: { geom: 2 /* dim10x8 */, cg: "cg-640", board: "capablanca", pieces: "standard", css: ["capasei0", "capasei1", "capasei2"], icon: "P" },
    grand: { geom: 4 /* dim10x10 */, cg: "cg-640-640", board: "grand", pieces: "standard", css: ["capasei0", "capasei1", "capasei2"], icon: "G" },
    grandhouse: { geom: 4 /* dim10x10 */, cg: "cg-640-640", board: "grand", pieces: "standard", css: ["capasei0", "capasei1", "capasei2"], icon: "G" },
    seirawan: { geom: 0 /* dim8x8 */, cg: "cg-512", board: "brown", pieces: "standard", css: ["capasei1", "capasei0", "capasei2"], icon: "L" },
    shouse: { geom: 0 /* dim8x8 */, cg: "cg-512", board: "brown", pieces: "standard", css: ["capasei1", "capasei0", "capasei2"], icon: "L" },
    standard: { geom: 0 /* dim8x8 */, cg: "cg-512", board: "brown", pieces: "standard", css: ["standard", "green"], icon: "M" },
};
function pocketRoles(variant) {
    switch (variant) {
        case "sittuyin":
            return ["rook", "knight", "silver", "ferz", "king"];
        case "crazyhouse":
            return ["pawn", "knight", "bishop", "rook", "queen"];
        case "grandhouse":
        case "capahouse":
            return ["pawn", "knight", "bishop", "rook", "queen", "archbishop", "cancellor"];
        case "shogi":
            return ["pawn", "lance", "knight", "bishop", "rook", "silver", "gold"];
        case "shouse":
            return ["pawn", "knight", "bishop", "rook", "queen", "elephant", "hawk"];
        case "seirawan":
            return ["elephant", "hawk"];
        default:
            return ["rook", "knight", "bishop", "queen", "king"];
    }
}
exports.pocketRoles = pocketRoles;
function promotionZone(variant, color) {
    switch (variant) {
        case 'shogi':
            return color === 'white' ? 'a9b9c9d9e9f9g9h9i9a8b8c8d8e8f8g8h8i8a7b7c7d7e7f7g7h7i7' : 'a1b1c1d1e1f1g1h1i1a2b2c2d2e2f2g2h2i2a3b3c3d3e3f3g3h3i3';
        case 'makruk':
            return color === 'white' ? 'a6b6c6d6e6f6g6h6' : 'a3b3c3d3e3f3g3h3';
        case 'sittuyin':
            return color === 'white' ? 'a8b7c6d5e5f6g7h8' : 'a1b2c3d4e4f3g2h1';
        default:
            return color === 'white' ? 'a8b8c8d8e8f8g8h8i8j8' : 'a1b1c1d1e1f1g1h1i1j1';
    }
}
function promotionRoles(variant, role, orig, dest, promotions) {
    switch (variant) {
        case "capahouse":
        case "capablanca":
            return ["queen", "knight", "rook", "bishop", "archbishop", "cancellor"];
        case "shouse":
        case "seirawan":
            return ["queen", "knight", "rook", "bishop", "elephant", "hawk"];
        case "shogi":
            return ["p" + role, role];
        case "grandhouse":
        case "grand":
            var roles = [];
            const moves = promotions.map((move) => move.slice(0, -1));
            promotions.forEach((move) => {
                const prole = exports.sanToRole[move.slice(-1)];
                if (moves.indexOf(orig + dest) !== -1 && roles.indexOf(prole) === -1) {
                    roles.push(prole);
                }
            });
            // promotion is optional except on back ranks
            if ((dest[1] !== "9") && (dest[1] !== "0"))
                roles.push(role);
            return roles;
        default:
            return ["queen", "knight", "rook", "bishop"];
    }
}
exports.promotionRoles = promotionRoles;
function mandatoryPromotion(role, dest, color) {
    switch (role) {
        case "pawn":
        case "lance":
            if (color === "white") {
                return dest[1] === "9";
            }
            else {
                return dest[1] === "1";
            }
        case "knight":
            if (color === "white") {
                return dest[1] === "9" || dest[1] === "8";
            }
            else {
                return dest[1] === "1" || dest[1] === "2";
            }
        default:
            return false;
    }
}
exports.mandatoryPromotion = mandatoryPromotion;
function needPockets(variant) {
    return variant === 'placement' || variant === 'crazyhouse' || variant === 'sittuyin' || variant === 'shogi' || variant === 'seirawan' || variant === 'capahouse' || variant === 'shouse' || variant === 'grandhouse';
}
exports.needPockets = needPockets;
function hasEp(variant) {
    return variant === 'standard' || variant === 'placement' || variant === 'crazyhouse' || variant === 'capablanca' || variant === 'seirawan' || variant === 'capahouse' || variant === 'shouse' || variant === 'grand' || variant === 'grandhouse';
}
exports.hasEp = hasEp;
function diff(a, b) {
    return Math.abs(a - b);
}
function diagonalMove(pos1, pos2) {
    const xd = diff(pos1[0], pos2[0]);
    const yd = diff(pos1[1], pos2[1]);
    return xd === yd && xd === 1;
}
function canGate(fen, piece, orig, dest, meta) {
    console.log("   isGating()", fen, piece, orig, dest, meta);
    const no_gate = [false, false, false, false, false, false];
    if ((piece.color === "white" && orig.slice(1) !== "1") ||
        (piece.color === "black" && orig.slice(1) !== "8") ||
        (piece.role === "hawk") ||
        (piece.role === "elephant"))
        return no_gate;
    // In starting position king and(!) rook virginity is encoded in KQkq
    // "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[HEhe] w KQBCDFGkqbcdfg - 0 1"
    // but after kings moved rook virginity is encoded in AHah
    // rnbq1bnr/ppppkppp/8/4p3/4P3/8/PPPPKPPP/RNBQ1BNR[HEhe] w ABCDFGHabcdfgh - 2 3
    // king virginity is encoded in Ee after any Rook moved but King not
    const parts = fen.split(" ");
    const placement = parts[0];
    const color = parts[1];
    const castl = parts[2];
    // console.log("isGating()", orig, placement, color, castl);
    switch (orig) {
        case "a1":
            if (castl.indexOf("A") === -1 && castl.indexOf("Q") === -1)
                return no_gate;
            break;
        case "b1":
            if (castl.indexOf("B") === -1)
                return no_gate;
            break;
        case "c1":
            if (castl.indexOf("C") === -1)
                return no_gate;
            break;
        case "d1":
            if (castl.indexOf("D") === -1)
                return no_gate;
            break;
        case "e1":
            if (piece.role !== "king") {
                return no_gate;
            }
            else if ((castl.indexOf("K") === -1) && (castl.indexOf("Q") === -1)) {
                return no_gate;
            }
            else if (castl.indexOf("E") === -1) {
                return no_gate;
            }
            ;
            break;
        case "f1":
            if (castl.indexOf("F") === -1)
                return no_gate;
            break;
        case "g1":
            if (castl.indexOf("G") === -1)
                return no_gate;
            break;
        case "h1":
            if (castl.indexOf("H") === -1 && castl.indexOf("K") === -1)
                return no_gate;
            break;
        case "a8":
            if (castl.indexOf("a") === -1 && castl.indexOf("q") === -1)
                return no_gate;
            break;
        case "b8":
            if (castl.indexOf("b") === -1)
                return no_gate;
            break;
        case "c8":
            if (castl.indexOf("c") === -1)
                return no_gate;
            break;
        case "d8":
            if (castl.indexOf("d") === -1)
                return no_gate;
            break;
        case "e8":
            if (piece.role !== "king") {
                return no_gate;
            }
            else if ((castl.indexOf("k") === -1) && (castl.indexOf("q") === -1)) {
                return no_gate;
            }
            else if (castl.indexOf("e") === -1) {
                return no_gate;
            }
            ;
            break;
        case "f8":
            if (castl.indexOf("f") === -1)
                return no_gate;
            break;
        case "g8":
            if (castl.indexOf("g") === -1)
                return no_gate;
            break;
        case "h8":
            if (castl.indexOf("h") === -1 && castl.indexOf("k") === -1)
                return no_gate;
            break;
    }
    ;
    const bracketPos = placement.indexOf("[");
    const pockets = placement.slice(bracketPos);
    const ph = lc(pockets, "h", color === 'w') !== 0;
    const pe = lc(pockets, "e", color === 'w') !== 0;
    const pq = lc(pockets, "q", color === 'w') !== 0;
    const pr = lc(pockets, "r", color === 'w') !== 0;
    const pb = lc(pockets, "b", color === 'w') !== 0;
    const pn = lc(pockets, "n", color === 'w') !== 0;
    return [ph, pe, pq, pr, pb, pn];
}
exports.canGate = canGate;
function isPromotion(variant, piece, orig, dest, meta, promotions) {
    if (variant === 'xiangqi')
        return false;
    const pz = promotionZone(variant, piece.color);
    switch (variant) {
        case 'shogi':
            return ['king', 'gold', 'ppawn', 'pknight', 'pbishop', 'prook', 'psilver', 'plance'].indexOf(piece.role) === -1
                && (pz.indexOf(orig) !== -1 || pz.indexOf(dest) !== -1);
        case 'sittuyin':
            // See https://vdocuments.net/how-to-play-myanmar-traditional-chess-eng-book-1.html
            const firstRankIs0 = false;
            const dm = diagonalMove(util_1.key2pos(orig, firstRankIs0), util_1.key2pos(dest, firstRankIs0));
            return piece.role === "pawn" && (orig === dest || (!meta.captured && dm));
        case 'grandhouse':
        case 'grand':
            // TODO: we can use this for other variants also
            return promotions.map((move) => move.slice(0, -1)).indexOf(orig + dest) !== -1;
        default:
            return piece.role === "pawn" && pz.indexOf(dest) !== -1;
    }
}
exports.isPromotion = isPromotion;
function uci2usi(move) {
    const parts = move.split("");
    if (parts[1] === "@") {
        parts[1] = "*";
        parts[2] = String.fromCharCode(parts[2].charCodeAt() - 48);
        parts[3] = String.fromCharCode(parts[3].charCodeAt() + 48);
    }
    else {
        parts[0] = String.fromCharCode(parts[0].charCodeAt() - 48);
        parts[1] = String.fromCharCode(parts[1].charCodeAt() + 48);
        parts[2] = String.fromCharCode(parts[2].charCodeAt() - 48);
        parts[3] = String.fromCharCode(parts[3].charCodeAt() + 48);
    }
    return parts.join("");
}
exports.uci2usi = uci2usi;
function usi2uci(move) {
    console.log("usi2uci()", move);
    const parts = move.split("");
    if (parts[1] === "*") {
        parts[1] = "@";
        parts[2] = String.fromCharCode(parts[2].charCodeAt() + 48);
        parts[3] = String.fromCharCode(parts[3].charCodeAt() - 48);
    }
    else {
        parts[0] = String.fromCharCode(parts[0].charCodeAt() + 48);
        parts[1] = String.fromCharCode(parts[1].charCodeAt() - 48);
        parts[2] = String.fromCharCode(parts[2].charCodeAt() + 48);
        parts[3] = String.fromCharCode(parts[3].charCodeAt() - 48);
    }
    return parts.join("");
}
exports.usi2uci = usi2uci;
function zero2grand(move) {
    const parts = move.split("");
    if (parts[1] !== "@") {
        parts[1] = String(Number(parts[1]) + 1);
    }
    parts[3] = String(Number(parts[3]) + 1);
    return parts.join("");
}
exports.zero2grand = zero2grand;
function grand2zero(move) {
    // cut off promotion piece letter
    var promo = '';
    if ('0123456789'.indexOf(move.slice(-1)) === -1) {
        promo = move.slice(-1);
        move = move.slice(0, -1);
    }
    const parts = move.split("");
    if (parts[1] === '@') {
        return parts[0] + parts[1] + parts[2] + String(Number(move.slice(3)) - 1);
    }
    if ('0123456789'.indexOf(parts[2]) !== -1) {
        parts[1] = String(Number(parts[1] + parts[2]) - 1);
        parts[4] = String(Number(move.slice(4)) - 1);
        return parts[0] + parts[1] + parts[3] + parts[4] + promo;
    }
    else {
        parts[1] = String(Number(parts[1]) - 1);
        parts[3] = String(Number(move.slice(3)) - 1);
        return parts[0] + parts[1] + parts[2] + parts[3] + promo;
    }
}
exports.grand2zero = grand2zero;
exports.roleToSan = {
    pawn: 'P',
    knight: 'N',
    bishop: 'B',
    rook: 'R',
    queen: 'Q',
    king: 'K',
    archbishop: 'A',
    cancellor: 'C',
    elephant: "E",
    hawk: "H",
    ferz: 'F',
    met: 'M',
    gold: 'G',
    silver: 'S',
    lance: 'L',
};
exports.sanToRole = {
    P: 'pawn',
    N: 'knight',
    B: 'bishop',
    R: 'rook',
    Q: 'queen',
    K: 'king',
    A: 'archbishop',
    C: 'cancellor',
    E: 'elephant',
    H: 'hawk',
    F: 'ferz',
    M: 'met',
    G: 'gold',
    S: 'silver',
    L: 'lance',
    p: 'pawn',
    n: 'knight',
    b: 'bishop',
    r: 'rook',
    q: 'queen',
    k: 'king',
    a: 'archbishop',
    c: 'cancellor',
    e: 'elephant',
    h: 'hawk',
    f: 'ferz',
    m: 'met',
    g: 'gold',
    s: 'silver',
    l: 'lance',
};
// Count given letter occurences in a string
function lc(str, letter, uppercase) {
    var letterCount = 0;
    if (uppercase)
        letter = letter.toUpperCase();
    for (var position = 0; position < str.length; position++) {
        if (str.charAt(position) === letter)
            letterCount += 1;
    }
    return letterCount;
}
exports.lc = lc;

},{"chessgroundx/util":17}],33:[function(require,module,exports){
"use strict";
// https://stackoverflow.com/questions/20618355/the-simplest-possible-javascript-countdown-timer
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
class Clock {
    // game baseTime (min) and increment (sec)
    constructor(baseTime, increment, el, id) {
        this.start = (duration) => {
            if (this.running)
                return;
            if (typeof duration !== "undefined")
                this.duration = duration;
            this.running = true;
            this.startTime = Date.now();
            var that = this;
            var diff;
            (function timer() {
                diff = that.duration - (Date.now() - that.startTime);
                // console.log("timer()", that.duration, that.startTime, diff);
                if (diff <= 0) {
                    that.flagCallback();
                    that.pause(false);
                    return;
                }
                that.timeout = setTimeout(timer, that.granularity);
                that.tickCallbacks.forEach(function (callback) {
                    callback.call(that, that, diff);
                }, that);
            }());
        };
        this.onTick = (callback) => {
            if (typeof callback === 'function') {
                this.tickCallbacks.push(callback);
            }
            return this;
        };
        this.onFlag = (callback) => {
            if (typeof callback === 'function') {
                this.pause(false);
                this.flagCallback = callback;
            }
            return this;
        };
        this.pause = (withIncrement) => {
            if (!this.running)
                return;
            this.running = false;
            if (this.timeout)
                clearTimeout(this.timeout);
            this.timeout = null;
            this.duration -= Date.now() - this.startTime;
            if (withIncrement && this.increment)
                this.duration += this.increment;
            renderTime(this, this.duration);
        };
        this.setTime = (millis) => {
            this.duration = millis;
            renderTime(this, this.duration);
        };
        this.parseTime = (millis) => {
            let minutes = Math.floor(millis / 60000);
            let seconds = (millis % 60000) / 1000;
            let secs, mins;
            if (Math.floor(seconds) == 60) {
                minutes++;
                seconds = 0;
            }
            minutes = Math.max(0, minutes);
            seconds = Math.max(0, seconds);
            if (millis < 10000) {
                secs = seconds.toFixed(1);
            }
            else {
                secs = String(Math.floor(seconds));
            }
            mins = (minutes < 10 ? "0" : "") + String(minutes);
            secs = (seconds < 10 ? "0" : "") + secs;
            return {
                minutes: mins,
                seconds: secs,
            };
        };
        this.duration = baseTime * 1000 * 60;
        this.increment = increment * 1000;
        this.granularity = 500;
        this.running = false;
        this.connecting = false;
        this.timeout = null;
        this.startTime = null;
        this.tickCallbacks = [];
        this.flagCallback = null;
        this.el = el;
        this.id = id;
        renderTime(this, this.duration);
    }
}
exports.Clock = Clock;
function renderTime(clock, time) {
    if (clock.granularity > 100 && time < 10000)
        clock.granularity = 100;
    const parsed = clock.parseTime(time);
    // console.log("renderTime():", time, parsed);
    const date = new Date(time);
    const millis = date.getUTCMilliseconds();
    clock.el = patch(clock.el, snabbdom_1.h('div.clock-wrap#' + clock.id, [
        snabbdom_1.h('div.clock', [
            snabbdom_1.h('div.clock.time.min', { class: { running: clock.running, hurry: time < 10000, connecting: clock.connecting } }, parsed.minutes),
            snabbdom_1.h('div.clock.sep', { class: { running: clock.running, hurry: time < 10000, low: millis < 500, connecting: clock.connecting } }, ':'),
            snabbdom_1.h('div.clock.time.sec', { class: { running: clock.running, hurry: time < 10000, connecting: clock.connecting } }, parsed.seconds)
        ])
    ]));
}
exports.renderTime = renderTime;
function timeago(date) {
    const TZdate = new Date(date + 'Z');
    var val = 0 | (Date.now() - TZdate.getTime()) / 1000;
    var unit, length = { second: 60, minute: 60, hour: 24, day: 7, week: 4.35,
        month: 12, year: 10000 }, result;
    for (unit in length) {
        result = val % length[unit];
        if (!(val = 0 | val / length[unit]))
            return result + ' ' + (result - 1 ? unit + 's' : unit) + ' ago';
    }
    return '';
}
exports.timeago = timeago;
function renderTimeago() {
    var x = document.getElementsByTagName("info-date");
    var i;
    for (i = 0; i < x.length; i++) {
        x[i].innerHTML = timeago(x[i].getAttribute('timestamp'));
    }
    setTimeout(renderTimeago, 1200);
}
exports.renderTimeago = renderTimeago;

},{"snabbdom":26,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],34:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sockette_1 = __importDefault(require("sockette"));
const snabbdom_1 = require("snabbdom");
const h_1 = require("snabbdom/h");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const util_1 = require("chessgroundx/util");
const chessgroundx_1 = require("chessgroundx");
const drop_1 = require("chessgroundx/drop");
const clock_1 = require("./clock");
const gating_1 = __importDefault(require("./gating"));
const promotion_1 = __importDefault(require("./promotion"));
const pocket_1 = require("./pocket");
const sound_1 = require("./sound");
const chess_1 = require("./chess");
const user_1 = require("./user");
const chat_1 = require("./chat");
const settings_1 = require("./settings");
const movelist_1 = require("./movelist");
const resize_1 = __importDefault(require("./resize"));
const profile_1 = require("./profile");
const player_1 = require("./player");
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
class RoundController {
    constructor(el, model) {
        this.getGround = () => this.chessground;
        this.getDests = () => this.dests;
        this.onMsgGameStart = (msg) => {
            // console.log("got gameStart msg:", msg);
            if (msg.gameId !== this.model["gameId"])
                return;
            if (!this.spectator)
                sound_1.sound.genericNotify();
        };
        this.onMsgNewGame = (msg) => {
            console.log("GameController.onMsgNewGame()", this.model["gameId"]);
            window.location.assign(this.model["home"] + '/' + msg["gameId"]);
        };
        this.rematch = () => {
            console.log("REMATCH");
            this.doSend({ type: "rematch", gameId: this.model["gameId"] });
            // window.location.assign(home);
        };
        this.newOpponent = (home) => {
            window.location.assign(home);
        };
        this.gameOver = () => {
            this.gameControls = patch(this.gameControls, h_1.h('div'));
            var container = document.getElementById('after-game');
            if (this.spectator) {
                patch(container, h_1.h('div.after-game', [h_1.h('result', profile_1.result(this.status, this.result))]));
            }
            else {
                patch(container, h_1.h('div.after-game', [
                    h_1.h('result', profile_1.result(this.status, this.result)),
                    h_1.h('button.rematch', { on: { click: () => this.rematch() } }, "REMATCH"),
                    h_1.h('button.newopp', { on: { click: () => this.newOpponent(this.model["home"]) } }, "NEW OPPONENT"),
                ]));
            }
        };
        this.checkStatus = (msg) => {
            if (msg.gameId !== this.model["gameId"])
                return;
            if (msg.status >= 0 && this.result === "") {
                this.clocks[0].pause(false);
                this.clocks[1].pause(false);
                this.result = msg.result;
                this.status = msg.status;
                switch (msg.result) {
                    case "1/2-1/2":
                        sound_1.sound.draw();
                        break;
                    case "1-0":
                        if (!this.spectator) {
                            if (this.mycolor === "white") {
                                sound_1.sound.victory();
                            }
                            else {
                                sound_1.sound.defeat();
                            }
                        }
                        break;
                    case "0-1":
                        if (!this.spectator) {
                            if (this.mycolor === "black") {
                                sound_1.sound.victory();
                            }
                            else {
                                sound_1.sound.defeat();
                            }
                        }
                        break;
                    // ABORTED
                    default:
                        break;
                }
                this.gameOver();
                // clean up gating/promotion widget left over the ground while game ended by time out
                var container = document.getElementById('extension_choice');
                if (container instanceof Element)
                    patch(container, h_1.h('extension'));
                // TODO: move this to (not implemented yet) analysis page
                this.pgn = msg.pgn;
                var container = document.getElementById('pgn');
                this.vpng = patch(container, h_1.h('div#pgn', [h_1.h('div', this.fullfen), h_1.h('textarea', { attrs: { rows: 13 } }, msg.pgn)]));
                if (this.tv) {
                    setInterval(() => { this.doSend({ type: "updateTV", gameId: this.model["gameId"], profileId: this.model["profileid"] }); }, 2000);
                }
            }
        };
        this.onMsgUpdateTV = (msg) => {
            if (msg.gameId !== this.model["gameId"]) {
                window.location.assign(this.model["home"] + '/tv');
            }
        };
        this.onMsgBoard = (msg) => {
            if (msg.gameId !== this.model["gameId"])
                return;
            // console.log("got board msg:", msg);
            this.ply = msg.ply;
            this.fullfen = msg.fen;
            this.dests = msg.dests;
            // list of legal promotion moves
            this.promotions = msg.promo;
            const clocks = msg.clocks;
            const parts = msg.fen.split(" ");
            this.turnColor = parts[1] === "w" ? "white" : "black";
            if (msg.steps.length > 1) {
                this.steps = [];
                var container = document.getElementById('movelist');
                patch(container, h_1.h('div#movelist'));
                msg.steps.forEach((step) => {
                    this.steps.push(step);
                    movelist_1.updateMovelist(this);
                });
            }
            else {
                if (msg.ply === this.steps.length) {
                    const step = {
                        'fen': msg.fen,
                        'move': msg.lastMove,
                        'check': msg.check,
                        'turnColor': this.turnColor,
                        'san': msg.steps[0].san,
                    };
                    this.steps.push(step);
                    movelist_1.updateMovelist(this);
                }
            }
            this.abortable = Number(parts[parts.length - 1]) <= 1;
            if (!this.spectator && !this.abortable && this.result === "") {
                var container = document.getElementById('abort');
                patch(container, h_1.h('button#abort', { props: { disabled: true } }));
            }
            var lastMove = msg.lastMove;
            if (lastMove !== null) {
                if (this.variant === "shogi") {
                    lastMove = chess_1.usi2uci(lastMove);
                }
                else if (this.variant === "grand" || this.variant === "grandhouse") {
                    lastMove = chess_1.grand2zero(lastMove);
                }
                lastMove = [lastMove.slice(0, 2), lastMove.slice(2, 4)];
            }
            // drop lastMove causing scrollbar flicker,
            // so we remove from part to avoid that
            if (lastMove !== null && lastMove[0][1] === '@')
                lastMove = [lastMove[1]];
            // save capture state before updating chessground
            const capture = lastMove !== null && this.chessground.state.pieces[lastMove[1]];
            if (lastMove !== null && (this.turnColor === this.mycolor || this.spectator)) {
                if (this.variant === "shogi") {
                    sound_1.sound.shogimove();
                }
                else {
                    if (capture) {
                        sound_1.sound.capture();
                    }
                    else {
                        sound_1.sound.move();
                    }
                }
            }
            else {
                lastMove = [];
            }
            this.checkStatus(msg);
            if (msg.check) {
                sound_1.sound.check();
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
                pocket_1.updatePockets(this, this.vpocket0, this.vpocket1);
                this.clocks[0].pause(false);
                this.clocks[1].pause(false);
                this.clocks[oppclock].setTime(clocks[this.oppcolor]);
                this.clocks[myclock].setTime(clocks[this.mycolor]);
                if (!this.abortable && msg.status < 0) {
                    if (this.turnColor === this.mycolor) {
                        this.clocks[myclock].start();
                    }
                    else {
                        this.clocks[oppclock].start();
                    }
                }
            }
            else {
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
                    pocket_1.updatePockets(this, this.vpocket0, this.vpocket1);
                    this.clocks[oppclock].pause(false);
                    this.clocks[oppclock].setTime(clocks[this.oppcolor]);
                    this.clocks[myclock].setTime(clocks[this.mycolor]);
                    if (!this.abortable && msg.status < 0) {
                        this.clocks[myclock].start(clocks[this.mycolor]);
                        console.log('MY CLOCK STARTED');
                    }
                    // console.log("trying to play premove....");
                    if (this.premove)
                        this.performPremove();
                    if (this.predrop)
                        this.performPredrop();
                }
                else {
                    this.chessground.set({
                        // giving fen here will place castling rooks to their destination in chess960 variants
                        fen: parts[0],
                        turnColor: this.turnColor,
                        premovable: {
                            dests: msg.dests,
                        },
                        check: msg.check,
                    });
                    this.clocks[myclock].pause(false);
                    this.clocks[myclock].setTime(clocks[this.mycolor]);
                    this.clocks[oppclock].setTime(clocks[this.oppcolor]);
                    if (!this.abortable && msg.status < 0) {
                        this.clocks[oppclock].start(clocks[this.oppcolor]);
                        console.log('OPP CLOCK  STARTED');
                    }
                    if (this.oppIsRandomMover && msg.rm !== "") {
                        this.doSend({ type: "move", gameId: this.model["gameId"], move: msg.rm, clocks: clocks });
                    }
                    ;
                }
                ;
            }
            ;
        };
        this.goPly = (ply) => {
            const step = this.steps[ply];
            var move = step['move'];
            var capture = false;
            if (move !== undefined) {
                if (this.variant === "shogi")
                    move = chess_1.usi2uci(move);
                if (this.variant === "grand" || this.variant === "grandhouse")
                    move = chess_1.grand2zero(move);
                move = move.slice(1, 2) === '@' ? [move.slice(2, 4)] : [move.slice(0, 2), move.slice(2, 4)];
                capture = this.chessground.state.pieces[move[move.length - 1]] !== undefined;
            }
            this.chessground.set({
                fen: step.fen,
                turnColor: step.turnColor,
                movable: {
                    free: false,
                    color: this.spectator ? undefined : step.turnColor,
                    dests: this.result === "" && ply === this.steps.length - 1 ? this.dests : undefined,
                },
                check: step.check,
                lastMove: move,
            });
            this.fullfen = step.fen;
            pocket_1.updatePockets(this, this.vpocket0, this.vpocket1);
            if (ply === this.ply + 1) {
                if (this.variant === "shogi") {
                    sound_1.sound.shogimove();
                }
                else {
                    if (capture) {
                        sound_1.sound.capture();
                    }
                    else {
                        sound_1.sound.move();
                    }
                }
            }
            this.ply = ply;
            //var container = document.getElementById('pgn') as HTMLElement;
            this.vpng = patch(this.vpng, h_1.h('div#pgn', [h_1.h('div', this.fullfen), h_1.h('textarea', { attrs: { rows: 13 } }, this.pgn)]));
        };
        this.doSend = (message) => {
            console.log("---> doSend():", message);
            this.sock.send(JSON.stringify(message));
        };
        this.sendMove = (orig, dest, promo) => {
            // pause() will add increment!
            const oppclock = !this.flip ? 0 : 1;
            const myclock = 1 - oppclock;
            const movetime = (this.clocks[myclock].running) ? Date.now() - this.clocks[myclock].startTime : 0;
            this.clocks[myclock].pause((this.base === 0 && this.ply < 2) ? false : true);
            // console.log("sendMove(orig, dest, prom)", orig, dest, promo);
            const uci_move = orig + dest + promo;
            const move = this.variant === "shogi" ? chess_1.uci2usi(uci_move) : (this.variant === "grand" || this.variant === "grandhouse") ? chess_1.zero2grand(uci_move) : uci_move;
            // console.log("sendMove(move)", move);
            // TODO: if premoved, send 0 time
            let bclock, clocks;
            if (!this.flip) {
                bclock = this.mycolor === "black" ? 1 : 0;
            }
            else {
                bclock = this.mycolor === "black" ? 0 : 1;
            }
            const wclock = 1 - bclock;
            clocks = { movetime: movetime, black: this.clocks[bclock].duration, white: this.clocks[wclock].duration };
            this.doSend({ type: "move", gameId: this.model["gameId"], move: move, clocks: clocks });
            if (!this.abortable)
                this.clocks[oppclock].start();
        };
        this.onMove = () => {
            return (orig, dest, capturedPiece) => {
                console.log("   ground.onMove()", orig, dest, capturedPiece);
                if (this.variant === "shogi") {
                    sound_1.sound.shogimove();
                }
                else {
                    if (capturedPiece) {
                        sound_1.sound.capture();
                    }
                    else {
                        sound_1.sound.move();
                    }
                }
            };
        };
        this.onDrop = () => {
            return (piece, dest) => {
                console.log("ground.onDrop()", piece, dest);
                if (dest != 'z0' && piece.role && pocket_1.dropIsValid(this.dests, piece.role, dest)) {
                    if (this.variant === "shogi") {
                        sound_1.sound.shogimove();
                    }
                    else {
                        sound_1.sound.move();
                    }
                }
                else {
                    this.clickDrop = piece;
                }
            };
        };
        this.setPremove = (orig, dest, meta) => {
            this.premove = { orig, dest, meta };
            // console.log("setPremove() to:", orig, dest, meta);
        };
        this.unsetPremove = () => {
            this.premove = null;
        };
        this.setPredrop = (role, key) => {
            this.predrop = { role, key };
            // console.log("setPredrop() to:", role, key);
        };
        this.unsetPredrop = () => {
            this.predrop = null;
        };
        this.performPremove = () => {
            const { orig, dest, meta } = this.premove;
            // TODO: promotion?
            console.log("performPremove()", orig, dest, meta);
            this.chessground.playPremove();
            this.premove = null;
        };
        this.performPredrop = () => {
            const { role, key } = this.predrop;
            console.log("performPredrop()", role, key);
            this.chessground.playPredrop(drop => { return pocket_1.dropIsValid(this.dests, drop.role, drop.key); });
            this.predrop = null;
        };
        this.onUserMove = (orig, dest, meta) => {
            // chessground doesn't knows about ep, so we have to remove ep captured pawn
            const pieces = this.chessground.state.pieces;
            const geom = this.chessground.state.geometry;
            // console.log("ground.onUserMove()", orig, dest, meta, pieces);
            const moved = pieces[dest];
            const firstRankIs0 = this.chessground.state.dimensions.height === 10;
            if (meta.captured === undefined && moved.role === "pawn" && orig[0] != dest[0] && chess_1.hasEp(this.variant)) {
                const pos = util_1.key2pos(dest, firstRankIs0), pawnPos = [pos[0], pos[1] + (this.mycolor === 'white' ? -1 : 1)];
                const diff = {};
                diff[util_1.pos2key(pawnPos, geom)] = undefined;
                this.chessground.setPieces(diff);
                meta.captured = { role: "pawn" };
            }
            ;
            // increase pocket count
            if ((this.variant === "crazyhouse" || this.variant === "capahouse" || this.variant === "shouse" || this.variant === "grandhouse" || this.variant === "shogi") && meta.captured) {
                var role = meta.captured.role;
                if (meta.captured.promoted)
                    role = this.variant === "shogi" ? meta.captured.role.slice(1) : "pawn";
                if (this.flip) {
                    this.pockets[0][role]++;
                    this.vpocket0 = patch(this.vpocket0, pocket_1.pocketView(this, this.mycolor, "top"));
                }
                else {
                    this.pockets[1][role]++;
                    this.vpocket1 = patch(this.vpocket1, pocket_1.pocketView(this, this.mycolor, "bottom"));
                }
            }
            ;
            //  gating elephant/hawk
            if (this.variant === "seirawan" || this.variant === "shouse") {
                if (!this.promotion.start(orig, dest, meta) && !this.gating.start(this.fullfen, orig, dest, meta))
                    this.sendMove(orig, dest, '');
            }
            else {
                if (!this.promotion.start(orig, dest, meta))
                    this.sendMove(orig, dest, '');
            }
            ;
        };
        this.onUserDrop = (role, dest) => {
            // console.log("ground.onUserDrop()", role, dest);
            // decrease pocket count
            drop_1.cancelDropMode(this.chessground.state);
            if (pocket_1.dropIsValid(this.dests, role, dest)) {
                if (this.flip) {
                    this.pockets[0][role]--;
                    this.vpocket0 = patch(this.vpocket0, pocket_1.pocketView(this, this.mycolor, "top"));
                }
                else {
                    this.pockets[1][role]--;
                    this.vpocket1 = patch(this.vpocket1, pocket_1.pocketView(this, this.mycolor, "bottom"));
                }
                this.sendMove(chess_1.roleToSan[role] + "@", dest, '');
                // console.log("sent move", move);
            }
            else {
                console.log("!!! invalid move !!!", role, dest);
                // restore board
                this.clickDrop = undefined;
                this.chessground.set({
                    fen: this.fullfen,
                    lastMove: this.lastmove,
                    turnColor: this.mycolor,
                    movable: {
                        dests: this.dests,
                        showDests: true,
                    },
                });
            }
        };
        this.onSelect = (selected) => {
            return (key) => {
                console.log("   ground.onSelect()", key, selected, this.clickDrop, this.chessground.state);
                // If drop selection was set dropDests we have to restore dests here
                if (this.chessground.state.movable.dests === undefined)
                    return;
                if (key != 'z0' && 'z0' in this.chessground.state.movable.dests) {
                    if (this.clickDrop !== undefined && pocket_1.dropIsValid(this.dests, this.clickDrop.role, key)) {
                        this.chessground.newPiece(this.clickDrop, key);
                        this.onUserDrop(this.clickDrop.role, key);
                    }
                    this.clickDrop = undefined;
                    drop_1.cancelDropMode(this.chessground.state);
                    this.chessground.set({ movable: { dests: this.dests } });
                }
                ;
                // Sittuyin in place promotion on Ctrl+click
                if (this.chessground.state.stats.ctrlKey &&
                    (key in this.chessground.state.movable.dests) &&
                    (this.chessground.state.movable.dests[key].indexOf(key) >= 0) &&
                    (this.variant === 'sittuyin')) {
                    console.log("Ctrl in place promotion", key);
                    var pieces = {};
                    var piece = this.chessground.state.pieces[key];
                    pieces[key] = {
                        color: piece.color,
                        role: 'ferz',
                        promoted: true
                    };
                    this.chessground.setPieces(pieces);
                    this.sendMove(key, key, 'f');
                }
                ;
            };
        };
        this.onMsgUserConnected = (msg) => {
            this.model["username"] = msg["username"];
            user_1.renderUsername(this.model["home"], this.model["username"]);
            if (this.spectator) {
                this.doSend({ type: "is_user_online", username: this.wplayer });
                this.doSend({ type: "is_user_online", username: this.bplayer });
                // we want to know lastMove and check status
                this.doSend({ type: "board", gameId: this.model["gameId"] });
            }
            else {
                const opp_name = this.model["username"] === this.wplayer ? this.bplayer : this.wplayer;
                this.doSend({ type: "is_user_online", username: opp_name });
                var container = document.getElementById('player1');
                patch(container, h_1.h('i-side.online#player1', { class: { "icon": true, "icon-online": true, "icon-offline": false } }));
                // prevent sending gameStart message when user just reconecting
                if (msg.ply === 0) {
                    this.doSend({ type: "ready", gameId: this.model["gameId"] });
                }
                this.doSend({ type: "board", gameId: this.model["gameId"] });
            }
        };
        this.onMsgUserOnline = (msg) => {
            console.log(msg);
            if (msg.username === this.players[0]) {
                var container = document.getElementById('player0');
                patch(container, h_1.h('i-side.online#player0', { class: { "icon": true, "icon-online": true, "icon-offline": false } }));
            }
            else {
                var container = document.getElementById('player1');
                patch(container, h_1.h('i-side.online#player1', { class: { "icon": true, "icon-online": true, "icon-offline": false } }));
            }
        };
        this.onMsgUserDisconnected = (msg) => {
            console.log(msg);
            if (msg.username === this.players[0]) {
                var container = document.getElementById('player0');
                patch(container, h_1.h('i-side.online#player0', { class: { "icon": true, "icon-online": false, "icon-offline": true } }));
            }
            else {
                var container = document.getElementById('player1');
                patch(container, h_1.h('i-side.online#player1', { class: { "icon": true, "icon-online": false, "icon-offline": true } }));
            }
        };
        this.onMsgChat = (msg) => {
            if (msg.user !== this.model["username"])
                chat_1.chatMessage(msg.user, msg.message, "roundchat");
        };
        this.onMsgMoreTime = () => {
            chat_1.chatMessage('', this.mycolor + ' +15 seconds', "roundchat");
            this.clocks[1].setTime(this.clocks[1].duration + 15 * 1000);
        };
        this.onMsgOffer = (msg) => {
            chat_1.chatMessage("", msg.message, "roundchat");
        };
        this.onMessage = (evt) => {
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
                case "user_online":
                    this.onMsgUserOnline(msg);
                    break;
                case "user_disconnected":
                    this.onMsgUserDisconnected(msg);
                    break;
                case "roundchat":
                    this.onMsgChat(msg);
                    break;
                case "new_game":
                    this.onMsgNewGame(msg);
                    break;
                case "offer":
                    this.onMsgOffer(msg);
                    break;
                case "moretime":
                    this.onMsgMoreTime();
                    break;
                case "updateTV":
                    this.onMsgUpdateTV(msg);
                    break;
            }
        };
        const onOpen = (evt) => {
            console.log("ctrl.onOpen()", evt);
            this.clocks[0].connecting = false;
            this.clocks[1].connecting = false;
            this.doSend({ type: "game_user_connected", username: this.model["username"], gameId: this.model["gameId"] });
        };
        const opts = {
            maxAttempts: 10,
            onopen: e => onOpen(e),
            onmessage: e => this.onMessage(e),
            onreconnect: e => {
                this.clocks[0].connecting = true;
                this.clocks[1].connecting = true;
                console.log('Reconnecting in round...', e);
                var container = document.getElementById('player1');
                patch(container, h_1.h('i-side.online#player1', { class: { "icon": true, "icon-online": false, "icon-offline": true } }));
            },
            onmaximum: e => console.log('Stop Attempting!', e),
            onclose: e => console.log('Closed!', e),
            onerror: e => console.log('Error:', e),
        };
        try {
            this.sock = new sockette_1.default("ws://" + location.host + "/wsr", opts);
        }
        catch (err) {
            this.sock = new sockette_1.default("wss://" + location.host + "/wsr", opts);
        }
        this.model = model;
        this.variant = model["variant"];
        this.fullfen = model["fen"];
        this.wplayer = model["wplayer"];
        this.bplayer = model["bplayer"];
        this.base = model["base"];
        this.inc = model["inc"];
        this.status = model["status"];
        this.tv = model["tv"];
        this.steps = [];
        this.pgn = "";
        this.ply = 0;
        this.flip = false;
        this.settings = true;
        this.CSSindexes = chess_1.variants.map((variant) => localStorage[variant + "_pieces"] === undefined ? 0 : Number(localStorage[variant + "_pieces"]));
        this.spectator = this.model["username"] !== this.wplayer && this.model["username"] !== this.bplayer;
        // orientation = this.mycolor
        if (this.spectator) {
            this.mycolor = this.variant === 'shogi' ? 'black' : 'white';
            this.oppcolor = this.variant === 'shogi' ? 'white' : 'black';
        }
        else {
            this.mycolor = this.model["username"] === this.wplayer ? 'white' : 'black';
            this.oppcolor = this.model["username"] === this.wplayer ? 'black' : 'white';
        }
        this.oppIsRandomMover = ((this.mycolor === "white" && this.bplayer === "Random-Mover") ||
            (this.mycolor === "black" && this.wplayer === "Random-Mover"));
        // players[0] is top player, players[1] is bottom player
        this.players = [
            this.mycolor === "white" ? this.bplayer : this.wplayer,
            this.mycolor === "white" ? this.wplayer : this.bplayer
        ];
        this.titles = [
            this.mycolor === "white" ? this.model['btitle'] : this.model['wtitle'],
            this.mycolor === "white" ? this.model['wtitle'] : this.model['btitle']
        ];
        this.premove = null;
        this.predrop = null;
        this.result = "";
        const parts = this.fullfen.split(" ");
        this.abortable = Number(parts[parts.length - 1]) <= 1;
        const fen_placement = parts[0];
        this.turnColor = parts[1] === "w" ? "white" : "black";
        this.steps.push({
            'fen': fen_placement,
            'move': undefined,
            'check': false,
            'turnColor': this.turnColor,
        });
        this.chessground = chessgroundx_1.Chessground(el, {
            fen: fen_placement,
            geometry: chess_1.VARIANTS[this.variant].geom,
            orientation: this.mycolor,
            turnColor: this.turnColor,
            animation: {
                enabled: true,
            },
            events: {
                insert(elements) { resize_1.default(elements); }
            }
        });
        if (this.spectator) {
            this.chessground.set({
                viewOnly: true,
                events: {
                    move: this.onMove(),
                }
            });
        }
        else {
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
                    select: this.onSelect(this.chessground.state.selected),
                }
            });
        }
        ;
        this.gating = gating_1.default(this);
        this.promotion = promotion_1.default(this);
        // initialize users
        const player0 = document.getElementById('rplayer0');
        const player1 = document.getElementById('rplayer1');
        this.vplayer0 = patch(player0, player_1.player('player0', this.titles[0], this.players[0], model["level"]));
        this.vplayer1 = patch(player1, player_1.player('player1', this.titles[1], this.players[1], model["level"]));
        // initialize pockets
        if (chess_1.needPockets(this.variant)) {
            const pocket0 = document.getElementById('pocket0');
            const pocket1 = document.getElementById('pocket1');
            pocket_1.updatePockets(this, pocket0, pocket1);
        }
        // initialize clocks
        const c0 = new clock_1.Clock(this.base, this.inc, document.getElementById('clock0'), 'clock0');
        const c1 = new clock_1.Clock(this.base, this.inc, document.getElementById('clock1'), 'clock1');
        this.clocks = [c0, c1];
        this.clocks[0].onTick(clock_1.renderTime);
        this.clocks[1].onTick(clock_1.renderTime);
        const onMoreTime = () => {
            // TODO: enable when this.flip is true
            if (this.model['wtitle'] === 'BOT' || this.model['btitle'] === 'BOT' || this.spectator || this.status >= 0 || this.flip)
                return;
            this.clocks[0].setTime(this.clocks[0].duration + 15 * 1000);
            this.doSend({ type: "moretime", gameId: this.model["gameId"] });
            chat_1.chatMessage('', this.oppcolor + ' +15 seconds', "roundchat");
        };
        var container = document.getElementById('clock0');
        patch(container, h_1.h('div.clock-wrap#clock0', [
            h_1.h('div.more-time', [
                h_1.h('button.icon.icon-plus-square', {
                    props: { type: "button", title: "Give 15 seconds" },
                    on: { click: () => onMoreTime() }
                })
            ])
        ]));
        const flagCallback = () => {
            if (this.turnColor === this.mycolor) {
                this.chessground.stop();
                console.log("Flag");
                this.doSend({ type: "flag", gameId: this.model["gameId"] });
            }
        };
        if (!this.spectator)
            this.clocks[1].onFlag(flagCallback);
        const abort = () => {
            console.log("Abort");
            this.doSend({ type: "abort", gameId: this.model["gameId"] });
        };
        const draw = () => {
            console.log("Draw");
            this.doSend({ type: "draw", gameId: this.model["gameId"] });
        };
        const resign = () => {
            console.log("Resign");
            this.doSend({ type: "resign", gameId: this.model["gameId"] });
        };
        var container = document.getElementById('game-controls');
        if (!this.spectator) {
            this.gameControls = patch(container, h_1.h('div.btn-controls', [
                h_1.h('button#abort', { on: { click: () => abort() }, props: { title: 'Abort' } }, [h_1.h('i', { class: { "icon": true, "icon-abort": true } }),]),
                h_1.h('button#draw', { on: { click: () => draw() }, props: { title: "Draw" } }, [h_1.h('i', { class: { "icon": true, "icon-hand-paper-o": true } }),]),
                h_1.h('button#resign', { on: { click: () => resign() }, props: { title: "Resign" } }, [h_1.h('i', { class: { "icon": true, "icon-flag-o": true } }),]),
            ]));
        }
        else {
            this.gameControls = patch(container, h_1.h('div'));
        }
        patch(document.getElementById('board-settings'), settings_1.settingsView(this));
        patch(document.getElementById('movelist'), movelist_1.movelistView(this));
        patch(document.getElementById('roundchat'), chat_1.chatView(this, "roundchat"));
    }
}
exports.default = RoundController;

},{"./chat":31,"./chess":32,"./clock":33,"./gating":35,"./movelist":38,"./player":39,"./pocket":41,"./profile":42,"./promotion":43,"./resize":44,"./settings":46,"./sound":47,"./user":48,"chessgroundx":4,"chessgroundx/drop":8,"chessgroundx/util":17,"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25,"sockette":30}],35:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const tovnode_1 = __importDefault(require("snabbdom/tovnode"));
const util_1 = require("chessgroundx/util");
const chess_1 = require("./chess");
const pocket_1 = require("./pocket");
const patch = snabbdom_1.init([class_1.default, attributes_1.default, eventlisteners_1.default]);
function default_1(ctrl) {
    let gating = false;
    let roles = [];
    function start(fen, orig, dest, meta) {
        const ground = ctrl.getGround();
        const gatable = chess_1.canGate(fen, ground.state.pieces[dest], orig, dest, meta);
        roles = ["hawk", "elephant", "queen", "rook", "bishop", "knight", ""];
        if (gatable[0] || gatable[1] || gatable[2] || gatable[3] || gatable[4] || gatable[5]) {
            const color = ctrl.mycolor;
            const orientation = ground.state.orientation;
            if (roles.indexOf("hawk") !== -1 && !gatable[0])
                roles.splice(roles.indexOf("hawk"), 1);
            if (roles.indexOf("elephant") !== -1 && !gatable[1])
                roles.splice(roles.indexOf("elephant"), 1);
            if (roles.indexOf("queen") !== -1 && !gatable[2])
                roles.splice(roles.indexOf("queen"), 1);
            if (roles.indexOf("rook") !== -1 && !gatable[3])
                roles.splice(roles.indexOf("rook"), 1);
            if (roles.indexOf("bishop") !== -1 && !gatable[4])
                roles.splice(roles.indexOf("bishop"), 1);
            if (roles.indexOf("knight") !== -1 && !gatable[5])
                roles.splice(roles.indexOf("knight"), 1);
            var origs = [orig];
            const castling = ground.state.pieces[dest].role === "king" && orig[0] === "e" && dest[0] !== "d" && dest[0] !== "e" && dest[0] !== "f";
            var rookDest = "";
            if (castling) {
                // O-O
                if (dest[0] > "e") {
                    origs.push("h" + orig[1]);
                    rookDest = "e" + orig[1];
                    // O-O-O
                }
                else {
                    origs.push("a" + orig[1]);
                    rookDest = "e" + orig[1];
                }
                ;
            }
            ;
            draw_gating(origs, color, orientation);
            gating = {
                origs: origs,
                dest: dest,
                rookDest: rookDest,
                callback: ctrl.sendMove,
            };
            return true;
        }
        return false;
    }
    ;
    function gate(ctrl, orig, dest, role) {
        const g = ctrl.getGround();
        const color = g.state.pieces[dest].color;
        g.newPiece({ "role": role, "color": color }, orig);
        ctrl.pockets[color === 'white' ? 0 : 1][role]--;
        ctrl.vpocket1 = patch(ctrl.vpocket1, pocket_1.pocketView(ctrl, color, "bottom"));
    }
    function draw_gating(origs, color, orientation) {
        var container = tovnode_1.default(document.querySelector('extension'));
        patch(container, renderGating(origs, color, orientation));
    }
    function draw_no_gating() {
        var container = document.getElementById('extension_choice');
        patch(container, snabbdom_1.h('extension'));
    }
    function finish(role, index) {
        if (gating) {
            draw_no_gating();
            if (role)
                gate(ctrl, gating.origs[index], gating.dest, role);
            else
                index = 0;
            const gated = role ? chess_1.roleToSan[role].toLowerCase() : "";
            if (gating.callback)
                gating.callback(gating.origs[index], index === 0 ? gating.dest : gating.rookDest, gated);
            gating = false;
        }
    }
    ;
    function cancel() {
        draw_no_gating();
        ctrl.goPly(ctrl.ply);
        return;
    }
    function bind(eventName, f, redraw) {
        return {
            insert(vnode) {
                vnode.elm.addEventListener(eventName, e => {
                    const res = f(e);
                    if (redraw)
                        redraw();
                    return res;
                });
            }
        };
    }
    function renderSquares(orig, color, orientation, index) {
        const firstRankIs0 = false;
        var left = (8 - util_1.key2pos(orig, firstRankIs0)[0]) * 12.5;
        if (orientation === "white")
            left = 87.5 - left;
        return roles.map((serverRole, i) => {
            var top = (color === orientation ? 7 - i : i) * 12.5;
            return snabbdom_1.h("square", {
                attrs: { style: "top: " + top + "%;left: " + left + "%" },
                hook: bind("click", e => {
                    e.stopPropagation();
                    finish(serverRole, index);
                }, false)
            }, [snabbdom_1.h("piece." + serverRole + "." + color)]);
        });
    }
    function renderGating(origs, color, orientation) {
        var vertical = color === orientation ? "top" : "bottom";
        var squares = renderSquares(origs[0], color, orientation, 0);
        if (origs.length > 1)
            squares = squares.concat(renderSquares(origs[1], color, orientation, 1));
        return snabbdom_1.h("div#extension_choice." + vertical, {
            hook: {
                insert: vnode => {
                    const el = vnode.elm;
                    el.addEventListener("click", () => cancel());
                    el.addEventListener("contextmenu", e => {
                        e.preventDefault();
                        return false;
                    });
                }
            }
        }, squares);
    }
    return {
        start,
    };
}
exports.default = default_1;

},{"./chess":32,"./pocket":41,"chessgroundx/util":17,"snabbdom":26,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/tovnode":28}],36:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sockette_1 = __importDefault(require("sockette"));
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const h_1 = __importDefault(require("snabbdom/h"));
const user_1 = require("./user");
const chat_1 = require("./chat");
const chess_1 = require("./chess");
const sound_1 = require("./sound");
class LobbyController {
    constructor(el, model) {
        this.onMsgGetSeeks = (msg) => {
            this.seeks = msg.seeks;
            // console.log("!!!! got get_seeks msg:", msg);
            const oldVNode = document.getElementById('seeks');
            if (oldVNode instanceof Element) {
                oldVNode.innerHTML = '';
                patch(oldVNode, h_1.default('table#seeks', this.renderSeeks(msg.seeks)));
            }
        };
        this.onMsgNewGame = (msg) => {
            console.log("LobbyController.onMsgNewGame()", this.model["gameId"]);
            window.location.assign(this.model["home"] + '/' + msg["gameId"]);
        };
        this.onMsgUserConnected = (msg) => {
            this.model["username"] = msg["username"];
            user_1.renderUsername(this.model["home"], this.model["username"]);
        };
        this.onMsgChat = (msg) => {
            if (msg.user !== this.model["username"]) {
                chat_1.chatMessage(msg.user, msg.message, "lobbychat");
                if (msg.user.length !== 0 && msg.user !== '_server')
                    sound_1.sound.chat();
            }
        };
        this.onMsgFullChat = (msg) => {
            msg.lines.forEach((line) => { chat_1.chatMessage(line.user, line.message, "lobbychat"); });
        };
        this.onMsgPing = (msg) => {
            this.doSend({ type: "pong", timestamp: msg.timestamp });
        };
        this.onMsgShutdown = (msg) => {
            alert(msg.message);
        };
        console.log("LobbyController constructor", el, model);
        this.model = model;
        this.challengeAI = false;
        const onOpen = (evt) => {
            this._ws = evt.target;
            console.log("---CONNECTED", evt);
            this.doSend({ type: "lobby_user_connected", username: this.model["username"] });
            this.doSend({ type: "get_seeks" });
        };
        this._ws = { "readyState": -1 };
        const opts = {
            maxAttempts: 20,
            onopen: e => onOpen(e),
            onmessage: e => this.onMessage(e),
            onreconnect: e => console.log('Reconnecting in lobby...', e),
            onmaximum: e => console.log('Stop Attempting!', e),
            onclose: e => { console.log('Closed!', e); },
            onerror: e => console.log('Error:', e),
        };
        try {
            this.sock = new sockette_1.default("ws://" + location.host + "/wsl", opts);
        }
        catch (err) {
            this.sock = new sockette_1.default("wss://" + location.host + "/wsl", opts);
        }
        // get seeks when we are coming back after a game
        if (this._ws.readyState === 1) {
            this.doSend({ type: "get_seeks" });
        }
        ;
        patch(document.getElementById('seekbuttons'), h_1.default('ul#seekbuttons', this.renderSeekButtons()));
        patch(document.getElementById('lobbychat'), chat_1.chatView(this, "lobbychat"));
    }
    doSend(message) {
        console.log("---> lobby doSend():", message);
        this.sock.send(JSON.stringify(message));
    }
    createSeekMsg(variant, color, fen, minutes, increment, chess960) {
        this.doSend({
            type: "create_seek",
            user: this.model["username"],
            variant: variant,
            fen: fen,
            minutes: minutes,
            increment: increment,
            rated: false,
            chess960: chess960,
            color: color
        });
    }
    createBotChallengeMsg(variant, color, fen, minutes, increment, level, chess960) {
        this.doSend({
            type: "create_ai_challenge",
            user: this.model["username"],
            variant: variant,
            fen: fen,
            minutes: minutes,
            increment: increment,
            rated: false,
            level: level,
            chess960: chess960,
            color: color
        });
    }
    isNewSeek(variant, color, fen, minutes, increment) {
        return !this.seeks.some(seek => {
            return seek.user === this.model["username"] && seek.variant === variant && seek.fen === fen && seek.color === color && seek.tc === minutes + "+" + increment;
        });
    }
    createSeek(color) {
        document.getElementById('id01').style.display = 'none';
        let e;
        e = document.getElementById('variant');
        const variant = e.options[e.selectedIndex].value;
        localStorage.setItem("seek_variant", variant);
        e = document.getElementById('fen');
        const fen = e.value;
        localStorage.setItem("seek_fen", e.value);
        e = document.getElementById('min');
        const minutes = parseInt(e.value);
        localStorage.setItem("seek_min", e.value);
        e = document.getElementById('inc');
        const increment = parseInt(e.value);
        localStorage.setItem("seek_inc", e.value);
        e = document.getElementById('chess960');
        const hide = chess_1.variants960.indexOf(variant) === -1;
        const chess960 = (hide) ? false : e.checked;
        console.log("CREATE SEEK variant, color, fen, minutes, increment, hide, chess960", variant, color, fen, minutes, increment, hide, chess960);
        localStorage.setItem("seek_chess960", e.checked);
        if (this.challengeAI) {
            e = document.querySelector('input[name="level"]:checked');
            const level = parseInt(e.value);
            localStorage.setItem("seek_level", e.value);
            console.log(level, e.value, localStorage.getItem("seek_level"));
            this.createBotChallengeMsg(variant, color, fen, minutes, increment, level, chess960);
        }
        else {
            if (this.isNewSeek(variant, color, fen, minutes, increment)) {
                this.createSeekMsg(variant, color, fen, minutes, increment, chess960);
            }
        }
    }
    renderSeekButtons() {
        const setVariant = () => {
            let e;
            e = document.getElementById('variant');
            const variant = e.options[e.selectedIndex].value;
            const hide = chess_1.variants960.indexOf(variant) === -1;
            document.getElementById('chess960-block').style.display = (hide) ? 'none' : 'block';
        };
        const setMinutes = (minutes) => {
            var min, inc = 0;
            var el = document.getElementById("minutes");
            if (el)
                el.innerHTML = minutes;
            var e = document.getElementById('min');
            if (e)
                min = parseInt(e.value);
            e = document.getElementById('inc');
            if (e)
                inc = parseInt(e.value);
            document.getElementById('color-button-group').style.display = (min + inc === 0) ? 'none' : 'block';
        };
        const setIncrement = (increment) => {
            var min, inc = 0;
            var el = document.getElementById("increment");
            if (el)
                el.innerHTML = increment;
            var e = document.getElementById('min');
            if (e)
                min = parseInt(e.value);
            e = document.getElementById('inc');
            if (e)
                inc = parseInt(e.value);
            document.getElementById('color-button-group').style.display = (min + inc === 0) ? 'none' : 'block';
        };
        const vIdx = localStorage.seek_variant === undefined ? 0 : chess_1.variants.indexOf(localStorage.seek_variant);
        const vFen = localStorage.seek_fen === undefined ? "" : localStorage.seek_fen;
        const vMin = localStorage.seek_min === undefined ? "5" : localStorage.seek_min;
        const vInc = localStorage.seek_inc === undefined ? "3" : localStorage.seek_inc;
        const vLevel = localStorage.seek_level === undefined ? "1" : localStorage.seek_level;
        const vChess960 = localStorage.seek_chess960 === undefined ? "false" : localStorage.seek_chess960;
        console.log("localeStorage.seek_level, vLevel=", localStorage.seek_level, vLevel);
        return [
            h_1.default('div#id01', { class: { "modal": true } }, [
                h_1.default('form.modal-content', [
                    h_1.default('div#closecontainer', [
                        h_1.default('span.close', { on: { click: () => document.getElementById('id01').style.display = 'none' }, attrs: { 'data-icon': 'j' }, props: { title: "Cancel" } }),
                    ]),
                    h_1.default('div.container', [
                        h_1.default('label', { attrs: { for: "variant" } }, "Variant"),
                        h_1.default('select#variant', {
                            props: { name: "variant" },
                            on: { input: () => setVariant() },
                            hook: { insert: () => setVariant() },
                        }, chess_1.variants.map((variant, idx) => h_1.default('option', { props: { value: variant, selected: (idx === vIdx) ? "selected" : "" } }, variant))),
                        h_1.default('label', { attrs: { for: "fen" } }, "Start position"),
                        h_1.default('input#fen', { props: { name: 'fen', placeholder: 'Paste the FEN text here', value: vFen } }),
                        h_1.default('div#chess960-block', [
                            h_1.default('label', { attrs: { for: "chess960" } }, "Chess960"),
                            h_1.default('input#chess960', { props: { name: "chess960", type: "checkbox", checked: vChess960 === "true" ? "checked" : "" } }),
                        ]),
                        //h('label', { attrs: {for: "tc"} }, "Time Control"),
                        //h('select#timecontrol', { props: {name: "timecontrol"} }, [
                        //    h('option', { props: {value: "1", selected: true} }, "Real time"),
                        //    h('option', { props: {value: "2"} }, "Unlimited"),
                        //]),
                        h_1.default('label', { attrs: { for: "min" } }, "Minutes per side:"),
                        h_1.default('span#minutes'),
                        h_1.default('input#min', { class: { "slider": true },
                            props: { name: "min", type: "range", min: 0, max: 60, value: vMin },
                            on: { input: (e) => setMinutes(e.target.value) },
                            hook: { insert: (vnode) => setMinutes(vnode.elm.value) },
                        }),
                        h_1.default('label', { attrs: { for: "inc" } }, "Increment in seconds:"),
                        h_1.default('span#increment'),
                        h_1.default('input#inc', { class: { "slider": true },
                            props: { name: "inc", type: "range", min: 0, max: 15, value: vInc },
                            on: { input: (e) => setIncrement(e.target.value) },
                            hook: { insert: (vnode) => setIncrement(vnode.elm.value) },
                        }),
                        // if play with the machine
                        // A.I.Level (1-8 buttons)
                        h_1.default('form#ailevel', [
                            h_1.default('h4', "A.I. Level"),
                            h_1.default('div.ai-radio-group', [
                                h_1.default('input#ai1', { props: { type: "radio", name: "level", value: "1", checked: vLevel === "1" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai1', { attrs: { for: "ai1" } }, "1"),
                                h_1.default('input#ai2', { props: { type: "radio", name: "level", value: "2", checked: vLevel === "2" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai2', { attrs: { for: "ai2" } }, "2"),
                                h_1.default('input#ai3', { props: { type: "radio", name: "level", value: "3", checked: vLevel === "3" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai3', { attrs: { for: "ai3" } }, "3"),
                                h_1.default('input#ai4', { props: { type: "radio", name: "level", value: "4", checked: vLevel === "4" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai4', { attrs: { for: "ai4" } }, "4"),
                                h_1.default('input#ai5', { props: { type: "radio", name: "level", value: "5", checked: vLevel === "5" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai5', { attrs: { for: "ai5" } }, "5"),
                                h_1.default('input#ai6', { props: { type: "radio", name: "level", value: "6", checked: vLevel === "6" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai6', { attrs: { for: "ai6" } }, "6"),
                                h_1.default('input#ai7', { props: { type: "radio", name: "level", value: "7", checked: vLevel === "7" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai7', { attrs: { for: "ai7" } }, "7"),
                                h_1.default('input#ai8', { props: { type: "radio", name: "level", value: "8", checked: vLevel === "8" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai8', { attrs: { for: "ai8" } }, "8"),
                            ]),
                        ]),
                        h_1.default('div#color-button-group', [
                            h_1.default('button.icon.icon-black', { props: { type: "button", title: "Black" }, on: { click: () => this.createSeek('b') } }),
                            h_1.default('button.icon.icon-adjust', { props: { type: "button", title: "Random" }, on: { click: () => this.createSeek('r') } }),
                            h_1.default('button.icon.icon-white', { props: { type: "button", title: "White" }, on: { click: () => this.createSeek('w') } }),
                        ]),
                    ]),
                ]),
            ]),
            h_1.default('button', { class: { 'lobby-button': true }, on: {
                    click: () => {
                        this.challengeAI = false;
                        document.getElementById('ailevel').style.display = 'none';
                        document.getElementById('id01').style.display = 'block';
                    }
                } }, "Create a game"),
            h_1.default('button', { class: { 'lobby-button': true }, on: {
                    click: () => {
                        this.challengeAI = true;
                        document.getElementById('ailevel').style.display = 'inline-block';
                        document.getElementById('id01').style.display = 'block';
                    }
                } }, "Play with the machine"),
        ];
    }
    onClickSeek(seek) {
        if (seek["user"] === this.model["username"]) {
            this.doSend({ type: "delete_seek", seekID: seek["seekID"], player: this.model["username"] });
        }
        else {
            this.doSend({ type: "accept_seek", seekID: seek["seekID"], player: this.model["username"] });
        }
    }
    renderSeeks(seeks) {
        // TODO: fix header and data row colomns
        // https://stackoverflow.com/questions/37272331/html-table-with-fixed-header-and-footer-and-scrollable-body-without-fixed-widths
        const header = h_1.default('thead', [h_1.default('tr', [h_1.default('th', 'Player'),
                h_1.default('th', 'Color'),
                h_1.default('th', 'Rating'),
                h_1.default('th', 'Time'),
                h_1.default('th', '    '),
                h_1.default('th', 'Variant'),
                h_1.default('th', 'Mode')])]);
        const colorIcon = (color) => { return h_1.default('i', { attrs: { "data-icon": color === "w" ? "c" : color === "b" ? "b" : "a" } }); };
        var rows = seeks.map((seek) => h_1.default('tr', { on: { click: () => this.onClickSeek(seek) } }, [h_1.default('td', seek["user"]),
            h_1.default('td', [colorIcon(seek["color"])]),
            h_1.default('td', '1500?'),
            h_1.default('td', seek["tc"]),
            h_1.default('td', { attrs: { "data-icon": chess_1.VARIANTS[seek["variant"]].icon }, class: { "icon": true } }),
            h_1.default('td', { attrs: { "data-icon": (seek.chess960) ? "V" : "" }, class: { "icon": true } }),
            h_1.default('td', seek["variant"]),
            h_1.default('td', seek["rated"])]));
        return [header, h_1.default('tbody', rows)];
    }
    onMessage(evt) {
        console.log("<+++ lobby onMessage():", evt.data);
        var msg = JSON.parse(evt.data);
        switch (msg.type) {
            case "get_seeks":
                this.onMsgGetSeeks(msg);
                break;
            case "new_game":
                this.onMsgNewGame(msg);
                break;
            case "lobby_user_connected":
                this.onMsgUserConnected(msg);
                break;
            case "lobbychat":
                this.onMsgChat(msg);
                break;
            case "fullchat":
                this.onMsgFullChat(msg);
                break;
            case "ping":
                this.onMsgPing(msg);
                break;
            case "shutdown":
                this.onMsgShutdown(msg);
                break;
        }
    }
}
function runSeeks(vnode, model) {
    const el = vnode.elm;
    const ctrl = new LobbyController(el, model);
    console.log("lobbyView() -> runSeeks()", el, model, ctrl);
}
function lobbyView(model) {
    // Get the modal
    const modal = document.getElementById('id01');
    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };
    return [h_1.default('aside.sidebar-first', [h_1.default('div.lobbychat#lobbychat')]),
        h_1.default('main.main', [h_1.default('table#seeks', { hook: { insert: (vnode) => runSeeks(vnode, model) } })]),
        h_1.default('aside.sidebar-second', [h_1.default('ul#seekbuttons')]),
        h_1.default('under-left', "# of users"),
        h_1.default('under-lobby'),
        h_1.default('under-right', [
            h_1.default('a', {
                class: { 'donate-button': true },
                attrs: { href: 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=NC73JXRBQNTAN&source=url' }
            }, 'Directly support us')
        ]),
    ];
}
exports.lobbyView = lobbyView;

},{"./chat":31,"./chess":32,"./sound":47,"./user":48,"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25,"sockette":30}],37:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const h_1 = __importDefault(require("snabbdom/h"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const lobby_1 = require("./lobby");
const round_1 = require("./round");
const players_1 = require("./players");
const profile_1 = require("./profile");
const model = { home: "", username: "", anon: "", variant: "", gameId: 0, wplayer: "", bplayer: "", fen: "", base: "", inc: "", seeks: [], tv: "", profileid: "", status: "" };
var getCookie = function (name) {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; ++i) {
        var pair = cookies[i].trim().split('=');
        if (pair[0] == name)
            return pair[1];
    }
    return "";
};
function view(el, model) {
    const user = getCookie("user");
    if (user !== "")
        model["username"] = user;
    model["home"] = el.getAttribute("data-home");
    model["anon"] = el.getAttribute("data-anon");
    model["profileid"] = el.getAttribute("data-profile");
    model["variant"] = el.getAttribute("data-variant");
    model["chess960"] = el.getAttribute("data-chess960");
    model["level"] = el.getAttribute("data-level");
    model["username"] = user !== "" ? user : el.getAttribute("data-user");
    model["gameId"] = el.getAttribute("data-gameid");
    model["wplayer"] = el.getAttribute("data-wplayer");
    model["wtitle"] = el.getAttribute("data-wtitle");
    model["bplayer"] = el.getAttribute("data-bplayer");
    model["btitle"] = el.getAttribute("data-btitle");
    model["fen"] = el.getAttribute("data-fen");
    model["base"] = el.getAttribute("data-base");
    model["inc"] = el.getAttribute("data-inc");
    model["result"] = el.getAttribute("data-result");
    model["status"] = el.getAttribute("data-status");
    model["date"] = el.getAttribute("data-date");
    model["tv"] = el.getAttribute("data-view") === 'tv';
    switch (el.getAttribute("data-view")) {
        case 'about':
            return h_1.default('iframe', { props: { src: model["home"] + "/static/docs/variants.html", height: "100%", width: "100%", seamless: "" } });
        case 'players':
            return h_1.default('div#placeholder.players-wrapper', players_1.playersView(model));
        case 'profile':
            return h_1.default('div#placeholder.profile-wrapper', profile_1.profileView(model));
        case 'tv':
        case 'round':
            return h_1.default('div#placeholder.main-wrapper', round_1.roundView(model));
        case 'thanks':
            return h_1.default('div#placeholder.main-wrapper', h_1.default('h2', 'Thank you for your support!'));
        default:
            return h_1.default('div#placeholder.main-wrapper', lobby_1.lobbyView(model));
    }
}
exports.view = view;
const el = document.getElementById('pychess-variants');
if (el instanceof Element) {
    patch(document.getElementById('placeholder'), view(el, model));
}

},{"./lobby":36,"./players":40,"./profile":42,"./round":45,"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],38:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const h_1 = __importDefault(require("snabbdom/h"));
const settings_1 = require("./settings");
function selectMove(ctrl, ply) {
    const active = document.querySelector('li.move.active');
    if (active)
        active.classList.remove('active');
    const elPly = document.querySelector(`li.move[ply="${ply}"]`);
    if (elPly)
        elPly.classList.add('active');
    ctrl.goPly(ply);
    scrollToPly(ctrl);
}
function scrollToPly(ctrl) {
    if (ctrl.steps.length < 9)
        return;
    const movesEl = document.getElementById('moves');
    let st = undefined;
    const plyEl = movesEl.querySelector('li.move.active');
    if (ctrl.ply == 0)
        st = 0;
    else if (ctrl.ply == ctrl.steps.length - 1)
        st = 99999;
    else if (plyEl)
        st = plyEl.offsetTop - movesEl.offsetHeight + plyEl.offsetHeight;
    console.log("scrollToPly", ctrl.ply, st);
    if (typeof st == 'number') {
        if (st == 0 || st == 99999)
            movesEl.scrollTop = st;
        else if (plyEl) {
            var isSmoothScrollSupported = 'scrollBehavior' in document.documentElement.style;
            if (isSmoothScrollSupported) {
                plyEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            else {
                plyEl.scrollIntoView(false);
            }
        }
    }
}
function movelistView(ctrl) {
    ctrl.vgear = settings_1.gearButton(ctrl);
    var container = document.getElementById('move-controls');
    ctrl.moveControls = patch(container, h_1.default('div.btn-controls', [
        h_1.default('button', { on: { click: () => settings_1.toggleOrientation(ctrl) } }, [h_1.default('i', { props: { title: 'Flip board' }, class: { "icon": true, "icon-refresh": true } }),]),
        h_1.default('button', { on: { click: () => selectMove(ctrl, 0) } }, [h_1.default('i', { class: { "icon": true, "icon-fast-backward": true } }),]),
        h_1.default('button', { on: { click: () => selectMove(ctrl, Math.max(ctrl.ply - 1, 0)) } }, [h_1.default('i', { class: { "icon": true, "icon-step-backward": true } }),]),
        h_1.default('button', { on: { click: () => selectMove(ctrl, Math.min(ctrl.ply + 1, ctrl.steps.length - 1)) } }, [h_1.default('i', { class: { "icon": true, "icon-step-forward": true } }),]),
        h_1.default('button', { on: { click: () => selectMove(ctrl, ctrl.steps.length - 1) } }, [h_1.default('i', { class: { "icon": true, "icon-fast-forward": true } }),]),
        ctrl.vgear,
    ]));
    return h_1.default('div#moves', [h_1.default('ol.movelist#movelist')]);
}
exports.movelistView = movelistView;
function updateMovelist(ctrl) {
    var container = document.getElementById('movelist');
    const ply = ctrl.steps.length - 1;
    const move = ctrl.steps[ply]['san'];
    const active = document.querySelector('li.move.active');
    if (active)
        active.classList.remove('active');
    const el = h_1.default('li.move', { class: { active: true }, attrs: { ply: ply }, on: { click: () => selectMove(ctrl, ply) } }, move);
    if (ply % 2 == 0) {
        patch(container, h_1.default('ol.movelist#movelist', [el]));
    }
    else {
        patch(container, h_1.default('ol.movelist#movelist', [h_1.default('li.move.counter', (ply + 1) / 2), el]));
    }
    scrollToPly(ctrl);
}
exports.updateMovelist = updateMovelist;

},{"./settings":46,"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],39:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const h_1 = __importDefault(require("snabbdom/h"));
function player(id, title, name, level) {
    return h_1.default('round-player', [
        h_1.default('div.player-data', [
            h_1.default('i-side.online#' + id, { class: { "icon": true, "icon-online": false, "icon-offline": true } }),
            h_1.default('player', [
                h_1.default('a.user-link', { attrs: { href: '/@/' + name } }, [
                    h_1.default('player-title', " " + title + " "),
                    name + ((title === "BOT" && level > 0) ? ' level ' + level : ''),
                ]),
                h_1.default('rating', "1500?"),
            ]),
        ]),
    ]);
}
exports.player = player;

},{"snabbdom/h":19}],40:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const h_1 = __importDefault(require("snabbdom/h"));
const user_1 = require("./user");
function renderPlayers(model, players) {
    console.log("players", model, players);
    const header = h_1.default('thead', [h_1.default('tr', [h_1.default('th', 'Players'),])]);
    var rows = players.map((player) => h_1.default('tr', [
        h_1.default('td.player-data', [
            h_1.default('i-side.online', { class: { "icon": true, "icon-online": player["online"], "icon-offline": !player["online"] } }),
            h_1.default('player', [
                h_1.default('a.user-link', { attrs: { href: '/@/' + player["_id"] } }, [
                    h_1.default('player-title', " " + player["title"] + " "),
                    player["_id"],
                ]),
            ]),
        ])
    ]));
    return [header, h_1.default('tbody', rows)];
}
function playersView(model) {
    user_1.renderUsername(model["home"], model["username"]);
    var xmlhttp = new XMLHttpRequest();
    var url = model["home"] + "/api/players";
    xmlhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var myArr = JSON.parse(this.responseText);
            myFunction(myArr);
        }
    };
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
    function myFunction(arr) {
        const oldVNode = document.getElementById('players');
        console.log(arr);
        if (oldVNode instanceof Element) {
            patch(oldVNode, h_1.default('table#players', renderPlayers(model, arr)));
        }
    }
    console.log(model);
    return [h_1.default('aside.sidebar-first'),
        h_1.default('main.main', [h_1.default('table#players')]),
        h_1.default('aside.sidebar-second'),
    ];
}
exports.playersView = playersView;

},{"./user":48,"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],41:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const drag_1 = require("chessgroundx/drag");
const drop_1 = require("chessgroundx/drop");
const chess_1 = require("./chess");
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const eventNames = ['mousedown', 'touchstart'];
function pocketView(ctrl, color, position) {
    const pocket = ctrl.pockets[position === 'top' ? 0 : 1];
    const pieceRoles = Object.keys(pocket);
    return snabbdom_1.h('div.pocket.' + position, {
        class: { usable: true },
        hook: {
            insert: vnode => {
                eventNames.forEach(name => {
                    vnode.elm.addEventListener(name, (e) => {
                        if (position === (ctrl.flip ? 'top' : 'bottom'))
                            drag(ctrl, e);
                    });
                });
            }
        }
    }, pieceRoles.map(role => {
        let nb = pocket[role] || 0;
        return snabbdom_1.h('piece.' + role + '.' + color, {
            attrs: {
                'data-role': role,
                'data-color': color,
                'data-nb': nb,
            }
        });
    }));
}
exports.pocketView = pocketView;
function drag(ctrl, e) {
    if (e.button !== undefined && e.button !== 0)
        return; // only touch or left click
    const el = e.target, role = el.getAttribute('data-role'), color = el.getAttribute('data-color'), number = el.getAttribute('data-nb');
    if (!role || !color || number === '0')
        return;
    if (ctrl.clickDrop !== undefined && role === ctrl.clickDrop.role) {
        ctrl.clickDrop = undefined;
        ctrl.chessground.selectSquare(null);
        drop_1.cancelDropMode(ctrl.chessground.state);
        return;
    }
    else {
        drop_1.setDropMode(ctrl.chessground.state, number !== '0' ? { color, role } : undefined);
    }
    ;
    // Show possible drop dests on my turn only not to mess up predrop
    if (ctrl.turnColor === ctrl.mycolor) {
        const dropDests = { 'z0': ctrl.dests[chess_1.roleToSan[role] + "@"] };
        ctrl.chessground.newPiece({ "role": role, "color": color }, 'z0');
        ctrl.chessground.set({
            turnColor: color,
            movable: {
                dests: dropDests,
                showDests: true,
            },
        });
        ctrl.chessground.selectSquare('z0');
        ctrl.chessground.set({ lastMove: ctrl.lastmove });
    }
    e.stopPropagation();
    e.preventDefault();
    drag_1.dragNewPiece(ctrl.chessground.state, { color, role }, e);
}
exports.drag = drag;
function dropIsValid(dests, role, key) {
    // console.log("dropDests:", dests, role, key)
    const drops = dests[chess_1.roleToSan[role] + "@"];
    // console.log("drops:", drops)
    if (drops === undefined || drops === null)
        return false;
    return drops.indexOf(key) !== -1;
}
exports.dropIsValid = dropIsValid;
// TODO: after 1 move made only 1 pocket update needed at once, no need to update both
function updatePockets(ctrl, vpocket0, vpocket1) {
    // update pockets from fen
    if (chess_1.needPockets(ctrl.variant)) {
        const parts = ctrl.fullfen.split(" ");
        const fen_placement = parts[0];
        var pockets = "";
        const bracketPos = fen_placement.indexOf("[");
        if (bracketPos !== -1) {
            pockets = fen_placement.slice(bracketPos);
        }
        const c = ctrl.mycolor[0];
        const o = ctrl.oppcolor[0];
        const roles = chess_1.pocketRoles(ctrl.variant);
        var po = {};
        var pc = {};
        roles.forEach(role => pc[role] = chess_1.lc(pockets, chess_1.roleToSan[role].toLowerCase(), c === (ctrl.variant === 'shogi' ? 'b' : 'w')));
        roles.forEach(role => po[role] = chess_1.lc(pockets, chess_1.roleToSan[role].toLowerCase(), o === (ctrl.variant === 'shogi' ? 'b' : 'w')));
        if (ctrl.flip) {
            ctrl.pockets = [pc, po];
        }
        else {
            ctrl.pockets = [po, pc];
        }
        console.log(o, c, po, pc);
        ctrl.vpocket0 = patch(vpocket0, pocketView(ctrl, ctrl.flip ? ctrl.mycolor : ctrl.oppcolor, "top"));
        ctrl.vpocket1 = patch(vpocket1, pocketView(ctrl, ctrl.flip ? ctrl.oppcolor : ctrl.mycolor, "bottom"));
    }
}
exports.updatePockets = updatePockets;

},{"./chess":32,"chessgroundx/drag":6,"chessgroundx/drop":8,"snabbdom":26,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],42:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const h_1 = __importDefault(require("snabbdom/h"));
const chessgroundx_1 = require("chessgroundx");
const user_1 = require("./user");
const chess_1 = require("./chess");
const clock_1 = require("./clock");
const settings_1 = require("./settings");
function result(status, result) {
    var text = '';
    console.log("result()", status, result);
    switch (status) {
        case -2:
        case -1:
            text = 'Playing right now';
            break;
        case 0:
            text = 'Game aborted';
            break;
        case 1:
            text = 'Checkmate';
            break;
        case 2:
            text = ((result === '1-0') ? 'Black' : 'White') + ' resigned';
            break;
        case 3:
            text = 'Stalemate';
            break;
        case 4:
            text = 'Time out';
            break;
        case 5:
            text = 'Draw';
            break;
        case 6:
            text = 'Time out';
            break;
        case 7:
            text = ((result === '1-0') ? 'Black' : 'White') + ' abandoned the game';
            break;
        default:
            text = '*';
            break;
    }
    return (status <= 0) ? text : text + ', ' + result;
}
exports.result = result;
function renderGames(model, games) {
    //                h('fn', player["first_name"]),
    //                h('ln', player["last_name"]),
    //                h('country', player["country"]),
    var rows = games.map((game) => h_1.default('tr', { on: { click: () => { window.location.assign(model["home"] + '/' + game["_id"]); } },
    }, [
        h_1.default('td.board', [
            h_1.default('selection.' + chess_1.VARIANTS[game["v"]].board + '.' + chess_1.VARIANTS[game["v"]].pieces, [
                h_1.default('div.cg-wrap.' + chess_1.VARIANTS[game["v"]].cg + '.mini', { hook: {
                        insert: (vnode) => {
                            chessgroundx_1.Chessground(vnode.elm, {
                                coordinates: false,
                                viewOnly: true,
                                fen: game["f"],
                                geometry: chess_1.VARIANTS[game["v"]].geom
                            });
                        }
                    } }),
            ]),
        ]),
        h_1.default('td.games-info', [
            h_1.default('div.info0', { attrs: { "data-icon": chess_1.VARIANTS[game["v"]].icon }, class: { "icon": true } }, [
                h_1.default('div.info1', { attrs: { "data-icon": (game["z"] === 1) ? "V" : "" }, class: { "icon": true } }),
                h_1.default('div.info2', [
                    h_1.default('div.tc', game["b"] + "+" + game["i"] + " • Casual • " + game["v"]),
                    h_1.default('info-date', { attrs: { timestamp: game["d"] } }),
                ]),
            ]),
            h_1.default('div', [
                h_1.default('player', [
                    h_1.default('a.user-link', { attrs: { href: '/@/' + game["us"][0] } }, [
                        h_1.default('player-title', " " + game["wt"] + " "),
                        game["us"][0] + ((game["wt"] === 'BOT' && game['x'] > 0) ? ' level ' + game['x'] : ''),
                    ]),
                ]),
                h_1.default('vs', ' - '),
                h_1.default('player', [
                    h_1.default('a.user-link', { attrs: { href: '/@/' + game["us"][1] } }, [
                        h_1.default('player-title', " " + game["bt"] + " "),
                        game["us"][1] + ((game["bt"] === 'BOT' && game['x'] > 0) ? ' level ' + game['x'] : ''),
                    ]),
                ]),
            ]),
            h_1.default('div.info-result', {
                class: {
                    "win": (game["r"] === '1-0' && game["us"][0] === model["profileid"]) || (game["r"] === '0-1' && game["us"][1] === model["profileid"]),
                    "lose": (game["r"] === '0-1' && game["us"][0] === model["profileid"]) || (game["r"] === '1-0' && game["us"][1] === model["profileid"]),
                }
            }, result(game["s"], game["r"])),
        ])
    ]));
    return [h_1.default('tbody', rows)];
}
function loadGames(model, page) {
    var xmlhttp = new XMLHttpRequest();
    var url = model["home"] + "/api/" + model["profileid"] + "/games?p=";
    xmlhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var myArr = JSON.parse(this.responseText);
            // If empty JSON, exit the function
            if (!myArr.length) {
                return;
            }
            myFunction(myArr);
        }
    };
    xmlhttp.open("GET", url + page, true);
    xmlhttp.send();
    function myFunction(arr) {
        const oldVNode = document.getElementById('games');
        console.log(arr);
        if (oldVNode instanceof Element) {
            patch(oldVNode, h_1.default('table#games', renderGames(model, arr)));
        }
        clock_1.renderTimeago();
    }
}
function observeSentinel(vnode, model) {
    const sentinel = vnode.elm;
    var page = 0;
    var intersectionObserver = new IntersectionObserver(entries => {
        // If intersectionRatio is 0, the sentinel is out of view
        // and we don't need to do anything. Exit the function
        if (entries[0].intersectionRatio <= 0)
            return;
        loadGames(model, page);
        page += 1;
    });
    intersectionObserver.observe(sentinel);
}
function profileView(model) {
    user_1.renderUsername(model["home"], model["username"]);
    console.log(model);
    const CSSindexes = chess_1.variants.map((variant) => localStorage[variant + "_pieces"] === undefined ? 0 : Number(localStorage[variant + "_pieces"]));
    Object.keys(chess_1.VARIANTS).forEach((key) => {
        const variant = chess_1.VARIANTS[key];
        if (variant.css.length > 1) {
            var idx = CSSindexes[chess_1.variants.indexOf(key)];
            idx = Math.min(idx, variant.css.length - 1);
            settings_1.changeCSS('/static/' + variant.css[idx] + '.css');
        }
        ;
    });
    return [h_1.default('aside.sidebar-first'),
        h_1.default('main.main', [
            h_1.default('player-head', [
                model["profileid"],
                h_1.default('a.i-dl', {
                    attrs: { href: '/games/export/' + model["profileid"], "download": model["profileid"] + '.pgn' },
                    class: { "icon": true, "icon-download": true }
                }),
                h_1.default('a.i-tv', {
                    attrs: { href: '/@/' + model["profileid"] + '/tv' },
                    class: { "icon": true, "icon-tv": true }
                }),
            ]),
            h_1.default('table#games'),
            h_1.default('div#sentinel', { hook: { insert: (vnode) => observeSentinel(vnode, model) } })
        ]),
        h_1.default('aside.sidebar-second'),
    ];
}
exports.profileView = profileView;

},{"./chess":32,"./clock":33,"./settings":46,"./user":48,"chessgroundx":4,"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],43:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const tovnode_1 = __importDefault(require("snabbdom/tovnode"));
const util_1 = require("chessgroundx/util");
const chess_1 = require("./chess");
const patch = snabbdom_1.init([class_1.default, attributes_1.default, eventlisteners_1.default]);
function default_1(ctrl) {
    let promoting = false;
    let roles = [];
    function start(orig, dest, meta) {
        const ground = ctrl.getGround();
        if (chess_1.isPromotion(ctrl.variant, ground.state.pieces[dest], orig, dest, meta, ctrl.promotions)) {
            const color = ctrl.mycolor;
            const orientation = ground.state.orientation;
            const movingRole = ground.state.pieces[dest].role;
            roles = chess_1.promotionRoles(ctrl.variant, movingRole, orig, dest, ctrl.promotions);
            switch (ctrl.variant) {
                // TODO: in grand chess use mandatoryPromotion when promotion happens on back rank
                case "shogi":
                    if (chess_1.mandatoryPromotion(movingRole, dest, color)) {
                        promote(ground, dest, 'p' + ground.state.pieces[dest].role);
                        ctrl.sendMove(orig, dest, '+');
                    }
                    else {
                        draw_promo(dest, color, orientation);
                        promoting = {
                            orig: orig,
                            dest: dest,
                            callback: ctrl.sendMove,
                        };
                    }
                    ;
                    break;
                case 'makruk':
                    promote(ground, dest, 'met');
                    ctrl.sendMove(orig, dest, 'm');
                    break;
                case 'sittuyin':
                    promote(ground, dest, 'ferz');
                    ctrl.sendMove(orig, dest, 'f');
                    break;
                default:
                    // in grand chess promotion on back rank is mandatory
                    // and sometimes only one choice exists
                    if (roles.length === 1) {
                        const role = roles[0];
                        const promo = chess_1.roleToSan[role].toLowerCase();
                        promote(ground, dest, role);
                        ctrl.sendMove(orig, dest, promo);
                    }
                    else {
                        draw_promo(dest, color, orientation);
                        promoting = {
                            orig: orig,
                            dest: dest,
                            callback: ctrl.sendMove,
                        };
                    }
                    ;
            }
            ;
            return true;
        }
        return false;
    }
    ;
    function promote(g, key, role) {
        var pieces = {};
        var piece = g.state.pieces[key];
        if (g.state.pieces[key].role === role) {
            return false;
        }
        else {
            pieces[key] = {
                color: piece.color,
                role: role,
                promoted: true
            };
            g.setPieces(pieces);
            return true;
        }
    }
    function draw_promo(dest, color, orientation) {
        var container = tovnode_1.default(document.querySelector('extension'));
        patch(container, renderPromotion(dest, color, orientation));
    }
    function draw_no_promo() {
        var container = document.getElementById('extension_choice');
        patch(container, snabbdom_1.h('extension'));
    }
    function finish(role) {
        if (promoting) {
            draw_no_promo();
            const promoted = promote(ctrl.getGround(), promoting.dest, role);
            let promo;
            switch (ctrl.variant) {
                case "shogi":
                    promo = promoted ? "+" : "";
                    break;
                case "grandhouse":
                case "grand":
                    promo = promoted ? chess_1.roleToSan[role].toLowerCase() : "";
                    break;
                default:
                    promo = chess_1.roleToSan[role].toLowerCase();
            }
            ;
            if (promoting.callback)
                promoting.callback(promoting.orig, promoting.dest, promo);
            promoting = false;
        }
    }
    ;
    function cancel() {
        draw_no_promo();
        ctrl.goPly(ctrl.ply);
        return;
    }
    function bind(eventName, f, redraw) {
        return {
            insert(vnode) {
                vnode.elm.addEventListener(eventName, e => {
                    const res = f(e);
                    if (redraw)
                        redraw();
                    return res;
                });
            }
        };
    }
    function renderPromotion(dest, color, orientation) {
        const dim = ctrl.getGround().state.dimensions;
        const firstRankIs0 = dim.height === 10;
        var left = (dim.width - util_1.key2pos(dest, firstRankIs0)[0]) * (100 / dim.width);
        if (orientation === "white")
            left = (100 / dim.width) * (dim.width - 1) - left;
        var vertical = color === orientation ? "top" : "bottom";
        return snabbdom_1.h("div#extension_choice." + vertical, {
            hook: {
                insert: vnode => {
                    const el = vnode.elm;
                    el.addEventListener("click", () => cancel());
                    el.addEventListener("contextmenu", e => {
                        e.preventDefault();
                        return false;
                    });
                }
            }
        }, roles.map((serverRole, i) => {
            var top = (color === orientation ? i : dim.height - 1 - i) * (100 / dim.height);
            return snabbdom_1.h("square", {
                attrs: { style: "top: " + top + "%;left: " + left + "%" },
                hook: bind("click", e => {
                    e.stopPropagation();
                    finish(serverRole);
                }, false)
            }, [snabbdom_1.h("piece." + serverRole + "." + color)]);
        }));
    }
    return {
        start,
    };
}
exports.default = default_1;

},{"./chess":32,"chessgroundx/util":17,"snabbdom":26,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/tovnode":28}],44:[function(require,module,exports){
"use strict";
// http://jsfiddle.net/MissoulaLorenzo/gfn6ob3j/
// https://github.com/ornicar/lila/blob/master/ui/common/src/resize.ts
Object.defineProperty(exports, "__esModule", { value: true });
//export default function resizeHandle(els: cg.Elements, pref: number, ply: number) {
function resizeHandle(els) {
    //  if (!pref) return;
    if (true)
        return;
    const el = document.createElement('cg-resize');
    els.container.appendChild(el);
    const mousemoveEvent = 'mousemove';
    const mouseupEvent = 'mouseup';
    el.addEventListener('mousedown', (start) => {
        start.preventDefault();
        const startPos = eventPosition(start);
        const initialZoom = 100; //parseInt(getComputedStyle(document.body).getPropertyValue('--zoom'));
        let zoom = initialZoom;
        /*
            const saveZoom = window.lichess.debounce(() => {
              $.ajax({ method: 'post', url: '/pref/zoom?v=' + (100 + zoom) });
            }, 700);
        */
        const setZoom = (zoom) => {
            const el = document.querySelector('.cg-wrap');
            if (el) {
                //            const baseWidth = dimensions[VARIANTS[this.variant].geom].width * (this.variant === "shogi" ? 52 : 64);
                //            const baseHeight = dimensions[VARIANTS[this.variant].geom].height * (this.variant === "shogi" ? 60 : 64);
                const baseWidth = parseInt(document.defaultView.getComputedStyle(el).width || '', 10);
                const baseHeight = parseInt(document.defaultView.getComputedStyle(el).height || '', 10);
                console.log(baseWidth, baseHeight, zoom);
                const pxw = `${zoom / 100 * baseWidth}px`;
                const pxh = `${zoom / 100 * baseHeight}px`;
                el.style.width = pxw;
                el.style.height = pxh;
                const ev = document.createEvent('Event');
                ev.initEvent('chessground.resize', false, false);
                document.body.dispatchEvent(ev);
            }
        };
        const resize = (move) => {
            const pos = eventPosition(move);
            const delta = pos[0] - startPos[0] + pos[1] - startPos[1];
            zoom = Math.round(Math.min(150, Math.max(0, initialZoom + delta / 10)));
            //      document.body.setAttribute('style', '--zoom:' + zoom);
            //      window.lichess.dispatchEvent(window, 'resize');
            setZoom(zoom);
            //      saveZoom();
        };
        document.body.classList.add('resizing');
        document.addEventListener(mousemoveEvent, resize);
        document.addEventListener(mouseupEvent, () => {
            document.removeEventListener(mousemoveEvent, resize);
            document.body.classList.remove('resizing');
        }, { once: true });
    });
    /*
      if (pref == 1) {
        const toggle = (ply: number) => el.classList.toggle('none', ply >= 2);
        toggle(ply);
        window.lichess.pubsub.on('ply', toggle);
      }
    
      addNag(el);
    */
}
exports.default = resizeHandle;
function eventPosition(e) {
    if (e.clientX || e.clientX === 0)
        return [e.clientX, e.clientY];
    if (e.touches && e.targetTouches[0])
        return [e.targetTouches[0].clientX, e.targetTouches[0].clientY];
    return undefined;
}
/*
function addNag(el: HTMLElement) {

  const storage = window.lichess.storage.makeBoolean('resize-nag');
  if (storage.get()) return;

  window.lichess.loadCssPath('nag-circle');
  el.title = 'Drag to resize';
  el.innerHTML = '<div class="nag-circle"></div>';
  el.addEventListener(window.lichess.mousedownEvent, () => {
    storage.set(true);
    el.innerHTML = '';
  }, { once: true });

  setTimeout(() => storage.set(true), 15000);
}
*/ 

},{}],45:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const ctrl_1 = __importDefault(require("./ctrl"));
const chess_1 = require("./chess");
const clock_1 = require("./clock");
function runGround(vnode, model) {
    const el = vnode.elm;
    const ctrl = new ctrl_1.default(el, model);
    const cg = ctrl.chessground;
    window['cg'] = cg;
}
function roundView(model) {
    console.log("roundView model=", model);
    const dataIcon = chess_1.VARIANTS[model["variant"]].icon;
    clock_1.renderTimeago();
    return [snabbdom_1.h('aside.sidebar-first', [
            snabbdom_1.h('div.game-info', [
                snabbdom_1.h('div.info0', { attrs: { "data-icon": dataIcon }, class: { "icon": true } }, [
                    snabbdom_1.h('div.info1', { attrs: { "data-icon": (model["chess960"] === 'True') ? "V" : "" }, class: { "icon": true } }),
                    snabbdom_1.h('div.info2', [
                        snabbdom_1.h('div.tc', model["base"] + "+" + model["inc"] + " • Casual • " + model["variant"]),
                        Number(model["status"]) >= 0 ? snabbdom_1.h('info-date', { attrs: { timestamp: model["date"] } }, clock_1.timeago(model["date"])) : "Playing right now",
                    ]),
                ]),
                snabbdom_1.h('div.player-data', [
                    snabbdom_1.h('i-side.online', { class: { "icon": true, "icon-white": true } }),
                    snabbdom_1.h('player', [
                        snabbdom_1.h('a.user-link', { attrs: { href: '/@/' + model["wplayer"] } }, [
                            snabbdom_1.h('player-title', " " + model["wtitle"] + " "),
                            model["wplayer"] + " (1500?)",
                        ]),
                    ]),
                ]),
                snabbdom_1.h('div.player-data', [
                    snabbdom_1.h('i-side.online', { class: { "icon": true, "icon-black": true } }),
                    snabbdom_1.h('player', [
                        snabbdom_1.h('a.user-link', { attrs: { href: '/@/' + model["bplayer"] } }, [
                            snabbdom_1.h('player-title', " " + model["btitle"] + " "),
                            model["bplayer"] + " (1500?)",
                        ]),
                    ]),
                ]),
            ]),
            snabbdom_1.h('div.roundchat#roundchat'),
        ]),
        snabbdom_1.h('main.main', [
            snabbdom_1.h('selection.' + chess_1.VARIANTS[model["variant"]].board + '.' + chess_1.VARIANTS[model["variant"]].pieces, [
                snabbdom_1.h('div.cg-wrap.' + chess_1.VARIANTS[model["variant"]].cg, { hook: { insert: (vnode) => runGround(vnode, model) },
                }),
            ]),
        ]),
        snabbdom_1.h('aside.sidebar-second', [
            snabbdom_1.h('div#pocket-wrapper', [
                snabbdom_1.h('div.' + chess_1.VARIANTS[model["variant"]].pieces + '.' + model["variant"], [
                    snabbdom_1.h('div.cg-wrap.pocket', [
                        snabbdom_1.h('div#pocket0'),
                    ]),
                ]),
            ]),
            snabbdom_1.h('div#clock0'),
            snabbdom_1.h('div.round-data', [
                snabbdom_1.h('round-player#rplayer0'),
                snabbdom_1.h('div#move-controls'),
                snabbdom_1.h('div#board-settings'),
                snabbdom_1.h('div#movelist-block', [
                    snabbdom_1.h('div#movelist'),
                    snabbdom_1.h('div#after-game'),
                    snabbdom_1.h('div#game-controls'),
                ]),
                snabbdom_1.h('round-player#rplayer1'),
            ]),
            snabbdom_1.h('div#clock1'),
            snabbdom_1.h('div#pocket-wrapper', [
                snabbdom_1.h('div.' + chess_1.VARIANTS[model["variant"]].pieces + '.' + model["variant"], [
                    snabbdom_1.h('div.cg-wrap.pocket', [
                        snabbdom_1.h('div#pocket1'),
                    ]),
                ]),
            ]),
            snabbdom_1.h('div#flip'),
        ]),
        snabbdom_1.h('under-left', "Spectators"),
        snabbdom_1.h('under-board', [snabbdom_1.h('div.#pgn')]),
    ];
}
exports.roundView = roundView;

},{"./chess":32,"./clock":33,"./ctrl":34,"snabbdom":26}],46:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const h_1 = __importDefault(require("snabbdom/h"));
const types_1 = require("chessgroundx/types");
const chess_1 = require("./chess");
const pocket_1 = require("./pocket");
const chess_2 = require("./chess");
const player_1 = require("./player");
// TODO: add dark/light theme buttons (icon-sun-o/icon-moon-o)
function changeCSS(cssFile) {
    // css file index in template.html
    var cssLinkIndex = 1;
    if (cssFile.includes("xiangqi")) {
        cssLinkIndex = 3;
    }
    else if (cssFile.includes("shogi")) {
        cssLinkIndex = 2;
    }
    else if (cssFile.includes("capasei")) {
        cssLinkIndex = 4;
    }
    else if (cssFile.includes("makruk")) {
        cssLinkIndex = 5;
    }
    document.getElementsByTagName("link").item(cssLinkIndex).setAttribute("href", cssFile);
}
exports.changeCSS = changeCSS;
function setPieces(CSSindexes, variant, color) {
    //console.log("setPieces()", variant, color)
    var idx = CSSindexes[chess_1.variants.indexOf(variant)];
    idx = Math.min(idx, chess_1.VARIANTS[variant].css.length - 1);
    if (variant === "shogi") {
        var css = chess_1.VARIANTS[variant].css[idx];
        // change shogi piece colors according to board orientation
        if (color === "black")
            css = css.replace('0', '1');
        changeCSS('/static/' + css + '.css');
    }
    else {
        changeCSS('/static/' + chess_1.VARIANTS[variant].css[idx] + '.css');
    }
}
exports.setPieces = setPieces;
function setZoom(ctrl, zoom) {
    const el = document.querySelector('.cg-wrap');
    if (el) {
        const baseWidth = types_1.dimensions[chess_1.VARIANTS[ctrl.variant].geom].width * (ctrl.variant === "shogi" ? 52 : 64);
        const baseHeight = types_1.dimensions[chess_1.VARIANTS[ctrl.variant].geom].height * (ctrl.variant === "shogi" ? 60 : 64);
        const pxw = `${zoom / 100 * baseWidth}px`;
        const pxh = `${zoom / 100 * baseHeight}px`;
        el.style.width = pxw;
        el.style.height = pxh;
        document.body.setAttribute('style', '--cgwrapwidth:' + pxw + ';--cgwrapheight:' + pxh);
        document.body.dispatchEvent(new Event('chessground.resize'));
        localStorage.setItem("zoom", String(zoom));
    }
}
exports.setZoom = setZoom;
// flip
function toggleOrientation(ctrl) {
    ctrl.flip = !ctrl.flip;
    ctrl.chessground.toggleOrientation();
    if (ctrl.variant === "shogi") {
        const color = ctrl.chessground.state.orientation === "white" ? "white" : "black";
        setPieces(ctrl.CSSindexes, ctrl.variant, color);
    }
    ;
    console.log("FLIP");
    if (chess_2.needPockets(ctrl.variant)) {
        const tmp_pocket = ctrl.pockets[0];
        ctrl.pockets[0] = ctrl.pockets[1];
        ctrl.pockets[1] = tmp_pocket;
        ctrl.vpocket0 = patch(ctrl.vpocket0, pocket_1.pocketView(ctrl, ctrl.flip ? ctrl.mycolor : ctrl.oppcolor, "top"));
        ctrl.vpocket1 = patch(ctrl.vpocket1, pocket_1.pocketView(ctrl, ctrl.flip ? ctrl.oppcolor : ctrl.mycolor, "bottom"));
    }
    // TODO: moretime button
    const new_running_clck = (ctrl.clocks[0].running) ? ctrl.clocks[1] : ctrl.clocks[0];
    ctrl.clocks[0].pause(false);
    ctrl.clocks[1].pause(false);
    const tmp_clock = ctrl.clocks[0];
    const tmp_clock_time = tmp_clock.duration;
    ctrl.clocks[0].setTime(ctrl.clocks[1].duration);
    ctrl.clocks[1].setTime(tmp_clock_time);
    if (ctrl.status < 0)
        new_running_clck.start();
    ctrl.vplayer0 = patch(ctrl.vplayer0, player_1.player('player0', ctrl.titles[ctrl.flip ? 1 : 0], ctrl.players[ctrl.flip ? 1 : 0], ctrl.model["level"]));
    ctrl.vplayer1 = patch(ctrl.vplayer1, player_1.player('player1', ctrl.titles[ctrl.flip ? 0 : 1], ctrl.players[ctrl.flip ? 0 : 1], ctrl.model["level"]));
}
exports.toggleOrientation = toggleOrientation;
function gearButton(ctrl) {
    return h_1.default('button#gear', {
        on: { click: () => toggleBoardSettings(ctrl) },
        class: { "selected": ctrl.settings }
    }, [h_1.default('i', {
            props: { title: 'Settings' },
            class: { "icon": true, "icon-cog": true }
        })]);
}
exports.gearButton = gearButton;
function toggleBoardSettings(ctrl) {
    ctrl.settings = !ctrl.settings;
    const el = document.getElementById('gear');
    if (el instanceof Element)
        patch(ctrl.vgear, gearButton(ctrl));
    document.getElementById('movelist-block').style.display = (ctrl.settings) ? 'none' : 'inline-grid';
    document.getElementById('board-settings').style.display = (ctrl.settings) ? 'inline-grid' : 'none';
}
exports.toggleBoardSettings = toggleBoardSettings;
function renderPieces(ctrl) {
    const variant = ctrl.variant;
    var vpiece = ctrl.CSSindexes[chess_1.variants.indexOf(ctrl.variant)];
    var i;
    const pieces = [];
    const togglePieces = (e) => {
        const idx = e.target.value;
        //console.log("togglePieces()", idx);
        ctrl.CSSindexes[chess_1.variants.indexOf(ctrl.variant)] = idx;
        localStorage.setItem(ctrl.variant + "_pieces", String(idx));
        setPieces(ctrl.CSSindexes, ctrl.variant, ctrl.mycolor);
    };
    for (i = 0; i < chess_1.VARIANTS[ctrl.variant].css.length; i++) {
        pieces.push(h_1.default('input#piece' + String(i), {
            on: { change: togglePieces },
            props: { type: "radio", name: "piece", value: String(i), checked: vpiece === String(i) ? "checked" : "" }
        }));
        pieces.push(h_1.default('label.piece.piece' + String(i) + '.' + variant, { attrs: { for: "piece" + String(i) } }, ""));
    }
    return pieces;
}
function settingsView(ctrl) {
    if (chess_1.VARIANTS[ctrl.variant].css.length > 1)
        setPieces(ctrl.CSSindexes, ctrl.variant, ctrl.mycolor);
    // turn settings panel off
    toggleBoardSettings(ctrl);
    if (localStorage.zoom !== undefined && localStorage.zoom !== 100)
        setZoom(ctrl, Number(localStorage.zoom));
    return h_1.default('div#board-settings', [
        h_1.default('div.settings-radio-group', renderPieces(ctrl)),
        // TODO: how to horizontaly center this?
        // h('label.zoom', { attrs: {for: "zoom"} }, "Board size"),
        h_1.default('input#zoom', {
            class: { "slider": true },
            attrs: { name: 'zoom', width: '280px', type: 'range', value: Number(localStorage.zoom), min: 60, max: 140 },
            on: { input: (e) => { setZoom(ctrl, parseFloat(e.target.value)); } }
        }),
    ]);
}
exports.settingsView = settingsView;

},{"./chess":32,"./player":39,"./pocket":41,"chessgroundx/types":16,"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],47:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class sounds {
    constructor() {
        this.buildManySounds = (file, qty) => {
            var soundArray = [];
            while (soundArray.length < qty) {
                var el = document.createElement("audio");
                if (el.canPlayType('audio/mpeg')) {
                    el.src = '/static/sound/' + file + '.mp3';
                }
                else {
                    el.src = '/static/sound/' + file + '.ogg';
                }
                el.setAttribute("preload", "none");
                el.style.display = "none";
                soundArray.push(el);
                document.body.appendChild(el);
            }
            return soundArray;
        };
        this.getSound = (type) => {
            let target = this.tracks[type];
            target.index = (target.index + 1) % target.pool.length;
            // console.log("SOUND:", type, target.index);
            return target.pool[target.index];
        };
        this.tracks = {
            GenericNotify: { name: 'GenericNotify', qty: 1, pool: [], index: 0 },
            Move: { name: 'Move', qty: 6, pool: [], index: 0 },
            Capture: { name: 'Capture', qty: 4, pool: [], index: 0 },
            Check: { name: 'Check', qty: 2, pool: [], index: 0 },
            Draw: { name: 'Draw', qty: 1, pool: [], index: 0 },
            Victory: { name: 'Victory', qty: 1, pool: [], index: 0 },
            Defeat: { name: 'Defeat', qty: 1, pool: [], index: 0 },
            ShogiMove: { name: 'komaoto5', qty: 6, pool: [], index: 0 },
            Chat: { name: 'chat', qty: 1, pool: [], index: 0 },
        };
        Object.keys(this.tracks).forEach(key => {
            let type = this.tracks[key];
            type.pool = this.buildManySounds(type.name, type.qty);
        });
    }
    genericNotify() { this.getSound('GenericNotify').play(); }
    ;
    move() { this.getSound('Move').play(); }
    ;
    capture() { this.getSound('Capture').play(); }
    ;
    check() { this.getSound('Check').play(); }
    ;
    draw() { this.getSound('Draw').play(); }
    ;
    victory() { this.getSound('Victory').play(); }
    ;
    defeat() { this.getSound('Defeat').play(); }
    ;
    shogimove() { this.getSound('ShogiMove').play(); }
    ;
    chat() { this.getSound('Chat').play(); }
    ;
}
exports.sound = new (sounds);

},{}],48:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const h_1 = __importDefault(require("snabbdom/h"));
// TODO: create logout button when logged in
/*
function login(home) {
    console.log("LOGIN WITH LICHESS");
    window.location.assign(home + '/login');
};
*/
function renderUsername(home, username) {
    console.log("renderUsername()", username, home);
    var oldVNode = document.getElementById('username');
    if (oldVNode instanceof Element) {
        oldVNode.innerHTML = '';
        patch(oldVNode, h_1.default('div#username', h_1.default('a.nav-link', { attrs: { href: '/@/' + username } }, username)));
    }
    ;
    /*
        // if username is not a logged in name login else logout button
        var oldVNode = document.getElementById('login');
        if (oldVNode instanceof Element) {
            oldVNode.innerHTML = '';
            patch(oldVNode as HTMLElement, h('button', { on: { click: () => login(home) }, props: {title: 'Login with Lichess'} }, [h('i', {class: {"icon": true, "icon-sign-in": true} } ), ]));
        };
    */
}
exports.renderUsername = renderUsername;

},{"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}]},{},[37])(37)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvY2hlc3Nncm91bmR4L3NyYy9hbmltLnRzIiwibm9kZV9tb2R1bGVzL2NoZXNzZ3JvdW5keC9zcmMvYXBpLnRzIiwibm9kZV9tb2R1bGVzL2NoZXNzZ3JvdW5keC9zcmMvYm9hcmQudHMiLCJub2RlX21vZHVsZXMvY2hlc3Nncm91bmR4L3NyYy9jaGVzc2dyb3VuZC50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL2NvbmZpZy50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL2RyYWcudHMiLCJub2RlX21vZHVsZXMvY2hlc3Nncm91bmR4L3NyYy9kcmF3LnRzIiwibm9kZV9tb2R1bGVzL2NoZXNzZ3JvdW5keC9zcmMvZHJvcC50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL2V2ZW50cy50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL2V4cGxvc2lvbi50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL2Zlbi50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL3ByZW1vdmUudHMiLCJub2RlX21vZHVsZXMvY2hlc3Nncm91bmR4L3NyYy9yZW5kZXIudHMiLCJub2RlX21vZHVsZXMvY2hlc3Nncm91bmR4L3NyYy9zdGF0ZS50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL3N2Zy50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL3R5cGVzLnRzIiwibm9kZV9tb2R1bGVzL2NoZXNzZ3JvdW5keC9zcmMvdXRpbC50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL3dyYXAudHMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vaC5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9odG1sZG9tYXBpLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL2lzLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL21vZHVsZXMvYXR0cmlidXRlcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL2NsYXNzLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMuanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vbW9kdWxlcy9wcm9wcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9zbmFiYmRvbS5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS90aHVuay5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS90b3Zub2RlLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3Zub2RlLmpzIiwibm9kZV9tb2R1bGVzL3NvY2tldHRlL2Rpc3Qvc29ja2V0dGUuanMiLCJzcmMvY2hhdC50cyIsInNyYy9jaGVzcy50cyIsInNyYy9jbG9jay50cyIsInNyYy9jdHJsLnRzIiwic3JjL2dhdGluZy50cyIsInNyYy9sb2JieS50cyIsInNyYy9tYWluLnRzIiwic3JjL21vdmVsaXN0LnRzIiwic3JjL3BsYXllci50cyIsInNyYy9wbGF5ZXJzLnRzIiwic3JjL3BvY2tldC50cyIsInNyYy9wcm9maWxlLnRzIiwic3JjL3Byb21vdGlvbi50cyIsInNyYy9yZXNpemUudHMiLCJzcmMvcm91bmQudHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvc291bmQudHMiLCJzcmMvdXNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FDQ0EsK0JBQThCO0FBNEI5QixTQUFnQixJQUFJLENBQUksUUFBcUIsRUFBRSxLQUFZO0lBQ3pELE9BQU8sS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDdEYsQ0FBQztBQUZELG9CQUVDO0FBRUQsU0FBZ0IsTUFBTSxDQUFJLFFB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QUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUN2RCxNQUFNLE9BQU8sR0FBRyxjQUFPLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQzVDLElBQUksVUFBVSxFQUFFLFVBQVUsRUFBRSxVQUFVLENBQUM7SUFDdkMsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDeEMsVUFBVSxHQUFHLGNBQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDdEQsVUFBVSxHQUFHLGNBQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDdEQsVUFBVSxHQUFHLGNBQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDdkQ7U0FBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUMvQyxVQUFVLEdBQUcsY0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN0RCxVQUFVLEdBQUcsY0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN0RCxVQUFVLEdBQUcsY0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztLQUN2RDs7UUFBTSxPQUFP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LE1BQU0sRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLE9BQU87Q0FBRSxDQUFDO0FBRXBHLE1BQU0sT0FBTyxHQUFrQztJQUMzQyxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsU0FBUztDQUFFLENBQUM7QUFHM0YsTUFBTSxRQUFRLEdBQUc7SUFDYixJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsR0FBRztDQUFFLENBQUM7QUFFekssTUFBTSxRQUFRLEdBQUc7SUFDYixJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxHQUFHO0lBQzdGLEtBQUssRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSTtDQUFFLENBQUM7QUFFMUYsTUFBTSxTQUFTLEdBQUc7SUFDZCxJQUFJLEVBQUUsR0FBRyxFQUFFLElB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U0FBUyxJQUFJLENBQUMsS0FBZSxFQUFFLFNBQW1CLEVBQUUsU0FBa0I7SUFDcEUsT0FBTyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRyxFQUFFLENBQUMsQ0FDMUIsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQ3JDLElBQUksQ0FDSCxTQUFTLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxLQUFLLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQzlELENBQUMsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQ3RFLENBQ0YsQ0FBQztBQUNKLENBQUM7QUFHRCxNQUFNLEdBQUcsR0FBYSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0lBQ3ZDLE9BQU8sSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsS0FBSyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzdELENBQUMsQ0FBQTtBQUdELE1BQU0sVUFBVSxHQUFhLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDOUMsT0FBTyxNQUFNLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksTUFBTSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQzFELENBQUMsQ0FBQTtBQUdELE1BQU0sU0FBUyxHQUFhLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDN0MsT0FBTyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksTUFBTSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3hELENBQUMsQ0FBQTtBQUdELFNBQVMsS0FBSyxDQUFDLEtBQWU7SUFDNUIsT0FBTyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FDekIsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FDckQsQ0FBQztBQUNKLENBQUM7QUFHRCxTQUFTLE1BQU0sQ0FBQyxLQUFlO0lBQzdCLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUcsRUFBRSxDQUFDLENBQzFCLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUMxRixDQUFDO0FBQ0osQ0FBQztBQUdELFNBQVMsSUFBSSxDQUFDLEtBQWU7SUFDM0IsT0FBTyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRyxFQUFFLENBQUMsQ0FDMUIsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FDdEMsS0FBSyxLQUFLLE9BQU8sQ0FBQyxDQUFDO1FBQ2pCLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN6RSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUMxRSxDQUNGLENBQUM7QUFDSixDQUFDO0FBR0QsU0FBUyxLQUFLLENBQUMsS0FBZTtJQUM1QixPQUFPLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hHLENBQUM7QUFHRCxTQUFTLE9BQU8sQ0FBQyxLQUFlO0lBQzlCLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEtBQUssS0FBSyxPQUFPLENBQUMsQ0FBQztRQUM1QyxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRSxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDdkUsQ0FBQztBQUdELE1BQU0sS0FBSyxHQUFhLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDekMsT0FBTyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3hFLENBQUMsQ0FBQTtBQUdELE1BQU0sT0FBTyxHQUFhLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDM0MsT0FBTyxNQUFNLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzFFLENBQUMsQ0FBQTtBQUdELE1BQU0sS0FBSyxHQUFhLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDekMsT0FBTyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM5QyxDQUFDLENBQUE7QUFHRCxTQUFTLEtBQUssQ0FBQyxLQUFlO0lBQzVCLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQ3pCLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2xFLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FDdEYsQ0FBQztBQUNOLENBQUM7QUFHRCxNQUFNLE9BQU8sR0FBYSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0lBQzNDLE9BQU8sSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsS0FBSyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzdELENBQUMsQ0FBQTtBQUdELE1BQU0sT0FBTyxHQUFhLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDM0MsT0FBTyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxLQUFLLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDN0QsQ0FBQyxDQUFBO0FBR0QsTUFBTSxLQUFLLEdBQWEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtJQUV6QyxPQUFPLENBQUMsRUFBRSxLQUFL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R0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFFdEMsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3BDLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUVyQyxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFFdEMsTUFBTSxVQUFVLEdBQWEsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDOUYsTUFBTSxVQUFVLEdBQWEsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDOUYsTUFBTSxXQUFXLEdBQWEsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEcsTUFBTSxXQUFXLEdBQWEsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FB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QUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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RUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUU7SUFDOUgsVUFBVSxFQUFFLEVBQUUsSUFBSSxpQkFBa0IsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUU7SUFDbkosU0FBUyxFQUFFLEVBQUUsSUFBSSxpQkFBa0IsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUU7SUFDbEosS0FBSyxFQUFFLEVBQUUsSUFBSSxrQkFBbUIsRUFBRSxFQUFFLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUU7SUFDOUksVUFBVSxFQUFFLEVBQUUsSUFBSSxrQkFBbUIsRUFBRSxFQUFFLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUU7SUFDbkosUUFBUSxFQUFFLEVBQUUsSUFBSSxnQkFBaUIsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUU7SUFDM0ksTUFBTSxFQUFFLEVBQUUsSUFBSSxnQkFBaUIsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUU7SUFDekksUUFBUSxFQUFFLEVBQUUsSUFBSSxnQkFBaUIsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRTtDQUMvSCxDQUFBO0FBRUQsU0FBZ0IsV0FBVyxDQUFDLE9BQWU7SUFDdkMsUUFBUSxPQUFPLEVBQUU7UUFDakIsS0FBSyxVQUFVO1lBQ1gsT0FBTyxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN4RCxLQUFLLFlBQVk7WUFDYixPQUFPLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3pELEtBQUssWUFBWSxDQUFDO1FBQ2xCLEtBQUssV0FBVztZQUNaLE9BQU8sQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBRSxXQUFXLENBQUMsQ0FBQztRQUNwRixLQUFLLE9BQU87WUFDUixPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDM0UsS0FBSyxRQUFRO1lBQ1QsT0FBTyxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzdFLEtBQUssVUFBVTtZQUNYLE9BQU8sQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDaEM7WUFDSSxPQUFPLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0tBQ3hEO0FBQ0wsQ0FBQztBQWxCRCxrQ0FrQkM7QUFFRCxTQUFTLGFBQWEsQ0FBQyxPQUFlLEVBQUUsS0FBYTtJQUNqRCxRQUFRLE9BQU8sRUFBRTtRQUNqQixLQUFLLE9BQU87WUFDUixPQUFPLEtBQUssS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLHdEQUF3RCxDQUFDLENBQUMsQ0FBQyx3REFBd0QsQ0FBQztRQUNuSixLQUFLLFFBQVE7WUFDVCxPQUFPLEtBQUssS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQztRQUN2RSxLQUFLLFVBQVU7WUFDWCxPQUFPLEtBQUssS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQztRQUN2RTtZQUNJLE9BQU8sS0FBSyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixDQUFDO0tBQzlFO0FBQ0wsQ0FBQztBQUVELFNBQWdCLGNBQWMsQ0FBQyxPQUFlLEVBQUUsSUFBVSxFQUFFLElBQVMsRUFBRSxJQUFTLEVBQUUsVUFBVTtJQUN4RixRQUFRLE9BQU8sRUFBRTtRQUNqQixLQUFLLFdBQVcsQ0FBQztRQUNqQixLQUFLLFlBQVk7WUFDYixPQUFPLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxXQUFXLENBQUMsQ0FBQztRQUM1RSxLQUFLLFFBQVEsQ0FBQztRQUNkLEtBQUssVUFBVTtZQUNYLE9BQU8sQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3JFLEtBQUssT0FBTztZQUNSLE9BQU8sQ0FBQyxHQUFHLEdBQUcsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzlCLEtBQUssWUFBWSxDQUFDO1FBQ2xCLEtBQUssT0FBTztZQUNSLElBQUksS0FBSyxHQUFXLEVBQUUsQ0FBQztZQUN2QixNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDMUQsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFO2dCQUN4QixNQUFNLEtBQUssR0FBRyxpQkFBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN4QyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7b0JBQ2xFLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQ3JCO1lBQ0wsQ0FBQyxDQUFDLENBQUM7WUFDSCw2Q0FBNkM7WUFDN0MsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUM7Z0JBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM3RCxPQUFPLEtBQUssQ0FBQztRQUNqQjtZQUNJLE9BQU8sQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztLQUNoRDtBQUNMLENBQUM7QUExQkQsd0NBMEJDO0FBRUQsU0FBZ0Isa0JBQWtCLENBQUMsSUFBVSxFQUFFLElBQVMsRUFBRSxLQUFZO0lBQ2xFLFFBQVEsSUFBSSxFQUFFO1FBQ2QsS0FBSyxNQUFNLENBQUM7UUFDWixLQUFLLE9BQU87WUFDUixJQUFJLEtBQUssS0FBSyxPQUFPLEVBQUU7Z0JBQ25CLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQzthQUMxQjtpQkFBTTtnQkFDSCxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUM7YUFDMUI7UUFDTCxLQUFLLFFBQVE7WUFDVCxJQUFJLEtBQUssS0FBSyxPQUFPLEVBQUU7Z0JBQ25CLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDO2FBQzdDO2lCQUFNO2dCQUNILE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDO2FBQzdDO1FBQ0w7WUFDSSxPQUFPLEtBQUssQ0FBQztLQUNoQjtBQUNMLENBQUM7QUFsQkQsZ0RBa0JDO0FBRUQsU0FBZ0IsV0FBVyxDQUFDLE9BQWU7SUFDdkMsT0FBTyxPQUFPLEtBQUssV0FBVyxJQUFJLE9BQU8sS0FBSyxZQUFZLElBQUksT0FBTyxLQUFLLFVBQVUsSUFBSSxPQUFPLEtBQUssT0FBTyxJQUFJLE9BQU8sS0FBSyxVQUFVLElBQUksT0FBTyxLQUFLLFdBQVcsSUFBSSxPQUFPLEtBQUssUUFBUSxJQUFJLE9BQU8sS0FBSyxZQUFZLENBQUM7QUFDek4sQ0FBQztBQUZELGtDQUVDO0FBRUQsU0FBZ0IsS0FBSyxDQUFDLE9BQWU7SUFDakMsT0FBTyxPQUFPLEtBQUssVUFBVSxJQUFJLE9BQU8sS0FBSyxXQUFXLElBQUksT0FBTyxLQUFLLFlBQVksSUFBSSxPQUFPLEtBQUssWUFBWSxJQUFJLE9BQU8sS0FBSyxVQUFVLElBQUksT0FBTyxLQUFLLFdBQVcsSUFBSSxPQUFPLEtBQUssUUFBUSxJQUFJLE9BQU8sS0FBSyxPQUFPLElBQUksT0FBTyxLQUFLLFlBQVksQ0FBQztBQUNyUCxDQUFDO0FBRkQsc0JBRUM7QUFFRCxTQUFTLElBQUksQ0FBQyxDQUFTLEVBQUUsQ0FBUTtJQUMvQixPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3pCLENBQUM7QUFFRCxTQUFTLFlBQVksQ0FBQyxJQUFJLEVBQUUsSUFBSTtJQUM1QixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEMsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDakMsQ0FBQztBQUVELFNBQWdCLE9BQU8sQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtJQUNoRCxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDM0QsTUFBTSxPQUFPLEdBQUcsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFBO0lBQzFELElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxLQUFLLE9BQU8sSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQztRQUNsRCxDQUFDLEtBQUssQ0FBQyxLQUFLLEtBQUssT0FBTyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDO1FBQ2xELENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxNQUFNLENBQUM7UUFDdkIsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQztRQUFFLE9BQU8sT0FBTyxDQUFDO0lBRWhELHFFQUFxRTtJQUNyRSw2RUFBNkU7SUFFN0UsMERBQTBEO0lBQzFELCtFQUErRTtJQUUvRSxvRUFBb0U7SUFFcEUsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM3QixNQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDM0IsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZCLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2Qiw0REFBNEQ7SUFDNUQsUUFBUSxJQUFJLEVBQUU7UUFDZCxLQUFLLElBQUk7WUFDTCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQUUsT0FBTyxPQUFPLENBQUM7WUFDM0UsTUFBTTtRQUNWLEtBQUssSUFBSTtZQUNMLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQUUsT0FBTyxPQUFPLENBQUM7WUFDOUMsTUFBTTtRQUNWLEtBQUssSUFBSTtZQUNMLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQUUsT0FBTyxPQUFPLENBQUM7WUFDOUMsTUFBTTtRQUNWLEtBQUssSUFBSTtZQUNMLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQUUsT0FBTyxPQUFPLENBQUM7WUFDOUMsTUFBTTtRQUNWLEtBQUssSUFBSTtZQUNMLElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7Z0JBQ3ZCLE9BQU8sT0FBTyxDQUFDO2FBQ2xCO2lCQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ25FLE9BQU8sT0FBTyxDQUFDO2FBQ2xCO2lCQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtnQkFDbEMsT0FBTyxPQUFPLENBQUM7YUFDbEI7WUFBQSxDQUFDO1lBQ0YsTUFBTTtRQUNWLEtBQUssSUFBSTtZQUNMLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQUUsT0FBTyxPQUFPLENBQUM7WUFDOUMsTUFBTTtRQUNWLEtBQUssSUFBSTtZQUNMLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQUUsT0FBTyxPQUFPLENBQUM7WUFDOUMsTUFBTTtRQUNWLEtBQUssSUFBSTtZQUNMLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFBRSxPQUFPLE9BQU8sQ0FBQztZQUMzRSxNQUFNO1FBQ1YsS0FBSyxJQUFJO1lBQ0wsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUFFLE9BQU8sT0FBTyxDQUFDO1lBQzNFLE1BQU07UUFDVixLQUFLLElBQUk7WUFDTCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUFFLE9BQU8sT0FBTyxDQUFDO1lBQzlDLE1BQU07UUFDVixLQUFLLElBQUk7WUFDTCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUFFLE9BQU8sT0FBTyxDQUFDO1lBQzlDLE1BQU07UUFDVixLQUFLLElBQUk7WUFDTCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUFFLE9BQU8sT0FBTyxDQUFDO1lBQzlDLE1BQU07UUFDVixLQUFLLElBQUk7WUFDTCxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssTUFBTSxFQUFFO2dCQUN2QixPQUFPLE9BQU8sQ0FBQzthQUNsQjtpQkFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUNuRSxPQUFPLE9BQU8sQ0FBQzthQUNsQjtpQkFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7Z0JBQ2xDLE9BQU8sT0FBTyxDQUFDO2FBQ2xCO1lBQUEsQ0FBQztZQUNGLE1BQU07UUFDVixLQUFLLElBQUk7WUFDTCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUFFLE9BQU8sT0FBTyxDQUFDO1lBQzlDLE1BQU07UUFDVixLQUFLLElBQUk7WUFDTCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUFFLE9BQU8sT0FBTyxDQUFDO1lBQzlDLE1BQU07UUFDVixLQUFLLElBQUk7WUFDTCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQUUsT0FBTyxPQUFPLENBQUM7WUFDM0UsTUFBTTtLQUNUO0lBQUEsQ0FBQztJQUNGLE1BQU0sVUFBVSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDMUMsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUM1QyxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxLQUFLLEtBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQy9DLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLEtBQUssS0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDL0MsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsS0FBSyxLQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvQyxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxLQUFLLEtBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQy9DLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLEtBQUssS0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDL0MsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsS0FBSyxLQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUUvQyxPQUFPLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNwQyxDQUFDO0FBN0ZELDBCQTZGQztBQUVELFNBQWdCLFdBQVcsQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFVBQVU7SUFDcEUsSUFBSSxPQUFPLEtBQUssU0FBUztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ3hDLE1BQU0sRUFBRSxHQUFHLGFBQWEsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFD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QUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7S0FDN0U7SUFDRCxJQUFJLFlBQVksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7UUFDdkMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2xELEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUM3QyxPQUFPLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7S0FDNUQ7U0FBTTtRQUNILEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3ZDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUM3QyxPQUFPLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7S0FDNUQ7QUFDTCxDQUFDO0FBckJELGdDQXFCQztBQUVZLFFBQUEs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SUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3hGLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2hHLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzFGLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3hGLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzVGLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFF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QUFHLEVBQUUsS0FBSyxFQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7Z0NBQ3JELFdBQUMsQ0FBQyxXQUFXLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDO2dDQUNoSCxXQUFDLENBQUMsb0JBQW9CLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBQyxHQUFHLEVBQUUsS0FBSyxFQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7Z0NBQ3JELFdBQUMsQ0FBQyxXQUFXLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDO2dDQUNoSCxXQUFDLENBQUMsb0JBQW9CLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBQyxHQUFHLEVBQUUsS0FBSyxFQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7Z0NBQ3JELFdBQUMsQ0FBQyxXQUFXLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDO2dDQUNoSCxXQUFDLENBQUMsb0JBQW9CLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBQyxHQUFHLEVBQUUsS0FBSyxFQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7Z0NBQ3JELFdBQUMsQ0FBQyxXQUFXLEVBQUUsRUFBRSxL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LEVBQUUsQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDL0MsS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN0RSxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNqRCxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUNuRCxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNqRCxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUNuRCxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNqRCxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMzQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM3QyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMzQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNqRCxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNqRCxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM3QyxLQUFLLENBQUMsSUFBSSxD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LENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxXQUFDLENBQUMsR0FBRyxFQUFFLEVBQUMsS0FBSyxFQUFFLEVBQUMsS0FBSyxFQUFFLFlBQVksRUFBQyxFQUFFLEtBQUssRUFBRSxFQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBQyxFQUFFLENBQUUsRUFBRyxDQUFDO1FBQ3hKLFdBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxXQUFDLENBQUMsR0FBRyxFQUFFLEVBQUMsS0FBSyxFQUFFLEVBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxvQkFBb0IsRUFBRSxJQUFJLEVBQUMsRUFBRSxDQUFFLEVBQUcsQ0FBQztRQUM1SCxXQUFDLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLFdBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBQyxLQUFLLEVBQUUsRUFBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLG9CQUFvQixFQUFFLElBQUksRUFBQyxFQUFFLENBQUUsRUFBRyxDQUFDO1FBQ3BKLFdBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsV0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFDLEtB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LEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRyxDQUFDLEVBQUUsSUFBSSxFQUFHLEVBQUUsRUFBRSxLQUFLLEVBQUcsQ0FBQyxFQUFDO1lBQ3RELElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFHLENBQUMsRUFBRSxJQUFJLEVBQUcsRUFBRSxFQUFFLEtBQUssRUFBRyxDQUFDLEVBQUM7WUFDcEQsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUcsQ0FBQyxFQUFFLElBQUksRUFBRyxFQUFFLEVBQUUsS0FBSyxFQUFHLENBQUMsRUFBQztZQUMxRCxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRyxDQUFDLEVBQUUsSUFBSSxFQUFHLEVBQUUsRUFBRSxLQUFLLEVBQUcsQ0FBQyxFQUFDO1lBQ3hELFNBQVMsRUFBRSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFHLENBQUMsRUFBRSxJQUFJLEVBQUcsRUFBRSxFQUFFLEtBQUssRUFBRyxDQUFDLEVBQUM7WUFDN0QsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUcsQ0FBQyxFQUFFLElBQUksRUFBRyxFQUFFLEVBQUUsS0FBSyxFQUFHLENBQUMsRUFBQztTQUN2RCxDQUFBO1FBRUQsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQ25DLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDNUIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzFELENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQTBCRCxhQUFhLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFBQSxDQUFDO0lBQzNELElBQUksS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUFBLENBQUM7SUFDekMsT0FBTyxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQUEsQ0FBQztJQUMvQyxLQUFLLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFBQSxDQUFDO0lBQzNDLElBQUksS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUFBLENBQUM7SUFDekMsT0FBTyxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQUEsQ0FBQztJQUMvQyxNQUFNLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFBQSxDQUFDO0lBQzdDLFNBQVMsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUFBLENBQUM7SUFDbkQsSUFBSSxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQUEsQ0FBQztDQUM1QztBQUVZLFFBQUEsS0FBSyxHQUFHLElBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQzs7Ozs7Ozs7QUN4RGpDLHVDQUFnQztBQUNoQyxtRUFBMkM7QUFDM0MsNkVBQXFEO0FBQ3JELG1FQUFnRDtBQUNoRCxxRkFBd0Q7QUFFeEQsTUFBTSxLQUFLLEdBQUcsZUFBSSxDQUFDLENBQUMsZUFBSyxFQUFFLG9CQUFVLEVBQUUsZUFBVSxFQUFFLHdCQUFTLENBQUMsQ0FBQyxDQUFDO0FBRS9ELG1EQUEyQjtBQUUzQiw0Q0FBNEM7QUFDNUM7Ozs7O0VBS0U7QUFDRixTQUFnQixjQUFjLENBQUMsSUFBSSxFQUFFLFFBQVE7SUFDekMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDaEQsSUFBSSxRQUFRLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNuRCxJQUFJLFFBQVEsWUFBWSxPQUFPLEVBQUU7UUFDN0IsUUFBUSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7UUFDeEIsS0FBSyxDQUFDLFFBQXVCLEVBQUUsV0FBQyxDQUFDLGNBQWMsRUFBRSxXQUFDLENBQUMsWUFBWSxFQUFFLEVBQUMsS0FBSyxFQUFFLEVBQUMsSUFBSSxFQUFFLEtBQUssR0FBRyxRQUFRLEVBQUMsRUFBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNuSDtJQUFBLENBQUM7SUFDTjs7Ozs7OztNQU9FO0FBQ0YsQ0FBQztBQWZELHdDQWVDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJ1xuXG5leHBvcnQgdHlwZSBNdXRhdGlvbjxBPiA9IChzdGF0ZTogU3RhdGUpID0+IEE7XG5cbi8vIDAsMSBhbmltYXRpb24gZ29hbFxuLy8gMiwzIGFuaW1hdGlvbiBjdXJyZW50IHN0YXR1c1xuZXhwb3J0IHR5cGUgQW5pbVZlY3RvciA9IGNnLk51bWJlclF1YWRcblxuZXhwb3J0IGludGVyZmFjZSBBbmltVmVjdG9ycyB7XG4gIFtrZXk6IHN0cmluZ106IEFuaW1WZWN0b3Jcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBbmltRmFkaW5ncyB7XG4gIFtrZXk6IHN0cmluZ106IGNnLlBpZWNlXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQW5pbVBsYW4ge1xuICBhbmltczogQW5pbVZlY3RvcnM7XG4gIGZhZGluZ3M6IEFuaW1GYWRpbmdzO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFuaW1DdXJyZW50IHtcbiAgc3RhcnQ6IERPTUhpZ2hSZXNUaW1lU3RhbXA7XG4gIGZyZXF1ZW5jeTogY2cuS0h6O1xuICBwbGFuOiBBbmltUGxhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFuaW08QT4obXV0YXRpb246IE11dGF0aW9uPEE+LCBzdGF0ZTogU3RhdGUpOiBBIHtcbiAgcmV0dXJuIHN0YXRlLmFuaW1hdGlvbi5lbmFibGVkID8gYW5pbWF0ZShtdXRhdGlvbiwgc3RhdGUpIDogcmVuZGVyKG11dGF0aW9uLCBzdGF0ZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXI8QT4obXV0YXRpb246IE11dGF0aW9uPEE+LCBzdGF0ZTogU3RhdGUpOiBBIHtcbiAgY29uc3QgcmVzdWx0ID0gbXV0YXRpb24oc3RhdGUpO1xuICBzdGF0ZS5kb20ucmVkcmF3KCk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmludGVyZmFjZSBBbmltUGllY2Uge1xuICBrZXk6IGNnLktleTtcbiAgcG9zOiBjZy5Qb3M7XG4gIHBpZWNlOiBjZy5QaWVjZTtcbn1cbmludGVyZmFjZSBBbmltUGllY2VzIHtcbiAgW2tleTogc3RyaW5nXTogQW5pbVBpZWNlXG59XG5cbmZ1bmN0aW9uIG1ha2VQaWVjZShrZXk6IGNnLktleSwgcGllY2U6IGNnLlBpZWNlLCBmaXJzdFJhbmtJczA6IGJvb2xlYW4pOiBBbmltUGllY2Uge1xuICByZXR1cm4ge1xuICAgIGtleToga2V5LFxuICAgIHBvczogdXRpbC5rZXkycG9zKGtleSwgZmlyc3RSYW5rSXMwKSxcbiAgICBwaWVjZTogcGllY2VcbiAgfTtcbn1cblxuZnVuY3Rpb24gY2xvc2VyKHBpZWNlOiBBbmltUGllY2UsIHBpZWNlczogQW5pbVBpZWNlW10pOiBBbmltUGllY2Uge1xuICByZXR1cm4gcGllY2VzLnNvcnQoKHAxLCBwMikgPT4ge1xuICAgIHJldHVybiB1dGlsLmRpc3RhbmNlU3EocGllY2UucG9zLCBwMS5wb3MpIC0gdXRpbC5kaXN0YW5jZVNxKHBpZWNlLnBvcywgcDIucG9zKTtcbiAgfSlbMF07XG59XG5cbmZ1bmN0aW9uIGNvbXB1dGVQbGFuKHByZXZQaWVjZXM6IGNnLlBpZWNlcywgY3VycmVudDogU3RhdGUpOiBBbmltUGxhbiB7XG4gIGNvbnN0IGZpcnN0UmFua0lzMCA9IGN1cnJlbnQuZGltZW5zaW9ucy5oZWlnaHQgPT09IDEwO1xuICBjb25zdCBhbmltczogQW5pbVZlY3RvcnMgPSB7fSxcbiAgYW5pbWVkT3JpZ3M6IGNnLktleVtdID0gW10sXG4gIGZhZGluZ3M6IEFuaW1GYWRpbmdzID0ge30sXG4gIG1pc3NpbmdzOiBBbmltUGllY2VbXSA9IFtdLFxuICBuZXdzOiBBbmltUGllY2VbXSA9IFtdLFxuICBwcmVQaWVjZXM6IEFuaW1QaWVjZXMgPSB7fTtcbiAgbGV0IGN1clA6IGNnLlBpZWNlIHwgdW5kZWZpbmVkLCBwcmVQOiBBbmltUGllY2UgfCB1bmRlZmluZWQsIGk6IGFueSwgdmVjdG9yOiBjZy5OdW1iZXJQYWlyO1xuICBmb3IgKGkgaW4gcHJldlBpZWNlcykge1xuICAgIHByZVBpZWNlc1tpXSA9IG1ha2VQaWVjZShpIGFzIGNnLktleSwgcHJldlBpZWNlc1tpXSEsIGZpcnN0UmFua0lzMCk7XG4gIH1cbiAgZm9yIChjb25zdCBrZXkgb2YgdXRpbC5hbGxLZXlzW2N1cnJlbnQuZ2VvbWV0cnldKSB7XG4gICAgY3VyUCA9IGN1cnJlbnQucGllY2VzW2tleV07XG4gICAgcHJlUCA9IHByZVBpZWNlc1trZXldO1xuICAgIGlmIChjdXJQKSB7XG4gICAgICBpZiAocHJlUCkge1xuICAgICAgICBpZiAoIXV0aWwuc2FtZVBpZWNlKGN1clAsIHByZVAucGllY2UpKSB7XG4gICAgICAgICAgbWlzc2luZ3MucHVzaChwcmVQKTtcbiAgICAgICAgICBuZXdzLnB1c2gobWFrZVBpZWNlKGtleSwgY3VyUCwgZmlyc3RSYW5rSXMwKSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBuZXdzLnB1c2gobWFrZVBpZWNlKGtleSwgY3VyUCwgZmlyc3RSYW5rSXMwKSk7XG4gICAgfSBlbHNlIGlmIChwcmVQKSBtaXNzaW5ncy5wdXNoKHByZVApO1xuICB9XG4gIG5ld3MuZm9yRWFjaChuZXdQID0+IHtcbiAgICBwcmVQID0gY2xvc2VyKG5ld1AsIG1pc3NpbmdzLmZpbHRlcihwID0+IHV0aWwuc2FtZVBpZWNlKG5ld1AucGllY2UsIHAucGllY2UpKSk7XG4gICAgaWYgKHByZVApIHtcbiAgICAgIHZlY3RvciA9IFtwcmVQLnBvc1swXSAtIG5ld1AucG9zWzBdLCBwcmVQLnBvc1sxXSAtIG5ld1AucG9zWzFdXTtcbiAgICAgIGFuaW1zW25ld1Aua2V5XSA9IHZlY3Rvci5jb25jYXQodmVjdG9yKSBhcyBBbmltVmVjdG9yO1xuICAgICAgYW5pbWVkT3JpZ3MucHVzaChwcmVQLmtleSk7XG4gICAgfVxuICB9KTtcbiAgbWlzc2luZ3MuZm9yRWFjaChwID0+IHtcbiAgICBpZiAoIXV0aWwuY29udGFpbnNYKGFuaW1lZE9yaWdzLCBwLmtleSkpIGZhZGluZ3NbcC5rZXldID0gcC5waWVjZTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBhbmltczogYW5pbXMsXG4gICAgZmFkaW5nczogZmFkaW5nc1xuICB9O1xufVxuXG5mdW5jdGlvbiBzdGVwKHN0YXRlOiBTdGF0ZSwgbm93OiBET01IaWdoUmVzVGltZVN0YW1wKTogdm9pZCB7XG4gIGNvbnN0IGN1ciA9IHN0YXRlLmFuaW1hdGlvbi5jdXJyZW50O1xuICBpZiAoY3VyID09PSB1bmRlZmluZWQpIHsgLy8gYW5pbWF0aW9uIHdhcyBjYW5jZWxlZCA6KFxuICAgIGlmICghc3RhdGUuZG9tLmRlc3Ryb3llZCkgc3RhdGUuZG9tLnJlZHJhd05vdygpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCByZXN0ID0gMSAtIChub3cgLSBjdXIuc3RhcnQpICogY3VyLmZyZXF1ZW5jeTtcbiAgaWYgKHJlc3QgPD0gMCkge1xuICAgIHN0YXRlLmFuaW1hdGlvbi5jdXJyZW50ID0gdW5kZWZpbmVkO1xuICAgIHN0YXRlLmRvbS5yZWRyYXdOb3coKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBlYXNlID0gZWFzaW5nKHJlc3QpO1xuICAgIGZvciAobGV0IGkgaW4gY3VyLnBsYW4uYW5pbXMpIHtcbiAgICAgIGNvbnN0IGNmZyA9IGN1ci5wbGFuLmFuaW1zW2ldO1xuICAgICAgY2ZnWzJdID0gY2ZnWzBdICogZWFzZTtcbiAgICAgIGNmZ1szXSA9IGNmZ1sxXSAqIGVhc2U7XG4gICAgfVxuICAgIHN0YXRlLmRvbS5yZWRyYXdOb3codHJ1ZSk7IC8vIG9wdGltaXNhdGlvbjogZG9uJ3QgcmVuZGVyIFNWRyBjaGFuZ2VzIGR1cmluZyBhbmltYXRpb25zXG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKChub3cgPSBwZXJmb3JtYW5jZS5ub3coKSkgPT4gc3RlcChzdGF0ZSwgbm93KSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gYW5pbWF0ZTxBPihtdXRhdGlvbjogTXV0YXRpb248QT4sIHN0YXRlOiBTdGF0ZSk6IEEge1xuICAvLyBjbG9uZSBzdGF0ZSBiZWZvcmUgbXV0YXRpbmcgaXRcbiAgY29uc3QgcHJldlBpZWNlczogY2cuUGllY2VzID0gey4uLnN0YXRlLnBpZWNlc307XG5cbiAgY29uc3QgcmVzdWx0ID0gbXV0YXRpb24oc3RhdGUpO1xuICBjb25zdCBwbGFuID0gY29tcHV0ZVBsYW4ocHJldlBpZWNlcywgc3RhdGUpO1xuICBpZiAoIWlzT2JqZWN0RW1wdHkocGxhbi5hbmltcykgfHwgIWlzT2JqZWN0RW1wdHkocGxhbi5mYWRpbmdzKSkge1xuICAgIGNvbnN0IGFscmVhZHlSdW5uaW5nID0gc3RhdGUuYW5pbWF0aW9uLmN1cnJlbnQgJiYgc3RhdGUuYW5pbWF0aW9uLmN1cnJlbnQuc3RhcnQ7XG4gICAgc3RhdGUuYW5pbWF0aW9uLmN1cnJlbnQgPSB7XG4gICAgICBzdGFydDogcGVyZm9ybWFuY2Uubm93KCksXG4gICAgICBmcmVxdWVuY3k6IDEgLyBzdGF0ZS5hbmltYXRpb24uZHVyYXRpb24sXG4gICAgICBwbGFuOiBwbGFuXG4gICAgfTtcbiAgICBpZiAoIWFscmVhZHlSdW5uaW5nKSBzdGVwKHN0YXRlLCBwZXJmb3JtYW5jZS5ub3coKSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gZG9uJ3QgYW5pbWF0ZSwganVzdCByZW5kZXIgcmlnaHQgYXdheVxuICAgIHN0YXRlLmRvbS5yZWRyYXcoKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBpc09iamVjdEVtcHR5KG86IGFueSk6IGJvb2xlYW4ge1xuICBmb3IgKGxldCBfIGluIG8pIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIHRydWU7XG59XG4vLyBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9ncmUvMTY1MDI5NFxuZnVuY3Rpb24gZWFzaW5nKHQ6IG51bWJlcik6IG51bWJlciB7XG4gIHJldHVybiB0IDwgMC41ID8gNCAqIHQgKiB0ICogdCA6ICh0IC0gMSkgKiAoMiAqIHQgLSAyKSAqICgyICogdCAtIDIpICsgMTtcbn1cbiIsImltcG9ydCB7IFN0YXRlIH0gZnJvbSAnLi9zdGF0ZSdcbmltcG9ydCAqIGFzIGJvYXJkIGZyb20gJy4vYm9hcmQnXG5pbXBvcnQgeyB3cml0ZSBhcyBmZW5Xcml0ZSB9IGZyb20gJy4vZmVuJ1xuaW1wb3J0IHsgQ29uZmlnLCBjb25maWd1cmUgfSBmcm9tICcuL2NvbmZpZydcbmltcG9ydCB7IGFuaW0sIHJlbmRlciB9IGZyb20gJy4vYW5pbSdcbmltcG9ydCB7IGNhbmNlbCBhcyBkcmFnQ2FuY2VsLCBkcmFnTmV3UGllY2UgfSBmcm9tICcuL2RyYWcnXG5pbXBvcnQgeyBEcmF3U2hhcGUgfSBmcm9tICcuL2RyYXcnXG5pbXBvcnQgZXhwbG9zaW9uIGZyb20gJy4vZXhwbG9zaW9uJ1xuaW1wb3J0ICogYXMgY2cgZnJvbSAnLi90eXBlcydcblxuZXhwb3J0IGludGVyZmFjZSBBcGkge1xuXG4gIC8vIHJlY29uZmlndXJlIHRoZSBpbnN0YW5jZS4gQWNjZXB0cyBhbGwgY29uZmlnIG9wdGlvbnMsIGV4Y2VwdCBmb3Igdmlld09ubHkgJiBkcmF3YWJsZS52aXNpYmxlLlxuICAvLyBib2FyZCB3aWxsIGJlIGFuaW1hdGVkIGFjY29yZGluZ2x5LCBpZiBhbmltYXRpb25zIGFyZSBlbmFibGVkLlxuICBzZXQoY29uZmlnOiBDb25maWcpOiB2b2lkO1xuXG4gIC8vIHJlYWQgY2hlc3Nncm91bmQgc3RhdGU7IHdyaXRlIGF0IHlvdXIgb3duIHJpc2tzLlxuICBzdGF0ZTogU3RhdGU7XG5cbiAgLy8gZ2V0IHRoZSBwb3NpdGlvbiBhcyBhIEZFTiBzdHJpbmcgKG9ubHkgY29udGFpbnMgcGllY2VzLCBubyBmbGFncylcbiAgLy8gZS5nLiBybmJxa2Juci9wcHBwcHBwcC84LzgvOC84L1BQUFBQUFBQL1JOQlFLQk5SXG4gIGdldEZlbigpOiBjZy5GRU47XG5cbiAgLy8gY2hhbmdlIHRoZSB2aWV3IGFuZ2xlXG4gIHRvZ2dsZU9yaWVudGF0aW9uKCk6IHZvaWQ7XG5cbiAgLy8gcGVyZm9ybSBhIG1vdmUgcHJvZ3JhbW1hdGljYWxseVxuICBtb3ZlKG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5KTogdm9pZDtcblxuICAvLyBhZGQgYW5kL29yIHJlbW92ZSBhcmJpdHJhcnkgcGllY2VzIG9uIHRoZSBib2FyZFxuICBzZXRQaWVjZXMocGllY2VzOiBjZy5QaWVjZXNEaWZmKTogdm9pZDtcblxuICAvLyBjbGljayBhIHNxdWFyZSBwcm9ncmFtbWF0aWNhbGx5XG4gIHNlbGVjdFNxdWFyZShrZXk6IGNnLktleSB8IG51bGwsIGZvcmNlPzogYm9vbGVhbik6IHZvaWQ7XG5cbiAgLy8gcHV0IGEgbmV3IHBpZWNlIG9uIHRoZSBib2FyZFxuICBuZXdQaWVjZShwaWVjZTogY2cuUGllY2UsIGtleTogY2cuS2V5KTogdm9pZDtcblxuICAvLyBwbGF5IHRoZSBjdXJyZW50IHByZW1vdmUsIGlmIGFueTsgcmV0dXJucyB0cnVlIGlmIHByZW1vdmUgd2FzIHBsYXllZFxuICBwbGF5UHJlbW92ZSgpOiBib29sZWFuO1xuXG4gIC8vIGNhbmNlbCB0aGUgY3VycmVudCBwcmVtb3ZlLCBpZiBhbnlcbiAgY2FuY2VsUHJlbW92ZSgpOiB2b2lkO1xuXG4gIC8vIHBsYXkgdGhlIGN1cnJlbnQgcHJlZHJvcCwgaWYgYW55OyByZXR1cm5zIHRydWUgaWYgcHJlbW92ZSB3YXMgcGxheWVkXG4gIHBsYXlQcmVkcm9wKHZhbGlkYXRlOiAoZHJvcDogY2cuRHJvcCkgPT4gYm9vbGVhbik6IGJvb2xlYW47XG5cbiAgLy8gY2FuY2VsIHRoZSBjdXJyZW50IHByZWRyb3AsIGlmIGFueVxuICBjYW5jZWxQcmVkcm9wKCk6IHZvaWQ7XG5cbiAgLy8gY2FuY2VsIHRoZSBjdXJyZW50IG1vdmUgYmVpbmcgbWFkZVxuICBjYW5jZWxNb3ZlKCk6IHZvaWQ7XG5cbiAgLy8gY2FuY2VsIGN1cnJlbnQgbW92ZSBhbmQgcHJldmVudCBmdXJ0aGVyIG9uZXNcbiAgc3RvcCgpOiB2b2lkO1xuXG4gIC8vIG1ha2Ugc3F1YXJlcyBleHBsb2RlIChhdG9taWMgY2hlc3MpXG4gIGV4cGxvZGUoa2V5czogY2cuS2V5W10pOiB2b2lkO1xuXG4gIC8vIHByb2dyYW1tYXRpY2FsbHkgZHJhdyB1c2VyIHNoYXBlc1xuICBzZXRTaGFwZXMoc2hhcGVzOiBEcmF3U2hhcGVbXSk6IHZvaWQ7XG5cbiAgLy8gcHJvZ3JhbW1hdGljYWxseSBkcmF3IGF1dG8gc2hhcGVzXG4gIHNldEF1dG9TaGFwZXMoc2hhcGVzOiBEcmF3U2hhcGVbXSk6IHZvaWQ7XG5cbiAgLy8gc3F1YXJlIG5hbWUgYXQgdGhpcyBET00gcG9zaXRpb24gKGxpa2UgXCJlNFwiKVxuICBnZXRLZXlBdERvbVBvcyhwb3M6IGNnLk51bWJlclBhaXIpOiBjZy5LZXkgfCB1bmRlZmluZWQ7XG5cbiAgLy8gb25seSB1c2VmdWwgd2hlbiBDU1MgY2hhbmdlcyB0aGUgYm9hcmQgd2lkdGgvaGVpZ2h0IHJhdGlvIChmb3IgM0QpXG4gIHJlZHJhd0FsbDogY2cuUmVkcmF3O1xuXG4gIC8vIGZvciBjcmF6eWhvdXNlIGFuZCBib2FyZCBlZGl0b3JzXG4gIGRyYWdOZXdQaWVjZShwaWVjZTogY2cuUGllY2UsIGV2ZW50OiBjZy5Nb3VjaEV2ZW50LCBmb3JjZT86IGJvb2xlYW4pOiB2b2lkO1xuXG4gIC8vIHVuYmluZHMgYWxsIGV2ZW50c1xuICAvLyAoaW1wb3J0YW50IGZvciBkb2N1bWVudC13aWRlIGV2ZW50cyBsaWtlIHNjcm9sbCBhbmQgbW91c2Vtb3ZlKVxuICBkZXN0cm95OiBjZy5VbmJpbmRcbn1cblxuLy8gc2VlIEFQSSB0eXBlcyBhbmQgZG9jdW1lbnRhdGlvbnMgaW4gZHRzL2FwaS5kLnRzXG5leHBvcnQgZnVuY3Rpb24gc3RhcnQoc3RhdGU6IFN0YXRlLCByZWRyYXdBbGw6IGNnLlJlZHJhdyk6IEFwaSB7XG5cbiAgZnVuY3Rpb24gdG9nZ2xlT3JpZW50YXRpb24oKSB7XG4gICAgYm9hcmQudG9nZ2xlT3JpZW50YXRpb24oc3RhdGUpO1xuICAgIHJlZHJhd0FsbCgpO1xuICB9O1xuXG4gIHJldHVybiB7XG5cbiAgICBzZXQoY29uZmlnKSB7XG4gICAgICBpZiAoY29uZmlnLm9yaWVudGF0aW9uICYmIGNvbmZpZy5vcmllbnRhdGlvbiAhPT0gc3RhdGUub3JpZW50YXRpb24pIHRvZ2dsZU9yaWVudGF0aW9uKCk7XG4gICAgICAoY29uZmlnLmZlbiA/IGFuaW0gOiByZW5kZXIpKHN0YXRlID0+IGNvbmZpZ3VyZShzdGF0ZSwgY29uZmlnKSwgc3RhdGUpO1xuICAgIH0sXG5cbiAgICBzdGF0ZSxcblxuICAgIGdldEZlbjogKCkgPT4gZmVuV3JpdGUoc3RhdGUucGllY2VzLCBzdGF0ZS5nZW9tZXRyeSksXG5cbiAgICB0b2dnbGVPcmllbnRhdGlvbixcblxuICAgIHNldFBpZWNlcyhwaWVjZXMpIHtcbiAgICAgIGFuaW0oc3RhdGUgPT4gYm9hcmQuc2V0UGllY2VzKHN0YXRlLCBwaWVjZXMpLCBzdGF0ZSk7XG4gICAgfSxcblxuICAgIHNlbGVjdFNxdWFyZShrZXksIGZvcmNlKSB7XG4gICAgICBpZiAoa2V5KSBhbmltKHN0YXRlID0+IGJvYXJkLnNlbGVjdFNxdWFyZShzdGF0ZSwga2V5LCBmb3JjZSksIHN0YXRlKTtcbiAgICAgIGVsc2UgaWYgKHN0YXRlLnNlbGVjdGVkKSB7XG4gICAgICAgIGJvYXJkLnVuc2VsZWN0KHN0YXRlKTtcbiAgICAgICAgc3RhdGUuZG9tLnJlZHJhdygpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBtb3ZlKG9yaWcsIGRlc3QpIHtcbiAgICAgIGFuaW0oc3RhdGUgPT4gYm9hcmQuYmFzZU1vdmUoc3RhdGUsIG9yaWcsIGRlc3QpLCBzdGF0ZSk7XG4gICAgfSxcblxuICAgIG5ld1BpZWNlKHBpZWNlLCBrZXkpIHtcbiAgICAgIGFuaW0oc3RhdGUgPT4gYm9hcmQuYmFzZU5ld1BpZWNlKHN0YXRlLCBwaWVjZSwga2V5KSwgc3RhdGUpO1xuICAgIH0sXG5cbiAgICBwbGF5UHJlbW92ZSgpIHtcbiAgICAgIGlmIChzdGF0ZS5wcmVtb3ZhYmxlLmN1cnJlbnQpIHtcbiAgICAgICAgaWYgKGFuaW0oYm9hcmQucGxheVByZW1vdmUsIHN0YXRlKSkgcmV0dXJuIHRydWU7XG4gICAgICAgIC8vIGlmIHRoZSBwcmVtb3ZlIGNvdWxkbid0IGJlIHBsYXllZCwgcmVkcmF3IHRvIGNsZWFyIGl0IHVwXG4gICAgICAgIHN0YXRlLmRvbS5yZWRyYXcoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuXG4gICAgcGxheVByZWRyb3AodmFsaWRhdGUpIHtcbiAgICAgIGlmIChzdGF0ZS5wcmVkcm9wcGFibGUuY3VycmVudCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBib2FyZC5wbGF5UHJlZHJvcChzdGF0ZSwgdmFsaWRhdGUpO1xuICAgICAgICBzdGF0ZS5kb20ucmVkcmF3KCk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcblxuICAgIGNhbmNlbFByZW1vdmUoKSB7XG4gICAgICByZW5kZXIoYm9hcmQudW5zZXRQcmVtb3ZlLCBzdGF0ZSk7XG4gICAgfSxcblxuICAgIGNhbmNlbFByZWRyb3AoKSB7XG4gICAgICByZW5kZXIoYm9hcmQudW5zZXRQcmVkcm9wLCBzdGF0ZSk7XG4gICAgfSxcblxuICAgIGNhbmNlbE1vdmUoKSB7XG4gICAgICByZW5kZXIoc3RhdGUgPT4geyBib2FyZC5jYW5jZWxNb3ZlKHN0YXRlKTsgZHJhZ0NhbmNlbChzdGF0ZSk7IH0sIHN0YXRlKTtcbiAgICB9LFxuXG4gICAgc3RvcCgpIHtcbiAgICAgIHJlbmRlcihzdGF0ZSA9PiB7IGJvYXJkLnN0b3Aoc3RhdGUpOyBkcmFnQ2FuY2VsKHN0YXRlKTsgfSwgc3RhdGUpO1xuICAgIH0sXG5cbiAgICBleHBsb2RlKGtleXM6IGNnLktleVtdKSB7XG4gICAgICBleHBsb3Npb24oc3RhdGUsIGtleXMpO1xuICAgIH0sXG5cbiAgICBzZXRBdXRvU2hhcGVzKHNoYXBlczogRHJhd1NoYXBlW10pIHtcbiAgICAgIHJlbmRlcihzdGF0ZSA9PiBzdGF0ZS5kcmF3YWJsZS5hdXRvU2hhcGVzID0gc2hhcGVzLCBzdGF0ZSk7XG4gICAgfSxcblxuICAgIHNldFNoYXBlcyhzaGFwZXM6IERyYXdTaGFwZVtdKSB7XG4gICAgICByZW5kZXIoc3RhdGUgPT4gc3RhdGUuZHJhd2FibGUuc2hhcGVzID0gc2hhcGVzLCBzdGF0ZSk7XG4gICAgfSxcblxuICAgIGdldEtleUF0RG9tUG9zKHBvcykge1xuICAgICAgcmV0dXJuIGJvYXJkLmdldEtleUF0RG9tUG9zKHBvcywgYm9hcmQud2hpdGVQb3Yoc3RhdGUpLCBzdGF0ZS5kb20uYm91bmRzKCksIHN0YXRlLmdlb21ldHJ5KTtcbiAgICB9LFxuXG4gICAgcmVkcmF3QWxsLFxuXG4gICAgZHJhZ05ld1BpZWNlKHBpZWNlLCBldmVudCwgZm9yY2UpIHtcbiAgICAgIGRyYWdOZXdQaWVjZShzdGF0ZSwgcGllY2UsIGV2ZW50LCBmb3JjZSlcbiAgICB9LFxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgIGJvYXJkLnN0b3Aoc3RhdGUpO1xuICAgICAgc3RhdGUuZG9tLnVuYmluZCAmJiBzdGF0ZS5kb20udW5iaW5kKCk7XG4gICAgICBzdGF0ZS5kb20uZGVzdHJveWVkID0gdHJ1ZTtcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBTdGF0ZSB9IGZyb20gJy4vc3RhdGUnXG5pbXBvcnQgeyBwb3Mya2V5LCBrZXkycG9zLCBvcHBvc2l0ZSwgY29udGFpbnNYIH0gZnJvbSAnLi91dGlsJ1xuaW1wb3J0IHByZW1vdmUgZnJvbSAnLi9wcmVtb3ZlJ1xuaW1wb3J0ICogYXMgY2cgZnJvbSAnLi90eXBlcydcblxuZXhwb3J0IHR5cGUgQ2FsbGJhY2sgPSAoLi4uYXJnczogYW55W10pID0+IHZvaWQ7XG5cbmV4cG9ydCBmdW5jdGlvbiBjYWxsVXNlckZ1bmN0aW9uKGY6IENhbGxiYWNrIHwgdW5kZWZpbmVkLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuICBpZiAoZikgc2V0VGltZW91dCgoKSA9PiBmKC4uLmFyZ3MpLCAxKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZU9yaWVudGF0aW9uKHN0YXRlOiBTdGF0ZSk6IHZvaWQge1xuICBzdGF0ZS5vcmllbnRhdGlvbiA9IG9wcG9zaXRlKHN0YXRlLm9yaWVudGF0aW9uKTtcbiAgc3RhdGUuYW5pbWF0aW9uLmN1cnJlbnQgPVxuICBzdGF0ZS5kcmFnZ2FibGUuY3VycmVudCA9XG4gIHN0YXRlLnNlbGVjdGVkID0gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzZXQoc3RhdGU6IFN0YXRlKTogdm9pZCB7XG4gIHN0YXRlLmxhc3RNb3ZlID0gdW5kZWZpbmVkO1xuICB1bnNlbGVjdChzdGF0ZSk7XG4gIHVuc2V0UHJlbW92ZShzdGF0ZSk7XG4gIHVuc2V0UHJlZHJvcChzdGF0ZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRQaWVjZXMoc3RhdGU6IFN0YXRlLCBwaWVjZXM6IGNnLlBpZWNlc0RpZmYpOiB2b2lkIHtcbiAgZm9yIChsZXQga2V5IGluIHBpZWNlcykge1xuICAgIGNvbnN0IHBpZWNlID0gcGllY2VzW2tleV07XG4gICAgaWYgKHBpZWNlKSBzdGF0ZS5waWVjZXNba2V5XSA9IHBpZWNlO1xuICAgIGVsc2UgZGVsZXRlIHN0YXRlLnBpZWNlc1trZXldO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRDaGVjayhzdGF0ZTogU3RhdGUsIGNvbG9yOiBjZy5Db2xvciB8IGJvb2xlYW4pOiB2b2lkIHtcbiAgc3RhdGUuY2hlY2sgPSB1bmRlZmluZWQ7XG4gIGlmIChjb2xvciA9PT0gdHJ1ZSkgY29sb3IgPSBzdGF0ZS50dXJuQ29sb3I7XG4gIGlmIChjb2xvcikgZm9yIChsZXQgayBpbiBzdGF0ZS5waWVjZXMpIHtcbiAgICBpZiAoc3RhdGUucGllY2VzW2tdIS5yb2xlID09PSAna2luZycgJiYgc3RhdGUucGllY2VzW2tdIS5jb2xvciA9PT0gY29sb3IpIHtcbiAgICAgIHN0YXRlLmNoZWNrID0gayBhcyBjZy5LZXk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHNldFByZW1vdmUoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSwgbWV0YTogY2cuU2V0UHJlbW92ZU1ldGFkYXRhKTogdm9pZCB7XG4gIHVuc2V0UHJlZHJvcChzdGF0ZSk7XG4gIHN0YXRlLnByZW1vdmFibGUuY3VycmVudCA9IFtvcmlnLCBkZXN0XTtcbiAgY2FsbFVzZXJGdW5jdGlvbihzdGF0ZS5wcmVtb3ZhYmxlLmV2ZW50cy5zZXQsIG9yaWcsIGRlc3QsIG1ldGEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdW5zZXRQcmVtb3ZlKHN0YXRlOiBTdGF0ZSk6IHZvaWQge1xuICBpZiAoc3RhdGUucHJlbW92YWJsZS5jdXJyZW50KSB7XG4gICAgc3RhdGUucHJlbW92YWJsZS5jdXJyZW50ID0gdW5kZWZpbmVkO1xuICAgIGNhbGxVc2VyRnVuY3Rpb24oc3RhdGUucHJlbW92YWJsZS5ldmVudHMudW5zZXQpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNldFByZWRyb3Aoc3RhdGU6IFN0YXRlLCByb2xlOiBjZy5Sb2xlLCBrZXk6IGNnLktleSk6IHZvaWQge1xuICB1bnNldFByZW1vdmUoc3RhdGUpO1xuICBzdGF0ZS5wcmVkcm9wcGFibGUuY3VycmVudCA9IHsgcm9sZSwga2V5IH07XG4gIGNhbGxVc2VyRnVuY3Rpb24oc3RhdGUucHJlZHJvcHBhYmxlLmV2ZW50cy5zZXQsIHJvbGUsIGtleSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1bnNldFByZWRyb3Aoc3RhdGU6IFN0YXRlKTogdm9pZCB7XG4gIGNvbnN0IHBkID0gc3RhdGUucHJlZHJvcHBhYmxlO1xuICBpZiAocGQuY3VycmVudCkge1xuICAgIHBkLmN1cnJlbnQgPSB1bmRlZmluZWQ7XG4gICAgY2FsbFVzZXJGdW5jdGlvbihwZC5ldmVudHMudW5zZXQpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHRyeUF1dG9DYXN0bGUoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSk6IGJvb2xlYW4ge1xuICBpZiAoIXN0YXRlLmF1dG9DYXN0bGUpIHJldHVybiBmYWxzZTtcbiAgY29uc3Qga2luZyA9IHN0YXRlLnBpZWNlc1tvcmlnXTtcbiAgaWYgKCFraW5nIHx8IGtpbmcucm9sZSAhPT0gJ2tpbmcnKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGZpcnN0UmFua0lzMCA9IHN0YXRlLmRpbWVuc2lvbnMuaGVpZ2h0ID09PSAxMDtcbiAgY29uc3Qgb3JpZ1BvcyA9IGtleTJwb3Mob3JpZywgZmlyc3RSYW5rSXMwKTtcbiAgaWYgKG9yaWdQb3NbMF0gIT09IDUpIHJldHVybiBmYWxzZTtcbiAgaWYgKG9yaWdQb3NbMV0gIT09IDEgJiYgb3JpZ1Bvc1sxXSAhPT0gOCkgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBkZXN0UG9zID0ga2V5MnBvcyhkZXN0LCBmaXJzdFJhbmtJczApO1xuICBsZXQgb2xkUm9va1BvcywgbmV3Um9va1BvcywgbmV3S2luZ1BvcztcbiAgaWYgKGRlc3RQb3NbMF0gPT09IDcgfHwgZGVzdFBvc1swXSA9PT0gOCkge1xuICAgIG9sZFJvb2tQb3MgPSBwb3Mya2V5KFs4LCBvcmlnUG9zWzFdXSwgc3RhdGUuZ2VvbWV0cnkpO1xuICAgIG5ld1Jvb2tQb3MgPSBwb3Mya2V5KFs2LCBvcmlnUG9zWzFdXSwgc3RhdGUuZ2VvbWV0cnkpO1xuICAgIG5ld0tpbmdQb3MgPSBwb3Mya2V5KFs3LCBvcmlnUG9zWzFdXSwgc3RhdGUuZ2VvbWV0cnkpO1xuICB9IGVsc2UgaWYgKGRlc3RQb3NbMF0gPT09IDMgfHwgZGVzdFBvc1swXSA9PT0gMSkge1xuICAgIG9sZFJvb2tQb3MgPSBwb3Mya2V5KFsxLCBvcmlnUG9zWzFdXSwgc3RhdGUuZ2VvbWV0cnkpO1xuICAgIG5ld1Jvb2tQb3MgPSBwb3Mya2V5KFs0LCBvcmlnUG9zWzFdXSwgc3RhdGUuZ2VvbWV0cnkpO1xuICAgIG5ld0tpbmdQb3MgPSBwb3Mya2V5KFszLCBvcmlnUG9zWzFdXSwgc3RhdGUuZ2VvbWV0cnkpO1xuICB9IGVsc2UgcmV0dXJuIGZhbHNlO1xuXG4gIGNvbnN0IHJvb2sgPSBzdGF0ZS5waWVjZXNbb2xkUm9va1Bvc107XG4gIGlmICghcm9vayB8fCByb29rLnJvbGUgIT09ICdyb29rJykgcmV0dXJuIGZhbHNlO1xuXG4gIGRlbGV0ZSBzdGF0ZS5waWVjZXNbb3JpZ107XG4gIGRlbGV0ZSBzdGF0ZS5waWVjZXNbb2xkUm9va1Bvc107XG5cbiAgc3RhdGUucGllY2VzW25ld0tpbmdQb3NdID0ga2luZ1xuICBzdGF0ZS5waWVjZXNbbmV3Um9va1Bvc10gPSByb29rO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJhc2VNb3ZlKHN0YXRlOiBTdGF0ZSwgb3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXkpOiBjZy5QaWVjZSB8IGJvb2xlYW4ge1xuICBjb25zdCBvcmlnUGllY2UgPSBzdGF0ZS5waWVjZXNbb3JpZ10sIGRlc3RQaWVjZSA9IHN0YXRlLnBpZWNlc1tkZXN0XTtcbiAgaWYgKG9yaWcgPT09IGRlc3QgfHwgIW9yaWdQaWVjZSkgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBjYXB0dXJlZCA9IChkZXN0UGllY2UgJiYgZGVzdFBpZWNlLmNvbG9yICE9PSBvcmlnUGllY2UuY29sb3IpID8gZGVzdFBpZWNlIDogdW5kZWZpbmVkO1xuICBpZiAoZGVzdCA9PSBzdGF0ZS5zZWxlY3RlZCkgdW5zZWxlY3Qoc3RhdGUpO1xuICBjYWxsVXNlckZ1bmN0aW9uKHN0YXRlLmV2ZW50cy5tb3ZlLCBvcmlnLCBkZXN0LCBjYXB0dXJlZCk7XG4gIGlmICghdHJ5QXV0b0Nhc3RsZShzdGF0ZSwgb3JpZywgZGVzdCkpIHtcbiAgICBzdGF0ZS5waWVjZXNbZGVzdF0gPSBvcmlnUGllY2U7XG4gICAgZGVsZXRlIHN0YXRlLnBpZWNlc1tvcmlnXTtcbiAgfVxuICBzdGF0ZS5sYXN0TW92ZSA9IFtvcmlnLCBkZXN0XTtcbiAgc3RhdGUuY2hlY2sgPSB1bmRlZmluZWQ7XG4gIGNhbGxVc2VyRnVuY3Rpb24oc3RhdGUuZXZlbnRzLmNoYW5nZSk7XG4gIHJldHVybiBjYXB0dXJlZCB8fCB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYmFzZU5ld1BpZWNlKHN0YXRlOiBTdGF0ZSwgcGllY2U6IGNnLlBpZWNlLCBrZXk6IGNnLktleSwgZm9yY2U/OiBib29sZWFuKTogYm9vbGVhbiB7XG4gIGlmIChzdGF0ZS5waWVjZXNba2V5XSkge1xuICAgIGlmIChmb3JjZSkgZGVsZXRlIHN0YXRlLnBpZWNlc1trZXldO1xuICAgIGVsc2UgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNhbGxVc2VyRnVuY3Rpb24oc3RhdGUuZXZlbnRzLmRyb3BOZXdQaWVjZSwgcGllY2UsIGtleSk7XG4gIHN0YXRlLnBpZWNlc1trZXldID0gcGllY2U7XG4gIHN0YXRlLmxhc3RNb3ZlID0gW2tleV07XG4gIHN0YXRlLmNoZWNrID0gdW5kZWZpbmVkO1xuICBjYWxsVXNlckZ1bmN0aW9uKHN0YXRlLmV2ZW50cy5jaGFuZ2UpO1xuICBzdGF0ZS5tb3ZhYmxlLmRlc3RzID0gdW5kZWZpbmVkO1xuICBzdGF0ZS50dXJuQ29sb3IgPSBvcHBvc2l0ZShzdGF0ZS50dXJuQ29sb3IpO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gYmFzZVVzZXJNb3ZlKHN0YXRlOiBTdGF0ZSwgb3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXkpOiBjZy5QaWVjZSB8IGJvb2xlYW4ge1xuICBjb25zdCByZXN1bHQgPSBiYXNlTW92ZShzdGF0ZSwgb3JpZywgZGVzdCk7XG4gIGlmIChyZXN1bHQpIHtcbiAgICBzdGF0ZS5tb3ZhYmxlLmRlc3RzID0gdW5kZWZpbmVkO1xuICAgIHN0YXRlLnR1cm5Db2xvciA9IG9wcG9zaXRlKHN0YXRlLnR1cm5Db2xvcik7XG4gICAgc3RhdGUuYW5pbWF0aW9uLmN1cnJlbnQgPSB1bmRlZmluZWQ7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZXJNb3ZlKHN0YXRlOiBTdGF0ZSwgb3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXkpOiBib29sZWFuIHtcbiAgaWYgKGNhbk1vdmUoc3RhdGUsIG9yaWcsIGRlc3QpKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYmFzZVVzZXJNb3ZlKHN0YXRlLCBvcmlnLCBkZXN0KTtcbiAgICBpZiAocmVzdWx0KSB7XG4gICAgICBjb25zdCBob2xkVGltZSA9IHN0YXRlLmhvbGQuc3RvcCgpO1xuICAgICAgdW5zZWxlY3Qoc3RhdGUpO1xuICAgICAgY29uc3QgbWV0YWRhdGE6IGNnLk1vdmVNZXRhZGF0YSA9IHtcbiAgICAgICAgcHJlbW92ZTogZmFsc2UsXG4gICAgICAgIGN0cmxLZXk6IHN0YXRlLnN0YXRzLmN0cmxLZXksXG4gICAgICAgIGhvbGRUaW1lXG4gICAgICB9O1xuICAgICAgaWYgKHJlc3VsdCAhPT0gdHJ1ZSkgbWV0YWRhdGEuY2FwdHVyZWQgPSByZXN1bHQ7XG4gICAgICBjYWxsVXNlckZ1bmN0aW9uKHN0YXRlLm1vdmFibGUuZXZlbnRzLmFmdGVyLCBvcmlnLCBkZXN0LCBtZXRhZGF0YSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoY2FuUHJlbW92ZShzdGF0ZSwgb3JpZywgZGVzdCkpIHtcbiAgICBzZXRQcmVtb3ZlKHN0YXRlLCBvcmlnLCBkZXN0LCB7XG4gICAgICBjdHJsS2V5OiBzdGF0ZS5zdGF0cy5jdHJsS2V5XG4gICAgfSk7XG4gICAgdW5zZWxlY3Qoc3RhdGUpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHVuc2VsZWN0KHN0YXRlKTtcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZHJvcE5ld1BpZWNlKHN0YXRlOiBTdGF0ZSwgb3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXksIGZvcmNlPzogYm9vbGVhbik6IHZvaWQge1xuICBpZiAoY2FuRHJvcChzdGF0ZSwgb3JpZywgZGVzdCkgfHwgZm9yY2UpIHtcbiAgICBjb25zdCBwaWVjZSA9IHN0YXRlLnBpZWNlc1tvcmlnXSE7XG4gICAgZGVsZXRlIHN0YXRlLnBpZWNlc1tvcmlnXTtcbiAgICBiYXNlTmV3UGllY2Uoc3RhdGUsIHBpZWNlLCBkZXN0LCBmb3JjZSk7XG4gICAgY2FsbFVzZXJGdW5jdGlvbihzdGF0ZS5tb3ZhYmxlLmV2ZW50cy5hZnRlck5ld1BpZWNlLCBwaWVjZS5yb2xlLCBkZXN0LCB7XG4gICAgICBwcmVkcm9wOiBmYWxzZVxuICAgIH0pO1xuICB9IGVsc2UgaWYgKGNhblByZWRyb3Aoc3RhdGUsIG9yaWcsIGRlc3QpKSB7XG4gICAgc2V0UHJlZHJvcChzdGF0ZSwgc3RhdGUucGllY2VzW29yaWddIS5yb2xlLCBkZXN0KTtcbiAgfSBlbHNlIHtcbiAgICB1bnNldFByZW1vdmUoc3RhdGUpO1xuICAgIHVuc2V0UHJlZHJvcChzdGF0ZSk7XG4gIH1cbiAgZGVsZXRlIHN0YXRlLnBpZWNlc1tvcmlnXTtcbiAgdW5zZWxlY3Qoc3RhdGUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VsZWN0U3F1YXJlKHN0YXRlOiBTdGF0ZSwga2V5OiBjZy5LZXksIGZvcmNlPzogYm9vbGVhbik6IHZvaWQge1xuICBjYWxsVXNlckZ1bmN0aW9uKHN0YXRlLmV2ZW50cy5zZWxlY3QsIGtleSk7XG4gIGlmIChzdGF0ZS5zZWxlY3RlZCkge1xuICAgIGlmIChzdGF0ZS5zZWxlY3RlZCA9PT0ga2V5ICYmICFzdGF0ZS5kcmFnZ2FibGUuZW5hYmxlZCkge1xuICAgICAgdW5zZWxlY3Qoc3RhdGUpO1xuICAgICAgc3RhdGUuaG9sZC5jYW5jZWwoKTtcbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKChzdGF0ZS5zZWxlY3RhYmxlLmVuYWJsZWQgfHwgZm9yY2UpICYmIHN0YXRlLnNlbGVjdGVkICE9PSBrZXkpIHtcbiAgICAgIGlmICh1c2VyTW92ZShzdGF0ZSwgc3RhdGUuc2VsZWN0ZWQsIGtleSkpIHtcbiAgICAgICAgc3RhdGUuc3RhdHMuZHJhZ2dlZCA9IGZhbHNlO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChpc01vdmFibGUoc3RhdGUsIGtleSkgfHwgaXNQcmVtb3ZhYmxlKHN0YXRlLCBrZXkpKSB7XG4gICAgc2V0U2VsZWN0ZWQoc3RhdGUsIGtleSk7XG4gICAgc3RhdGUuaG9sZC5zdGFydCgpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRTZWxlY3RlZChzdGF0ZTogU3RhdGUsIGtleTogY2cuS2V5KTogdm9pZCB7XG4gIHN0YXRlLnNlbGVjdGVkID0ga2V5O1xuICBpZiAoaXNQcmVtb3ZhYmxlKHN0YXRlLCBrZXkpKSB7XG4gICAgc3RhdGUucHJlbW92YWJsZS5kZXN0cyA9IHByZW1vdmUoc3RhdGUucGllY2VzLCBrZXksIHN0YXRlLnByZW1vdmFibGUuY2FzdGxlLCBzdGF0ZS5nZW9tZXRyeSk7XG4gIH1cbiAgZWxzZSBzdGF0ZS5wcmVtb3ZhYmxlLmRlc3RzID0gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdW5zZWxlY3Qoc3RhdGU6IFN0YXRlKTogdm9pZCB7XG4gIHN0YXRlLnNlbGVjdGVkID0gdW5kZWZpbmVkO1xuICBzdGF0ZS5wcmVtb3ZhYmxlLmRlc3RzID0gdW5kZWZpbmVkO1xuICBzdGF0ZS5ob2xkLmNhbmNlbCgpO1xufVxuXG5mdW5jdGlvbiBpc01vdmFibGUoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXkpOiBib29sZWFuIHtcbiAgY29uc3QgcGllY2UgPSBzdGF0ZS5waWVjZXNbb3JpZ107XG4gIHJldHVybiAhIXBpZWNlICYmIChcbiAgICBzdGF0ZS5tb3ZhYmxlLmNvbG9yID09PSAnYm90aCcgfHwgKFxuICAgICAgc3RhdGUubW92YWJsZS5jb2xvciA9PT0gcGllY2UuY29sb3IgJiZcbiAgICAgICAgc3RhdGUudHVybkNvbG9yID09PSBwaWVjZS5jb2xvclxuICAgICkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2FuTW92ZShzdGF0ZTogU3RhdGUsIG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5KTogYm9vbGVhbiB7XG4gIHJldHVybiBvcmlnICE9PSBkZXN0ICYmIGlzTW92YWJsZShzdGF0ZSwgb3JpZykgJiYgKFxuICAgIHN0YXRlLm1vdmFibGUuZnJlZSB8fCAoISFzdGF0ZS5tb3ZhYmxlLmRlc3RzICYmIGNvbnRhaW5zWChzdGF0ZS5tb3ZhYmxlLmRlc3RzW29yaWddLCBkZXN0KSlcbiAgKTtcbn1cblxuZnVuY3Rpb24gY2FuRHJvcChzdGF0ZTogU3RhdGUsIG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5KTogYm9vbGVhbiB7XG4gIGNvbnN0IHBpZWNlID0gc3RhdGUucGllY2VzW29yaWddO1xuICByZXR1cm4gISFwaWVjZSAmJiBkZXN0ICYmIChvcmlnID09PSBkZXN0IHx8ICFzdGF0ZS5waWVjZXNbZGVzdF0pICYmIChcbiAgICBzdGF0ZS5tb3ZhYmxlLmNvbG9yID09PSAnYm90aCcgfHwgKFxuICAgICAgc3RhdGUubW92YWJsZS5jb2xvciA9PT0gcGllY2UuY29sb3IgJiZcbiAgICAgICAgc3RhdGUudHVybkNvbG9yID09PSBwaWVjZS5jb2xvclxuICAgICkpO1xufVxuXG5cbmZ1bmN0aW9uIGlzUHJlbW92YWJsZShzdGF0ZTogU3RhdGUsIG9yaWc6IGNnLktleSk6IGJvb2xlYW4ge1xuICBjb25zdCBwaWVjZSA9IHN0YXRlLnBpZWNlc1tvcmlnXTtcbiAgcmV0dXJuICEhcGllY2UgJiYgc3RhdGUucHJlbW92YWJsZS5lbmFibGVkICYmXG4gIHN0YXRlLm1vdmFibGUuY29sb3IgPT09IHBpZWNlLmNvbG9yICYmXG4gICAgc3RhdGUudHVybkNvbG9yICE9PSBwaWVjZS5jb2xvcjtcbn1cblxuZnVuY3Rpb24gY2FuUHJlbW92ZShzdGF0ZTogU3RhdGUsIG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5KTogYm9vbGVhbiB7XG4gIHJldHVybiBvcmlnICE9PSBkZXN0ICYmXG4gIGlzUHJlbW92YWJsZShzdGF0ZSwgb3JpZykgJiZcbiAgY29udGFpbnNYKHByZW1vdmUoc3RhdGUucGllY2VzLCBvcmlnLCBzdGF0ZS5wcmVtb3ZhYmxlLmNhc3RsZSwgc3RhdGUuZ2VvbWV0cnkpLCBkZXN0KTtcbn1cblxuZnVuY3Rpb24gY2FuUHJlZHJvcChzdGF0ZTogU3RhdGUsIG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5KTogYm9vbGVhbiB7XG4gIGNvbnN0IHBpZWNlID0gc3RhdGUucGllY2VzW29yaWddO1xuICBjb25zdCBkZXN0UGllY2UgPSBzdGF0ZS5waWVjZXNbZGVzdF07XG4gIHJldHVybiAhIXBpZWNlICYmIGRlc3QgJiZcbiAgKCFkZXN0UGllY2UgfHwgZGVzdFBpZWNlLmNvbG9yICE9PSBzdGF0ZS5tb3ZhYmxlLmNvbG9yKSAmJlxuICBzdGF0ZS5wcmVkcm9wcGFibGUuZW5hYmxlZCAmJlxuICAocGllY2Uucm9sZSAhPT0gJ3Bhd24nIHx8IChkZXN0WzFdICE9PSAnMScgJiYgZGVzdFsxXSAhPT0gJzgnKSkgJiZcbiAgc3RhdGUubW92YWJsZS5jb2xvciA9PT0gcGllY2UuY29sb3IgJiZcbiAgICBzdGF0ZS50dXJuQ29sb3IgIT09IHBpZWNlLmNvbG9yO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNEcmFnZ2FibGUoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXkpOiBib29sZWFuIHtcbiAgY29uc3QgcGllY2UgPSBzdGF0ZS5waWVjZXNbb3JpZ107XG4gIHJldHVybiAhIXBpZWNlICYmIHN0YXRlLmRyYWdnYWJsZS5lbmFibGVkICYmIChcbiAgICBzdGF0ZS5tb3ZhYmxlLmNvbG9yID09PSAnYm90aCcgfHwgKFxuICAgICAgc3RhdGUubW92YWJsZS5jb2xvciA9PT0gcGllY2UuY29sb3IgJiYgKFxuICAgICAgICBzdGF0ZS50dXJuQ29sb3IgPT09IHBpZWNlLmNvbG9yIHx8IHN0YXRlLnByZW1vdmFibGUuZW5hYmxlZFxuICAgICAgKVxuICAgIClcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBsYXlQcmVtb3ZlKHN0YXRlOiBTdGF0ZSk6IGJvb2xlYW4ge1xuICBjb25zdCBtb3ZlID0gc3RhdGUucHJlbW92YWJsZS5jdXJyZW50O1xuICBpZiAoIW1vdmUpIHJldHVybiBmYWxzZTtcbiAgY29uc3Qgb3JpZyA9IG1vdmVbMF0sIGRlc3QgPSBtb3ZlWzFdO1xuICBsZXQgc3VjY2VzcyA9IGZhbHNlO1xuICBpZiAoY2FuTW92ZShzdGF0ZSwgb3JpZywgZGVzdCkpIHtcbiAgICBjb25zdCByZXN1bHQgPSBiYXNlVXNlck1vdmUoc3RhdGUsIG9yaWcsIGRlc3QpO1xuICAgIGlmIChyZXN1bHQpIHtcbiAgICAgIGNvbnN0IG1ldGFkYXRhOiBjZy5Nb3ZlTWV0YWRhdGEgPSB7IHByZW1vdmU6IHRydWUgfTtcbiAgICAgIGlmIChyZXN1bHQgIT09IHRydWUpIG1ldGFkYXRhLmNhcHR1cmVkID0gcmVzdWx0O1xuICAgICAgY2FsbFVzZXJGdW5jdGlvbihzdGF0ZS5tb3ZhYmxlLmV2ZW50cy5hZnRlciwgb3JpZywgZGVzdCwgbWV0YWRhdGEpO1xuICAgICAgc3VjY2VzcyA9IHRydWU7XG4gICAgfVxuICB9XG4gIHVuc2V0UHJlbW92ZShzdGF0ZSk7XG4gIHJldHVybiBzdWNjZXNzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGxheVByZWRyb3Aoc3RhdGU6IFN0YXRlLCB2YWxpZGF0ZTogKGRyb3A6IGNnLkRyb3ApID0+IGJvb2xlYW4pOiBib29sZWFuIHtcbiAgbGV0IGRyb3AgPSBzdGF0ZS5wcmVkcm9wcGFibGUuY3VycmVudCxcbiAgc3VjY2VzcyA9IGZhbHNlO1xuICBpZiAoIWRyb3ApIHJldHVybiBmYWxzZTtcbiAgaWYgKHZhbGlkYXRlKGRyb3ApKSB7XG4gICAgY29uc3QgcGllY2UgPSB7XG4gICAgICByb2xlOiBkcm9wLnJvbGUsXG4gICAgICBjb2xvcjogc3RhdGUubW92YWJsZS5jb2xvclxuICAgIH0gYXMgY2cuUGllY2U7XG4gICAgaWYgKGJhc2VOZXdQaWVjZShzdGF0ZSwgcGllY2UsIGRyb3Aua2V5KSkge1xuICAgICAgY2FsbFVzZXJGdW5jdGlvbihzdGF0ZS5tb3ZhYmxlLmV2ZW50cy5hZnRlck5ld1BpZWNlLCBkcm9wLnJvbGUsIGRyb3Aua2V5LCB7XG4gICAgICAgIHByZWRyb3A6IHRydWVcbiAgICAgIH0pO1xuICAgICAgc3VjY2VzcyA9IHRydWU7XG4gICAgfVxuICB9XG4gIHVuc2V0UHJlZHJvcChzdGF0ZSk7XG4gIHJldHVybiBzdWNjZXNzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2FuY2VsTW92ZShzdGF0ZTogU3RhdGUpOiB2b2lkIHtcbiAgdW5zZXRQcmVtb3ZlKHN0YXRlKTtcbiAgdW5zZXRQcmVkcm9wKHN0YXRlKTtcbiAgdW5zZWxlY3Qoc3RhdGUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RvcChzdGF0ZTogU3RhdGUpOiB2b2lkIHtcbiAgc3RhdGUubW92YWJsZS5jb2xvciA9XG4gIHN0YXRlLm1vdmFibGUuZGVzdHMgPVxuICBzdGF0ZS5hbmltYXRpb24uY3VycmVudCA9IHVuZGVmaW5lZDtcbiAgY2FuY2VsTW92ZShzdGF0ZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRLZXlBdERvbVBvcyhwb3M6IGNnLk51bWJlclBhaXIsIGFzV2hpdGU6IGJvb2xlYW4sIGJvdW5kczogQ2xpZW50UmVjdCwgZ2VvbTogY2cuR2VvbWV0cnkpOiBjZy5LZXkgfCB1bmRlZmluZWQge1xuICBjb25zdCBiZCA9IGNnLmRpbWVuc2lvbnNbZ2VvbV07XG4gIGxldCBmaWxlID0gTWF0aC5jZWlsKGJkLndpZHRoICogKChwb3NbMF0gLSBib3VuZHMubGVmdCkgLyBib3VuZHMud2lkdGgpKTtcbiAgaWYgKCFhc1doaXRlKSBmaWxlID0gYmQud2lkdGggKyAxIC0gZmlsZTtcbiAgbGV0IHJhbmsgPSBNYXRoLmNlaWwoYmQuaGVpZ2h0IC0gKGJkLmhlaWdodCAqICgocG9zWzFdIC0gYm91bmRzLnRvcCkgLyBib3VuZHMuaGVpZ2h0KSkpO1xuICBpZiAoIWFzV2hpdGUpIHJhbmsgPSBiZC5oZWlnaHQgKyAxIC0gcmFuaztcbiAgcmV0dXJuIChmaWxlID4gMCAmJiBmaWxlIDwgYmQud2lkdGggKyAxICYmIHJhbmsgPiAwICYmIHJhbmsgPCBiZC5oZWlnaHQgKyAxKSA/IHBvczJrZXkoW2ZpbGUsIHJhbmtdLCBnZW9tKSA6IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdoaXRlUG92KHM6IFN0YXRlKTogYm9vbGVhbiB7XG4gIHJldHVybiBzLm9yaWVudGF0aW9uID09PSAnd2hpdGUnO1xufVxuIiwiaW1wb3J0IHsgQXBpLCBzdGFydCB9IGZyb20gJy4vYXBpJ1xuaW1wb3J0IHsgQ29uZmlnLCBjb25maWd1cmUgfSBmcm9tICcuL2NvbmZpZydcbmltcG9ydCB7IFN0YXRlLCBkZWZhdWx0cyB9IGZyb20gJy4vc3RhdGUnXG5cbmltcG9ydCByZW5kZXJXcmFwIGZyb20gJy4vd3JhcCc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnLi9ldmVudHMnXG5pbXBvcnQgcmVuZGVyIGZyb20gJy4vcmVuZGVyJztcbmltcG9ydCAqIGFzIHN2ZyBmcm9tICcuL3N2Zyc7XG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBDaGVzc2dyb3VuZChlbGVtZW50OiBIVE1MRWxlbWVudCwgY29uZmlnPzogQ29uZmlnKTogQXBpIHtcblxuICBjb25zdCBzdGF0ZSA9IGRlZmF1bHRzKCkgYXMgU3RhdGU7XG5cbiAgY29uZmlndXJlKHN0YXRlLCBjb25maWcgfHwge30pO1xuXG4gIGZ1bmN0aW9uIHJlZHJhd0FsbCgpIHtcbiAgICBsZXQgcHJldlVuYmluZCA9IHN0YXRlLmRvbSAmJiBzdGF0ZS5kb20udW5iaW5kO1xuICAgIC8vIGNvbXB1dGUgYm91bmRzIGZyb20gZXhpc3RpbmcgYm9hcmQgZWxlbWVudCBpZiBwb3NzaWJsZVxuICAgIC8vIHRoaXMgYWxsb3dzIG5vbi1zcXVhcmUgYm9hcmRzIGZyb20gQ1NTIHRvIGJlIGhhbmRsZWQgKGZvciAzRClcbiAgICBjb25zdCByZWxhdGl2ZSA9IHN0YXRlLnZpZXdPbmx5ICYmICFzdGF0ZS5kcmF3YWJsZS52aXNpYmxlLFxuICAgIGVsZW1lbnRzID0gcmVuZGVyV3JhcChlbGVtZW50LCBzdGF0ZSwgcmVsYXRpdmUpLFxuICAgIGJvdW5kcyA9IHV0aWwubWVtbygoKSA9PiBlbGVtZW50cy5ib2FyZC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSksXG4gICAgcmVkcmF3Tm93ID0gKHNraXBTdmc/OiBib29sZWFuKSA9PiB7XG4gICAgICByZW5kZXIoc3RhdGUpO1xuICAgICAgaWYgKCFza2lwU3ZnICYmIGVsZW1lbnRzLnN2Zykgc3ZnLnJlbmRlclN2ZyhzdGF0ZSwgZWxlbWVudHMuc3ZnKTtcbiAgICB9O1xuICAgIHN0YXRlLmRvbSA9IHtcbiAgICAgIGVsZW1lbnRzLFxuICAgICAgYm91bmRzLFxuICAgICAgcmVkcmF3OiBkZWJvdW5jZVJlZHJhdyhyZWRyYXdOb3cpLFxuICAgICAgcmVkcmF3Tm93LFxuICAgICAgdW5iaW5kOiBwcmV2VW5iaW5kLFxuICAgICAgcmVsYXRpdmVcbiAgICB9O1xuICAgIHN0YXRlLmRyYXdhYmxlLnByZXZTdmdIYXNoID0gJyc7XG4gICAgcmVkcmF3Tm93KGZhbHNlKTtcbiAgICBldmVudHMuYmluZEJvYXJkKHN0YXRlKTtcbiAgICBpZiAoIXByZXZVbmJpbmQpIHN0YXRlLmRvbS51bmJpbmQgPSBldmVudHMuYmluZERvY3VtZW50KHN0YXRlLCByZWRyYXdBbGwpO1xuICAgIHN0YXRlLmV2ZW50cy5pbnNlcnQgJiYgc3RhdGUuZXZlbnRzLmluc2VydChlbGVtZW50cyk7XG4gIH1cbiAgcmVkcmF3QWxsKCk7XG5cbiAgcmV0dXJuIHN0YXJ0KHN0YXRlLCByZWRyYXdBbGwpO1xufTtcblxuZnVuY3Rpb24gZGVib3VuY2VSZWRyYXcocmVkcmF3Tm93OiAoc2tpcFN2Zz86IGJvb2xlYW4pID0+IHZvaWQpOiAoKSA9PiB2b2lkIHtcbiAgbGV0IHJlZHJhd2luZyA9IGZhbHNlO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGlmIChyZWRyYXdpbmcpIHJldHVybjtcbiAgICByZWRyYXdpbmcgPSB0cnVlO1xuICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgICByZWRyYXdOb3coKTtcbiAgICAgIHJlZHJhd2luZyA9IGZhbHNlO1xuICAgIH0pO1xuICB9O1xufVxuIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xuaW1wb3J0IHsgc2V0Q2hlY2ssIHNldFNlbGVjdGVkIH0gZnJvbSAnLi9ib2FyZCdcbmltcG9ydCB7IHJlYWQgYXMgZmVuUmVhZCB9IGZyb20gJy4vZmVuJ1xuaW1wb3J0IHsgRHJhd1NoYXBlLCBEcmF3QnJ1c2ggfSBmcm9tICcuL2RyYXcnXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJ1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbmZpZyB7XG4gIGZlbj86IGNnLkZFTjsgLy8gY2hlc3MgcG9zaXRpb24gaW4gRm9yc3l0aCBub3RhdGlvblxuICBvcmllbnRhdGlvbj86IGNnLkNvbG9yOyAvLyBib2FyZCBvcmllbnRhdGlvbi4gd2hpdGUgfCBibGFja1xuICB0dXJuQ29sb3I/OiBjZy5Db2xvcjsgLy8gdHVybiB0byBwbGF5LiB3aGl0ZSB8IGJsYWNrXG4gIGNoZWNrPzogY2cuQ29sb3IgfCBib29sZWFuOyAvLyB0cnVlIGZvciBjdXJyZW50IGNvbG9yLCBmYWxzZSB0byB1bnNldFxuICBsYXN0TW92ZT86IGNnLktleVtdOyAvLyBzcXVhcmVzIHBhcnQgb2YgdGhlIGxhc3QgbW92ZSBbXCJjM1wiLCBcImM0XCJdXG4gIHNlbGVjdGVkPzogY2cuS2V5OyAvLyBzcXVhcmUgY3VycmVudGx5IHNlbGVjdGVkIFwiYTFcIlxuICBjb29yZGluYXRlcz86IGJvb2xlYW47IC8vIGluY2x1ZGUgY29vcmRzIGF0dHJpYnV0ZXNcbiAgYXV0b0Nhc3RsZT86IGJvb2xlYW47IC8vIGltbWVkaWF0ZWx5IGNvbXBsZXRlIHRoZSBjYXN0bGUgYnkgbW92aW5nIHRoZSByb29rIGFmdGVyIGtpbmcgbW92ZVxuICB2aWV3T25seT86IGJvb2xlYW47IC8vIGRvbid0IGJpbmQgZXZlbnRzOiB0aGUgdXNlciB3aWxsIG5ldmVyIGJlIGFibGUgdG8gbW92ZSBwaWVjZXMgYXJvdW5kXG4gIGRpc2FibGVDb250ZXh0TWVudT86IGJvb2xlYW47IC8vIGJlY2F1c2Ugd2hvIG5lZWRzIGEgY29udGV4dCBtZW51IG9uIGEgY2hlc3Nib2FyZFxuICByZXNpemFibGU/OiBib29sZWFuOyAvLyBsaXN0ZW5zIHRvIGNoZXNzZ3JvdW5kLnJlc2l6ZSBvbiBkb2N1bWVudC5ib2R5IHRvIGNsZWFyIGJvdW5kcyBjYWNoZVxuICBhZGRQaWVjZVpJbmRleD86IGJvb2xlYW47IC8vIGFkZHMgei1pbmRleCB2YWx1ZXMgdG8gcGllY2VzIChmb3IgM0QpXG4gIC8vIHBpZWNlS2V5OiBib29sZWFuOyAvLyBhZGQgYSBkYXRhLWtleSBhdHRyaWJ1dGUgdG8gcGllY2UgZWxlbWVudHNcbiAgaGlnaGxpZ2h0Pzoge1xuICAgIGxhc3RNb3ZlPzogYm9vbGVhbjsgLy8gYWRkIGxhc3QtbW92ZSBjbGFzcyB0byBzcXVhcmVzXG4gICAgY2hlY2s/OiBib29sZWFuOyAvLyBhZGQgY2hlY2sgY2xhc3MgdG8gc3F1YXJlc1xuICB9O1xuICBhbmltYXRpb24/OiB7XG4gICAgZW5hYmxlZD86IGJvb2xlYW47XG4gICAgZHVyYXRpb24/OiBudW1iZXI7XG4gIH07XG4gIG1vdmFibGU/OiB7XG4gICAgZnJlZT86IGJvb2xlYW47IC8vIGFsbCBtb3ZlcyBhcmUgdmFsaWQgLSBib2FyZCBlZGl0b3JcbiAgICBjb2xvcj86IGNnLkNvbG9yIHwgJ2JvdGgnOyAvLyBjb2xvciB0aGF0IGNhbiBtb3ZlLiB3aGl0ZSB8IGJsYWNrIHwgYm90aCB8IHVuZGVmaW5lZFxuICAgIGRlc3RzPzoge1xuICAgICAgW2tleTogc3RyaW5nXTogY2cuS2V5W11cbiAgICB9OyAvLyB2YWxpZCBtb3Zlcy4ge1wiYTJcIiBbXCJhM1wiIFwiYTRcIl0gXCJiMVwiIFtcImEzXCIgXCJjM1wiXX1cbiAgICBzaG93RGVzdHM/OiBib29sZWFuOyAvLyB3aGV0aGVyIHRvIGFkZCB0aGUgbW92ZS1kZXN0IGNsYXNzIG9uIHNxdWFyZXNcbiAgICBldmVudHM/OiB7XG4gICAgICBhZnRlcj86IChvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSwgbWV0YWRhdGE6IGNnLk1vdmVNZXRhZGF0YSkgPT4gdm9pZDsgLy8gY2FsbGVkIGFmdGVyIHRoZSBtb3ZlIGhhcyBiZWVuIHBsYXllZFxuICAgICAgYWZ0ZXJOZXdQaWVjZT86IChyb2xlOiBjZy5Sb2xlLCBrZXk6IGNnLktleSwgbWV0YWRhdGE6IGNnLk1vdmVNZXRhZGF0YSkgPT4gdm9pZDsgLy8gY2FsbGVkIGFmdGVyIGEgbmV3IHBpZWNlIGlzIGRyb3BwZWQgb24gdGhlIGJvYXJkXG4gICAgfTtcbiAgICByb29rQ2FzdGxlPzogYm9vbGVhbiAvLyBjYXN0bGUgYnkgbW92aW5nIHRoZSBraW5nIHRvIHRoZSByb29rXG4gIH07XG4gIHByZW1vdmFibGU/OiB7XG4gICAgZW5hYmxlZD86IGJvb2xlYW47IC8vIGFsbG93IHByZW1vdmVzIGZvciBjb2xvciB0aGF0IGNhbiBub3QgbW92ZVxuICAgIHNob3dEZXN0cz86IGJvb2xlYW47IC8vIHdoZXRoZXIgdG8gYWRkIHRoZSBwcmVtb3ZlLWRlc3QgY2xhc3Mgb24gc3F1YXJlc1xuICAgIGNhc3RsZT86IGJvb2xlYW47IC8vIHdoZXRoZXIgdG8gYWxsb3cga2luZyBjYXN0bGUgcHJlbW92ZXNcbiAgICBkZXN0cz86IGNnLktleVtdOyAvLyBwcmVtb3ZlIGRlc3RpbmF0aW9ucyBmb3IgdGhlIGN1cnJlbnQgc2VsZWN0aW9uXG4gICAgZXZlbnRzPzoge1xuICAgICAgc2V0PzogKG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5LCBtZXRhZGF0YT86IGNnLlNldFByZW1vdmVNZXRhZGF0YSkgPT4gdm9pZDsgLy8gY2FsbGVkIGFmdGVyIHRoZSBwcmVtb3ZlIGhhcyBiZWVuIHNldFxuICAgICAgdW5zZXQ/OiAoKSA9PiB2b2lkOyAgLy8gY2FsbGVkIGFmdGVyIHRoZSBwcmVtb3ZlIGhhcyBiZWVuIHVuc2V0XG4gICAgfVxuICB9O1xuICBwcmVkcm9wcGFibGU/OiB7XG4gICAgZW5hYmxlZD86IGJvb2xlYW47IC8vIGFsbG93IHByZWRyb3BzIGZvciBjb2xvciB0aGF0IGNhbiBub3QgbW92ZVxuICAgIGV2ZW50cz86IHtcbiAgICAgIHNldD86IChyb2xlOiBjZy5Sb2xlLCBrZXk6IGNnLktleSkgPT4gdm9pZDsgLy8gY2FsbGVkIGFmdGVyIHRoZSBwcmVkcm9wIGhhcyBiZWVuIHNldFxuICAgICAgdW5zZXQ/OiAoKSA9PiB2b2lkOyAvLyBjYWxsZWQgYWZ0ZXIgdGhlIHByZWRyb3AgaGFzIGJlZW4gdW5zZXRcbiAgICB9XG4gIH07XG4gIGRyYWdnYWJsZT86IHtcbiAgICBlbmFibGVkPzogYm9vbGVhbjsgLy8gYWxsb3cgbW92ZXMgJiBwcmVtb3ZlcyB0byB1c2UgZHJhZyduIGRyb3BcbiAgICBkaXN0YW5jZT86IG51bWJlcjsgLy8gbWluaW11bSBkaXN0YW5jZSB0byBpbml0aWF0ZSBhIGRyYWc7IGluIHBpeGVsc1xuICAgIGF1dG9EaXN0YW5jZT86IGJvb2xlYW47IC8vIGxldHMgY2hlc3Nncm91bmQgc2V0IGRpc3RhbmNlIHRvIHplcm8gd2hlbiB1c2VyIGRyYWdzIHBpZWNlc1xuICAgIGNlbnRlclBpZWNlPzogYm9vbGVhbjsgLy8gY2VudGVyIHRoZSBwaWVjZSBvbiBjdXJzb3IgYXQgZHJhZyBzdGFydFxuICAgIHNob3dHaG9zdD86IGJvb2xlYW47IC8vIHNob3cgZ2hvc3Qgb2YgcGllY2UgYmVpbmcgZHJhZ2dlZFxuICAgIGRlbGV0ZU9uRHJvcE9mZj86IGJvb2xlYW47IC8vIGRlbGV0ZSBhIHBpZWNlIHdoZW4gaXQgaXMgZHJvcHBlZCBvZmYgdGhlIGJvYXJkXG4gIH07XG4gIHNlbGVjdGFibGU/OiB7XG4gICAgLy8gZGlzYWJsZSB0byBlbmZvcmNlIGRyYWdnaW5nIG92ZXIgY2xpY2stY2xpY2sgbW92ZVxuICAgIGVuYWJsZWQ/OiBib29sZWFuXG4gIH07XG4gIGV2ZW50cz86IHtcbiAgICBjaGFuZ2U/OiAoKSA9PiB2b2lkOyAvLyBjYWxsZWQgYWZ0ZXIgdGhlIHNpdHVhdGlvbiBjaGFuZ2VzIG9uIHRoZSBib2FyZFxuICAgIC8vIGNhbGxlZCBhZnRlciBhIHBpZWNlIGhhcyBiZWVuIG1vdmVkLlxuICAgIC8vIGNhcHR1cmVkUGllY2UgaXMgdW5kZWZpbmVkIG9yIGxpa2Uge2NvbG9yOiAnd2hpdGUnOyAncm9sZSc6ICdxdWVlbid9XG4gICAgbW92ZT86IChvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSwgY2FwdHVyZWRQaWVjZT86IGNnLlBpZWNlKSA9PiB2b2lkO1xuICAgIGRyb3BOZXdQaWVjZT86IChwaWVjZTogY2cuUGllY2UsIGtleTogY2cuS2V5KSA9PiB2b2lkO1xuICAgIHNlbGVjdD86IChrZXk6IGNnLktleSkgPT4gdm9pZDsgLy8gY2FsbGVkIHdoZW4gYSBzcXVhcmUgaXMgc2VsZWN0ZWRcbiAgICBpbnNlcnQ/OiAoZWxlbWVudHM6IGNnLkVsZW1lbnRzKSA9PiB2b2lkOyAvLyB3aGVuIHRoZSBib2FyZCBET00gaGFzIGJlZW4gKHJlKWluc2VydGVkXG4gIH07XG4gIGRyYXdhYmxlPzoge1xuICAgIGVuYWJsZWQ/OiBib29sZWFuOyAvLyBjYW4gZHJhd1xuICAgIHZpc2libGU/OiBib29sZWFuOyAvLyBjYW4gdmlld1xuICAgIGVyYXNlT25DbGljaz86IGJvb2xlYW47XG4gICAgc2hhcGVzPzogRHJhd1NoYXBlW107XG4gICAgYXV0b1NoYXBlcz86IERyYXdTaGFwZVtdO1xuICAgIGJydXNoZXM/OiBEcmF3QnJ1c2hbXTtcbiAgICBwaWVjZXM/OiB7XG4gICAgICBiYXNlVXJsPzogc3RyaW5nO1xuICAgIH1cbiAgfTtcbiAgZ2VvbWV0cnk/OiBjZy5HZW9tZXRyeTsgLy8gZGltOHg4IHwgZGltOXg5IHwgZGltMTB4OCB8IGRpbTl4MTBcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbmZpZ3VyZShzdGF0ZTogU3RhdGUsIGNvbmZpZzogQ29uZmlnKSB7XG5cbiAgLy8gZG9uJ3QgbWVyZ2UgZGVzdGluYXRpb25zLiBKdXN0IG92ZXJyaWRlLlxuICBpZiAoY29uZmlnLm1vdmFibGUgJiYgY29uZmlnLm1vdmFibGUuZGVzdHMpIHN0YXRlLm1vdmFibGUuZGVzdHMgPSB1bmRlZmluZWQ7XG5cbiAgbWVyZ2Uoc3RhdGUsIGNvbmZpZyk7XG5cbiAgaWYgKGNvbmZpZy5nZW9tZXRyeSkgc3RhdGUuZGltZW5zaW9ucyA9IGNnLmRpbWVuc2lvbnNbY29uZmlnLmdlb21ldHJ5XTtcblxuICAvLyBpZiBhIGZlbiB3YXMgcHJvdmlkZWQsIHJlcGxhY2UgdGhlIHBpZWNlc1xuICBpZiAoY29uZmlnLmZlbikge1xuICAgIHN0YXRlLnBpZWNlcyA9IGZlblJlYWQoY29uZmlnLmZlbiwgc3RhdGUuZ2VvbWV0cnkpO1xuICAgIHN0YXRlLmRyYXdhYmxlLnNoYXBlcyA9IFtdO1xuICB9XG5cbiAgLy8gYXBwbHkgY29uZmlnIHZhbHVlcyB0aGF0IGNvdWxkIGJlIHVuZGVmaW5lZCB5ZXQgbWVhbmluZ2Z1bFxuICBpZiAoY29uZmlnLmhhc093blByb3BlcnR5KCdjaGVjaycpKSBzZXRDaGVjayhzdGF0ZSwgY29uZmlnLmNoZWNrIHx8IGZhbHNlKTtcbiAgaWYgKGNvbmZpZy5oYXNPd25Qcm9wZXJ0eSgnbGFzdE1vdmUnKSAmJiAhY29uZmlnLmxhc3RNb3ZlKSBzdGF0ZS5sYXN0TW92ZSA9IHVuZGVmaW5lZDtcbiAgLy8gaW4gY2FzZSBvZiBaSCBkcm9wIGxhc3QgbW92ZSwgdGhlcmUncyBhIHNpbmdsZSBzcXVhcmUuXG4gIC8vIGlmIHRoZSBwcmV2aW91cyBsYXN0IG1vdmUgaGFkIHR3byBzcXVhcmVzLFxuICAvLyB0aGUgbWVyZ2UgYWxnb3JpdGhtIHdpbGwgaW5jb3JyZWN0bHkga2VlcCB0aGUgc2Vjb25kIHNxdWFyZS5cbiAgZWxzZSBpZiAoY29uZmlnLmxhc3RNb3ZlKSBzdGF0ZS5sYXN0TW92ZSA9IGNvbmZpZy5sYXN0TW92ZTtcblxuICAvLyBmaXggbW92ZS9wcmVtb3ZlIGRlc3RzXG4gIGlmIChzdGF0ZS5zZWxlY3RlZCkgc2V0U2VsZWN0ZWQoc3RhdGUsIHN0YXRlLnNlbGVjdGVkKTtcblxuICAvLyBubyBuZWVkIGZvciBzdWNoIHNob3J0IGFuaW1hdGlvbnNcbiAgaWYgKCFzdGF0ZS5hbmltYXRpb24uZHVyYXRpb24gfHwgc3RhdGUuYW5pbWF0aW9uLmR1cmF0aW9uIDwgMTAwKSBzdGF0ZS5hbmltYXRpb24uZW5hYmxlZCA9IGZhbHNlO1xuXG4gIGlmICghc3RhdGUubW92YWJsZS5yb29rQ2FzdGxlICYmIHN0YXRlLm1vdmFibGUuZGVzdHMpIHtcbiAgICBjb25zdCByYW5rID0gc3RhdGUubW92YWJsZS5jb2xvciA9PT0gJ3doaXRlJyA/IDEgOiA4LFxuICAgIGtpbmdTdGFydFBvcyA9ICdlJyArIHJhbmssXG4gICAgZGVzdHMgPSBzdGF0ZS5tb3ZhYmxlLmRlc3RzW2tpbmdTdGFydFBvc10sXG4gICAga2luZyA9IHN0YXRlLnBpZWNlc1traW5nU3RhcnRQb3NdO1xuICAgIGlmICghZGVzdHMgfHwgIWtpbmcgfHwga2luZy5yb2xlICE9PSAna2luZycpIHJldHVybjtcbiAgICBzdGF0ZS5tb3ZhYmxlLmRlc3RzW2tpbmdTdGFydFBvc10gPSBkZXN0cy5maWx0ZXIoZCA9PlxuICAgICAgISgoZCA9PT0gJ2EnICsgcmFuaykgJiYgZGVzdHMuaW5kZXhPZignYycgKyByYW5rIGFzIGNnLktleSkgIT09IC0xKSAmJlxuICAgICAgICAhKChkID09PSAnaCcgKyByYW5rKSAmJiBkZXN0cy5pbmRleE9mKCdnJyArIHJhbmsgYXMgY2cuS2V5KSAhPT0gLTEpXG4gICAgKTtcbiAgfVxufTtcblxuZnVuY3Rpb24gbWVyZ2UoYmFzZTogYW55LCBleHRlbmQ6IGFueSkge1xuICBmb3IgKGxldCBrZXkgaW4gZXh0ZW5kKSB7XG4gICAgaWYgKGlzT2JqZWN0KGJhc2Vba2V5XSkgJiYgaXNPYmplY3QoZXh0ZW5kW2tleV0pKSBtZXJnZShiYXNlW2tleV0sIGV4dGVuZFtrZXldKTtcbiAgICBlbHNlIGJhc2Vba2V5XSA9IGV4dGVuZFtrZXldO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KG86IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gdHlwZW9mIG8gPT09ICdvYmplY3QnO1xufVxuIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xuaW1wb3J0ICogYXMgYm9hcmQgZnJvbSAnLi9ib2FyZCdcbmltcG9ydCAqIGFzIHV0aWwgZnJvbSAnLi91dGlsJ1xuaW1wb3J0IHsgY2xlYXIgYXMgZHJhd0NsZWFyIH0gZnJvbSAnLi9kcmF3J1xuaW1wb3J0ICogYXMgY2cgZnJvbSAnLi90eXBlcydcbmltcG9ydCB7IGFuaW0gfSBmcm9tICcuL2FuaW0nXG5cbmV4cG9ydCBpbnRlcmZhY2UgRHJhZ0N1cnJlbnQge1xuICBvcmlnOiBjZy5LZXk7IC8vIG9yaWcga2V5IG9mIGRyYWdnaW5nIHBpZWNlXG4gIG9yaWdQb3M6IGNnLlBvcztcbiAgcGllY2U6IGNnLlBpZWNlO1xuICByZWw6IGNnLk51bWJlclBhaXI7IC8vIHg7IHkgb2YgdGhlIHBpZWNlIGF0IG9yaWdpbmFsIHBvc2l0aW9uXG4gIGVwb3M6IGNnLk51bWJlclBhaXI7IC8vIGluaXRpYWwgZXZlbnQgcG9zaXRpb25cbiAgcG9zOiBjZy5OdW1iZXJQYWlyOyAvLyByZWxhdGl2ZSBjdXJyZW50IHBvc2l0aW9uXG4gIGRlYzogY2cuTnVtYmVyUGFpcjsgLy8gcGllY2UgY2VudGVyIGRlY2F5XG4gIHN0YXJ0ZWQ6IGJvb2xlYW47IC8vIHdoZXRoZXIgdGhlIGRyYWcgaGFzIHN0YXJ0ZWQ7IGFzIHBlciB0aGUgZGlzdGFuY2Ugc2V0dGluZ1xuICBlbGVtZW50OiBjZy5QaWVjZU5vZGUgfCAoKCkgPT4gY2cuUGllY2VOb2RlIHwgdW5kZWZpbmVkKTtcbiAgbmV3UGllY2U/OiBib29sZWFuOyAvLyBpdCBpdCBhIG5ldyBwaWVjZSBmcm9tIG91dHNpZGUgdGhlIGJvYXJkXG4gIGZvcmNlPzogYm9vbGVhbjsgLy8gY2FuIHRoZSBuZXcgcGllY2UgcmVwbGFjZSBhbiBleGlzdGluZyBvbmUgKGVkaXRvcilcbiAgcHJldmlvdXNseVNlbGVjdGVkPzogY2cuS2V5O1xuICBvcmlnaW5UYXJnZXQ6IEV2ZW50VGFyZ2V0IHwgbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0KHM6IFN0YXRlLCBlOiBjZy5Nb3VjaEV2ZW50KTogdm9pZCB7XG4gIGlmIChlLmJ1dHRvbiAhPT0gdW5kZWZpbmVkICYmIGUuYnV0dG9uICE9PSAwKSByZXR1cm47IC8vIG9ubHkgdG91Y2ggb3IgbGVmdCBjbGlja1xuICBpZiAoZS50b3VjaGVzICYmIGUudG91Y2hlcy5sZW5ndGggPiAxKSByZXR1cm47IC8vIHN1cHBvcnQgb25lIGZpbmdlciB0b3VjaCBvbmx5XG4gIGNvbnN0IGJvdW5kcyA9IHMuZG9tLmJvdW5kcygpLFxuICBwb3NpdGlvbiA9IHV0aWwuZXZlbnRQb3NpdGlvbihlKSBhcyBjZy5OdW1iZXJQYWlyLFxuICBvcmlnID0gYm9hcmQuZ2V0S2V5QXREb21Qb3MocG9zaXRpb24sIGJvYXJkLndoaXRlUG92KHMpLCBib3VuZHMsIHMuZ2VvbWV0cnkpO1xuICBpZiAoIW9yaWcpIHJldHVybjtcbiAgY29uc3QgcGllY2UgPSBzLnBpZWNlc1tvcmlnXTtcbiAgY29uc3QgcHJldmlvdXNseVNlbGVjdGVkID0gcy5zZWxlY3RlZDtcbiAgaWYgKCFwcmV2aW91c2x5U2VsZWN0ZWQgJiYgcy5kcmF3YWJsZS5lbmFibGVkICYmIChcbiAgICBzLmRyYXdhYmxlLmVyYXNlT25DbGljayB8fCAoIXBpZWNlIHx8IHBpZWNlLmNvbG9yICE9PSBzLnR1cm5Db2xvcilcbiAgKSkgZHJhd0NsZWFyKHMpO1xuICAvLyBQcmV2ZW50IHRvdWNoIHNjcm9sbCBhbmQgY3JlYXRlIG5vIGNvcnJlc3BvbmRpbmcgbW91c2UgZXZlbnQsIGlmIHRoZXJlXG4gIC8vIGlzIGFuIGludGVudCB0byBpbnRlcmFjdCB3aXRoIHRoZSBib2FyZC4gSWYgbm8gY29sb3IgaXMgbW92YWJsZVxuICAvLyAoYW5kIHRoZSBib2FyZCBpcyBub3QgZm9yIHZpZXdpbmcgb25seSksIHRvdWNoZXMgYXJlIGxpa2VseSBpbnRlbmRlZCB0b1xuICAvLyBzZWxlY3Qgc3F1YXJlcy5cbiAgaWYgKGUuY2FuY2VsYWJsZSAhPT0gZmFsc2UgJiZcbiAgICAgICghZS50b3VjaGVzIHx8ICFzLm1vdmFibGUuY29sb3IgfHwgcGllY2UgfHwgcHJldmlvdXNseVNlbGVjdGVkIHx8IHBpZWNlQ2xvc2VUbyhzLCBwb3NpdGlvbikpKVxuICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgY29uc3QgaGFkUHJlbW92ZSA9ICEhcy5wcmVtb3ZhYmxlLmN1cnJlbnQ7XG4gIGNvbnN0IGhhZFByZWRyb3AgPSAhIXMucHJlZHJvcHBhYmxlLmN1cnJlbnQ7XG4gIHMuc3RhdHMuY3RybEtleSA9IGUuY3RybEtleTtcbiAgaWYgKHMuc2VsZWN0ZWQgJiYgYm9hcmQuY2FuTW92ZShzLCBzLnNlbGVjdGVkLCBvcmlnKSkge1xuICAgIGFuaW0oc3RhdGUgPT4gYm9hcmQuc2VsZWN0U3F1YXJlKHN0YXRlLCBvcmlnKSwgcyk7XG4gIH0gZWxzZSB7XG4gICAgYm9hcmQuc2VsZWN0U3F1YXJlKHMsIG9yaWcpO1xuICB9XG4gIGNvbnN0IHN0aWxsU2VsZWN0ZWQgPSBzLnNlbGVjdGVkID09PSBvcmlnO1xuICBjb25zdCBlbGVtZW50ID0gcGllY2VFbGVtZW50QnlLZXkocywgb3JpZyk7XG4gIGNvbnN0IGZpcnN0UmFua0lzMCA9IHMuZGltZW5zaW9ucy5oZWlnaHQgPT09IDEwO1xuICBpZiAocGllY2UgJiYgZWxlbWVudCAmJiBzdGlsbFNlbGVjdGVkICYmIGJvYXJkLmlzRHJhZ2dhYmxlKHMsIG9yaWcpKSB7XG4gICAgY29uc3Qgc3F1YXJlQm91bmRzID0gY29tcHV0ZVNxdWFyZUJvdW5kcyhvcmlnLCBib2FyZC53aGl0ZVBvdihzKSwgYm91bmRzLCBzLmRpbWVuc2lvbnMpO1xuICAgIHMuZHJhZ2dhYmxlLmN1cnJlbnQgPSB7XG4gICAgICBvcmlnLFxuICAgICAgb3JpZ1BvczogdXRpbC5rZXkycG9zKG9yaWcsIGZpcnN0UmFua0lzMCksXG4gICAgICBwaWVjZSxcbiAgICAgIHJlbDogcG9zaXRpb24sXG4gICAgICBlcG9zOiBwb3NpdGlvbixcbiAgICAgIHBvczogWzAsIDBdLFxuICAgICAgZGVjOiBzLmRyYWdnYWJsZS5jZW50ZXJQaWVjZSA/IFtcbiAgICAgICAgcG9zaXRpb25bMF0gLSAoc3F1YXJlQm91bmRzLmxlZnQgKyBzcXVhcmVCb3VuZHMud2lkdGggLyAyKSxcbiAgICAgICAgcG9zaXRpb25bMV0gLSAoc3F1YXJlQm91bmRzLnRvcCArIHNxdWFyZUJvdW5kcy5oZWlnaHQgLyAyKVxuICAgICAgXSA6IFswLCAwXSxcbiAgICAgIHN0YXJ0ZWQ6IHMuZHJhZ2dhYmxlLmF1dG9EaXN0YW5jZSAmJiBzLnN0YXRzLmRyYWdnZWQsXG4gICAgICBlbGVtZW50LFxuICAgICAgcHJldmlvdXNseVNlbGVjdGVkLFxuICAgICAgb3JpZ2luVGFyZ2V0OiBlLnRhcmdldFxuICAgIH07XG4gICAgZWxlbWVudC5jZ0RyYWdnaW5nID0gdHJ1ZTtcbiAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2RyYWdnaW5nJyk7XG4gICAgLy8gcGxhY2UgZ2hvc3RcbiAgICBjb25zdCBnaG9zdCA9IHMuZG9tLmVsZW1lbnRzLmdob3N0O1xuICAgIGlmIChnaG9zdCkge1xuICAgICAgZ2hvc3QuY2xhc3NOYW1lID0gYGdob3N0ICR7cGllY2UuY29sb3J9ICR7cGllY2Uucm9sZX1gO1xuICAgICAgdXRpbC50cmFuc2xhdGVBYnMoZ2hvc3QsIHV0aWwucG9zVG9UcmFuc2xhdGVBYnMoYm91bmRzLCBzLmRpbWVuc2lvbnMpKHV0aWwua2V5MnBvcyhvcmlnLCBmaXJzdFJhbmtJczApLCBib2FyZC53aGl0ZVBvdihzKSkpO1xuICAgICAgdXRpbC5zZXRWaXNpYmxlKGdob3N0LCB0cnVlKTtcbiAgICB9XG4gICAgcHJvY2Vzc0RyYWcocyk7XG4gIH0gZWxzZSB7XG4gICAgaWYgKGhhZFByZW1vdmUpIGJvYXJkLnVuc2V0UHJlbW92ZShzKTtcbiAgICBpZiAoaGFkUHJlZHJvcCkgYm9hcmQudW5zZXRQcmVkcm9wKHMpO1xuICB9XG4gIHMuZG9tLnJlZHJhdygpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGllY2VDbG9zZVRvKHM6IFN0YXRlLCBwb3M6IGNnLlBvcyk6IGJvb2xlYW4ge1xuICBjb25zdCBhc1doaXRlID0gYm9hcmQud2hpdGVQb3YocyksXG4gIGJvdW5kcyA9IHMuZG9tLmJvdW5kcygpLFxuICByYWRpdXNTcSA9IE1hdGgucG93KGJvdW5kcy53aWR0aCAvIDgsIDIpO1xuICBmb3IgKGxldCBrZXkgaW4gcy5waWVjZXMpIHtcbiAgICBjb25zdCBzcXVhcmVCb3VuZHMgPSBjb21wdXRlU3F1YXJlQm91bmRzKGtleSBhcyBjZy5LZXksIGFzV2hpdGUsIGJvdW5kcywgcy5kaW1lbnNpb25zKSxcbiAgICBjZW50ZXI6IGNnLlBvcyA9IFtcbiAgICAgIHNxdWFyZUJvdW5kcy5sZWZ0ICsgc3F1YXJlQm91bmRzLndpZHRoIC8gMixcbiAgICAgIHNxdWFyZUJvdW5kcy50b3AgKyBzcXVhcmVCb3VuZHMuaGVpZ2h0IC8gMlxuICAgIF07XG4gICAgaWYgKHV0aWwuZGlzdGFuY2VTcShjZW50ZXIsIHBvcykgPD0gcmFkaXVzU3EpIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRyYWdOZXdQaWVjZShzOiBTdGF0ZSwgcGllY2U6IGNnLlBpZWNlLCBlOiBjZy5Nb3VjaEV2ZW50LCBmb3JjZT86IGJvb2xlYW4pOiB2b2lkIHtcblxuICBjb25zdCBrZXk6IGNnLktleSA9ICd6MCc7XG5cbiAgcy5waWVjZXNba2V5XSA9IHBpZWNlO1xuXG4gIHMuZG9tLnJlZHJhdygpO1xuXG4gIGNvbnN0IHBvc2l0aW9uID0gdXRpbC5ldmVudFBvc2l0aW9uKGUpIGFzIGNnLk51bWJlclBhaXIsXG4gIGFzV2hpdGUgPSBib2FyZC53aGl0ZVBvdihzKSxcbiAgYm91bmRzID0gcy5kb20uYm91bmRzKCksXG4gIHNxdWFyZUJvdW5kcyA9IGNvbXB1dGVTcXVhcmVCb3VuZHMoa2V5LCBhc1doaXRlLCBib3VuZHMsIHMuZGltZW5zaW9ucyk7XG5cbiAgY29uc3QgcmVsOiBjZy5OdW1iZXJQYWlyID0gW1xuICAgIChhc1doaXRlID8gMCA6IHMuZGltZW5zaW9ucy53aWR0aCAtIDEpICogc3F1YXJlQm91bmRzLndpZHRoICsgYm91bmRzLmxlZnQsXG4gICAgKGFzV2hpdGUgPyBzLmRpbWVuc2lvbnMuaGVpZ2h0IDogLTEpICogc3F1YXJlQm91bmRzLmhlaWdodCArIGJvdW5kcy50b3BcbiAgXTtcblxuICBjb25zdCBmaXJzdFJhbmtJczAgPSBzLmdlb21ldHJ5ID09PSBjZy5HZW9tZXRyeS5kaW05eDEwO1xuICBzLmRyYWdnYWJsZS5jdXJyZW50ID0ge1xuICAgIG9yaWc6IGtleSxcbiAgICBvcmlnUG9zOiB1dGlsLmtleTJwb3MoJ2EwJywgZmlyc3RSYW5rSXMwKSxcbiAgICBwaWVjZSxcbiAgICByZWwsXG4gICAgZXBvczogcG9zaXRpb24sXG4gICAgcG9zOiBbcG9zaXRpb25bMF0gLSByZWxbMF0sIHBvc2l0aW9uWzFdIC0gcmVsWzFdXSxcbiAgICBkZWM6IFstc3F1YXJlQm91bmRzLndpZHRoIC8gMiwgLXNxdWFyZUJvdW5kcy5oZWlnaHQgLyAyXSxcbiAgICBzdGFydGVkOiB0cnVlLFxuICAgIGVsZW1lbnQ6ICgpID0+IHBpZWNlRWxlbWVudEJ5S2V5KHMsIGtleSksXG4gICAgb3JpZ2luVGFyZ2V0OiBlLnRhcmdldCxcbiAgICBuZXdQaWVjZTogdHJ1ZSxcbiAgICBmb3JjZTogISFmb3JjZVxuICB9O1xuICBwcm9jZXNzRHJhZyhzKTtcbn1cblxuZnVuY3Rpb24gcHJvY2Vzc0RyYWcoczogU3RhdGUpOiB2b2lkIHtcbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICBjb25zdCBjdXIgPSBzLmRyYWdnYWJsZS5jdXJyZW50O1xuICAgIGlmICghY3VyKSByZXR1cm47XG4gICAgLy8gY2FuY2VsIGFuaW1hdGlvbnMgd2hpbGUgZHJhZ2dpbmdcbiAgICBpZiAocy5hbmltYXRpb24uY3VycmVudCAmJiBzLmFuaW1hdGlvbi5jdXJyZW50LnBsYW4uYW5pbXNbY3VyLm9yaWddKSBzLmFuaW1hdGlvbi5jdXJyZW50ID0gdW5kZWZpbmVkO1xuICAgIC8vIGlmIG1vdmluZyBwaWVjZSBpcyBnb25lLCBjYW5jZWxcbiAgICBjb25zdCBvcmlnUGllY2UgPSBzLnBpZWNlc1tjdXIub3JpZ107XG4gICAgaWYgKCFvcmlnUGllY2UgfHwgIXV0aWwuc2FtZVBpZWNlKG9yaWdQaWVjZSwgY3VyLnBpZWNlKSkgY2FuY2VsKHMpO1xuICAgIGVsc2Uge1xuICAgICAgaWYgKCFjdXIuc3RhcnRlZCAmJiB1dGlsLmRpc3RhbmNlU3EoY3VyLmVwb3MsIGN1ci5yZWwpID49IE1hdGgucG93KHMuZHJhZ2dhYmxlLmRpc3RhbmNlLCAyKSkgY3VyLnN0YXJ0ZWQgPSB0cnVlO1xuICAgICAgaWYgKGN1ci5zdGFydGVkKSB7XG5cbiAgICAgICAgLy8gc3VwcG9ydCBsYXp5IGVsZW1lbnRzXG4gICAgICAgIGlmICh0eXBlb2YgY3VyLmVsZW1lbnQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBjb25zdCBmb3VuZCA9IGN1ci5lbGVtZW50KCk7XG4gICAgICAgICAgaWYgKCFmb3VuZCkgcmV0dXJuO1xuICAgICAgICAgIGZvdW5kLmNnRHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgICAgIGZvdW5kLmNsYXNzTGlzdC5hZGQoJ2RyYWdnaW5nJyk7XG4gICAgICAgICAgY3VyLmVsZW1lbnQgPSBmb3VuZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGN1ci5wb3MgPSBbXG4gICAgICAgICAgY3VyLmVwb3NbMF0gLSBjdXIucmVsWzBdLFxuICAgICAgICAgIGN1ci5lcG9zWzFdIC0gY3VyLnJlbFsxXVxuICAgICAgICBdO1xuXG4gICAgICAgIC8vIG1vdmUgcGllY2VcbiAgICAgICAgY29uc3QgdHJhbnNsYXRpb24gPSB1dGlsLnBvc1RvVHJhbnNsYXRlQWJzKHMuZG9tLmJvdW5kcygpLCBzLmRpbWVuc2lvbnMpKGN1ci5vcmlnUG9zLCBib2FyZC53aGl0ZVBvdihzKSk7XG4gICAgICAgIHRyYW5zbGF0aW9uWzBdICs9IGN1ci5wb3NbMF0gKyBjdXIuZGVjWzBdO1xuICAgICAgICB0cmFuc2xhdGlvblsxXSArPSBjdXIucG9zWzFdICsgY3VyLmRlY1sxXTtcbiAgICAgICAgdXRpbC50cmFuc2xhdGVBYnMoY3VyLmVsZW1lbnQsIHRyYW5zbGF0aW9uKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcHJvY2Vzc0RyYWcocyk7XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbW92ZShzOiBTdGF0ZSwgZTogY2cuTW91Y2hFdmVudCk6IHZvaWQge1xuICAvLyBzdXBwb3J0IG9uZSBmaW5nZXIgdG91Y2ggb25seVxuICBpZiAocy5kcmFnZ2FibGUuY3VycmVudCAmJiAoIWUudG91Y2hlcyB8fCBlLnRvdWNoZXMubGVuZ3RoIDwgMikpIHtcbiAgICBzLmRyYWdnYWJsZS5jdXJyZW50LmVwb3MgPSB1dGlsLmV2ZW50UG9zaXRpb24oZSkgYXMgY2cuTnVtYmVyUGFpcjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZW5kKHM6IFN0YXRlLCBlOiBjZy5Nb3VjaEV2ZW50KTogdm9pZCB7XG4gIGNvbnN0IGN1ciA9IHMuZHJhZ2dhYmxlLmN1cnJlbnQ7XG4gIGlmICghY3VyKSByZXR1cm47XG4gIC8vIGNyZWF0ZSBubyBjb3JyZXNwb25kaW5nIG1vdXNlIGV2ZW50XG4gIGlmIChlLnR5cGUgPT09ICd0b3VjaGVuZCcgJiYgZS5jYW5jZWxhYmxlICE9PSBmYWxzZSkgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAvLyBjb21wYXJpbmcgd2l0aCB0aGUgb3JpZ2luIHRhcmdldCBpcyBhbiBlYXN5IHdheSB0byB0ZXN0IHRoYXQgdGhlIGVuZCBldmVudFxuICAvLyBoYXMgdGhlIHNhbWUgdG91Y2ggb3JpZ2luXG4gIGlmIChlLnR5cGUgPT09ICd0b3VjaGVuZCcgJiYgY3VyICYmIGN1ci5vcmlnaW5UYXJnZXQgIT09IGUudGFyZ2V0ICYmICFjdXIubmV3UGllY2UpIHtcbiAgICBzLmRyYWdnYWJsZS5jdXJyZW50ID0gdW5kZWZpbmVkO1xuICAgIHJldHVybjtcbiAgfVxuICBib2FyZC51bnNldFByZW1vdmUocyk7XG4gIGJvYXJkLnVuc2V0UHJlZHJvcChzKTtcbiAgLy8gdG91Y2hlbmQgaGFzIG5vIHBvc2l0aW9uOyBzbyB1c2UgdGhlIGxhc3QgdG91Y2htb3ZlIHBvc2l0aW9uIGluc3RlYWRcbiAgY29uc3QgZXZlbnRQb3M6IGNnLk51bWJlclBhaXIgPSB1dGlsLmV2ZW50UG9zaXRpb24oZSkgfHwgY3VyLmVwb3M7XG4gIGNvbnN0IGRlc3QgPSBib2FyZC5nZXRLZXlBdERvbVBvcyhldmVudFBvcywgYm9hcmQud2hpdGVQb3YocyksIHMuZG9tLmJvdW5kcygpLCBzLmdlb21ldHJ5KTtcbiAgaWYgKGRlc3QgJiYgY3VyLnN0YXJ0ZWQgJiYgY3VyLm9yaWcgIT09IGRlc3QpIHtcbiAgICBpZiAoY3VyLm5ld1BpZWNlKSBib2FyZC5kcm9wTmV3UGllY2UocywgY3VyLm9yaWcsIGRlc3QsIGN1ci5mb3JjZSk7XG4gICAgZWxzZSB7XG4gICAgICBzLnN0YXRzLmN0cmxLZXkgPSBlLmN0cmxLZXk7XG4gICAgICBpZiAoYm9hcmQudXNlck1vdmUocywgY3VyLm9yaWcsIGRlc3QpKSBzLnN0YXRzLmRyYWdnZWQgPSB0cnVlO1xuICAgIH1cbiAgfSBlbHNlIGlmIChjdXIubmV3UGllY2UpIHtcbiAgICBkZWxldGUgcy5waWVjZXNbY3VyLm9yaWddO1xuICB9IGVsc2UgaWYgKHMuZHJhZ2dhYmxlLmRlbGV0ZU9uRHJvcE9mZiAmJiAhZGVzdCkge1xuICAgIGRlbGV0ZSBzLnBpZWNlc1tjdXIub3JpZ107XG4gICAgYm9hcmQuY2FsbFVzZXJGdW5jdGlvbihzLmV2ZW50cy5jaGFuZ2UpO1xuICB9XG4gIGlmIChjdXIgJiYgY3VyLm9yaWcgPT09IGN1ci5wcmV2aW91c2x5U2VsZWN0ZWQgJiYgKGN1ci5vcmlnID09PSBkZXN0IHx8ICFkZXN0KSlcbiAgICBib2FyZC51bnNlbGVjdChzKTtcbiAgZWxzZSBpZiAoIXMuc2VsZWN0YWJsZS5lbmFibGVkKSBib2FyZC51bnNlbGVjdChzKTtcblxuICByZW1vdmVEcmFnRWxlbWVudHMocyk7XG5cbiAgcy5kcmFnZ2FibGUuY3VycmVudCA9IHVuZGVmaW5lZDtcbiAgcy5kb20ucmVkcmF3KCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYW5jZWwoczogU3RhdGUpOiB2b2lkIHtcbiAgY29uc3QgY3VyID0gcy5kcmFnZ2FibGUuY3VycmVudDtcbiAgaWYgKGN1cikge1xuICAgIGlmIChjdXIubmV3UGllY2UpIGRlbGV0ZSBzLnBpZWNlc1tjdXIub3JpZ107XG4gICAgcy5kcmFnZ2FibGUuY3VycmVudCA9IHVuZGVmaW5lZDtcbiAgICBib2FyZC51bnNlbGVjdChzKTtcbiAgICByZW1vdmVEcmFnRWxlbWVudHMocyk7XG4gICAgcy5kb20ucmVkcmF3KCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlRHJhZ0VsZW1lbnRzKHM6IFN0YXRlKSB7XG4gIGNvbnN0IGUgPSBzLmRvbS5lbGVtZW50cztcbiAgaWYgKGUuZ2hvc3QpIHV0aWwuc2V0VmlzaWJsZShlLmdob3N0LCBmYWxzZSk7XG59XG5cbmZ1bmN0aW9uIGNvbXB1dGVTcXVhcmVCb3VuZHMoa2V5OiBjZy5LZXksIGFzV2hpdGU6IGJvb2xlYW4sIGJvdW5kczogQ2xpZW50UmVjdCwgYmQ6IGNnLkJvYXJkRGltZW5zaW9ucykge1xuICBjb25zdCBmaXJzdFJhbmtJczAgPSBiZC5oZWlnaHQgPT09IDEwO1xuICBjb25zdCBwb3MgPSB1dGlsLmtleTJwb3Moa2V5LCBmaXJzdFJhbmtJczApO1xuICBpZiAoIWFzV2hpdGUpIHtcbiAgICBwb3NbMF0gPSBiZC53aWR0aCArIDEgLSBwb3NbMF07XG4gICAgcG9zWzFdID0gYmQuaGVpZ2h0ICsgMSAtIHBvc1sxXTtcbiAgfVxuICByZXR1cm4ge1xuICAgIGxlZnQ6IGJvdW5kcy5sZWZ0ICsgYm91bmRzLndpZHRoICogKHBvc1swXSAtIDEpIC8gYmQud2lkdGgsXG4gICAgdG9wOiBib3VuZHMudG9wICsgYm91bmRzLmhlaWdodCAqIChiZC5oZWlnaHQgLSBwb3NbMV0pIC8gYmQuaGVpZ2h0LFxuICAgIHdpZHRoOiBib3VuZHMud2lkdGggLyBiZC53aWR0aCxcbiAgICBoZWlnaHQ6IGJvdW5kcy5oZWlnaHQgLyBiZC5oZWlnaHRcbiAgfTtcbn1cblxuZnVuY3Rpb24gcGllY2VFbGVtZW50QnlLZXkoczogU3RhdGUsIGtleTogY2cuS2V5KTogY2cuUGllY2VOb2RlIHwgdW5kZWZpbmVkIHtcbiAgbGV0IGVsID0gcy5kb20uZWxlbWVudHMuYm9hcmQuZmlyc3RDaGlsZCBhcyBjZy5QaWVjZU5vZGU7XG4gIHdoaWxlIChlbCkge1xuICAgIGlmIChlbC5jZ0tleSA9PT0ga2V5ICYmIGVsLnRhZ05hbWUgPT09ICdQSUVDRScpIHJldHVybiBlbDtcbiAgICBlbCA9IGVsLm5leHRTaWJsaW5nIGFzIGNnLlBpZWNlTm9kZTtcbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xuaW1wb3J0IHsgdW5zZWxlY3QsIGNhbmNlbE1vdmUsIGdldEtleUF0RG9tUG9zLCB3aGl0ZVBvdiB9IGZyb20gJy4vYm9hcmQnXG5pbXBvcnQgeyBldmVudFBvc2l0aW9uLCBpc1JpZ2h0QnV0dG9uIH0gZnJvbSAnLi91dGlsJ1xuaW1wb3J0ICogYXMgY2cgZnJvbSAnLi90eXBlcydcblxuZXhwb3J0IGludGVyZmFjZSBEcmF3U2hhcGUge1xuICBvcmlnOiBjZy5LZXk7XG4gIGRlc3Q/OiBjZy5LZXk7XG4gIGJydXNoOiBzdHJpbmc7XG4gIG1vZGlmaWVycz86IERyYXdNb2RpZmllcnM7XG4gIHBpZWNlPzogRHJhd1NoYXBlUGllY2U7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRHJhd1NoYXBlUGllY2Uge1xuICByb2xlOiBjZy5Sb2xlO1xuICBjb2xvcjogY2cuQ29sb3I7XG4gIHNjYWxlPzogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERyYXdCcnVzaCB7XG4gIGtleTogc3RyaW5nO1xuICBjb2xvcjogc3RyaW5nO1xuICBvcGFjaXR5OiBudW1iZXI7XG4gIGxpbmVXaWR0aDogbnVtYmVyXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRHJhd0JydXNoZXMge1xuICBbbmFtZTogc3RyaW5nXTogRHJhd0JydXNoO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERyYXdNb2RpZmllcnMge1xuICBsaW5lV2lkdGg/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRHJhd2FibGUge1xuICBlbmFibGVkOiBib29sZWFuOyAvLyBjYW4gZHJhd1xuICB2aXNpYmxlOiBib29sZWFuOyAvLyBjYW4gdmlld1xuICBlcmFzZU9uQ2xpY2s6IGJvb2xlYW47XG4gIG9uQ2hhbmdlPzogKHNoYXBlczogRHJhd1NoYXBlW10pID0+IHZvaWQ7XG4gIHNoYXBlczogRHJhd1NoYXBlW107IC8vIHVzZXIgc2hhcGVzXG4gIGF1dG9TaGFwZXM6IERyYXdTaGFwZVtdOyAvLyBjb21wdXRlciBzaGFwZXNcbiAgY3VycmVudD86IERyYXdDdXJyZW50O1xuICBicnVzaGVzOiBEcmF3QnJ1c2hlcztcbiAgLy8gZHJhd2FibGUgU1ZHIHBpZWNlczsgdXNlZCBmb3IgY3Jhenlob3VzZSBkcm9wXG4gIHBpZWNlczoge1xuICAgIGJhc2VVcmw6IHN0cmluZ1xuICB9LFxuICBwcmV2U3ZnSGFzaDogc3RyaW5nXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRHJhd0N1cnJlbnQge1xuICBvcmlnOiBjZy5LZXk7IC8vIG9yaWcga2V5IG9mIGRyYXdpbmdcbiAgZGVzdD86IGNnLktleTsgLy8gc2hhcGUgZGVzdCwgb3IgdW5kZWZpbmVkIGZvciBjaXJjbGVcbiAgbW91c2VTcT86IGNnLktleTsgLy8gc3F1YXJlIGJlaW5nIG1vdXNlZCBvdmVyXG4gIHBvczogY2cuTnVtYmVyUGFpcjsgLy8gcmVsYXRpdmUgY3VycmVudCBwb3NpdGlvblxuICBicnVzaDogc3RyaW5nOyAvLyBicnVzaCBuYW1lIGZvciBzaGFwZVxufVxuXG5jb25zdCBicnVzaGVzID0gWydncmVlbicsICdyZWQnLCAnYmx1ZScsICd5ZWxsb3cnXTtcblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0KHN0YXRlOiBTdGF0ZSwgZTogY2cuTW91Y2hFdmVudCk6IHZvaWQge1xuICBpZiAoZS50b3VjaGVzICYmIGUudG91Y2hlcy5sZW5ndGggPiAxKSByZXR1cm47IC8vIHN1cHBvcnQgb25lIGZpbmdlciB0b3VjaCBvbmx5XG4gIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIGUucHJldmVudERlZmF1bHQoKTtcbiAgZS5jdHJsS2V5ID8gdW5zZWxlY3Qoc3RhdGUpIDogY2FuY2VsTW92ZShzdGF0ZSk7XG4gIGNvbnN0IHBvcyA9IGV2ZW50UG9zaXRpb24oZSkgYXMgY2cuTnVtYmVyUGFpcixcbiAgb3JpZyA9IGdldEtleUF0RG9tUG9zKHBvcywgd2hpdGVQb3Yoc3RhdGUpLCBzdGF0ZS5kb20uYm91bmRzKCksIHN0YXRlLmdlb21ldHJ5KTtcbiAgaWYgKCFvcmlnKSByZXR1cm47XG4gIHN0YXRlLmRyYXdhYmxlLmN1cnJlbnQgPSB7XG4gICAgb3JpZyxcbiAgICBwb3MsXG4gICAgYnJ1c2g6IGV2ZW50QnJ1c2goZSlcbiAgfTtcbiAgcHJvY2Vzc0RyYXcoc3RhdGUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvY2Vzc0RyYXcoc3RhdGU6IFN0YXRlKTogdm9pZCB7XG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgY29uc3QgY3VyID0gc3RhdGUuZHJhd2FibGUuY3VycmVudDtcbiAgICBpZiAoY3VyKSB7XG4gICAgICBjb25zdCBtb3VzZVNxID0gZ2V0S2V5QXREb21Qb3MoY3VyLnBvcywgd2hpdGVQb3Yoc3RhdGUpLCBzdGF0ZS5kb20uYm91bmRzKCksIHN0YXRlLmdlb21ldHJ5KTtcbiAgICAgIGlmIChtb3VzZVNxICE9PSBjdXIubW91c2VTcSkge1xuICAgICAgICBjdXIubW91c2VTcSA9IG1vdXNlU3E7XG4gICAgICAgIGN1ci5kZXN0ID0gbW91c2VTcSAhPT0gY3VyLm9yaWcgPyBtb3VzZVNxIDogdW5kZWZpbmVkO1xuICAgICAgICBzdGF0ZS5kb20ucmVkcmF3Tm93KCk7XG4gICAgICB9XG4gICAgICBwcm9jZXNzRHJhdyhzdGF0ZSk7XG4gICAgfVxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1vdmUoc3RhdGU6IFN0YXRlLCBlOiBjZy5Nb3VjaEV2ZW50KTogdm9pZCB7XG4gIGlmIChzdGF0ZS5kcmF3YWJsZS5jdXJyZW50KSBzdGF0ZS5kcmF3YWJsZS5jdXJyZW50LnBvcyA9IGV2ZW50UG9zaXRpb24oZSkgYXMgY2cuTnVtYmVyUGFpcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVuZChzdGF0ZTogU3RhdGUpOiB2b2lkIHtcbiAgY29uc3QgY3VyID0gc3RhdGUuZHJhd2FibGUuY3VycmVudDtcbiAgaWYgKGN1cikge1xuICAgIGlmIChjdXIubW91c2VTcSkgYWRkU2hhcGUoc3RhdGUuZHJhd2FibGUsIGN1cik7XG4gICAgY2FuY2VsKHN0YXRlKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY2FuY2VsKHN0YXRlOiBTdGF0ZSk6IHZvaWQge1xuICBpZiAoc3RhdGUuZHJhd2FibGUuY3VycmVudCkge1xuICAgIHN0YXRlLmRyYXdhYmxlLmN1cnJlbnQgPSB1bmRlZmluZWQ7XG4gICAgc3RhdGUuZG9tLnJlZHJhdygpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGVhcihzdGF0ZTogU3RhdGUpOiB2b2lkIHtcbiAgaWYgKHN0YXRlLmRyYXdhYmxlLnNoYXBlcy5sZW5ndGgpIHtcbiAgICBzdGF0ZS5kcmF3YWJsZS5zaGFwZXMgPSBbXTtcbiAgICBzdGF0ZS5kb20ucmVkcmF3KCk7XG4gICAgb25DaGFuZ2Uoc3RhdGUuZHJhd2FibGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGV2ZW50QnJ1c2goZTogY2cuTW91Y2hFdmVudCk6IHN0cmluZyB7XG4gIHJldHVybiBicnVzaGVzWyhlLnNoaWZ0S2V5ICYmIGlzUmlnaHRCdXR0b24oZSkgPyAxIDogMCkgKyAoZS5hbHRLZXkgPyAyIDogMCldO1xufVxuXG5mdW5jdGlvbiBhZGRTaGFwZShkcmF3YWJsZTogRHJhd2FibGUsIGN1cjogRHJhd0N1cnJlbnQpOiB2b2lkIHtcbiAgY29uc3Qgc2FtZVNoYXBlID0gKHM6IERyYXdTaGFwZSkgPT4gcy5vcmlnID09PSBjdXIub3JpZyAmJiBzLmRlc3QgPT09IGN1ci5kZXN0O1xuICBjb25zdCBzaW1pbGFyID0gZHJhd2FibGUuc2hhcGVzLmZpbHRlcihzYW1lU2hhcGUpWzBdO1xuICBpZiAoc2ltaWxhcikgZHJhd2FibGUuc2hhcGVzID0gZHJhd2FibGUuc2hhcGVzLmZpbHRlcihzID0+ICFzYW1lU2hhcGUocykpO1xuICBpZiAoIXNpbWlsYXIgfHwgc2ltaWxhci5icnVzaCAhPT0gY3VyLmJydXNoKSBkcmF3YWJsZS5zaGFwZXMucHVzaChjdXIpO1xuICBvbkNoYW5nZShkcmF3YWJsZSk7XG59XG5cbmZ1bmN0aW9uIG9uQ2hhbmdlKGRyYXdhYmxlOiBEcmF3YWJsZSk6IHZvaWQge1xuICBpZiAoZHJhd2FibGUub25DaGFuZ2UpIGRyYXdhYmxlLm9uQ2hhbmdlKGRyYXdhYmxlLnNoYXBlcyk7XG59XG4iLCJpbXBvcnQgeyBTdGF0ZSB9IGZyb20gJy4vc3RhdGUnXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJ1xuaW1wb3J0ICogYXMgYm9hcmQgZnJvbSAnLi9ib2FyZCdcbmltcG9ydCAqIGFzIHV0aWwgZnJvbSAnLi91dGlsJ1xuaW1wb3J0IHsgY2FuY2VsIGFzIGNhbmNlbERyYWcgfSBmcm9tICcuL2RyYWcnXG5cbmV4cG9ydCBmdW5jdGlvbiBzZXREcm9wTW9kZShzOiBTdGF0ZSwgcGllY2U/OiBjZy5QaWVjZSk6IHZvaWQge1xuICBzLmRyb3Btb2RlID0ge1xuICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICBwaWVjZVxuICB9O1xuICBjYW5jZWxEcmFnKHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2FuY2VsRHJvcE1vZGUoczogU3RhdGUpOiB2b2lkIHtcbiAgcy5kcm9wbW9kZSA9IHtcbiAgICBhY3RpdmU6IGZhbHNlXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkcm9wKHM6IFN0YXRlLCBlOiBjZy5Nb3VjaEV2ZW50KTogdm9pZCB7XG4gIGlmICghcy5kcm9wbW9kZS5hY3RpdmUpIHJldHVybjtcblxuICBib2FyZC51bnNldFByZW1vdmUocyk7XG4gIGJvYXJkLnVuc2V0UHJlZHJvcChzKTtcblxuICBjb25zdCBwaWVjZSA9IHMuZHJvcG1vZGUucGllY2U7XG5cbiAgaWYgKHBpZWNlKSB7XG4gICAgcy5waWVjZXMuejAgPSBwaWVjZTtcbiAgICBjb25zdCBwb3NpdGlvbiA9IHV0aWwuZXZlbnRQb3NpdGlvbihlKTtcbiAgICBjb25zdCBkZXN0ID0gcG9zaXRpb24gJiYgYm9hcmQuZ2V0S2V5QXREb21Qb3MoXG4gICAgICBwb3NpdGlvbiwgYm9hcmQud2hpdGVQb3YocyksIHMuZG9tLmJvdW5kcygpLCBzLmdlb21ldHJ5KTtcbiAgICBpZiAoZGVzdCkgYm9hcmQuZHJvcE5ld1BpZWNlKHMsICd6MCcsIGRlc3QpO1xuICB9XG4gIHMuZG9tLnJlZHJhdygpO1xufVxuIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xuaW1wb3J0ICogYXMgZHJhZyBmcm9tICcuL2RyYWcnXG5pbXBvcnQgKiBhcyBkcmF3IGZyb20gJy4vZHJhdydcbmltcG9ydCB7IGRyb3AgfSBmcm9tICcuL2Ryb3AnXG5pbXBvcnQgeyBpc1JpZ2h0QnV0dG9uIH0gZnJvbSAnLi91dGlsJ1xuaW1wb3J0ICogYXMgY2cgZnJvbSAnLi90eXBlcydcblxudHlwZSBNb3VjaEJpbmQgPSAoZTogY2cuTW91Y2hFdmVudCkgPT4gdm9pZDtcbnR5cGUgU3RhdGVNb3VjaEJpbmQgPSAoZDogU3RhdGUsIGU6IGNnLk1vdWNoRXZlbnQpID0+IHZvaWQ7XG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kQm9hcmQoczogU3RhdGUpOiB2b2lkIHtcblxuICBpZiAocy52aWV3T25seSkgcmV0dXJuO1xuXG4gIGNvbnN0IGJvYXJkRWwgPSBzLmRvbS5lbGVtZW50cy5ib2FyZCxcbiAgb25TdGFydCA9IHN0YXJ0RHJhZ09yRHJhdyhzKTtcblxuICAvLyBDYW5ub3QgYmUgcGFzc2l2ZSwgYmVjYXVzZSB3ZSBwcmV2ZW50IHRvdWNoIHNjcm9sbGluZyBhbmQgZHJhZ2dpbmcgb2ZcbiAgLy8gc2VsZWN0ZWQgZWxlbWVudHMuXG4gIGJvYXJkRWwuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIG9uU3RhcnQgYXMgRXZlbnRMaXN0ZW5lciwgeyBwYXNzaXZlOiBmYWxzZSB9KTtcbiAgYm9hcmRFbC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBvblN0YXJ0IGFzIEV2ZW50TGlzdGVuZXIsIHsgcGFzc2l2ZTogZmFsc2UgfSk7XG5cbiAgaWYgKHMuZGlzYWJsZUNvbnRleHRNZW51IHx8IHMuZHJhd2FibGUuZW5hYmxlZCkge1xuICAgIGJvYXJkRWwuYWRkRXZlbnRMaXN0ZW5lcignY29udGV4dG1lbnUnLCBlID0+IGUucHJldmVudERlZmF1bHQoKSk7XG4gIH1cbn1cblxuLy8gcmV0dXJucyB0aGUgdW5iaW5kIGZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gYmluZERvY3VtZW50KHM6IFN0YXRlLCByZWRyYXdBbGw6IGNnLlJlZHJhdyk6IGNnLlVuYmluZCB7XG5cbiAgY29uc3QgdW5iaW5kczogY2cuVW5iaW5kW10gPSBbXTtcblxuICBpZiAoIXMuZG9tLnJlbGF0aXZlICYmIHMucmVzaXphYmxlKSB7XG4gICAgY29uc3Qgb25SZXNpemUgPSAoKSA9PiB7XG4gICAgICBzLmRvbS5ib3VuZHMuY2xlYXIoKTtcbiAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShyZWRyYXdBbGwpO1xuICAgIH07XG4gICAgdW5iaW5kcy5wdXNoKHVuYmluZGFibGUoZG9jdW1lbnQuYm9keSwgJ2NoZXNzZ3JvdW5kLnJlc2l6ZScsIG9uUmVzaXplKSk7XG4gIH1cblxuICBpZiAoIXMudmlld09ubHkpIHtcblxuICAgIGNvbnN0IG9ubW92ZTogTW91Y2hCaW5kID0gZHJhZ09yRHJhdyhzLCBkcmFnLm1vdmUsIGRyYXcubW92ZSk7XG4gICAgY29uc3Qgb25lbmQ6IE1vdWNoQmluZCA9IGRyYWdPckRyYXcocywgZHJhZy5lbmQsIGRyYXcuZW5kKTtcblxuICAgIFsndG91Y2htb3ZlJywgJ21vdXNlbW92ZSddLmZvckVhY2goZXYgPT4gdW5iaW5kcy5wdXNoKHVuYmluZGFibGUoZG9jdW1lbnQsIGV2LCBvbm1vdmUpKSk7XG4gICAgWyd0b3VjaGVuZCcsICdtb3VzZXVwJ10uZm9yRWFjaChldiA9PiB1bmJpbmRzLnB1c2godW5iaW5kYWJsZShkb2N1bWVudCwgZXYsIG9uZW5kKSkpO1xuXG4gICAgY29uc3Qgb25TY3JvbGwgPSAoKSA9PiBzLmRvbS5ib3VuZHMuY2xlYXIoKTtcbiAgICB1bmJpbmRzLnB1c2godW5iaW5kYWJsZSh3aW5kb3csICdzY3JvbGwnLCBvblNjcm9sbCwgeyBwYXNzaXZlOiB0cnVlIH0pKTtcbiAgICB1bmJpbmRzLnB1c2godW5iaW5kYWJsZSh3aW5kb3csICdyZXNpemUnLCBvblNjcm9sbCwgeyBwYXNzaXZlOiB0cnVlIH0pKTtcbiAgfVxuXG4gIHJldHVybiAoKSA9PiB1bmJpbmRzLmZvckVhY2goZiA9PiBmKCkpO1xufVxuXG5mdW5jdGlvbiB1bmJpbmRhYmxlKGVsOiBFdmVudFRhcmdldCwgZXZlbnROYW1lOiBzdHJpbmcsIGNhbGxiYWNrOiBNb3VjaEJpbmQsIG9wdGlvbnM/OiBhbnkpOiBjZy5VbmJpbmQge1xuICBlbC5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgY2FsbGJhY2sgYXMgRXZlbnRMaXN0ZW5lciwgb3B0aW9ucyk7XG4gIHJldHVybiAoKSA9PiBlbC5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgY2FsbGJhY2sgYXMgRXZlbnRMaXN0ZW5lcik7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0RHJhZ09yRHJhdyhzOiBTdGF0ZSk6IE1vdWNoQmluZCB7XG4gIHJldHVybiBlID0+IHtcbiAgICBpZiAocy5kcmFnZ2FibGUuY3VycmVudCkgZHJhZy5jYW5jZWwocyk7XG4gICAgZWxzZSBpZiAocy5kcmF3YWJsZS5jdXJyZW50KSBkcmF3LmNhbmNlbChzKTtcbiAgICBlbHNlIGlmIChlLnNoaWZ0S2V5IHx8IGlzUmlnaHRCdXR0b24oZSkpIHsgaWYgKHMuZHJhd2FibGUuZW5hYmxlZCkgZHJhdy5zdGFydChzLCBlKTsgfVxuICAgIGVsc2UgaWYgKCFzLnZpZXdPbmx5KSB7XG4gICAgICBpZiAocy5kcm9wbW9kZS5hY3RpdmUpIGRyb3AocywgZSk7XG4gICAgICBlbHNlIGRyYWcuc3RhcnQocywgZSk7XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBkcmFnT3JEcmF3KHM6IFN0YXRlLCB3aXRoRHJhZzogU3RhdGVNb3VjaEJpbmQsIHdpdGhEcmF3OiBTdGF0ZU1vdWNoQmluZCk6IE1vdWNoQmluZCB7XG4gIHJldHVybiBlID0+IHtcbiAgICBpZiAoZS5zaGlmdEtleSB8fCBpc1JpZ2h0QnV0dG9uKGUpKSB7IGlmIChzLmRyYXdhYmxlLmVuYWJsZWQpIHdpdGhEcmF3KHMsIGUpOyB9XG4gICAgZWxzZSBpZiAoIXMudmlld09ubHkpIHdpdGhEcmFnKHMsIGUpO1xuICB9O1xufVxuIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xuaW1wb3J0IHsgS2V5IH0gZnJvbSAnLi90eXBlcydcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZXhwbG9zaW9uKHN0YXRlOiBTdGF0ZSwga2V5czogS2V5W10pOiB2b2lkIHtcbiAgc3RhdGUuZXhwbG9kaW5nID0geyBzdGFnZTogMSwga2V5cyB9O1xuICBzdGF0ZS5kb20ucmVkcmF3KCk7XG4gIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIHNldFN0YWdlKHN0YXRlLCAyKTtcbiAgICBzZXRUaW1lb3V0KCgpID0+IHNldFN0YWdlKHN0YXRlLCB1bmRlZmluZWQpLCAxMjApO1xuICB9LCAxMjApO1xufVxuXG5mdW5jdGlvbiBzZXRTdGFnZShzdGF0ZTogU3RhdGUsIHN0YWdlOiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcbiAgaWYgKHN0YXRlLmV4cGxvZGluZykge1xuICAgIGlmIChzdGFnZSkgc3RhdGUuZXhwbG9kaW5nLnN0YWdlID0gc3RhZ2U7XG4gICAgZWxzZSBzdGF0ZS5leHBsb2RpbmcgPSB1bmRlZmluZWQ7XG4gICAgc3RhdGUuZG9tLnJlZHJhdygpO1xuICB9XG59XG4iLCJpbXBvcnQgeyBwb3Mya2V5LCBOUmFua3MsIGludk5SYW5rcyB9IGZyb20gJy4vdXRpbCdcbmltcG9ydCAqIGFzIGNnIGZyb20gJy4vdHlwZXMnXG5cbmV4cG9ydCBjb25zdCBpbml0aWFsOiBjZy5GRU4gPSAncm5icWtibnIvcHBwcHBwcHAvOC84LzgvOC9QUFBQUFBQUC9STkJRS0JOUic7XG5cbmNvbnN0IHJvbGVzODogeyBbbGV0dGVyOiBzdHJpbmddOiBjZy5Sb2xlIH0gPSB7XG4gICAgcDogJ3Bhd24nLCByOiAncm9vaycsIG46ICdrbmlnaHQnLCBiOiAnYmlzaG9wJywgcTogJ3F1ZWVuJywgazogJ2tpbmcnLCBtOiAnbWV0JywgZjogJ2ZlcnonLCBzOiAnc2lsdmVyJywgYzogJ2NhbmNlbGxvcicsIGE6ICdhcmNoYmlzaG9wJywgaDogJ2hhd2snLCBlOiAnZWxlcGhhbnQnIH07XG4vLyBzaG9naVxuY29uc3Qgcm9sZXM5OiB7IFtsZXR0ZXI6IHN0cmluZ106IGNnLlJvbGUgfSA9IHtcbiAgICBwOiAncGF3bicsIHI6ICdyb29rJywgbjogJ2tuaWdodCcsIGI6ICdiaXNob3AnLCBrOiAna2luZycsIGc6ICdnb2xkJywgczogJ3NpbHZlcicsIGw6ICdsYW5jZScgfTtcbi8vIHhpYW5ncWlcbmNvbnN0IHJvbGVzMTA6IHsgW2xldHRlcjogc3RyaW5nXTogY2cuUm9sZSB9ID0ge1xuICAgIHA6ICdwYXduJywgcjogJ3Jvb2snLCBuOiAna25pZ2h0JywgYjogJ2Jpc2hvcCcsIGs6ICdraW5nJywgYzogJ2Nhbm5vbicsIGE6ICdhZHZpc29yJyB9O1xuXG5cbmNvbnN0IGxldHRlcnM4ID0ge1xuICAgIHBhd246ICdwJywgcm9vazogJ3InLCBrbmlnaHQ6ICduJywgYmlzaG9wOiAnYicsIHF1ZWVuOiAncScsIGtpbmc6ICdrJywgbWV0OiAnbScsIGZlcno6ICdmJywgc2lsdmVyOiAncycsIGNhbmNlbGxvcjogJ2MnLCBhcmNoYmlzaG9wOiAnYScsIGhhd2s6ICdoJywgZWxlcGhhbnQ6ICdlJyB9O1xuLy8gc2hvZ2lcbmNvbnN0IGxldHRlcnM5ID0ge1xuICAgIHBhd246ICdwJywgcm9vazogJ3InLCBrbmlnaHQ6ICduJywgYmlzaG9wOiAnYicsIGtpbmc6ICdrJywgZ29sZDogJ2cnLCBzaWx2ZXI6ICdzJywgbGFuY2U6ICdsJyxcbiAgICBwcGF3bjogJytwJywgcGtuaWdodDogJytuJywgcGJpc2hvcDogJytiJywgcHJvb2s6ICcrcicsIHBzaWx2ZXI6ICcrcycsIHBsYW5jZTogJytsJyB9O1xuLy8geGlhbmdxaVxuY29uc3QgbGV0dGVyczEwID0ge1xuICAgIHBhd246ICdwJywgcm9vazogJ3InLCBrbmlnaHQ6ICduJywgYmlzaG9wOiAnYicsIGtpbmc6ICdrJywgY2Fubm9uOiAnYycsIGFkdmlzb3I6ICdhJ307XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkKGZlbjogY2cuRkVOLCBnZW9tOiBjZy5HZW9tZXRyeSk6IGNnLlBpZWNlcyB7XG4gIGlmIChmZW4gPT09ICdzdGFydCcpIGZlbiA9IGluaXRpYWw7XG4gIGlmIChmZW4uaW5kZXhPZignWycpICE9PSAtMSkgZmVuID0gZmVuLnNsaWNlKDAsIGZlbi5pbmRleE9mKCdbJykpO1xuICBjb25zdCBwaWVjZXM6IGNnLlBpZWNlcyA9IHt9O1xuICBsZXQgcm93OiBudW1iZXIgPSBmZW4uc3BsaXQoXCIvXCIpLmxlbmd0aDtcbiAgbGV0IGNvbDogbnVtYmVyID0gMDtcbiAgbGV0IHByb21vdGVkOiBib29sZWFuID0gZmFsc2U7XG4gIGNvbnN0IHJvbGVzID0gKGdlb20gPT09IGNnLkdlb21ldHJ5LmRpbTl4MTApID8gcm9sZXMxMCA6IChnZW9tID09PSBjZy5HZW9tZXRyeS5kaW05eDkpID8gcm9sZXM5IDogcm9sZXM4O1xuICBjb25zdCBmaXJzdFJhbmtJczAgPSByb3cgPT09IDEwO1xuICBjb25zdCBzaG9naSA9IHJvdyA9PT0gOTtcbiAgZm9yIChjb25zdCBjIG9mIGZlbikge1xuICAgIHN3aXRjaCAoYykge1xuICAgICAgY2FzZSAnICc6IHJldHVybiBwaWVjZXM7XG4gICAgICBjYXNlICcvJzpcbiAgICAgICAgLS1yb3c7XG4gICAgICAgIGlmIChyb3cgPT09IDApIHJldHVybiBwaWVjZXM7XG4gICAgICAgIGNvbCA9IDA7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnKyc6XG4gICAgICAgIHByb21vdGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd+JzpcbiAgICAgICAgY29uc3QgcGllY2UgPSBwaWVjZXNbY2cuZmlsZXNbY29sXSArIGNnLnJhbmtzW2ZpcnN0UmFua0lzMCA/IHJvdyA6IHJvdyArIDFdXTtcbiAgICAgICAgaWYgKHBpZWNlKSBwaWVjZS5wcm9tb3RlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgY29uc3QgbmIgPSBjLmNoYXJDb2RlQXQoMCk7XG4gICAgICAgIGlmIChuYiA8IDU4KSBjb2wgKz0gKGMgPT09ICcwJykgPyA5IDogbmIgLSA0ODtcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgKytjb2w7XG4gICAgICAgICAgY29uc3Qgcm9sZSA9IGMudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICBsZXQgcGllY2UgPSB7XG4gICAgICAgICAgICByb2xlOiByb2xlc1tyb2xlXSxcbiAgICAgICAgICAgIGNvbG9yOiAoYyA9PT0gcm9sZSA/IHNob2dpID8gJ3doaXRlJzogJ2JsYWNrJyA6IHNob2dpID8gJ2JsYWNrJyA6ICd3aGl0ZScpIGFzIGNnLkNvbG9yXG4gICAgICAgICAgfSBhcyBjZy5QaWVjZTtcbiAgICAgICAgICBpZiAocHJvbW90ZWQpIHtcbiAgICAgICAgICAgIHBpZWNlLnJvbGUgPSAncCcgKyBwaWVjZS5yb2xlIGFzIGNnLlJvbGU7XG4gICAgICAgICAgICBwaWVjZS5wcm9tb3RlZCA9IHRydWU7XG4gICAgICAgICAgICBwcm9tb3RlZCA9IGZhbHNlO1xuICAgICAgICAgIH07XG4gICAgICAgICAgaWYgKHNob2dpKSB7XG4gICAgICAgICAgICAgIHBpZWNlc1tjZy5maWxlc1sxMCAtIGNvbCAtIDFdICsgY2cucmFua3NbMTAgLSByb3ddXSA9IHBpZWNlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBpZWNlc1tjZy5maWxlc1tjb2wgLSAxXSArIGNnLnJhbmtzW2ZpcnN0UmFua0lzMCA/IHJvdyAtIDEgOiByb3ddXSA9IHBpZWNlO1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHBpZWNlcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlKHBpZWNlczogY2cuUGllY2VzLCBnZW9tOiBjZy5HZW9tZXRyeSk6IGNnLkZFTiB7XG4gIHZhciBsZXR0ZXJzOiBhbnkgPSB7fTtcbiAgc3dpdGNoIChnZW9tKSB7XG4gIGNhc2UgY2cuR2VvbWV0cnkuZGltOXgxMDpcbiAgICBsZXR0ZXJzID0gbGV0dGVyczEwO1xuICAgIGJyZWFrO1xuICBjYXNlIGNnLkdlb21ldHJ5LmRpbTl4OTpcbiAgICBsZXR0ZXJzID0gbGV0dGVyczk7XG4gICAgYnJlYWs7XG4gIGRlZmF1bHQ6XG4gICAgbGV0dGVycyA9IGxldHRlcnM4O1xuICAgIGJyZWFrXG4gIH07XG4gIHJldHVybiBpbnZOUmFua3MubWFwKHkgPT4gTlJhbmtzLm1hcCh4ID0+IHtcbiAgICAgIGNvbnN0IHBpZWNlID0gcGllY2VzW3BvczJrZXkoW3gsIHldLCBnZW9tKV07XG4gICAgICBpZiAocGllY2UpIHtcbiAgICAgICAgY29uc3QgbGV0dGVyOiBzdHJpbmcgPSBsZXR0ZXJzW3BpZWNlLnJvbGVdO1xuICAgICAgICByZXR1cm4gcGllY2UuY29sb3IgPT09ICd3aGl0ZScgPyBsZXR0ZXIudG9VcHBlckNhc2UoKSA6IGxldHRlcjtcbiAgICAgIH0gZWxzZSByZXR1cm4gJzEnO1xuICAgIH0pLmpvaW4oJycpXG4gICkuam9pbignLycpLnJlcGxhY2UoLzF7Mix9L2csIHMgPT4gcy5sZW5ndGgudG9TdHJpbmcoKSk7XG59XG4iLCJpbXBvcnQgKiBhcyB1dGlsIGZyb20gJy4vdXRpbCdcbmltcG9ydCAqIGFzIGNnIGZyb20gJy4vdHlwZXMnXG5cbnR5cGUgTW9iaWxpdHkgPSAoeDE6bnVtYmVyLCB5MTpudW1iZXIsIHgyOm51bWJlciwgeTI6bnVtYmVyKSA9PiBib29sZWFuO1xuXG5mdW5jdGlvbiBkaWZmKGE6IG51bWJlciwgYjpudW1iZXIpOm51bWJlciB7XG4gIHJldHVybiBNYXRoLmFicyhhIC0gYik7XG59XG5cbmZ1bmN0aW9uIHBhd24oY29sb3I6IGNnLkNvbG9yKTogTW9iaWxpdHkge1xuICByZXR1cm4gKHgxLCB5MSwgeDIsIHkyKSA9PiBkaWZmKHgxLCB4MikgPCAyICYmIChcbiAgICBjb2xvciA9PT0gJ3doaXRlJyA/IChcbiAgICAgIC8vIGFsbG93IDIgc3F1YXJlcyBmcm9tIDEgYW5kIDgsIGZvciBob3JkZVxuICAgICAgeTIgPT09IHkxICsgMSB8fCAoeTEgPD0gMiAmJiB5MiA9PT0gKHkxICsgMikgJiYgeDEgPT09IHgyKVxuICAgICkgOiAoXG4gICAgICB5MiA9PT0geTEgLSAxIHx8ICh5MSA+PSA3ICYmIHkyID09PSAoeTEgLSAyKSAmJiB4MSA9PT0geDIpXG4gICAgKVxuICApO1xufVxuXG5jb25zdCBrbmlnaHQ6IE1vYmlsaXR5ID0gKHgxLCB5MSwgeDIsIHkyKSA9PiB7XG4gIGNvbnN0IHhkID0gZGlmZih4MSwgeDIpO1xuICBjb25zdCB5ZCA9IGRpZmYoeTEsIHkyKTtcbiAgcmV0dXJuICh4ZCA9PT0gMSAmJiB5ZCA9PT0gMikgfHwgKHhkID09PSAyICYmIHlkID09PSAxKTtcbn1cblxuY29uc3QgYmlzaG9wOiBNb2JpbGl0eSA9ICh4MSwgeTEsIHgyLCB5MikgPT4ge1xuICByZXR1cm4gZGlmZih4MSwgeDIpID09PSBkaWZmKHkxLCB5Mik7XG59XG5cbmNvbnN0IHJvb2s6IE1vYmlsaXR5ID0gKHgxLCB5MSwgeDIsIHkyKSA9PiB7XG4gIHJldHVybiB4MSA9PT0geDIgfHwgeTEgPT09IHkyO1xufVxuXG5jb25zdCBxdWVlbjogTW9iaWxpdHkgPSAoeDEsIHkxLCB4MiwgeTIpID0+IHtcbiAgcmV0dXJuIGJpc2hvcCh4MSwgeTEsIHgyLCB5MikgfHwgcm9vayh4MSwgeTEsIHgyLCB5Mik7XG59XG5cbmZ1bmN0aW9uIGtpbmcoY29sb3I6IGNnLkNvbG9yLCByb29rRmlsZXM6IG51bWJlcltdLCBjYW5DYXN0bGU6IGJvb2xlYW4pOiBNb2JpbGl0eSB7XG4gIHJldHVybiAoeDEsIHkxLCB4MiwgeTIpICA9PiAoXG4gICAgZGlmZih4MSwgeDIpIDwgMiAmJiBkaWZmKHkxLCB5MikgPCAyXG4gICkgfHwgKFxuICAgIGNhbkNhc3RsZSAmJiB5MSA9PT0geTIgJiYgeTEgPT09IChjb2xvciA9PT0gJ3doaXRlJyA/IDEgOiA4KSAmJiAoXG4gICAgICAoeDEgPT09IDUgJiYgKHgyID09PSAzIHx8IHgyID09PSA3KSkgfHwgdXRpbC5jb250YWluc1gocm9va0ZpbGVzLCB4MilcbiAgICApXG4gICk7XG59XG5cbi8vIG1ha3J1ay9zaXR0dXlpbiBxdWVlblxuY29uc3QgbWV0OiBNb2JpbGl0eSA9ICh4MSwgeTEsIHgyLCB5MikgPT4ge1xuICByZXR1cm4gZGlmZih4MSwgeDIpID09PSBkaWZmKHkxLCB5MikgJiYgZGlmZih4MSwgeDIpID09PSAxO1xufVxuXG4vLyBjYXBhYmxhbmNhIGFyY2hiaXNob3AsIHNlaXJhd2FuIGhhd2tcbmNvbnN0IGFyY2hiaXNob3A6IE1vYmlsaXR5ID0gKHgxLCB5MSwgeDIsIHkyKSA9PiB7XG4gIHJldHVybiBiaXNob3AoeDEsIHkxLCB4MiwgeTIpIHx8IGtuaWdodCh4MSwgeTEsIHgyLCB5Mik7XG59XG5cbi8vIGNhcGFibGFuY2EgY2FuY2VsbG9yLCBzZWlyYXdhbiBlbGVwaGFudFxuY29uc3QgY2FuY2VsbG9yOiBNb2JpbGl0eSA9ICh4MSwgeTEsIHgyLCB5MikgPT4ge1xuICByZXR1cm4gcm9vayh4MSwgeTEsIHgyLCB5MikgfHwga25pZ2h0KHgxLCB5MSwgeDIsIHkyKTtcbn1cblxuLy8gc2hvZ2kgbGFuY2VcbmZ1bmN0aW9uIGxhbmNlKGNvbG9yOiBjZy5Db2xvcik6IE1vYmlsaXR5IHtcbiAgcmV0dXJuICh4MSwgeTEsIHgyLCB5MikgPT4gKFxuICAgIHgyID09PSB4MSAmJiAoY29sb3IgPT09ICd3aGl0ZScgPyB5MiA+IHkxIDogeTIgPCB5MSlcbiAgKTtcbn1cblxuLy8gc2hvZ2kgc2lsdmVyLCBtYWtydWsvc2l0dHV5aW4gYmlzaG9wXG5mdW5jdGlvbiBzaWx2ZXIoY29sb3I6IGNnLkNvbG9yKTogTW9iaWxpdHkge1xuICByZXR1cm4gKHgxLCB5MSwgeDIsIHkyKSAgPT4gKFxuICAgIG1ldCh4MSwgeTEsIHgyLCB5MikgfHwgKHgxID09PSB4MiAmJiAoY29sb3IgPT09ICd3aGl0ZScgPyB5MiA9PT0geTEgKyAxIDogeTIgPT09IHkxIC0gMSkpXG4gICk7XG59XG5cbi8vIHNob2dpIGdvbGQsIHByb21vdGVkIHBhd24va25pZ2h0L2xhbmNlL3NpbHZlclxuZnVuY3Rpb24gZ29sZChjb2xvcjogY2cuQ29sb3IpOiBNb2JpbGl0eSB7XG4gIHJldHVybiAoeDEsIHkxLCB4MiwgeTIpICA9PiAoXG4gICAgZGlmZih4MSwgeDIpIDwgMiAmJiBkaWZmKHkxLCB5MikgPCAyICYmIChcbiAgICAgIGNvbG9yID09PSAnd2hpdGUnID9cbiAgICAgICAgISgoeDIgPT09IHgxIC0gMSAmJiB5MiA9PT0geTEgLSAxKSB8fCAoeDIgPT09IHgxICsgMSAmJiB5MiA9PT0geTEgLSAxKSkgOlxuICAgICAgICAhKCh4MiA9PT0geDEgKyAxICYmIHkyID09PSB5MSArIDEpIHx8ICh4MiA9PT0geDEgLSAxICYmIHkyID09PSB5MSArIDEpKVxuICAgIClcbiAgKTtcbn1cblxuLy8gc2hvZ2kgcGF3blxuZnVuY3Rpb24gc3Bhd24oY29sb3I6IGNnLkNvbG9yKTogTW9iaWxpdHkge1xuICByZXR1cm4gKHgxLCB5MSwgeDIsIHkyKSA9PiAoeDIgPT09IHgxICYmIChjb2xvciA9PT0gJ3doaXRlJyA/IHkyID09PSB5MSArIDEgOiB5MiA9PT0geTEgLSAxKSk7XG59XG5cbi8vIHNob2dpIGtuaWdodFxuZnVuY3Rpb24gc2tuaWdodChjb2xvcjogY2cuQ29sb3IpOiBNb2JpbGl0eSB7XG4gIHJldHVybiAoeDEsIHkxLCB4MiwgeTIpID0+IGNvbG9yID09PSAnd2hpdGUnID9cbiAgICAoeTIgPT09IHkxICsgMiAmJiB4MiA9PT0geDEgLSAxIHx8IHkyID09PSB5MSArIDIgJiYgeDIgPT09IHgxICsgMSkgOlxuICAgICh5MiA9PT0geTEgLSAyICYmIHgyID09PSB4MSAtIDEgfHwgeTIgPT09IHkxIC0gMiAmJiB4MiA9PT0geDEgKyAxKTtcbn1cblxuLy8gc2hvZ2kgcHJvbW90ZWQgcm9va1xuY29uc3QgcHJvb2s6IE1vYmlsaXR5ID0gKHgxLCB5MSwgeDIsIHkyKSA9PiB7XG4gIHJldHVybiByb29rKHgxLCB5MSwgeDIsIHkyKSB8fCAoZGlmZih4MSwgeDIpIDwgMiAmJiBkaWZmKHkxLCB5MikgPCAyKTtcbn1cblxuLy8gc2hvZ2kgcHJvbW90ZWQgYmlzaG9wXG5jb25zdCBwYmlzaG9wOiBNb2JpbGl0eSA9ICh4MSwgeTEsIHgyLCB5MikgPT4ge1xuICByZXR1cm4gYmlzaG9wKHgxLCB5MSwgeDIsIHkyKSB8fCAoZGlmZih4MSwgeDIpIDwgMiAmJiBkaWZmKHkxLCB5MikgPCAyKTtcbn1cblxuLy8gc2hvZ2kga2luZ1xuY29uc3Qgc2tpbmc6IE1vYmlsaXR5ID0gKHgxLCB5MSwgeDIsIHkyKSA9PiB7XG4gIHJldHVybiBkaWZmKHgxLCB4MikgPCAyICYmIGRpZmYoeTEsIHkyKSA8IDI7XG59XG5cbi8vIHhpYW5ncWkgcGF3blxuZnVuY3Rpb24geHBhd24oY29sb3I6IGNnLkNvbG9yKTogTW9iaWxpdHkge1xuICByZXR1cm4gKHgxLCB5MSwgeDIsIHkyKSA9PiAoXG4gICAgKHgyID09PSB4MSAmJiAoY29sb3IgPT09ICd3aGl0ZScgPyB5MiA9PT0geTEgKyAxIDogeTIgPT09IHkxIC0gMSkpIHx8XG4gICAgKHkyID09PSB5MSAmJiAoeDIgPT09IHgxICsgMSB8fCB4MiA9PT0geDEgLSAxKSAmJiAoY29sb3IgPT09ICd3aGl0ZScgPyB5MSA+IDU6IHkxIDwgNikpXG4gICAgKTtcbn1cblxuLy8geGlhbmdxaSBiaXNob3BcbmNvbnN0IHhiaXNob3A6IE1vYmlsaXR5ID0gKHgxLCB5MSwgeDIsIHkyKSA9PiB7XG4gIHJldHVybiBkaWZmKHgxLCB4MikgPT09IGRpZmYoeTEsIHkyKSAmJiBkaWZmKHgxLCB4MikgPT09IDI7XG59XG5cbi8vIHhpYW5ncWkgYWR2aXNvclxuY29uc3QgYWR2aXNvcjogTW9iaWxpdHkgPSAoeDEsIHkxLCB4MiwgeTIpID0+IHtcbiAgcmV0dXJuIGRpZmYoeDEsIHgyKSA9PT0gZGlmZih5MSwgeTIpICYmIGRpZmYoeDEsIHgyKSA9PT0gMTtcbn1cblxuLy8geGlhbmdxaSBnZW5lcmFsKGtpbmcpXG5jb25zdCB4a2luZzogTW9iaWxpdHkgPSAoeDEsIHkxLCB4MiwgeTIpID0+IHtcbiAgLy8gVE9ETzogZmx5aW5nIGdlbmVyYWwgY2FuIGNhcHR1cmUgb3BwIGdlbmVyYWxcbiAgcmV0dXJuICh4MSA9PT0geDIgfHwgeTEgPT09IHkyKSAmJiBkaWZmKHgxLCB4MikgPT09IDE7XG59XG5cbmZ1bmN0aW9uIHJvb2tGaWxlc09mKHBpZWNlczogY2cuUGllY2VzLCBjb2xvcjogY2cuQ29sb3IsIGZpcnN0UmFua0lzMDogYm9vbGVhbikge1xuICByZXR1cm4gT2JqZWN0LmtleXMocGllY2VzKS5maWx0ZXIoa2V5ID0+IHtcbiAgICBjb25zdCBwaWVjZSA9IHBpZWNlc1trZXldO1xuICAgIHJldHVybiBwaWVjZSAmJiBwaWVjZS5jb2xvciA9PT0gY29sb3IgJiYgcGllY2Uucm9sZSA9PT0gJ3Jvb2snO1xuICB9KS5tYXAoKGtleTogc3RyaW5nICkgPT4gdXRpbC5rZXkycG9zKGtleSBhcyBjZy5LZXksIGZpcnN0UmFua0lzMClbMF0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwcmVtb3ZlKHBpZWNlczogY2cuUGllY2VzLCBrZXk6IGNnLktleSwgY2FuQ2FzdGxlOiBib29sZWFuLCBnZW9tOiBjZy5HZW9tZXRyeSk6IGNnLktleVtdIHtcbiAgY29uc3QgZmlyc3RSYW5rSXMwID0gY2cuZGltZW5zaW9uc1tnZW9tXS5oZWlnaHQgPT09IDEwO1xuICBjb25zdCBwaWVjZSA9IHBpZWNlc1trZXldISxcbiAgcG9zID0gdXRpbC5rZXkycG9zKGtleSwgZmlyc3RSYW5rSXMwKTtcbiAgbGV0IG1vYmlsaXR5OiBNb2JpbGl0eTtcbiAgLy8gUGllY2UgcHJlbW92ZSBkZXBlbmRzIG9uIGNoZXNzIHZhcmlhbnQgbm90IG9uIGJvYXJkIGdlb21ldHJ5LCBidXQgd2Ugd2lsbCB1c2UgaXQgaGVyZVxuICAvLyBGLmUuIHNob2dpIGlzIG5vdCB0aGUgb25seSA5eDkgdmFyaWFudCwgc2VlIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0plc29uX01vclxuICBzd2l0Y2ggKGdlb20pIHtcbiAgY2FzZSBjZy5HZW9tZXRyeS5kaW05eDEwOlxuICAgIHN3aXRjaCAocGllY2Uucm9sZSkge1xuICAgIGNhc2UgJ3Bhd24nOlxuICAgICAgbW9iaWxpdHkgPSB4cGF3bihwaWVjZS5jb2xvcik7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdjYW5ub24nOlxuICAgIGNhc2UgJ3Jvb2snOlxuICAgICAgbW9iaWxpdHkgPSByb29rO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAna25pZ2h0JzpcbiAgICAgIG1vYmlsaXR5ID0ga25pZ2h0O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnYmlzaG9wJzpcbiAgICAgIG1vYmlsaXR5ID0geGJpc2hvcDtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2Fkdmlzb3InOlxuICAgICAgbW9iaWxpdHkgPSBhZHZpc29yO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAna2luZyc6XG4gICAgICBtb2JpbGl0eSA9IHhraW5nO1xuICAgICAgYnJlYWs7XG4gICAgfTtcbiAgICBicmVhaztcbiAgY2FzZSBjZy5HZW9tZXRyeS5kaW05eDk6XG4gICAgc3dpdGNoIChwaWVjZS5yb2xlKSB7XG4gICAgY2FzZSAncGF3bic6XG4gICAgICBtb2JpbGl0eSA9IHNwYXduKHBpZWNlLmNvbG9yKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2tuaWdodCc6XG4gICAgICBtb2JpbGl0eSA9IHNrbmlnaHQocGllY2UuY29sb3IpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnYmlzaG9wJzpcbiAgICAgIG1vYmlsaXR5ID0gYmlzaG9wO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAncm9vayc6XG4gICAgICBtb2JpbGl0eSA9IHJvb2s7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdraW5nJzpcbiAgICAgIG1vYmlsaXR5ID0gc2tpbmc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdzaWx2ZXInOlxuICAgICAgbW9iaWxpdHkgPSBzaWx2ZXIocGllY2UuY29sb3IpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAncHBhd24nOlxuICAgIGNhc2UgJ3BsYW5jZSc6XG4gICAgY2FzZSAncGtuaWdodCc6XG4gICAgY2FzZSAncHNpbHZlcic6XG4gICAgY2FzZSAnZ29sZCc6XG4gICAgICBtb2JpbGl0eSA9IGdvbGQocGllY2UuY29sb3IpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnbGFuY2UnOlxuICAgICAgbW9iaWxpdHkgPSBsYW5jZShwaWVjZS5jb2xvcik7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdwcm9vayc6XG4gICAgICBtb2JpbGl0eSA9IHByb29rO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAncGJpc2hvcCc6XG4gICAgICBtb2JpbGl0eSA9IHBiaXNob3A7XG4gICAgICBicmVhaztcbiAgICB9O1xuICAgIGJyZWFrO1xuICBkZWZhdWx0OlxuICAgIHN3aXRjaCAocGllY2Uucm9sZSkge1xuICAgIGNhc2UgJ3Bhd24nOlxuICAgICAgbW9iaWxpdHkgPSBwYXduKHBpZWNlLmNvbG9yKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2tuaWdodCc6XG4gICAgICBtb2JpbGl0eSA9IGtuaWdodDtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2Jpc2hvcCc6XG4gICAgICBtb2JpbGl0eSA9IGJpc2hvcDtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3Jvb2snOlxuICAgICAgbW9iaWxpdHkgPSByb29rO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAncXVlZW4nOlxuICAgICAgbW9iaWxpdHkgPSBxdWVlbjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2tpbmcnOlxuICAgICAgbW9iaWxpdHkgPSBraW5nKHBpZWNlLmNvbG9yLCByb29rRmlsZXNPZihwaWVjZXMsIHBpZWNlLmNvbG9yLCBmaXJzdFJhbmtJczApLCBjYW5DYXN0bGUpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnaGF3ayc6XG4gICAgY2FzZSAnYXJjaGJpc2hvcCc6XG4gICAgICBtb2JpbGl0eSA9IGFyY2hiaXNob3A7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdlbGVwaGFudCc6XG4gICAgY2FzZSAnY2FuY2VsbG9yJzpcbiAgICAgIG1vYmlsaXR5ID0gY2FuY2VsbG9yO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnbWV0JzpcbiAgICBjYXNlICdmZXJ6JzpcbiAgICAgIG1vYmlsaXR5ID0gbWV0O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnc2lsdmVyJzpcbiAgICAgIG1vYmlsaXR5ID0gc2lsdmVyKHBpZWNlLmNvbG9yKTtcbiAgICAgIGJyZWFrO1xuICAgIH07XG4gICAgYnJlYWs7XG4gIH07XG4gIGNvbnN0IGFsbGtleXMgPSB1dGlsLmFsbEtleXNbZ2VvbV07XG5cbiAgY29uc3QgcG9zMmtleUdlb20gPSAoZ2VvbTogY2cuR2VvbWV0cnkpID0+ICggKHBvczogY2cuUG9zKSA9PiB1dGlsLnBvczJrZXkocG9zLCBnZW9tKSApO1xuICBjb25zdCBwb3Mya2V5ID0gcG9zMmtleUdlb20oZ2VvbSk7XG5cbiAgY29uc3Qga2V5MnBvc1JhbmswID0gKGZpcnN0cmFuazA6IGJvb2xlYW4pID0+ICggKGtleTogY2cuS2V5KSA9PiB1dGlsLmtleTJwb3Moa2V5LCBmaXJzdHJhbmswKSApO1xuICBjb25zdCBrZXkycG9zID0ga2V5MnBvc1JhbmswKGZpcnN0UmFua0lzMCk7XG5cbiAgcmV0dXJuIGFsbGtleXMubWFwKGtleTJwb3MpLmZpbHRlcihwb3MyID0+IHtcbiAgICByZXR1cm4gKHBvc1swXSAhPT0gcG9zMlswXSB8fCBwb3NbMV0gIT09IHBvczJbMV0pICYmIG1vYmlsaXR5KHBvc1swXSwgcG9zWzFdLCBwb3MyWzBdLCBwb3MyWzFdKTtcbiAgfSkubWFwKHBvczJrZXkpO1xufTtcbiIsImltcG9ydCB7IFN0YXRlIH0gZnJvbSAnLi9zdGF0ZSdcbmltcG9ydCB7IGtleTJwb3MsIGNyZWF0ZUVsIH0gZnJvbSAnLi91dGlsJ1xuaW1wb3J0IHsgd2hpdGVQb3YgfSBmcm9tICcuL2JvYXJkJ1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnXG5pbXBvcnQgeyBBbmltQ3VycmVudCwgQW5pbVZlY3RvcnMsIEFuaW1WZWN0b3IsIEFuaW1GYWRpbmdzIH0gZnJvbSAnLi9hbmltJ1xuaW1wb3J0IHsgRHJhZ0N1cnJlbnQgfSBmcm9tICcuL2RyYWcnXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJ1xuXG4vLyBgJGNvbG9yICRyb2xlYFxudHlwZSBQaWVjZU5hbWUgPSBzdHJpbmc7XG5cbmludGVyZmFjZSBTYW1lUGllY2VzIHsgW2tleTogc3RyaW5nXTogYm9vbGVhbiB9XG5pbnRlcmZhY2UgU2FtZVNxdWFyZXMgeyBba2V5OiBzdHJpbmddOiBib29sZWFuIH1cbmludGVyZmFjZSBNb3ZlZFBpZWNlcyB7IFtwaWVjZU5hbWU6IHN0cmluZ106IGNnLlBpZWNlTm9kZVtdIH1cbmludGVyZmFjZSBNb3ZlZFNxdWFyZXMgeyBbY2xhc3NOYW1lOiBzdHJpbmddOiBjZy5TcXVhcmVOb2RlW10gfVxuaW50ZXJmYWNlIFNxdWFyZUNsYXNzZXMgeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfVxuXG4vLyBwb3J0ZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vdmVsb2NlL2xpY2hvYmlsZS9ibG9iL21hc3Rlci9zcmMvanMvY2hlc3Nncm91bmQvdmlldy5qc1xuLy8gaW4gY2FzZSBvZiBidWdzLCBibGFtZSBAdmVsb2NlXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByZW5kZXIoczogU3RhdGUpOiB2b2lkIHtcbiAgY29uc3QgZmlyc3RSYW5rSXMwID0gcy5kaW1lbnNpb25zLmhlaWdodCA9PT0gMTA7XG4gIGNvbnN0IGFzV2hpdGU6IGJvb2xlYW4gPSB3aGl0ZVBvdihzKSxcbiAgcG9zVG9UcmFuc2xhdGUgPSBzLmRvbS5yZWxhdGl2ZSA/IHV0aWwucG9zVG9UcmFuc2xhdGVSZWwgOiB1dGlsLnBvc1RvVHJhbnNsYXRlQWJzKHMuZG9tLmJvdW5kcygpLCBzLmRpbWVuc2lvbnMpLFxuICB0cmFuc2xhdGUgPSBzLmRvbS5yZWxhdGl2ZSA/IHV0aWwudHJhbnNsYXRlUmVsIDogdXRpbC50cmFuc2xhdGVBYnMsXG4gIGJvYXJkRWw6IEhUTUxFbGVtZW50ID0gcy5kb20uZWxlbWVudHMuYm9hcmQsXG4gIHBpZWNlczogY2cuUGllY2VzID0gcy5waWVjZXMsXG4gIGN1ckFuaW06IEFuaW1DdXJyZW50IHwgdW5kZWZpbmVkID0gcy5hbmltYXRpb24uY3VycmVudCxcbiAgYW5pbXM6IEFuaW1WZWN0b3JzID0gY3VyQW5pbSA/IGN1ckFuaW0ucGxhbi5hbmltcyA6IHt9LFxuICBmYWRpbmdzOiBBbmltRmFkaW5ncyA9IGN1ckFuaW0gPyBjdXJBbmltLnBsYW4uZmFkaW5ncyA6IHt9LFxuICBjdXJEcmFnOiBEcmFnQ3VycmVudCB8IHVuZGVmaW5lZCA9IHMuZHJhZ2dhYmxlLmN1cnJlbnQsXG4gIHNxdWFyZXM6IFNxdWFyZUNsYXNzZXMgPSBjb21wdXRlU3F1YXJlQ2xhc3NlcyhzKSxcbiAgc2FtZVBpZWNlczogU2FtZVBpZWNlcyA9IHt9LFxuICBzYW1lU3F1YXJlczogU2FtZVNxdWFyZXMgPSB7fSxcbiAgbW92ZWRQaWVjZXM6IE1vdmVkUGllY2VzID0ge30sXG4gIG1vdmVkU3F1YXJlczogTW92ZWRTcXVhcmVzID0ge30sXG4gIHBpZWNlc0tleXM6IGNnLktleVtdID0gT2JqZWN0LmtleXMocGllY2VzKSBhcyBjZy5LZXlbXTtcbiAgbGV0IGs6IGNnLktleSxcbiAgcDogY2cuUGllY2UgfCB1bmRlZmluZWQsXG4gIGVsOiBjZy5QaWVjZU5vZGUgfCBjZy5TcXVhcmVOb2RlLFxuICBwaWVjZUF0S2V5OiBjZy5QaWVjZSB8IHVuZGVmaW5lZCxcbiAgZWxQaWVjZU5hbWU6IFBpZWNlTmFtZSxcbiAgYW5pbTogQW5pbVZlY3RvciB8IHVuZGVmaW5lZCxcbiAgZmFkaW5nOiBjZy5QaWVjZSB8IHVuZGVmaW5lZCxcbiAgcE12ZHNldDogY2cuUGllY2VOb2RlW10sXG4gIHBNdmQ6IGNnLlBpZWNlTm9kZSB8IHVuZGVmaW5lZCxcbiAgc012ZHNldDogY2cuU3F1YXJlTm9kZVtdLFxuICBzTXZkOiBjZy5TcXVhcmVOb2RlIHwgdW5kZWZpbmVkO1xuXG4gIC8vIHdhbGsgb3ZlciBhbGwgYm9hcmQgZG9tIGVsZW1lbnRzLCBhcHBseSBhbmltYXRpb25zIGFuZCBmbGFnIG1vdmVkIHBpZWNlc1xuICBlbCA9IGJvYXJkRWwuZmlyc3RDaGlsZCBhcyBjZy5QaWVjZU5vZGUgfCBjZy5TcXVhcmVOb2RlO1xuICB3aGlsZSAoZWwpIHtcbiAgICBrID0gZWwuY2dLZXk7XG4gICAgaWYgKGlzUGllY2VOb2RlKGVsKSkge1xuICAgICAgcGllY2VBdEtleSA9IHBpZWNlc1trXTtcbiAgICAgIGFuaW0gPSBhbmltc1trXTtcbiAgICAgIGZhZGluZyA9IGZhZGluZ3Nba107XG4gICAgICBlbFBpZWNlTmFtZSA9IGVsLmNnUGllY2U7XG4gICAgICAvLyBpZiBwaWVjZSBub3QgYmVpbmcgZHJhZ2dlZCBhbnltb3JlLCByZW1vdmUgZHJhZ2dpbmcgc3R5bGVcbiAgICAgIGlmIChlbC5jZ0RyYWdnaW5nICYmICghY3VyRHJhZyB8fCBjdXJEcmFnLm9yaWcgIT09IGspKSB7XG4gICAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2RyYWdnaW5nJyk7XG4gICAgICAgIHRyYW5zbGF0ZShlbCwgcG9zVG9UcmFuc2xhdGUoa2V5MnBvcyhrLCBmaXJzdFJhbmtJczApLCBhc1doaXRlLCBzLmRpbWVuc2lvbnMpKTtcbiAgICAgICAgZWwuY2dEcmFnZ2luZyA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgLy8gcmVtb3ZlIGZhZGluZyBjbGFzcyBpZiBpdCBzdGlsbCByZW1haW5zXG4gICAgICBpZiAoIWZhZGluZyAmJiBlbC5jZ0ZhZGluZykge1xuICAgICAgICBlbC5jZ0ZhZGluZyA9IGZhbHNlO1xuICAgICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKCdmYWRpbmcnKTtcbiAgICAgIH1cbiAgICAgIC8vIHRoZXJlIGlzIG5vdyBhIHBpZWNlIGF0IHRoaXMgZG9tIGtleVxuICAgICAgaWYgKHBpZWNlQXRLZXkpIHtcbiAgICAgICAgLy8gY29udGludWUgYW5pbWF0aW9uIGlmIGFscmVhZHkgYW5pbWF0aW5nIGFuZCBzYW1lIHBpZWNlXG4gICAgICAgIC8vIChvdGhlcndpc2UgaXQgY291bGQgYW5pbWF0ZSBhIGNhcHR1cmVkIHBpZWNlKVxuICAgICAgICBpZiAoYW5pbSAmJiBlbC5jZ0FuaW1hdGluZyAmJiBlbFBpZWNlTmFtZSA9PT0gcGllY2VOYW1lT2YocGllY2VBdEtleSkpIHtcbiAgICAgICAgICBjb25zdCBwb3MgPSBrZXkycG9zKGssIGZpcnN0UmFua0lzMCk7XG4gICAgICAgICAgcG9zWzBdICs9IGFuaW1bMl07XG4gICAgICAgICAgcG9zWzFdICs9IGFuaW1bM107XG4gICAgICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnYW5pbScpO1xuICAgICAgICAgIHRyYW5zbGF0ZShlbCwgcG9zVG9UcmFuc2xhdGUocG9zLCBhc1doaXRlLCBzLmRpbWVuc2lvbnMpKTtcbiAgICAgICAgfSBlbHNlIGlmIChlbC5jZ0FuaW1hdGluZykge1xuICAgICAgICAgIGVsLmNnQW5pbWF0aW5nID0gZmFsc2U7XG4gICAgICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnYW5pbScpO1xuICAgICAgICAgIHRyYW5zbGF0ZShlbCwgcG9zVG9UcmFuc2xhdGUoa2V5MnBvcyhrLCBmaXJzdFJhbmtJczApLCBhc1doaXRlLCBzLmRpbWVuc2lvbnMpKTtcbiAgICAgICAgICBpZiAocy5hZGRQaWVjZVpJbmRleCkgZWwuc3R5bGUuekluZGV4ID0gcG9zWkluZGV4KGtleTJwb3MoaywgZmlyc3RSYW5rSXMwKSwgYXNXaGl0ZSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2FtZSBwaWVjZTogZmxhZyBhcyBzYW1lXG4gICAgICAgIGlmIChlbFBpZWNlTmFtZSA9PT0gcGllY2VOYW1lT2YocGllY2VBdEtleSkgJiYgKCFmYWRpbmcgfHwgIWVsLmNnRmFkaW5nKSkge1xuICAgICAgICAgIHNhbWVQaWVjZXNba10gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRpZmZlcmVudCBwaWVjZTogZmxhZyBhcyBtb3ZlZCB1bmxlc3MgaXQgaXMgYSBmYWRpbmcgcGllY2VcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaWYgKGZhZGluZyAmJiBlbFBpZWNlTmFtZSA9PT0gcGllY2VOYW1lT2YoZmFkaW5nKSkge1xuICAgICAgICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnZmFkaW5nJyk7XG4gICAgICAgICAgICBlbC5jZ0ZhZGluZyA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChtb3ZlZFBpZWNlc1tlbFBpZWNlTmFtZV0pIG1vdmVkUGllY2VzW2VsUGllY2VOYW1lXS5wdXNoKGVsKTtcbiAgICAgICAgICAgIGVsc2UgbW92ZWRQaWVjZXNbZWxQaWVjZU5hbWVdID0gW2VsXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIG5vIHBpZWNlOiBmbGFnIGFzIG1vdmVkXG4gICAgICBlbHNlIHtcbiAgICAgICAgaWYgKG1vdmVkUGllY2VzW2VsUGllY2VOYW1lXSkgbW92ZWRQaWVjZXNbZWxQaWVjZU5hbWVdLnB1c2goZWwpO1xuICAgICAgICBlbHNlIG1vdmVkUGllY2VzW2VsUGllY2VOYW1lXSA9IFtlbF07XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzU3F1YXJlTm9kZShlbCkpIHtcbiAgICAgIGNvbnN0IGNuID0gZWwuY2xhc3NOYW1lO1xuICAgICAgaWYgKHNxdWFyZXNba10gPT09IGNuKSBzYW1lU3F1YXJlc1trXSA9IHRydWU7XG4gICAgICBlbHNlIGlmIChtb3ZlZFNxdWFyZXNbY25dKSBtb3ZlZFNxdWFyZXNbY25dLnB1c2goZWwpO1xuICAgICAgZWxzZSBtb3ZlZFNxdWFyZXNbY25dID0gW2VsXTtcbiAgICB9XG4gICAgZWwgPSBlbC5uZXh0U2libGluZyBhcyBjZy5QaWVjZU5vZGUgfCBjZy5TcXVhcmVOb2RlO1xuICB9XG5cbiAgLy8gd2FsayBvdmVyIGFsbCBzcXVhcmVzIGluIGN1cnJlbnQgc2V0LCBhcHBseSBkb20gY2hhbmdlcyB0byBtb3ZlZCBzcXVhcmVzXG4gIC8vIG9yIGFwcGVuZCBuZXcgc3F1YXJlc1xuICBmb3IgKGNvbnN0IHNrIGluIHNxdWFyZXMpIHtcbiAgICBpZiAoIXNhbWVTcXVhcmVzW3NrXSkge1xuICAgICAgc012ZHNldCA9IG1vdmVkU3F1YXJlc1tzcXVhcmVzW3NrXV07XG4gICAgICBzTXZkID0gc012ZHNldCAmJiBzTXZkc2V0LnBvcCgpO1xuICAgICAgY29uc3QgdHJhbnNsYXRpb24gPSBwb3NUb1RyYW5zbGF0ZShrZXkycG9zKHNrIGFzIGNnLktleSwgZmlyc3RSYW5rSXMwKSwgYXNXaGl0ZSwgcy5kaW1lbnNpb25zKTtcbiAgICAgIGlmIChzTXZkKSB7XG4gICAgICAgIHNNdmQuY2dLZXkgPSBzayBhcyBjZy5LZXk7XG4gICAgICAgIHRyYW5zbGF0ZShzTXZkLCB0cmFuc2xhdGlvbik7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc3Qgc3F1YXJlTm9kZSA9IGNyZWF0ZUVsKCdzcXVhcmUnLCBzcXVhcmVzW3NrXSkgYXMgY2cuU3F1YXJlTm9kZTtcbiAgICAgICAgc3F1YXJlTm9kZS5jZ0tleSA9IHNrIGFzIGNnLktleTtcbiAgICAgICAgdHJhbnNsYXRlKHNxdWFyZU5vZGUsIHRyYW5zbGF0aW9uKTtcbiAgICAgICAgYm9hcmRFbC5pbnNlcnRCZWZvcmUoc3F1YXJlTm9kZSwgYm9hcmRFbC5maXJzdENoaWxkKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyB3YWxrIG92ZXIgYWxsIHBpZWNlcyBpbiBjdXJyZW50IHNldCwgYXBwbHkgZG9tIGNoYW5nZXMgdG8gbW92ZWQgcGllY2VzXG4gIC8vIG9yIGFwcGVuZCBuZXcgcGllY2VzXG4gIGZvciAoY29uc3QgaiBpbiBwaWVjZXNLZXlzKSB7XG4gICAgayA9IHBpZWNlc0tleXNbal07XG4gICAgcCA9IHBpZWNlc1trXSE7XG4gICAgYW5pbSA9IGFuaW1zW2tdO1xuICAgIGlmICghc2FtZVBpZWNlc1trXSkge1xuICAgICAgcE12ZHNldCA9IG1vdmVkUGllY2VzW3BpZWNlTmFtZU9mKHApXTtcbiAgICAgIHBNdmQgPSBwTXZkc2V0ICYmIHBNdmRzZXQucG9wKCk7XG4gICAgICAvLyBhIHNhbWUgcGllY2Ugd2FzIG1vdmVkXG4gICAgICBpZiAocE12ZCkge1xuICAgICAgICAvLyBhcHBseSBkb20gY2hhbmdlc1xuICAgICAgICBwTXZkLmNnS2V5ID0gaztcbiAgICAgICAgaWYgKHBNdmQuY2dGYWRpbmcpIHtcbiAgICAgICAgICBwTXZkLmNsYXNzTGlzdC5yZW1vdmUoJ2ZhZGluZycpO1xuICAgICAgICAgIHBNdmQuY2dGYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwb3MgPSBrZXkycG9zKGssIGZpcnN0UmFua0lzMCk7XG4gICAgICAgIGlmIChzLmFkZFBpZWNlWkluZGV4KSBwTXZkLnN0eWxlLnpJbmRleCA9IHBvc1pJbmRleChwb3MsIGFzV2hpdGUpO1xuICAgICAgICBpZiAoYW5pbSkge1xuICAgICAgICAgIHBNdmQuY2dBbmltYXRpbmcgPSB0cnVlO1xuICAgICAgICAgIHBNdmQuY2xhc3NMaXN0LmFkZCgnYW5pbScpO1xuICAgICAgICAgIHBvc1swXSArPSBhbmltWzJdO1xuICAgICAgICAgIHBvc1sxXSArPSBhbmltWzNdO1xuICAgICAgICB9XG4gICAgICAgIHRyYW5zbGF0ZShwTXZkLCBwb3NUb1RyYW5zbGF0ZShwb3MsIGFzV2hpdGUsIHMuZGltZW5zaW9ucykpO1xuICAgICAgfVxuICAgICAgLy8gbm8gcGllY2UgaW4gbW92ZWQgb2JqOiBpbnNlcnQgdGhlIG5ldyBwaWVjZVxuICAgICAgLy8gYXNzdW1lcyB0aGUgbmV3IHBpZWNlIGlzIG5vdCBiZWluZyBkcmFnZ2VkXG4gICAgICBlbHNlIHtcblxuICAgICAgICBjb25zdCBwaWVjZU5hbWUgPSBwaWVjZU5hbWVPZihwKSxcbiAgICAgICAgcGllY2VOb2RlID0gY3JlYXRlRWwoJ3BpZWNlJywgcGllY2VOYW1lKSBhcyBjZy5QaWVjZU5vZGUsXG4gICAgICAgIHBvcyA9IGtleTJwb3MoaywgZmlyc3RSYW5rSXMwKTtcblxuICAgICAgICBwaWVjZU5vZGUuY2dQaWVjZSA9IHBpZWNlTmFtZTtcbiAgICAgICAgcGllY2VOb2RlLmNnS2V5ID0gaztcbiAgICAgICAgaWYgKGFuaW0pIHtcbiAgICAgICAgICBwaWVjZU5vZGUuY2dBbmltYXRpbmcgPSB0cnVlO1xuICAgICAgICAgIHBvc1swXSArPSBhbmltWzJdO1xuICAgICAgICAgIHBvc1sxXSArPSBhbmltWzNdO1xuICAgICAgICB9XG4gICAgICAgIHRyYW5zbGF0ZShwaWVjZU5vZGUsIHBvc1RvVHJhbnNsYXRlKHBvcywgYXNXaGl0ZSwgcy5kaW1lbnNpb25zKSk7XG5cbiAgICAgICAgaWYgKHMuYWRkUGllY2VaSW5kZXgpIHBpZWNlTm9kZS5zdHlsZS56SW5kZXggPSBwb3NaSW5kZXgocG9zLCBhc1doaXRlKTtcblxuICAgICAgICBib2FyZEVsLmFwcGVuZENoaWxkKHBpZWNlTm9kZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gcmVtb3ZlIGFueSBlbGVtZW50IHRoYXQgcmVtYWlucyBpbiB0aGUgbW92ZWQgc2V0c1xuICBmb3IgKGNvbnN0IGkgaW4gbW92ZWRQaWVjZXMpIHJlbW92ZU5vZGVzKHMsIG1vdmVkUGllY2VzW2ldKTtcbiAgZm9yIChjb25zdCBpIGluIG1vdmVkU3F1YXJlcykgcmVtb3ZlTm9kZXMocywgbW92ZWRTcXVhcmVzW2ldKTtcbn1cblxuZnVuY3Rpb24gaXNQaWVjZU5vZGUoZWw6IGNnLlBpZWNlTm9kZSB8IGNnLlNxdWFyZU5vZGUpOiBlbCBpcyBjZy5QaWVjZU5vZGUge1xuICByZXR1cm4gZWwudGFnTmFtZSA9PT0gJ1BJRUNFJztcbn1cbmZ1bmN0aW9uIGlzU3F1YXJlTm9kZShlbDogY2cuUGllY2VOb2RlIHwgY2cuU3F1YXJlTm9kZSk6IGVsIGlzIGNnLlNxdWFyZU5vZGUge1xuICByZXR1cm4gZWwudGFnTmFtZSA9PT0gJ1NRVUFSRSc7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZU5vZGVzKHM6IFN0YXRlLCBub2RlczogSFRNTEVsZW1lbnRbXSk6IHZvaWQge1xuICBmb3IgKGNvbnN0IGkgaW4gbm9kZXMpIHMuZG9tLmVsZW1lbnRzLmJvYXJkLnJlbW92ZUNoaWxkKG5vZGVzW2ldKTtcbn1cblxuZnVuY3Rpb24gcG9zWkluZGV4KHBvczogY2cuUG9zLCBhc1doaXRlOiBib29sZWFuKTogc3RyaW5nIHtcbiAgbGV0IHogPSAyICsgKHBvc1sxXSAtIDEpICogOCArICg4IC0gcG9zWzBdKTtcbiAgaWYgKGFzV2hpdGUpIHogPSA2NyAtIHo7XG4gIHJldHVybiB6ICsgJyc7XG59XG5cbmZ1bmN0aW9uIHBpZWNlTmFtZU9mKHBpZWNlOiBjZy5QaWVjZSk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtwaWVjZS5jb2xvcn0gJHtwaWVjZS5yb2xlfWA7XG59XG5cbmZ1bmN0aW9uIGNvbXB1dGVTcXVhcmVDbGFzc2VzKHM6IFN0YXRlKTogU3F1YXJlQ2xhc3NlcyB7XG4gIGNvbnN0IHNxdWFyZXM6IFNxdWFyZUNsYXNzZXMgPSB7fTtcbiAgbGV0IGk6IGFueSwgazogY2cuS2V5O1xuICBpZiAocy5sYXN0TW92ZSAmJiBzLmhpZ2hsaWdodC5sYXN0TW92ZSkgZm9yIChpIGluIHMubGFzdE1vdmUpIHtcbiAgICBpZiAocy5sYXN0TW92ZVtpXSAhPSAnejAnKSB7XG4gICAgICBhZGRTcXVhcmUoc3F1YXJlcywgcy5sYXN0TW92ZVtpXSwgJ2xhc3QtbW92ZScpO1xuICAgIH1cbiAgfVxuICBpZiAocy5jaGVjayAmJiBzLmhpZ2hsaWdodC5jaGVjaykgYWRkU3F1YXJlKHNxdWFyZXMsIHMuY2hlY2ssICdjaGVjaycpO1xuICBpZiAocy5zZWxlY3RlZCkge1xuICAgIGlmIChzLnNlbGVjdGVkICE9ICd6MCcpIHtcbiAgICAgIGFkZFNxdWFyZShzcXVhcmVzLCBzLnNlbGVjdGVkLCAnc2VsZWN0ZWQnKTtcbiAgICB9XG4gICAgaWYgKHMubW92YWJsZS5zaG93RGVzdHMpIHtcbiAgICAgIGNvbnN0IGRlc3RzID0gcy5tb3ZhYmxlLmRlc3RzICYmIHMubW92YWJsZS5kZXN0c1tzLnNlbGVjdGVkXTtcbiAgICAgIGlmIChkZXN0cykgZm9yIChpIGluIGRlc3RzKSB7XG4gICAgICAgIGsgPSBkZXN0c1tpXTtcbiAgICAgICAgYWRkU3F1YXJlKHNxdWFyZXMsIGssICdtb3ZlLWRlc3QnICsgKHMucGllY2VzW2tdID8gJyBvYycgOiAnJykpO1xuICAgICAgfVxuICAgICAgY29uc3QgcERlc3RzID0gcy5wcmVtb3ZhYmxlLmRlc3RzO1xuICAgICAgaWYgKHBEZXN0cykgZm9yIChpIGluIHBEZXN0cykge1xuICAgICAgICBrID0gcERlc3RzW2ldO1xuICAgICAgICBhZGRTcXVhcmUoc3F1YXJlcywgaywgJ3ByZW1vdmUtZGVzdCcgKyAocy5waWVjZXNba10gPyAnIG9jJyA6ICcnKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNvbnN0IHByZW1vdmUgPSBzLnByZW1vdmFibGUuY3VycmVudDtcbiAgaWYgKHByZW1vdmUpIGZvciAoaSBpbiBwcmVtb3ZlKSBhZGRTcXVhcmUoc3F1YXJlcywgcHJlbW92ZVtpXSwgJ2N1cnJlbnQtcHJlbW92ZScpO1xuICBlbHNlIGlmIChzLnByZWRyb3BwYWJsZS5jdXJyZW50KSBhZGRTcXVhcmUoc3F1YXJlcywgcy5wcmVkcm9wcGFibGUuY3VycmVudC5rZXksICdjdXJyZW50LXByZW1vdmUnKTtcblxuICBjb25zdCBvID0gcy5leHBsb2Rpbmc7XG4gIGlmIChvKSBmb3IgKGkgaW4gby5rZXlzKSBhZGRTcXVhcmUoc3F1YXJlcywgby5rZXlzW2ldLCAnZXhwbG9kaW5nJyArIG8uc3RhZ2UpO1xuXG4gIHJldHVybiBzcXVhcmVzO1xufVxuXG5mdW5jdGlvbiBhZGRTcXVhcmUoc3F1YXJlczogU3F1YXJlQ2xhc3Nlcywga2V5OiBjZy5LZXksIGtsYXNzOiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKHNxdWFyZXNba2V5XSkgc3F1YXJlc1trZXldICs9ICcgJyArIGtsYXNzO1xuICBlbHNlIHNxdWFyZXNba2V5XSA9IGtsYXNzO1xufVxuIiwiaW1wb3J0ICogYXMgZmVuIGZyb20gJy4vZmVuJ1xuaW1wb3J0IHsgQW5pbUN1cnJlbnQgfSBmcm9tICcuL2FuaW0nXG5pbXBvcnQgeyBEcmFnQ3VycmVudCB9IGZyb20gJy4vZHJhZydcbmltcG9ydCB7IERyYXdhYmxlIH0gZnJvbSAnLi9kcmF3J1xuaW1wb3J0IHsgdGltZXIgfSBmcm9tICcuL3V0aWwnXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJztcblxuZXhwb3J0IGludGVyZmFjZSBTdGF0ZSB7XG4gIHBpZWNlczogY2cuUGllY2VzO1xuICBvcmllbnRhdGlvbjogY2cuQ29sb3I7IC8vIGJvYXJkIG9yaWVudGF0aW9uLiB3aGl0ZSB8IGJsYWNrXG4gIHR1cm5Db2xvcjogY2cuQ29sb3I7IC8vIHR1cm4gdG8gcGxheS4gd2hpdGUgfCBibGFja1xuICBjaGVjaz86IGNnLktleTsgLy8gc3F1YXJlIGN1cnJlbnRseSBpbiBjaGVjayBcImEyXCJcbiAgbGFzdE1vdmU/OiBjZy5LZXlbXTsgLy8gc3F1YXJlcyBwYXJ0IG9mIHRoZSBsYXN0IG1vdmUgW1wiYzNcIjsgXCJjNFwiXVxuICBzZWxlY3RlZD86IGNnLktleTsgLy8gc3F1YXJlIGN1cnJlbnRseSBzZWxlY3RlZCBcImExXCJcbiAgY29vcmRpbmF0ZXM6IGJvb2xlYW47IC8vIGluY2x1ZGUgY29vcmRzIGF0dHJpYnV0ZXNcbiAgYXV0b0Nhc3RsZTogYm9vbGVhbjsgLy8gaW1tZWRpYXRlbHkgY29tcGxldGUgdGhlIGNhc3RsZSBieSBtb3ZpbmcgdGhlIHJvb2sgYWZ0ZXIga2luZyBtb3ZlXG4gIHZpZXdPbmx5OiBib29sZWFuOyAvLyBkb24ndCBiaW5kIGV2ZW50czogdGhlIHVzZXIgd2lsbCBuZXZlciBiZSBhYmxlIHRvIG1vdmUgcGllY2VzIGFyb3VuZFxuICBkaXNhYmxlQ29udGV4dE1lbnU6IGJvb2xlYW47IC8vIGJlY2F1c2Ugd2hvIG5lZWRzIGEgY29udGV4dCBtZW51IG9uIGEgY2hlc3Nib2FyZFxuICByZXNpemFibGU6IGJvb2xlYW47IC8vIGxpc3RlbnMgdG8gY2hlc3Nncm91bmQucmVzaXplIG9uIGRvY3VtZW50LmJvZHkgdG8gY2xlYXIgYm91bmRzIGNhY2hlXG4gIGFkZFBpZWNlWkluZGV4OiBib29sZWFuOyAvLyBhZGRzIHotaW5kZXggdmFsdWVzIHRvIHBpZWNlcyAoZm9yIDNEKVxuICBwaWVjZUtleTogYm9vbGVhbjsgLy8gYWRkIGEgZGF0YS1rZXkgYXR0cmlidXRlIHRvIHBpZWNlIGVsZW1lbnRzXG4gIGhpZ2hsaWdodDoge1xuICAgIGxhc3RNb3ZlOiBib29sZWFuOyAvLyBhZGQgbGFzdC1tb3ZlIGNsYXNzIHRvIHNxdWFyZXNcbiAgICBjaGVjazogYm9vbGVhbjsgLy8gYWRkIGNoZWNrIGNsYXNzIHRvIHNxdWFyZXNcbiAgfTtcbiAgYW5pbWF0aW9uOiB7XG4gICAgZW5hYmxlZDogYm9vbGVhbjtcbiAgICBkdXJhdGlvbjogbnVtYmVyO1xuICAgIGN1cnJlbnQ/OiBBbmltQ3VycmVudDtcbiAgfTtcbiAgbW92YWJsZToge1xuICAgIGZyZWU6IGJvb2xlYW47IC8vIGFsbCBtb3ZlcyBhcmUgdmFsaWQgLSBib2FyZCBlZGl0b3JcbiAgICBjb2xvcj86IGNnLkNvbG9yIHwgJ2JvdGgnOyAvLyBjb2xvciB0aGF0IGNhbiBtb3ZlLiB3aGl0ZSB8IGJsYWNrIHwgYm90aFxuICAgIGRlc3RzPzogY2cuRGVzdHM7IC8vIHZhbGlkIG1vdmVzLiB7XCJhMlwiIFtcImEzXCIgXCJhNFwiXSBcImIxXCIgW1wiYTNcIiBcImMzXCJdfVxuICAgIHNob3dEZXN0czogYm9vbGVhbjsgLy8gd2hldGhlciB0byBhZGQgdGhlIG1vdmUtZGVzdCBjbGFzcyBvbiBzcXVhcmVzXG4gICAgZXZlbnRzOiB7XG4gICAgICBhZnRlcj86IChvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSwgbWV0YWRhdGE6IGNnLk1vdmVNZXRhZGF0YSkgPT4gdm9pZDsgLy8gY2FsbGVkIGFmdGVyIHRoZSBtb3ZlIGhhcyBiZWVuIHBsYXllZFxuICAgICAgYWZ0ZXJOZXdQaWVjZT86IChyb2xlOiBjZy5Sb2xlLCBrZXk6IGNnLktleSwgbWV0YWRhdGE6IGNnLk1vdmVNZXRhZGF0YSkgPT4gdm9pZDsgLy8gY2FsbGVkIGFmdGVyIGEgbmV3IHBpZWNlIGlzIGRyb3BwZWQgb24gdGhlIGJvYXJkXG4gICAgfTtcbiAgICByb29rQ2FzdGxlOiBib29sZWFuIC8vIGNhc3RsZSBieSBtb3ZpbmcgdGhlIGtpbmcgdG8gdGhlIHJvb2tcbiAgfTtcbiAgcHJlbW92YWJsZToge1xuICAgIGVuYWJsZWQ6IGJvb2xlYW47IC8vIGFsbG93IHByZW1vdmVzIGZvciBjb2xvciB0aGF0IGNhbiBub3QgbW92ZVxuICAgIHNob3dEZXN0czogYm9vbGVhbjsgLy8gd2hldGhlciB0byBhZGQgdGhlIHByZW1vdmUtZGVzdCBjbGFzcyBvbiBzcXVhcmVzXG4gICAgY2FzdGxlOiBib29sZWFuOyAvLyB3aGV0aGVyIHRvIGFsbG93IGtpbmcgY2FzdGxlIHByZW1vdmVzXG4gICAgZGVzdHM/OiBjZy5LZXlbXTsgLy8gcHJlbW92ZSBkZXN0aW5hdGlvbnMgZm9yIHRoZSBjdXJyZW50IHNlbGVjdGlvblxuICAgIGN1cnJlbnQ/OiBjZy5LZXlQYWlyOyAvLyBrZXlzIG9mIHRoZSBjdXJyZW50IHNhdmVkIHByZW1vdmUgW1wiZTJcIiBcImU0XCJdXG4gICAgZXZlbnRzOiB7XG4gICAgICBzZXQ/OiAob3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXksIG1ldGFkYXRhPzogY2cuU2V0UHJlbW92ZU1ldGFkYXRhKSA9PiB2b2lkOyAvLyBjYWxsZWQgYWZ0ZXIgdGhlIHByZW1vdmUgaGFzIGJlZW4gc2V0XG4gICAgICB1bnNldD86ICgpID0+IHZvaWQ7ICAvLyBjYWxsZWQgYWZ0ZXIgdGhlIHByZW1vdmUgaGFzIGJlZW4gdW5zZXRcbiAgICB9XG4gIH07XG4gIHByZWRyb3BwYWJsZToge1xuICAgIGVuYWJsZWQ6IGJvb2xlYW47IC8vIGFsbG93IHByZWRyb3BzIGZvciBjb2xvciB0aGF0IGNhbiBub3QgbW92ZVxuICAgIGN1cnJlbnQ/OiB7IC8vIGN1cnJlbnQgc2F2ZWQgcHJlZHJvcCB7cm9sZTogJ2tuaWdodCc7IGtleTogJ2U0J31cbiAgICAgIHJvbGU6IGNnLlJvbGU7XG4gICAgICBrZXk6IGNnLktleVxuICAgIH07XG4gICAgZXZlbnRzOiB7XG4gICAgICBzZXQ/OiAocm9sZTogY2cuUm9sZSwga2V5OiBjZy5LZXkpID0+IHZvaWQ7IC8vIGNhbGxlZCBhZnRlciB0aGUgcHJlZHJvcCBoYXMgYmVlbiBzZXRcbiAgICAgIHVuc2V0PzogKCkgPT4gdm9pZDsgLy8gY2FsbGVkIGFmdGVyIHRoZSBwcmVkcm9wIGhhcyBiZWVuIHVuc2V0XG4gICAgfVxuICB9O1xuICBkcmFnZ2FibGU6IHtcbiAgICBlbmFibGVkOiBib29sZWFuOyAvLyBhbGxvdyBtb3ZlcyAmIHByZW1vdmVzIHRvIHVzZSBkcmFnJ24gZHJvcFxuICAgIGRpc3RhbmNlOiBudW1iZXI7IC8vIG1pbmltdW0gZGlzdGFuY2UgdG8gaW5pdGlhdGUgYSBkcmFnOyBpbiBwaXhlbHNcbiAgICBhdXRvRGlzdGFuY2U6IGJvb2xlYW47IC8vIGxldHMgY2hlc3Nncm91bmQgc2V0IGRpc3RhbmNlIHRvIHplcm8gd2hlbiB1c2VyIGRyYWdzIHBpZWNlc1xuICAgIGNlbnRlclBpZWNlOiBib29sZWFuOyAvLyBjZW50ZXIgdGhlIHBpZWNlIG9uIGN1cnNvciBhdCBkcmFnIHN0YXJ0XG4gICAgc2hvd0dob3N0OiBib29sZWFuOyAvLyBzaG93IGdob3N0IG9mIHBpZWNlIGJlaW5nIGRyYWdnZWRcbiAgICBkZWxldGVPbkRyb3BPZmY6IGJvb2xlYW47IC8vIGRlbGV0ZSBhIHBpZWNlIHdoZW4gaXQgaXMgZHJvcHBlZCBvZmYgdGhlIGJvYXJkXG4gICAgY3VycmVudD86IERyYWdDdXJyZW50O1xuICB9O1xuICBkcm9wbW9kZToge1xuICAgIGFjdGl2ZTogYm9vbGVhbjtcbiAgICBwaWVjZT86IGNnLlBpZWNlO1xuICB9XG4gIHNlbGVjdGFibGU6IHtcbiAgICAvLyBkaXNhYmxlIHRvIGVuZm9yY2UgZHJhZ2dpbmcgb3ZlciBjbGljay1jbGljayBtb3ZlXG4gICAgZW5hYmxlZDogYm9vbGVhblxuICB9O1xuICBzdGF0czoge1xuICAgIC8vIHdhcyBsYXN0IHBpZWNlIGRyYWdnZWQgb3IgY2xpY2tlZD9cbiAgICAvLyBuZWVkcyBkZWZhdWx0IHRvIGZhbHNlIGZvciB0b3VjaFxuICAgIGRyYWdnZWQ6IGJvb2xlYW4sXG4gICAgY3RybEtleT86IGJvb2xlYW5cbiAgfTtcbiAgZXZlbnRzOiB7XG4gICAgY2hhbmdlPzogKCkgPT4gdm9pZDsgLy8gY2FsbGVkIGFmdGVyIHRoZSBzaXR1YXRpb24gY2hhbmdlcyBvbiB0aGUgYm9hcmRcbiAgICAvLyBjYWxsZWQgYWZ0ZXIgYSBwaWVjZSBoYXMgYmVlbiBtb3ZlZC5cbiAgICAvLyBjYXB0dXJlZFBpZWNlIGlzIHVuZGVmaW5lZCBvciBsaWtlIHtjb2xvcjogJ3doaXRlJzsgJ3JvbGUnOiAncXVlZW4nfVxuICAgIG1vdmU/OiAob3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXksIGNhcHR1cmVkUGllY2U/OiBjZy5QaWVjZSkgPT4gdm9pZDtcbiAgICBkcm9wTmV3UGllY2U/OiAocGllY2U6IGNnLlBpZWNlLCBrZXk6IGNnLktleSkgPT4gdm9pZDtcbiAgICBzZWxlY3Q/OiAoa2V5OiBjZy5LZXkpID0+IHZvaWQgLy8gY2FsbGVkIHdoZW4gYSBzcXVhcmUgaXMgc2VsZWN0ZWRcbiAgICBpbnNlcnQ/OiAoZWxlbWVudHM6IGNnLkVsZW1lbnRzKSA9PiB2b2lkOyAvLyB3aGVuIHRoZSBib2FyZCBET00gaGFzIGJlZW4gKHJlKWluc2VydGVkXG4gIH07XG4gIGRyYXdhYmxlOiBEcmF3YWJsZSxcbiAgZXhwbG9kaW5nPzogY2cuRXhwbG9kaW5nO1xuICBkb206IGNnLkRvbSxcbiAgaG9sZDogY2cuVGltZXIsXG4gIGRpbWVuc2lvbnM6IGNnLkJvYXJkRGltZW5zaW9ucywgLy8gbnVtYmVyIG9mIGxpbmVzIGFuZCByYW5rcyBvZiB0aGUgYm9hcmQge3dpZHRoOiAxMCwgaGVpZ2h0OiA4fVxuICBnZW9tZXRyeTogY2cuR2VvbWV0cnksIC8vIGRpbTh4OCB8IGRpbTl4OSB8IGRpbTEweDggfCBkaW05eDEwXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZhdWx0cygpOiBQYXJ0aWFsPFN0YXRlPiB7XG4gIHJldHVybiB7XG4gICAgcGllY2VzOiBmZW4ucmVhZChmZW4uaW5pdGlhbCwgY2cuR2VvbWV0cnkuZGltOHg4KSxcbiAgICBvcmllbnRhdGlvbjogJ3doaXRlJyxcbiAgICB0dXJuQ29sb3I6ICd3aGl0ZScsXG4gICAgY29vcmRpbmF0ZXM6IHRydWUsXG4gICAgYXV0b0Nhc3RsZTogdHJ1ZSxcbiAgICB2aWV3T25seTogZmFsc2UsXG4gICAgZGlzYWJsZUNvbnRleHRNZW51OiBmYWxzZSxcbiAgICByZXNpemFibGU6IHRydWUsXG4gICAgYWRkUGllY2VaSW5kZXg6IGZhbHNlLFxuICAgIHBpZWNlS2V5OiBmYWxzZSxcbiAgICBoaWdobGlnaHQ6IHtcbiAgICAgIGxhc3RNb3ZlOiB0cnVlLFxuICAgICAgY2hlY2s6IHRydWVcbiAgICB9LFxuICAgIGFuaW1hdGlvbjoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIGR1cmF0aW9uOiAyMDBcbiAgICB9LFxuICAgIG1vdmFibGU6IHtcbiAgICAgIGZyZWU6IHRydWUsXG4gICAgICBjb2xvcjogJ2JvdGgnLFxuICAgICAgc2hvd0Rlc3RzOiB0cnVlLFxuICAgICAgZXZlbnRzOiB7fSxcbiAgICAgIHJvb2tDYXN0bGU6IHRydWVcbiAgICB9LFxuICAgIHByZW1vdmFibGU6IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBzaG93RGVzdHM6IHRydWUsXG4gICAgICBjYXN0bGU6IHRydWUsXG4gICAgICBldmVudHM6IHt9XG4gICAgfSxcbiAgICBwcmVkcm9wcGFibGU6IHtcbiAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgZXZlbnRzOiB7fVxuICAgIH0sXG4gICAgZHJhZ2dhYmxlOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgZGlzdGFuY2U6IDMsXG4gICAgICBhdXRvRGlzdGFuY2U6IHRydWUsXG4gICAgICBjZW50ZXJQaWVjZTogdHJ1ZSxcbiAgICAgIHNob3dHaG9zdDogdHJ1ZSxcbiAgICAgIGRlbGV0ZU9uRHJvcE9mZjogZmFsc2VcbiAgICB9LFxuICAgIGRyb3Btb2RlOiB7XG4gICAgICBhY3RpdmU6IGZhbHNlXG4gICAgfSxcbiAgICBzZWxlY3RhYmxlOiB7XG4gICAgICBlbmFibGVkOiB0cnVlXG4gICAgfSxcbiAgICBzdGF0czoge1xuICAgICAgLy8gb24gdG91Y2hzY3JlZW4sIGRlZmF1bHQgdG8gXCJ0YXAtdGFwXCIgbW92ZXNcbiAgICAgIC8vIGluc3RlYWQgb2YgZHJhZ1xuICAgICAgZHJhZ2dlZDogISgnb250b3VjaHN0YXJ0JyBpbiB3aW5kb3cpXG4gICAgfSxcbiAgICBldmVudHM6IHt9LFxuICAgIGRyYXdhYmxlOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLCAvLyBjYW4gZHJhd1xuICAgICAgdmlzaWJsZTogdHJ1ZSwgLy8gY2FuIHZpZXdcbiAgICAgIGVyYXNlT25DbGljazogdHJ1ZSxcbiAgICAgIHNoYXBlczogW10sXG4gICAgICBhdXRvU2hhcGVzOiBbXSxcbiAgICAgIGJydXNoZXM6IHtcbiAgICAgICAgZ3JlZW46IHsga2V5OiAnZycsIGNvbG9yOiAnIzE1NzgxQicsIG9wYWNpdHk6IDEsIGxpbmVXaWR0aDogMTAgfSxcbiAgICAgICAgcmVkOiB7IGtleTogJ3InLCBjb2xvcjogJyM4ODIwMjAnLCBvcGFjaXR5OiAxLCBsaW5lV2lkdGg6IDEwIH0sXG4gICAgICAgIGJsdWU6IHsga2V5OiAnYicsIGNvbG9yOiAnIzAwMzA4OCcsIG9wYWNpdHk6IDEsIGxpbmVXaWR0aDogMTAgfSxcbiAgICAgICAgeWVsbG93OiB7IGtleTogJ3knLCBjb2xvcjogJyNlNjhmMDAnLCBvcGFjaXR5OiAxLCBsaW5lV2lkdGg6IDEwIH0sXG4gICAgICAgIHBhbGVCbHVlOiB7IGtleTogJ3BiJywgY29sb3I6ICcjMDAzMDg4Jywgb3BhY2l0eTogMC40LCBsaW5lV2lkdGg6IDE1IH0sXG4gICAgICAgIHBhbGVHcmVlbjogeyBrZXk6ICdwZycsIGNvbG9yOiAnIzE1NzgxQicsIG9wYWNpdHk6IDAuNCwgbGluZVdpZHRoOiAxNSB9LFxuICAgICAgICBwYWxlUmVkOiB7IGtleTogJ3ByJywgY29sb3I6ICcjODgyMDIwJywgb3BhY2l0eTogMC40LCBsaW5lV2lkdGg6IDE1IH0sXG4gICAgICAgIHBhbGVHcmV5OiB7IGtleTogJ3BncicsIGNvbG9yOiAnIzRhNGE0YScsIG9wYWNpdHk6IDAuMzUsIGxpbmVXaWR0aDogMTUgfVxuICAgICAgfSxcbiAgICAgIHBpZWNlczoge1xuICAgICAgICBiYXNlVXJsOiAnaHR0cHM6Ly9saWNoZXNzMS5vcmcvYXNzZXRzL3BpZWNlL2NidXJuZXR0LydcbiAgICAgIH0sXG4gICAgICBwcmV2U3ZnSGFzaDogJydcbiAgICB9LFxuICAgIGhvbGQ6IHRpbWVyKCksXG4gICAgZGltZW5zaW9uczoge3dpZHRoOiA4LCBoZWlnaHQ6IDh9LFxuICAgIGdlb21ldHJ5OiBjZy5HZW9tZXRyeS5kaW04eDgsXG4gIH07XG59XG4iLCJpbXBvcnQgeyBTdGF0ZSB9IGZyb20gJy4vc3RhdGUnXG5pbXBvcnQgeyBrZXkycG9zIH0gZnJvbSAnLi91dGlsJ1xuaW1wb3J0IHsgRHJhd2FibGUsIERyYXdTaGFwZSwgRHJhd1NoYXBlUGllY2UsIERyYXdCcnVzaCwgRHJhd0JydXNoZXMsIERyYXdNb2RpZmllcnMgfSBmcm9tICcuL2RyYXcnXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJ1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRWxlbWVudCh0YWdOYW1lOiBzdHJpbmcpOiBTVkdFbGVtZW50IHtcbiAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUygnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLCB0YWdOYW1lKTtcbn1cblxuaW50ZXJmYWNlIFNoYXBlIHtcbiAgc2hhcGU6IERyYXdTaGFwZTtcbiAgY3VycmVudDogYm9vbGVhbjtcbiAgaGFzaDogSGFzaDtcbn1cblxuaW50ZXJmYWNlIEN1c3RvbUJydXNoZXMge1xuICBbaGFzaDogc3RyaW5nXTogRHJhd0JydXNoXG59XG5cbmludGVyZmFjZSBBcnJvd0Rlc3RzIHtcbiAgW2tleTogc3RyaW5nXTogbnVtYmVyOyAvLyBob3cgbWFueSBhcnJvd3MgbGFuZCBvbiBhIHNxdWFyZVxufVxuXG50eXBlIEhhc2ggPSBzdHJpbmc7XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJTdmcoc3RhdGU6IFN0YXRlLCByb290OiBTVkdFbGVtZW50KTogdm9pZCB7XG5cbiAgY29uc3QgZCA9IHN0YXRlLmRyYXdhYmxlLFxuICBjdXJEID0gZC5jdXJyZW50LFxuICBjdXIgPSBjdXJEICYmIGN1ckQubW91c2VTcSA/IGN1ckQgYXMgRHJhd1NoYXBlIDogdW5kZWZpbmVkLFxuICBhcnJvd0Rlc3RzOiBBcnJvd0Rlc3RzID0ge307XG5cbiAgZC5zaGFwZXMuY29uY2F0KGQuYXV0b1NoYXBlcykuY29uY2F0KGN1ciA/IFtjdXJdIDogW10pLmZvckVhY2gocyA9PiB7XG4gICAgaWYgKHMuZGVzdCkgYXJyb3dEZXN0c1tzLmRlc3RdID0gKGFycm93RGVzdHNbcy5kZXN0XSB8fCAwKSArIDE7XG4gIH0pO1xuXG4gIGNvbnN0IHNoYXBlczogU2hhcGVbXSA9IGQuc2hhcGVzLmNvbmNhdChkLmF1dG9TaGFwZXMpLm1hcCgoczogRHJhd1NoYXBlKSA9PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNoYXBlOiBzLFxuICAgICAgY3VycmVudDogZmFsc2UsXG4gICAgICBoYXNoOiBzaGFwZUhhc2gocywgYXJyb3dEZXN0cywgZmFsc2UpXG4gICAgfTtcbiAgfSk7XG4gIGlmIChjdXIpIHNoYXBlcy5wdXNoKHtcbiAgICBzaGFwZTogY3VyLFxuICAgIGN1cnJlbnQ6IHRydWUsXG4gICAgaGFzaDogc2hhcGVIYXNoKGN1ciwgYXJyb3dEZXN0cywgdHJ1ZSlcbiAgfSk7XG5cbiAgY29uc3QgZnVsbEhhc2ggPSBzaGFwZXMubWFwKHNjID0+IHNjLmhhc2gpLmpvaW4oJycpO1xuICBpZiAoZnVsbEhhc2ggPT09IHN0YXRlLmRyYXdhYmxlLnByZXZTdmdIYXNoKSByZXR1cm47XG4gIHN0YXRlLmRyYXdhYmxlLnByZXZTdmdIYXNoID0gZnVsbEhhc2g7XG5cbiAgY29uc3QgZGVmc0VsID0gcm9vdC5maXJzdENoaWxkIGFzIFNWR0VsZW1lbnQ7XG5cbiAgc3luY0RlZnMoZCwgc2hhcGVzLCBkZWZzRWwpO1xuICBzeW5jU2hhcGVzKHN0YXRlLCBzaGFwZXMsIGQuYnJ1c2hlcywgYXJyb3dEZXN0cywgcm9vdCwgZGVmc0VsKTtcbn1cblxuLy8gYXBwZW5kIG9ubHkuIERvbid0IHRyeSB0byB1cGRhdGUvcmVtb3ZlLlxuZnVuY3Rpb24gc3luY0RlZnMoZDogRHJhd2FibGUsIHNoYXBlczogU2hhcGVbXSwgZGVmc0VsOiBTVkdFbGVtZW50KSB7XG4gIGNvbnN0IGJydXNoZXM6IEN1c3RvbUJydXNoZXMgPSB7fTtcbiAgbGV0IGJydXNoOiBEcmF3QnJ1c2g7XG4gIHNoYXBlcy5mb3JFYWNoKHMgPT4ge1xuICAgIGlmIChzLnNoYXBlLmRlc3QpIHtcbiAgICAgIGJydXNoID0gZC5icnVzaGVzW3Muc2hhcGUuYnJ1c2hdO1xuICAgICAgaWYgKHMuc2hhcGUubW9kaWZpZXJzKSBicnVzaCA9IG1ha2VDdXN0b21CcnVzaChicnVzaCwgcy5zaGFwZS5tb2RpZmllcnMpO1xuICAgICAgYnJ1c2hlc1ticnVzaC5rZXldID0gYnJ1c2g7XG4gICAgfVxuICB9KTtcbiAgY29uc3Qga2V5c0luRG9tOiB7W2tleTogc3RyaW5nXTogYm9vbGVhbn0gPSB7fTtcbiAgbGV0IGVsOiBTVkdFbGVtZW50ID0gZGVmc0VsLmZpcnN0Q2hpbGQgYXMgU1ZHRWxlbWVudDtcbiAgd2hpbGUoZWwpIHtcbiAgICBrZXlzSW5Eb21bZWwuZ2V0QXR0cmlidXRlKCdjZ0tleScpIGFzIHN0cmluZ10gPSB0cnVlO1xuICAgIGVsID0gZWwubmV4dFNpYmxpbmcgYXMgU1ZHRWxlbWVudDtcbiAgfVxuICBmb3IgKGxldCBrZXkgaW4gYnJ1c2hlcykge1xuICAgIGlmICgha2V5c0luRG9tW2tleV0pIGRlZnNFbC5hcHBlbmRDaGlsZChyZW5kZXJNYXJrZXIoYnJ1c2hlc1trZXldKSk7XG4gIH1cbn1cblxuLy8gYXBwZW5kIGFuZCByZW1vdmUgb25seS4gTm8gdXBkYXRlcy5cbmZ1bmN0aW9uIHN5bmNTaGFwZXMoc3RhdGU6IFN0YXRlLCBzaGFwZXM6IFNoYXBlW10sIGJydXNoZXM6IERyYXdCcnVzaGVzLCBhcnJvd0Rlc3RzOiBBcnJvd0Rlc3RzLCByb290OiBTVkdFbGVtZW50LCBkZWZzRWw6IFNWR0VsZW1lbnQpOiB2b2lkIHtcbiAgY29uc3QgYm91bmRzID0gc3RhdGUuZG9tLmJvdW5kcygpLFxuICBoYXNoZXNJbkRvbToge1toYXNoOiBzdHJpbmddOiBib29sZWFufSA9IHt9LFxuICB0b1JlbW92ZTogU1ZHRWxlbWVudFtdID0gW107XG4gIHNoYXBlcy5mb3JFYWNoKHNjID0+IHsgaGFzaGVzSW5Eb21bc2MuaGFzaF0gPSBmYWxzZTsgfSk7XG4gIGxldCBlbDogU1ZHRWxlbWVudCA9IGRlZnNFbC5uZXh0U2libGluZyBhcyBTVkdFbGVtZW50LCBlbEhhc2g6IEhhc2g7XG4gIHdoaWxlKGVsKSB7XG4gICAgZWxIYXNoID0gZWwuZ2V0QXR0cmlidXRlKCdjZ0hhc2gnKSBhcyBIYXNoO1xuICAgIC8vIGZvdW5kIGEgc2hhcGUgZWxlbWVudCB0aGF0J3MgaGVyZSB0byBzdGF5XG4gICAgaWYgKGhhc2hlc0luRG9tLmhhc093blByb3BlcnR5KGVsSGFzaCkpIGhhc2hlc0luRG9tW2VsSGFzaF0gPSB0cnVlO1xuICAgIC8vIG9yIHJlbW92ZSBpdFxuICAgIGVsc2UgdG9SZW1vdmUucHVzaChlbCk7XG4gICAgZWwgPSBlbC5uZXh0U2libGluZyBhcyBTVkdFbGVtZW50O1xuICB9XG4gIC8vIHJlbW92ZSBvbGQgc2hhcGVzXG4gIHRvUmVtb3ZlLmZvckVhY2goZWwgPT4gcm9vdC5yZW1vdmVDaGlsZChlbCkpO1xuICAvLyBpbnNlcnQgc2hhcGVzIHRoYXQgYXJlIG5vdCB5ZXQgaW4gZG9tXG4gIHNoYXBlcy5mb3JFYWNoKHNjID0+IHtcbiAgICBpZiAoIWhhc2hlc0luRG9tW3NjLmhhc2hdKSByb290LmFwcGVuZENoaWxkKHJlbmRlclNoYXBlKHN0YXRlLCBzYywgYnJ1c2hlcywgYXJyb3dEZXN0cywgYm91bmRzKSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBzaGFwZUhhc2goe29yaWcsIGRlc3QsIGJydXNoLCBwaWVjZSwgbW9kaWZpZXJzfTogRHJhd1NoYXBlLCBhcnJvd0Rlc3RzOiBBcnJvd0Rlc3RzLCBjdXJyZW50OiBib29sZWFuKTogSGFzaCB7XG4gIHJldHVybiBbY3VycmVudCwgb3JpZywgZGVzdCwgYnJ1c2gsIGRlc3QgJiYgYXJyb3dEZXN0c1tkZXN0XSA+IDEsXG4gICAgcGllY2UgJiYgcGllY2VIYXNoKHBpZWNlKSxcbiAgICBtb2RpZmllcnMgJiYgbW9kaWZpZXJzSGFzaChtb2RpZmllcnMpXG4gIF0uZmlsdGVyKHggPT4geCkuam9pbignJyk7XG59XG5cbmZ1bmN0aW9uIHBpZWNlSGFzaChwaWVjZTogRHJhd1NoYXBlUGllY2UpOiBIYXNoIHtcbiAgcmV0dXJuIFtwaWVjZS5jb2xvciwgcGllY2Uucm9sZSwgcGllY2Uuc2NhbGVdLmZpbHRlcih4ID0+IHgpLmpvaW4oJycpO1xufVxuXG5mdW5jdGlvbiBtb2RpZmllcnNIYXNoKG06IERyYXdNb2RpZmllcnMpOiBIYXNoIHtcbiAgcmV0dXJuICcnICsgKG0ubGluZVdpZHRoIHx8ICcnKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyU2hhcGUoc3RhdGU6IFN0YXRlLCB7c2hhcGUsIGN1cnJlbnQsIGhhc2h9OiBTaGFwZSwgYnJ1c2hlczogRHJhd0JydXNoZXMsIGFycm93RGVzdHM6IEFycm93RGVzdHMsIGJvdW5kczogQ2xpZW50UmVjdCk6IFNWR0VsZW1lbnQge1xuICBjb25zdCBmaXJzdFJhbmtJczAgPSBzdGF0ZS5kaW1lbnNpb25zLmhlaWdodCA9PT0gMTA7XG4gIGxldCBlbDogU1ZHRWxlbWVudDtcbiAgaWYgKHNoYXBlLnBpZWNlKSBlbCA9IHJlbmRlclBpZWNlKFxuICAgIHN0YXRlLmRyYXdhYmxlLnBpZWNlcy5iYXNlVXJsLFxuICAgIG9yaWVudChrZXkycG9zKHNoYXBlLm9yaWcsIGZpcnN0UmFua0lzMCksIHN0YXRlLm9yaWVudGF0aW9uLCBzdGF0ZS5kaW1lbnNpb25zKSxcbiAgICBzaGFwZS5waWVjZSxcbiAgICBib3VuZHMsXG4gICAgc3RhdGUuZGltZW5zaW9ucyk7XG4gIGVsc2Uge1xuICAgIGNvbnN0IG9yaWcgPSBvcmllbnQoa2V5MnBvcyhzaGFwZS5vcmlnLCBmaXJzdFJhbmtJczApLCBzdGF0ZS5vcmllbnRhdGlvbiwgc3RhdGUuZGltZW5zaW9ucyk7XG4gICAgaWYgKHNoYXBlLm9yaWcgJiYgc2hhcGUuZGVzdCkge1xuICAgICAgbGV0IGJydXNoOiBEcmF3QnJ1c2ggPSBicnVzaGVzW3NoYXBlLmJydXNoXTtcbiAgICAgIGlmIChzaGFwZS5tb2RpZmllcnMpIGJydXNoID0gbWFrZUN1c3RvbUJydXNoKGJydXNoLCBzaGFwZS5tb2RpZmllcnMpO1xuICAgICAgZWwgPSByZW5kZXJBcnJvdyhcbiAgICAgICAgYnJ1c2gsXG4gICAgICAgIG9yaWcsXG4gICAgICAgIG9yaWVudChrZXkycG9zKHNoYXBlLmRlc3QsIGZpcnN0UmFua0lzMCksIHN0YXRlLm9yaWVudGF0aW9uLCBzdGF0ZS5kaW1lbnNpb25zKSxcbiAgICAgICAgY3VycmVudCxcbiAgICAgICAgYXJyb3dEZXN0c1tzaGFwZS5kZXN0XSA+IDEsXG4gICAgICAgIGJvdW5kcyxcbiAgICAgICAgc3RhdGUuZGltZW5zaW9ucyk7XG4gICAgfVxuICAgIGVsc2UgZWwgPSByZW5kZXJDaXJjbGUoYnJ1c2hlc1tzaGFwZS5icnVzaF0sIG9yaWcsIGN1cnJlbnQsIGJvdW5kcywgc3RhdGUuZGltZW5zaW9ucyk7XG4gIH1cbiAgZWwuc2V0QXR0cmlidXRlKCdjZ0hhc2gnLCBoYXNoKTtcbiAgcmV0dXJuIGVsO1xufVxuXG5mdW5jdGlvbiByZW5kZXJDaXJjbGUoYnJ1c2g6IERyYXdCcnVzaCwgcG9zOiBjZy5Qb3MsIGN1cnJlbnQ6IGJvb2xlYW4sIGJvdW5kczogQ2xpZW50UmVjdCwgYmQ6IGNnLkJvYXJkRGltZW5zaW9ucyk6IFNWR0VsZW1lbnQge1xuICBjb25zdCBvID0gcG9zMnB4KHBvcywgYm91bmRzLCBiZCksXG4gIHdpZHRocyA9IGNpcmNsZVdpZHRoKGJvdW5kcywgYmQpLFxuICByYWRpdXMgPSAoYm91bmRzLndpZHRoIC8gYmQud2lkdGgpIC8gMjtcbiAgcmV0dXJuIHNldEF0dHJpYnV0ZXMoY3JlYXRlRWxlbWVudCgnY2lyY2xlJyksIHtcbiAgICBzdHJva2U6IGJydXNoLmNvbG9yLFxuICAgICdzdHJva2Utd2lkdGgnOiB3aWR0aHNbY3VycmVudCA/IDAgOiAxXSxcbiAgICBmaWxsOiAnbm9uZScsXG4gICAgb3BhY2l0eTogb3BhY2l0eShicnVzaCwgY3VycmVudCksXG4gICAgY3g6IG9bMF0sXG4gICAgY3k6IG9bMV0sXG4gICAgcjogcmFkaXVzIC0gd2lkdGhzWzFdIC8gMlxuICB9KTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyQXJyb3coYnJ1c2g6IERyYXdCcnVzaCwgb3JpZzogY2cuUG9zLCBkZXN0OiBjZy5Qb3MsIGN1cnJlbnQ6IGJvb2xlYW4sIHNob3J0ZW46IGJvb2xlYW4sIGJvdW5kczogQ2xpZW50UmVjdCwgYmQ6IGNnLkJvYXJkRGltZW5zaW9ucyk6IFNWR0VsZW1lbnQge1xuICBjb25zdCBtID0gYXJyb3dNYXJnaW4oYm91bmRzLCBzaG9ydGVuICYmICFjdXJyZW50LCBiZCksXG4gIGEgPSBwb3MycHgob3JpZywgYm91bmRzLCBiZCksXG4gIGIgPSBwb3MycHgoZGVzdCwgYm91bmRzLCBiZCksXG4gIGR4ID0gYlswXSAtIGFbMF0sXG4gIGR5ID0gYlsxXSAtIGFbMV0sXG4gIGFuZ2xlID0gTWF0aC5hdGFuMihkeSwgZHgpLFxuICB4byA9IE1hdGguY29zKGFuZ2xlKSAqIG0sXG4gIHlvID0gTWF0aC5zaW4oYW5nbGUpICogbTtcbiAgcmV0dXJuIHNldEF0dHJpYnV0ZXMoY3JlYXRlRWxlbWVudCgnbGluZScpLCB7XG4gICAgc3Ryb2tlOiBicnVzaC5jb2xvcixcbiAgICAnc3Ryb2tlLXdpZHRoJzogbGluZVdpZHRoKGJydXNoLCBjdXJyZW50LCBib3VuZHMsIGJkKSxcbiAgICAnc3Ryb2tlLWxpbmVjYXAnOiAncm91bmQnLFxuICAgICdtYXJrZXItZW5kJzogJ3VybCgjYXJyb3doZWFkLScgKyBicnVzaC5rZXkgKyAnKScsXG4gICAgb3BhY2l0eTogb3BhY2l0eShicnVzaCwgY3VycmVudCksXG4gICAgeDE6IGFbMF0sXG4gICAgeTE6IGFbMV0sXG4gICAgeDI6IGJbMF0gLSB4byxcbiAgICB5MjogYlsxXSAtIHlvXG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZW5kZXJQaWVjZShiYXNlVXJsOiBzdHJpbmcsIHBvczogY2cuUG9zLCBwaWVjZTogRHJhd1NoYXBlUGllY2UsIGJvdW5kczogQ2xpZW50UmVjdCwgYmQ6IGNnLkJvYXJkRGltZW5zaW9ucyk6IFNWR0VsZW1lbnQge1xuICBjb25zdCBvID0gcG9zMnB4KHBvcywgYm91bmRzLCBiZCksXG4gIHdpZHRoID0gYm91bmRzLndpZHRoIC8gYmQud2lkdGggKiAocGllY2Uuc2NhbGUgfHwgMSksXG4gIGhlaWdodCA9IGJvdW5kcy53aWR0aCAvIGJkLmhlaWdodCAqIChwaWVjZS5zY2FsZSB8fCAxKSxcbiAgbmFtZSA9IHBpZWNlLmNvbG9yWzBdICsgKHBpZWNlLnJvbGUgPT09ICdrbmlnaHQnID8gJ24nIDogcGllY2Uucm9sZVswXSkudG9VcHBlckNhc2UoKTtcbiAgcmV0dXJuIHNldEF0dHJpYnV0ZXMoY3JlYXRlRWxlbWVudCgnaW1hZ2UnKSwge1xuICAgIGNsYXNzTmFtZTogYCR7cGllY2Uucm9sZX0gJHtwaWVjZS5jb2xvcn1gLFxuICAgIHg6IG9bMF0gLSB3aWR0aCAvIDIsXG4gICAgeTogb1sxXSAtIGhlaWdodCAvIDIsXG4gICAgd2lkdGg6IHdpZHRoLFxuICAgIGhlaWdodDogaGVpZ2h0LFxuICAgIGhyZWY6IGJhc2VVcmwgKyBuYW1lICsgJy5zdmcnXG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZW5kZXJNYXJrZXIoYnJ1c2g6IERyYXdCcnVzaCk6IFNWR0VsZW1lbnQge1xuICBjb25zdCBtYXJrZXIgPSBzZXRBdHRyaWJ1dGVzKGNyZWF0ZUVsZW1lbnQoJ21hcmtlcicpLCB7XG4gICAgaWQ6ICdhcnJvd2hlYWQtJyArIGJydXNoLmtleSxcbiAgICBvcmllbnQ6ICdhdXRvJyxcbiAgICBtYXJrZXJXaWR0aDogNCxcbiAgICBtYXJrZXJIZWlnaHQ6IDgsXG4gICAgcmVmWDogMi4wNSxcbiAgICByZWZZOiAyLjAxXG4gIH0pO1xuICBtYXJrZXIuYXBwZW5kQ2hpbGQoc2V0QXR0cmlidXRlcyhjcmVhdGVFbGVtZW50KCdwYXRoJyksIHtcbiAgICBkOiAnTTAsMCBWNCBMMywyIFonLFxuICAgIGZpbGw6IGJydXNoLmNvbG9yXG4gIH0pKTtcbiAgbWFya2VyLnNldEF0dHJpYnV0ZSgnY2dLZXknLCBicnVzaC5rZXkpO1xuICByZXR1cm4gbWFya2VyO1xufVxuXG5mdW5jdGlvbiBzZXRBdHRyaWJ1dGVzKGVsOiBTVkdFbGVtZW50LCBhdHRyczogeyBba2V5OiBzdHJpbmddOiBhbnkgfSk6IFNWR0VsZW1lbnQge1xuICBmb3IgKGxldCBrZXkgaW4gYXR0cnMpIGVsLnNldEF0dHJpYnV0ZShrZXksIGF0dHJzW2tleV0pO1xuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIG9yaWVudChwb3M6IGNnLlBvcywgY29sb3I6IGNnLkNvbG9yLCBiZDogY2cuQm9hcmREaW1lbnNpb25zKTogY2cuUG9zIHtcbiAgcmV0dXJuIGNvbG9yID09PSAnd2hpdGUnID8gcG9zIDogW2JkLndpZHRoICsgMSAtIHBvc1swXSwgYmQuaGVpZ2h0ICsgMSAtIHBvc1sxXV07XG59XG5cbmZ1bmN0aW9uIG1ha2VDdXN0b21CcnVzaChiYXNlOiBEcmF3QnJ1c2gsIG1vZGlmaWVyczogRHJhd01vZGlmaWVycyk6IERyYXdCcnVzaCB7XG4gIGNvbnN0IGJydXNoOiBQYXJ0aWFsPERyYXdCcnVzaD4gPSB7XG4gICAgY29sb3I6IGJhc2UuY29sb3IsXG4gICAgb3BhY2l0eTogTWF0aC5yb3VuZChiYXNlLm9wYWNpdHkgKiAxMCkgLyAxMCxcbiAgICBsaW5lV2lkdGg6IE1hdGgucm91bmQobW9kaWZpZXJzLmxpbmVXaWR0aCB8fCBiYXNlLmxpbmVXaWR0aClcbiAgfTtcbiAgYnJ1c2gua2V5ID0gW2Jhc2Uua2V5LCBtb2RpZmllcnMubGluZVdpZHRoXS5maWx0ZXIoeCA9PiB4KS5qb2luKCcnKTtcbiAgcmV0dXJuIGJydXNoIGFzIERyYXdCcnVzaDtcbn1cblxuZnVuY3Rpb24gY2lyY2xlV2lkdGgoYm91bmRzOiBDbGllbnRSZWN0LCBiZDogY2cuQm9hcmREaW1lbnNpb25zKTogW251bWJlciwgbnVtYmVyXSB7XG4gIGNvbnN0IGJhc2UgPSBib3VuZHMud2lkdGggLyAoYmQud2lkdGggKiA2NCk7XG4gIHJldHVybiBbMyAqIGJhc2UsIDQgKiBiYXNlXTtcbn1cblxuZnVuY3Rpb24gbGluZVdpZHRoKGJydXNoOiBEcmF3QnJ1c2gsIGN1cnJlbnQ6IGJvb2xlYW4sIGJvdW5kczogQ2xpZW50UmVjdCwgYmQ6IGNnLkJvYXJkRGltZW5zaW9ucyk6IG51bWJlciB7XG4gIHJldHVybiAoYnJ1c2gubGluZVdpZHRoIHx8IDEwKSAqIChjdXJyZW50ID8gMC44NSA6IDEpIC8gKGJkLndpZHRoICogNjQpICogYm91bmRzLndpZHRoO1xufVxuXG5mdW5jdGlvbiBvcGFjaXR5KGJydXNoOiBEcmF3QnJ1c2gsIGN1cnJlbnQ6IGJvb2xlYW4pOiBudW1iZXIge1xuICByZXR1cm4gKGJydXNoLm9wYWNpdHkgfHwgMSkgKiAoY3VycmVudCA/IDAuOSA6IDEpO1xufVxuXG5mdW5jdGlvbiBhcnJvd01hcmdpbihib3VuZHM6IENsaWVudFJlY3QsIHNob3J0ZW46IGJvb2xlYW4sIGJkOiBjZy5Cb2FyZERpbWVuc2lvbnMpOiBudW1iZXIge1xuICByZXR1cm4gKHNob3J0ZW4gPyAyMCA6IDEwKSAvIChiZC53aWR0aCAqIDY0KSAqIGJvdW5kcy53aWR0aDtcbn1cblxuZnVuY3Rpb24gcG9zMnB4KHBvczogY2cuUG9zLCBib3VuZHM6IENsaWVudFJlY3QsIGJkOiBjZy5Cb2FyZERpbWVuc2lvbnMpOiBjZy5OdW1iZXJQYWlyIHtcbiAgcmV0dXJuIFsocG9zWzBdIC0gMC41KSAqIGJvdW5kcy53aWR0aCAvIGJkLndpZHRoLCAoYmQuaGVpZ2h0ICsgMC41IC0gcG9zWzFdKSAqIGJvdW5kcy5oZWlnaHQgLyBiZC5oZWlnaHRdO1xufVxuIiwiZXhwb3J0IHR5cGUgQ29sb3IgPSAnd2hpdGUnIHwgJ2JsYWNrJztcbmV4cG9ydCB0eXBlIFJvbGUgPSAna2luZycgfCAncXVlZW4nIHwgJ3Jvb2snIHwgJ2Jpc2hvcCcgfCAna25pZ2h0JyB8ICdwYXduJyB8ICdjYW5jZWxsb3InIHwgJ2FyY2hiaXNob3AnIHwgJ2ZlcnonIHwgJ21ldCcgfCAnZ29sZCcgfCAnc2lsdmVyJyB8ICdsYW5jZSd8ICdwcGF3bicgfCAncGtuaWdodCcgfCAncGJpc2hvcCcgfCAncHJvb2snIHwgJ3BzaWx2ZXInIHwgJ3BsYW5jZScgfCAnYWR2aXNvcicgfCAnY2Fubm9uJyB8ICdoYXdrJyB8ICdlbGVwaGFudCc7XG5leHBvcnQgdHlwZSBLZXkgPSAgJ3owJyB8ICdhMCcgfCAnYjAnIHwgJ2MwJyB8ICdkMCcgfCAnZTAnIHwgJ2YwJyB8ICdnMCcgfCAnaDAnIHwgJ2kwJyB8ICdqMCcgfCAnYTEnIHwgJ2IxJyB8ICdjMScgfCAnZDEnIHwgJ2UxJyB8ICdmMScgfCAnZzEnIHwgJ2gxJyB8ICdpMScgfCAnajEnIHwgJ2EyJyB8ICdiMicgfCAnYzInIHwgJ2QyJyB8ICdlMicgfCAnZjInIHwgJ2cyJyB8ICdoMicgfCAnaTInIHwgJ2oyJyB8ICdhMycgfCAnYjMnIHwgJ2MzJyB8ICdkMycgfCAnZTMnIHwgJ2YzJyB8ICdnMycgfCAnaDMnIHwgJ2kzJyB8ICdqMycgfCAnYTQnIHwgJ2I0JyB8ICdjNCcgfCAnZDQnIHwgJ2U0JyB8ICdmNCcgfCAnZzQnIHwgJ2g0JyB8ICdpNCcgfCAnajQnIHwgJ2E1JyB8ICdiNScgfCAnYzUnIHwgJ2Q1JyB8ICdlNScgfCAnZjUnIHwgJ2c1JyB8ICdoNScgfCAnaTUnIHwgJ2o1JyB8ICdhNicgfCAnYjYnIHwgJ2M2JyB8ICdkNicgfCAnZTYnIHwgJ2Y2JyB8ICdnNicgfCAnaDYnIHwgJ2k2JyB8ICdqNicgfCAnYTcnIHwgJ2I3JyB8ICdjNycgfCAnZDcnIHwgJ2U3JyB8ICdmNycgfCAnZzcnIHwgJ2g3JyB8ICdpNycgfCAnajcnIHwgJ2E4JyB8ICdiOCcgfCAnYzgnIHwgJ2Q4JyB8ICdlOCcgfCAnZjgnIHwgJ2c4JyB8ICdoOCcgfCAnaTgnIHwgJ2o4JyB8ICdhOScgfCAnYjknIHwgJ2M5JyB8ICdkOScgfCAnZTknIHwgJ2Y5JyB8ICdnOScgfCAnaDknIHwgJ2k5JyB8ICdqOSc7XG5leHBvcnQgdHlwZSBGaWxlID0gJ2EnIHwgJ2InIHwgJ2MnIHwgJ2QnIHwgJ2UnIHwgJ2YnIHwgJ2cnIHwgJ2gnIHwgJ2knIHwgJ2onO1xuZXhwb3J0IHR5cGUgUmFuayA9ICcwJyB8ICcxJyB8ICcyJyB8ICczJyB8ICc0JyB8ICc1JyB8ICc2JyB8ICc3JyB8ICc4JyB8ICc5JyB8ICcxMCc7XG5leHBvcnQgdHlwZSBGRU4gPSBzdHJpbmc7XG5leHBvcnQgdHlwZSBQb3MgPSBbbnVtYmVyLCBudW1iZXJdO1xuZXhwb3J0IGludGVyZmFjZSBQaWVjZSB7XG4gIHJvbGU6IFJvbGU7XG4gIGNvbG9yOiBDb2xvcjtcbiAgcHJvbW90ZWQ/OiBib29sZWFuO1xufVxuZXhwb3J0IGludGVyZmFjZSBEcm9wIHtcbiAgcm9sZTogUm9sZTtcbiAga2V5OiBLZXk7XG59XG5leHBvcnQgaW50ZXJmYWNlIFBpZWNlcyB7XG4gIFtrZXk6IHN0cmluZ106IFBpZWNlIHwgdW5kZWZpbmVkO1xufVxuZXhwb3J0IGludGVyZmFjZSBQaWVjZXNEaWZmIHtcbiAgW2tleTogc3RyaW5nXTogUGllY2UgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCB0eXBlIEtleVBhaXIgPSBbS2V5LCBLZXldO1xuXG5leHBvcnQgdHlwZSBOdW1iZXJQYWlyID0gW251bWJlciwgbnVtYmVyXTtcblxuZXhwb3J0IHR5cGUgTnVtYmVyUXVhZCA9IFtudW1iZXIsIG51bWJlciwgbnVtYmVyLCBudW1iZXJdO1xuXG5leHBvcnQgaW50ZXJmYWNlIERlc3RzIHtcbiAgW2tleTogc3RyaW5nXTogS2V5W11cbn1cblxuZXhwb3J0IGludGVyZmFjZSBFbGVtZW50cyB7XG4gIGJvYXJkOiBIVE1MRWxlbWVudDtcbiAgY29udGFpbmVyOiBIVE1MRWxlbWVudDtcbiAgZ2hvc3Q/OiBIVE1MRWxlbWVudDtcbiAgc3ZnPzogU1ZHRWxlbWVudDtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgRG9tIHtcbiAgZWxlbWVudHM6IEVsZW1lbnRzLFxuICBib3VuZHM6IE1lbW88Q2xpZW50UmVjdD47XG4gIHJlZHJhdzogKCkgPT4gdm9pZDtcbiAgcmVkcmF3Tm93OiAoc2tpcFN2Zz86IGJvb2xlYW4pID0+IHZvaWQ7XG4gIHVuYmluZD86IFVuYmluZDtcbiAgZGVzdHJveWVkPzogYm9vbGVhbjtcbiAgcmVsYXRpdmU/OiBib29sZWFuOyAvLyBkb24ndCBjb21wdXRlIGJvdW5kcywgdXNlIHJlbGF0aXZlICUgdG8gcGxhY2UgcGllY2VzXG59XG5leHBvcnQgaW50ZXJmYWNlIEV4cGxvZGluZyB7XG4gIHN0YWdlOiBudW1iZXI7XG4gIGtleXM6IEtleVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE1vdmVNZXRhZGF0YSB7XG4gIHByZW1vdmU6IGJvb2xlYW47XG4gIGN0cmxLZXk/OiBib29sZWFuO1xuICBob2xkVGltZT86IG51bWJlcjtcbiAgY2FwdHVyZWQ/OiBQaWVjZTtcbiAgcHJlZHJvcD86IGJvb2xlYW47XG59XG5leHBvcnQgaW50ZXJmYWNlIFNldFByZW1vdmVNZXRhZGF0YSB7XG4gIGN0cmxLZXk/OiBib29sZWFuO1xufVxuXG5leHBvcnQgdHlwZSBXaW5kb3dFdmVudCA9ICdvbnNjcm9sbCcgfCAnb25yZXNpemUnO1xuXG5leHBvcnQgdHlwZSBNb3VjaEV2ZW50ID0gTW91c2VFdmVudCAmIFRvdWNoRXZlbnQ7XG5cbmV4cG9ydCBpbnRlcmZhY2UgS2V5ZWROb2RlIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuICBjZ0tleTogS2V5O1xufVxuZXhwb3J0IGludGVyZmFjZSBQaWVjZU5vZGUgZXh0ZW5kcyBLZXllZE5vZGUge1xuICBjZ1BpZWNlOiBzdHJpbmc7XG4gIGNnQW5pbWF0aW5nPzogYm9vbGVhbjtcbiAgY2dGYWRpbmc/OiBib29sZWFuO1xuICBjZ0RyYWdnaW5nPzogYm9vbGVhbjtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgU3F1YXJlTm9kZSBleHRlbmRzIEtleWVkTm9kZSB7IH1cblxuZXhwb3J0IGludGVyZmFjZSBNZW1vPEE+IHsgKCk6IEE7IGNsZWFyOiAoKSA9PiB2b2lkOyB9XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGltZXIge1xuICBzdGFydDogKCkgPT4gdm9pZDtcbiAgY2FuY2VsOiAoKSA9PiB2b2lkO1xuICBzdG9wOiAoKSA9PiBudW1iZXI7XG59XG5cbmV4cG9ydCB0eXBlIFJlZHJhdyA9ICgpID0+IHZvaWQ7XG5leHBvcnQgdHlwZSBVbmJpbmQgPSAoKSA9PiB2b2lkO1xuZXhwb3J0IHR5cGUgTWlsbGlzZWNvbmRzID0gbnVtYmVyO1xuZXhwb3J0IHR5cGUgS0h6ID0gbnVtYmVyO1xuXG5leHBvcnQgY29uc3QgZmlsZXM6IEZpbGVbXSA9IFsnYScsICdiJywgJ2MnLCAnZCcsICdlJywgJ2YnLCAnZycsICdoJywgJ2knLCAnaiddO1xuZXhwb3J0IGNvbnN0IHJhbmtzOiBSYW5rW10gPSBbJzAnLCAnMScsICcyJywgJzMnLCAnNCcsICc1JywgJzYnLCAnNycsICc4JywgJzknLCAnMTAnXTtcblxuZXhwb3J0IGludGVyZmFjZSBCb2FyZERpbWVuc2lvbnMge1xuICB3aWR0aDogbnVtYmVyO1xuICBoZWlnaHQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gR2VvbWV0cnkge2RpbTh4OCwgZGltOXg5LCBkaW0xMHg4LCBkaW05eDEwLCBkaW0xMHgxMH07XG5cbmV4cG9ydCBjb25zdCBkaW1lbnNpb25zOiBCb2FyZERpbWVuc2lvbnNbXSA9IFt7d2lkdGg6IDgsIGhlaWdodDogOH0sIHt3aWR0aDogOSwgaGVpZ2h0OiA5fSwge3dpZHRoOiAxMCwgaGVpZ2h0OiA4fSwge3dpZHRoOiA5LCBoZWlnaHQ6IDEwfSwge3dpZHRoOiAxMCwgaGVpZ2h0OiAxMH1dO1xuIiwiaW1wb3J0ICogYXMgY2cgZnJvbSAnLi90eXBlcyc7XG5cbmV4cG9ydCBjb25zdCBjb2xvcnM6IGNnLkNvbG9yW10gPSBbJ3doaXRlJywgJ2JsYWNrJ107XG5cbmV4cG9ydCBjb25zdCBOUmFua3M6IG51bWJlcltdID0gWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDgsIDksIDEwXTtcbmV4cG9ydCBjb25zdCBpbnZOUmFua3M6IG51bWJlcltdID0gWzEwLCA5LCA4LCA3LCA2LCA1LCA0LCAzLCAyLCAxXTtcblxuY29uc3QgZmlsZXM4ID0gY2cuZmlsZXMuc2xpY2UoMCwgOCk7XG5jb25zdCBmaWxlczkgPSBjZy5maWxlcy5zbGljZSgwLCA5KTtcbmNvbnN0IGZpbGVzMTAgPSBjZy5maWxlcy5zbGljZSgwLCAxMCk7XG5cbmNvbnN0IHJhbmtzOCA9IGNnLnJhbmtzLnNsaWNlKDEsIDkpO1xuY29uc3QgcmFua3M5ID0gY2cucmFua3Muc2xpY2UoMSwgMTApO1xuLy8gd2UgaGF2ZSB0byBjb3VudCByYW5rcyBzdGFydGluZyBmcm9tIDAgYXMgaW4gVUNDSVxuY29uc3QgcmFua3MxMCA9IGNnLnJhbmtzLnNsaWNlKDAsIDEwKTtcblxuY29uc3QgYWxsS2V5czh4ODogY2cuS2V5W10gPSBBcnJheS5wcm90b3R5cGUuY29uY2F0KC4uLmZpbGVzOC5tYXAoYyA9PiByYW5rczgubWFwKHIgPT4gYytyKSkpO1xuY29uc3QgYWxsS2V5czl4OTogY2cuS2V5W10gPSBBcnJheS5wcm90b3R5cGUuY29uY2F0KC4uLmZpbGVzOS5tYXAoYyA9PiByYW5rczkubWFwKHIgPT4gYytyKSkpO1xuY29uc3QgYWxsS2V5czEweDg6IGNnLktleVtdID0gQXJyYXkucHJvdG90eXBlLmNvbmNhdCguLi5maWxlczEwLm1hcChjID0+IHJhbmtzOC5tYXAociA9PiBjK3IpKSk7XG5jb25zdCBhbGxLZXlzOXgxMDogY2cuS2V5W10gPSBBcnJheS5wcm90b3R5cGUuY29uY2F0KC4uLmZpbGVzOS5tYXAoYyA9PiByYW5rczEwLm1hcChyID0+IGMrcikpKTtcbmNvbnN0IGFsbEtleXMxMHgxMDogY2cuS2V5W10gPSBBcnJheS5wcm90b3R5cGUuY29uY2F0KC4uLmZpbGVzMTAubWFwKGMgPT4gcmFua3MxMC5tYXAociA9PiBjK3IpKSk7XG5cbmV4cG9ydCBjb25zdCBhbGxLZXlzID0gW2FsbEtleXM4eDgsIGFsbEtleXM5eDksIGFsbEtleXMxMHg4LCBhbGxLZXlzOXgxMCwgYWxsS2V5czEweDEwXTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBvczJrZXkocG9zOiBjZy5Qb3MsIGdlb206IGNnLkdlb21ldHJ5KSB7XG4gICAgY29uc3QgYmQgPSBjZy5kaW1lbnNpb25zW2dlb21dO1xuICAgIHJldHVybiBhbGxLZXlzW2dlb21dW2JkLmhlaWdodCAqIHBvc1swXSArIHBvc1sxXSAtIGJkLmhlaWdodCAtIDFdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24ga2V5MnBvcyhrOiBjZy5LZXksIGZpcnN0UmFua0lzMDogYm9vbGVhbikge1xuICBjb25zdCBzaGlmdCA9IGZpcnN0UmFua0lzMCA/IDEgOiAwO1xuICByZXR1cm4gW2suY2hhckNvZGVBdCgwKSAtIDk2LCBrLmNoYXJDb2RlQXQoMSkgLSA0OCArIHNoaWZ0XSBhcyBjZy5Qb3M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtZW1vPEE+KGY6ICgpID0+IEEpOiBjZy5NZW1vPEE+IHtcbiAgbGV0IHY6IEEgfCB1bmRlZmluZWQ7XG4gIGNvbnN0IHJldDogYW55ID0gKCkgPT4ge1xuICAgIGlmICh2ID09PSB1bmRlZmluZWQpIHYgPSBmKCk7XG4gICAgcmV0dXJuIHY7XG4gIH07XG4gIHJldC5jbGVhciA9ICgpID0+IHsgdiA9IHVuZGVmaW5lZCB9O1xuICByZXR1cm4gcmV0O1xufVxuXG5leHBvcnQgY29uc3QgdGltZXI6ICgpID0+IGNnLlRpbWVyID0gKCkgPT4ge1xuICBsZXQgc3RhcnRBdDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuICByZXR1cm4ge1xuICAgIHN0YXJ0KCkgeyBzdGFydEF0ID0gcGVyZm9ybWFuY2Uubm93KCkgfSxcbiAgICBjYW5jZWwoKSB7IHN0YXJ0QXQgPSB1bmRlZmluZWQgfSxcbiAgICBzdG9wKCkge1xuICAgICAgaWYgKCFzdGFydEF0KSByZXR1cm4gMDtcbiAgICAgIGNvbnN0IHRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKSAtIHN0YXJ0QXQ7XG4gICAgICBzdGFydEF0ID0gdW5kZWZpbmVkO1xuICAgICAgcmV0dXJuIHRpbWU7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgY29uc3Qgb3Bwb3NpdGUgPSAoYzogY2cuQ29sb3IpID0+IGMgPT09ICd3aGl0ZScgPyAnYmxhY2snIDogJ3doaXRlJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNvbnRhaW5zWDxYPih4czogWFtdIHwgdW5kZWZpbmVkLCB4OiBYKTogYm9vbGVhbiB7XG4gIHJldHVybiB4cyAhPT0gdW5kZWZpbmVkICYmIHhzLmluZGV4T2YoeCkgIT09IC0xO1xufVxuXG5leHBvcnQgY29uc3QgZGlzdGFuY2VTcTogKHBvczE6IGNnLlBvcywgcG9zMjogY2cuUG9zKSA9PiBudW1iZXIgPSAocG9zMSwgcG9zMikgPT4ge1xuICByZXR1cm4gTWF0aC5wb3cocG9zMVswXSAtIHBvczJbMF0sIDIpICsgTWF0aC5wb3cocG9zMVsxXSAtIHBvczJbMV0sIDIpO1xufVxuXG5leHBvcnQgY29uc3Qgc2FtZVBpZWNlOiAocDE6IGNnLlBpZWNlLCBwMjogY2cuUGllY2UpID0+IGJvb2xlYW4gPSAocDEsIHAyKSA9PlxuICBwMS5yb2xlID09PSBwMi5yb2xlICYmIHAxLmNvbG9yID09PSBwMi5jb2xvcjtcblxuY29uc3QgcG9zVG9UcmFuc2xhdGVCYXNlOiAocG9zOiBjZy5Qb3MsIGFzV2hpdGU6IGJvb2xlYW4sIHhGYWN0b3I6IG51bWJlciwgeUZhY3RvcjogbnVtYmVyLCBidDogY2cuQm9hcmREaW1lbnNpb25zKSA9PiBjZy5OdW1iZXJQYWlyID1cbihwb3MsIGFzV2hpdGUsIHhGYWN0b3IsIHlGYWN0b3IsIGJ0KSA9PiBbXG4gIChhc1doaXRlID8gcG9zWzBdIC0gMSA6IGJ0LndpZHRoIC0gcG9zWzBdKSAqIHhGYWN0b3IsXG4gIChhc1doaXRlID8gYnQuaGVpZ2h0IC0gcG9zWzFdIDogcG9zWzFdIC0gMSkgKiB5RmFjdG9yXG5dO1xuXG5leHBvcnQgY29uc3QgcG9zVG9UcmFuc2xhdGVBYnMgPSAoYm91bmRzOiBDbGllbnRSZWN0LCBidDogY2cuQm9hcmREaW1lbnNpb25zKSA9PiB7XG4gIGNvbnN0IHhGYWN0b3IgPSBib3VuZHMud2lkdGggLyBidC53aWR0aCxcbiAgeUZhY3RvciA9IGJvdW5kcy5oZWlnaHQgLyBidC5oZWlnaHQ7XG4gIHJldHVybiAocG9zOiBjZy5Qb3MsIGFzV2hpdGU6IGJvb2xlYW4pID0+IHBvc1RvVHJhbnNsYXRlQmFzZShwb3MsIGFzV2hpdGUsIHhGYWN0b3IsIHlGYWN0b3IsIGJ0KTtcbn07XG5cbmV4cG9ydCBjb25zdCBwb3NUb1RyYW5zbGF0ZVJlbDogKHBvczogY2cuUG9zLCBhc1doaXRlOiBib29sZWFuLCBidDogY2cuQm9hcmREaW1lbnNpb25zKSA9PiBjZy5OdW1iZXJQYWlyID1cbiAgKHBvcywgYXNXaGl0ZSwgYnQpID0+IHBvc1RvVHJhbnNsYXRlQmFzZShwb3MsIGFzV2hpdGUsIDEwMCAvIGJ0LndpZHRoLCAxMDAgLyBidC5oZWlnaHQsIGJ0KTtcblxuZXhwb3J0IGNvbnN0IHRyYW5zbGF0ZUFicyA9IChlbDogSFRNTEVsZW1lbnQsIHBvczogY2cuUG9zKSA9PiB7XG4gIGVsLnN0eWxlLnRyYW5zZm9ybSA9IGB0cmFuc2xhdGUoJHtwb3NbMF19cHgsJHtwb3NbMV19cHgpYDtcbn1cblxuZXhwb3J0IGNvbnN0IHRyYW5zbGF0ZVJlbCA9IChlbDogSFRNTEVsZW1lbnQsIHBlcmNlbnRzOiBjZy5OdW1iZXJQYWlyKSA9PiB7XG4gIGVsLnN0eWxlLmxlZnQgPSBwZXJjZW50c1swXSArICclJztcbiAgZWwuc3R5bGUudG9wID0gcGVyY2VudHNbMV0gKyAnJSc7XG59XG5cbmV4cG9ydCBjb25zdCBzZXRWaXNpYmxlID0gKGVsOiBIVE1MRWxlbWVudCwgdjogYm9vbGVhbikgPT4ge1xuICBlbC5zdHlsZS52aXNpYmlsaXR5ID0gdiA/ICd2aXNpYmxlJyA6ICdoaWRkZW4nO1xufVxuXG4vLyB0b3VjaGVuZCBoYXMgbm8gcG9zaXRpb24hXG5leHBvcnQgY29uc3QgZXZlbnRQb3NpdGlvbjogKGU6IGNnLk1vdWNoRXZlbnQpID0+IGNnLk51bWJlclBhaXIgfCB1bmRlZmluZWQgPSBlID0+IHtcbiAgaWYgKGUuY2xpZW50WCB8fCBlLmNsaWVudFggPT09IDApIHJldHVybiBbZS5jbGllbnRYLCBlLmNsaWVudFldO1xuICBpZiAoZS50b3VjaGVzICYmIGUudGFyZ2V0VG91Y2hlc1swXSkgcmV0dXJuIFtlLnRhcmdldFRvdWNoZXNbMF0uY2xpZW50WCwgZS50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFldO1xuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgY29uc3QgaXNSaWdodEJ1dHRvbiA9IChlOiBNb3VzZUV2ZW50KSA9PiBlLmJ1dHRvbnMgPT09IDIgfHwgZS5idXR0b24gPT09IDI7XG5cbmV4cG9ydCBjb25zdCBjcmVhdGVFbCA9ICh0YWdOYW1lOiBzdHJpbmcsIGNsYXNzTmFtZT86IHN0cmluZykgPT4ge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSk7XG4gIGlmIChjbGFzc05hbWUpIGVsLmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcbiAgcmV0dXJuIGVsO1xufVxuIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xuaW1wb3J0IHsgY29sb3JzLCBzZXRWaXNpYmxlLCBjcmVhdGVFbCB9IGZyb20gJy4vdXRpbCdcbmltcG9ydCB7IGZpbGVzLCByYW5rcyB9IGZyb20gJy4vdHlwZXMnXG5pbXBvcnQgeyBjcmVhdGVFbGVtZW50IGFzIGNyZWF0ZVNWRyB9IGZyb20gJy4vc3ZnJ1xuaW1wb3J0IHsgRWxlbWVudHMsIEdlb21ldHJ5IH0gZnJvbSAnLi90eXBlcydcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gd3JhcChlbGVtZW50OiBIVE1MRWxlbWVudCwgczogU3RhdGUsIHJlbGF0aXZlOiBib29sZWFuKTogRWxlbWVudHMge1xuXG4gIC8vIC5jZy13cmFwIChlbGVtZW50IHBhc3NlZCB0byBDaGVzc2dyb3VuZClcbiAgLy8gICBjZy1oZWxwZXIgKDEyLjUlKVxuICAvLyAgICAgY2ctY29udGFpbmVyICg4MDAlKVxuICAvLyAgICAgICBjZy1ib2FyZFxuICAvLyAgICAgICBzdmdcbiAgLy8gICAgICAgY29vcmRzLnJhbmtzXG4gIC8vICAgICAgIGNvb3Jkcy5maWxlc1xuICAvLyAgICAgICBwaWVjZS5naG9zdFxuXG4gIGVsZW1lbnQuaW5uZXJIVE1MID0gJyc7XG5cbiAgLy8gZW5zdXJlIHRoZSBjZy13cmFwIGNsYXNzIGlzIHNldFxuICAvLyBzbyBib3VuZHMgY2FsY3VsYXRpb24gY2FuIHVzZSB0aGUgQ1NTIHdpZHRoL2hlaWdodCB2YWx1ZXNcbiAgLy8gYWRkIHRoYXQgY2xhc3MgeW91cnNlbGYgdG8gdGhlIGVsZW1lbnQgYmVmb3JlIGNhbGxpbmcgY2hlc3Nncm91bmRcbiAgLy8gZm9yIGEgc2xpZ2h0IHBlcmZvcm1hbmNlIGltcHJvdmVtZW50ISAoYXZvaWRzIHJlY29tcHV0aW5nIHN0eWxlKVxuICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2NnLXdyYXAnKTtcblxuICBjb2xvcnMuZm9yRWFjaChjID0+IGVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnb3JpZW50YXRpb24tJyArIGMsIHMub3JpZW50YXRpb24gPT09IGMpKTtcbiAgZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdtYW5pcHVsYWJsZScsICFzLnZpZXdPbmx5KTtcblxuICBjb25zdCBoZWxwZXIgPSBjcmVhdGVFbCgnY2ctaGVscGVyJyk7XG4gIGVsZW1lbnQuYXBwZW5kQ2hpbGQoaGVscGVyKTtcbiAgY29uc3QgY29udGFpbmVyID0gY3JlYXRlRWwoJ2NnLWNvbnRhaW5lcicpO1xuICBoZWxwZXIuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcblxuICBjb25zdCBleHRlbnNpb24gPSBjcmVhdGVFbCgnZXh0ZW5zaW9uJyk7XG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChleHRlbnNpb24pO1xuICBjb25zdCBib2FyZCA9IGNyZWF0ZUVsKCdjZy1ib2FyZCcpO1xuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoYm9hcmQpO1xuXG4gIGxldCBzdmc6IFNWR0VsZW1lbnQgfCB1bmRlZmluZWQ7XG4gIGlmIChzLmRyYXdhYmxlLnZpc2libGUgJiYgIXJlbGF0aXZlKSB7XG4gICAgc3ZnID0gY3JlYXRlU1ZHKCdzdmcnKTtcbiAgICBzdmcuYXBwZW5kQ2hpbGQoY3JlYXRlU1ZHKCdkZWZzJykpO1xuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChzdmcpO1xuICB9XG5cbiAgaWYgKHMuY29vcmRpbmF0ZXMpIHtcbiAgICBjb25zdCBvcmllbnRDbGFzcyA9IHMub3JpZW50YXRpb24gPT09ICdibGFjaycgPyAnIGJsYWNrJyA6ICcnO1xuICAgIGNvbnN0IGZpcnN0UmFua0lzMCA9IHMuZ2VvbWV0cnkgPT09IEdlb21ldHJ5LmRpbTl4MTA7XG4gICAgY29uc3Qgc2hpZnQgPSBmaXJzdFJhbmtJczAgPyAwIDogMTtcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQocmVuZGVyQ29vcmRzKHJhbmtzLnNsaWNlKHNoaWZ0LCBzLmRpbWVuc2lvbnMuaGVpZ2h0ICsgc2hpZnQpLCAncmFua3MnICsgb3JpZW50Q2xhc3MpKTtcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQocmVuZGVyQ29vcmRzKGZpbGVzLnNsaWNlKDAsIHMuZGltZW5zaW9ucy53aWR0aCksICdmaWxlcycgKyBvcmllbnRDbGFzcykpO1xuICB9XG5cbiAgbGV0IGdob3N0OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcbiAgaWYgKHMuZHJhZ2dhYmxlLnNob3dHaG9zdCAmJiAhcmVsYXRpdmUpIHtcbiAgICBnaG9zdCA9IGNyZWF0ZUVsKCdwaWVjZScsICdnaG9zdCcpO1xuICAgIHNldFZpc2libGUoZ2hvc3QsIGZhbHNlKTtcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoZ2hvc3QpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBib2FyZCxcbiAgICBjb250YWluZXIsXG4gICAgZ2hvc3QsXG4gICAgc3ZnXG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlbmRlckNvb3JkcyhlbGVtczogYW55W10sIGNsYXNzTmFtZTogc3RyaW5nKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBlbCA9IGNyZWF0ZUVsKCdjb29yZHMnLCBjbGFzc05hbWUpO1xuICBsZXQgZjogSFRNTEVsZW1lbnQ7XG4gIGZvciAobGV0IGkgaW4gZWxlbXMpIHtcbiAgICBmID0gY3JlYXRlRWwoJ2Nvb3JkJyk7XG4gICAgZi50ZXh0Q29udGVudCA9IGVsZW1zW2ldO1xuICAgIGVsLmFwcGVuZENoaWxkKGYpO1xuICB9XG4gIHJldHVybiBlbDtcbn1cbiIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xudmFyIHZub2RlXzEgPSByZXF1aXJlKFwiLi92bm9kZVwiKTtcbnZhciBpcyA9IHJlcXVpcmUoXCIuL2lzXCIpO1xuZnVuY3Rpb24gYWRkTlMoZGF0YSwgY2hpbGRyZW4sIHNlbCkge1xuICAgIGRhdGEubnMgPSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnO1xuICAgIGlmIChzZWwgIT09ICdmb3JlaWduT2JqZWN0JyAmJiBjaGlsZHJlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHZhciBjaGlsZERhdGEgPSBjaGlsZHJlbltpXS5kYXRhO1xuICAgICAgICAgICAgaWYgKGNoaWxkRGF0YSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgYWRkTlMoY2hpbGREYXRhLCBjaGlsZHJlbltpXS5jaGlsZHJlbiwgY2hpbGRyZW5baV0uc2VsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbmZ1bmN0aW9uIGgoc2VsLCBiLCBjKSB7XG4gICAgdmFyIGRhdGEgPSB7fSwgY2hpbGRyZW4sIHRleHQsIGk7XG4gICAgaWYgKGMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBkYXRhID0gYjtcbiAgICAgICAgaWYgKGlzLmFycmF5KGMpKSB7XG4gICAgICAgICAgICBjaGlsZHJlbiA9IGM7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoaXMucHJpbWl0aXZlKGMpKSB7XG4gICAgICAgICAgICB0ZXh0ID0gYztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChjICYmIGMuc2VsKSB7XG4gICAgICAgICAgICBjaGlsZHJlbiA9IFtjXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmIChiICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKGlzLmFycmF5KGIpKSB7XG4gICAgICAgICAgICBjaGlsZHJlbiA9IGI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoaXMucHJpbWl0aXZlKGIpKSB7XG4gICAgICAgICAgICB0ZXh0ID0gYjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChiICYmIGIuc2VsKSB7XG4gICAgICAgICAgICBjaGlsZHJlbiA9IFtiXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRhdGEgPSBiO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChjaGlsZHJlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgaWYgKGlzLnByaW1pdGl2ZShjaGlsZHJlbltpXSkpXG4gICAgICAgICAgICAgICAgY2hpbGRyZW5baV0gPSB2bm9kZV8xLnZub2RlKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGNoaWxkcmVuW2ldLCB1bmRlZmluZWQpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChzZWxbMF0gPT09ICdzJyAmJiBzZWxbMV0gPT09ICd2JyAmJiBzZWxbMl0gPT09ICdnJyAmJlxuICAgICAgICAoc2VsLmxlbmd0aCA9PT0gMyB8fCBzZWxbM10gPT09ICcuJyB8fCBzZWxbM10gPT09ICcjJykpIHtcbiAgICAgICAgYWRkTlMoZGF0YSwgY2hpbGRyZW4sIHNlbCk7XG4gICAgfVxuICAgIHJldHVybiB2bm9kZV8xLnZub2RlKHNlbCwgZGF0YSwgY2hpbGRyZW4sIHRleHQsIHVuZGVmaW5lZCk7XG59XG5leHBvcnRzLmggPSBoO1xuO1xuZXhwb3J0cy5kZWZhdWx0ID0gaDtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWguanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG5mdW5jdGlvbiBjcmVhdGVFbGVtZW50KHRhZ05hbWUpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnROUyhuYW1lc3BhY2VVUkksIHF1YWxpZmllZE5hbWUpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKG5hbWVzcGFjZVVSSSwgcXVhbGlmaWVkTmFtZSk7XG59XG5mdW5jdGlvbiBjcmVhdGVUZXh0Tm9kZSh0ZXh0KSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRleHQpO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29tbWVudCh0ZXh0KSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQodGV4dCk7XG59XG5mdW5jdGlvbiBpbnNlcnRCZWZvcmUocGFyZW50Tm9kZSwgbmV3Tm9kZSwgcmVmZXJlbmNlTm9kZSkge1xuICAgIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKG5ld05vZGUsIHJlZmVyZW5jZU5vZGUpO1xufVxuZnVuY3Rpb24gcmVtb3ZlQ2hpbGQobm9kZSwgY2hpbGQpIHtcbiAgICBub2RlLnJlbW92ZUNoaWxkKGNoaWxkKTtcbn1cbmZ1bmN0aW9uIGFwcGVuZENoaWxkKG5vZGUsIGNoaWxkKSB7XG4gICAgbm9kZS5hcHBlbmRDaGlsZChjaGlsZCk7XG59XG5mdW5jdGlvbiBwYXJlbnROb2RlKG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS5wYXJlbnROb2RlO1xufVxuZnVuY3Rpb24gbmV4dFNpYmxpbmcobm9kZSkge1xuICAgIHJldHVybiBub2RlLm5leHRTaWJsaW5nO1xufVxuZnVuY3Rpb24gdGFnTmFtZShlbG0pIHtcbiAgICByZXR1cm4gZWxtLnRhZ05hbWU7XG59XG5mdW5jdGlvbiBzZXRUZXh0Q29udGVudChub2RlLCB0ZXh0KSB7XG4gICAgbm9kZS50ZXh0Q29udGVudCA9IHRleHQ7XG59XG5mdW5jdGlvbiBnZXRUZXh0Q29udGVudChub2RlKSB7XG4gICAgcmV0dXJuIG5vZGUudGV4dENvbnRlbnQ7XG59XG5mdW5jdGlvbiBpc0VsZW1lbnQobm9kZSkge1xuICAgIHJldHVybiBub2RlLm5vZGVUeXBlID09PSAxO1xufVxuZnVuY3Rpb24gaXNUZXh0KG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS5ub2RlVHlwZSA9PT0gMztcbn1cbmZ1bmN0aW9uIGlzQ29tbWVudChub2RlKSB7XG4gICAgcmV0dXJuIG5vZGUubm9kZVR5cGUgPT09IDg7XG59XG5leHBvcnRzLmh0bWxEb21BcGkgPSB7XG4gICAgY3JlYXRlRWxlbWVudDogY3JlYXRlRWxlbWVudCxcbiAgICBjcmVhdGVFbGVtZW50TlM6IGNyZWF0ZUVsZW1lbnROUyxcbiAgICBjcmVhdGVUZXh0Tm9kZTogY3JlYXRlVGV4dE5vZGUsXG4gICAgY3JlYXRlQ29tbWVudDogY3JlYXRlQ29tbWVudCxcbiAgICBpbnNlcnRCZWZvcmU6IGluc2VydEJlZm9yZSxcbiAgICByZW1vdmVDaGlsZDogcmVtb3ZlQ2hpbGQsXG4gICAgYXBwZW5kQ2hpbGQ6IGFwcGVuZENoaWxkLFxuICAgIHBhcmVudE5vZGU6IHBhcmVudE5vZGUsXG4gICAgbmV4dFNpYmxpbmc6IG5leHRTaWJsaW5nLFxuICAgIHRhZ05hbWU6IHRhZ05hbWUsXG4gICAgc2V0VGV4dENvbnRlbnQ6IHNldFRleHRDb250ZW50LFxuICAgIGdldFRleHRDb250ZW50OiBnZXRUZXh0Q29udGVudCxcbiAgICBpc0VsZW1lbnQ6IGlzRWxlbWVudCxcbiAgICBpc1RleHQ6IGlzVGV4dCxcbiAgICBpc0NvbW1lbnQ6IGlzQ29tbWVudCxcbn07XG5leHBvcnRzLmRlZmF1bHQgPSBleHBvcnRzLmh0bWxEb21BcGk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1odG1sZG9tYXBpLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZXhwb3J0cy5hcnJheSA9IEFycmF5LmlzQXJyYXk7XG5mdW5jdGlvbiBwcmltaXRpdmUocykge1xuICAgIHJldHVybiB0eXBlb2YgcyA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHMgPT09ICdudW1iZXInO1xufVxuZXhwb3J0cy5wcmltaXRpdmUgPSBwcmltaXRpdmU7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pcy5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbnZhciB4bGlua05TID0gJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsnO1xudmFyIHhtbE5TID0gJ2h0dHA6Ly93d3cudzMub3JnL1hNTC8xOTk4L25hbWVzcGFjZSc7XG52YXIgY29sb25DaGFyID0gNTg7XG52YXIgeENoYXIgPSAxMjA7XG5mdW5jdGlvbiB1cGRhdGVBdHRycyhvbGRWbm9kZSwgdm5vZGUpIHtcbiAgICB2YXIga2V5LCBlbG0gPSB2bm9kZS5lbG0sIG9sZEF0dHJzID0gb2xkVm5vZGUuZGF0YS5hdHRycywgYXR0cnMgPSB2bm9kZS5kYXRhLmF0dHJzO1xuICAgIGlmICghb2xkQXR0cnMgJiYgIWF0dHJzKVxuICAgICAgICByZXR1cm47XG4gICAgaWYgKG9sZEF0dHJzID09PSBhdHRycylcbiAgICAgICAgcmV0dXJuO1xuICAgIG9sZEF0dHJzID0gb2xkQXR0cnMgfHwge307XG4gICAgYXR0cnMgPSBhdHRycyB8fCB7fTtcbiAgICAvLyB1cGRhdGUgbW9kaWZpZWQgYXR0cmlidXRlcywgYWRkIG5ldyBhdHRyaWJ1dGVzXG4gICAgZm9yIChrZXkgaW4gYXR0cnMpIHtcbiAgICAgICAgdmFyIGN1ciA9IGF0dHJzW2tleV07XG4gICAgICAgIHZhciBvbGQgPSBvbGRBdHRyc1trZXldO1xuICAgICAgICBpZiAob2xkICE9PSBjdXIpIHtcbiAgICAgICAgICAgIGlmIChjdXIgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBlbG0uc2V0QXR0cmlidXRlKGtleSwgXCJcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjdXIgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgZWxtLnJlbW92ZUF0dHJpYnV0ZShrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGtleS5jaGFyQ29kZUF0KDApICE9PSB4Q2hhcikge1xuICAgICAgICAgICAgICAgICAgICBlbG0uc2V0QXR0cmlidXRlKGtleSwgY3VyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoa2V5LmNoYXJDb2RlQXQoMykgPT09IGNvbG9uQ2hhcikge1xuICAgICAgICAgICAgICAgICAgICAvLyBBc3N1bWUgeG1sIG5hbWVzcGFjZVxuICAgICAgICAgICAgICAgICAgICBlbG0uc2V0QXR0cmlidXRlTlMoeG1sTlMsIGtleSwgY3VyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoa2V5LmNoYXJDb2RlQXQoNSkgPT09IGNvbG9uQ2hhcikge1xuICAgICAgICAgICAgICAgICAgICAvLyBBc3N1bWUgeGxpbmsgbmFtZXNwYWNlXG4gICAgICAgICAgICAgICAgICAgIGVsbS5zZXRBdHRyaWJ1dGVOUyh4bGlua05TLCBrZXksIGN1cik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbG0uc2V0QXR0cmlidXRlKGtleSwgY3VyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gcmVtb3ZlIHJlbW92ZWQgYXR0cmlidXRlc1xuICAgIC8vIHVzZSBgaW5gIG9wZXJhdG9yIHNpbmNlIHRoZSBwcmV2aW91cyBgZm9yYCBpdGVyYXRpb24gdXNlcyBpdCAoLmkuZS4gYWRkIGV2ZW4gYXR0cmlidXRlcyB3aXRoIHVuZGVmaW5lZCB2YWx1ZSlcbiAgICAvLyB0aGUgb3RoZXIgb3B0aW9uIGlzIHRvIHJlbW92ZSBhbGwgYXR0cmlidXRlcyB3aXRoIHZhbHVlID09IHVuZGVmaW5lZFxuICAgIGZvciAoa2V5IGluIG9sZEF0dHJzKSB7XG4gICAgICAgIGlmICghKGtleSBpbiBhdHRycykpIHtcbiAgICAgICAgICAgIGVsbS5yZW1vdmVBdHRyaWJ1dGUoa2V5KTtcbiAgICAgICAgfVxuICAgIH1cbn1cbmV4cG9ydHMuYXR0cmlidXRlc01vZHVsZSA9IHsgY3JlYXRlOiB1cGRhdGVBdHRycywgdXBkYXRlOiB1cGRhdGVBdHRycyB9O1xuZXhwb3J0cy5kZWZhdWx0ID0gZXhwb3J0cy5hdHRyaWJ1dGVzTW9kdWxlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXR0cmlidXRlcy5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbmZ1bmN0aW9uIHVwZGF0ZUNsYXNzKG9sZFZub2RlLCB2bm9kZSkge1xuICAgIHZhciBjdXIsIG5hbWUsIGVsbSA9IHZub2RlLmVsbSwgb2xkQ2xhc3MgPSBvbGRWbm9kZS5kYXRhLmNsYXNzLCBrbGFzcyA9IHZub2RlLmRhdGEuY2xhc3M7XG4gICAgaWYgKCFvbGRDbGFzcyAmJiAha2xhc3MpXG4gICAgICAgIHJldHVybjtcbiAgICBpZiAob2xkQ2xhc3MgPT09IGtsYXNzKVxuICAgICAgICByZXR1cm47XG4gICAgb2xkQ2xhc3MgPSBvbGRDbGFzcyB8fCB7fTtcbiAgICBrbGFzcyA9IGtsYXNzIHx8IHt9O1xuICAgIGZvciAobmFtZSBpbiBvbGRDbGFzcykge1xuICAgICAgICBpZiAoIWtsYXNzW25hbWVdKSB7XG4gICAgICAgICAgICBlbG0uY2xhc3NMaXN0LnJlbW92ZShuYW1lKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKG5hbWUgaW4ga2xhc3MpIHtcbiAgICAgICAgY3VyID0ga2xhc3NbbmFtZV07XG4gICAgICAgIGlmIChjdXIgIT09IG9sZENsYXNzW25hbWVdKSB7XG4gICAgICAgICAgICBlbG0uY2xhc3NMaXN0W2N1ciA/ICdhZGQnIDogJ3JlbW92ZSddKG5hbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuZXhwb3J0cy5jbGFzc01vZHVsZSA9IHsgY3JlYXRlOiB1cGRhdGVDbGFzcywgdXBkYXRlOiB1cGRhdGVDbGFzcyB9O1xuZXhwb3J0cy5kZWZhdWx0ID0gZXhwb3J0cy5jbGFzc01vZHVsZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNsYXNzLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZnVuY3Rpb24gaW52b2tlSGFuZGxlcihoYW5kbGVyLCB2bm9kZSwgZXZlbnQpIHtcbiAgICBpZiAodHlwZW9mIGhhbmRsZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAvLyBjYWxsIGZ1bmN0aW9uIGhhbmRsZXJcbiAgICAgICAgaGFuZGxlci5jYWxsKHZub2RlLCBldmVudCwgdm5vZGUpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2YgaGFuZGxlciA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAvLyBjYWxsIGhhbmRsZXIgd2l0aCBhcmd1bWVudHNcbiAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyWzBdID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIC8vIHNwZWNpYWwgY2FzZSBmb3Igc2luZ2xlIGFyZ3VtZW50IGZvciBwZXJmb3JtYW5jZVxuICAgICAgICAgICAgaWYgKGhhbmRsZXIubGVuZ3RoID09PSAyKSB7XG4gICAgICAgICAgICAgICAgaGFuZGxlclswXS5jYWxsKHZub2RlLCBoYW5kbGVyWzFdLCBldmVudCwgdm5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBoYW5kbGVyLnNsaWNlKDEpO1xuICAgICAgICAgICAgICAgIGFyZ3MucHVzaChldmVudCk7XG4gICAgICAgICAgICAgICAgYXJncy5wdXNoKHZub2RlKTtcbiAgICAgICAgICAgICAgICBoYW5kbGVyWzBdLmFwcGx5KHZub2RlLCBhcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNhbGwgbXVsdGlwbGUgaGFuZGxlcnNcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaGFuZGxlci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGludm9rZUhhbmRsZXIoaGFuZGxlcltpXSwgdm5vZGUsIGV2ZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbmZ1bmN0aW9uIGhhbmRsZUV2ZW50KGV2ZW50LCB2bm9kZSkge1xuICAgIHZhciBuYW1lID0gZXZlbnQudHlwZSwgb24gPSB2bm9kZS5kYXRhLm9uO1xuICAgIC8vIGNhbGwgZXZlbnQgaGFuZGxlcihzKSBpZiBleGlzdHNcbiAgICBpZiAob24gJiYgb25bbmFtZV0pIHtcbiAgICAgICAgaW52b2tlSGFuZGxlcihvbltuYW1lXSwgdm5vZGUsIGV2ZW50KTtcbiAgICB9XG59XG5mdW5jdGlvbiBjcmVhdGVMaXN0ZW5lcigpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gaGFuZGxlcihldmVudCkge1xuICAgICAgICBoYW5kbGVFdmVudChldmVudCwgaGFuZGxlci52bm9kZSk7XG4gICAgfTtcbn1cbmZ1bmN0aW9uIHVwZGF0ZUV2ZW50TGlzdGVuZXJzKG9sZFZub2RlLCB2bm9kZSkge1xuICAgIHZhciBvbGRPbiA9IG9sZFZub2RlLmRhdGEub24sIG9sZExpc3RlbmVyID0gb2xkVm5vZGUubGlzdGVuZXIsIG9sZEVsbSA9IG9sZFZub2RlLmVsbSwgb24gPSB2bm9kZSAmJiB2bm9kZS5kYXRhLm9uLCBlbG0gPSAodm5vZGUgJiYgdm5vZGUuZWxtKSwgbmFtZTtcbiAgICAvLyBvcHRpbWl6YXRpb24gZm9yIHJldXNlZCBpbW11dGFibGUgaGFuZGxlcnNcbiAgICBpZiAob2xkT24gPT09IG9uKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gcmVtb3ZlIGV4aXN0aW5nIGxpc3RlbmVycyB3aGljaCBubyBsb25nZXIgdXNlZFxuICAgIGlmIChvbGRPbiAmJiBvbGRMaXN0ZW5lcikge1xuICAgICAgICAvLyBpZiBlbGVtZW50IGNoYW5nZWQgb3IgZGVsZXRlZCB3ZSByZW1vdmUgYWxsIGV4aXN0aW5nIGxpc3RlbmVycyB1bmNvbmRpdGlvbmFsbHlcbiAgICAgICAgaWYgKCFvbikge1xuICAgICAgICAgICAgZm9yIChuYW1lIGluIG9sZE9uKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGxpc3RlbmVyIGlmIGVsZW1lbnQgd2FzIGNoYW5nZWQgb3IgZXhpc3RpbmcgbGlzdGVuZXJzIHJlbW92ZWRcbiAgICAgICAgICAgICAgICBvbGRFbG0ucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBvbGRMaXN0ZW5lciwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZm9yIChuYW1lIGluIG9sZE9uKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGxpc3RlbmVyIGlmIGV4aXN0aW5nIGxpc3RlbmVyIHJlbW92ZWRcbiAgICAgICAgICAgICAgICBpZiAoIW9uW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgIG9sZEVsbS5yZW1vdmVFdmVudExpc3RlbmVyKG5hbWUsIG9sZExpc3RlbmVyLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vIGFkZCBuZXcgbGlzdGVuZXJzIHdoaWNoIGhhcyBub3QgYWxyZWFkeSBhdHRhY2hlZFxuICAgIGlmIChvbikge1xuICAgICAgICAvLyByZXVzZSBleGlzdGluZyBsaXN0ZW5lciBvciBjcmVhdGUgbmV3XG4gICAgICAgIHZhciBsaXN0ZW5lciA9IHZub2RlLmxpc3RlbmVyID0gb2xkVm5vZGUubGlzdGVuZXIgfHwgY3JlYXRlTGlzdGVuZXIoKTtcbiAgICAgICAgLy8gdXBkYXRlIHZub2RlIGZvciBsaXN0ZW5lclxuICAgICAgICBsaXN0ZW5lci52bm9kZSA9IHZub2RlO1xuICAgICAgICAvLyBpZiBlbGVtZW50IGNoYW5nZWQgb3IgYWRkZWQgd2UgYWRkIGFsbCBuZWVkZWQgbGlzdGVuZXJzIHVuY29uZGl0aW9uYWxseVxuICAgICAgICBpZiAoIW9sZE9uKSB7XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gb24pIHtcbiAgICAgICAgICAgICAgICAvLyBhZGQgbGlzdGVuZXIgaWYgZWxlbWVudCB3YXMgY2hhbmdlZCBvciBuZXcgbGlzdGVuZXJzIGFkZGVkXG4gICAgICAgICAgICAgICAgZWxtLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgbGlzdGVuZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGZvciAobmFtZSBpbiBvbikge1xuICAgICAgICAgICAgICAgIC8vIGFkZCBsaXN0ZW5lciBpZiBuZXcgbGlzdGVuZXIgYWRkZWRcbiAgICAgICAgICAgICAgICBpZiAoIW9sZE9uW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsbS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGxpc3RlbmVyLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuZXhwb3J0cy5ldmVudExpc3RlbmVyc01vZHVsZSA9IHtcbiAgICBjcmVhdGU6IHVwZGF0ZUV2ZW50TGlzdGVuZXJzLFxuICAgIHVwZGF0ZTogdXBkYXRlRXZlbnRMaXN0ZW5lcnMsXG4gICAgZGVzdHJveTogdXBkYXRlRXZlbnRMaXN0ZW5lcnNcbn07XG5leHBvcnRzLmRlZmF1bHQgPSBleHBvcnRzLmV2ZW50TGlzdGVuZXJzTW9kdWxlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZXZlbnRsaXN0ZW5lcnMuanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG5mdW5jdGlvbiB1cGRhdGVQcm9wcyhvbGRWbm9kZSwgdm5vZGUpIHtcbiAgICB2YXIga2V5LCBjdXIsIG9sZCwgZWxtID0gdm5vZGUuZWxtLCBvbGRQcm9wcyA9IG9sZFZub2RlLmRhdGEucHJvcHMsIHByb3BzID0gdm5vZGUuZGF0YS5wcm9wcztcbiAgICBpZiAoIW9sZFByb3BzICYmICFwcm9wcylcbiAgICAgICAgcmV0dXJuO1xuICAgIGlmIChvbGRQcm9wcyA9PT0gcHJvcHMpXG4gICAgICAgIHJldHVybjtcbiAgICBvbGRQcm9wcyA9IG9sZFByb3BzIHx8IHt9O1xuICAgIHByb3BzID0gcHJvcHMgfHwge307XG4gICAgZm9yIChrZXkgaW4gb2xkUHJvcHMpIHtcbiAgICAgICAgaWYgKCFwcm9wc1trZXldKSB7XG4gICAgICAgICAgICBkZWxldGUgZWxtW2tleV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgZm9yIChrZXkgaW4gcHJvcHMpIHtcbiAgICAgICAgY3VyID0gcHJvcHNba2V5XTtcbiAgICAgICAgb2xkID0gb2xkUHJvcHNba2V5XTtcbiAgICAgICAgaWYgKG9sZCAhPT0gY3VyICYmIChrZXkgIT09ICd2YWx1ZScgfHwgZWxtW2tleV0gIT09IGN1cikpIHtcbiAgICAgICAgICAgIGVsbVtrZXldID0gY3VyO1xuICAgICAgICB9XG4gICAgfVxufVxuZXhwb3J0cy5wcm9wc01vZHVsZSA9IHsgY3JlYXRlOiB1cGRhdGVQcm9wcywgdXBkYXRlOiB1cGRhdGVQcm9wcyB9O1xuZXhwb3J0cy5kZWZhdWx0ID0gZXhwb3J0cy5wcm9wc01vZHVsZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXByb3BzLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xudmFyIHZub2RlXzEgPSByZXF1aXJlKFwiLi92bm9kZVwiKTtcbnZhciBpcyA9IHJlcXVpcmUoXCIuL2lzXCIpO1xudmFyIGh0bWxkb21hcGlfMSA9IHJlcXVpcmUoXCIuL2h0bWxkb21hcGlcIik7XG5mdW5jdGlvbiBpc1VuZGVmKHMpIHsgcmV0dXJuIHMgPT09IHVuZGVmaW5lZDsgfVxuZnVuY3Rpb24gaXNEZWYocykgeyByZXR1cm4gcyAhPT0gdW5kZWZpbmVkOyB9XG52YXIgZW1wdHlOb2RlID0gdm5vZGVfMS5kZWZhdWx0KCcnLCB7fSwgW10sIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcbmZ1bmN0aW9uIHNhbWVWbm9kZSh2bm9kZTEsIHZub2RlMikge1xuICAgIHJldHVybiB2bm9kZTEua2V5ID09PSB2bm9kZTIua2V5ICYmIHZub2RlMS5zZWwgPT09IHZub2RlMi5zZWw7XG59XG5mdW5jdGlvbiBpc1Zub2RlKHZub2RlKSB7XG4gICAgcmV0dXJuIHZub2RlLnNlbCAhPT0gdW5kZWZpbmVkO1xufVxuZnVuY3Rpb24gY3JlYXRlS2V5VG9PbGRJZHgoY2hpbGRyZW4sIGJlZ2luSWR4LCBlbmRJZHgpIHtcbiAgICB2YXIgaSwgbWFwID0ge30sIGtleSwgY2g7XG4gICAgZm9yIChpID0gYmVnaW5JZHg7IGkgPD0gZW5kSWR4OyArK2kpIHtcbiAgICAgICAgY2ggPSBjaGlsZHJlbltpXTtcbiAgICAgICAgaWYgKGNoICE9IG51bGwpIHtcbiAgICAgICAgICAgIGtleSA9IGNoLmtleTtcbiAgICAgICAgICAgIGlmIChrZXkgIT09IHVuZGVmaW5lZClcbiAgICAgICAgICAgICAgICBtYXBba2V5XSA9IGk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG1hcDtcbn1cbnZhciBob29rcyA9IFsnY3JlYXRlJywgJ3VwZGF0ZScsICdyZW1vdmUnLCAnZGVzdHJveScsICdwcmUnLCAncG9zdCddO1xudmFyIGhfMSA9IHJlcXVpcmUoXCIuL2hcIik7XG5leHBvcnRzLmggPSBoXzEuaDtcbnZhciB0aHVua18xID0gcmVxdWlyZShcIi4vdGh1bmtcIik7XG5leHBvcnRzLnRodW5rID0gdGh1bmtfMS50aHVuaztcbmZ1bmN0aW9uIGluaXQobW9kdWxlcywgZG9tQXBpKSB7XG4gICAgdmFyIGksIGosIGNicyA9IHt9O1xuICAgIHZhciBhcGkgPSBkb21BcGkgIT09IHVuZGVmaW5lZCA/IGRvbUFwaSA6IGh0bWxkb21hcGlfMS5kZWZhdWx0O1xuICAgIGZvciAoaSA9IDA7IGkgPCBob29rcy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjYnNbaG9va3NbaV1dID0gW107XG4gICAgICAgIGZvciAoaiA9IDA7IGogPCBtb2R1bGVzLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICB2YXIgaG9vayA9IG1vZHVsZXNbal1baG9va3NbaV1dO1xuICAgICAgICAgICAgaWYgKGhvb2sgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNic1tob29rc1tpXV0ucHVzaChob29rKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBmdW5jdGlvbiBlbXB0eU5vZGVBdChlbG0pIHtcbiAgICAgICAgdmFyIGlkID0gZWxtLmlkID8gJyMnICsgZWxtLmlkIDogJyc7XG4gICAgICAgIHZhciBjID0gZWxtLmNsYXNzTmFtZSA/ICcuJyArIGVsbS5jbGFzc05hbWUuc3BsaXQoJyAnKS5qb2luKCcuJykgOiAnJztcbiAgICAgICAgcmV0dXJuIHZub2RlXzEuZGVmYXVsdChhcGkudGFnTmFtZShlbG0pLnRvTG93ZXJDYXNlKCkgKyBpZCArIGMsIHt9LCBbXSwgdW5kZWZpbmVkLCBlbG0pO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjcmVhdGVSbUNiKGNoaWxkRWxtLCBsaXN0ZW5lcnMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIHJtQ2IoKSB7XG4gICAgICAgICAgICBpZiAoLS1saXN0ZW5lcnMgPT09IDApIHtcbiAgICAgICAgICAgICAgICB2YXIgcGFyZW50XzEgPSBhcGkucGFyZW50Tm9kZShjaGlsZEVsbSk7XG4gICAgICAgICAgICAgICAgYXBpLnJlbW92ZUNoaWxkKHBhcmVudF8xLCBjaGlsZEVsbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuICAgIGZ1bmN0aW9uIGNyZWF0ZUVsbSh2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSB7XG4gICAgICAgIHZhciBpLCBkYXRhID0gdm5vZGUuZGF0YTtcbiAgICAgICAgaWYgKGRhdGEgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGlzRGVmKGkgPSBkYXRhLmhvb2spICYmIGlzRGVmKGkgPSBpLmluaXQpKSB7XG4gICAgICAgICAgICAgICAgaSh2bm9kZSk7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHZub2RlLmRhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW4sIHNlbCA9IHZub2RlLnNlbDtcbiAgICAgICAgaWYgKHNlbCA9PT0gJyEnKSB7XG4gICAgICAgICAgICBpZiAoaXNVbmRlZih2bm9kZS50ZXh0KSkge1xuICAgICAgICAgICAgICAgIHZub2RlLnRleHQgPSAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZub2RlLmVsbSA9IGFwaS5jcmVhdGVDb21tZW50KHZub2RlLnRleHQpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNlbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBQYXJzZSBzZWxlY3RvclxuICAgICAgICAgICAgdmFyIGhhc2hJZHggPSBzZWwuaW5kZXhPZignIycpO1xuICAgICAgICAgICAgdmFyIGRvdElkeCA9IHNlbC5pbmRleE9mKCcuJywgaGFzaElkeCk7XG4gICAgICAgICAgICB2YXIgaGFzaCA9IGhhc2hJZHggPiAwID8gaGFzaElkeCA6IHNlbC5sZW5ndGg7XG4gICAgICAgICAgICB2YXIgZG90ID0gZG90SWR4ID4gMCA/IGRvdElkeCA6IHNlbC5sZW5ndGg7XG4gICAgICAgICAgICB2YXIgdGFnID0gaGFzaElkeCAhPT0gLTEgfHwgZG90SWR4ICE9PSAtMSA/IHNlbC5zbGljZSgwLCBNYXRoLm1pbihoYXNoLCBkb3QpKSA6IHNlbDtcbiAgICAgICAgICAgIHZhciBlbG0gPSB2bm9kZS5lbG0gPSBpc0RlZihkYXRhKSAmJiBpc0RlZihpID0gZGF0YS5ucykgPyBhcGkuY3JlYXRlRWxlbWVudE5TKGksIHRhZylcbiAgICAgICAgICAgICAgICA6IGFwaS5jcmVhdGVFbGVtZW50KHRhZyk7XG4gICAgICAgICAgICBpZiAoaGFzaCA8IGRvdClcbiAgICAgICAgICAgICAgICBlbG0uc2V0QXR0cmlidXRlKCdpZCcsIHNlbC5zbGljZShoYXNoICsgMSwgZG90KSk7XG4gICAgICAgICAgICBpZiAoZG90SWR4ID4gMClcbiAgICAgICAgICAgICAgICBlbG0uc2V0QXR0cmlidXRlKCdjbGFzcycsIHNlbC5zbGljZShkb3QgKyAxKS5yZXBsYWNlKC9cXC4vZywgJyAnKSk7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLmNyZWF0ZS5sZW5ndGg7ICsraSlcbiAgICAgICAgICAgICAgICBjYnMuY3JlYXRlW2ldKGVtcHR5Tm9kZSwgdm5vZGUpO1xuICAgICAgICAgICAgaWYgKGlzLmFycmF5KGNoaWxkcmVuKSkge1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2ggPSBjaGlsZHJlbltpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwaS5hcHBlbmRDaGlsZChlbG0sIGNyZWF0ZUVsbShjaCwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChpcy5wcmltaXRpdmUodm5vZGUudGV4dCkpIHtcbiAgICAgICAgICAgICAgICBhcGkuYXBwZW5kQ2hpbGQoZWxtLCBhcGkuY3JlYXRlVGV4dE5vZGUodm5vZGUudGV4dCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSA9IHZub2RlLmRhdGEuaG9vazsgLy8gUmV1c2UgdmFyaWFibGVcbiAgICAgICAgICAgIGlmIChpc0RlZihpKSkge1xuICAgICAgICAgICAgICAgIGlmIChpLmNyZWF0ZSlcbiAgICAgICAgICAgICAgICAgICAgaS5jcmVhdGUoZW1wdHlOb2RlLCB2bm9kZSk7XG4gICAgICAgICAgICAgICAgaWYgKGkuaW5zZXJ0KVxuICAgICAgICAgICAgICAgICAgICBpbnNlcnRlZFZub2RlUXVldWUucHVzaCh2bm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2bm9kZS5lbG0gPSBhcGkuY3JlYXRlVGV4dE5vZGUodm5vZGUudGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZub2RlLmVsbTtcbiAgICB9XG4gICAgZnVuY3Rpb24gYWRkVm5vZGVzKHBhcmVudEVsbSwgYmVmb3JlLCB2bm9kZXMsIHN0YXJ0SWR4LCBlbmRJZHgsIGluc2VydGVkVm5vZGVRdWV1ZSkge1xuICAgICAgICBmb3IgKDsgc3RhcnRJZHggPD0gZW5kSWR4OyArK3N0YXJ0SWR4KSB7XG4gICAgICAgICAgICB2YXIgY2ggPSB2bm9kZXNbc3RhcnRJZHhdO1xuICAgICAgICAgICAgaWYgKGNoICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgY3JlYXRlRWxtKGNoLCBpbnNlcnRlZFZub2RlUXVldWUpLCBiZWZvcmUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIGludm9rZURlc3Ryb3lIb29rKHZub2RlKSB7XG4gICAgICAgIHZhciBpLCBqLCBkYXRhID0gdm5vZGUuZGF0YTtcbiAgICAgICAgaWYgKGRhdGEgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGlzRGVmKGkgPSBkYXRhLmhvb2spICYmIGlzRGVmKGkgPSBpLmRlc3Ryb3kpKVxuICAgICAgICAgICAgICAgIGkodm5vZGUpO1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGNicy5kZXN0cm95Lmxlbmd0aDsgKytpKVxuICAgICAgICAgICAgICAgIGNicy5kZXN0cm95W2ldKHZub2RlKTtcbiAgICAgICAgICAgIGlmICh2bm9kZS5jaGlsZHJlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHZub2RlLmNoaWxkcmVuLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICAgICAgICAgIGkgPSB2bm9kZS5jaGlsZHJlbltqXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgIT0gbnVsbCAmJiB0eXBlb2YgaSAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW52b2tlRGVzdHJveUhvb2soaSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZnVuY3Rpb24gcmVtb3ZlVm5vZGVzKHBhcmVudEVsbSwgdm5vZGVzLCBzdGFydElkeCwgZW5kSWR4KSB7XG4gICAgICAgIGZvciAoOyBzdGFydElkeCA8PSBlbmRJZHg7ICsrc3RhcnRJZHgpIHtcbiAgICAgICAgICAgIHZhciBpXzEgPSB2b2lkIDAsIGxpc3RlbmVycyA9IHZvaWQgMCwgcm0gPSB2b2lkIDAsIGNoID0gdm5vZGVzW3N0YXJ0SWR4XTtcbiAgICAgICAgICAgIGlmIChjaCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzRGVmKGNoLnNlbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW52b2tlRGVzdHJveUhvb2soY2gpO1xuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBjYnMucmVtb3ZlLmxlbmd0aCArIDE7XG4gICAgICAgICAgICAgICAgICAgIHJtID0gY3JlYXRlUm1DYihjaC5lbG0sIGxpc3RlbmVycyk7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaV8xID0gMDsgaV8xIDwgY2JzLnJlbW92ZS5sZW5ndGg7ICsraV8xKVxuICAgICAgICAgICAgICAgICAgICAgICAgY2JzLnJlbW92ZVtpXzFdKGNoLCBybSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0RlZihpXzEgPSBjaC5kYXRhKSAmJiBpc0RlZihpXzEgPSBpXzEuaG9vaykgJiYgaXNEZWYoaV8xID0gaV8xLnJlbW92ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlfMShjaCwgcm0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcm0oKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgYXBpLnJlbW92ZUNoaWxkKHBhcmVudEVsbSwgY2guZWxtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZnVuY3Rpb24gdXBkYXRlQ2hpbGRyZW4ocGFyZW50RWxtLCBvbGRDaCwgbmV3Q2gsIGluc2VydGVkVm5vZGVRdWV1ZSkge1xuICAgICAgICB2YXIgb2xkU3RhcnRJZHggPSAwLCBuZXdTdGFydElkeCA9IDA7XG4gICAgICAgIHZhciBvbGRFbmRJZHggPSBvbGRDaC5sZW5ndGggLSAxO1xuICAgICAgICB2YXIgb2xkU3RhcnRWbm9kZSA9IG9sZENoWzBdO1xuICAgICAgICB2YXIgb2xkRW5kVm5vZGUgPSBvbGRDaFtvbGRFbmRJZHhdO1xuICAgICAgICB2YXIgbmV3RW5kSWR4ID0gbmV3Q2gubGVuZ3RoIC0gMTtcbiAgICAgICAgdmFyIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFswXTtcbiAgICAgICAgdmFyIG5ld0VuZFZub2RlID0gbmV3Q2hbbmV3RW5kSWR4XTtcbiAgICAgICAgdmFyIG9sZEtleVRvSWR4O1xuICAgICAgICB2YXIgaWR4SW5PbGQ7XG4gICAgICAgIHZhciBlbG1Ub01vdmU7XG4gICAgICAgIHZhciBiZWZvcmU7XG4gICAgICAgIHdoaWxlIChvbGRTdGFydElkeCA8PSBvbGRFbmRJZHggJiYgbmV3U3RhcnRJZHggPD0gbmV3RW5kSWR4KSB7XG4gICAgICAgICAgICBpZiAob2xkU3RhcnRWbm9kZSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgb2xkU3RhcnRWbm9kZSA9IG9sZENoWysrb2xkU3RhcnRJZHhdOyAvLyBWbm9kZSBtaWdodCBoYXZlIGJlZW4gbW92ZWQgbGVmdFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAob2xkRW5kVm5vZGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIG9sZEVuZFZub2RlID0gb2xkQ2hbLS1vbGRFbmRJZHhdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAobmV3U3RhcnRWbm9kZSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWysrbmV3U3RhcnRJZHhdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAobmV3RW5kVm5vZGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIG5ld0VuZFZub2RlID0gbmV3Q2hbLS1uZXdFbmRJZHhdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoc2FtZVZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld1N0YXJ0Vm5vZGUpKSB7XG4gICAgICAgICAgICAgICAgcGF0Y2hWbm9kZShvbGRTdGFydFZub2RlLCBuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICAgICAgICAgIG9sZFN0YXJ0Vm5vZGUgPSBvbGRDaFsrK29sZFN0YXJ0SWR4XTtcbiAgICAgICAgICAgICAgICBuZXdTdGFydFZub2RlID0gbmV3Q2hbKytuZXdTdGFydElkeF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChzYW1lVm5vZGUob2xkRW5kVm5vZGUsIG5ld0VuZFZub2RlKSkge1xuICAgICAgICAgICAgICAgIHBhdGNoVm5vZGUob2xkRW5kVm5vZGUsIG5ld0VuZFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICAgICAgICAgIG9sZEVuZFZub2RlID0gb2xkQ2hbLS1vbGRFbmRJZHhdO1xuICAgICAgICAgICAgICAgIG5ld0VuZFZub2RlID0gbmV3Q2hbLS1uZXdFbmRJZHhdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoc2FtZVZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld0VuZFZub2RlKSkge1xuICAgICAgICAgICAgICAgIHBhdGNoVm5vZGUob2xkU3RhcnRWbm9kZSwgbmV3RW5kVm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgICAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIG9sZFN0YXJ0Vm5vZGUuZWxtLCBhcGkubmV4dFNpYmxpbmcob2xkRW5kVm5vZGUuZWxtKSk7XG4gICAgICAgICAgICAgICAgb2xkU3RhcnRWbm9kZSA9IG9sZENoWysrb2xkU3RhcnRJZHhdO1xuICAgICAgICAgICAgICAgIG5ld0VuZFZub2RlID0gbmV3Q2hbLS1uZXdFbmRJZHhdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoc2FtZVZub2RlKG9sZEVuZFZub2RlLCBuZXdTdGFydFZub2RlKSkge1xuICAgICAgICAgICAgICAgIHBhdGNoVm5vZGUob2xkRW5kVm5vZGUsIG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgICAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIG9sZEVuZFZub2RlLmVsbSwgb2xkU3RhcnRWbm9kZS5lbG0pO1xuICAgICAgICAgICAgICAgIG9sZEVuZFZub2RlID0gb2xkQ2hbLS1vbGRFbmRJZHhdO1xuICAgICAgICAgICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChvbGRLZXlUb0lkeCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIG9sZEtleVRvSWR4ID0gY3JlYXRlS2V5VG9PbGRJZHgob2xkQ2gsIG9sZFN0YXJ0SWR4LCBvbGRFbmRJZHgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZHhJbk9sZCA9IG9sZEtleVRvSWR4W25ld1N0YXJ0Vm5vZGUua2V5XTtcbiAgICAgICAgICAgICAgICBpZiAoaXNVbmRlZihpZHhJbk9sZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIGNyZWF0ZUVsbShuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpLCBvbGRTdGFydFZub2RlLmVsbSk7XG4gICAgICAgICAgICAgICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVsbVRvTW92ZSA9IG9sZENoW2lkeEluT2xkXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVsbVRvTW92ZS5zZWwgIT09IG5ld1N0YXJ0Vm5vZGUuc2VsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgY3JlYXRlRWxtKG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSksIG9sZFN0YXJ0Vm5vZGUuZWxtKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGNoVm5vZGUoZWxtVG9Nb3ZlLCBuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb2xkQ2hbaWR4SW5PbGRdID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIGVsbVRvTW92ZS5lbG0sIG9sZFN0YXJ0Vm5vZGUuZWxtKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBuZXdTdGFydFZub2RlID0gbmV3Q2hbKytuZXdTdGFydElkeF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChvbGRTdGFydElkeCA8PSBvbGRFbmRJZHggfHwgbmV3U3RhcnRJZHggPD0gbmV3RW5kSWR4KSB7XG4gICAgICAgICAgICBpZiAob2xkU3RhcnRJZHggPiBvbGRFbmRJZHgpIHtcbiAgICAgICAgICAgICAgICBiZWZvcmUgPSBuZXdDaFtuZXdFbmRJZHggKyAxXSA9PSBudWxsID8gbnVsbCA6IG5ld0NoW25ld0VuZElkeCArIDFdLmVsbTtcbiAgICAgICAgICAgICAgICBhZGRWbm9kZXMocGFyZW50RWxtLCBiZWZvcmUsIG5ld0NoLCBuZXdTdGFydElkeCwgbmV3RW5kSWR4LCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlVm5vZGVzKHBhcmVudEVsbSwgb2xkQ2gsIG9sZFN0YXJ0SWR4LCBvbGRFbmRJZHgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIHBhdGNoVm5vZGUob2xkVm5vZGUsIHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpIHtcbiAgICAgICAgdmFyIGksIGhvb2s7XG4gICAgICAgIGlmIChpc0RlZihpID0gdm5vZGUuZGF0YSkgJiYgaXNEZWYoaG9vayA9IGkuaG9vaykgJiYgaXNEZWYoaSA9IGhvb2sucHJlcGF0Y2gpKSB7XG4gICAgICAgICAgICBpKG9sZFZub2RlLCB2bm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGVsbSA9IHZub2RlLmVsbSA9IG9sZFZub2RlLmVsbTtcbiAgICAgICAgdmFyIG9sZENoID0gb2xkVm5vZGUuY2hpbGRyZW47XG4gICAgICAgIHZhciBjaCA9IHZub2RlLmNoaWxkcmVuO1xuICAgICAgICBpZiAob2xkVm5vZGUgPT09IHZub2RlKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBpZiAodm5vZGUuZGF0YSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnVwZGF0ZS5sZW5ndGg7ICsraSlcbiAgICAgICAgICAgICAgICBjYnMudXBkYXRlW2ldKG9sZFZub2RlLCB2bm9kZSk7XG4gICAgICAgICAgICBpID0gdm5vZGUuZGF0YS5ob29rO1xuICAgICAgICAgICAgaWYgKGlzRGVmKGkpICYmIGlzRGVmKGkgPSBpLnVwZGF0ZSkpXG4gICAgICAgICAgICAgICAgaShvbGRWbm9kZSwgdm5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc1VuZGVmKHZub2RlLnRleHQpKSB7XG4gICAgICAgICAgICBpZiAoaXNEZWYob2xkQ2gpICYmIGlzRGVmKGNoKSkge1xuICAgICAgICAgICAgICAgIGlmIChvbGRDaCAhPT0gY2gpXG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZUNoaWxkcmVuKGVsbSwgb2xkQ2gsIGNoLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaXNEZWYoY2gpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzRGVmKG9sZFZub2RlLnRleHQpKVxuICAgICAgICAgICAgICAgICAgICBhcGkuc2V0VGV4dENvbnRlbnQoZWxtLCAnJyk7XG4gICAgICAgICAgICAgICAgYWRkVm5vZGVzKGVsbSwgbnVsbCwgY2gsIDAsIGNoLmxlbmd0aCAtIDEsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChpc0RlZihvbGRDaCkpIHtcbiAgICAgICAgICAgICAgICByZW1vdmVWbm9kZXMoZWxtLCBvbGRDaCwgMCwgb2xkQ2gubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChpc0RlZihvbGRWbm9kZS50ZXh0KSkge1xuICAgICAgICAgICAgICAgIGFwaS5zZXRUZXh0Q29udGVudChlbG0sICcnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChvbGRWbm9kZS50ZXh0ICE9PSB2bm9kZS50ZXh0KSB7XG4gICAgICAgICAgICBpZiAoaXNEZWYob2xkQ2gpKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlVm5vZGVzKGVsbSwgb2xkQ2gsIDAsIG9sZENoLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXBpLnNldFRleHRDb250ZW50KGVsbSwgdm5vZGUudGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzRGVmKGhvb2spICYmIGlzRGVmKGkgPSBob29rLnBvc3RwYXRjaCkpIHtcbiAgICAgICAgICAgIGkob2xkVm5vZGUsIHZub2RlKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZnVuY3Rpb24gcGF0Y2gob2xkVm5vZGUsIHZub2RlKSB7XG4gICAgICAgIHZhciBpLCBlbG0sIHBhcmVudDtcbiAgICAgICAgdmFyIGluc2VydGVkVm5vZGVRdWV1ZSA9IFtdO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnByZS5sZW5ndGg7ICsraSlcbiAgICAgICAgICAgIGNicy5wcmVbaV0oKTtcbiAgICAgICAgaWYgKCFpc1Zub2RlKG9sZFZub2RlKSkge1xuICAgICAgICAgICAgb2xkVm5vZGUgPSBlbXB0eU5vZGVBdChvbGRWbm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNhbWVWbm9kZShvbGRWbm9kZSwgdm5vZGUpKSB7XG4gICAgICAgICAgICBwYXRjaFZub2RlKG9sZFZub2RlLCB2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGVsbSA9IG9sZFZub2RlLmVsbTtcbiAgICAgICAgICAgIHBhcmVudCA9IGFwaS5wYXJlbnROb2RlKGVsbSk7XG4gICAgICAgICAgICBjcmVhdGVFbG0odm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgICAgICBpZiAocGFyZW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnQsIHZub2RlLmVsbSwgYXBpLm5leHRTaWJsaW5nKGVsbSkpO1xuICAgICAgICAgICAgICAgIHJlbW92ZVZub2RlcyhwYXJlbnQsIFtvbGRWbm9kZV0sIDAsIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBpbnNlcnRlZFZub2RlUXVldWUubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGluc2VydGVkVm5vZGVRdWV1ZVtpXS5kYXRhLmhvb2suaW5zZXJ0KGluc2VydGVkVm5vZGVRdWV1ZVtpXSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGNicy5wb3N0Lmxlbmd0aDsgKytpKVxuICAgICAgICAgICAgY2JzLnBvc3RbaV0oKTtcbiAgICAgICAgcmV0dXJuIHZub2RlO1xuICAgIH07XG59XG5leHBvcnRzLmluaXQgPSBpbml0O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c25hYmJkb20uanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG52YXIgaF8xID0gcmVxdWlyZShcIi4vaFwiKTtcbmZ1bmN0aW9uIGNvcHlUb1RodW5rKHZub2RlLCB0aHVuaykge1xuICAgIHRodW5rLmVsbSA9IHZub2RlLmVsbTtcbiAgICB2bm9kZS5kYXRhLmZuID0gdGh1bmsuZGF0YS5mbjtcbiAgICB2bm9kZS5kYXRhLmFyZ3MgPSB0aHVuay5kYXRhLmFyZ3M7XG4gICAgdGh1bmsuZGF0YSA9IHZub2RlLmRhdGE7XG4gICAgdGh1bmsuY2hpbGRyZW4gPSB2bm9kZS5jaGlsZHJlbjtcbiAgICB0aHVuay50ZXh0ID0gdm5vZGUudGV4dDtcbiAgICB0aHVuay5lbG0gPSB2bm9kZS5lbG07XG59XG5mdW5jdGlvbiBpbml0KHRodW5rKSB7XG4gICAgdmFyIGN1ciA9IHRodW5rLmRhdGE7XG4gICAgdmFyIHZub2RlID0gY3VyLmZuLmFwcGx5KHVuZGVmaW5lZCwgY3VyLmFyZ3MpO1xuICAgIGNvcHlUb1RodW5rKHZub2RlLCB0aHVuayk7XG59XG5mdW5jdGlvbiBwcmVwYXRjaChvbGRWbm9kZSwgdGh1bmspIHtcbiAgICB2YXIgaSwgb2xkID0gb2xkVm5vZGUuZGF0YSwgY3VyID0gdGh1bmsuZGF0YTtcbiAgICB2YXIgb2xkQXJncyA9IG9sZC5hcmdzLCBhcmdzID0gY3VyLmFyZ3M7XG4gICAgaWYgKG9sZC5mbiAhPT0gY3VyLmZuIHx8IG9sZEFyZ3MubGVuZ3RoICE9PSBhcmdzLmxlbmd0aCkge1xuICAgICAgICBjb3B5VG9UaHVuayhjdXIuZm4uYXBwbHkodW5kZWZpbmVkLCBhcmdzKSwgdGh1bmspO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGlmIChvbGRBcmdzW2ldICE9PSBhcmdzW2ldKSB7XG4gICAgICAgICAgICBjb3B5VG9UaHVuayhjdXIuZm4uYXBwbHkodW5kZWZpbmVkLCBhcmdzKSwgdGh1bmspO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfVxuICAgIGNvcHlUb1RodW5rKG9sZFZub2RlLCB0aHVuayk7XG59XG5leHBvcnRzLnRodW5rID0gZnVuY3Rpb24gdGh1bmsoc2VsLCBrZXksIGZuLCBhcmdzKSB7XG4gICAgaWYgKGFyZ3MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBhcmdzID0gZm47XG4gICAgICAgIGZuID0ga2V5O1xuICAgICAgICBrZXkgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiBoXzEuaChzZWwsIHtcbiAgICAgICAga2V5OiBrZXksXG4gICAgICAgIGhvb2s6IHsgaW5pdDogaW5pdCwgcHJlcGF0Y2g6IHByZXBhdGNoIH0sXG4gICAgICAgIGZuOiBmbixcbiAgICAgICAgYXJnczogYXJnc1xuICAgIH0pO1xufTtcbmV4cG9ydHMuZGVmYXVsdCA9IGV4cG9ydHMudGh1bms7XG4vLyMgc291cmNlTWFwcGluZ1VSTD10aHVuay5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbnZhciB2bm9kZV8xID0gcmVxdWlyZShcIi4vdm5vZGVcIik7XG52YXIgaHRtbGRvbWFwaV8xID0gcmVxdWlyZShcIi4vaHRtbGRvbWFwaVwiKTtcbmZ1bmN0aW9uIHRvVk5vZGUobm9kZSwgZG9tQXBpKSB7XG4gICAgdmFyIGFwaSA9IGRvbUFwaSAhPT0gdW5kZWZpbmVkID8gZG9tQXBpIDogaHRtbGRvbWFwaV8xLmRlZmF1bHQ7XG4gICAgdmFyIHRleHQ7XG4gICAgaWYgKGFwaS5pc0VsZW1lbnQobm9kZSkpIHtcbiAgICAgICAgdmFyIGlkID0gbm9kZS5pZCA/ICcjJyArIG5vZGUuaWQgOiAnJztcbiAgICAgICAgdmFyIGNuID0gbm9kZS5nZXRBdHRyaWJ1dGUoJ2NsYXNzJyk7XG4gICAgICAgIHZhciBjID0gY24gPyAnLicgKyBjbi5zcGxpdCgnICcpLmpvaW4oJy4nKSA6ICcnO1xuICAgICAgICB2YXIgc2VsID0gYXBpLnRhZ05hbWUobm9kZSkudG9Mb3dlckNhc2UoKSArIGlkICsgYztcbiAgICAgICAgdmFyIGF0dHJzID0ge307XG4gICAgICAgIHZhciBjaGlsZHJlbiA9IFtdO1xuICAgICAgICB2YXIgbmFtZV8xO1xuICAgICAgICB2YXIgaSA9IHZvaWQgMCwgbiA9IHZvaWQgMDtcbiAgICAgICAgdmFyIGVsbUF0dHJzID0gbm9kZS5hdHRyaWJ1dGVzO1xuICAgICAgICB2YXIgZWxtQ2hpbGRyZW4gPSBub2RlLmNoaWxkTm9kZXM7XG4gICAgICAgIGZvciAoaSA9IDAsIG4gPSBlbG1BdHRycy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgIG5hbWVfMSA9IGVsbUF0dHJzW2ldLm5vZGVOYW1lO1xuICAgICAgICAgICAgaWYgKG5hbWVfMSAhPT0gJ2lkJyAmJiBuYW1lXzEgIT09ICdjbGFzcycpIHtcbiAgICAgICAgICAgICAgICBhdHRyc1tuYW1lXzFdID0gZWxtQXR0cnNbaV0ubm9kZVZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IDAsIG4gPSBlbG1DaGlsZHJlbi5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgIGNoaWxkcmVuLnB1c2godG9WTm9kZShlbG1DaGlsZHJlbltpXSwgZG9tQXBpKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZub2RlXzEuZGVmYXVsdChzZWwsIHsgYXR0cnM6IGF0dHJzIH0sIGNoaWxkcmVuLCB1bmRlZmluZWQsIG5vZGUpO1xuICAgIH1cbiAgICBlbHNlIGlmIChhcGkuaXNUZXh0KG5vZGUpKSB7XG4gICAgICAgIHRleHQgPSBhcGkuZ2V0VGV4dENvbnRlbnQobm9kZSk7XG4gICAgICAgIHJldHVybiB2bm9kZV8xLmRlZmF1bHQodW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdGV4dCwgbm9kZSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGFwaS5pc0NvbW1lbnQobm9kZSkpIHtcbiAgICAgICAgdGV4dCA9IGFwaS5nZXRUZXh0Q29udGVudChub2RlKTtcbiAgICAgICAgcmV0dXJuIHZub2RlXzEuZGVmYXVsdCgnIScsIHt9LCBbXSwgdGV4dCwgbm9kZSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gdm5vZGVfMS5kZWZhdWx0KCcnLCB7fSwgW10sIHVuZGVmaW5lZCwgbm9kZSk7XG4gICAgfVxufVxuZXhwb3J0cy50b1ZOb2RlID0gdG9WTm9kZTtcbmV4cG9ydHMuZGVmYXVsdCA9IHRvVk5vZGU7XG4vLyMgc291cmNlTWFwcGluZ1VSTD10b3Zub2RlLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZnVuY3Rpb24gdm5vZGUoc2VsLCBkYXRhLCBjaGlsZHJlbiwgdGV4dCwgZWxtKSB7XG4gICAgdmFyIGtleSA9IGRhdGEgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IGRhdGEua2V5O1xuICAgIHJldHVybiB7IHNlbDogc2VsLCBkYXRhOiBkYXRhLCBjaGlsZHJlbjogY2hpbGRyZW4sXG4gICAgICAgIHRleHQ6IHRleHQsIGVsbTogZWxtLCBrZXk6IGtleSB9O1xufVxuZXhwb3J0cy52bm9kZSA9IHZub2RlO1xuZXhwb3J0cy5kZWZhdWx0ID0gdm5vZGU7XG4vLyMgc291cmNlTWFwcGluZ1VSTD12bm9kZS5qcy5tYXAiLCJmdW5jdGlvbiBub29wKCkge31cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAodXJsLCBvcHRzKSB7XG5cdG9wdHMgPSBvcHRzIHx8IHt9O1xuXG5cdHZhciB3cywgbnVtPTAsIHRpbWVyPTEsICQ9e307XG5cdHZhciBtYXggPSBvcHRzLm1heEF0dGVtcHRzIHx8IEluZmluaXR5O1xuXG5cdCQub3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0XHR3cyA9IG5ldyBXZWJTb2NrZXQodXJsLCBvcHRzLnByb3RvY29scyB8fCBbXSk7XG5cblx0XHR3cy5vbm1lc3NhZ2UgPSBvcHRzLm9ubWVzc2FnZSB8fCBub29wO1xuXG5cdFx0d3Mub25vcGVuID0gZnVuY3Rpb24gKGUpIHtcblx0XHRcdChvcHRzLm9ub3BlbiB8fCBub29wKShlKTtcblx0XHRcdG51bSA9IDA7XG5cdFx0fTtcblxuXHRcdHdzLm9uY2xvc2UgPSBmdW5jdGlvbiAoZSkge1xuXHRcdFx0ZS5jb2RlID09PSAxZTMgfHwgZS5jb2RlID09PSAxMDAxIHx8IGUuY29kZSA9PT0gMTAwNSB8fCAkLnJlY29ubmVjdChlKTtcblx0XHRcdChvcHRzLm9uY2xvc2UgfHwgbm9vcCkoZSk7XG5cdFx0fTtcblxuXHRcdHdzLm9uZXJyb3IgPSBmdW5jdGlvbiAoZSkge1xuXHRcdFx0KGUgJiYgZS5jb2RlPT09J0VDT05OUkVGVVNFRCcpID8gJC5yZWNvbm5lY3QoZSkgOiAob3B0cy5vbmVycm9yIHx8IG5vb3ApKGUpO1xuXHRcdH07XG5cdH07XG5cblx0JC5yZWNvbm5lY3QgPSBmdW5jdGlvbiAoZSkge1xuXHRcdGlmICh0aW1lciAmJiBudW0rKyA8IG1heCkge1xuXHRcdFx0dGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0KG9wdHMub25yZWNvbm5lY3QgfHwgbm9vcCkoZSk7XG5cdFx0XHRcdCQub3BlbigpO1xuXHRcdFx0fSwgb3B0cy50aW1lb3V0IHx8IDFlMyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdChvcHRzLm9ubWF4aW11bSB8fCBub29wKShlKTtcblx0XHR9XG5cdH07XG5cblx0JC5qc29uID0gZnVuY3Rpb24gKHgpIHtcblx0XHR3cy5zZW5kKEpTT04uc3RyaW5naWZ5KHgpKTtcblx0fTtcblxuXHQkLnNlbmQgPSBmdW5jdGlvbiAoeCkge1xuXHRcdHdzLnNlbmQoeCk7XG5cdH07XG5cblx0JC5jbG9zZSA9IGZ1bmN0aW9uICh4LCB5KSB7XG5cdFx0dGltZXIgPSBjbGVhclRpbWVvdXQodGltZXIpO1xuXHRcdHdzLmNsb3NlKHggfHwgMWUzLCB5KTtcblx0fTtcblxuXHQkLm9wZW4oKTsgLy8gaW5pdFxuXG5cdHJldHVybiAkO1xufVxuIiwiaW1wb3J0IHsgaW5pdCB9IGZyb20gXCJzbmFiYmRvbVwiO1xuaW1wb3J0IGtsYXNzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnO1xuaW1wb3J0IGF0dHJpYnV0ZXMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9hdHRyaWJ1dGVzJztcbmltcG9ydCBwcm9wZXJ0aWVzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvcHJvcHMnO1xuaW1wb3J0IGxpc3RlbmVycyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJztcblxuY29uc3QgcGF0Y2ggPSBpbml0KFtrbGFzcywgYXR0cmlidXRlcywgcHJvcGVydGllcywgbGlzdGVuZXJzXSk7XG5cbmltcG9ydCBoIGZyb20gJ3NuYWJiZG9tL2gnO1xuXG5leHBvcnQgZnVuY3Rpb24gY2hhdFZpZXcgKGN0cmwsIGNoYXRUeXBlKSB7XG4gICAgZnVuY3Rpb24gb25LZXlQcmVzcyAoZSkge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gKGUudGFyZ2V0IGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlXG4gICAgICAgIGlmICgoZS5rZXlDb2RlID09IDEzIHx8IGUud2hpY2ggPT0gMTMpICYmIG1lc3NhZ2UubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY2hhdE1lc3NhZ2UgKGN0cmwubW9kZWxbJ3VzZXJuYW1lJ10sIG1lc3NhZ2UsIGNoYXRUeXBlKTtcbiAgICAgICAgICAgIGN0cmwuc29jay5zZW5kKEpTT04uc3RyaW5naWZ5KHtcInR5cGVcIjogY2hhdFR5cGUsIFwibWVzc2FnZVwiOiBtZXNzYWdlLCBcImdhbWVJZFwiOiBjdHJsLm1vZGVsW1wiZ2FtZUlkXCJdIH0pKTtcbiAgICAgICAgICAgIChlLnRhcmdldCBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZSA9IFwiXCI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gaChgZGl2LiR7Y2hhdFR5cGV9IyR7Y2hhdFR5cGV9YCwgeyBjbGFzczoge1wiY2hhdFwiOiB0cnVlfSB9LCBbXG4gICAgICAgICAgICAgICAgaChgb2wjJHtjaGF0VHlwZX0tbWVzc2FnZXNgLCBbIGgoXCJkaXYjbWVzc2FnZXNcIildKSxcbiAgICAgICAgICAgICAgICBoKCdpbnB1dCNjaGF0LWVudHJ5Jywge1xuICAgICAgICAgICAgICAgICAgICBwcm9wczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJ0ZXh0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBcImVudHJ5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBhdXRvY29tcGxldGU6IFwib2ZmXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcjogXCJQbGVhc2UgYmUgbmljZSBpbiB0aGUgY2hhdCFcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heGxlbmd0aDogXCIxNDBcIixcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgb246IHsga2V5cHJlc3M6IChlKSA9PiBvbktleVByZXNzKGUpIH0sXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIF0pXG4gICAgfVxuXG5leHBvcnQgZnVuY3Rpb24gY2hhdE1lc3NhZ2UgKHVzZXIsIG1lc3NhZ2UsIGNoYXRUeXBlKSB7XG4gICAgY29uc3QgbXlEaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjaGF0VHlwZSArICctbWVzc2FnZXMnKSBhcyBIVE1MRWxlbWVudDtcbiAgICAvLyBZb3UgbXVzdCBhZGQgYm9yZGVyIHdpZHRocywgcGFkZGluZyBhbmQgbWFyZ2lucyB0byB0aGUgcmlnaHQuXG4gICAgY29uc3QgaXNTY3JvbGxlZCA9IG15RGl2LnNjcm9sbFRvcCA9PSBteURpdi5zY3JvbGxIZWlnaHQgLSBteURpdi5vZmZzZXRIZWlnaHQ7XG5cbiAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21lc3NhZ2VzJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgaWYgKHVzZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHBhdGNoKGNvbnRhaW5lciwgaCgnZGl2I21lc3NhZ2VzJywgWyBoKFwibGkubWVzc2FnZS5vZmZlclwiLCBbaChcInRcIiwgbWVzc2FnZSldKSBdKSk7XG4gICAgfSBlbHNlIGlmICh1c2VyID09PSAnX3NlcnZlcicpIHtcbiAgICAgICAgcGF0Y2goY29udGFpbmVyLCBoKCdkaXYjbWVzc2FnZXMnLCBbIGgoXCJsaS5tZXNzYWdlLnNlcnZlclwiLCBbaChcInVzZXJcIiwgJ1NlcnZlcicpLCBoKFwidFwiLCBtZXNzYWdlKV0pIF0pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ2RpdiNtZXNzYWdlcycsIFsgaChcImxpLm1lc3NhZ2VcIiwgW2goXCJ1c2VyXCIsIHVzZXIpLCBoKFwidFwiLCBtZXNzYWdlKV0pIF0pKTtcbiAgICB9O1xuXG4gICAgaWYgKGlzU2Nyb2xsZWQpIG15RGl2LnNjcm9sbFRvcCA9IG15RGl2LnNjcm9sbEhlaWdodDtcbn0iLCJpbXBvcnQgeyBrZXkycG9zIH0gZnJvbSAnY2hlc3Nncm91bmR4L3V0aWwnO1xyXG5pbXBvcnQgeyBDb2xvciwgR2VvbWV0cnksIEtleSwgUm9sZSB9IGZyb20gJ2NoZXNzZ3JvdW5keC90eXBlcyc7XHJcblxyXG5leHBvcnQgY29uc3QgdmFyaWFudHMgPSBbXCJtYWtydWtcIiwgXCJzaXR0dXlpblwiLCBcInBsYWNlbWVudFwiLCBcImNyYXp5aG91c2VcIiwgXCJzdGFuZGFyZFwiLCBcInNob2dpXCIsIFwieGlhbmdxaVwiLCBcImNhcGFibGFuY2FcIiwgXCJzZWlyYXdhblwiLCBcImNhcGFob3VzZVwiLCBcInNob3VzZVwiLCBcImdyYW5kXCIsIFwiZ3JhbmRob3VzZVwiXTtcclxuZXhwb3J0IGNvbnN0IHZhcmlhbnRzOTYwID0gW1wiY3Jhenlob3VzZVwiLCBcInN0YW5kYXJkXCIsIFwiY2FwYWJsYW5jYVwiLCBcImNhcGFob3VzZVwiXTtcclxuXHJcbmV4cG9ydCBjb25zdCBWQVJJQU5UUyA9IHtcclxuICAgIG1ha3J1azogeyBnZW9tOiBHZW9tZXRyeS5kaW04eDgsIGNnOiBcImNnLTUxMlwiLCBib2FyZDogXCJncmlkXCIsIHBpZWNlczogXCJtYWtydWtcIiwgY3NzOiBbXCJtYWtydWtcIl0sIGljb246IFwiUVwifSxcclxuICAgIHNpdHR1eWluOiB7IGdlb206IEdlb21ldHJ5LmRpbTh4OCwgY2c6IFwiY2ctNTEyXCIsIGJvYXJkOiBcImdyaWR4XCIsIHBpZWNlczogXCJtYWtydWtcIiwgY3NzOiBbXCJtYWtydWtcIiwgXCJtYWtydWtzXCJdLCBpY29uOiBcIlJcIiB9LFxyXG4gICAgc2hvZ2k6IHsgZ2VvbTogR2VvbWV0cnkuZGltOXg5LCBjZzogXCJjZy01NzZcIiwgYm9hcmQ6IFwiZ3JpZDl4OVwiLCBwaWVjZXM6IFwic2hvZ2lcIiwgY3NzOiBbXCJzaG9naTBrXCIsIFwic2hvZ2kwXCIsIFwic2hvZ2kwd1wiLCBcInNob2dpMHBcIl0sIGljb246IFwiS1wiIH0sXHJcbiAgICB4aWFuZ3FpOiB7IGdlb206IEdlb21ldHJ5LmRpbTl4MTAsIGNnOiBcImNnLTU3Ni02NDBcIiwgYm9hcmQ6IFwicml2ZXJcIiwgcGllY2VzOiBcInhpYW5ncWlcIiwgY3NzOiBbXCJ4aWFuZ3FpXCIsIFwieGlhbmdxaWVcIiwgXCJ4aWFuZ3FpY3QyXCIsIFwieGlhbmdxaWhuelwiXSwgaWNvbjogXCJPXCIgfSxcclxuICAgIHBsYWNlbWVudDogeyBnZW9tOiBHZW9tZXRyeS5kaW04eDgsIGNnOiBcImNnLTUxMlwiLCBib2FyZDogXCJicm93blwiLCBwaWVjZXM6IFwic3RhbmRhcmRcIiwgY3NzOiBbXCJzdGFuZGFyZFwiLCBcImdyZWVuXCJdLCBpY29uOiBcIlNcIiB9LFxyXG4gICAgY3Jhenlob3VzZTogeyBnZW9tOiBHZW9tZXRyeS5kaW04eDgsIGNnOiBcImNnLTUxMlwiLCBib2FyZDogXCJicm93blwiLCBwaWVjZXM6IFwic3RhbmRhcmRcIiwgY3NzOiBbXCJzdGFuZGFyZFwiLCBcImdyZWVuXCJdLCBpY29uOiBcIkhcIiB9LFxyXG4gICAgY2FwYWJsYW5jYTogeyBnZW9tOiBHZW9tZXRyeS5kaW0xMHg4LCBjZzogXCJjZy02NDBcIiwgYm9hcmQ6IFwiY2FwYWJsYW5jYVwiLCBwaWVjZXM6IFwic3RhbmRhcmRcIiwgY3NzOiBbXCJjYXBhc2VpMFwiLCBcImNhcGFzZWkxXCIsIFwiY2FwYXNlaTJcIl0sIGljb246IFwiUFwiIH0sXHJcbiAgICBjYXBhaG91c2U6IHsgZ2VvbTogR2VvbWV0cnkuZGltMTB4OCwgY2c6IFwiY2ctNjQwXCIsIGJvYXJkOiBcImNhcGFibGFuY2FcIiwgcGllY2VzOiBcInN0YW5kYXJkXCIsIGNzczogW1wiY2FwYXNlaTBcIiwgXCJjYXBhc2VpMVwiLCBcImNhcGFzZWkyXCJdLCBpY29uOiBcIlBcIiB9LFxyXG4gICAgZ3JhbmQ6IHsgZ2VvbTogR2VvbWV0cnkuZGltMTB4MTAsIGNnOiBcImNnLTY0MC02NDBcIiwgYm9hcmQ6IFwiZ3JhbmRcIiwgcGllY2VzOiBcInN0YW5kYXJkXCIsIGNzczogW1wiY2FwYXNlaTBcIiwgXCJjYXBhc2VpMVwiLCBcImNhcGFzZWkyXCJdLCBpY29uOiBcIkdcIiB9LFxyXG4gICAgZ3JhbmRob3VzZTogeyBnZW9tOiBHZW9tZXRyeS5kaW0xMHgxMCwgY2c6IFwiY2ctNjQwLTY0MFwiLCBib2FyZDogXCJncmFuZFwiLCBwaWVjZXM6IFwic3RhbmRhcmRcIiwgY3NzOiBbXCJjYXBhc2VpMFwiLCBcImNhcGFzZWkxXCIsIFwiY2FwYXNlaTJcIl0sIGljb246IFwiR1wiIH0sXHJcbiAgICBzZWlyYXdhbjogeyBnZW9tOiBHZW9tZXRyeS5kaW04eDgsIGNnOiBcImNnLTUxMlwiLCBib2FyZDogXCJicm93blwiLCBwaWVjZXM6IFwic3RhbmRhcmRcIiwgY3NzOiBbXCJjYXBhc2VpMVwiLCBcImNhcGFzZWkwXCIsIFwiY2FwYXNlaTJcIl0sIGljb246IFwiTFwiIH0sXHJcbiAgICBzaG91c2U6IHsgZ2VvbTogR2VvbWV0cnkuZGltOHg4LCBjZzogXCJjZy01MTJcIiwgYm9hcmQ6IFwiYnJvd25cIiwgcGllY2VzOiBcInN0YW5kYXJkXCIsIGNzczogW1wiY2FwYXNlaTFcIiwgXCJjYXBhc2VpMFwiLCBcImNhcGFzZWkyXCJdLCBpY29uOiBcIkxcIiB9LFxyXG4gICAgc3RhbmRhcmQ6IHsgZ2VvbTogR2VvbWV0cnkuZGltOHg4LCBjZzogXCJjZy01MTJcIiwgYm9hcmQ6IFwiYnJvd25cIiwgcGllY2VzOiBcInN0YW5kYXJkXCIsIGNzczogW1wic3RhbmRhcmRcIiwgXCJncmVlblwiXSwgaWNvbjogXCJNXCIgfSxcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHBvY2tldFJvbGVzKHZhcmlhbnQ6IHN0cmluZykge1xyXG4gICAgc3dpdGNoICh2YXJpYW50KSB7XHJcbiAgICBjYXNlIFwic2l0dHV5aW5cIjpcclxuICAgICAgICByZXR1cm4gW1wicm9va1wiLCBcImtuaWdodFwiLCBcInNpbHZlclwiLCBcImZlcnpcIiwgXCJraW5nXCJdO1xyXG4gICAgY2FzZSBcImNyYXp5aG91c2VcIjpcclxuICAgICAgICByZXR1cm4gW1wicGF3blwiLCBcImtuaWdodFwiLCBcImJpc2hvcFwiLCBcInJvb2tcIiwgXCJxdWVlblwiXTtcclxuICAgIGNhc2UgXCJncmFuZGhvdXNlXCI6XHJcbiAgICBjYXNlIFwiY2FwYWhvdXNlXCI6XHJcbiAgICAgICAgcmV0dXJuIFtcInBhd25cIiwgXCJrbmlnaHRcIiwgXCJiaXNob3BcIiwgXCJyb29rXCIsIFwicXVlZW5cIiwgXCJhcmNoYmlzaG9wXCIsIFwiY2FuY2VsbG9yXCJdO1xyXG4gICAgY2FzZSBcInNob2dpXCI6XHJcbiAgICAgICAgcmV0dXJuIFtcInBhd25cIiwgXCJsYW5jZVwiLCBcImtuaWdodFwiLCBcImJpc2hvcFwiLCBcInJvb2tcIiwgXCJzaWx2ZXJcIiwgXCJnb2xkXCJdO1xyXG4gICAgY2FzZSBcInNob3VzZVwiOlxyXG4gICAgICAgIHJldHVybiBbXCJwYXduXCIsIFwia25pZ2h0XCIsIFwiYmlzaG9wXCIsIFwicm9va1wiLCBcInF1ZWVuXCIsIFwiZWxlcGhhbnRcIiwgXCJoYXdrXCJdO1xyXG4gICAgY2FzZSBcInNlaXJhd2FuXCI6XHJcbiAgICAgICAgcmV0dXJuIFtcImVsZXBoYW50XCIsIFwiaGF3a1wiXTtcclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgcmV0dXJuIFtcInJvb2tcIiwgXCJrbmlnaHRcIiwgXCJiaXNob3BcIiwgXCJxdWVlblwiLCBcImtpbmdcIl07XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHByb21vdGlvblpvbmUodmFyaWFudDogc3RyaW5nLCBjb2xvcjogc3RyaW5nKSB7XHJcbiAgICBzd2l0Y2ggKHZhcmlhbnQpIHtcclxuICAgIGNhc2UgJ3Nob2dpJzpcclxuICAgICAgICByZXR1cm4gY29sb3IgPT09ICd3aGl0ZScgPyAnYTliOWM5ZDllOWY5ZzloOWk5YThiOGM4ZDhlOGY4ZzhoOGk4YTdiN2M3ZDdlN2Y3ZzdoN2k3JyA6ICdhMWIxYzFkMWUxZjFnMWgxaTFhMmIyYzJkMmUyZjJnMmgyaTJhM2IzYzNkM2UzZjNnM2gzaTMnO1xyXG4gICAgY2FzZSAnbWFrcnVrJzpcclxuICAgICAgICByZXR1cm4gY29sb3IgPT09ICd3aGl0ZScgPyAnYTZiNmM2ZDZlNmY2ZzZoNicgOiAnYTNiM2MzZDNlM2YzZzNoMyc7XHJcbiAgICBjYXNlICdzaXR0dXlpbic6XHJcbiAgICAgICAgcmV0dXJuIGNvbG9yID09PSAnd2hpdGUnID8gJ2E4YjdjNmQ1ZTVmNmc3aDgnIDogJ2ExYjJjM2Q0ZTRmM2cyaDEnO1xyXG4gICAgZGVmYXVsdDpcclxuICAgICAgICByZXR1cm4gY29sb3IgPT09ICd3aGl0ZScgPyAnYThiOGM4ZDhlOGY4ZzhoOGk4ajgnIDogJ2ExYjFjMWQxZTFmMWcxaDFpMWoxJztcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHByb21vdGlvblJvbGVzKHZhcmlhbnQ6IHN0cmluZywgcm9sZTogUm9sZSwgb3JpZzogS2V5LCBkZXN0OiBLZXksIHByb21vdGlvbnMpIHtcclxuICAgIHN3aXRjaCAodmFyaWFudCkge1xyXG4gICAgY2FzZSBcImNhcGFob3VzZVwiOlxyXG4gICAgY2FzZSBcImNhcGFibGFuY2FcIjpcclxuICAgICAgICByZXR1cm4gW1wicXVlZW5cIiwgXCJrbmlnaHRcIiwgXCJyb29rXCIsIFwiYmlzaG9wXCIsIFwiYXJjaGJpc2hvcFwiLCBcImNhbmNlbGxvclwiXTtcclxuICAgIGNhc2UgXCJzaG91c2VcIjpcclxuICAgIGNhc2UgXCJzZWlyYXdhblwiOlxyXG4gICAgICAgIHJldHVybiBbXCJxdWVlblwiLCBcImtuaWdodFwiLCBcInJvb2tcIiwgXCJiaXNob3BcIiwgXCJlbGVwaGFudFwiLCBcImhhd2tcIl07XHJcbiAgICBjYXNlIFwic2hvZ2lcIjpcclxuICAgICAgICByZXR1cm4gW1wicFwiICsgcm9sZSwgcm9sZV07XHJcbiAgICBjYXNlIFwiZ3JhbmRob3VzZVwiOlxyXG4gICAgY2FzZSBcImdyYW5kXCI6XHJcbiAgICAgICAgdmFyIHJvbGVzOiBSb2xlW10gPSBbXTtcclxuICAgICAgICBjb25zdCBtb3ZlcyA9IHByb21vdGlvbnMubWFwKChtb3ZlKSA9PiBtb3ZlLnNsaWNlKDAsIC0xKSk7XHJcbiAgICAgICAgcHJvbW90aW9ucy5mb3JFYWNoKChtb3ZlKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHByb2xlID0gc2FuVG9Sb2xlW21vdmUuc2xpY2UoLTEpXTtcclxuICAgICAgICAgICAgaWYgKG1vdmVzLmluZGV4T2Yob3JpZyArIGRlc3QpICE9PSAtMSAmJiByb2xlcy5pbmRleE9mKHByb2xlKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHJvbGVzLnB1c2gocHJvbGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgLy8gcHJvbW90aW9uIGlzIG9wdGlvbmFsIGV4Y2VwdCBvbiBiYWNrIHJhbmtzXHJcbiAgICAgICAgaWYgKChkZXN0WzFdICE9PSBcIjlcIikgJiYgKGRlc3RbMV0gIT09IFwiMFwiKSkgcm9sZXMucHVzaChyb2xlKTtcclxuICAgICAgICByZXR1cm4gcm9sZXM7XHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICAgIHJldHVybiBbXCJxdWVlblwiLCBcImtuaWdodFwiLCBcInJvb2tcIiwgXCJiaXNob3BcIl07XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBtYW5kYXRvcnlQcm9tb3Rpb24ocm9sZTogUm9sZSwgZGVzdDogS2V5LCBjb2xvcjogQ29sb3IpIHtcclxuICAgIHN3aXRjaCAocm9sZSkge1xyXG4gICAgY2FzZSBcInBhd25cIjpcclxuICAgIGNhc2UgXCJsYW5jZVwiOlxyXG4gICAgICAgIGlmIChjb2xvciA9PT0gXCJ3aGl0ZVwiKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBkZXN0WzFdID09PSBcIjlcIjtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gZGVzdFsxXSA9PT0gXCIxXCI7XHJcbiAgICAgICAgfVxyXG4gICAgY2FzZSBcImtuaWdodFwiOlxyXG4gICAgICAgIGlmIChjb2xvciA9PT0gXCJ3aGl0ZVwiKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBkZXN0WzFdID09PSBcIjlcIiB8fCBkZXN0WzFdID09PSBcIjhcIjtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gZGVzdFsxXSA9PT0gXCIxXCIgfHwgZGVzdFsxXSA9PT0gXCIyXCI7XHJcbiAgICAgICAgfVxyXG4gICAgZGVmYXVsdDpcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBuZWVkUG9ja2V0cyh2YXJpYW50OiBzdHJpbmcpIHtcclxuICAgIHJldHVybiB2YXJpYW50ID09PSAncGxhY2VtZW50JyB8fCB2YXJpYW50ID09PSAnY3Jhenlob3VzZScgfHwgdmFyaWFudCA9PT0gJ3NpdHR1eWluJyB8fCB2YXJpYW50ID09PSAnc2hvZ2knIHx8IHZhcmlhbnQgPT09ICdzZWlyYXdhbicgfHwgdmFyaWFudCA9PT0gJ2NhcGFob3VzZScgfHwgdmFyaWFudCA9PT0gJ3Nob3VzZScgfHwgdmFyaWFudCA9PT0gJ2dyYW5kaG91c2UnO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaGFzRXAodmFyaWFudDogc3RyaW5nKSB7XHJcbiAgICByZXR1cm4gdmFyaWFudCA9PT0gJ3N0YW5kYXJkJyB8fCB2YXJpYW50ID09PSAncGxhY2VtZW50JyB8fCB2YXJpYW50ID09PSAnY3Jhenlob3VzZScgfHwgdmFyaWFudCA9PT0gJ2NhcGFibGFuY2EnIHx8IHZhcmlhbnQgPT09ICdzZWlyYXdhbicgfHwgdmFyaWFudCA9PT0gJ2NhcGFob3VzZScgfHwgdmFyaWFudCA9PT0gJ3Nob3VzZScgfHwgdmFyaWFudCA9PT0gJ2dyYW5kJyB8fCB2YXJpYW50ID09PSAnZ3JhbmRob3VzZSc7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRpZmYoYTogbnVtYmVyLCBiOm51bWJlcik6bnVtYmVyIHtcclxuICByZXR1cm4gTWF0aC5hYnMoYSAtIGIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBkaWFnb25hbE1vdmUocG9zMSwgcG9zMikge1xyXG4gICAgY29uc3QgeGQgPSBkaWZmKHBvczFbMF0sIHBvczJbMF0pO1xyXG4gICAgY29uc3QgeWQgPSBkaWZmKHBvczFbMV0sIHBvczJbMV0pO1xyXG4gICAgcmV0dXJuIHhkID09PSB5ZCAmJiB4ZCA9PT0gMTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNhbkdhdGUoZmVuLCBwaWVjZSwgb3JpZywgZGVzdCwgbWV0YSkge1xyXG4gICAgY29uc29sZS5sb2coXCIgICBpc0dhdGluZygpXCIsIGZlbiwgcGllY2UsIG9yaWcsIGRlc3QsIG1ldGEpO1xyXG4gICAgY29uc3Qgbm9fZ2F0ZSA9IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxyXG4gICAgaWYgKChwaWVjZS5jb2xvciA9PT0gXCJ3aGl0ZVwiICYmIG9yaWcuc2xpY2UoMSkgIT09IFwiMVwiKSB8fFxyXG4gICAgICAgIChwaWVjZS5jb2xvciA9PT0gXCJibGFja1wiICYmIG9yaWcuc2xpY2UoMSkgIT09IFwiOFwiKSB8fFxyXG4gICAgICAgIChwaWVjZS5yb2xlID09PSBcImhhd2tcIikgfHxcclxuICAgICAgICAocGllY2Uucm9sZSA9PT0gXCJlbGVwaGFudFwiKSkgcmV0dXJuIG5vX2dhdGU7XHJcblxyXG4gICAgLy8gSW4gc3RhcnRpbmcgcG9zaXRpb24ga2luZyBhbmQoISkgcm9vayB2aXJnaW5pdHkgaXMgZW5jb2RlZCBpbiBLUWtxXHJcbiAgICAvLyBcInJuYnFrYm5yL3BwcHBwcHBwLzgvOC84LzgvUFBQUFBQUFAvUk5CUUtCTlJbSEVoZV0gdyBLUUJDREZHa3FiY2RmZyAtIDAgMVwiXHJcblxyXG4gICAgLy8gYnV0IGFmdGVyIGtpbmdzIG1vdmVkIHJvb2sgdmlyZ2luaXR5IGlzIGVuY29kZWQgaW4gQUhhaFxyXG4gICAgLy8gcm5icTFibnIvcHBwcGtwcHAvOC80cDMvNFAzLzgvUFBQUEtQUFAvUk5CUTFCTlJbSEVoZV0gdyBBQkNERkdIYWJjZGZnaCAtIDIgM1xyXG5cclxuICAgIC8vIGtpbmcgdmlyZ2luaXR5IGlzIGVuY29kZWQgaW4gRWUgYWZ0ZXIgYW55IFJvb2sgbW92ZWQgYnV0IEtpbmcgbm90XHJcblxyXG4gICAgY29uc3QgcGFydHMgPSBmZW4uc3BsaXQoXCIgXCIpO1xyXG4gICAgY29uc3QgcGxhY2VtZW50ID0gcGFydHNbMF07XHJcbiAgICBjb25zdCBjb2xvciA9IHBhcnRzWzFdO1xyXG4gICAgY29uc3QgY2FzdGwgPSBwYXJ0c1syXTtcclxuICAgIC8vIGNvbnNvbGUubG9nKFwiaXNHYXRpbmcoKVwiLCBvcmlnLCBwbGFjZW1lbnQsIGNvbG9yLCBjYXN0bCk7XHJcbiAgICBzd2l0Y2ggKG9yaWcpIHtcclxuICAgIGNhc2UgXCJhMVwiOlxyXG4gICAgICAgIGlmIChjYXN0bC5pbmRleE9mKFwiQVwiKSA9PT0gLTEgJiYgY2FzdGwuaW5kZXhPZihcIlFcIikgPT09IC0xKSByZXR1cm4gbm9fZ2F0ZTtcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgXCJiMVwiOlxyXG4gICAgICAgIGlmIChjYXN0bC5pbmRleE9mKFwiQlwiKSA9PT0gLTEpIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImMxXCI6XHJcbiAgICAgICAgaWYgKGNhc3RsLmluZGV4T2YoXCJDXCIpID09PSAtMSkgcmV0dXJuIG5vX2dhdGU7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwiZDFcIjpcclxuICAgICAgICBpZiAoY2FzdGwuaW5kZXhPZihcIkRcIikgPT09IC0xKSByZXR1cm4gbm9fZ2F0ZTtcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgXCJlMVwiOlxyXG4gICAgICAgIGlmIChwaWVjZS5yb2xlICE9PSBcImtpbmdcIikge1xyXG4gICAgICAgICAgICByZXR1cm4gbm9fZ2F0ZTtcclxuICAgICAgICB9IGVsc2UgaWYgKChjYXN0bC5pbmRleE9mKFwiS1wiKSA9PT0gLTEpICYmIChjYXN0bC5pbmRleE9mKFwiUVwiKSA9PT0gLTEpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoY2FzdGwuaW5kZXhPZihcIkVcIikgPT09IC0xKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwiZjFcIjpcclxuICAgICAgICBpZiAoY2FzdGwuaW5kZXhPZihcIkZcIikgPT09IC0xKSByZXR1cm4gbm9fZ2F0ZTtcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgXCJnMVwiOlxyXG4gICAgICAgIGlmIChjYXN0bC5pbmRleE9mKFwiR1wiKSA9PT0gLTEpIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImgxXCI6XHJcbiAgICAgICAgaWYgKGNhc3RsLmluZGV4T2YoXCJIXCIpID09PSAtMSAmJiBjYXN0bC5pbmRleE9mKFwiS1wiKSA9PT0gLTEpIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImE4XCI6XHJcbiAgICAgICAgaWYgKGNhc3RsLmluZGV4T2YoXCJhXCIpID09PSAtMSAmJiBjYXN0bC5pbmRleE9mKFwicVwiKSA9PT0gLTEpIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImI4XCI6XHJcbiAgICAgICAgaWYgKGNhc3RsLmluZGV4T2YoXCJiXCIpID09PSAtMSkgcmV0dXJuIG5vX2dhdGU7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwiYzhcIjpcclxuICAgICAgICBpZiAoY2FzdGwuaW5kZXhPZihcImNcIikgPT09IC0xKSByZXR1cm4gbm9fZ2F0ZTtcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgXCJkOFwiOlxyXG4gICAgICAgIGlmIChjYXN0bC5pbmRleE9mKFwiZFwiKSA9PT0gLTEpIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImU4XCI6XHJcbiAgICAgICAgaWYgKHBpZWNlLnJvbGUgIT09IFwia2luZ1wiKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoKGNhc3RsLmluZGV4T2YoXCJrXCIpID09PSAtMSkgJiYgKGNhc3RsLmluZGV4T2YoXCJxXCIpID09PSAtMSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5vX2dhdGU7XHJcbiAgICAgICAgfSBlbHNlIGlmIChjYXN0bC5pbmRleE9mKFwiZVwiKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5vX2dhdGU7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgXCJmOFwiOlxyXG4gICAgICAgIGlmIChjYXN0bC5pbmRleE9mKFwiZlwiKSA9PT0gLTEpIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImc4XCI6XHJcbiAgICAgICAgaWYgKGNhc3RsLmluZGV4T2YoXCJnXCIpID09PSAtMSkgcmV0dXJuIG5vX2dhdGU7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwiaDhcIjpcclxuICAgICAgICBpZiAoY2FzdGwuaW5kZXhPZihcImhcIikgPT09IC0xICYmIGNhc3RsLmluZGV4T2YoXCJrXCIpID09PSAtMSkgcmV0dXJuIG5vX2dhdGU7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9O1xyXG4gICAgY29uc3QgYnJhY2tldFBvcyA9IHBsYWNlbWVudC5pbmRleE9mKFwiW1wiKTtcclxuICAgIGNvbnN0IHBvY2tldHMgPSBwbGFjZW1lbnQuc2xpY2UoYnJhY2tldFBvcyk7XHJcbiAgICBjb25zdCBwaCA9IGxjKHBvY2tldHMsIFwiaFwiLCBjb2xvcj09PSd3JykgIT09IDA7XHJcbiAgICBjb25zdCBwZSA9IGxjKHBvY2tldHMsIFwiZVwiLCBjb2xvcj09PSd3JykgIT09IDA7XHJcbiAgICBjb25zdCBwcSA9IGxjKHBvY2tldHMsIFwicVwiLCBjb2xvcj09PSd3JykgIT09IDA7XHJcbiAgICBjb25zdCBwciA9IGxjKHBvY2tldHMsIFwiclwiLCBjb2xvcj09PSd3JykgIT09IDA7XHJcbiAgICBjb25zdCBwYiA9IGxjKHBvY2tldHMsIFwiYlwiLCBjb2xvcj09PSd3JykgIT09IDA7XHJcbiAgICBjb25zdCBwbiA9IGxjKHBvY2tldHMsIFwiblwiLCBjb2xvcj09PSd3JykgIT09IDA7XHJcblxyXG4gICAgcmV0dXJuIFtwaCwgcGUsIHBxLCBwciwgcGIsIHBuXTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGlzUHJvbW90aW9uKHZhcmlhbnQsIHBpZWNlLCBvcmlnLCBkZXN0LCBtZXRhLCBwcm9tb3Rpb25zKSB7XHJcbiAgICBpZiAodmFyaWFudCA9PT0gJ3hpYW5ncWknKSByZXR1cm4gZmFsc2U7XHJcbiAgICBjb25zdCBweiA9IHByb21vdGlvblpvbmUodmFyaWFudCwgcGllY2UuY29sb3IpXHJcbiAgICBzd2l0Y2ggKHZhcmlhbnQpIHtcclxuICAgIGNhc2UgJ3Nob2dpJzpcclxuICAgICAgICByZXR1cm4gWydraW5nJywgJ2dvbGQnLCAncHBhd24nLCAncGtuaWdodCcsICdwYmlzaG9wJywgJ3Byb29rJywgJ3BzaWx2ZXInLCAncGxhbmNlJ10uaW5kZXhPZihwaWVjZS5yb2xlKSA9PT0gLTFcclxuICAgICAgICAgICAgJiYgKHB6LmluZGV4T2Yob3JpZykgIT09IC0xIHx8IHB6LmluZGV4T2YoZGVzdCkgIT09IC0xKTtcclxuICAgIGNhc2UgJ3NpdHR1eWluJzpcclxuICAgICAgICAvLyBTZWUgaHR0cHM6Ly92ZG9jdW1lbnRzLm5ldC9ob3ctdG8tcGxheS1teWFubWFyLXRyYWRpdGlvbmFsLWNoZXNzLWVuZy1ib29rLTEuaHRtbFxyXG4gICAgICAgIGNvbnN0IGZpcnN0UmFua0lzMCA9IGZhbHNlO1xyXG4gICAgICAgIGNvbnN0IGRtID0gZGlhZ29uYWxNb3ZlKGtleTJwb3Mob3JpZywgZmlyc3RSYW5rSXMwKSwga2V5MnBvcyhkZXN0LCBmaXJzdFJhbmtJczApKTtcclxuICAgICAgICByZXR1cm4gcGllY2Uucm9sZSA9PT0gXCJwYXduXCIgJiYgKCBvcmlnID09PSBkZXN0IHx8ICghbWV0YS5jYXB0dXJlZCAmJiBkbSkpO1xyXG4gICAgY2FzZSAnZ3JhbmRob3VzZSc6XHJcbiAgICBjYXNlICdncmFuZCc6XHJcbiAgICAgICAgLy8gVE9ETzogd2UgY2FuIHVzZSB0aGlzIGZvciBvdGhlciB2YXJpYW50cyBhbHNvXHJcbiAgICAgICAgcmV0dXJuIHByb21vdGlvbnMubWFwKChtb3ZlKSA9PiBtb3ZlLnNsaWNlKDAsIC0xKSkuaW5kZXhPZihvcmlnICsgZGVzdCkgIT09IC0xO1xyXG4gICAgZGVmYXVsdDpcclxuICAgICAgICByZXR1cm4gcGllY2Uucm9sZSA9PT0gXCJwYXduXCIgJiYgcHouaW5kZXhPZihkZXN0KSAhPT0gLTE7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB1Y2kydXNpKG1vdmUpIHtcclxuICAgIGNvbnN0IHBhcnRzID0gbW92ZS5zcGxpdChcIlwiKTtcclxuICAgIGlmIChwYXJ0c1sxXSA9PT0gXCJAXCIpIHtcclxuICAgICAgICBwYXJ0c1sxXSA9IFwiKlwiO1xyXG4gICAgICAgIHBhcnRzWzJdID0gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJ0c1syXS5jaGFyQ29kZUF0KCkgLSA0OClcclxuICAgICAgICBwYXJ0c1szXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUocGFydHNbM10uY2hhckNvZGVBdCgpICsgNDgpXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHBhcnRzWzBdID0gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJ0c1swXS5jaGFyQ29kZUF0KCkgLSA0OClcclxuICAgICAgICBwYXJ0c1sxXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUocGFydHNbMV0uY2hhckNvZGVBdCgpICsgNDgpXHJcbiAgICAgICAgcGFydHNbMl0gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHBhcnRzWzJdLmNoYXJDb2RlQXQoKSAtIDQ4KVxyXG4gICAgICAgIHBhcnRzWzNdID0gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJ0c1szXS5jaGFyQ29kZUF0KCkgKyA0OClcclxuICAgIH1cclxuICAgIHJldHVybiBwYXJ0cy5qb2luKFwiXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdXNpMnVjaShtb3ZlKSB7XHJcbiAgICBjb25zb2xlLmxvZyhcInVzaTJ1Y2koKVwiLCBtb3ZlKTtcclxuICAgIGNvbnN0IHBhcnRzID0gbW92ZS5zcGxpdChcIlwiKTtcclxuICAgIGlmIChwYXJ0c1sxXSA9PT0gXCIqXCIpIHtcclxuICAgICAgICBwYXJ0c1sxXSA9IFwiQFwiO1xyXG4gICAgICAgIHBhcnRzWzJdID0gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJ0c1syXS5jaGFyQ29kZUF0KCkgKyA0OClcclxuICAgICAgICBwYXJ0c1szXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUocGFydHNbM10uY2hhckNvZGVBdCgpIC0gNDgpXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHBhcnRzWzBdID0gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJ0c1swXS5jaGFyQ29kZUF0KCkgKyA0OClcclxuICAgICAgICBwYXJ0c1sxXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUocGFydHNbMV0uY2hhckNvZGVBdCgpIC0gNDgpXHJcbiAgICAgICAgcGFydHNbMl0gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHBhcnRzWzJdLmNoYXJDb2RlQXQoKSArIDQ4KVxyXG4gICAgICAgIHBhcnRzWzNdID0gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJ0c1szXS5jaGFyQ29kZUF0KCkgLSA0OClcclxuICAgIH1cclxuICAgIHJldHVybiBwYXJ0cy5qb2luKFwiXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gemVybzJncmFuZChtb3ZlKSB7XHJcbiAgICBjb25zdCBwYXJ0cyA9IG1vdmUuc3BsaXQoXCJcIik7XHJcbiAgICBpZiAocGFydHNbMV0gIT09IFwiQFwiKSB7XHJcbiAgICAgICAgcGFydHNbMV0gPSBTdHJpbmcoTnVtYmVyKHBhcnRzWzFdKSArIDEpO1xyXG4gICAgfVxyXG4gICAgcGFydHNbM10gPSBTdHJpbmcoTnVtYmVyKHBhcnRzWzNdKSArIDEpO1xyXG4gICAgcmV0dXJuIHBhcnRzLmpvaW4oXCJcIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBncmFuZDJ6ZXJvKG1vdmUpIHtcclxuICAgIC8vIGN1dCBvZmYgcHJvbW90aW9uIHBpZWNlIGxldHRlclxyXG4gICAgdmFyIHByb21vID0gJyc7XHJcbiAgICBpZiAoJzAxMjM0NTY3ODknLmluZGV4T2YobW92ZS5zbGljZSgtMSkpID09PSAtMSkge1xyXG4gICAgICAgIHByb21vID0gbW92ZS5zbGljZSgtMSk7XHJcbiAgICAgICAgbW92ZSA9IG1vdmUuc2xpY2UoMCwgLTEpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgcGFydHMgPSBtb3ZlLnNwbGl0KFwiXCIpO1xyXG5cclxuICAgIGlmIChwYXJ0c1sxXSA9PT0gJ0AnKSB7XHJcbiAgICAgICAgcmV0dXJuIHBhcnRzWzBdICsgcGFydHNbMV0gKyBwYXJ0c1syXSArIFN0cmluZyhOdW1iZXIobW92ZS5zbGljZSgzKSkgLSAxKTtcclxuICAgIH1cclxuICAgIGlmICgnMDEyMzQ1Njc4OScuaW5kZXhPZihwYXJ0c1syXSkgIT09IC0xKSB7XHJcbiAgICAgICAgcGFydHNbMV0gPSBTdHJpbmcoTnVtYmVyKHBhcnRzWzFdICsgcGFydHNbMl0pIC0xKTtcclxuICAgICAgICBwYXJ0c1s0XSA9IFN0cmluZyhOdW1iZXIobW92ZS5zbGljZSg0KSkgLSAxKTtcclxuICAgICAgICByZXR1cm4gcGFydHNbMF0gKyBwYXJ0c1sxXSArIHBhcnRzWzNdICsgcGFydHNbNF0gKyBwcm9tbztcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcGFydHNbMV0gPSBTdHJpbmcoTnVtYmVyKHBhcnRzWzFdKSAtMSk7XHJcbiAgICAgICAgcGFydHNbM10gPSBTdHJpbmcoTnVtYmVyKG1vdmUuc2xpY2UoMykpIC0gMSk7XHJcbiAgICAgICAgcmV0dXJuIHBhcnRzWzBdICsgcGFydHNbMV0gKyBwYXJ0c1syXSArIHBhcnRzWzNdICsgcHJvbW87XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCByb2xlVG9TYW4gPSB7XHJcbiAgICBwYXduOiAnUCcsXHJcbiAgICBrbmlnaHQ6ICdOJyxcclxuICAgIGJpc2hvcDogJ0InLFxyXG4gICAgcm9vazogJ1InLFxyXG4gICAgcXVlZW46ICdRJyxcclxuICAgIGtpbmc6ICdLJyxcclxuICAgIGFyY2hiaXNob3A6ICdBJyxcclxuICAgIGNhbmNlbGxvcjogJ0MnLFxyXG4gICAgZWxlcGhhbnQ6IFwiRVwiLFxyXG4gICAgaGF3azogXCJIXCIsXHJcbiAgICBmZXJ6OiAnRicsXHJcbiAgICBtZXQ6ICdNJyxcclxuICAgIGdvbGQ6ICdHJyxcclxuICAgIHNpbHZlcjogJ1MnLFxyXG4gICAgbGFuY2U6ICdMJyxcclxufTtcclxuXHJcbmV4cG9ydCBjb25zdCBzYW5Ub1JvbGUgPSB7XHJcbiAgICBQOiAncGF3bicsXHJcbiAgICBOOiAna25pZ2h0JyxcclxuICAgIEI6ICdiaXNob3AnLFxyXG4gICAgUjogJ3Jvb2snLFxyXG4gICAgUTogJ3F1ZWVuJyxcclxuICAgIEs6ICdraW5nJyxcclxuICAgIEE6ICdhcmNoYmlzaG9wJyxcclxuICAgIEM6ICdjYW5jZWxsb3InLFxyXG4gICAgRTogJ2VsZXBoYW50JyxcclxuICAgIEg6ICdoYXdrJyxcclxuICAgIEY6ICdmZXJ6JyxcclxuICAgIE06ICdtZXQnLFxyXG4gICAgRzogJ2dvbGQnLFxyXG4gICAgUzogJ3NpbHZlcicsXHJcbiAgICBMOiAnbGFuY2UnLFxyXG4gICAgcDogJ3Bhd24nLFxyXG4gICAgbjogJ2tuaWdodCcsXHJcbiAgICBiOiAnYmlzaG9wJyxcclxuICAgIHI6ICdyb29rJyxcclxuICAgIHE6ICdxdWVlbicsXHJcbiAgICBrOiAna2luZycsXHJcbiAgICBhOiAnYXJjaGJpc2hvcCcsXHJcbiAgICBjOiAnY2FuY2VsbG9yJyxcclxuICAgIGU6ICdlbGVwaGFudCcsXHJcbiAgICBoOiAnaGF3aycsXHJcbiAgICBmOiAnZmVyeicsXHJcbiAgICBtOiAnbWV0JyxcclxuICAgIGc6ICdnb2xkJyxcclxuICAgIHM6ICdzaWx2ZXInLFxyXG4gICAgbDogJ2xhbmNlJyxcclxufTtcclxuXHJcbi8vIENvdW50IGdpdmVuIGxldHRlciBvY2N1cmVuY2VzIGluIGEgc3RyaW5nXHJcbmV4cG9ydCBmdW5jdGlvbiBsYyhzdHIsIGxldHRlciwgdXBwZXJjYXNlKSB7XHJcbiAgICB2YXIgbGV0dGVyQ291bnQgPSAwO1xyXG4gICAgaWYgKHVwcGVyY2FzZSkgbGV0dGVyID0gbGV0dGVyLnRvVXBwZXJDYXNlKCk7XHJcbiAgICBmb3IgKHZhciBwb3NpdGlvbiA9IDA7IHBvc2l0aW9uIDwgc3RyLmxlbmd0aDsgcG9zaXRpb24rKykge1xyXG4gICAgICAgIGlmIChzdHIuY2hhckF0KHBvc2l0aW9uKSA9PT0gbGV0dGVyKSBsZXR0ZXJDb3VudCArPSAxO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGxldHRlckNvdW50O1xyXG59XHJcbiIsIi8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzIwNjE4MzU1L3RoZS1zaW1wbGVzdC1wb3NzaWJsZS1qYXZhc2NyaXB0LWNvdW50ZG93bi10aW1lclxuXG5pbXBvcnQgeyBoLCBpbml0IH0gZnJvbSBcInNuYWJiZG9tXCI7XG5pbXBvcnQga2xhc3MgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9jbGFzcyc7XG5pbXBvcnQgYXR0cmlidXRlcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2F0dHJpYnV0ZXMnO1xuaW1wb3J0IHByb3BlcnRpZXMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9wcm9wcyc7XG5pbXBvcnQgbGlzdGVuZXJzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMnO1xuXG5jb25zdCBwYXRjaCA9IGluaXQoW2tsYXNzLCBhdHRyaWJ1dGVzLCBwcm9wZXJ0aWVzLCBsaXN0ZW5lcnNdKTtcblxuZXhwb3J0IGNsYXNzIENsb2NrIHtcbiAgICBkdXJhdGlvbjogbnVtYmVyO1xuICAgIGluY3JlbWVudDogbnVtYmVyO1xuICAgIGdyYW51bGFyaXR5OiBudW1iZXI7XG4gICAgcnVubmluZzogYm9vbGVhbjtcbiAgICBjb25uZWN0aW5nOiBib29sZWFuO1xuICAgIHRpbWVvdXQ6IGFueTtcbiAgICBzdGFydFRpbWU6IGFueTtcbiAgICB0aWNrQ2FsbGJhY2tzOiBhbnlbXTtcbiAgICBmbGFnQ2FsbGJhY2s6IGFueTtcbiAgICBlbDogSFRNTEVsZW1lbnQ7XG4gICAgaWQ6IHN0cmluZztcblxuICAgIC8vIGdhbWUgYmFzZVRpbWUgKG1pbikgYW5kIGluY3JlbWVudCAoc2VjKVxuICAgIGNvbnN0cnVjdG9yKGJhc2VUaW1lLCBpbmNyZW1lbnQsIGVsLCBpZCkge1xuICAgIHRoaXMuZHVyYXRpb24gPSBiYXNlVGltZSAqIDEwMDAgKiA2MDtcbiAgICB0aGlzLmluY3JlbWVudCA9IGluY3JlbWVudCAqIDEwMDA7XG4gICAgdGhpcy5ncmFudWxhcml0eSA9IDUwMDtcbiAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICB0aGlzLmNvbm5lY3RpbmcgPSBmYWxzZTtcbiAgICB0aGlzLnRpbWVvdXQgPSBudWxsO1xuICAgIHRoaXMuc3RhcnRUaW1lID0gbnVsbDtcbiAgICB0aGlzLnRpY2tDYWxsYmFja3MgPSBbXTtcbiAgICB0aGlzLmZsYWdDYWxsYmFjayA9IG51bGw7XG4gICAgdGhpcy5lbCA9IGVsO1xuICAgIHRoaXMuaWQgPSBpZDtcblxuICAgIHJlbmRlclRpbWUodGhpcywgdGhpcy5kdXJhdGlvbik7XG4gICAgfVxuXG4gICAgc3RhcnQgPSAoZHVyYXRpb24pID0+IHtcbiAgICAgICAgaWYgKHRoaXMucnVubmluZykgcmV0dXJuO1xuICAgICAgICBpZiAodHlwZW9mIGR1cmF0aW9uICE9PSBcInVuZGVmaW5lZFwiKSB0aGlzLmR1cmF0aW9uID0gZHVyYXRpb247XG5cbiAgICAgICAgdGhpcy5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgICAgIHZhciBkaWZmO1xuXG4gICAgICAgIChmdW5jdGlvbiB0aW1lcigpIHtcbiAgICAgICAgICAgIGRpZmYgPSB0aGF0LmR1cmF0aW9uIC0gKERhdGUubm93KCkgLSB0aGF0LnN0YXJ0VGltZSk7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInRpbWVyKClcIiwgdGhhdC5kdXJhdGlvbiwgdGhhdC5zdGFydFRpbWUsIGRpZmYpO1xuICAgICAgICAgICAgaWYgKGRpZmYgPD0gMCkge1xuICAgICAgICAgICAgICAgIHRoYXQuZmxhZ0NhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgdGhhdC5wYXVzZShmYWxzZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhhdC50aW1lb3V0ID0gc2V0VGltZW91dCh0aW1lciwgdGhhdC5ncmFudWxhcml0eSk7XG4gICAgICAgICAgICB0aGF0LnRpY2tDYWxsYmFja3MuZm9yRWFjaChmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwodGhhdCwgdGhhdCwgZGlmZik7XG4gICAgICAgICAgICB9LCB0aGF0KTtcbiAgICAgICAgfSgpKTtcbiAgICB9XG5cbiAgICBvblRpY2sgPSAoY2FsbGJhY2spID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhpcy50aWNrQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIG9uRmxhZyA9IChjYWxsYmFjaykgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB0aGlzLnBhdXNlKGZhbHNlKTtcbiAgICAgICAgICAgIHRoaXMuZmxhZ0NhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgcGF1c2UgPSAod2l0aEluY3JlbWVudCkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMucnVubmluZykgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy50aW1lb3V0KSBjbGVhclRpbWVvdXQodGhpcy50aW1lb3V0KTtcbiAgICAgICAgdGhpcy50aW1lb3V0ID0gbnVsbDtcblxuICAgICAgICB0aGlzLmR1cmF0aW9uIC09IERhdGUubm93KCkgLSB0aGlzLnN0YXJ0VGltZTtcbiAgICAgICAgaWYgKHdpdGhJbmNyZW1lbnQgJiYgdGhpcy5pbmNyZW1lbnQpIHRoaXMuZHVyYXRpb24gKz0gdGhpcy5pbmNyZW1lbnQ7XG4gICAgICAgIHJlbmRlclRpbWUodGhpcywgdGhpcy5kdXJhdGlvbik7XG4gICAgfVxuXG4gICAgc2V0VGltZSA9IChtaWxsaXMpID0+IHtcbiAgICAgICAgdGhpcy5kdXJhdGlvbiA9IG1pbGxpcztcbiAgICAgICAgcmVuZGVyVGltZSh0aGlzLCB0aGlzLmR1cmF0aW9uKTtcbiAgICB9XG5cbiAgICBwYXJzZVRpbWUgPSAobWlsbGlzKSA9PiB7XG4gICAgICAgIGxldCBtaW51dGVzID0gTWF0aC5mbG9vcihtaWxsaXMgLyA2MDAwMCk7XG4gICAgICAgIGxldCBzZWNvbmRzID0gKG1pbGxpcyAlIDYwMDAwKSAvIDEwMDA7XG4gICAgICAgIGxldCBzZWNzLCBtaW5zO1xuICAgICAgICBpZiAoTWF0aC5mbG9vcihzZWNvbmRzKSA9PSA2MCkge1xuICAgICAgICAgICAgbWludXRlcysrO1xuICAgICAgICAgICAgc2Vjb25kcyA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgbWludXRlcyA9IE1hdGgubWF4KDAsIG1pbnV0ZXMpO1xuICAgICAgICBzZWNvbmRzID0gTWF0aC5tYXgoMCwgc2Vjb25kcyk7XG4gICAgICAgIGlmIChtaWxsaXMgPCAxMDAwMCkge1xuICAgICAgICAgICAgc2VjcyA9IHNlY29uZHMudG9GaXhlZCgxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlY3MgPSBTdHJpbmcoTWF0aC5mbG9vcihzZWNvbmRzKSk7XG4gICAgICAgIH1cbiAgICAgICAgbWlucyA9IChtaW51dGVzIDwgMTAgPyBcIjBcIiA6IFwiXCIpICsgU3RyaW5nKG1pbnV0ZXMpO1xuICAgICAgICBzZWNzID0gKHNlY29uZHMgPCAxMCA/IFwiMFwiIDogXCJcIikgKyBzZWNzO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbWludXRlczogbWlucyxcbiAgICAgICAgICAgIHNlY29uZHM6IHNlY3MsXG4gICAgICAgIH07XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyVGltZShjbG9jaywgdGltZSkge1xuICAgIGlmIChjbG9jay5ncmFudWxhcml0eSA+IDEwMCAmJiB0aW1lIDwgMTAwMDApIGNsb2NrLmdyYW51bGFyaXR5ID0gMTAwO1xuICAgIGNvbnN0IHBhcnNlZCA9IGNsb2NrLnBhcnNlVGltZSh0aW1lKTtcbiAgICAvLyBjb25zb2xlLmxvZyhcInJlbmRlclRpbWUoKTpcIiwgdGltZSwgcGFyc2VkKTtcblxuICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSh0aW1lKTtcbiAgICBjb25zdCBtaWxsaXMgPSBkYXRlLmdldFVUQ01pbGxpc2Vjb25kcygpO1xuICAgIGNsb2NrLmVsID0gcGF0Y2goY2xvY2suZWwsIGgoJ2Rpdi5jbG9jay13cmFwIycgKyBjbG9jay5pZCwgW1xuICAgICAgICBoKCdkaXYuY2xvY2snLCBbXG4gICAgICAgICAgICBoKCdkaXYuY2xvY2sudGltZS5taW4nLCB7Y2xhc3M6IHtydW5uaW5nOiBjbG9jay5ydW5uaW5nLCBodXJyeTogdGltZSA8IDEwMDAwLCBjb25uZWN0aW5nOiBjbG9jay5jb25uZWN0aW5nfX0sIHBhcnNlZC5taW51dGVzKSxcbiAgICAgICAgICAgIGgoJ2Rpdi5jbG9jay5zZXAnLCB7Y2xhc3M6IHtydW5uaW5nOiBjbG9jay5ydW5uaW5nLCBodXJyeTogdGltZSA8IDEwMDAwLCBsb3c6IG1pbGxpcyA8IDUwMCwgY29ubmVjdGluZzogY2xvY2suY29ubmVjdGluZ319ICwgJzonKSxcbiAgICAgICAgICAgIGgoJ2Rpdi5jbG9jay50aW1lLnNlYycsIHtjbGFzczoge3J1bm5pbmc6IGNsb2NrLnJ1bm5pbmcsIGh1cnJ5OiB0aW1lIDwgMTAwMDAsIGNvbm5lY3Rpbmc6IGNsb2NrLmNvbm5lY3Rpbmd9fSwgcGFyc2VkLnNlY29uZHMpXG4gICAgICAgIF0pXG4gICAgXSlcbiAgICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGltZWFnbyhkYXRlKSB7XG4gICAgY29uc3QgVFpkYXRlID0gbmV3IERhdGUoZGF0ZSArICdaJyk7XG4gICAgdmFyIHZhbCA9IDAgfCAoRGF0ZS5ub3coKSAtIFRaZGF0ZS5nZXRUaW1lKCkpIC8gMTAwMDtcbiAgICB2YXIgdW5pdCwgbGVuZ3RoID0geyBzZWNvbmQ6IDYwLCBtaW51dGU6IDYwLCBob3VyOiAyNCwgZGF5OiA3LCB3ZWVrOiA0LjM1LFxuICAgICAgICBtb250aDogMTIsIHllYXI6IDEwMDAwIH0sIHJlc3VsdDtcbiBcbiAgICBmb3IgKHVuaXQgaW4gbGVuZ3RoKSB7XG4gICAgICAgIHJlc3VsdCA9IHZhbCAlIGxlbmd0aFt1bml0XTtcbiAgICAgICAgaWYgKCEodmFsID0gMCB8IHZhbCAvIGxlbmd0aFt1bml0XSkpXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0ICsgJyAnICsgKHJlc3VsdC0xID8gdW5pdCArICdzJyA6IHVuaXQpICsgJyBhZ28nO1xuICAgIH1cbiAgICByZXR1cm4gJyc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJUaW1lYWdvKCkge1xuICAgIHZhciB4ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJpbmZvLWRhdGVcIik7XG4gICAgdmFyIGk7XG4gICAgZm9yIChpID0gMDsgaSA8IHgubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgeFtpXS5pbm5lckhUTUwgPSB0aW1lYWdvKHhbaV0uZ2V0QXR0cmlidXRlKCd0aW1lc3RhbXAnKSk7XG4gICAgfVxuICAgIHNldFRpbWVvdXQocmVuZGVyVGltZWFnbywgMTIwMCk7XG59IiwiaW1wb3J0IFNvY2tldHRlIGZyb20gJ3NvY2tldHRlJztcclxuXHJcbmltcG9ydCB7IGluaXQgfSBmcm9tICdzbmFiYmRvbSc7XHJcbmltcG9ydCB7IGggfSBmcm9tICdzbmFiYmRvbS9oJztcclxuaW1wb3J0IGtsYXNzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnO1xyXG5pbXBvcnQgYXR0cmlidXRlcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2F0dHJpYnV0ZXMnO1xyXG5pbXBvcnQgcHJvcGVydGllcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL3Byb3BzJztcclxuaW1wb3J0IGxpc3RlbmVycyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJztcclxuXHJcbmltcG9ydCB7IGtleTJwb3MsIHBvczJrZXkgfSBmcm9tICdjaGVzc2dyb3VuZHgvdXRpbCc7XHJcbmltcG9ydCB7IENoZXNzZ3JvdW5kIH0gZnJvbSAnY2hlc3Nncm91bmR4JztcclxuaW1wb3J0IHsgQXBpIH0gZnJvbSAnY2hlc3Nncm91bmR4L2FwaSc7XHJcbmltcG9ydCB7IENvbG9yLCBEZXN0cywgUGllY2VzRGlmZiwgUm9sZSwgS2V5LCBQb3MsIFBpZWNlIH0gZnJvbSAnY2hlc3Nncm91bmR4L3R5cGVzJztcclxuaW1wb3J0IHsgY2FuY2VsRHJvcE1vZGUgfSBmcm9tICdjaGVzc2dyb3VuZHgvZHJvcCc7XHJcblxyXG5pbXBvcnQgeyBDbG9jaywgcmVuZGVyVGltZSB9IGZyb20gJy4vY2xvY2snO1xyXG5pbXBvcnQgbWFrZUdhdGluZyBmcm9tICcuL2dhdGluZyc7XHJcbmltcG9ydCBtYWtlUHJvbW90aW9uIGZyb20gJy4vcHJvbW90aW9uJztcclxuaW1wb3J0IHsgZHJvcElzVmFsaWQsIHBvY2tldFZpZXcsIHVwZGF0ZVBvY2tldHMgfSBmcm9tICcuL3BvY2tldCc7XHJcbmltcG9ydCB7IHNvdW5kIH0gZnJvbSAnLi9zb3VuZCc7XHJcbmltcG9ydCB7IHZhcmlhbnRzLCBoYXNFcCwgbmVlZFBvY2tldHMsIHJvbGVUb1NhbiwgdWNpMnVzaSwgdXNpMnVjaSwgZ3JhbmQyemVybywgemVybzJncmFuZCwgVkFSSUFOVFMgfSBmcm9tICcuL2NoZXNzJztcclxuaW1wb3J0IHsgcmVuZGVyVXNlcm5hbWUgfSBmcm9tICcuL3VzZXInO1xyXG5pbXBvcnQgeyBjaGF0TWVzc2FnZSwgY2hhdFZpZXcgfSBmcm9tICcuL2NoYXQnO1xyXG5pbXBvcnQgeyBzZXR0aW5nc1ZpZXcgfSBmcm9tICcuL3NldHRpbmdzJztcclxuaW1wb3J0IHsgbW92ZWxpc3RWaWV3LCB1cGRhdGVNb3ZlbGlzdCB9IGZyb20gJy4vbW92ZWxpc3QnO1xyXG5pbXBvcnQgcmVzaXplSGFuZGxlIGZyb20gJy4vcmVzaXplJztcclxuaW1wb3J0IHsgcmVzdWx0IH0gZnJvbSAnLi9wcm9maWxlJ1xyXG5pbXBvcnQgeyBwbGF5ZXIgfSBmcm9tICcuL3BsYXllcic7XHJcblxyXG5jb25zdCBwYXRjaCA9IGluaXQoW2tsYXNzLCBhdHRyaWJ1dGVzLCBwcm9wZXJ0aWVzLCBsaXN0ZW5lcnNdKTtcclxuXHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBSb3VuZENvbnRyb2xsZXIge1xyXG4gICAgbW9kZWw7XHJcbiAgICBzb2NrO1xyXG4gICAgY2hlc3Nncm91bmQ6IEFwaTtcclxuICAgIGZ1bGxmZW46IHN0cmluZztcclxuICAgIHdwbGF5ZXI6IHN0cmluZztcclxuICAgIGJwbGF5ZXI6IHN0cmluZztcclxuICAgIGJhc2U6IG51bWJlcjtcclxuICAgIGluYzogbnVtYmVyO1xyXG4gICAgbXljb2xvcjogQ29sb3I7XHJcbiAgICBvcHBjb2xvcjogQ29sb3I7XHJcbiAgICB0dXJuQ29sb3I6IENvbG9yO1xyXG4gICAgY2xvY2tzOiBhbnk7XHJcbiAgICBhYm9ydGFibGU6IGJvb2xlYW47XHJcbiAgICBnYW1lSWQ6IHN0cmluZztcclxuICAgIHZhcmlhbnQ6IHN0cmluZztcclxuICAgIHBvY2tldHM6IGFueTtcclxuICAgIHZwb2NrZXQwOiBhbnk7XHJcbiAgICB2cG9ja2V0MTogYW55O1xyXG4gICAgdnBsYXllcjA6IGFueTtcclxuICAgIHZwbGF5ZXIxOiBhbnk7XHJcbiAgICB2cG5nOiBhbnk7XHJcbiAgICBnYW1lQ29udHJvbHM6IGFueTtcclxuICAgIG1vdmVDb250cm9sczogYW55O1xyXG4gICAgZ2F0aW5nOiBhbnk7XHJcbiAgICBwcm9tb3Rpb246IGFueTtcclxuICAgIGRlc3RzOiBEZXN0cztcclxuICAgIHByb21vdGlvbnM6IHN0cmluZ1tdO1xyXG4gICAgbGFzdG1vdmU6IEtleVtdO1xyXG4gICAgcHJlbW92ZTogYW55O1xyXG4gICAgcHJlZHJvcDogYW55O1xyXG4gICAgcmVzdWx0OiBzdHJpbmc7XHJcbiAgICBmbGlwOiBib29sZWFuO1xyXG4gICAgc3BlY3RhdG9yOiBib29sZWFuO1xyXG4gICAgb3BwSXNSYW5kb21Nb3ZlcjogYm9vbGVhbjtcclxuICAgIHNldHRpbmdzOiBib29sZWFuO1xyXG4gICAgdHY6IGJvb2xlYW47XHJcbiAgICBzdGF0dXM6IG51bWJlcjtcclxuICAgIHN0ZXBzO1xyXG4gICAgcGduOiBzdHJpbmc7XHJcbiAgICBwbHk6IG51bWJlcjtcclxuICAgIHBsYXllcnM6IHN0cmluZ1tdO1xyXG4gICAgdGl0bGVzOiBzdHJpbmdbXTtcclxuICAgIENTU2luZGV4ZXM6IG51bWJlcltdO1xyXG4gICAgY2xpY2tEcm9wOiBQaWVjZSB8IHVuZGVmaW5lZDtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihlbCwgbW9kZWwpIHtcclxuICAgICAgICBjb25zdCBvbk9wZW4gPSAoZXZ0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY3RybC5vbk9wZW4oKVwiLCBldnQpO1xyXG4gICAgICAgICAgICB0aGlzLmNsb2Nrc1swXS5jb25uZWN0aW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvY2tzWzFdLmNvbm5lY3RpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgdGhpcy5kb1NlbmQoeyB0eXBlOiBcImdhbWVfdXNlcl9jb25uZWN0ZWRcIiwgdXNlcm5hbWU6IHRoaXMubW9kZWxbXCJ1c2VybmFtZVwiXSwgZ2FtZUlkOiB0aGlzLm1vZGVsW1wiZ2FtZUlkXCJdIH0pO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNvbnN0IG9wdHMgPSB7XHJcbiAgICAgICAgICAgIG1heEF0dGVtcHRzOiAxMCxcclxuICAgICAgICAgICAgb25vcGVuOiBlID0+IG9uT3BlbihlKSxcclxuICAgICAgICAgICAgb25tZXNzYWdlOiBlID0+IHRoaXMub25NZXNzYWdlKGUpLFxyXG4gICAgICAgICAgICBvbnJlY29ubmVjdDogZSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNsb2Nrc1swXS5jb25uZWN0aW5nID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2xvY2tzWzFdLmNvbm5lY3RpbmcgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1JlY29ubmVjdGluZyBpbiByb3VuZC4uLicsIGUpO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWVyMScpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgcGF0Y2goY29udGFpbmVyLCBoKCdpLXNpZGUub25saW5lI3BsYXllcjEnLCB7Y2xhc3M6IHtcImljb25cIjogdHJ1ZSwgXCJpY29uLW9ubGluZVwiOiBmYWxzZSwgXCJpY29uLW9mZmxpbmVcIjogdHJ1ZX19KSk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBvbm1heGltdW06IGUgPT4gY29uc29sZS5sb2coJ1N0b3AgQXR0ZW1wdGluZyEnLCBlKSxcclxuICAgICAgICAgICAgb25jbG9zZTogZSA9PiBjb25zb2xlLmxvZygnQ2xvc2VkIScsIGUpLFxyXG4gICAgICAgICAgICBvbmVycm9yOiBlID0+IGNvbnNvbGUubG9nKCdFcnJvcjonLCBlKSxcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgdGhpcy5zb2NrID0gbmV3IFNvY2tldHRlKFwid3M6Ly9cIiArIGxvY2F0aW9uLmhvc3QgKyBcIi93c3JcIiwgb3B0cyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNhdGNoKGVycikge1xyXG4gICAgICAgICAgICB0aGlzLnNvY2sgPSBuZXcgU29ja2V0dGUoXCJ3c3M6Ly9cIiArIGxvY2F0aW9uLmhvc3QgKyBcIi93c3JcIiwgb3B0cyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLm1vZGVsID0gbW9kZWw7XHJcbiAgICAgICAgdGhpcy52YXJpYW50ID0gbW9kZWxbXCJ2YXJpYW50XCJdIGFzIHN0cmluZztcclxuICAgICAgICB0aGlzLmZ1bGxmZW4gPSBtb2RlbFtcImZlblwiXSBhcyBzdHJpbmc7XHJcbiAgICAgICAgdGhpcy53cGxheWVyID0gbW9kZWxbXCJ3cGxheWVyXCJdIGFzIHN0cmluZztcclxuICAgICAgICB0aGlzLmJwbGF5ZXIgPSBtb2RlbFtcImJwbGF5ZXJcIl0gYXMgc3RyaW5nO1xyXG4gICAgICAgIHRoaXMuYmFzZSA9IG1vZGVsW1wiYmFzZVwiXSBhcyBudW1iZXI7XHJcbiAgICAgICAgdGhpcy5pbmMgPSBtb2RlbFtcImluY1wiXSBhcyBudW1iZXI7XHJcbiAgICAgICAgdGhpcy5zdGF0dXMgPSBtb2RlbFtcInN0YXR1c1wiXSBhcyBudW1iZXI7XHJcbiAgICAgICAgdGhpcy50diA9IG1vZGVsW1widHZcIl07XHJcbiAgICAgICAgdGhpcy5zdGVwcyA9IFtdO1xyXG4gICAgICAgIHRoaXMucGduID0gXCJcIjtcclxuICAgICAgICB0aGlzLnBseSA9IDA7XHJcblxyXG4gICAgICAgIHRoaXMuZmxpcCA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuQ1NTaW5kZXhlcyA9IHZhcmlhbnRzLm1hcCgodmFyaWFudCkgPT4gbG9jYWxTdG9yYWdlW3ZhcmlhbnQgKyBcIl9waWVjZXNcIl0gPT09IHVuZGVmaW5lZCA/IDAgOiBOdW1iZXIobG9jYWxTdG9yYWdlW3ZhcmlhbnQgKyBcIl9waWVjZXNcIl0pKTtcclxuXHJcbiAgICAgICAgdGhpcy5zcGVjdGF0b3IgPSB0aGlzLm1vZGVsW1widXNlcm5hbWVcIl0gIT09IHRoaXMud3BsYXllciAmJiB0aGlzLm1vZGVsW1widXNlcm5hbWVcIl0gIT09IHRoaXMuYnBsYXllcjtcclxuXHJcbiAgICAgICAgLy8gb3JpZW50YXRpb24gPSB0aGlzLm15Y29sb3JcclxuICAgICAgICBpZiAodGhpcy5zcGVjdGF0b3IpIHtcclxuICAgICAgICAgICAgdGhpcy5teWNvbG9yID0gdGhpcy52YXJpYW50ID09PSAnc2hvZ2knID8gJ2JsYWNrJyA6ICd3aGl0ZSc7XHJcbiAgICAgICAgICAgIHRoaXMub3BwY29sb3IgPSB0aGlzLnZhcmlhbnQgPT09ICdzaG9naScgPyAnd2hpdGUnIDogJ2JsYWNrJztcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLm15Y29sb3IgPSB0aGlzLm1vZGVsW1widXNlcm5hbWVcIl0gPT09IHRoaXMud3BsYXllciA/ICd3aGl0ZScgOiAnYmxhY2snO1xyXG4gICAgICAgICAgICB0aGlzLm9wcGNvbG9yID0gdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdID09PSB0aGlzLndwbGF5ZXIgPyAnYmxhY2snIDogJ3doaXRlJztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMub3BwSXNSYW5kb21Nb3ZlciA9IChcclxuICAgICAgICAgICAgKHRoaXMubXljb2xvciA9PT0gXCJ3aGl0ZVwiICYmIHRoaXMuYnBsYXllciA9PT0gXCJSYW5kb20tTW92ZXJcIikgfHxcclxuICAgICAgICAgICAgKHRoaXMubXljb2xvciA9PT0gXCJibGFja1wiICYmIHRoaXMud3BsYXllciA9PT0gXCJSYW5kb20tTW92ZXJcIikpO1xyXG5cclxuICAgICAgICAvLyBwbGF5ZXJzWzBdIGlzIHRvcCBwbGF5ZXIsIHBsYXllcnNbMV0gaXMgYm90dG9tIHBsYXllclxyXG4gICAgICAgIHRoaXMucGxheWVycyA9IFtcclxuICAgICAgICAgICAgdGhpcy5teWNvbG9yID09PSBcIndoaXRlXCIgPyB0aGlzLmJwbGF5ZXIgOiB0aGlzLndwbGF5ZXIsXHJcbiAgICAgICAgICAgIHRoaXMubXljb2xvciA9PT0gXCJ3aGl0ZVwiID8gdGhpcy53cGxheWVyIDogdGhpcy5icGxheWVyXHJcbiAgICAgICAgXTtcclxuICAgICAgICB0aGlzLnRpdGxlcyA9IFtcclxuICAgICAgICAgICAgdGhpcy5teWNvbG9yID09PSBcIndoaXRlXCIgPyB0aGlzLm1vZGVsWydidGl0bGUnXSA6IHRoaXMubW9kZWxbJ3d0aXRsZSddLFxyXG4gICAgICAgICAgICB0aGlzLm15Y29sb3IgPT09IFwid2hpdGVcIiA/IHRoaXMubW9kZWxbJ3d0aXRsZSddIDogdGhpcy5tb2RlbFsnYnRpdGxlJ11cclxuICAgICAgICBdO1xyXG5cclxuICAgICAgICB0aGlzLnByZW1vdmUgPSBudWxsO1xyXG4gICAgICAgIHRoaXMucHJlZHJvcCA9IG51bGw7XHJcblxyXG4gICAgICAgIHRoaXMucmVzdWx0ID0gXCJcIjtcclxuICAgICAgICBjb25zdCBwYXJ0cyA9IHRoaXMuZnVsbGZlbi5zcGxpdChcIiBcIik7XHJcbiAgICAgICAgdGhpcy5hYm9ydGFibGUgPSBOdW1iZXIocGFydHNbcGFydHMubGVuZ3RoIC0gMV0pIDw9IDE7XHJcblxyXG4gICAgICAgIGNvbnN0IGZlbl9wbGFjZW1lbnQgPSBwYXJ0c1swXTtcclxuICAgICAgICB0aGlzLnR1cm5Db2xvciA9IHBhcnRzWzFdID09PSBcIndcIiA/IFwid2hpdGVcIiA6IFwiYmxhY2tcIjtcclxuXHJcbiAgICAgICAgdGhpcy5zdGVwcy5wdXNoKHtcclxuICAgICAgICAgICAgJ2Zlbic6IGZlbl9wbGFjZW1lbnQsXHJcbiAgICAgICAgICAgICdtb3ZlJzogdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAnY2hlY2snOiBmYWxzZSxcclxuICAgICAgICAgICAgJ3R1cm5Db2xvcic6IHRoaXMudHVybkNvbG9yLFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5jaGVzc2dyb3VuZCA9IENoZXNzZ3JvdW5kKGVsLCB7XHJcbiAgICAgICAgICAgIGZlbjogZmVuX3BsYWNlbWVudCxcclxuICAgICAgICAgICAgZ2VvbWV0cnk6IFZBUklBTlRTW3RoaXMudmFyaWFudF0uZ2VvbSxcclxuICAgICAgICAgICAgb3JpZW50YXRpb246IHRoaXMubXljb2xvcixcclxuICAgICAgICAgICAgdHVybkNvbG9yOiB0aGlzLnR1cm5Db2xvcixcclxuICAgICAgICAgICAgYW5pbWF0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBldmVudHM6IHtcclxuICAgICAgICAgICAgICAgIGluc2VydChlbGVtZW50cykge3Jlc2l6ZUhhbmRsZShlbGVtZW50cyk7fVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLnNwZWN0YXRvcikge1xyXG4gICAgICAgICAgICB0aGlzLmNoZXNzZ3JvdW5kLnNldCh7XHJcbiAgICAgICAgICAgICAgICB2aWV3T25seTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGV2ZW50czoge1xyXG4gICAgICAgICAgICAgICAgICAgIG1vdmU6IHRoaXMub25Nb3ZlKCksXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2hlc3Nncm91bmQuc2V0KHtcclxuICAgICAgICAgICAgICAgIG1vdmFibGU6IHtcclxuICAgICAgICAgICAgICAgICAgICBmcmVlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBjb2xvcjogdGhpcy5teWNvbG9yLFxyXG4gICAgICAgICAgICAgICAgICAgIHNob3dEZXN0czogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBldmVudHM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWZ0ZXI6IHRoaXMub25Vc2VyTW92ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWZ0ZXJOZXdQaWVjZTogdGhpcy5vblVzZXJEcm9wLFxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBwcmVtb3ZhYmxlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBldmVudHM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2V0OiB0aGlzLnNldFByZW1vdmUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVuc2V0OiB0aGlzLnVuc2V0UHJlbW92ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHByZWRyb3BwYWJsZToge1xyXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldDogdGhpcy5zZXRQcmVkcm9wLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB1bnNldDogdGhpcy51bnNldFByZWRyb3AsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBldmVudHM6IHtcclxuICAgICAgICAgICAgICAgICAgICBtb3ZlOiB0aGlzLm9uTW92ZSgpLFxyXG4gICAgICAgICAgICAgICAgICAgIGRyb3BOZXdQaWVjZTogdGhpcy5vbkRyb3AoKSxcclxuICAgICAgICAgICAgICAgICAgICBzZWxlY3Q6IHRoaXMub25TZWxlY3QodGhpcy5jaGVzc2dyb3VuZC5zdGF0ZS5zZWxlY3RlZCksXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuZ2F0aW5nID0gbWFrZUdhdGluZyh0aGlzKTtcclxuICAgICAgICB0aGlzLnByb21vdGlvbiA9IG1ha2VQcm9tb3Rpb24odGhpcyk7XHJcblxyXG4gICAgICAgIC8vIGluaXRpYWxpemUgdXNlcnNcclxuICAgICAgICBjb25zdCBwbGF5ZXIwID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JwbGF5ZXIwJykgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgY29uc3QgcGxheWVyMSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdycGxheWVyMScpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgIHRoaXMudnBsYXllcjAgPSBwYXRjaChwbGF5ZXIwLCBwbGF5ZXIoJ3BsYXllcjAnLCB0aGlzLnRpdGxlc1swXSwgdGhpcy5wbGF5ZXJzWzBdLCBtb2RlbFtcImxldmVsXCJdKSk7XHJcbiAgICAgICAgdGhpcy52cGxheWVyMSA9IHBhdGNoKHBsYXllcjEsIHBsYXllcigncGxheWVyMScsIHRoaXMudGl0bGVzWzFdLCB0aGlzLnBsYXllcnNbMV0sIG1vZGVsW1wibGV2ZWxcIl0pKTtcclxuXHJcbiAgICAgICAgLy8gaW5pdGlhbGl6ZSBwb2NrZXRzXHJcbiAgICAgICAgaWYgKG5lZWRQb2NrZXRzKHRoaXMudmFyaWFudCkpIHtcclxuICAgICAgICAgICAgY29uc3QgcG9ja2V0MCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwb2NrZXQwJykgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGNvbnN0IHBvY2tldDEgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncG9ja2V0MScpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICB1cGRhdGVQb2NrZXRzKHRoaXMsIHBvY2tldDAsIHBvY2tldDEpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gaW5pdGlhbGl6ZSBjbG9ja3NcclxuICAgICAgICBjb25zdCBjMCA9IG5ldyBDbG9jayh0aGlzLmJhc2UsIHRoaXMuaW5jLCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xvY2swJykgYXMgSFRNTEVsZW1lbnQsICdjbG9jazAnKTtcclxuICAgICAgICBjb25zdCBjMSA9IG5ldyBDbG9jayh0aGlzLmJhc2UsIHRoaXMuaW5jLCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xvY2sxJykgYXMgSFRNTEVsZW1lbnQsICdjbG9jazEnKTtcclxuICAgICAgICB0aGlzLmNsb2NrcyA9IFtjMCwgYzFdO1xyXG4gICAgICAgIHRoaXMuY2xvY2tzWzBdLm9uVGljayhyZW5kZXJUaW1lKTtcclxuICAgICAgICB0aGlzLmNsb2Nrc1sxXS5vblRpY2socmVuZGVyVGltZSk7XHJcblxyXG4gICAgICAgIGNvbnN0IG9uTW9yZVRpbWUgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIC8vIFRPRE86IGVuYWJsZSB3aGVuIHRoaXMuZmxpcCBpcyB0cnVlXHJcbiAgICAgICAgICAgIGlmICh0aGlzLm1vZGVsWyd3dGl0bGUnXSA9PT0gJ0JPVCcgfHwgdGhpcy5tb2RlbFsnYnRpdGxlJ10gPT09ICdCT1QnIHx8IHRoaXMuc3BlY3RhdG9yIHx8IHRoaXMuc3RhdHVzID49IDAgfHwgdGhpcy5mbGlwKSByZXR1cm47XHJcbiAgICAgICAgICAgIHRoaXMuY2xvY2tzWzBdLnNldFRpbWUodGhpcy5jbG9ja3NbMF0uZHVyYXRpb24gKyAxNSAqIDEwMDApO1xyXG4gICAgICAgICAgICB0aGlzLmRvU2VuZCh7IHR5cGU6IFwibW9yZXRpbWVcIiwgZ2FtZUlkOiB0aGlzLm1vZGVsW1wiZ2FtZUlkXCJdIH0pO1xyXG4gICAgICAgICAgICBjaGF0TWVzc2FnZSgnJywgdGhpcy5vcHBjb2xvciArICcgKzE1IHNlY29uZHMnLCBcInJvdW5kY2hhdFwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xvY2swJykgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgcGF0Y2goY29udGFpbmVyLCBoKCdkaXYuY2xvY2std3JhcCNjbG9jazAnLCBbXHJcbiAgICAgICAgICAgIGgoJ2Rpdi5tb3JlLXRpbWUnLCBbXHJcbiAgICAgICAgICAgICAgICBoKCdidXR0b24uaWNvbi5pY29uLXBsdXMtc3F1YXJlJywge1xyXG4gICAgICAgICAgICAgICAgICAgIHByb3BzOiB7dHlwZTogXCJidXR0b25cIiwgdGl0bGU6IFwiR2l2ZSAxNSBzZWNvbmRzXCJ9LFxyXG4gICAgICAgICAgICAgICAgICAgIG9uOiB7Y2xpY2s6ICgpID0+IG9uTW9yZVRpbWUoKSB9XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICBdKVxyXG4gICAgICAgIF0pXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3QgZmxhZ0NhbGxiYWNrID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAodGhpcy50dXJuQ29sb3IgPT09IHRoaXMubXljb2xvcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jaGVzc2dyb3VuZC5zdG9wKCk7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkZsYWdcIik7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRvU2VuZCh7IHR5cGU6IFwiZmxhZ1wiLCBnYW1lSWQ6IHRoaXMubW9kZWxbXCJnYW1lSWRcIl0gfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF0aGlzLnNwZWN0YXRvcikgdGhpcy5jbG9ja3NbMV0ub25GbGFnKGZsYWdDYWxsYmFjayk7XHJcblxyXG4gICAgICAgIGNvbnN0IGFib3J0ID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIkFib3J0XCIpO1xyXG4gICAgICAgICAgICB0aGlzLmRvU2VuZCh7IHR5cGU6IFwiYWJvcnRcIiwgZ2FtZUlkOiB0aGlzLm1vZGVsW1wiZ2FtZUlkXCJdIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgZHJhdyA9ICgpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJEcmF3XCIpO1xyXG4gICAgICAgICAgICB0aGlzLmRvU2VuZCh7IHR5cGU6IFwiZHJhd1wiLCBnYW1lSWQ6IHRoaXMubW9kZWxbXCJnYW1lSWRcIl0gfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCByZXNpZ24gPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiUmVzaWduXCIpO1xyXG4gICAgICAgICAgICB0aGlzLmRvU2VuZCh7IHR5cGU6IFwicmVzaWduXCIsIGdhbWVJZDogdGhpcy5tb2RlbFtcImdhbWVJZFwiXSB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2FtZS1jb250cm9scycpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgIGlmICghdGhpcy5zcGVjdGF0b3IpIHtcclxuICAgICAgICAgICAgdGhpcy5nYW1lQ29udHJvbHMgPSBwYXRjaChjb250YWluZXIsIGgoJ2Rpdi5idG4tY29udHJvbHMnLCBbXHJcbiAgICAgICAgICAgICAgICBoKCdidXR0b24jYWJvcnQnLCB7IG9uOiB7IGNsaWNrOiAoKSA9PiBhYm9ydCgpIH0sIHByb3BzOiB7dGl0bGU6ICdBYm9ydCd9IH0sIFtoKCdpJywge2NsYXNzOiB7XCJpY29uXCI6IHRydWUsIFwiaWNvbi1hYm9ydFwiOiB0cnVlfSB9ICksIF0pLFxyXG4gICAgICAgICAgICAgICAgaCgnYnV0dG9uI2RyYXcnLCB7IG9uOiB7IGNsaWNrOiAoKSA9PiBkcmF3KCkgfSwgcHJvcHM6IHt0aXRsZTogXCJEcmF3XCJ9IH0sIFtoKCdpJywge2NsYXNzOiB7XCJpY29uXCI6IHRydWUsIFwiaWNvbi1oYW5kLXBhcGVyLW9cIjogdHJ1ZX0gfSApLCBdKSxcclxuICAgICAgICAgICAgICAgIGgoJ2J1dHRvbiNyZXNpZ24nLCB7IG9uOiB7IGNsaWNrOiAoKSA9PiByZXNpZ24oKSB9LCBwcm9wczoge3RpdGxlOiBcIlJlc2lnblwifSB9LCBbaCgnaScsIHtjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tZmxhZy1vXCI6IHRydWV9IH0gKSwgXSksXHJcbiAgICAgICAgICAgICAgICBdKVxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuZ2FtZUNvbnRyb2xzID0gcGF0Y2goY29udGFpbmVyLCBoKCdkaXYnKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwYXRjaChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYm9hcmQtc2V0dGluZ3MnKSBhcyBIVE1MRWxlbWVudCwgc2V0dGluZ3NWaWV3KHRoaXMpKTtcclxuXHJcbiAgICAgICAgcGF0Y2goZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21vdmVsaXN0JykgYXMgSFRNTEVsZW1lbnQsIG1vdmVsaXN0Vmlldyh0aGlzKSk7XHJcblxyXG4gICAgICAgIHBhdGNoKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyb3VuZGNoYXQnKSBhcyBIVE1MRWxlbWVudCwgY2hhdFZpZXcodGhpcywgXCJyb3VuZGNoYXRcIikpO1xyXG4gICAgfVxyXG5cclxuICAgIGdldEdyb3VuZCA9ICgpID0+IHRoaXMuY2hlc3Nncm91bmQ7XHJcbiAgICBnZXREZXN0cyA9ICgpID0+IHRoaXMuZGVzdHM7XHJcblxyXG4gICAgcHJpdmF0ZSBvbk1zZ0dhbWVTdGFydCA9IChtc2cpID0+IHtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcImdvdCBnYW1lU3RhcnQgbXNnOlwiLCBtc2cpO1xyXG4gICAgICAgIGlmIChtc2cuZ2FtZUlkICE9PSB0aGlzLm1vZGVsW1wiZ2FtZUlkXCJdKSByZXR1cm47XHJcbiAgICAgICAgaWYgKCF0aGlzLnNwZWN0YXRvcikgc291bmQuZ2VuZXJpY05vdGlmeSgpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgb25Nc2dOZXdHYW1lID0gKG1zZykgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiR2FtZUNvbnRyb2xsZXIub25Nc2dOZXdHYW1lKClcIiwgdGhpcy5tb2RlbFtcImdhbWVJZFwiXSlcclxuICAgICAgICB3aW5kb3cubG9jYXRpb24uYXNzaWduKHRoaXMubW9kZWxbXCJob21lXCJdICsgJy8nICsgbXNnW1wiZ2FtZUlkXCJdKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHJlbWF0Y2ggPSAoKSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJSRU1BVENIXCIpO1xyXG4gICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJyZW1hdGNoXCIsIGdhbWVJZDogdGhpcy5tb2RlbFtcImdhbWVJZFwiXSB9KTtcclxuICAgICAgICAvLyB3aW5kb3cubG9jYXRpb24uYXNzaWduKGhvbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgbmV3T3Bwb25lbnQgPSAoaG9tZSkgPT4ge1xyXG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5hc3NpZ24oaG9tZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBnYW1lT3ZlciA9ICgpID0+IHtcclxuICAgICAgICB0aGlzLmdhbWVDb250cm9scyA9IHBhdGNoKHRoaXMuZ2FtZUNvbnRyb2xzLCBoKCdkaXYnKSk7XHJcblxyXG4gICAgICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWZ0ZXItZ2FtZScpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgIGlmICh0aGlzLnNwZWN0YXRvcikge1xyXG4gICAgICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ2Rpdi5hZnRlci1nYW1lJywgW2goJ3Jlc3VsdCcsIHJlc3VsdCh0aGlzLnN0YXR1cywgdGhpcy5yZXN1bHQpKV0pKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ2Rpdi5hZnRlci1nYW1lJywgW1xyXG4gICAgICAgICAgICAgICAgaCgncmVzdWx0JywgcmVzdWx0KHRoaXMuc3RhdHVzLCB0aGlzLnJlc3VsdCkpLFxyXG4gICAgICAgICAgICAgICAgaCgnYnV0dG9uLnJlbWF0Y2gnLCB7IG9uOiB7IGNsaWNrOiAoKSA9PiB0aGlzLnJlbWF0Y2goKSB9IH0sIFwiUkVNQVRDSFwiKSxcclxuICAgICAgICAgICAgICAgIGgoJ2J1dHRvbi5uZXdvcHAnLCB7IG9uOiB7IGNsaWNrOiAoKSA9PiB0aGlzLm5ld09wcG9uZW50KHRoaXMubW9kZWxbXCJob21lXCJdKSB9IH0sIFwiTkVXIE9QUE9ORU5UXCIpLFxyXG4gICAgICAgICAgICBdKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgY2hlY2tTdGF0dXMgPSAobXNnKSA9PiB7XHJcbiAgICAgICAgaWYgKG1zZy5nYW1lSWQgIT09IHRoaXMubW9kZWxbXCJnYW1lSWRcIl0pIHJldHVybjtcclxuICAgICAgICBpZiAobXNnLnN0YXR1cyA+PSAwICYmIHRoaXMucmVzdWx0ID09PSBcIlwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvY2tzWzBdLnBhdXNlKGZhbHNlKTtcclxuICAgICAgICAgICAgdGhpcy5jbG9ja3NbMV0ucGF1c2UoZmFsc2UpO1xyXG4gICAgICAgICAgICB0aGlzLnJlc3VsdCA9IG1zZy5yZXN1bHQ7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhdHVzID0gbXNnLnN0YXR1cztcclxuICAgICAgICAgICAgc3dpdGNoIChtc2cucmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiMS8yLTEvMlwiOlxyXG4gICAgICAgICAgICAgICAgICAgIHNvdW5kLmRyYXcoKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgXCIxLTBcIjpcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuc3BlY3RhdG9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLm15Y29sb3IgPT09IFwid2hpdGVcIikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc291bmQudmljdG9yeSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc291bmQuZGVmZWF0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiMC0xXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnNwZWN0YXRvcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5teWNvbG9yID09PSBcImJsYWNrXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNvdW5kLnZpY3RvcnkoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNvdW5kLmRlZmVhdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgLy8gQUJPUlRFRFxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLmdhbWVPdmVyKCk7XHJcblxyXG4gICAgICAgICAgICAvLyBjbGVhbiB1cCBnYXRpbmcvcHJvbW90aW9uIHdpZGdldCBsZWZ0IG92ZXIgdGhlIGdyb3VuZCB3aGlsZSBnYW1lIGVuZGVkIGJ5IHRpbWUgb3V0XHJcbiAgICAgICAgICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZXh0ZW5zaW9uX2Nob2ljZScpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAoY29udGFpbmVyIGluc3RhbmNlb2YgRWxlbWVudCkgcGF0Y2goY29udGFpbmVyLCBoKCdleHRlbnNpb24nKSk7XHJcblxyXG4gICAgICAgICAgICAvLyBUT0RPOiBtb3ZlIHRoaXMgdG8gKG5vdCBpbXBsZW1lbnRlZCB5ZXQpIGFuYWx5c2lzIHBhZ2VcclxuICAgICAgICAgICAgdGhpcy5wZ24gPSBtc2cucGduO1xyXG4gICAgICAgICAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BnbicpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICB0aGlzLnZwbmcgPSBwYXRjaChjb250YWluZXIsIGgoJ2RpdiNwZ24nLCBbaCgnZGl2JywgdGhpcy5mdWxsZmVuKSwgaCgndGV4dGFyZWEnLCB7IGF0dHJzOiB7IHJvd3M6IDEzfSB9LCBtc2cucGduKV0pKTtcclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLnR2KSB7XHJcbiAgICAgICAgICAgICAgICBzZXRJbnRlcnZhbCgoKSA9PiB7dGhpcy5kb1NlbmQoeyB0eXBlOiBcInVwZGF0ZVRWXCIsIGdhbWVJZDogdGhpcy5tb2RlbFtcImdhbWVJZFwiXSwgcHJvZmlsZUlkOiB0aGlzLm1vZGVsW1wicHJvZmlsZWlkXCJdIH0pO30sIDIwMDApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgb25Nc2dVcGRhdGVUViA9IChtc2cpID0+IHtcclxuICAgICAgICBpZiAobXNnLmdhbWVJZCAhPT0gdGhpcy5tb2RlbFtcImdhbWVJZFwiXSkge1xyXG4gICAgICAgICAgICB3aW5kb3cubG9jYXRpb24uYXNzaWduKHRoaXMubW9kZWxbXCJob21lXCJdICsgJy90dicpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uTXNnQm9hcmQgPSAobXNnKSA9PiB7XHJcbiAgICAgICAgaWYgKG1zZy5nYW1lSWQgIT09IHRoaXMubW9kZWxbXCJnYW1lSWRcIl0pIHJldHVybjtcclxuXHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJnb3QgYm9hcmQgbXNnOlwiLCBtc2cpO1xyXG4gICAgICAgIHRoaXMucGx5ID0gbXNnLnBseVxyXG4gICAgICAgIHRoaXMuZnVsbGZlbiA9IG1zZy5mZW47XHJcbiAgICAgICAgdGhpcy5kZXN0cyA9IG1zZy5kZXN0cztcclxuICAgICAgICAvLyBsaXN0IG9mIGxlZ2FsIHByb21vdGlvbiBtb3Zlc1xyXG4gICAgICAgIHRoaXMucHJvbW90aW9ucyA9IG1zZy5wcm9tbztcclxuICAgICAgICBjb25zdCBjbG9ja3MgPSBtc2cuY2xvY2tzO1xyXG5cclxuICAgICAgICBjb25zdCBwYXJ0cyA9IG1zZy5mZW4uc3BsaXQoXCIgXCIpO1xyXG4gICAgICAgIHRoaXMudHVybkNvbG9yID0gcGFydHNbMV0gPT09IFwid1wiID8gXCJ3aGl0ZVwiIDogXCJibGFja1wiO1xyXG5cclxuICAgICAgICBpZiAobXNnLnN0ZXBzLmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgdGhpcy5zdGVwcyA9IFtdO1xyXG4gICAgICAgICAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21vdmVsaXN0JykgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIHBhdGNoKGNvbnRhaW5lciwgaCgnZGl2I21vdmVsaXN0JykpO1xyXG5cclxuICAgICAgICAgICAgbXNnLnN0ZXBzLmZvckVhY2goKHN0ZXApID0+IHsgXHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0ZXBzLnB1c2goc3RlcCk7XHJcbiAgICAgICAgICAgICAgICB1cGRhdGVNb3ZlbGlzdCh0aGlzKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmIChtc2cucGx5ID09PSB0aGlzLnN0ZXBzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RlcCA9IHtcclxuICAgICAgICAgICAgICAgICAgICAnZmVuJzogbXNnLmZlbixcclxuICAgICAgICAgICAgICAgICAgICAnbW92ZSc6IG1zZy5sYXN0TW92ZSxcclxuICAgICAgICAgICAgICAgICAgICAnY2hlY2snOiBtc2cuY2hlY2ssXHJcbiAgICAgICAgICAgICAgICAgICAgJ3R1cm5Db2xvcic6IHRoaXMudHVybkNvbG9yLFxyXG4gICAgICAgICAgICAgICAgICAgICdzYW4nOiBtc2cuc3RlcHNbMF0uc2FuLFxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0ZXBzLnB1c2goc3RlcCk7XHJcbiAgICAgICAgICAgICAgICB1cGRhdGVNb3ZlbGlzdCh0aGlzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5hYm9ydGFibGUgPSBOdW1iZXIocGFydHNbcGFydHMubGVuZ3RoIC0gMV0pIDw9IDE7XHJcbiAgICAgICAgaWYgKCF0aGlzLnNwZWN0YXRvciAmJiAhdGhpcy5hYm9ydGFibGUgJiYgdGhpcy5yZXN1bHQgPT09IFwiXCIpIHtcclxuICAgICAgICAgICAgdmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhYm9ydCcpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ2J1dHRvbiNhYm9ydCcsIHsgcHJvcHM6IHtkaXNhYmxlZDogdHJ1ZX0gfSkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIGxhc3RNb3ZlID0gbXNnLmxhc3RNb3ZlO1xyXG4gICAgICAgIGlmIChsYXN0TW92ZSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy52YXJpYW50ID09PSBcInNob2dpXCIpIHtcclxuICAgICAgICAgICAgICAgIGxhc3RNb3ZlID0gdXNpMnVjaShsYXN0TW92ZSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy52YXJpYW50ID09PSBcImdyYW5kXCIgfHwgdGhpcy52YXJpYW50ID09PSBcImdyYW5kaG91c2VcIikge1xyXG4gICAgICAgICAgICAgICAgbGFzdE1vdmUgPSBncmFuZDJ6ZXJvKGxhc3RNb3ZlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBsYXN0TW92ZSA9IFtsYXN0TW92ZS5zbGljZSgwLDIpLCBsYXN0TW92ZS5zbGljZSgyLDQpXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gZHJvcCBsYXN0TW92ZSBjYXVzaW5nIHNjcm9sbGJhciBmbGlja2VyLFxyXG4gICAgICAgIC8vIHNvIHdlIHJlbW92ZSBmcm9tIHBhcnQgdG8gYXZvaWQgdGhhdFxyXG4gICAgICAgIGlmIChsYXN0TW92ZSAhPT0gbnVsbCAmJiBsYXN0TW92ZVswXVsxXSA9PT0gJ0AnKSBsYXN0TW92ZSA9IFtsYXN0TW92ZVsxXV07XHJcbiAgICAgICAgLy8gc2F2ZSBjYXB0dXJlIHN0YXRlIGJlZm9yZSB1cGRhdGluZyBjaGVzc2dyb3VuZFxyXG4gICAgICAgIGNvbnN0IGNhcHR1cmUgPSBsYXN0TW92ZSAhPT0gbnVsbCAmJiB0aGlzLmNoZXNzZ3JvdW5kLnN0YXRlLnBpZWNlc1tsYXN0TW92ZVsxXV1cclxuXHJcbiAgICAgICAgaWYgKGxhc3RNb3ZlICE9PSBudWxsICYmICh0aGlzLnR1cm5Db2xvciA9PT0gdGhpcy5teWNvbG9yIHx8IHRoaXMuc3BlY3RhdG9yKSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy52YXJpYW50ID09PSBcInNob2dpXCIpIHtcclxuICAgICAgICAgICAgICAgIHNvdW5kLnNob2dpbW92ZSgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhcHR1cmUpIHtcclxuICAgICAgICAgICAgICAgICAgICBzb3VuZC5jYXB0dXJlKCk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHNvdW5kLm1vdmUoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGxhc3RNb3ZlID0gW107XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuY2hlY2tTdGF0dXMobXNnKTtcclxuICAgICAgICBpZiAobXNnLmNoZWNrKSB7XHJcbiAgICAgICAgICAgIHNvdW5kLmNoZWNrKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBvcHBjbG9jayA9ICF0aGlzLmZsaXAgPyAwIDogMTtcclxuICAgICAgICBjb25zdCBteWNsb2NrID0gMSAtIG9wcGNsb2NrO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5zcGVjdGF0b3IpIHtcclxuICAgICAgICAgICAgdGhpcy5jaGVzc2dyb3VuZC5zZXQoe1xyXG4gICAgICAgICAgICAgICAgZmVuOiBwYXJ0c1swXSxcclxuICAgICAgICAgICAgICAgIHR1cm5Db2xvcjogdGhpcy50dXJuQ29sb3IsXHJcbiAgICAgICAgICAgICAgICBjaGVjazogbXNnLmNoZWNrLFxyXG4gICAgICAgICAgICAgICAgbGFzdE1vdmU6IGxhc3RNb3ZlLFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdXBkYXRlUG9ja2V0cyh0aGlzLCB0aGlzLnZwb2NrZXQwLCB0aGlzLnZwb2NrZXQxKTtcclxuICAgICAgICAgICAgdGhpcy5jbG9ja3NbMF0ucGF1c2UoZmFsc2UpO1xyXG4gICAgICAgICAgICB0aGlzLmNsb2Nrc1sxXS5wYXVzZShmYWxzZSk7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvY2tzW29wcGNsb2NrXS5zZXRUaW1lKGNsb2Nrc1t0aGlzLm9wcGNvbG9yXSk7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvY2tzW215Y2xvY2tdLnNldFRpbWUoY2xvY2tzW3RoaXMubXljb2xvcl0pO1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuYWJvcnRhYmxlICYmIG1zZy5zdGF0dXMgPCAwKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy50dXJuQ29sb3IgPT09IHRoaXMubXljb2xvcikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xvY2tzW215Y2xvY2tdLnN0YXJ0KCk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xvY2tzW29wcGNsb2NrXS5zdGFydCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMudHVybkNvbG9yID09PSB0aGlzLm15Y29sb3IpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2hlc3Nncm91bmQuc2V0KHtcclxuICAgICAgICAgICAgICAgICAgICBmZW46IHBhcnRzWzBdLFxyXG4gICAgICAgICAgICAgICAgICAgIHR1cm5Db2xvcjogdGhpcy50dXJuQ29sb3IsXHJcbiAgICAgICAgICAgICAgICAgICAgbW92YWJsZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmcmVlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6IHRoaXMubXljb2xvcixcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzdHM6IG1zZy5kZXN0cyxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGNoZWNrOiBtc2cuY2hlY2ssXHJcbiAgICAgICAgICAgICAgICAgICAgbGFzdE1vdmU6IGxhc3RNb3ZlLFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB1cGRhdGVQb2NrZXRzKHRoaXMsIHRoaXMudnBvY2tldDAsIHRoaXMudnBvY2tldDEpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jbG9ja3Nbb3BwY2xvY2tdLnBhdXNlKGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2xvY2tzW29wcGNsb2NrXS5zZXRUaW1lKGNsb2Nrc1t0aGlzLm9wcGNvbG9yXSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNsb2Nrc1tteWNsb2NrXS5zZXRUaW1lKGNsb2Nrc1t0aGlzLm15Y29sb3JdKTtcclxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5hYm9ydGFibGUgJiYgbXNnLnN0YXR1cyA8IDApIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsb2Nrc1tteWNsb2NrXS5zdGFydChjbG9ja3NbdGhpcy5teWNvbG9yXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ01ZIENMT0NLIFNUQVJURUQnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwidHJ5aW5nIHRvIHBsYXkgcHJlbW92ZS4uLi5cIik7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wcmVtb3ZlKSB0aGlzLnBlcmZvcm1QcmVtb3ZlKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wcmVkcm9wKSB0aGlzLnBlcmZvcm1QcmVkcm9wKCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNoZXNzZ3JvdW5kLnNldCh7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gZ2l2aW5nIGZlbiBoZXJlIHdpbGwgcGxhY2UgY2FzdGxpbmcgcm9va3MgdG8gdGhlaXIgZGVzdGluYXRpb24gaW4gY2hlc3M5NjAgdmFyaWFudHNcclxuICAgICAgICAgICAgICAgICAgICBmZW46IHBhcnRzWzBdLFxyXG4gICAgICAgICAgICAgICAgICAgIHR1cm5Db2xvcjogdGhpcy50dXJuQ29sb3IsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJlbW92YWJsZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXN0czogbXNnLmRlc3RzLFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgY2hlY2s6IG1zZy5jaGVjayxcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jbG9ja3NbbXljbG9ja10ucGF1c2UoZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jbG9ja3NbbXljbG9ja10uc2V0VGltZShjbG9ja3NbdGhpcy5teWNvbG9yXSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNsb2Nrc1tvcHBjbG9ja10uc2V0VGltZShjbG9ja3NbdGhpcy5vcHBjb2xvcl0pO1xyXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmFib3J0YWJsZSAmJiBtc2cuc3RhdHVzIDwgMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xvY2tzW29wcGNsb2NrXS5zdGFydChjbG9ja3NbdGhpcy5vcHBjb2xvcl0pO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdPUFAgQ0xPQ0sgIFNUQVJURUQnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm9wcElzUmFuZG9tTW92ZXIgJiYgbXNnLnJtICAhPT0gXCJcIikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJtb3ZlXCIsIGdhbWVJZDogdGhpcy5tb2RlbFtcImdhbWVJZFwiXSwgbW92ZTogbXNnLnJtLCBjbG9ja3M6IGNsb2NrcyB9KTtcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBnb1BseSA9IChwbHkpID0+IHtcclxuICAgICAgICBjb25zdCBzdGVwID0gdGhpcy5zdGVwc1twbHldO1xyXG4gICAgICAgIHZhciBtb3ZlID0gc3RlcFsnbW92ZSddO1xyXG4gICAgICAgIHZhciBjYXB0dXJlID0gZmFsc2U7XHJcbiAgICAgICAgaWYgKG1vdmUgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy52YXJpYW50ID09PSBcInNob2dpXCIpIG1vdmUgPSB1c2kydWNpKG1vdmUpO1xyXG4gICAgICAgICAgICBpZiAodGhpcy52YXJpYW50ID09PSBcImdyYW5kXCIgfHwgdGhpcy52YXJpYW50ID09PSBcImdyYW5kaG91c2VcIikgbW92ZSA9IGdyYW5kMnplcm8obW92ZSk7XHJcbiAgICAgICAgICAgIG1vdmUgPSBtb3ZlLnNsaWNlKDEsIDIpID09PSAnQCcgPyBbbW92ZS5zbGljZSgyLCA0KV0gOiBbbW92ZS5zbGljZSgwLCAyKSwgbW92ZS5zbGljZSgyLCA0KV07XHJcbiAgICAgICAgICAgIGNhcHR1cmUgPSB0aGlzLmNoZXNzZ3JvdW5kLnN0YXRlLnBpZWNlc1ttb3ZlW21vdmUubGVuZ3RoIC0gMV1dICE9PSB1bmRlZmluZWQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmNoZXNzZ3JvdW5kLnNldCh7XHJcbiAgICAgICAgICAgIGZlbjogc3RlcC5mZW4sXHJcbiAgICAgICAgICAgIHR1cm5Db2xvcjogc3RlcC50dXJuQ29sb3IsXHJcbiAgICAgICAgICAgIG1vdmFibGU6IHtcclxuICAgICAgICAgICAgICAgIGZyZWU6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgY29sb3I6IHRoaXMuc3BlY3RhdG9yID8gdW5kZWZpbmVkIDogc3RlcC50dXJuQ29sb3IsXHJcbiAgICAgICAgICAgICAgICBkZXN0czogdGhpcy5yZXN1bHQgPT09IFwiXCIgJiYgcGx5ID09PSB0aGlzLnN0ZXBzLmxlbmd0aCAtIDEgPyB0aGlzLmRlc3RzIDogdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgY2hlY2s6IHN0ZXAuY2hlY2ssXHJcbiAgICAgICAgICAgIGxhc3RNb3ZlOiBtb3ZlLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMuZnVsbGZlbiA9IHN0ZXAuZmVuO1xyXG4gICAgICAgIHVwZGF0ZVBvY2tldHModGhpcywgdGhpcy52cG9ja2V0MCwgdGhpcy52cG9ja2V0MSk7XHJcblxyXG4gICAgICAgIGlmIChwbHkgPT09IHRoaXMucGx5ICsgMSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy52YXJpYW50ID09PSBcInNob2dpXCIpIHtcclxuICAgICAgICAgICAgICAgIHNvdW5kLnNob2dpbW92ZSgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhcHR1cmUpIHtcclxuICAgICAgICAgICAgICAgICAgICBzb3VuZC5jYXB0dXJlKCk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHNvdW5kLm1vdmUoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnBseSA9IHBseVxyXG5cclxuICAgICAgICAvL3ZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGduJykgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgdGhpcy52cG5nID0gcGF0Y2godGhpcy52cG5nLCBoKCdkaXYjcGduJywgW2goJ2RpdicsIHRoaXMuZnVsbGZlbiksIGgoJ3RleHRhcmVhJywgeyBhdHRyczogeyByb3dzOiAxM30gfSwgdGhpcy5wZ24pXSkpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgZG9TZW5kID0gKG1lc3NhZ2UpID0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIi0tLT4gZG9TZW5kKCk6XCIsIG1lc3NhZ2UpO1xyXG4gICAgICAgIHRoaXMuc29jay5zZW5kKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHNlbmRNb3ZlID0gKG9yaWcsIGRlc3QsIHByb21vKSA9PiB7XHJcbiAgICAgICAgLy8gcGF1c2UoKSB3aWxsIGFkZCBpbmNyZW1lbnQhXHJcbiAgICAgICAgY29uc3Qgb3BwY2xvY2sgPSAhdGhpcy5mbGlwID8gMCA6IDFcclxuICAgICAgICBjb25zdCBteWNsb2NrID0gMSAtIG9wcGNsb2NrO1xyXG4gICAgICAgIGNvbnN0IG1vdmV0aW1lID0gKHRoaXMuY2xvY2tzW215Y2xvY2tdLnJ1bm5pbmcpID8gRGF0ZS5ub3coKSAtIHRoaXMuY2xvY2tzW215Y2xvY2tdLnN0YXJ0VGltZSA6IDA7XHJcbiAgICAgICAgdGhpcy5jbG9ja3NbbXljbG9ja10ucGF1c2UoKHRoaXMuYmFzZSA9PT0gMCAmJiB0aGlzLnBseSA8IDIpID8gZmFsc2UgOiB0cnVlKTtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNlbmRNb3ZlKG9yaWcsIGRlc3QsIHByb20pXCIsIG9yaWcsIGRlc3QsIHByb21vKTtcclxuICAgICAgICBjb25zdCB1Y2lfbW92ZSA9IG9yaWcgKyBkZXN0ICsgcHJvbW87XHJcbiAgICAgICAgY29uc3QgbW92ZSA9IHRoaXMudmFyaWFudCA9PT0gXCJzaG9naVwiID8gdWNpMnVzaSh1Y2lfbW92ZSkgOiAodGhpcy52YXJpYW50ID09PSBcImdyYW5kXCIgfHwgdGhpcy52YXJpYW50ID09PSBcImdyYW5kaG91c2VcIikgPyB6ZXJvMmdyYW5kKHVjaV9tb3ZlKSA6IHVjaV9tb3ZlO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2VuZE1vdmUobW92ZSlcIiwgbW92ZSk7XHJcbiAgICAgICAgLy8gVE9ETzogaWYgcHJlbW92ZWQsIHNlbmQgMCB0aW1lXHJcbiAgICAgICAgbGV0IGJjbG9jaywgY2xvY2tzO1xyXG4gICAgICAgIGlmICghdGhpcy5mbGlwKSB7XHJcbiAgICAgICAgICAgIGJjbG9jayA9IHRoaXMubXljb2xvciA9PT0gXCJibGFja1wiID8gMSA6IDA7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgYmNsb2NrID0gdGhpcy5teWNvbG9yID09PSBcImJsYWNrXCIgPyAwIDogMTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3Qgd2Nsb2NrID0gMSAtIGJjbG9ja1xyXG4gICAgICAgIGNsb2NrcyA9IHttb3ZldGltZTogbW92ZXRpbWUsIGJsYWNrOiB0aGlzLmNsb2Nrc1tiY2xvY2tdLmR1cmF0aW9uLCB3aGl0ZTogdGhpcy5jbG9ja3Nbd2Nsb2NrXS5kdXJhdGlvbn07XHJcbiAgICAgICAgdGhpcy5kb1NlbmQoeyB0eXBlOiBcIm1vdmVcIiwgZ2FtZUlkOiB0aGlzLm1vZGVsW1wiZ2FtZUlkXCJdLCBtb3ZlOiBtb3ZlLCBjbG9ja3M6IGNsb2NrcyB9KTtcclxuICAgICAgICBpZiAoIXRoaXMuYWJvcnRhYmxlKSB0aGlzLmNsb2Nrc1tvcHBjbG9ja10uc3RhcnQoKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uTW92ZSA9ICgpID0+IHtcclxuICAgICAgICByZXR1cm4gKG9yaWcsIGRlc3QsIGNhcHR1cmVkUGllY2UpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCIgICBncm91bmQub25Nb3ZlKClcIiwgb3JpZywgZGVzdCwgY2FwdHVyZWRQaWVjZSk7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnZhcmlhbnQgPT09IFwic2hvZ2lcIikge1xyXG4gICAgICAgICAgICAgICAgc291bmQuc2hvZ2ltb3ZlKCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FwdHVyZWRQaWVjZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHNvdW5kLmNhcHR1cmUoKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc291bmQubW92ZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgb25Ecm9wID0gKCkgPT4ge1xyXG4gICAgICAgIHJldHVybiAocGllY2UsIGRlc3QpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJncm91bmQub25Ecm9wKClcIiwgcGllY2UsIGRlc3QpO1xyXG4gICAgICAgICAgICBpZiAoZGVzdCAhPSAnejAnICYmIHBpZWNlLnJvbGUgJiYgZHJvcElzVmFsaWQodGhpcy5kZXN0cywgcGllY2Uucm9sZSwgZGVzdCkpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnZhcmlhbnQgPT09IFwic2hvZ2lcIikge1xyXG4gICAgICAgICAgICAgICAgICAgIHNvdW5kLnNob2dpbW92ZSgpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBzb3VuZC5tb3ZlKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWNrRHJvcCA9IHBpZWNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgc2V0UHJlbW92ZSA9IChvcmlnLCBkZXN0LCBtZXRhKSA9PiB7XHJcbiAgICAgICAgdGhpcy5wcmVtb3ZlID0geyBvcmlnLCBkZXN0LCBtZXRhIH07XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJzZXRQcmVtb3ZlKCkgdG86XCIsIG9yaWcsIGRlc3QsIG1ldGEpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdW5zZXRQcmVtb3ZlID0gKCkgPT4ge1xyXG4gICAgICAgIHRoaXMucHJlbW92ZSA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBzZXRQcmVkcm9wID0gKHJvbGUsIGtleSkgPT4ge1xyXG4gICAgICAgIHRoaXMucHJlZHJvcCA9IHsgcm9sZSwga2V5IH07XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJzZXRQcmVkcm9wKCkgdG86XCIsIHJvbGUsIGtleSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB1bnNldFByZWRyb3AgPSAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5wcmVkcm9wID0gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHBlcmZvcm1QcmVtb3ZlID0gKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHsgb3JpZywgZGVzdCwgbWV0YSB9ID0gdGhpcy5wcmVtb3ZlO1xyXG4gICAgICAgIC8vIFRPRE86IHByb21vdGlvbj9cclxuICAgICAgICBjb25zb2xlLmxvZyhcInBlcmZvcm1QcmVtb3ZlKClcIiwgb3JpZywgZGVzdCwgbWV0YSk7XHJcbiAgICAgICAgdGhpcy5jaGVzc2dyb3VuZC5wbGF5UHJlbW92ZSgpO1xyXG4gICAgICAgIHRoaXMucHJlbW92ZSA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBwZXJmb3JtUHJlZHJvcCA9ICgpID0+IHtcclxuICAgICAgICBjb25zdCB7IHJvbGUsIGtleSB9ID0gdGhpcy5wcmVkcm9wO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwicGVyZm9ybVByZWRyb3AoKVwiLCByb2xlLCBrZXkpO1xyXG4gICAgICAgIHRoaXMuY2hlc3Nncm91bmQucGxheVByZWRyb3AoZHJvcCA9PiB7IHJldHVybiBkcm9wSXNWYWxpZCh0aGlzLmRlc3RzLCBkcm9wLnJvbGUsIGRyb3Aua2V5KTsgfSk7XHJcbiAgICAgICAgdGhpcy5wcmVkcm9wID0gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uVXNlck1vdmUgPSAob3JpZywgZGVzdCwgbWV0YSkgPT4ge1xyXG4gICAgICAgIC8vIGNoZXNzZ3JvdW5kIGRvZXNuJ3Qga25vd3MgYWJvdXQgZXAsIHNvIHdlIGhhdmUgdG8gcmVtb3ZlIGVwIGNhcHR1cmVkIHBhd25cclxuICAgICAgICBjb25zdCBwaWVjZXMgPSB0aGlzLmNoZXNzZ3JvdW5kLnN0YXRlLnBpZWNlcztcclxuICAgICAgICBjb25zdCBnZW9tID0gdGhpcy5jaGVzc2dyb3VuZC5zdGF0ZS5nZW9tZXRyeTtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcImdyb3VuZC5vblVzZXJNb3ZlKClcIiwgb3JpZywgZGVzdCwgbWV0YSwgcGllY2VzKTtcclxuICAgICAgICBjb25zdCBtb3ZlZCA9IHBpZWNlc1tkZXN0XSBhcyBQaWVjZTtcclxuICAgICAgICBjb25zdCBmaXJzdFJhbmtJczAgPSB0aGlzLmNoZXNzZ3JvdW5kLnN0YXRlLmRpbWVuc2lvbnMuaGVpZ2h0ID09PSAxMDtcclxuICAgICAgICBpZiAobWV0YS5jYXB0dXJlZCA9PT0gdW5kZWZpbmVkICYmIG1vdmVkLnJvbGUgPT09IFwicGF3blwiICYmIG9yaWdbMF0gIT0gZGVzdFswXSAmJiBoYXNFcCh0aGlzLnZhcmlhbnQpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHBvcyA9IGtleTJwb3MoZGVzdCwgZmlyc3RSYW5rSXMwKSxcclxuICAgICAgICAgICAgcGF3blBvczogUG9zID0gW3Bvc1swXSwgcG9zWzFdICsgKHRoaXMubXljb2xvciA9PT0gJ3doaXRlJyA/IC0xIDogMSldO1xyXG4gICAgICAgICAgICBjb25zdCBkaWZmOiBQaWVjZXNEaWZmID0ge307XHJcbiAgICAgICAgICAgIGRpZmZbcG9zMmtleShwYXduUG9zLCBnZW9tKV0gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIHRoaXMuY2hlc3Nncm91bmQuc2V0UGllY2VzKGRpZmYpO1xyXG4gICAgICAgICAgICBtZXRhLmNhcHR1cmVkID0ge3JvbGU6IFwicGF3blwifTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIC8vIGluY3JlYXNlIHBvY2tldCBjb3VudFxyXG4gICAgICAgIGlmICgodGhpcy52YXJpYW50ID09PSBcImNyYXp5aG91c2VcIiB8fCB0aGlzLnZhcmlhbnQgPT09IFwiY2FwYWhvdXNlXCIgfHwgdGhpcy52YXJpYW50ID09PSBcInNob3VzZVwiIHx8IHRoaXMudmFyaWFudCA9PT0gXCJncmFuZGhvdXNlXCIgfHwgdGhpcy52YXJpYW50ID09PSBcInNob2dpXCIpICYmIG1ldGEuY2FwdHVyZWQpIHtcclxuICAgICAgICAgICAgdmFyIHJvbGUgPSBtZXRhLmNhcHR1cmVkLnJvbGVcclxuICAgICAgICAgICAgaWYgKG1ldGEuY2FwdHVyZWQucHJvbW90ZWQpIHJvbGUgPSB0aGlzLnZhcmlhbnQgPT09IFwic2hvZ2lcIiA/IG1ldGEuY2FwdHVyZWQucm9sZS5zbGljZSgxKSBhcyBSb2xlIDogXCJwYXduXCI7XHJcblxyXG4gICAgICAgICAgICBpZiAodGhpcy5mbGlwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBvY2tldHNbMF1bcm9sZV0rKztcclxuICAgICAgICAgICAgICAgIHRoaXMudnBvY2tldDAgPSBwYXRjaCh0aGlzLnZwb2NrZXQwLCBwb2NrZXRWaWV3KHRoaXMsIHRoaXMubXljb2xvciwgXCJ0b3BcIikpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wb2NrZXRzWzFdW3JvbGVdKys7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZwb2NrZXQxID0gcGF0Y2godGhpcy52cG9ja2V0MSwgcG9ja2V0Vmlldyh0aGlzLCB0aGlzLm15Y29sb3IsIFwiYm90dG9tXCIpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIC8vICBnYXRpbmcgZWxlcGhhbnQvaGF3a1xyXG4gICAgICAgIGlmICh0aGlzLnZhcmlhbnQgPT09IFwic2VpcmF3YW5cIiB8fCB0aGlzLnZhcmlhbnQgPT09IFwic2hvdXNlXCIpIHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLnByb21vdGlvbi5zdGFydChvcmlnLCBkZXN0LCBtZXRhKSAmJiAhdGhpcy5nYXRpbmcuc3RhcnQodGhpcy5mdWxsZmVuLCBvcmlnLCBkZXN0LCBtZXRhKSkgdGhpcy5zZW5kTW92ZShvcmlnLCBkZXN0LCAnJyk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLnByb21vdGlvbi5zdGFydChvcmlnLCBkZXN0LCBtZXRhKSkgdGhpcy5zZW5kTW92ZShvcmlnLCBkZXN0LCAnJyk7XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uVXNlckRyb3AgPSAocm9sZSwgZGVzdCkgPT4ge1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiZ3JvdW5kLm9uVXNlckRyb3AoKVwiLCByb2xlLCBkZXN0KTtcclxuICAgICAgICAvLyBkZWNyZWFzZSBwb2NrZXQgY291bnRcclxuICAgICAgICBjYW5jZWxEcm9wTW9kZSh0aGlzLmNoZXNzZ3JvdW5kLnN0YXRlKTtcclxuICAgICAgICBpZiAoZHJvcElzVmFsaWQodGhpcy5kZXN0cywgcm9sZSwgZGVzdCkpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuZmxpcCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wb2NrZXRzWzBdW3JvbGVdLS07XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZwb2NrZXQwID0gcGF0Y2godGhpcy52cG9ja2V0MCwgcG9ja2V0Vmlldyh0aGlzLCB0aGlzLm15Y29sb3IsIFwidG9wXCIpKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucG9ja2V0c1sxXVtyb2xlXS0tO1xyXG4gICAgICAgICAgICAgICAgdGhpcy52cG9ja2V0MSA9IHBhdGNoKHRoaXMudnBvY2tldDEsIHBvY2tldFZpZXcodGhpcywgdGhpcy5teWNvbG9yLCBcImJvdHRvbVwiKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5zZW5kTW92ZShyb2xlVG9TYW5bcm9sZV0gKyBcIkBcIiwgZGVzdCwgJycpXHJcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2VudCBtb3ZlXCIsIG1vdmUpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiISEhIGludmFsaWQgbW92ZSAhISFcIiwgcm9sZSwgZGVzdCk7XHJcbiAgICAgICAgICAgIC8vIHJlc3RvcmUgYm9hcmRcclxuICAgICAgICAgICAgdGhpcy5jbGlja0Ryb3AgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIHRoaXMuY2hlc3Nncm91bmQuc2V0KHtcclxuICAgICAgICAgICAgICAgIGZlbjogdGhpcy5mdWxsZmVuLFxyXG4gICAgICAgICAgICAgICAgbGFzdE1vdmU6IHRoaXMubGFzdG1vdmUsXHJcbiAgICAgICAgICAgICAgICB0dXJuQ29sb3I6IHRoaXMubXljb2xvcixcclxuICAgICAgICAgICAgICAgIG1vdmFibGU6IHtcclxuICAgICAgICAgICAgICAgICAgICBkZXN0czogdGhpcy5kZXN0cyxcclxuICAgICAgICAgICAgICAgICAgICBzaG93RGVzdHM6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvblNlbGVjdCA9IChzZWxlY3RlZCkgPT4ge1xyXG4gICAgICAgIHJldHVybiAoa2V5KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiICAgZ3JvdW5kLm9uU2VsZWN0KClcIiwga2V5LCBzZWxlY3RlZCwgdGhpcy5jbGlja0Ryb3AsIHRoaXMuY2hlc3Nncm91bmQuc3RhdGUpO1xyXG4gICAgICAgICAgICAvLyBJZiBkcm9wIHNlbGVjdGlvbiB3YXMgc2V0IGRyb3BEZXN0cyB3ZSBoYXZlIHRvIHJlc3RvcmUgZGVzdHMgaGVyZVxyXG4gICAgICAgICAgICBpZiAodGhpcy5jaGVzc2dyb3VuZC5zdGF0ZS5tb3ZhYmxlLmRlc3RzID09PSB1bmRlZmluZWQpIHJldHVybjtcclxuICAgICAgICAgICAgaWYgKGtleSAhPSAnejAnICYmICd6MCcgaW4gdGhpcy5jaGVzc2dyb3VuZC5zdGF0ZS5tb3ZhYmxlLmRlc3RzKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jbGlja0Ryb3AgIT09IHVuZGVmaW5lZCAmJiBkcm9wSXNWYWxpZCh0aGlzLmRlc3RzLCB0aGlzLmNsaWNrRHJvcC5yb2xlLCBrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jaGVzc2dyb3VuZC5uZXdQaWVjZSh0aGlzLmNsaWNrRHJvcCwga2V5KTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm9uVXNlckRyb3AodGhpcy5jbGlja0Ryb3Aucm9sZSwga2V5KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuY2xpY2tEcm9wID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICAgICAgY2FuY2VsRHJvcE1vZGUodGhpcy5jaGVzc2dyb3VuZC5zdGF0ZSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNoZXNzZ3JvdW5kLnNldCh7IG1vdmFibGU6IHsgZGVzdHM6IHRoaXMuZGVzdHMgfX0pO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAvLyBTaXR0dXlpbiBpbiBwbGFjZSBwcm9tb3Rpb24gb24gQ3RybCtjbGlja1xyXG4gICAgICAgICAgICBpZiAodGhpcy5jaGVzc2dyb3VuZC5zdGF0ZS5zdGF0cy5jdHJsS2V5ICYmIFxyXG4gICAgICAgICAgICAgICAgKGtleSBpbiB0aGlzLmNoZXNzZ3JvdW5kLnN0YXRlLm1vdmFibGUuZGVzdHMpICYmXHJcbiAgICAgICAgICAgICAgICAodGhpcy5jaGVzc2dyb3VuZC5zdGF0ZS5tb3ZhYmxlLmRlc3RzW2tleV0uaW5kZXhPZihrZXkpID49IDApICYmXHJcbiAgICAgICAgICAgICAgICAodGhpcy52YXJpYW50ID09PSAnc2l0dHV5aW4nKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJDdHJsIGluIHBsYWNlIHByb21vdGlvblwiLCBrZXkpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHBpZWNlcyA9IHt9O1xyXG4gICAgICAgICAgICAgICAgdmFyIHBpZWNlID0gdGhpcy5jaGVzc2dyb3VuZC5zdGF0ZS5waWVjZXNba2V5XTtcclxuICAgICAgICAgICAgICAgIHBpZWNlc1trZXldID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbG9yOiBwaWVjZSEuY29sb3IsXHJcbiAgICAgICAgICAgICAgICAgICAgcm9sZTogJ2ZlcnonLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb21vdGVkOiB0cnVlXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jaGVzc2dyb3VuZC5zZXRQaWVjZXMocGllY2VzKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2VuZE1vdmUoa2V5LCBrZXksICdmJyk7XHJcblxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uTXNnVXNlckNvbm5lY3RlZCA9IChtc2cpID0+IHtcclxuICAgICAgICB0aGlzLm1vZGVsW1widXNlcm5hbWVcIl0gPSBtc2dbXCJ1c2VybmFtZVwiXTtcclxuICAgICAgICByZW5kZXJVc2VybmFtZSh0aGlzLm1vZGVsW1wiaG9tZVwiXSwgdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdKTtcclxuICAgICAgICBpZiAodGhpcy5zcGVjdGF0b3IpIHtcclxuICAgICAgICAgICAgdGhpcy5kb1NlbmQoeyB0eXBlOiBcImlzX3VzZXJfb25saW5lXCIsIHVzZXJuYW1lOiB0aGlzLndwbGF5ZXIgfSk7XHJcbiAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJpc191c2VyX29ubGluZVwiLCB1c2VybmFtZTogdGhpcy5icGxheWVyIH0pO1xyXG5cclxuICAgICAgICAgICAgLy8gd2Ugd2FudCB0byBrbm93IGxhc3RNb3ZlIGFuZCBjaGVjayBzdGF0dXNcclxuICAgICAgICAgICAgdGhpcy5kb1NlbmQoeyB0eXBlOiBcImJvYXJkXCIsIGdhbWVJZDogdGhpcy5tb2RlbFtcImdhbWVJZFwiXSB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zdCBvcHBfbmFtZSA9IHRoaXMubW9kZWxbXCJ1c2VybmFtZVwiXSA9PT0gdGhpcy53cGxheWVyID8gdGhpcy5icGxheWVyIDogdGhpcy53cGxheWVyO1xyXG4gICAgICAgICAgICB0aGlzLmRvU2VuZCh7IHR5cGU6IFwiaXNfdXNlcl9vbmxpbmVcIiwgdXNlcm5hbWU6IG9wcF9uYW1lIH0pO1xyXG5cclxuICAgICAgICAgICAgdmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5ZXIxJykgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIHBhdGNoKGNvbnRhaW5lciwgaCgnaS1zaWRlLm9ubGluZSNwbGF5ZXIxJywge2NsYXNzOiB7XCJpY29uXCI6IHRydWUsIFwiaWNvbi1vbmxpbmVcIjogdHJ1ZSwgXCJpY29uLW9mZmxpbmVcIjogZmFsc2V9fSkpO1xyXG5cclxuICAgICAgICAgICAgLy8gcHJldmVudCBzZW5kaW5nIGdhbWVTdGFydCBtZXNzYWdlIHdoZW4gdXNlciBqdXN0IHJlY29uZWN0aW5nXHJcbiAgICAgICAgICAgIGlmIChtc2cucGx5ID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRvU2VuZCh7IHR5cGU6IFwicmVhZHlcIiwgZ2FtZUlkOiB0aGlzLm1vZGVsW1wiZ2FtZUlkXCJdIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJib2FyZFwiLCBnYW1lSWQ6IHRoaXMubW9kZWxbXCJnYW1lSWRcIl0gfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgb25Nc2dVc2VyT25saW5lID0gKG1zZykgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKG1zZyk7XHJcbiAgICAgICAgaWYgKG1zZy51c2VybmFtZSA9PT0gdGhpcy5wbGF5ZXJzWzBdKSB7XHJcbiAgICAgICAgICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWVyMCcpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ2ktc2lkZS5vbmxpbmUjcGxheWVyMCcsIHtjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tb25saW5lXCI6IHRydWUsIFwiaWNvbi1vZmZsaW5lXCI6IGZhbHNlfX0pKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllcjEnKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgcGF0Y2goY29udGFpbmVyLCBoKCdpLXNpZGUub25saW5lI3BsYXllcjEnLCB7Y2xhc3M6IHtcImljb25cIjogdHJ1ZSwgXCJpY29uLW9ubGluZVwiOiB0cnVlLCBcImljb24tb2ZmbGluZVwiOiBmYWxzZX19KSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgb25Nc2dVc2VyRGlzY29ubmVjdGVkID0gKG1zZykgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKG1zZyk7XHJcbiAgICAgICAgaWYgKG1zZy51c2VybmFtZSA9PT0gdGhpcy5wbGF5ZXJzWzBdKSB7XHJcbiAgICAgICAgICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWVyMCcpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ2ktc2lkZS5vbmxpbmUjcGxheWVyMCcsIHtjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tb25saW5lXCI6IGZhbHNlLCBcImljb24tb2ZmbGluZVwiOiB0cnVlfX0pKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllcjEnKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgcGF0Y2goY29udGFpbmVyLCBoKCdpLXNpZGUub25saW5lI3BsYXllcjEnLCB7Y2xhc3M6IHtcImljb25cIjogdHJ1ZSwgXCJpY29uLW9ubGluZVwiOiBmYWxzZSwgXCJpY29uLW9mZmxpbmVcIjogdHJ1ZX19KSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgb25Nc2dDaGF0ID0gKG1zZykgPT4ge1xyXG4gICAgICAgIGlmIChtc2cudXNlciAhPT0gdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdKSBjaGF0TWVzc2FnZShtc2cudXNlciwgbXNnLm1lc3NhZ2UsIFwicm91bmRjaGF0XCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgb25Nc2dNb3JlVGltZSA9ICgpID0+IHtcclxuICAgICAgICBjaGF0TWVzc2FnZSgnJywgdGhpcy5teWNvbG9yICsgJyArMTUgc2Vjb25kcycsIFwicm91bmRjaGF0XCIpO1xyXG4gICAgICAgIHRoaXMuY2xvY2tzWzFdLnNldFRpbWUodGhpcy5jbG9ja3NbMV0uZHVyYXRpb24gKyAxNSAqIDEwMDApO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgb25Nc2dPZmZlciA9IChtc2cpID0+IHtcclxuICAgICAgICBjaGF0TWVzc2FnZShcIlwiLCBtc2cubWVzc2FnZSwgXCJyb3VuZGNoYXRcIik7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgb25NZXNzYWdlID0gKGV2dCkgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiPCsrKyBvbk1lc3NhZ2UoKTpcIiwgZXZ0LmRhdGEpO1xyXG4gICAgICAgIHZhciBtc2cgPSBKU09OLnBhcnNlKGV2dC5kYXRhKTtcclxuICAgICAgICBzd2l0Y2ggKG1zZy50eXBlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgXCJib2FyZFwiOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5vbk1zZ0JvYXJkKG1zZyk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcImdhbWVFbmRcIjpcclxuICAgICAgICAgICAgICAgIHRoaXMuY2hlY2tTdGF0dXMobXNnKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwiZ2FtZVN0YXJ0XCI6XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uTXNnR2FtZVN0YXJ0KG1zZyk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcImdhbWVfdXNlcl9jb25uZWN0ZWRcIjpcclxuICAgICAgICAgICAgICAgIHRoaXMub25Nc2dVc2VyQ29ubmVjdGVkKG1zZyk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcInVzZXJfb25saW5lXCI6XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uTXNnVXNlck9ubGluZShtc2cpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgXCJ1c2VyX2Rpc2Nvbm5lY3RlZFwiOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5vbk1zZ1VzZXJEaXNjb25uZWN0ZWQobXNnKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwicm91bmRjaGF0XCI6XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uTXNnQ2hhdChtc2cpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgXCJuZXdfZ2FtZVwiOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5vbk1zZ05ld0dhbWUobXNnKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwib2ZmZXJcIjpcclxuICAgICAgICAgICAgICAgIHRoaXMub25Nc2dPZmZlcihtc2cpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgXCJtb3JldGltZVwiOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5vbk1zZ01vcmVUaW1lKCk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcInVwZGF0ZVRWXCI6XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uTXNnVXBkYXRlVFYobXNnKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiIsImltcG9ydCB7IGgsIGluaXQgfSBmcm9tIFwic25hYmJkb21cIjtcclxuaW1wb3J0IGtsYXNzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnO1xyXG5pbXBvcnQgYXR0cmlidXRlcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2F0dHJpYnV0ZXMnO1xyXG5pbXBvcnQgbGlzdGVuZXJzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMnO1xyXG5pbXBvcnQgdG9WTm9kZSBmcm9tICdzbmFiYmRvbS90b3Zub2RlJztcclxuXHJcbmltcG9ydCB7IGtleTJwb3MgfSBmcm9tICdjaGVzc2dyb3VuZHgvdXRpbCc7XHJcblxyXG5pbXBvcnQgeyBjYW5HYXRlLCByb2xlVG9TYW4gfSBmcm9tICcuL2NoZXNzJztcclxuaW1wb3J0IHsgcG9ja2V0VmlldyB9IGZyb20gJy4vcG9ja2V0JztcclxuXHJcbmNvbnN0IHBhdGNoID0gaW5pdChba2xhc3MsIGF0dHJpYnV0ZXMsIGxpc3RlbmVyc10pO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24oY3RybCkge1xyXG5cclxuICAgIGxldCBnYXRpbmc6IGFueSA9IGZhbHNlO1xyXG4gICAgbGV0IHJvbGVzOiBzdHJpbmdbXSA9IFtdO1xyXG5cclxuICAgIGZ1bmN0aW9uIHN0YXJ0KGZlbiwgb3JpZywgZGVzdCwgbWV0YSkge1xyXG4gICAgICAgIGNvbnN0IGdyb3VuZCA9IGN0cmwuZ2V0R3JvdW5kKCk7XHJcbiAgICAgICAgY29uc3QgZ2F0YWJsZSA9IGNhbkdhdGUoZmVuLCBncm91bmQuc3RhdGUucGllY2VzW2Rlc3RdLCBvcmlnLCBkZXN0LCBtZXRhKVxyXG4gICAgICAgIHJvbGVzID0gW1wiaGF3a1wiLCBcImVsZXBoYW50XCIsIFwicXVlZW5cIiwgXCJyb29rXCIsIFwiYmlzaG9wXCIsIFwia25pZ2h0XCIsIFwiXCJdO1xyXG5cclxuICAgICAgICBpZiAoZ2F0YWJsZVswXSB8fCBnYXRhYmxlWzFdIHx8IGdhdGFibGVbMl0gfHwgZ2F0YWJsZVszXSB8fCBnYXRhYmxlWzRdIHx8IGdhdGFibGVbNV0pIHtcclxuICAgICAgICAgICAgY29uc3QgY29sb3IgPSBjdHJsLm15Y29sb3I7XHJcbiAgICAgICAgICAgIGNvbnN0IG9yaWVudGF0aW9uID0gZ3JvdW5kLnN0YXRlLm9yaWVudGF0aW9uO1xyXG4gICAgICAgICAgICBpZiAocm9sZXMuaW5kZXhPZihcImhhd2tcIikgIT09IC0xICYmICFnYXRhYmxlWzBdKSByb2xlcy5zcGxpY2Uocm9sZXMuaW5kZXhPZihcImhhd2tcIiksIDEpO1xyXG4gICAgICAgICAgICBpZiAocm9sZXMuaW5kZXhPZihcImVsZXBoYW50XCIpICE9PSAtMSAmJiAhZ2F0YWJsZVsxXSkgcm9sZXMuc3BsaWNlKHJvbGVzLmluZGV4T2YoXCJlbGVwaGFudFwiKSwgMSk7XHJcbiAgICAgICAgICAgIGlmIChyb2xlcy5pbmRleE9mKFwicXVlZW5cIikgIT09IC0xICYmICFnYXRhYmxlWzJdKSByb2xlcy5zcGxpY2Uocm9sZXMuaW5kZXhPZihcInF1ZWVuXCIpLCAxKTtcclxuICAgICAgICAgICAgaWYgKHJvbGVzLmluZGV4T2YoXCJyb29rXCIpICE9PSAtMSAmJiAhZ2F0YWJsZVszXSkgcm9sZXMuc3BsaWNlKHJvbGVzLmluZGV4T2YoXCJyb29rXCIpLCAxKTtcclxuICAgICAgICAgICAgaWYgKHJvbGVzLmluZGV4T2YoXCJiaXNob3BcIikgIT09IC0xICYmICFnYXRhYmxlWzRdKSByb2xlcy5zcGxpY2Uocm9sZXMuaW5kZXhPZihcImJpc2hvcFwiKSwgMSk7XHJcbiAgICAgICAgICAgIGlmIChyb2xlcy5pbmRleE9mKFwia25pZ2h0XCIpICE9PSAtMSAmJiAhZ2F0YWJsZVs1XSkgcm9sZXMuc3BsaWNlKHJvbGVzLmluZGV4T2YoXCJrbmlnaHRcIiksIDEpO1xyXG5cclxuICAgICAgICAgICAgdmFyIG9yaWdzID0gW29yaWddO1xyXG4gICAgICAgICAgICBjb25zdCBjYXN0bGluZyA9IGdyb3VuZC5zdGF0ZS5waWVjZXNbZGVzdF0ucm9sZSA9PT0gXCJraW5nXCIgJiYgb3JpZ1swXSA9PT0gXCJlXCIgJiYgZGVzdFswXSAhPT0gXCJkXCIgJiYgZGVzdFswXSAhPT0gXCJlXCIgJiYgZGVzdFswXSAhPT0gXCJmXCI7XHJcbiAgICAgICAgICAgIHZhciByb29rRGVzdCA9IFwiXCI7XHJcbiAgICAgICAgICAgIGlmIChjYXN0bGluZykge1xyXG4gICAgICAgICAgICAgICAgLy8gTy1PXHJcbiAgICAgICAgICAgICAgICBpZiAoZGVzdFswXSA+IFwiZVwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb3JpZ3MucHVzaChcImhcIiArIG9yaWdbMV0pO1xyXG4gICAgICAgICAgICAgICAgICAgIHJvb2tEZXN0ID0gIFwiZVwiICsgb3JpZ1sxXTtcclxuICAgICAgICAgICAgICAgIC8vIE8tTy1PXHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIG9yaWdzLnB1c2goXCJhXCIgKyBvcmlnWzFdKTtcclxuICAgICAgICAgICAgICAgICAgICByb29rRGVzdCA9ICBcImVcIiArIG9yaWdbMV07XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBkcmF3X2dhdGluZyhvcmlncywgY29sb3IsIG9yaWVudGF0aW9uKTtcclxuICAgICAgICAgICAgZ2F0aW5nID0ge1xyXG4gICAgICAgICAgICAgICAgb3JpZ3M6IG9yaWdzLFxyXG4gICAgICAgICAgICAgICAgZGVzdDogZGVzdCxcclxuICAgICAgICAgICAgICAgIHJvb2tEZXN0OiByb29rRGVzdCxcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrOiBjdHJsLnNlbmRNb3ZlLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfTtcclxuXHJcbiAgICBmdW5jdGlvbiBnYXRlKGN0cmwsIG9yaWcsIGRlc3QsIHJvbGUpIHtcclxuICAgICAgICBjb25zdCBnID0gY3RybC5nZXRHcm91bmQoKTtcclxuICAgICAgICBjb25zdCBjb2xvciA9IGcuc3RhdGUucGllY2VzW2Rlc3RdLmNvbG9yO1xyXG4gICAgICAgIGcubmV3UGllY2Uoe1wicm9sZVwiOiByb2xlLCBcImNvbG9yXCI6IGNvbG9yfSwgb3JpZylcclxuICAgICAgICBjdHJsLnBvY2tldHNbY29sb3IgPT09ICd3aGl0ZScgPyAwIDogMV1bcm9sZV0tLTtcclxuICAgICAgICBjdHJsLnZwb2NrZXQxID0gcGF0Y2goY3RybC52cG9ja2V0MSwgcG9ja2V0VmlldyhjdHJsLCBjb2xvciwgXCJib3R0b21cIikpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGRyYXdfZ2F0aW5nKG9yaWdzLCBjb2xvciwgb3JpZW50YXRpb24pIHtcclxuICAgICAgICB2YXIgY29udGFpbmVyID0gdG9WTm9kZShkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdleHRlbnNpb24nKSBhcyBOb2RlKTtcclxuICAgICAgICBwYXRjaChjb250YWluZXIsIHJlbmRlckdhdGluZyhvcmlncywgY29sb3IsIG9yaWVudGF0aW9uKSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZHJhd19ub19nYXRpbmcoKSB7XHJcbiAgICAgICAgdmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdleHRlbnNpb25fY2hvaWNlJykgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgcGF0Y2goY29udGFpbmVyLCBoKCdleHRlbnNpb24nKSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZmluaXNoKHJvbGUsIGluZGV4KSB7XHJcbiAgICAgICAgaWYgKGdhdGluZykge1xyXG4gICAgICAgICAgICBkcmF3X25vX2dhdGluZygpO1xyXG4gICAgICAgICAgICBpZiAocm9sZSkgZ2F0ZShjdHJsLCBnYXRpbmcub3JpZ3NbaW5kZXhdLCBnYXRpbmcuZGVzdCwgcm9sZSk7XHJcbiAgICAgICAgICAgIGVsc2UgaW5kZXggPSAwO1xyXG4gICAgICAgICAgICBjb25zdCBnYXRlZCA9IHJvbGUgPyByb2xlVG9TYW5bcm9sZV0udG9Mb3dlckNhc2UoKSA6IFwiXCI7XHJcbiAgICAgICAgICAgIGlmIChnYXRpbmcuY2FsbGJhY2spIGdhdGluZy5jYWxsYmFjayhnYXRpbmcub3JpZ3NbaW5kZXhdLCBpbmRleCA9PT0gMCA/IGdhdGluZy5kZXN0IDogZ2F0aW5nLnJvb2tEZXN0LCBnYXRlZCk7XHJcbiAgICAgICAgICAgIGdhdGluZyA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgZnVuY3Rpb24gY2FuY2VsKCkge1xyXG4gICAgICAgIGRyYXdfbm9fZ2F0aW5nKCk7XHJcbiAgICAgICAgY3RybC5nb1BseShjdHJsLnBseSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGJpbmQoZXZlbnROYW1lOiBzdHJpbmcsIGY6IChlOiBFdmVudCkgPT4gdm9pZCwgcmVkcmF3KSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgaW5zZXJ0KHZub2RlKSB7XHJcbiAgICAgICAgICAgICAgICB2bm9kZS5lbG0uYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGUgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcyA9IGYoZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlZHJhdykgcmVkcmF3KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcztcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByZW5kZXJTcXVhcmVzKG9yaWcsIGNvbG9yLCBvcmllbnRhdGlvbiwgaW5kZXgpIHtcclxuICAgICAgICBjb25zdCBmaXJzdFJhbmtJczAgPSBmYWxzZTtcclxuICAgICAgICB2YXIgbGVmdCA9ICg4IC0ga2V5MnBvcyhvcmlnLCBmaXJzdFJhbmtJczApWzBdKSAqIDEyLjU7XHJcbiAgICAgICAgaWYgKG9yaWVudGF0aW9uID09PSBcIndoaXRlXCIpIGxlZnQgPSA4Ny41IC0gbGVmdDtcclxuICAgICAgICByZXR1cm4gcm9sZXMubWFwKChzZXJ2ZXJSb2xlLCBpKSA9PiB7XHJcbiAgICAgICAgICAgIHZhciB0b3AgPSAoY29sb3IgPT09IG9yaWVudGF0aW9uID8gNyAtIGkgOiBpKSAqIDEyLjU7XHJcbiAgICAgICAgICAgIHJldHVybiBoKFxyXG4gICAgICAgICAgICAgICAgXCJzcXVhcmVcIixcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBhdHRyczogeyBzdHlsZTogXCJ0b3A6IFwiICsgdG9wICsgXCIlO2xlZnQ6IFwiICsgbGVmdCArIFwiJVwiIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgaG9vazogYmluZChcImNsaWNrXCIsIGUgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmaW5pc2goc2VydmVyUm9sZSwgaW5kZXgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sIGZhbHNlKVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIFtoKFwicGllY2UuXCIgKyBzZXJ2ZXJSb2xlICsgXCIuXCIgKyBjb2xvcildXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfSlcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByZW5kZXJHYXRpbmcob3JpZ3MsIGNvbG9yLCBvcmllbnRhdGlvbikge1xyXG4gICAgICAgIHZhciB2ZXJ0aWNhbCA9IGNvbG9yID09PSBvcmllbnRhdGlvbiA/IFwidG9wXCIgOiBcImJvdHRvbVwiO1xyXG4gICAgICAgIHZhciBzcXVhcmVzID0gcmVuZGVyU3F1YXJlcyhvcmlnc1swXSwgY29sb3IsIG9yaWVudGF0aW9uLCAwKTtcclxuICAgICAgICBpZiAob3JpZ3MubGVuZ3RoID4gMSkgc3F1YXJlcyA9IHNxdWFyZXMuY29uY2F0KHJlbmRlclNxdWFyZXMob3JpZ3NbMV0sIGNvbG9yLCBvcmllbnRhdGlvbiwgMSkpO1xyXG4gICAgICAgIHJldHVybiBoKFxyXG4gICAgICAgICAgICBcImRpdiNleHRlbnNpb25fY2hvaWNlLlwiICsgdmVydGljYWwsXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGhvb2s6IHtcclxuICAgICAgICAgICAgICAgICAgICBpbnNlcnQ6IHZub2RlID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZWwgPSB2bm9kZS5lbG0gYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBjYW5jZWwoKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjb250ZXh0bWVudVwiLCBlID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBzcXVhcmVzXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHN0YXJ0LFxyXG4gICAgfTtcclxufVxyXG4iLCJpbXBvcnQgU29ja2V0dGUgZnJvbSAnc29ja2V0dGUnO1xyXG5cclxuaW1wb3J0IHsgaW5pdCB9IGZyb20gJ3NuYWJiZG9tJztcclxuaW1wb3J0IGtsYXNzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnO1xyXG5pbXBvcnQgYXR0cmlidXRlcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2F0dHJpYnV0ZXMnO1xyXG5pbXBvcnQgcHJvcGVydGllcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL3Byb3BzJztcclxuaW1wb3J0IGxpc3RlbmVycyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJztcclxuXHJcbmNvbnN0IHBhdGNoID0gaW5pdChba2xhc3MsIGF0dHJpYnV0ZXMsIHByb3BlcnRpZXMsIGxpc3RlbmVyc10pO1xyXG5cclxuaW1wb3J0IGggZnJvbSAnc25hYmJkb20vaCc7XHJcbmltcG9ydCB7IFZOb2RlIH0gZnJvbSAnc25hYmJkb20vdm5vZGUnO1xyXG5cclxuaW1wb3J0IHsgcmVuZGVyVXNlcm5hbWUgfSBmcm9tICcuL3VzZXInO1xyXG5pbXBvcnQgeyBjaGF0TWVzc2FnZSwgY2hhdFZpZXcgfSBmcm9tICcuL2NoYXQnO1xyXG5pbXBvcnQgeyB2YXJpYW50cywgdmFyaWFudHM5NjAsIFZBUklBTlRTIH0gZnJvbSAnLi9jaGVzcyc7XHJcbmltcG9ydCB7IHNvdW5kIH0gZnJvbSAnLi9zb3VuZCc7XHJcblxyXG5cclxuY2xhc3MgTG9iYnlDb250cm9sbGVyIHtcclxuICAgIG1vZGVsO1xyXG4gICAgc29jaztcclxuICAgIHBsYXllcjtcclxuICAgIGxvZ2dlZF9pbjtcclxuICAgIGNoYWxsZW5nZUFJO1xyXG4gICAgX3dzO1xyXG4gICAgc2Vla3M7XHJcblxyXG4gICAgY29uc3RydWN0b3IoZWwsIG1vZGVsKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJMb2JieUNvbnRyb2xsZXIgY29uc3RydWN0b3JcIiwgZWwsIG1vZGVsKTtcclxuXHJcbiAgICAgICAgdGhpcy5tb2RlbCA9IG1vZGVsO1xyXG4gICAgICAgIHRoaXMuY2hhbGxlbmdlQUkgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgY29uc3Qgb25PcGVuID0gKGV2dCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLl93cyA9IGV2dC50YXJnZXQ7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiLS0tQ09OTkVDVEVEXCIsIGV2dCk7XHJcbiAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJsb2JieV91c2VyX2Nvbm5lY3RlZFwiLCB1c2VybmFtZTogdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdfSk7XHJcbiAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJnZXRfc2Vla3NcIiB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX3dzID0ge1wicmVhZHlTdGF0ZVwiOiAtMX07XHJcbiAgICAgICAgY29uc3Qgb3B0cyA9IHtcclxuICAgICAgICAgICAgbWF4QXR0ZW1wdHM6IDIwLFxyXG4gICAgICAgICAgICBvbm9wZW46IGUgPT4gb25PcGVuKGUpLFxyXG4gICAgICAgICAgICBvbm1lc3NhZ2U6IGUgPT4gdGhpcy5vbk1lc3NhZ2UoZSksXHJcbiAgICAgICAgICAgIG9ucmVjb25uZWN0OiBlID0+IGNvbnNvbGUubG9nKCdSZWNvbm5lY3RpbmcgaW4gbG9iYnkuLi4nLCBlKSxcclxuICAgICAgICAgICAgb25tYXhpbXVtOiBlID0+IGNvbnNvbGUubG9nKCdTdG9wIEF0dGVtcHRpbmchJywgZSksXHJcbiAgICAgICAgICAgIG9uY2xvc2U6IGUgPT4ge2NvbnNvbGUubG9nKCdDbG9zZWQhJywgZSk7fSxcclxuICAgICAgICAgICAgb25lcnJvcjogZSA9PiBjb25zb2xlLmxvZygnRXJyb3I6JywgZSksXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgdGhpcy5zb2NrID0gbmV3IFNvY2tldHRlKFwid3M6Ly9cIiArIGxvY2F0aW9uLmhvc3QgKyBcIi93c2xcIiwgb3B0cyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNhdGNoKGVycikge1xyXG4gICAgICAgICAgICB0aGlzLnNvY2sgPSBuZXcgU29ja2V0dGUoXCJ3c3M6Ly9cIiArIGxvY2F0aW9uLmhvc3QgKyBcIi93c2xcIiwgb3B0cyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBnZXQgc2Vla3Mgd2hlbiB3ZSBhcmUgY29taW5nIGJhY2sgYWZ0ZXIgYSBnYW1lXHJcbiAgICAgICAgaWYgKHRoaXMuX3dzLnJlYWR5U3RhdGUgPT09IDEpIHtcclxuICAgICAgICAgICAgdGhpcy5kb1NlbmQoeyB0eXBlOiBcImdldF9zZWVrc1wiIH0pO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgcGF0Y2goZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZWtidXR0b25zJykgYXMgSFRNTEVsZW1lbnQsIGgoJ3VsI3NlZWtidXR0b25zJywgdGhpcy5yZW5kZXJTZWVrQnV0dG9ucygpKSk7XHJcbiAgICAgICAgcGF0Y2goZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvYmJ5Y2hhdCcpIGFzIEhUTUxFbGVtZW50LCBjaGF0Vmlldyh0aGlzLCBcImxvYmJ5Y2hhdFwiKSk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIGRvU2VuZCAobWVzc2FnZSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiLS0tPiBsb2JieSBkb1NlbmQoKTpcIiwgbWVzc2FnZSk7XHJcbiAgICAgICAgdGhpcy5zb2NrLnNlbmQoSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpO1xyXG4gICAgfVxyXG5cclxuICAgIGNyZWF0ZVNlZWtNc2cgKHZhcmlhbnQsIGNvbG9yLCBmZW4sIG1pbnV0ZXMsIGluY3JlbWVudCwgY2hlc3M5NjApIHtcclxuICAgICAgICB0aGlzLmRvU2VuZCh7XHJcbiAgICAgICAgICAgIHR5cGU6IFwiY3JlYXRlX3NlZWtcIixcclxuICAgICAgICAgICAgdXNlcjogdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdLFxyXG4gICAgICAgICAgICB2YXJpYW50OiB2YXJpYW50LFxyXG4gICAgICAgICAgICBmZW46IGZlbixcclxuICAgICAgICAgICAgbWludXRlczogbWludXRlcyxcclxuICAgICAgICAgICAgaW5jcmVtZW50OiBpbmNyZW1lbnQsXHJcbiAgICAgICAgICAgIHJhdGVkOiBmYWxzZSxcclxuICAgICAgICAgICAgY2hlc3M5NjA6IGNoZXNzOTYwLFxyXG4gICAgICAgICAgICBjb2xvcjogY29sb3IgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgY3JlYXRlQm90Q2hhbGxlbmdlTXNnICh2YXJpYW50LCBjb2xvciwgZmVuLCBtaW51dGVzLCBpbmNyZW1lbnQsIGxldmVsLCBjaGVzczk2MCkge1xyXG4gICAgICAgIHRoaXMuZG9TZW5kKHtcclxuICAgICAgICAgICAgdHlwZTogXCJjcmVhdGVfYWlfY2hhbGxlbmdlXCIsXHJcbiAgICAgICAgICAgIHVzZXI6IHRoaXMubW9kZWxbXCJ1c2VybmFtZVwiXSxcclxuICAgICAgICAgICAgdmFyaWFudDogdmFyaWFudCxcclxuICAgICAgICAgICAgZmVuOiBmZW4sXHJcbiAgICAgICAgICAgIG1pbnV0ZXM6IG1pbnV0ZXMsXHJcbiAgICAgICAgICAgIGluY3JlbWVudDogaW5jcmVtZW50LFxyXG4gICAgICAgICAgICByYXRlZDogZmFsc2UsXHJcbiAgICAgICAgICAgIGxldmVsOiBsZXZlbCxcclxuICAgICAgICAgICAgY2hlc3M5NjA6IGNoZXNzOTYwLFxyXG4gICAgICAgICAgICBjb2xvcjogY29sb3IgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaXNOZXdTZWVrICh2YXJpYW50LCBjb2xvciwgZmVuLCBtaW51dGVzLCBpbmNyZW1lbnQpIHtcclxuICAgICAgICByZXR1cm4gIXRoaXMuc2Vla3Muc29tZShzZWVrID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHNlZWsudXNlciA9PT0gdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdICYmIHNlZWsudmFyaWFudCA9PT0gdmFyaWFudCAmJiBzZWVrLmZlbiA9PT0gZmVuICYmIHNlZWsuY29sb3IgPT09IGNvbG9yICYmIHNlZWsudGMgPT09IG1pbnV0ZXMgKyBcIitcIiArIGluY3JlbWVudDtcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG5cclxuICAgIGNyZWF0ZVNlZWsgKGNvbG9yKSB7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lkMDEnKSEuc3R5bGUuZGlzcGxheT0nbm9uZSc7XHJcbiAgICAgICAgbGV0IGU7XHJcbiAgICAgICAgZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd2YXJpYW50JykgYXMgSFRNTFNlbGVjdEVsZW1lbnQ7XHJcbiAgICAgICAgY29uc3QgdmFyaWFudCA9IGUub3B0aW9uc1tlLnNlbGVjdGVkSW5kZXhdLnZhbHVlO1xyXG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwic2Vla192YXJpYW50XCIsIHZhcmlhbnQpO1xyXG5cclxuICAgICAgICBlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZlbicpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgY29uc3QgZmVuID0gZS52YWx1ZTtcclxuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcInNlZWtfZmVuXCIsIGUudmFsdWUpO1xyXG5cclxuICAgICAgICBlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21pbicpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgY29uc3QgbWludXRlcyA9IHBhcnNlSW50KGUudmFsdWUpO1xyXG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwic2Vla19taW5cIiwgZS52YWx1ZSk7XHJcblxyXG4gICAgICAgIGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW5jJykgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICBjb25zdCBpbmNyZW1lbnQgPSBwYXJzZUludChlLnZhbHVlKTtcclxuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcInNlZWtfaW5jXCIsIGUudmFsdWUpO1xyXG5cclxuICAgICAgICBlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NoZXNzOTYwJykgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICBjb25zdCBoaWRlID0gdmFyaWFudHM5NjAuaW5kZXhPZih2YXJpYW50KSA9PT0gLTE7XHJcbiAgICAgICAgY29uc3QgY2hlc3M5NjAgPSAoaGlkZSkgPyBmYWxzZSA6IGUuY2hlY2tlZDtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIkNSRUFURSBTRUVLIHZhcmlhbnQsIGNvbG9yLCBmZW4sIG1pbnV0ZXMsIGluY3JlbWVudCwgaGlkZSwgY2hlc3M5NjBcIiwgdmFyaWFudCwgY29sb3IsIGZlbiwgbWludXRlcywgaW5jcmVtZW50LCBoaWRlLCBjaGVzczk2MCk7XHJcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJzZWVrX2NoZXNzOTYwXCIsIGUuY2hlY2tlZCk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNoYWxsZW5nZUFJKSB7XHJcbiAgICAgICAgICAgIGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdpbnB1dFtuYW1lPVwibGV2ZWxcIl06Y2hlY2tlZCcpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGNvbnN0IGxldmVsID0gcGFyc2VJbnQoZS52YWx1ZSk7XHJcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwic2Vla19sZXZlbFwiLCBlLnZhbHVlKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2cobGV2ZWwsIGUudmFsdWUsIGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwic2Vla19sZXZlbFwiKSk7XHJcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlQm90Q2hhbGxlbmdlTXNnKHZhcmlhbnQsIGNvbG9yLCBmZW4sIG1pbnV0ZXMsIGluY3JlbWVudCwgbGV2ZWwsIGNoZXNzOTYwKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5pc05ld1NlZWsodmFyaWFudCwgY29sb3IsIGZlbiwgbWludXRlcywgaW5jcmVtZW50KSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVTZWVrTXNnKHZhcmlhbnQsIGNvbG9yLCBmZW4sIG1pbnV0ZXMsIGluY3JlbWVudCwgY2hlc3M5NjApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJlbmRlclNlZWtCdXR0b25zICgpIHtcclxuICAgICAgICBjb25zdCBzZXRWYXJpYW50ID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBsZXQgZTtcclxuICAgICAgICAgICAgZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd2YXJpYW50JykgYXMgSFRNTFNlbGVjdEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGNvbnN0IHZhcmlhbnQgPSBlLm9wdGlvbnNbZS5zZWxlY3RlZEluZGV4XS52YWx1ZTtcclxuICAgICAgICAgICAgY29uc3QgaGlkZSA9IHZhcmlhbnRzOTYwLmluZGV4T2YodmFyaWFudCkgPT09IC0xO1xyXG5cclxuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NoZXNzOTYwLWJsb2NrJykhLnN0eWxlLmRpc3BsYXkgPSAoaGlkZSkgPyAnbm9uZScgOiAnYmxvY2snO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3Qgc2V0TWludXRlcyA9IChtaW51dGVzKSA9PiB7XHJcbiAgICAgICAgICAgIHZhciBtaW4sIGluYyA9IDA7XHJcbiAgICAgICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibWludXRlc1wiKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgaWYgKGVsKSBlbC5pbm5lckhUTUwgPSBtaW51dGVzO1xyXG5cclxuICAgICAgICAgICAgdmFyIGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWluJykgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICAgICAgaWYgKGUpIG1pbiA9IHBhcnNlSW50KGUudmFsdWUpO1xyXG5cclxuICAgICAgICAgICAgZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbmMnKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAoZSkgaW5jID0gcGFyc2VJbnQoZS52YWx1ZSk7XHJcblxyXG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29sb3ItYnV0dG9uLWdyb3VwJykhLnN0eWxlLmRpc3BsYXkgPSAobWluICsgaW5jID09PSAwKSA/ICdub25lJyA6ICdibG9jayc7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBzZXRJbmNyZW1lbnQgPSAoaW5jcmVtZW50KSA9PiB7XHJcbiAgICAgICAgICAgIHZhciBtaW4sIGluYyA9IDA7XHJcbiAgICAgICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiaW5jcmVtZW50XCIpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAoZWwpIGVsLmlubmVySFRNTCA9IGluY3JlbWVudDtcclxuXHJcbiAgICAgICAgICAgIHZhciBlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21pbicpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGlmIChlKSBtaW4gPSBwYXJzZUludChlLnZhbHVlKTtcclxuXHJcbiAgICAgICAgICAgIGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW5jJykgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICAgICAgaWYgKGUpIGluYyA9IHBhcnNlSW50KGUudmFsdWUpO1xyXG5cclxuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbG9yLWJ1dHRvbi1ncm91cCcpIS5zdHlsZS5kaXNwbGF5ID0gKG1pbiArIGluYyA9PT0gMCkgPyAnbm9uZScgOiAnYmxvY2snO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgdklkeCA9IGxvY2FsU3RvcmFnZS5zZWVrX3ZhcmlhbnQgPT09IHVuZGVmaW5lZCA/IDAgOiB2YXJpYW50cy5pbmRleE9mKGxvY2FsU3RvcmFnZS5zZWVrX3ZhcmlhbnQpO1xyXG4gICAgICAgIGNvbnN0IHZGZW4gPSBsb2NhbFN0b3JhZ2Uuc2Vla19mZW4gPT09IHVuZGVmaW5lZCA/IFwiXCIgOiBsb2NhbFN0b3JhZ2Uuc2Vla19mZW47XHJcbiAgICAgICAgY29uc3Qgdk1pbiA9IGxvY2FsU3RvcmFnZS5zZWVrX21pbiA9PT0gdW5kZWZpbmVkID8gXCI1XCIgOiBsb2NhbFN0b3JhZ2Uuc2Vla19taW47XHJcbiAgICAgICAgY29uc3QgdkluYyA9IGxvY2FsU3RvcmFnZS5zZWVrX2luYyA9PT0gdW5kZWZpbmVkID8gXCIzXCIgOiBsb2NhbFN0b3JhZ2Uuc2Vla19pbmM7XHJcbiAgICAgICAgY29uc3QgdkxldmVsID0gbG9jYWxTdG9yYWdlLnNlZWtfbGV2ZWwgPT09IHVuZGVmaW5lZCA/IFwiMVwiIDogbG9jYWxTdG9yYWdlLnNlZWtfbGV2ZWw7XHJcbiAgICAgICAgY29uc3QgdkNoZXNzOTYwID0gbG9jYWxTdG9yYWdlLnNlZWtfY2hlc3M5NjAgPT09IHVuZGVmaW5lZCA/IFwiZmFsc2VcIiA6IGxvY2FsU3RvcmFnZS5zZWVrX2NoZXNzOTYwO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwibG9jYWxlU3RvcmFnZS5zZWVrX2xldmVsLCB2TGV2ZWw9XCIsIGxvY2FsU3RvcmFnZS5zZWVrX2xldmVsLCB2TGV2ZWwpO1xyXG5cclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgIGgoJ2RpdiNpZDAxJywgeyBjbGFzczoge1wibW9kYWxcIjogdHJ1ZX0gfSwgW1xyXG4gICAgICAgICAgaCgnZm9ybS5tb2RhbC1jb250ZW50JywgW1xyXG4gICAgICAgICAgICBoKCdkaXYjY2xvc2Vjb250YWluZXInLCBbXHJcbiAgICAgICAgICAgICAgaCgnc3Bhbi5jbG9zZScsIHsgb246IHsgY2xpY2s6ICgpID0+IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpZDAxJykhLnN0eWxlLmRpc3BsYXk9J25vbmUnIH0sIGF0dHJzOiB7J2RhdGEtaWNvbic6ICdqJ30sIHByb3BzOiB7dGl0bGU6IFwiQ2FuY2VsXCJ9IH0pLFxyXG4gICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgaCgnZGl2LmNvbnRhaW5lcicsIFtcclxuICAgICAgICAgICAgICAgIGgoJ2xhYmVsJywgeyBhdHRyczoge2ZvcjogXCJ2YXJpYW50XCJ9IH0sIFwiVmFyaWFudFwiKSxcclxuICAgICAgICAgICAgICAgIGgoJ3NlbGVjdCN2YXJpYW50Jywge1xyXG4gICAgICAgICAgICAgICAgICAgIHByb3BzOiB7bmFtZTogXCJ2YXJpYW50XCJ9LFxyXG4gICAgICAgICAgICAgICAgICAgIG9uOiB7IGlucHV0OiAoKSA9PiBzZXRWYXJpYW50KCkgfSxcclxuICAgICAgICAgICAgICAgICAgICBob29rOiB7aW5zZXJ0OiAoKSA9PiBzZXRWYXJpYW50KCkgfSxcclxuICAgICAgICAgICAgICAgICAgICB9LCB2YXJpYW50cy5tYXAoKHZhcmlhbnQsIGlkeCkgPT4gaCgnb3B0aW9uJywgeyBwcm9wczoge3ZhbHVlOiB2YXJpYW50LCBzZWxlY3RlZDogKGlkeCA9PT0gdklkeCkgPyBcInNlbGVjdGVkXCIgOiBcIlwifSB9LCB2YXJpYW50KSkpLFxyXG4gICAgICAgICAgICAgICAgaCgnbGFiZWwnLCB7IGF0dHJzOiB7Zm9yOiBcImZlblwifSB9LCBcIlN0YXJ0IHBvc2l0aW9uXCIpLFxyXG4gICAgICAgICAgICAgICAgaCgnaW5wdXQjZmVuJywgeyBwcm9wczoge25hbWU6ICdmZW4nLCBwbGFjZWhvbGRlcjogJ1Bhc3RlIHRoZSBGRU4gdGV4dCBoZXJlJywgdmFsdWU6IHZGZW59IH0pLFxyXG4gICAgICAgICAgICAgICAgaCgnZGl2I2NoZXNzOTYwLWJsb2NrJywgW1xyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsJywgeyBhdHRyczoge2ZvcjogXCJjaGVzczk2MFwifSB9LCBcIkNoZXNzOTYwXCIpLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2lucHV0I2NoZXNzOTYwJywge3Byb3BzOiB7bmFtZTogXCJjaGVzczk2MFwiLCB0eXBlOiBcImNoZWNrYm94XCIsIGNoZWNrZWQ6IHZDaGVzczk2MCA9PT0gXCJ0cnVlXCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9fSksXHJcbiAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgIC8vaCgnbGFiZWwnLCB7IGF0dHJzOiB7Zm9yOiBcInRjXCJ9IH0sIFwiVGltZSBDb250cm9sXCIpLFxyXG4gICAgICAgICAgICAgICAgLy9oKCdzZWxlY3QjdGltZWNvbnRyb2wnLCB7IHByb3BzOiB7bmFtZTogXCJ0aW1lY29udHJvbFwifSB9LCBbXHJcbiAgICAgICAgICAgICAgICAvLyAgICBoKCdvcHRpb24nLCB7IHByb3BzOiB7dmFsdWU6IFwiMVwiLCBzZWxlY3RlZDogdHJ1ZX0gfSwgXCJSZWFsIHRpbWVcIiksXHJcbiAgICAgICAgICAgICAgICAvLyAgICBoKCdvcHRpb24nLCB7IHByb3BzOiB7dmFsdWU6IFwiMlwifSB9LCBcIlVubGltaXRlZFwiKSxcclxuICAgICAgICAgICAgICAgIC8vXSksXHJcbiAgICAgICAgICAgICAgICBoKCdsYWJlbCcsIHsgYXR0cnM6IHtmb3I6IFwibWluXCJ9IH0sIFwiTWludXRlcyBwZXIgc2lkZTpcIiksXHJcbiAgICAgICAgICAgICAgICBoKCdzcGFuI21pbnV0ZXMnKSxcclxuICAgICAgICAgICAgICAgIGgoJ2lucHV0I21pbicsIHsgY2xhc3M6IHsgXCJzbGlkZXJcIjogdHJ1ZSB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BzOiB7bmFtZTogXCJtaW5cIiwgdHlwZTogXCJyYW5nZVwiLCBtaW46IDAsIG1heDogNjAsIHZhbHVlOiB2TWlufSxcclxuICAgICAgICAgICAgICAgICAgICBvbjogeyBpbnB1dDogKGUpID0+IHNldE1pbnV0ZXMoKGUudGFyZ2V0IGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlKSB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGhvb2s6IHtpbnNlcnQ6ICh2bm9kZSkgPT4gc2V0TWludXRlcygodm5vZGUuZWxtIGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlKSB9LFxyXG4gICAgICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgICAgICBoKCdsYWJlbCcsIHsgYXR0cnM6IHtmb3I6IFwiaW5jXCJ9IH0sIFwiSW5jcmVtZW50IGluIHNlY29uZHM6XCIpLFxyXG4gICAgICAgICAgICAgICAgaCgnc3BhbiNpbmNyZW1lbnQnKSxcclxuICAgICAgICAgICAgICAgIGgoJ2lucHV0I2luYycsIHsgY2xhc3M6IHtcInNsaWRlclwiOiB0cnVlIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcHM6IHtuYW1lOiBcImluY1wiLCB0eXBlOiBcInJhbmdlXCIsIG1pbjogMCwgbWF4OiAxNSwgdmFsdWU6IHZJbmN9LFxyXG4gICAgICAgICAgICAgICAgICAgIG9uOiB7IGlucHV0OiAoZSkgPT4gc2V0SW5jcmVtZW50KChlLnRhcmdldCBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZSkgfSxcclxuICAgICAgICAgICAgICAgICAgICBob29rOiB7aW5zZXJ0OiAodm5vZGUpID0+IHNldEluY3JlbWVudCgodm5vZGUuZWxtIGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlKSB9LFxyXG4gICAgICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgICAgICAvLyBpZiBwbGF5IHdpdGggdGhlIG1hY2hpbmVcclxuICAgICAgICAgICAgICAgIC8vIEEuSS5MZXZlbCAoMS04IGJ1dHRvbnMpXHJcbiAgICAgICAgICAgICAgICBoKCdmb3JtI2FpbGV2ZWwnLCBbXHJcbiAgICAgICAgICAgICAgICBoKCdoNCcsIFwiQS5JLiBMZXZlbFwiKSxcclxuICAgICAgICAgICAgICAgIGgoJ2Rpdi5haS1yYWRpby1ncm91cCcsIFtcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTEnLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCIxXCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCIxXCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpMScsIHsgYXR0cnM6IHtmb3I6IFwiYWkxXCJ9IH0sIFwiMVwiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTInLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCIyXCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCIyXCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpMicsIHsgYXR0cnM6IHtmb3I6IFwiYWkyXCJ9IH0sIFwiMlwiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTMnLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCIzXCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCIzXCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpMycsIHsgYXR0cnM6IHtmb3I6IFwiYWkzXCJ9IH0sIFwiM1wiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTQnLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCI0XCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCI0XCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpNCcsIHsgYXR0cnM6IHtmb3I6IFwiYWk0XCJ9IH0sIFwiNFwiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTUnLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCI1XCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCI1XCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpNScsIHsgYXR0cnM6IHtmb3I6IFwiYWk1XCJ9IH0sIFwiNVwiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTYnLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCI2XCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCI2XCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpNicsIHsgYXR0cnM6IHtmb3I6IFwiYWk2XCJ9IH0sIFwiNlwiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTcnLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCI3XCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCI3XCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpNycsIHsgYXR0cnM6IHtmb3I6IFwiYWk3XCJ9IH0sIFwiN1wiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTgnLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCI4XCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCI4XCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpOCcsIHsgYXR0cnM6IHtmb3I6IFwiYWk4XCJ9IH0sIFwiOFwiKSxcclxuICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICBoKCdkaXYjY29sb3ItYnV0dG9uLWdyb3VwJywgW1xyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2J1dHRvbi5pY29uLmljb24tYmxhY2snLCB7IHByb3BzOiB7dHlwZTogXCJidXR0b25cIiwgdGl0bGU6IFwiQmxhY2tcIn0sIG9uOiB7Y2xpY2s6ICgpID0+IHRoaXMuY3JlYXRlU2VlaygnYicpIH0gfSksXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnYnV0dG9uLmljb24uaWNvbi1hZGp1c3QnLCB7IHByb3BzOiB7dHlwZTogXCJidXR0b25cIiwgdGl0bGU6IFwiUmFuZG9tXCJ9LCBvbjoge2NsaWNrOiAoKSA9PiB0aGlzLmNyZWF0ZVNlZWsoJ3InKX0gfSksXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnYnV0dG9uLmljb24uaWNvbi13aGl0ZScsIHsgcHJvcHM6IHt0eXBlOiBcImJ1dHRvblwiLCB0aXRsZTogXCJXaGl0ZVwifSwgb246IHtjbGljazogKCkgPT4gdGhpcy5jcmVhdGVTZWVrKCd3Jyl9IH0pLFxyXG4gICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgXSksXHJcbiAgICAgICAgXSksXHJcbiAgICAgICAgaCgnYnV0dG9uJywgeyBjbGFzczogeydsb2JieS1idXR0b24nOiB0cnVlfSwgb246IHtcclxuICAgICAgICAgICAgY2xpY2s6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2hhbGxlbmdlQUkgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhaWxldmVsJykhLnN0eWxlLmRpc3BsYXk9J25vbmUnO1xyXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lkMDEnKSEuc3R5bGUuZGlzcGxheT0nYmxvY2snO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IH0sIFwiQ3JlYXRlIGEgZ2FtZVwiKSxcclxuICAgICAgICBoKCdidXR0b24nLCB7IGNsYXNzOiB7J2xvYmJ5LWJ1dHRvbic6IHRydWV9LCBvbjoge1xyXG4gICAgICAgICAgICBjbGljazogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jaGFsbGVuZ2VBSSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWlsZXZlbCcpIS5zdHlsZS5kaXNwbGF5PSdpbmxpbmUtYmxvY2snO1xyXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lkMDEnKSEuc3R5bGUuZGlzcGxheT0nYmxvY2snO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IH0sIFwiUGxheSB3aXRoIHRoZSBtYWNoaW5lXCIpLFxyXG4gICAgICAgIF07XHJcbiAgICB9XHJcblxyXG4gICAgb25DbGlja1NlZWsoc2Vlaykge1xyXG4gICAgICAgIGlmIChzZWVrW1widXNlclwiXSA9PT0gdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJkZWxldGVfc2Vla1wiLCBzZWVrSUQ6IHNlZWtbXCJzZWVrSURcIl0sIHBsYXllcjogdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJhY2NlcHRfc2Vla1wiLCBzZWVrSUQ6IHNlZWtbXCJzZWVrSURcIl0sIHBsYXllcjogdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZW5kZXJTZWVrcyhzZWVrcykge1xyXG4gICAgICAgIC8vIFRPRE86IGZpeCBoZWFkZXIgYW5kIGRhdGEgcm93IGNvbG9tbnNcclxuICAgICAgICAvLyBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zNzI3MjMzMS9odG1sLXRhYmxlLXdpdGgtZml4ZWQtaGVhZGVyLWFuZC1mb290ZXItYW5kLXNjcm9sbGFibGUtYm9keS13aXRob3V0LWZpeGVkLXdpZHRoc1xyXG4gICAgICAgIGNvbnN0IGhlYWRlciA9IGgoJ3RoZWFkJywgW2goJ3RyJyxcclxuICAgICAgICAgICAgW2goJ3RoJywgJ1BsYXllcicpLFxyXG4gICAgICAgICAgICAgaCgndGgnLCAnQ29sb3InKSxcclxuICAgICAgICAgICAgIGgoJ3RoJywgJ1JhdGluZycpLFxyXG4gICAgICAgICAgICAgaCgndGgnLCAnVGltZScpLFxyXG4gICAgICAgICAgICAgaCgndGgnLCAnICAgICcpLFxyXG4gICAgICAgICAgICAgaCgndGgnLCAnVmFyaWFudCcpLFxyXG4gICAgICAgICAgICAgaCgndGgnLCAnTW9kZScpXSldKTtcclxuICAgICAgICBjb25zdCBjb2xvckljb24gPSAoY29sb3IpID0+IHsgcmV0dXJuIGgoJ2knLCB7YXR0cnM6IHtcImRhdGEtaWNvblwiOiBjb2xvciA9PT0gXCJ3XCIgPyBcImNcIiA6IGNvbG9yID09PSBcImJcIiA/IFwiYlwiIDogXCJhXCJ9fSApOyB9O1xyXG4gICAgICAgIHZhciByb3dzID0gc2Vla3MubWFwKChzZWVrKSA9PiBoKFxyXG4gICAgICAgICAgICAndHInLFxyXG4gICAgICAgICAgICB7IG9uOiB7IGNsaWNrOiAoKSA9PiB0aGlzLm9uQ2xpY2tTZWVrKHNlZWspIH0gfSxcclxuICAgICAgICAgICAgW2goJ3RkJywgc2Vla1tcInVzZXJcIl0pLFxyXG4gICAgICAgICAgICAgaCgndGQnLCBbY29sb3JJY29uKHNlZWtbXCJjb2xvclwiXSldKSxcclxuICAgICAgICAgICAgIGgoJ3RkJywgJzE1MDA/JyksXHJcbiAgICAgICAgICAgICBoKCd0ZCcsIHNlZWtbXCJ0Y1wiXSksXHJcbiAgICAgICAgICAgICBoKCd0ZCcsIHthdHRyczoge1wiZGF0YS1pY29uXCI6IFZBUklBTlRTW3NlZWtbXCJ2YXJpYW50XCJdXS5pY29ufSwgY2xhc3M6IHtcImljb25cIjogdHJ1ZX19ICksXHJcbiAgICAgICAgICAgICBoKCd0ZCcsIHthdHRyczoge1wiZGF0YS1pY29uXCI6IChzZWVrLmNoZXNzOTYwKSA/IFwiVlwiIDogXCJcIn0sIGNsYXNzOiB7XCJpY29uXCI6IHRydWV9fSApLFxyXG4gICAgICAgICAgICAgaCgndGQnLCBzZWVrW1widmFyaWFudFwiXSksXHJcbiAgICAgICAgICAgICBoKCd0ZCcsIHNlZWtbXCJyYXRlZFwiXSkgXSlcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICByZXR1cm4gW2hlYWRlciwgaCgndGJvZHknLCByb3dzKV07XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvbk1zZ0dldFNlZWtzID0gKG1zZykgPT4ge1xyXG4gICAgICAgIHRoaXMuc2Vla3MgPSBtc2cuc2Vla3M7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCIhISEhIGdvdCBnZXRfc2Vla3MgbXNnOlwiLCBtc2cpO1xyXG4gICAgICAgIGNvbnN0IG9sZFZOb2RlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZWtzJyk7XHJcbiAgICAgICAgaWYgKG9sZFZOb2RlIGluc3RhbmNlb2YgRWxlbWVudCkge1xyXG4gICAgICAgICAgICBvbGRWTm9kZS5pbm5lckhUTUwgPSAnJztcclxuICAgICAgICAgICAgcGF0Y2gob2xkVk5vZGUgYXMgSFRNTEVsZW1lbnQsIGgoJ3RhYmxlI3NlZWtzJywgdGhpcy5yZW5kZXJTZWVrcyhtc2cuc2Vla3MpKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgb25Nc2dOZXdHYW1lID0gKG1zZykgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiTG9iYnlDb250cm9sbGVyLm9uTXNnTmV3R2FtZSgpXCIsIHRoaXMubW9kZWxbXCJnYW1lSWRcIl0pXHJcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLmFzc2lnbih0aGlzLm1vZGVsW1wiaG9tZVwiXSArICcvJyArIG1zZ1tcImdhbWVJZFwiXSk7XHJcbn1cclxuXHJcbiAgICBwcml2YXRlIG9uTXNnVXNlckNvbm5lY3RlZCA9IChtc2cpID0+IHtcclxuICAgICAgICB0aGlzLm1vZGVsW1widXNlcm5hbWVcIl0gPSBtc2dbXCJ1c2VybmFtZVwiXTtcclxuICAgICAgICByZW5kZXJVc2VybmFtZSh0aGlzLm1vZGVsW1wiaG9tZVwiXSwgdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uTXNnQ2hhdCA9IChtc2cpID0+IHtcclxuICAgICAgICBpZiAobXNnLnVzZXIgIT09IHRoaXMubW9kZWxbXCJ1c2VybmFtZVwiXSkge1xyXG4gICAgICAgICAgICBjaGF0TWVzc2FnZShtc2cudXNlciwgbXNnLm1lc3NhZ2UsIFwibG9iYnljaGF0XCIpO1xyXG4gICAgICAgICAgICBpZiAobXNnLnVzZXIubGVuZ3RoICE9PSAwICYmIG1zZy51c2VyICE9PSAnX3NlcnZlcicpIHNvdW5kLmNoYXQoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvbk1zZ0Z1bGxDaGF0ID0gKG1zZykgPT4ge1xyXG4gICAgICAgIG1zZy5saW5lcy5mb3JFYWNoKChsaW5lKSA9PiB7Y2hhdE1lc3NhZ2UobGluZS51c2VyLCBsaW5lLm1lc3NhZ2UsIFwibG9iYnljaGF0XCIpO30pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgb25Nc2dQaW5nID0gKG1zZykgPT4ge1xyXG4gICAgICAgIHRoaXMuZG9TZW5kKHt0eXBlOiBcInBvbmdcIiwgdGltZXN0YW1wOiBtc2cudGltZXN0YW1wfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvbk1zZ1NodXRkb3duID0gKG1zZykgPT4ge1xyXG4gICAgICAgIGFsZXJ0KG1zZy5tZXNzYWdlKTtcclxuICAgIH1cclxuXHJcbiAgICBvbk1lc3NhZ2UgKGV2dCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiPCsrKyBsb2JieSBvbk1lc3NhZ2UoKTpcIiwgZXZ0LmRhdGEpO1xyXG4gICAgICAgIHZhciBtc2cgPSBKU09OLnBhcnNlKGV2dC5kYXRhKTtcclxuICAgICAgICBzd2l0Y2ggKG1zZy50eXBlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgXCJnZXRfc2Vla3NcIjpcclxuICAgICAgICAgICAgICAgIHRoaXMub25Nc2dHZXRTZWVrcyhtc2cpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgXCJuZXdfZ2FtZVwiOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5vbk1zZ05ld0dhbWUobXNnKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwibG9iYnlfdXNlcl9jb25uZWN0ZWRcIjpcclxuICAgICAgICAgICAgICAgIHRoaXMub25Nc2dVc2VyQ29ubmVjdGVkKG1zZyk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcImxvYmJ5Y2hhdFwiOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5vbk1zZ0NoYXQobXNnKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwiZnVsbGNoYXRcIjpcclxuICAgICAgICAgICAgICAgIHRoaXMub25Nc2dGdWxsQ2hhdChtc2cpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgXCJwaW5nXCI6XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uTXNnUGluZyhtc2cpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgXCJzaHV0ZG93blwiOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5vbk1zZ1NodXRkb3duKG1zZyk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJ1blNlZWtzKHZub2RlOiBWTm9kZSwgbW9kZWwpIHtcclxuICAgIGNvbnN0IGVsID0gdm5vZGUuZWxtIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgY29uc3QgY3RybCA9IG5ldyBMb2JieUNvbnRyb2xsZXIoZWwsIG1vZGVsKTtcclxuICAgIGNvbnNvbGUubG9nKFwibG9iYnlWaWV3KCkgLT4gcnVuU2Vla3MoKVwiLCBlbCwgbW9kZWwsIGN0cmwpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbG9iYnlWaWV3KG1vZGVsKTogVk5vZGVbXSB7XHJcbiAgICAvLyBHZXQgdGhlIG1vZGFsXHJcbiAgICBjb25zdCBtb2RhbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpZDAxJykhO1xyXG5cclxuICAgIC8vIFdoZW4gdGhlIHVzZXIgY2xpY2tzIGFueXdoZXJlIG91dHNpZGUgb2YgdGhlIG1vZGFsLCBjbG9zZSBpdFxyXG4gICAgd2luZG93Lm9uY2xpY2sgPSBmdW5jdGlvbihldmVudCkge1xyXG4gICAgICAgIGlmIChldmVudC50YXJnZXQgPT0gbW9kYWwpIHtcclxuICAgICAgICAgICAgbW9kYWwuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gW2goJ2FzaWRlLnNpZGViYXItZmlyc3QnLCBbIGgoJ2Rpdi5sb2JieWNoYXQjbG9iYnljaGF0JykgXSksXHJcbiAgICAgICAgICAgIGgoJ21haW4ubWFpbicsIFsgaCgndGFibGUjc2Vla3MnLCB7aG9vazogeyBpbnNlcnQ6ICh2bm9kZSkgPT4gcnVuU2Vla3Modm5vZGUsIG1vZGVsKSB9IH0pIF0pLFxyXG4gICAgICAgICAgICBoKCdhc2lkZS5zaWRlYmFyLXNlY29uZCcsIFsgaCgndWwjc2Vla2J1dHRvbnMnKSBdKSxcclxuICAgICAgICAgICAgaCgndW5kZXItbGVmdCcsIFwiIyBvZiB1c2Vyc1wiKSxcclxuICAgICAgICAgICAgaCgndW5kZXItbG9iYnknKSxcclxuICAgICAgICAgICAgaCgndW5kZXItcmlnaHQnLCBbXHJcbiAgICAgICAgICAgICAgICBoKCdhJywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzOiB7J2RvbmF0ZS1idXR0b24nOiB0cnVlfSxcclxuICAgICAgICAgICAgICAgICAgICBhdHRyczoge2hyZWY6ICdodHRwczovL3d3dy5wYXlwYWwuY29tL2NnaS1iaW4vd2Vic2NyP2NtZD1fcy14Y2xpY2smaG9zdGVkX2J1dHRvbl9pZD1OQzczSlhSQlFOVEFOJnNvdXJjZT11cmwnfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sICdEaXJlY3RseSBzdXBwb3J0IHVzJylcclxuICAgICAgICAgICAgXSksXHJcbiAgICAgICAgXTtcclxufVxyXG4iLCJpbXBvcnQgeyBpbml0IH0gZnJvbSAnc25hYmJkb20nO1xyXG5pbXBvcnQga2xhc3MgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9jbGFzcyc7XHJcbmltcG9ydCBhdHRyaWJ1dGVzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvYXR0cmlidXRlcyc7XHJcbmltcG9ydCBwcm9wZXJ0aWVzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvcHJvcHMnO1xyXG5pbXBvcnQgbGlzdGVuZXJzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMnO1xyXG5pbXBvcnQgaCBmcm9tICdzbmFiYmRvbS9oJztcclxuaW1wb3J0IHsgVk5vZGUgfSBmcm9tICdzbmFiYmRvbS92bm9kZSc7XHJcblxyXG5jb25zdCBwYXRjaCA9IGluaXQoW2tsYXNzLCBhdHRyaWJ1dGVzLCBwcm9wZXJ0aWVzLCBsaXN0ZW5lcnNdKTtcclxuXHJcbmltcG9ydCB7IGxvYmJ5VmlldyB9IGZyb20gJy4vbG9iYnknO1xyXG5pbXBvcnQgeyByb3VuZFZpZXcgfSBmcm9tICcuL3JvdW5kJztcclxuaW1wb3J0IHsgcGxheWVyc1ZpZXcgfSBmcm9tICcuL3BsYXllcnMnO1xyXG5pbXBvcnQgeyBwcm9maWxlVmlldyB9IGZyb20gJy4vcHJvZmlsZSc7XHJcblxyXG5jb25zdCBtb2RlbCA9IHtob21lOiBcIlwiLCB1c2VybmFtZTogXCJcIiwgYW5vbjogXCJcIiwgdmFyaWFudDogXCJcIiwgZ2FtZUlkOiAwLCB3cGxheWVyOiBcIlwiLCBicGxheWVyOiBcIlwiLCBmZW46IFwiXCIsIGJhc2U6IFwiXCIsIGluYzogXCJcIiwgc2Vla3M6IFtdLCB0djogXCJcIiwgcHJvZmlsZWlkOiBcIlwiLCBzdGF0dXM6IFwiXCJ9O1xyXG5cclxudmFyIGdldENvb2tpZSA9IGZ1bmN0aW9uKG5hbWUpIHtcclxuICAgIHZhciBjb29raWVzID0gZG9jdW1lbnQuY29va2llLnNwbGl0KCc7Jyk7XHJcbiAgICBmb3IodmFyIGk9MCA7IGkgPCBjb29raWVzLmxlbmd0aCA7ICsraSkge1xyXG4gICAgICAgIHZhciBwYWlyID0gY29va2llc1tpXS50cmltKCkuc3BsaXQoJz0nKTtcclxuICAgICAgICBpZihwYWlyWzBdID09IG5hbWUpXHJcbiAgICAgICAgICAgIHJldHVybiBwYWlyWzFdO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFwiXCI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB2aWV3KGVsLCBtb2RlbCk6IFZOb2RlIHtcclxuICAgIGNvbnN0IHVzZXIgPSBnZXRDb29raWUoXCJ1c2VyXCIpO1xyXG4gICAgaWYgKHVzZXIgIT09IFwiXCIpIG1vZGVsW1widXNlcm5hbWVcIl0gPSB1c2VyO1xyXG5cclxuICAgIG1vZGVsW1wiaG9tZVwiXSA9IGVsLmdldEF0dHJpYnV0ZShcImRhdGEtaG9tZVwiKTtcclxuICAgIG1vZGVsW1wiYW5vblwiXSA9IGVsLmdldEF0dHJpYnV0ZShcImRhdGEtYW5vblwiKTtcclxuICAgIG1vZGVsW1wicHJvZmlsZWlkXCJdID0gZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1wcm9maWxlXCIpO1xyXG4gICAgbW9kZWxbXCJ2YXJpYW50XCJdID0gZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS12YXJpYW50XCIpO1xyXG4gICAgbW9kZWxbXCJjaGVzczk2MFwiXSA9IGVsLmdldEF0dHJpYnV0ZShcImRhdGEtY2hlc3M5NjBcIik7XHJcbiAgICBtb2RlbFtcImxldmVsXCJdID0gZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1sZXZlbFwiKTtcclxuICAgIG1vZGVsW1widXNlcm5hbWVcIl0gPSB1c2VyICE9PSBcIlwiID8gdXNlciA6IGVsLmdldEF0dHJpYnV0ZShcImRhdGEtdXNlclwiKTtcclxuICAgIG1vZGVsW1wiZ2FtZUlkXCJdID0gZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1nYW1laWRcIik7XHJcbiAgICBtb2RlbFtcIndwbGF5ZXJcIl0gPSBlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLXdwbGF5ZXJcIik7XHJcbiAgICBtb2RlbFtcInd0aXRsZVwiXSA9IGVsLmdldEF0dHJpYnV0ZShcImRhdGEtd3RpdGxlXCIpO1xyXG4gICAgbW9kZWxbXCJicGxheWVyXCJdID0gZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1icGxheWVyXCIpO1xyXG4gICAgbW9kZWxbXCJidGl0bGVcIl0gPSBlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLWJ0aXRsZVwiKTtcclxuICAgIG1vZGVsW1wiZmVuXCJdID0gZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1mZW5cIik7XHJcbiAgICBtb2RlbFtcImJhc2VcIl0gPSBlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLWJhc2VcIik7XHJcbiAgICBtb2RlbFtcImluY1wiXSA9IGVsLmdldEF0dHJpYnV0ZShcImRhdGEtaW5jXCIpO1xyXG4gICAgbW9kZWxbXCJyZXN1bHRcIl0gPSBlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLXJlc3VsdFwiKTtcclxuICAgIG1vZGVsW1wic3RhdHVzXCJdID0gZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1zdGF0dXNcIik7XHJcbiAgICBtb2RlbFtcImRhdGVcIl0gPSBlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLWRhdGVcIik7XHJcbiAgICBtb2RlbFtcInR2XCJdID0gZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS12aWV3XCIpID09PSAndHYnO1xyXG5cclxuICAgIHN3aXRjaCAoZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS12aWV3XCIpKSB7XHJcbiAgICBjYXNlICdhYm91dCc6XHJcbiAgICAgICAgcmV0dXJuIGgoJ2lmcmFtZScsIHtwcm9wczoge3NyYzogbW9kZWxbXCJob21lXCJdICsgXCIvc3RhdGljL2RvY3MvdmFyaWFudHMuaHRtbFwiLCBoZWlnaHQ6IFwiMTAwJVwiLCB3aWR0aDpcIjEwMCVcIiwgc2VhbWxlc3M6IFwiXCJ9fSk7XHJcbiAgICBjYXNlICdwbGF5ZXJzJzpcclxuICAgICAgICByZXR1cm4gaCgnZGl2I3BsYWNlaG9sZGVyLnBsYXllcnMtd3JhcHBlcicsIHBsYXllcnNWaWV3KG1vZGVsKSk7XHJcbiAgICBjYXNlICdwcm9maWxlJzpcclxuICAgICAgICByZXR1cm4gaCgnZGl2I3BsYWNlaG9sZGVyLnByb2ZpbGUtd3JhcHBlcicsIHByb2ZpbGVWaWV3KG1vZGVsKSk7XHJcbiAgICBjYXNlICd0dic6XHJcbiAgICBjYXNlICdyb3VuZCc6XHJcbiAgICAgICAgcmV0dXJuIGgoJ2RpdiNwbGFjZWhvbGRlci5tYWluLXdyYXBwZXInLCByb3VuZFZpZXcobW9kZWwpKTtcclxuICAgIGNhc2UgJ3RoYW5rcyc6XHJcbiAgICAgICAgcmV0dXJuIGgoJ2RpdiNwbGFjZWhvbGRlci5tYWluLXdyYXBwZXInLCBoKCdoMicsICdUaGFuayB5b3UgZm9yIHlvdXIgc3VwcG9ydCEnKSk7XHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICAgIHJldHVybiBoKCdkaXYjcGxhY2Vob2xkZXIubWFpbi13cmFwcGVyJywgbG9iYnlWaWV3KG1vZGVsKSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3B5Y2hlc3MtdmFyaWFudHMnKTtcclxuaWYgKGVsIGluc3RhbmNlb2YgRWxlbWVudCkge1xyXG4gICAgcGF0Y2goZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYWNlaG9sZGVyJykgYXMgSFRNTEVsZW1lbnQsIHZpZXcoZWwsIG1vZGVsKSk7XHJcbn1cclxuIiwiaW1wb3J0IHsgaW5pdCB9IGZyb20gXCJzbmFiYmRvbVwiO1xuaW1wb3J0IGtsYXNzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnO1xuaW1wb3J0IGF0dHJpYnV0ZXMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9hdHRyaWJ1dGVzJztcbmltcG9ydCBwcm9wZXJ0aWVzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvcHJvcHMnO1xuaW1wb3J0IGxpc3RlbmVycyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJztcblxuY29uc3QgcGF0Y2ggPSBpbml0KFtrbGFzcywgYXR0cmlidXRlcywgcHJvcGVydGllcywgbGlzdGVuZXJzXSk7XG5cbmltcG9ydCBoIGZyb20gJ3NuYWJiZG9tL2gnO1xuXG5pbXBvcnQgeyBnZWFyQnV0dG9uLCB0b2dnbGVPcmllbnRhdGlvbiB9IGZyb20gJy4vc2V0dGluZ3MnO1xuXG5cbmZ1bmN0aW9uIHNlbGVjdE1vdmUgKGN0cmwsIHBseSkge1xuICAgIGNvbnN0IGFjdGl2ZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2xpLm1vdmUuYWN0aXZlJyk7XG4gICAgaWYgKGFjdGl2ZSkgYWN0aXZlLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpO1xuXG4gICAgY29uc3QgZWxQbHkgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBsaS5tb3ZlW3BseT1cIiR7cGx5fVwiXWApO1xuICAgIGlmIChlbFBseSkgZWxQbHkuY2xhc3NMaXN0LmFkZCgnYWN0aXZlJyk7XG5cbiAgICBjdHJsLmdvUGx5KHBseSlcbiAgICBzY3JvbGxUb1BseShjdHJsKTtcbn1cblxuZnVuY3Rpb24gc2Nyb2xsVG9QbHkgKGN0cmwpIHtcbiAgICBpZiAoY3RybC5zdGVwcy5sZW5ndGggPCA5KSByZXR1cm47XG4gICAgY29uc3QgbW92ZXNFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtb3ZlcycpIGFzIEhUTUxFbGVtZW50O1xuICAgIGxldCBzdDogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGNvbnN0IHBseUVsID0gbW92ZXNFbC5xdWVyeVNlbGVjdG9yKCdsaS5tb3ZlLmFjdGl2ZScpIGFzIEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG4gICAgaWYgKGN0cmwucGx5ID09IDApIHN0ID0gMDtcbiAgICBlbHNlIGlmIChjdHJsLnBseSA9PSBjdHJsLnN0ZXBzLmxlbmd0aCAtIDEpIHN0ID0gOTk5OTk7XG4gICAgZWxzZSBpZiAocGx5RWwpIHN0ID0gcGx5RWwub2Zmc2V0VG9wIC0gbW92ZXNFbC5vZmZzZXRIZWlnaHQgKyBwbHlFbC5vZmZzZXRIZWlnaHQ7XG5cbiAgICBjb25zb2xlLmxvZyhcInNjcm9sbFRvUGx5XCIsIGN0cmwucGx5LCBzdCk7XG4gICAgaWYgKHR5cGVvZiBzdCA9PSAnbnVtYmVyJykge1xuICAgICAgICBpZiAoc3QgPT0gMCB8fCBzdCA9PSA5OTk5OSkgbW92ZXNFbC5zY3JvbGxUb3AgPSBzdDtcbiAgICAgICAgZWxzZSBpZiAocGx5RWwpIHtcbiAgICAgICAgICAgIHZhciBpc1Ntb290aFNjcm9sbFN1cHBvcnRlZCA9ICdzY3JvbGxCZWhhdmlvcicgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlO1xuICAgICAgICAgICAgaWYoaXNTbW9vdGhTY3JvbGxTdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBwbHlFbC5zY3JvbGxJbnRvVmlldyh7YmVoYXZpb3I6IFwic21vb3RoXCIsIGJsb2NrOiBcImNlbnRlclwifSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBseUVsLnNjcm9sbEludG9WaWV3KGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1vdmVsaXN0VmlldyAoY3RybCkge1xuICAgIGN0cmwudmdlYXIgPSBnZWFyQnV0dG9uKGN0cmwpO1xuICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbW92ZS1jb250cm9scycpIGFzIEhUTUxFbGVtZW50O1xuICAgIGN0cmwubW92ZUNvbnRyb2xzID0gcGF0Y2goY29udGFpbmVyLCBoKCdkaXYuYnRuLWNvbnRyb2xzJywgW1xuICAgICAgICAgICAgaCgnYnV0dG9uJywgeyBvbjogeyBjbGljazogKCkgPT4gdG9nZ2xlT3JpZW50YXRpb24oY3RybCkgfSB9LCBbaCgnaScsIHtwcm9wczoge3RpdGxlOiAnRmxpcCBib2FyZCd9LCBjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tcmVmcmVzaFwiOiB0cnVlfSB9ICksIF0pLFxuICAgICAgICAgICAgaCgnYnV0dG9uJywgeyBvbjogeyBjbGljazogKCkgPT4gc2VsZWN0TW92ZShjdHJsLCAwKSB9IH0sIFtoKCdpJywge2NsYXNzOiB7XCJpY29uXCI6IHRydWUsIFwiaWNvbi1mYXN0LWJhY2t3YXJkXCI6IHRydWV9IH0gKSwgXSksXG4gICAgICAgICAgICBoKCdidXR0b24nLCB7IG9uOiB7IGNsaWNrOiAoKSA9PiBzZWxlY3RNb3ZlKGN0cmwsIE1hdGgubWF4KGN0cmwucGx5IC0gMSwgMCkpIH0gfSwgW2goJ2knLCB7Y2xhc3M6IHtcImljb25cIjogdHJ1ZSwgXCJpY29uLXN0ZXAtYmFja3dhcmRcIjogdHJ1ZX0gfSApLCBdKSxcbiAgICAgICAgICAgIGgoJ2J1dHRvbicsIHsgb246IHsgY2xpY2s6ICgpID0+IHNlbGVjdE1vdmUoY3RybCwgTWF0aC5taW4oY3RybC5wbHkgKyAxLCBjdHJsLnN0ZXBzLmxlbmd0aCAtIDEpKSB9IH0sIFtoKCdpJywge2NsYXNzOiB7XCJpY29uXCI6IHRydWUsIFwiaWNvbi1zdGVwLWZvcndhcmRcIjogdHJ1ZX0gfSApLCBdKSxcbiAgICAgICAgICAgIGgoJ2J1dHRvbicsIHsgb246IHsgY2xpY2s6ICgpID0+IHNlbGVjdE1vdmUoY3RybCwgY3RybC5zdGVwcy5sZW5ndGggLSAxKSB9IH0sIFtoKCdpJywge2NsYXNzOiB7XCJpY29uXCI6IHRydWUsIFwiaWNvbi1mYXN0LWZvcndhcmRcIjogdHJ1ZX0gfSApLCBdKSxcbiAgICAgICAgICAgIGN0cmwudmdlYXIsXG4gICAgICAgIF0pXG4gICAgKTtcbiAgICByZXR1cm4gaCgnZGl2I21vdmVzJywgW2goJ29sLm1vdmVsaXN0I21vdmVsaXN0JyldKVxuICAgIH1cblxuZXhwb3J0IGZ1bmN0aW9uIHVwZGF0ZU1vdmVsaXN0IChjdHJsKSB7XG4gICAgdmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtb3ZlbGlzdCcpIGFzIEhUTUxFbGVtZW50O1xuICAgIGNvbnN0IHBseSA9IGN0cmwuc3RlcHMubGVuZ3RoIC0gMTtcbiAgICBjb25zdCBtb3ZlID0gY3RybC5zdGVwc1twbHldWydzYW4nXTtcbiAgICBjb25zdCBhY3RpdmUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdsaS5tb3ZlLmFjdGl2ZScpO1xuICAgIGlmIChhY3RpdmUpIGFjdGl2ZS5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKTtcbiAgICBjb25zdCBlbCA9IGgoJ2xpLm1vdmUnLCB7Y2xhc3M6IHthY3RpdmU6IHRydWV9LCBhdHRyczoge3BseTogcGx5fSwgb246IHsgY2xpY2s6ICgpID0+IHNlbGVjdE1vdmUoY3RybCwgcGx5KSB9fSwgbW92ZSk7XG4gICAgaWYgKHBseSAlIDIgPT0gMCkge1xuICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ29sLm1vdmVsaXN0I21vdmVsaXN0JywgW2VsXSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHBhdGNoKGNvbnRhaW5lciwgaCgnb2wubW92ZWxpc3QjbW92ZWxpc3QnLCBbaCgnbGkubW92ZS5jb3VudGVyJywgKHBseSArIDEpIC8gMiksIGVsXSkpO1xuICAgIH1cbiAgICBzY3JvbGxUb1BseShjdHJsKTtcbn0iLCJpbXBvcnQgaCBmcm9tICdzbmFiYmRvbS9oJztcblxuZXhwb3J0IGZ1bmN0aW9uIHBsYXllcihpZCwgdGl0bGUsIG5hbWUsIGxldmVsKSB7XG4gICAgcmV0dXJuIGgoJ3JvdW5kLXBsYXllcicsIFtcbiAgICAgICAgaCgnZGl2LnBsYXllci1kYXRhJywgW1xuICAgICAgICAgICAgaCgnaS1zaWRlLm9ubGluZSMnICsgaWQsIHtjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tb25saW5lXCI6IGZhbHNlLCBcImljb24tb2ZmbGluZVwiOiB0cnVlfX0pLFxuICAgICAgICAgICAgaCgncGxheWVyJywgW1xuICAgICAgICAgICAgICAgIGgoJ2EudXNlci1saW5rJywge2F0dHJzOiB7aHJlZjogJy9ALycgKyBuYW1lfX0sIFtcbiAgICAgICAgICAgICAgICAgICAgaCgncGxheWVyLXRpdGxlJywgXCIgXCIgKyB0aXRsZSArIFwiIFwiKSxcbiAgICAgICAgICAgICAgICAgICAgbmFtZSArICgodGl0bGUgPT09IFwiQk9UXCIgJiYgbGV2ZWwgPiAwKSA/ICcgbGV2ZWwgJyArIGxldmVsOiAnJyksXG4gICAgICAgICAgICAgICAgXSksXG4gICAgICAgICAgICAgICAgaCgncmF0aW5nJywgXCIxNTAwP1wiKSxcbiAgICAgICAgICAgIF0pLFxuICAgICAgICBdKSxcbiAgICBdKTtcbn1cbiIsImltcG9ydCB7IGluaXQgfSBmcm9tICdzbmFiYmRvbSc7XHJcbmltcG9ydCBrbGFzcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2NsYXNzJztcclxuaW1wb3J0IGF0dHJpYnV0ZXMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9hdHRyaWJ1dGVzJztcclxuaW1wb3J0IHByb3BlcnRpZXMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9wcm9wcyc7XHJcbmltcG9ydCBsaXN0ZW5lcnMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9ldmVudGxpc3RlbmVycyc7XHJcblxyXG5jb25zdCBwYXRjaCA9IGluaXQoW2tsYXNzLCBhdHRyaWJ1dGVzLCBwcm9wZXJ0aWVzLCBsaXN0ZW5lcnNdKTtcclxuXHJcbmltcG9ydCBoIGZyb20gJ3NuYWJiZG9tL2gnO1xyXG5pbXBvcnQgeyBWTm9kZSB9IGZyb20gJ3NuYWJiZG9tL3Zub2RlJztcclxuXHJcbmltcG9ydCB7IHJlbmRlclVzZXJuYW1lIH0gZnJvbSAnLi91c2VyJztcclxuXHJcblxyXG5mdW5jdGlvbiByZW5kZXJQbGF5ZXJzKG1vZGVsLCBwbGF5ZXJzKSB7XHJcbiAgICBjb25zb2xlLmxvZyhcInBsYXllcnNcIiwgbW9kZWwsIHBsYXllcnMpO1xyXG4gICAgY29uc3QgaGVhZGVyID0gaCgndGhlYWQnLCBbaCgndHInLCBbaCgndGgnLCAnUGxheWVycycpLCBdKV0pO1xyXG4gICAgdmFyIHJvd3MgPSBwbGF5ZXJzLm1hcChcclxuICAgICAgICAocGxheWVyKSA9PiBoKCd0cicsIFtcclxuICAgICAgICAgICAgaCgndGQucGxheWVyLWRhdGEnLCBbXHJcbiAgICAgICAgICAgICAgICBoKCdpLXNpZGUub25saW5lJywge2NsYXNzOiB7XCJpY29uXCI6IHRydWUsIFwiaWNvbi1vbmxpbmVcIjogcGxheWVyW1wib25saW5lXCJdLCBcImljb24tb2ZmbGluZVwiOiAhcGxheWVyW1wib25saW5lXCJdfX0pLFxyXG4gICAgICAgICAgICAgICAgaCgncGxheWVyJywgW1xyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2EudXNlci1saW5rJywge2F0dHJzOiB7aHJlZjogJy9ALycgKyBwbGF5ZXJbXCJfaWRcIl19fSwgW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdwbGF5ZXItdGl0bGUnLCBcIiBcIiArIHBsYXllcltcInRpdGxlXCJdICsgXCIgXCIpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwbGF5ZXJbXCJfaWRcIl0sXHJcbiAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgXSlcclxuICAgICAgICBdKVxyXG4gICAgICAgICk7XHJcbiAgICByZXR1cm4gW2hlYWRlciwgaCgndGJvZHknLCByb3dzKV07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBwbGF5ZXJzVmlldyhtb2RlbCk6IFZOb2RlW10ge1xyXG4gICAgcmVuZGVyVXNlcm5hbWUobW9kZWxbXCJob21lXCJdLCBtb2RlbFtcInVzZXJuYW1lXCJdKTtcclxuXHJcbiAgICB2YXIgeG1saHR0cCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG4gICAgdmFyIHVybCA9IG1vZGVsW1wiaG9tZVwiXSArIFwiL2FwaS9wbGF5ZXJzXCI7XHJcblxyXG4gICAgeG1saHR0cC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcclxuICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PSA0ICYmIHRoaXMuc3RhdHVzID09IDIwMCkge1xyXG4gICAgICAgIHZhciBteUFyciA9IEpTT04ucGFyc2UodGhpcy5yZXNwb25zZVRleHQpO1xyXG4gICAgICAgIG15RnVuY3Rpb24obXlBcnIpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgeG1saHR0cC5vcGVuKFwiR0VUXCIsIHVybCwgdHJ1ZSk7XHJcbiAgICB4bWxodHRwLnNlbmQoKTtcclxuXHJcbiAgICBmdW5jdGlvbiBteUZ1bmN0aW9uKGFycikge1xyXG4gICAgICAgIGNvbnN0IG9sZFZOb2RlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllcnMnKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhhcnIpO1xyXG4gICAgICAgIGlmIChvbGRWTm9kZSBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcclxuICAgICAgICAgICAgcGF0Y2gob2xkVk5vZGUgYXMgSFRNTEVsZW1lbnQsIGgoJ3RhYmxlI3BsYXllcnMnLCByZW5kZXJQbGF5ZXJzKG1vZGVsLCBhcnIpKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnNvbGUubG9nKG1vZGVsKTtcclxuICAgIHJldHVybiBbaCgnYXNpZGUuc2lkZWJhci1maXJzdCcpLFxyXG4gICAgICAgICAgICBoKCdtYWluLm1haW4nLCBbaCgndGFibGUjcGxheWVycycpXSksXHJcbiAgICAgICAgICAgIGgoJ2FzaWRlLnNpZGViYXItc2Vjb25kJyksXHJcbiAgICAgICAgXTtcclxufVxyXG4iLCJpbXBvcnQgeyBoLCBpbml0IH0gZnJvbSBcInNuYWJiZG9tXCI7XG5pbXBvcnQga2xhc3MgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9jbGFzcyc7XG5pbXBvcnQgYXR0cmlidXRlcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2F0dHJpYnV0ZXMnO1xuaW1wb3J0IHByb3BlcnRpZXMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9wcm9wcyc7XG5pbXBvcnQgbGlzdGVuZXJzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMnO1xuXG5pbXBvcnQgKiBhcyBjZyBmcm9tICdjaGVzc2dyb3VuZHgvdHlwZXMnO1xuaW1wb3J0IHsgZHJhZ05ld1BpZWNlIH0gZnJvbSAnY2hlc3Nncm91bmR4L2RyYWcnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICdjaGVzc2dyb3VuZHgvdHlwZXMnO1xuaW1wb3J0IHsgc2V0RHJvcE1vZGUsIGNhbmNlbERyb3BNb2RlIH0gZnJvbSAnY2hlc3Nncm91bmR4L2Ryb3AnO1xuXG5pbXBvcnQgeyByb2xlVG9TYW4sIG5lZWRQb2NrZXRzLCBwb2NrZXRSb2xlcywgbGMgfSBmcm9tICcuL2NoZXNzJztcbmltcG9ydCBSb3VuZENvbnRyb2xsZXIgZnJvbSAnLi9jdHJsJztcblxuY29uc3QgcGF0Y2ggPSBpbml0KFtrbGFzcywgYXR0cmlidXRlcywgcHJvcGVydGllcywgbGlzdGVuZXJzXSk7XG5cbnR5cGUgUG9zaXRpb24gPSAndG9wJyB8ICdib3R0b20nO1xuXG5jb25zdCBldmVudE5hbWVzID0gWydtb3VzZWRvd24nLCAndG91Y2hzdGFydCddO1xuXG5leHBvcnQgZnVuY3Rpb24gcG9ja2V0VmlldyhjdHJsOiBSb3VuZENvbnRyb2xsZXIsIGNvbG9yOiBDb2xvciwgcG9zaXRpb246IFBvc2l0aW9uKSB7XG4gIGNvbnN0IHBvY2tldCA9IGN0cmwucG9ja2V0c1twb3NpdGlvbiA9PT0gJ3RvcCcgPyAwIDogMV07XG4gIGNvbnN0IHBpZWNlUm9sZXMgPSBPYmplY3Qua2V5cyhwb2NrZXQpO1xuICByZXR1cm4gaCgnZGl2LnBvY2tldC4nICsgcG9zaXRpb24sIHtcbiAgICBjbGFzczogeyB1c2FibGU6IHRydWUgfSxcbiAgICBob29rOiB7XG4gICAgICBpbnNlcnQ6IHZub2RlID0+IHtcbiAgICAgICAgZXZlbnROYW1lcy5mb3JFYWNoKG5hbWUgPT4ge1xuICAgICAgICAgICh2bm9kZS5lbG0gYXMgSFRNTEVsZW1lbnQpLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgKGU6IGNnLk1vdWNoRXZlbnQpID0+IHtcbiAgICAgICAgICAgIGlmIChwb3NpdGlvbiA9PT0gKGN0cmwuZmxpcCA/ICd0b3AnIDogJ2JvdHRvbScpKSBkcmFnKGN0cmwsIGUpO1xuICAgICAgICAgIH0pXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSwgcGllY2VSb2xlcy5tYXAocm9sZSA9PiB7XG4gICAgbGV0IG5iID0gcG9ja2V0W3JvbGVdIHx8IDA7XG4gICAgcmV0dXJuIGgoJ3BpZWNlLicgKyByb2xlICsgJy4nICsgY29sb3IsIHtcbiAgICAgIGF0dHJzOiB7XG4gICAgICAgICdkYXRhLXJvbGUnOiByb2xlLFxuICAgICAgICAnZGF0YS1jb2xvcic6IGNvbG9yLFxuICAgICAgICAnZGF0YS1uYic6IG5iLFxuICAgICAgfVxuICAgIH0pO1xuICB9KSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkcmFnKGN0cmw6IFJvdW5kQ29udHJvbGxlciwgZTogY2cuTW91Y2hFdmVudCk6IHZvaWQge1xuICAgIGlmIChlLmJ1dHRvbiAhPT0gdW5kZWZpbmVkICYmIGUuYnV0dG9uICE9PSAwKSByZXR1cm47IC8vIG9ubHkgdG91Y2ggb3IgbGVmdCBjbGlja1xuICAgIGNvbnN0IGVsID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQsXG4gICAgcm9sZSA9IGVsLmdldEF0dHJpYnV0ZSgnZGF0YS1yb2xlJykgYXMgY2cuUm9sZSxcbiAgICBjb2xvciA9IGVsLmdldEF0dHJpYnV0ZSgnZGF0YS1jb2xvcicpIGFzIGNnLkNvbG9yLFxuICAgIG51bWJlciA9IGVsLmdldEF0dHJpYnV0ZSgnZGF0YS1uYicpO1xuICAgIGlmICghcm9sZSB8fCAhY29sb3IgfHwgbnVtYmVyID09PSAnMCcpIHJldHVybjtcbiAgICBpZiAoY3RybC5jbGlja0Ryb3AgIT09IHVuZGVmaW5lZCAmJiByb2xlID09PSBjdHJsLmNsaWNrRHJvcC5yb2xlKSB7XG4gICAgICAgIGN0cmwuY2xpY2tEcm9wID0gdW5kZWZpbmVkO1xuICAgICAgICBjdHJsLmNoZXNzZ3JvdW5kLnNlbGVjdFNxdWFyZShudWxsKTtcbiAgICAgICAgY2FuY2VsRHJvcE1vZGUoY3RybC5jaGVzc2dyb3VuZC5zdGF0ZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBzZXREcm9wTW9kZShjdHJsLmNoZXNzZ3JvdW5kLnN0YXRlLCBudW1iZXIgIT09ICcwJyA/IHsgY29sb3IsIHJvbGUgfSA6IHVuZGVmaW5lZCk7XG4gICAgfTtcblxuICAgIC8vIFNob3cgcG9zc2libGUgZHJvcCBkZXN0cyBvbiBteSB0dXJuIG9ubHkgbm90IHRvIG1lc3MgdXAgcHJlZHJvcFxuICAgIGlmIChjdHJsLnR1cm5Db2xvciA9PT0gY3RybC5teWNvbG9yKSB7XG4gICAgICAgIGNvbnN0IGRyb3BEZXN0cyA9IHsgJ3owJzogY3RybC5kZXN0c1tyb2xlVG9TYW5bcm9sZV0gKyBcIkBcIl0gfTtcbiAgICAgICAgY3RybC5jaGVzc2dyb3VuZC5uZXdQaWVjZSh7XCJyb2xlXCI6IHJvbGUsIFwiY29sb3JcIjogY29sb3J9LCAnejAnKVxuICAgICAgICBjdHJsLmNoZXNzZ3JvdW5kLnNldCh7XG4gICAgICAgICAgICB0dXJuQ29sb3I6IGNvbG9yLFxuICAgICAgICAgICAgbW92YWJsZToge1xuICAgICAgICAgICAgICAgIGRlc3RzOiBkcm9wRGVzdHMsXG4gICAgICAgICAgICAgICAgc2hvd0Rlc3RzOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGN0cmwuY2hlc3Nncm91bmQuc2VsZWN0U3F1YXJlKCd6MCcpO1xuICAgICAgICBjdHJsLmNoZXNzZ3JvdW5kLnNldCh7IGxhc3RNb3ZlOiBjdHJsLmxhc3Rtb3ZlIH0pO1xuICAgIH1cbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBkcmFnTmV3UGllY2UoY3RybC5jaGVzc2dyb3VuZC5zdGF0ZSwgeyBjb2xvciwgcm9sZSB9LCBlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRyb3BJc1ZhbGlkKGRlc3RzOiBjZy5EZXN0cywgcm9sZTogY2cuUm9sZSwga2V5OiBjZy5LZXkpOiBib29sZWFuIHtcbiAgICAvLyBjb25zb2xlLmxvZyhcImRyb3BEZXN0czpcIiwgZGVzdHMsIHJvbGUsIGtleSlcbiAgICBjb25zdCBkcm9wcyA9IGRlc3RzW3JvbGVUb1Nhbltyb2xlXSArIFwiQFwiXTtcbiAgICAvLyBjb25zb2xlLmxvZyhcImRyb3BzOlwiLCBkcm9wcylcblxuICAgIGlmIChkcm9wcyA9PT0gdW5kZWZpbmVkIHx8IGRyb3BzID09PSBudWxsKSByZXR1cm4gZmFsc2U7XG5cbiAgICByZXR1cm4gZHJvcHMuaW5kZXhPZihrZXkpICE9PSAtMTtcbn1cblxuLy8gVE9ETzogYWZ0ZXIgMSBtb3ZlIG1hZGUgb25seSAxIHBvY2tldCB1cGRhdGUgbmVlZGVkIGF0IG9uY2UsIG5vIG5lZWQgdG8gdXBkYXRlIGJvdGhcbmV4cG9ydCBmdW5jdGlvbiB1cGRhdGVQb2NrZXRzKGN0cmw6IFJvdW5kQ29udHJvbGxlciwgdnBvY2tldDAsIHZwb2NrZXQxKTogdm9pZCB7XG4gICAgLy8gdXBkYXRlIHBvY2tldHMgZnJvbSBmZW5cbiAgICBpZiAobmVlZFBvY2tldHMoY3RybC52YXJpYW50KSkge1xuICAgICAgICBjb25zdCBwYXJ0cyA9IGN0cmwuZnVsbGZlbi5zcGxpdChcIiBcIik7XG4gICAgICAgIGNvbnN0IGZlbl9wbGFjZW1lbnQgPSBwYXJ0c1swXTtcbiAgICAgICAgdmFyIHBvY2tldHMgPSBcIlwiO1xuICAgICAgICBjb25zdCBicmFja2V0UG9zID0gZmVuX3BsYWNlbWVudC5pbmRleE9mKFwiW1wiKTtcbiAgICAgICAgaWYgKGJyYWNrZXRQb3MgIT09IC0xKSB7XG4gICAgICAgICAgICBwb2NrZXRzID0gZmVuX3BsYWNlbWVudC5zbGljZShicmFja2V0UG9zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGMgPSBjdHJsLm15Y29sb3JbMF07XG4gICAgICAgIGNvbnN0IG8gPSBjdHJsLm9wcGNvbG9yWzBdO1xuICAgICAgICBjb25zdCByb2xlcyA9IHBvY2tldFJvbGVzKGN0cmwudmFyaWFudCk7XG4gICAgICAgIHZhciBwbyA9IHt9O1xuICAgICAgICB2YXIgcGMgPSB7fTtcbiAgICAgICAgcm9sZXMuZm9yRWFjaChyb2xlID0+IHBjW3JvbGVdID0gbGMocG9ja2V0cywgcm9sZVRvU2FuW3JvbGVdLnRvTG93ZXJDYXNlKCksIGM9PT0oY3RybC52YXJpYW50PT09J3Nob2dpJyA/ICdiJyA6ICd3JykpKTtcbiAgICAgICAgcm9sZXMuZm9yRWFjaChyb2xlID0+IHBvW3JvbGVdID0gbGMocG9ja2V0cywgcm9sZVRvU2FuW3JvbGVdLnRvTG93ZXJDYXNlKCksIG89PT0oY3RybC52YXJpYW50PT09J3Nob2dpJyA/ICdiJyA6ICd3JykpKTtcbiAgICAgICAgaWYgKGN0cmwuZmxpcCkge1xuICAgICAgICAgICAgY3RybC5wb2NrZXRzID0gW3BjLCBwb107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjdHJsLnBvY2tldHMgPSBbcG8sIHBjXTtcbiAgICAgICAgfVxuICAgICAgICBjb25zb2xlLmxvZyhvLGMscG8scGMpXG4gICAgICAgIGN0cmwudnBvY2tldDAgPSBwYXRjaCh2cG9ja2V0MCwgcG9ja2V0VmlldyhjdHJsLCBjdHJsLmZsaXAgPyBjdHJsLm15Y29sb3IgOiBjdHJsLm9wcGNvbG9yLCBcInRvcFwiKSk7XG4gICAgICAgIGN0cmwudnBvY2tldDEgPSBwYXRjaCh2cG9ja2V0MSwgcG9ja2V0VmlldyhjdHJsLCBjdHJsLmZsaXAgPyBjdHJsLm9wcGNvbG9yIDogY3RybC5teWNvbG9yLCBcImJvdHRvbVwiKSk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgaW5pdCB9IGZyb20gJ3NuYWJiZG9tJztcclxuaW1wb3J0IGtsYXNzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnO1xyXG5pbXBvcnQgYXR0cmlidXRlcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2F0dHJpYnV0ZXMnO1xyXG5pbXBvcnQgcHJvcGVydGllcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL3Byb3BzJztcclxuaW1wb3J0IGxpc3RlbmVycyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJztcclxuXHJcbmNvbnN0IHBhdGNoID0gaW5pdChba2xhc3MsIGF0dHJpYnV0ZXMsIHByb3BlcnRpZXMsIGxpc3RlbmVyc10pO1xyXG5cclxuaW1wb3J0IGggZnJvbSAnc25hYmJkb20vaCc7XHJcbmltcG9ydCB7IFZOb2RlIH0gZnJvbSAnc25hYmJkb20vdm5vZGUnO1xyXG5cclxuaW1wb3J0IHsgQ2hlc3Nncm91bmQgfSBmcm9tICdjaGVzc2dyb3VuZHgnO1xyXG5cclxuaW1wb3J0IHsgcmVuZGVyVXNlcm5hbWUgfSBmcm9tICcuL3VzZXInO1xyXG5pbXBvcnQgeyB2YXJpYW50cywgVkFSSUFOVFMgfSBmcm9tICcuL2NoZXNzJztcclxuaW1wb3J0IHsgcmVuZGVyVGltZWFnbyB9IGZyb20gJy4vY2xvY2snO1xyXG5pbXBvcnQgeyBjaGFuZ2VDU1MgfSBmcm9tICcuL3NldHRpbmdzJztcclxuXHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVzdWx0KHN0YXR1cywgcmVzdWx0KSB7XHJcbiAgICB2YXIgdGV4dCA9ICcnO1xyXG4gICAgY29uc29sZS5sb2coXCJyZXN1bHQoKVwiLCBzdGF0dXMsIHJlc3VsdCk7XHJcbiAgICBzd2l0Y2ggKHN0YXR1cykge1xyXG4gICAgY2FzZSAtMjpcclxuICAgIGNhc2UgLTE6XHJcbiAgICAgICAgdGV4dCA9ICdQbGF5aW5nIHJpZ2h0IG5vdyc7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIDA6XHJcbiAgICAgICAgdGV4dCA9ICdHYW1lIGFib3J0ZWQnO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAxOlxyXG4gICAgICAgIHRleHQgPSAnQ2hlY2ttYXRlJztcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgMjpcclxuICAgICAgICB0ZXh0ID0gKChyZXN1bHQgPT09ICcxLTAnKSA/ICdCbGFjaycgOiAnV2hpdGUnKSArICcgcmVzaWduZWQnO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAzOlxyXG4gICAgICAgIHRleHQgPSAnU3RhbGVtYXRlJztcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgNDpcclxuICAgICAgICB0ZXh0ID0gJ1RpbWUgb3V0JztcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgNTpcclxuICAgICAgICB0ZXh0ID0gJ0RyYXcnO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSA2OlxyXG4gICAgICAgIHRleHQgPSAnVGltZSBvdXQnO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSA3OlxyXG4gICAgICAgIHRleHQgPSAoKHJlc3VsdCA9PT0gJzEtMCcpID8gJ0JsYWNrJyA6ICdXaGl0ZScpICsgJyBhYmFuZG9uZWQgdGhlIGdhbWUnO1xyXG4gICAgICAgIGJyZWFrXHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICAgIHRleHQgPSAnKic7XHJcbiAgICAgICAgYnJlYWtcclxuICAgIH1cclxuICAgIHJldHVybiAoc3RhdHVzIDw9IDApID8gdGV4dCA6IHRleHQgKyAnLCAnICsgcmVzdWx0O1xyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gcmVuZGVyR2FtZXMobW9kZWwsIGdhbWVzKSB7XHJcbi8vICAgICAgICAgICAgICAgIGgoJ2ZuJywgcGxheWVyW1wiZmlyc3RfbmFtZVwiXSksXHJcbi8vICAgICAgICAgICAgICAgIGgoJ2xuJywgcGxheWVyW1wibGFzdF9uYW1lXCJdKSxcclxuLy8gICAgICAgICAgICAgICAgaCgnY291bnRyeScsIHBsYXllcltcImNvdW50cnlcIl0pLFxyXG4gICAgdmFyIHJvd3MgPSBnYW1lcy5tYXAoKGdhbWUpID0+IGgoXHJcbiAgICAgICAgJ3RyJyxcclxuICAgICAgICB7IG9uOiB7IGNsaWNrOiAoKSA9PiB7IHdpbmRvdy5sb2NhdGlvbi5hc3NpZ24obW9kZWxbXCJob21lXCJdICsgJy8nICsgZ2FtZVtcIl9pZFwiXSk7IH0gfSxcclxuICAgICAgICB9LCBbXHJcbiAgICAgICAgaCgndGQuYm9hcmQnLCBbXHJcbiAgICAgICAgICAgIGgoJ3NlbGVjdGlvbi4nICsgVkFSSUFOVFNbZ2FtZVtcInZcIl1dLmJvYXJkICsgJy4nICsgVkFSSUFOVFNbZ2FtZVtcInZcIl1dLnBpZWNlcywgW1xyXG4gICAgICAgICAgICAgICAgaCgnZGl2LmNnLXdyYXAuJyArIFZBUklBTlRTW2dhbWVbXCJ2XCJdXS5jZyArICcubWluaScsIHsgaG9vazoge1xyXG4gICAgICAgICAgICAgICAgICAgIGluc2VydDogKHZub2RlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIENoZXNzZ3JvdW5kKHZub2RlLmVsbSBhcyBIVE1MRWxlbWVudCwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29vcmRpbmF0ZXM6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlld09ubHk6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmZW46IGdhbWVbXCJmXCJdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2VvbWV0cnk6IFZBUklBTlRTW2dhbWVbXCJ2XCJdXS5nZW9tXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH19KSxcclxuICAgICAgICAgICAgXSksXHJcbiAgICAgICAgXSksXHJcbiAgICAgICAgaCgndGQuZ2FtZXMtaW5mbycsIFtcclxuICAgICAgICAgICAgaCgnZGl2LmluZm8wJywge2F0dHJzOiB7XCJkYXRhLWljb25cIjogVkFSSUFOVFNbZ2FtZVtcInZcIl1dLmljb259LCBjbGFzczoge1wiaWNvblwiOiB0cnVlfX0sIFtcclxuICAgICAgICAgICAgICAgIGgoJ2Rpdi5pbmZvMScsIHthdHRyczoge1wiZGF0YS1pY29uXCI6IChnYW1lW1wielwiXSA9PT0gMSkgPyBcIlZcIiA6IFwiXCJ9LCBjbGFzczoge1wiaWNvblwiOiB0cnVlfX0pLFxyXG4gICAgICAgICAgICAgICAgaCgnZGl2LmluZm8yJywgW1xyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2Rpdi50YycsIGdhbWVbXCJiXCJdICsgXCIrXCIgKyBnYW1lW1wiaVwiXSArIFwiIOKAoiBDYXN1YWwg4oCiIFwiICsgZ2FtZVtcInZcIl0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2luZm8tZGF0ZScsIHthdHRyczoge3RpbWVzdGFtcDogZ2FtZVtcImRcIl19fSksXHJcbiAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgIGgoJ2RpdicsIFtcclxuICAgICAgICAgICAgICAgIGgoJ3BsYXllcicsIFtcclxuICAgICAgICAgICAgICAgICAgICBoKCdhLnVzZXItbGluaycsIHthdHRyczoge2hyZWY6ICcvQC8nICsgZ2FtZVtcInVzXCJdWzBdfX0sIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaCgncGxheWVyLXRpdGxlJywgXCIgXCIgKyBnYW1lW1wid3RcIl0gKyBcIiBcIiksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGdhbWVbXCJ1c1wiXVswXSArICgoZ2FtZVtcInd0XCJdID09PSAnQk9UJyAmJiBnYW1lWyd4J10gPiAwKSA/ICcgbGV2ZWwgJyArIGdhbWVbJ3gnXTogJycpLFxyXG4gICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICBoKCd2cycsICcgLSAnKSxcclxuICAgICAgICAgICAgICAgIGgoJ3BsYXllcicsIFtcclxuICAgICAgICAgICAgICAgICAgICBoKCdhLnVzZXItbGluaycsIHthdHRyczoge2hyZWY6ICcvQC8nICsgZ2FtZVtcInVzXCJdWzFdfX0sIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaCgncGxheWVyLXRpdGxlJywgXCIgXCIgKyBnYW1lW1wiYnRcIl0gKyBcIiBcIiksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGdhbWVbXCJ1c1wiXVsxXSArICgoZ2FtZVtcImJ0XCJdID09PSAnQk9UJyAmJiBnYW1lWyd4J10gPiAwKSA/ICcgbGV2ZWwgJyArIGdhbWVbJ3gnXTogJycpLFxyXG4gICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICBoKCdkaXYuaW5mby1yZXN1bHQnLCB7XHJcbiAgICAgICAgICAgICAgICBjbGFzczoge1xyXG4gICAgICAgICAgICAgICAgICAgIFwid2luXCI6IChnYW1lW1wiclwiXSA9PT0gJzEtMCcgJiYgZ2FtZVtcInVzXCJdWzBdID09PSBtb2RlbFtcInByb2ZpbGVpZFwiXSkgfHwgKGdhbWVbXCJyXCJdID09PSAnMC0xJyAmJiBnYW1lW1widXNcIl1bMV0gPT09IG1vZGVsW1wicHJvZmlsZWlkXCJdKSxcclxuICAgICAgICAgICAgICAgICAgICBcImxvc2VcIjogKGdhbWVbXCJyXCJdID09PSAnMC0xJyAmJiBnYW1lW1widXNcIl1bMF0gPT09IG1vZGVsW1wicHJvZmlsZWlkXCJdKSB8fCAoZ2FtZVtcInJcIl0gPT09ICcxLTAnICYmIGdhbWVbXCJ1c1wiXVsxXSA9PT0gbW9kZWxbXCJwcm9maWxlaWRcIl0pLFxyXG4gICAgICAgICAgICAgICAgfX0sIHJlc3VsdChnYW1lW1wic1wiXSwgZ2FtZVtcInJcIl0pXHJcbiAgICAgICAgICAgICksXHJcbiAgICAgICAgXSlcclxuICAgICAgICBdKVxyXG4gICAgICAgICk7XHJcbiAgICByZXR1cm4gW2goJ3Rib2R5Jywgcm93cyldO1xyXG59XHJcblxyXG5mdW5jdGlvbiBsb2FkR2FtZXMobW9kZWwsIHBhZ2UpIHtcclxuICAgIHZhciB4bWxodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICB2YXIgdXJsID0gbW9kZWxbXCJob21lXCJdICsgXCIvYXBpL1wiICsgbW9kZWxbXCJwcm9maWxlaWRcIl0gKyBcIi9nYW1lcz9wPVwiO1xyXG5cclxuICAgIHhtbGh0dHAub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PSA0ICYmIHRoaXMuc3RhdHVzID09IDIwMCkge1xyXG4gICAgICAgICAgICB2YXIgbXlBcnIgPSBKU09OLnBhcnNlKHRoaXMucmVzcG9uc2VUZXh0KTtcclxuXHJcbiAgICAgICAgICAgIC8vIElmIGVtcHR5IEpTT04sIGV4aXQgdGhlIGZ1bmN0aW9uXHJcbiAgICAgICAgICAgIGlmICghbXlBcnIubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbXlGdW5jdGlvbihteUFycik7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHhtbGh0dHAub3BlbihcIkdFVFwiLCB1cmwgKyBwYWdlLCB0cnVlKTtcclxuICAgIHhtbGh0dHAuc2VuZCgpO1xyXG5cclxuICAgIGZ1bmN0aW9uIG15RnVuY3Rpb24oYXJyKSB7XHJcbiAgICAgICAgY29uc3Qgb2xkVk5vZGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2FtZXMnKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhhcnIpO1xyXG4gICAgICAgIGlmIChvbGRWTm9kZSBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcclxuICAgICAgICAgICAgcGF0Y2gob2xkVk5vZGUgYXMgSFRNTEVsZW1lbnQsIGgoJ3RhYmxlI2dhbWVzJywgcmVuZGVyR2FtZXMobW9kZWwsIGFycikpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVuZGVyVGltZWFnbygpO1xyXG4gICAgfVxyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gb2JzZXJ2ZVNlbnRpbmVsKHZub2RlOiBWTm9kZSwgbW9kZWwpIHtcclxuICAgIGNvbnN0IHNlbnRpbmVsID0gdm5vZGUuZWxtIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgdmFyIHBhZ2UgPSAwO1xyXG5cclxuICAgIHZhciBpbnRlcnNlY3Rpb25PYnNlcnZlciA9IG5ldyBJbnRlcnNlY3Rpb25PYnNlcnZlcihlbnRyaWVzID0+IHtcclxuICAgICAgICAvLyBJZiBpbnRlcnNlY3Rpb25SYXRpbyBpcyAwLCB0aGUgc2VudGluZWwgaXMgb3V0IG9mIHZpZXdcclxuICAgICAgICAvLyBhbmQgd2UgZG9uJ3QgbmVlZCB0byBkbyBhbnl0aGluZy4gRXhpdCB0aGUgZnVuY3Rpb25cclxuICAgICAgICBpZiAoZW50cmllc1swXS5pbnRlcnNlY3Rpb25SYXRpbyA8PSAwKSByZXR1cm47XHJcblxyXG4gICAgICAgIGxvYWRHYW1lcyhtb2RlbCwgcGFnZSk7XHJcbiAgICAgICAgcGFnZSArPSAxO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaW50ZXJzZWN0aW9uT2JzZXJ2ZXIub2JzZXJ2ZShzZW50aW5lbCEpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcHJvZmlsZVZpZXcobW9kZWwpOiBWTm9kZVtdIHtcclxuICAgIHJlbmRlclVzZXJuYW1lKG1vZGVsW1wiaG9tZVwiXSwgbW9kZWxbXCJ1c2VybmFtZVwiXSk7XHJcbiAgICBjb25zb2xlLmxvZyhtb2RlbCk7XHJcblxyXG4gICAgY29uc3QgQ1NTaW5kZXhlcyA9IHZhcmlhbnRzLm1hcCgodmFyaWFudCkgPT4gbG9jYWxTdG9yYWdlW3ZhcmlhbnQgKyBcIl9waWVjZXNcIl0gPT09IHVuZGVmaW5lZCA/IDAgOiBOdW1iZXIobG9jYWxTdG9yYWdlW3ZhcmlhbnQgKyBcIl9waWVjZXNcIl0pKTtcclxuICAgIE9iamVjdC5rZXlzKFZBUklBTlRTKS5mb3JFYWNoKChrZXkpID0+IHtcclxuICAgICAgICBjb25zdCB2YXJpYW50ID0gVkFSSUFOVFNba2V5XTtcclxuICAgICAgICBpZiAodmFyaWFudC5jc3MubGVuZ3RoID4gMSkge1xyXG4gICAgICAgICAgICB2YXIgaWR4ID0gQ1NTaW5kZXhlc1t2YXJpYW50cy5pbmRleE9mKGtleSldO1xyXG4gICAgICAgICAgICBpZHggPSBNYXRoLm1pbihpZHgsIHZhcmlhbnQuY3NzLmxlbmd0aCAtIDEpO1xyXG4gICAgICAgICAgICBjaGFuZ2VDU1MoJy9zdGF0aWMvJyArIHZhcmlhbnQuY3NzW2lkeF0gKyAnLmNzcycpO1xyXG4gICAgICAgIH07XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gW2goJ2FzaWRlLnNpZGViYXItZmlyc3QnKSxcclxuICAgICAgICAgICAgaCgnbWFpbi5tYWluJywgW1xyXG4gICAgICAgICAgICAgICAgaCgncGxheWVyLWhlYWQnLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgbW9kZWxbXCJwcm9maWxlaWRcIl0sXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnYS5pLWRsJywge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyczoge2hyZWY6ICcvZ2FtZXMvZXhwb3J0LycgKyBtb2RlbFtcInByb2ZpbGVpZFwiXSwgXCJkb3dubG9hZFwiOiBtb2RlbFtcInByb2ZpbGVpZFwiXSArICcucGduJ30sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzOiB7XCJpY29uXCI6IHRydWUsIFwiaWNvbi1kb3dubG9hZFwiOiB0cnVlfX0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2EuaS10dicsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXR0cnM6IHtocmVmOiAnL0AvJyArIG1vZGVsW1wicHJvZmlsZWlkXCJdICsgJy90did9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tdHZcIjogdHJ1ZX19KSxcclxuICAgICAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgIGgoJ3RhYmxlI2dhbWVzJyksXHJcbiAgICAgICAgICAgICAgICBoKCdkaXYjc2VudGluZWwnLCB7IGhvb2s6IHsgaW5zZXJ0OiAodm5vZGUpID0+IG9ic2VydmVTZW50aW5lbCh2bm9kZSwgbW9kZWwpIH19KVxyXG4gICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgaCgnYXNpZGUuc2lkZWJhci1zZWNvbmQnKSxcclxuICAgICAgICBdO1xyXG59XHJcbiIsImltcG9ydCB7IGgsIGluaXQgfSBmcm9tIFwic25hYmJkb21cIjtcclxuaW1wb3J0IGtsYXNzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnO1xyXG5pbXBvcnQgYXR0cmlidXRlcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2F0dHJpYnV0ZXMnO1xyXG5pbXBvcnQgbGlzdGVuZXJzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMnO1xyXG5pbXBvcnQgdG9WTm9kZSBmcm9tICdzbmFiYmRvbS90b3Zub2RlJztcclxuXHJcbmltcG9ydCB7IGtleTJwb3MgfSBmcm9tICdjaGVzc2dyb3VuZHgvdXRpbCc7XHJcblxyXG5pbXBvcnQgeyBpc1Byb21vdGlvbiwgbWFuZGF0b3J5UHJvbW90aW9uLCBwcm9tb3Rpb25Sb2xlcywgcm9sZVRvU2FuIH0gZnJvbSAnLi9jaGVzcyc7XHJcblxyXG5jb25zdCBwYXRjaCA9IGluaXQoW2tsYXNzLCBhdHRyaWJ1dGVzLCBsaXN0ZW5lcnNdKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKGN0cmwpIHtcclxuXHJcbiAgICBsZXQgcHJvbW90aW5nOiBhbnkgPSBmYWxzZTtcclxuICAgIGxldCByb2xlczogc3RyaW5nW10gPSBbXTtcclxuXHJcbiAgICBmdW5jdGlvbiBzdGFydChvcmlnLCBkZXN0LCBtZXRhKSB7XHJcbiAgICAgICAgY29uc3QgZ3JvdW5kID0gY3RybC5nZXRHcm91bmQoKTtcclxuICAgICAgICBpZiAoaXNQcm9tb3Rpb24oY3RybC52YXJpYW50LCBncm91bmQuc3RhdGUucGllY2VzW2Rlc3RdLCBvcmlnLCBkZXN0LCBtZXRhLCBjdHJsLnByb21vdGlvbnMpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbG9yID0gY3RybC5teWNvbG9yO1xyXG4gICAgICAgICAgICBjb25zdCBvcmllbnRhdGlvbiA9IGdyb3VuZC5zdGF0ZS5vcmllbnRhdGlvbjtcclxuICAgICAgICAgICAgY29uc3QgbW92aW5nUm9sZSA9IGdyb3VuZC5zdGF0ZS5waWVjZXNbZGVzdF0ucm9sZTtcclxuICAgICAgICAgICAgcm9sZXMgPSBwcm9tb3Rpb25Sb2xlcyhjdHJsLnZhcmlhbnQsIG1vdmluZ1JvbGUsIG9yaWcsIGRlc3QsIGN0cmwucHJvbW90aW9ucyk7XHJcblxyXG4gICAgICAgICAgICBzd2l0Y2ggKGN0cmwudmFyaWFudCkge1xyXG4gICAgICAgICAgICAvLyBUT0RPOiBpbiBncmFuZCBjaGVzcyB1c2UgbWFuZGF0b3J5UHJvbW90aW9uIHdoZW4gcHJvbW90aW9uIGhhcHBlbnMgb24gYmFjayByYW5rXHJcbiAgICAgICAgICAgIGNhc2UgXCJzaG9naVwiOlxyXG4gICAgICAgICAgICAgICAgaWYgKG1hbmRhdG9yeVByb21vdGlvbihtb3ZpbmdSb2xlLCBkZXN0LCBjb2xvcikpIHtcclxuICAgICAgICAgICAgICAgICAgICBwcm9tb3RlKGdyb3VuZCwgZGVzdCwgJ3AnICsgZ3JvdW5kLnN0YXRlLnBpZWNlc1tkZXN0XS5yb2xlKTtcclxuICAgICAgICAgICAgICAgICAgICBjdHJsLnNlbmRNb3ZlKG9yaWcsIGRlc3QsICcrJyk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGRyYXdfcHJvbW8oZGVzdCwgY29sb3IsIG9yaWVudGF0aW9uKTtcclxuICAgICAgICAgICAgICAgICAgICBwcm9tb3RpbmcgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9yaWc6IG9yaWcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc3Q6IGRlc3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrOiBjdHJsLnNlbmRNb3ZlLFxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgJ21ha3J1ayc6XHJcbiAgICAgICAgICAgICAgICBwcm9tb3RlKGdyb3VuZCwgZGVzdCwgJ21ldCcpO1xyXG4gICAgICAgICAgICAgICAgY3RybC5zZW5kTW92ZShvcmlnLCBkZXN0LCAnbScpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NpdHR1eWluJzpcclxuICAgICAgICAgICAgICAgIHByb21vdGUoZ3JvdW5kLCBkZXN0LCAnZmVyeicpO1xyXG4gICAgICAgICAgICAgICAgY3RybC5zZW5kTW92ZShvcmlnLCBkZXN0LCAnZicpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAvLyBpbiBncmFuZCBjaGVzcyBwcm9tb3Rpb24gb24gYmFjayByYW5rIGlzIG1hbmRhdG9yeVxyXG4gICAgICAgICAgICAgICAgLy8gYW5kIHNvbWV0aW1lcyBvbmx5IG9uZSBjaG9pY2UgZXhpc3RzXHJcbiAgICAgICAgICAgICAgICBpZiAocm9sZXMubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm9sZSA9IHJvbGVzWzBdO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHByb21vID0gcm9sZVRvU2FuW3JvbGVdLnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJvbW90ZShncm91bmQsIGRlc3QsIHJvbGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGN0cmwuc2VuZE1vdmUob3JpZywgZGVzdCwgcHJvbW8pO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBkcmF3X3Byb21vKGRlc3QsIGNvbG9yLCBvcmllbnRhdGlvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJvbW90aW5nID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBvcmlnOiBvcmlnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXN0OiBkZXN0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjazogY3RybC5zZW5kTW92ZSxcclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcblxyXG4gICAgZnVuY3Rpb24gcHJvbW90ZShnLCBrZXksIHJvbGUpIHtcclxuICAgICAgICB2YXIgcGllY2VzID0ge307XHJcbiAgICAgICAgdmFyIHBpZWNlID0gZy5zdGF0ZS5waWVjZXNba2V5XTtcclxuICAgICAgICBpZiAoZy5zdGF0ZS5waWVjZXNba2V5XS5yb2xlID09PSByb2xlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBwaWVjZXNba2V5XSA9IHtcclxuICAgICAgICAgICAgICAgIGNvbG9yOiBwaWVjZS5jb2xvcixcclxuICAgICAgICAgICAgICAgIHJvbGU6IHJvbGUsXHJcbiAgICAgICAgICAgICAgICBwcm9tb3RlZDogdHJ1ZVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBnLnNldFBpZWNlcyhwaWVjZXMpO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZHJhd19wcm9tbyhkZXN0LCBjb2xvciwgb3JpZW50YXRpb24pIHtcclxuICAgICAgICB2YXIgY29udGFpbmVyID0gdG9WTm9kZShkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdleHRlbnNpb24nKSBhcyBOb2RlKTtcclxuICAgICAgICBwYXRjaChjb250YWluZXIsIHJlbmRlclByb21vdGlvbihkZXN0LCBjb2xvciwgb3JpZW50YXRpb24pKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBkcmF3X25vX3Byb21vKCkge1xyXG4gICAgICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZXh0ZW5zaW9uX2Nob2ljZScpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgIHBhdGNoKGNvbnRhaW5lciwgaCgnZXh0ZW5zaW9uJykpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGZpbmlzaChyb2xlKSB7XHJcbiAgICAgICAgaWYgKHByb21vdGluZykge1xyXG4gICAgICAgICAgICBkcmF3X25vX3Byb21vKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHByb21vdGVkID0gcHJvbW90ZShjdHJsLmdldEdyb3VuZCgpLCBwcm9tb3RpbmcuZGVzdCwgcm9sZSk7XHJcbiAgICAgICAgICAgIGxldCBwcm9tbztcclxuXHJcbiAgICAgICAgICAgIHN3aXRjaCAoY3RybC52YXJpYW50KSB7XHJcbiAgICAgICAgICAgIGNhc2UgXCJzaG9naVwiOlxyXG4gICAgICAgICAgICAgICAgcHJvbW8gPSBwcm9tb3RlZCA/IFwiK1wiIDogXCJcIjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwiZ3JhbmRob3VzZVwiOlxyXG4gICAgICAgICAgICBjYXNlIFwiZ3JhbmRcIjpcclxuICAgICAgICAgICAgICAgIHByb21vID0gcHJvbW90ZWQgPyByb2xlVG9TYW5bcm9sZV0udG9Mb3dlckNhc2UoKSA6IFwiXCI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHByb21vID0gcm9sZVRvU2FuW3JvbGVdLnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGlmIChwcm9tb3RpbmcuY2FsbGJhY2spIHByb21vdGluZy5jYWxsYmFjayhwcm9tb3Rpbmcub3JpZywgcHJvbW90aW5nLmRlc3QsIHByb21vKTtcclxuICAgICAgICAgICAgcHJvbW90aW5nID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBmdW5jdGlvbiBjYW5jZWwoKSB7XHJcbiAgICAgICAgZHJhd19ub19wcm9tbygpO1xyXG4gICAgICAgIGN0cmwuZ29QbHkoY3RybC5wbHkpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBiaW5kKGV2ZW50TmFtZTogc3RyaW5nLCBmOiAoZTogRXZlbnQpID0+IHZvaWQsIHJlZHJhdykge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGluc2VydCh2bm9kZSkge1xyXG4gICAgICAgICAgICAgICAgdm5vZGUuZWxtLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBlID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXMgPSBmKGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWRyYXcpIHJlZHJhdygpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXM7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcmVuZGVyUHJvbW90aW9uKGRlc3QsIGNvbG9yLCBvcmllbnRhdGlvbikge1xyXG4gICAgICAgIGNvbnN0IGRpbSA9IGN0cmwuZ2V0R3JvdW5kKCkuc3RhdGUuZGltZW5zaW9uc1xyXG4gICAgICAgIGNvbnN0IGZpcnN0UmFua0lzMCA9IGRpbS5oZWlnaHQgPT09IDEwO1xyXG4gICAgICAgIHZhciBsZWZ0ID0gKGRpbS53aWR0aCAtIGtleTJwb3MoZGVzdCwgZmlyc3RSYW5rSXMwKVswXSkgKiAoMTAwIC8gZGltLndpZHRoKTtcclxuICAgICAgICBpZiAob3JpZW50YXRpb24gPT09IFwid2hpdGVcIikgbGVmdCA9ICgxMDAgLyBkaW0ud2lkdGgpICogKGRpbS53aWR0aCAtIDEpIC0gbGVmdDtcclxuICAgICAgICB2YXIgdmVydGljYWwgPSBjb2xvciA9PT0gb3JpZW50YXRpb24gPyBcInRvcFwiIDogXCJib3R0b21cIjtcclxuICAgICAgICByZXR1cm4gaChcclxuICAgICAgICAgICAgXCJkaXYjZXh0ZW5zaW9uX2Nob2ljZS5cIiArIHZlcnRpY2FsLFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBob29rOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5zZXJ0OiB2bm9kZSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGVsID0gdm5vZGUuZWxtIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gY2FuY2VsKCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbC5hZGRFdmVudExpc3RlbmVyKFwiY29udGV4dG1lbnVcIiwgZSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcm9sZXMubWFwKChzZXJ2ZXJSb2xlLCBpKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YXIgdG9wID0gKGNvbG9yID09PSBvcmllbnRhdGlvbiA/IGkgOiBkaW0uaGVpZ2h0IC0xIC0gaSkgKiAoMTAwIC8gZGltLmhlaWdodCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaChcclxuICAgICAgICAgICAgICAgICAgICBcInNxdWFyZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXR0cnM6IHsgc3R5bGU6IFwidG9wOiBcIiArIHRvcCArIFwiJTtsZWZ0OiBcIiArIGxlZnQgKyBcIiVcIiB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBob29rOiBiaW5kKFwiY2xpY2tcIiwgZSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmluaXNoKHNlcnZlclJvbGUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBmYWxzZSlcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIFtoKFwicGllY2UuXCIgKyBzZXJ2ZXJSb2xlICsgXCIuXCIgKyBjb2xvcildXHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBzdGFydCxcclxuICAgIH07XHJcbn1cclxuIiwiLy8gaHR0cDovL2pzZmlkZGxlLm5ldC9NaXNzb3VsYUxvcmVuem8vZ2ZuNm9iM2ovXG4vLyBodHRwczovL2dpdGh1Yi5jb20vb3JuaWNhci9saWxhL2Jsb2IvbWFzdGVyL3VpL2NvbW1vbi9zcmMvcmVzaXplLnRzXG5cbmltcG9ydCAqIGFzIGNnIGZyb20gJ2NoZXNzZ3JvdW5keC90eXBlcyc7XG5cbmV4cG9ydCB0eXBlIE1vdWNoRXZlbnQgPSBNb3VzZUV2ZW50ICYgVG91Y2hFdmVudDtcblxuLy9leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByZXNpemVIYW5kbGUoZWxzOiBjZy5FbGVtZW50cywgcHJlZjogbnVtYmVyLCBwbHk6IG51bWJlcikge1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcmVzaXplSGFuZGxlKGVsczogY2cuRWxlbWVudHMpIHtcblxuLy8gIGlmICghcHJlZikgcmV0dXJuO1xuICBpZiAodHJ1ZSkgcmV0dXJuO1xuXG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2ctcmVzaXplJyk7XG4gIGVscy5jb250YWluZXIuYXBwZW5kQ2hpbGQoZWwpO1xuXG4gIGNvbnN0IG1vdXNlbW92ZUV2ZW50ID0gJ21vdXNlbW92ZSc7XG4gIGNvbnN0IG1vdXNldXBFdmVudCA9ICdtb3VzZXVwJztcblxuICBlbC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoc3RhcnQ6IE1vdWNoRXZlbnQpID0+IHtcblxuICAgIHN0YXJ0LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICBjb25zdCBzdGFydFBvcyA9IGV2ZW50UG9zaXRpb24oc3RhcnQpITtcbiAgICBjb25zdCBpbml0aWFsWm9vbSA9IDEwMDsgIC8vcGFyc2VJbnQoZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5KS5nZXRQcm9wZXJ0eVZhbHVlKCctLXpvb20nKSk7XG4gICAgbGV0IHpvb20gPSBpbml0aWFsWm9vbTtcbi8qXG4gICAgY29uc3Qgc2F2ZVpvb20gPSB3aW5kb3cubGljaGVzcy5kZWJvdW5jZSgoKSA9PiB7XG4gICAgICAkLmFqYXgoeyBtZXRob2Q6ICdwb3N0JywgdXJsOiAnL3ByZWYvem9vbT92PScgKyAoMTAwICsgem9vbSkgfSk7XG4gICAgfSwgNzAwKTtcbiovXG5cbiAgICBjb25zdCBzZXRab29tID0gKHpvb206IG51bWJlcikgPT4ge1xuICAgICAgICBjb25zdCBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jZy13cmFwJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICAgIGlmIChlbCkge1xuLy8gICAgICAgICAgICBjb25zdCBiYXNlV2lkdGggPSBkaW1lbnNpb25zW1ZBUklBTlRTW3RoaXMudmFyaWFudF0uZ2VvbV0ud2lkdGggKiAodGhpcy52YXJpYW50ID09PSBcInNob2dpXCIgPyA1MiA6IDY0KTtcbi8vICAgICAgICAgICAgY29uc3QgYmFzZUhlaWdodCA9IGRpbWVuc2lvbnNbVkFSSUFOVFNbdGhpcy52YXJpYW50XS5nZW9tXS5oZWlnaHQgKiAodGhpcy52YXJpYW50ID09PSBcInNob2dpXCIgPyA2MCA6IDY0KTtcbiAgICAgICAgICAgIGNvbnN0IGJhc2VXaWR0aCA9IHBhcnNlSW50KCBkb2N1bWVudC5kZWZhdWx0VmlldyEuZ2V0Q29tcHV0ZWRTdHlsZSggZWwgKS53aWR0aCB8fCAnJywgMTApO1xuICAgICAgICAgICAgY29uc3QgYmFzZUhlaWdodCA9IHBhcnNlSW50KGRvY3VtZW50LmRlZmF1bHRWaWV3IS5nZXRDb21wdXRlZFN0eWxlKCBlbCApLmhlaWdodCB8fCAnJywgMTApO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYmFzZVdpZHRoLCBiYXNlSGVpZ2h0LCB6b29tKTtcbiAgICAgICAgICAgIGNvbnN0IHB4dyA9IGAke3pvb20gLyAxMDAgKiBiYXNlV2lkdGh9cHhgO1xuICAgICAgICAgICAgY29uc3QgcHhoID0gYCR7em9vbSAvIDEwMCAqIGJhc2VIZWlnaHR9cHhgO1xuICAgICAgICAgICAgZWwuc3R5bGUud2lkdGggPSBweHc7XG4gICAgICAgICAgICBlbC5zdHlsZS5oZWlnaHQgPSBweGg7XG4gICAgICAgICAgICBjb25zdCBldiA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdFdmVudCcpO1xuICAgICAgICAgICAgZXYuaW5pdEV2ZW50KCdjaGVzc2dyb3VuZC5yZXNpemUnLCBmYWxzZSwgZmFsc2UpO1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5kaXNwYXRjaEV2ZW50KGV2KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHJlc2l6ZSA9IChtb3ZlOiBNb3VjaEV2ZW50KSA9PiB7XG5cbiAgICAgIGNvbnN0IHBvcyA9IGV2ZW50UG9zaXRpb24obW92ZSkhO1xuICAgICAgY29uc3QgZGVsdGEgPSBwb3NbMF0gLSBzdGFydFBvc1swXSArIHBvc1sxXSAtIHN0YXJ0UG9zWzFdO1xuXG4gICAgICB6b29tID0gTWF0aC5yb3VuZChNYXRoLm1pbigxNTAsIE1hdGgubWF4KDAsIGluaXRpYWxab29tICsgZGVsdGEgLyAxMCkpKTtcblxuLy8gICAgICBkb2N1bWVudC5ib2R5LnNldEF0dHJpYnV0ZSgnc3R5bGUnLCAnLS16b29tOicgKyB6b29tKTtcbi8vICAgICAgd2luZG93LmxpY2hlc3MuZGlzcGF0Y2hFdmVudCh3aW5kb3csICdyZXNpemUnKTtcbiAgICAgIHNldFpvb20oem9vbSk7XG4vLyAgICAgIHNhdmVab29tKCk7XG4gICAgfTtcblxuICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZCgncmVzaXppbmcnKTtcblxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIobW91c2Vtb3ZlRXZlbnQsIHJlc2l6ZSk7XG5cbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKG1vdXNldXBFdmVudCwgKCkgPT4ge1xuICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihtb3VzZW1vdmVFdmVudCwgcmVzaXplKTtcbiAgICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZSgncmVzaXppbmcnKTtcbiAgICB9LCB7IG9uY2U6IHRydWUgfSk7XG4gIH0pO1xuLypcbiAgaWYgKHByZWYgPT0gMSkge1xuICAgIGNvbnN0IHRvZ2dsZSA9IChwbHk6IG51bWJlcikgPT4gZWwuY2xhc3NMaXN0LnRvZ2dsZSgnbm9uZScsIHBseSA+PSAyKTtcbiAgICB0b2dnbGUocGx5KTtcbiAgICB3aW5kb3cubGljaGVzcy5wdWJzdWIub24oJ3BseScsIHRvZ2dsZSk7XG4gIH1cblxuICBhZGROYWcoZWwpO1xuKi9cbn1cblxuZnVuY3Rpb24gZXZlbnRQb3NpdGlvbihlOiBNb3VjaEV2ZW50KTogW251bWJlciwgbnVtYmVyXSB8IHVuZGVmaW5lZCB7XG4gIGlmIChlLmNsaWVudFggfHwgZS5jbGllbnRYID09PSAwKSByZXR1cm4gW2UuY2xpZW50WCwgZS5jbGllbnRZXTtcbiAgaWYgKGUudG91Y2hlcyAmJiBlLnRhcmdldFRvdWNoZXNbMF0pIHJldHVybiBbZS50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFgsIGUudGFyZ2V0VG91Y2hlc1swXS5jbGllbnRZXTtcbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cbi8qXG5mdW5jdGlvbiBhZGROYWcoZWw6IEhUTUxFbGVtZW50KSB7XG5cbiAgY29uc3Qgc3RvcmFnZSA9IHdpbmRvdy5saWNoZXNzLnN0b3JhZ2UubWFrZUJvb2xlYW4oJ3Jlc2l6ZS1uYWcnKTtcbiAgaWYgKHN0b3JhZ2UuZ2V0KCkpIHJldHVybjtcblxuICB3aW5kb3cubGljaGVzcy5sb2FkQ3NzUGF0aCgnbmFnLWNpcmNsZScpO1xuICBlbC50aXRsZSA9ICdEcmFnIHRvIHJlc2l6ZSc7XG4gIGVsLmlubmVySFRNTCA9ICc8ZGl2IGNsYXNzPVwibmFnLWNpcmNsZVwiPjwvZGl2Pic7XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIod2luZG93LmxpY2hlc3MubW91c2Vkb3duRXZlbnQsICgpID0+IHtcbiAgICBzdG9yYWdlLnNldCh0cnVlKTtcbiAgICBlbC5pbm5lckhUTUwgPSAnJztcbiAgfSwgeyBvbmNlOiB0cnVlIH0pO1xuXG4gIHNldFRpbWVvdXQoKCkgPT4gc3RvcmFnZS5zZXQodHJ1ZSksIDE1MDAwKTtcbn1cbiovIiwiaW1wb3J0IHsgaCB9IGZyb20gXCJzbmFiYmRvbVwiO1xyXG5pbXBvcnQgeyBWTm9kZSB9IGZyb20gJ3NuYWJiZG9tL3Zub2RlJztcclxuXHJcbmltcG9ydCBSb3VuZENvbnRyb2xsZXIgZnJvbSAnLi9jdHJsJztcclxuaW1wb3J0IHsgVkFSSUFOVFMgfSBmcm9tICcuL2NoZXNzJztcclxuaW1wb3J0IHsgdGltZWFnbywgcmVuZGVyVGltZWFnbyB9IGZyb20gJy4vY2xvY2snO1xyXG5cclxuXHJcbmZ1bmN0aW9uIHJ1bkdyb3VuZCh2bm9kZTogVk5vZGUsIG1vZGVsKSB7XHJcbiAgICBjb25zdCBlbCA9IHZub2RlLmVsbSBhcyBIVE1MRWxlbWVudDtcclxuICAgIGNvbnN0IGN0cmwgPSBuZXcgUm91bmRDb250cm9sbGVyKGVsLCBtb2RlbCk7XHJcbiAgICBjb25zdCBjZyA9IGN0cmwuY2hlc3Nncm91bmQ7XHJcbiAgICB3aW5kb3dbJ2NnJ10gPSBjZztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJvdW5kVmlldyhtb2RlbCk6IFZOb2RlW10ge1xyXG4gICAgY29uc29sZS5sb2coXCJyb3VuZFZpZXcgbW9kZWw9XCIsIG1vZGVsKTtcclxuICAgIGNvbnN0IGRhdGFJY29uID0gVkFSSUFOVFNbbW9kZWxbXCJ2YXJpYW50XCJdXS5pY29uO1xyXG4gICAgcmVuZGVyVGltZWFnbygpO1xyXG4gICAgcmV0dXJuIFtoKCdhc2lkZS5zaWRlYmFyLWZpcnN0JywgW1xyXG4gICAgICAgICAgICAgICAgaCgnZGl2LmdhbWUtaW5mbycsIFtcclxuICAgICAgICAgICAgICAgICAgICBoKCdkaXYuaW5mbzAnLCB7YXR0cnM6IHtcImRhdGEtaWNvblwiOiBkYXRhSWNvbn0sIGNsYXNzOiB7XCJpY29uXCI6IHRydWV9fSwgW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdkaXYuaW5mbzEnLCB7YXR0cnM6IHtcImRhdGEtaWNvblwiOiAobW9kZWxbXCJjaGVzczk2MFwiXSA9PT0gJ1RydWUnKSA/IFwiVlwiIDogXCJcIn0sIGNsYXNzOiB7XCJpY29uXCI6IHRydWV9fSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2Rpdi5pbmZvMicsIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2Rpdi50YycsIG1vZGVsW1wiYmFzZVwiXSArIFwiK1wiICsgbW9kZWxbXCJpbmNcIl0gKyBcIiDigKIgQ2FzdWFsIOKAoiBcIiArIG1vZGVsW1widmFyaWFudFwiXSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBOdW1iZXIobW9kZWxbXCJzdGF0dXNcIl0pID49IDAgPyBoKCdpbmZvLWRhdGUnLCB7YXR0cnM6IHt0aW1lc3RhbXA6IG1vZGVsW1wiZGF0ZVwiXX19LCB0aW1lYWdvKG1vZGVsW1wiZGF0ZVwiXSkpIDogXCJQbGF5aW5nIHJpZ2h0IG5vd1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdkaXYucGxheWVyLWRhdGEnLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2ktc2lkZS5vbmxpbmUnLCB7Y2xhc3M6IHtcImljb25cIjogdHJ1ZSwgXCJpY29uLXdoaXRlXCI6IHRydWV9IH0gKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaCgncGxheWVyJywgW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaCgnYS51c2VyLWxpbmsnLCB7YXR0cnM6IHtocmVmOiAnL0AvJyArIG1vZGVsW1wid3BsYXllclwiXX19LCBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaCgncGxheWVyLXRpdGxlJywgXCIgXCIgKyBtb2RlbFtcInd0aXRsZVwiXSArIFwiIFwiKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbFtcIndwbGF5ZXJcIl0gKyBcIiAoMTUwMD8pXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnZGl2LnBsYXllci1kYXRhJywgW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdpLXNpZGUub25saW5lJywge2NsYXNzOiB7XCJpY29uXCI6IHRydWUsIFwiaWNvbi1ibGFja1wiOiB0cnVlfSB9ICksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ3BsYXllcicsIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2EudXNlci1saW5rJywge2F0dHJzOiB7aHJlZjogJy9ALycgKyBtb2RlbFtcImJwbGF5ZXJcIl19fSwgW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGgoJ3BsYXllci10aXRsZScsIFwiIFwiICsgbW9kZWxbXCJidGl0bGVcIl0gKyBcIiBcIiksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxbXCJicGxheWVyXCJdICsgXCIgKDE1MDA/KVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICBoKCdkaXYucm91bmRjaGF0I3JvdW5kY2hhdCcpLFxyXG4gICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgaCgnbWFpbi5tYWluJywgW1xyXG4gICAgICAgICAgICAgICAgaCgnc2VsZWN0aW9uLicgKyBWQVJJQU5UU1ttb2RlbFtcInZhcmlhbnRcIl1dLmJvYXJkICsgJy4nICsgVkFSSUFOVFNbbW9kZWxbXCJ2YXJpYW50XCJdXS5waWVjZXMsIFtcclxuICAgICAgICAgICAgICAgICAgICBoKCdkaXYuY2ctd3JhcC4nICsgVkFSSUFOVFNbbW9kZWxbXCJ2YXJpYW50XCJdXS5jZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgeyBob29rOiB7IGluc2VydDogKHZub2RlKSA9PiBydW5Hcm91bmQodm5vZGUsIG1vZGVsKX0sXHJcbiAgICAgICAgICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgIGgoJ2FzaWRlLnNpZGViYXItc2Vjb25kJywgW1xyXG4gICAgICAgICAgICAgICAgaCgnZGl2I3BvY2tldC13cmFwcGVyJywgW1xyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2Rpdi4nICsgVkFSSUFOVFNbbW9kZWxbXCJ2YXJpYW50XCJdXS5waWVjZXMgKyAnLicgKyBtb2RlbFtcInZhcmlhbnRcIl0sIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaCgnZGl2LmNnLXdyYXAucG9ja2V0JywgW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaCgnZGl2I3BvY2tldDAnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgIGgoJ2RpdiNjbG9jazAnKSxcclxuICAgICAgICAgICAgICAgIGgoJ2Rpdi5yb3VuZC1kYXRhJywgW1xyXG4gICAgICAgICAgICAgICAgICAgIGgoJ3JvdW5kLXBsYXllciNycGxheWVyMCcpLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2RpdiNtb3ZlLWNvbnRyb2xzJyksXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnZGl2I2JvYXJkLXNldHRpbmdzJyksXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnZGl2I21vdmVsaXN0LWJsb2NrJywgW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdkaXYjbW92ZWxpc3QnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaCgnZGl2I2FmdGVyLWdhbWUnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaCgnZGl2I2dhbWUtY29udHJvbHMnKSxcclxuICAgICAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdyb3VuZC1wbGF5ZXIjcnBsYXllcjEnKSxcclxuICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgaCgnZGl2I2Nsb2NrMScpLFxyXG4gICAgICAgICAgICAgICAgaCgnZGl2I3BvY2tldC13cmFwcGVyJywgW1xyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2Rpdi4nICsgVkFSSUFOVFNbbW9kZWxbXCJ2YXJpYW50XCJdXS5waWVjZXMgKyAnLicgKyBtb2RlbFtcInZhcmlhbnRcIl0sIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaCgnZGl2LmNnLXdyYXAucG9ja2V0JywgW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaCgnZGl2I3BvY2tldDEnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgIGgoJ2RpdiNmbGlwJyksXHJcbiAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICBoKCd1bmRlci1sZWZ0JywgXCJTcGVjdGF0b3JzXCIpLFxyXG4gICAgICAgICAgICBoKCd1bmRlci1ib2FyZCcsIFtoKCdkaXYuI3BnbicpXSksXHJcbiAgICAgICAgXTtcclxufVxyXG4iLCJpbXBvcnQgeyBpbml0IH0gZnJvbSBcInNuYWJiZG9tXCI7XG5pbXBvcnQgeyBWTm9kZSB9IGZyb20gJ3NuYWJiZG9tL3Zub2RlJztcbmltcG9ydCBrbGFzcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2NsYXNzJztcbmltcG9ydCBhdHRyaWJ1dGVzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvYXR0cmlidXRlcyc7XG5pbXBvcnQgcHJvcGVydGllcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL3Byb3BzJztcbmltcG9ydCBsaXN0ZW5lcnMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9ldmVudGxpc3RlbmVycyc7XG5cbmNvbnN0IHBhdGNoID0gaW5pdChba2xhc3MsIGF0dHJpYnV0ZXMsIHByb3BlcnRpZXMsIGxpc3RlbmVyc10pO1xuXG5pbXBvcnQgaCBmcm9tICdzbmFiYmRvbS9oJztcblxuaW1wb3J0IHsgZGltZW5zaW9ucyB9IGZyb20gJ2NoZXNzZ3JvdW5keC90eXBlcyc7XG5pbXBvcnQgeyB2YXJpYW50cywgVkFSSUFOVFMgfSBmcm9tICcuL2NoZXNzJztcbmltcG9ydCB7IHBvY2tldFZpZXcgfSBmcm9tICcuL3BvY2tldCc7XG5pbXBvcnQgeyBuZWVkUG9ja2V0cyB9IGZyb20gJy4vY2hlc3MnO1xuaW1wb3J0IHsgcGxheWVyIH0gZnJvbSAnLi9wbGF5ZXInO1xuXG4vLyBUT0RPOiBhZGQgZGFyay9saWdodCB0aGVtZSBidXR0b25zIChpY29uLXN1bi1vL2ljb24tbW9vbi1vKVxuXG5leHBvcnQgZnVuY3Rpb24gY2hhbmdlQ1NTKGNzc0ZpbGUpIHtcbiAgICAvLyBjc3MgZmlsZSBpbmRleCBpbiB0ZW1wbGF0ZS5odG1sXG4gICAgdmFyIGNzc0xpbmtJbmRleCA9IDE7XG4gICAgaWYgKGNzc0ZpbGUuaW5jbHVkZXMoXCJ4aWFuZ3FpXCIpKSB7XG4gICAgICAgIGNzc0xpbmtJbmRleCA9IDM7XG4gICAgfSBlbHNlIGlmIChjc3NGaWxlLmluY2x1ZGVzKFwic2hvZ2lcIikpIHtcbiAgICAgICAgY3NzTGlua0luZGV4ID0gMjtcbiAgICB9IGVsc2UgaWYgKGNzc0ZpbGUuaW5jbHVkZXMoXCJjYXBhc2VpXCIpKSB7XG4gICAgICAgIGNzc0xpbmtJbmRleCA9IDQ7XG4gICAgfSBlbHNlIGlmIChjc3NGaWxlLmluY2x1ZGVzKFwibWFrcnVrXCIpKSB7XG4gICAgICAgIGNzc0xpbmtJbmRleCA9IDU7XG4gICAgfVxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKFwibGlua1wiKS5pdGVtKGNzc0xpbmtJbmRleCkhLnNldEF0dHJpYnV0ZShcImhyZWZcIiwgY3NzRmlsZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRQaWVjZXMgKENTU2luZGV4ZXMsIHZhcmlhbnQsIGNvbG9yKSB7XG4gICAgLy9jb25zb2xlLmxvZyhcInNldFBpZWNlcygpXCIsIHZhcmlhbnQsIGNvbG9yKVxuICAgIHZhciBpZHggPSBDU1NpbmRleGVzW3ZhcmlhbnRzLmluZGV4T2YodmFyaWFudCldO1xuICAgIGlkeCA9IE1hdGgubWluKGlkeCwgVkFSSUFOVFNbdmFyaWFudF0uY3NzLmxlbmd0aCAtIDEpO1xuICAgIGlmICh2YXJpYW50ID09PSBcInNob2dpXCIpIHtcbiAgICAgICAgdmFyIGNzcyA9IFZBUklBTlRTW3ZhcmlhbnRdLmNzc1tpZHhdO1xuICAgICAgICAvLyBjaGFuZ2Ugc2hvZ2kgcGllY2UgY29sb3JzIGFjY29yZGluZyB0byBib2FyZCBvcmllbnRhdGlvblxuICAgICAgICBpZiAoY29sb3IgPT09IFwiYmxhY2tcIikgY3NzID0gY3NzLnJlcGxhY2UoJzAnLCAnMScpO1xuICAgICAgICBjaGFuZ2VDU1MoJy9zdGF0aWMvJyArIGNzcyArICcuY3NzJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY2hhbmdlQ1NTKCcvc3RhdGljLycgKyBWQVJJQU5UU1t2YXJpYW50XS5jc3NbaWR4XSArICcuY3NzJyk7XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0Wm9vbSAoY3RybCwgem9vbTogbnVtYmVyKSB7XG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY2ctd3JhcCcpIGFzIEhUTUxFbGVtZW50O1xuICAgIGlmIChlbCkge1xuICAgICAgICBjb25zdCBiYXNlV2lkdGggPSBkaW1lbnNpb25zW1ZBUklBTlRTW2N0cmwudmFyaWFudF0uZ2VvbV0ud2lkdGggKiAoY3RybC52YXJpYW50ID09PSBcInNob2dpXCIgPyA1MiA6IDY0KTtcbiAgICAgICAgY29uc3QgYmFzZUhlaWdodCA9IGRpbWVuc2lvbnNbVkFSSUFOVFNbY3RybC52YXJpYW50XS5nZW9tXS5oZWlnaHQgKiAoY3RybC52YXJpYW50ID09PSBcInNob2dpXCIgPyA2MCA6IDY0KTtcbiAgICAgICAgY29uc3QgcHh3ID0gYCR7em9vbSAvIDEwMCAqIGJhc2VXaWR0aH1weGA7XG4gICAgICAgIGNvbnN0IHB4aCA9IGAke3pvb20gLyAxMDAgKiBiYXNlSGVpZ2h0fXB4YDtcbiAgICAgICAgZWwuc3R5bGUud2lkdGggPSBweHc7XG4gICAgICAgIGVsLnN0eWxlLmhlaWdodCA9IHB4aDtcblxuICAgICAgICBkb2N1bWVudC5ib2R5LnNldEF0dHJpYnV0ZSgnc3R5bGUnLCAnLS1jZ3dyYXB3aWR0aDonICsgcHh3ICsgJzstLWNnd3JhcGhlaWdodDonICsgcHhoKTtcblxuICAgICAgICBkb2N1bWVudC5ib2R5LmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdjaGVzc2dyb3VuZC5yZXNpemUnKSk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwiem9vbVwiLCBTdHJpbmcoem9vbSkpO1xuICAgIH1cbn1cblxuLy8gZmxpcFxuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZU9yaWVudGF0aW9uIChjdHJsKSB7XG4gICAgY3RybC5mbGlwID0gIWN0cmwuZmxpcDtcbiAgICBjdHJsLmNoZXNzZ3JvdW5kLnRvZ2dsZU9yaWVudGF0aW9uKCk7XG5cbiAgICBpZiAoY3RybC52YXJpYW50ID09PSBcInNob2dpXCIpIHtcbiAgICAgICAgY29uc3QgY29sb3IgPSBjdHJsLmNoZXNzZ3JvdW5kLnN0YXRlLm9yaWVudGF0aW9uID09PSBcIndoaXRlXCIgPyBcIndoaXRlXCIgOiBcImJsYWNrXCI7XG4gICAgICAgIHNldFBpZWNlcyhjdHJsLkNTU2luZGV4ZXMsIGN0cmwudmFyaWFudCwgY29sb3IpO1xuICAgIH07XG4gICAgXG4gICAgY29uc29sZS5sb2coXCJGTElQXCIpO1xuICAgIGlmIChuZWVkUG9ja2V0cyhjdHJsLnZhcmlhbnQpKSB7XG4gICAgICAgIGNvbnN0IHRtcF9wb2NrZXQgPSBjdHJsLnBvY2tldHNbMF07XG4gICAgICAgIGN0cmwucG9ja2V0c1swXSA9IGN0cmwucG9ja2V0c1sxXTtcbiAgICAgICAgY3RybC5wb2NrZXRzWzFdID0gdG1wX3BvY2tldDtcbiAgICAgICAgY3RybC52cG9ja2V0MCA9IHBhdGNoKGN0cmwudnBvY2tldDAsIHBvY2tldFZpZXcoY3RybCwgY3RybC5mbGlwID8gY3RybC5teWNvbG9yIDogY3RybC5vcHBjb2xvciwgXCJ0b3BcIikpO1xuICAgICAgICBjdHJsLnZwb2NrZXQxID0gcGF0Y2goY3RybC52cG9ja2V0MSwgcG9ja2V0VmlldyhjdHJsLCBjdHJsLmZsaXAgPyBjdHJsLm9wcGNvbG9yIDogY3RybC5teWNvbG9yLCBcImJvdHRvbVwiKSk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogbW9yZXRpbWUgYnV0dG9uXG4gICAgY29uc3QgbmV3X3J1bm5pbmdfY2xjayA9IChjdHJsLmNsb2Nrc1swXS5ydW5uaW5nKSA/IGN0cmwuY2xvY2tzWzFdIDogY3RybC5jbG9ja3NbMF07XG4gICAgY3RybC5jbG9ja3NbMF0ucGF1c2UoZmFsc2UpO1xuICAgIGN0cmwuY2xvY2tzWzFdLnBhdXNlKGZhbHNlKTtcblxuICAgIGNvbnN0IHRtcF9jbG9jayA9IGN0cmwuY2xvY2tzWzBdO1xuICAgIGNvbnN0IHRtcF9jbG9ja190aW1lID0gdG1wX2Nsb2NrLmR1cmF0aW9uO1xuICAgIGN0cmwuY2xvY2tzWzBdLnNldFRpbWUoY3RybC5jbG9ja3NbMV0uZHVyYXRpb24pO1xuICAgIGN0cmwuY2xvY2tzWzFdLnNldFRpbWUodG1wX2Nsb2NrX3RpbWUpO1xuICAgIGlmIChjdHJsLnN0YXR1cyA8IDApIG5ld19ydW5uaW5nX2NsY2suc3RhcnQoKTtcblxuICAgIGN0cmwudnBsYXllcjAgPSBwYXRjaChjdHJsLnZwbGF5ZXIwLCBwbGF5ZXIoJ3BsYXllcjAnLCBjdHJsLnRpdGxlc1tjdHJsLmZsaXAgPyAxIDogMF0sIGN0cmwucGxheWVyc1tjdHJsLmZsaXAgPyAxIDogMF0sIGN0cmwubW9kZWxbXCJsZXZlbFwiXSkpO1xuICAgIGN0cmwudnBsYXllcjEgPSBwYXRjaChjdHJsLnZwbGF5ZXIxLCBwbGF5ZXIoJ3BsYXllcjEnLCBjdHJsLnRpdGxlc1tjdHJsLmZsaXAgPyAwIDogMV0sIGN0cmwucGxheWVyc1tjdHJsLmZsaXAgPyAwIDogMV0sIGN0cmwubW9kZWxbXCJsZXZlbFwiXSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VhckJ1dHRvbiAoY3RybCkge1xuICAgIHJldHVybiBoKCdidXR0b24jZ2VhcicsIHtcbiAgICAgICAgb246IHsgY2xpY2s6ICgpID0+IHRvZ2dsZUJvYXJkU2V0dGluZ3MoY3RybCkgfSxcbiAgICAgICAgY2xhc3M6IHtcInNlbGVjdGVkXCI6IGN0cmwuc2V0dGluZ3N9IH0sXG4gICAgICAgIFtoKCdpJywge1xuICAgICAgICAgICAgcHJvcHM6IHt0aXRsZTogJ1NldHRpbmdzJ30sXG4gICAgICAgICAgICBjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tY29nXCI6IHRydWV9IFxuICAgICAgICAgICAgfVxuICAgICAgICApXSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZUJvYXJkU2V0dGluZ3MgKGN0cmwpIHtcbiAgICBjdHJsLnNldHRpbmdzID0gIWN0cmwuc2V0dGluZ3M7XG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2VhcicpO1xuICAgIGlmIChlbCBpbnN0YW5jZW9mIEVsZW1lbnQpIHBhdGNoKGN0cmwudmdlYXIsIGdlYXJCdXR0b24oY3RybCkpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtb3ZlbGlzdC1ibG9jaycpIS5zdHlsZS5kaXNwbGF5ID0gKGN0cmwuc2V0dGluZ3MpID8gJ25vbmUnIDogJ2lubGluZS1ncmlkJztcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYm9hcmQtc2V0dGluZ3MnKSEuc3R5bGUuZGlzcGxheSA9IChjdHJsLnNldHRpbmdzKSA/ICdpbmxpbmUtZ3JpZCc6ICdub25lJztcbn1cblxuZnVuY3Rpb24gcmVuZGVyUGllY2VzIChjdHJsKSB7XG4gICAgY29uc3QgdmFyaWFudCA9IGN0cmwudmFyaWFudDtcbiAgICB2YXIgdnBpZWNlID0gY3RybC5DU1NpbmRleGVzW3ZhcmlhbnRzLmluZGV4T2YoY3RybC52YXJpYW50KV07XG4gICAgdmFyIGk7XG4gICAgY29uc3QgcGllY2VzIDogVk5vZGVbXSA9IFtdO1xuXG4gICAgY29uc3QgdG9nZ2xlUGllY2VzID0gKGUpID0+IHtcbiAgICAgICAgY29uc3QgaWR4ID0gZS50YXJnZXQudmFsdWU7XG4gICAgICAgIC8vY29uc29sZS5sb2coXCJ0b2dnbGVQaWVjZXMoKVwiLCBpZHgpO1xuICAgICAgICBjdHJsLkNTU2luZGV4ZXNbdmFyaWFudHMuaW5kZXhPZihjdHJsLnZhcmlhbnQpXSA9IGlkeFxuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShjdHJsLnZhcmlhbnQgKyBcIl9waWVjZXNcIiwgU3RyaW5nKGlkeCkpO1xuICAgICAgICBzZXRQaWVjZXMoY3RybC5DU1NpbmRleGVzLCBjdHJsLnZhcmlhbnQsIGN0cmwubXljb2xvcik7XG4gICAgfVxuXG4gICAgZm9yIChpID0gMDsgaSA8IFZBUklBTlRTW2N0cmwudmFyaWFudF0uY3NzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHBpZWNlcy5wdXNoKGgoJ2lucHV0I3BpZWNlJyArIFN0cmluZyhpKSwge1xuICAgICAgICAgICAgb246IHsgY2hhbmdlOiB0b2dnbGVQaWVjZXMgfSxcbiAgICAgICAgICAgIHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJwaWVjZVwiLCB2YWx1ZTogU3RyaW5nKGkpLCBjaGVja2VkOiB2cGllY2UgPT09IFN0cmluZyhpKSA/IFwiY2hlY2tlZFwiIDogXCJcIn1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgICAgIHBpZWNlcy5wdXNoKGgoJ2xhYmVsLnBpZWNlLnBpZWNlJyArIFN0cmluZyhpKSArICcuJyArIHZhcmlhbnQsIHsgYXR0cnM6IHtmb3I6IFwicGllY2VcIiArIFN0cmluZyhpKX0gfSwgXCJcIikpO1xuICAgIH1cbiAgICByZXR1cm4gcGllY2VzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0dGluZ3NWaWV3IChjdHJsKSB7XG5cbiAgICBpZiAoVkFSSUFOVFNbY3RybC52YXJpYW50XS5jc3MubGVuZ3RoID4gMSkgc2V0UGllY2VzKGN0cmwuQ1NTaW5kZXhlcywgY3RybC52YXJpYW50LCBjdHJsLm15Y29sb3IpO1xuXG4gICAgLy8gdHVybiBzZXR0aW5ncyBwYW5lbCBvZmZcbiAgICB0b2dnbGVCb2FyZFNldHRpbmdzKGN0cmwpO1xuXG4gICAgaWYgKGxvY2FsU3RvcmFnZS56b29tICE9PSB1bmRlZmluZWQgJiYgbG9jYWxTdG9yYWdlLnpvb20gIT09IDEwMCkgc2V0Wm9vbShjdHJsLCBOdW1iZXIobG9jYWxTdG9yYWdlLnpvb20pKTtcblxuICAgIHJldHVybiBoKCdkaXYjYm9hcmQtc2V0dGluZ3MnLCBbXG4gICAgICAgIGgoJ2Rpdi5zZXR0aW5ncy1yYWRpby1ncm91cCcsIHJlbmRlclBpZWNlcyhjdHJsKSksXG4gICAgICAgIC8vIFRPRE86IGhvdyB0byBob3Jpem9udGFseSBjZW50ZXIgdGhpcz9cbiAgICAgICAgLy8gaCgnbGFiZWwuem9vbScsIHsgYXR0cnM6IHtmb3I6IFwiem9vbVwifSB9LCBcIkJvYXJkIHNpemVcIiksXG4gICAgICAgIGgoJ2lucHV0I3pvb20nLCB7XG4gICAgICAgICAgICBjbGFzczoge1wic2xpZGVyXCI6IHRydWUgfSxcbiAgICAgICAgICAgIGF0dHJzOiB7IG5hbWU6ICd6b29tJywgd2lkdGg6ICcyODBweCcsIHR5cGU6ICdyYW5nZScsIHZhbHVlOiBOdW1iZXIobG9jYWxTdG9yYWdlLnpvb20pLCBtaW46IDYwLCBtYXg6IDE0MCB9LFxuICAgICAgICAgICAgb246IHsgaW5wdXQ6IChlKSA9PiB7IHNldFpvb20oY3RybCwgcGFyc2VGbG9hdCgoZS50YXJnZXQgYXMgSFRNTElucHV0RWxlbWVudCkudmFsdWUpKTsgfSB9XG4gICAgICAgICAgICB9XG4gICAgICAgICksXG4gICAgXSk7XG59XG4iLCJjbGFzcyBzb3VuZHMge1xyXG4gICAgdHJhY2tzO1xyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgdGhpcy50cmFja3MgPSB7XHJcbiAgICAgICAgICAgIEdlbmVyaWNOb3RpZnk6IHsgbmFtZTogJ0dlbmVyaWNOb3RpZnknLCBxdHkgOiAxLCBwb29sIDogW10sIGluZGV4IDogMH0sXHJcbiAgICAgICAgICAgIE1vdmU6IHsgbmFtZTogJ01vdmUnLCBxdHkgOiA2LCBwb29sIDogW10sIGluZGV4IDogMH0sXHJcbiAgICAgICAgICAgIENhcHR1cmU6IHsgbmFtZTogJ0NhcHR1cmUnLCBxdHkgOiA0LCBwb29sIDogW10sIGluZGV4IDogMH0sXHJcbiAgICAgICAgICAgIENoZWNrOiB7IG5hbWU6ICdDaGVjaycsIHF0eSA6IDIsIHBvb2wgOiBbXSwgaW5kZXggOiAwfSxcclxuICAgICAgICAgICAgRHJhdzogeyBuYW1lOiAnRHJhdycsIHF0eSA6IDEsIHBvb2wgOiBbXSwgaW5kZXggOiAwfSxcclxuICAgICAgICAgICAgVmljdG9yeTogeyBuYW1lOiAnVmljdG9yeScsIHF0eSA6IDEsIHBvb2wgOiBbXSwgaW5kZXggOiAwfSxcclxuICAgICAgICAgICAgRGVmZWF0OiB7IG5hbWU6ICdEZWZlYXQnLCBxdHkgOiAxLCBwb29sIDogW10sIGluZGV4IDogMH0sXHJcbiAgICAgICAgICAgIFNob2dpTW92ZTogeyBuYW1lOiAna29tYW90bzUnLCBxdHkgOiA2LCBwb29sIDogW10sIGluZGV4IDogMH0sXHJcbiAgICAgICAgICAgIENoYXQ6IHsgbmFtZTogJ2NoYXQnLCBxdHkgOiAxLCBwb29sIDogW10sIGluZGV4IDogMH0sXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBPYmplY3Qua2V5cyh0aGlzLnRyYWNrcykuZm9yRWFjaChrZXkgPT4ge1xyXG4gICAgICAgICAgICBsZXQgdHlwZSA9IHRoaXMudHJhY2tzW2tleV07XHJcbiAgICAgICAgICAgIHR5cGUucG9vbCA9IHRoaXMuYnVpbGRNYW55U291bmRzKHR5cGUubmFtZSwgdHlwZS5xdHkpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYnVpbGRNYW55U291bmRzID0gKGZpbGUsIHF0eSkgPT4ge1xyXG4gICAgICAgIHZhciBzb3VuZEFycmF5OiBIVE1MQXVkaW9FbGVtZW50W10gPSBbXTtcclxuICAgICAgICB3aGlsZSAoc291bmRBcnJheS5sZW5ndGggPCBxdHkpIHtcclxuICAgICAgICAgICAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImF1ZGlvXCIpO1xyXG4gICAgICAgICAgICBpZiAoZWwuY2FuUGxheVR5cGUoJ2F1ZGlvL21wZWcnKSkge1xyXG4gICAgICAgICAgICAgICAgZWwuc3JjID0gJy9zdGF0aWMvc291bmQvJyArIGZpbGUgKyAnLm1wMyc7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBlbC5zcmMgPSAnL3N0YXRpYy9zb3VuZC8nICsgZmlsZSArICcub2dnJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbC5zZXRBdHRyaWJ1dGUoXCJwcmVsb2FkXCIsIFwibm9uZVwiKTtcclxuICAgICAgICAgICAgZWwuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xyXG4gICAgICAgICAgICBzb3VuZEFycmF5LnB1c2goZWwpO1xyXG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGVsKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHNvdW5kQXJyYXk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBnZXRTb3VuZCA9ICh0eXBlKSA9PiB7XHJcbiAgICAgICAgbGV0IHRhcmdldCA9IHRoaXMudHJhY2tzW3R5cGVdO1xyXG4gICAgICAgIHRhcmdldC5pbmRleCA9ICh0YXJnZXQuaW5kZXggKyAxKSAlIHRhcmdldC5wb29sLmxlbmd0aDtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcIlNPVU5EOlwiLCB0eXBlLCB0YXJnZXQuaW5kZXgpO1xyXG4gICAgICAgIHJldHVybiB0YXJnZXQucG9vbFt0YXJnZXQuaW5kZXhdO1xyXG4gICAgfVxyXG5cclxuICAgIGdlbmVyaWNOb3RpZnkoKSB7IHRoaXMuZ2V0U291bmQoJ0dlbmVyaWNOb3RpZnknKS5wbGF5KCk7IH07XHJcbiAgICBtb3ZlKCkgeyB0aGlzLmdldFNvdW5kKCdNb3ZlJykucGxheSgpOyB9O1xyXG4gICAgY2FwdHVyZSgpIHsgdGhpcy5nZXRTb3VuZCgnQ2FwdHVyZScpLnBsYXkoKTsgfTtcclxuICAgIGNoZWNrKCkgeyB0aGlzLmdldFNvdW5kKCdDaGVjaycpLnBsYXkoKTsgfTtcclxuICAgIGRyYXcoKSB7IHRoaXMuZ2V0U291bmQoJ0RyYXcnKS5wbGF5KCk7IH07XHJcbiAgICB2aWN0b3J5KCkgeyB0aGlzLmdldFNvdW5kKCdWaWN0b3J5JykucGxheSgpOyB9O1xyXG4gICAgZGVmZWF0KCkgeyB0aGlzLmdldFNvdW5kKCdEZWZlYXQnKS5wbGF5KCk7IH07XHJcbiAgICBzaG9naW1vdmUoKSB7IHRoaXMuZ2V0U291bmQoJ1Nob2dpTW92ZScpLnBsYXkoKTsgfTtcclxuICAgIGNoYXQoKSB7IHRoaXMuZ2V0U291bmQoJ0NoYXQnKS5wbGF5KCk7IH07XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBzb3VuZCA9IG5ldyhzb3VuZHMpO1xyXG4iLCJpbXBvcnQgeyBpbml0IH0gZnJvbSAnc25hYmJkb20nO1xuaW1wb3J0IGtsYXNzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnO1xuaW1wb3J0IGF0dHJpYnV0ZXMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9hdHRyaWJ1dGVzJztcbmltcG9ydCBwcm9wZXJ0aWVzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvcHJvcHMnO1xuaW1wb3J0IGxpc3RlbmVycyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJztcblxuY29uc3QgcGF0Y2ggPSBpbml0KFtrbGFzcywgYXR0cmlidXRlcywgcHJvcGVydGllcywgbGlzdGVuZXJzXSk7XG5cbmltcG9ydCBoIGZyb20gJ3NuYWJiZG9tL2gnO1xuXG4vLyBUT0RPOiBjcmVhdGUgbG9nb3V0IGJ1dHRvbiB3aGVuIGxvZ2dlZCBpblxuLypcbmZ1bmN0aW9uIGxvZ2luKGhvbWUpIHtcbiAgICBjb25zb2xlLmxvZyhcIkxPR0lOIFdJVEggTElDSEVTU1wiKTtcbiAgICB3aW5kb3cubG9jYXRpb24uYXNzaWduKGhvbWUgKyAnL2xvZ2luJyk7XG59O1xuKi9cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJVc2VybmFtZShob21lLCB1c2VybmFtZSkge1xuICAgIGNvbnNvbGUubG9nKFwicmVuZGVyVXNlcm5hbWUoKVwiLCB1c2VybmFtZSwgaG9tZSk7XG4gICAgdmFyIG9sZFZOb2RlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3VzZXJuYW1lJyk7XG4gICAgaWYgKG9sZFZOb2RlIGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgICAgICBvbGRWTm9kZS5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgcGF0Y2gob2xkVk5vZGUgYXMgSFRNTEVsZW1lbnQsIGgoJ2RpdiN1c2VybmFtZScsIGgoJ2EubmF2LWxpbmsnLCB7YXR0cnM6IHtocmVmOiAnL0AvJyArIHVzZXJuYW1lfX0sIHVzZXJuYW1lKSkpO1xuICAgIH07XG4vKlxuICAgIC8vIGlmIHVzZXJuYW1lIGlzIG5vdCBhIGxvZ2dlZCBpbiBuYW1lIGxvZ2luIGVsc2UgbG9nb3V0IGJ1dHRvblxuICAgIHZhciBvbGRWTm9kZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2dpbicpO1xuICAgIGlmIChvbGRWTm9kZSBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICAgICAgb2xkVk5vZGUuaW5uZXJIVE1MID0gJyc7XG4gICAgICAgIHBhdGNoKG9sZFZOb2RlIGFzIEhUTUxFbGVtZW50LCBoKCdidXR0b24nLCB7IG9uOiB7IGNsaWNrOiAoKSA9PiBsb2dpbihob21lKSB9LCBwcm9wczoge3RpdGxlOiAnTG9naW4gd2l0aCBMaWNoZXNzJ30gfSwgW2goJ2knLCB7Y2xhc3M6IHtcImljb25cIjogdHJ1ZSwgXCJpY29uLXNpZ24taW5cIjogdHJ1ZX0gfSApLCBdKSk7XG4gICAgfTtcbiovXG59XG4iXX0=
