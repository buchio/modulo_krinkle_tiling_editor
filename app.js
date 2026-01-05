/*
  MIT License
  Copyright (c) 2026 buchio
  See LICENSE file for details.
*/

/**
 * Modulo Krinkle Tiling - Single File Application
 * Integrated for compatibility with file:// protocol (avoiding CORS/Module issues)
 */
// ==========================================
// Configuration
// ==========================================
const TILING_CONFIG = {
    colorCount: 3, // Global number of colors
    wedges: [{
        params: {
            c: 3,
            m: 3,
            k: 7,
            n: 14
        },
        0: { reverse: false, startColor: 0 },
        1: { reverse: true, startColor: 1 },
        2: { reverse: false, startColor: 2 },
        3: { reverse: true, startColor: 1 },
        4: { reverse: false, startColor: 0 },
        5: { reverse: true, startColor: 2 },
        6: { reverse: false, startColor: 0 },
        7: { reverse: true, startColor: 2 },
        8: { reverse: false, startColor: 1 },
        9: { reverse: true, startColor: 0 },
        10: { reverse: false, startColor: 1 },
        11: { reverse: true, startColor: 2 },
        12: { reverse: false, startColor: 0 },
        13: { reverse: true, startColor: 2 },
        // Per-wedge configuration (index: { reverse: boolean, startColor: number })
        // Defaults: reverse = false, startColor = wedgeIndex % colorCount
        // Example:
        // 1: { reverse: true, startColor: 0 }
    }]
};

