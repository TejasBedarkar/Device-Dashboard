const fs = require("fs");
const OpenAI = require("openai");
require("dotenv").config();

/* -----------------------------------------------------
   INIT OPENAI
----------------------------------------------------- */
let openai = null;

try {
    const key = process.env.OPENAI_API_KEY;

    if (!key) {
        console.log("[ERROR] Missing OPENAI_API_KEY in .env");
        process.exit(1);
    }

    openai = new OpenAI({
        apiKey: key
    });

    console.log("[OK] OpenAI ready");

} catch (e) {
    console.log("[ERROR] OpenAI initialization:", e);
    process.exit(1);
}

/* -----------------------------------------------------
   READ system_hardware_info.json
----------------------------------------------------- */
function readSystemInfo() {
    try {
        const raw = fs.readFileSync("system_hardware_info.json", "utf-8");
        const json = JSON.parse(raw);

        const sys = json.system_info;

        return {
            cpu: sys.cpu.model,
            ram: sys.ram.total_gb + " GB",
            gpu: sys.gpus ? sys.gpus.join(", ") : "Unknown",
            model: sys.model,
            manufacturer: sys.manufacturer || "Unknown",
            os: sys.os_platform
        };

    } catch (err) {
        console.log("[ERROR] Reading system_hardware_info.json:", err);
        process.exit(1);
    }
}

/* -----------------------------------------------------
   GET SPECS FROM OPENAI
----------------------------------------------------- */
async function getLaptopDetails(modelName, cpu, ram, gpu) {
    try {
        const prompt = `
Research ALL real specifications for laptop model:
"${modelName}"

Use detected hardware for accuracy:
CPU: ${cpu}
RAM: ${ram}
GPU: ${gpu}

Return STRICT JSON ONLY with this structure:

{
  "laptop_model": "",
  "brand": "",
  "series": "",
  "release_year": "",
  "cpu": "",
  "gpu": "",
  "ram_options": "",
  "max_ram_supported": "",
  "storage_options": "",
  "display": "",
  "battery": "",
  "weight": "",
  "dimensions": "",
  "ports": "",
  "os": "",
  "connectivity": "",
  "webcam": "",
  "keyboard": "",
  "build_quality": "",
  "typical_price_range": ""
}

No explanations. No extra text. JSON ONLY.
`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",     // you can use gpt-4o or gpt-4o-mini
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
            max_tokens: 800
        });

        let text = response.choices[0].message.content.trim();

        if (text.startsWith("```json")) {
            text = text.replace("```json", "").replace("```", "").trim();
        }

        return JSON.parse(text);

    } catch (err) {
        console.log("[ERROR] OpenAI request:", err);
        return null;
    }
}

/* -----------------------------------------------------
   MAIN FLOW
----------------------------------------------------- */
async function main() {
    console.log("[SCAN] Reading system hardware...");

    const scan = readSystemInfo();

    console.log("[SYSTEM] CPU:", scan.cpu);
    console.log("[SYSTEM] RAM:", scan.ram);
    console.log("[SYSTEM] GPU:", scan.gpu);
    console.log("[SYSTEM] Model:", scan.model);

    console.log("[OPENAI] Fetching detailed specifications...");

    const specs = await getLaptopDetails(scan.model, scan.cpu, scan.ram, scan.gpu);

    const output = {
        from_scan: scan,
        specifications: specs,
        error: specs ? null : "OpenAI lookup failed",
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19)
    };

    fs.writeFileSync(
        "laptop_full_specs.json",
        JSON.stringify(output, null, 2),
        "utf-8"
    );

    console.log("[OK] Saved → laptop_full_specs.json");
}

main();