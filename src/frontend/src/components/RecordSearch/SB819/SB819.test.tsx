import React from "react";
import "@testing-library/jest-dom";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupStore } from "../../../redux/store";
import { default as initialSearchState } from "../../../redux/search/initialState";
import { appRender } from "../../../test/testHelpers";
import Layout from "../Layout";
import { SB819AnalysisData } from "./types";
import { buildRecord, buildAnalysis } from "./sb819TestData";
import resolveAnalysis from "./resolveAnalysis";
import { clearAllData } from "../../../redux/store";

jest.mock("axios", () => ({ request: () => new Promise(() => {}) }));

jest.mock("react-router-dom", () => ({
  ...(jest.requireActual("react-router-dom") as any),
  useNavigate: () => jest.fn(),
}));

function rawAnalysis(store: any) {
  const analysis = store.getState().search.record?.summary?.sb819_analysis;
  if (!analysis) throw new Error("the store holds no SB-819 analysis");
  return analysis;
}

function renderWith(analysis: SB819AnalysisData) {
  const store = setupStore({
    search: { ...initialSearchState, record: buildRecord(analysis) },
  });
  return {
    user: userEvent.setup(),
    ...appRender(<Layout />, undefined, { store }),
  };
}

async function openTheAnalysis(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: /SB-819 eligibility analysis/i })
  );
}

describe("the feature flag", () => {
  const realLocation = window.location;

  function serveFrom(hostname: string) {
    Object.defineProperty(window, "location", {
      value: { ...realLocation, hostname },
      writable: true,
      configurable: true,
    });
  }

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: realLocation,
      writable: true,
      configurable: true,
    });
  });

  it("hides the badge on recordsponge.com", () => {
    serveFrom("recordsponge.com");
    renderWith(buildAnalysis());
    expect(screen.queryByText(/SB-819 eligible/)).not.toBeInTheDocument();
  });

  it("shows the badge on the staging host", () => {
    serveFrom("dev.recordsponge.com");
    renderWith(buildAnalysis());
    expect(
      screen.getByText("Charges possibly SB-819 eligible")
    ).toBeInTheDocument();
  });

  it("shows the badge locally", () => {
    serveFrom("localhost");
    renderWith(buildAnalysis());
    expect(
      screen.getByText("Charges possibly SB-819 eligible")
    ).toBeInTheDocument();
  });
});

describe("the badge in the search summary", () => {
  it("reads positively when a charge survived the criteria", () => {
    renderWith(buildAnalysis());
    expect(
      screen.getByText("Charges possibly SB-819 eligible")
    ).toBeInTheDocument();
  });

  it("reads negatively when every analyzed charge is ineligible", () => {
    renderWith(buildAnalysis({ possible: false }));
    expect(screen.getByText("No charges SB-819 eligible")).toBeInTheDocument();
  });

  it("opens the analysis either way", async () => {
    const { user } = renderWith(buildAnalysis({ possible: false }));
    await openTheAnalysis(user);
    expect(
      screen.getByRole("heading", { name: /SB-819 Eligibility Analysis/i })
    ).toBeInTheDocument();
  });

  it("is absent when no charge is in scope", () => {
    renderWith(buildAnalysis({ empty: true }));
    expect(screen.queryByText(/SB-819 eligible/)).not.toBeInTheDocument();
  });
});

