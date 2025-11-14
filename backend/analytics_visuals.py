from __future__ import annotations

import os, sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# importing app + models
BASE_DIR = os.path.dirname(__file__)
sys.path.insert(0, BASE_DIR)
from app import app, Earthquake, EarthquakeSRaw, EarthquakeMerged  # type: ignore

# CONFIGURATION
OUT_DIR = os.path.join(BASE_DIR, "reports_highres")
os.makedirs(OUT_DIR, exist_ok=True)

plt.rcParams.update({
    "figure.dpi": 120,
    "savefig.dpi": 300,
    "axes.grid": True,
    "grid.alpha": 0.25,
    "axes.titlesize": 12,
    "axes.labelsize": 11,
    "xtick.labelsize": 10,
    "ytick.labelsize": 10,
})

def save_fig(basename: str):
    png = os.path.join(OUT_DIR, f"{basename}.png")
    svg = os.path.join(OUT_DIR, f"{basename}.svg")
    plt.tight_layout()
    plt.savefig(png, bbox_inches="tight")
    plt.savefig(svg, bbox_inches="tight")
    plt.close()
    print(f"Saved → {png}\nSaved → {svg}")

# LOADING
def to_df(rows, cols):
    return pd.DataFrame([{c: getattr(r, c) for c in cols} for r in rows])

def load_data():
    with app.app_context():
        v_rows = Earthquake.query.all()
        s_rows = EarthquakeSRaw.query.all()
        m_rows = EarthquakeMerged.query.all()

    v = to_df(v_rows, ["date_time","latitude","longitude","depth","mw_mean"])
    v.rename(columns={"date_time":"dt","latitude":"lat_v","longitude":"lon_v","depth":"depth_v","mw_mean":"Mw_v"},inplace=True)

    s = to_df(s_rows, ["event_id","date_time","latitude","longitude","depth","magnitude"])
    s.rename(columns={"event_id":"s_event_id","date_time":"dt_s","latitude":"lat_s","longitude":"lon_s",
                      "depth":"depth_s","magnitude":"mag_s"}, inplace=True)

    m = to_df(m_rows, ["date_time","latitude","longitude","depth","mw_mean","status",
                       "s_event_id","match_dt_sec","match_dist_km"])
    m.rename(columns={"date_time":"dt","latitude":"lat_m","longitude":"lon_m","depth":"depth_m","mw_mean":"Mw_m"},inplace=True)
    return v,s,m


# HELPERS

def annotate_box(ax, text, loc="upper right"):
    ax.text(0.99 if "right" in loc else 0.01,
            0.99 if "upper" in loc else 0.01,
            text, transform=ax.transAxes,
            va="top" if "upper" in loc else "bottom",
            ha="right" if "right" in loc else "left",
            fontsize=9, bbox=dict(boxstyle="round,pad=0.3", fc="white", ec="#888", alpha=0.9))

def percent_within(arr: np.ndarray, thresh: float, le=True) -> float:
    arr = np.asarray(arr, dtype=float)
    arr = arr[~np.isnan(arr)]
    if arr.size == 0: return np.nan
    if le:
        return 100.0 * np.mean(arr <= thresh)
    return 100.0 * np.mean(arr < thresh)

# 1) MATCHING QUALITY HISTOGRAMS (with thresholds & annotation)

def plot_match_quality(m: pd.DataFrame):
    mm = m[m["status"]=="matched"].copy()
    if mm.empty: return
    dt = mm["match_dt_sec"].astype(float).values
    dk = mm["match_dist_km"].astype(float).values

    fig,ax = plt.subplots(1,2,figsize=(11,4.2))
    # Δt
    ax[0].hist(dt, bins=np.arange(-0.5, 3.5, 0.5), edgecolor="black")
    ax[0].axvline(3, ls="--", color="red", lw=1.2, label="3 s limit")
    ax[0].set_xlabel("|Δt| (seconds)")
    ax[0].set_ylabel("Count")
    ax[0].set_title("Time Difference (matched)")
    p_within = percent_within(dt, 3.0, le=True)
    annotate_box(ax[0], f"≤ 3 s: {p_within:.1f}%", "upper right")

    # dist
    ax[1].hist(dk, bins=30, edgecolor="black")
    ax[1].axvline(5, ls="--", color="red", lw=1.2, label="5 km limit")
    ax[1].set_xlabel("Distance (km)")
    ax[1].set_ylabel("Count")
    ax[1].set_title("Spatial Distance (matched)")
    p_within_d = percent_within(dk, 5.0, le=True)
    annotate_box(ax[1], f"≤ 5 km: {p_within_d:.1f}%", "upper right")

    fig.suptitle("Match Quality Distributions", fontsize=13, fontweight="bold")
    save_fig("match_quality_histograms")

