import { gameIcon } from './game-icon-glyph';
import type { IconGroup } from './icon-group';

/** Add new addon groups here; `slug` becomes the exported file name. */
export const ICON_GROUPS = [
	{
		slug: 'voice-over',
		label: 'Voice Over',
		glyph: gameIcon('old-microphone'),
		hue: 268,
	},
	{
		slug: 'debugging',
		label: 'Debugging',
		glyph: gameIcon('bug-net'),
		hue: 354,
	},
	{
		slug: 'gamepad',
		label: 'Gamepad',
		glyph: gameIcon('console-controller'),
		hue: 184,
	},
	{
		slug: 'bag-organization',
		label: 'Bag Organization',
		glyph: gameIcon('bindle'),
		hue: 30,
	},
	{
		slug: 'questing',
		label: 'Questing',
		glyph: gameIcon('stabbed-note'),
		hue: 48,
	},
] satisfies IconGroup[];
