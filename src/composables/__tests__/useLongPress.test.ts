// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { useLongPress } from '@/composables/useLongPress';
import { vibrateTick } from '@/services/haptics';
import { dispatchPointer } from '@/__tests__/longPress';
import { LONG_PRESS_DELAY_MS, LONG_PRESS_RELEASE_GUARD_MS } from '@/constants/gestures';

vi.mock('@/services/haptics', () => ({ vibrateTick: vi.fn() }));

type Row = { id: number; title: string };

const ROWS: Row[] = [
  { id: 1, title: 'Продукты' },
  { id: 2, title: 'Кафе' },
];

// A list the way the pages bind it: the gesture and the row's own tap on one element
function mountList(options: { isEnabled?: (row: Row) => boolean } = {}) {
  const onLongPress = vi.fn();
  const onRowClick = vi.fn();
  const onElsewhere = vi.fn();

  const wrapper = mount(
    defineComponent({
      setup() {
        const { bindLongPress } = useLongPress<Row>({ onLongPress, ...options });
        return { bindLongPress, onElsewhere, onRowClick, rows: ROWS };
      },
      template: `
        <div>
          <div
            v-for="row in rows"
            :key="row.id"
            :data-row="row.id"
            class="select-none [-webkit-touch-callout:none]"
            role="button"
            v-on="bindLongPress(row)"
            @click="onRowClick(row)"
          >
            {{ row.title }}
          </div>
          <button
            type="button"
            data-testid="elsewhere"
            @click="onElsewhere('click')"
            @mousedown="onElsewhere('mousedown')"
            @mouseup="onElsewhere('mouseup')"
          />
        </div>
      `,
    }),
    { attachTo: document.body },
  );

  const row = (id: number) => wrapper.get(`[data-row="${id}"]`).element;
  const elsewhere = wrapper.get('[data-testid="elsewhere"]').element;

  return { onElsewhere, onLongPress, onRowClick, row, elsewhere, wrapper };
}

