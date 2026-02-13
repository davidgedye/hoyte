#!/usr/bin/env python3
"""
Measure the background (paper) color of each page by sampling a border region.

Samples pixels within a configurable border width from the edges, computes
a trimmed mean in LAB color space (discarding outlier pixels), and reports
the result per page.

Usage:
    python measure_backgrounds.py cambridge/jpgs/
"""

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np


def get_edge_strips(lab_image, inner=30, outer=150):
    """Return a list of pixel arrays, one per edge (top, bottom, left, right)."""
    h, w = lab_image.shape[:2]
    inner = min(inner, h // 4, w // 4)
    outer = min(outer, h // 4, w // 4)
    return [
        lab_image[inner:outer, inner:-inner].reshape(-1, 3),
        lab_image[-outer:-inner, inner:-inner].reshape(-1, 3),
        lab_image[inner:-inner, inner:outer].reshape(-1, 3),
        lab_image[inner:-inner, -outer:-inner].reshape(-1, 3),
    ]


def _measure_strip(lab_image, inner, outer):
    """Measure one strip configuration. Returns (L, A, B) of paper cluster."""
    edge_strips = get_edge_strips(lab_image, inner, outer)

    edge_medians = [float(np.median(s[:, 0])) for s in edge_strips]
    median_of_medians = float(np.median(edge_medians))

    kept = []
    for strip, med_L in zip(edge_strips, edge_medians):
        if med_L <= median_of_medians + 10:
            kept.append(strip)
    if not kept:
        ranked = sorted(zip(edge_medians, edge_strips))
        kept = [s for _, s in ranked[:2]]

    pooled = np.concatenate(kept).astype(np.float32)

    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(
        pooled, 2, None, criteria, 5, cv2.KMEANS_PP_CENTERS
    )
    paper_cluster = 0 if centers[0][0] >= centers[1][0] else 1
    paper_pixels = pooled[labels.ravel() == paper_cluster]
    return (
        float(np.mean(paper_pixels[:, 0])),
        float(np.mean(paper_pixels[:, 1])),
        float(np.mean(paper_pixels[:, 2])),
    )


def measure_background(image_path, inner=30, outer=150):
    """Measure the background (paper) color from inner border strips.

    Samples each edge independently, rejects scanner-white edges, and
    uses k-means to find the paper cluster. If the result looks like
    scanner white (L>245 and B<132), retries with progressively deeper
    strips until real paper is found.

    Returns (L, A, B) float values.
    """
    image = cv2.imread(str(image_path))
    if image is None:
        return None

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    strip_width = outer - inner
    h, w = lab.shape[:2]
    max_inner = min(h, w) // 3

    for attempt_inner in range(inner, max_inner, 100):
        attempt_outer = attempt_inner + strip_width
        L, A, B = _measure_strip(lab, attempt_inner, attempt_outer)
        if L < 245 or B > 132:
            return L, A, B
    return L, A, B


def lab_to_rgb(L, A, B):
    """Convert a single LAB color to RGB (0-255)."""
    lab_pixel = np.array([[[L, A, B]]], dtype=np.uint8)
    bgr = cv2.cvtColor(lab_pixel, cv2.COLOR_LAB2BGR)
    b, g, r = bgr[0, 0]
    return int(r), int(g), int(b)


def main():
    parser = argparse.ArgumentParser(
        description="Measure background color of scanned pages."
    )
    parser.add_argument("input", help="Directory of cropped page JPGs")
    parser.add_argument(
        "--inner", type=int, default=30,
        help="Skip this many pixels from edge (default: 30)"
    )
    parser.add_argument(
        "--outer", type=int, default=150,
        help="Sample up to this many pixels from edge (default: 150)"
    )

    args = parser.parse_args()
    input_dir = Path(args.input)

    if not input_dir.is_dir():
        print(f"Error: {input_dir} is not a directory")
        sys.exit(1)

    extensions = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp"}
    image_files = sorted([
        f for f in input_dir.iterdir()
        if f.suffix.lower() in extensions
    ])

    if not image_files:
        print(f"No image files found in {input_dir}")
        sys.exit(1)

    print(f"Measuring {len(image_files)} images (strip={args.inner}-{args.outer}px from edge)")
    print()
    print(f"{'File':<20} {'L':>6} {'A':>6} {'B':>6}    {'R':>3} {'G':>3} {'B_':>3}   {'Hex'}")
    print("-" * 72)

    all_lab = []

    for img_path in image_files:
        result = measure_background(img_path, args.inner, args.outer)
        if result is None:
            print(f"{img_path.name:<20} ERROR")
            continue

        L, A, B = result
        all_lab.append((L, A, B))
        r, g, b = lab_to_rgb(round(L), round(A), round(B))
        hex_color = f"#{r:02x}{g:02x}{b:02x}"
        print(f"{img_path.name:<20} {L:6.1f} {A:6.1f} {B:6.1f}    {r:3d} {g:3d} {b:3d}   {hex_color}")

    if all_lab:
        all_lab = np.array(all_lab)
        med_L, med_A, med_B = np.median(all_lab, axis=0)
        mean_L, mean_A, mean_B = np.mean(all_lab, axis=0)
        std_L, std_A, std_B = np.std(all_lab, axis=0)

        print("-" * 72)
        r, g, b = lab_to_rgb(round(med_L), round(med_A), round(med_B))
        hex_color = f"#{r:02x}{g:02x}{b:02x}"
        print(f"{'Median':<20} {med_L:6.1f} {med_A:6.1f} {med_B:6.1f}    {r:3d} {g:3d} {b:3d}   {hex_color}")

        r, g, b = lab_to_rgb(round(mean_L), round(mean_A), round(mean_B))
        hex_color = f"#{r:02x}{g:02x}{b:02x}"
        print(f"{'Mean':<20} {mean_L:6.1f} {mean_A:6.1f} {mean_B:6.1f}    {r:3d} {g:3d} {b:3d}   {hex_color}")

        print(f"{'Std dev':<20} {std_L:6.1f} {std_A:6.1f} {std_B:6.1f}")

        # Show the range
        min_L, min_A, min_B = np.min(all_lab, axis=0)
        max_L, max_A, max_B = np.max(all_lab, axis=0)
        print(f"{'Range':<20} {min_L:5.1f}-{max_L:<5.1f} {min_A:5.1f}-{max_A:<5.1f} {min_B:5.1f}-{max_B:<5.1f}")


if __name__ == "__main__":
    main()
