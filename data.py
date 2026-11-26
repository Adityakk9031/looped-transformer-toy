"""k-hop pointer chasing, generated on the fly.

Each example: a random permutation f over N nodes, given as a SHUFFLED SET of
N edge tokens (a -> f(a)), plus one query token (start, k).
Target: f^k(start), a 16-way classification read at the query position.
"""
import torch

N = 16                        # number of nodes
TRAIN_HOPS = (1, 2, 3, 4)
EVAL_HOPS = tuple(range(1, 9))  # 5..8 = extrapolation


def sample_batch(B, hops, gen=None, device="cpu"):
    """Returns a dict of LongTensors on `device`:
    src, dst : (B, N)  edge list in shuffled order, dst[b, i] = f(src[b, i])
    start, k : (B,)    query
    y        : (B,)    f^k(start)
    f        : (B, N)  the permutation itself (only for analysis / logit lens)
    """
    f = torch.argsort(torch.rand(B, N, generator=gen), dim=1)      # random permutation
    src = torch.argsort(torch.rand(B, N, generator=gen), dim=1)    # shuffled token order
    dst = torch.gather(f, 1, src)
    start = torch.randint(0, N, (B,), generator=gen)
    hops = torch.as_tensor(hops)
    k = hops[torch.randint(0, len(hops), (B,), generator=gen)]
    y = start.clone()
    for step in range(int(k.max())):                               # chase pointers
        y = torch.where(k > step, torch.gather(f, 1, y[:, None])[:, 0], y)
    out = dict(src=src, dst=dst, start=start, k=k, y=y, f=f)
    return {n: t.to(device) for n, t in out.items()}


def path(f_row, start, steps):
    """[start, f(start), f^2(start), ...] for one example (python ints)."""
    p = [int(start)]
    for _ in range(steps):
        p.append(int(f_row[p[-1]]))
    return p


def check_labels(batch):
    """Brute force: rebuild f from the *edge tokens* (not from batch['f']) with a
    python dict, chase k pointers, compare against batch['y']."""
    src, dst = batch["src"].cpu().tolist(), batch["dst"].cpu().tolist()
    for b in range(len(src)):
        edges = dict(zip(src[b], dst[b]))
        assert len(edges) == N and sorted(edges.values()) == list(range(N)), "not a permutation"
        node = int(batch["start"][b])
        for _ in range(int(batch["k"][b])):
            node = edges[node]
        assert node == int(batch["y"][b]), f"bad label at {b}"
    return True


if __name__ == "__main__":
    g = torch.Generator().manual_seed(0)
    b = sample_batch(4096, EVAL_HOPS, g)
    print("labels ok:", check_labels(b))
    # Chance-level reference: how often f^k(start) == start (short cycles).
    for k in EVAL_HOPS:
        m = b["k"] == k
        print(f"k={k}: P(answer == start) = {(b['y'][m] == b['start'][m]).float().mean():.3f}")