# 2) Δt VS DISTANCE (with limits + density)

def plot_dt_vs_distance(m: pd.DataFrame):
    mm = m[m["status"]=="matched"].copy()
    if mm.empty: return
    x = mm["match_dt_sec"].astype(float).values
    y = mm["match_dist_km"].astype(float).values

    plt.figure(figsize=(6.4,5.2))
    plt.hexbin(x, y, gridsize=35, cmap="Blues", mincnt=1)
    cb = plt.colorbar()
    cb.set_label("Count")

    plt.axvline(3, ls="--", color="red", lw=1.2)
    plt.axhline(5, ls="--", color="red", lw=1.2)
    plt.xlabel("|Δt| (seconds)")
    plt.ylabel("Distance (km)")
    plt.title("Temporal vs Spatial Difference (matched)")

    inside = np.mean((x <= 3.0) & (y <= 5.0)) * 100.0
    annotate_box(plt.gca(), f"Inside limits: {inside:.1f}%", "upper right")
    save_fig("scatter_dt_vs_distance")

# 3) DEPTH & MAG COMPARISONS (stats + 1:1 line + fit)

def plot_depth_and_magnitude(v: pd.DataFrame, s: pd.DataFrame, m: pd.DataFrame):
    mm = m[m["status"]=="matched"].copy()
    if mm.empty: return
    mm = mm.merge(s[["s_event_id","depth_s","mag_s"]], on="s_event_id", how="left")
    mm = mm.merge(v[["dt","depth_v","Mw_v"]], on="dt", how="left")

    # DEPTH
    xv = mm["depth_v"].astype(float).values
    ys = mm["depth_s"].astype(float).values
    mask = np.isfinite(xv) & np.isfinite(ys)
    xv, ys = xv[mask], ys[mask]
    if xv.size:
        plt.figure(figsize=(6.2,5.0))
        plt.scatter(xv, ys, s=18, alpha=0.7, edgecolor="black", linewidth=0.2)
        lim = float(max(xv.max(), ys.max())) + 1.0
        lim = max(lim, 5.0)
        plt.plot([0, lim], [0, lim], "k--", lw=1, label="y = x")
        # linear fit
        b1, b0 = np.polyfit(xv, ys, 1)
        xs = np.linspace(0, lim, 100)
        plt.plot(xs, b1*xs + b0, color="#cc5500", lw=1.2, label=f"fit: y={b1:.2f}x+{b0:.2f}")
        mae = np.mean(np.abs(ys - xv))
        bias = np.mean(ys - xv)
        plt.xlabel("MPGV Depth (km)")
        plt.ylabel("Skjálftalísa Depth (km)")
        plt.title("Depth comparison: MPGV vs Skjálftalísa")
        annotate_box(plt.gca(), f"MAE={mae:.2f} km\nBias={bias:+.2f} km", "upper left")
        plt.legend(frameon=True)
        save_fig("depth_comparison")

    # MAGNITUDE
    xv = mm["Mw_v"].astype(float).values
    ys = mm["mag_s"].astype(float).values
    mask = np.isfinite(xv) & np.isfinite(ys)
    xv, ys = xv[mask], ys[mask]
    if xv.size:
        plt.figure(figsize=(6.2,5.0))
        plt.scatter(xv, ys, s=18, alpha=0.7, edgecolor="black", linewidth=0.2)
        lim = float(max(xv.max(), ys.max())) + 0.2
        lim = max(lim, 3.0)
        plt.plot([0, lim], [0, lim], "k--", lw=1, label="y = x")
        b1, b0 = np.polyfit(xv, ys, 1)
        xs = np.linspace(0, lim, 100)
        plt.plot(xs, b1*xs + b0, color="#006d77", lw=1.2, label=f"fit: y={b1:.2f}x+{b0:.2f}")
        mae = np.mean(np.abs(ys - xv))
        bias = np.mean(ys - xv)
        plt.xlabel("MPGV Mw")
        plt.ylabel("Skjálftalísa magnitude")
        plt.title("Magnitude comparison: MPGV vs Skjálftalísa")
        annotate_box(plt.gca(), f"MAE={mae:.2f}\nBias={bias:+.2f}", "upper left")
        plt.legend(frameon=True)
        save_fig("magnitude_comparison")

