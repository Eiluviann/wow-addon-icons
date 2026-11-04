import { fail, type Result, succeed } from './result';

/** A brush tip's opacity mask: one byte per pixel, row by row, where 255 lays down full paint. */
export type BrushTip = {
	width: number;
	height: number;
	opacity: Uint8Array;
};

type SampleBounds = { width: number; height: number };

const SUPPORTED_VERSIONS: readonly number[] = [6, 7, 10];
const SECTION_SIGNATURE = '8BIM';
const SAMPLE_SECTION_KEY = 'samp';
// Bytes between a sampled brush's length field and its bounds: its UUID plus settings we ignore.
const SAMPLE_HEADER_BYTES_BY_SUBVERSION: ReadonlyMap<number, number> = new Map([
	[1, 47],
	[2, 301],
]);
const RAW_COMPRESSION = 0;
const RLE_COMPRESSION = 1;

class ByteCursor {
	readonly #view: DataView;
	#offset: number;

	constructor(bytes: Uint8Array, offset = 0) {
		this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		this.#offset = offset;
	}

	get offset(): number {
		return this.#offset;
	}

	get remaining(): number {
		return this.#view.byteLength - this.#offset;
	}

	moveTo(offset: number): void {
		if (offset > this.#view.byteLength)
			throw new RangeError(`Offset ${offset} is past the end of the data`);
		this.#offset = offset;
	}

	skip(byteCount: number): void {
		this.moveTo(this.#offset + byteCount);
	}

	readUint8(): number {
		const value = this.#view.getUint8(this.#offset);
		this.#offset += 1;
		return value;
	}

	readInt8(): number {
		const value = this.#view.getInt8(this.#offset);
		this.#offset += 1;
		return value;
	}

	readUint16(): number {
		const value = this.#view.getUint16(this.#offset);
		this.#offset += 2;
		return value;
	}

	readUint32(): number {
		const value = this.#view.getUint32(this.#offset);
		this.#offset += 4;
		return value;
	}

	readInt32(): number {
		const value = this.#view.getInt32(this.#offset);
		this.#offset += 4;
		return value;
	}

	readAscii(length: number): string {
		return String.fromCharCode(
			...Array.from({ length }, () => this.readUint8()),
		);
	}
}

/**
 * Reads the sampled (bitmap) brush tips from a Photoshop `.abr` file, version 6 or later.
 * Computed brushes and tips in unsupported bit depths or compressions are skipped.
 * @returns The tips in file order, or an error when the file is not a readable `.abr`
 * or holds no sampled tips.
 */
export function parseAbrBrushTips(bytes: Uint8Array): Result<BrushTip[]> {
	try {
		return readBrushTips(new ByteCursor(bytes));
	} catch (error) {
		if (error instanceof RangeError)
			return fail(new Error('Brush file is truncated'));
		throw error;
	}
}

function readBrushTips(cursor: ByteCursor): Result<BrushTip[]> {
	const version = cursor.readUint16();
	if (!SUPPORTED_VERSIONS.includes(version))
		return fail(
			new Error(
				`Unsupported .abr version ${version}; only Photoshop CS2 (version 6) or later is supported`,
			),
		);
	const subversion = cursor.readUint16();
	const sampleHeaderBytes = SAMPLE_HEADER_BYTES_BY_SUBVERSION.get(subversion);
	if (sampleHeaderBytes === undefined)
		return fail(new Error(`Unsupported .abr subversion ${subversion}`));
	const sampleSectionEnd = findSampleSection(cursor);
	if (!sampleSectionEnd.ok) return sampleSectionEnd;
	const tips = readSampleSection(
		cursor,
		sampleSectionEnd.value,
		sampleHeaderBytes,
	);
	if (tips.length === 0)
		return fail(new Error('Brush file holds no sampled brush tips'));
	return succeed(tips);
}

// Leaves the cursor at the start of the sample section and returns where it ends.
function findSampleSection(cursor: ByteCursor): Result<number> {
	while (cursor.remaining >= 12) {
		const signature = cursor.readAscii(4);
		if (signature !== SECTION_SIGNATURE)
			return fail(new Error(`Malformed .abr section signature "${signature}"`));
		const key = cursor.readAscii(4);
		const length = cursor.readUint32();
		if (key === SAMPLE_SECTION_KEY) return succeed(cursor.offset + length);
		cursor.skip(length);
	}
	return fail(new Error('Brush file has no sampled brush section'));
}

function readSampleSection(
	cursor: ByteCursor,
	sectionEnd: number,
	sampleHeaderBytes: number,
): BrushTip[] {
	const tips: BrushTip[] = [];
	while (cursor.offset + 4 <= sectionEnd) {
		const sampleLength = cursor.readUint32();
		const nextSampleOffset =
			cursor.offset + roundUpToMultipleOfFour(sampleLength);
		cursor.skip(sampleHeaderBytes);
		const tip = readSampledTip(cursor);
		if (tip !== undefined) tips.push(tip);
		cursor.moveTo(Math.min(nextSampleOffset, sectionEnd));
	}
	return tips;
}

function readSampledTip(cursor: ByteCursor): BrushTip | undefined {
	const top = cursor.readInt32();
	const left = cursor.readInt32();
	const bottom = cursor.readInt32();
	const right = cursor.readInt32();
	const depth = cursor.readUint16();
	const compression = cursor.readUint8();
	const bounds = { width: right - left, height: bottom - top };
	if (bounds.width <= 0 || bounds.height <= 0) return undefined;
	if (compression === RAW_COMPRESSION && (depth === 8 || depth === 16))
		return { ...bounds, opacity: readRawOpacity(cursor, bounds, depth) };
	if (compression === RLE_COMPRESSION && depth === 8)
		return { ...bounds, opacity: readRunLengthOpacity(cursor, bounds) };
	return undefined;
}

// 16-bit tips keep only their high byte: an 8-bit mask is all the renderer uses.
function readRawOpacity(
	cursor: ByteCursor,
	{ width, height }: SampleBounds,
	depth: number,
): Uint8Array {
	const opacity = new Uint8Array(width * height);
	for (let index = 0; index < opacity.length; index++) {
		opacity[index] =
			depth === 16 ? cursor.readUint16() >> 8 : cursor.readUint8();
	}
	return opacity;
}

// PackBits per row, preceded by a table of each row's compressed byte count.
function readRunLengthOpacity(
	cursor: ByteCursor,
	{ width, height }: SampleBounds,
): Uint8Array {
	const rowByteCounts = Array.from({ length: height }, () =>
		cursor.readUint16(),
	);
	const opacity = new Uint8Array(width * height);
	rowByteCounts.forEach((rowByteCount, rowIndex) => {
		decodePackBitsRow(
			cursor,
			rowByteCount,
			opacity.subarray(rowIndex * width, (rowIndex + 1) * width),
		);
	});
	return opacity;
}

// Writes into `row`; runs past its end are dropped rather than overflowing into the next row.
function decodePackBitsRow(
	cursor: ByteCursor,
	rowByteCount: number,
	row: Uint8Array,
): void {
	const rowEnd = cursor.offset + rowByteCount;
	let column = 0;
	while (cursor.offset < rowEnd) {
		const header = cursor.readInt8();
		if (header >= 0) {
			for (let count = 0; count <= header; count++) {
				const value = cursor.readUint8();
				if (column < row.length) row[column++] = value;
			}
		} else if (header !== -128) {
			const value = cursor.readUint8();
			const runEnd = Math.min(row.length, column + 1 - header);
			row.fill(value, column, runEnd);
			column = runEnd;
		}
	}
	cursor.moveTo(rowEnd);
}

function roundUpToMultipleOfFour(value: number): number {
	return Math.ceil(value / 4) * 4;
}
