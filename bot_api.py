import asyncio
import logging

from aiohttp import web

from utils import STARTED, RESIGN, INVALIDMOVE, \
    get_board, accept_seek, challenge, get_seeks, User, Seek

log = logging.getLogger(__name__)


async def profile(request):
    if request.headers.get("Authorization") is None:
        return web.HTTPForbidden()
    else:
        # TODO: use lichess oauth
        auth = request.headers.get("Authorization")
        token = auth[auth.find("Bearer") + 7:]
        username = token[6:]
        resp = {"username": username, "title": "BOT"}
        return web.json_response(resp)


async def playing(request):
    if request.headers.get("Authorization") is None:
        return web.HTTPForbidden()
    else:
        # TODO: get bot player ongoing game list
        resp = {"nowPlaying": []}
        return web.json_response(resp)


async def challenge_create(request):
    if request.headers.get("Authorization") is None:
        return web.HTTPForbidden()
    else:
        # TODO: use lichess oauth
        return web.json_response({"ok": True})


async def challenge_accept(request):
    if request.headers.get("Authorization") is None:
        return web.HTTPForbidden()
    else:
        # TODO: use lichess oauth
        return web.json_response({"ok": True})


async def challenge_decline(request):
    if request.headers.get("Authorization") is None:
        return web.HTTPForbidden()
    else:
        # TODO: use lichess oauth
        return web.json_response({"ok": True})


async def create_bot_seek(request):
    if request.headers.get("Authorization") is None:
        return web.HTTPForbidden()

    # TODO: use lichess oauth
    user_agent = request.headers.get("User-Agent")
    username = user_agent[user_agent.find("user:") + 5:]

    data = await request.post()

    users = request.app["users"]
    seeks = request.app["seeks"]
    sockets = request.app["websockets"]

    bot_player = users[username]

    log.info("+++ %s created %s seek" % (bot_player.username, data["variant"]))

    # Try to create BOT vs BOT game to test TV
    test_TV = False
    matching_seek = None
    if test_TV:
        for seek in seeks.values():
            if seek.variant == data["variant"] and seek.user.is_bot and seek.user.online and seek.user.username != username:
                log.debug("MATCHING BOT SEEK %s FOUND!" % seek.id)
                matching_seek = seek
                break

    if matching_seek is None:
        seek = Seek(bot_player, data["variant"])
        seeks[seek.id] = seek
        bot_player.seeks[seek.id] = seek

        # inform others
        response = get_seeks(seeks)
        for client_ws in sockets.values():
            if client_ws is not None:
                await client_ws.send_json(response)
    else:
        games = request.app["games"]
        response = accept_seek(seeks, games, bot_player, matching_seek.id)

        gameId = response["gameId"]
        game = games[gameId]

        chall = challenge(seek, response)

        await seek.user.event_queue.put(chall)
        seek.user.game_queues[gameId] = asyncio.Queue()

        await bot_player.event_queue.put(chall)
        bot_player.game_queues[gameId] = asyncio.Queue()

        await seek.user.event_queue.put(game.game_start)
        await bot_player.event_queue.put(game.game_start)

        # delete accepted seek and inform others
        del seeks[matching_seek.id]
        response = get_seeks(seeks)
        for client_ws in sockets.values():
            if client_ws is not None:
                await client_ws.send_json(response)

    return web.json_response({"ok": True})


async def event_stream(request):
    user_agent = request.headers.get("User-Agent")
    username = user_agent[user_agent.find("user:") + 5:]

    users = request.app["users"]
    seeks = request.app["seeks"]
    sockets = request.app["websockets"]

    resp = web.StreamResponse()
    resp.content_type = "text/plain"
    await resp.prepare(request)

    bot_player = User(event_stream=resp, username=username)
    users[bot_player.username] = bot_player
    bot_player.event_queue = asyncio.Queue()

    log.info("+++ BOT %s connected" % bot_player.username)

    loop = asyncio.get_event_loop()
    pinger_task = loop.create_task(bot_player.pinger(sockets, seeks))

    # inform others
    response = get_seeks(seeks)
    for client_ws in sockets.values():
        if client_ws is not None:
            await client_ws.send_json(response)

    # send "challenge" and "gameStart" events from event_queue to the BOT
    while bot_player.online:
        answer = await bot_player.event_queue.get()
        await resp.write(answer.encode("utf-8"))
        await resp.drain()

    pinger_task.cancel()
    return resp


async def game_stream(request):
    user_agent = request.headers.get("User-Agent")
    username = user_agent[user_agent.find("user:") + 5:]

    gameId = request.match_info["gameId"]

    users = request.app["users"]
    games = request.app["games"]

    game = games[gameId]

    resp = web.StreamResponse()
    resp.content_type = "application/json"
    await resp.prepare(request)

    bot_player = users[username]

    log.info("+++ %s connected to %s game stream" % (bot_player.username, gameId))

    await bot_player.game_queues[gameId].put(game.game_full)

    async def pinger():
        """ To help lichess-bot.py abort games showing no activity. """
        while True:
            await bot_player.game_queues[gameId].put("\n")
            await asyncio.sleep(5)

    loop = asyncio.get_event_loop()
    pinger_task = loop.create_task(pinger())

    opp_name = game.wplayer.username if username == game.bplayer.username else game.bplayer.username
    if not users[opp_name].is_bot:
        opp_ws = users[opp_name].game_sockets[gameId]
        response = {"type": "game_opp_connected", "username": username, "gameId": gameId}
        await opp_ws.send_json(response)

    while True:
        answer = await bot_player.game_queues[gameId].get()
        await resp.write(answer.encode("utf-8"))
        await resp.drain()

    await resp.write_eof()
    pinger_task.cancel()

    return resp


