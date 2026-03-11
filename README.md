# LMS Downloader

A Chromium extension that bulk-downloads files from NUST LMS (Moodle) and packages them into a structured ZIP archive.

## Features

- **Automated Scanning**: Instantly detects downloadable resources on course pages.
- **Structured Output**: Automatically organizes files into directories by course section or week within the final ZIP archive.
- **Adaptive Concurrency**: Manages parallel downloads and automatically throttles request rates to respect server limits (HTTP 429).
- **Deduplication**: Resolves naming conflicts by intelligently renaming identical files within the same section.
- **Customizable Selection**: Allows users to include or exclude specific files prior to downloading.

## Installation

*Note: The extension is currently pending approval on the Microsoft Edge Add-ons and Chrome Web Stores. In the interim, it can be installed manually.*

### 1. Download the Extension
1. Navigate to the [Releases page](../../releases/latest) on GitHub.
2. Download the `.zip` file associated with the latest release (e.g., `lms-downloader-v1.2.0.zip`).
3. Extract the contents of the ZIP archive to a folder on your computer.

### 2. Load into Browser

**For Microsoft Edge:**
1. Open Edge and navigate to `edge://extensions/`.
2. Enable **Developer mode** (toggle located in the bottom left).
3. Click **Load unpacked** (top right).
4. Select the folder containing the extracted extension files.

**For Google Chrome:**
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle located in the top right).
3. Click **Load unpacked** (top left).
4. Select the folder containing the extracted extension files.

## Usage

1. Log in to your NUST LMS account and navigate to any course page.
2. Click the LMS Downloader icon in your browser toolbar.
3. Select the desired files from the list.
4. Click **Download ZIP** to begin the packaging process.

## Development

To build the extension from source:

```bash
git clone https://github.com/YOUR_USERNAME/lms-downloader.git
cd lms-downloader

# Download the required JSZip dependency
npm run setup
```

Once the setup script completes, the repository folder can be loaded as an unpacked extension in your browser for testing and development.

## License

Distributed under the MIT License. See `LICENSE` for more information.