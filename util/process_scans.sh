#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CAMBRIDGE_DIR="$REPO_ROOT/cambridge"
SCANS_DIR="$CAMBRIDGE_DIR/scans"
JPGS_DIR="$CAMBRIDGE_DIR/jpgs"
DATA_JS="$CAMBRIDGE_DIR/data.js"

# ---------------------------------------------------------------------------
# Step 1: Copy & rename scans
# ---------------------------------------------------------------------------
echo "=== Step 1: Copy & rename scans ==="

if [ ! -d "$SCANS_DIR" ]; then
    echo "Error: scans directory not found at $SCANS_DIR"
    exit 1
fi

# Collect image files sorted alphabetically by name
mapfile -t scan_files < <(ls -1 "$SCANS_DIR"/*.jpg "$SCANS_DIR"/*.jpeg "$SCANS_DIR"/*.JPG "$SCANS_DIR"/*.JPEG 2>/dev/null | sort)

if [ ${#scan_files[@]} -eq 0 ]; then
    echo "Error: no JPG files found in $SCANS_DIR"
    exit 1
fi

echo "Found ${#scan_files[@]} scan(s)"
mkdir -p "$JPGS_DIR"

n=1
for f in "${scan_files[@]}"; do
    dest=$(printf "Page_%02d.jpg" "$n")
    cp "$f" "$JPGS_DIR/$dest"
    echo "  $(basename "$f") -> $dest"
    n=$((n + 1))
done

echo "Copied ${#scan_files[@]} file(s) to $JPGS_DIR"

# Clean up any leftover pages beyond the current count
for old in "$JPGS_DIR"/Page_*.jpg "$JPGS_DIR"/Page_*.dzi "$JPGS_DIR"/Page_*_files; do
    [ -e "$old" ] || continue
    base=$(basename "$old" | sed 's/\..*//' | sed 's/_files$//')
    num=$(echo "$base" | sed 's/Page_//')
    if [ "$((10#$num))" -gt "${#scan_files[@]}" ]; then
        rm -rf "$old"
        echo "  Removed stale $old"
    fi
done

# ---------------------------------------------------------------------------
# Step 2: Autocrop
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 2: Autocrop ==="
python3 "$SCRIPT_DIR/crop_margins.py" "$JPGS_DIR" --inplace --verbose

# ---------------------------------------------------------------------------
# Step 3: Background normalization
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 3: Background normalization ==="
python3 "$SCRIPT_DIR/normalize_backgrounds.py" "$JPGS_DIR" --inplace --target-lab 253 128 145 --verbose

# ---------------------------------------------------------------------------
# Step 4: Generate DZIs
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 4: Generate DZIs ==="

# Remove old DZI files and tile directories
rm -f "$JPGS_DIR"/*.dzi
rm -rf "$JPGS_DIR"/*_files/

page_files=("$JPGS_DIR"/Page_*.jpg)
total=${#page_files[@]}
i=0

for jpg in "${page_files[@]}"; do
    i=$((i + 1))
    base=$(basename "$jpg" .jpg)
    echo "  [$i/$total] $base"
    vips dzsave "$jpg" "$JPGS_DIR/$base" --suffix .jpg --tile-size 510
done

echo "Generated $total DZI(s)"

# ---------------------------------------------------------------------------
# Step 5: Generate data.js
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 5: Generate data.js ==="

python3 -c "
import xml.etree.ElementTree as ET
import glob, os, json

ns = 'http://schemas.microsoft.com/deepzoom/2008'
jpgs_dir = '$JPGS_DIR'

dzi_files = sorted(glob.glob(os.path.join(jpgs_dir, 'Page_*.dzi')))
entries = []

for dzi_path in dzi_files:
    tree = ET.parse(dzi_path)
    root = tree.getroot()
    fmt = root.get('Format')
    overlap = root.get('Overlap')
    tile_size = root.get('TileSize')
    size_el = root.find('{' + ns + '}Size')
    width = size_el.get('Width')
    height = size_el.get('Height')
    base = os.path.splitext(os.path.basename(dzi_path))[0]
    entries.append({
        'Image': {
            'xmlns': ns,
            'Format': fmt,
            'Overlap': overlap,
            'TileSize': tile_size,
            'Url': 'jpgs/' + base + '_files/',
            'Size': {
                'Height': height,
                'Width': width,
            }
        }
    })

lines = ['// Auto-generated file. Do not edit directly.', '', 'export const dzis = [']
for i, entry in enumerate(entries):
    comma = ',' if i < len(entries) - 1 else ''
    img = entry['Image']
    size = img['Size']
    lines.append('  {')
    lines.append('    \"Image\": {')
    lines.append('      \"xmlns\": \"' + img['xmlns'] + '\",')
    lines.append('      \"Format\": \"' + img['Format'] + '\",')
    lines.append('      \"Overlap\": \"' + img['Overlap'] + '\",')
    lines.append('      \"TileSize\": \"' + img['TileSize'] + '\",')
    lines.append('      \"Url\": \"' + img['Url'] + '\",')
    lines.append('      \"Size\": {')
    lines.append('        \"Height\": \"' + size['Height'] + '\",')
    lines.append('        \"Width\": \"' + size['Width'] + '\"')
    lines.append('      }')
    lines.append('    }')
    lines.append('  }' + comma)

lines.append('];')
lines.append('')

with open('$DATA_JS', 'w') as f:
    f.write('\n'.join(lines))

print(f'  Generated {len(entries)} entries in data.js')
"

echo ""
echo "=== Done ==="
