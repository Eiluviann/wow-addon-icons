import type { BrushTipImage } from './brush-tip-image';
import type { GlyphFlowField } from './glyph-flow-field';

type Point = { x: number; y: number };

/**
 * The region strokes are scattered over, in canvas pixels around a shared centre:
 * a filled disc or square when `innerExtent` is 0, otherwise a ring between the two extents.
 */
export type BrushworkArea = {
	center: number;
	innerExtent: number;
	outerExtent: number;
	isCircular: boolean;
};

type BrushStroke = {
	center: Point;
	angle: number;
	length: number;
	width: number;
	color: string;
	opacity: number;
	/** Strokes paint in ascending order, so later layers cover earlier ones. */
	layerOrder: number;
	/** Caps a brush-file tip's length-to-width ratio below `MAX_TIP_STROKE_ASPECT`, for short dabs that follow curves. */
	maxAspect?: number;
};

/**
 * The brush strokes are painted with: `scale` sizes every stroke, and `tips` are images loaded
 * from a brush file. Without tips, the built-in procedural bristle stamps are used.
 */
export type Brush = {
	scale: number;
	tips: readonly BrushTipImage[];
};

type SeededRandom = () => number;

type DabSpan = { fromX: number; toX: number };

const STAMP_IDS = [
	'brush-stamp-a',
	'brush-stamp-b',
	'brush-stamp-c',
	'brush-stamp-d',
] as const;
// Fixed so every icon shares the same brush tips, like one brush used across a set of paintings.
const STAMP_SEED = 7;
const STAMP_HALF_LENGTH = 50;
const STAMP_HALF_WIDTH = 20;
const STAMP_BRISTLES = 14;

// Long brush-file tips are squashed to at most this length-to-width ratio, so strokes stay short and thick.
const MAX_TIP_STROKE_ASPECT = 4;
const TIP_WIDTH_FACTOR = 1.3;

const PIXELS_PER_STROKE = 70;
// Traced strokes cover only the glyph's own pixels, so they need a denser count to fill it.
const TRACED_PIXELS_PER_STROKE = 45;
// Top-left in SVG's y-down angle space, matching the emboss lighting.
const LIGHT_DIRECTION = (-3 * Math.PI) / 4;
const GOLD_HUE = 40;

/**
 * Defines the brush tips every stroke stamps. Brush-file tips become masks that each stroke's
 * colour shows through. Without them, the procedural tips are overlapping bristle streaks that
 * break up towards the tail, with dark grooves and pale ridges where the bristles dragged the paint;
 * their bristles leave `stroke` unset, so each stamped stroke tints them through its own `stroke`.
 */
export function buildBrushStamps(brush: Brush): string {
	if (brush.tips.length > 0) return brush.tips.map(buildTipMask).join('');
	const random = createSeededRandom(STAMP_SEED);
	return STAMP_IDS.map(
		(stampId) => `<g id="${stampId}">${buildStampMarks(random)}</g>`,
	).join('');
}

/**
 * Paints a background as layered textured strokes in the group's hue: dark strokes at the edge first,
 * lighter ones over them towards the centre, so the gradient comes from the layering itself.
 * @throws When `brush.scale` is not a positive number.
 */
export function buildPanelBrushwork(
	area: BrushworkArea,
	hue: number,
	seed: number,
	brush: Brush,
): string {
	assertBrushScale(brush.scale);
	const random = createSeededRandom(seed);
	const strokes = sampleAreaPoints(area, random, brush.scale).map((center) => {
		const distanceRatio = clamp(
			measureDistance(center, area) / area.outerExtent + jitter(random, 0.1),
			0,
			1,
		);
		return {
			center,
			angle: computeFlowAngle(center) + jitter(random, 0.35),
			length: between(random, 30, 56) * brush.scale,
			width: between(random, 18, 28) * brush.scale,
			color: formatHsl(
				hue + jitter(random, 7),
				56 + jitter(random, 8),
				lerp(40, 9, distanceRatio ** 1.4) + jitter(random, 3.5),
			),
			opacity: between(random, 0.8, 1),
			layerOrder: -distanceRatio,
		};
	});
	return renderStrokes(strokes, random, brush);
}

/**
 * Paints a gold frame as textured strokes running along the ring, lit from the top-left:
 * darker strokes go down first and highlights are dabbed over them.
 * @throws When `brush.scale` is not a positive number.
 */