describe("scrolling on a view swap", () => {
  // jsdom has no scrollIntoView, so the panels report where they were asked to scroll to.
  let scrolledTo: string[];

  beforeEach(() => {
    scrolledTo = [];
    (Element.prototype as any).scrollIntoView = function () {
      scrolledTo.push((this as HTMLElement).id);
    };
    jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    delete (Element.prototype as any).scrollIntoView;
    jest.restoreAllMocks();
  });

  async function nextFrame() {
    await act(async () => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => resolve(null))
      );
    });
  }

  it("brings the SB-819 panel to the top, not the page", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await nextFrame();

    expect(scrolledTo).toEqual(["sb819-summary-panel"]);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("brings the search summary panel back to the top on return", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await nextFrame();
    scrolledTo = [];

    await user.click(
      screen.getByRole("button", { name: /back to search summary/i })
    );
    await nextFrame();

    expect(scrolledTo).toEqual(["record-summary-panel"]);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("clears the fixed header on both panels", async () => {
    const { user } = renderWith(buildAnalysis());
    expect(document.getElementById("record-summary-panel")).toHaveClass(
      "scroll-mt-20"
    );

    await openTheAnalysis(user);
    expect(document.getElementById("sb819-summary-panel")).toHaveClass(
      "scroll-mt-20"
    );
  });
});

describe("answering questions", () => {
  function answer(
    user: ReturnType<typeof userEvent.setup>,
    target: string,
    value: "yes" | "no"
  ) {
    const input = document.getElementById(`${target}-${value}`);
    if (!input) throw new Error(`no ${value} control for ${target}`);
    return user.click(input);
  }

  function statusesFor(store: any) {
    const answers = store.getState().sb819Answers.answers;
    const raw = rawAnalysis(store);
    const resolved = resolveAnalysis(raw, answers);
    return Object.fromEntries(
      Object.values(resolved.charges).map((c: any) => [
        c.ambiguous_charge_id,
        c.status,
      ])
    );
  }

  it("asks each applicant question once, not once per charge", async () => {
    const { user } = renderWith(buildAnalysis({ twoChargesOnFirstCase: true }));
    await openTheAnalysis(user);

    expect(
      screen.getByRole("heading", { name: /About the applicant/i })
    ).toBeInTheDocument();
    // Three charges, but one control for the applicant question.
    expect(
      document.querySelectorAll('[id="record:currently-incarcerated-no"]')
    ).toHaveLength(1);
  });

  it("applies one applicant answer to every charge", async () => {
    const { user, store } = renderWith(
      buildAnalysis({ twoChargesOnFirstCase: true })
    );
    await openTheAnalysis(user);
    await answer(user, "record:currently-incarcerated", "no");

    const raw = rawAnalysis(store);
    const resolved = resolveAnalysis(
      raw,
      store.getState().sb819Answers.answers
    );
    Object.values(resolved.charges).forEach((charge: any) => {
      const excessive = charge.pathways.find(
        (p: any) => p.pathway === "Excessive Sentencing"
      );
      expect(excessive.status).toBe("SB-819 Ineligible");
    });
  });

  it("applies a case answer to that case only", async () => {
    const { user, store } = renderWith(
      buildAnalysis({ twoChargesOnFirstCase: true })
    );
    await openTheAnalysis(user);
    await answer(user, "case:100:sentence-completed", "no");

    const raw = rawAnalysis(store);
    const resolved = resolveAnalysis(
      raw,
      store.getState().sb819Answers.answers
    );
    const collateral = (id: string) =>
      resolved.charges[id].pathways.find(
        (p: any) => p.pathway === "Collateral Consequences"
      )!.status;

    expect(collateral("100-1")).toBe("SB-819 Ineligible");
    expect(collateral("100-2")).toBe("SB-819 Ineligible");
    expect(collateral("300-1")).toBe("Needs More Analysis");
  });

  it("moves a charge into the cleared section once nothing is left to ask", async () => {
    const { user, store } = renderWith(buildAnalysis());
    await openTheAnalysis(user);

    expect(statusesFor(store)["100-1"]).toBe("Needs More Analysis");

    await answer(user, "case:100:sentence-completed", "yes");
    await answer(user, "charge:100-1:no-domestic-violence", "no");

    expect(statusesFor(store)["100-1"]).toBe("Possibly SB-819 Eligible");
  });

  it("keeps the criteria that nobody can settle out of the status", async () => {
    const { user, store } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await answer(user, "case:100:sentence-completed", "yes");
    await answer(user, "charge:100-1:no-domestic-violence", "no");

    // Substantial rehabilitation is still unresolved, and the charge clears regardless.
    const raw = rawAnalysis(store);
    const resolved = resolveAnalysis(
      raw,
      store.getState().sb819Answers.answers
    );
    const collateral = resolved.charges["100-1"].pathways.find(
      (p: any) => p.pathway === "Collateral Consequences"
    )!;
    expect(collateral.criteria.some((c: any) => c.outcome === "Unknown")).toBe(
      true
    );
    expect(collateral.status).toBe("Possibly SB-819 Eligible");
  });

  it("discards answers and leaves the view when a new search starts", async () => {
    // The targets carry no name, so one client's answers would otherwise be applied to the
    // next client's record.
    const { user, store } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await answer(user, "record:currently-incarcerated", "yes");
    expect(store.getState().sb819.isViewing).toBe(true);

    store.dispatch({ type: "RECORD_LOADING" });
    expect(store.getState().sb819Answers.answers).toEqual({});
    expect(store.getState().sb819.isViewing).toBe(false);
  });

  it("discards answers on Start Over", async () => {
    const { user, store } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await answer(user, "case:100:sentence-completed", "yes");
    expect(Object.keys(store.getState().sb819Answers.answers)).toHaveLength(1);

    store.dispatch(clearAllData());
    expect(store.getState().sb819Answers.answers).toEqual({});
  });
});

