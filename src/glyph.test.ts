import { faBug } from '@fortawesome/free-solid-svg-icons';
import { describe, expect, it } from 'vitest';
import { fromFontAwesome, glyphFromSvgMarkup, isPathData } from './glyph';

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

describe('glyphFromSvgMarkup', () => {
	it('reads the viewBox size and a single path', () => {
		const result = glyphFromSvgMarkup(
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 20"><path d="M0 0h24v20z"/></svg>',
		);
		expect(result).toEqual({
			ok: true,
			value: { width: 24, height: 20, paths: ['M0 0h24v20z'] },
		});
	});

	it('keeps every path, with either quote style and closing tag', () => {
		const result = glyphFromSvgMarkup(
			`<?xml version="1.0"?><svg width="64" height="64"><g><path fill="#000" d='M1 1h2'></path><path d="M3 3h4"/></g></svg>`,
		);
		expect(result.ok && result.value.paths).toEqual(['M1 1h2', 'M3 3h4']);
		expect(result.ok && result.value.width).toBe(64);
	});

	it.each([
		['no size', '<svg><path d="M0 0h1"/></svg>', /viewBox/],
		['no paths', '<svg viewBox="0 0 10 10"><g/></svg>', /no <path>/],
		[
			'an offset viewBox',
			'<svg viewBox="2 2 10 10"><path d="M0 0"/></svg>',
			/0 0/,
		],
		[
			'other shapes',
			'<svg viewBox="0 0 10 10"><path d="M0 0h1"/><circle r="2"/></svg>',
			/shapes/,
		],
		['not an SVG', '<html></html>', /Not an SVG/],
		[
			'markup smuggled into path data',
			`<svg viewBox="0 0 10 10"><path d='M0 0"/><script>alert(1)</script>'/></svg>`,
			/plain commands/,
		],
	])('rejects markup with %s', (_case, markup, message) => {
		const result = glyphFromSvgMarkup(markup);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toMatch(message);
	});
});

describe('isPathData', () => {
	it('accepts commands, numbers and exponents', () => {
		expect(isPathData('M10.5-2e-3 L4,4 a1 1 0 0 1 2 2Z')).toBe(true);
	});

	it('rejects anything that could close the attribute', () => {
		expect(isPathData('M0 0" onload="x')).toBe(false);
	});
});
