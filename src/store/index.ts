import { configureStore } from "@reduxjs/toolkit";
import { formApi } from "./formApi";
import autosaveReducer from "./autosaveSlice";

export const store = configureStore({
  reducer: {
    [formApi.reducerPath]: formApi.reducer,
    autosave: autosaveReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }).concat(formApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