describe("attributing a disqualification", () => {
  function answer(
    user: ReturnType<typeof userEvent.setup>,
    target: string,
    value: "yes" | "no"
  ) {
    const input = document.getElementById(`${target}-${value}`);
    if (!input) throw new Error(`no ${value} control for ${target}`);
    return user.click(input);
  }

  it("names the criterion that actually bars a pathway", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await answer(user, "record:currently-incarcerated", "yes");
    await answer(user, "record:over-60-or-ill", "no");
    await answer(user, "charge:100-1:five-years-served", "no");

    const reason = screen
      .getAllByText(
        "Has the applicant served at least five years on this sentence?"
      )
      .map((el) => el.closest("p"))
      .find(Boolean);
    expect(reason).toHaveTextContent(/five years on this sentence\?\s*No/);
  });

  it("reports a barring answer as what was answered, not as what was required", async () => {
    // Criterion names are requirements, so printing one as the reason states the opposite
    // of what happened: answering "no" must not read as "Applicant is currently incarcerated".
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await answer(user, "record:currently-incarcerated", "no");

    const bars = screen
      .getAllByText("Is the applicant currently incarcerated?")
      .map((el) => el.closest("p"))
      .filter((p) => p && /\?\s*No$/.test(p.textContent ?? ""));
    expect(bars.length).toBeGreaterThan(0);
    expect(screen.queryByText(/currently incarcerated\?\s*Yes$/)).toBeNull();
  });
});