function dispatchMouse(target: Element, type: string) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function dispatchTouchEnd(target: Element) {
  const event = new TouchEvent('touchend', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function dispatchContextMenu(target: Element) {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function dispatchSelectStart(target: Element) {
  const event = new Event('selectstart', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function holdRow(row: Element, init: PointerEventInit = {}) {
  dispatchPointer(row, 'pointerdown', init);
  vi.advanceTimersByTime(LONG_PRESS_DELAY_MS);
}

enableAutoUnmount(afterEach);

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.mocked(vibrateTick).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires once for a row held still, with a tick before the actions', () => {
    const { onLongPress, row } = mountList();

    dispatchPointer(row(2), 'pointerdown');
    vi.advanceTimersByTime(LONG_PRESS_DELAY_MS - 1);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(vibrateTick).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(LONG_PRESS_DELAY_MS * 2);

    expect(onLongPress).toHaveBeenCalledExactlyOnceWith(ROWS[1]);
    expect(vibrateTick).toHaveBeenCalledOnce();
    expect(vi.mocked(vibrateTick).mock.invocationCallOrder[0]).toBeLessThan(
      onLongPress.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('leaves a tap to the row', () => {
    const { onLongPress, onRowClick, row } = mountList();

    dispatchPointer(row(1), 'pointerdown');
    vi.advanceTimersByTime(100);
    dispatchPointer(row(1), 'pointerup');
    const touchEnd = dispatchTouchEnd(row(1));
    const click = dispatchMouse(row(1), 'click');
    vi.advanceTimersByTime(LONG_PRESS_DELAY_MS);

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(click.defaultPrevented).toBe(false);
    expect(onRowClick).toHaveBeenCalledExactlyOnceWith(ROWS[0]);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])(
    'drops the press on %s before it fires',
    type => {
      const { onLongPress, row } = mountList();

      dispatchPointer(row(1), 'pointerdown');
      vi.advanceTimersByTime(LONG_PRESS_DELAY_MS - 1);
      dispatchPointer(row(1), type);
      vi.advanceTimersByTime(LONG_PRESS_DELAY_MS);

      expect(onLongPress).not.toHaveBeenCalled();
      expect(vibrateTick).not.toHaveBeenCalled();
    },
  );

  it.each([
    [6, 0],
    [-6, 0],
    [0, 6],
    [0, -6],
  ])('drops the press moved by (%i, %i)', (dx, dy) => {
    const { onLongPress, row } = mountList();

    dispatchPointer(row(1), 'pointerdown');
    dispatchPointer(row(1), 'pointermove', { clientX: 100 + dx, clientY: 100 + dy });
    vi.advanceTimersByTime(LONG_PRESS_DELAY_MS);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it.each([
    [5, 5],
    [-5, -5],
  ])('keeps the press moved by (%i, %i)', (dx, dy) => {
    const { onLongPress, row } = mountList();

    dispatchPointer(row(1), 'pointerdown');
    dispatchPointer(row(1), 'pointermove', { clientX: 100 + dx, clientY: 100 + dy });
    vi.advanceTimersByTime(LONG_PRESS_DELAY_MS);

    expect(onLongPress).toHaveBeenCalledExactlyOnceWith(ROWS[0]);
  });

  // A mouse has no implicit capture: off the row, its moves and its release go to another element
  it('drops a mouse press moved off the row', () => {
    const { onLongPress, row, elsewhere } = mountList();

    dispatchPointer(row(1), 'pointerdown', { pointerType: 'mouse' });
    dispatchPointer(elsewhere, 'pointermove', { pointerType: 'mouse', clientY: 108 });
    vi.advanceTimersByTime(LONG_PRESS_DELAY_MS);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it.each(['pointerup', 'pointercancel'])(
    'drops a mouse press on %s off the row and leaves the next click alone',
    type => {
      const { onElsewhere, onLongPress, row, elsewhere } = mountList();

      dispatchPointer(row(1), 'pointerdown', { pointerType: 'mouse' });
      vi.advanceTimersByTime(100);
      dispatchPointer(elsewhere, type, { pointerType: 'mouse' });
      vi.advanceTimersByTime(LONG_PRESS_DELAY_MS);

      expect(onLongPress).not.toHaveBeenCalled();
      expect(vibrateTick).not.toHaveBeenCalled();
      expect(dispatchMouse(elsewhere, 'click').defaultPrevented).toBe(false);
      expect(onElsewhere).toHaveBeenCalledExactlyOnceWith('click');
    },
  );

  it('follows only the pointer of the press', () => {
    const { onLongPress, row, elsewhere } = mountList();

    dispatchPointer(row(1), 'pointerdown');
    dispatchPointer(row(1), 'pointermove', { pointerId: 2, clientX: 140 });
    dispatchPointer(elsewhere, 'pointerup', { pointerId: 2 });
    dispatchPointer(row(1), 'lostpointercapture', { pointerId: 2 });
    vi.advanceTimersByTime(LONG_PRESS_DELAY_MS);

    expect(onLongPress).toHaveBeenCalledExactlyOnceWith(ROWS[0]);
  });

  it('starts over on a new press', () => {
    const { onLongPress, row } = mountList();

    dispatchPointer(row(1), 'pointerdown');
    vi.advanceTimersByTime(300);
    dispatchPointer(row(2), 'pointerdown');
    vi.advanceTimersByTime(LONG_PRESS_DELAY_MS - 300);
    expect(onLongPress).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onLongPress).toHaveBeenCalledExactlyOnceWith(ROWS[1]);
  });

  it.each([
    ['a second finger', { isPrimary: false }],
    ['the right mouse button', { pointerType: 'mouse', button: 2 }],
  ])('does not start a press with %s', (_name, init) => {
    const { onLongPress, row } = mountList();

    holdRow(row(1), init);

    expect(onLongPress).not.toHaveBeenCalled();
    expect(vibrateTick).not.toHaveBeenCalled();
  });

  it('starts a press with the left mouse button', () => {
    const { onLongPress, row } = mountList();

    holdRow(row(1), { pointerType: 'mouse', button: 0 });

    expect(onLongPress).toHaveBeenCalledExactlyOnceWith(ROWS[0]);
  });

  it('asks whether the row is enabled when the press fires and does nothing when it is not', () => {
    let enabled = true;
    const isEnabled = vi.fn(() => enabled);
    const { onLongPress, onRowClick, row } = mountList({ isEnabled });

    dispatchPointer(row(1), 'pointerdown');
    expect(isEnabled).not.toHaveBeenCalled();
    enabled = false;
    vi.advanceTimersByTime(LONG_PRESS_DELAY_MS);

    expect(isEnabled).toHaveBeenCalledExactlyOnceWith(ROWS[0]);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(vibrateTick).not.toHaveBeenCalled();

    dispatchPointer(row(1), 'pointerup');
    const touchEnd = dispatchTouchEnd(row(1));
    const click = dispatchMouse(row(1), 'click');

    expect(touchEnd.defaultPrevented).toBe(false);
    expect(click.defaultPrevented).toBe(false);
    expect(onRowClick).toHaveBeenCalledOnce();
  });

  it('cancels the touchend of a fired press that comes after its pointerup', () => {
    const { row } = mountList();

    holdRow(row(1));
    dispatchPointer(row(1), 'pointerup');

    expect(dispatchTouchEnd(row(1)).defaultPrevented).toBe(true);

    // The next touch is a tap of its own
    dispatchPointer(row(1), 'pointerdown');
    dispatchPointer(row(1), 'pointerup');
    expect(dispatchTouchEnd(row(1)).defaultPrevented).toBe(false);
  });

  it('cancels the touchend of a fired press without a pointerup before it', () => {
    const { row } = mountList();

    holdRow(row(1));

    expect(dispatchTouchEnd(row(1)).defaultPrevented).toBe(true);
  });

  it('swallows the mouse events of the release anywhere until the next press', () => {
    const { onElsewhere, onRowClick, row, elsewhere } = mountList();

    holdRow(row(1), { pointerType: 'mouse' });
    dispatchPointer(row(1), 'pointerup', { pointerType: 'mouse' });

    const swallowed = [
      dispatchMouse(row(1), 'mouseup'),
      dispatchMouse(row(1), 'click'),
      dispatchMouse(elsewhere, 'mousedown'),
      dispatchMouse(elsewhere, 'mouseup'),
      dispatchMouse(elsewhere, 'click'),
    ];

    expect(swallowed.map(event => event.defaultPrevented)).toEqual([true, true, true, true, true]);
    expect(onRowClick).not.toHaveBeenCalled();
    expect(onElsewhere).not.toHaveBeenCalled();

    dispatchPointer(elsewhere, 'pointerdown', { pointerType: 'mouse' });
    dispatchMouse(elsewhere, 'mousedown');
    dispatchPointer(elsewhere, 'pointerup', { pointerType: 'mouse' });
    dispatchMouse(elsewhere, 'mouseup');
    dispatchMouse(elsewhere, 'click');
    dispatchMouse(row(1), 'click');

    expect(onElsewhere.mock.calls).toEqual([['mousedown'], ['mouseup'], ['click']]);
    expect(onRowClick).toHaveBeenCalledExactlyOnceWith(ROWS[0]);
  });

  // TalkBack activates with a click that no press comes before
  it('lets a bare click through once the release is a guard interval old', () => {
    const { onRowClick, row, elsewhere } = mountList();

    holdRow(row(1));
    dispatchPointer(row(1), 'pointerup');
    dispatchTouchEnd(row(1));

    vi.advanceTimersByTime(LONG_PRESS_RELEASE_GUARD_MS - 1);
    expect(dispatchMouse(elsewhere, 'click').defaultPrevented).toBe(true);

    vi.advanceTimersByTime(1);
    expect(dispatchMouse(elsewhere, 'click').defaultPrevented).toBe(false);
    dispatchMouse(row(1), 'click');
    expect(onRowClick).toHaveBeenCalledOnce();
  });

  // The sheet's mask covers the row as soon as the press fires, and a mouse is released over it
  it('counts the guard from a release that lands off the row', () => {
    const { row, elsewhere } = mountList();

    holdRow(row(1), { pointerType: 'mouse' });
    vi.advanceTimersByTime(LONG_PRESS_RELEASE_GUARD_MS * 2);
    expect(dispatchMouse(elsewhere, 'click').defaultPrevented).toBe(true);

    dispatchPointer(elsewhere, 'pointerup', { pointerType: 'mouse' });
    vi.advanceTimersByTime(LONG_PRESS_RELEASE_GUARD_MS);

    expect(dispatchMouse(elsewhere, 'click').defaultPrevented).toBe(false);
  });

  // The system may break off a held touch: `pointercancel`, and no `pointerup` or `touchend` after it
  it('counts the guard from the cancellation of a fired press', () => {
    const { onRowClick, row } = mountList();

    holdRow(row(1));
    dispatchPointer(row(1), 'pointercancel');

    vi.advanceTimersByTime(LONG_PRESS_RELEASE_GUARD_MS - 1);
    expect(dispatchMouse(row(1), 'click').defaultPrevented).toBe(true);

    vi.advanceTimersByTime(1);
    expect(dispatchMouse(row(1), 'click').defaultPrevented).toBe(false);
    expect(onRowClick).toHaveBeenCalledOnce();
  });

  it('cancels the context menu of a row whether or not the gesture is on', () => {
    const enabled = mountList();
    const disabled = mountList({ isEnabled: () => false });

    expect(dispatchContextMenu(enabled.row(1)).defaultPrevented).toBe(true);
    expect(dispatchContextMenu(disabled.row(1)).defaultPrevented).toBe(true);

    // The WebView's own long press comes first and leaves the press running
    dispatchPointer(enabled.row(1), 'pointerdown');
    vi.advanceTimersByTime(400);
    expect(dispatchContextMenu(enabled.row(1)).defaultPrevented).toBe(true);
    vi.advanceTimersByTime(LONG_PRESS_DELAY_MS - 400);

    expect(enabled.onLongPress).toHaveBeenCalledOnce();
  });

  // The WebView's own long press may come after ours, with the sheet's mask under the finger
  it('cancels the context menu and the text selection anywhere until the guard runs out', () => {
    const { row, elsewhere } = mountList();

    expect(dispatchContextMenu(elsewhere).defaultPrevented).toBe(false);
    expect(dispatchSelectStart(elsewhere).defaultPrevented).toBe(false);

    holdRow(row(1));
    expect(dispatchContextMenu(elsewhere).defaultPrevented).toBe(true);
    expect(dispatchSelectStart(elsewhere).defaultPrevented).toBe(true);

    dispatchPointer(row(1), 'pointerup');
    vi.advanceTimersByTime(LONG_PRESS_RELEASE_GUARD_MS - 1);
    expect(dispatchContextMenu(elsewhere).defaultPrevented).toBe(true);
    expect(dispatchSelectStart(elsewhere).defaultPrevented).toBe(true);

    vi.advanceTimersByTime(1);
    expect(dispatchContextMenu(elsewhere).defaultPrevented).toBe(false);
    expect(dispatchSelectStart(elsewhere).defaultPrevented).toBe(false);
  });

  it('clears a selection already started when the press fires', () => {
    const { row } = mountList();
    const range = document.createRange();
    range.selectNodeContents(row(2));
    window.getSelection()?.addRange(range);

    dispatchPointer(row(1), 'pointerdown');
    vi.advanceTimersByTime(LONG_PRESS_DELAY_MS - 1);
    expect(window.getSelection()?.rangeCount).toBe(1);

    vi.advanceTimersByTime(1);
    expect(window.getSelection()?.rangeCount).toBe(0);
  });

  it('drops a press still held when the list unmounts', () => {
    const { onLongPress, row, wrapper } = mountList();

    dispatchPointer(row(1), 'pointerdown');
    wrapper.unmount();
    vi.advanceTimersByTime(LONG_PRESS_DELAY_MS);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('stops swallowing clicks when the list unmounts after a press fired', () => {
    const { onLongPress, row, wrapper } = mountList();
    const outside = document.createElement('button');
    const onOutsideClick = vi.fn();
    outside.addEventListener('click', onOutsideClick);
    document.body.appendChild(outside);

    holdRow(row(1));
    expect(onLongPress).toHaveBeenCalledOnce();
    wrapper.unmount();

    expect(dispatchMouse(outside, 'click').defaultPrevented).toBe(false);
    expect(onOutsideClick).toHaveBeenCalledOnce();
    outside.remove();
  });
});
