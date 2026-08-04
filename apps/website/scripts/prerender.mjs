import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outputDirectory = resolve(root, "dist");
const serverDirectory = resolve(root, "dist-server");
const serverEntry = resolve(serverDirectory, "entry-server.js");
const template = await readFile(resolve(outputDirectory, "index.html"), "utf8");
const { prerenderPaths, render } = await import(pathToFileURL(serverEntry));

const pages = [];
const renderTargets = [
  ...prerenderPaths.map((path) => ({ path, indexable: true })),
  {
    path: "/verify/v1/prerender-placeholder",
    indexable: false,
    output: "verify.html",
  },
  { path: "/404", indexable: false, output: "404.html" },
];

for (const target of renderTargets) {
  const result = await render(target.path);
  const html = template
    .replace("<!--app-head-->", result.headHtml)
    .replace('<div id="app"></div>', `<div id="app">${result.appHtml}</div>`);
  const relativeOutput =
    target.output ||
    (target.path === "/" ? "index.html" : `${target.path.slice(1)}.html`);
  const output = resolve(outputDirectory, relativeOutput);

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html, "utf8");
  pages.push({
    path: target.path,
    output: relativeOutput,
    indexable: target.indexable,
    title: result.meta.title,
  });
}

await writeFile(
  resolve(outputDirectory, "prerender-manifest.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), pages }, null, 2)}\n`,
  "utf8",
);
await rm(serverDirectory, { recursive: true, force: true });

console.log(`Prerendered ${pages.length} website pages.`);
