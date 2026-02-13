# John Hoyte Manuscript Viewer

A static website for viewing historical manuscripts and scrapbooks from [John Hoyte](https://johnhoyte.com) using OpenSeadragon deep zoom technology.

**All manuscripts in this repository are copyright John Hoyte. All rights reserved.**

## Available Manuscripts

### 1956 Cambridge Hannibal Expedition
- **URL:** [davidgedye.github.io/hoyte/1956expedition/](https://davidgedye.github.io/hoyte/1956expedition/)
- Journal and scrapbook documenting the first trip of the "Cambridge Hannibalians" to investigate the different passes across the Alps which Hannibal may have used in 218 BCE.
- 81 pages
- A PDF version of this manuscript is available at "https://davidgedye.github.io/hoyte/1956expedition/Cambridge%201956%20Hannibal%20Expedition.pdf"


### Cambridge Undergraduate Scrapbook
- **URL:** [davidgedye.github.io/hoyte/cambridge/](https://davidgedye.github.io/hoyte/cambridge/)
- 42 pages

## Project Structure

```
hoyte/
├── shared/              # Shared viewer code and assets
│   ├── viewer.js        # Main OpenSeadragon viewer logic
│   ├── main.css         # Shared styles
│   ├── ImageRec.js      # Image record class
│   ├── arrangements.js  # Layout arrangements
│   ├── highlights.js    # Highlight overlay support
│   ├── intro.js         # Introduction message handling
│   └── util.js          # Utility functions
├── 1956expedition/      # First manuscript
│   ├── index.html       # Entry point
│   ├── config.js        # Manuscript-specific configuration
│   ├── data.js          # DZI metadata (auto-generated)
│   └── jpgs/            # DZI tiles and source images
├── cambridge/           # Second manuscript
│   ├── index.html
│   ├── config.js
│   ├── data.js
│   └── jpgs/
├── util/                # Processing utilities
│   ├── crop_margins.py  # Image preprocessing
│   ├── collect.js       # DZI metadata collector
│   └── dzi.js           # DZI file list
└── EMBEDDING.md         # Instructions for embedding in websites
```

## Adding a New Manuscript

### 1. Prepare Source Images

Process scanned images to crop white margins:

```bash
# Install Python dependencies
cd util
pip install -r requirements.txt

# Crop white margins from scanned images
python crop_margins.py /path/to/scans/ /path/to/output/ --verbose
```

Options:
- `--threshold`: White threshold 0-255 (default: 250)
- `--padding`: Add padding around content
- `--inplace`: Overwrite original files

### 2. Generate DZI Tiles

Use [libvips](https://www.libvips.org/) to create Deep Zoom Image tiles:

```bash
# Create DZI for each image
for img in /path/to/processed/*.jpg; do
  name=$(basename "$img" .jpg)
  vips dzsave "$img" "newmanuscript/jpgs/$name" --suffix .jpg --tile-size 510
done
```

### 3. Create Manuscript Files

Create a new folder with:

**index.html:**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Manuscript Title</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" type="text/css" href="../shared/main.css" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/openseadragon/5.0.1/openseadragon.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/tween.js/20.0.3/tween.umd.js"></script>
  </head>
  <body>
    <div id="osd-container"></div>
    <div class="intro-container">
      <div class="intro intro-desktop">To zoom use your scroll wheel or two fingers on your trackpad</div>
      <div class="intro intro-mobile">Pinch the screen to zoom</div>
    </div>
    <footer>&copy; 2025 John Hoyte</footer>
    <script type="module">
      import { initViewer } from '../shared/viewer.js';
      import { dzis } from './data.js';
      import config from './config.js';
      initViewer(dzis, config);
    </script>
  </body>
</html>
```

**config.js:**
```javascript
export default {
  title: 'Manuscript Title',
  rowStarts: [],           // Optional: manual row break indices
  rotatedIndexes: [],      // Indices of 90° rotated images (0-based)
  defaultLayout: 'responsive',
  showHighlights: false,
  highlights: []
};
```

### 4. Generate data.js

Update `util/dzi.js` with the list of DZI files, then:

```bash
cd util
npm install
node collect.js
```

Or generate directly with a script that parses the DZI XML files.

## Embedding in Websites

See [EMBEDDING.md](EMBEDDING.md) for instructions on embedding the viewer in Squarespace and other websites using iframes.

## Keyboard Shortcuts

- **Arrow keys**: Navigate between pages when zoomed in
- **L**: Toggle between responsive and manual row layouts
- **Click**: Zoom to clicked page

## Dependencies

- [OpenSeadragon](https://openseadragon.github.io/) - Deep zoom image viewer
- [Tween.js](https://github.com/tweenjs/tween.js/) - Animation library
- [libvips](https://www.libvips.org/) - Image processing (for DZI generation)
- [OpenCV Python](https://opencv.org/) - Image processing (for crop/straighten utility)

## License

Code in this repository is available for reference. All manuscript images and content are copyright John Hoyte.
