import { validateIconGroups } from '../../src/icon-group';
import { createBrushPanel } from './brush-panel';
import { createGlyphThumbnail, downloadFile, element } from './dom';
import {
	createGroupId,
	type EditableGroup,
	GLYPH_SET_LABELS,
	slugify,
} from './editable-group';
import { createExportPanel } from './export-panel';
import { loadGlyphCatalogue } from './glyph-catalogue';
import { openGlyphPicker } from './glyph-picker';
import {
	loadStoredGroups,
	parseGroupSet,
	serialiseGroupSet,
	storeGroups,
} from './group-store';
import { buildIconKey, RenderClient } from './render-client';
import { buildSampleGroups, findGlyph } from './sample-groups';
import './styles.css';

type AppState = { groups: EditableGroup[]; selectedId: string | undefined };

// Long enough to let a hue drag settle, short enough to feel live.
const PREVIEW_DEBOUNCE_MS = 140;
const PREVIEW_SIZE = 512;
const THUMBNAIL_SIZE = 150;

const renderClient = new RenderClient();
const state: AppState = { groups: [], selectedId: undefined };
const groupList = element('ul', { className: 'group-list' });
const editor = element('section', { className: 'panel editor' });
const setMessage = element('p', { className: 'set-message' });
let previewTimer: ReturnType<typeof setTimeout> | undefined;

await startApp();

async function startApp(): Promise<void> {
	const app = document.getElementById('app');
	if (app === null) throw new Error('The page has no #app element');
	app.replaceChildren(buildLayout());
	editor.replaceChildren(
		element('p', { className: 'muted', text: 'Loading glyphs…' }),
	);
	state.groups =
		loadStoredGroups() ?? buildSampleGroups(await loadGlyphCatalogue());
	state.selectedId = state.groups[0]?.id;
	renderGroupList();
	renderEditor();
	refreshPreviews();
}

function buildLayout(): HTMLElement {
	return element('div', {
		className: 'shell',
		children: [
			element('header', {
				className: 'app-header',
				children: [
					element('h1', { text: 'WoW Addon Icons' }),
					createBrushPanel(renderClient, refreshPreviews),
				],
			}),
			element('main', {
				className: 'workspace',
				children: [buildGroupPanel(), editor, buildExportColumn()],
			}),
			buildFooter(),
		],
	});
}

function buildGroupPanel(): HTMLElement {
	const addButton = buildButton('Add icon', () => void addGroup(), 'primary');
	const saveSetButton = buildButton('Save set', saveSetFile, 'ghost');
	const openSetInput = element('input', {
		className: 'visually-hidden',
		attributes: { type: 'file', accept: '.json,application/json' },
	});
	openSetInput.addEventListener('change', () => {
		const file = openSetInput.files?.[0];
		openSetInput.value = '';
		if (file !== undefined) void openSetFile(file);
	});
	return element('section', {
		className: 'panel groups',
		children: [
			element('h2', { text: 'Icons' }),
			groupList,
			addButton,
			element('div', {
				className: 'row',
				children: [
					saveSetButton,
					element('label', {
						className: 'button ghost',
						text: 'Open set…',
						children: [openSetInput],
					}),
				],
			}),
			setMessage,
		],
	});
}

function buildExportColumn(): HTMLElement {
	return createExportPanel({
		renderClient,
		getGroups: () => state.groups,
		getSelectedGroup: findSelectedGroup,
		findSetProblem: () => findSlugProblem(state.groups),
	});
}

function buildFooter(): HTMLElement {
	const link = (href: string, text: string) =>
		element('a', { text, attributes: { href, rel: 'noopener' } });
	return element('footer', {
		className: 'app-footer',
		children: [
			element('p', {
				children: [
					document.createTextNode('Glyphs from '),
					link('https://game-icons.net', 'game-icons.net'),
					document.createTextNode(
						' by Lorc, Delapouite and contributors (CC BY 3.0) and ',
					),
					link('https://fontawesome.com', 'Font Awesome Free'),
					document.createTextNode(
						' (CC BY 4.0). Credit them where you publish icons; every zip includes CREDITS.txt.',
					),
				],
			}),
			element('p', {
				text: 'Everything runs in your browser: brushes, uploads and icon sets are never sent anywhere.',
			}),
		],
	});
}

function renderGroupList(): void {
	groupList.replaceChildren(...state.groups.map(buildGroupRow));
}

function buildGroupRow(group: EditableGroup): HTMLLIElement {
	const isSelected = group.id === state.selectedId;
	const thumbnail = element('img', {
		attributes: {
			alt: '',
			width: '48',
			height: '48',
			'data-group-id': group.id,
		},
	});
	const button = element('button', {
		className: 'group-row',
		attributes: { type: 'button', 'aria-pressed': String(isSelected) },
		children: [
			thumbnail,
			element('span', {
				className: 'group-text',
				children: [
					element('strong', { text: group.label }),
					element('small', { text: group.slug }),
				],
			}),
		],
	});
	button.addEventListener('click', () => selectGroup(group.id));
	return element('li', { children: [button] });
}