export function buildFrameBrushwork(
	area: BrushworkArea,
	seed: number,
	brush: Brush,
): string {
	assertBrushScale(brush.scale);
	const random = createSeededRandom(seed);
	const strokes = sampleAreaPoints(area, random, brush.scale).map((center) => {
		const positionAngle = Math.atan2(
			center.y - area.center,
			center.x - area.center,
		);
		const litAmount = (Math.cos(positionAngle - LIGHT_DIRECTION) + 1) / 2;
		const lightness = lerp(34, 64, litAmount) + jitter(random, 4);
		return {
			center,
			angle: computeTangentAngle(center, area) + jitter(random, 0.35),
			length: between(random, 18, 32) * brush.scale,
			width: between(random, 10, 15) * brush.scale,
			color: formatHsl(
				GOLD_HUE + jitter(random, 5),
				68 + jitter(random, 10),
				lightness,
			),
			opacity: between(random, 0.8, 1),
			layerOrder: lightness,
		};
	});
	return renderStrokes(strokes, random, brush);
}

/**
 * Paints a glyph's gold as the frame's strokes, laid over its whole square for a mask to cut out:
 * they lean with the panel's flow and are lit by how far they sit towards the top-left light.
 * @throws When `brush.scale` is not a positive number.
 */
export function buildGlyphBrushwork(
	area: BrushworkArea,
	seed: number,
	brush: Brush,
): string {
	assertBrushScale(brush.scale);
	const random = createSeededRandom(seed);
	const strokes = sampleAreaPoints(area, random, brush.scale).map((center) =>
		buildGoldStroke(
			center,
			computeFlowAngle(center) + jitter(random, 0.35),
			area,
			random,
			{
				length: between(random, 18, 32) * brush.scale,
				width: between(random, 10, 15) * brush.scale,
			},
		),
	);
	return renderStrokes(strokes, random, brush);
}

/**
 * Paints the glyph in the same gold strokes, but traced: each stroke lies along the glyph's path
 * where it lands, like a painter following the lines, and only the glyph's own pixels are painted.
 * @param area - The glyph's square, used to light the strokes from the top left.
 * @throws When `brush.scale` is not a positive number, or `flowField` covers no pixels.
 */
export function buildTracedGlyphBrushwork(
	area: BrushworkArea,
	flowField: GlyphFlowField,
	seed: number,
	brush: Brush,
): string {
	assertBrushScale(brush.scale);
	if (flowField.insideIndices.length === 0)
		throw new Error('flowField has no pixels inside the glyph');
	const random = createSeededRandom(seed);
	const strokeCount = Math.round(
		flowField.insideIndices.length /
			(TRACED_PIXELS_PER_STROKE * brush.scale ** 2),
	);
	const strokes = Array.from({ length: strokeCount }, () => {
		const pixelIndex = pickInsidePixel(flowField, random);
		const width = between(random, 8, 11.5) * brush.scale;
		const maxAspect = between(random, 2.2, 3.4);
		return {
			...buildGoldStroke(
				pixelIndexToPoint(pixelIndex, flowField.size),
				(flowField.pathAngles[pixelIndex] ?? 0) + jitter(random, 0.1),
				area,
				random,
				{ length: width * TIP_WIDTH_FACTOR * maxAspect, width },
			),
			maxAspect,
		};
	});
	return renderStrokes(strokes, random, brush);
}

function buildStampMarks(random: SeededRandom): string {
	const bend = jitter(random, 6);
	const bristles = Array.from({ length: STAMP_BRISTLES }, (_, index) =>
		buildStampBristle(index, bend, random),
	).join('');
	return `<g fill="none" stroke-linecap="round">${bristles}</g>`;
}

// Outer bristles carry less paint: they start later, run out sooner and skip near the tail.
function buildStampBristle(
	index: number,
	bend: number,
	random: SeededRandom,
): string {
	const across =
		lerp(-STAMP_HALF_WIDTH, STAMP_HALF_WIDTH, (index + 0.5) / STAMP_BRISTLES) +
		jitter(random, 0.6);
	const edgeness = Math.abs(across) / STAMP_HALF_WIDTH;
	const fromX =
		-STAMP_HALF_LENGTH +
		between(random, 0, 6) +
		edgeness ** 2 * between(random, 0, 16);
	const toX =
		STAMP_HALF_LENGTH -
		between(random, 0, 8) -
		edgeness * between(random, 0, 32);
	const width =
		((STAMP_HALF_WIDTH * 2) / STAMP_BRISTLES) * between(random, 1.2, 1.7);
	const hasGroove = random() < 0.7;
	const hasRidge = random() < 0.4;
	return splitIntoDabs({ fromX, toX }, random)
		.map((span) =>
			[
				`<path d="${buildCurvedLine(span, across, bend)}" stroke-width="${round(width)}"/>`,
				hasGroove
					? buildBristleEdge(
							span,
							across + width * 0.45,
							bend,
							'#000',
							between(random, 0.08, 0.2),
						)
					: '',
				hasRidge
					? buildBristleEdge(
							span,
							across - width * 0.3,
							bend,
							'#fff',
							between(random, 0.06, 0.14),
						)
					: '',
			].join(''),
		)
		.join('');
}

