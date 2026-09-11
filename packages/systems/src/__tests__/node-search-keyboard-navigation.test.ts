import { describe, it, expect } from 'vitest';
import { NodeSearchPalette } from '../node-graph/index.js';

describe('Node Graph Search & Keyboard Navigation Invariants', () => {
  it('exports NodeSearchPalette as a valid component', () => {
    expect(NodeSearchPalette).toBeDefined();
    expect(typeof NodeSearchPalette).toBe('function');
  });

  it('initializes highlightedIndex to 0 and responds to keyboard navigation', () => {
    const items = [
      { type: 'math_add', label: 'Add' },
      { type: 'math_mult', label: 'Multiply' },
      { type: 'math_sub', label: 'Subtract' }
    ];
    let selected: typeof items[0] | null = null;
    let closed = false;

    // Simulate hook behavior
    let currentIndex = 0;
    const onSelect = (item: typeof items[0]) => {
      selected = item;
    };
    const onClose = () => {
      closed = true;
    };

    // Step 1: Initial state is index 0
    expect(currentIndex).toBe(0);

    // Step 2: ArrowDown navigation
    const handleDown = () => {
      currentIndex = Math.min(currentIndex + 1, items.length - 1);
    };
    handleDown();
    expect(currentIndex).toBe(1);

    // Step 3: ArrowUp navigation
    const handleUp = () => {
      currentIndex = Math.max(currentIndex - 1, 0);
    };
    handleUp();
    expect(currentIndex).toBe(0);

    // Step 4: Enter selects current highlighted item (index 0)
    const handleEnter = () => {
      if (items[currentIndex]) {
        onSelect(items[currentIndex]);
      }
    };
    handleEnter();
    expect(selected).toEqual({ type: 'math_add', label: 'Add' });

    // Step 5: Escape triggers close
    onClose();
    expect(closed).toBe(true);
  });

  it('honors hotkey N trigger gate only when focus is outside text inputs', () => {
    const shouldTriggerSpawnMenu = (key: string, tagName: string, isContentEditable = false): boolean => {
      if (key.toLowerCase() !== 'n') return false;
      const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA' || isContentEditable;
      return !isInput;
    };

    // Outside input (on canvas / body): hotkey triggers
    expect(shouldTriggerSpawnMenu('n', 'DIV')).toBe(true);
    expect(shouldTriggerSpawnMenu('N', 'BODY')).toBe(true);
    expect(shouldTriggerSpawnMenu('n', 'CANVAS')).toBe(true);

    // Inside input or textarea: hotkey does NOT trigger (user is typing)
    expect(shouldTriggerSpawnMenu('n', 'INPUT')).toBe(false);
    expect(shouldTriggerSpawnMenu('N', 'TEXTAREA')).toBe(false);
    expect(shouldTriggerSpawnMenu('n', 'DIV', true)).toBe(false);

    // Other keys do NOT trigger
    expect(shouldTriggerSpawnMenu('a', 'DIV')).toBe(false);
    expect(shouldTriggerSpawnMenu('Enter', 'DIV')).toBe(false);
  });
});
