import type { IconDefinition } from '@fortawesome/fontawesome-common-types';
import { fail, type Result, succeed } from './result';

/** A glyph from any icon set: its own coordinate box and the path data drawn in it. */
export type Glyph = {
	width: number;
	height: number;
	paths: readonly string[];
};

const PATH_DATA_PATTERN = /<path\b[^>]*?\sd\s*=\s*(["'])([\s\S]*?)\1/g;
const SVG_ROOT_PATTERN = /<svg\b[^>]*>/;
// Path commands, numbers and separators only: path data is spliced into exported SVG markup.
const PATH_DATA_CHARACTERS = /^[MmZzLlHhVvCcSsQqTtAaEe0-9.,+\-\s]+$/;
const SHAPE_ELEMENT_PATTERN =
	/<(?:circle|ellipse|rect|polygon|polyline|line|text|image|use)\b/;

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
 * Reads every `<path d>` out of SVG markup. Transforms and non-path shapes are not applied,
 * so the SVG should be a flat set of paths, as icon sets export them.
 * @returns The glyph, or an error when the markup has no usable size or no paths, or draws
 * with shapes the glyph would drop.
 */
export function glyphFromSvgMarkup(markup: string): Result<Glyph> {
	const rootTag = markup.match(SVG_ROOT_PATTERN)?.[0];
	if (rootTag === undefined) return fail(new Error('Not an SVG file'));
	const sizeResult = readSvgSize(rootTag);
	if (!sizeResult.ok) return sizeResult;
	const paths = extractPathData(markup);
	if (paths.length === 0)
		return fail(new Error('The SVG has no <path> elements'));
	if (!paths.every(isPathData))
		return fail(new Error('The SVG has path data that is not plain commands'));
	if (SHAPE_ELEMENT_PATTERN.test(markup))
		return fail(
			new Error('The SVG uses shapes other than paths; convert them to paths'),
		);
	return succeed({ ...sizeResult.value, paths });
}

/** Whether `pathData` holds only path commands and numbers, so it is safe to splice into markup. */
export function isPathData(pathData: string): boolean {
	return PATH_DATA_CHARACTERS.test(pathData);
}

/** Every path's `d` attribute in `markup`, in document order. */
export function extractPathData(markup: string): string[] {
	return [...markup.matchAll(PATH_DATA_PATTERN)]
		.map(([, , pathData]) => pathData?.trim() ?? '')
		.filter((pathData) => pathData !== '');
}

// Glyphs carry no origin, so a viewBox must start at 0 0 for the paths to land where they were drawn.
function readSvgSize(
	rootTag: string,
): Result<{ width: number; height: number }> {
	const viewBox = readAttribute(rootTag, 'viewBox');
	if (viewBox !== undefined) {
		const [minX, minY, width, height] = viewBox
			.trim()
			.split(/[\s,]+/)
			.map(Number);
		if (
			width === undefined ||
			height === undefined ||
			!(width > 0 && height > 0)
		)
			return fail(new Error(`The SVG viewBox "${viewBox}" is not valid`));
		if (minX !== 0 || minY !== 0)
			return fail(new Error('The SVG viewBox must start at 0 0'));
		return succeed({ width, height });
	}
	const width = Number.parseFloat(readAttribute(rootTag, 'width') ?? '');
	const height = Number.parseFloat(readAttribute(rootTag, 'height') ?? '');
	if (!(width > 0 && height > 0))
		return fail(new Error('The SVG has no viewBox or width and height'));
	return succeed({ width, height });
}

function readAttribute(tag: string, name: string): string | undefined {
	return tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`))?.[2];
}
