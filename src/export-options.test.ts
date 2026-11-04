import { faBug } from '@fortawesome/pro-regular-svg-icons';
import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_SIZES, resolveExportOptions } from './export-options';
import { fromFontAwesome } from './glyph';
import { ICON_GROUPS } from './icon-groups';

describe('resolveExportOptions', () => {
	it('defaults to every group at every default size', () => {
		const result = resolveExportOptions([]);
		expect(result.ok && result.value.iconGroups).toHaveLength(
			ICON_GROUPS.length,
		);
		expect(result.ok && result.value.sizes).toEqual(DEFAULT_EXPORT_SIZES);
	});

	it('filters groups with --only and dedupes --sizes', () => {
		const result = resolveExportOptions([
			'--only',
			'gamepad,questing',
			'--sizes',
			'200, 200,300',
		]);
		expect(
			result.ok && result.value.iconGroups.map((group) => group.slug),
		).toEqual(['gamepad', 'questing']);
		expect(result.ok && result.value.sizes).toEqual([200, 300]);
	});

	it('passes --brush through as the brush file', () => {
		const withBrush = resolveExportOptions(['--brush', 'brushes/oil.abr']);
		const withoutBrush = resolveExportOptions([]);
		expect(withBrush.ok && withBrush.value.brushFile).toBe('brushes/oil.abr');
		expect(withoutBrush.ok && withoutBrush.value.brushFile).toBeUndefined();
	});

	it('rejects an unknown slug', () => {
		const result = resolveExportOptions(['--only', 'raiding']);
		expect(!result.ok && result.error.message).toMatch(
			/Unknown group "raiding"/,
		);
	});

	it('rejects a size below 150', () => {
		expect(resolveExportOptions(['--sizes', '64']).ok).toBe(false);
	});

	it('rejects duplicate slugs in the group config', () => {
		const duplicateGroup = {
			slug: 'debugging',
			label: 'Debugging',
			glyph: fromFontAwesome(faBug),
			hue: 0,
		};
		const result = resolveExportOptions([], [duplicateGroup, duplicateGroup]);
		expect(!result.ok && result.error.message).toMatch(/Duplicate slug/);
	});
});
