import { describe, expect, it } from 'vitest';
import { buildGlyphFlowField, type GlyphFlowField } from './glyph-flow-field';
import { RESVG_NODE_RASTERISER } from './resvg-node-rasteriser';

describe('buildGlyphFlowField', () => {
	const canvasSize = 512;
	const horizontalBar =
		'<rect x="100" y="240" width="300" height="30" fill="#fff"/>';
	const verticalBar =
		'<rect x="240" y="100" width="30" height="300" fill="#fff"/>';

	it('marks the pixels inside the shape', () => {
		const field = buildGlyphFlowField(
			horizontalBar,
			canvasSize,
			RESVG_NODE_RASTERISER,
		);
		expect(field.insideIndices.length).toBeGreaterThan(300 * 30 * 0.95);
		expect(field.insideIndices.length).toBeLessThan(300 * 30 * 1.05);
		expect(field.insideIndices).toContain(255 * canvasSize + 250);
		expect(field.insideIndices).not.toContain(50 * canvasSize + 50);
	});

	it('runs along a horizontal stroke', () => {
		const field = buildGlyphFlowField(
			horizontalBar,
			canvasSize,
			RESVG_NODE_RASTERISER,
		);
		expect(measureAxisOffset(field, 250, 255, 0)).toBeLessThan(0.05);
		expect(measureAxisOffset(field, 150, 245, 0)).toBeLessThan(0.05);
	});

	it('runs along a vertical stroke', () => {
		const field = buildGlyphFlowField(
			verticalBar,
			canvasSize,
			RESVG_NODE_RASTERISER,
		);
		expect(measureAxisOffset(field, 255, 250, Math.PI / 2)).toBeLessThan(0.05);
	});

	it('rejects a canvas size that is not a positive integer', () => {
		expect(() =>
			buildGlyphFlowField(horizontalBar, 0, RESVG_NODE_RASTERISER),
		).toThrow(/canvasSize/);
		expect(() =>
			buildGlyphFlowField(horizontalBar, 10.5, RESVG_NODE_RASTERISER),
		).toThrow(/canvasSize/);
	});
});

// Path angles have no head or tail, so compare them as axes: modulo half a turn.
function measureAxisOffset(
	field: GlyphFlowField,
	x: number,
	y: number,
	expectedAngle: number,
): number {
	const angle = field.pathAngles[y * field.size + x];
	if (angle === undefined) throw new Error(`No angle at ${x},${y}`);
	const offset = (((angle - expectedAngle) % Math.PI) + Math.PI) % Math.PI;
	return Math.min(offset, Math.PI - offset);
}
