import { Vector3 } from 'three';
import type { Stage } from '../stage';

interface Label {
  element: HTMLDivElement;
  anchor: Vector3;
  opacity: number;
}

const LABEL_STYLE =
  'position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;font-size:12px;line-height:1.35;' +
  'padding:4px 8px;border-radius:6px;background:rgba(13,26,20,0.9);color:#e6eee9;' +
  'border:1px solid rgba(255,255,255,0.12);transition:opacity 240ms ease;will-change:transform;';

/**
 * Text chips pinned to points in the scene. They are plain DOM nodes moved each frame,
 * so text stays crisp and translatable. Text is set with textContent, never as HTML.
 */
export function createLabelLayer(container: HTMLElement, stage: Stage) {
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  container.appendChild(layer);
  const labels = new Map<string, Label>();

  const position = () => {
    for (const label of labels.values()) {
      const { x, y, visible } = stage.project(label.anchor);
      label.element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      label.element.style.opacity = visible ? String(label.opacity) : '0';
    }
  };
  stage.onFrame(position);

  return {
    /** Adds or updates a chip. Several lines render as a small card, the first line in medium weight. */
    set(id: string, lines: string[], anchor: [number, number, number], opacity = 1) {
      let label = labels.get(id);
      if (!label) {
        const element = document.createElement('div');
        element.style.cssText = LABEL_STYLE;
        layer.appendChild(element);
        label = { element, anchor: new Vector3(), opacity };
        labels.set(id, label);
      }
      label.anchor.set(...anchor);
      label.opacity = opacity;
      if (label.element.dataset.text !== lines.join('\n')) {
        label.element.dataset.text = lines.join('\n');
        label.element.replaceChildren(
          ...lines.map((line, index) => {
            const row = document.createElement('div');
            row.textContent = line;
            if (index === 0 && lines.length > 1) row.style.fontWeight = '500';
            else if (lines.length > 1) row.style.color = '#c5d3cb';
            return row;
          })
        );
      }
    },
    setOpacity(id: string, opacity: number) {
      const label = labels.get(id);
      if (label) label.opacity = opacity;
    },
    position,
    dispose() {
      layer.remove();
      labels.clear();
    },
  };
}

export type LabelLayer = ReturnType<typeof createLabelLayer>;
