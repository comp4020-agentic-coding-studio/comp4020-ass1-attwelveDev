import { FREEPLAY_PALETTE } from "../lib/freeplay-palette";
import type { Scenario } from "../lib/types";

// Free play's starting point: three of the palette entries with an
// intentionally non-tied split, so the winner banner reads sensibly before
// the reader has touched anything.
const [alder, beech, cypress] = FREEPLAY_PALETTE;

export const scenarioFreeplay: Scenario = {
  candidates: [alder!, beech!, cypress!],
  groups: [
    { ranking: [alder!.id, beech!.id, cypress!.id], count: 400 },
    { ranking: [beech!.id, alder!.id, cypress!.id], count: 350 },
    { ranking: [cypress!.id, alder!.id, beech!.id], count: 250 },
  ],
};
