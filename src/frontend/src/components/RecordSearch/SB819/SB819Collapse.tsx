import React from "react";

interface Props {
  /** From useSelectableDisclosure; the `hidden` flag is replaced by an animated height. */
  contentProps: { id: string; hidden?: boolean };
  children: React.ReactNode;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Disclosure content that opens and closes over 0.4s.
 *
 * The `hidden` attribute cannot be animated, so height is driven by a grid row that
 * transitions from 0fr to 1fr, which needs no measurement and no magic number. Visibility
 * still flips, so collapsed content stays out of the accessibility tree and out of the tab
 * order exactly as `hidden` left it; it is applied inline so that assistive technology and
 * tests both see it. Closing waits for the height to finish before hiding, opening reveals
 * at once.
 */
export default function SB819Collapse({ contentProps, children }: Props) {
  const { hidden, ...rest } = contentProps;
  const isExpanded = !hidden;
  const still = prefersReducedMotion();

  return (
    <div
      {...rest}
      style={{
        display: "grid",
        gridTemplateRows: isExpanded ? "1fr" : "0fr",
        visibility: isExpanded ? "visible" : "hidden",
        transition: still
          ? "none"
          : `grid-template-rows 0.4s ease, visibility 0s linear ${
              isExpanded ? "0s" : "0.4s"
            }`,
      }}
    >
      <div style={{ overflow: "hidden", minHeight: 0 }}>{children}</div>
    </div>
  );
}
