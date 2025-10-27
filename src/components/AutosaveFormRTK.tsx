import React, { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useAutosave } from "../hooks/useAutosaveRTK";
import { useAppDispatch, useAppSelector } from "../hooks/redux";
import {
  setOnlineStatus,
  retryFailedItems,
  queueSave,
  abandonUnprocessedItems,
} from "../store/autosaveSlice";
import { useTestApiMutation } from "../store/formApi";
import { mockBackend } from "../services/mockBackend";
import UnifiedQueueDebugger from "./UnifiedQueueDebugger";
import type { FormData } from "../types";
import "./AutosaveForm.css";

const AutosaveFormRTK: React.FC = () => {
  const dispatch = useAppDispatch();
  const [manualSaveStatus, setManualSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");

  const { control, register } = useForm<FormData>({
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      message: "",
    },
  });

  // Watch individual fields to prevent input conflicts
  const name = useWatch({ control, name: "name" });
  const email = useWatch({ control, name: "email" });
  const message = useWatch({ control, name: "message" });

  // Combine watched values for autosave
  const formData = { name, email, message };

  // RTK Query test mutation
  const [testApi] = useTestApiMutation();

  // Get online status from Redux
  const { isOnline, allItems } = useAppSelector((state) => state.autosave);

  // Get failed items count
  const failedItems = allItems.filter((item) => item.status === "failed");

  // Autosave hook (RTK Query version)
  const { isProcessing, queueLength, pendingCount, hasFailures } = useAutosave({
    data: formData,
  });

  // Calculate last save time from completed items
  const lastSaveTime = useMemo(() => {
    const completedItems = allItems.filter((item) => item.completedAt);
    if (completedItems.length === 0) return null;
    return Math.max(...completedItems.map((item) => item.completedAt!));
  }, [allItems]);

  // Log form changes for debugging
  useEffect(() => {
    console.log("AutosaveFormRTK values:", formData);
  }, [formData]);

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusColor = () => {
    if (!isOnline) return "#ff6b6b";
    if (hasFailures) return "#ff8c42";
    if (isProcessing) return "#ffd93d";
    if (queueLength > 0) return "#74c0fc";
    return "#51cf66";
  };

  const getStatusText = () => {
    if (!isOnline) return `Offline - ${queueLength} items queued`;
    if (hasFailures)
      return `${failedItems.length} failed items - manual retry available`;
    if (isProcessing) return "Saving...";
    if (queueLength > 0)
      return `${pendingCount} pending, ${queueLength} total in queue`;
    return "All saved";
  };

  const handleToggleOnline = () => {
    const newOnlineStatus = !isOnline;

    // Update Redux state
    dispatch(setOnlineStatus(newOnlineStatus));

    // Sync with mock backend (when going offline, set server down)
    mockBackend.setServerDown(!newOnlineStatus);

    console.log(`🌐 Status changed: ${newOnlineStatus ? "ONLINE" : "OFFLINE"}`);
    console.log(`🖥️ Backend synced: ${newOnlineStatus ? "UP" : "DOWN"}`);
  };

  const handleTestApiCall = async () => {
    console.log("🧪 Testing MSW API call...");
    try {
      const testData = {
        test: true,
        timestamp: Date.now(),
        message: "MSW test call",
      };

      const result = await testApi(testData).unwrap();
      console.log("✅ MSW API call successful:", result);
      alert("✅ MSW API call successful! Check Network tab and console.");
    } catch (error) {
      console.error("❌ MSW API call failed:", error);
      alert("❌ MSW API call failed! Check console for details.");
    }
  };

  const handleManualRetry = () => {
    console.log("🔄 Manual retry triggered for failed items");
    dispatch(retryFailedItems());
  };

  const handleManualSave = () => {
    console.log("💾 Manual save triggered");

    // Check if form has meaningful content first
    const hasContent = Object.values(formData).some(
      (value) => value && typeof value === "string" && value.trim().length > 0
    );

    if (!hasContent) {
      alert("⚠️ Please fill out at least one field before saving.");
      return;
    }

    // Check if there's an item currently being processed (in-flight request)
    const currentlyProcessing = allItems.find(
      (item) => item.status === "processing"
    );
    if (currentlyProcessing || isProcessing) {
      alert(
        "⚠️ Please wait for the current save operation to complete before manually saving."
      );
      console.log("🚫 Manual save blocked: Item currently being processed");
      return;
    }

    // Check for unprocessed items and ask user for confirmation
    const unprocessedItems = allItems.filter(
      (item) => item.status === "pending" || item.status === "failed"
    );

    if (unprocessedItems.length > 0) {
      const confirmed = window.confirm(
        `⚠️ Manual save will abandon ${unprocessedItems.length} unprocessed autosave item(s) in the queue.\n\n` +
          `These items represent older versions of your form data that haven't been saved yet.\n\n` +
          `Click OK to proceed with manual save (recommended) or Cancel to let autosave continue processing the queue.`
      );

      if (!confirmed) {
        console.log(
          "🚫 Manual save cancelled by user - letting autosave continue"
        );
        return;
      }

      console.log(
        `🚫 User confirmed: Abandoning ${unprocessedItems.length} unprocessed items due to manual save:`
      );
      unprocessedItems.forEach((item) => {
        console.log(`  - ${item.id.slice(0, 8)}... (${item.status})`);
      });
      dispatch(abandonUnprocessedItems());
    }

    setManualSaveStatus("saving");

    const formDataToSave: FormData = {
      id: crypto.randomUUID(),
      name: formData.name || "",
      email: formData.email || "",
      message: formData.message || "",
      timestamp: Date.now(),
    };

    dispatch(queueSave(formDataToSave));

    // Provide immediate feedback
    setManualSaveStatus("saved");

    // Reset status after a delay
    setTimeout(() => {
      setManualSaveStatus("idle");
    }, 2000);
  };

  return (
    <div className="autosave-form">
      <div className="form-header">
        <h2>Secure Autosaving Form (RTK Query + MSW)</h2>
        <div className="status-indicator">
          <div
            className="status-dot"
            style={{ backgroundColor: getStatusColor() }}
          />
          <span className="status-text">{getStatusText()}</span>
        </div>
      </div>

      <form className="form-container">
        <div className="form-group">
          <label htmlFor="name">Name:</label>
          <input
            {...register("name")}
            type="text"
            id="name"
            placeholder="Enter your name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            {...register("email")}
            type="email"
            id="email"
            placeholder="Enter your email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="message">Message:</label>
          <textarea
            {...register("message")}
            id="message"
            rows={4}
            placeholder="Enter your message"
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={handleManualSave}
            className="manual-save-button"
            disabled={manualSaveStatus === "saving" || isProcessing}
            style={{
              backgroundColor: isProcessing
                ? "#fd7e14" // orange when blocked by active processing
                : manualSaveStatus === "saved"
                ? "#28a745"
                : manualSaveStatus === "saving"
                ? "#6c757d"
                : "#007bff",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: "6px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor:
                manualSaveStatus === "saving" || isProcessing
                  ? "not-allowed"
                  : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s",
              opacity: manualSaveStatus === "saving" || isProcessing ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (manualSaveStatus === "idle" && !isProcessing) {
                e.currentTarget.style.backgroundColor = "#0056b3";
              }
            }}
            onMouseLeave={(e) => {
              if (manualSaveStatus === "idle" && !isProcessing) {
                e.currentTarget.style.backgroundColor = "#007bff";
              }
            }}
          >
            {isProcessing && "🚫 Processing..."}
            {!isProcessing && manualSaveStatus === "saving" && "⏳ Saving..."}
            {!isProcessing && manualSaveStatus === "saved" && "✅ Saved!"}
            {!isProcessing &&
              manualSaveStatus === "idle" &&
              pendingCount > 0 &&
              "💾 Save Now (Override Queue)"}
            {!isProcessing &&
              manualSaveStatus === "idle" &&
              pendingCount === 0 &&
              "💾 Save Form Now"}
          </button>
        </div>
      </form>

      {/* Manual Save Impact Indicator */}
      {pendingCount > 0 && !isProcessing && (
        <div
          style={{
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "6px",
            padding: "12px",
            margin: "16px 0",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "20px" }}>⚠️</span>
          <div>
            <strong>Pending autosave items in queue</strong>
            <div style={{ fontSize: "14px", color: "#856404" }}>
              You have {pendingCount} unprocessed autosave item(s). Manual save
              will ask for confirmation before abandoning them since it
              represents your latest form data.
            </div>
          </div>
        </div>
      )}

      {/* Processing Block Indicator */}
      {isProcessing && (
        <div
          style={{
            backgroundColor: "#f8d7da",
            border: "1px solid #f5c6cb",
            borderRadius: "6px",
            padding: "12px",
            margin: "16px 0",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "20px" }}>🔄</span>
          <div>
            <strong>Save in progress</strong>
            <div style={{ fontSize: "14px", color: "#721c24" }}>
              Please wait for the current save operation to complete before
              manually saving.
            </div>
          </div>
        </div>
      )}

      <div className="debug-section">
        <h3>System Status</h3>
        <div className="debug-grid">
          <div className="debug-item">
            <span className="debug-label">Redux Status:</span>
            <span className="debug-value">
              {isOnline ? "Online" : "Offline"}
            </span>
            <button onClick={handleToggleOnline} className="toggle-button">
              Go {isOnline ? "Offline" : "Online"}
            </button>
          </div>

          <div className="debug-item">
            <span className="debug-label">Backend Status:</span>
            <span className="debug-value">
              {mockBackend.getConfig().isServerDown ? "DOWN" : "UP"}
              (Failure Rate:{" "}
              {(mockBackend.getConfig().failureRate * 100).toFixed(0)}%)
            </span>
            <button
              onClick={handleTestApiCall}
              className="toggle-button"
              style={{ marginLeft: "10px" }}
            >
              🧪 Test API
            </button>
          </div>

          {failedItems.length > 0 && (
            <div className="debug-item">
              <span className="debug-label">Failed Items:</span>
              <span
                className="debug-value"
                style={{ color: "#ff6b6b", fontWeight: "bold" }}
              >
                {failedItems.length} failed items
              </span>
              <button
                onClick={handleManualRetry}
                className="retry-button"
                style={{
                  marginLeft: "10px",
                  backgroundColor: "#ff6b6b",
                  color: "white",
                  border: "none",
                  padding: "5px 10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                🔄 Retry All Failed
              </button>
            </div>
          )}

          <div className="debug-item">
            <span className="debug-label">Queue Status:</span>
            <span className="debug-value">
              {queueLength} items ({pendingCount} pending, {failedItems.length}{" "}
              failed)
            </span>
          </div>

          <div className="debug-item">
            <span className="debug-label">Processing:</span>
            <span className="debug-value">{isProcessing ? "Yes" : "No"}</span>
          </div>

          <div className="debug-item">
            <span className="debug-label">Last Save:</span>
            <span className="debug-value">{formatTimestamp(lastSaveTime)}</span>
          </div>

          <div className="debug-item">
            <span className="debug-label">Form Data:</span>
            <pre className="debug-value">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      <UnifiedQueueDebugger />
    </div>
  );
};

export default AutosaveFormRTK;
