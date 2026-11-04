import { readFile } from 'node:fs/promises';
import { parseAbrBrushTips } from './abr-brush-file';
import { type BrushTipImage, prepareBrushTipImage } from './brush-tip-image';
import { fail, type Result, succeed } from './result';

// Large enough for crisp bristles at 512 px, small enough to keep 100 embedded tips near 1 MB.
const EMBEDDED_TIP_LONG_SIDE = 256;

/**
 * Reads a Photoshop `.abr` file and prepares its sampled tips for embedding in icon SVGs.
 * @returns The tips, or an error when the file cannot be read or holds no usable tips.
 */
export async function loadBrushTips(
	brushFilePath: string,
): Promise<Result<BrushTipImage[]>> {
	const bytesResult = await readBrushFile(brushFilePath);
	if (!bytesResult.ok) return bytesResult;
	const tipsResult = parseAbrBrushTips(bytesResult.value);
	if (!tipsResult.ok)
		return fail(new Error(`${brushFilePath}: ${tipsResult.error.message}`));
	return succeed(
		tipsResult.value.map((tip) =>
			prepareBrushTipImage(tip, EMBEDDED_TIP_LONG_SIDE),
		),
	);
}

async function readBrushFile(
	brushFilePath: string,
): Promise<Result<Uint8Array>> {
	try {
		return succeed(new Uint8Array(await readFile(brushFilePath)));
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		return fail(new Error(`Cannot read brush file: ${reason}`));
	}
}
