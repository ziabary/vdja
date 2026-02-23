read this summary. I'll give you current source code in next message 
---

# **Final PDF Extraction Pipeline Summary (2026 Version – Geometry Extended)**

---
## **Step 0 – extractPageGeometry**

* **Purpose:** Extract unified geometric primitives (text, raster, vector) from the PDF drawing stream before layout segmentation.

* **Input:**
  * `page.getTextContent()`
  * `page.getOperatorList()`

* **Key considerations:**
  * Preserve **all glyph info** (styles, positions, font, etc.).
  * Compute accurate glyph bounding boxes (viewport transformed).
  * Ignore **overlapping / non-positive glyph gaps** when computing spacing statistics (kerning, ligatures, artifacts).
  * Maintain **CTM (current transform matrix)**.
  * Maintain **graphics state stack** (`save` / `restore`).
  * Accumulate paths:

    * `moveTo`
    * `lineTo`
    * `curveTo`
    * `rectangle`
  * On `stroke` / `fill`:
    * Compute path bounding box.
    * Extract line segments.
    * Classify orientation (horizontal / vertical / other).
  * Track:
    * Line length
    * Orientation
    * Intersection candidates
  * Respect nested transforms inside:
    * `paintFormXObjectBegin`
    * `paintFormXObjectEnd`
  * No need to simulate:
    * Color
    * Clipping
    * Shading
    * Rendering intent
    * Text state

* **Computed primitive-level features:**
  * `glyphDensity`
  * `fontSizeVariance`
  * Line orientation statistics
  * Line intersection candidates
  * Vector bounding boxes
  * Image bounding boxes

* **Output:**

```ts
interface PageGeometry {
  textPrimitives: GlyphPrimitive[]
  imagePrimitives: ImagePrimitive[]
  vectorSegments: LineSegment[]
  vectorBoxes: BoundingBox[]
}
```

This output feeds Step 1 and Step 2.

---

## **Step 1 – extractNativeTextBlocks**

* **Purpose:** Group glyphs into atomic sub-blocks without merging into full lines yet.

* **Input:** `PageGeometry.textPrimitives`

* **Key considerations (unchanged + geometry-aware context):**

  * Preserve **all glyph info** (styles, positions, font, etc.).
  * Ignore **overlapping / non-positive glyph gaps** when computing spacing statistics (kerning, ligatures, font artifacts).
  * Compute **glyph density per block** (`glyphCount / bbox.area`) → used later in XY-cut vetoes.
  * Detect **RTL/LTR per block**, not per page:
    * Primary signal: Unicode script majority
    * Fallback: geometric glyph order (tables, numbers, code, mixed scripts)
  * Preserve geometry needed for later **multi-line alignment detection** (final alignment computed after line & paragraph reconstruction).
  * Handle first-line indents and partial-width lines — alignment may require context from neighboring lines.
  * Mixed RTL/LTR within a block is rare but allowed and handled later during line reconstruction if needed.
  * Preserve `fontSizeVariance` per block (used later in XY-cut and table scoring).

* **Output:**
  Array of `IntfTextBlock` sub-blocks with glyphs, style info, alignment metadata, RTL flag, density, and font variance.

---

## **Step 2 – XY-Cut (`runXYCut`)**

* **Purpose:** Recursively split page into visual regions based on gaps.

* **Input:**

  * Text blocks (Step 1)
  * `imagePrimitives`
  * `vectorBoxes`
  * `vectorSegments`

* **Key considerations (original + extended):**

  * Use **adaptive gaps** (median + MAD), axis-aware (vertical gaps tolerate higher variance than horizontal).
  * **Veto splitting** if crossing blocks:
    * Have **high glyph density** (formulas, dense inline text)
    * Have **high font-size variance** (math, mixed semantics)
    * Contain **strong orthogonal vector grid structure** (table candidate)
    * Have **high line intersection density**
  * Veto is **purely geometric/statistical** (no semantic types).
  * Optionally **pre-mask low-density regions** (figures, illustrations) to reduce hierarchy errors (advanced / optional).
  * Merge adjacent regions vertically if x-overlap is strong and vertical gap small.
  * Configurable **max depth / iteration**.
  * Convergence is checked using hash of block IDs + bounding boxes to guarantee termination.
  * Now geometry-aware: vectorBoxes influence gap boundaries.

* Output regions are **layout-only** and intentionally classification-agnostic.

---

## **Step 3 – Region Classification**

* **Purpose:** Assign type (`text`, `table`, `table-candidate`, `image`, `illustration`) to XY-cut regions.

* **Input:**

  * Region blocks
  * `vectorSegments`
  * `vectorBoxes`

