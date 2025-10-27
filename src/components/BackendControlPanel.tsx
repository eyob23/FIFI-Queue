import React, { useState, useEffect } from "react";
import { mockBackend } from "../services/mockBackend";
import "./BackendControlPanel.css";

const BackendControlPanel: React.FC = () => {
  const [config, setConfig] = useState(mockBackend.getConfig());
  const [stats, setStats] = useState(mockBackend.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setConfig(mockBackend.getConfig());
      setStats(mockBackend.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleFailureRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(e.target.value) / 100;
    mockBackend.setFailureRate(rate);
    setConfig(mockBackend.getConfig());
  };

  const handleDelayChange = (type: "min" | "max", value: string) => {
    const delay = parseInt(value) || 0;
    if (type === "min") {
      mockBackend.setResponseDelay(delay, config.responseDelay.max);
    } else {
      mockBackend.setResponseDelay(config.responseDelay.min, delay);
    }
    setConfig(mockBackend.getConfig());
  };

  const toggleServerStatus = () => {
    mockBackend.setServerDown(!config.isServerDown);
    setConfig(mockBackend.getConfig());
  };

  const simulateScenario = (
    scenario: "network" | "server-down" | "high-failure" | "normal"
  ) => {
    mockBackend.simulateErrorScenario(scenario);
    setConfig(mockBackend.getConfig());
  };

  const clearData = () => {
    mockBackend.clearSavedData();
    setStats(mockBackend.getStats());
  };

  return (
    <div className="backend-control-panel">
      <h3>🔧 Mock Backend Control Panel</h3>

      <div className="control-section">
        <h4>Server Status</h4>
        <div className="control-row">
          <button
            onClick={toggleServerStatus}
            className={`btn ${
              config.isServerDown ? "btn-danger" : "btn-success"
            }`}
          >
            {config.isServerDown ? "🔴 Server Down" : "🟢 Server Online"}
          </button>
        </div>
      </div>

      <div className="control-section">
        <h4>Failure Rate</h4>
        <div className="control-row">
          <input
            type="range"
            min="0"
            max="100"
            value={config.failureRate * 100}
            onChange={handleFailureRateChange}
            className="slider"
          />
          <span className="value">
            {(config.failureRate * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="control-section">
        <h4>Response Delay (ms)</h4>
        <div className="control-row">
          <label>
            Min:
            <input
              type="number"
              value={config.responseDelay.min}
              onChange={(e) => handleDelayChange("min", e.target.value)}
              className="number-input"
            />
          </label>
          <label>
            Max:
            <input
              type="number"
              value={config.responseDelay.max}
              onChange={(e) => handleDelayChange("max", e.target.value)}
              className="number-input"
            />
          </label>
        </div>
      </div>

      <div className="control-section">
        <h4>Quick Scenarios</h4>
        <div className="scenario-buttons">
          <button
            onClick={() => simulateScenario("normal")}
            className="btn btn-success"
          >
            😊 Normal
          </button>
          <button
            onClick={() => simulateScenario("network")}
            className="btn btn-warning"
          >
            🌐 Poor Network
          </button>
          <button
            onClick={() => simulateScenario("high-failure")}
            className="btn btn-warning"
          >
            ⚠️ High Failures
          </button>
          <button
            onClick={() => simulateScenario("server-down")}
            className="btn btn-danger"
          >
            🔴 Server Down
          </button>
        </div>
      </div>

      <div className="control-section">
        <h4>Statistics</h4>
        <div className="stats-grid">
          <div className="stat-item">
            <strong>Total Saved:</strong> {stats.totalSaved}
          </div>
          <div className="stat-item">
            <strong>Last Saved:</strong>
            {stats.lastSaved ? (
              <div className="last-saved-info">
                <div>{stats.lastSaved.name || "Unnamed"}</div>
                <div className="timestamp">
                  {new Date(stats.lastSaved.savedAt).toLocaleTimeString()}
                </div>
              </div>
            ) : (
              "None"
            )}
          </div>
        </div>
        <button onClick={clearData} className="btn btn-secondary">
          🗑️ Clear Saved Data
        </button>
      </div>
    </div>
  );
};

export default BackendControlPanel;
