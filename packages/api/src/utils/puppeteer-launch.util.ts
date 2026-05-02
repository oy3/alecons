import { Logger } from "@nestjs/common";
import type { Browser, LaunchOptions } from "puppeteer";

const logger = new Logger("PuppeteerLaunch");

/**
 * Launch a Puppeteer browser with production-safe defaults.
 *
 * On the production droplet the `puppeteer` npm package ships only the JS
 * code; Chrome itself lives in the user's Puppeteer cache directory
 * (~/.cache/puppeteer) and must have been installed separately (the
 * remote-deploy.sh script does this via `node install.mjs`).
 *
 * As an escape hatch, set PUPPETEER_EXECUTABLE_PATH (or CHROME_PATH) in
 * /etc/alecons/api.env to point at a system-installed Chromium binary.
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

    const executablePath =
        process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
    if (executablePath) {
        logger.log(`Using Chrome at: ${executablePath}`);
        launchOptions.executablePath = executablePath;
    }

    return puppeteer.launch(launchOptions);
}
