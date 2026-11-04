import { Resvg } from '@resvg/resvg-js';
import type { SvgRasteriser } from './svg-rasteriser';

/** Native resvg for the CLI and tests. */
export const RESVG_NODE_RASTERISER: SvgRasteriser = {
	renderRgba: (svg, width) =>
		// `pixels` copies the whole buffer on every read, so read it once.
		new Uint8Array(renderImage(svg, width).pixels),
	renderPng: (svg, width) => new Uint8Array(renderImage(svg, width).asPng()),
};

function renderImage(svg: string, width: number) {
	return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render();
}
