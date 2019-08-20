import { key2pos } from 'chessgroundx/util';
import { Color, Geometry, Key, Role } from 'chessgroundx/types';

export const variants = ["makruk", "sittuyin", "placement", "crazyhouse", "standard", "shogi", "xiangqi", "capablanca", "seirawan", "capahouse", "shouse"];
export const variants960 = ["crazyhouse", "standard", "capablanca", "capahouse"];

export const VARIANTS = {
    makruk: { geom: Geometry.dim8x8, cg: "cg-512", board: "grid", pieces: "makruk", css: ["makruk"], icon: "Q"},
    sittuyin: { geom: Geometry.dim8x8, cg: "cg-512", board: "gridx", pieces: "makruk", css: ["makruk"], icon: "R" },
    shogi: { geom: Geometry.dim9x9, cg: "cg-576", board: "grid9x9", pieces: "shogi", css: ["shogi0", "shogi0w", "shogi0p", "shogi0k"], icon: "K" },
    xiangqi: { geom: Geometry.dim9x10, cg: "cg-576-640", board: "river", pieces: "xiangqi", css: ["xiangqi", "xiangqie", "xiangqict2"], icon: "O" },
    placement: { geom: Geometry.dim8x8, cg: "cg-512", board: "brown", pieces: "merida", css: ["standard"], icon: "S" },
    crazyhouse: { geom: Geometry.dim8x8, cg: "cg-512", board: "brown", pieces: "merida", css: ["standard"], icon: "H" },
    capablanca: { geom: Geometry.dim10x8, cg: "cg-640", board: "capablanca", pieces: "merida", css: ["capasei0", "capasei1"], icon: "P" },
    capahouse: { geom: Geometry.dim10x8, cg: "cg-640", board: "capablanca", pieces: "merida", css: ["capasei0", "capasei1"], icon: "P" },
    seirawan: { geom: Geometry.dim8x8, cg: "cg-512", board: "brown", pieces: "merida", css: ["capasei1", "capasei0"], icon: "L" },
    shouse: { geom: Geometry.dim8x8, cg: "cg-512", board: "brown", pieces: "merida", css: ["capasei1", "capasei0"], icon: "L" },
    standard: { geom: Geometry.dim8x8, cg: "cg-512", board: "brown", pieces: "merida", css: ["standard"], icon: "M" },
}

