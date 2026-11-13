import { describe, expect, it } from 'vitest';
import { computed, reactive, toRaw } from 'vue';
import { itemVersion } from '@/utils/scroller';

describe('itemVersion', () => {
  const ROW = { id: 1, title: 'Продукты', amount: -2500, payee: null };

  it('is a short base-36 word, for no value too', () => {
    expect(itemVersion(ROW)).toMatch(/^[0-9a-z]{1,7}$/);
    expect(itemVersion(undefined)).toMatch(/^[0-9a-z]{1,7}$/);
  });

  it('stays the same for the same data, in a new object read again', () => {
    expect(itemVersion({ ...ROW })).toBe(itemVersion(ROW));
    expect(itemVersion([ROW, 10_000])).toBe(itemVersion([{ ...ROW }, 10_000]));
  });

  it('changes with any field of the data', () => {
    const version = itemVersion(ROW);

    expect(itemVersion({ ...ROW, title: 'Кафе и рестораны' })).not.toBe(version);
    expect(itemVersion({ ...ROW, amount: -2501 })).not.toBe(version);
    expect(itemVersion({ ...ROW, payee: 'Евроопт' })).not.toBe(version);
  });

  it('tells apart values that read alike', () => {
    expect(itemVersion(1)).not.toBe(itemVersion('1'));
    expect(itemVersion([ROW, false])).not.toBe(itemVersion([ROW, true]));
  });

  // A list's computed reads its rows from a store, that is through reactive proxies
  it('reads a row of a store as the row itself', () => {
    const stored = reactive({ ...ROW, cards: [{ lastDigits: '1234' }] });

    expect(itemVersion(stored)).toBe(itemVersion(toRaw(stored)));
    expect(itemVersion([stored, 10_000])).toBe(itemVersion([toRaw(stored), 10_000]));
    expect(itemVersion({ entry: stored })).toBe(itemVersion({ entry: toRaw(stored) }));
  });

  // Stores replace a row as a whole, so the fields are no dependencies of the list: one per field of
  // every row would make each recount of a long list several times slower
  it('makes no field of a stored row a dependency of the computed that reads it', () => {
    const rows = reactive([{ ...ROW, cards: [{ lastDigits: '1234' }] }]);
    let counts = 0;
    const version = computed(() => {
      counts += 1;
      return itemVersion([rows[0], rows.length]);
    });
    const first = version.value;

    rows[0]!.title = 'Кафе и рестораны';
    rows[0]!.cards[0]!.lastDigits = '5678';

    expect(version.value).toBe(first);
    expect(counts).toBe(1);

    rows.push({ ...ROW, id: 2, cards: [] });

    expect(version.value).not.toBe(first);
    expect(counts).toBe(2);
  });
});
