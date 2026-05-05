export default function SlideSection({
  id,
  eyebrow,
  title,
  description,
  highlights,
  stats,
  cards,
  narrative,
  ctas,
  sectionRef,
}) {
  return (
    <section id={id} ref={sectionRef} className="slide-section">
      <div className="slide-panel" data-panel>
        <div className="slide-panel-aura slide-panel-aura-one" aria-hidden="true" />
        <div className="slide-panel-aura slide-panel-aura-two" aria-hidden="true" />
        <div className="slide-panel-grid" aria-hidden="true" />

        <div className="slide-panel-rail" data-parallax="rail">
          <span />
          <small>{id}</small>
        </div>

        <div className="slide-copy" data-parallax="copy">
          <p className="slide-eyebrow" data-reveal="eyebrow">
            {eyebrow}
          </p>
          <h2 className="slide-title" data-reveal="title">
            {title}
          </h2>
          <p className="slide-description" data-reveal="description">
            {description}
          </p>
        </div>

        {highlights?.length ? (
          <div className="slide-chip-row" data-parallax="chips">
            {highlights.map((item) => (
              <span key={item} className="slide-chip" data-stagger="chip">
                {item}
              </span>
            ))}
          </div>
        ) : null}

        {stats?.length ? (
          <div className="slide-stats-grid" data-parallax="stats">
            {stats.map((item) => (
              <article key={item.label} className="glass-card stat-card" data-stagger="card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
        ) : null}

        {narrative?.length ? (
          <div className="narrative-list" data-parallax="narrative">
            {narrative.map((item) => (
              <article key={item} className="glass-card narrative-card" data-stagger="card">
                <p>{item}</p>
              </article>
            ))}
          </div>
        ) : null}

        {cards?.length ? (
          <div className="project-grid" data-parallax="projects">
            {cards.map((card) => (
              <article key={card.title} className="glass-card project-card" data-stagger="card">
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        ) : null}

        {ctas?.length ? (
          <div className="slide-actions" data-parallax="actions">
            {ctas.map((cta) => (
              <a
                key={cta.label}
                className={cta.primary ? "action-button primary" : "action-button ghost"}
                href={cta.href}
                target={cta.href.startsWith("http") ? "_blank" : undefined}
                rel={cta.href.startsWith("http") ? "noreferrer" : undefined}
                data-stagger="action"
              >
                {cta.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
