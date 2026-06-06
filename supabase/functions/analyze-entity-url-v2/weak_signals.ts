// Phase 6: weak-signal detection.
//
// Pure function over the actual extractor result type — no `criticalFieldsMissing`
// trigger in Phase 6 (deferred to Phase 7/8 alongside Gemini/normalization).

import type { ExtractResult } from "./extractor.ts";

export interface WeakSignalCheck {
  weak: boolean;
  reasons: string[];
}

export function detectWeakSignals(extract: ExtractResult): WeakSignalCheck {
  const reasons: string[] = [];
  if (extract.predictions === null) reasons.push("predictions_null");
  if (extract.metadata.weak_signals === true) reasons.push("weak_signals_flag");
  return { weak: reasons.length > 0, reasons };
}