describe("taking an answer back", () => {
  function answer(
    user: ReturnType<typeof userEvent.setup>,
    target: string,
    value: "yes" | "no"
  ) {
    const input = document.getElementById(`${target}-${value}`);
    if (!input) throw new Error(`no ${value} control for ${target}`);
    return user.click(input);
  }

  it("keeps an answered applicant question on screen once it rules a pathway out", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await answer(user, "record:currently-incarcerated", "no");

    // The answer that collapsed the pathway is the only way back from it.
    const control = document.getElementById("record:currently-incarcerated-no");
    expect(control).toBeInTheDocument();
    expect(control).toBeChecked();
  });

  it("never reports a count of zero out of zero", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await answer(user, "record:currently-incarcerated", "no");

    expect(screen.queryByText(/0 of 0/)).not.toBeInTheDocument();
    expect(screen.getByText(/1 of 1 answered/)).toBeInTheDocument();
  });

  it("reverses an answer and brings the questions back", async () => {
    const { user, store } = renderWith(buildAnalysis());
    await openTheAnalysis(user);

    await answer(user, "record:currently-incarcerated", "no");
    expect(
      resolveAnalysis(
        rawAnalysis(store),
        store.getState().sb819Answers.answers
      ).charges["100-1"].pathways.find(
        (p: any) => p.pathway === "Excessive Sentencing"
      )!.status
    ).toBe("SB-819 Ineligible");

    await answer(user, "record:currently-incarcerated", "yes");
    expect(
      resolveAnalysis(
        rawAnalysis(store),
        store.getState().sb819Answers.answers
      ).charges["100-1"].pathways.find(
        (p: any) => p.pathway === "Excessive Sentencing"
      )!.status
    ).toBe("Needs More Analysis");
  });

  it("clears an answer back to unanswered", async () => {
    const { user, store } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await answer(user, "record:currently-incarcerated", "no");
    expect(store.getState().sb819Answers.answers).toHaveProperty(
      "record:currently-incarcerated"
    );

    await user.click(screen.getAllByRole("button", { name: /^Clear$/i })[0]);
    expect(store.getState().sb819Answers.answers).not.toHaveProperty(
      "record:currently-incarcerated"
    );
  });

  it("reopens a pathway that an answer folded shut, to change that answer", async () => {
    // Answering the last open question folds the pathway away. The header names what
    // decided it, and one click brings the answer back within reach.
    const { user, store } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await answer(user, "case:100:sentence-completed", "yes");
    await answer(user, "charge:100-1:no-domestic-violence", "yes");

    const header = screen.getByRole("button", {
      name: /^Collateral Consequences/i,
    });
    expect(header).toHaveAttribute("aria-expanded", "false");

    await user.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");

    await answer(user, "charge:100-1:no-domestic-violence", "no");
    expect(
      store.getState().sb819Answers.answers["charge:100-1:no-domestic-violence"]
    ).toBe("no");
  });

  it("keeps an answered charge question answerable", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await answer(user, "case:100:sentence-completed", "yes");
    await answer(user, "charge:100-1:no-domestic-violence", "yes");

    const other = document.getElementById(
      "charge:100-1:no-domestic-violence-no"
    );
    expect(other).toBeInTheDocument();
    await user.click(other!);
    expect(other).toBeChecked();
  });

  it("keeps the questions it set aside reachable", async () => {
    // The gate is met, so the alternatives are on the table; then time served rules the
    // pathway out from a charge, and the unanswered alternatives are folded, not dropped.
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await answer(user, "record:currently-incarcerated", "yes");
    expect(
      document.getElementById("record:over-60-or-ill-yes")
    ).toBeInTheDocument();
    await answer(user, "charge:100-1:five-years-served", "no");

    const toggle = screen.getByRole("button", {
      name: /more questions, not needed/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      document.getElementById("record:over-60-or-ill-yes")
    ).toBeInTheDocument();
  });
});

