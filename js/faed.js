// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

/* what mode is the editor in? 
 *   select -- click to select states and transitions
 *   state  -- click to add a state
 *   transition -- drag between two states or click states
                   in succession to add transitions
 *   execute -- cannot edit during this time
 */
var mode = 'select';
var selection_type = 'none';        /* state, transition, none */
var selection = -1;                 /* deprecated */
var selected_states = [];
var selected_transitions = [];

/* internal vars */
var canvas_element = 'canvasc';
var canvas_w = 680;
var canvas_h = 480;
var nxt_state = 1;                  /* the next state id to generate */
var state_radius = 60;
var accept_radius = 55;
var arrow_length = 12.5;
var bevel_amount = 60;
var state_label_font = "20pt Arial";
var transition_label_font = "12pt Arial";
var selected_state_color = "#0055FF"
var current_state_color = "#FF5500"
var state_color = "#000000"
var transition_color = "#000000"
var selected_transition_color = "#0055FF"
var dblClick_delay = 200;           /* ms */

/* for double click functionality */
var last_click = -1;

/* the vectors for determining whether a transition has been clicked */
var transition_hits = new Object

/* initialize the editor */
var fa = new DFA(['0','1']);

function Render(ctx) {

    this.to_draw = new Object;
    this.dirty = true;  /* marked to recalculate positions */
    this.ctx = ctx;

    /* rendering functions */
    this.draw_fa = function() {
        this.calc_transitions();
        this.draw_states();
        this.draw_transitions();
    };
    this.draw_states = function() {
        for (var s_id in fa.states) {
            var state = fa.states[s_id];
            this.ctx.strokeStyle = state_color;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            /* set special colors */
            if (selected_states.indexOf(s_id) >= 0)
                this.ctx.strokeStyle = selected_state_color;
            if (fa.running && s_id == fa.c_state)
                this.ctx.strokeStyle = current_state_color;
            drawCircle(this.ctx,state_radius,state.position[0],state.position[1]);
            if (state.accept) 
                drawCircle(this.ctx,accept_radius,state.position[0],state.position[1]);
            this.ctx.font = state_label_font;
            var width = this.ctx.measureText(state.label).width;
            this.ctx.fillText(state.label, state.position[0]-width/2, state.position[1]);
            this.ctx.stroke();
        }
        /* draw the leader arrow */
        if (fa.states[fa.start_state]) {
            var state = fa.states[fa.start_state];
            var cx = state.position[0];
            var cy = state.position[1];
            this.ctx.strokeStyle = transition_color;
            this.ctx.beginPath();
            this.ctx.moveTo(cx - 2*state_radius,cy);
            this.ctx.lineTo(cx - state_radius,cy);
            this.ctx.lineTo(cx - state_radius - arrow_length,cy - arrow_length);
            this.ctx.moveTo(cx - state_radius - arrow_length,cy + arrow_length);
            this.ctx.lineTo(cx - state_radius,cy);
            this.ctx.stroke();
        }
    };
    this.calc_transitions = function() {
        transition_hits = new Object;
        for (var from in fa.states) {
            transition_hits[from] = [];
            this.to_draw[from] = new Object;
            for (var sym in fa.states[from].transitions) {
                var fr_pos = fa.states[from].position;
                var to = fa.states[from].transitions[sym];
                if (!this.to_draw[from][to]) {
                    /* initilize this transition */
                    this.to_draw[from][to] = new Object;
                    this.to_draw[from][to].label = "";
                    this.to_draw[from][to].start = [0,0];
                    this.to_draw[from][to].end = [0,0];
                    this.to_draw[from][to].midp = [0,0];
                    this.to_draw[from][to].quadr = false;
                    this.to_draw[from][to].lineWidth = 1;
                    this.to_draw[from][to].strokeStyle = transition_color;
                }
                this.to_draw[from][to].label += sym + " ";
                var to_pos = fa.states[to].position;

                /* determine if this transition is selected */
                for (var i=0;i<selected_transitions.length;i++) {
                    var sel = selected_transitions[i];
                    if (sel[0] == from && sel[1] == sym) {
                        this.to_draw[from][to].strokeStyle = selected_transition_color;
                    }
                }
                if (fa.running) {
                    if (from == fa.c_state && sym == fa.input[0])
                        this.to_draw[from][to].lineWidth=2;
                    else
                        this.to_draw[from][to].lineWidth=1;
                }
                if (this.dirty) {
                    if (from != to) {       /* calc a line or quad curve */
                        var unit_vec = vecTo(fr_pos[0],fr_pos[1],to_pos[0],to_pos[1],1);
                        var dir_vec = [state_radius*unit_vec[0],state_radius*unit_vec[1]]
                        var perp_vec = perp(unit_vec);
                        var sx = fr_pos[0] + dir_vec[0]; // perp_vec[0];
                        var sy = fr_pos[1] + dir_vec[1]; //perp_vec[1];
                        var fx = to_pos[0] - dir_vec[0]; // perp_vec[0];
                        var fy = to_pos[1] - dir_vec[1]; // perp_vec[1];
                        var len = distance(sx,sy,fx,fy);
                        var midp = [sx + unit_vec[0]*len*0.5, sy+unit_vec[1]*len*0.5];
                        if (this.to_draw[to] && this.to_draw[to][from] && this.to_draw[to][from].quadr == false) {
                            /* make the quadratic back-curve */
                            this.to_draw[from][to].quadr = true;
                            dir_vec = vecTo(sx,sy,midp[0]+bevel_amount*perp_vec[0],midp[1]+bevel_amount*perp_vec[1],state_radius);
                            sx = fr_pos[0] + dir_vec[0];
                            sy = fr_pos[1] + dir_vec[1];
                            dir_vec = vecTo(fx,fy,midp[0]+bevel_amount*perp_vec[0],midp[1]+bevel_amount*perp_vec[1],state_radius);
                            fx = to_pos[0] + dir_vec[0];
                            fy = to_pos[1] + dir_vec[1];
                        }
                        this.to_draw[from][to].start = [sx,sy];
                        this.to_draw[from][to].end = [fx,fy];
                        this.to_draw[from][to].midp = midp;
                        var hit_vec = vecTo(sx,sy,fx,fy,len);
                        transition_hits[from].push([sx,sy,hit_vec[0],hit_vec[1],sym]);
                    } else {
                        this.to_draw[from][to].start = [state_radius/1.414+fr_pos[0],-state_radius/1.414+fr_pos[1]];
                    }
                }
            }
        }
        //this.dirty = false;
    };
    this.draw_transitions = function () {
        for (from in this.to_draw) {
            for (to in this.to_draw[from]) {
                var t = this.to_draw[from][to];
                var labelpos = [0,0];
                this.ctx.strokeStyle = t.strokeStyle;
                this.ctx.lineWidth = t.lineWidth
                this.ctx.font = transition_label_font;
                this.ctx.beginPath();
                if (from == to) {     // draw the loop 
                    cx = t.start[0];
                    cy = t.start[1];
                    this.ctx.arc(cx,cy,state_radius,Math.PI,Math.PI/2);
                    labelpos = [cx+state_radius/1.414, cy-state_radius/1.414];
                } else {
                    this.ctx.moveTo(t.start[0],t.start[1]);
                    if (t.quadr) {  /* draw a quadratic curve */
                        var perp_vec = vecTo(t.start[0],t.start[1],t.end[0],t.end[1],bevel_amount)    
                        perp_vec = perp(perp_vec);
                        this.ctx.quadraticCurveTo(t.midp[0]+perp_vec[0],t.midp[1]+perp_vec[1],t.end[0],t.end[1]);
                    } else 
                        this.ctx.lineTo(t.end[0],t.end[1]);

                    // draw the direction arrow
                    var arrow_vec = vecTo(t.start[0],t.start[1],t.end[0],t.end[1],arrow_length);
                    this.ctx.moveTo(t.end[0],t.end[1])
                    var v45 = vecRotate(arrow_vec,5*Math.PI/4);
                    this.ctx.lineTo(t.end[0]+v45[0],t.end[1]+v45[1]);
                    this.ctx.moveTo(t.end[0],t.end[1])
                    var v45 = vecRotate(arrow_vec,3*Math.PI/4);
                    this.ctx.lineTo(t.end[0]+v45[0],t.end[1]+v45[1]);

                    labelpos = [t.midp[0]-arrow_vec[1],t.midp[1]+arrow_vec[0]];
                }
                // draw the label
                this.ctx.fillText(t.label,labelpos[0], labelpos[1]);
                this.ctx.stroke();
            } 
        }
    };
}
window.onload = function() {

    /* set up event handlers */
    var btn_select = document.getElementById('btn_select');
    var btn_drag = document.getElementById('btn_drag');
    var btn_addstate = document.getElementById('btn_addstate');
    var btn_addtransition = document.getElementById('btn_addtransition');

    btn_select.onclick = function () {
        mode = 'select';
    }
    btn_addstate.onclick = function () {
        mode = 'state';
    }
    btn_addtransition.onclick = function () {
        mode = 'transition';
    }
    btn_drag.onclick = function () {
        mode = 'drag';
    }

    /* initialize gee.js on the canvas */
    var g = new GEE( { width: canvas_w, height: canvas_h, container: document.getElementById(canvas_element) } );
    var R = new Render(g.ctx);
    g.draw = function() {
        g.ctx.font = "10pt Arial";
        g.ctx.clearRect( 0, 0, g.width, g.height );
        g.ctx.fillText( g.frameCount, 10, 10 );

        if (fa.running) {
            R.dirty = true;
            g.ctx.fillText( "RUNNING", 50,10 );
            g.ctx.fillText( fa.input, 10,25 );
            g.ctx.fillText( "^",10,35);
            g.ctx.fillText( "c_state = " + fa.c_state, 100,10);
        }
        R.draw_fa();
    };

    g.mousedown = function() {
        if (fa.running)
            return;
        now = new Date().getTime();
        if (now - last_click < dblClick_delay)
            return g.dblclick();
        last_click = now;
        /* find out what we clicked on */
        var clicked_state = getState(g.mouseX,g.mouseY,fa);
        if (clicked_state != -1) {
            selection_type = 'state';
            selected_transitions = [];
            if (selected_states.indexOf(clicked_state) < 0) {
                if (g.keyPressed && g.keyCode == 16) 
                    selected_states.push(clicked_state);
                else 
                    selected_states = [clicked_state];
             } else {
                if (g.keyPressed && g.keyCode == 16) 
                    /* already selected, unselect */
                    selected_states.remove(clicked_state);
            }
        } else {
            var clicked_transition = getTransition(g.mouseX,g.mouseY,g.ctx);
            if (clicked_transition != -1) {
                selection_type = 'transition';
                selected_states = [];
                if (selected_transitions.indexOf(clicked_transition) < 0) {
                    if (g.keyPressed && g.keyCode == 16) 
                        selected_transitions.push(clicked_transition);
                    else 
                        selected_transitions = [clicked_transition];
                 } else {
                    if (g.keyPressed && g.keyCode == 16) 
                        /* already selected, unselect */
                        selected_transitions.remove(clicked_transition);
                }
            } else {
                selection_type = 'none';
                selection = -1;
                selected_states = [];
                selected_transitions = [];
            }
        }
        if (mode == 'state' && selection_type == 'none') {
            fa.add_state(nxt_state, nxt_state, false, [g.mouseX, g.mouseY], "");
            nxt_state++;
        }
    }
    g.dblclick = function() {
        console.log("DOUBLECLICK");
        if (mode == 'transition') {
            var state = selected_states[selected_states.length-1];
            input = prompt("input trigger for loop transition?");
            if (input) {
                fa.add_transition(state,state,input);
                R.dirty = true;
            }
        }

    }
    g.mouseup = function() {
        /* making a connection */
        if (mode == 'transition')
        {
            var dropped_state = getState(g.mouseX,g.mouseY,fa);
            if (dropped_state != -1 && selected_states.indexOf(dropped_state) < 0)
            {
                input = prompt("input trigger for transition?");
                if (input) {
                    for (var i=0;i<selected_states.length;i++)
                        fa.add_transition(selected_states[i],dropped_state,input);
                    R.dirty = true;
                }
            }
        }
    }
    g.keydown = function() {
        console.log(g.keyCode);
        if (g.key == 'A') {
            for (var i=0;i<selected_states.length;i++)
                fa.states[selected_states[i]].accept = !fa.states[selected_states[i]].accept;
        } else if (g.key == 'T') {
            input = prompt("input trigger for loop transition?");
            if (input)  {
                fa.add_transition(selection,selection,input);
                R.dirty = true;
            }
        }
    }
    g.mousedrag = function() {
        var dx = g.mouseX - g.pmouseX;
        var dy = g.mouseY - g.pmouseY;
        if (mode == 'drag' && selection_type == 'state') {
            for (var i=0; i < selected_states.length; i++) {
                s = fa.states[selected_states[i]];
                s.position = [s.position[0] + dx, s.position[1] + dy];
            }
            R.dirty = true;
        }
/*        g.ctx.beginPath();
        g.ctx.moveTo( g.pmouseX, g.pmouseY );
        g.ctx.lineTo( g.mouseX, g.mouseY );
        g.ctx.stroke(); */
    };
    var process_btn = document.getElementById("process_btn");
    process_btn.onclick = function () {
        if (!fa.running)
        {
            selection_type = 'none';
            selection = -1;
            selected_states = [];
            selected_transitions = [];
            fa.process(document.getElementById("instr").value);
        }
    };
    var import_btn = document.getElementById("import_btn");
    import_btn.onclick = function () {
        var tb = document.getElementById("exp");
        var json = tb.value; 
        var data = JSON.parse(json);
        for (var key in data) {
            fa[key] = data[key];
        }
        for (s_id in fa.states) {
            if (parseInt(s_id) > nxt_state)
                nxt_state = parseInt(s_id) + 1;
        }
    };
    var export_btn = document.getElementById("export_btn");
    export_btn.onclick = function () {
        var tb = document.getElementById("exp");
        tb.value = JSON.stringify(fa);
    };
    fa.complete = function (accept, f_state) {
        console.log("string accepted: " + accept + "\nfinal state: " + f_state);
        if (accept)
            alert("Accepted!");
        else
            alert("Rejected");
    };
};
function getState(x,y,fa) {
    var sel = -1;
    for (var s_id in fa.states) {
        var pos = fa.states[s_id].position;
        dist = Math.sqrt(Math.pow(pos[0]-x,2) + Math.pow(pos[1]-y,2));
        if (dist < state_radius) {
            sel = s_id;
            break;
        }
    }
    return sel;
}
function getTransition(x,y,ctx) {
    var sel = -1;
    var click_thresh = 15;
    for (var from in transition_hits) {
        for (var i=0;i<transition_hits[from].length;i++) {
            var hit = transition_hits[from][i];
            var toClick = vecTo(hit[0],hit[1],x,y);
            var tVec = [hit[2],hit[3]];
            var dist = dot(toClick,tVec) / length(tVec);
            var unit_vec = [tVec[0] / length(tVec), tVec[1] / length(tVec)];
            var proj_vec = [dist*unit_vec[0],dist*unit_vec[1]];
            var perp_vec = [toClick[0] - proj_vec[0],toClick[1] - proj_vec[1]]
            var dist = length(perp_vec);
            console.log("t_click_dist = " + dist);
            if (dist < click_thresh)
            {
                sel = [from,hit[4]];
                break;
            }
        }
    }
    return sel;
}
function dot(vec1,vec2) {
    var dim = vec1.length;
    if (dim != vec2.length)
        return 0;
    var dp = 0;
    for (var i=0;i<dim;i++)
        dp += (vec1[i]*vec2[i]);
    return dp;
}
function length(vec) {
    return distance(0,0,vec[0],vec[1]);
}
function distance(x1,y1,x2,y2)
{
    var vlen = Math.sqrt(Math.pow(x2-x1,2) + Math.pow(y2-y1,2));
    return vlen;
}
function vecTo(x1,y1,x2,y2,dist)
{
    if (dist) {
        var vlen = distance(x1,y1,x2,y2);
        var xf = dist * (x2-x1) / vlen;
        var yf = dist * (y2-y1) / vlen;
    } else {
        var xf = (x2-x1);
        var yf = (y2-y1);
    }
    return [xf,yf];
}
function vecRotate(vec,theta) {
    var st = Math.sin(theta);
    var ct = Math.cos(theta);
    var x = vec[0];
    var y = vec[1];
    var nx = x*ct-y*st;
    var ny = x*st+y*ct;
    return [nx,ny];
}
function perp(vector)
{
    return [-vector[1],vector[0]];
}
function drawCircle(ctx, radius, x, y)
{
    ctx.arc(x,y,radius,0,Math.PI*2);
}
