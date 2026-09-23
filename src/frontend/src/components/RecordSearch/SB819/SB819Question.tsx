import React from "react";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  answerSB819Question,
  clearSB819Answer,
  selectSB819Answers,
} from "../../../redux/sb819AnswersSlice";
import { SB819Answer, SB819CriterionResultData, statusColor } from "./types";

interface Props {
  criterion: SB819CriterionResultData;
  target: string;
}

/**
 * One yes/no question, with both outcomes stated.
 *
 * Answers live in the store for the session only. Nothing is written to disk, and nothing
 * is sent to the server, so this shares no machinery with the expungement questions.
 */
export default function SB819Question({ criterion, target }: Props) {
  const dispatch = useAppDispatch();
  const answers = useAppSelector(selectSB819Answers);
  const answer = answers[target];
  const question = criterion.question;

  if (!question) return null;

  const choose = (value: SB819Answer) => () =>
    dispatch(answerSB819Question({ target, answer: value }));

  const outcomeFor = (value: SB819Answer) =>
    value === "yes" ? question.if_yes : question.if_no;

  return (
    <fieldset className="bn ma0 pa0 pl3 mt2 mb3 bl bw2 b--light-purple">
      <legend className="fw6 pb1">{question.text}</legend>

      <div className="flex flex-wrap items-center">
        {(["yes", "no"] as SB819Answer[]).map((value) => {
          const id = `${target}-${value}`;
          const selected = answer === value;
          return (
            <label
              key={value}
              htmlFor={id}
              className={`inline-flex items-center f6 fw6 br2 ba pv1 ph2 mr2 mv1 pointer ${
                selected
                  ? `${statusColor(outcomeFor(value))} bg-washed-${statusColor(
                      outcomeFor(value)
                    )} b--light-gray`
                  : "mid-gray bg-white b--black-10"
              }`}
            >
              <input
                type="radio"
                id={id}
                name={target}
                className="mr2"
                checked={selected}
                onChange={choose(value)}
              />
              {value === "yes" ? "Yes" : "No"}
            </label>
          );
        })}

        {answer && (
          <button
            type="button"
            className="f6 link mid-gray hover-blue bg-transparent bn pointer underline"
            onClick={() => dispatch(clearSB819Answer(target))}
          >
            Clear
          </button>
        )}
      </div>

      <div className="f6 mt1">
        <div>
          <span className="fw7">If yes:</span> {question.if_yes}
        </div>
        <div>
          <span className="fw7">If no:</span> {question.if_no}
        </div>
        {question.note && <div className="gray mt1">{question.note}</div>}
      </div>
    </fieldset>
  );
}
