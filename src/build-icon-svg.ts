import type { BrushTipImage } from './brush-tip-image';
import {
	type Brush,
	type BrushworkArea,
	buildBrushStamps,
	buildFrameBrushwork,
	buildGlyphBrushwork,
	buildPanelBrushwork,
	buildTracedGlyphBrushwork,
} from './brushwork';
import type { Glyph } from './glyph';
import { buildGlyphFlowField } from './glyph-flow-field';
import type { IconGroup } from './icon-group';
import type { SvgRasteriser } from './svg-rasteriser';
import {
	deriveGroupPalette,
	type GlyphBevel,
	type GroupPalette,
	type PanelTexture,
	type Theme,
} from './theme';

type GlyphPlacement = {
	scale: number;
	offsetX: number;
	offsetY: number;
};

type RoundedSquare = {
	inset: number;
	size: number;
	radius: number;
};

type TextureNoise = {
	baseFrequency: string;
	octaves: number;
	shadeStrength: number;
	lightStrength: number;
	/** Posterizes the noise into this many flat tones, giving hard-edged brush dabs. 0 keeps it smooth. */
	toneCount: number;
};

type OverlayTexture = Exclude<PanelTexture, 'none' | 'canvas' | 'strokes'>;

// Offset so the frame's strokes do not mirror the panel's.
const FRAME_STROKE_SEED_OFFSET = 101;
const GLYPH_STROKE_SEED_OFFSET = 211;

// Shade and light strengths scale how far the noise darkens or brightens the panel.
const TEXTURE_NOISE = {
	clouds: {
		baseFrequency: '0.012 0.022',
		octaves: 5,
		shadeStrength: 1,
		lightStrength: 1,
		toneCount: 0,
	},
	grain: {
		baseFrequency: '0.11',
		octaves: 4,
		shadeStrength: 0.55,
		lightStrength: 0.35,
		toneCount: 0,
	},
	brushed: {
		baseFrequency: '0.035 0.06',
		octaves: 4,
		shadeStrength: 0.7,
		lightStrength: 0.6,
		toneCount: 6,
	},
} as const satisfies Record<OverlayTexture, TextureNoise>;

/** What an icon is painted with beyond its group and theme. */
export type IconPaintKit = {
	/** Tips loaded from a brush file; when empty or absent, the built-in procedural brush paints. */
	brushTips?: readonly BrushTipImage[];
	/** Needed only when the theme traces glyph strokes, which reads the glyph's pixels. */
	rasteriser?: SvgRasteriser;
};

/**
 * Builds the full icon as an SVG document: a gold-framed tile tinted by the group's hue,
 * with its glyph centred on top.
 * @throws When the hue is outside 0–360, `theme.brushScale` is not positive, or the theme traces
 * glyph strokes and no rasteriser is given.
 */
