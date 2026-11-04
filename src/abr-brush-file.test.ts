import { describe, expect, it } from 'vitest';
import { parseAbrBrushTips } from './abr-brush-file';

type SampleSpec = {
	width: number;
	height: number;
	payload: number[];
	compression: 0 | 1;
};

const SUBVERSION_1_SAMPLE_HEADER_BYTES = 47;

describe('parseAbrBrushTips', () => {
	it('reads a raw 8-bit tip', () => {
		const file = buildAbrFile([
			{
				width: 3,
				height: 2,
				compression: 0,
				payload: [0, 128, 255, 10, 20, 30],
			},
		]);
		const result = parseAbrBrushTips(file);
		expect(result.ok && result.value).toEqual([
			{ width: 3, height: 2, opacity: Uint8Array.of(0, 128, 255, 10, 20, 30) },
		]);
	});

	it('decodes a PackBits run-length tip', () => {
		// Row 0: a run of four 200s. Row 1: two literals, then a run of two 9s.
		const rowZero = [-3 & 0xff, 200];
		const rowOne = [1, 7, 8, -1 & 0xff, 9];
		const file = buildAbrFile([
			{
				width: 4,
				height: 2,
				compression: 1,
				payload: [0, rowZero.length, 0, rowOne.length, ...rowZero, ...rowOne],
			},
		]);
		const result = parseAbrBrushTips(file);
		expect(result.ok && [...(result.value[0]?.opacity ?? [])]).toEqual([
			200, 200, 200, 200, 7, 8, 9, 9,
		]);
	});

	it('rejects a pre-CS2 version', () => {
		const result = parseAbrBrushTips(Uint8Array.of(0, 2, 0, 1));
		expect(!result.ok && result.error.message).toMatch(
			/Unsupported .abr version 2/,
		);
	});

	it('reports a truncated file', () => {
		const file = buildAbrFile([
			{ width: 3, height: 2, compression: 0, payload: [1, 2, 3, 4, 5, 6] },
		]);
		const result = parseAbrBrushTips(file.subarray(0, file.length - 4));
		expect(!result.ok && result.error.message).toBe('Brush file is truncated');
	});
});

function buildAbrFile(samples: readonly SampleSpec[]): Uint8Array {
	const sampleBytes = samples.flatMap(buildSample);
	return Uint8Array.from([
		...uint16(6),
		...uint16(1),
		...ascii('8BIM'),
		...ascii('samp'),
		...uint32(sampleBytes.length),
		...sampleBytes,
	]);
}

function buildSample({
	width,
	height,
	payload,
	compression,
}: SampleSpec): number[] {
	const body = [
		...new Array<number>(SUBVERSION_1_SAMPLE_HEADER_BYTES).fill(0),
		...uint32(0),
		...uint32(0),
		...uint32(height),
		...uint32(width),
		...uint16(8),
		compression,
		...payload,
	];
	const padding = new Array<number>((4 - (body.length % 4)) % 4).fill(0);
	return [...uint32(body.length), ...body, ...padding];
}

function uint16(value: number): number[] {
	return [(value >> 8) & 0xff, value & 0xff];
}

function uint32(value: number): number[] {
	return [...uint16(value >>> 16), ...uint16(value & 0xffff)];
}

function ascii(text: string): number[] {
	return Array.from(text, (character) => character.charCodeAt(0));
}
