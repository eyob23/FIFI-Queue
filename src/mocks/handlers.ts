import { http, HttpResponse } from "msw";
import { mockBackend } from "../services/mockBackend";
import type { FormData } from "../types";

export const handlers = [
  // Handle form save requests
  http.post("/api/save-form", async ({ request }) => {
    console.log("🎭 MSW: Intercepting form save request");

    try {
      // Parse the request body
      const formData = (await request.json()) as FormData;
      console.log("📝 MSW: Form data received:", formData);

      // Use our mock backend to process the request with all simulation features
      const result = await mockBackend.saveData(formData);

      console.log("✅ MSW: Mock backend response:", result);

      // Return the response with proper headers
      return HttpResponse.json(result, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Mock-Response": "true",
          "X-Server-Time": new Date().toISOString(),
          "X-MSW-Intercepted": "true",
        },
      });
    } catch (error) {
      console.error("❌ MSW: Mock backend error:", error);

      // Return error response
      return HttpResponse.json(
        {
          error: (error as Error).message,
          timestamp: Date.now(),
        },
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Mock-Response": "true",
            "X-MSW-Intercepted": "true",
          },
        }
      );
    }
  }),

  // Handle test API calls
  http.post("/api/test", async ({ request }) => {
    console.log("🧪 MSW: Intercepting test API call");

    try {
      const body = await request.json();

      return HttpResponse.json(
        {
          success: true,
          message: "Test API call successful",
          timestamp: Date.now(),
          echo: body,
        },
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Test-Response": "true",
            "X-MSW-Intercepted": "true",
          },
        }
      );
    } catch (error) {
      return HttpResponse.json(
        {
          error: "Test API failed",
          message: (error as Error).message,
        },
        { status: 500 }
      );
    }
  }),
];
