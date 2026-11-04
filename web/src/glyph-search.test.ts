import { describe, expect, it } from 'vitest';
import type { GlyphSetId, SourcedGlyph } from './editable-group';
import { searchGlyphs } from './glyph-search';

const SQUARE = { width: 1, height: 1, paths: ['M0 0h1v1z'] };
const entry = (set: GlyphSetId, name: string): SourcedGlyph => ({
	ref: { set, name },
	glyph: SQUARE,
});
const CATALOGUE = [
	entry('game-icons', 'old-microphone'),
	entry('fa-solid', 'microphone-lines'),
	entry('fa-solid', 'microphone'),
	entry('game-icons', 'bug-net'),
];

describe('searchGlyphs', () => {
	it('ranks the exact name, then prefixes, then other matches', () => {
		const names = searchGlyphs(
			CATALOGUE,
			{ text: 'microphone', set: 'all' },
			10,
		).map(({ ref }) => ref.name);
		expect(names).toEqual(['microphone', 'microphone-lines', 'old-microphone']);
	});

	it('needs every word and honours the set filter', () => {
		const results = searchGlyphs(
			CATALOGUE,
			{ text: 'old mic', set: 'game-icons' },
			10,
		);
		expect(results.map(({ ref }) => ref.name)).toEqual(['old-microphone']);
		expect(
			searchGlyphs(CATALOGUE, { text: 'old', set: 'fa-solid' }, 10),
		).toEqual([]);
	});

	it('returns everything up to the limit for an empty query', () => {
		expect(searchGlyphs(CATALOGUE, { text: ' ', set: 'all' }, 3)).toHaveLength(
			3,
		);
	});
});
