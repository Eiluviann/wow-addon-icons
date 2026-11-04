import type {
	IconDefinition,
	IconPack,
} from '@fortawesome/fontawesome-common-types';
import { fromFontAwesome } from '../../src/glyph';
import type { GlyphSetId, SourcedGlyph } from './editable-group';

let cataloguePromise: Promise<SourcedGlyph[]> | undefined;

/**
 * Every built-in glyph: game-icons.net, then Font Awesome Free. The sets load on first use
 * into their own chunks, so the page paints before the several megabytes of path data arrive.
 */
export function loadGlyphCatalogue(): Promise<SourcedGlyph[]> {
	cataloguePromise ??= buildCatalogue();
	return cataloguePromise;
}

async function buildCatalogue(): Promise<SourcedGlyph[]> {
	const [gameIcons, { fas }, { far }] = await Promise.all([
		import('../../src/game-icon-glyph'),
		import('@fortawesome/free-solid-svg-icons'),
		import('@fortawesome/free-regular-svg-icons'),
	]);
	const gameIconGlyphs = gameIcons.GAME_ICON_NAMES.flatMap((name) => {
		const glyphResult = gameIcons.findGameIcon(name);
		return glyphResult.ok
			? [
					{
						ref: { set: 'game-icons' as const, name },
						glyph: glyphResult.value,
					},
				]
			: [];
	});
	return [
		...gameIconGlyphs,
		...listFontAwesomeGlyphs(fas, 'fa-solid'),
		...listFontAwesomeGlyphs(far, 'fa-regular'),
	];
}

// A pack lists each icon under its own name and again under every alias; keep one of each.
function listFontAwesomeGlyphs(
	pack: IconPack,
	set: GlyphSetId,
): SourcedGlyph[] {
	const definitions = new Map<string, IconDefinition>();
	for (const definition of Object.values(pack))
		definitions.set(definition.iconName, definition);
	return [...definitions.values()].map((definition) => ({
		ref: { set, name: definition.iconName },
		glyph: fromFontAwesome(definition),
	}));
}
