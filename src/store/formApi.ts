import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { FormData } from "../types";

// Simple base query using standard fetchBaseQuery
// MSW will intercept these requests automatically
const baseQuery = fetchBaseQuery({
  baseUrl: "/api",
  prepareHeaders: (headers) => {
    headers.set("Content-Type", "application/json");
    headers.set("X-Client-Request", "true");
    return headers;
  },
});

// Define our API - MSW will handle the interception
export const formApi = createApi({
  reducerPath: "formApi",
  baseQuery,
  tagTypes: ["FormSave"],
  endpoints: (builder) => ({
    saveForm: builder.mutation<
      { success: boolean; message?: string; timestamp?: number },
      FormData
    >({
      query: (formData) => ({
        url: "/save-form",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["FormSave"],
    }),

    // Test endpoint for diagnostics
    testApi: builder.mutation<
      { success: boolean; message?: string; timestamp?: number; echo?: any },
      any
    >({
      query: (testData) => ({
        url: "/test",
        method: "POST",
        body: testData,
      }),
    }),
  }),
});

export const { useSaveFormMutation, useTestApiMutation } = formApi;
