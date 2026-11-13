# X Following Website Extractor

Automatically extract website links from the profiles you follow on X (formerly Twitter).

X Following Website Extractor visits each accessible profile, collects external links from both the profile website section and clickable links in the bio, removes duplicate websites, and saves the results to a text file.

No more manually opening profiles, checking bios, copying links, and navigating back.

## Features

- Automatically detects your Windows default browser.
- Supports Brave, Google Chrome, Microsoft Edge, and Vivaldi.
- Uses your existing browser profile when launching the browser.
- Can reuse an existing browser session when remote debugging is available on port `9222`.
- Waits for you to open your X Following page.
- Collects followed accounts automatically.
- Extracts links from the separate profile website field.
- Extracts clickable links inside profile bios.
- Detects plain URLs written directly in bios.
- Attempts to resolve X shortened `t.co` links.
- Normalizes HTTP and HTTPS URLs.
- Removes duplicate websites based on their main domain.
- Treats `www` and subdomains as the same website.
- Saves extracted links immediately.
- Tracks successfully processed profiles.
- Supports resuming interrupted extraction.
- Preserves existing browser theme and appearance preferences.
- Does not require a browser extension or cookie editor.

## Requirements

- Windows 10 or Windows 11.
- Node.js 18 or newer.
- npm.
- A supported Chromium-based browser.
- An X account.

### Supported browsers

- Brave
- Google Chrome
- Microsoft Edge
- Vivaldi

Firefox and Safari are not currently supported.

## Installation

### 1. Install Node.js

Download Node.js from:

https://nodejs.org/

Install the LTS version.

Verify the installation using PowerShell:

```powershell
node --version
npm --version
```

### 2. Download the project

Clone the repository:

```powershell
git clone https://github.com/YOUR_USERNAME/x-following-website-extractor.git
```

Alternatively, download the repository as a ZIP file and extract it.

Open PowerShell inside the project directory:

```powershell
cd x-following-website-extractor
```

### 3. Install dependencies

Run:

```powershell
npm install
```

This installs the required dependencies:

- Playwright
- tldts

The project uses Playwright to communicate with your browser and tldts to identify main domains for duplicate detection.

No additional browser extension is required.

## How to Use

### Step 1. Start the application

Run:

```powershell
npm start
```

The application will:

1. Check whether remote debugging is already available on port `9222`.
2. If available, connect to the browser exposing that debugging port.
3. Otherwise, detect your Windows default browser.
4. Check whether that browser is already running.
5. Launch the browser with remote debugging enabled if the browser is not already running.
6. Connect to the browser.

**Important:** If your default browser is already running without remote debugging, close all its windows and background processes before starting the application again.

Save your work before closing the browser.

If another browser or application is already using port `9222`, the application may connect to the wrong browser or fail. Make sure the port is available or belongs to the browser you intend to use.

### Step 2. Log in to X

When the browser opens, log in to your X account if necessary.

The application attempts to use your existing browser profile and login session.

If your session is not available, log in manually.

### Step 3. Open your Following page

Navigate to your X Following page.

Example:

```text
https://x.com/yourusername/following
```

Wait until the page has loaded.

### Step 4. Start extraction

Return to the PowerShell terminal.

You will see instructions similar to:

```text
Your browser is ready.

1. Log in to X if necessary.
2. Open your X Following page.
3. Return to this terminal.
4. Press ENTER to begin.

Press ENTER when ready:
```

Press **Enter**.

The application will wait for your Following page to be detected, collect the accounts, and start extracting website links.

### Step 5. Monitor progress

The terminal displays extraction progress.

Example:

```text
Connected successfully!

Following page detected!

Collecting followed accounts...
Accounts discovered: 202

Found 202 profiles.

Starting extraction...

Checking @example1...
  + https://example.com
  Processed: 1/202
  Unique websites: 1

Checking @example2...
  No new websites.
  Processed: 2/202
  Unique websites: 1
```

Wait until extraction is complete.

The time required depends on the number of followed accounts, page loading speed, and X availability.

## Output Files

The application automatically creates three files.

