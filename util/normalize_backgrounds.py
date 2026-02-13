#!/usr/bin/env python3
"""
Normalize page background colors to a target color.

Measures each page's background by sampling the brightest cluster of border
pixels in LAB space, then shifts the entire image so its background matches
the target.

Usage:
    python normalize_backgrounds.py input_dir/ output_dir/ --target-lab 253 125 136
    python normalize_backgrounds.py input_dir/ --inplace --target-lab 253 125 136
"""

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np


def get_edge_strips(lab_image, inner=30, outer=150):
    """Return a list of pixel arrays, one per edge (top, bottom, left, right).

    Each strip spans from inner to outer pixels from that edge, inset by
    inner on the perpendicular axis to avoid corners.
    """
    h, w = lab_image.shape[:2]
    inner = min(inner, h // 4, w // 4)
    outer = min(outer, h // 4, w // 4)
    return [
        lab_image[inner:outer, inner:-inner].reshape(-1, 3),       # top
        lab_image[-outer:-inner, inner:-inner].reshape(-1, 3),     # bottom
        lab_image[inner:-inner, inner:outer].reshape(-1, 3),       # left
        lab_image[inner:-inner, -outer:-inner].reshape(-1, 3),     # right
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


def measure_background(lab_image, inner=30, outer=150):
    """Measure background (paper) color from inner border strips.

    Samples each edge independently, rejects scanner-white edges, and
    uses k-means to find the paper cluster. If the result looks like
    scanner white (L>245 and B<132), retries with progressively deeper
    strips until real paper is found.
    """
    strip_width = outer - inner
    h, w = lab_image.shape[:2]
    max_inner = min(h, w) // 3

    for attempt_inner in range(inner, max_inner, 100):
        attempt_outer = attempt_inner + strip_width
        L, A, B = _measure_strip(lab_image, attempt_inner, attempt_outer)
        if L < 245 or B > 132:
            return L, A, B
    return L, A, B


def normalize_image(image, target_lab, inner=30, outer=150):
    """Shift an image's colors so its background matches target_lab."""
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    bg_L, bg_A, bg_B = measure_background(lab, inner, outer)
    target_L, target_A, target_B = target_lab

    shift_L = target_L - bg_L
    shift_A = target_A - bg_A
    shift_B = target_B - bg_B

    lab = lab.astype(np.float64)
    lab[:, :, 0] = np.clip(lab[:, :, 0] + shift_L, 0, 255)
    lab[:, :, 1] = np.clip(lab[:, :, 1] + shift_A, 0, 255)
    lab[:, :, 2] = np.clip(lab[:, :, 2] + shift_B, 0, 255)
    lab = lab.round().astype(np.uint8)

    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR), (shift_L, shift_A, shift_B)


def main():
    parser = argparse.ArgumentParser(
        description="Normalize page backgrounds to a target color."
    )
    parser.add_argument("input", help="Input directory of cropped page JPGs")
    parser.add_argument("output", nargs="?", help="Output directory")
    parser.add_argument(
        "--inplace", "-i", action="store_true",
        help="Overwrite original files"
    )
    parser.add_argument(
        "--target-lab", type=float, nargs=3, required=True,
        metavar=("L", "A", "B"),
        help="Target background color in LAB (e.g. 253 125 136)"
    )
    parser.add_argument(
        "--inner", type=int, default=30,
        help="Skip this many pixels from edge (default: 30)"
    )
    parser.add_argument(
        "--outer", type=int, default=150,
        help="Sample up to this many pixels from edge (default: 150)"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Print detailed progress"
    )

    args = parser.parse_args()
    input_dir = Path(args.input)

    if not input_dir.is_dir():
        print(f"Error: {input_dir} is not a directory")
        sys.exit(1)

    if args.output:
        output_dir = Path(args.output)
    elif args.inplace:
        output_dir = input_dir
    else:
        output_dir = input_dir.parent / (input_dir.name + "_corrected")

    output_dir.mkdir(parents=True, exist_ok=True)

    extensions = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp"}
    image_files = sorted([
        f for f in input_dir.iterdir()
        if f.suffix.lower() in extensions
    ])

    if not image_files:
        print(f"No image files found in {input_dir}")
        sys.exit(1)

    target_lab = tuple(args.target_lab)
    print(f"Normalizing {len(image_files)} images to LAB ({target_lab[0]:.0f}, {target_lab[1]:.0f}, {target_lab[2]:.0f})")
    print(f"Strip={args.inner}-{args.outer}px from edge")

    success_count = 0
    for img_path in image_files:
        image = cv2.imread(str(img_path))
        if image is None:
            print(f"  Error reading {img_path.name}")
            continue

        corrected, (dL, dA, dB) = normalize_image(
            image, target_lab, args.inner, args.outer
        )

        output_path = output_dir / img_path.name
        cv2.imwrite(str(output_path), corrected, [cv2.IMWRITE_JPEG_QUALITY, 95])
        success_count += 1

        if args.verbose:
            print(f"  {img_path.name}  shift: L={dL:+.1f} A={dA:+.1f} B={dB:+.1f}")

    print(f"\nProcessed {success_count}/{len(image_files)} images")
    print(f"Output: {output_dir}")


if __name__ == "__main__":
    main()
