import React from "react";
import useSelectableDisclosure from "./useSelectableDisclosure";
import DisclosureIcon from "../../common/DisclosureIcon";
import SB819Collapse from "./SB819Collapse";
import { PartitionedQuestions } from "./questionCollection";
import SB819Question from "./SB819Question";

interface Props
  extends Pick<PartitionedQuestions, "setAside" | "setAsideReason"> {
  id: string;
}

/**
 * Questions nothing turns on any more, folded away but reachable.
 *
 * They are not dropped, because the answer that made them irrelevant can be taken back at
 * any time, and they would have to come straight back.
 */
export default function SB819SetAside({ setAside, setAsideReason, id }: Props) {
  const {
    disclosureIsExpanded,
    disclosureButtonProps,
    disclosureContentProps,
  } = useSelectableDisclosure({ id });

  if (setAside.length === 0) return null;

  const count = setAside.length;
  const because =
    setAsideReason.length > 0
      ? ` because ${setAsideReason.join(" and ")} ${
          setAsideReason.length === 1 ? "is" : "are"
        } ruled out`
      : "";

  return (
    <div className="bt b--light-gray mt3 pt2">
      <button
        {...disclosureButtonProps}
        className="w-100 flex flex-wrap items-center bg-transparent bn pointer tl pa0 pv2 f6 gray"
      >
        <span className="mr-auto">
          {count} more {count === 1 ? "question" : "questions"}, not needed
          {because}
        </span>
        <span className="underline mr2">
          {disclosureIsExpanded ? "Hide" : "Show"}
        </span>
        <DisclosureIcon disclosureIsExpanded={disclosureIsExpanded} />
      </button>

      <SB819Collapse contentProps={disclosureContentProps}>
        <p className="f6 gray mb2">
          Answering these changes nothing while that stays true.
        </p>
        {setAside.map(({ criterion, target }) => (
          <SB819Question key={target} criterion={criterion} target={target} />
        ))}
      </SB819Collapse>
    </div>
  );
}
