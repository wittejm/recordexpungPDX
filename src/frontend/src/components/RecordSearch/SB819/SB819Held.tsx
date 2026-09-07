import React from "react";
import { PendingQuestion, revealingAnswer } from "./questionCollection";
import { SB819CriterionResultData } from "./types";

/**
 * One line naming the question that has to be met before a held question is asked.
 *
 * Used in place of the question's controls on a charge, so the row still says what the
 * criterion is and why nothing can be answered there yet.
 */
export function HeldNote({ holder }: { holder: SB819CriterionResultData }) {
  return (
    <p className="f6 gray mt1 mb2">
      Asked if <q>{holder.question?.text}</q> is answered{" "}
      <span className="fw6">{revealingAnswer(holder)}</span>.
    </p>
  );
}

interface Props {
  held: PendingQuestion[];
}

/**
 * The questions a panel is not asking yet, grouped by the question they wait on.
 *
 * The count tells the volunteer that more follows and which answer brings it, so the form
 * grows as the client's circumstances come out.
 */
export default function SB819Held({ held }: Props) {
  if (held.length === 0) return null;

  const byHolder = new Map<string, PendingQuestion[]>();
  held.forEach((q) => {
    const key = q.heldBy!.question!.text;
    byHolder.set(key, [...(byHolder.get(key) ?? []), q]);
  });

  return (
    <div className="f6 gray mt2">
      {Array.from(byHolder.entries()).map(([text, questions]) => {
        const holder = questions[0].heldBy!;
        const count = questions.length;
        return (
          <p key={text} className="mv1">
            {count} more {count === 1 ? "question" : "questions"} if{" "}
            <q>{text}</q> is answered{" "}
            <span className="fw6">{revealingAnswer(holder)}</span>.
          </p>
        );
      })}
    </div>
  );
}
