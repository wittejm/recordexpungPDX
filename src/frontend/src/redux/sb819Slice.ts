import { createSlice } from "@reduxjs/toolkit";
import { RootState } from "./store";
import { RECORD_LOADING } from "./search/types";

/**
 * Whether the SB-819 view stands in for the search summary.
 *
 * A new search puts the summary back, since the view belongs to the record it was opened
 * on and the next record may have nothing for it to show.
 */
interface SB819State {
  isViewing: boolean;
}

const initialState: SB819State = {
  isViewing: false,
};

export const sb819Slice = createSlice({
  name: "sb819",
  initialState,
  reducers: {
    showSB819View: (state) => {
      state.isViewing = true;
    },
    hideSB819View: (state) => {
      state.isViewing = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(RECORD_LOADING, () => initialState);
  },
});

export const { showSB819View, hideSB819View } = sb819Slice.actions;

export const selectIsViewingSB819 = (state: RootState) => state.sb819.isViewing;

export default sb819Slice.reducer;
