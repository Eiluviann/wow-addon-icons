import { describe, expect, it } from 'vitest';
import { findGameIcon, GAME_ICON_NAMES, gameIcon } from './game-icon-glyph';

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

describe('findGameIcon', () => {
	it('returns an error for an unknown name', () => {
		expect(findGameIcon('not-a-real-icon').ok).toBe(false);
	});

	it('lists thousands of icon names', () => {
		expect(GAME_ICON_NAMES.length).toBeGreaterThan(3000);
		expect(GAME_ICON_NAMES).toContain('bindle');
	});
});
