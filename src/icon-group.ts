import type { Glyph } from './glyph';
import { fail, type Result, succeed } from './result';

/** One addon group and the glyph and tint its icon uses. */
export type IconGroup = {
	slug: string;
	label: string;
	glyph: Glyph;
	hue: number;
};

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
