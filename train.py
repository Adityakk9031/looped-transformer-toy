"""Train shallow, deep, looped (random R) and looped-fixed (R=4) models."""
import argparse, csv, math, os, random, time
import numpy as np
import torch
import torch.nn.functional as F
from data import sample_batch, TRAIN_HOPS
from model import Standard, Looped, n_params


def get_device():
    if torch.backends.mps.is_available():
        return "mps"
    return "cuda" if torch.cuda.is_available() else "cpu"


def seed_all(s):
    random.seed(s); np.random.seed(s); torch.manual_seed(s)


def build(name, gate=False):
    return {"shallow": lambda: Standard(2), "deep": lambda: Standard(8),
            "looped": lambda: Looped(gate), "looped_fixed": lambda: Looped(gate)}[name]()


def sample_R(name, rng):
    """How many loops to run on this batch."""
    if name == "looped":
        return rng.randint(2, 8)   # stochastic depth: the core must work for ANY loop count
    if name == "looped_fixed":
        return 4                   # ablation: always exactly 4 loops
    return None


def compute_loss(model, b, R, multi_step):
    if not model.looped:
        logits = model(b)
        return F.cross_entropy(logits, b["y"]), logits
    if not multi_step:
        # Final-loop loss: only the answer after the LAST loop matters. The model is
        # free to use the loops however it likes (including going off-track and
        # coming back), as long as it lands on the answer at loop R.
        logits = model(b, R)
        return F.cross_entropy(logits, b["y"]), logits
    # Multi-step loss: decode EVERY loop and average the loss over loops r >= k.
    # This says "once you've had enough loops to do k hops, have the answer AND
    # KEEP IT". It directly rewards a stable fixed point after the answer is
    # reached, i.e. it trains against overthinking.
    outs = model(b, R, return_all=True)                                 # R x (B, N)
    L = torch.stack([F.cross_entropy(o, b["y"], reduction="none") for o in outs], 1)  # (B, R)
    r = torch.arange(1, R + 1, device=L.device)
    mask = (r[None] >= b["k"][:, None]).float()
    mask[:, -1] = 1.0                       # if R < k there is no valid loop: use the final one
    return ((L * mask).sum(1) / mask.sum(1)).mean(), outs[-1]


def lr_at(step, total, warmup, base):
    if step < warmup:
        return base * (step + 1) / warmup
    p = (step - warmup) / max(1, total - warmup)
    return base * (0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * p)))     # cosine to 10%


def train_one(name, args, device, writer):
    seed_all(args.seed)
    model = build(name, args.gate).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01, betas=(0.9, 0.98))
    gen, rng = torch.Generator().manual_seed(args.seed), random.Random(args.seed)
    t0, warmup = time.time(), max(1, int(0.05 * args.steps))
    for step in range(args.steps):
        for g in opt.param_groups:
            g["lr"] = lr_at(step, args.steps, warmup, args.lr)
        b = sample_batch(args.batch, TRAIN_HOPS, gen, device)
        R = sample_R(name, rng)
        loss, logits = compute_loss(model, b, R, args.multi_step)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        if step % args.log_every == 0 or step == args.steps - 1:
            acc = (logits.argmax(-1) == b["y"]).float().mean().item()
            writer.writerow([name, step, f"{loss.item():.4f}", f"{acc:.4f}", R or "", f"{time.time() - t0:.1f}"])
            if step % (args.log_every * 5) == 0 or step == args.steps - 1:
                print(f"  {name:13s} step {step:5d}  loss {loss.item():.3f}  acc {acc:.3f}  R={R}  {time.time() - t0:.0f}s")
    cfg = dict(name=name, gate=args.gate, multi_step=args.multi_step, steps=args.steps,
               eval_R=8 if name == "looped" else 4 if name == "looped_fixed" else None)
    torch.save({"state": model.state_dict(), "cfg": cfg}, os.path.join(args.out, f"{name}.pt"))
    print(f"  saved {name}.pt  ({n_params(model):,} params, {time.time() - t0:.0f}s)")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--quick", action="store_true", help="tiny run (<= 2 min total incl. eval)")
    p.add_argument("--steps", type=int, default=None)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--batch", type=int, default=256)
    p.add_argument("--gate", action="store_true", help="per-token write-back gate in looped models")
    p.add_argument("--multi-step", action="store_true", help="loss averaged over loops >= k")
    p.add_argument("--models", default="shallow,deep,looped,looped_fixed")
    p.add_argument("--out", default=None, help="default: results/ (results/quick/ with --quick)")
    p.add_argument("--seed", type=int, default=0)
    args = p.parse_args()
    args.steps = args.steps or (550 if args.quick else 4000)
    args.log_every = 20 if args.quick else 50
    args.out = args.out or ("results/quick" if args.quick else "results")
    os.makedirs(args.out, exist_ok=True)
    device = get_device()
    print(f"device={device} steps={args.steps} gate={args.gate} multi_step={args.multi_step}")
    with open(os.path.join(args.out, "train_log.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["model", "step", "loss", "acc", "R", "seconds"])
        for name in args.models.split(","):
            train_one(name, args, device, w)
            fh.flush()


if __name__ == "__main__":
    main()
