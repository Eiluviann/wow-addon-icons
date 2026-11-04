import type { SvgRasteriser } from './svg-rasteriser';

/** A glyph's shape rasterised to canvas pixels, with the direction its path runs at every pixel. */
export type GlyphFlowField = {
	/** Width and height in pixels; pixels are indexed row by row. */
	size: number;
	/** Indices of the pixels inside the glyph. */
	insideIndices: readonly number[];
	/** Radians along the glyph's strokes at each pixel; an axis, so θ and θ + π mean the same. */
	pathAngles: Float32Array;
};

// Wide enough to average both sides of a stroke into one direction, small enough to follow its curves.
const DIRECTION_WINDOW_RADIUS = 5;
const ALPHA_THRESHOLD = 127;

/**
 * Rasterises white glyph markup and derives which way its path runs everywhere inside it,
 * so strokes can be painted along the glyph's own lines.
 * @param shapeMarkup - SVG markup in canvas coordinates that paints the glyph opaque.
 * @param rasteriser - Renders the shape so its pixels can be read.
 * @throws When `canvasSize` is not a positive integer.
 */
export function buildGlyphFlowField(
	shapeMarkup: string,
	canvasSize: number,
	rasteriser: SvgRasteriser,
): GlyphFlowField {
	if (!Number.isInteger(canvasSize) || canvasSize <= 0)
		throw new Error(`canvasSize must be a positive integer, got ${canvasSize}`);
	const insideMask = rasteriseInsideMask(shapeMarkup, canvasSize, rasteriser);
	const edgeDistances = measureEdgeDistances(insideMask, canvasSize);
	return {
		size: canvasSize,
		insideIndices: collectInsideIndices(insideMask),
		pathAngles: computePathAngles(edgeDistances, canvasSize),
	};
}

function rasteriseInsideMask(
	shapeMarkup: string,
	size: number,
	rasteriser: SvgRasteriser,
): Uint8Array {
	const pixels = rasteriser.renderRgba(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${shapeMarkup}</svg>`,
		size,
	);
	return Uint8Array.from({ length: size * size }, (_, index) =>
		(pixels[index * 4 + 3] ?? 0) > ALPHA_THRESHOLD ? 1 : 0,
	);
}

// Two-pass chamfer transform: each inside pixel gets its distance to the nearest outside pixel.
function measureEdgeDistances(
	insideMask: Uint8Array,
	size: number,
): Float32Array {
	const distances = Float32Array.from(insideMask, (isInside) =>
		isInside ? Number.POSITIVE_INFINITY : 0,
	);
	const relax = (index: number, neighbour: number, cost: number) => {
		const candidate = (distances[neighbour] ?? 0) + cost;
		if (candidate < (distances[index] ?? 0)) distances[index] = candidate;
	};
	for (let y = 1; y < size - 1; y++) {
		for (let x = 1; x < size - 1; x++) {
			const index = y * size + x;
			relax(index, index - 1, 1);
			relax(index, index - size, 1);
			relax(index, index - size - 1, Math.SQRT2);
			relax(index, index - size + 1, Math.SQRT2);
		}
	}
	for (let y = size - 2; y > 0; y--) {
		for (let x = size - 2; x > 0; x--) {
			const index = y * size + x;
			relax(index, index + 1, 1);
			relax(index, index + size, 1);
			relax(index, index + size + 1, Math.SQRT2);
			relax(index, index + size - 1, Math.SQRT2);
		}
	}
	return distances;
}

// Structure tensor of the distance gradient. The gradients on either side of a stroke point opposite
// ways, so they are averaged as doubled angles, which gives the stroke's normal; the path runs across it.
function computePathAngles(
	edgeDistances: Float32Array,
	size: number,
): Float32Array {
	const tensorCos = new Float64Array(size * size);
	const tensorSin = new Float64Array(size * size);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const gradientX =
				readClamped(edgeDistances, size, x + 1, y) -
				readClamped(edgeDistances, size, x - 1, y);
			const gradientY =
				readClamped(edgeDistances, size, x, y + 1) -
				readClamped(edgeDistances, size, x, y - 1);
			tensorCos[y * size + x] = gradientX ** 2 - gradientY ** 2;
			tensorSin[y * size + x] = 2 * gradientX * gradientY;
		}
	}
	const cosSums = buildSummedArea(tensorCos, size);
	const sinSums = buildSummedArea(tensorSin, size);
	const pathAngles = new Float32Array(size * size);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const normalAngle =
				Math.atan2(
					sumWindow(sinSums, size, x, y),
					sumWindow(cosSums, size, x, y),
				) / 2;
			pathAngles[y * size + x] = normalAngle + Math.PI / 2;
		}
	}
	return pathAngles;
}

function collectInsideIndices(insideMask: Uint8Array): number[] {
	return insideMask.reduce<number[]>((indices, isInside, index) => {
		if (isInside) indices.push(index);
		return indices;
	}, []);
}

// Out-of-range reads repeat the nearest edge pixel; infinities never reach here outside the canvas border.
function readClamped(
	values: Float32Array,
	size: number,
	x: number,
	y: number,
): number {
	const clampedX = Math.min(size - 1, Math.max(0, x));
	const clampedY = Math.min(size - 1, Math.max(0, y));
	const value = values[clampedY * size + clampedX] ?? 0;
	return Number.isFinite(value) ? value : 0;
}

// One row and column larger than the image, so every window sum is four lookups.
function buildSummedArea(values: Float64Array, size: number): Float64Array {
	const stride = size + 1;
	const sums = new Float64Array(stride * stride);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			sums[(y + 1) * stride + x + 1] =
				(values[y * size + x] ?? 0) +
				(sums[y * stride + x + 1] ?? 0) +
				(sums[(y + 1) * stride + x] ?? 0) -
				(sums[y * stride + x] ?? 0);
		}
	}
	return sums;
}

function sumWindow(
	sums: Float64Array,
	size: number,
	x: number,
	y: number,
): number {
	const stride = size + 1;
	const left = Math.max(0, x - DIRECTION_WINDOW_RADIUS);
	const top = Math.max(0, y - DIRECTION_WINDOW_RADIUS);
	const right = Math.min(size, x + DIRECTION_WINDOW_RADIUS + 1);
	const bottom = Math.min(size, y + DIRECTION_WINDOW_RADIUS + 1);
	return (
		(sums[bottom * stride + right] ?? 0) -
		(sums[top * stride + right] ?? 0) -
		(sums[bottom * stride + left] ?? 0) +
		(sums[top * stride + left] ?? 0)
	);
}