// ==========================================
// Renderer Class
// Manages drawing to local canvas, zoom, pan, and interaction
// ==========================================
class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;

        // Viewport state
        this.scale = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;

        // Drag operation state
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;

        this.initEvents();
        this.resize();
        this.centerView();

        // Hover state
        this.hoveredWedgeIndex = null; // Index of currently hovered Wedge
        this.hoveredDepth = null;      // Depth (Row Index) of currently hovered tile
        this.mouseX = 0;
        this.mouseY = 0;

        // Visibility flags
        this.showEdges = true;   // Show edge numbers
        this.showWedges = true;  // Show Wedge numbers
        this.showTiles = true;   // Show tile numbers
        this.showFill = false;    // Show fill color
    }

    initEvents() {
        // Resize listener (Window + Canvas Size Change)
        // Using ResizeObserver to detect container changes (e.g. sidebar toggle)
        this.resizeObserver = new ResizeObserver(() => {
            this.resize();
        });
        this.resizeObserver.observe(this.canvas);

        // Also keep window resize for viewport updates if needed
        window.addEventListener('resize', () => {
            console.log('Window resized, redrawing...');
            this.resize();
        });

        // Toggle Panel
        const panel = document.querySelector('.control-panel');
        const btnOpen = document.getElementById('btn-open-panel');
        const btnClose = document.getElementById('btn-close-panel');

        const togglePanel = (show) => {
            if (show) {
                panel.classList.remove('hidden');
                btnOpen.classList.remove('visible');
            } else {
                panel.classList.add('hidden');
                btnOpen.classList.add('visible');
            }

            // Explicitly resize immediately and after transition to ensure redraw
            this.resize();
            setTimeout(() => {
                this.resize();
                if (this.polygons) this.autoCenter(this.polygons);
            }, 320);
        };

        if (btnOpen) btnOpen.addEventListener('click', () => togglePanel(true));
        if (btnClose) btnClose.addEventListener('click', () => togglePanel(false));

        // Mouse events for pan operation
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            this.canvas.style.cursor = 'grabbing';

            // Auto-close removed for split-screen layout
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.lastX;
                const dy = e.clientY - this.lastY;
                this.offsetX += dx;
                this.offsetY += dy;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                this.draw(); // Redraw during drag
            }

            // Update hover detection
            this.handleMouseMove(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        });

        // Touch handling for mobile/tablet highlighting & drag
        // Touch handling: 1 finger = Highlight, 2 fingers = Pan
        this.lastTouchCount = 0;

        const handleTouch = (e) => {
            const touchCount = e.touches.length;

            // Prevent browser scroll
            if (e.type === 'touchmove') e.preventDefault();

            if (touchCount === 1) {
                // 1 Finger: Highlight only
                const t = e.touches[0];
                this.handleMouseMove(t.clientX, t.clientY);

                // Reset drag state so it doesn't get stuck
                this.isDragging = false;
                this.lastTouchCount = 1;

            } else if (touchCount === 2) {
                // 2 Fingers: Pan (Scroll) + Zoom (Pinch)
                const t1 = e.touches[0];
                const t2 = e.touches[1];

                // Calculate midpoint (for Pan)
                const cx = (t1.clientX + t2.clientX) / 2;
                const cy = (t1.clientY + t2.clientY) / 2;

                // Calculate distance (for Zoom)
                const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

                if (this.lastTouchCount !== 2) {
                    // Just switched to 2 fingers, reset reference
                    this.lastX = cx;
                    this.lastY = cy;
                    this.lastPinchDist = dist;
                }

                if (e.type === 'touchmove') {
                    // Pan Logic
                    const dx = cx - this.lastX;
                    const dy = cy - this.lastY;
                    this.offsetX += dx;
                    this.offsetY += dy;
                    this.lastX = cx;
                    this.lastY = cy;

                    // Zoom Logic
                    if (this.lastPinchDist > 0) {
                        const zoomFactor = dist / this.lastPinchDist;
                        const newScale = Math.min(Math.max(0.1, this.scale * zoomFactor), 20);

                        // Optional: Zoom towards center (cx, cy)
                        // Current simple zoom implementation centers on screen center, 
                        // but user asked for "pinch zoom" which implies centering on fingers.
                        // For now, keeping global scale change to match wheel behavior, 
                        // but updating scale directly.
                        this.scale = newScale;
                    }
                    this.lastPinchDist = dist;

                    this.draw();
                }

                this.lastTouchCount = 2;
            } else {
                // 0 or >2 fingers
                this.lastTouchCount = touchCount;
                this.isDragging = false;
            }
        };

        this.canvas.addEventListener('touchstart', handleTouch, { passive: false });
        this.canvas.addEventListener('touchmove', handleTouch, { passive: false });
        this.canvas.addEventListener('touchend', (e) => {
            // Reset on all fingers lifted
            if (e.touches.length === 0) {
                this.isDragging = false;
                this.lastTouchCount = 0;
            } else {
                // If some fingers remain, update count to prevent jumps on next move
                this.lastTouchCount = e.touches.length;
            }
        });

        // Zoom operation (wheel event)
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSensitivity = 0.001;
            const delta = -e.deltaY * zoomSensitivity;
            // Limit zoom scale
            const newScale = Math.min(Math.max(0.1, this.scale + delta), 20);

            // Simple zoom (center-based)
            // * Ideally mouse-position based, but keeping it simple for now
            this.scale = newScale;
            this.draw();
        }, { passive: false });
    }

    resize() {
        // Use clientWidth/Height to fit within flex container (not full window)
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        // Update Panel Scale
        this.updatePanelScale();

        // Do not reset offset on resize to keep user's view context
        // especially on mobile where browser chrome toggles trigger resize.
        this.draw();
    }

    updatePanelScale() {
        const panel = document.querySelector('.control-panel');
        const scaler = document.querySelector('.panel-scaler');

        if (!panel || !scaler) return;

        // Reset to measure natural size
        scaler.style.transform = 'none';
        scaler.style.width = '100%';

        if (panel.clientHeight === 0) return; // Hidden

        // Add buffer to prevent clipping of bottom elements (margins, shadows)
        const contentHeight = scaler.scrollHeight + 50;
        const availableHeight = panel.clientHeight;

        if (contentHeight > availableHeight) {
            const scale = availableHeight / contentHeight;
            // Limit minimum scale to avoid unreadable text (optional, but requested "must fit")
            // We'll stick to fitting it.
            scaler.style.transform = `scale(${scale})`;
            scaler.style.width = `${100 / scale}% `;
        }
    }

    centerView() {
        this.offsetX = this.canvas.width / 2;
        this.offsetY = this.canvas.height / 2;
        this.draw();
    }

    setDisplayData(polygons, mode = 'prototile') {
        this.polygons = polygons;
        this.mode = mode;
        if (mode === 'tiling') {
            this.calculateWedgeCenters();
            this.calculateTileCenters();
        } else if (mode === 'wedge') {
            this.calculateTileCenters();
        }
        this.draw();
    }

    setOptions(options) {
        if (typeof options.showEdges !== 'undefined') this.showEdges = options.showEdges;
        if (typeof options.showWedges !== 'undefined') this.showWedges = options.showWedges;
        if (typeof options.showTiles !== 'undefined') this.showTiles = options.showTiles;
        if (typeof options.showFill !== 'undefined') this.showFill = options.showFill;

        if (typeof options.showAxis !== 'undefined') this.showAxis = options.showAxis;
        if (typeof options.showLines !== 'undefined') this.showLines = options.showLines;
        if (typeof options.highlightWedge !== 'undefined') this.highlightWedge = options.highlightWedge;
        if (typeof options.highlightLayer !== 'undefined') this.highlightLayer = options.highlightLayer;

        this.draw();
    }

    calculateTileCenters() {
        this.tileLabels = [];
        if (!this.polygons) return;

        this.polygons.forEach(poly => {
            if (poly.meta && typeof poly.meta.tileIndex !== 'undefined') {
                // Calculate Centroid
                let sumX = 0, sumY = 0;
                poly.path.forEach(p => {
                    sumX += p.x;
                    sumY += p.y;
                });

                this.tileLabels.push({
                    x: sumX / poly.path.length,
                    y: sumY / poly.path.length,
                    text: poly.meta.tileIndex.toString()
                });
            }
        });
    }

    calculateWedgeCenters() {
        this.wedgeCenters = {};
        if (!this.polygons) return;

        const sums = {};
        const counts = {};
        const bounds = {};

        this.polygons.forEach(poly => {
            if (poly.meta && typeof poly.meta.wedgeIndex !== 'undefined') {
                const idx = poly.meta.wedgeIndex;
                if (!sums[idx]) {
                    sums[idx] = { x: 0, y: 0 };
                    counts[idx] = 0;
                    bounds[idx] = {
                        minX: Infinity, maxX: -Infinity,
                        minY: Infinity, maxY: -Infinity
                    };
                }

                // Calculate Centroid (using path vertices)
                poly.path.forEach(p => {
                    sums[idx].x += p.x;
                    sums[idx].y += p.y;
                    counts[idx]++;

                    if (p.x < bounds[idx].minX) bounds[idx].minX = p.x;
                    if (p.x > bounds[idx].maxX) bounds[idx].maxX = p.x;
                    if (p.y < bounds[idx].minY) bounds[idx].minY = p.y;
                    if (p.y > bounds[idx].maxY) bounds[idx].maxY = p.y;
                });
            }
        });

        for (const idx in sums) {
            const width = bounds[idx].maxX - bounds[idx].minX;
            const height = bounds[idx].maxY - bounds[idx].minY;

            this.wedgeCenters[idx] = {
                x: sums[idx].x / counts[idx],
                y: sums[idx].y / counts[idx],
                width: width,
                height: height
            };
        }
    }

    /**
     * Centers the view on a collection of polygons.
     * @param {Array|Object} polygons - Array of polygons or single polygon
     */
    autoCenter(polygons) {
        if (!polygons) return;
        const polyList = Array.isArray(polygons) ? polygons : [polygons];
        if (polyList.length === 0) return;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        let hasPoints = false;

        polyList.forEach(poly => {
            if (!poly.path || poly.path.length === 0) return;
            poly.path.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
                hasPoints = true;
            });
        });

        if (!hasPoints) return;

        const width = maxX - minX;
        const height = maxY - minY;

        // Add some padding
        const padding = 50;
        const targetW = width + padding * 2;
        const targetH = height + padding * 2;

        const scaleX = this.canvas.width / targetW;
        const scaleY = this.canvas.height / targetH;

        // Basic fit
        this.scale = Math.min(scaleX, scaleY, 5.0); // Limit max zoom

        // Center
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        // Reset offset to center the polygon in the middle of the screen
        this.offsetX = (this.canvas.width / 2) - (cx * this.scale);
        this.offsetY = (this.canvas.height / 2) - (cy * this.scale);

        this.draw();
    }

    draw() {
        if (!this.ctx) return;

        // Clear screen
        this.ctx.fillStyle = '#0d1117'; // Matches CSS background color
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();

        // Apply transform matrix (pan and zoom)
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Draw axes (as guide)
        if (this.showAxis !== false) {
            this.ctx.strokeStyle = '#30363d';
            this.ctx.lineWidth = 1 / this.scale;
            this.ctx.beginPath();
            this.ctx.moveTo(-10000, 0);
            this.ctx.lineTo(10000, 0);
            this.ctx.moveTo(0, -10000);
            this.ctx.lineTo(0, 10000);
            this.ctx.stroke();
        }

        // Draw polygons
        if (this.polygons) {
            this.polygons.forEach(poly => {
                this.ctx.beginPath();
                if (poly.path.length > 0) {
                    this.ctx.moveTo(poly.path[0].x, poly.path[0].y);
                    for (let i = 1; i < poly.path.length; i++) {
                        this.ctx.lineTo(poly.path[i].x, poly.path[i].y);
                    }
                    this.ctx.closePath();
                }

                this.ctx.fillStyle = this.showFill ? poly.color : '#0d1117';
                this.ctx.fill();

                if (this.showLines !== false && poly.stroke) {
                    this.ctx.strokeStyle = poly.stroke;
                    this.ctx.lineWidth = 2 / this.scale;
                    this.ctx.stroke();
                }
            });
        }

        this.ctx.restore();

        // Debug overlay (draw inside transform matrix for alignment)
        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        if (this.polygons) {
            this.polygons.forEach(poly => {
                if (!poly.path || poly.path.length === 0) return;

                // 1. Show Edge numbers (Prototile mode only)
                // 1. Show Edge numbers (Prototile mode only)
                if (this.mode === 'prototile' && this.showEdges) {
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.font = `${14 / this.scale}px sans-serif`;
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';

                    for (let i = 0; i < poly.path.length - 1; i++) {
                        const p1 = poly.path[i];
                        const p2 = poly.path[i + 1];

                        const midX = (p1.x + p2.x) / 2;
                        const midY = (p1.y + p2.y) / 2;

                        this.ctx.fillText(i.toString(), midX, midY);
                    }
                }
            });
        }

        this.ctx.restore();

        // 2. Hover Overlay (Tiling mode - per Wedge)
        // Blue highlight (transparent)
        if (this.mode === 'tiling' && this.highlightWedge !== false && this.hoveredWedgeIndex !== null && this.polygons) {
            this.ctx.save();
            this.ctx.translate(this.offsetX, this.offsetY);
            this.ctx.scale(this.scale, this.scale);

            this.ctx.fillStyle = 'rgba(20, 140, 170, 0.4)';

            this.polygons.forEach(poly => {
                if (poly.meta && poly.meta.wedgeIndex === this.hoveredWedgeIndex) {
                    this.ctx.beginPath();
                    if (poly.path.length > 0) {
                        this.ctx.moveTo(poly.path[0].x, poly.path[0].y);
                        for (let i = 1; i < poly.path.length; i++) {
                            this.ctx.lineTo(poly.path[i].x, poly.path[i].y);
                        }
                        this.ctx.closePath();
                    }
                    this.ctx.fill();
                }
            });

            this.ctx.restore();
        }

        // 3. Depth Overlay (Tiling mode - same depth)
        // Red highlight (transparent)
        if (this.mode === 'tiling' && this.highlightLayer !== false && this.hoveredDepth !== null && this.polygons) {
            this.ctx.save();
            this.ctx.translate(this.offsetX, this.offsetY);
            this.ctx.scale(this.scale, this.scale);

            this.ctx.fillStyle = 'rgba(170, 170, 10, 0.4)';

            this.polygons.forEach(poly => {
                if (poly.meta && typeof poly.meta.r !== 'undefined' && poly.meta.r === this.hoveredDepth) {
                    this.ctx.beginPath();
                    if (poly.path.length > 0) {
                        this.ctx.moveTo(poly.path[0].x, poly.path[0].y);
                        for (let i = 1; i < poly.path.length; i++) {
                            this.ctx.lineTo(poly.path[i].x, poly.path[i].y);
                        }
                        this.ctx.closePath();
                    }
                    this.ctx.fill();
                }
            });

            this.ctx.restore();
        }

        // 4. Draw labels
        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${18 / this.scale}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Tiling mode: Show Wedge numbers
        if (this.mode === 'tiling' && this.wedgeCenters && this.showWedges) {
            const numWedges = Object.keys(this.wedgeCenters).length;
            if (numWedges > 0) {
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillStyle = '#a3b3cc';

                // Get sorted keys to ensure stable sequential numbering
                const sortedKeys = Object.keys(this.wedgeCenters).sort((a, b) => a - b);

                const anglePerWedge = (2 * Math.PI) / numWedges;

                sortedKeys.forEach((key, i) => {
                    const center = this.wedgeCenters[key];
                    const dist = Math.hypot(center.x, center.y);

                    // Estimate width at centroid
                    const arcWidth = dist * anglePerWedge;

                    // Estimate bounds size (diagonal)
                    const boundDiag = Math.hypot(center.width, center.height);

                    // Determine font size based on wedge width approximation
                    let size = Math.min(boundDiag * 0.2, arcWidth * 0.5);
                    size = Math.max(12, size); // Minimum size

                    // Remove / this.scale so font scales with zoom (attached to world)
                    this.ctx.font = `bold ${size}px sans-serif`;
                    this.ctx.fillText(i.toString(), center.x, center.y);
                });
            }
        }

        // Wedge/Tiling mode: Show tile numbers
        if ((this.mode === 'wedge' || this.mode === 'tiling') && this.tileLabels && this.showTiles) {
            this.ctx.font = `bold ${12 / this.scale}px sans-serif`;
            this.tileLabels.forEach(label => {
                // Simple shadow
                this.ctx.shadowColor = "black";
                this.ctx.shadowBlur = 3;
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillText(label.text, label.x, label.y);
                this.ctx.shadowBlur = 0;
            });
        }

        this.ctx.restore();
    }

    handleMouseMove(mx, my) {
        if (!this.polygons || this.mode !== 'tiling') return;

        // Correct for canvas position (e.g. offset by menu)
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = mx - rect.left;
        const canvasY = my - rect.top;

        // Convert mouse coordinates to world coordinates
        // screenX = worldX * scale + offsetX
        // worldX = (screenX - offsetX) / scale
        const worldX = (canvasX - this.offsetX) / this.scale;
        const worldY = (canvasY - this.offsetY) / this.scale;

        // Find hovered polygon
        let foundIndex = null;
        let foundDepth = null;

        // Search in reverse order (top first) in case of overlap
        for (let i = this.polygons.length - 1; i >= 0; i--) {
            const poly = this.polygons[i];
            if (this.isPointInPoly(worldX, worldY, poly.path)) {
                foundIndex = poly.meta ? poly.meta.wedgeIndex : null;
                if (poly.meta && typeof poly.meta.r !== 'undefined') {
                    foundDepth = poly.meta.r;
                }
                break;
            }
        }

        let needsRedraw = false;
        if (this.hoveredWedgeIndex !== foundIndex) {
            this.hoveredWedgeIndex = foundIndex;
            needsRedraw = true;
        }
        if (this.hoveredDepth !== foundDepth) {
            this.hoveredDepth = foundDepth;
            needsRedraw = true;
        }

        if (needsRedraw) {
            this.draw();
        }

    }

    isPointInPoly(x, y, path) {
        // Raycasting algorithm (point in polygon)
        let inside = false;
        for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
            const xi = path[i].x, yi = path[i].y;
            const xj = path[j].x, yj = path[j].y;

            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
}

