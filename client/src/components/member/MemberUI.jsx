import './MemberUI.css';

/**
 * Standardized Member Portal page header: title, concise subtitle, optional actions.
 */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="member-page-header">
      <div className="member-page-heading">
        <h1 className="member-page-title">{title}</h1>
        {subtitle && <p className="member-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="member-page-actions">{actions}</div>}
    </header>
  );
}

/**
 * Quiet status indicator tag with semantic dot.
 */
export function StatusTag({ variant = 'neutral', children, className = '' }) {
  return (
    <span className={`status-tag is-${variant} ${className}`.trim()}>
      <span className="status-tag-dot" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

/**
 * Standardized accessible progress bar with hairline track.
 */
export function ProgressBar({
  value = 0,
  label,
  valueText,
  valueTestId,
  fillTestId,
  variant = 'accent',
}) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="member-progress">
      {(label || valueText) && (
        <div className="member-progress-meta">
          <span>{label}</span>
          {valueText && <span data-testid={valueTestId}>{valueText}</span>}
        </div>
      )}
      <div
        className="member-progress-track"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div
          className={`member-progress-fill is-${variant}`}
          style={{ width: `${clamped}%` }}
          data-testid={fillTestId}
        />
      </div>
    </div>
  );
}

/**
 * Unified loading or empty state panel.
 */
export function StatePanel({ icon: Icon, title, description, action, testId, spinIcon = false }) {
  return (
    <div className="member-state-panel" data-testid={testId}>
      {Icon && (
        <div className="member-state-icon" aria-hidden="true">
          <Icon size={18} strokeWidth={1.65} className={spinIcon ? 'member-spin' : ''} />
        </div>
      )}
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
