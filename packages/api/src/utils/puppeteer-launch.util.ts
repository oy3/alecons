import { Logger } from "@nestjs/common";
import type { Browser, LaunchOptions } from "puppeteer";
import { existsSync, readFileSync, realpathSync, statSync } from "fs";

const logger = new Logger("PuppeteerLaunch");

// Prefer non-snap Chrome builds first. On Ubuntu servers, the chromium-browser
// wrapper often points to snap Chromium, which is unreliable from PM2/system
// service contexts and fails with snap cgroup errors.
const SYSTEM_CHROME_PATHS = [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
];

function isSnapWrappedBrowser(executablePath: string): boolean {
    try {
        const resolvedPath = realpathSync(executablePath);
        if (
            resolvedPath.includes("/snap/") ||
            resolvedPath.startsWith("/var/lib/snapd/")
        ) {
            return true;
        }
    } catch {
        // Ignore path resolution errors and fall through to script inspection.
    }

    try {
        const fileStats = statSync(executablePath);
        if (fileStats.size > 64 * 1024) {
            return false;
        }

        const fileContents = readFileSync(executablePath, "utf8");
        return (
            fileContents.includes("snap.chromium.chromium") ||
            fileContents.includes("/snap/bin/chromium") ||
            fileContents.includes("xdg-settings")
        );
    } catch {
        return false;
    }
}

function resolveSystemBrowserPath(): string | undefined {
    for (const candidatePath of SYSTEM_CHROME_PATHS) {
        if (!existsSync(candidatePath)) {
            continue;
        }

        if (isSnapWrappedBrowser(candidatePath)) {
            logger.warn(`Skipping snap-wrapped browser path: ${candidatePath}`);
            continue;
        }

        return candidatePath;
    }

    return undefined;
}

/**
 * Launch a Puppeteer browser with production-safe defaults.
 *
 * Resolution order for the Chrome binary:
 *   1. PUPPETEER_EXECUTABLE_PATH env var (explicit override in api.env)
 *   2. CHROME_PATH env var (legacy alias)
 *   3. First non-snap path from SYSTEM_CHROME_PATHS (system chromium/chrome)
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
        if (isSnapWrappedBrowser(explicitPath)) {
            throw new Error(
                `Configured browser path uses a snap wrapper and cannot be used by Puppeteer in production: ${explicitPath}`,
            );
        }

        logger.log(`Using Chrome from env: ${explicitPath}`);
        launchOptions.executablePath = explicitPath;
    } else {
        const systemPath = resolveSystemBrowserPath();
        if (systemPath) {
            logger.log(`Using system Chrome at: ${systemPath}`);
            launchOptions.executablePath = systemPath;
        }
        // else: fall through to Puppeteer's bundled Chrome
    }

    return puppeteer.launch(launchOptions);
}