export function pocketRoles(variant: string) {
    switch (variant) {
    case "sittuyin":
        return ["rook", "knight", "silver", "ferz", "king"];
    case "crazyhouse":
        return ["pawn", "knight", "bishop", "rook", "queen"];
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

function promotionZone(variant: string, color: string) {
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

export function promotionRoles(variant: string, role: Role) {
    switch (variant) {
    case "capahouse":
    case "capablanca":
        return ["queen", "knight", "rook", "bishop", "archbishop", "cancellor"];
    case "shouse":
    case "seirawan":
        return ["queen", "knight", "rook", "bishop", "elephant", "hawk"];
    case "shogi":
        return ["p" + role, role];
    default:
        return ["queen", "knight", "rook", "bishop"];
    }
}

export function mandatoryPromotion(role: Role, dest: Key, color: Color) {
    switch (role) {
    case "pawn":
    case "lance":
        if (color === "white") {
            return dest[1] === "9";
        } else {
            return dest[1] === "1";
        }
    case "knight":
        if (color === "white") {
            return dest[1] === "9" || dest[1] === "8";
        } else {
            return dest[1] === "1" || dest[1] === "2";
        }
    default:
        return false;
    }
}

export function needPockets(variant: string) {
    return variant === 'placement' || variant === 'crazyhouse' || variant === 'sittuyin' || variant === 'shogi' || variant === 'seirawan' || variant === 'capahouse' || variant === 'shouse'
}

export function hasEp(variant: string) {
    return variant === 'standard' || variant === 'placement' || variant === 'crazyhouse' || variant === 'capablanca' || variant === 'seirawan' || variant === 'capahouse' || variant === 'shouse'
}

function diff(a: number, b:number):number {
  return Math.abs(a - b);
}

function diagonalMove(pos1, pos2) {
    const xd = diff(pos1[0], pos2[0]);
    const yd = diff(pos1[1], pos2[1]);
    return xd === yd && xd === 1;
}

export function canGate(fen, piece, orig, dest, meta) {
    console.log("   isGating()", fen, piece, orig, dest, meta);
    const no_gate = [false, false, false, false, false, false]
    if ((piece.color === "white" && orig.slice(1) !== "1") ||
        (piece.color === "black" && orig.slice(1) !== "8") ||
        (piece.role === "hawk") ||
        (piece.role === "elephant")) return no_gate;

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
        if (castl.indexOf("A") === -1 && castl.indexOf("Q") === -1) return no_gate;
        break;
    case "b1":
        if (castl.indexOf("B") === -1) return no_gate;
        break;
    case "c1":
        if (castl.indexOf("C") === -1) return no_gate;
        break;
    case "d1":
        if (castl.indexOf("D") === -1) return no_gate;
        break;
    case "e1":
        if (piece.role !== "king") {
            return no_gate;
        } else if ((castl.indexOf("K") === -1) && (castl.indexOf("Q") === -1)) {
            return no_gate;
        } else if (castl.indexOf("E") === -1) {
            return no_gate;
        };
        break;
    case "f1":
        if (castl.indexOf("F") === -1) return no_gate;
        break;
    case "g1":
        if (castl.indexOf("G") === -1) return no_gate;
        break;
    case "h1":
        if (castl.indexOf("H") === -1 && castl.indexOf("K") === -1) return no_gate;
        break;
    case "a8":
        if (castl.indexOf("a") === -1 && castl.indexOf("q") === -1) return no_gate;
        break;
    case "b8":
        if (castl.indexOf("b") === -1) return no_gate;
        break;
    case "c8":
        if (castl.indexOf("c") === -1) return no_gate;
        break;
    case "d8":
        if (castl.indexOf("d") === -1) return no_gate;
        break;
    case "e8":
        if (piece.role !== "king") {
            return no_gate;
        } else if ((castl.indexOf("k") === -1) && (castl.indexOf("q") === -1)) {
            return no_gate;
        } else if (castl.indexOf("e") === -1) {
            return no_gate;
        };
        break;
    case "f8":
        if (castl.indexOf("f") === -1) return no_gate;
        break;
    case "g8":
        if (castl.indexOf("g") === -1) return no_gate;
        break;
    case "h8":
        if (castl.indexOf("h") === -1 && castl.indexOf("k") === -1) return no_gate;
        break;
    };
    const bracketPos = placement.indexOf("[");
    const pockets = placement.slice(bracketPos);
    const ph = lc(pockets, "h", color==='w') !== 0;
    const pe = lc(pockets, "e", color==='w') !== 0;
    const pq = lc(pockets, "q", color==='w') !== 0;
    const pr = lc(pockets, "r", color==='w') !== 0;
    const pb = lc(pockets, "b", color==='w') !== 0;
    const pn = lc(pockets, "n", color==='w') !== 0;

    return [ph, pe, pq, pr, pb, pn];
}

export function isPromotion(variant, piece, orig, dest, meta) {
    if (variant === 'xiangqi') return false;
    const pz = promotionZone(variant, piece.color)
    switch (variant) {
    case 'shogi':
        return ['king', 'gold', 'ppawn', 'pknight', 'pbishop', 'prook', 'psilver', 'plance'].indexOf(piece.role) === -1
            && (pz.indexOf(orig) !== -1 || pz.indexOf(dest) !== -1)
    case 'sittuyin':
        // See https://vdocuments.net/how-to-play-myanmar-traditional-chess-eng-book-1.html
        const firstRankIs0 = false;
        const dm = diagonalMove(key2pos(orig, firstRankIs0), key2pos(dest, firstRankIs0));
        return piece.role === "pawn" && ( orig === dest || (!meta.captured && dm))
    default:
        return piece.role === "pawn" && pz.indexOf(dest) !== -1
    }
}

export function uci2usi(move) {
    const parts = move.split("");
    if (parts[1] === "@") {
        parts[1] = "*";
        parts[2] = String.fromCharCode(parts[2].charCodeAt() - 48)
        parts[3] = String.fromCharCode(parts[3].charCodeAt() + 48)
    } else {
        parts[0] = String.fromCharCode(parts[0].charCodeAt() - 48)
        parts[1] = String.fromCharCode(parts[1].charCodeAt() + 48)
        parts[2] = String.fromCharCode(parts[2].charCodeAt() - 48)
        parts[3] = String.fromCharCode(parts[3].charCodeAt() + 48)
    }
    return parts.join("");
}

export function usi2uci(move) {
    const parts = move.split("");
    if (parts[1] === "*") {
        parts[1] = "@";
        parts[2] = String.fromCharCode(parts[2].charCodeAt() + 48)
        parts[3] = String.fromCharCode(parts[3].charCodeAt() - 48)
    } else {
        parts[0] = String.fromCharCode(parts[0].charCodeAt() + 48)
        parts[1] = String.fromCharCode(parts[1].charCodeAt() - 48)
        parts[2] = String.fromCharCode(parts[2].charCodeAt() + 48)
        parts[3] = String.fromCharCode(parts[3].charCodeAt() - 48)
    }
    return parts.join("");
}

export const roleToSan = {
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

export const sanToRole = {
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
export function lc(str, letter, uppercase) {
    var letterCount = 0;
    if (uppercase) letter = letter.toUpperCase();
    for (var position = 0; position < str.length; position++) {
        if (str.charAt(position) === letter) letterCount += 1;
    }
    return letterCount;
}