// ==========================================
// Krinkle Generator Class
// ==========================================
class KrinkleGenerator {
    constructor() {
        this.polygons = [];
        this.palette = [];
        this.paletteType = 'color'; // Default type
        this.currentParams = { m: 0, k: 0, n: 0 };
    }

    /**
     * Generates a color palette based on global config.
     */
    generatePalette(count, type) {
        // Fallback to stored state if args missing
        if (typeof count === 'undefined') {
            count = TILING_CONFIG.colorCount;
        }
        if (typeof type === 'undefined') {
            type = this.paletteType;
        }

        // Update stored state
        this.paletteType = type;
        this.palette = [];
        for (let i = 0; i < count; i++) {
            if (type === 'gray') {
                // Distribute lightness from 25% to 80% to ensure visibility against dark background
                const minL = 25;
                const maxL = 80;
                const range = maxL - minL;
                const step = count > 1 ? range / (count - 1) : 0;
                const l = minL + (step * i);
                this.palette.push(`hsla(0, 0%, ${Math.floor(l)}%, 0.6)`);
            } else {
                // Color mode (Rainbow)
                const hue = Math.floor((360 / count) * i);
                this.palette.push(`hsla(${hue}, 70%, 60%, 0.6)`);
            }
        }
    }

    /**
     * Calculates the color index for a tile.
     * @param {number} r - Row index (depth)
     * @param {number} c - Column index
     * @param {number} wedgeIndex - Index of the wedge
     * @returns {number} - Index in the palette
     */
    getColorIndex(r, c, wedgeIndex) {
        const config = TILING_CONFIG;
        const count = config.colorCount;
        const { m, k, n } = this.currentParams;
        if (!m || !k || !n) return (wedgeIndex % count); // Fallback if params not set

        // config.wedges is now an array of config objects
        let wedgeConfig = {};
        for (const item of config.wedges) {
            if (item.params &&
                item.params.c == config.colorCount &&
                item.params.m == m &&
                item.params.k == k &&
                item.params.n == n
            ) {
                // Found matching configuration for current parameters
                wedgeConfig = item[wedgeIndex] || {};
                break;
            }
        }

        const reverse = (typeof wedgeConfig.reverse !== 'undefined')
            ? wedgeConfig.reverse
            : (wedgeIndex % 2 !== 0);
        const startColor = (typeof wedgeConfig.startColor !== 'undefined')
            ? wedgeConfig.startColor
            : (wedgeIndex % count);

        let baseIndex;
        if (reverse) {
            baseIndex = (count - ((r + c) % count)) % count;
        } else {
            baseIndex = (r + c) % count;
        }

        return (baseIndex + startColor) % count;
    }

