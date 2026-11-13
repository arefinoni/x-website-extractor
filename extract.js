
const { chromium } = require("playwright");
const { getDomain } = require("tldts");
const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const readline = require("readline/promises");

// ============================================================
// CONFIGURATION
// ============================================================

const OUTPUT = "website-links.txt";
const PROCESSED = "processed-profiles.txt";
const PROFILE_LIST = "profiles.txt";

const DEBUG_PORT = 9222;
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const WAIT_TIMEOUT = 10 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================
// FILE HELPERS
// ============================================================

function readSet(file) {
  if (!fs.existsSync(file)) return new Set();

  return new Set(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function appendLine(file, value) {
  fs.appendFileSync(file, `${value}\n`, "utf8");
}

// ============================================================
// DEFAULT BROWSER DETECTION (WINDOWS)
// ============================================================

function getDefaultBrowser() {
  if (process.platform !== "win32") {
    throw new Error("This version currently supports Windows only.");
  }

  const userChoiceKey = String.raw`HKCU\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice`;

  const result = execFileSync(
    "reg",
    ["query", userChoiceKey, "/v", "ProgId"],
    { encoding: "utf8" }
  );

  const progIdMatch = result.match(/ProgId\s+REG_SZ\s+(.+)/i);

  if (!progIdMatch) {
    throw new Error("Could not detect your Windows default browser.");
  }

  const progId = progIdMatch[1].trim();
  const commandKey = `HKCR\\${progId}\\shell\\open\\command`;

  const commandResult = execFileSync(
    "reg",
    ["query", commandKey, "/ve"],
    { encoding: "utf8" }
  );

  const commandMatch = commandResult.match(/\(Default\)\s+REG_SZ\s+(.+)/i);

  if (!commandMatch) {
    throw new Error("Could not locate your default browser executable.");
  }

  const command = commandMatch[1].trim();

  // Handles normal Windows registry formats.
  const exeMatch =
    command.match(/^"([^"]+\.exe)"/i) ||
    command.match(/^(.+?\.exe)(?:\s|$)/i);

  if (!exeMatch) {
    throw new Error(`Could not identify the browser executable from: ${command}`);
  }

  const executable = exeMatch[1];
  const lower = executable.toLowerCase();

  let userDataDir;

  if (lower.includes("brave")) {
    userDataDir = path.join(
      process.env.LOCALAPPDATA,
      "BraveSoftware",
      "Brave-Browser",
      "User Data"
    );
  } else if (lower.includes("msedge")) {
    userDataDir = path.join(
      process.env.LOCALAPPDATA,
      "Microsoft",
      "Edge",
      "User Data"
    );
  } else if (lower.includes("chrome")) {
    userDataDir = path.join(
      process.env.LOCALAPPDATA,
      "Google",
      "Chrome",
      "User Data"
    );
  } else if (lower.includes("vivaldi")) {
    userDataDir = path.join(
      process.env.LOCALAPPDATA,
      "Vivaldi",
      "User Data"
    );
  } else {
    throw new Error(
      `Unsupported default browser: ${executable}\n` +
        "Supported browsers: Brave, Chrome, Edge and Vivaldi."
    );
  }

  if (!fs.existsSync(userDataDir)) {
    throw new Error(`Browser profile directory not found: ${userDataDir}`);
  }

  return {
    executable,
    userDataDir,
    imageName: path.basename(executable),
  };
}

// ============================================================
// BROWSER PROCESS CHECK
// ============================================================

function isBrowserRunning(imageName) {
  try {
    const result = execFileSync(
      "tasklist",
      ["/FI", `IMAGENAME eq ${imageName}`, "/FO", "CSV", "/NH"],
      { encoding: "utf8" }
    );

    return result.toLowerCase().includes(`"${imageName.toLowerCase()}"`);
  } catch {
    return false;
  }
}

// ============================================================
// REMOTE DEBUGGING
// ============================================================

async function isDebuggingAvailable() {
  try {
    const response = await fetch(`${DEBUG_URL}/json/version`);

    if (!response.ok) return false;

    const data = await response.json();
    return Boolean(data.webSocketDebuggerUrl);
  } catch {
    return false;
  }
}

function launchDefaultBrowser(info) {
  console.log("Launching your default browser...");

  const args = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${info.userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "https://x.com/home",
  ];

  const child = spawn(info.executable, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });

  child.on("error", (error) => {
    console.error("Browser launch error:", error.message);
  });

  child.unref();
}

