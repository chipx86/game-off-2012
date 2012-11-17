(function() {


var MS = {};

MS.KeyCodes = {
    BACKSPACE: 8,
    ENTER: 13
};


MS.CommandInterpreter = Backbone.Model.extend({
    defaults: {
        game: null
    },

    commands: [
        ['^(go )?n(orth)?$', '_goNorth'],
        ['^(go )?s(outh)?$', '_goSouth'],
        ['^(go )?e(east)?$', '_goEast'],
        ['^(go )?w(west)?$', '_goWest']
    ],

    initialize: function() {
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
    },

    _goNorth: function() {
        this.get('game').terminal.writeLine('Hello!');
    },

    _goSouth: function() {
        console.log('south');
    },

    _goEast: function() {
        console.log('east');
    },

    _goWest: function() {
        console.log('west');
    }
});


MS.Terminal = Backbone.Model.extend({
    defaults: {
        buffer: null
    },

    promptStr: '> ',

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
                   ? this._lineBuffer.length - this.promptStr.length
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
        this.trigger('lineEntered', line);
        this.showPrompt();
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
    };

    this.set = function(s) {
        pre.textContent = s;
    };

    this.get = function(s) {
        return pre.textContent;
    };

    return this;
};


MS.TerminalView = Backbone.View.extend({
    el: $('#terminal'),

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
        this._updateSize();

        $(window).resize(_.bind(this._updateSize, this));

        return this;
    },

    _updateSize: function() {
        this.$el
            .outerWidth($(document).width())
            .outerHeight($(document).height());
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

    initialize: function() {
        this.terminal = new MS.Terminal();
        this.commandInterpreter = new MS.CommandInterpreter({
            game: this
        });

        this.terminal.on('lineEntered', function(line) {
            this.commandInterpreter.handleCommand(line);
        }, this);
    },

    run: function() {
        this.terminal.clear();
        this.terminal.writeLine('= M I N E S W E P T =');
        this.terminal.writeLine();
        this.terminal.writeLine(this.introText);
        this.terminal.writeLine();
        this.terminal.showPrompt();
    }
});


MS.GameView = Backbone.View.extend({
    initialize: function() {
        this.terminalView = new MS.TerminalView({
            model: this.model.terminal
        });
    },

    render: function() {
        this.terminalView.render();

        return this;
    }
});


$(document).ready(function() {
    var gameView = new MS.GameView({
        model: new MS.Game()
    });

    gameView.render();
    gameView.model.run();
});


})();