export function buildIconSvg(
	iconGroup: IconGroup,
	theme: Theme,
	{ brushTips = [], rasteriser }: IconPaintKit = {},
): string {
	const palette = deriveGroupPalette(iconGroup.hue);
	const { canvasSize } = theme;
	const brush = { scale: theme.brushScale, tips: brushTips };
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="${buildPaddedViewBox(theme)}">`,
		buildDefinitions(theme, palette, Math.round(iconGroup.hue), brush),
		buildPanel(theme, iconGroup.hue, brush),
		buildGlyph(
			iconGroup.glyph,
			theme,
			Math.round(iconGroup.hue),
			brush,
			rasteriser,
		),
		buildFrame(theme, Math.round(iconGroup.hue), brush),
		'</svg>',
	].join('\n');
}

function buildDefinitions(
	theme: Theme,
	palette: GroupPalette,
	textureSeed: number,
	brush: Brush,
): string {
	const { glyphTop, glyphBottom } = selectGlyphColors(theme, palette);
	const frameHammerSeed = theme.isFrameHammered ? textureSeed : undefined;
	return `<defs>
	<linearGradient id="border-gold" x1="0" y1="0" x2="1" y2="1">
		<stop offset="0" stop-color="${theme.borderGoldLight}"/>
		<stop offset="0.45" stop-color="${theme.borderGoldMid}"/>
		<stop offset="1" stop-color="${theme.borderGoldDark}"/>
	</linearGradient>
	<linearGradient id="chamfer-outer" x1="0" y1="0" x2="1" y2="1">
		<stop offset="0" stop-color="#fff" stop-opacity="0.6"/>
		<stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
		<stop offset="1" stop-color="#000" stop-opacity="0.45"/>
	</linearGradient>
	<linearGradient id="chamfer-inner" x1="0" y1="0" x2="1" y2="1">
		<stop offset="0" stop-color="#000" stop-opacity="0.5"/>
		<stop offset="0.5" stop-color="#000" stop-opacity="0"/>
		<stop offset="1" stop-color="#fff" stop-opacity="0.45"/>
	</linearGradient>
	<radialGradient id="background" cx="0.5" cy="0.42" r="0.7">
		<stop offset="0" stop-color="${palette.backgroundCenter}"/>
		<stop offset="1" stop-color="${palette.backgroundEdge}"/>
	</radialGradient>
	<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
		<stop offset="0" stop-color="${palette.glow}" stop-opacity="0.45"/>
		<stop offset="1" stop-color="${palette.glow}" stop-opacity="0"/>
	</radialGradient>
	<radialGradient id="vignette" cx="0.5" cy="0.5" r="0.72">
		<stop offset="0.6" stop-color="#000" stop-opacity="0"/>
		<stop offset="1" stop-color="#000" stop-opacity="0.6"/>
	</radialGradient>
	<linearGradient id="glyph-fill" x1="0" y1="0" x2="0" y2="1">
		<stop offset="0" stop-color="${glyphTop}"/>
		<stop offset="1" stop-color="${glyphBottom}"/>
	</linearGradient>
	<linearGradient id="top-sheen" x1="0" y1="0" x2="0" y2="1">
		<stop offset="0" stop-color="#fff" stop-opacity="0.16"/>
		<stop offset="1" stop-color="#fff" stop-opacity="0"/>
	</linearGradient>
	<filter id="glyph-shadow" x="-20%" y="-20%" width="140%" height="140%">
		<feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="${theme.glyphShadowColor}" flood-opacity="${theme.glyphShadowOpacity}"/>
	</filter>
	${buildEmbossFilter('frame-emboss', buildFrameHeightMap(frameHammerSeed), 5)}
	${buildEmbossFilter('glyph-emboss', buildGlyphHeightMap(theme.glyphBevel), 4)}
	<filter id="glyph-glow" x="-30%" y="-30%" width="160%" height="160%">
		<feGaussianBlur in="SourceAlpha" stdDeviation="11" result="spread"/>
		<feFlood flood-color="${palette.glow}" flood-opacity="0.6"/>
		<feComposite in2="spread" operator="in" result="glow"/>
		<feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
	</filter>
	${buildPaintTextureFilter(theme.panelTexture, textureSeed)}
	${theme.panelTexture === 'canvas' ? buildCanvasPaintFilter(textureSeed) : ''}
	${theme.panelTexture === 'strokes' ? `${buildBrushStamps(brush)}${buildImpastoFilter('impasto', 1)}${theme.panelStrokeDepth > 0 ? buildImpastoFilter('panel-impasto', theme.panelStrokeDepth) : ''}${theme.glyphStrokeDepth > 0 ? buildImpastoFilter('glyph-impasto', theme.glyphStrokeDepth) : ''}` : ''}
</defs>`;
}

function selectGlyphColors(
	theme: Theme,
	palette: GroupPalette,
): { glyphTop: string; glyphBottom: string } {
	switch (theme.glyphColorMode) {
		case 'tinted':
			return {
				glyphTop: palette.glyphTintTop,
				glyphBottom: palette.glyphTintBottom,
			};
		case 'gold':
			return {
				glyphTop: theme.borderGoldLight,
				glyphBottom: theme.borderGoldMid,
			};
		case 'parchment':
			return {
				glyphTop: theme.glyphColorTop,
				glyphBottom: theme.glyphColorBottom,
			};
	}
}

// Fractal noise turned into dark blotches and light flecks, like a hand-painted backdrop.
function buildPaintTextureFilter(
	panelTexture: PanelTexture,
	seed: number,
): string {
	if (
		panelTexture === 'none' ||
		panelTexture === 'canvas' ||
		panelTexture === 'strokes'
	)
		return '';
	const noise = TEXTURE_NOISE[panelTexture];
	const shadeAlpha = `${-1.6 * noise.shadeStrength} 0 0 0 ${0.95 * noise.shadeStrength}`;
	const lightAlpha = `0 ${0.9 * noise.lightStrength} 0 0 ${-0.42 * noise.lightStrength}`;
	return `<filter id="paint-texture" x="0" y="0" width="100%" height="100%">
		<feTurbulence type="fractalNoise" baseFrequency="${noise.baseFrequency}" numOctaves="${noise.octaves}" seed="${seed}" result="noise"/>
		${buildPosterizeStep(noise.toneCount)}
		<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${shadeAlpha}" result="shade"/>
		<feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  ${lightAlpha}" result="light"/>
		<feMerge result="paint"><feMergeNode in="shade"/><feMergeNode in="light"/></feMerge>
		<feComposite in="paint" in2="SourceAlpha" operator="in"/>
	</filter>`;
}

// Paints the surface itself instead of overlaying grey: broad, soft tonal patches in the surface's own hue,
// then a fine, even canvas grain lit from the top-left. Multiplying keeps the hue saturated.
function buildCanvasPaintFilter(seed: number): string {
	return `<filter id="canvas-paint" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
		<feTurbulence type="fractalNoise" baseFrequency="0.007" numOctaves="3" seed="${seed}" result="patches"/>
		<feColorMatrix in="patches" type="matrix" values="1.1 0 0 0 0.38  1.1 0 0 0 0.38  1.1 0 0 0 0.38  0 0 0 0 1" result="patch-tone"/>
		<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="${seed + 1}" result="weave"/>
		<feDiffuseLighting in="weave" surfaceScale="0.9" diffuseConstant="1" lighting-color="#fff" result="weave-light"><feDistantLight azimuth="225" elevation="62"/></feDiffuseLighting>
		<feComposite in="patch-tone" in2="weave-light" operator="arithmetic" k1="1.12" k2="0" k3="0" k4="0" result="surface"/>
		<feComposite in="SourceGraphic" in2="surface" operator="arithmetic" k1="1.3" k2="0" k3="0" k4="0" result="painted"/>
		<feComposite in="painted" in2="SourceAlpha" operator="in"/>
	</filter>`;
}

// Paint relief: luminance stands in for paint thickness, so the dark grooves and pale ridges
// inside each brush stamp catch the top-left light like real impasto.
function buildImpastoFilter(filterId: string, depth: number): string {
	const surfaceScale = formatNumber(4 * depth);
	return `<filter id="${filterId}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
		<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.3 0.59 0.11 0 0" result="height"/>
		<feDiffuseLighting in="height" surfaceScale="${surfaceScale}" diffuseConstant="1.1" lighting-color="#fff" result="diffuse"><feDistantLight azimuth="225" elevation="55"/></feDiffuseLighting>
		<feComposite in="SourceGraphic" in2="diffuse" operator="arithmetic" k1="1.15" k2="0" k3="0" k4="0" result="shaded"/>
		<feSpecularLighting in="height" surfaceScale="${surfaceScale}" specularConstant="0.5" specularExponent="20" lighting-color="#fff" result="specular"><feDistantLight azimuth="225" elevation="50"/></feSpecularLighting>
		<feComposite in="shaded" in2="specular" operator="arithmetic" k1="0" k2="1" k3="${formatNumber(0.45 * depth)}" k4="0" result="lit"/>
		<feComposite in="lit" in2="SourceAlpha" operator="in"/>
	</filter>`;
}

// Re-emits the noise under the same name, so later steps read the posterized tones.
function buildPosterizeStep(toneCount: number): string {
	if (toneCount === 0) return '';
	const tones = Array.from({ length: toneCount }, (_, index) =>
		(index / (toneCount - 1)).toFixed(3),
	).join(' ');
	return `<feComponentTransfer in="noise" result="noise"><feFuncR type="discrete" tableValues="${tones}"/><feFuncG type="discrete" tableValues="${tones}"/></feComponentTransfer>`;
}

// Light from the top-left: diffuse light shades the far side, a specular pass adds the shine.
// The height map gives the surface its shape.
function buildEmbossFilter(
	filterId: string,
	heightMap: string,
	surfaceScale: number,
): string {
	return `<filter id="${filterId}" x="-5%" y="-5%" width="110%" height="110%">
		${heightMap}
		<feDiffuseLighting in="height" surfaceScale="${surfaceScale}" diffuseConstant="1.15" lighting-color="#fff" result="diffuse"><feDistantLight azimuth="225" elevation="48"/></feDiffuseLighting>
		<feComposite in="SourceGraphic" in2="diffuse" operator="arithmetic" k1="1.25" k2="0" k3="0" k4="0" result="shaded"/>
		<feSpecularLighting in="height" surfaceScale="${surfaceScale}" specularConstant="0.9" specularExponent="24" lighting-color="#fff4cc" result="specular"><feDistantLight azimuth="225" elevation="42"/></feSpecularLighting>
		<feComposite in="shaded" in2="specular" operator="arithmetic" k1="0" k2="1" k3="0.7" k4="0" result="lit"/>
		<feComposite in="lit" in2="SourceAlpha" operator="in"/>
	</filter>`;
}

// With a hammer seed, noise is mixed into the height map so the surface catches light in dents.
function buildFrameHeightMap(hammerSeed: number | undefined): string {
	if (hammerSeed === undefined)
		return '<feGaussianBlur in="SourceAlpha" stdDeviation="5" result="height"/>';
	return `<feGaussianBlur in="SourceAlpha" stdDeviation="5" result="edge"/>
		<feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="${hammerSeed}" result="dents"/>
		<feComposite in="dents" in2="edge" operator="arithmetic" k1="0.7" k2="0" k3="0.75" k4="0" result="height"/>`;
}

// Blurred alpha is 0.5 on the outline and 1 inside. The edge bevel remaps 0.5–1 to 0–1,
// so the slope stays within the glyph's rim and the face on top is a flat plateau.
function buildGlyphHeightMap(glyphBevel: GlyphBevel): string {
	if (glyphBevel === 'rounded')
		return '<feGaussianBlur in="SourceAlpha" stdDeviation="3.5" result="height"/>';
	return `<feGaussianBlur in="SourceAlpha" stdDeviation="2" result="soft"/>
		<feComponentTransfer in="soft" result="height"><feFuncA type="linear" slope="2" intercept="-1"/></feComponentTransfer>`;
}

function buildPanel(theme: Theme, hue: number, brush: Brush): string {
	const panel = getPanelSquare(theme);
	const panelRect = `x="${panel.inset}" y="${panel.inset}" width="${panel.size}" height="${panel.size}" rx="${panel.radius}"`;
	if (theme.panelTexture === 'strokes')
		return buildBrushedPanel(theme, panel, panelRect, hue, brush);
	const isCanvasPainted = theme.panelTexture === 'canvas';
	const texture =
		theme.panelTexture === 'none' || isCanvasPainted
			? ''
			: `<rect ${panelRect} fill="#000" filter="url(#paint-texture)" opacity="0.5"/>`;
	const backgroundFilter = isCanvasPainted
		? ' filter="url(#canvas-paint)"'
		: '';
	return `<rect ${panelRect} fill="url(#background)"${backgroundFilter}/>
${texture}
<circle cx="${theme.canvasSize / 2}" cy="${theme.canvasSize / 2}" r="${panel.size * 0.42}" fill="url(#glow)"/>
<rect ${panelRect} fill="url(#vignette)"/>
<rect x="${panel.inset}" y="${panel.inset}" width="${panel.size}" height="${panel.size / 2}" rx="${panel.radius}" fill="url(#top-sheen)"/>`;
}

// The strokes carry the whole gradient, so the smooth glow and sheen overlays are left out.
function buildBrushedPanel(
	theme: Theme,
	panel: RoundedSquare,
	panelRect: string,
	hue: number,
	brush: Brush,
): string {
	assertStrokeDepth('panelStrokeDepth', theme.panelStrokeDepth);
	const area = {
		center: theme.canvasSize / 2,
		innerExtent: 0,
		outerExtent: panel.size / 2,
		isCircular: isCircle(panel),
	};
	return `<clipPath id="panel-clip"><rect ${panelRect}/></clipPath>
<g clip-path="url(#panel-clip)">
<rect ${panelRect} fill="url(#background)"/>
${wrapDepthStrokes(buildPanelBrushwork(area, hue, Math.round(hue), brush), 'panel-impasto', theme.panelStrokeDepth)}
</g>`;
}

function buildGlyph(
	glyph: Glyph,
	theme: Theme,
	seed: number,
	brush: Brush,
	rasteriser: SvgRasteriser | undefined,
): string {
	const placement = computeGlyphPlacement(glyph.width, glyph.height, theme);
	const paths = glyph.paths.map((path) => `<path d="${path}"/>`).join('');
	const transform = `translate(${placement.offsetX} ${placement.offsetY}) scale(${placement.scale})`;
	const embossFilter = theme.isGlyphEmbossed
		? ' filter="url(#glyph-emboss)"'
		: '';
	const glowFilter = theme.hasGlyphGlow ? ' filter="url(#glyph-glow)"' : '';
	const glyphShape = `<g fill="url(#glyph-fill)"${buildGlyphOutline(theme, 'url(#glyph-fill)')} transform="${transform}">${paths}</g>`;
	const glyphSurface =
		theme.panelTexture === 'strokes'
			? buildPaintedGlyph(
					theme,
					glyphShape,
					paths,
					transform,
					placement,
					seed,
					brush,
					rasteriser,
				)
			: glyphShape;
	// Filters sit on untransformed wrapper groups so their radii are in canvas pixels, not glyph units.
	return `<g filter="url(#glyph-shadow)"><g${glowFilter}><g${embossFilter}>${glyphSurface}</g></g></g>`;
}

// The same gold strokes as the frame, cut to the glyph by a mask: clip paths ignore the thickening outline.
function buildPaintedGlyph(
	theme: Theme,
	glyphShape: string,
	paths: string,
	transform: string,
	placement: GlyphPlacement,
	seed: number,
	brush: Brush,
	rasteriser: SvgRasteriser | undefined,
): string {
	assertStrokeDepth('glyphStrokeDepth', theme.glyphStrokeDepth);
	const area: BrushworkArea = {
		center: theme.canvasSize / 2,
		innerExtent: 0,
		outerExtent:
			(theme.canvasSize * theme.glyphScale) / 2 +
			theme.glyphStrokeWidth * placement.scale,
		isCircular: false,
	};
	const maskShape = `<g fill="#fff"${buildGlyphOutline(theme, '#fff')} transform="${transform}">${paths}</g>`;
	const strokeSeed = seed + GLYPH_STROKE_SEED_OFFSET;
	if (theme.glyphStrokeFlow === 'traced' && rasteriser === undefined)
		throw new Error('Traced glyph strokes need a rasteriser');
	const strokes =
		theme.glyphStrokeFlow === 'traced' && rasteriser !== undefined
			? buildTracedGlyphBrushwork(
					area,
					buildGlyphFlowField(maskShape, theme.canvasSize, rasteriser),
					strokeSeed,
					brush,
				)
			: buildGlyphBrushwork(area, strokeSeed, brush);
	return `<mask id="glyph-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${theme.canvasSize}" height="${theme.canvasSize}">${maskShape}</mask>
<g mask="url(#glyph-mask)">${glyphShape}
${wrapDepthStrokes(strokes, 'glyph-impasto', theme.glyphStrokeDepth)}
</g>`;
}

// Drawn last so the frame and its bevel sit above the panel's sheen and glow.
function buildFrame(theme: Theme, seed: number, brush: Brush): string {
	const outer = getOuterSquare(theme);
	const panel = getPanelSquare(theme);
	const ringPath = `${buildRoundedSquarePath(outer)} ${buildRoundedSquarePath(panel)}`;
	const embossFilter =
		theme.frameBevel === 'embossed' ? ' filter="url(#frame-emboss)"' : '';
	const ring = `<path d="${ringPath}" fill-rule="evenodd" fill="url(#border-gold)"${embossFilter}/>`;
	return [
		selectRingMarkup(theme, ring, ringPath, embossFilter, seed, brush),
		theme.frameBevel === 'chamfer' ? buildChamferBands(theme) : '',
		// The same paint strokes as the panel keep the metal looking hand-painted rather than rendered.
		isOverlayTexture(theme.panelTexture)
			? `<path d="${ringPath}" fill-rule="evenodd" fill="#000" filter="url(#paint-texture)" opacity="0.4"/>`
			: '',
		`<rect x="${panel.inset}" y="${panel.inset}" width="${panel.size}" height="${panel.size}" rx="${panel.radius}" fill="none" stroke="${theme.innerEdgeColor}" stroke-width="6"/>`,
		buildOuterEdgeHighlight(outer, theme),
	].join('\n');
}

function selectRingMarkup(
	theme: Theme,
	ring: string,
	ringPath: string,
	embossFilter: string,
	seed: number,
	brush: Brush,
): string {
	if (theme.panelTexture === 'canvas')
		return `<g filter="url(#canvas-paint)">${ring}</g>`;
	if (theme.panelTexture !== 'strokes') return ring;
	const outer = getOuterSquare(theme);
	const area: BrushworkArea = {
		center: theme.canvasSize / 2,
		innerExtent: getPanelSquare(theme).size / 2,
		outerExtent: outer.size / 2,
		isCircular: isCircle(outer),
	};
	// Strokes sit inside the emboss so the bevel still lights the painted metal.
	return `<clipPath id="ring-clip"><path d="${ringPath}" clip-rule="evenodd"/></clipPath>
<g${embossFilter}><g clip-path="url(#ring-clip)">
<path d="${ringPath}" fill-rule="evenodd" fill="url(#border-gold)"/>
${wrapStrokes(buildFrameBrushwork(area, seed + FRAME_STROKE_SEED_OFFSET, brush))}
</g></g>`;
}

// Two bands across the frame width, lit in opposite directions, read as a carved 45° chamfer.
function buildChamferBands(theme: Theme): string {
	const { canvasSize, borderWidth, outerCornerRadius, innerCornerRadius } =
		theme;
	const bandWidth = borderWidth / 2;
	const middleRadius = (outerCornerRadius + innerCornerRadius) / 2;
	const bands = [
		{
			inset: bandWidth / 2,
			radius: outerCornerRadius - bandWidth / 2,
			gradientId: 'chamfer-outer',
		},
		{
			inset: bandWidth * 1.5,
			radius: middleRadius - bandWidth / 2,
			gradientId: 'chamfer-inner',
		},
	];
	return bands
		.map(
			({ inset, radius, gradientId }) =>
				`<rect x="${inset}" y="${inset}" width="${canvasSize - inset * 2}" height="${canvasSize - inset * 2}" rx="${radius}" fill="none" stroke="url(#${gradientId})" stroke-width="${bandWidth}"/>`,
		)
		.join('\n');
}

function buildOuterEdgeHighlight(outer: RoundedSquare, theme: Theme): string {
	const edgeInset = 3;
	const size = outer.size - edgeInset * 2;
	return `<rect x="${edgeInset}" y="${edgeInset}" width="${size}" height="${size}" rx="${outer.radius - edgeInset}" fill="none" stroke="${theme.borderGoldLight}" stroke-opacity="0.7" stroke-width="3"/>`;
}

function computeGlyphPlacement(
	glyphWidth: number,
	glyphHeight: number,
	theme: Theme,
): GlyphPlacement {
	const targetSize = theme.canvasSize * theme.glyphScale;
	const scale = targetSize / Math.max(glyphWidth, glyphHeight);
	return {
		scale,
		offsetX: (theme.canvasSize - glyphWidth * scale) / 2,
		offsetY: (theme.canvasSize - glyphHeight * scale) / 2,
	};
}

function buildGlyphOutline(theme: Theme, paint: string): string {
	if (theme.glyphStrokeWidth <= 0) return '';
	return ` stroke="${paint}" stroke-width="${theme.glyphStrokeWidth}" stroke-linejoin="round"`;
}

function getOuterSquare(theme: Theme): RoundedSquare {
	return { inset: 0, size: theme.canvasSize, radius: theme.outerCornerRadius };
}

function getPanelSquare(theme: Theme): RoundedSquare {
	return {
		inset: theme.borderWidth,
		size: theme.canvasSize - theme.borderWidth * 2,
		radius: theme.innerCornerRadius,
	};
}

function buildRoundedSquarePath({
	inset,
	size,
	radius,
}: RoundedSquare): string {
	const far = inset + size;
	return [
		`M${inset + radius} ${inset}`,
		`H${far - radius}`,
		`A${radius} ${radius} 0 0 1 ${far} ${inset + radius}`,
		`V${far - radius}`,
		`A${radius} ${radius} 0 0 1 ${far - radius} ${far}`,
		`H${inset + radius}`,
		`A${radius} ${radius} 0 0 1 ${inset} ${far - radius}`,
		`V${inset + radius}`,
		`A${radius} ${radius} 0 0 1 ${inset + radius} ${inset}`,
		'Z',
	].join(' ');
}

function wrapStrokes(stampedStrokes: string): string {
	return `<g filter="url(#impasto)">${stampedStrokes}</g>`;
}

// At depth 0 the strokes skip lighting entirely: a flat-lit filter would still shift their tones.
function wrapDepthStrokes(
	stampedStrokes: string,
	filterId: string,
	depth: number,
): string {
	if (depth === 0) return `<g>${stampedStrokes}</g>`;
	return `<g filter="url(#${filterId})">${stampedStrokes}</g>`;
}

function assertStrokeDepth(tokenName: string, depth: number): void {
	if (!Number.isFinite(depth) || depth < 0 || depth > 1)
		throw new Error(`${tokenName} must be within 0–1, got ${depth}`);
}

// Widens the view around the 0–canvasSize drawing, so the icon keeps its coordinates and shrinks into the margin.
function buildPaddedViewBox({ canvasSize, iconFill }: Theme): string {
	if (!Number.isFinite(iconFill) || iconFill <= 0 || iconFill > 1)
		throw new Error(`iconFill must be within (0, 1], got ${iconFill}`);
	const margin = (canvasSize / iconFill - canvasSize) / 2;
	const viewSize = canvasSize + margin * 2;
	return [-margin, -margin, viewSize, viewSize].map(formatNumber).join(' ');
}

function isCircle(square: RoundedSquare): boolean {
	return square.radius >= square.size / 2;
}

function isOverlayTexture(panelTexture: PanelTexture): boolean {
	return (
		panelTexture !== 'none' &&
		panelTexture !== 'canvas' &&
		panelTexture !== 'strokes'
	);
}

function formatNumber(value: number): string {
	return String(Number(value.toFixed(3)));
}