async function connectToBrowser() {
  if (!(await isDebuggingAvailable())) {
    const info = getDefaultBrowser();

    console.log(`Detected default browser: ${info.executable}`);

    if (isBrowserRunning(info.imageName)) {
      throw new Error(
        "Your default browser is already running without remote debugging.\n\n" +
          "Save your work, close ALL browser windows, and make sure the browser " +
          "has fully exited. Then run npm start again."
      );
    }

    launchDefaultBrowser(info);

    console.log("Waiting for browser connection...");

    const started = Date.now();

    while (Date.now() - started < 30000) {
      if (await isDebuggingAvailable()) break;
      await sleep(500);
    }

    if (!(await isDebuggingAvailable())) {
      throw new Error(
        "Could not start remote debugging.\n" +
          "Check your browser installation and try again."
      );
    }
  }

  console.log("Connecting to browser...");

  const browser = await chromium.connectOverCDP(DEBUG_URL);
  const context = browser.contexts()[0];

  if (!context) {
    throw new Error("Could not find an open browser context.");
  }

  return { browser, context };
}

// ============================================================
// WAIT FOR USER TO OPEN THE FOLLOWING PAGE
// ============================================================

function isFollowingPage(url) {
  return /^https?:\/\/(www\.)?(x\.com|twitter\.com)\/[^/?#]+\/following(?:[/?#]|$)/i.test(
    url
  );
}

async function waitForFollowingPage(context) {
  console.log("\n========================================");
  console.log("              READY TO START");
  console.log("========================================\n");

  console.log("Your browser is ready.");
  console.log("1. Log in to X if necessary.");
  console.log("2. Open your X Following page.");
  console.log("3. Return to this terminal.");
  console.log("4. Press ENTER to begin.\n");

  const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await terminal.question("Press ENTER when ready: ");
  terminal.close();

  console.log("\nWaiting for your Following page...");

  const started = Date.now();
  let lastMessage = 0;

  while (Date.now() - started < WAIT_TIMEOUT) {
    const page = context.pages().find((candidate) =>
      isFollowingPage(candidate.url())
    );

    if (page) {
      console.log("Following page detected!\n");
      return page;
    }

    if (Date.now() - lastMessage > 15000) {
      console.log("Still waiting for your Following page...");
      lastMessage = Date.now();
    }

    await sleep(1000);
  }

  throw new Error("Following page was not detected within 10 minutes.");
}

// ============================================================
// COLLECT FOLLOWING ACCOUNTS
// ============================================================

async function collectProfiles(page) {
  console.log("Collecting followed accounts...");

  const profiles = new Set();
  let unchanged = 0;

  while (unchanged < 8) {
    const links = await page
      .locator('[data-testid="UserCell"] a[href^="/"]')
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("href"))
      );

    const previousCount = profiles.size;

    for (const link of links) {
      const match = link?.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);

      if (match) profiles.add(match[1]);
    }

    unchanged = profiles.size === previousCount ? unchanged + 1 : 0;

    console.log(`Accounts discovered: ${profiles.size}`);

    await page.mouse.wheel(0, 1400);
    await sleep(1800);
  }

  if (!profiles.size) {
    throw new Error(
      "No accounts found. Make sure the Following page has loaded."
    );
  }

  const accounts = [...profiles];

  fs.writeFileSync(PROFILE_LIST, `${accounts.join("\n")}\n`, "utf8");

  console.log(`\nFound ${accounts.length} profiles.\n`);

  return accounts;
}