describe("questions behind a gate", () => {
  function answer(
    user: ReturnType<typeof userEvent.setup>,
    target: string,
    value: "yes" | "no"
  ) {
    const input = document.getElementById(`${target}-${value}`);
    if (!input) throw new Error(`no ${value} control for ${target}`);
    return user.click(input);
  }

  it("opens the applicant panel with the gate alone", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);

    expect(
      document.getElementById("record:currently-incarcerated-yes")
    ).toBeInTheDocument();
    expect(document.getElementById("record:over-60-or-ill-yes")).toBeNull();
    expect(document.getElementById("record:juvenile-transfer-yes")).toBeNull();
    expect(screen.getByText(/0 of 1 answered/)).toBeInTheDocument();
    expect(
      screen.getByText(/2 more questions if/).closest("p")
    ).toHaveTextContent(
      /2 more questions if Is the applicant currently incarcerated\? is answered Yes/
    );
  });

  it("reveals the rest of the pathway when the gate is met", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await answer(user, "record:currently-incarcerated", "yes");

    expect(
      document.getElementById("record:over-60-or-ill-yes")
    ).toBeInTheDocument();
    expect(
      document.getElementById("record:juvenile-transfer-yes")
    ).toBeInTheDocument();
    expect(
      document.getElementById("charge:100-1:five-years-served-yes")
    ).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 answered/)).toBeInTheDocument();
    expect(screen.queryByText(/more questions if/)).toBeNull();
  });

  it("reveals nothing and folds nothing when the gate is answered against the pathway", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await answer(user, "record:currently-incarcerated", "no");

    expect(document.getElementById("record:over-60-or-ill-yes")).toBeNull();
    expect(
      document.getElementById("charge:100-1:five-years-served-yes")
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /more questions, not needed/i })
    ).toBeNull();
    expect(screen.getByText(/1 of 1 answered/)).toBeInTheDocument();
  });

  it("names the gate on a charge row in place of the question", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);

    const row = screen
      .getByText("Applicant has served at least five years")
      .closest("li");
    expect(row).toHaveTextContent(
      /Asked if Is the applicant currently incarcerated\? is answered Yes/
    );
    expect(row?.querySelector("input")).toBeNull();

    await answer(user, "record:currently-incarcerated", "yes");
    expect(row?.querySelector("input")).not.toBeNull();
  });

  it("counts only the questions a charge can be asked now", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    // The two gates, one per open pathway.
    expect(screen.getByText(/2 questions to answer/)).toBeInTheDocument();

    await answer(user, "record:currently-incarcerated", "yes");
    // Time served and the two alternatives join the collateral gate.
    expect(screen.getByText(/4 questions to answer/)).toBeInTheDocument();
  });

  it("gates a case's charge questions on the case's own answer", async () => {
    const { user } = renderWith(buildAnalysis({ twoChargesOnFirstCase: true }));
    await openTheAnalysis(user);
    expect(
      document.getElementById("charge:100-1:no-domestic-violence-yes")
    ).toBeNull();
    expect(
      document.getElementById("charge:300-1:no-domestic-violence-yes")
    ).toBeNull();

    await answer(user, "case:100:sentence-completed", "yes");
    expect(
      document.getElementById("charge:100-1:no-domestic-violence-yes")
    ).toBeInTheDocument();
    expect(
      document.getElementById("charge:100-2:no-domestic-violence-yes")
    ).toBeInTheDocument();
    expect(
      document.getElementById("charge:300-1:no-domestic-violence-yes")
    ).toBeNull();
  });

  it("keeps an answered question on screen after its gate turns against it", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await answer(user, "record:currently-incarcerated", "yes");
    await answer(user, "record:over-60-or-ill", "yes");
    await answer(user, "record:currently-incarcerated", "no");

    // The record of a decision, and the only way back from it.
    const control = document.getElementById("record:over-60-or-ill-yes");
    expect(control).toBeInTheDocument();
    expect(control).toBeChecked();
    expect(document.getElementById("record:juvenile-transfer-yes")).toBeNull();
  });

  it("holds every pathway question behind an open main criterion", async () => {
    const { user } = renderWith(buildAnalysis({ felonyUncertain: true }));
    await openTheAnalysis(user);

    expect(
      document.getElementById("charge:100-1:sentenced-as-felony-yes")
    ).toBeInTheDocument();
    // Both gates wait on it, so neither panel has anything to ask yet.
    expect(
      screen.queryByRole("heading", { name: /About the applicant/i })
    ).toBeNull();
    expect(document.getElementById("case:100:sentence-completed-yes")).toBeNull();

    await answer(user, "charge:100-1:sentenced-as-felony", "yes");
    expect(
      document.getElementById("record:currently-incarcerated-yes")
    ).toBeInTheDocument();
    expect(
      document.getElementById("case:100:sentence-completed-yes")
    ).toBeInTheDocument();
  });
});

