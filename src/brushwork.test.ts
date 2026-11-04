import { describe, expect, it } from 'vitest';
import type { BrushTipImage } from './brush-tip-image';
import {
	buildFrameBrushwork,
	buildPanelBrushwork,
	buildTracedGlyphBrushwork,
} from './brushwork';
import { buildGlyphFlowField } from './glyph-flow-field';

describe('brushwork', () => {
	const panelArea = {
		center: 256,
		innerExtent: 0,
		outerExtent: 218,
		isCircular: true,
	};
	const ringArea = { ...panelArea, innerExtent: 218, outerExtent: 256 };
	const tip: BrushTipImage = {
		width: 200,
		height: 20,
		dataUri: 'data:image/png;base64,',
	};

	// resvg renders hsl() with a fractional hue as black.
	it('writes every stroke colour with a whole-number hue', () => {
		const strokes = [
			buildPanelBrushwork(panelArea, 187, 187, { scale: 1, tips: [] }),
			buildFrameBrushwork(ringArea, 288, { scale: 1, tips: [tip] }),
		].join('');
		const hues = [...strokes.matchAll(/hsl\(([^ ]+) /g)].map(
			(match) => match[1],
		);
		expect(hues.length).toBeGreaterThan(100);
		expect(hues.filter((hue) => hue?.includes('.'))).toEqual([]);
	});

	it('stamps brush-file tips as masked strokes', () => {
		const strokes = buildPanelBrushwork(panelArea, 187, 187, {
			scale: 1,
			tips: [tip, tip],
		});
		expect(strokes).toContain('mask="url(#brush-tip-');
		expect(strokes).not.toContain('<use href="#brush-stamp-');
	});

	it('paints more, finer strokes at a smaller brush scale', () => {
		const countStrokes = (scale: number) =>
			buildPanelBrushwork(panelArea, 187, 187, { scale, tips: [] }).match(
				/<use /g,
			)?.length ?? 0;
		expect(countStrokes(0.6)).toBeGreaterThan(countStrokes(1) * 2);
	});

	it('traces glyph strokes along the path, inside the glyph', () => {
		const horizontalBar = buildGlyphFlowField(
			'<rect x="100" y="240" width="300" height="30" fill="#fff"/>',
			512,
		);
		const strokes = buildTracedGlyphBrushwork(
			{ ...panelArea, outerExtent: 150, isCircular: false },
			horizontalBar,
			211,
			{ scale: 1, tips: [tip] },
		);
		const placements = [
			...strokes.matchAll(/translate\(([^ ]+) ([^)]+)\) rotate\(([^)]+)\)/g),
		].map(([, x, y, degrees]) => ({
			x: Number(x),
			y: Number(y),
			degrees: Number(degrees),
		}));
		expect(placements.length).toBeGreaterThan(150);
		for (const { x, y, degrees } of placements) {
			expect(x).toBeGreaterThanOrEqual(100);
			expect(x).toBeLessThanOrEqual(400);
			expect(y).toBeGreaterThanOrEqual(240);
			expect(y).toBeLessThanOrEqual(270);
			// At the bar's square ends the path turns to run around the corner.
			if (x < 130 || x > 370) continue;
			const axisOffset = ((degrees % 180) + 180) % 180;
			expect(Math.min(axisOffset, 180 - axisOffset)).toBeLessThan(20);
		}
	});

	it('rejects a flow field with no glyph pixels', () => {
		const emptyField = buildGlyphFlowField('', 64);
		expect(() =>
			buildTracedGlyphBrushwork(panelArea, emptyField, 1, {
				scale: 1,
				tips: [],
			}),
		).toThrow(/no pixels/);
	});
});
