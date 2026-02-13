#!/usr/bin/env python3
"""
Crop white margins from scanned document images.

This script trims pure white (scanner bed) margins from scanned images,
leaving only the document content.

Usage:
    python crop_margins.py input.jpg output.jpg
    python crop_margins.py input_folder/ output_folder/
    python crop_margins.py input_folder/ --inplace

Requirements:
    pip install opencv-python numpy
"""

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np


def find_content_bounds(image, white_threshold=250, margin_threshold=0.95):
    """
    Find the bounding box of non-white content in the image.

    Scans rows and columns to find where content begins/ends.
    A row/column is considered "white" if more than margin_threshold
    of its pixels are above white_threshold.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape

    row_white_fraction = np.mean(gray > white_threshold, axis=1)
    content_rows = row_white_fraction < margin_threshold

    col_white_fraction = np.mean(gray > white_threshold, axis=0)
    content_cols = col_white_fraction < margin_threshold

    row_indices = np.where(content_rows)[0]
    col_indices = np.where(content_cols)[0]

    if len(row_indices) == 0 or len(col_indices) == 0:
        return 0, height, 0, width

    top = row_indices[0]
    bottom = row_indices[-1] + 1
    left = col_indices[0]
    right = col_indices[-1] + 1

    return top, bottom, left, right


def process_image(input_path, output_path, white_threshold=250, padding=0, debug=False):
    """Process a single image: crop white margins."""
    image = cv2.imread(str(input_path))
    if image is None:
        print(f"Error: Could not read {input_path}")
        return False

    original_shape = image.shape

    # Find and crop white margins
    top, bottom, left, right = find_content_bounds(image, white_threshold)
    cropped = image[top:bottom, left:right]

    # Apply padding if requested
    if padding > 0:
        height, width = cropped.shape[:2]
        padded = np.full((height + 2*padding, width + 2*padding, 3), 255, dtype=np.uint8)
        padded[padding:padding+height, padding:padding+width] = cropped
        cropped = padded

    # Save result
    cv2.imwrite(str(output_path), cropped, [cv2.IMWRITE_JPEG_QUALITY, 95])

    if debug:
        print(f"Processed {input_path.name}: "
              f"original={original_shape[1]}x{original_shape[0]}, "
              f"cropped={cropped.shape[1]}x{cropped.shape[0]}")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Crop white margins from scanned images."
    )
    parser.add_argument(
        "input",
        help="Input image file or directory"
    )
    parser.add_argument(
        "output",
        nargs="?",
        help="Output image file or directory (optional)"
    )
    parser.add_argument(
        "--inplace", "-i",
        action="store_true",
        help="Overwrite original files (use with caution!)"
    )
    parser.add_argument(
        "--threshold", "-t",
        type=int,
        default=250,
        help="White threshold (0-255, default: 250). Pixels above this are 'white'."
    )
    parser.add_argument(
        "--padding", "-p",
        type=int,
        default=0,
        help="Padding to add around content (default: 0)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print detailed progress"
    )

    args = parser.parse_args()

    input_path = Path(args.input)

    if not input_path.exists():
        print(f"Error: {input_path} does not exist")
        sys.exit(1)

    if input_path.is_file():
        # Single file mode
        if args.output:
            output_path = Path(args.output)
        elif args.inplace:
            output_path = input_path
        else:
            output_path = input_path.with_stem(input_path.stem + "_cropped")

        success = process_image(input_path, output_path, args.threshold,
                               args.padding, args.verbose)
        if not args.verbose:
            print(f"Saved: {output_path}")
        sys.exit(0 if success else 1)

    elif input_path.is_dir():
        # Directory mode
        if args.output:
            output_dir = Path(args.output)
            output_dir.mkdir(parents=True, exist_ok=True)
        elif args.inplace:
            output_dir = input_path
        else:
            output_dir = input_path.parent / (input_path.name + "_cropped")
            output_dir.mkdir(parents=True, exist_ok=True)

        # Find all image files
        extensions = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp"}
        image_files = sorted([
            f for f in input_path.iterdir()
            if f.suffix.lower() in extensions
        ])

        if not image_files:
            print(f"No image files found in {input_path}")
            sys.exit(1)

        print(f"Processing {len(image_files)} images...")

        success_count = 0
        for img_path in image_files:
            output_path = output_dir / img_path.name
            if process_image(img_path, output_path, args.threshold,
                           args.padding, args.verbose):
                success_count += 1
                if not args.verbose:
                    print(f"  {img_path.name}")

        print(f"\nProcessed {success_count}/{len(image_files)} images")
        print(f"Output: {output_dir}")
        sys.exit(0 if success_count == len(image_files) else 1)


if __name__ == "__main__":
    main()
