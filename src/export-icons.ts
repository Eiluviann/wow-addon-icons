import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrushTipImage } from './brush-tip-image';
import { buildIconSvg } from './build-icon-svg';
import { type ExportOptions, resolveExportOptions } from './export-options';
import type { IconGroup } from './icon-groups';
import { loadBrushTips } from './load-brush-tips';
import { renderPng } from './render-png';
import { succeed } from './result';
import { MEDALLION_THEME } from './theme';

await main();

async function main(): Promise<void> {
	const optionsResult = resolveExportOptions(process.argv.slice(2));
	if (!optionsResult.ok) {
		console.error(optionsResult.error.message);
		process.exitCode = 1;
		return;
	}
	const { outputDirectory, brushFile } = optionsResult.value;
	const brushTipsResult =
		brushFile === undefined ? succeed([]) : await loadBrushTips(brushFile);
	if (!brushTipsResult.ok) {
		console.error(brushTipsResult.error.message);
		process.exitCode = 1;
		return;
	}
	const writtenPngCount = await exportIcons(
		optionsResult.value,
		brushTipsResult.value,
	);
	console.log(
		`Wrote ${writtenPngCount} PNGs to ${outputDirectory}/ — preview: ${outputDirectory}/preview.html`,
	);
}

async function exportIcons(
	options: ExportOptions,
	brushTips: readonly BrushTipImage[],
): Promise<number> {
	const { iconGroups, sizes, outputDirectory } = options;
	await rm(outputDirectory, { recursive: true, force: true });
	await Promise.all(
		['svg', ...sizes.map(String)].map((folder) =>
			mkdir(join(outputDirectory, folder), { recursive: true }),
		),
	);
	const writes = iconGroups.flatMap((iconGroup) => {
		const svg = buildIconSvg(iconGroup, MEDALLION_THEME, brushTips);
		return [
			writeFile(join(outputDirectory, 'svg', `${iconGroup.slug}.svg`), svg),
			...sizes.map((size) =>
				writeFile(
					join(outputDirectory, String(size), `${iconGroup.slug}.png`),
					renderPng(svg, size),
				),
			),
		];
	});
	await Promise.all([
		...writes,
		writeFile(
			join(outputDirectory, 'preview.html'),
			buildPreviewHtml(iconGroups, sizes),
		),
	]);
	return iconGroups.length * sizes.length;
}

function buildPreviewHtml(
	iconGroups: readonly IconGroup[],
	sizes: readonly number[],
): string {
	const rows = iconGroups
		.map((iconGroup) => {
			const images = sizes
				.map(
					(size) =>
						`<img src="${size}/${iconGroup.slug}.png" width="${size}" height="${size}" alt="${iconGroup.label} ${size}px">`,
				)
				.join('');
			return `<section><h2>${iconGroup.label} <small>${iconGroup.slug}</small></h2><div class="sizes">${images}</div></section>`;
		})
		.join('\n');
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Addon icon set</title>
<style>
body{margin:0;padding:24px;background:#16130f;color:#eadfc4;font:14px system-ui,sans-serif}
section{margin-bottom:28px}footer{opacity:.6;font-size:12px}a{color:inherit}h2{font-weight:600;margin:0 0 10px}small{opacity:.5;font-weight:400}
.sizes{display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap}
</style></head><body>
${rows}
<footer>Some glyphs by Lorc, Delapouite and contributors from <a href="https://game-icons.net">game-icons.net</a>, CC BY 3.0.</footer>
</body></html>
`;
}
