import { parseArgs } from 'node:util';
import { ICON_GROUPS, type IconGroup, validateIconGroups } from './icon-groups';
import { validateExportSize } from './render-png';
import { fail, type Result, succeed } from './result';

/** What one export run renders, and where it writes. */
export type ExportOptions = {
	iconGroups: readonly IconGroup[];
	sizes: readonly number[];
	outputDirectory: string;
	/** Photoshop `.abr` file whose sampled tips paint the 'strokes' texture; procedural stamps when absent. */
	brushFile: string | undefined;
};

export const DEFAULT_EXPORT_SIZES = [150, 256, 512] as const;
export const OUTPUT_DIRECTORY = 'dist';

/**
 * Turns CLI arguments into export options.
 * Supports `--only <slug>[,<slug>]`, `--sizes <px>[,<px>]` and `--brush <file.abr>`.
 * @param iconGroups - The configured groups; defaults to `ICON_GROUPS`.
 * @returns The options, or an error for an unknown slug, an invalid size or a bad group config.
 */
export function resolveExportOptions(
	cliArguments: readonly string[],
	iconGroups: readonly IconGroup[] = ICON_GROUPS,
): Result<ExportOptions> {
	const { values } = parseArgs({
		args: [...cliArguments],
		options: {
			only: { type: 'string' },
			sizes: { type: 'string' },
			brush: { type: 'string' },
		},
	});
	const groupsResult = validateIconGroups(iconGroups);
	if (!groupsResult.ok) return groupsResult;
	const selectedGroupsResult = selectIconGroups(
		groupsResult.value,
		values.only,
	);
	if (!selectedGroupsResult.ok) return selectedGroupsResult;
	const sizesResult = parseExportSizes(values.sizes);
	if (!sizesResult.ok) return sizesResult;
	return succeed({
		iconGroups: selectedGroupsResult.value,
		sizes: sizesResult.value,
		outputDirectory: OUTPUT_DIRECTORY,
		brushFile: values.brush,
	});
}

function selectIconGroups(
	iconGroups: readonly IconGroup[],
	onlyArgument: string | undefined,
): Result<readonly IconGroup[]> {
	if (onlyArgument === undefined) return succeed(iconGroups);
	const requestedSlugs = splitList(onlyArgument);
	const unknownSlug = requestedSlugs.find(
		(slug) => !iconGroups.some((iconGroup) => iconGroup.slug === slug),
	);
	if (unknownSlug !== undefined)
		return fail(new Error(`Unknown group "${unknownSlug}"`));
	return succeed(
		iconGroups.filter((iconGroup) => requestedSlugs.includes(iconGroup.slug)),
	);
}

function parseExportSizes(
	sizesArgument: string | undefined,
): Result<readonly number[]> {
	if (sizesArgument === undefined) return succeed(DEFAULT_EXPORT_SIZES);
	const sizes: number[] = [];
	for (const sizeText of splitList(sizesArgument)) {
		const sizeResult = validateExportSize(Number(sizeText));
		if (!sizeResult.ok) return sizeResult;
		sizes.push(sizeResult.value);
	}
	return succeed([...new Set(sizes)]);
}

function splitList(listArgument: string): string[] {
	return listArgument
		.split(',')
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}
