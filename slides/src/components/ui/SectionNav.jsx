export default function SectionNav({ sections, activeIndex, onJump }) {
  return (
    <nav className="section-nav" aria-label="Slide sections">
      {sections.map((section, index) => {
        const isActive = index === activeIndex;

        return (
          <button
            key={section.id}
            type="button"
            className={isActive ? "section-nav-dot is-active" : "section-nav-dot"}
            aria-label={`Go to ${section.eyebrow}`}
            onClick={() => onJump(index)}
          >
            <span />
          </button>
        );
      })}
    </nav>
  );
}
