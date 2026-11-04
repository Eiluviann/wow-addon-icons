import { type Glyph, gameIcon } from './glyph';
import { fail, type Result, succeed } from './result';

/** One addon group and the glyph and tint its icon uses. */
export type IconGroup = {
	slug: string;
	label: string;
	glyph: Glyph;
	hue: number;
};

/** Add new addon groups here; `slug` becomes the exported file name. */
export const ICON_GROUPS = [
	{
		slug: 'voice-over',
		label: 'Voice Over',
		glyph: gameIcon('old-microphone'),
		hue: 268,
	},
	{
		slug: 'debugging',
		label: 'Debugging',
		glyph: gameIcon('bug-net'),
		hue: 354,
	},
	{
		slug: 'gamepad',
		label: 'Gamepad',
		glyph: gameIcon('console-controller'),
		hue: 184,
	},
	{
		slug: 'bag-organization',
		label: 'Bag Organization',
		glyph: gameIcon('bindle'),
		hue: 30,
	},
	{
		slug: 'questing',
		label: 'Questing',
		glyph: gameIcon('stabbed-note'),
		hue: 48,
	},
] satisfies IconGroup[];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Checks that every slug is kebab-case and unique.
 * @returns The groups unchanged, or an error naming the offending slug.
 */
export function validateIconGroups(
	iconGroups: readonly IconGroup[],
): Result<readonly IconGroup[]> {
	const seenSlugs = new Set<string>();
	for (const { slug } of iconGroups) {
		if (!SLUG_PATTERN.test(slug))
			return fail(new Error(`Slug "${slug}" is not kebab-case`));
		if (seenSlugs.has(slug)) return fail(new Error(`Duplicate slug "${slug}"`));
		seenSlugs.add(slug);
	}
	return succeed(iconGroups);
}
