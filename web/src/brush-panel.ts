import { element } from './dom';
import type { RenderClient } from './render-client';

/**
 * The brush picker: the built-in procedural brush by default, or the tips of a Photoshop
 * `.abr` file the viewer loads. The file is read in the browser and never leaves it.
 * @param onBrushChanged - Called after a new brush is in use, so previews can repaint.
 */
export function createBrushPanel(
	renderClient: RenderClient,
	onBrushChanged: () => void,
): HTMLElement {
	const status = element('span', {
		className: 'brush-status',
		text: 'Built-in brush',
	});
	const fileInput = element('input', {
		className: 'visually-hidden',
		attributes: { type: 'file', accept: '.abr' },
	});
	const resetButton = element('button', {
		className: 'ghost',
		text: 'Use built-in',
		attributes: { type: 'button', hidden: '' },
	});
	const useBrush = async (file: File | undefined) => {
		status.classList.remove('error');
		status.textContent =
			file === undefined ? 'Switching brush…' : `Reading ${file.name}…`;
		const brushBytes =
			file === undefined ? undefined : new Uint8Array(await file.arrayBuffer());
		const tipCountResult = await renderClient.setBrush(brushBytes);
		if (!tipCountResult.ok) {
			status.textContent = `${file?.name ?? 'Brush'}: ${tipCountResult.error.message}`;
			status.classList.add('error');
			return;
		}
		status.textContent =
			file === undefined
				? 'Built-in brush'
				: `${file.name} · ${tipCountResult.value} tips`;
		resetButton.hidden = file === undefined;
		onBrushChanged();
	};
	fileInput.addEventListener('change', () => {
		const file = fileInput.files?.[0];
		fileInput.value = '';
		if (file !== undefined) void useBrush(file);
	});
	resetButton.addEventListener('click', () => void useBrush(undefined));
	return element('div', {
		className: 'brush-panel',
		attributes: {
			title: 'Brush files are read in your browser and never uploaded.',
		},
		children: [
			element('span', { className: 'label', text: 'Brush' }),
			status,
			element('label', {
				className: 'button ghost',
				text: 'Load .abr…',
				children: [fileInput],
			}),
			resetButton,
		],
	});
}
