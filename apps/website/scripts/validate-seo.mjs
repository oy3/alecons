import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.cwd(), "dist");
const manifest = JSON.parse(
  await readFile(resolve(output, "prerender-manifest.json"), "utf8"),
);
const failures = [];

for (const page of manifest.pages) {
  const html = await readFile(resolve(output, page.output), "utf8");
  const checks = [
    [/<title>[^<]+<\/title>/, "title"],
    [/<meta name="description" content="[^"]+">/, "description"],
    [/<meta name="robots" content="[^"]+">/, "robots directive"],
    [/<meta property="og:title" content="[^"]+">/, "Open Graph title"],
    [/<meta name="twitter:image" content="[^"]+">/, "Twitter image"],
    [/<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/, "H1"],
  ];

  for (const [pattern, label] of checks) {
    if (!pattern.test(html)) failures.push(`${page.path}: missing ${label}`);
  }

  if (page.indexable && !/<link rel="canonical" href="[^"]+">/.test(html)) {
    failures.push(`${page.path}: missing canonical URL`);
  }
  if (
    page.indexable &&
    !/<script id="alecons-structured-data" type="application\/ld\+json">/.test(
      html,
    )
  ) {
    failures.push(`${page.path}: missing structured data`);
  }
  if (!page.indexable && !html.includes("noindex, nofollow, noarchive")) {
    failures.push(`${page.path}: missing noindex directive`);
  }
  if (html.includes('<div id="app"></div>')) {
    failures.push(`${page.path}: app content was not prerendered`);
  }
}

await access(resolve(output, "robots.txt"));
await access(resolve(output, "sitemap.xml"));

const sitemap = await readFile(resolve(output, "sitemap.xml"), "utf8");
for (const page of manifest.pages.filter(({ indexable }) => indexable)) {
  if (!sitemap.includes(page.path === "/" ? "alecons.edu.ng/</loc>" : `${page.path}</loc>`)) {
    failures.push(`${page.path}: missing from sitemap`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Validated SEO output for ${manifest.pages.length} pages.`);
