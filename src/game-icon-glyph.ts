import { icons as gameIconSet } from '@iconify-json/game-icons';
import { extractPathData, type Glyph } from './glyph';
import { fail, type Result, succeed } from './result';

const SELF_CLOSING_PATH_PATTERN = /<path\b[^>]*\/>/g;
const ALIAS_DEPTH_LIMIT = 8;

/** Every icon name in the game-icons.net set, aliases excluded. */
export const GAME_ICON_NAMES: readonly string[] = Object.keys(
	gameIconSet.icons,
);

/**
 * Looks up a glyph from game-icons.net (CC BY 3.0, credit Lorc, Delapouite and contributors).
 * @param name - The icon's slug as listed on game-icons.net, e.g. `crossed-swords`.
 * @returns The glyph, or an error when the name is unknown or its body holds anything but paths.
 */
export function findGameIcon(name: string): Result<Glyph> {
	const iconName = resolveGameIconAlias(name);
	const icon = iconName === undefined ? undefined : gameIconSet.icons[iconName];
	if (icon === undefined)
		return fail(new Error(`Unknown game-icons glyph "${name}"`));
	const paths = extractPathData(icon.body);
	const bodyWithoutPaths = icon.body
		.replace(SELF_CLOSING_PATH_PATTERN, '')
		.trim();
	if (paths.length === 0 || bodyWithoutPaths !== '')
		return fail(new Error(`game-icons glyph "${name}" is not plain paths`));
	return succeed({
		width: icon.width ?? gameIconSet.width ?? 512,
		height: icon.height ?? gameIconSet.height ?? 512,
		paths,
	});
}

/**
 * Looks up a game-icons.net glyph named in code.
 * @throws When the name is unknown or not plain paths: both mean a typo in the group config.
 */
export function gameIcon(name: string): Glyph {
	const glyphResult = findGameIcon(name);
	if (!glyphResult.ok) throw glyphResult.error;
	return glyphResult.value;
}

function resolveGameIconAlias(name: string): string | undefined {
	let resolvedName = name;
	for (let depth = 0; depth < ALIAS_DEPTH_LIMIT; depth++) {
		const parent = gameIconSet.aliases?.[resolvedName]?.parent;
		if (parent === undefined) return resolvedName;
		resolvedName = parent;
	}
	return undefined;
}
