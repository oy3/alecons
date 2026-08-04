import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const distDir = new URL("../dist/", import.meta.url).pathname;
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

function sendFile(response, filePath, status = 200, headers = {}) {
  response.writeHead(status, {
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
    ...headers,
  });
  createReadStream(filePath).pipe(response);
}

function resolvePublicFile(pathname) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.(\/|\\|$))+/, "");
  const directPath = join(distDir, safePath);
  if (existsSync(directPath) && statSync(directPath).isFile()) return directPath;

  const htmlPath = join(distDir, `${safePath.replace(/\/$/, "")}.html`);
  if (existsSync(htmlPath)) return htmlPath;
  return null;
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  if (url.pathname.startsWith("/verify/v1/")) {
    sendFile(response, join(distDir, "verify.html"), 200, {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    });
    return;
  }

  const filePath = url.pathname === "/" ? join(distDir, "index.html") : resolvePublicFile(url.pathname);
  if (filePath) {
    sendFile(response, filePath, 200, url.pathname.startsWith("/assets/")
      ? { "Cache-Control": "public, max-age=31536000, immutable" }
      : {});
    return;
  }

  sendFile(response, join(distDir, "404.html"), 404);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ALECONS production preview: http://127.0.0.1:${port}`);
});