# 4) SUMMARY (bar with coverage annotation)

def plot_summary_bar(m: pd.DataFrame):
    total = len(m)
    if total==0: return
    matched = int((m["status"]=="matched").sum())
    v_only = int((m["status"]=="v_only").sum())
    coverage = 100.0 * matched / total

    plt.figure(figsize=(6.8,4.2))
    cats = ["Matched", "v_only"]
    vals = [matched, v_only]
    bars = plt.bar(cats, vals, edgecolor="black", color=["#2a9d8f","#89c2d9"])
    plt.ylabel("Number of events")
    plt.title("Merge status counts")
    for b in bars:
        plt.text(b.get_x() + b.get_width()/2, b.get_height() + max(vals)*0.01,
                 f"{int(b.get_height()):,}", ha="center", va="bottom", fontsize=10)
    annotate_box(plt.gca(), f"Coverage = {coverage:.2f}%", "upper right")
    save_fig("merge_status_bar")

# 5) FLOWCHART (clean)

def plot_flowchart():
    from matplotlib.patches import FancyBboxPatch
    plt.figure(figsize=(10,5.5))
    ax = plt.gca(); ax.set_axis_off(); ax.set_xlim(0,100); ax.set_ylim(0,100)

    def box(x,y,w,h,text,fc="white"):
        ax.add_patch(FancyBboxPatch((x,y),w,h, boxstyle="round,pad=0.02,rounding_size=8",
                                    linewidth=1.2, edgecolor="#333", facecolor=fc))
        ax.text(x+w/2, y+h/2, text, ha="center", va="center", fontsize=11, color="#111")

    def arrow(x1,y1,x2,y2,text=None):
        ax.annotate("", xy=(x2,y2), xytext=(x1,y1),
                    arrowprops=dict(arrowstyle="->", linewidth=1.2, color="#333"))
        if text:
            ax.text((x1+x2)/2, (y1+y2)/2 + 2.5, text, ha="center", va="bottom", fontsize=10, color="#444")

    ax.text(50,95,"Earthquake Data Merge Logic", ha="center", va="center", fontsize=14, fontweight="bold", color="#111")
    box(8,70,34,14,"MPGV (v)\n• time dt_v\n• Mw_v\n• lat_v, lon_v, depth_v")
    box(58,70,34,14,"Skjálftalísa (s)\n• time dt_s\n• mag_s\n• lat_s, lon_s, depth_s")
    box(25,45,50,12,"Match criteria:\n|Δt| < 3 s   AND   distance < 5 km   AND   |ΔMw| < 1.0", fc="#f7f7f7")
    box(8,18,34,14,"No candidate → v_only\n(keep MPGV record)")
    box(58,18,34,14,"Exactly one candidate → matched\n(time & Mw ← MPGV)\n(lat/lon/depth ← Skjálftalísa)")

    arrow(25,70,40,57)   # v -> rule
    arrow(75,70,60,57)   # s -> rule
    arrow(50,45,25,32,"0 candidates")
    arrow(50,45,75,32,"= 1 candidate")
    save_fig("flowchart_merge_algorithm")

# MAIN

def main():
    print(f"Output → {OUT_DIR}")
    v,s,m = load_data()
    plot_match_quality(m)
    plot_dt_vs_distance(m)
    plot_depth_and_magnitude(v,s,m)
    plot_summary_bar(m)
    plot_flowchart()
    print("Hurrah it's Done.")

if __name__ == "__main__":
    main()
