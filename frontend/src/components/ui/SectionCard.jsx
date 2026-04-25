export default function SectionCard({ title, actions, children, className = "" }) {
  const sectionClassName = className ? `section-card ${className}` : "section-card";

  return (
    <section className={sectionClassName}>
      <div className="section-card-header">
        <h2>{title}</h2>
        {actions}
      </div>
      <div className="section-card-body">{children}</div>
    </section>
  );
}
