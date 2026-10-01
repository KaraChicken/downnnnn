# YT-DLP Downloader

A Tauri 2 desktop GUI for yt-dlp. Frontend uses native HTML/CSS/JavaScript; Rust handles yt-dlp and FFmpeg processes.

## Requirements

- Node.js 20+
- Rust stable
- Tauri 2 prerequisites for your OS
- yt-dlp executable
- ffmpeg executable

## Local development

Put binaries in `bin/`:

- Windows: `bin/yt-dlp.exe`, `bin/ffmpeg.exe`
- macOS/Linux: `bin/yt-dlp`, `bin/ffmpeg`

Then:

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

The Tauri bundle includes `bin/*` as resources.

## Features

- URL analysis
- Thumbnail/title/channel/duration
- Best quality, 1080p/720p/480p/360p
- M4A and MP3 audio extraction
- Output directory picker
- Live progress, speed and ETA
- Cancel active download
- yt-dlp logs

Only use the downloader for content you are authorized to download and in compliance with applicable terms and laws.