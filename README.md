# LMS Downloader

A Chromium extension that bulk-downloads files from NUST LMS (Moodle) and packages them into a structured ZIP archive.

## Features

- 🔍 Scans course pages for all downloadable resources
- 📂 Groups files by course section/week
- ☑️ Select/deselect individual files
- ⚡ Adaptive parallel downloads (starts at 3, scales up on fast networks, backs off on rate limits)
- 🔁 Automatic retry with exponential back-off (up to 3 attempts per file)
- 📦 Downloads as a single organized ZIP with filename deduplication
- ⏸️ Pause / Resume / Cancel downloads seamlessly
- 📊 Real-time progress, speed, and ETA

## Installation & Setup

### 1. Requirements

- [Node.js](https://nodejs.org/) (for development and setup)
- A Chromium-based browser (Chrome, Edge, Brave, etc.)

### 2. Clone & Setup

```bash
git clone https://github.com/YOUR_USERNAME/lms-downloader.git
cd lms-downloader

# Download the JSZip library dependency
npm run build
```

### 3. Load into Browser

1. Open your browser and navigate to the extensions page (e.g., `chrome://extensions`).
2. Enable **Developer mode** (toggle in the top right corner).
3. Click **Load unpacked**.
4. Select the `lms-downloader` folder you just cloned.

## Contributing

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request!

When opening a Pull Request, the CI suite will automatically lint the extension manifest and files. To run this locally:

```bash
npm install
npm run lint
```

## License

Distributed under the MIT License. See `LICENSE` for more information.