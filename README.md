# Pixel ICO Creator

A retro-style, browser-based pixel icon editor for creating `.ico` files with exactly two sizes:

- 16×16
- 32×32

## Features

- Side-by-side editing for both icon sizes.
- Old-school 256-color palette (web-safe 216 + 40 grayscale shades).
- 10 custom color slots with color picker.
- Custom colors persisted to `localStorage`.
- 100% live preview canvases for 16×16 and 32×32.
- Direct ICO import/export (PNG-based ICO entries).
- Optional PNG download for each size.

## Try it

https://brunoassuncao.github.io/iconzzz/

## Run locally

Since this is a static app, any static server works:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## ICO compatibility note

This app exports ICO files with PNG image entries, which are supported by modern systems and browsers. For import, PNG-based ICO entries are supported.
