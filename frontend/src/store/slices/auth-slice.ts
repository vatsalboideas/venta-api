import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type AuthState = {
  token: string | null;
  initialized: boolean;
};

const initialState: AuthState = {
  token: null,
  initialized: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
      state.initialized = true;
    },
  },
});

export const { setToken } = authSlice.actions;
export const authReducer = authSlice.reducer;
