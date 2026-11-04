import { deflateSync } from 'node:zlib';
import type { BrushTip } from './abr-brush-file';

/** A brush tip ready to embed: lying along the x axis, downscaled, as a white PNG whose alpha is the paint. */
export type BrushTipImage = {
	width: number;
	height: number;
	dataUri: string;
};

const PNG_SIGNATURE = Uint8Array.of(
	0x89,
	0x50,
	0x4e,
	0x47,
	0x0d,
	0x0a,
	0x1a,
	0x0a,
);
const PNG_GRAY_ALPHA_COLOR_TYPE = 4;
const CRC_TABLE = buildCrcTable();

/**
 * Turns a parsed tip into an embeddable image. Tall tips are turned on their side so every
 * stroke's length runs along x, and the long side is downscaled to at most `maxLongSide`.
 * @throws When `maxLongSide` is not a positive integer.
 */
export function prepareBrushTipImage(
	tip: BrushTip,
	maxLongSide: number,
): BrushTipImage {
	if (!Number.isInteger(maxLongSide) || maxLongSide <= 0)
		throw new Error(
			`maxLongSide must be a positive integer, got ${maxLongSide}`,
		);
	const horizontalTip = tip.height > tip.width ? transposeTip(tip) : tip;
	const scaledTip = downscaleTip(
		horizontalTip,
		maxLongSide / horizontalTip.width,
	);
	return {
		width: scaledTip.width,
		height: scaledTip.height,
		dataUri: `data:image/png;base64,${Buffer.from(encodeWhitePng(scaledTip)).toString('base64')}`,
	};
}

function transposeTip({ width, height, opacity }: BrushTip): BrushTip {
	const transposed = new Uint8Array(opacity.length);
	for (let row = 0; row < height; row++) {
		for (let column = 0; column < width; column++) {
			transposed[column * height + row] = opacity[row * width + column] ?? 0;
		}
	}
	return { width: height, height: width, opacity: transposed };
}

// Box-filter average, so the fine bristle lines blend into soft streaks instead of aliasing.
function downscaleTip(tip: BrushTip, scale: number): BrushTip {
	if (scale >= 1) return tip;
	const width = Math.max(1, Math.round(tip.width * scale));
	const height = Math.max(1, Math.round(tip.height * scale));
	const opacity = new Uint8Array(width * height);
	for (let row = 0; row < height; row++) {
		const sourceRowStart = Math.floor((row * tip.height) / height);
		const sourceRowEnd = Math.max(
			sourceRowStart + 1,
			Math.floor(((row + 1) * tip.height) / height),
		);
		for (let column = 0; column < width; column++) {
			const sourceColumnStart = Math.floor((column * tip.width) / width);
			const sourceColumnEnd = Math.max(
				sourceColumnStart + 1,
				Math.floor(((column + 1) * tip.width) / width),
			);
			opacity[row * width + column] = averageBox(
				tip,
				sourceRowStart,
				sourceRowEnd,
				sourceColumnStart,
				sourceColumnEnd,
			);
		}
	}
	return { width, height, opacity };
}

function averageBox(
	tip: BrushTip,
	rowStart: number,
	rowEnd: number,
	columnStart: number,
	columnEnd: number,
): number {
	let sum = 0;
	for (let row = rowStart; row < rowEnd; row++) {
		for (let column = columnStart; column < columnEnd; column++) {
			sum += tip.opacity[row * tip.width + column] ?? 0;
		}
	}
	return Math.round(sum / ((rowEnd - rowStart) * (columnEnd - columnStart)));
}

// White everywhere with the paint in alpha, so it works both as a luminance mask and on its own.
function encodeWhitePng({ width, height, opacity }: BrushTip): Uint8Array {
	const scanlines = new Uint8Array(height * (1 + width * 2));
	for (let row = 0; row < height; row++) {
		const lineStart = row * (1 + width * 2);
		for (let column = 0; column < width; column++) {
			scanlines[lineStart + 1 + column * 2] = 255;
			scanlines[lineStart + 2 + column * 2] =
				opacity[row * width + column] ?? 0;
		}
	}
	const header = new Uint8Array(13);
	const headerView = new DataView(header.buffer);
	headerView.setUint32(0, width);
	headerView.setUint32(4, height);
	header[8] = 8;
	header[9] = PNG_GRAY_ALPHA_COLOR_TYPE;
	return concatenateBytes([
		PNG_SIGNATURE,
		buildPngChunk('IHDR', header),
		buildPngChunk('IDAT', deflateSync(scanlines)),
		buildPngChunk('IEND', new Uint8Array(0)),
	]);
}

function buildPngChunk(type: string, data: Uint8Array): Uint8Array {
	const typeBytes = Uint8Array.from(type, (character) =>
		character.charCodeAt(0),
	);
	const chunk = new Uint8Array(12 + data.length);
	const chunkView = new DataView(chunk.buffer);
	chunkView.setUint32(0, data.length);
	chunk.set(typeBytes, 4);
	chunk.set(data, 8);
	chunkView.setUint32(
		8 + data.length,
		computeCrc(chunk.subarray(4, 8 + data.length)),
	);
	return chunk;
}

function concatenateBytes(parts: readonly Uint8Array[]): Uint8Array {
	const joined = new Uint8Array(
		parts.reduce((total, part) => total + part.length, 0),
	);
	parts.reduce((offset, part) => {
		joined.set(part, offset);
		return offset + part.length;
	}, 0);
	return joined;
}

function computeCrc(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable(): Uint32Array {
	return Uint32Array.from({ length: 256 }, (_, index) => {
		let value = index;
		for (let bit = 0; bit < 8; bit++) {
			value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		}
		return value >>> 0;
	});
}
