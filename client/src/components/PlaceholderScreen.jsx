import './PlaceholderScreen.css';

/**
 * PlaceholderScreen — Reusable placeholder view for blueprint screens
 * used during the initial foundation phase before full feature implementation.
 */
export default function PlaceholderScreen({
  title,
  screenNumber,
  role,
  day,
  description,
  features = [],
  icon: Icon,
}) {
  return (
    <div className="placeholder-screen">
      <div className="card placeholder-card">
        <div className="placeholder-header">
          {Icon && (
            <div className="placeholder-icon-wrap">
              <Icon size={28} className="text-accent" />
            </div>
          )}
          <div className="placeholder-meta">
            {screenNumber && (
              <span className="badge badge-accent">Screen {screenNumber}</span>
            )}
            {role && <span className="badge badge-warning">{role}</span>}
            {day && <span className="badge badge-info">Planned: Day {day}</span>}
          </div>
        </div>

        <h2 className="placeholder-title">{title}</h2>
        <p className="placeholder-desc">{description}</p>

        {features.length > 0 && (
          <div className="placeholder-features">
            <h3>Planned Capabilities:</h3>
            <ul>
              {features.map((feat, index) => (
                <li key={index}>
                  <span className="bullet">✓</span>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="placeholder-footer">
          <span className="placeholder-status-dot"></span>
          <span>Application Shell & Routing Connected</span>
        </div>
      </div>
    </div>
  );
}
