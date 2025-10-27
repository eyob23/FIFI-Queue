import { Provider } from "react-redux";
import { store } from "./store";
import AutosaveFormRTK from "./components/AutosaveFormRTK";
import BackendControlPanel from "./components/BackendControlPanel";
import "./App.css";

function App() {
  return (
    <Provider store={store}>
      <div className="app">
        <header className="app-header">
          <h1>🔒 FIFI-Queue: RTK Query Autosave Demo</h1>
          <p>
            A resilient, offline-capable autosaving form system with RTK Query,
            FIFO queue management, and multi-tab coordination.
          </p>
        </header>

        <main className="app-main">
          <div className="form-section">
            <AutosaveFormRTK />
          </div>

          <div className="control-section">
            <BackendControlPanel />
          </div>
        </main>

        <footer className="app-footer">
          <p>
            Built with TypeScript, React, Redux Toolkit, and RTK Query. Features
            offline-safe autosaving with guaranteed delivery.
          </p>
        </footer>
      </div>
    </Provider>
  );
}

export default App;
