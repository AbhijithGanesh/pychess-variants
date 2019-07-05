import asyncio
import logging
import random
import string
from time import monotonic, time
from datetime import datetime

import fairy
import seirawan
import xiangqi

from settings import URI
from compress import encode_moves, decode_moves, R2C, C2R, V2C, C2V

log = logging.getLogger(__name__)

BLACK = True
MAX_USER_SEEKS = 10

CREATED, STARTED, ABORTED, MATE, RESIGN, STALEMATE, TIMEOUT, DRAW, FLAG, CHEAT, \
    NOSTART, INVALIDMOVE, UNKNOWNFINISH, VARIANTEND = range(-2, 12)


def usi2uci(move):
    """ Used to create chessground dests UCI coordinates from USI shogi moves and on game save also. """
    if move[1] == "*":
        return "%s@%s%s" % (move[0], chr(ord(move[2]) + 48), chr(ord(move[3]) - 48))
    else:
        return "%s%s%s%s%s" % (chr(ord(move[0]) + 48), chr(ord(move[1]) - 48), chr(ord(move[2]) + 48), chr(ord(move[3]) - 48), move[4] if len(move) == 5 else "")


def uci2usi(move):
    if move[1] == "@":
        return "%s*%s%s" % (move[0], chr(ord(move[2]) - 48), chr(ord(move[3]) + 48))
    else:
        return "%s%s%s%s%s" % (chr(ord(move[0]) - 48), chr(ord(move[1]) + 48), chr(ord(move[2]) - 48), chr(ord(move[3]) + 48), move[4] if len(move) == 5 else "")


class Seek:
    gen_id = 0

    def __init__(self, user, variant, fen="", color="r", base=5, inc=3, level=1, rated=False):
        self.user = user
        self.variant = variant
        self.color = color
        self.fen = fen
        self.rated = rated
        self.base = base
        self.inc = inc
        self.level = level

        Seek.gen_id += 1
        self.id = self.gen_id

        self.as_json = {
            "seekID": self.id,
            "user": self.user.username,
            "variant": self.variant,
            "fen": self.fen,
            "color": self.color,
            "rated": "Rated" if self.rated else "Casual",
            "tc": "%s+%s" % (self.base, self.inc)
        }


class User:
    def __init__(self, lobby_ws=None, bot=False, username=None):
        self.lobby_ws = lobby_ws
        self.bot = bot
        if username is None:
            self.username = "Anonymous" + "".join(random.sample(string.ascii_uppercase, 4))
        else:
            self.username = username
        self.first_name = ""
        self.last_name = ""
        self.country = ""
        self.seeks = {}
        if self.bot:
            self.event_queue = asyncio.Queue()
            self.game_queues = {}
            self.title = "BOT"
        else:
            self.game_sockets = {}
            self.title = ""
        self.online = True
        self.ping_counter = 0

#    @property
#    def id(self):
#        return id(self)
#
    async def clear_seeks(self, sockets, seeks):
        has_seek = len(self.seeks) > 0
        if has_seek:
            for seek in self.seeks:
                del seeks[seek]
            self.seeks.clear()

            await broadcast(sockets, get_seeks(seeks))

    async def quit_lobby(self, sockets):
        print(self.username, "quit()")

        self.online = False
        if self.username in sockets:
            del sockets[self.username]

    async def broadcast_disconnect(self, users, games):
        games_involved = self.game_queues.keys() if self.bot else self.game_sockets.keys()

        for gameId in games_involved:
            if gameId not in games:
                continue
            game = games[gameId]
            if self.username != game.wplayer.username and self.username != game.bplayer.username:
                continue

            response = {"type": "user_disconnected", "username": self.username, "gameId": gameId}
            opp = game.bplayer if game.wplayer.username == self.username else game.wplayer
            if not opp.bot:
                await opp.game_sockets[gameId].send_json(response)

            for spectator in game.spectators:
                if gameId in users[spectator.username].game_sockets:
                    await users[spectator.username].game_sockets[gameId].send_json(response)

    async def pinger(self, sockets, seeks, users, games):
        while True:
            if self.ping_counter > 2:
                self.online = False
                log.info("%s went offline" % self.username)
                await self.broadcast_disconnect(users, games)
                await self.clear_seeks(sockets, seeks)
                await self.quit_lobby(sockets)
                break

            if self.bot:
                await self.event_queue.put("\n")
            else:
                await self.lobby_ws.send_json({"type": "ping", "timestamp": "%s" % time()})
            self.ping_counter += 1

            # heroku needs ping at least in 50 sec not to close BOT connections (stream events) on server side
            await asyncio.sleep(3)

    def __str__(self):
        return self.username