function renderEditor(): void {
	const group = findSelectedGroup();
	if (group === undefined) {
		editor.replaceChildren(
			element('p', { className: 'muted', text: 'Add an icon to start.' }),
		);
		return;
	}
	editor.replaceChildren(
		element('div', {
			className: 'preview-frame',
			children: [
				element('img', {
					className: 'preview',
					attributes: {
						alt: `${group.label} icon preview`,
						width: String(PREVIEW_SIZE),
						height: String(PREVIEW_SIZE),
					},
				}),
			],
		}),
		buildEditorFields(group),
	);
}

function buildEditorFields(group: EditableGroup): HTMLElement {
	const labelInput = element('input', {
		attributes: { type: 'text', value: group.label },
	});
	const slugInput = element('input', {
		attributes: { type: 'text', value: group.slug, spellcheck: 'false' },
	});
	const slugError = element('small', { className: 'field-error' });
	const hueRange = element('input', {
		attributes: {
			type: 'range',
			min: '0',
			max: '360',
			step: '1',
			value: String(group.hue),
		},
	});
	const hueNumber = element('input', {
		className: 'hue-number',
		attributes: {
			type: 'number',
			min: '0',
			max: '360',
			step: '1',
			value: String(group.hue),
			'aria-label': 'Hue in degrees',
		},
	});
	const showSlugProblem = () => {
		slugError.textContent = findSlugProblem(state.groups) ?? '';
	};
	labelInput.addEventListener('input', () => {
		const isSlugFollowingLabel = group.slug === slugify(group.label);
		const changes = isSlugFollowingLabel
			? { label: labelInput.value, slug: slugify(labelInput.value) }
			: { label: labelInput.value };
		updateSelectedGroup(changes);
		slugInput.value = findSelectedGroup()?.slug ?? slugInput.value;
		showSlugProblem();
	});
	slugInput.addEventListener('input', () => {
		updateSelectedGroup({ slug: slugInput.value.trim() });
		showSlugProblem();
	});
	const setHue = (hue: number) => {
		if (!(hue >= 0 && hue <= 360)) return;
		hueRange.value = String(hue);
		hueNumber.value = String(hue);
		updateSelectedGroup({ hue });
	};
	hueRange.addEventListener('input', () => setHue(hueRange.valueAsNumber));
	hueNumber.addEventListener('input', () => setHue(hueNumber.valueAsNumber));
	hueRange.style.setProperty('--hue', String(group.hue));
	hueRange.addEventListener('input', () =>
		hueRange.style.setProperty('--hue', hueRange.value),
	);
	showSlugProblem();
	return element('div', {
		className: 'fields',
		children: [
			buildField('Name', labelInput),
			buildField('File name', slugInput, slugError),
			buildField(
				'Hue',
				element('div', { className: 'row', children: [hueRange, hueNumber] }),
			),
			buildField('Glyph', buildGlyphButton(group)),
			element('div', {
				className: 'row',
				children: [
					buildButton('Duplicate', duplicateSelectedGroup, 'ghost'),
					buildButton('Delete', deleteSelectedGroup, 'ghost danger'),
				],
			}),
		],
	});
}

function buildGlyphButton(group: EditableGroup): HTMLButtonElement {
	const button = element('button', {
		className: 'glyph-button',
		attributes: { type: 'button' },
		children: [
			createGlyphThumbnail(group.glyph.glyph),
			element('span', {
				className: 'group-text',
				children: [
					element('strong', { text: group.glyph.ref.name }),
					element('small', {
						text: `${GLYPH_SET_LABELS[group.glyph.ref.set]} · change…`,
					}),
				],
			}),
		],
	});
	button.addEventListener('click', async () => {
		const searchText =
			group.glyph.ref.set === 'upload' ? '' : group.glyph.ref.name;
		const chosenGlyph = await openGlyphPicker(searchText);
		if (chosenGlyph === undefined) return;
		updateSelectedGroup({ glyph: chosenGlyph });
		renderEditor();
		refreshPreviews();
	});
	return button;
}

function buildField(
	label: string,
	control: HTMLElement,
	hint?: HTMLElement,
): HTMLLabelElement {
	return element('label', {
		className: 'field',
		children: [
			element('span', { className: 'label', text: label }),
			control,
			hint,
		],
	});
}

function buildButton(
	text: string,
	onClick: () => void,
	className: string,
): HTMLButtonElement {
	const button = element('button', {
		className,
		text,
		attributes: { type: 'button' },
	});
	button.addEventListener('click', onClick);
	return button;
}

function selectGroup(groupId: string): void {
	state.selectedId = groupId;
	renderGroupList();
	renderEditor();
	refreshPreviews();
}

function updateSelectedGroup(
	changes: Partial<Omit<EditableGroup, 'id'>>,
): void {
	state.groups = state.groups.map((group) =>
		group.id === state.selectedId ? { ...group, ...changes } : group,
	);
	storeGroups(state.groups);
	updateSelectedRowText();
	schedulePreviewRefresh();
}

function updateSelectedRowText(): void {
	const group = findSelectedGroup();
	const row = groupList.querySelector('[aria-pressed="true"]');
	if (group === undefined || row === null) return;
	const [label, slug] = row.querySelectorAll('strong, small');
	if (label !== undefined) label.textContent = group.label;
	if (slug !== undefined) slug.textContent = group.slug;
}

