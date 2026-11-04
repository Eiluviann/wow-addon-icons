import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildExportZip, type ExportedIcon } from './export-bundle';

const icon = (slug: string): ExportedIcon => ({
	slug,
	svg: '<svg/>',
	pngs: [150, 512].map((size) => ({ size, png: Uint8Array.of(size % 256) })),
});

describe('buildExportZip', () => {
	it('files each size and the SVGs into folders, with credits', () => {
		const entries = unzipSync(
			buildExportZip([icon('voice-over'), icon('debugging')]),
		);
		expect(Object.keys(entries).sort()).toEqual([
			'150/debugging.png',
			'150/voice-over.png',
			'512/debugging.png',
			'512/voice-over.png',
			'CREDITS.txt',
			'svg/debugging.svg',
			'svg/voice-over.svg',
		]);
		expect([...(entries['512/debugging.png'] ?? [])]).toEqual([0]);
	});

	it('rejects duplicate slugs', () => {
		expect(() => buildExportZip([icon('a'), icon('a')])).toThrow(/unique/);
	});
});