    /**
     * Generates a Prototile (Wedge 0).
     * Defines the basic tile shape from the paper.
     * @param {number} m - Parameter m (Step size)
     * @param {number} k - Parameter k (Modulus)
     * @param {number} n - Parameter n (Symmetry - Rotations)
     */
    generatePrototile(m, k, n) {
        console.log(`Generating Prototile with m = ${m}, k = ${k}, n = ${n} `);
        let hasShortPeriod = false;
        this.polygons = [];

        if (n < k) {
            console.error("Parameter Error: n must be >= k");
        }

        if (n < k) {
            console.error("Parameter Error: n must be >= k");
        }

        // 1. Generate sequences (logic based on paper)
        // l_seq (Lower Boundary): [(j * m) % k for j in range(k)] + [k]
        const l_seq = [];
        for (let j = 0; j < k; j++) {
            if (j > 0 && ((j * m) % k) == 0) {
                // Detect short period (returns to zero before closing loop)
                hasShortPeriod = true;
                break;
            }
            l_seq.push((j * m) % k);
        }
        l_seq.push(k);

        // u_seq (Upper Boundary): [k] + [(j * m) % k for j in range(1, k)] + [0]
        const u_seq = [k];
        for (let j = 1; j < k; j++) {
            if (((j * m) % k) == 0) {
                hasShortPeriod = true;
                break;
            }
            u_seq.push((j * m) % k);
        }
        u_seq.push(0);

        // 2. Build Path
        const path = [{ x: 0, y: 0 }];
        let current = { x: 0, y: 0 };

        // Helper: Convert direction index to vector
        const getVector = (dirIndex) => {
            const angle = (dirIndex * 2 * Math.PI) / n;
            const len = 100; // 任意の単位長
            return {
                x: Math.cos(angle) * len,
                y: Math.sin(angle) * len
            };
        };

        // Forward along Lower Boundary (l_seq)
        for (let d of l_seq) {
            const v = getVector(d);
            current = { x: current.x + v.x, y: current.y + v.y };
            path.push(current);
        }

        // Backward along Upper Boundary (u_seq)
        // Reverse u_seq to draw path from current point (tip) back to origin.
        // Python version generates u_pts from origin and joins them,
        // but here we reverse-traverse to form a closed loop.
        const u_seq_rev = [...u_seq].reverse();

        for (let d of u_seq_rev) {
            const v = getVector(d);
            current = { x: current.x - v.x, y: current.y - v.y };
            path.push(current);
        }

        // Check closure (return to start point)
        const closureError = Math.hypot(current.x, current.y);
        console.log(`Prototile generated.Closure Error: ${closureError.toFixed(4)} `);

        this.polygons.push({
            path: path,
            color: 'rgba(88, 166, 255, 0.4)',
            stroke: '#58a6ff',
            meta: { closureError, hasShortPeriod }
        });

        return this.polygons;
    }