async def bot_move(request):
    user_agent = request.headers.get("User-Agent")
    username = user_agent[user_agent.find("user:") + 5:]
    gameId = request.match_info["gameId"]
    move = request.match_info["move"]

    users = request.app["users"]
    games = request.app["games"]

    bot_player = users[username]
    game = games[gameId]

    invalid_move = False
    log.info("BOT move %s %s %s %s - %s" % (username, gameId, move, game.wplayer.username, game.bplayer.username))
    if game.status <= STARTED:
        try:
            game.play_move(move)
        except SystemError:
            invalid_move = True
            log.error("Game %s aborted because invalid move %s by %s !!!" % (gameId, move, username))
            game.status = INVALIDMOVE
            game.result = "0-1" if username == game.wplayer.username else "1-0"
            bot_player.online = False

    await bot_player.game_queues[gameId].put(game.game_state)

    if game.status > STARTED:
        await bot_player.game_queues[gameId].put(game.game_end)

    opp_name = game.wplayer.username if username == game.bplayer.username else game.bplayer.username

    if not invalid_move:
        board_response = get_board(games, {"gameId": gameId}, full=False)

    if users[opp_name].is_bot:
        if game.status > STARTED:
            await users[opp_name].game_queues[gameId].put(game.game_end)
        else:
            await users[opp_name].game_queues[gameId].put(game.game_state)
    else:
        opp_ws = users[opp_name].game_sockets[gameId]
        if not invalid_move:
            await opp_ws.send_json(board_response)
        if game.status > STARTED:
            await opp_ws.send_json(game.game_end)

    if game.spectators and not invalid_move:
        for spectator in game.spectators:
            if gameId in spectator.game_sockets:
                await spectator.game_sockets[gameId].send_json(board_response)

    return web.json_response({"ok": True})


async def bot_abort(request):
    # TODO: use lichess oauth
    if request.headers.get("Authorization") is None:
        return web.HTTPForbidden()
    user_agent = request.headers.get("User-Agent")
    username = user_agent[user_agent.find("user:") + 5:]

    games = request.app["games"]
    gameId = request.match_info["gameId"]
    game = games[gameId]

    users = request.app["users"]
    bot_player = users[username]

    opp_name = game.wplayer.username if username == game.bplayer.username else game.bplayer.username
    opp_player = users[opp_name]

    response = game.abort()
    await bot_player.game_queues[gameId].put(game.game_end)
    if opp_player.is_bot:
        await opp_player.game_queues[gameId].put(game.game_end)
    else:
        opp_ws = users[opp_name].game_sockets[gameId]
        await opp_ws.send_json(response)

    if game.spectators:
        for spectator in game.spectators:
            await users[spectator.username].game_sockets[gameId].send_json(response)

    return web.json_response({"ok": True})


async def bot_resign(request):
    # TODO: use lichess oauth
    if request.headers.get("Authorization") is None:
        return web.HTTPForbidden()

    user_agent = request.headers.get("User-Agent")
    username = user_agent[user_agent.find("user:") + 5:]

    games = request.app["games"]
    gameId = request.match_info["gameId"]
    game = games[gameId]
    game.status = RESIGN
    game.result = "0-1" if username == game.wplayer.username else "1-0"
    return web.json_response({"ok": True})


async def bot_chat(request):
    # TODO: use lichess oauth
    if request.headers.get("Authorization") is None:
        return web.HTTPForbidden()

    user_agent = request.headers.get("User-Agent")
    username = user_agent[user_agent.find("user:") + 5:]

    data = await request.post()

    gameId = request.match_info["gameId"]
    room = data["room"]
    message = data["text"]

    users = request.app["users"]
    games = request.app["games"]

    game = games[gameId]

    opp_name = game.wplayer.username if username == game.bplayer.username else game.bplayer.username

    if not users[opp_name].is_bot:
        opp_ws = users[opp_name].game_sockets[gameId]
        response = {"type": "roundchat", "user": username, "room": room, "message": message}
        await opp_ws.send_json(response)

    return web.json_response({"ok": True})


async def bot_pong(request):
    # TODO: use lichess oauth
    if request.headers.get("Authorization") is None:
        return web.HTTPForbidden()

    user_agent = request.headers.get("User-Agent")
    username = user_agent[user_agent.find("user:") + 5:]
    users = request.app["users"]
    bot_player = users[username]
    bot_player.ping_counter -= 1
    return web.json_response({"ok": True})
