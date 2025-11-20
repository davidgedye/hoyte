const { dzis } = require('./dzi.js');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

async function collectDzis() {
  const output = [];
  for (const dzi of dzis) {
    const dziPath = path.join(__dirname, '..', dzi);
    const text = fs.readFileSync(dziPath, 'utf-8');

    const xml = await new Promise((resolve, reject) => {
      xml2js.parseString(text, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });

    const result = {
      Image: {
        xmlns: xml.Image.$.xmlns,
        Format: xml.Image.$.Format,
        Overlap: xml.Image.$.Overlap,
        TileSize: xml.Image.$.TileSize,
        Url: dzi.replace('.dzi', '_files/'),
        Size: {
          Height: xml.Image.Size[0].$.Height,
          Width: xml.Image.Size[0].$.Width
        }
      }
    };

    output.push(result);
  }

  const outputText = `// Auto-generated file. Do not edit directly.
// Run 'node util/collect.js' to regenerate.

export const dzis = ${JSON.stringify(output, null, 2)};
`;

  const outputPath = path.join(__dirname, '..', 'data.js');
  fs.writeFileSync(outputPath, outputText, 'utf-8');
  console.log(`Collected ${dzis.length} DZIs to ${outputPath}`);
}

collectDzis();
