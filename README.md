# Substack to PDF

A Chrome extension that converts Substack articles into clean, beautifully formatted PDFs with one click.

Think of it as a smarter Cmd+P — it strips out subscribe buttons, navigation, and UI clutter, keeping just the article content with proper typography.

## Features

- Extracts title, subtitle, author, date, and full article body
- Clean print layout with Georgia serif body text and system font headings
- Preserves images, blockquotes, code blocks, tables, and formatting
- Handles all Substack page types:
  - Publication pages (`author.substack.com/p/article-name`)
  - Reader feed (`substack.com/@author/p-12345`)
  - Shared links (`substack.com/home/post/p-12345`)
- Works with free and paid articles (you must have access to the content)

## Install

### Chrome Web Store

*Coming soon — pending review.*

### Manual Install (Developer Mode)

1. Download or clone this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the repo folder
5. Navigate to any Substack article and click the extension icon

## How It Works

1. Click the extension icon on any Substack article
2. The popup shows the detected article title
3. Click **Save as PDF** — a print preview opens with the formatted article
4. Chrome's print dialog appears — save as PDF or send to your printer

The extension reads article data from Substack's page variables (`window._preloads`) with a DOM-based fallback for SPA-navigated pages. All processing happens locally in your browser — no data is sent anywhere.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration and permissions |
| `popup.html/js` | Extension popup — detects and extracts articles |
| `print.html/js` | Print preview page — renders and formats the article |
| `icons/` | Extension icons (16, 48, 128px) |

## Privacy

This extension collects no data. See [PRIVACY.md](PRIVACY.md) for details.

## Contributing

Issues and PRs are welcome. Check the [open issues](https://github.com/randomlybrian/substack.pdf/issues) for feature ideas — ones labeled `good first issue` are a great place to start.

## License

MIT
