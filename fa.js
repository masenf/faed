/* fa.js -- finite automata */

function hashify (a){
    var h = new Object;
    for(var i = 0; i < a.length;i++ ){
        h[a[i]] = true;
    }
    return h;
}

function DState(label, accept, position) {
    this.transitions = new Object;
    this.back_transitions = new Object;
    this.position = position;
    this.accept = accept;
    this.label = label;
}
function NDState(label, accept, position) {
    this.transitions = [];
    this.back_transitions = [];
    this.position = position;
    this.accept = accept;
    this.label = label;
}

function DFA(alpha) {
/* return a new Deterministic Finite Automata based around the given alphabet
 *
 * alphabet should be a js Array of symbols */
    /* uniqify the alphabet */
    this.alpha = hashify(alpha);
    this.states = new Object;
    this.start_state = 's';
    this.states['s'] = new DState('s',false,[50,50]);
    this.states['s'].description = 'This is the start state';
    this.add_transition = function(from, to, symbol) {
        if (!this.alpha[symbol])
        {
            this.error('add_transition',"symbol '" + symbol + "' is not in the alphabet");
            return false;
        }
        if (this.states[from] && this.states[to])
        {
            this.states[from].transitions[symbol] = to;
            if (!this.states[to].back_transitions[from])
                this.states[to].back_transitions[from] = [];
            this.states[to].back_transitions[from].push(symbol);
            return true;
        } else {
            this.error('add_transition',"One of the states does not exist!");
            return false;
        }
    };
    this.add_state = function(id, label, accept, position, description) {
        this.states[id] = new DState(label,accept,position);
        this.states[id].description = description;
    }
    this.delay = 25;        /* default state change delay */
    this.c_state = this.start_state;
    this.complete = function (accept, f_state) {
        console.log("string accepted: " + accept + "\nfinal state: " + f_state);
    }
    this.state_change = function (from, to, symbol) {
        console.log("State changed " + from + " --> " + to + " on '" + symbol + "'");
    }
    this.error = function (tag, err_msg) {
        console.log("[err] [" + tag + "]: " + err_msg);
    }
    this.process = function(input,self) {
        if (!self)
            var self = this;
        if (!self.running) {
            self.c_state = self.start_state;
            self.input = input;
            self.running = true;
        }
        if (self.input.length > 0) {
            if (self.alpha[self.input[0]]) {
                var n_state = self.states[self.c_state].transitions[self.input[0]];
                self.state_change(self.c_state, n_state, self.input[0]);
                self.c_state = n_state;
                self.input = self.input.slice(1,self.input.length)
                setTimeout(function () {self.process("",self);},self.delay);
            } else {
                self.error('process',"symbol '" + self.input[0] + "' not in alphabet");
                self.running = false;
            }
        } else {
            /* entire string is now processed */
            self.running = false;
            self.complete(self.states[self.c_state].accept, self.c_state);
        }
    };
    this.running = false;
}
