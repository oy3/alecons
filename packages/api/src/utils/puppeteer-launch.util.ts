import { Logger } from "@nestjs/common";
import type { Browser, LaunchOptions } from "puppeteer";
import { existsSync } from "fs";

const logger = new Logger("PuppeteerLaunch");

// Common paths for system-installed Chromium/Chrome on Linux.
// Used as fallback when PUPPETEER_EXECUTABLE_PATH is not set and the
// Puppeteer-bundled Chrome is missing its system library dependencies.
const SYSTEM_CHROME_PATHS = [
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
];

/**
 * Launch a Puppeteer browser with production-safe defaults.
 *
 * Resolution order for the Chrome binary:
 *   1. PUPPETEER_EXECUTABLE_PATH env var (explicit override in api.env)
 *   2. CHROME_PATH env var (legacy alias)
 *   3. First existing path from SYSTEM_CHROME_PATHS (system chromium/chrome)
 *   4. Puppeteer's own downloaded Chrome (requires ~/.cache/puppeteer populated
 *      by the install.mjs step in remote-deploy.sh)
 */
export async function launchPuppeteerBrowser(): Promise<Browser> {
    const puppeteer = await import("puppeteer");

    const launchOptions: LaunchOptions = {
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
        ],
    };

    const explicitPath =
        process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;

    if (explicitPath) {
        logger.log(`Using Chrome from env: ${explicitPath}`);
        launchOptions.executablePath = explicitPath;
    } else {
        const systemPath = SYSTEM_CHROME_PATHS.find((p) => existsSync(p));
        if (systemPath) {
            logger.log(`Using system Chrome at: ${systemPath}`);
            launchOptions.executablePath = systemPath;
        }
        // else: fall through to Puppeteer's bundled Chrome
    }

    return puppeteer.launch(launchOptions);
}
