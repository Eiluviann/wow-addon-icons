import { faBug } from '@fortawesome/pro-regular-svg-icons';
import { describe, expect, it } from 'vitest';
import { buildIconSvg } from './build-icon-svg';
import { fromFontAwesome, gameIcon } from './glyph';
import { DEFAULT_THEME, deriveGroupPalette, MEDALLION_THEME } from './theme';

describe('buildIconSvg', () => {
	const debuggingGroup = {
		slug: 'debugging',
		label: 'Debugging',
		glyph: fromFontAwesome(faBug),
		hue: 354,
	};

	it('embeds the glyph path and the group palette', () => {
		const svg = buildIconSvg(debuggingGroup, DEFAULT_THEME);
		const firstPath = debuggingGroup.glyph.paths[0];
		expect(firstPath).toBeDefined();
		expect(svg).toContain(`d="${firstPath}"`);
		expect(svg).toContain(deriveGroupPalette(354).backgroundCenter);
		expect(svg).toContain(DEFAULT_THEME.borderGoldMid);
	});

	it('applies the frame bevel and glyph emboss only when enabled', () => {
		const flatSvg = buildIconSvg(debuggingGroup, DEFAULT_THEME);
		expect(flatSvg).not.toContain('url(#frame-emboss)');
		expect(flatSvg).not.toContain('url(#chamfer-outer)');
		const chamferSvg = buildIconSvg(debuggingGroup, {
			...DEFAULT_THEME,
			frameBevel: 'chamfer',
		});
		expect(chamferSvg).toContain('url(#chamfer-outer)');
		const embossedSvg = buildIconSvg(debuggingGroup, {
			...DEFAULT_THEME,
			frameBevel: 'embossed',
			isGlyphEmbossed: true,
		});
		expect(embossedSvg).toContain('url(#frame-emboss)');
		expect(embossedSvg).toContain('url(#glyph-emboss)');
	});

	it('applies the classic-style tokens only when enabled', () => {
		const plainSvg = buildIconSvg(debuggingGroup, DEFAULT_THEME);
		expect(plainSvg).not.toContain('url(#paint-texture)');
		expect(plainSvg).not.toContain('url(#glyph-glow)');
		expect(plainSvg).not.toContain('stroke="url(#glyph-fill)"');
		const classicSvg = buildIconSvg(debuggingGroup, {
			...DEFAULT_THEME,
			panelTexture: 'grain',
			hasGlyphGlow: true,
			glyphColorMode: 'tinted',
			glyphStrokeWidth: 14,
		});
		expect(classicSvg).toContain('url(#paint-texture)');
		expect(classicSvg).toContain('url(#glyph-glow)');
		expect(classicSvg).toContain('stroke-width="14"');
		expect(classicSvg).toContain(deriveGroupPalette(354).glyphTintTop);
	});

	it('colours the glyph gold and hammers the frame when enabled', () => {
		const plainSvg = buildIconSvg(debuggingGroup, {
			...DEFAULT_THEME,
			frameBevel: 'embossed',
		});
		expect(plainSvg).not.toContain('result="dents"');
		const medallionSvg = buildIconSvg(debuggingGroup, {
			...DEFAULT_THEME,
			frameBevel: 'embossed',
			isFrameHammered: true,
			glyphColorMode: 'gold',
		});
		expect(medallionSvg).toContain('result="dents"');
		expect(medallionSvg).toMatch(
			new RegExp(
				`id="glyph-fill"[\\s\\S]*?stop-color="${DEFAULT_THEME.borderGoldLight}"`,
			),
		);
	});

	it('filters the panel and frame directly for the canvas texture', () => {
		const canvasSvg = buildIconSvg(debuggingGroup, {
			...DEFAULT_THEME,
			panelTexture: 'canvas',
		});
		expect(canvasSvg).toContain(
			'fill="url(#background)" filter="url(#canvas-paint)"',
		);
		expect(canvasSvg).toContain('<g filter="url(#canvas-paint)">');
		expect(canvasSvg).not.toContain('id="paint-texture"');
	});

	it('paints panel and frame with clipped, deterministic brush strokes', () => {
		const strokesTheme = {
			...DEFAULT_THEME,
			outerCornerRadius: 256,
			borderWidth: 38,
			innerCornerRadius: 218,
			frameBevel: 'embossed',
			panelTexture: 'strokes',
		} as const;
		const strokesSvg = buildIconSvg(debuggingGroup, strokesTheme);
		const stampCount =
			strokesSvg.match(/<use href="#brush-stamp-/g)?.length ?? 0;
		expect(stampCount).toBeGreaterThan(1000);
		expect(strokesSvg).toContain('id="impasto"');
		expect(strokesSvg).toContain('<g clip-path="url(#panel-clip)">');
		expect(strokesSvg).toContain('clip-rule="evenodd"');
		expect(strokesSvg).toContain(
			'<g filter="url(#frame-emboss)"><g clip-path="url(#ring-clip)">',
		);
		expect(strokesSvg).not.toContain('url(#paint-texture)');
		expect(buildIconSvg(debuggingGroup, strokesTheme)).toBe(strokesSvg);
	});

	it('scales or drops the panel stroke depth but keeps the frame relief', () => {
		const strokesTheme = {
			...DEFAULT_THEME,
			outerCornerRadius: 256,
			borderWidth: 38,
			innerCornerRadius: 218,
			frameBevel: 'embossed',
			panelTexture: 'strokes',
		} as const;
		const flatPanelSvg = buildIconSvg(debuggingGroup, {
			...strokesTheme,
			panelStrokeDepth: 0,
		});
		const shallowPanelSvg = buildIconSvg(debuggingGroup, {
			...strokesTheme,
			panelStrokeDepth: 0.5,
		});
		expect(flatPanelSvg).not.toContain('url(#panel-impasto)');
		expect(flatPanelSvg).toContain('url(#impasto)');
		expect(shallowPanelSvg).toMatch(
			/<filter id="panel-impasto"[\s\S]*?surfaceScale="2"/,
		);
		expect(() =>
			buildIconSvg(debuggingGroup, { ...strokesTheme, panelStrokeDepth: 1.5 }),
		).toThrow(/panelStrokeDepth/);
	});

	it('scales the glyph stroke depth apart from the frame', () => {
		const strokesTheme = {
			...DEFAULT_THEME,
			panelTexture: 'strokes',
		} as const;
		const shallowGlyphSvg = buildIconSvg(debuggingGroup, {
			...strokesTheme,
			glyphStrokeDepth: 0.5,
		});
		const flatGlyphSvg = buildIconSvg(debuggingGroup, {
			...strokesTheme,
			glyphStrokeDepth: 0,
		});
		expect(shallowGlyphSvg).toMatch(
			/<filter id="glyph-impasto"[\s\S]*?surfaceScale="2"/,
		);
		expect(flatGlyphSvg).not.toContain('url(#glyph-impasto)');
		expect(flatGlyphSvg).toContain('url(#impasto)');
		expect(() =>
			buildIconSvg(debuggingGroup, { ...strokesTheme, glyphStrokeDepth: -1 }),
		).toThrow(/glyphStrokeDepth/);
	});

	it('paints the glyph in gold strokes masked to its shape', () => {
		const strokesTheme = {
			...DEFAULT_THEME,
			outerCornerRadius: 256,
			borderWidth: 38,
			innerCornerRadius: 218,
			frameBevel: 'embossed',
			isGlyphEmbossed: true,
			panelTexture: 'strokes',
		} as const;
		const paintedSvg = buildIconSvg(debuggingGroup, strokesTheme);
		const glyphMarkup = paintedSvg.slice(
			paintedSvg.indexOf('<g filter="url(#glyph-shadow)">'),
		);
		expect(paintedSvg).toContain('<mask id="glyph-mask"');
		expect(glyphMarkup).toContain('<g mask="url(#glyph-mask)">');
		expect(
			glyphMarkup.slice(0, glyphMarkup.indexOf('<clipPath id="ring-clip">')),
		).toContain('<use href="#brush-stamp-');
		expect(buildIconSvg(debuggingGroup, DEFAULT_THEME)).not.toContain(
			'glyph-mask',
		);
	});

	it('flattens the glyph face with an edge bevel', () => {
		const roundedSvg = buildIconSvg(debuggingGroup, {
			...DEFAULT_THEME,
			isGlyphEmbossed: true,
		});
		const edgeSvg = buildIconSvg(debuggingGroup, {
			...DEFAULT_THEME,
			isGlyphEmbossed: true,
			glyphBevel: 'edge',
		});
		const plateau = '<feFuncA type="linear" slope="2" intercept="-1"/>';
		expect(roundedSvg).not.toContain(plateau);
		expect(edgeSvg).toMatch(
			new RegExp(`<filter id="glyph-emboss"[\\s\\S]*?${plateau}`),
		);
	});

	it('sets the glyph shadow strength from the theme', () => {
		const svg = buildIconSvg(debuggingGroup, {
			...DEFAULT_THEME,
			glyphShadowOpacity: 0.35,
		});
		expect(svg).toContain('flood-opacity="0.35"');
	});

	it('traces the glyph strokes along its path when asked', () => {
		const fieldSvg = buildIconSvg(debuggingGroup, {
			...MEDALLION_THEME,
			glyphStrokeFlow: 'field',
		});
		const tracedSvg = buildIconSvg(debuggingGroup, MEDALLION_THEME);
		const glyphStrokes = (svg: string) =>
			svg.match(/<g mask="url\(#glyph-mask\)">[\s\S]*?\n<\/g>/)?.[0];
		expect(glyphStrokes(tracedSvg)).toContain('<use href="#brush-stamp-');
		expect(glyphStrokes(tracedSvg)).not.toEqual(glyphStrokes(fieldSvg));
		expect(buildIconSvg(debuggingGroup, MEDALLION_THEME)).toEqual(tracedSvg);
	});

	it('rejects a non-positive brush scale', () => {
		expect(() =>
			buildIconSvg(debuggingGroup, {
				...DEFAULT_THEME,
				panelTexture: 'strokes',
				brushScale: 0,
			}),
		).toThrow(/brushScale/);
	});

	it('rejects a hue outside 0–360', () => {
		expect(() =>
			buildIconSvg({ ...debuggingGroup, hue: 400 }, DEFAULT_THEME),
		).toThrow(/hue/);
	});

	it('draws a game-icons glyph the same way', () => {
		const swordsGroup = {
			slug: 'combat',
			label: 'Combat',
			glyph: gameIcon('crossed-swords'),
			hue: 0,
		};
		const svg = buildIconSvg(swordsGroup, DEFAULT_THEME);
		expect(svg).toContain(`d="${swordsGroup.glyph.paths[0]}"`);
	});
});
