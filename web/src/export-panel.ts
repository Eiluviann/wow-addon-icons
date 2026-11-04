import { DEFAULT_EXPORT_SIZES, validateExportSize } from '../../src/render-png';
import { downloadFile, element } from './dom';
import type { EditableGroup } from './editable-group';
import { buildExportZip, type ExportedIcon } from './export-bundle';
import type { RenderClient } from './render-client';

/** What the export panel reads from the app when a download starts. */
export type ExportSource = {
	renderClient: RenderClient;
	getGroups: () => readonly EditableGroup[];
	getSelectedGroup: () => EditableGroup | undefined;
	/** Explains why the set can't be exported right now, such as a duplicate slug. */
	findSetProblem: () => string | undefined;
};

/** Size checkboxes plus buttons to download the selected icon or the whole set as a zip. */
export function createExportPanel(source: ExportSource): HTMLElement {
	const sizeList = element('div', { className: 'size-list' });
	for (const size of DEFAULT_EXPORT_SIZES)
		sizeList.append(buildSizeToggle(size));
	const status = element('p', { className: 'export-status' });
	const customSizeInput = element('input', {
		attributes: {
			type: 'number',
			min: '150',
			step: '1',
			placeholder: 'Custom px',
			'aria-label': 'Custom size in pixels',
		},
	});
	const addSizeButton = element('button', {
		className: 'ghost',
		text: 'Add',
		attributes: { type: 'button' },
	});
	addSizeButton.addEventListener('click', () => {
		const sizeResult = validateExportSize(customSizeInput.valueAsNumber);
		status.classList.toggle('error', !sizeResult.ok);
		if (!sizeResult.ok) {
			status.textContent = sizeResult.error.message;
			return;
		}
		status.textContent = '';
		customSizeInput.value = '';
		if (!readSizes(sizeList).includes(sizeResult.value))
			sizeList.append(buildSizeToggle(sizeResult.value));
	});
	const downloadSelectedButton = element('button', {
		text: 'Download selected',
		attributes: { type: 'button' },
	});
	const downloadAllButton = element('button', {
		className: 'primary',
		text: 'Download all (.zip)',
		attributes: { type: 'button' },
	});
	const runExport = async (scope: 'selected' | 'all') => {
		const problem = findExportProblem(source, readSizes(sizeList), scope);
		status.classList.toggle('error', problem !== undefined);
		if (problem !== undefined) {
			status.textContent = problem;
			return;
		}
		status.textContent = 'Rendering…';
		try {
			await exportIcons(source, readSizes(sizeList), scope);
			status.textContent = '';
		} catch (error) {
			status.classList.add('error');
			status.textContent =
				error instanceof Error ? error.message : String(error);
		}
	};
	downloadSelectedButton.addEventListener(
		'click',
		() => void runExport('selected'),
	);
	downloadAllButton.addEventListener('click', () => void runExport('all'));
	return element('section', {
		className: 'panel export-panel',
		children: [
			element('h2', { text: 'Export' }),
			sizeList,
			element('div', {
				className: 'row',
				children: [customSizeInput, addSizeButton],
			}),
			element('div', {
				className: 'stack',
				children: [downloadSelectedButton, downloadAllButton],
			}),
			status,
		],
	});
}

async function exportIcons(
	source: ExportSource,
	sizes: readonly number[],
	scope: 'selected' | 'all',
): Promise<void> {
	const selectedGroup = source.getSelectedGroup();
	const groups =
		scope === 'all' || selectedGroup === undefined
			? source.getGroups()
			: [selectedGroup];
	const icons = await Promise.all(
		groups.map((group) =>
			renderExportedIcon(source.renderClient, group, sizes),
		),
	);
	const [onlyIcon] = icons;
	const [onlySize] = sizes;
	if (
		icons.length === 1 &&
		sizes.length === 1 &&
		onlyIcon !== undefined &&
		onlySize !== undefined
	) {
		downloadFile(
			`${onlyIcon.slug}-${onlySize}.png`,
			onlyIcon.pngs[0]?.png ?? new Uint8Array(),
			'image/png',
		);
		return;
	}
	const zipName =
		scope === 'all' ? 'addon-icons.zip' : `${onlyIcon?.slug ?? 'icon'}.zip`;
	downloadFile(zipName, buildExportZip(icons), 'application/zip');
}

async function renderExportedIcon(
	renderClient: RenderClient,
	group: EditableGroup,
	sizes: readonly number[],
): Promise<ExportedIcon> {
	const { svg, pngs } = await renderClient.renderIcon(
		{ glyph: group.glyph.glyph, hue: group.hue },
		sizes,
	);
	return { slug: group.slug, svg, pngs };
}

function findExportProblem(
	source: ExportSource,
	sizes: readonly number[],
	scope: 'selected' | 'all',
): string | undefined {
	if (sizes.length === 0) return 'Pick at least one size.';
	if (scope === 'selected' && source.getSelectedGroup() === undefined)
		return 'Select an icon first.';
	if (source.getGroups().length === 0) return 'Add an icon first.';
	return source.findSetProblem();
}

function buildSizeToggle(size: number): HTMLLabelElement {
	return element('label', {
		className: 'size-toggle',
		children: [
			element('input', {
				attributes: { type: 'checkbox', value: String(size), checked: '' },
			}),
			element('span', { text: `${size} px` }),
		],
	});
}

function readSizes(sizeList: HTMLElement): number[] {
	return [...sizeList.querySelectorAll<HTMLInputElement>('input:checked')]
		.map((checkbox) => Number(checkbox.value))
		.sort((first, second) => first - second);
}
