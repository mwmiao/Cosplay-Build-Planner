// Renders the PNG app icons from the SVG sources. Run after changing an icon:
//   node scripts/generate-icons.mjs
import sharp from "sharp";

const out = (name) => `public/icons/${name}`;

await sharp("public/icon.svg", { density: 600 }).resize(192).png().toFile(out("icon-192.png"));
await sharp("public/icon.svg", { density: 600 }).resize(512).png().toFile(out("icon-512.png"));
// Full-bleed versions: Android masks them to its own shape, iOS rounds the corners itself.
await sharp("public/icons/maskable.svg", { density: 600 }).resize(512).png().toFile(out("maskable-512.png"));
await sharp("public/icons/maskable.svg", { density: 600 }).resize(180).png().toFile(out("apple-touch-icon.png"));
console.log("Icons written to public/icons/");