// Grooves and ridges ride along their own bristle, so they never stray outside the paint.
function buildBristleEdge(
	span: DabSpan,
	across: number,
	bend: number,
	color: string,
	opacity: number,
): string {
	return `<path d="${buildCurvedLine(span, across, bend)}" stroke="${color}" stroke-opacity="${round(opacity)}" stroke-width="0.8"/>`;
}

// A dry brush skips: about half the bristles break once in the tail half.
function splitIntoDabs(span: DabSpan, random: SeededRandom): DabSpan[] {
	if (random() < 0.5) return [span];
	const gapStart = lerp(span.fromX, span.toX, between(random, 0.55, 0.85));
	const gapEnd = gapStart + between(random, 2, 7);
	if (gapEnd >= span.toX) return [{ fromX: span.fromX, toX: gapStart }];
	return [
		{ fromX: span.fromX, toX: gapStart },
		{ fromX: gapEnd, toX: span.toX },
	];
}

// Every mark follows the same gentle arc, so the bristles stay parallel like one sweep of the brush.
function buildCurvedLine(
	{ fromX, toX }: DabSpan,
	across: number,
	bend: number,
): string {
	const curveY = (x: number) =>
		across + bend * (1 - (x / STAMP_HALF_LENGTH) ** 2);
	const midX = (fromX + toX) / 2;
	const controlY = 2 * curveY(midX) - (curveY(fromX) + curveY(toX)) / 2;
	return `M${round(fromX)} ${round(curveY(fromX))}Q${round(midX)} ${round(controlY)} ${round(toX)} ${round(curveY(toX))}`;
}

function renderStrokes(
	strokes: BrushStroke[],
	random: SeededRandom,
	brush: Brush,
): string {
	return [...strokes]
		.sort((first, second) => first.layerOrder - second.layerOrder)
		.map((stroke) =>
			brush.tips.length > 0
				? renderTipStroke(stroke, random, brush.tips)
				: renderStampedStroke(stroke, random),
		)
		.join('');
}

// Centred on the origin in the tip's own pixels, so a stroke places it with one transform.
function buildTipMask(tip: BrushTipImage, index: number): string {
	const box = `x="${round(-tip.width / 2)}" y="${round(-tip.height / 2)}" width="${tip.width}" height="${tip.height}"`;
	return `<mask id="brush-tip-${index}" maskUnits="userSpaceOnUse" ${box}><image ${box} href="${tip.dataUri}"/></mask>`;
}

// The tip keeps its own shape up to MAX_TIP_STROKE_ASPECT; only the stroke's width is taken as given.
function renderTipStroke(
	stroke: BrushStroke,
	random: SeededRandom,
	tips: readonly BrushTipImage[],
): string {
	const tipIndex = Math.floor(random() * tips.length);
	const tip = tips[tipIndex];
	if (tip === undefined) throw new Error('Brush has no tips to stamp');
	const flip = random() < 0.5 ? -1 : 1;
	const strokeWidth = stroke.width * TIP_WIDTH_FACTOR;
	const strokeLength =
		strokeWidth *
		Math.min(
			tip.width / tip.height,
			stroke.maxAspect ?? MAX_TIP_STROKE_ASPECT,
			MAX_TIP_STROKE_ASPECT,
		);
	const scaleX = strokeLength / tip.width;
	const scaleY = (flip * strokeWidth) / tip.height;
	const degrees = (stroke.angle * 180) / Math.PI;
	return `<rect x="${round(-tip.width / 2)}" y="${round(-tip.height / 2)}" width="${tip.width}" height="${tip.height}" fill="${stroke.color}" mask="url(#brush-tip-${tipIndex})" transform="translate(${round(stroke.center.x)} ${round(stroke.center.y)}) rotate(${round(degrees)}) scale(${round(scaleX, 1000)} ${round(scaleY, 1000)})" opacity="${round(stroke.opacity)}"/>`;
}

function renderStampedStroke(
	stroke: BrushStroke,
	random: SeededRandom,
): string {
	const stampId =
		STAMP_IDS[Math.floor(random() * STAMP_IDS.length)] ?? STAMP_IDS[0];
	const flip = random() < 0.5 ? -1 : 1;
	const scaleX = stroke.length / (STAMP_HALF_LENGTH * 2);
	const scaleY = (flip * stroke.width) / (STAMP_HALF_WIDTH * 2);
	const degrees = (stroke.angle * 180) / Math.PI;
	return `<use href="#${stampId}" transform="translate(${round(stroke.center.x)} ${round(stroke.center.y)}) rotate(${round(degrees)}) scale(${round(scaleX, 1000)} ${round(scaleY, 1000)})" stroke="${stroke.color}" opacity="${round(stroke.opacity)}"/>`;
}

