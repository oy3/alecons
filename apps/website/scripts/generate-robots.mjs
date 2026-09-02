import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.cwd(), "dist", "robots.txt");
const noindex = process.env.VITE_SITE_NOINDEX === "true";
const siteUrl = (process.env.VITE_APP_SITE_URL || "https://alecons.edu.ng").replace(
  /\/$/,
  "",
);

const content = noindex
  ? ["User-agent: *", "Disallow: /", ""].join("\n")
  : ["User-agent: *", "Allow: /", "", `Sitemap: ${siteUrl}/sitemap.xml`, ""].join(
      "\n",
    );

await writeFile(output, content, "utf8");
console.log(`Generated ${noindex ? "non-indexable" : "production"} robots.txt.`);
