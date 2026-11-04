import type { Glyph } from '../../src/glyph';

/** What `element` sets on a new element; text is always set as text, never parsed as markup. */
export type ElementOptions = {
	className?: string;
	text?: string;
	attributes?: Readonly<Record<string, string>>;
	children?: readonly (Node | undefined)[];
};

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** Creates an HTML element with its class, text, attributes and children in one call. */
export function element<TagName extends keyof HTMLElementTagNameMap>(
	tagName: TagName,
	{ className, text, attributes = {}, children = [] }: ElementOptions = {},
): HTMLElementTagNameMap[TagName] {
	const created = document.createElement(tagName);
	if (className !== undefined) created.className = className;
	if (text !== undefined) created.textContent = text;
	for (const [name, value] of Object.entries(attributes))
		created.setAttribute(name, value);
	created.append(...children.filter((child) => child !== undefined));
	return created;
}

/** Draws a glyph's paths as an inline SVG in the current text colour. */
export function createGlyphThumbnail(glyph: Glyph): SVGSVGElement {
	const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
	svg.setAttribute('viewBox', `0 0 ${glyph.width} ${glyph.height}`);
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('fill', 'currentColor');
	for (const pathData of glyph.paths) {
		const path = document.createElementNS(SVG_NAMESPACE, 'path');
		path.setAttribute('d', pathData);
		svg.append(path);
	}
	return svg;
}

/** Hands the viewer a file to save. */
export function downloadFile(
	fileName: string,
	contents: Uint8Array | string,
	mimeType: string,
): void {
	const blobPart =
		typeof contents === 'string' ? contents : new Uint8Array(contents);
	const url = URL.createObjectURL(new Blob([blobPart], { type: mimeType }));
	const link = element('a', { attributes: { href: url, download: fileName } });
	link.click();
	// The download has started by the next task; the URL is no longer needed.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
