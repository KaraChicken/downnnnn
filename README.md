# YT-DLP Downloader

A lightweight Electron desktop GUI for yt-dlp, using native HTML/CSS/JavaScript.

## Features

- URL analysis with thumbnail, title, channel and duration
- Best quality, 1080p/720p/480p/360p
- M4A and MP3 audio extraction
- Output directory picker
- Live progress, speed and ETA
- Cancel active download
- yt-dlp logs
- Windows NSIS .exe and .msi installers

## Requirements

- Node.js 20+
- Windows for the bundled Windows build
- bin/yt-dlp.exe
- bin/ffmpeg.exe

## Local development

Put yt-dlp and FFmpeg in bin/, then run:

    npm install
    npm run dev

## Build Windows installers

    npm run build

Electron Builder copies bin/* into the packaged application's resources.

Only use the downloader for content you are authorized to download and in compliance with applicable terms and laws.
