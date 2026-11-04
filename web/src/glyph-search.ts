import type { GlyphSetId, SourcedGlyph } from './editable-group';

/** What the picker asks for: words to match in glyph names, and optionally one set. */
export type GlyphQuery = { text: string; set: GlyphSetId | 'all' };

/**
 * Finds glyphs whose names hold every word of the query, exact and prefix matches first.
 * @param limit - The most results to return, so the picker never draws thousands at once.
 */
export function searchGlyphs(
	catalogue: readonly SourcedGlyph[],
	{ text, set }: GlyphQuery,
	limit: number,
): SourcedGlyph[] {
	const words = text
		.toLowerCase()
		.split(/[\s-]+/)
		.filter(Boolean);
	const joinedQuery = words.join('-');
	return catalogue
		.filter(({ ref }) => set === 'all' || ref.set === set)
		.filter(({ ref }) => words.every((word) => ref.name.includes(word)))
		.map((entry) => ({ entry, rank: rankMatch(entry.ref.name, joinedQuery) }))
		.sort((first, second) => first.rank - second.rank)
		.slice(0, limit)
		.map(({ entry }) => entry);
}

function rankMatch(name: string, joinedQuery: string): number {
	if (joinedQuery === '') return 0;
	if (name === joinedQuery) return 0;
	if (name.startsWith(joinedQuery)) return 1;
	return 2;
}
