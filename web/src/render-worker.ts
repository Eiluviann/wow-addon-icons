import type { BrushTipImage } from '../../src/brush-tip-image';
import { prepareBrushTips } from '../../src/brush-tips';
import { buildIconSvg } from '../../src/build-icon-svg';
import { renderPng } from '../../src/render-png';
import { MEDALLION_THEME } from '../../src/theme';
import type { RenderRequest, RenderResponse } from './render-protocol';
import { loadResvgWasm, RESVG_WASM_RASTERISER } from './resvg-wasm-rasteriser';

// Building an SVG traces the glyph, the slow half of a render; keep the latest few for re-exports.
const SVG_CACHE_LIMIT = 64;

let brushTips: readonly BrushTipImage[] = [];
const svgCache = new Map<string, string>();

// Only this app's own page posts here, so the message shape is the protocol's.
self.addEventListener('message', (event: MessageEvent<RenderRequest>) => {
	void answer(event.data);
});

async function answer(request: RenderRequest): Promise<void> {
	try {
		await loadResvgWasm();
		postResponse(handleRequest(request));
	} catch (error) {
		postResponse({
			kind: 'failed',
			id: request.id,
			message: error instanceof Error ? error.message : String(error),
		});
	}
}

function handleRequest(request: RenderRequest): RenderResponse {
	if (request.kind === 'set-brush') return setBrush(request);
	const svg = buildCachedSvg(request);
	return {
		kind: 'rendered',
		id: request.id,
		svg,
		pngs: request.sizes.map((size) => ({
			size,
			png: renderPng(svg, size, RESVG_WASM_RASTERISER),
		})),
	};
}

function setBrush({
	id,
	brushBytes,
}: Extract<RenderRequest, { kind: 'set-brush' }>): RenderResponse {
	svgCache.clear();
	if (brushBytes === undefined) {
		brushTips = [];
		return { kind: 'brush-set', id, tipCount: 0 };
	}
	const tipsResult = prepareBrushTips(brushBytes);
	if (!tipsResult.ok)
		return { kind: 'failed', id, message: tipsResult.error.message };
	brushTips = tipsResult.value;
	return { kind: 'brush-set', id, tipCount: brushTips.length };
}

function buildCachedSvg({
	iconKey,
	glyph,
	hue,
}: Extract<RenderRequest, { kind: 'render' }>): string {
	const cachedSvg = svgCache.get(iconKey);
	if (cachedSvg !== undefined) return cachedSvg;
	const svg = buildIconSvg(
		{ slug: 'preview', label: 'Preview', glyph, hue },
		MEDALLION_THEME,
		{ brushTips, rasteriser: RESVG_WASM_RASTERISER },
	);
	svgCache.set(iconKey, svg);
	const oldestKey = svgCache.keys().next().value;
	if (svgCache.size > SVG_CACHE_LIMIT && oldestKey !== undefined)
		svgCache.delete(oldestKey);
	return svg;
}

function postResponse(response: RenderResponse): void {
	const transfer =
		response.kind === 'rendered'
			? response.pngs.map(({ png }) => png.buffer)
			: [];
	self.postMessage(response, { transfer });
}