| File | Description |
|---|---|
| `website-links.txt` | Extracted website URLs |
| `processed-profiles.txt` | Usernames successfully processed |
| `profiles.txt` | Collected usernames from your Following page |

### Example output

`website-links.txt`

```text
https://example.com
https://portfolio.org
https://company.net
https://anotherwebsite.com
```

The main output file contains only website links.

## URL Normalization and Duplicate Detection

The extractor treats HTTP and HTTPS as equivalent.

It also ignores `www` and subdomains when checking for duplicate websites.

For example:

| Discovered URL | Result |
|---|---|
| `http://example.com` | Saved |
| `https://example.com` | Duplicate |
| `https://www.example.com` | Duplicate |
| `https://blog.example.com` | Duplicate |
| `https://shop.example.com` | Duplicate |
| `https://another.com` | Saved |

Only one URL per main domain is saved.

The first discovered URL is retained in the output.

Different paths on the same domain are also treated as duplicates.

For example:

```text
https://example.com/about
https://example.com/contact
https://example.com/portfolio
```

Only the first discovered URL will be saved.

The application standardizes saved URLs to HTTPS and removes URL fragments.

## Resume Support

The extractor saves each new website immediately after discovering it.

It also maintains a record of successfully processed profiles.

If the application is interrupted:

1. Run `npm start` again.
2. Open your Following page.
3. Press Enter when prompted.

Previously processed profiles will be skipped.

Profiles that failed to load are not marked as completed and can be retried on the next run.

### Start a completely fresh extraction

Delete these files:

```text
website-links.txt
processed-profiles.txt
profiles.txt
```

Then run:

```powershell
npm start
```

This starts a fresh extraction.

### Reprocess all profiles while keeping existing websites

Delete only:

```text
processed-profiles.txt
```

Then run:

```powershell
npm start
```

Previously collected websites will remain, and domain-level duplicate detection will prevent them from being added again.

## Privacy and Browser Behavior

The application uses a local browser connection and attempts to use your existing browser profile.

It does not intentionally:

- Change X dark mode or light mode.
- Modify your X account settings.
- Export or upload browser cookies.
- Require a cookie editor extension.
- Include usernames or bios in the main website output file.
- Send extracted website links to an external server.

The application uses a local remote debugging connection to communicate with the browser.

**Security warning:** Remote debugging can provide access to your browser session. The debugging port must remain restricted to localhost. Never expose it to a public network or share its connection details.

## Troubleshooting

### Browser does not open

Check that your default browser is installed and supported.

Also make sure all existing browser processes have been closed before running the application.

### Browser is already running

Close all browser windows and background processes, then run:

```powershell
npm start
```

### Cannot connect to the browser

Check whether remote debugging is available on port `9222`.

You can test it by opening:

```text
http://127.0.0.1:9222/json/version
```

If the page returns browser debugging information, a debugging endpoint is available.

If the connection is refused, remote debugging is not running.

### Following page not detected

Make sure you are on your actual Following page:

```text
https://x.com/yourusername/following
```

Press Enter in the terminal only after opening the page.

### No websites found

Check whether the profiles contain external website links or clickable bio links.

Some shortened links may not resolve, and some profiles may not have external websites.

### Extraction stops unexpectedly

Run the application again.

Successfully processed profiles will be skipped, and failed profiles can be retried.

### Want to process everyone again?

Delete `processed-profiles.txt` and run the application again.

Keep `website-links.txt` if you want to retain previously collected websites.

## Limitations

- Designed for Windows.
- Requires a supported Chromium-based browser.
- Requires remote debugging access through port `9222`.
- Only accessible profiles can be processed.
- X may temporarily restrict automated browsing.
- Some shortened or unavailable links may not resolve.
- Browser profile reuse can be affected by browser security restrictions.
- The Following page must load its accounts successfully.
- The application does not bypass X access restrictions or anti-automation protections.
- Extraction results depend on the profile information X makes available.

Use this tool responsibly and respect X's Terms of Service and applicable rate limits.

## License

This project is licensed under the MIT License.

See the [LICENSE](LICENSE) file for details.

## Disclaimer

This is an independent community project. It is not affiliated with, endorsed by, or officially associated with X Corp. or Twitter.