describe("leaving the view", () => {
  it("returns to the summary when the record stops having anything to analyze", async () => {
    // An edit can remove the last analyzed charge from a record the view was opened on.
    const { user, store } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    expect(
      screen.queryByRole("heading", { name: "Search Summary" })
    ).not.toBeInTheDocument();

    const record = store.getState().search.record!;
    act(() => {
      store.dispatch({
        type: "DISPLAY_RECORD",
        record: {
          ...record,
          summary: {
            ...record.summary,
            sb819_analysis: buildAnalysis({ empty: true }),
          },
        },
        questions: {},
      });
    });
    expect(
      screen.getByRole("heading", { name: "Search Summary" })
    ).toBeInTheDocument();
  });
});

describe("collapsing", () => {
  it("folds the main criteria away when all four are met", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    const button = screen.getByRole("button", { name: /Main Criteria/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/all four met/i)).toBeInTheDocument();
  });

  it("keeps the main criteria open when one of them fails", async () => {
    const { user } = renderWith(buildAnalysis({ possible: false }));
    await openTheAnalysis(user);
    expect(
      screen.getByRole("button", { name: /Main Criteria/i })
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("folds a pathway away once it is ruled out", async () => {
    const { user } = renderWith(
      buildAnalysis({ blockCollateralConsequences: true })
    );
    await openTheAnalysis(user);
    expect(
      screen.getByRole("button", { name: /^Collateral Consequences/i })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", { name: /^Excessive Sentencing/i })
    ).toHaveAttribute("aria-expanded", "true");
  });
});

describe("the SB-819 view", () => {
  it("replaces the search summary and can be dismissed", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    expect(
      screen.queryByRole("heading", { name: "Search Summary" })
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /back to search summary/i })
    );
    expect(
      screen.getByRole("heading", { name: "Search Summary" })
    ).toBeInTheDocument();
  });

  it("lists all three sections, including the empty one", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    for (const section of [
      "Possibly SB-819 Eligible",
      "Needs More Analysis",
      "SB-819 Ineligible",
    ]) {
      expect(screen.getAllByText(section).length).toBeGreaterThan(0);
    }
  });

  it("shows only the charges the analysis covers", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    expect(
      screen.getAllByText(/Robbery in the Second Degree/).length
    ).toBeGreaterThan(0);
    // A Clackamas charge is out of scope, so it is absent from the view entirely.
    expect(
      screen.queryByText(/Assault in the First Degree/)
    ).not.toBeInTheDocument();
  });

  it("shows the criteria and their sources on the charge panel", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    expect(screen.getByText("SB-819 Limiting Criteria")).toBeInTheDocument();
    expect(
      screen.getByText("Conviction is not aggravated murder")
    ).toBeInTheDocument();
    // Every criterion carries its page cite and how it is determined.
    expect(screen.getAllByText("Page 3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("OECI").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Question").length).toBeGreaterThan(0);
  });

  it("states a question with both of its outcomes", async () => {
    const { user } = renderWith(buildAnalysis());
    await openTheAnalysis(user);
    await user.click(document.getElementById("case:100:sentence-completed-yes")!);
    expect(
      screen.getByText("Did this conviction involve domestic violence?")
    ).toBeInTheDocument();
    expect(screen.getAllByText("If yes:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("If no:").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/not disqualifying if it was committed while/)
    ).toBeInTheDocument();
  });

  it("says when one pathway is blocked but others remain open", async () => {
    const { user } = renderWith(
      buildAnalysis({ blockCollateralConsequences: true })
    );
    await openTheAnalysis(user);
    expect(
      screen.getByText(
        /Blocked under Collateral Consequences, but still open under Excessive Sentencing/
      )
    ).toBeInTheDocument();
  });

  it("says when a main criterion rules out every pathway", async () => {
    const { user } = renderWith(buildAnalysis({ possible: false }));
    await openTheAnalysis(user);
    expect(
      screen.getByText(/gates every application type/)
    ).toBeInTheDocument();
  });
});
