export default function SlideSection({
  id,
  eyebrow,
  title,
  description,
  highlights,
  stats,
  cards,
  narrative,
  list,
  media,
  table,
  tableFooter,
  ctas,
  rtl,
  sectionRef,
}) {
  const panelClassName = rtl ? "slide-panel is-rtl" : "slide-panel";
  const direction = rtl ? "rtl" : "ltr";

  const renderMediaItem = (item) => {
    if (item.type === "image") {
      return <img className="media-image" src={item.src} alt={item.alt || item.title || ""} />;
    }

    if (item.type === "video") {
      return (
        <video className="media-video" controls preload="metadata" src={item.src}>
          <track kind="captions" />
        </video>
      );
    }

    return (
      <div className="media-placeholder">
        <strong>{item.title || "Media"}</strong>
        {item.note ? <span>{item.note}</span> : null}
      </div>
    );
  };

  return (
    <section id={id} ref={sectionRef} className="slide-section">
      <div className={panelClassName} data-panel dir={direction}>
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

        {list?.length ? (
          <ol className="slide-list" data-parallax="list">
            {list.map((item) => (
              <li key={item} className="glass-card list-card" data-stagger="card">
                <span>{item}</span>
              </li>
            ))}
          </ol>
        ) : null}

        {media?.length ? (
          <div className="slide-media" data-parallax="media">
            {media.map((item, index) => (
              <figure
                key={`${item.title || item.src || "media"}-${index}`}
                className="glass-card media-card"
                data-stagger="card"
              >
                {renderMediaItem(item)}
                {item.caption ? <figcaption className="media-caption">{item.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        ) : null}

        {table?.columns?.length ? (
          <div className="glass-card table-card" data-parallax="table" data-stagger="card">
            <div className="table-scroll">
              <table className="slide-table">
                <thead>
                  <tr>
                    {table.columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows?.map((row, rowIndex) => (
                    <tr key={`${id}-row-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${id}-cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {tableFooter ? (
                  <tfoot>
                    <tr>
                      <td colSpan={table.columns.length}>{tableFooter}</td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
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
