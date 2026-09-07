import { createSlice } from "@reduxjs/toolkit";
import { RootState } from "./store";

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
});

export const { showSB819View, hideSB819View } = sb819Slice.actions;

export const selectIsViewingSB819 = (state: RootState) => state.sb819.isViewing;

export default sb819Slice.reducer;
