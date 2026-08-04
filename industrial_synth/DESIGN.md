---
name: Industrial Synth
colors:
  surface: '#fff8f6'
  surface-dim: '#f2d3ca'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1ed'
  surface-container: '#ffe9e3'
  surface-container-high: '#ffe2da'
  surface-container-highest: '#fbdcd3'
  on-surface: '#281712'
  on-surface-variant: '#5c4037'
  inverse-surface: '#3f2c26'
  inverse-on-surface: '#ffede8'
  outline: '#916f65'
  outline-variant: '#e6beb2'
  surface-tint: '#ad3300'
  primary: '#a93100'
  on-primary: '#ffffff'
  primary-container: '#d34000'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb59e'
  secondary: '#326854'
  on-secondary: '#ffffff'
  secondary-container: '#b3ecd2'
  on-secondary-container: '#376c58'
  tertiary: '#005da8'
  on-tertiary: '#ffffff'
  tertiary-container: '#0076d3'
  on-tertiary-container: '#fdfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59e'
  on-primary-fixed: '#3a0b00'
  on-primary-fixed-variant: '#842500'
  secondary-fixed: '#b6efd5'
  secondary-fixed-dim: '#9ad2b9'
  on-secondary-fixed: '#002116'
  on-secondary-fixed-variant: '#17503d'
  tertiary-fixed: '#d4e3ff'
  tertiary-fixed-dim: '#a4c9ff'
  on-tertiary-fixed: '#001c39'
  on-tertiary-fixed-variant: '#004884'
  background: '#fff8f6'
  on-background: '#281712'
  surface-variant: '#fbdcd3'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 80px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: 0.05em
  headline-md:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.5'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  mono-label:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 40px
  technical-gap: 8px
---

## Brand & Style

This design system is built on the "Industrial Synth" aesthetic, heavily inspired by the precision and tactile nature of high-end hardware. It is professional, precise, and avant-garde, designed specifically for an escrow marketplace where transparency and technical accuracy are paramount.

The UI avoids soft decorative elements in favor of functional aesthetics. It utilizes a **Brutalist-Modernist** hybrid style:
- **Grid-Centric:** Every element is locked to a rigorous technical grid.
- **Hardware-Inspired:** Components mimic physical switches, toggles, and machined parts.
- **Data-Forward:** Technical information is treated with the same visual hierarchy as marketing copy, using monospaced fonts and bracketed numbering (e.g., `[01]`, `[02]`) to index content.
- **High Transparency:** The layout reveals its structure through thin borders and clear visual "wiring" between related data points.

## Colors

The palette is derived from industrial safety equipment and classic synthesizer hardware. 

- **Primary (Safety Orange):** Reserved for critical actions, status indicators, and primary branding. It serves as a high-visibility warning and call-to-action color.
- **Secondary (Forest Green):** Used for "stable" states, successful transaction indicators, and deep structural backgrounds to provide relief from the high-energy orange.
- **Background & Surface:** A warm, architectural off-white (`#E6E2D3`) forms the canvas, with a slightly lighter surface tint (`#F2F1ED`) used to define technical modules and data containers.
- **Ink (Text/Border):** A near-black `#1A1A1A` provides sharp, high-contrast definition for all typography and structural lines.

## Typography

The typography strategy separates "Editorial" intent from "Technical" intent.

- **Headlines:** Use **Inter** with wide tracking and tight line heights. Large display headers should feel "stamped" onto the page.
- **Body:** **Inter** is used for readability in descriptions and documentation.
- **Technical/Data:** **JetBrains Mono** is mandatory for all labels, numerical data, status codes, and bracketed navigation. 
- **Tracking:** Use wide letter spacing (+5% or more) for uppercase headlines and mono-labels to reinforce the technical/schematic feel.

## Layout & Spacing

The layout uses a **strict fluid grid** based on a 4px baseline. 

- **Columns:** 12-column grid for desktop, 4-column for mobile.
- **Gutters:** 16px fixed gutters between all primary content blocks.
- **Margins:** Generous outer margins (40px) to frame the "machine" interface.
- **Rhythm:** Spacing is "tight" to mimic dense hardware panels. Use 8px (2 units) for internal component spacing and 24px-32px for section separation.
- **Technical Offsets:** Occasionally break the grid with small, deliberate offsets or "tags" that sit halfway between grid lines to simulate a technical drawing.

## Elevation & Depth

This design system rejects traditional shadows and blurs. Depth is achieved through **Tonal Layering** and **Bold Outlines**:

- **No Shadows:** Use 1px solid borders (`#1A1A1A`) to define all containers and interactive zones.
- **Stacking:** Use the Surface color (`#F2F1ED`) against the Background (`#E6E2D3`) to create a "recessed" or "mounted" effect for dashboard modules.
- **High-Contrast Selection:** Active states are indicated by solid color fills (Primary Orange or Secondary Green) rather than elevation changes.
- **Connector Lines:** Use thin 1px vertical or horizontal lines to visually link related technical data, simulating wire traces on a circuit board.

## Shapes

The shape language is strictly **geometric and sharp**.

- **Sharp Corners:** All buttons, input fields, and containers must have 0px border-radius.
- **Circular Accents:** Perfectly circular shapes are reserved exclusively for "mechanical" elements like dials, toggle switches, or status LEDs.
- **Structural Lines:** 1px borders are the primary method of shape definition. No soft edges or organic curves are permitted.

## Components

- **Buttons:** Sharp 0px corners. Primary buttons use a solid Safety Orange fill with White or Black text. Secondary buttons are outlined in 1px Black with a Mono-spaced label.
- **Technical Tags:** Small bracketed labels like `[01]` or `[STATUS: OK]` should precede all major section headers and list items.
- **Input Fields:** Flat, outlined boxes with monospaced placeholder text. The "focus" state uses a thick 2px Primary Orange border.
- **Cards/Modules:** Defined by 1px borders. Header areas of cards should have a subtle background tint (`#F2F1ED`) and be separated from the card body by a horizontal 1px line.
- **Dials/Toggles:** For AI parameter settings, use hardware-inspired UI components like circular rotary dials or horizontal sliding toggles with high-contrast indicator pips.
- **Status Indicators:** Small circular "LEDs" that glow in Forest Green (active/secure) or Safety Orange (warning/attention).