// ============================================================
// URL NORMALIZATION
// ============================================================

function normalizeUrl(value) {
  if (!value) return null;

  let url = value.trim();

  // Ignore visibly truncated URLs.
  if (/…|\.\.\./.test(url)) return null;

  // Remove common punctuation around URLs.
  url = url.replace(/^[("'<>]+|[)"'>,;.!?]+$/g, "");

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const host = parsed.hostname.toLowerCase();

    // Do not save X's own domains or unresolved short links.
    if (
      host === "x.com" ||
      host.endsWith(".x.com") ||
      host === "twitter.com" ||
      host.endsWith(".twitter.com") ||
      host === "t.co"
    ) {
      return null;
    }

    // Standardize output to HTTPS and remove www.
    parsed.protocol = "https:";
    parsed.hostname = host.replace(/^www\./, "");
    parsed.hash = "";

    return parsed.href;
  } catch {
    return null;
  }
}

// ============================================================
// DOMAIN-LEVEL DUPLICATE DETECTION
// ============================================================

function getWebsiteKey(url) {
  try {
    const parsed = new URL(url);

    // Subdomains of the same main domain count as duplicates.
    return getDomain(parsed.hostname) || parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

// ============================================================
// EXTRACT URLS FROM BIO TEXT
// ============================================================

function extractUrlsFromText(text) {
  if (!text) return [];

  const pattern =
    /(?:https?:\/\/|www\.)[^\s<>"']+|(?<![@\w.-])(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?/gi;

  const matches = text.match(pattern) || [];

  return matches.map(normalizeUrl).filter(Boolean);
}

// ============================================================
// RESOLVE X SHORTENED LINKS
// ============================================================

async function resolveShortLink(context, url) {
  try {
    const response = await context.request.get(url, {
      timeout: 12000,
      maxRedirects: 5,
    });

    return normalizeUrl(response.url());
  } catch {
    return null;
  }
}

// ============================================================
// EXTRACT LINKS FROM A PROFILE
// ============================================================

async function extractProfileLinks(page, context) {
  // Separate website field on the X profile.
  const websiteLinks = await page
    .locator('[data-testid="UserUrl"]')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        href: element.href,
        text: element.innerText || element.textContent || "",
        title: element.title || "",
        expanded: element.getAttribute("data-expanded-url") || "",
      }))
    );

  // Clickable links inside the bio.
  const bioLinks = await page
    .locator('[data-testid="UserDescription"] a[href]')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        href: element.href,
        text: element.innerText || element.textContent || "",
        title: element.title || "",
        expanded: element.getAttribute("data-expanded-url") || "",
      }))
    );

  // Plain text in the bio may also contain URLs.
  const bioText = await page
    .locator('[data-testid="UserDescription"]')
    .textContent()
    .catch(() => "");

  const allLinks = [...websiteLinks, ...bioLinks];
  const extracted = new Set();

  for (const link of allLinks) {
    const candidates = [link.expanded, link.text, link.title];

    let found = null;

    for (const candidate of candidates) {
      const urls = extractUrlsFromText(candidate);

      if (urls.length) {
        found = urls[0];
        break;
      }
    }

    if (found) extracted.add(found);

    // Resolve t.co links when visible text does not reveal the URL.
    if (/^https?:\/\/t\.co\//i.test(link.href) && !found) {
      const resolved = await resolveShortLink(context, link.href);

      if (resolved) extracted.add(resolved);
    }

    // Keep direct external links as a fallback.
    if (link.href && !/t\.co\//i.test(link.href)) {
      const direct = normalizeUrl(link.href);

      if (direct) extracted.add(direct);
    }
  }

  // Capture plain text URLs from the bio.
  for (const url of extractUrlsFromText(bioText)) {
    extracted.add(url);
  }

  return [...extracted];
}

// ============================================================
// LOAD EXISTING RESULTS
// ============================================================

