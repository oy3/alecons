import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteUrl = "https://alecons.edu.ng";
const routes = [
  ["/", "weekly", "1.0"],
  ["/about", "monthly", "0.8"],
  ["/programs", "monthly", "0.9"],
  ["/programs/basic-nursing", "monthly", "0.8"],
  ["/programs/public-health", "monthly", "0.6"],
  ["/programs/midwifery", "monthly", "0.6"],
  ["/programs/post-basic-nursing", "monthly", "0.6"],
  ["/admissions", "weekly", "0.9"],
  ["/faculty", "monthly", "0.7"],
  ["/contact", "monthly", "0.7"],
  ["/privacy-policy", "yearly", "0.3"],
  ["/terms-of-service", "yearly", "0.3"],
  ["/accessibility", "yearly", "0.3"],
];

const urls = routes
  .map(([path, changefreq, priority]) => `  <url>\n    <loc>${siteUrl}${path}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`)
  .join("\n");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

const output = resolve(process.cwd(), "dist");
await mkdir(output, { recursive: true });
await writeFile(resolve(output, "sitemap.xml"), sitemap, "utf8");
