import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./store";
import { SB819Answer } from "../components/RecordSearch/SB819/types";

/**
 * Yes/no answers to the SB-819 criteria questions.
 *
 * Keyed by the target built in `answerTarget`, so a question about the applicant is stored
 * once and reaches every charge, while a question about a conviction is stored per charge.
 *
 * Answers are held here only. They are not written to disk, not sent with the search, and
 * are discarded on reload and by Start Over, which resets every slice.
 */
export interface SB819AnswersState {
  answers: { [target: string]: SB819Answer };
}

const initialState: SB819AnswersState = { answers: {} };

export const sb819AnswersSlice = createSlice({
  name: "sb819Answers",
  initialState,
  reducers: {
    answerSB819Question: (
      state,
      action: PayloadAction<{ target: string; answer: SB819Answer }>
    ) => {
      state.answers[action.payload.target] = action.payload.answer;
    },
    clearSB819Answer: (state, action: PayloadAction<string>) => {
      delete state.answers[action.payload];
    },
    clearAllSB819Answers: (state) => {
      state.answers = {};
    },
  },
});

export const { answerSB819Question, clearSB819Answer, clearAllSB819Answers } =
  sb819AnswersSlice.actions;

export const selectSB819Answers = (state: RootState) =>
  state.sb819Answers.answers;

export default sb819AnswersSlice.reducer;
