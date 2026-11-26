# Tiny looped (recurrent-depth) transformer

**▶ 3-minute narrated explainer: the idea, the puzzle, and every benchmark** (turn sound on)


https://github.com/user-attachments/assets/7fca9a6f-fab9-46b5-aed7-2e12fc1414f0


## What is a looped transformer?
A normal transformer gets depth by stacking *different* layers: 8 layers means 8 sets of weights.
A looped transformer takes one block (or a small stack) and **applies the same weights R times**.
Depth becomes a runtime knob: more loops means more sequential computation, with the same parameters.
Each loop re-reads the original input ("input injection"), so the loop is a refinement process
`h ← core(h, x0)` that iterates on a latent state rather than emitting chain-of-thought tokens.
Train with a random R, then turn R up at test time to "think longer" in latent space.

```
tokens ─► embed ─► PRELUDE ─► x0 ──────────────┐ (re-injected every loop)
                               │               ▼
                               └─► h ─► [ CORE (shared weights) ] ─► h ─► ... R times
                                                                      │
                                                    CODA ─► head ─► answer
```

## How this toy maps to real models
| | prelude | looped core | coda |
|---|---|---|---|
| this repo | 1 block | 1 block × R (R = 2..8 in training) | 1 block |
| GLM-5.4 (as described in the brief) | – | 28 layers run twice | – |
| Inkling 2 Mini (as described in the brief) | 6 layers | 12 layers × 3 | 6 layers |

Both real configurations come from the project brief and haven't been checked against the model cards.
The structure is the same: some unique layers to encode and decode, plus a shared middle that runs
several times. GLM-5.4's per-token write-back gate corresponds to `--gate` here.

## Task
k-hop pointer chasing over 16 nodes. Input: 16 shuffled edge tokens `a → f(a)` plus a query token `(start, k)`.
Output: `f^k(start)`. Each hop depends on the previous one, so the problem needs **sequential depth**.
Train on k ≤ 4; evaluate on k = 1..8.

## Run
```
python -m venv .venv && .venv/bin/pip install -r requirements.txt
python train.py && python eval.py                  # full, ~13 min on an M4 Air -> results/
python train.py --quick && python eval.py --quick  # smoke test, ~2 min       -> results/quick/
python data.py   # brute-force label check      python model.py   # params vs depth table
```

## Outputs (results/)
- `summary.md`: parameter/depth table, accuracy table (model × k), accuracy for every R, logit lens, latency.
- `acc_vs_loops.png`: heatmap, loops R = 1..16 × hops k = 1..8, one panel per looped model.
  A **staircase** (row k lights up once R is large enough) means each loop performs about one hop:
  extra loops buy extra reasoning steps.
- `test_time_compute.png`: accuracy vs R (1..32, log axis) for k = 4 and k = 7. Look for a jump
  (enough loops), a plateau (stable fixed point), or a drop at large R (**overthinking**).
- `train_log.csv`: loss and accuracy per model during training.

## What we found (M4 Air, 4000 steps, accuracy %)
**Depth, not parameters.** Shallow (2 layers) solves k ≤ 2 only (k=3: 45). Deep (8 unique layers, 1.59M params)
solves k ≤ 4. Looped (617k params, R=8) solves k ≤ 4 *and* the unseen k=5 (96).

**Staircase.** In `acc_vs_loops.png`, row k turns on at R ≈ k − 2: the prelude and coda each do about one hop,
and each loop adds one. The logit lens shows the latent state walking the path: at loop 1 the decoded guess is
f³(start) (68%), at loop 2 it is f⁴ (96%), and from loop 3 on it is the answer f⁵, where it stays.

**Where extrapolation breaks.** For k=6 the seed-0 looped model answers f⁵(start) 92% of the time: the hop step
generalises, but the learned *stopping rule* (read from the k embedding) only stretches one step.

**Overthinking, and three ways to treat it** (k=4 accuracy at R=32, i.e. 4–16× the trained loop count):

| training | seed 0 | seed 1 |
|---|---:|---:|
| fixed R=4, final-loop loss | 35 | 46 |
| fixed R=4, final-loop loss, `--gate` | **100** | **98** |
| fixed R=4, `--multi-step` | 50 | – |
| random R ∈ 2..8, final-loop loss | **100** | **100** |
| random R ∈ 2..8, `--gate` | **100** | **100** |
| random R ∈ 2..8, `--multi-step` | **99** | – |

- Random R and the gate each fix overthinking on their own. Multi-step barely helps the fixed model: with R=4,
  its loss only covers loops ≤ 4, so it never learns to hold the answer beyond loop 4.
- Multi-step on random R kept k ≤ 4 stable but cut k=5 extrapolation to 38–41 (logit lens: it mostly stops at
  4 hops). Rewarding "answer at every loop ≥ k" for k ≤ 4 seems to teach "stop after 4" (one seed only).
- Extrapolation is **seed-sensitive**: random-R + gate scored k=5 = 35 on seed 0 but 99 on seed 1;
  ungated random R scored k=6 = 8 vs 58. Gated fixed-R seed 1 is the clearest test-time-compute win:
  k=5/6/7 = 37/11/12 at R=4 → 95/78/50 at R=16. Seed 0 of that model sat at k=5 ≈ 91 for every R.

**Cost.** Batch-256 forward pass: 5 ms (R=1), 17 ms (R=8), 57 ms (R=32); the gate adds about 20% at R=32.
Deep (8 layers) takes 12 ms.

Full numbers: `results/summary.md` (baseline), `results/gate`, `results/ms`, `results/seed1`, `results/gate_seed1`.

**Tip:** keep the Mac plugged in with the lid open. Sleep pauses training mid-run (we lost 15-minute chunks to it).

## Experiments to try
1. **Fixed vs random loops**: compare `looped` (R ~ U{2..8}) with `looped_fixed` (R = 4) in the
   heatmap. Random R forces the core to learn a step that is safe to repeat; fixed R learns a
   4-step program and degrades when run longer.
2. **Gate on/off at R = 32**: `python train.py --gate --models looped,looped_fixed --out results/gate`,
   then `python eval.py --out results/gate`. Compare the `@ R=32` rows with the ungated run.
   The gate lets each token freeze itself (g → 0) once its answer is ready.
3. **Multi-step vs final-loop loss**: `python train.py --multi-step --models looped,looped_fixed --out results/ms`,
   then `python eval.py --out results/ms`. Multi-step loss rewards having the answer at *every*
   loop ≥ k, which explicitly trains "reach the answer, then hold it".
4. **Seeds**: `python train.py --seed 1 --models looped,looped_fixed --out results/seed1`. Single-seed
   extrapolation numbers can swing a lot; check any surprising result on a second seed.
