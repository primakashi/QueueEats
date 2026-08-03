import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import sharp from "sharp";

const sourcePath = process.argv[2];

if (!sourcePath) {
  throw new Error("Usage: node scripts/import-landing.mjs <landing-page.html>");
}

const projectRoot = process.cwd();
const landingRoot = "#solusisaji-landing";
const assetNames = [
  "dashboard-management",
  "dashboard-sales",
  "dashboard-orders",
  "pempek",
  "es-kacang-merah",
];

const source = fs.readFileSync(path.resolve(sourcePath), "utf8");
const assetDirectory = path.join(projectRoot, "public", "landing");

fs.mkdirSync(assetDirectory, { recursive: true });

let assetIndex = 0;
const pendingWrites = [];
const normalizedSource = source.replace(
  /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g,
  (dataUri) => {
    const encoded = dataUri.slice(dataUri.indexOf(",") + 1);
    const image = Buffer.from(encoded, "base64");
    const baseName = assetNames[assetIndex] ?? `asset-${assetIndex + 1}`;
    const isThumbnail = assetIndex >= 3;
    const extension = isThumbnail
      ? "webp"
      : image.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]))
        ? "jpg"
        : "png";
    const fileName = `${baseName}.${extension}`;

    for (const staleExtension of ["jpg", "png", "webp"]) {
      fs.rmSync(path.join(assetDirectory, `${baseName}.${staleExtension}`), {
        force: true,
      });
    }

    if (isThumbnail) {
      pendingWrites.push(
        sharp(image)
          .resize(256, 256, { fit: "cover" })
          .webp({ quality: 82 })
          .toFile(path.join(assetDirectory, fileName)),
      );
    } else {
      fs.writeFileSync(path.join(assetDirectory, fileName), image);
    }
    assetIndex += 1;

    return `/landing/${fileName}`;
  },
);

await Promise.all(pendingWrites);

const styleMatch = normalizedSource.match(/<style>([\s\S]*?)<\/style>/);
const mainMatch = normalizedSource.match(/<main>([\s\S]*?)<\/main>/);

if (!styleMatch || !mainMatch) {
  throw new Error("The supplied file must contain one <style> and one <main> element.");
}

if (assetIndex !== assetNames.length) {
  throw new Error(`Expected ${assetNames.length} embedded images, found ${assetIndex}.`);
}

const css = postcss.parse(styleMatch[1]);

css.walkRules((rule) => {
  if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) {
    return;
  }

  rule.selectors = rule.selectors.map((selector) => {
    const trimmed = selector.trim();

    if (trimmed === "html") {
      return `html:has(${landingRoot})`;
    }

    if (trimmed === ":root" || trimmed === "body") {
      return landingRoot;
    }

    return `${landingRoot} ${trimmed}`;
  });
});

const generatedNotice = [
  "/*",
  " * Generated from the approved Solusi Saji landing-page reference.",
  " * Re-run `node scripts/import-landing.mjs <file>` to refresh this stylesheet.",
  " */",
  "",
].join("\n");

fs.writeFileSync(
  path.join(projectRoot, "app", "landing.css"),
  generatedNotice + css.toString().trim() + "\n",
);
fs.writeFileSync(
  path.join(projectRoot, "app", "landing-content.html"),
  `<main>${mainMatch[1]}</main>\n`,
);

console.log(`Imported landing page with ${assetIndex} optimized public assets.`);
