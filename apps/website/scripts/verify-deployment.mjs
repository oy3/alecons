import { Buffer } from "node:buffer";

const baseUrl = (process.argv[2] || "https://alecons.edu.ng").replace(/\/$/, "");
const basicAuthUsername = process.env.BASIC_AUTH_USERNAME || "";
const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD || "";
const expectNoindex = process.env.EXPECT_NOINDEX === "true";
const headers = {};

if (basicAuthUsername && basicAuthPassword) {
  headers.Authorization = `Basic ${Buffer.from(`${basicAuthUsername}:${basicAuthPassword}`).toString("base64")}`;
}

async function fetchPage(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: options.redirect || "follow",
    headers,
  });
  return { response, body: await response.text() };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const home = await fetchPage("/");
assert(home.response.ok, `Homepage returned ${home.response.status}`);
assert(/<title>[^<]+<\/title>/.test(home.body), "Homepage is missing a server-rendered title");
assert(/<h1[\s>]/i.test(home.body), "Homepage is missing a server-rendered H1");

const about = await fetchPage("/about");
assert(about.response.ok, `About page returned ${about.response.status}`);
assert(/<link rel="canonical" href="https:\/\/alecons\.edu\.ng\/about">/.test(about.body), "About canonical is missing or incorrect");
assert(/<h1[\s>]/i.test(about.body), "About page is not prerendered");
if (expectNoindex) {
  assert(/noindex, nofollow, noarchive/.test(about.body), "Staging page is missing HTML noindex metadata");
  assert(/noindex/i.test(about.response.headers.get("x-robots-tag") || ""), "Staging page is missing its X-Robots-Tag header");
}

const robots = await fetchPage("/robots.txt");
assert(robots.response.ok, "robots.txt is missing");
if (expectNoindex) {
  assert(/^Disallow: \/$/m.test(robots.body), "Staging robots.txt must disallow all crawling");
} else {
  assert(/Sitemap:\s*https:\/\/alecons\.edu\.ng\/sitemap\.xml/.test(robots.body), "Production robots.txt is missing or incorrect");
}

const sitemap = await fetchPage("/sitemap.xml");
assert(sitemap.response.ok && /<loc>https:\/\/alecons\.edu\.ng\/about<\/loc>/.test(sitemap.body), "sitemap.xml is missing expected public routes");

const verify = await fetchPage("/verify/v1/deployment-check");
assert(verify.response.ok, `Verification route returned ${verify.response.status}`);
assert(/noindex/i.test(verify.response.headers.get("x-robots-tag") || ""), "Verification route is missing its X-Robots-Tag header");

const missing = await fetchPage(`/seo-check-${Date.now()}`);
assert(missing.response.status === 404, `Unknown route returned ${missing.response.status} instead of 404`);
assert(/noindex/i.test(missing.body), "404 response is missing noindex metadata");

console.log(`Deployment SEO checks passed for ${baseUrl}.`);
