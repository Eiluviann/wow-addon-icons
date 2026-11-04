import { readFile } from 'node:fs/promises';
import type { BrushTipImage } from './brush-tip-image';
import { prepareBrushTips } from './brush-tips';
import { fail, type Result, succeed } from './result';

/**
 * Reads a Photoshop `.abr` file and prepares its sampled tips for embedding in icon SVGs.
 * @returns The tips, or an error when the file cannot be read or holds no usable tips.
 */
export async function loadBrushTips(
	brushFilePath: string,
): Promise<Result<BrushTipImage[]>> {
	const bytesResult = await readBrushFile(brushFilePath);
	if (!bytesResult.ok) return bytesResult;
	const tipsResult = prepareBrushTips(bytesResult.value);
	if (!tipsResult.ok)
		return fail(new Error(`${brushFilePath}: ${tipsResult.error.message}`));
	return tipsResult;
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
