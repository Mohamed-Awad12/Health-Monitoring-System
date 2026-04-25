export default function EmptyState({ title, description, icon: Icon }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-state-icon">
          <Icon />
        </div>
      )}
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
