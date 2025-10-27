import type { FormData } from "../types";

export interface BackendResponse {
  success: boolean;
  message?: string;
  timestamp?: number;
}

export class MockBackendService {
  private static instance: MockBackendService;
  private failureRate: number = 0.3; // 30% failure rate
  private responseDelay: { min: number; max: number } = { min: 500, max: 2000 };
  private isServerDown: boolean = false;
  private savedData: Array<FormData & { savedAt: number }> = [];

  private constructor() {}

  static getInstance(): MockBackendService {
    if (!MockBackendService.instance) {
      MockBackendService.instance = new MockBackendService();
    }
    return MockBackendService.instance;
  }

  // Configure failure rate (0-1)
  setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  // Configure response delay
  setResponseDelay(min: number, max: number): void {
    this.responseDelay = { min, max };
  }

  // Simulate server downtime
  setServerDown(isDown: boolean): void {
    this.isServerDown = isDown;
  }

  // Get current configuration
  getConfig() {
    return {
      failureRate: this.failureRate,
      responseDelay: this.responseDelay,
      isServerDown: this.isServerDown,
      savedItemsCount: this.savedData.length,
    };
  }

  // Simulate network delay
  private async simulateDelay(): Promise<void> {
    const delay =
      Math.random() * (this.responseDelay.max - this.responseDelay.min) +
      this.responseDelay.min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Main save method
  async saveData(data: FormData): Promise<BackendResponse> {
    console.log(
      `🔄 Mock Backend: Attempting to save data for ${data.name || "unnamed"}`
    );

    // Simulate network delay
    await this.simulateDelay();

    // Check if server is down
    if (this.isServerDown) {
      console.log("❌ Mock Backend: Server is down");
      throw new Error("Server is currently down for maintenance");
    }

    // Simulate random failures
    if (Math.random() < this.failureRate) {
      const errorMessages = [
        "Database connection timeout",
        "Validation failed: Invalid data format",
        "Server overloaded, please try again",
        "Authentication token expired",
        "Rate limit exceeded",
      ];

      const randomError =
        errorMessages[Math.floor(Math.random() * errorMessages.length)];
      console.log(`❌ Mock Backend: ${randomError}`);
      throw new Error(randomError);
    }

    // Success case - save the data
    const savedItem = {
      ...data,
      savedAt: Date.now(),
    };

    this.savedData.push(savedItem);
    console.log(
      `✅ Mock Backend: Successfully saved data for ${data.name || "unnamed"}`
    );

    return {
      success: true,
      message: "Data saved successfully",
      timestamp: savedItem.savedAt,
    };
  }

  // Get all saved data (for testing purposes)
  getSavedData(): Array<FormData & { savedAt: number }> {
    return [...this.savedData];
  }

  // Clear saved data
  clearSavedData(): void {
    this.savedData = [];
    console.log("🗑️ Mock Backend: Cleared all saved data");
  }

  // Simulate different error scenarios
  simulateErrorScenario(
    scenario: "network" | "server-down" | "high-failure" | "normal"
  ): void {
    switch (scenario) {
      case "network":
        this.setResponseDelay(3000, 8000);
        this.setFailureRate(0.6);
        console.log("🌐 Mock Backend: Simulating poor network conditions");
        break;

      case "server-down":
        this.setServerDown(true);
        console.log("🔴 Mock Backend: Server is now down");
        break;

      case "high-failure":
        this.setFailureRate(0.8);
        console.log("⚠️ Mock Backend: High failure rate active");
        break;

      case "normal":
        this.setResponseDelay(500, 2000);
        this.setFailureRate(0.3);
        this.setServerDown(false);
        console.log("✅ Mock Backend: Normal conditions restored");
        break;
    }
  }

  // Get statistics
  getStats() {
    return {
      totalSaved: this.savedData.length,
      lastSaved:
        this.savedData.length > 0
          ? this.savedData[this.savedData.length - 1]
          : null,
      config: this.getConfig(),
    };
  }
}

// Export singleton instance
export const mockBackend = MockBackendService.getInstance();
