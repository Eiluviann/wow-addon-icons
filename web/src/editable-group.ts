import type { Glyph } from '../../src/glyph';

/** Where a glyph came from, so the picker can show and search it again. */
export type GlyphSetId = 'game-icons' | 'fa-solid' | 'fa-regular' | 'upload';

/** A glyph's set and its name within that set. */
export type GlyphRef = { set: GlyphSetId; name: string };

/** A glyph together with where it came from. */
export type SourcedGlyph = { ref: GlyphRef; glyph: Glyph };

/** One icon in the set being edited; `id` is local to this browser session. */
export type EditableGroup = {
	id: string;
	label: string;
	slug: string;
	hue: number;
	glyph: SourcedGlyph;
};

export const GLYPH_SET_LABELS = {
	'game-icons': 'game-icons.net',
	'fa-solid': 'Font Awesome Solid',
	'fa-regular': 'Font Awesome Regular',
	upload: 'Uploaded',
} as const satisfies Record<GlyphSetId, string>;

/** Turns a display name into a kebab-case file name; falls back to `icon` when nothing is left. */
export function slugify(label: string): string {
	const slug = label
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug === '' ? 'icon' : slug;
}

/** A fresh id for a group added in this session. */
export function createGroupId(): string {
	return crypto.randomUUID();
}
