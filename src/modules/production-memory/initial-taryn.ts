// The three initial Taryn production memories, exactly as approved for Wave 3
// (2026-09-19). Facts only, with provenance; everything not evidenced is
// null -- never a guessed URL, template path, reference video or approval.
// No client id here on purpose: the operator insert resolves Taryn's
// canonical client id from production at write time.
//
// Sources: the operator's Wave 3 brief and the "Waves de Sabado" log's
// summary of the Taryn Slack ("Client Success = teal, Lecture = black,
// white/black text, rounded corners, Content Waterfall template"). The
// primary Slack messages themselves are not in this repo.
import type { ProductionMemoryInput } from "./core.ts";

export const INITIAL_TARYN_PRODUCTION_MEMORY: readonly ProductionMemoryInput[] = [
  {
    name: "Content Waterfall",
    useCase: "Recurring multi-deliverable batch built from an editor cut sheet.",
    // A convention of how the batch is run, not a client-approved template.
    status: "OPERATOR_CONVENTION",
    approvalEvidence: null,
    preferenceNotes: null,
    recipeNotes:
      "Cut-sheet driven: assemble the listed segments in the order shown and remove the lines marked DELETE. Delivered as a batch of several clips.",
    templateLocation: null,
    referenceVideoId: null,
    referenceUrl: null,
  },
  {
    name: "Lecture Format",
    useCase: null,
    status: "CLIENT_APPROVED",
    approvalEvidence:
      'Taryn explicitly asked for this to be kept "in the vault as the lecture format" (Slack; exact message date not recorded here).',
    preferenceNotes: "Black overall treatment. White text box with black bold text. Rounded video corners.",
    recipeNotes: null,
    templateLocation: null,
    referenceVideoId: null,
    referenceUrl: null,
  },
  {
    name: "Client Success Format",
    useCase: null,
    // Observed recurring treatment; no explicit approval is evidenced.
    status: "OBSERVED",
    approvalEvidence: null,
    preferenceNotes: "Teal visual treatment. Rounded video corners.",
    recipeNotes: null,
    templateLocation: null,
    referenceVideoId: null,
    referenceUrl: null,
  },
];
