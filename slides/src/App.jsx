import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ThreeBackground from "./components/scene/ThreeBackground";
import SlideSection from "./components/ui/SlideSection";
import SectionNav from "./components/ui/SectionNav";
import { slideSections } from "./content/sections";

gsap.registerPlugin(ScrollTrigger);

const mainAppUrl =
  import.meta.env.VITE_MAIN_APP_URL?.trim() || "http://localhost:5173";

export default function App() {
  const rootRef = useRef(null);
  const sectionRefs = useRef([]);
  const progressRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const sections = useMemo(
    () =>
      slideSections.map((section) => ({
        ...section,
        ctas: section.ctas?.map((cta) => ({
          ...cta,
          href: cta.href === "__MAIN_APP_URL__" ? mainAppUrl : cta.href,
        })),
      })),
    []
  );

  useEffect(() => {
    const rootNode = rootRef.current;
    const panels = sectionRefs.current.filter(Boolean);

    if (!rootNode || panels.length === 0) {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const ctx = gsap.context(() => {
      const progressProxy = { value: 0 };

      if (!prefersReducedMotion) {
        gsap.fromTo(
          ".floating-topbar",
          { autoAlpha: 0, y: -28, scale: 0.96 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 1,
            ease: "power3.out",
          }
        );

        gsap.fromTo(
          ".section-nav-dot",
          { autoAlpha: 0, x: 12 },
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.7,
            ease: "power3.out",
            stagger: 0.06,
            delay: 0.18,
          }
        );
      }

      gsap.to(progressProxy, {
        value: 1,
        ease: "none",
        onUpdate: () => {
          progressRef.current = progressProxy.value;
          rootNode.style.setProperty(
            "--deck-progress",
            progressProxy.value.toFixed(4)
          );
        },
        scrollTrigger: {
          trigger: panels[0],
          endTrigger: panels[panels.length - 1],
          start: "top top",
          end: "bottom bottom",
          scrub: 1,
        },
      });

      panels.forEach((panel, index) => {
        const revealNode = panel.querySelector("[data-panel]");
        const eyebrow = panel.querySelector('[data-reveal="eyebrow"]');
        const title = panel.querySelector('[data-reveal="title"]');
        const description = panel.querySelector('[data-reveal="description"]');
        const chips = panel.querySelectorAll('[data-stagger="chip"]');
        const cards = panel.querySelectorAll('[data-stagger="card"]');
        const actions = panel.querySelectorAll('[data-stagger="action"]');
        const rail = panel.querySelector('[data-parallax="rail"]');
        const copy = panel.querySelector('[data-parallax="copy"]');
        const chipRow = panel.querySelector('[data-parallax="chips"]');
        const stats = panel.querySelector('[data-parallax="stats"]');
        const narrative = panel.querySelector('[data-parallax="narrative"]');
        const projects = panel.querySelector('[data-parallax="projects"]');
        const actionRow = panel.querySelector('[data-parallax="actions"]');

        ScrollTrigger.create({
          trigger: panel,
          start: "top center",
          end: "bottom center",
          onEnter: () => setActiveIndex(index),
          onEnterBack: () => setActiveIndex(index),
        });

        if (!revealNode || prefersReducedMotion) {
          return;
        }

        gsap.set(revealNode, {
          transformPerspective: 1400,
          transformOrigin: "50% 50%",
        });

        const entranceTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: panel,
            start: "top 76%",
            toggleActions: "play none none reverse",
          },
          defaults: {
            ease: "power3.out",
          },
        });

        entranceTimeline.fromTo(
          revealNode,
          {
            autoAlpha: 0,
            y: 96,
            scale: 0.93,
            rotateX: 12,
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotateX: 0,
            duration: 1.2,
          }
        );

        if (eyebrow) {
          entranceTimeline.fromTo(
            eyebrow,
            { autoAlpha: 0, y: 20, x: -18 },
            { autoAlpha: 1, y: 0, x: 0, duration: 0.55 },
            0.18
          );
        }

        if (title) {
          entranceTimeline.fromTo(
            title,
            { autoAlpha: 0, y: 34, clipPath: "inset(0 0 100% 0)" },
            { autoAlpha: 1, y: 0, clipPath: "inset(0 0 0% 0)", duration: 0.85 },
            0.26
          );
        }

        if (description) {
          entranceTimeline.fromTo(
            description,
            { autoAlpha: 0, y: 26 },
            { autoAlpha: 1, y: 0, duration: 0.68 },
            0.42
          );
        }

        if (chips.length > 0) {
          entranceTimeline.fromTo(
            chips,
            { autoAlpha: 0, y: 18, scale: 0.9 },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: 0.5,
              stagger: 0.06,
            },
            0.52
          );
        }

        if (cards.length > 0) {
          entranceTimeline.fromTo(
            cards,
            {
              autoAlpha: 0,
              y: 46,
              rotateY: (cardIndex) => (cardIndex % 2 === 0 ? -14 : 14),
              rotateX: 10,
              scale: 0.92,
            },
            {
              autoAlpha: 1,
              y: 0,
              rotateY: 0,
              rotateX: 0,
              scale: 1,
              duration: 0.8,
              stagger: 0.09,
            },
            0.56
          );
        }

        if (actions.length > 0) {
          entranceTimeline.fromTo(
            actions,
            { autoAlpha: 0, y: 18, scale: 0.92 },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: 0.52,
              stagger: 0.08,
            },
            0.7
          );
        }

        const parallaxTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: panel,
            start: "top bottom",
            end: "bottom top",
            scrub: 1.1,
          },
        });

        parallaxTimeline.fromTo(
          revealNode,
          { yPercent: 8, rotateX: 5, rotateY: index % 2 === 0 ? -2.2 : 2.2 },
          { yPercent: -8, rotateX: -5, rotateY: index % 2 === 0 ? 2.2 : -2.2, ease: "none" },
          0
        );

        if (rail) {
          parallaxTimeline.fromTo(
            rail,
            { yPercent: 20, opacity: 0.45 },
            { yPercent: -28, opacity: 1, ease: "none" },
            0
          );
        }

        if (copy) {
          parallaxTimeline.fromTo(copy, { yPercent: 10 }, { yPercent: -10, ease: "none" }, 0);
        }

        if (chipRow) {
          parallaxTimeline.fromTo(
            chipRow,
            { yPercent: 12 },
            { yPercent: -14, ease: "none" },
            0
          );
        }

        if (stats) {
          parallaxTimeline.fromTo(stats, { yPercent: 14 }, { yPercent: -18, ease: "none" }, 0);
        }

        if (narrative) {
          parallaxTimeline.fromTo(
            narrative,
            { yPercent: 16 },
            { yPercent: -18, ease: "none" },
            0
          );
        }

        if (projects) {
          parallaxTimeline.fromTo(
            projects,
            { yPercent: 18 },
            { yPercent: -20, ease: "none" },
            0
          );
        }

        if (actionRow) {
          parallaxTimeline.fromTo(
            actionRow,
            { yPercent: 10 },
            { yPercent: -12, ease: "none" },
            0
          );
        }
      });

      ScrollTrigger.refresh();
    }, rootNode);

    return () => ctx.revert();
  }, []);

  const scrollToSection = (index) => {
    const nextSection = sectionRefs.current[index];

    if (!nextSection) {
      return;
    }

    nextSection.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div ref={rootRef} className="deck-root">
      <ThreeBackground progressRef={progressRef} />

      <header className="floating-topbar">
        <div>
          <p className="brand-kicker">Pulse</p>
          <strong>Product Slides</strong>
        </div>
        <div className="topbar-meta">
          <span>IoT health monitoring</span>
          <span>Patients, doctors, and admin oversight</span>
        </div>
      </header>

      <SectionNav
        sections={sections}
        activeIndex={activeIndex}
        onJump={scrollToSection}
      />

      <main className="deck-content">
        {sections.map((section, index) => (
          <SlideSection
            key={section.id}
            {...section}
            sectionRef={(node) => {
              sectionRefs.current[index] = node;
            }}
          />
        ))}
      </main>
    </div>
  );
}
