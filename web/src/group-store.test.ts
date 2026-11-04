import { describe, expect, it } from 'vitest';
import type { EditableGroup } from './editable-group';
import { parseGroupSet, serialiseGroupSet } from './group-store';

const BUG_GROUP: EditableGroup = {
	id: 'a',
	label: 'Debugging',
	slug: 'debugging',
	hue: 354,
	glyph: {
		ref: { set: 'game-icons', name: 'bug-net' },
		glyph: { width: 512, height: 512, paths: ['M0 0h512v512z'] },
	},
};

describe('group set files', () => {
	it('round-trips every field but the session id', () => {
		const result = parseGroupSet(serialiseGroupSet([BUG_GROUP]));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const [group] = result.value;
		expect({ ...group, id: 'a' }).toEqual(BUG_GROUP);
	});

	it('rejects malformed JSON', () => {
		const result = parseGroupSet('{"version":');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toMatch(/JSON/);
	});

	it('rejects duplicate slugs', () => {
		const result = parseGroupSet(
			serialiseGroupSet([BUG_GROUP, { ...BUG_GROUP, id: 'b' }]),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toMatch(/Duplicate slug/);
	});

	it.each([
		['a hue out of range', { hue: 400 }, /hue/],
		[
			'markup in path data',
			{
				glyph: {
					ref: BUG_GROUP.glyph.ref,
					glyph: { width: 1, height: 1, paths: ['M0 0"/><script/>'] },
				},
			},
			/path data/,
		],
		[
			'an unknown glyph set',
			{ glyph: { ...BUG_GROUP.glyph, ref: { set: 'fa-pro', name: 'x' } } },
			/unknown/,
		],
	])('rejects a group with %s', (_case, override, message) => {
		const json = JSON.stringify({
			version: 1,
			groups: [{ ...BUG_GROUP, ...override }],
		});
		const result = parseGroupSet(json);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toMatch(message);
	});
});
