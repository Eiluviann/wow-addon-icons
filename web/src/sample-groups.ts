import {
	createGroupId,
	type EditableGroup,
	type GlyphRef,
	type SourcedGlyph,
} from './editable-group';

const SAMPLE_GROUPS = [
	{
		label: 'Voice Over',
		slug: 'voice-over',
		hue: 268,
		glyphName: 'old-microphone',
	},
	{ label: 'Debugging', slug: 'debugging', hue: 354, glyphName: 'bug-net' },
	{
		label: 'Gamepad',
		slug: 'gamepad',
		hue: 184,
		glyphName: 'console-controller',
	},
	{
		label: 'Bag Organization',
		slug: 'bag-organization',
		hue: 30,
		glyphName: 'bindle',
	},
	{ label: 'Questing', slug: 'questing', hue: 48, glyphName: 'stabbed-note' },
] as const;

/** The starter set shown to someone who has not saved one yet. */
export function buildSampleGroups(
	catalogue: readonly SourcedGlyph[],
): EditableGroup[] {
	return SAMPLE_GROUPS.flatMap(({ label, slug, hue, glyphName }) => {
		const glyph = findGlyph(catalogue, { set: 'game-icons', name: glyphName });
		return glyph === undefined
			? []
			: [{ id: createGroupId(), label, slug, hue, glyph }];
	});
}

/** Looks a glyph up by its set and name. */
export function findGlyph(
	catalogue: readonly SourcedGlyph[],
	{ set, name }: GlyphRef,
): SourcedGlyph | undefined {
	return catalogue.find(({ ref }) => ref.set === set && ref.name === name);
}
