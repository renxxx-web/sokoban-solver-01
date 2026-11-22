# sokoban-solver-01 — push-optimal Sokoban, room by room

[![Competition](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/c/sokoban-solver-01-run-20261121)
[![Rank](https://make.fun/badge/sokoban-solver-01-run-20261121/renxxx-web/sokoban-solver-01/rank.svg)](https://make.fun/c/sokoban-solver-01-run-20261121)
[![Reward](https://make.fun/badge/sokoban-solver-01-run-20261121/renxxx-web/sokoban-solver-01/reward.svg)](https://make.fun/c/sokoban-solver-01-run-20261121)

Entry for make.fun's [Build the best Sokoban solver, 21 November 2026](https://make.fun/c/sokoban-solver-01-run-20261121) ($100). One dependency-free `main.ts` (Node 22) answers every 5-level set in exactly P\* pushes — the provable optimum, 1,000 points a level.

**How.** A generated level is independent rooms off a hallway, and a box pushed out of its room can never return, so the level optimum is the sum of its rooms'. Each room (≤ 4 boxes) is solved by breadth-first search over pushes — state: box squares + the player's reachable region — pruned by dead squares and frozen 2×2 blocks; neither prune removes a solvable state, so the first solution met is push-optimal. Budgets count states, never the clock, so two runs write byte-identical answers.

**Local numbers** (the kit's official grade-local): this entry **1,000,000 / 1,000,000** on the practice set; house baseline plain-astar 1.0.0 scores 200,000. Robustness: 70 freshly drawn generator sets (350 levels), every level solved in exactly P\* pushes; worst room search 8,525 states against a 1,500,000 budget; about a second per set against a 60-second wall.

**Run:** `MAKEFUN_INPUT_DIR=<set>/input MAKEFUN_OUTPUT_DIR=<out> node main.ts`

MIT — see [LICENSE](LICENSE).