async function addGroup(): Promise<void> {
	const catalogue = await loadGlyphCatalogue();
	const glyph =
		findGlyph(catalogue, { set: 'game-icons', name: 'crossed-swords' }) ??
		catalogue[0];
	if (glyph === undefined) throw new Error('The glyph catalogue is empty');
	const label = 'New icon';
	insertGroup({
		id: createGroupId(),
		label,
		slug: pickFreeSlug(slugify(label), state.groups),
		hue: Math.floor(Math.random() * 360),
		glyph,
	});
}

function duplicateSelectedGroup(): void {
	const group = findSelectedGroup();
	if (group === undefined) return;
	insertGroup({
		...group,
		id: createGroupId(),
		label: `${group.label} copy`,
		slug: pickFreeSlug(`${group.slug}-copy`, state.groups),
	});
}

function deleteSelectedGroup(): void {
	const index = state.groups.findIndex(
		(group) => group.id === state.selectedId,
	);
	state.groups = state.groups.filter((group) => group.id !== state.selectedId);
	state.selectedId = (state.groups[index] ?? state.groups[index - 1])?.id;
	storeGroups(state.groups);
	selectGroupOrNothing();
}

function insertGroup(group: EditableGroup): void {
	const index = state.groups.findIndex(({ id }) => id === state.selectedId);
	state.groups = [
		...state.groups.slice(0, index + 1),
		group,
		...state.groups.slice(index + 1),
	];
	storeGroups(state.groups);
	selectGroup(group.id);
}

function selectGroupOrNothing(): void {
	if (state.selectedId !== undefined) {
		selectGroup(state.selectedId);
		return;
	}
	renderGroupList();
	renderEditor();
}

function saveSetFile(): void {
	downloadFile(
		'addon-icon-set.json',
		serialiseGroupSet(state.groups),
		'application/json',
	);
}

async function openSetFile(file: File): Promise<void> {
	const groupsResult = parseGroupSet(await file.text());
	setMessage.classList.toggle('error', !groupsResult.ok);
	if (!groupsResult.ok) {
		setMessage.textContent = `${file.name}: ${groupsResult.error.message}`;
		return;
	}
	setMessage.textContent = `Opened ${file.name}.`;
	state.groups = groupsResult.value;
	state.selectedId = state.groups[0]?.id;
	storeGroups(state.groups);
	selectGroupOrNothing();
}

function schedulePreviewRefresh(): void {
	clearTimeout(previewTimer);
	previewTimer = setTimeout(refreshPreviews, PREVIEW_DEBOUNCE_MS);
}

// Results can arrive after the viewer has moved on; each image only takes the look it still shows.
function refreshPreviews(): void {
	const selectedGroup = findSelectedGroup();
	const preview = editor.querySelector<HTMLImageElement>('img.preview');
	if (selectedGroup !== undefined && preview !== null)
		showRenderedPng(preview, selectedGroup, PREVIEW_SIZE, findSelectedGroup);
	for (const thumbnail of groupList.querySelectorAll<HTMLImageElement>(
		'img[data-group-id]',
	)) {
		const findGroup = () =>
			state.groups.find(({ id }) => id === thumbnail.dataset.groupId);
		const group = findGroup();
		if (group !== undefined)
			showRenderedPng(thumbnail, group, THUMBNAIL_SIZE, findGroup);
	}
}

function showRenderedPng(
	image: HTMLImageElement,
	group: EditableGroup,
	size: number,
	findCurrentGroup: () => EditableGroup | undefined,
): void {
	const look = { glyph: group.glyph.glyph, hue: group.hue };
	const iconKey = buildIconKey(look);
	image.classList.add('is-rendering');
	renderClient
		.renderPngUrl(look, size)
		.then((url) => {
			const currentGroup = findCurrentGroup();
			const isStillCurrent =
				currentGroup !== undefined &&
				buildIconKey({
					glyph: currentGroup.glyph.glyph,
					hue: currentGroup.hue,
				}) === iconKey;
			if (!isStillCurrent) return;
			image.src = url;
			image.classList.remove('is-rendering');
		})
		.catch((error: unknown) => {
			image.classList.remove('is-rendering');
			image.title = error instanceof Error ? error.message : String(error);
		});
}

function findSelectedGroup(): EditableGroup | undefined {
	return state.groups.find((group) => group.id === state.selectedId);
}

function findSlugProblem(groups: readonly EditableGroup[]): string | undefined {
	const slugsResult = validateIconGroups(
		groups.map((group) => ({ ...group, glyph: group.glyph.glyph })),
	);
	return slugsResult.ok ? undefined : slugsResult.error.message;
}

function pickFreeSlug(
	baseSlug: string,
	groups: readonly EditableGroup[],
): string {
	const takenSlugs = new Set(groups.map(({ slug }) => slug));
	let candidate = baseSlug;
	for (let suffix = 2; takenSlugs.has(candidate); suffix++)
		candidate = `${baseSlug}-${suffix}`;
	return candidate;
}
