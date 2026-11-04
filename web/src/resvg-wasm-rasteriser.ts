import { initWasm, Resvg } from '@resvg/resvg-wasm';
import wasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url';
import type { SvgRasteriser } from '../../src/svg-rasteriser';

type RenderedImage = ReturnType<InstanceType<typeof Resvg>['render']>;

let wasmReady: Promise<void> | undefined;

/** Loads the resvg WebAssembly module once; await it before using `RESVG_WASM_RASTERISER`. */
export function loadResvgWasm(): Promise<void> {
	wasmReady ??= initWasm(fetch(wasmUrl));
	return wasmReady;
}

/** The browser counterpart of the CLI's resvg-js rasteriser, rendering the same pixels. */
export const RESVG_WASM_RASTERISER: SvgRasteriser = {
	renderRgba: (svg, width) => renderWith(svg, width, (image) => image.pixels),
	renderPng: (svg, width) => renderWith(svg, width, (image) => image.asPng()),
};

// wasm-bindgen objects live outside the JS heap, so both must be freed by hand.
function renderWith(
	svg: string,
	width: number,
	readImage: (image: RenderedImage) => Uint8Array,
): Uint8Array {
	const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } });
	const image = resvg.render();
	try {
		return readImage(image);
	} finally {
		image.free();
		resvg.free();
	}
}
