import { type Glyph, isPathData } from '../../src/glyph';
import { validateIconGroups } from '../../src/icon-group';
import { fail, type Result, succeed } from '../../src/result';
import {
	createGroupId,
	type EditableGroup,
	GLYPH_SET_LABELS,
	type GlyphRef,
	type GlyphSetId,
} from './editable-group';

const STORAGE_KEY = 'wow-addon-icons:groups';
const FORMAT_VERSION = 1;

/**
 * Serialises a set of groups to the JSON format `parseGroupSet` reads back.
 * Ids are left out: they only identify rows in one session.
 */
export function serialiseGroupSet(groups: readonly EditableGroup[]): string {
	return JSON.stringify(
		{
			version: FORMAT_VERSION,
			groups: groups.map(({ label, slug, hue, glyph }) => ({
				label,
				slug,
				hue,
				glyph,
			})),
		},
		undefined,
		'\t',
	);
}

/**
 * Reads a set of groups saved by `serialiseGroupSet`, from storage or a file someone shared.
 * @returns The groups with fresh ids, or an error naming the first thing that is wrong.
 */
export function parseGroupSet(json: string): Result<EditableGroup[]> {
	const parsedResult = parseJson(json);
	if (!parsedResult.ok) return parsedResult;
	const document = parsedResult.value;
	if (!isRecord(document) || document.version !== FORMAT_VERSION)
		return fail(new Error(`Not an icon set file (version ${FORMAT_VERSION})`));
	if (!Array.isArray(document.groups))
		return fail(new Error('The file has no groups list'));
	const groups: EditableGroup[] = [];
	for (const [index, candidate] of document.groups.entries()) {
		const groupResult = parseGroup(candidate);
		if (!groupResult.ok)
			return fail(
				new Error(`Group ${index + 1}: ${groupResult.error.message}`),
			);
		groups.push(groupResult.value);
	}
	const slugsResult = validateIconGroups(
		groups.map((group) => ({ ...group, glyph: group.glyph.glyph })),
	);
	if (!slugsResult.ok) return slugsResult;
	return succeed(groups);
}

/** The groups saved in this browser, or `undefined` when none are saved or storage is blocked. */
export function loadStoredGroups(): EditableGroup[] | undefined {
	try {
		const json = localStorage.getItem(STORAGE_KEY);
		if (json === null) return undefined;
		const groupsResult = parseGroupSet(json);
		return groupsResult.ok ? groupsResult.value : undefined;
	} catch {
		return undefined;
	}
}

/** Saves the groups in this browser; a blocked or full storage only loses the convenience. */
export function storeGroups(groups: readonly EditableGroup[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, serialiseGroupSet(groups));
	} catch {
		// Private windows and blocked site data: the set still lives in the page until it closes.
	}
}

function parseGroup(candidate: unknown): Result<EditableGroup> {
	if (!isRecord(candidate)) return fail(new Error('is not an object'));
	const { label, slug, hue, glyph } = candidate;
	if (typeof label !== 'string' || label.trim() === '')
		return fail(new Error('needs a name'));
	if (typeof slug !== 'string') return fail(new Error('needs a slug'));
	if (typeof hue !== 'number' || !(hue >= 0 && hue <= 360))
		return fail(new Error('hue must be a number from 0 to 360'));
	if (!isRecord(glyph)) return fail(new Error('needs a glyph'));
	const refResult = parseGlyphRef(glyph.ref);
	if (!refResult.ok) return refResult;
	const shapeResult = parseGlyphShape(glyph.glyph);
	if (!shapeResult.ok) return shapeResult;
	return succeed({
		id: createGroupId(),
		label,
		slug,
		hue,
		glyph: { ref: refResult.value, glyph: shapeResult.value },
	});
}

function parseGlyphRef(candidate: unknown): Result<GlyphRef> {
	if (!isRecord(candidate)) return fail(new Error('glyph has no source'));
	const { set, name } = candidate;
	if (!isGlyphSetId(set)) return fail(new Error('glyph source is unknown'));
	if (typeof name !== 'string') return fail(new Error('glyph has no name'));
	return succeed({ set, name });
}

function parseGlyphShape(candidate: unknown): Result<Glyph> {
	if (!isRecord(candidate)) return fail(new Error('glyph has no shape'));
	const { width, height, paths } = candidate;
	if (typeof width !== 'number' || typeof height !== 'number')
		return fail(new Error('glyph has no size'));
	if (!(width > 0 && height > 0))
		return fail(new Error('glyph size must be positive'));
	if (!Array.isArray(paths) || paths.length === 0)
		return fail(new Error('glyph has no paths'));
	const pathData = paths.filter((path) => typeof path === 'string');
	if (pathData.length !== paths.length || !pathData.every(isPathData))
		return fail(new Error('glyph paths are not plain path data'));
	return succeed({ width, height, paths: pathData });
}

function parseJson(json: string): Result<unknown> {
	try {
		return succeed(JSON.parse(json));
	} catch {
		return fail(new Error('The file is not valid JSON'));
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGlyphSetId(value: unknown): value is GlyphSetId {
	return typeof value === 'string' && Object.hasOwn(GLYPH_SET_LABELS, value);
}
