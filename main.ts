// Sokoban at the push optimum, room by room: a box pushed out of its room can never return, so a
// level's optimum is the sum of its rooms'. Each room (<= 4 boxes) is solved by breadth-first search
// over pushes (state: box squares + the player's reachable region), pruned by dead squares and
// frozen 2x2 blocks — neither removes a solvable state, so the first solution met is push-optimal.
// Budgets count states, never the clock; ties break by square order: runs are byte-identical.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const D = [[0, -1, 'u', 'U'], [0, 1, 'd', 'D'], [-1, 0, 'l', 'L'], [1, 0, 'r', 'R']];
const CAP = 1500000;

function parse(text) {
  const rows = text.split('\n').filter((r) => r.length > 0);
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const wall = new Uint8Array(w * h).fill(1), goals = [], boxes = [];
  let player = -1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x], i = y * w + x;
      if (ch === '#') continue;
      wall[i] = 0;
      if ('.*+'.includes(ch)) goals.push(i);
      if ('$*'.includes(ch)) boxes.push(i);
      if ('@+'.includes(ch)) player = i;
    }
  });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!x || !y || x === w - 1 || y === h - 1) wall[y * w + x] = 1;
  return { w, wall, goals, boxes: boxes.sort((a, b) => a - b), player };
}

// Squares from which a lone box can be pushed onto some goal (reverse pulls from the goals).
function live(w, wall, goals) {
  const lv = new Uint8Array(wall.length), q = [...goals];
  for (const g of goals) lv[g] = 1;
  for (let i = 0; i < q.length; i++) {
    const x = q[i];
    for (const [dx, dy] of D) {
      const d = dy * w + dx, y = x - d;
      if (!wall[y] && !wall[y - d] && !lv[y]) { lv[y] = 1; q.push(y); }
    }
  }
  return lv;
}

// Flood the player's region from `from` (boxes in `occ` block); return its lowest square.
function reach(w, wall, occ, from, seen, stamp, stack) {
  let low = from, n = 0;
  stack[n++] = from; seen[from] = stamp;
  while (n > 0) {
    const p = stack[--n];
    if (p < low) low = p;
    for (const q of [p - w, p + w, p - 1, p + 1])
      if (!wall[q] && !occ[q] && seen[q] !== stamp) { seen[q] = stamp; stack[n++] = q; }
  }
  return low;
}

// Is the box just pushed to `t` in a frozen 2x2 of walls/boxes with a box off its goal?
function frozen(w, wall, occ, goal, t) {
  for (const a of [t, t - 1, t - w, t - w - 1]) {
    const b = a + 1, c = a + w, d = c + 1;
    if (!(wall[a] || occ[a]) || !(wall[b] || occ[b]) || !(wall[c] || occ[c]) || !(wall[d] || occ[d])) continue;
    if ((occ[a] && !goal[a]) || (occ[b] && !goal[b]) || (occ[c] && !goal[c]) || (occ[d] && !goal[d])) return true;
  }
  return false;
}

// Shortest walk from `from` to `to` around walls and boxes, lower LURD letters.
function walk(w, wall, occ, from, to) {
  if (from === to) return '';
  const prev = new Int32Array(wall.length).fill(-1), how = [], q = [from];
  prev[from] = from;
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    if (p === to) break;
    for (const [dx, dy, letter] of D) {
      const s = p + dy * w + dx;
      if (wall[s] || occ[s] || prev[s] !== -1) continue;
      prev[s] = p; how[s] = letter; q.push(s);
    }
  }
  let s = '';
  for (let p = to; p !== from; p = prev[p]) s = how[p] + s;
  return s;
}

