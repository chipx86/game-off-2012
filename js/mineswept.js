(function() {


var MS = {};

MS.KeyCodes = {
    ENTER: 13
};


MS.Terminal = Backbone.Model.extend({
    initialize: function() {
        this._lineBuffer = '';
    },

    keyPressed: function(e) {
        var keyCode = e.which;

        switch (keyCode) {
            case MS.KeyCodes.ENTER:
                this._processLine();
                break;
            default:
                this._addChar(String.fromCharCode(keyCode));
                break;
        }
    },

    clear: function() {
        this.trigger('setText', '');
    },

    _processLine: function() {
        this.trigger('appendText', '\n');
        this._lineBuffer = '';
        this._showPrompt();
    },

    _addChar: function(c) {
        this._lineBuffer += c;
        this.trigger('appendText', c);
    },

    _showPrompt: function() {
        this.trigger('appendText', '> ');
    }
});


MS.TerminalView = Backbone.View.extend({
    el: $('#terminal'),

    initialize: function() {
        $(document.body).keypress(_.bind(function(e) {
            this.model.keyPressed(e);
            return false;
        }, this));

        this.model.on('setText', function(s) {
            this.el.textContent = s;
        }, this);

        this.model.on('appendText', function(s) {
            this.el.textContent += s;
        }, this);
    },

    render: function() {
        this._updateSize();

        $(window).resize(_.bind(this, _updateSize, this));

        return this;
    },

    _updateSize: function() {
        this.$el
            .outerWidth($(document).width())
            .outerHeight($(document).height());
    }
});


$(document).ready(function() {
    var terminalView = new MS.TerminalView({
        model: new MS.Terminal()
    });

    terminalView.render();
});


})();