    /**
     * Generates a Wedge (Triangular layout of Prototiles).
     * @param {number} m 
     * @param {number} k 
     * @param {number} n 
     * @param {number} rows - Number of rows (Depth)
     */
    generateWedge(m, k, n, rows) {
        this.currentParams = { m, k, n };
        console.log(`Generating Wedge with m = ${m}, k = ${k}, n = ${n}, rows = ${rows} `);
        // First, generate Prototile (base tile) to get sequences and base path
        const basePolygons = this.generatePrototile(m, k, n);
        const basePoly = basePolygons[0];

        // If error or empty
        if (!basePoly || basePoly.path.length === 0) {
            return basePolygons;
        }

        // Helper: Convert direction index to vector
        const getVector = (dirIndex) => {
            const angle = (dirIndex * 2 * Math.PI) / n;
            const len = 100;
            return {
                x: Math.cos(angle) * len,
                y: Math.sin(angle) * len
            };
        };

        const l_seq = [];
        for (let j = 0; j < k; j++) {
            if (j > 0 && ((j * m) % k) == 0) {
                break;
            }
            l_seq.push((j * m) % k);
        }
        l_seq.push(k);

        // Calculate d0 (Vector sum of l_seq - excluding last element 'k')
        // Python: sum(get_v((j * m) % k) for j in range(k))
        let d0 = { x: 0, y: 0 };
        // l_seq は k+1 要素ある (最後は k). 0 から k-1 までイテレート.
        for (let j = 0; j < k; j++) {
            if (j > 0 && ((j * m) % k) == 0) {
                break;
            }
            const v = getVector(l_seq[j]);
            d0.x += v.x;
            d0.y += v.y;
        }

        // Calculate d1 (v_k - v_0)
        // Shift vector in "height" direction of base tile
        const vk = getVector(k);
        const v0 = getVector(0);
        const d1 = {
            x: vk.x - v0.x,
            y: vk.y - v0.y
        };

        // Clear list for Wedge generation
        this.polygons = [];

        // Generate Palette
        this.generatePalette();

        // Color Scheme Array (Legacy fallback if palette fails, though generatePalette ensures it exists)
        // const colors = this.palette; 

        let tileIndex = 0;
        // Loop through specified rows to place tiles
        // r: Depth (row), c: Column
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c <= r; c++) {
                // Calculate shift position: r * d0 + c * d1
                const shiftX = r * d0.x + c * d1.x;
                const shiftY = r * d0.y + c * d1.y;

                // Clone path and shift
                const newPath = basePoly.path.map(p => ({
                    x: p.x + shiftX,
                    y: p.y + shiftY
                }));

                // Coloring logic
                const colorIdx = this.getColorIndex(r, c, 0); // Base Wedge is index 0

                this.polygons.push({
                    path: newPath,
                    color: this.palette[colorIdx],
                    stroke: '#888',
                    meta: {
                        wedgeIndex: 0,
                        tileIndex: tileIndex++,
                        r: r,
                        c: c
                    }
                });
            }
        }

        return this.polygons;
    }

    /**
     * Generates Full Tiling (Front Checking Algorithm).
     * @param {number} m 
     * @param {number} k 
     * @param {number} n 
     * @param {number} rows - Defined as Wedge size, sometimes reused as 'w_limit'
     * @param {boolean} isOffset - Whether Offset Mode is enabled
     */
    generateTiling(m, k, n, rows, isOffset) {
        // Store current params for color lookup
        this.currentParams = { m, k, n };

        // Offset Mode Logic:
        // - No Offset: w_limit = n (Fill entire circle with Wedges)
        // - Offset: w_limit = n / 2 (Fill half, then copy by rotation)
        let w_limit = isOffset ? (n / 2) : n;

        console.log(`Generating Tiling with m = ${m}, k = ${k}, n = ${n}, isOffset = ${isOffset}, w_limit = ${w_limit} `);


        // 1. Generate Base Wedge (Wedge 0)
        // Use generateWedge logic, but we also need u_seq for front calculation.
        // Conveniently reusing part of generatePrototile to get sequences.

        let hasShortPeriod = false;

        // Generate u_seq (Upper Boundary)
        const u_seq = [k];
        for (let j = 1; j < k; j++) {
            if (((j * m) % k) == 0) {
                hasShortPeriod = true;
                break;
            }
            u_seq.push((j * m) % k);
        }
        u_seq.push(0);

        // ヘルパー
        const getVector = (dirIndex) => {
            const angle = (dirIndex * 2 * Math.PI) / n;
            const len = 100;
            return {
                x: Math.cos(angle) * len,
                y: Math.sin(angle) * len
            };
        };

        // Generate base Wedge 0
        // Place per Wedge, similar to Python script
        const wedge0Polys = this.generateWedge(m, k, n, rows);
        if (!wedge0Polys || wedge0Polys.length === 0) return [];

        // this.polygons will be cleared later, so save Wedge 0 data
        const baseWedge = [...wedge0Polys];

        // 結果配列の初期化
        this.polygons = []; // Clear global list to fill with all Wedges

        // Initialize Front (Boundary)
        // Python: front_directions = list(u_seq[:-1])
        // Front represents the connecting surface (list of direction vectors) for placing next Wedge
        const front_directions = u_seq.slice(0, u_seq.length - 1);

        // 定数
        const unit_angle = (2 * Math.PI) / n;
        const wedge_offsets = [];
        for (let i = 0; i < w_limit; i++) wedge_offsets.push(i % 3);

        // Helper: Clone and transform polygon (Rotate/Translate)
        const addTransformedWedge = (polys, offsetX, offsetY, rotationIndex, colorOffset) => {
            const rotAngle = rotationIndex * unit_angle;

            // Ensure palette is ready (should be done at start of generation)
            if (this.palette.length !== TILING_CONFIG.colorCount) {
                this.generatePalette();
            }

            polys.forEach(p => {
                // Rotate then translate
                // x' = x*cos - y*sin + tx
                // y' = x*sin + y*cos + ty
                const cos = Math.cos(rotAngle);
                const sin = Math.sin(rotAngle);

                const newPath = p.path.map(pt => ({
                    x: (pt.x * cos - pt.y * sin) + offsetX,
                    y: (pt.x * sin + pt.y * cos) + offsetY
                }));

                // Color calculation
                // Use new configurable logic
                const r = p.meta.r || 0;
                const c = p.meta.c || 0;

                // rotationIndex is the actual wedge index in circular layout
                const cIdx = this.getColorIndex(r, c, rotationIndex);

                this.polygons.push({
                    path: newPath,
                    color: this.palette[cIdx],
                    stroke: '#888',
                    meta: { ...p.meta, wedgeIndex: rotationIndex }
                });
            });
        };

        // Add Wedge 0 (Origin, No rotation)
        addTransformedWedge(baseWedge, 0, 0, 0, wedge_offsets[0]);

        // Loop from 1 to w_limit-1 to place remaining Wedges
        console.log(`Starting loop for ${w_limit} wedges.Front: `, front_directions);
        for (let i = 1; i < w_limit; i++) {
            // Find j_star: where front_directions[j] == i
            // i.e., find where in current front matches the direction of next Wedge
            let j_star = -1;
            for (let idx = 0; idx < front_directions.length; idx++) {
                if (front_directions[idx] == i) {
                    j_star = idx;
                    break;
                }
            }

            console.log(`Wedge ${i}: Found j_star = ${j_star} in front` + JSON.stringify(front_directions));

            if (j_star === -1) {
                console.warn(`Warning: direction ${i} not found in front for wedge ${i}`);
                continue;
            }

            // Calculate start position (start_pos)
            // Sum of vectors up to j_star
            let startX = 0, startY = 0;
            for (let idx = 0; idx < j_star; idx++) {
                const v = getVector(front_directions[idx]);
                startX += v.x;
                startY += v.y;
            }

            // Add transformed Wedge
            addTransformedWedge(baseWedge, startX, startY, i, wedge_offsets[i]);

            // Update Front
            // Boundary is updated by placed Wedge
            front_directions[j_star] = i + k;
            console.log(`Updated front at ${j_star} to ${i + k}: `, front_directions);
        }

        // 3. (OFFSET MODE ONLY) 180-degree Rotation Copy
        // In Offset Mode, generate half, then fill rest by point-symmetric copy
        if (isOffset) {
            console.log("Offset Mode: Applying 180-degree rotation copy...");
            // Pivot (Rotation Center) is midpoint of first edge of first Wedge (Wedge 0)
            // Wedge 0 starts at (0,0). First edge is direction 0.
            const v0 = getVector(0);
            const pivot = { x: v0.x / 2, y: v0.y / 2 };

            console.log("Pivot:", pivot);

            const initialCount = this.polygons.length;
            // Duplicate current polygons
            const currentPolys = JSON.parse(JSON.stringify(this.polygons));

            currentPolys.forEach(p => {
                // Rotate 180 degrees around pivot
                // x' = 2*px - x
                // y' = 2*py - y
                const newPath = p.path.map(pt => ({
                    x: 2 * pivot.x - pt.x,
                    y: 2 * pivot.y - pt.y
                }));

                this.polygons.push({
                    path: newPath,
                    color: p.color,
                    stroke: p.stroke,
                    // Metadata to identify copy by offset
                    meta: { ...p.meta, isCopy: true, wedgeIndex: p.meta.wedgeIndex + 10000 }
                });
            });
            console.log(`Added ${this.polygons.length - initialCount} polygons via rotation.`);
        }

        return this.polygons;
    }
}