// Push-optimal solution of one (sub-)level: the move string, or null when the state budget ends.
function solvePush(w, wall, goals, boxes0, player0) {
  const size = wall.length, goal = new Uint8Array(size);
  for (const g of goals) goal[g] = 1;
  const lv = live(w, wall, goals);
  if (boxes0.some((b) => !lv[b])) return null;
  const occ = new Uint8Array(size), seen = new Int32Array(size), mark = new Int32Array(size), stack = new Int32Array(size);
  let stamp = 0;
  const solved = (bs) => bs.every((b) => goal[b]);
  const keyOf = (bs, low) => { let k = low; for (const b of bs) k = k * size + b; return k; };
  const SB = [boxes0], SP = [player0], PAR = [-1], index = new Map();
  for (const b of boxes0) occ[b] = 1;
  index.set(keyOf(boxes0, reach(w, wall, occ, player0, seen, ++stamp, stack)), 0);
  for (const b of boxes0) occ[b] = 0;
  let found = solved(boxes0) ? 0 : -1;
  for (let head = 0; found < 0 && head < SB.length; head++) {
    const boxes = SB[head];
    for (const b of boxes) occ[b] = 1;
    reach(w, wall, occ, SP[head], seen, ++stamp, stack);
    const here = stamp;
    for (let bi = 0; bi < boxes.length && found < 0; bi++) {
      const b = boxes[bi];
      for (const [dx, dy] of D) {
        const d = dy * w + dx, t = b + d;
        if (seen[b - d] !== here || wall[t] || occ[t] || !lv[t]) continue;
        occ[b] = 0; occ[t] = 1;
        const froz = frozen(w, wall, occ, goal, t);
        let key = -1, next = null;
        if (!froz) {
          next = boxes.slice(); next[bi] = t; next.sort((a, c) => a - c);
          key = keyOf(next, reach(w, wall, occ, b, mark, ++stamp, stack));
        }
        occ[t] = 0; occ[b] = 1;
        if (froz || index.has(key)) continue;
        if (SB.length >= CAP) return null;
        index.set(key, SB.length);
        SB.push(next); SP.push(b); PAR.push(head);
        if (solved(next)) found = SB.length - 1;
      }
    }
    for (const b of boxes) occ[b] = 0;
  }
  if (found < 0) return null;
  const path = [];
  for (let s = found; s > 0; s = PAR[s]) path.push(s);
  path.reverse();
  let moves = '', player = player0, boxes = boxes0;
  for (const s of path) {
    const nb = SB[s];
    const from = boxes.find((b) => !nb.includes(b)), to = nb.find((b) => !boxes.includes(b)), d = to - from;
    const dir = D.find(([dx, dy]) => dy * w + dx === d);
    for (const b of boxes) occ[b] = 1;
    moves += walk(w, wall, occ, player, from - d);
    for (const b of boxes) occ[b] = 0;
    moves += dir[3];
    player = from; boxes = nb;
  }
  return moves;
}

// The level's rooms: cut the hallway (dead squares of the player's row) out of the floor, flood.
function roomsOf({ w, wall, goals, boxes, player }) {
  const lv = live(w, wall, goals), row = Math.floor(player / w), cut = new Uint8Array(wall.length);
  for (let i = row * w; i < (row + 1) * w; i++) if (!wall[i] && !lv[i]) cut[i] = 1;
  if (boxes.some((b) => cut[b])) return null;
  const part = new Int32Array(wall.length).fill(-1), rooms = [];
  for (let s = 0; s < wall.length; s++) {
    if (wall[s] || cut[s] || part[s] >= 0) continue;
    const sq = [s];
    part[s] = rooms.length;
    for (let i = 0; i < sq.length; i++)
      for (const [dx, dy] of D) {
        const q = sq[i] + dy * w + dx;
        if (!wall[q] && !cut[q] && part[q] < 0) { part[q] = rooms.length; sq.push(q); }
      }
    rooms.push({ boxes: [], goals: [], done: false });
  }
  for (const b of boxes) rooms[part[b]].boxes.push(b);
  for (const g of goals) if (part[g] >= 0) rooms[part[g]].goals.push(g);
  if (goals.some((g) => part[g] < 0) || rooms.some((r) => r.boxes.length !== r.goals.length)) return null;
  return rooms.filter((r) => r.boxes.length > 0);
}

function solve(text) {
  const { w, wall, goals, boxes, player } = parse(text);
  const rooms = roomsOf({ w, wall, goals, boxes, player });
  if (rooms === null) return solvePush(w, wall, goals, boxes, player) ?? '';
  let at = player, moves = '';
  for (const room of rooms) {
    const w2 = wall.slice();
    for (const o of rooms) if (o !== room) for (const b of o.done ? o.goals : o.boxes) w2[b] = 1;
    const m = solvePush(w, w2, room.goals, room.boxes, at); // roomsOf collects both in square order
    if (m === null) return '';
    moves += m;
    for (const ch of m.toLowerCase()) at += ch === 'u' ? -w : ch === 'd' ? w : ch === 'l' ? -1 : 1;
    room.done = true;
  }
  return moves;
}

for (const id of readdirSync(I).sort()) {
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'solution.txt'), `${solve(readFileSync(join(I, id, 'level.txt'), 'utf8'))}\n`);
}
