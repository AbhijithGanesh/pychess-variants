## PyChess-Variants

PyChess-Variants is a chess server designed to support chess variants
Besides standard chess the currently supported games are:

- [Makruk](https://en.wikipedia.org/wiki/Makruk)
- [Sittuyin](https://en.wikipedia.org/wiki/Sittuyin)
- [Shogi](https://en.wikipedia.org/wiki/Shogi)
- [Xiangqi](https://en.wikipedia.org/wiki/Xiangqi)
- [Capablanca chess](https://en.wikipedia.org/wiki/Capablanca_Chess)
- [Seirawan chess](https://en.wikipedia.org/wiki/Seirawan_chess)
- [Placement chess](http://www.quantumgambitz.com/blog/chess/cga/bronstein-chess-pre-chess-shuffle-chess)
- [Crazyhouse](https://en.wikipedia.org/wiki/Crazyhouse)

For move generation/validation and engine play it uses
- [Fairy-Stockfish](https://github.com/gbtami/Fairy-Stockfish)
- [Seirawan-Stockfish](https://github.com/gbtami/Seirawan-Stockfish)
- [moonfish](https://github.com/walker8088/moonfish)
- [lichess-bot-variants](https://github.com/gbtami/lichess-bot-variants)

On client side it based on
[chessgroundx](https://github.com/gbtami/chessgroundx)

## Installation
```
pip3 install -r requirements.txt --user

yarn install
gulp dev
python3 server.py
```

If you are brave enough you can try an experimental version [here](https://pychess-variants.herokuapp.com)