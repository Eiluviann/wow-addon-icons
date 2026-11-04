import { strToU8, zipSync } from 'fflate';

/** One icon's exported files: its SVG and a PNG per size. */
export type ExportedIcon = {
	slug: string;
	svg: string;
	pngs: readonly { size: number; png: Uint8Array }[];
};

export const CREDITS_TEXT = `Icons made with WoW Addon Icons.

Glyphs from game-icons.net are by Lorc, Delapouite and contributors, licensed CC BY 3.0:
https://game-icons.net — https://creativecommons.org/licenses/by/3.0/

Glyphs from Font Awesome Free are by Fonticons, Inc., licensed CC BY 4.0:
https://fontawesome.com — https://creativecommons.org/licenses/by/4.0/

Keep this attribution wherever you publish icons that use these glyphs.
`;

/**
 * Packs icons into a zip: `<size>/<slug>.png`, `svg/<slug>.svg` and `CREDITS.txt`.
 * @throws When two icons share a slug, which would overwrite one with the other.
 */
export function buildExportZip(icons: readonly ExportedIcon[]): Uint8Array {
	const slugs = new Set(icons.map(({ slug }) => slug));
	if (slugs.size !== icons.length)
		throw new Error('Exported icons must have unique slugs');
	const entries = Object.fromEntries([
		...icons.flatMap(({ slug, svg, pngs }) => [
			[`svg/${slug}.svg`, strToU8(svg)] as const,
			...pngs.map(({ size, png }) => [`${size}/${slug}.png`, png] as const),
		]),
		['CREDITS.txt', strToU8(CREDITS_TEXT)] as const,
	]);
	// PNGs are already compressed; deflating them again only costs time.
	return zipSync(entries, { level: 0 });
}
