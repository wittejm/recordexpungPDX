/**
 * The frontend half of the shared resolution table.
 *
 * src/shared/sb819ResolutionFixtures.json is executed here and by
 * tests/test_sb819_shared_fixtures.py in the backend. The outcome scenarios pin the algebra
 * both implementations share; the answer scenarios pin the mapping from an answer to an
 * outcome, which only ever happens in the browser.
 *
 * The file is read rather than imported so that one copy serves both languages.
 */

import fs from "fs";
import path from "path";
import {
  applyAnswer,
  disqualifyingCriteria,
  resolveChargeStatus,
  resolveOutcomes,
} from "./resolveAnalysis";
import {
  SB819CriterionResultData,
  SB819Determination,
  SB819Outcome,
  SB819Status,
} from "./types";

const FIXTURES = path.resolve(
  __dirname,
  "../../../../../shared/sb819ResolutionFixtures.json"
);

interface FixtureCriterion {
  key: string;
  determination: SB819Determination;
  outcome: SB819Outcome;
  group?: string;
  question?: { if_yes: SB819Status; if_no: SB819Status };
}

interface Scenario {
  name: string;
  main: FixtureCriterion[];
  pathways: { pathway: string; criteria: FixtureCriterion[] }[];
  answers?: { [key: string]: "yes" | "no" };
  expect: {
    charge: SB819Status;
    pathways?: { [pathway: string]: SB819Status };
    pathways_not_evaluated?: boolean;
    disqualifying?: string[];
  };
}

const SCREENABLE: SB819Determination[] = ["OECI", "Question"];

function build(entry: FixtureCriterion): SB819CriterionResultData {
  return {
    key: entry.key,
    scope: "charge",
    disjunction_group: entry.group ?? "",
    is_gate: false,
    is_screenable: SCREENABLE.includes(entry.determination),
    name: entry.key,
    description: "",
    citation: "",
    determination: entry.determination,
    pathway: null,
    outcome: entry.outcome,
    explanation: "",
    question: entry.question
      ? {
          text: entry.key,
          if_yes: entry.question.if_yes,
          if_no: entry.question.if_no,
          note: "",
        }
      : null,
  };
}

const table = JSON.parse(fs.readFileSync(FIXTURES, "utf8"));

function runScenario(scenario: Scenario) {
  const answers = scenario.answers ?? {};
  const resolve = (entries: FixtureCriterion[]) =>
    entries.map(build).map((c) => applyAnswer(c, answers[c.key]));

  const mainStatus = resolveOutcomes(resolve(scenario.main));

  if (scenario.expect.pathways_not_evaluated) {
    expect(mainStatus).toBe("SB-819 Ineligible");
    expect(resolveChargeStatus(mainStatus, [])).toBe(scenario.expect.charge);
    return;
  }

  const statuses = scenario.pathways.map((pathway) => {
    const status = resolveOutcomes(resolve(pathway.criteria));
    expect([pathway.pathway, status]).toEqual([
      pathway.pathway,
      scenario.expect.pathways![pathway.pathway],
    ]);
    return status;
  });

  if (scenario.expect.disqualifying) {
    const barred = scenario.pathways.flatMap((pathway) =>
      disqualifyingCriteria(resolve(pathway.criteria)).map((c) => c.key)
    );
    expect(barred).toEqual(scenario.expect.disqualifying);
  }

  expect(resolveChargeStatus(mainStatus, statuses)).toBe(
    scenario.expect.charge
  );
}

it("finds the shared fixture file", () => {
  expect(fs.existsSync(FIXTURES)).toBe(true);
});

describe("outcome scenarios, shared with the backend", () => {
  (table.outcome_scenarios as Scenario[]).forEach((scenario) => {
    it(scenario.name, () => runScenario(scenario));
  });
});

describe("answer scenarios", () => {
  (table.answer_scenarios as Scenario[]).forEach((scenario) => {
    it(scenario.name, () => runScenario(scenario));
  });
});
