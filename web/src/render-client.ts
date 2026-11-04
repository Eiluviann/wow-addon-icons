import type { Glyph } from '../../src/glyph';
import { fail, type Result, succeed } from '../../src/result';
import type {
	RenderedIcon,
	RenderRequest,
	RenderResponse,
} from './render-protocol';

/** What the worker needs to paint one icon. */
export type IconLook = { glyph: Glyph; hue: number };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
	? Omit<T, K>
	: never;

type PendingRequest = {
	resolve: (response: RenderResponse) => void;
};

/**
 * Talks to the render worker and caches what it paints, so the preview strip, the large
 * preview and exports never render the same icon at the same size twice.
 */
export class RenderClient {
	#worker = new Worker(new URL('./render-worker.ts', import.meta.url), {
		type: 'module',
	});
	#nextRequestId = 1;
	#pendingRequests = new Map<number, PendingRequest>();
	#pngCache = new Map<string, Promise<Uint8Array>>();
	#svgCache = new Map<string, Promise<string>>();
	#pngUrlCache = new Map<string, Promise<string>>();
	#brushVersion = 0;

	constructor() {
		this.#worker.addEventListener(
			'message',
			(event: MessageEvent<RenderResponse>) => {
				const pendingRequest = this.#pendingRequests.get(event.data.id);
				this.#pendingRequests.delete(event.data.id);
				pendingRequest?.resolve(event.data);
			},
		);
	}

	/**
	 * Paints with the tips of a Photoshop `.abr` file from now on, or the built-in brush when
	 * `brushBytes` is undefined.
	 * @returns How many tips the brush has, or why the file could not be used.
	 */
	async setBrush(brushBytes: Uint8Array | undefined): Promise<Result<number>> {
		const response = await this.#send({ kind: 'set-brush', brushBytes });
		if (response.kind === 'failed') return fail(new Error(response.message));
		if (response.kind !== 'brush-set')
			throw new Error(`Unexpected ${response.kind} answer to set-brush`);
		this.#clearCaches();
		return succeed(response.tipCount);
	}

	/** An object URL of the icon's PNG, kept until the brush changes. */
	renderPngUrl(look: IconLook, size: number): Promise<string> {
		const cacheKey = `${buildIconKey(look)}@${size}`;
		const cachedUrl = this.#pngUrlCache.get(cacheKey);
		if (cachedUrl !== undefined) return cachedUrl;
		const url = this.renderPng(look, size).then((png) =>
			URL.createObjectURL(
				new Blob([new Uint8Array(png)], { type: 'image/png' }),
			),
		);
		this.#pngUrlCache.set(cacheKey, url);
		return url;
	}

	/** The icon's SVG and a PNG for each size, for exporting. */
	async renderIcon(
		look: IconLook,
		sizes: readonly number[],
	): Promise<RenderedIcon> {
		const [svg, ...pngs] = await Promise.all([
			this.#renderSvg(look),
			...sizes.map((size) => this.renderPng(look, size)),
		]);
		return {
			svg,
			pngs: sizes.map((size, index) => ({
				size,
				png: pngs[index] ?? new Uint8Array(),
			})),
		};
	}

	/** One PNG of the icon at `size` pixels. */
	renderPng(look: IconLook, size: number): Promise<Uint8Array> {
		const cacheKey = `${buildIconKey(look)}@${size}`;
		const cachedPng = this.#pngCache.get(cacheKey);
		if (cachedPng !== undefined) return cachedPng;
		const png = this.#renderSizes(look, [size]).then(
			(icon) => icon.pngs[0]?.png ?? new Uint8Array(),
		);
		this.#cacheUnlessFailed(this.#pngCache, cacheKey, png);
		return png;
	}

	#renderSvg(look: IconLook): Promise<string> {
		const iconKey = buildIconKey(look);
		const cachedSvg = this.#svgCache.get(iconKey);
		if (cachedSvg !== undefined) return cachedSvg;
		const svg = this.#renderSizes(look, []).then((icon) => icon.svg);
		this.#cacheUnlessFailed(this.#svgCache, iconKey, svg);
		return svg;
	}

	async #renderSizes(
		look: IconLook,
		sizes: readonly number[],
	): Promise<RenderedIcon> {
		const response = await this.#send({
			kind: 'render',
			iconKey: buildIconKey(look),
			glyph: look.glyph,
			hue: look.hue,
			sizes,
		});
		if (response.kind === 'failed') throw new Error(response.message);
		if (response.kind !== 'rendered')
			throw new Error(`Unexpected ${response.kind} answer to render`);
		return response;
	}

	#send(
		request: DistributiveOmit<RenderRequest, 'id'>,
	): Promise<RenderResponse> {
		const id = this.#nextRequestId++;
		return new Promise((resolve) => {
			this.#pendingRequests.set(id, { resolve });
			this.#worker.postMessage({ ...request, id });
		});
	}

	#cacheUnlessFailed<T>(
		cache: Map<string, Promise<T>>,
		cacheKey: string,
		value: Promise<T>,
	): void {
		const brushVersion = this.#brushVersion;
		cache.set(cacheKey, value);
		value.catch(() => {
			if (brushVersion === this.#brushVersion) cache.delete(cacheKey);
		});
	}

	#clearCaches(): void {
		this.#brushVersion++;
		for (const url of this.#pngUrlCache.values())
			void url.then(URL.revokeObjectURL);
		this.#pngUrlCache.clear();
		this.#pngCache.clear();
		this.#svgCache.clear();
	}
}

/** A short key for a glyph and hue: the same look always gets the same key. */
export function buildIconKey({ glyph, hue }: IconLook): string {
	const text = `${Math.round(hue)}|${glyph.width}x${glyph.height}|${glyph.paths.join('|')}`;
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index++) {
		hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
	}
	return `${(hash >>> 0).toString(36)}-${text.length.toString(36)}`;
}
