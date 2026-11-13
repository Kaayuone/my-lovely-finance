// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeFieldOverlay,
  closeTopOverlay,
  isOverlayOpen,
} from '@/services/hardwareBack/overlayBack';

// The markup PrimeVue renders: the field in the form, its overlay portalled into body
function renderDateField(panelId: string) {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<span class="p-datepicker"><input aria-controls="${panelId}" /></span>`,
  );
  const input = document.body.lastElementChild?.querySelector('input');
  if (!input) throw new Error('Date input was not rendered');
  return input;
}

function renderOverlay(className: string, id = '') {
  const overlay = document.createElement('div');
  overlay.className = className;
  overlay.id = id;
  document.body.append(overlay);
  return overlay;
}

// What the calendar does on Escape: focus back to its input, the panel gone
function closeLikeDatePicker(panel: HTMLElement, input: HTMLInputElement) {
  panel.addEventListener('keydown', event => {
    if (event.code !== 'Escape') return;
    input.focus();
    panel.remove();
    event.stopPropagation();
  });
}

describe('overlayBack', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('isOverlayOpen', () => {
    it('is false while no overlay is open', () => {
      expect(isOverlayOpen()).toBe(false);
    });

    it.each(['p-select-overlay', 'p-datepicker-panel'])('is true with an open %s', className => {
      renderOverlay(className);

      expect(isOverlayOpen()).toBe(true);
    });

    it('ignores an inline calendar, which is part of the page', () => {
      renderOverlay('p-datepicker-panel p-datepicker-panel-inline');

      expect(isOverlayOpen()).toBe(false);
    });

    it('ignores an overlay already playing its leave transition', () => {
      renderOverlay('p-select-overlay p-anchored-overlay-leave-active');

      expect(isOverlayOpen()).toBe(false);
    });
  });

  describe('closeTopOverlay', () => {
    // Two overlays open at once do not occur in practice (see closeTopOverlay); should they, only
    // the one last in the DOM gets the Escape
    it('sends Escape to the overlay last in the DOM only', () => {
      const firstKeydown = vi.fn();
      const lastKeydown = vi.fn<(event: KeyboardEvent) => void>();
      renderOverlay('p-select-overlay').addEventListener('keydown', firstKeydown);
      renderOverlay('p-datepicker-panel').addEventListener('keydown', lastKeydown);

      closeTopOverlay();

      expect(firstKeydown).not.toHaveBeenCalled();
      expect(lastKeydown).toHaveBeenCalledOnce();
      const event = lastKeydown.mock.calls[0]?.[0];
      expect(event?.code).toBe('Escape');
      expect(event?.key).toBe('Escape');
      expect(event?.bubbles).toBe(true);
    });

    it('does nothing while no overlay is open', () => {
      const documentKeydown = vi.fn();
      document.addEventListener('keydown', documentKeydown);

      closeTopOverlay();

      document.removeEventListener('keydown', documentKeydown);
      expect(documentKeydown).not.toHaveBeenCalled();
    });

    it('takes the focus away from the input the calendar hands it back to', () => {
      const input = renderDateField('date_panel');
      closeLikeDatePicker(renderOverlay('p-datepicker-panel', 'date_panel'), input);

      closeTopOverlay();

      expect(document.querySelector('.p-datepicker-panel')).toBeNull();
      expect(document.activeElement).not.toBe(input);
    });

    // Only the moment of the press: the real Select hands focus back to its combobox a tick later,
    // and a combobox raises no keyboard
    it('finds the field of a select through the list inside its overlay', () => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div class="p-select"><span tabindex="0" aria-controls="currency_list"></span></div>',
      );
      const select = document.querySelector<HTMLElement>('.p-select span');
      renderOverlay('p-select-overlay').innerHTML = '<ul id="currency_list"></ul>';
      select?.focus();

      closeTopOverlay();

      expect(document.activeElement).not.toBe(select);
    });

    it('leaves the focus alone outside the field of the overlay', () => {
      const otherInput = renderDateField('other_panel');
      renderDateField('date_panel');
      renderOverlay('p-datepicker-panel', 'date_panel');
      otherInput.focus();

      closeTopOverlay();

      expect(document.activeElement).toBe(otherInput);
    });
  });

  describe('closeFieldOverlay', () => {
    it.each(['panel', 'input'])(
      'prevents focus from scrolling the container when focus starts in the %s',
      focused => {
        const input = renderDateField('date_panel');
        const panel = renderOverlay('p-datepicker-panel', 'date_panel');
        const day = document.createElement('button');
        panel.append(day);
        if (focused === 'panel') day.focus();
        else input.focus();
        const focus = vi.spyOn(input, 'focus');
        const focusAtEscape = vi.fn();
        panel.addEventListener('keydown', () => focusAtEscape(document.activeElement));
        closeLikeDatePicker(panel, input);

        closeFieldOverlay(input);

        expect(focusAtEscape).toHaveBeenCalledExactlyOnceWith(input);
        expect(focus.mock.calls).toEqual(
          focused === 'panel' ? [[{ preventScroll: true }], []] : [[]],
        );
        expect(panel.isConnected).toBe(false);
        expect(document.activeElement).not.toBe(input);
      },
    );

    it('closes and blurs only the calendar controlled by the given field', () => {
      const input = renderDateField('date_panel');
      closeLikeDatePicker(renderOverlay('p-datepicker-panel', 'date_panel'), input);
      const otherKeydown = vi.fn();
      const otherPanel = renderOverlay('p-select-overlay');
      otherPanel.addEventListener('keydown', otherKeydown);

      closeFieldOverlay(input);

      expect(document.getElementById('date_panel')).toBeNull();
      expect(document.activeElement).not.toBe(input);
      expect(otherPanel.isConnected).toBe(true);
      expect(otherKeydown).not.toHaveBeenCalled();
    });

    it.each([null, undefined])('does nothing when the field is %s', field => {
      const keydown = vi.fn();
      renderOverlay('p-datepicker-panel').addEventListener('keydown', keydown);

      closeFieldOverlay(field);

      expect(keydown).not.toHaveBeenCalled();
    });

    it('does nothing when the field has no aria-controls', () => {
      const input = renderDateField('date_panel');
      input.removeAttribute('aria-controls');
      const keydown = vi.fn();
      renderOverlay('p-datepicker-panel', 'date_panel').addEventListener('keydown', keydown);
      input.focus();

      closeFieldOverlay(input);

      expect(keydown).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(input);
    });

    it('does nothing when the controlled panel is absent', () => {
      const input = renderDateField('date_panel');
      input.focus();

      closeFieldOverlay(input);

      expect(document.activeElement).toBe(input);
    });

    it.each([
      'p-datepicker-panel p-datepicker-panel-inline',
      'p-datepicker-panel p-anchored-overlay-leave-active',
    ])('ignores a panel with class %s', className => {
      const input = renderDateField('date_panel');
      const keydown = vi.fn();
      renderOverlay(className, 'date_panel').addEventListener('keydown', keydown);
      input.focus();

      closeFieldOverlay(input);

      expect(keydown).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(input);
    });
  });
});