class Game:
    def __init__(self, db, games, gameId, variant, initial_fen, wplayer, bplayer, base=1, inc=0, level=20, rated=False):
        self.db = db
        self.games = games
        self.saved = False
        self.variant = variant
        self.initial_fen = initial_fen
        self.wplayer = wplayer
        self.bplayer = bplayer
        self.rated = rated
        self.base = base
        self.inc = inc
        self.skill_level = level
        self.spectators = set()
        self.draw_offers = set()
        self.rematch_offers = set()
        self.messages = []
        self.date = datetime.utcnow()

        self.ply_clocks = [{"black": base * 1000 * 60, "white": base * 1000 * 60, "movetime": 0}]
        self.dests = {}
        self.lastmove = None
        self.check = False
        self.status = CREATED
        self.result = "*"
        self.bot_game = False
        self.last_server_clock = monotonic()

        self.id = gameId
        self.board = self.create_board(self.variant, self.initial_fen)

        # Initial_fen needs validation to prevent segfaulting in pyffish
        if self.initial_fen:
            start_fen = self.board.start_fen(self.variant)
            start = start_fen.split()
            init = self.initial_fen.split()
            invalid0 = len(init) < 2
            invalid1 = any((c not in start[0] for c in init[0] if not c.isdigit()))
            invalid2 = start[0].count("/") != init[0].count("/")
            invalid3 = init[1] != "b" and init[1] != "w"
            if variant == "seirawan":
                invalid4 = len(init) > 2 and any((c not in "KQBCDFGkqbcdfgAHah" for c in init[2]))
            else:
                invalid4 = len(init) > 2 and any((c not in start[2] for c in init[2]))

            if invalid0 or invalid1 or invalid2 or invalid3 or invalid4:
                log.error("Got invalid initial_fen %s for game %s" % (self.initial_fen, self.id))
                self.initial_fen = start_fen
                self.board = self.create_board(self.variant, self.initial_fen)
        else:
            self.initial_fen = self.board.fen

        self.bot_game = self.bplayer.bot or self.wplayer.bot
        self.random_mover = self.wplayer.username == "Random-Mover" or self.bplayer.username == "Random-Mover"
        self.random_move = ""

        self.set_dests()
        if self.board.move_stack:
            self.check = self.board.is_checked()

        self.steps = [{
            "fen": self.initial_fen,
            "san": None,
            "turnColor": "black" if self.board.color == BLACK else "white",
            "check": self.check}
        ]

    def create_board(self, variant, initial_fen):
        if variant == "seirawan":
            board = seirawan.SeirawanBoard(initial_fen)
        elif variant == "xiangqi":
            board = xiangqi.XiangqiBoard(initial_fen)
        else:
            board = fairy.FairyBoard(variant, initial_fen)
        return board

    async def play_move(self, move, clocks=None):
        if self.status > STARTED:
            return
        elif self.status == CREATED:
            self.status = STARTED

        cur_player = self.bplayer if self.board.color == BLACK else self.wplayer
        if cur_player.username in self.draw_offers:
            self.draw_offers.remove(cur_player.username)

        cur_time = monotonic()
        # BOT players doesn't send times used for moves
        if self.bot_game:
            movetime = int(round((cur_time - self.last_server_clock) * 1000))
            if clocks is None:
                clocks = {
                    "white": self.ply_clocks[-1]["white"],
                    "black": self.ply_clocks[-1]["black"]}
            clocks["movetime"] = movetime

            if cur_player.bot and self.ply > 2:
                cur_color = "black" if self.board.color == BLACK else "white"
                clocks[cur_color] = max(0, self.clocks[cur_color] - movetime)
                if clocks[cur_color] == 0:
                    # TODO: 1/2 if hasInsufficientMaterial()
                    result = "1-0" if self.board.color == BLACK else "0-1"
                    await self.update_status(FLAG, result)
        self.last_server_clock = cur_time

        if self.status != FLAG:
            san = self.board.get_san(move)
            self.lastmove = (move[0:2], move[2:4])
            self.board.push(move)
            self.ply_clocks.append(clocks)
            self.set_dests()
            await self.update_status()

            self.steps.append({
                "fen": self.board.fen,
                "move": move,
                "san": san,
                "turnColor": "black" if self.board.color == BLACK else "white",
                "check": self.check}
            )

    async def save_game(self):
        if self.saved:
            return
        print("SAVE GAME")
        self.print_game()
        await self.db.game.find_one_and_update(
            {"_id": self.id},
            {"$set":
             {"d": self.date,
              "s": self.status,
              "r": R2C[self.result],
              'm': encode_moves(map(usi2uci, self.board.move_stack) if self.variant == "shogi" else self.board.move_stack)}
             }
        )
        self.saved = True

        async def remove():
            # keep it in our games dict a little to let players get the last board
            await asyncio.sleep(5)
            print("REMOVED", )
            del self.games[self.id]

        loop = asyncio.get_event_loop()
        loop.create_task(remove())

    async def update_status(self, status=None, result=None):
        if status is not None:
            self.status = status
            if result is not None:
                self.result = result
            await self.save_game()
            return

        if self.board.move_stack:
            self.check = self.board.is_checked()

        if self.board.insufficient_material():
            print("1/2 by board.insufficient_material()")
            self.status = DRAW
            self.result = "1/2-1/2"

        # check 50 move rule and repetition
        if self.board.is_claimable_draw() and (self.wplayer.bot or self.bplayer.bot):
            print("1/2 by board.is_claimable_draw()")
            self.status = DRAW
            self.result = "1/2-1/2"

        if not self.dests:
            if self.check:
                self.status = MATE
                self.result = "1-0" if self.board.color == BLACK else "0-1"
            else:
                # being in stalemate loses in xiangqi
                self.status = STALEMATE
                if self.variant == "xiangqi":
                    self.result = "0-1" if self.board.color == BLACK else "1-0"
                else:
                    print("1/2 by stalemate")
                    self.result = "1/2-1/2"

        if self.status > STARTED:
            await self.save_game()

    def set_dests(self):
        dests = {}
        moves = self.board.legal_moves()

        if self.random_mover:
            self.random_move = random.choice(moves) if moves else ""

        for move in moves:
            if self.variant == "shogi":
                move = usi2uci(move)
            source, dest = move[0:2], move[2:4]
            if source in dests:
                dests[source].append(dest)
            else:
                dests[source] = [dest]
        # print("-----------------------------------------------------------")
        # print(self.board.print_pos())
        # print(dests)
        # print("-----------------------------------------------------------")
        self.dests = dests

    def print_game(self):
        print(self.pgn)
        print(self.board.print_pos())
        # print(self.board.move_stack)
        # print("---CLOCKS---")
        # for ply, clocks in enumerate(self.ply_clocks):
        #     print(ply, self.board.move_stack[ply - 1] if ply > 0 else "", self.ply_clocks[ply]["movetime"], self.ply_clocks[ply]["black"], self.ply_clocks[ply]["white"])
        # print(self.result)

    @property
    def pgn(self):
        moves = " ".join((step["san"] if ind % 2 == 0 else "%s. %s" % ((ind + 1) // 2, step["san"]) for ind, step in enumerate(self.steps) if ind > 0))
        return '[Event "{}"]\n[Site "{}"]\n[Date "{}"]\n[Round "-"]\n[White "{}"]\n[Black "{}"]\n[Result "{}"]\n[TimeControl "{}+{}"]\n[Variant "{}"]\n{fen}{setup}\n{} {}\n'.format(
            "PyChess casual game",
            URI + "/" + self.id,
            self.date.strftime("%Y.%m.%d"),
            self.wplayer.username,
            self.bplayer.username,
            self.result,
            self.base * 60,
            self.inc,
            self.variant.capitalize(),
            moves,
            self.result,
            fen="" if self.variant == "standard" else '[FEN "%s"]\n' % self.initial_fen,
            setup="" if self.variant == "standard" else '[SetUp "1"]\n')

    @property
    def ply(self):
        return len(self.board.move_stack)

    @property
    def clocks(self):
        return self.ply_clocks[-1]

    @property
    def is_claimable_draw(self):
        return self.board.is_claimable_draw()

    @property
    def game_start(self):
        return '{"type": "gameStart", "game": {"id": "%s", "skill_level": "%s"}}\n' % (self.id, self.skill_level)

    @property
    def game_end(self):
        return '{"type": "gameEnd", "game": {"id": "%s"}}\n' % self.id

    @property
    def game_full(self):
        return '{"type": "gameFull", "id": "%s", "variant": {"name": "%s"}, "white": {"name": "%s"}, "black": {"name": "%s"}, "state": {"moves": ""}, "initialFen": "%s"}\n' % (self.id, self.variant, self.wplayer.username, self.bplayer.username, self.initial_fen)

    @property
    def game_state(self):
        clocks = self.clocks
        return '{"type": "gameState", "moves": "%s", "wtime": %s, "btime": %s, "winc": %s, "binc": %s}\n' % (" ".join(self.board.move_stack), clocks["white"], clocks["black"], self.inc, self.inc)

    async def abort(self):
        await self.update_status(ABORTED)
        return {"type": "gameEnd", "status": self.status, "result": "Game aborted.", "gameId": self.id, "pgn": self.pgn}


async def load_game(db, games, users, game_id):
    if game_id in games:
        return games[game_id]

    doc = await db.game.find_one({"_id": game_id})

    if doc is None:
        return None

    wp = doc["us"][0]
    if wp in users:
        wplayer = users[wp]
    else:
        wplayer = User(username=wp)
        users[wp] = wplayer

    bp = doc["us"][1]
    if bp in users:
        bplayer = users[bp]
    else:
        bplayer = User(username=bp)
        users[bp] = bplayer

    variant = C2V[doc["v"]]

    game = Game(db, games, game_id, variant, doc.get("if"), wplayer, bplayer, doc["b"], doc["i"])

    mlist = decode_moves(doc["m"])
    if variant == "shogi":
        mlist = map(uci2usi, mlist)

    for move in mlist:
        san = game.board.get_san(move)
        game.board.push(move)
        game.check = game.board.is_checked()
        game.steps.append({
            "fen": game.board.fen,
            "move": move,
            "san": san,
            "turnColor": "black" if game.board.color == BLACK else "white",
            "check": game.check}
        )
    if len(game.steps) > 1:
        move = game.steps[-1]["move"]
        game.lastmove = (move[0:2], move[2:4])

    game.date = doc["d"]
    game.status = doc["s"]
    game.result = C2R[doc["r"]]
    game.random_move = ""
    game.saved = True
    return game


def start(games, data):
    return {"type": "gameStart", "gameId": data["gameId"]}


def end(games, data):
    game = games[data["gameId"]]
    return {"type": "gameEnd", "status": game.status, "result": game.result, "gameId": data["gameId"], "pgn": game.pgn}


async def draw(games, data, agreement=False):
    game = games[data["gameId"]]
    if game.is_claimable_draw or agreement:
        result = "1/2-1/2"
        await game.update_status(DRAW, result)
        return {"type": "gameEnd", "status": game.status, "result": game.result, "gameId": data["gameId"], "pgn": game.pgn}
    else:
        return {"type": "offer", "message": "Draw offer sent"}


async def resign(games, user, data):
    game = games[data["gameId"]]
    result = "0-1" if user.username == game.wplayer.username else "1-0"
    await game.update_status(RESIGN, result)
    return {"type": "gameEnd", "status": game.status, "result": game.result, "gameId": data["gameId"], "pgn": game.pgn}


async def flag(games, user, data):
    game = games[data["gameId"]]
    # TODO: 1/2 if hasInsufficientMaterial()
    result = "0-1" if user.username == game.wplayer.username else "1-0"
    await game.update_status(FLAG, result)
    return {"type": "gameEnd", "status": game.status, "result": game.result, "gameId": data["gameId"], "pgn": game.pgn}


def challenge(seek, response):
    return '{"type":"challenge", "challenge": {"id":"%s", "challenger":{"name":"%s", "rating":1500,"title":""},"variant":{"key":"%s"},"rated":"true","timeControl":{"type":"clock","limit":300,"increment":0},"color":"random","speed":"rapid","perf":{"name":"Rapid"}, "level":%s}}\n' % (response["gameId"], seek.user.username, seek.variant, seek.level)


def create_seek(seeks, user, data):
    if len(user.seeks) >= MAX_USER_SEEKS:
        return None

    seek = Seek(user, data["variant"], data["fen"], data["color"], data["minutes"], data["increment"])
    seeks[seek.id] = seek
    user.seeks[seek.id] = seek


def get_seeks(seeks):
    return {"type": "get_seeks", "seeks": [seek.as_json for seek in seeks.values()]}


async def accept_seek(db, seeks, games, user, seek_id):
    log.info("+++ Seek %s accepted by%s" % (seek_id, user.username))
    seek = seeks[seek_id]

    if seek.color == "r":
        wplayer = random.choice((user, seek.user))
        bplayer = user if wplayer.username == seek.user.username else seek.user
    else:
        wplayer = seek.user if seek.color == "w" else user
        bplayer = seek.user if seek.color == "b" else user

    new_id = "".join(random.choice(string.ascii_letters + string.digits) for x in range(8))
    existing = await db.game.find_one({'_id': {'$eq': new_id}})
    if existing:
        log.debug("!!! Game ID %s allready in mongodb !!!" % new_id)
        return {"type": "error"}

    new_game = Game(db, games, new_id, seek.variant, seek.fen, wplayer, bplayer, seek.base, seek.inc, seek.level)
    games[new_game.id] = new_game

    if not seek.user.bot:
        del seeks[seek_id]
        if seek_id in seek.user.seeks:
            del seek.user.seeks[seek_id]

    document = {
        "_id": new_id,
        "us": [wplayer.username, bplayer.username],
        "v": V2C[seek.variant],
        "b": seek.base,
        "i": seek.inc,
        "m": [],
        "d": new_game.date,
        "s": new_game.status,
        "r": R2C["*"]
    }
    if seek.fen:
        document["if"] = seek.fen
    result = await db.game.insert_one(document)
    print("db insert game result %s" % repr(result.inserted_id))

    return {"type": "accept_seek", "ok": True, "variant": seek.variant, "gameId": new_game.id, "wplayer": wplayer.username, "bplayer": bplayer.username, "fen": seek.fen, "base": seek.base, "inc": seek.inc}


async def broadcast(sockets, response):
    for client_ws in sockets.values():
        if client_ws is not None:
            await client_ws.send_json(response)


async def play_move(games, data):
    game = games[data["gameId"]]
    move = data["move"]
    clocks = data["clocks"]
    assert move
    await game.play_move(move, clocks)


def get_board(games, data, full=False):
    game = games[data["gameId"]]
    if full:
        steps = game.steps

        # To not touch game.ply_clocks we are creating deep copy from clocks
        clocks = {"black": game.clocks["black"], "white": game.clocks["white"]}

        if game.status == STARTED and game.ply >= 2:
            # We have to adjust current player latest saved clock time
            # unless he will get free extra time on browser page refresh
            # (also needed for spectators entering to see correct clock times)

            cur_time = monotonic()
            elapsed = int(round((cur_time - game.last_server_clock) * 1000))

            cur_color = "black" if game.board.color == BLACK else "white"
            clocks[cur_color] = max(0, clocks[cur_color] - elapsed)
    else:
        clocks = game.clocks
        steps = (game.steps[-1],)

    return {"type": "board",
            "gameId": data["gameId"],
            "status": game.status,
            "result": game.result,
            "fen": game.board.fen,
            "lastMove": game.lastmove,
            "steps": steps,
            "dests": game.dests,
            "check": game.check,
            "ply": game.ply,
            "clocks": {"black": clocks["black"], "white": clocks["white"]},
            "pgn": game.pgn if game.status > STARTED else "",
            "rm": game.random_move,
            }
