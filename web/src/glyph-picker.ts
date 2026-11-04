import { glyphFromSvgMarkup } from '../../src/glyph';
import { createGlyphThumbnail, element } from './dom';
import {
	GLYPH_SET_LABELS,
	type GlyphSetId,
	type SourcedGlyph,
} from './editable-group';
import { loadGlyphCatalogue } from './glyph-catalogue';
import { type GlyphQuery, searchGlyphs } from './glyph-search';

// Enough to browse a theme, few enough that the grid draws instantly.
const RESULT_LIMIT = 240;

/**
 * Opens a dialog to search the built-in glyphs or upload an SVG.
 * @returns The chosen glyph, or `undefined` when the dialog is closed without a choice.
 */
export function openGlyphPicker(
	initialText: string,
): Promise<SourcedGlyph | undefined> {
	return new Promise((resolve) => {
		// Settles directly rather than only on 'close': that event is queued and never fires in a throttled background page.
		const settle = (glyph: SourcedGlyph | undefined) => {
			if (!dialog.isConnected) return;
			dialog.close();
			dialog.remove();
			resolve(glyph);
		};
		const dialog = buildPickerDialog(initialText, settle);
		dialog.addEventListener('close', () => settle(undefined));
		document.body.append(dialog);
		dialog.showModal();
	});
}

function buildPickerDialog(
	initialText: string,
	settle: (glyph: SourcedGlyph | undefined) => void,
): HTMLDialogElement {
	const searchInput = element('input', {
		attributes: {
			type: 'search',
			placeholder: 'Search glyphs: sword, potion, map…',
			'aria-label': 'Search glyphs',
			value: initialText,
		},
	});
	const setSelect = buildSetSelect();
	const status = element('p', {
		className: 'picker-status',
		text: 'Loading glyphs…',
	});
	const grid = element('div', {
		className: 'glyph-grid',
		attributes: { role: 'list' },
	});
	const uploadControl = buildUploadControl(settle, status);
	const closeButton = element('button', {
		className: 'ghost',
		text: 'Close',
		attributes: { type: 'button' },
	});
	const dialog = element('dialog', {
		className: 'glyph-picker',
		attributes: { 'aria-label': 'Choose a glyph' },
		children: [
			element('div', {
				className: 'picker-toolbar',
				children: [searchInput, setSelect, uploadControl, closeButton],
			}),
			status,
			grid,
		],
	});
	closeButton.addEventListener('click', () => settle(undefined));
	const showResults = async () => {
		const catalogue = await loadGlyphCatalogue();
		const query: GlyphQuery = {
			text: searchInput.value,
			set: readSetFilter(setSelect),
		};
		const results = searchGlyphs(catalogue, query, RESULT_LIMIT + 1);
		grid.replaceChildren(
			...results
				.slice(0, RESULT_LIMIT)
				.map((glyph) => buildGlyphTile(glyph, settle)),
		);
		status.textContent = describeResults(results.length);
	};
	searchInput.addEventListener('input', () => void showResults());
	setSelect.addEventListener('change', () => void showResults());
	void showResults();
	return dialog;
}

function buildSetSelect(): HTMLSelectElement {
	const builtInSets: GlyphSetId[] = ['game-icons', 'fa-solid', 'fa-regular'];
	return element('select', {
		attributes: { 'aria-label': 'Icon set' },
		children: [
			element('option', { text: 'All sets', attributes: { value: 'all' } }),
			...builtInSets.map((set) =>
				element('option', {
					text: GLYPH_SET_LABELS[set],
					attributes: { value: set },
				}),
			),
		],
	});
}

function buildUploadControl(
	choose: (glyph: SourcedGlyph) => void,
	status: HTMLElement,
): HTMLLabelElement {
	const fileInput = element('input', {
		className: 'visually-hidden',
		attributes: { type: 'file', accept: '.svg,image/svg+xml' },
	});
	fileInput.addEventListener('change', async () => {
		const file = fileInput.files?.[0];
		if (file === undefined) return;
		const glyphResult = glyphFromSvgMarkup(await file.text());
		fileInput.value = '';
		if (!glyphResult.ok) {
			status.textContent = `${file.name}: ${glyphResult.error.message}`;
			status.classList.add('error');
			return;
		}
		choose({
			ref: { set: 'upload', name: file.name.replace(/\.svg$/i, '') },
			glyph: glyphResult.value,
		});
	});
	return element('label', {
		className: 'button ghost',
		text: 'Upload SVG…',
		children: [fileInput],
	});
}

function buildGlyphTile(
	glyph: SourcedGlyph,
	choose: (glyph: SourcedGlyph) => void,
): HTMLButtonElement {
	const tile = element('button', {
		className: 'glyph-tile',
		attributes: {
			type: 'button',
			role: 'listitem',
			title: `${glyph.ref.name} · ${GLYPH_SET_LABELS[glyph.ref.set]}`,
		},
		children: [
			createGlyphThumbnail(glyph.glyph),
			element('span', { text: glyph.ref.name }),
		],
	});
	tile.addEventListener('click', () => choose(glyph));
	return tile;
}

function readSetFilter(setSelect: HTMLSelectElement): GlyphQuery['set'] {
	const { value } = setSelect;
	return value === 'game-icons' ||
		value === 'fa-solid' ||
		value === 'fa-regular'
		? value
		: 'all';
}

function describeResults(resultCount: number): string {
	if (resultCount === 0)
		return 'No glyphs match. Try another word, or upload an SVG.';
	if (resultCount > RESULT_LIMIT)
		return `Showing the first ${RESULT_LIMIT}. Add words to narrow it down.`;
	return `${resultCount} glyph${resultCount === 1 ? '' : 's'}`;
}
