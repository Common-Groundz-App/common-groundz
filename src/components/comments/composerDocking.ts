import type { KeyboardStatus } from '@/utils/viewportKeyboard';

/**
 * Single source of truth for the docking condition of the main comment
 * composer.
 *
 * Docking waits for a *confirmed* software keyboard (`status === 'open'`).
 * Detaching to `fixed` on focus alone raced Safari's native focus scroll: on
 * the first focus of a session it scrolled toward geometry React had already
 * moved, leaving the bar behind the keyboard. It also keeps the composer in
 * flow with a hardware keyboard, where no software keyboard is ever confirmed.
 */
export function shouldDockMainComposer(input: {
  isMainComposerActive: boolean;
  viewportBelowXl: boolean;
  keyboardStatus: KeyboardStatus;
}): boolean {
  return (
    input.isMainComposerActive &&
    input.viewportBelowXl &&
    input.keyboardStatus === 'open'
  );
}