function loadExistingResults() {
  const links = readSet(OUTPUT);
  const keys = new Set();

  for (const link of links) {
    const normalized = normalizeUrl(link);

    if (!normalized) continue;

    const key = getWebsiteKey(normalized);

    if (key) keys.add(key);
  }

  return { links, keys };
}

// ============================================================
// PROCESS PROFILES
// ============================================================

async function processProfiles(page, context, accounts) {
  const processed = readSet(PROCESSED);
  const { keys: savedKeys } = loadExistingResults();

  console.log(`Existing unique websites: ${savedKeys.size}`);
  console.log(`Previously processed profiles: ${processed.size}`);
  console.log("Starting extraction...\n");

  let completedThisRun = 0;
  let newLinksThisRun = 0;
  let failedThisRun = 0;

  for (const username of accounts) {
    if (processed.has(username)) continue;

    console.log(`Checking @${username}...`);

    let successful = false;

    try {
      await page.goto(`https://x.com/${username}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Wait for the profile name/header to appear.
      await page.locator('[data-testid="UserName"]').waitFor({
        state: "attached",
        timeout: 15000,
      });

      await sleep(1000);

      const websiteLinks = await extractProfileLinks(page, context);
      let foundOnProfile = 0;

      for (const url of websiteLinks) {
        const key = getWebsiteKey(url);

        if (!key || savedKeys.has(key)) continue;

        savedKeys.add(key);
        appendLine(OUTPUT, url);

        foundOnProfile++;
        newLinksThisRun++;

        console.log(`  + ${url}`);
      }

      if (!foundOnProfile) {
        console.log("  No new websites.");
      }

      successful = true;
    } catch (error) {
      failedThisRun++;

      console.log(`  Failed @${username}: ${error.message}`);
    }

    // Only mark successfully loaded profiles as processed.
    // Failed profiles will be retried on the next run.
    if (successful) {
      processed.add(username);
      appendLine(PROCESSED, username);
      completedThisRun++;
    }

    console.log(`  Processed: ${processed.size}/${accounts.length}`);
    console.log(`  Unique websites: ${savedKeys.size}\n`);

    // Moderate browsing pace.
    await sleep(1800 + Math.random() * 1000);
  }

  console.log("\n========================================");
  console.log("           EXTRACTION COMPLETE");
  console.log("========================================");
  console.log(`Completed this run: ${completedThisRun}`);
  console.log(`Failed this run: ${failedThisRun}`);
  console.log(`New websites found: ${newLinksThisRun}`);
  console.log(`Total unique websites: ${savedKeys.size}`);
  console.log(`\nWebsite links: ${OUTPUT}`);
  console.log(`Progress file: ${PROCESSED}`);

  if (failedThisRun) {
    console.log("\nSome profiles failed and were not marked complete.");
    console.log("They can be retried the next time you run the script.");
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("\n========================================");
  console.log("       X FOLLOWING WEBSITE EXTRACTOR");
  console.log("========================================\n");

  const { context } = await connectToBrowser();

  console.log("Connected successfully!\n");

  let page = context.pages().find((candidate) =>
    candidate.url().includes("x.com")
  );

  if (!page) {
    page = await context.newPage();
    await page.goto("https://x.com/home");
  }

  // Does not intentionally change browser theme or X appearance settings.
  // Uses the existing browser profile and its current preferences.

  const followingPage = await waitForFollowingPage(context);
  const accounts = await collectProfiles(followingPage);

  await processProfiles(followingPage, context, accounts);

  console.log("\nBrowser will remain open.");
  console.log("Thank you for using the extractor!\n");

  // Disconnect the script without intentionally closing the browser.
  process.exit(0);
}

// ============================================================
// ERROR HANDLING
// ============================================================

main().catch((error) => {
  console.error("\n========================================");
  console.error("                ERROR");
  console.error("========================================\n");

  console.error(error.message);

  console.error("\nFix the issue above and run npm start again.");

  process.exit(1);
});
