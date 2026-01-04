# Modulo Krinkle Tiling Viewer

An interactive tool for generating and visualizing "Modulo Krinkle Tilings" (as proposed in [arXiv:2506.07638](https://arxiv.org/abs/2506.07638)) directly in the browser, featuring real-time rendering and parameter manipulation.

This project was inspired by [mk.tiling.jp/playground](https://mk.tiling.jp/playground/). While it might not look as polished as the original, I added features to show how it works under the hood.

**[🚀 Live Demo](https://buchio.github.io/modulo_krinkle_tiling_editor/)**

I built this tool using [Antigravity](https://antigravity.google/) and [NotebookLM](https://notebooklm.google.com/). These tools helped me create it in a single day, something I couldn't have done alone. Thank you, Google!

## Features

- **Real-time Generation**: Tiling is recalculated immediately when parameters ($m, k, t$) are changed.
- **3 Display Modes**:
  - **Prototile (Single)**: Displays the base tile (prototile) and its boundary sequence.
  - **Wedge (Layout)**: Displays a "Wedge" consisting of prototiles arranged in a triangular layout.
  - **Tiling (Full)**: Displays the full tiling filling a circular area by rotating and placing Wedges.
- **Interactive Control**: Supports panning via mouse drag and zooming via scroll wheel.
- **Detailed Visualization**:
  - Toggle display of Edge numbers, Tile numbers, and Wedge numbers.
  - Wedge highlight on hover and Depth (Row) highlight.
  - Support for Offset Mode ($n = 2(tk - m)$).

## Usage

This application is designed to run in a local environment (no build required).

1. Open `index.html` in this directory with a browser (Chrome, Firefox, Safari, etc.).
2. Manipulate parameters from the control panel at the top left of the screen.

## Parameters

| Parameter | Description | Mathematical Meaning |
| --- | --- | --- |
| **m (Step)** | Step size of the sequence (gradient) | $y \equiv m \cdot x \pmod k$ |
| **k (Mod)** | Modulus | Standard for period and size |
| **t (Period)** | Period coefficient | Determines symmetry $n$ ($n = k \times t$) |
| **Offset** | Offset Mode | Changes the calculation formula when enabled ($n = 2(tk - m)$) |
| **Display Mode** | Display mode toggle | Prototile / Wedge / Tiling |
| **Rows (Depth)** | Generation depth | Affects the number of rows in a Wedge and the density of tiling |

## Controls

- **Pan View**: Drag inside the screen
- **Zoom**: Mouse wheel (scroll)
- **Toggle Display**:
  - `Show Edge #`: Show edge indices (Prototile mode)
  - `Show Wedge #`: Show Wedge indices (Tiling mode)
  - `Show Tile #`: Show individual tile indices

## File Structure

- `index.html`: Entry point. Describes the UI structure.
- `app.js`: All application logic (UI control, rendering, calculation).
- `style.css`: Stylesheet. Dark mode / Glassmorphism design.

## TODO

- [ ] Improve coloring logic

## Deployment (GitHub Pages)

This project is ready for **GitHub Pages**.

1. Go to the project's **Settings** tab on GitHub.
2. Click **Pages** in the left sidebar.
3. Under **Build and deployment** > **Source**, select **Deploy from a branch**.
4. Under **Branch**, select `main` and `/ (root)`.
5. Click **Save**.

Your site will be live at `https://buchio.github.io/modulo_krinkle_tiling_editor/` shortly.
