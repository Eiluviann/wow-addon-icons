import { Resvg } from '@resvg/resvg-js';
import { fail, type Result, succeed } from './result';

export const MIN_EXPORT_SIZE = 150;

/**
 * Checks a requested export size: a whole number of pixels, at least `MIN_EXPORT_SIZE`.
 * @returns The size, or an error describing why it was rejected.
 */
export function validateExportSize(size: number): Result<number> {
	if (!Number.isInteger(size))
		return fail(new Error(`Size "${size}" is not a whole number of pixels`));
	if (size < MIN_EXPORT_SIZE)
		return fail(
			new Error(`Size ${size} is below the ${MIN_EXPORT_SIZE}px minimum`),
		);
	return succeed(size);
}

/**
 * Rasterises a square SVG to a PNG of `size`×`size` pixels.
 * @throws When `size` fails `validateExportSize`; check it first.
 */
export function renderPng(svg: string, size: number): Uint8Array {
	const sizeResult = validateExportSize(size);
	if (!sizeResult.ok) throw sizeResult.error;
	return new Resvg(svg, { fitTo: { mode: 'width', value: size } })
		.render()
		.asPng();
}
