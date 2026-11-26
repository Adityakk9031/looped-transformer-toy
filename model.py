"""Shallow / Deep / Looped transformers that share one Block class."""
import torch
import torch.nn as nn
import torch.nn.functional as F
from data import N

D, HEADS = 128, 4


class Block(nn.Module):
    """Pre-RMSNorm block, bidirectional attention (input is a set + a query), MLP x4."""
    def __init__(self, d=D, heads=HEADS):
        super().__init__()
        self.heads = heads
        self.n1, self.n2 = nn.RMSNorm(d), nn.RMSNorm(d)
        self.qkv = nn.Linear(d, 3 * d, bias=False)
        self.proj = nn.Linear(d, d, bias=False)
        self.mlp = nn.Sequential(nn.Linear(d, 4 * d), nn.GELU(), nn.Linear(4 * d, d))

    def forward(self, x):
        B, T, C = x.shape
        q, k, v = self.qkv(self.n1(x)).view(B, T, 3, self.heads, C // self.heads).permute(2, 0, 3, 1, 4)
        a = F.scaled_dot_product_attention(q, k, v)            # no mask: every token sees every token
        x = x + self.proj(a.transpose(1, 2).reshape(B, T, C))
        return x + self.mlp(self.n2(x))


class Embed(nn.Module):
    """Edge token = E_src[a] + E_dst[f(a)]; query token = E_node[start] + E_hops[k].
    E_hops[k] = k * w + b (linear in k) rather than a lookup table: a table would
    leave rows k=5..8 untrained (random) and make extrapolation meaningless."""
    def __init__(self, d=D):
        super().__init__()
        self.src, self.dst, self.node = nn.Embedding(N, d), nn.Embedding(N, d), nn.Embedding(N, d)
        self.hop_w = nn.Parameter(torch.randn(d) * 0.02)
        self.hop_b = nn.Parameter(torch.randn(d) * 0.02)

    def forward(self, b):
        edges = self.src(b["src"]) + self.dst(b["dst"])                        # (B, N, d)
        query = self.node(b["start"]) + b["k"][:, None].float() * self.hop_w + self.hop_b
        return torch.cat([edges, query[:, None]], dim=1)                      # query is LAST token


class Head(nn.Module):
    def __init__(self, d=D):
        super().__init__()
        self.norm, self.out = nn.RMSNorm(d), nn.Linear(d, N)

    def forward(self, h):
        return self.out(self.norm(h[:, -1]))                                  # read query position


class Standard(nn.Module):
    """Ordinary transformer: n_layers UNIQUE blocks. Depth = parameters."""
    looped = False

    def __init__(self, n_layers):
        super().__init__()
        self.embed, self.head = Embed(), Head()
        self.blocks = nn.ModuleList(Block() for _ in range(n_layers))

    def forward(self, b, n_loops=None, return_all=False):
        h = self.embed(b)
        for blk in self.blocks:
            h = blk(h)
        return self.head(h)

    def depth(self, n_loops=None):
        return len(self.blocks)


class Looped(nn.Module):
    """prelude -> core x R (SHARED weights) -> coda -> head.

    The core block is ONE set of weights. Calling it R times gives R layers of
    depth for the parameter cost of one: depth is now a runtime knob, not an
    architectural constant.
    """
    looped = True

    def __init__(self, gate=False):
        super().__init__()
        self.embed, self.head = Embed(), Head()
        self.prelude, self.core, self.coda = Block(), Block(), Block()
        # Input injection: a learned map of the prelude output x0, re-added at EVERY
        # loop. Without it, the question (start node, k) and the edge list exist only
        # in h; after many loops, h has been overwritten by intermediate thoughts and
        # the core can "forget what it was asked". Huginn and Parcae feed x0 in at
        # every iteration for the same reason: each loop sees (state, question).
        self.inject = nn.Linear(D, D, bias=False)
        # Optional per-token write-back gate (GLM-5.4-style): each token decides how
        # much of this loop's update to keep. g~0 = "I'm done, freeze me", which lets
        # tokens hold a fixed point instead of drifting when R >> what they need.
        self.gate = nn.Linear(2 * D, 1) if gate else None

    def loop_step(self, h, inj):
        """One iteration of the recurrent core: h_{r} -> h_{r+1}."""
        u = h + inj                          # core sees state + question
        new_h = h + (self.core(u) - u)       # apply core's UPDATE to h only. If we kept
                                             # core(u) itself, inj would pile up in the
                                             # residual stream once per loop (R * inj).
        if self.gate is not None:
            g = torch.sigmoid(self.gate(torch.cat([h, new_h], -1)))   # (B, T, 1), per token
            new_h = h + g * (new_h - h)      # interpolate old state -> new state
        return new_h

    def decode(self, h):
        return self.head(self.coda(h))

    def forward(self, b, n_loops=4, return_all=False):
        x0 = self.prelude(self.embed(b))     # encode the problem once
        inj = self.inject(x0)                # the "question", constant across loops
        h, states = x0, []
        for _ in range(n_loops):             # <- the loop: SAME weights every pass
            h = self.loop_step(h, inj)
            states.append(h)
        if return_all:                       # "logit lens": decode every loop's state
            return [self.decode(s) for s in states]
        return self.decode(h)

    def depth(self, n_loops):
        return 1 + n_loops + 1               # prelude + R core visits + coda


def n_params(m):
    return sum(p.numel() for p in m.parameters())


def param_table():
    rows = [("shallow (2 blocks)", Standard(2), None), ("deep (8 blocks)", Standard(8), None)]
    rows += [(f"looped R={r}", Looped(), r) for r in (4, 8, 16)]
    rows += [(f"looped+gate R={r}", Looped(gate=True), r) for r in (4, 8, 16)]
    lines = ["| model | unique params | effective depth (layer visits/token) |", "|---|---:|---:|"]
    for name, m, r in rows:
        lines.append(f"| {name} | {n_params(m):,} | {m.depth(r)} |")
    return "\n".join(lines)


if __name__ == "__main__":
    print(param_table())
