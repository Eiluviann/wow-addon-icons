import { describe, expect, it } from 'vitest';
import { MIN_EXPORT_SIZE, renderPng, validateExportSize } from './render-png';
import { RESVG_NODE_RASTERISER } from './resvg-node-rasteriser';

const SQUARE_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

function readPngDimensions(png: Uint8Array): { width: number; height: number } {
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe('validateExportSize', () => {
	it('accepts the minimum size', () => {
		expect(validateExportSize(MIN_EXPORT_SIZE)).toEqual({
			ok: true,
			value: MIN_EXPORT_SIZE,
		});
	});

	it.each([149, 0, -10, 150.5, Number.NaN])('rejects %s', (size) => {
		expect(validateExportSize(size).ok).toBe(false);
	});
});

describe('renderPng', () => {
	it.each([150, 256, 512])('renders a %ipx square PNG', (size) => {
		const png = renderPng(SQUARE_SVG, size, RESVG_NODE_RASTERISER);
		expect([...png.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
		expect(readPngDimensions(png)).toEqual({ width: size, height: size });
	});

	it('throws for a size below the minimum', () => {
		expect(() => renderPng(SQUARE_SVG, 100, RESVG_NODE_RASTERISER)).toThrow(
			/minimum/,
		);
	});
});
