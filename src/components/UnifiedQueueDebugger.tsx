import React, { useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../hooks/redux";
import {
  clearQueue,
  clearCompleted,
  manualRetryFailedItems,
  removeQueueItem,
  selectUnifiedItems,
  selectActiveItems,
  selectCompletedItems,
  selectFailedItems,
  selectBackoffConfig,
  calculateBackoffDelay,
  type UnifiedQueueItem,
} from "../store/autosaveSlice";
import "./QueueDebugger.css";

const UnifiedQueueDebugger: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isOnline } = useAppSelector((state) => state.autosave);
  const backoffConfig = useAppSelector(selectBackoffConfig);

  // Get all items with computed properties
  const allItems = useAppSelector(selectUnifiedItems);
  const activeItems = useAppSelector(selectActiveItems);
  const completedItems = useAppSelector(selectCompletedItems);
  const failedItems = useAppSelector(selectFailedItems);

  // Sort items by timestamp for FIFO display (oldest first = processing order)
  const sortedItems = useMemo(
    () => [...allItems].sort((a, b) => a.timestamp - b.timestamp),
    [allItems]
  );

  // Get unprocessed items in FIFO order
  const unprocessedItems = useMemo(
    () =>
      allItems
        .filter((item) => item.status === "pending" || item.status === "failed")
        .sort((a, b) => a.timestamp - b.timestamp),
    [allItems]
  );

  // Get currently processing item
  const currentlyProcessing = useMemo(
    () => allItems.find((item) => item.status === "processing"),
    [allItems]
  );

  const handleClearQueue = () => {
    dispatch(clearQueue());
  };

  const handleClearCompleted = () => {
    dispatch(clearCompleted());
  };

  const handleRetryFailed = () => {
    dispatch(manualRetryFailedItems());
  };

  const handleRemoveItem = (id: string) => {
    dispatch(removeQueueItem(id));
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Helper function to calculate remaining backoff time for failed items
  const getRemainingBackoffTime = (item: UnifiedQueueItem) => {
    if (item.status !== "failed" || !item.lastAttempt) return null;

    const backoffDelay = calculateBackoffDelay(
      backoffConfig.retryDelay,
      item.attempts - 1, // attempts is already incremented
      backoffConfig.backoffMultiplier,
      backoffConfig.maxBackoffDelay,
      false // Don't include jitter for display purposes
    );

    const timeSinceLastAttempt = Date.now() - item.lastAttempt;
    const remainingTime = backoffDelay - timeSinceLastAttempt;

    return {
      remainingMs: Math.max(0, remainingTime),
      totalBackoffMs: backoffDelay,
      isReady: remainingTime <= 0,
    };
  };

  const getStatusIcon = (status: UnifiedQueueItem["status"]) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "processing":
        return "🔄";
      case "completed":
        return "✅";
      case "failed":
        return "❌";
      case "abandoned":
        return "💀";
      default:
        return "❓";
    }
  };

  const getStatusColor = (status: UnifiedQueueItem["status"]) => {
    switch (status) {
      case "pending":
        return "#74c0fc";
      case "processing":
        return "#ffd93d";
      case "completed":
        return "#51cf66";
      case "failed":
        return "#ff6b6b";
      case "abandoned":
        return "#6f42c1";
      default:
        return "#adb5bd";
    }
  };

  const renderUnifiedItem = (item: UnifiedQueueItem, index: number) => {
    const isDuplicate = completedItems
      .filter(
        (completed) =>
          completed.id !== item.id && completed.status === "completed"
      )
      .some(
        (completed) =>
          JSON.stringify(completed.data) === JSON.stringify(item.data)
      );

    // Calculate FIFO queue position for unprocessed items
    const queuePosition =
      unprocessedItems.findIndex((unprocessed) => unprocessed.id === item.id) +
      1;
    const isInQueue = queuePosition > 0;

    return (
      <div
        key={item.id}
        className={`queue-item ${
          item.status === "processing" ? "currently-processing" : ""
        }`}
      >
        <div className="queue-item-header">
          <span
            className="queue-status"
            style={{ color: getStatusColor(item.status) }}
          >
            {getStatusIcon(item.status)} {item.status.toUpperCase()}
          </span>

          {item.status === "processing" && (
            <span className="processing-indicator">🔥 PROCESSING NOW</span>
          )}

          {item.status === "abandoned" &&
            item.error === "Superseded by manual save" && (
              <span
                className="abandoned-indicator"
                style={{
                  backgroundColor: "#e2e3e5",
                  color: "#6c757d",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "0.8em",
                  fontWeight: "bold",
                }}
              >
                🚫 SUPERSEDED BY MANUAL SAVE
              </span>
            )}

          {item.status === "abandoned" &&
            item.error !== "Superseded by manual save" && (
              <span
                className="abandoned-indicator"
                style={{
                  backgroundColor: "#f8d7da",
                  color: "#721c24",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "0.8em",
                  fontWeight: "bold",
                }}
              >
                💀 ABANDONED
              </span>
            )}

          {isInQueue && item.status !== "processing" && (
            <span
              className="queue-position-indicator"
              style={{
                backgroundColor: queuePosition === 1 ? "#ffd93d" : "#74c0fc",
                color: "#000",
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "0.8em",
                fontWeight: "bold",
              }}
            >
              {queuePosition === 1
                ? "🎯 NEXT IN QUEUE"
                : `📍 QUEUE POS: ${queuePosition}`}
            </span>
          )}

          {isDuplicate && item.status === "completed" && (
            <span className="duplicate-indicator">🔁 DUPLICATE</span>
          )}

          <span className="queue-position">#{index + 1}</span>

          <button
            onClick={() => handleRemoveItem(item.id)}
            className="remove-button"
            title="Remove from queue"
          >
            🗑️
          </button>
        </div>

        <div className="queue-item-details">
          <div className="detail-grid">
            <div className="queue-detail">
              <span className="detail-label">ID:</span>
              <span className="detail-value">{item.id.slice(0, 8)}...</span>
            </div>

            <div className="queue-detail">
              <span className="detail-label">Created:</span>
              <span className="detail-value">
                {formatTimestamp(item.timestamp)}
              </span>
            </div>

            <div className="queue-detail">
              <span className="detail-label">Attempts:</span>
              <span
                className={`detail-value ${
                  item.attempts > 1 ? "retry-count" : ""
                }`}
                style={{
                  color: item.attempts > 1 ? "#ff6b6b" : "inherit",
                  fontWeight: item.attempts > 1 ? "bold" : "normal",
                }}
              >
                {item.attempts}
                {item.attempts > 1 ? ` (retry ${item.attempts - 1})` : ""}
              </span>
            </div>

            {/* Show backoff information for failed items */}
            {item.status === "failed" &&
              (() => {
                const backoffInfo = getRemainingBackoffTime(item);
                if (backoffInfo) {
                  return (
                    <div className="queue-detail backoff-detail">
                      <span className="detail-label">Backoff:</span>
                      <span
                        className="detail-value"
                        style={{
                          color: backoffInfo.isReady ? "#51cf66" : "#ff6b6b",
                          fontWeight: "bold",
                        }}
                      >
                        {backoffInfo.isReady
                          ? "✅ Ready to retry"
                          : `⏳ ${formatDuration(
                              backoffInfo.remainingMs
                            )} (of ${formatDuration(
                              backoffInfo.totalBackoffMs
                            )})`}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

            {item.completedAt && (
              <div className="queue-detail">
                <span className="detail-label">Completed:</span>
                <span className="detail-value">
                  {formatTimestamp(item.completedAt)}
                </span>
              </div>
            )}

            {item.duration && (
              <div className="queue-detail">
                <span className="detail-label">Total Time:</span>
                <span className="detail-value">
                  {formatDuration(item.duration)}
                </span>
              </div>
            )}

            {item.processingDuration && (
              <div className="queue-detail">
                <span className="detail-label">Processing Time:</span>
                <span className="detail-value">
                  {formatDuration(item.processingDuration)}
                </span>
              </div>
            )}

            {item.error && (
              <div className="queue-detail error-detail">
                <span className="detail-label">Error:</span>
                <span className="detail-value error-text">{item.error}</span>
              </div>
            )}
          </div>

          <div className="queue-detail data-detail">
            <span className="detail-label">Data:</span>
            <pre className="detail-value">
              {JSON.stringify(item.data, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="queue-debugger unified">
      <div className="debugger-header">
        <h3>🔍 Unified Queue & History Debugger</h3>
        <div className="debugger-controls">
          <button
            onClick={handleClearCompleted}
            className="clear-button"
            disabled={completedItems.length === 0}
          >
            Clear Completed ({completedItems.length})
          </button>

          <button
            onClick={handleClearQueue}
            className="clear-button"
            disabled={allItems.length === 0}
          >
            Clear All ({allItems.length})
          </button>

          {failedItems.length > 0 && (
            <button
              onClick={handleRetryFailed}
              className="retry-button"
              disabled={!isOnline}
            >
              Retry Failed ({failedItems.length})
            </button>
          )}
        </div>
      </div>

      {/* Current Processing Status */}
      {currentlyProcessing && (
        <div className="current-processing">
          <h4>🔥 Currently Processing</h4>
          <div className="processing-item">
            <strong>ID:</strong> {currentlyProcessing.id.slice(0, 8)}... |
            <strong
              style={{
                color: currentlyProcessing.attempts > 1 ? "#ff6b6b" : "inherit",
              }}
            >
              {currentlyProcessing.attempts > 1
                ? ` Retry #${currentlyProcessing.attempts - 1}`
                : " First Attempt"}
            </strong>{" "}
            |<strong> Started:</strong>{" "}
            {currentlyProcessing.processingStarted
              ? formatTimestamp(currentlyProcessing.processingStarted)
              : "Unknown"}
            {currentlyProcessing.attempts > 1 && (
              <span
                style={{
                  color: "#ff6b6b",
                  fontWeight: "bold",
                  marginLeft: "10px",
                }}
              >
                (Total attempts: {currentlyProcessing.attempts})
              </span>
            )}
          </div>
        </div>
      )}

      <div className="debugger-stats">
        <div className="stat-item">
          <span className="stat-label">Total Items:</span>
          <span className="stat-value">{allItems.length}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Active:</span>
          <span className="stat-value">{activeItems.length}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Completed:</span>
          <span className="stat-value">
            {completedItems.filter((i) => i.status === "completed").length}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Failed:</span>
          <span className="stat-value">{failedItems.length}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Online:</span>
          <span className="stat-value">{isOnline ? "Yes" : "No"}</span>
        </div>
      </div>

      {/* FIFO Queue Status */}
      {unprocessedItems.length > 0 && (
        <div
          className="fifo-queue-status"
          style={{
            backgroundColor: "#e3f2fd",
            border: "1px solid #2196f3",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "16px",
          }}
        >
          <h4 style={{ margin: "0 0 8px 0", color: "#1976d2" }}>
            📋 FIFO Queue Status
          </h4>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span>
              <strong>Items in Queue:</strong> {unprocessedItems.length}
            </span>
            {unprocessedItems[0] && (
              <span>
                <strong>Next to Process:</strong>{" "}
                {unprocessedItems[0].id.slice(0, 8)}...
                {unprocessedItems[0].status === "failed"
                  ? " (retry)"
                  : " (new)"}
              </span>
            )}
            <span>
              <strong>Processing Order:</strong> Oldest → Newest (strict FIFO)
            </span>
          </div>
        </div>
      )}

      {/* Backoff Configuration Panel */}
      <div
        className="backoff-config-panel"
        style={{
          backgroundColor: "#f8f9fa",
          border: "1px solid #dee2e6",
          borderRadius: "8px",
          padding: "12px",
          marginBottom: "16px",
        }}
      >
        <h4 style={{ margin: "0 0 8px 0", color: "#495057" }}>
          ⚙️ Exponential Backoff Configuration
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
            fontSize: "0.9em",
          }}
        >
          <div>
            <strong>Base Delay:</strong>{" "}
            {formatDuration(backoffConfig.retryDelay)}
          </div>
          <div>
            <strong>Multiplier:</strong> {backoffConfig.backoffMultiplier}x
          </div>
          <div>
            <strong>Max Delay:</strong>{" "}
            {formatDuration(backoffConfig.maxBackoffDelay)}
          </div>
          <div>
            <strong>Jitter:</strong>{" "}
            {backoffConfig.jitterEnabled ? "Enabled (±25%)" : "Disabled"}
          </div>
          <div>
            <strong>Retry Limit:</strong>{" "}
            <span style={{ color: "#28a745", fontWeight: "bold" }}>
              Unlimited ∞
            </span>
          </div>
          <div>
            <strong>Abandon Only:</strong>{" "}
            <span style={{ color: "#6c757d" }}>Manual Save Override</span>
          </div>
        </div>
        <div style={{ marginTop: "8px", fontSize: "0.8em", color: "#6c757d" }}>
          <strong>Example delays:</strong> 1st retry:{" "}
          {formatDuration(backoffConfig.retryDelay)} → 2nd:{" "}
          {formatDuration(
            Math.min(
              backoffConfig.retryDelay * backoffConfig.backoffMultiplier,
              backoffConfig.maxBackoffDelay
            )
          )}{" "}
          → 3rd:{" "}
          {formatDuration(
            Math.min(
              backoffConfig.retryDelay *
                Math.pow(backoffConfig.backoffMultiplier, 2),
              backoffConfig.maxBackoffDelay
            )
          )}{" "}
          → ∞ retries until success or manual save
        </div>
      </div>

      <div className="debugger-content">
        <div className="unified-section">
          <h4>📋 Complete Queue Lifecycle (Newest First)</h4>
          {allItems.length === 0 ? (
            <div className="empty-state">No items yet</div>
          ) : (
            <div className="queue-list">
              {sortedItems.map((item, index) => renderUnifiedItem(item, index))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedQueueDebugger;
