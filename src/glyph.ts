import type { IconDefinition } from '@fortawesome/fontawesome-common-types';
import { icons as gameIconSet } from '@iconify-json/game-icons';

/** A glyph from any icon set: its own coordinate box and the path data drawn in it. */
export type Glyph = {
	width: number;
	height: number;
	paths: readonly string[];
};

const PATH_ELEMENT_PATTERN = /<path\b[^>]*\bd="([^"]+)"[^>]*\/>/g;
const ALIAS_DEPTH_LIMIT = 8;

/** Adapts a Font Awesome icon definition. */
export function fromFontAwesome(definition: IconDefinition): Glyph {
	const [width, height, , , pathData] = definition.icon;
	return {
		width,
		height,
		paths: Array.isArray(pathData) ? pathData : [pathData],
	};
}

/**
 * Looks up a glyph from game-icons.net (CC BY 3.0, credit Lorc, Delapouite and contributors).
 * @param name - The icon's slug as listed on game-icons.net, e.g. `crossed-swords`.
 * @throws When the name is unknown or its body holds anything but paths: both mean a typo in the group config.
 */
export function gameIcon(name: string): Glyph {
	const iconName = resolveGameIconAlias(name);
	const icon = gameIconSet.icons[iconName];
	if (icon === undefined) throw new Error(`Unknown game-icons glyph "${name}"`);
	const paths = [...icon.body.matchAll(PATH_ELEMENT_PATTERN)].map(
		([, pathData]) => pathData ?? '',
	);
	const bodyWithoutPaths = icon.body.replace(PATH_ELEMENT_PATTERN, '').trim();
	if (paths.length === 0 || bodyWithoutPaths !== '')
		throw new Error(`game-icons glyph "${name}" is not plain paths`);
	return {
		width: icon.width ?? gameIconSet.width ?? 512,
		height: icon.height ?? gameIconSet.height ?? 512,
		paths,
	};
}

function resolveGameIconAlias(name: string): string {
	let resolvedName = name;
	for (let depth = 0; depth < ALIAS_DEPTH_LIMIT; depth++) {
		const parent = gameIconSet.aliases?.[resolvedName]?.parent;
		if (parent === undefined) return resolvedName;
		resolvedName = parent;
	}
	throw new Error(`game-icons alias "${name}" does not resolve`);
}