function sampleAreaPoints(
	area: BrushworkArea,
	random: SeededRandom,
	brushScale: number,
): Point[] {
	const strokeCount = Math.round(
		computeAreaSize(area) / (PIXELS_PER_STROKE * brushScale ** 2),
	);
	// Slightly past the edges so the clip, not the sampling, defines the boundary.
	const innerLimit = area.innerExtent * 0.96;
	const outerLimit = area.outerExtent * 1.04;
	const maxAttempts = strokeCount * 20;
	const points: Point[] = [];
	for (
		let attempt = 0;
		attempt < maxAttempts && points.length < strokeCount;
		attempt++
	) {
		const candidate = {
			x: area.center + jitter(random, outerLimit),
			y: area.center + jitter(random, outerLimit),
		};
		const distance = measureDistance(candidate, area);
		if (distance >= innerLimit && distance <= outerLimit) {
			points.push(candidate);
		}
	}
	return points;
}

// Lit from the top left like the emboss: brighter strokes towards the light also layer on top.
function buildGoldStroke(
	center: Point,
	angle: number,
	area: BrushworkArea,
	random: SeededRandom,
	size: { length: number; width: number },
): BrushStroke {
	const litAmount = clamp(
		(measureLightProjection(center, area) + 1) / 2 + jitter(random, 0.1),
		0,
		1,
	);
	const lightness = lerp(38, 68, litAmount) + jitter(random, 4);
	return {
		center,
		angle,
		...size,
		color: formatHsl(
			GOLD_HUE + jitter(random, 5),
			68 + jitter(random, 10),
			lightness,
		),
		opacity: between(random, 0.8, 1),
		layerOrder: lightness,
	};
}

function pickInsidePixel(
	flowField: GlyphFlowField,
	random: SeededRandom,
): number {
	const pixelIndex =
		flowField.insideIndices[
			Math.floor(random() * flowField.insideIndices.length)
		];
	if (pixelIndex === undefined)
		throw new Error('flowField has no pixels inside the glyph');
	return pixelIndex;
}

function pixelIndexToPoint(pixelIndex: number, size: number): Point {
	return {
		x: (pixelIndex % size) + 0.5,
		y: Math.floor(pixelIndex / size) + 0.5,
	};
}

function assertBrushScale(brushScale: number): void {
	if (!Number.isFinite(brushScale) || brushScale <= 0)
		throw new Error(`brushScale must be a positive number, got ${brushScale}`);
}

// A slowly varying field, so neighbouring strokes lean the same way like a painter's hand.
function computeFlowAngle({ x, y }: Point): number {
	return 0.7 * Math.sin(x / 70) + 0.7 * Math.cos(y / 85) + 0.5;
}

function computeTangentAngle(point: Point, area: BrushworkArea): number {
	const deltaX = point.x - area.center;
	const deltaY = point.y - area.center;
	if (area.isCircular) return Math.atan2(deltaY, deltaX) + Math.PI / 2;
	return Math.abs(deltaX) > Math.abs(deltaY) ? Math.PI / 2 : 0;
}

// -1 at the far bottom-right edge, 1 at the top-left edge nearest the light.
function measureLightProjection(point: Point, area: BrushworkArea): number {
	const projection =
		(point.x - area.center) * Math.cos(LIGHT_DIRECTION) +
		(point.y - area.center) * Math.sin(LIGHT_DIRECTION);
	return clamp(projection / area.outerExtent, -1, 1);
}

// Euclidean for discs, Chebyshev for squares, so "distance from centre" follows the shape.
function measureDistance(point: Point, area: BrushworkArea): number {
	const deltaX = point.x - area.center;
	const deltaY = point.y - area.center;
	return area.isCircular
		? Math.hypot(deltaX, deltaY)
		: Math.max(Math.abs(deltaX), Math.abs(deltaY));
}

function computeAreaSize({
	innerExtent,
	outerExtent,
	isCircular,
}: BrushworkArea): number {
	const shapeFactor = isCircular ? Math.PI : 4;
	return shapeFactor * (outerExtent ** 2 - innerExtent ** 2);
}

// mulberry32: tiny, fast and deterministic, so the same group always gets the same strokes.
function createSeededRandom(seed: number): SeededRandom {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let mixed = Math.imul(state ^ (state >>> 15), state | 1);
		mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
	};
}

function jitter(random: SeededRandom, amount: number): number {
	return (random() * 2 - 1) * amount;
}

function between(random: SeededRandom, min: number, max: number): number {
	return min + random() * (max - min);
}

function lerp(from: number, to: number, amount: number): number {
	return from + (to - from) * amount;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

// The hue stays a whole number: resvg renders hsl() with a fractional hue as black.
function formatHsl(hue: number, saturation: number, lightness: number): string {
	return `hsl(${Math.round(hue)} ${round(saturation)}% ${round(lightness)}%)`;
}

function round(value: number, precision = 10): number {
	return Math.round(value * precision) / precision;
}
