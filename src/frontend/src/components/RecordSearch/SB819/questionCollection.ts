import {
  SB819AnalysisData,
  SB819CriterionResultData,
  SB819Scope,
  answerTarget,
} from "./types";

export interface PendingQuestion {
  criterion: SB819CriterionResultData;
  target: string;
  /** True once no charge can still be affected by the answer. */
  moot: boolean;
}

function isQuestion(criterion: SB819CriterionResultData) {
  return criterion.is_screenable && criterion.question !== null;
}

function noChargeStillAffectedBy(
  analysis: SB819AnalysisData,
  criterion: SB819CriterionResultData,
  chargeIds: string[]
) {
  return chargeIds.every((id) => {
    const charge = analysis.charges[id];
    if (charge.pathways.length === 0) return true; // a main criterion already ended it
    const pathway = charge.pathways.find(
      (p) => p.pathway === criterion.pathway
    );
    return !pathway || pathway.status === "SB-819 Ineligible";
  });
}

/**
 * The distinct questions at a given scope, in the order the criteria are evaluated.
 *
 * A record-scope question appears identically on every charge, so it is collected once.
 * Questions whose pathway is already ruled out everywhere are marked moot rather than
 * dropped, so the reasoning stays visible without demanding an answer that changes nothing.
 */
export function collectQuestions(
  analysis: SB819AnalysisData,
  scope: SB819Scope,
  chargeIds: string[] = Object.keys(analysis.charges)
): PendingQuestion[] {
  const collected = new Map<string, PendingQuestion>();

  chargeIds.forEach((id) => {
    const charge = analysis.charges[id];
    const all = [
      ...charge.main_criteria,
      ...charge.pathways.flatMap((p) => p.criteria),
    ];
    all
      .filter((criterion) => criterion.scope === scope && isQuestion(criterion))
      .forEach((criterion) => {
        const target = answerTarget(
          criterion,
          charge.case_number,
          charge.ambiguous_charge_id
        );
        if (collected.has(target)) return;
        collected.set(target, {
          criterion,
          target,
          moot: noChargeStillAffectedBy(analysis, criterion, chargeIds),
        });
      });
  });

  return Array.from(collected.values());
}

export interface PartitionedQuestions {
  /** Shown as normal: still live, or already answered. */
  asked: PendingQuestion[];
  /** Tucked away: nothing turns on them any more and nobody has answered them. */
  setAside: PendingQuestion[];
  /** The pathways whose collapse put those questions aside. */
  setAsideReason: string[];
}

/**
 * Splits questions into the ones worth showing and the ones worth folding away.
 *
 * An answered question is never folded away, however moot it has become. It is the record
 * of a decision and the only way back from it, and hiding it would strand the volunteer
 * with an answer they could no longer change.
 */
export function partitionQuestions(
  questions: PendingQuestion[],
  answers: { [target: string]: string | undefined }
): PartitionedQuestions {
  const asked = questions.filter((q) => !q.moot || answers[q.target]);
  const setAside = questions.filter((q) => q.moot && !answers[q.target]);
  const setAsideReason = Array.from(
    new Set(setAside.map((q) => q.criterion.pathway).filter(Boolean))
  ) as string[];
  return { asked, setAside, setAsideReason };
}

/** Charge ids belonging to one case, for gathering that case's questions. */
export function chargeIdsForCase(
  analysis: SB819AnalysisData,
  caseNumber: string
): string[] {
  return Object.values(analysis.charges)
    .filter((charge) => charge.case_number === caseNumber)
    .map((charge) => charge.ambiguous_charge_id);
}
