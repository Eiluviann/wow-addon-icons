import { faBug } from '@fortawesome/pro-regular-svg-icons';
import { describe, expect, it } from 'vitest';
import { fromFontAwesome, gameIcon } from './glyph';

describe('fromFontAwesome', () => {
	it('keeps the size and every path', () => {
		const glyph = fromFontAwesome(faBug);
		const [width, height, , , pathData] = faBug.icon;
		expect(glyph.width).toBe(width);
		expect(glyph.height).toBe(height);
		expect(glyph.paths).toEqual(
			Array.isArray(pathData) ? pathData : [pathData],
		);
	});
});

describe('gameIcon', () => {
	it('reads a game-icons glyph at the set size', () => {
		const glyph = gameIcon('crossed-swords');
		expect(glyph.width).toBe(512);
		expect(glyph.height).toBe(512);
		expect(glyph.paths.length).toBeGreaterThan(0);
		expect(glyph.paths[0]).toMatch(/^M/);
	});

	it('throws on an unknown name', () => {
		expect(() => gameIcon('not-a-real-icon')).toThrow(/not-a-real-icon/);
	});
});
