/** How the gold frame is shaded: flat gradient, a two-band carved chamfer, or a lit emboss. */
export type FrameBevel = 'flat' | 'chamfer' | 'embossed';

/** How the embossed glyph is shaped: a rounded, pillowed surface, or a flat face with a bevelled rim. */
export type GlyphBevel = 'rounded' | 'edge';

/** How the painted glyph's strokes run: along a shared flow field, or traced along the glyph's own path. */
export type GlyphStrokeFlow = 'field' | 'traced';

/** Glyph colouring: shared parchment tones, bright tones from the group's own hue, or the frame's gold. */
export type GlyphColorMode = 'parchment' | 'tinted' | 'gold';

/** Painted-backdrop noise: none, soft cloudy blotches, fine stone grain, posterized brush dabs, a canvas-paint filter on the surfaces themselves, or real layered brush strokes painting panel and frame. */
export type PanelTexture =
	| 'none'
	| 'clouds'
	| 'grain'
	| 'brushed'
	| 'canvas'
	| 'strokes';

/** Shared visual tokens for every icon. Tinting per group comes from `deriveGroupPalette`. */
export type Theme = {
	canvasSize: number;
	/** Share of the exported image the icon spans, (0, 1]: below 1 leaves a transparent margin. */
	iconFill: number;
	outerCornerRadius: number;
	borderWidth: number;
	innerCornerRadius: number;
	glyphScale: number;
	borderGoldLight: string;
	borderGoldMid: string;
	borderGoldDark: string;
	innerEdgeColor: string;
	glyphColorTop: string;
	glyphColorBottom: string;
	glyphShadowColor: string;
	frameBevel: FrameBevel;
	isGlyphEmbossed: boolean;
	glyphBevel: GlyphBevel;
	/** Drop-shadow strength under the glyph, 0–1. */
	glyphShadowOpacity: number;
	glyphColorMode: GlyphColorMode;
	hasGlyphGlow: boolean;
	/** Outline added around the glyph, in glyph units, to thicken thin weights. 0 disables it. */
	glyphStrokeWidth: number;
	panelTexture: PanelTexture;
	/** Dents the embossed frame with noise, like hand-hammered metal. Needs `frameBevel: 'embossed'`. */
	isFrameHammered: boolean;
	/** Brush size multiplier for the 'strokes' texture: below 1 paints more, finer strokes; above 1 fewer, broader ones. */
	brushScale: number;
	/** Paint relief on the panel's strokes, 0–1: 1 is full impasto, 0 paints them flat. The frame keeps its relief. */
	panelStrokeDepth: number;
	/** Paint relief on the glyph's strokes, 0–1, on the same scale as `panelStrokeDepth`. */
	glyphStrokeDepth: number;
	/** Direction of the glyph's strokes for the 'strokes' texture. */
	glyphStrokeFlow: GlyphStrokeFlow;
};

/** Per-group background colours derived from a single hue. */
export type GroupPalette = {
	backgroundCenter: string;
	backgroundEdge: string;
	glow: string;
	glyphTintTop: string;
	glyphTintBottom: string;
};

export const DEFAULT_THEME = {
	canvasSize: 512,
	iconFill: 1,
	outerCornerRadius: 64,
	borderWidth: 26,
	innerCornerRadius: 42,
	glyphScale: 0.58,
	borderGoldLight: '#f7e08f',
	borderGoldMid: '#c4952f',
	borderGoldDark: '#5e3d0c',
	innerEdgeColor: '#140d05',
	glyphColorTop: '#fff6dc',
	glyphColorBottom: '#e0c68c',
	glyphShadowColor: '#000000',
	frameBevel: 'flat',
	isGlyphEmbossed: false,
	glyphBevel: 'rounded',
	glyphShadowOpacity: 0.75,
	glyphColorMode: 'parchment',
	hasGlyphGlow: false,
	glyphStrokeWidth: 0,
	panelTexture: 'none',
	isFrameHammered: false,
	brushScale: 1,
	panelStrokeDepth: 1,
	glyphStrokeDepth: 1,
	glyphStrokeFlow: 'field',
} as const satisfies Theme;

/** The chosen look: a round hammered-gold medallion around a brush-painted panel and a gold embossed glyph. */
export const MEDALLION_THEME = {
	...DEFAULT_THEME,
	outerCornerRadius: 256,
	borderWidth: 38,
	innerCornerRadius: 218,
	glyphScale: 0.54,
	frameBevel: 'embossed',
	isFrameHammered: true,
	isGlyphEmbossed: true,
	glyphBevel: 'edge',
	glyphShadowOpacity: 0.4,
	glyphColorMode: 'gold',
	glyphStrokeWidth: 10,
	panelTexture: 'strokes',
	panelStrokeDepth: 0.3,
	glyphStrokeDepth: 0.3,
	glyphStrokeFlow: 'traced',
	iconFill: 0.8,
} as const satisfies Theme;

/**
 * Derives the background colours for a group from its hue.
 * @param hue - Hue in degrees, 0–360.
 * @throws When `hue` is outside 0–360 or not a finite number.
 */
export function deriveGroupPalette(hue: number): GroupPalette {
	if (!Number.isFinite(hue) || hue < 0 || hue > 360)
		throw new Error(`hue must be within 0–360, got ${hue}`);
	return {
		backgroundCenter: `hsl(${hue} 58% 34%)`,
		backgroundEdge: `hsl(${hue} 65% 9%)`,
		glow: `hsl(${hue} 80% 62%)`,
		glyphTintTop: `hsl(${hue} 75% 90%)`,
		glyphTintBottom: `hsl(${hue} 62% 58%)`,
	};
}