// ==========================================
// Main Application Logic
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('tiling-canvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }

    const ctx = canvas.getContext('2d');
    const renderer = new Renderer(canvas, ctx);
    const generator = new KrinkleGenerator();

    // Get UI elements
    const inputK = document.getElementById('param-mod');
    const inputM = document.getElementById('param-a');
    const inputT = document.getElementById('param-t') || document.getElementById('param-b');
    const inputOffset = document.getElementById('param-offset');

    // New UI elements
    const inputMode = document.getElementById('display-mode');
    const inputRows = document.getElementById('param-rows');
    const groupRows = document.getElementById('group-rows');
    const valRows = document.getElementById('val-rows');
    const valA = document.getElementById('val-a');
    const valMod = document.getElementById('val-mod');
    const valT = document.getElementById('val-t');

    // Visibility Toggle Containers
    const toggleEdgesContainer = document.getElementById('toggle-edges-container');
    const toggleWedgesContainer = document.getElementById('toggle-wedges-container');
    const toggleTilesContainer = document.getElementById('toggle-tiles-container');

    // Toggle Checkboxes
    const inputShowEdges = document.getElementById('show-edges');
    const inputShowWedges = document.getElementById('show-wedges');
    const inputShowTiles = document.getElementById('show-tiles');
    const inputFillMode = document.getElementById('input-fill-mode');

    // New Visual Toggles
    const checkShowAxis = document.getElementById('check-show-axis');
    const checkShowLines = document.getElementById('check-show-lines');
    const checkHighlightWedge = document.getElementById('check-highlight-wedge');
    const checkHighlightLayer = document.getElementById('check-highlight-layer');

    if (!inputK || !inputM || !inputT) {
        console.error("Critical Error: Missing UI inputs.", { inputK, inputM, inputT });
        const statusText = document.getElementById('status-text');
        if (statusText) statusText.textContent = "Error: UI initialization failed. Check console.";
        return;
    }


    const statusText = document.getElementById('status-text');



    function gcd(a, b) {
        return b === 0 ? a : gcd(b, a % b);
    }

    function updateTiling(e) {
        let k = parseInt(inputK.value, 10);
        let m = parseInt(inputM.value, 10);

        // Enforce m < k (User Request)
        if (e && e.target) {
            if (e.target === inputM && m >= k) {
                // If m is increased >= k, push k up
                k = m + 1;
                inputK.value = k;
            } else if (e.target === inputK && k <= m) {
                // If k is decreased <= m, clamp k to m + 1
                k = m + 1;
                inputK.value = k;
            }
        }

        // Enforce gcd(m, k) = 1 (User Request)
        // If not coprime, increase k until it is.
        while (gcd(m, k) !== 1) {
            k++;
        }
        // Update UI if k changed
        if (parseInt(inputK.value, 10) !== k) {
            inputK.value = k;
        }

        if (valMod) valMod.textContent = k;
        if (valA) valA.textContent = m;

        const t = parseInt(inputT.value, 10);
        if (valT) valT.textContent = t;

        const isOffset = inputOffset ? inputOffset.checked : false;

        // Get Mode and Parameters
        const mode = inputMode ? inputMode.value : 'prototile';
        const rows = inputRows ? parseInt(inputRows.value, 10) : 5;
        if (valRows) valRows.textContent = rows;

        // Toggle depth input (rows) visibility
        if (groupRows) {
            groupRows.style.display = (mode === 'wedge' || mode === 'tiling') ? 'block' : 'none';
        }

        // Control display toggle options based on mode:
        // Prototile: Edge #
        // Wedge: Tile #
        // Tiling: Wedge #, Tile #
        if (toggleEdgesContainer) toggleEdgesContainer.style.display = (mode === 'prototile') ? 'block' : 'none';
        if (toggleWedgesContainer) toggleWedgesContainer.style.display = (mode === 'tiling') ? 'block' : 'none';
        if (toggleTilesContainer) toggleTilesContainer.style.display = (mode === 'wedge' || mode === 'tiling') ? 'block' : 'none';

        // Configure Fill Mode
        const fillMode = inputFillMode ? inputFillMode.value : 'none';


        let showFill = false;

        if (fillMode !== 'none') {
            showFill = true;
            const parts = fillMode.split('-');
            if (parts.length === 2) {
                const count = parseInt(parts[0], 10);
                const type = parts[1];
                TILING_CONFIG.colorCount = count;
                generator.generatePalette(count, type);
            }
        }

        // Update Renderer Settings
        renderer.setOptions({
            showEdges: inputShowEdges ? inputShowEdges.checked : true,
            showWedges: inputShowWedges ? inputShowWedges.checked : true,
            showTiles: inputShowTiles ? inputShowTiles.checked : true,
            showFill: showFill,
            showAxis: checkShowAxis ? checkShowAxis.checked : true,
            showLines: checkShowLines ? checkShowLines.checked : true,
            highlightWedge: checkHighlightWedge ? checkHighlightWedge.checked : true,
            highlightLayer: checkHighlightLayer ? checkHighlightLayer.checked : true
        });

        // Calculate Parameter n
        let n;
        if (!isOffset) {
            n = k * t;
        } else {
            // Offset Logic (Python Compatible): n = 2 * (t * k - m)
            n = 2 * (t * k - m);
        }

        // バリデーションエラー表示
        if (n < k) {
            statusText.textContent = "Error: n (k*t) must be >= k";
            statusText.style.color = "#ff6b6b";
            return;
        }

        statusText.style.color = "#8b949e";
        statusText.textContent = (mode === 'wedge') ? "Generating Wedge..." : "Generating Prototile...";

        // Use setTimeout to delay processing for UI update
        setTimeout(() => {
            let polygons = [];

            try {
                if (mode === 'wedge') {
                    if (typeof generator.generateWedge === 'function') {
                        polygons = generator.generateWedge(m, k, n, rows);
                    } else {
                        throw new Error("generateWedge method missing");
                    }
                } else if (mode === 'tiling') {
                    if (typeof generator.generateTiling === 'function') {
                        polygons = generator.generateTiling(m, k, n, rows, isOffset);
                    } else {
                        throw new Error("generateTiling method missing");
                    }
                } else {
                    polygons = generator.generatePrototile(m, k, n);
                }
            } catch (e) {
                console.error("Generation failed:", e);
                statusText.textContent = "Error: " + e.message;
                statusText.style.color = "#ff6b6b";
                return;
            }

            if (!polygons) {
                console.error("Generator returned undefined");
                polygons = [];
            }

            renderer.setDisplayData(polygons, mode);

            // Auto-center on first load or change
            if (polygons.length > 0) {
                renderer.autoCenter(polygons);
            }
            statusText.textContent = `(m, k, n) = (${m}, ${k}, ${n})[${mode}]`;

            const hasShortPeriod = polygons[0]?.meta?.hasShortPeriod || false;
            if (hasShortPeriod) {
                statusText.style.color = "#ff6b6b";
            } else {
                statusText.style.color = "#8b949e";
            }

            // Re-check layout scaling after content update
            if (renderer.updatePanelScale) renderer.updatePanelScale();
        }, 10);
    }

    // Mode-specific preferences (Default: Wedge=ON, Tiling=OFF)
    const modePreferences = {
        prototile: { showTiles: false, fillMode: 'none' },
        wedge: { showTiles: true, fillMode: 'none' },
        tiling: { showTiles: false, fillMode: 'none' }
    };
    let currentMode = inputMode ? inputMode.value : 'tiling';

    // Apply initial preference
    if (modePreferences[currentMode]) {
        if (inputShowTiles) inputShowTiles.checked = modePreferences[currentMode].showTiles;
        if (inputFillMode) inputFillMode.value = modePreferences[currentMode].fillMode;
    }

    if (inputMode) {
        inputMode.addEventListener('change', (e) => {
            const newMode = e.target.value;
            // Apply pref for new mode
            if (modePreferences[newMode]) {
                if (inputShowTiles) inputShowTiles.checked = modePreferences[newMode].showTiles;
                if (inputFillMode) inputFillMode.value = modePreferences[newMode].fillMode;
            }
            currentMode = newMode;
        });

        if (inputShowTiles) {
            inputShowTiles.addEventListener('change', (e) => {
                if (modePreferences[currentMode]) {
                    modePreferences[currentMode].showTiles = e.target.checked;
                }
            });
        }

        if (inputFillMode) {
            inputFillMode.addEventListener('change', (e) => {
                if (modePreferences[currentMode]) {
                    modePreferences[currentMode].fillMode = e.target.value;
                }
            });
        }
    }

    // Add real-time update listeners for input changes
    const inputs = [inputK, inputM, inputT, inputOffset, inputMode, inputRows,
        inputShowEdges, inputShowWedges, inputShowTiles, inputFillMode,
        checkShowAxis, checkShowLines, checkHighlightWedge, checkHighlightLayer];
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('input', updateTiling);
            input.addEventListener('change', updateTiling);
        }
    });

    // Handle Window Resize (Regenerate Shapes as requested)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        // Debounce to prevent excessive regeneration
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            console.log('Window resized, regenerating tiling...');
            updateTiling();
        }, 300);
    });

    // Adjust slider visual widths to be proportional to their max values (User Request)
    function adjustSliderWidths() {
        if (!inputK || !inputM) return;

        const maxK = parseInt(inputK.getAttribute('max') || 50, 10);
        const maxM = parseInt(inputM.getAttribute('max') || 50, 10);

        // Find maximum scale
        const globalMax = Math.max(maxK, maxM);
        const labelOffset = '112px'; // 100px min-width + 12px gap

        // Update K
        const ratioK = maxK / globalMax;
        inputK.style.flexGrow = '0'; // Stop auto-growing
        inputK.style.width = `calc((100% - ${labelOffset}) * ${ratioK})`;

        // Update M
        const ratioM = maxM / globalMax;
        inputM.style.flexGrow = '0';
        inputM.style.width = `calc((100% - ${labelOffset}) * ${ratioM})`;
    }
    adjustSliderWidths();

    // Initial Draw
    updateTiling();
});
