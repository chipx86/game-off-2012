(function() {


var MS = {};


MS.CommandsMixin = {
    compileCommands: function() {
        var newCommands = [];

        _.each(this.commands, function(item) {
            var r = new RegExp(item[0]);
            r.compile(r);
            newCommands.push([r, item[1]]);
        });

        this.commands = newCommands;
    },

    handleCommand: function(line) {
        var len = this.commands.length,
            i;

        for (i = 0; i < len; i++) {
            var item = this.commands[i],
                m = item[0].exec(line);

            if (m) {
                this[item[1]](m);

                return true;
            }
        }

        return false;
    }
};


MS.KeyCodes = {
    BACKSPACE: 8,
    ENTER: 13
};


MS.Item = Backbone.Model.extend({
    name: null,
    commands: [],

    defaults: {
        game: null
    },

    initialize: function() {
        this.compileCommands();
    }
});
_.extend(MS.Item.prototype, MS.CommandsMixin);


MS.Items = Backbone.Collection.extend({
    model: MS.Item
});


MS.Player = Backbone.Model.extend({
    defaults: {
        x: 0,
        y: 0
    },

    initialize: function() {
        this.items = new MS.Items();
        this.items.add(new MS.Note());
    }
});


MS.Room = Backbone.Model.extend({
    defaults: {
        description: '',
        x: null,
        y: null,
        cleared: false,
        flagged: false,
        mine: false,
        number: 0,
        numberShown: false,
        exploded: false,
        mineShown: false
    },

    initialize: function() {
    },

    enter: function() {
    },

    getDescription: function() {
        if (this.get('flagged')) {
            return "Right or wrong, you flagged this area before.";
        } else if (this.get('numberShown')) {
            return "A big number " + this.get('number') + " is plastered " +
                   "on the ground.";
        } else {
            return "Just think, you might be stepping on a mine right now.";
        }
    }
});


MS.Rooms = Backbone.Collection.extend({
    model: MS.Room
});


MS.MineField = Backbone.Model.extend({
    defaults: {
        width: 6,
        height: 6,
        minesPct: 0.3
    },

    _directions: [
        [ 0, -1], // Top
        [ 1, -1], // Top-right
        [ 1,  0], // Right
        [ 1,  1], // Bottom-right
        [ 0,  1], // Bottom
        [-1,  1], // Bottom-left
        [-1,  0], // Left
        [-1, -1]  // Top-left
    ],

    initialize: function() {
        var width = this.get('width'),
            height = this.get('height'),
            x,
            y;

        this.rooms = [];
        this.roomsList = new MS.Rooms();

        for (y = 0; y < height; y++) {
            this.rooms.push([]);

            for (x = 0; x < width; x++) {
                var room = new MS.Room({
                    x: x,
                    y: y
                });

                this.roomsList.add(room);
                this.rooms[y].push(room);
            }
        }

        this.generateMines();

        this.roomsList.on('change', function(room) {
            this.trigger('roomChanged', room.get('x'), room.get('y'));
        }, this);
    },

    generateMines: function() {
        var width = this.get('width'),
            height = this.get('height'),
            num_mines = width * height * this.get('minesPct'),
            x,
            y,
            i;

        for (i = 0; i < num_mines; i++) {
            /* Keep going until we place a mine. */
            for (;;) {
                var room;

                x = Math.floor(Math.random() * width);
                y = Math.floor(Math.random() * height);
                room = this.rooms[y][x];

                /*
                 * Only mark this as a mine if it's not already a mine
                 * and if there's no adjacent mine.
                 */
                if (!room.get('mine') && this._countAdjacentMines(x, y) < 2) {
                    room.set('mine', true);
                    break;
                }
            }
        }

        /* Now set the neighbor counts. */
        for (y = 0; y < height; y++) {
            for (x = 0; x < width; x++) {
                var room = this.rooms[y][x];

                if (!room.get('mine')) {
                    room.set('number', this._countAdjacentMines(x, y));
                }
            }
        }
    },

    _countAdjacentMines: function(x, y) {
        var width = this.get('width'),
            height = this.get('height'),
            count = 0;

        _.each(this._directions, function(dir) {
            var roomX = x + dir[0],
                roomY = y + dir[1];

            if (roomX >= 0 && roomX < width &&
                roomY >= 0 && roomY < height &&
                this.rooms[roomY][roomX].get('mine')) {
                count++;
            }
        }, this);

        return count;
    }
});


MS.Terminal = Backbone.Model.extend({
    defaults: {
        buffer: null
    },

    promptStr: '\n> ',

    initialize: function() {
        this._lineBuffer = '';
        this._hasPrompt = false;
    },

    keyDown: function(e) {
        switch (e.which) {
            case MS.KeyCodes.BACKSPACE:
                this._backspace();
                break;

            default:
                return false;
        }

        return true;
    },

    keyPressed: function(e) {
        var keyCode = e.which;

        switch (keyCode) {
            case MS.KeyCodes.ENTER:
                this._processLine();
                break;

            default:
                var c = String.fromCharCode(keyCode);
                this._lineBuffer += c;
                this._appendText(c);
                break;
        }

        return true;
    },

    write: function(line) {
        var pos = (this._hasPrompt
                   ? this._lineBuffer.length + this.promptStr.length
                   : 0);

        this._insertText(pos, line || '', true);
    },

    writeLine: function(line) {
        this.write((line || '') + '\n');
    },

    clear: function() {
        this._setText('');
    },

    showPrompt: function() {
        this._hasPrompt = true;
        this._appendText(this.promptStr);
    },

    _processLine: function() {
        var line = this._lineBuffer;
        this._appendText('\n');
        this._lineBuffer = '';
        this.showPrompt();
        this.trigger('lineEntered', line);
    },

    _backspace: function() {
        var lineLen = this._lineBuffer.length;

        if (lineLen > 0) {
            var buffer = this.get('buffer'),
                bufferText = buffer.get();

            this._lineBuffer = this._lineBuffer.slice(0, lineLen - 1);
            buffer.set(bufferText.slice(0, bufferText.length - 1));
        }
    },

    _setText: function(s) {
        this.get('buffer').set(s);
    },

    _insertText: function(pos, text, fromEnd) {
        var buffer = this.get('buffer'),
            bufferText = buffer.get(),
            bufferLen = bufferText.length,
            realPos = (fromEnd ? bufferLen - pos : pos);

        if (realPos === bufferLen) {
            buffer.append(text);
        } else {
            buffer.set([
                bufferText.slice(0, realPos),
                text,
                bufferText.slice(realPos)
            ].join(''));
        }
    },

    _appendText: function(s) {
        this.get('buffer').append(s);
    }
});


MS.Buffer = function(pre) {
    this.append = function(s) {
        pre.textContent += s;
        pre.scrollTop = pre.scrollHeight;
    };

    this.set = function(s) {
        pre.textContent = s;
        pre.scrollTop = pre.scrollHeight;
    };

    this.get = function(s) {
        return pre.textContent;
    };

    return this;
};


MS.TerminalView = Backbone.View.extend({
    tagName: 'pre',
    id: 'terminal',

    initialize: function() {
        this.model.set('buffer', new MS.Buffer(this.el));

        $(document.body).keydown(_.bind(function(e) {
            return !this.model.keyDown(e);
        }, this));

        $(document.body).keypress(_.bind(function(e) {
            return !this.model.keyPressed(e);
        }, this));
    },

    render: function() {
        $(window).resize(_.bind(this._updateSize, this));
        this._updateSize();

        return this;
    },

    _updateSize: function() {
        var margin = parseInt(this.$el.css('margin'), 10);

        this.$el
            .outerWidth($(document).width() - margin - 10)
            .outerHeight($(document).height() - margin - 10);
    }
});


MS.MapView = Backbone.View.extend({
    tagName: 'table',
    id: 'map',

    initialize: function() {
        this.options.game.player.on('change:x change:y',
                                    this._updatePlayerPos, this);

        this.options.game.mineField.on('roomChanged', this._updateRoom, this);
    },

    _updatePlayerPos: function() {
        var player = this.options.game.player,
            x = player.get('x'),
            y = player.get('y'),
            room = this.options.game.mineField.rooms[y][x],
            cell = $(this.el.rows[y].cells[x]);

        if (this._curCell) {
            this._curCell.removeClass('cur');
        }

        this._updateRoom(x, y);

        cell.addClass('cur');
        this._curCell = cell;
    },

    _updateRoom: function(x, y) {
        var room = this.options.game.mineField.rooms[y][x],
            s = '';

        if (room.get('exploded')) {
            s = 'X';
        } else if (room.get('mineShown')) {
            s = '*';
        } else if (room.get('flagged')) {
            s = 'F';
        } else if (room.get('numberShown')) {
            s = room.get('number');
        }

        $(this.el.rows[y].cells[x]).text(s);
    },

    render: function() {
        var mineField = this.options.game.mineField,
            width = mineField.get('width'),
            height = mineField.get('height'),
            x,
            y;

        for (y = 0; y < height; y++) {
            var row = $('<tr/>');

            for (x = 0; x < width; x++) {
                row.append('<td/>');
            }

            this.$el.append(row);
        }

        return this;
    }
});


MS.Game = Backbone.Model.extend({
    introText: [
        "A late-night gelato run. Sounded like a good idea, only you didn't",
        "make it that far.",
        "",
        "*THUD*",
        "",
        "You don't know how long you've been knocked out, but you awoke with ",
        "a pretty bad headache.",
        "",
        "As your eyes begin to grow accustomed to the darkness, a shiver ",
        "goes down your spine. Your worse fears have been realized:",
        "",
        "Somebody put you in an underground minefield."
    ].join('\n'),

    commands: [
        ['^(go )?n(orth)?$', '_goNorth'],
        ['^(go )?s(outh)?$', '_goSouth'],
        ['^(go )?e(ast)?$', '_goEast'],
        ['^(go )?w(est)?$', '_goWest'],
        ['^f(lag)?$', '_toggleFlag'],
        ['^c(leared)?$', '_markCleared']
    ],

    initialize: function() {
        this.terminal = new MS.Terminal();
        this.mineField = new MS.MineField();
        this.player = new MS.Player();

        this.terminal.on('lineEntered', this._onLineEntered, this);

        this.compileCommands();
    },

    run: function() {
        this.terminal.clear();
        this.terminal.writeLine('= M I N E S W E P T =');
        this.terminal.writeLine();
        this.terminal.writeLine(this.introText);
        this.terminal.writeLine();
        this.terminal.showPrompt();

        this._enterRoom(
            Math.floor(Math.random() * this.mineField.get('width')),
            Math.floor(Math.random() * this.mineField.get('height')));
    },

    _onLineEntered: function(line) {
        if (!this.handleCommand(line)) {
            var items = this.player.items,
                len = items.length,
                i;

            for (i = 0; i < len; i++) {
                if (items.at(i).handleCommand(line)) {
                    return;
                }
            }
        }
    },

    _enterRoom: function(x, y) {
        var room = this.mineField.rooms[y][x],
            description;

        this.player.set({
            x: x,
            y: y
        });

        description = room.getDescription();

        if (description) {
            this.terminal.writeLine(description);
        }

        this.set('room', room);
        room.enter();
    },

    _goNorth: function() {
        this._goToRoom(this.player.get('x'), this.player.get('y') - 1);
    },

    _goSouth: function() {
        this._goToRoom(this.player.get('x'), this.player.get('y') + 1);
    },

    _goEast: function() {
        this._goToRoom(this.player.get('x') + 1, this.player.get('y'));
    },

    _goWest: function() {
        this._goToRoom(this.player.get('x') - 1, this.player.get('y'));
    },

    _goToRoom: function(x, y) {
        if (x >= 0 && x < this.mineField.get('width') &&
            y >= 0 && y < this.mineField.get('height')) {
            this._enterRoom(x, y);
        } else {
            this.terminal.writeLine(
                "You tried running into a brick wall, but surprisingly, you " +
                "came out the loser.");
        }
    },

    _toggleFlag: function() {
        var room = this.get('room');

        room.set('flagged', !room.get('flagged'));
    },

    _markCleared: function() {
        var room = this.get('room');

        if (room.get('mine')) {
            console.log("BOOM");
            this.gameOver();
            room.set('exploded', true);
        } else {
            room.set('cleared', true);
        }
    },

    gameOver: function() {
        this.mineField.roomsList.each(function(room) {
            if (room.get('mine') && !room.get('flagged')) {
                room.set('mineShown', true);
            }
        }, this);
    }
});
_.extend(MS.Game.prototype, MS.CommandsMixin);


MS.GameView = Backbone.View.extend({
    initialize: function() {
        this.terminalView = new MS.TerminalView({
            model: this.model.terminal
        });

        this.mapView = new MS.MapView({
            game: this.model
        });
    },

    render: function() {
        this.$el
            .append(this.mapView.$el)
            .append(this.terminalView.$el);

        this.mapView.render();
        this.terminalView.render();

        return this;
    }
});


$(document).ready(function() {
    var gameView = new MS.GameView({
        el: document.body,
        model: new MS.Game()
    });

    gameView.render();
    gameView.model.run();
});


})();
