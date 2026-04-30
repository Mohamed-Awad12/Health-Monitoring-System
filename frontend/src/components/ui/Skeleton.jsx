const createPlaceholders = (count) => Array.from({ length: count }, (_, index) => index);

function SkeletonState({ label, className = "", children }) {
  const skeletonStateClassName = className
    ? `skeleton-state ${className}`
    : "skeleton-state";

  return (
    <div
      className={skeletonStateClassName}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {children}
    </div>
  );
}

export function SkeletonBlock({ as: Component = "div", className = "", ...props }) {
  const skeletonBlockClassName = className
    ? `skeleton-block ${className}`
    : "skeleton-block";

  return <Component className={skeletonBlockClassName} aria-hidden="true" {...props} />;
}

function MetricCardSkeleton({ variant = "" }) {
  const className = variant
    ? `metric-card skeleton-card ${variant}`
    : "metric-card skeleton-card";

  return (
    <article className={className} aria-hidden="true">
      <div className="metric-card-header">
        <SkeletonBlock className="skeleton-line skeleton-line-label" />
        <SkeletonBlock className="skeleton-pill" />
      </div>
      <div className="metric-card-value">
        <SkeletonBlock className="skeleton-line skeleton-line-value" />
        <SkeletonBlock className="skeleton-line skeleton-line-unit" />
      </div>
      <SkeletonBlock className="skeleton-line skeleton-line-caption" />
    </article>
  );
}

function SnapshotCardSkeleton() {
  return (
    <div className="snapshot-status-card skeleton-card" aria-hidden="true">
      <SkeletonBlock className="skeleton-line skeleton-line-label" />
      <SkeletonBlock className="skeleton-line skeleton-line-body" />
      <SkeletonBlock className="skeleton-pill skeleton-pill-tight" />
    </div>
  );
}

export function OverviewSkeleton({
  label,
  metricVariants = [],
  metricCount = 4,
  showChart = true,
  showSnapshots = false,
}) {
  return (
    <SkeletonState label={label}>
      {showSnapshots ? (
        <div className="snapshot-status-grid">
          {createPlaceholders(3).map((item) => (
            <SnapshotCardSkeleton key={`snapshot-skeleton-${item}`} />
          ))}
        </div>
      ) : null}

      <div className="metrics-grid">
        {createPlaceholders(metricCount).map((item) => (
          <MetricCardSkeleton
            key={`metric-skeleton-${item}`}
            variant={metricVariants[item]}
          />
        ))}
      </div>

      {showChart ? (
        <div className="chart-wrapper live-chart skeleton-card" aria-hidden="true">
          <SkeletonBlock className="skeleton-chart" />
        </div>
      ) : null}
    </SkeletonState>
  );
}

export function AlertListSkeleton({ label, count = 3 }) {
  return (
    <SkeletonState label={label}>
      <div className="alert-list timeline-list">
        {createPlaceholders(count).map((item) => (
          <article
            key={`alert-skeleton-${item}`}
            className="alert-item timeline-item skeleton-card"
            aria-hidden="true"
            style={{ "--timeline-delay": `${Math.min(item, 6) * 55}ms` }}
          >
            <span className="timeline-node skeleton-node" />
            <div className="alert-item-main">
              <div className="alert-item-header">
                <SkeletonBlock className="skeleton-line skeleton-line-title" />
                <SkeletonBlock className="skeleton-pill" />
              </div>
              <SkeletonBlock className="skeleton-line skeleton-line-body" />
              <SkeletonBlock className="skeleton-line skeleton-line-short" />
            </div>
            <SkeletonBlock className="skeleton-button skeleton-inline-button" />
          </article>
        ))}
      </div>
    </SkeletonState>
  );
}

