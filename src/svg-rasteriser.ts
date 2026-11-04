/** Turns SVG markup into pixels; the CLI and the web app each supply their own resvg build. */
export type SvgRasteriser = {
	/** RGBA bytes, row by row, of the SVG rendered `width` pixels wide. */
	renderRgba(svg: string, width: number): Uint8Array;
	/** A PNG of the SVG rendered `width` pixels wide. */
	renderPng(svg: string, width: number): Uint8Array;
};
