import React from "react";
import useDisclosure from "../../../hooks/useDisclosure";

type Params = Parameters<typeof useDisclosure>[0];

/**
 * A disclosure whose header text can be selected and copied.
 *
 * Browsers suppress selection inside a button, and a drag across one fires a click when it
 * is released. Selection is re-enabled here, and a click that ended a drag inside the header
 * is ignored, so copying the wording of a criterion does not also collapse the panel it
 * sits in. A plain click still toggles, because pressing the mouse clears any selection
 * first.
 */
export default function useSelectableDisclosure(params?: Params) {
  const disclosure = useDisclosure(params);
  const { onClick, ...rest } = disclosure.disclosureButtonProps;

  const handleClick = (event: React.MouseEvent) => {
    const selection = window.getSelection();
    const endedADragInsideTheHeader =
      selection !== null &&
      !selection.isCollapsed &&
      selection.toString().trim().length > 0 &&
      event.currentTarget.contains(selection.anchorNode);

    if (endedADragInsideTheHeader) return;
    onClick(event);
  };

  return {
    ...disclosure,
    disclosureButtonProps: {
      ...rest,
      type: "button" as const,
      style: { userSelect: "text" as const, WebkitUserSelect: "text" as const },
      onClick: handleClick,
    },
  };
}
