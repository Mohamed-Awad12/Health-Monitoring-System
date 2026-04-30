export default function SlideNavigation({ activeIndex, slides, onSelect }) {
  return (
    <nav className="slides-nav" aria-label="Slide navigation">
      <div className="slides-nav-track">
        <div className="slides-nav-progress" />
      </div>

      <div className="slides-nav-dots">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;

          return (
            <button
              key={slide.title}
              type="button"
              className={isActive ? "slides-nav-dot is-active" : "slides-nav-dot"}
              aria-label={`Go to ${slide.eyebrow}`}
              aria-current={isActive ? "true" : undefined}
              onClick={() => onSelect(index)}
            >
              <span className="slides-nav-dot-core" />
              <span className="slides-nav-label">{slide.eyebrow}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
