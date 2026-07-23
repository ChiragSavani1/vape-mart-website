import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const imageDir = path.join(process.cwd(), "public/products/catalog");
const sourceFiles = fs.readdirSync(imageDir).filter(file => file.endsWith(".source"));

for (const sourceName of sourceFiles) {
  const sourceFile = path.join(imageDir, sourceName);
  if (!fs.existsSync(sourceFile)) continue;
  const destinationFile = path.join(imageDir, sourceName.replace(/\.source$/, ".webp"));
  await sharp(sourceFile)
    .rotate()
    .resize(900, 900, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(destinationFile);
  if (fs.existsSync(sourceFile)) fs.unlinkSync(sourceFile);
}

console.log(`Optimized ${sourceFiles.length} product images.`);
