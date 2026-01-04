## January 4, 2026

### Creation of Modulo Krinkle Tiling Editor

- **v1.0.0 - Initial Release**
    - Implementation of the Modulo Krinkle Tiling generation engine based on arXiv:2506.07638.
    - Visualization in three modes (Prototile, Wedge, Tiling) and real-time editing of parameters ($m, k, n$).
    - Tiling generation using a front-tracking algorithm and logic for overlap-free, gapless placement.
    - UI featuring dark mode and glassmorphism, with highlighting functionality for each tile row (Depth).

### UI/UX Improvements & Mobile Responsiveness

- **v1.1.0 - Responsive Design & Controls Update**
    - **Mobile Optimization**: Default layout now supports mobile devices. The control panel moves to the bottom on smaller screens.
    - **Toggleable Panel**: Added a hide/view toggle button for the control panel to maximize viewing area.
    - **Enhanced Controls**: Replaced numeric inputs with range sliders for intuitive parameter adjustment ($m, k, t, \text{Rows}$).
    - **Layout Adjustments**: Aligned labels and sliders horizontally for better usability.

- **v1.2.0 - Advanced Mobile & Interactive Updates**
    - **Fixed Sidebar Layout**: Refactored the control panel from a floating element to a fixed sidebar (Desktop: Left, Mobile: Top/Bottom Split).
    - **Mobile Enhancements**:
        - **Docked Panel**: Panel moves to the top on mobile for better ergonomics.
        - **Safe Area Support**: Optimized for devices with notches (iPhone) using `viewport-fit=cover` and safe-area padding.
        - **Fixed Overlays**: Buttons and GitHub ribbon are now `fixed` to ensure visibility regardless of scrolling.
        - **Auto-Scaling**: Control panel automatically scales down to fit the screen height without scrolling.
    - **Touch Interactions**:
        - **One-Finger**: Inspect/Highlight elements without moving the canvas.
        - **Two-Fingers**: Pan and Pinch-to-Zoom the canvas.
    - **UI Polish**:
        - **Close Button**: Moved to a full-width footer button for easier access.
        - **Separation**: Added clear visual boundaries (borders/shadows) between the menu and canvas.
        - **Contextual Icons**: Close icon direction adapts to the layout (Left/Up/Down).
    - **License**:
        - Added MIT License to the project.
