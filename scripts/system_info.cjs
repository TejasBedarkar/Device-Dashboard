// system_info.cjs - Full Hardware Detection

const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");
const { Builder } = require("selenium-webdriver");
require("chromedriver");

const chrome = require("selenium-webdriver/chrome");
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/* ------------------------------------------------------
   SETUP SELENIUM
------------------------------------------------------ */
async function setupSelenium() {
    try {
        const options = new chrome.Options();
        options.addArguments(
            "--headless=new",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--log-level=3"
        );

        let driver = await new Builder()
            .forBrowser("chrome")
            .setChromeOptions(options)
            .build();

        await driver.executeScript(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"
        );

        return driver;
    } catch (err) {
        console.log("[SELENIUM] failed:", err);
        return null;
    }
}

/* ------------------------------------------------------
   GET GPU LIST (Windows)
------------------------------------------------------ */
function getGPUInfo() {
    try {
        const output = execSync(
            `wmic path win32_VideoController get Name`,
            { encoding: "utf-8" }
        )
            .split("\n")
            .slice(1)
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

        return output;
    } catch {
        return ["Unknown GPU"];
    }
}

/* ------------------------------------------------------
   GET SYSTEM INFO
------------------------------------------------------ */
function getSystemInfo() {
    const info = {
        hostname: os.hostname(),
        os_type: os.type(),
        os_platform: os.platform(),
        os_release: os.release(),
        architecture: os.arch(),
    };

    // CPU INFO
    info.cpu = {
        model: os.cpus()[0].model,
        cores: os.cpus().length,
        speed_mhz: os.cpus()[0].speed,
    };

    // RAM INFO
    info.ram = {
        total_gb: (os.totalmem() / 1024 ** 3).toFixed(2),
        free_gb: (os.freemem() / 1024 ** 3).toFixed(2),
        used_gb: ((os.totalmem() - os.freemem()) / 1024 ** 3).toFixed(2),
    };

    // GPU using WMIC (Windows)
    if (os.platform() === "win32") {
        info.gpus = getGPUInfo();
    }

    // Laptop Model (Windows)
    if (os.platform() === "win32") {
        try {
            const manufacturer = execSync(
                `wmic computersystem get Manufacturer`, { encoding: "utf-8" }
            )
                .split("\n")[1]
                .trim();

            const model = execSync(
                `wmic computersystem get Model`, { encoding: "utf-8" }
            )
                .split("\n")[1]
                .trim();

            info.manufacturer = manufacturer;
            info.model = model;
        } catch {
            info.model = "Windows PC";
        }
    }

    return info;
}

/* ------------------------------------------------------
   SELENIUM BROWSER INFO
------------------------------------------------------ */
async function getBrowserInfo() {
    let browserData = { selenium_available: false };
    let driver = await setupSelenium();

    if (!driver) return browserData;

    try {
        browserData.selenium_available = true;

        await driver.get("about:blank");
        await sleep(300);

        const data = await driver.executeScript(`
            return {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                hardwareConcurrency: navigator.hardwareConcurrency
            };
        `);

        Object.assign(browserData, data);
    } catch (err) {
        browserData.error = err.message;
    }

    await driver.quit();
    return browserData;
}

/* ------------------------------------------------------
   MAIN FUNCTION
------------------------------------------------------ */
async function main() {
    console.log("[SYSTEM] Collecting full hardware info...");

    try {
        const sysInfo = getSystemInfo();
        const browserInfo = await getBrowserInfo();

        const finalData = {
            system_info: sysInfo,
            browser_info: browserInfo,
            collected_at: new Date().toISOString().replace("T", " ").slice(0, 19)
        };

        fs.writeFileSync(
            "system_hardware_info.json",
            JSON.stringify(finalData, null, 2),
            "utf-8"
        );

        console.log("[OK] Saved → system_hardware_info.json");
        console.log(`[MODEL] Detected: ${sysInfo.model}`);
    } catch (err) {
        console.error("[ERROR]", err);
    }
}

main();
