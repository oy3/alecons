import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.cwd(), "dist");
const manifest = JSON.parse(
  await readFile(resolve(output, "prerender-manifest.json"), "utf8"),
);
const siteUrl = (process.env.VITE_APP_SITE_URL || "https://alecons.edu.ng").replace(
  /\/$/,
  "",
);

const urls = manifest.pages
  .filter(({ indexable }) => indexable)
  .map(
    ({ path }) =>
      `  <url>\n    <loc>${siteUrl}${path === "/" ? "/" : path}</loc>\n  </url>`,
  )
  .join("\n");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

await writeFile(resolve(output, "sitemap.xml"), sitemap, "utf8");
console.log(`Generated sitemap with ${manifest.pages.filter(({ indexable }) => indexable).length} URLs.`);
