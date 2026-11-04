import { parseAbrBrushTips } from './abr-brush-file';
import { type BrushTipImage, prepareBrushTipImage } from './brush-tip-image';
import { type Result, succeed } from './result';

// Large enough for crisp bristles at 512 px, small enough to keep 100 embedded tips near 1 MB.
const EMBEDDED_TIP_LONG_SIDE = 256;

/**
 * Parses the bytes of a Photoshop `.abr` file and prepares its sampled tips for embedding in icon SVGs.
 * @returns The tips, or an error when the file holds no usable tips.
 */
export function prepareBrushTips(bytes: Uint8Array): Result<BrushTipImage[]> {
	const tipsResult = parseAbrBrushTips(bytes);
	if (!tipsResult.ok) return tipsResult;
	return succeed(
		tipsResult.value.map((tip) =>
			prepareBrushTipImage(tip, EMBEDDED_TIP_LONG_SIDE),
		),
	);
}