* **Key considerations (original + extended):**

  * Compute **features** per region:

    * Glyph density
    * Font variance
    * Grid alignment
    * x/y starts
    * Area ratios
    * Orthogonality score (horizontal/vertical line ratio)
    * Line intersection density
    * Row/column spacing regularity

  * Compute **table confidence (`tableScore`)** based on:

    * Grid alignment strength
    * Low font variation within rows
    * Row/column uniformity
    * Strong orthogonal vector presence
    * Consistent line spacing
    * High intersection density

  * Assign:

    * `table` if score ≥ 0.75
    * `table-candidate` if 0.45–0.75 (protect from column/paragraph merging)
    * Else fallback to `text`.

  * Distinguish **image vs illustration** using:

    * Glyph count
    * Vector complexity
    * Curve dominance
    * Area coverage
    * Centered short text / caption proximity.

  * **Captions:** Compute `captionConfidence` if bold/short text near visual region.

  * Preserve **sub-blocks** for later line reconstruction.

---

## **Step 4 – Column Detection**

* **Purpose:** Detect textual columns inside `text` regions.

* **Key considerations (unchanged):**

  * Only applied to regions classified as `kind === "text"` by Step 3.
  * Table and table-candidate regions are excluded structurally.
  * Column detection does not re-evaluate table confidence.
  * Compute **column uniformity**:

    * Column width variance < 12–15%
    * Inter-column gaps small and consistent (low MAD)
    * Font families ≤ 2–3
  * RTL/LTR + alignment considered per block.
  * Skip table-like regions.

* **Output:** Columns of blocks (sub-blocks still preserved).

---

## **Step 5 – Line Reconstruction & Paragraph Merging (Highest Priority)**

* **Purpose:** Merge sub-blocks into lines and paragraphs inside text regions.

* **Process (unchanged):**

  1. **Horizontal reconstruction:** Convert glyph clusters into real lines (`reconstructLineFromGlyphs`) using glyph geometry, direction-aware spacing, and font-style runs.

  2. **Sort top → bottom** for reading order.

  3. **Vertical paragraph merging:** Use thresholds for:

     * Max vertical gap (dynamic, based on font height)
     * Horizontal overlap (min fraction for same paragraph)
     * Horizontal drift (to allow slight misalignment)
     * Column alignment (same column X delta)

  4. **Skip non-text regions:** `image`, `illustration`, `table` (strong confidence ≥ 0.75).

* **Key considerations (unchanged):**

  * RTL/LTR spacing handled explicitly during line reconstruction.
  * Virtual-space-only glyphs are ignored when computing gaps.
  * Respect **justified text** — allow partial-width first lines for indents.
  * Detect **single non-full-width lines** (lists, code, captions) and merge carefully using `isFullWidthLine` and line geometry metadata.
  * Line-level geometry (baseline Y, height, xStart/xEnd) is preserved for paragraph merging.

* **Output:** `text` or `table-candidate` regions with **merged paragraphs**.

---

## **Step 6 – Output / Pipeline Completion**

* **Text regions:** concatenate merged paragraphs with double newlines.

* **Tables / table-candidates:** output plain text or tab-separated lines; later convert to markdown tables.

* **Images / illustrations:** output placeholder + caption if exists.

* **OCR fallback:** for visual-dominant regions without text:

  * Rasterize region
  * Call Tesseract.js
  * Replace region.blocks with OCR-derived text

* **Final ordering:** top → bottom, then left → right (reading order).

---

## **Step 7 – Optional / Advanced Enhancements**

* Pre-mask visual-dominant regions before XY-cut to reduce hierarchy errors.
* Mixed RTL/LTR splitting within a block during line reconstruction.
* Advanced table markdown reconstruction using `vectorSegments` + `xStarts` and `yStarts`.
* Automatic detection of headings vs normal paragraphs (font size + boldness).
* Merge collinear vector segments before table scoring to strengthen grid detection.

---

## **Immediate Implementation Priorities (Updated)**

1. Implement `GeometryInterpreter` (Step 0).
2. Add `glyphDensity` per block.
3. Improve XY-cut veto using density + font variance + orthogonal vector detection.
4. Add `table-candidate` kind.
5. Complete line reconstruction + paragraph merge.
6. Test on diverse real documents (multi-column, table-heavy, Persian RTL, mixed content, vector-heavy PDFs).

---

✅ **Notes / Edge Cases Covered**

* RTL/LTR detection per block.
* Justified text and first-line indents.
* Single non-full-width lines (lists, preformatted text).
* Table and figure protection in XY-cut.
* Paragraph merging only inside text, not visual-dominant regions.
* Output ordered top → bottom, left → right.

---
Just focus on Step 1. does this code need any changes? If yes give me in diff format
