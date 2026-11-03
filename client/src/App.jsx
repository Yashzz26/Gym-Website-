import './App.css';

/**
 * App — root component.
 *
 * Routing, auth context and role-based layout will be wired in on Day 3
 * (Task 5). Design tokens and global CSS established in Day 2 (Task 3).
 */
function App() {
  return (
    <div className="app-root">
      <div className="card app-card">
        <span className="badge badge-accent">Foundation Phase</span>
        <h1>Gym Management System</h1>
        <p className="subtitle">React + Vite frontend initialised. 🚀</p>
        <p className="note">
          Global CSS and design tokens loaded. Dark navy surfaces with neon lime
          accents configured according to the blueprint.
        </p>
        <div className="token-preview">
          <span className="badge badge-success">Active</span>
          <span className="badge badge-warning">Pending</span>
          <span className="badge badge-danger">Overdue</span>
        </div>
      </div>
    </div>
  );
}

export default App;
