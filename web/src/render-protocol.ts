import type { Glyph } from '../../src/glyph';

/** Messages the page sends to the render worker; every one carries an id its answer echoes. */
export type RenderRequest =
	| { kind: 'set-brush'; id: number; brushBytes: Uint8Array | undefined }
	| {
			kind: 'render';
			id: number;
			/** Identifies this glyph and hue, so the worker can reuse the SVG it built for them. */
			iconKey: string;
			glyph: Glyph;
			hue: number;
			sizes: readonly number[];
	  };

/** A rendered icon: its SVG document and one PNG per requested size. */
export type RenderedIcon = {
	svg: string;
	pngs: readonly { size: number; png: Uint8Array }[];
};

/** Messages the render worker sends back. */
export type RenderResponse =
	| { kind: 'brush-set'; id: number; tipCount: number }
	| ({ kind: 'rendered'; id: number } & RenderedIcon)
	| { kind: 'failed'; id: number; message: string };
