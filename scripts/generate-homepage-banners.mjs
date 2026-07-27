import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const catalogue = path.join(root, "public", "products", "catalog");
const output = path.join(root, "public", "banners");
const width = 1920;
const height = 680;

await mkdir(output, { recursive: true });

const escape = value => value.replaceAll("&", "&amp;");

function artwork({
  background,
  eyebrow,
  title,
  titleSize = 102,
  line1,
  line2,
  accent = "#ffffff",
  darkText = false,
  number,
}) {
  const ink = darkText ? "#090909" : "#ffffff";
  const muted = darkText ? "#4b4b4b" : "#c7c7c7";
  const badgeWidth = Math.max(198, eyebrow.length * 13 + 48);
  const badgeCentre = 112 + badgeWidth / 2;
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">${background}</linearGradient>
        <filter id="grain"><feTurbulence baseFrequency=".7" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .055 0"/></filter>
      </defs>
      <rect width="1920" height="680" fill="url(#bg)"/>
      <rect width="1920" height="680" filter="url(#grain)" opacity=".26"/>
      <path d="M1090 0h830v680H980c115-124 161-286 110-680z" fill="#f5f5f5"/>
      <path d="M1118 0h12l-90 680h-12z" fill="${accent}" opacity=".9"/>
      <g font-family="Arial, Helvetica, sans-serif" fill="${ink}">
        <rect x="112" y="92" width="${badgeWidth}" height="42" rx="21" fill="${accent}"/>
        <text x="${badgeCentre}" y="120" text-anchor="middle" font-size="18" font-weight="900" letter-spacing="2.5" fill="${darkText ? "#fff" : "#090909"}">${escape(eyebrow)}</text>
        <text x="112" y="250" font-size="${titleSize}" font-weight="900" letter-spacing="-5">${escape(title)}</text>
        <text x="116" y="315" font-size="28" font-weight="800" letter-spacing="2">${escape(line1)}</text>
        <text x="116" y="357" font-size="23" font-weight="500" fill="${muted}">${escape(line2)}</text>
        <rect x="112" y="430" width="310" height="66" rx="8" fill="${darkText ? "#090909" : "#ffffff"}"/>
        <text x="267" y="472" text-anchor="middle" font-size="21" font-weight="900" fill="${darkText ? "#fff" : "#090909"}">VIEW THE CATALOGUE  →</text>
        <text x="116" y="592" font-size="16" font-weight="800" letter-spacing="2.8" fill="${muted}">ADULTS 19+  •  IN-STORE AVAILABILITY</text>
        ${number ? `<text x="1015" y="610" font-size="210" font-weight="900" text-anchor="end" fill="${ink}" opacity=".08">${number}</text>` : ""}
      </g>
    </svg>
  `);
}

async function product(file, size, left, top, rotate = 0) {
  let image = sharp(path.join(catalogue, file)).resize(size, size, {
    fit: "contain",
    background: { r: 245, g: 245, b: 245, alpha: 1 },
  });
  if (rotate) image = image.rotate(rotate, { background: { r: 245, g: 245, b: 245, alpha: 1 } });
  return { input: await image.webp({ quality: 94 }).toBuffer(), left, top };
}

async function makeBanner(fileName, options, productSpecs) {
  const composites = await Promise.all(productSpecs.map(spec => product(...spec)));
  await sharp(artwork(options))
    .composite(composites)
    .webp({ quality: 91, smartSubsample: true })
    .toFile(path.join(output, fileName));
}

await makeBanner("envi-apex-new-arrivals.webp", {
  background: '<stop offset="0" stop-color="#050505"/><stop offset=".62" stop-color="#292929"/><stop offset="1" stop-color="#080808"/>',
  eyebrow: "NEW ARRIVAL",
  title: "ENVI APEX 2500",
  titleSize: 88,
  line1: "13 FLAVOURS  •  COMPACT FORMAT",
  line2: "Exact product artwork, now in the Vape Mart catalogue.",
  accent: "#ffffff",
  number: "13",
}, [
  ["envi-apex-2500-mango-iced-99009.webp", 410, 1110, 135, -4],
  ["envi-apex-2500-blue-razz-98897.webp", 430, 1390, 65, 3],
  ["envi-apex-2500-strawberry-iced-99078.webp", 390, 1610, 205, 5],
]);

await makeBanner("flavour-beast-60ml.webp", {
  background: '<stop offset="0" stop-color="#f8f8f8"/><stop offset=".64" stop-color="#cfcfcf"/><stop offset="1" stop-color="#f5f5f5"/>',
  eyebrow: "FULL-SIZE E-LIQUID",
  title: "FLAVOUR BEAST",
  titleSize: 92,
  line1: "60 mL  •  OVER 30 FLAVOURS",
  line2: "Browse the full-size collection and check availability.",
  accent: "#111111",
  darkText: true,
  number: "60",
}, [
  ["flavour-beast-60ml-bussin-banana-40008.webp", 390, 1085, 128, -5],
  ["flavourbeast-60ml-boss-blueberry-76137.webp", 425, 1330, 70, 2],
  ["flavour-beast-60ml-weekend-watermelon-40152.webp", 390, 1600, 145, 6],
]);

await makeBanner("sour-gushin-60ml.webp", {
  background: '<stop offset="0" stop-color="#070707"/><stop offset=".62" stop-color="#3a3a3a"/><stop offset="1" stop-color="#090909"/>',
  eyebrow: "NEW FLAVOURS",
  title: "SOUR GUSHIN",
  titleSize: 104,
  line1: "5 FLAVOURS  •  60 mL",
  line2: "Turn up the sour with the latest full-size arrivals.",
  accent: "#ffffff",
  number: "05",
}, [
  ["fb-60ml-gushin-watermelon-apple-58277.webp", 390, 1070, 165, -5],
  ["fb-60ml-gushin-sour-blueberry-grape-58321.webp", 420, 1335, 65, 2],
  ["fb-60ml-gushin-sour-strawberry-kiwi-58369.webp", 390, 1610, 175, 5],
]);

console.log("Generated three homepage promotional banners.");