export function StatusCardListSkeleton({
  label,
  count = 2,
  className = "status-detail-card",
  showActions = false,
}) {
  return (
    <SkeletonState label={label}>
      <div className="stack-list">
        {createPlaceholders(count).map((item) => (
          <article
            key={`${className}-skeleton-${item}`}
            className={`${className} skeleton-card`}
            aria-hidden="true"
          >
            <div className="status-detail-header">
              <div className="skeleton-text-stack">
                <SkeletonBlock className="skeleton-line skeleton-line-title" />
                <SkeletonBlock className="skeleton-line skeleton-line-caption" />
              </div>
              <SkeletonBlock className="skeleton-pill" />
            </div>
            <div className="skeleton-text-stack">
              <SkeletonBlock className="skeleton-line skeleton-line-body" />
              <SkeletonBlock className="skeleton-line skeleton-line-short" />
              <SkeletonBlock className="skeleton-line skeleton-line-caption" />
            </div>

            {showActions ? (
              <div className="skeleton-button-row">
                <SkeletonBlock className="skeleton-button" />
                <SkeletonBlock className="skeleton-button skeleton-button-secondary" />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </SkeletonState>
  );
}

export function DirectorySkeleton({ label, count = 4 }) {
  return (
    <SkeletonState label={label}>
      <div className="doctor-directory">
        {createPlaceholders(count).map((item) => (
          <article
            key={`doctor-skeleton-${item}`}
            className="doctor-option-card skeleton-card"
            aria-hidden="true"
          >
            <div className="status-detail-header">
              <div className="skeleton-text-stack">
                <SkeletonBlock className="skeleton-line skeleton-line-title" />
                <SkeletonBlock className="skeleton-line skeleton-line-caption" />
              </div>
              <SkeletonBlock className="skeleton-pill" />
            </div>
            <SkeletonBlock className="skeleton-line skeleton-line-body" />
            <SkeletonBlock className="skeleton-line skeleton-line-short" />
            <div className="skeleton-button-row">
              <SkeletonBlock className="skeleton-button" />
              <SkeletonBlock className="skeleton-button skeleton-button-secondary" />
            </div>
          </article>
        ))}
      </div>
    </SkeletonState>
  );
}

export function DevicePanelSkeleton({ label }) {
  return (
    <SkeletonState label={label}>
      <div className="stack-list device-status-panel skeleton-card" aria-hidden="true">
        {createPlaceholders(3).map((item) => (
          <div key={`device-line-skeleton-${item}`} className="line-item skeleton-inline-row">
            <SkeletonBlock className="skeleton-line skeleton-line-label" />
            <SkeletonBlock className="skeleton-line skeleton-line-short" />
          </div>
        ))}
      </div>
    </SkeletonState>
  );
}

export function PatientListSkeleton({ label, count = 4 }) {
  return (
    <SkeletonState label={label}>
      <div className="patient-list">
        {createPlaceholders(count).map((item) => (
          <div
            key={`patient-skeleton-${item}`}
            className="patient-list-item skeleton-card"
            aria-hidden="true"
          >
            <div className="skeleton-text-stack">
              <SkeletonBlock className="skeleton-line skeleton-line-title" />
              <SkeletonBlock className="skeleton-line skeleton-line-caption" />
            </div>
            <div className="patient-list-metrics skeleton-inline-row">
              <SkeletonBlock className="skeleton-line skeleton-line-body" />
              <SkeletonBlock className="skeleton-pill" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonState>
  );
}

export function AdminUsersSkeleton({ label, count = 4 }) {
  return (
    <SkeletonState label={label}>
      <div className="admin-users-list">
        {createPlaceholders(count).map((item) => (
          <article
            key={`admin-user-skeleton-${item}`}
            className="admin-user-card skeleton-card"
            aria-hidden="true"
          >
            <div className="admin-user-card-head">
              <div className="skeleton-text-stack">
                <SkeletonBlock className="skeleton-line skeleton-line-title" />
                <SkeletonBlock className="skeleton-line skeleton-line-caption" />
              </div>
              <SkeletonBlock className="skeleton-pill" />
            </div>

            <div className="admin-user-meta">
              {createPlaceholders(5).map((metaItem) => (
                <SkeletonBlock
                  key={`admin-user-meta-skeleton-${item}-${metaItem}`}
                  className="skeleton-line skeleton-line-meta"
                />
              ))}
            </div>

            <div className="skeleton-button-row">
              <SkeletonBlock className="skeleton-button skeleton-button-secondary" />
              <SkeletonBlock className="skeleton-button" />
              <SkeletonBlock className="skeleton-button skeleton-button-secondary" />
            </div>
          </article>
        ))}
      </div>
    </SkeletonState>
  );
}
