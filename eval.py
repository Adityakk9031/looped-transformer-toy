"""Evaluate all checkpoints: accuracy table, loops x hops heatmap, test-time
compute curves, logit lens, latency vs R. Everything goes to <out>/summary.md."""
import argparse, os, time
import numpy as np
import torch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from data import sample_batch, path, EVAL_HOPS
from model import param_table
from train import build, get_device

MAX_R = 32
INK, MUTED, SURF = "#0b0b0b", "#898781", "#fcfcfb"
BLUE, ORANGE = "#2a78d6", "#eb6834"
SEQ = LinearSegmentedColormap.from_list("seq", ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"])


def load(out, name, device):
    ck = torch.load(os.path.join(out, f"{name}.pt"), map_location=device)
    m = build(name, ck["cfg"]["gate"]).to(device)
    m.load_state_dict(ck["state"]); m.eval()
    return m, ck["cfg"]


@torch.no_grad()
def acc_standard(m, k, n, device, seed=123):
    b = sample_batch(n, (k,), torch.Generator().manual_seed(seed + k), device)
    return (m(b).argmax(-1) == b["y"]).float().mean().item()


@torch.no_grad()
def acc_all_loops(m, k, n, device, seed=123):
    """Accuracy after every loop R=1..MAX_R from ONE forward pass: running R loops
    then the coda is exactly the prefix of a MAX_R run, so return_all gives every R."""
    b = sample_batch(n, (k,), torch.Generator().manual_seed(seed + k), device)
    outs = m(b, MAX_R, return_all=True)
    return np.array([(o.argmax(-1) == b["y"]).float().mean().item() for o in outs])


def style(ax):
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(MUTED)
    ax.tick_params(colors=MUTED, labelcolor=INK)
    ax.set_facecolor(SURF)


def plot_heatmap(grids, path_png):
    fig, axes = plt.subplots(1, len(grids), figsize=(6.2 * len(grids), 4.6), facecolor=SURF)
    axes = np.atleast_1d(axes)
    for ax, (name, g) in zip(axes, grids.items()):
        sub = g[:16].T                                                      # (hops, R=1..16)
        im = ax.imshow(sub, cmap=SEQ, vmin=0, vmax=1, origin="lower", aspect="auto",
                       extent=(0.5, 16.5, 0.5, len(EVAL_HOPS) + 0.5))
        for ki, k in enumerate(EVAL_HOPS):
            for r in range(16):
                v = sub[ki, r]
                ax.text(r + 1, k, f"{v * 100:.0f}", ha="center", va="center", fontsize=6.5,
                        color="#ffffff" if v > 0.55 else INK)
        ax.axhline(4.5, color=INK, lw=1, ls="--")
        ax.text(16.4, 4.55, "trained on k ≤ 4", ha="right", va="bottom", fontsize=8, color=INK,
                bbox=dict(facecolor=SURF, edgecolor="none", pad=1.5))
        ax.set_title(name, color=INK, fontsize=11, loc="left")
        ax.set_xlabel("loops R at test time", color=INK); ax.set_ylabel("hops k", color=INK)
        ax.set_xticks(range(1, 17)); ax.set_yticks(EVAL_HOPS); style(ax)
    cb = fig.colorbar(im, ax=axes.tolist(), shrink=0.85, pad=0.02)
    cb.set_label("accuracy", color=INK); cb.outline.set_visible(False)
    fig.savefig(path_png, dpi=140, bbox_inches="tight"); plt.close(fig)


def plot_ttc(grids, train_R, path_png):
    fig, axes = plt.subplots(1, len(grids), figsize=(5.6 * len(grids), 3.8), facecolor=SURF, sharey=True)
    axes = np.atleast_1d(axes)
    R = np.arange(1, MAX_R + 1)
    for ax, (name, g) in zip(axes, grids.items()):
        lo, hi = train_R[name]
        ax.axvspan(lo - 0.5, hi + 0.5, color="#f0efec", zorder=0)
        ax.text((lo + hi) / 2, 1.02, "train R", ha="center", fontsize=8, color=MUTED)
        for k, c in ((4, BLUE), (7, ORANGE)):
            y = g[:, EVAL_HOPS.index(k)]
            ax.plot(R, y, color=c, lw=2, marker="o", ms=3.5, label=f"k={k}" + (" (unseen)" if k > 4 else ""))
            ax.text(MAX_R * 1.12, y[-1], f"k={k}", color=INK, fontsize=8, va="center")
        ax.set_xscale("log", base=2); ax.set_xticks([1, 2, 4, 8, 16, 32]); ax.set_xticklabels([1, 2, 4, 8, 16, 32])
        ax.set_xlim(0.8, MAX_R * 1.6)
        ax.set_ylim(0, 1.08); ax.grid(axis="y", color="#e6e5e0", lw=0.6)
        ax.set_title(name, color=INK, fontsize=11, loc="left"); ax.set_xlabel("loops R at test time", color=INK)
        style(ax)
    axes[0].set_ylabel("accuracy", color=INK)
    fig.legend(*axes[0].get_legend_handles_labels(), frameon=False, loc="upper center", ncol=2, bbox_to_anchor=(0.5, 1.06))
    fig.savefig(path_png, dpi=140, bbox_inches="tight"); plt.close(fig)


@torch.no_grad()
def logit_lens(m, device, n_loops=12, k=5, seed=7):
    b = sample_batch(512, (k,), torch.Generator().manual_seed(seed), device)
    outs = m(b, n_loops, return_all=True)
    preds = torch.stack([o.argmax(-1) for o in outs], 1).cpu()             # (B, loops)
    probs = torch.stack([o.softmax(-1).max(-1).values for o in outs], 1).cpu()
    f, s = b["f"].cpu(), b["start"].cpu()
    paths = torch.tensor([path(f[i], s[i], n_loops) for i in range(len(s))])  # (B, loops+1): f^j(start)
    i = 0
    p = paths[i].tolist()
    lines = [f"Example (k={k}): start={p[0]}, true path " + " -> ".join(map(str, p[:k + 1])) + f"  (answer {p[k]})", "",
             "| loop r | prediction | confidence | f^r(start) | f^k(start) |", "|---:|---:|---:|---:|---:|"]
    for r in range(n_loops):
        lines.append(f"| {r + 1} | {preds[i, r]} | {probs[i, r]:.2f} | {p[r + 1]} | {p[k]} |")
    # Over all 512 examples: at loop r, how often is the prediction f^j(start)?
    # If the latent "thoughts" walk the path, the mass should sit on j ~ r early on.
    lines += ["", f"Across 512 k={k} examples: % of predictions equal to f^j(start) at each loop", "",
              "| loop r | " + " | ".join(f"j={j}" for j in range(k + 2)) + " |", "|---:" * (k + 3) + "|"]
    for r in range(n_loops):
        row = [(preds[:, r] == paths[:, j]).float().mean().item() * 100 for j in range(k + 2)]
        lines.append(f"| {r + 1} | " + " | ".join(f"{v:.0f}" for v in row) + " |")
    return "\n".join(lines)


@torch.no_grad()
def latency(m, device, Rs, reps=20):
    b = sample_batch(256, (4,), torch.Generator().manual_seed(0), device)
    sync = torch.mps.synchronize if device == "mps" else torch.cuda.synchronize if device == "cuda" else (lambda: None)
    res = {}
    for R in Rs:
        for _ in range(3):
            m(b, R)
        sync(); t = time.perf_counter()
        for _ in range(reps):
            m(b, R)
        sync(); res[R] = (time.perf_counter() - t) / reps * 1000
    return res


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--quick", action="store_true")
    p.add_argument("--out", default=None, help="default: results/ (results/quick/ with --quick)")
    args = p.parse_args()
    args.out = args.out or ("results/quick" if args.quick else "results")
    device, n = get_device(), (400 if args.quick else 2000)
    names = [x for x in ("shallow", "deep", "looped", "looped_fixed") if os.path.exists(os.path.join(args.out, f"{x}.pt"))]
    models = {x: load(args.out, x, device) for x in names}
    cfg0 = next(iter(models.values()))[1]
    md = ["# Results", "", f"device={device}, {n} examples per cell, training steps={cfg0['steps']}, "
          f"gate={cfg0['gate']}, multi_step={cfg0['multi_step']}", "", "## Parameters vs depth", "", param_table(), ""]

    grids, rows = {}, []
    for x, (m, cfg) in models.items():
        if m.looped:
            grids[x] = np.stack([acc_all_loops(m, k, n, device) for k in EVAL_HOPS], 1)  # (MAX_R, hops)
            for R in sorted({cfg["eval_R"], 16, MAX_R}):
                rows.append((f"{x} @ R={R}", grids[x][R - 1]))
        else:
            rows.append((x, np.array([acc_standard(m, k, n, device) for k in EVAL_HOPS])))
    md += ["## Accuracy (%) by hops k  (k ≥ 5 never seen in training)", "",
           "| model | " + " | ".join(f"k={k}" for k in EVAL_HOPS) + " |", "|---|" + "---:|" * len(EVAL_HOPS)]
    md += [f"| {r} | " + " | ".join(f"{v * 100:.1f}" for v in a) + " |" for r, a in rows]
    print("\n".join(md[-len(rows) - 2:]))

    if grids:
        plot_heatmap(grids, os.path.join(args.out, "acc_vs_loops.png"))
        plot_ttc(grids, {"looped": (2, 8), "looped_fixed": (4, 4)}, os.path.join(args.out, "test_time_compute.png"))
        md += ["", "## Accuracy (%) vs loops R (rows) for each k  — see acc_vs_loops.png, test_time_compute.png"]
        for x, g in grids.items():
            md += ["", f"### {x}", "", "| R | " + " | ".join(f"k={k}" for k in EVAL_HOPS) + " |", "|---:|" + "---:|" * len(EVAL_HOPS)]
            md += [f"| {R} | " + " | ".join(f"{v * 100:.0f}" for v in g[R - 1]) + " |" for R in (1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 24, 32)]
        lens = logit_lens(models["looped"][0], device) if "looped" in models else ""
        md += ["", "## Logit lens (looped, k=5): decode the state after every loop", "", lens]
        print(lens)

    md += ["", "## Latency: ms per forward pass, batch 256", "", "| model | R | ms |", "|---|---:|---:|"]
    for x, (m, _) in models.items():
        for R, ms in latency(m, device, [1, 2, 4, 8, 16, 32] if m.looped else [None]).items():
            md.append(f"| {x} | {R if R else '-'} | {ms:.2f} |")
        if m.looped:
            break                                     # looped & looped_fixed share an architecture
    print("\n".join(md[-8:]))
    with open(os.path.join(args.out, "summary.md"), "w") as fh:
        fh.write("\n".join(md) + "\n")
    print(f"wrote {args.out}/summary.md")


if __name__ == "__main__":
    main()
