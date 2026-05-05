import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useNavigate } from "react-router-dom";
import SlidesBackground from "../components/landing/SlidesBackground";
import SlideNavigation from "../components/landing/SlideNavigation";
import IntroSplash from "../components/landing/IntroSplash";
import { useAuth } from "../hooks/useAuth";
import "../styles/landingSlides.css";
import { getRoleHomePath } from "../utils/roleRoutes";

gsap.registerPlugin(ScrollTrigger);

function getInitialIntroPhase() {
  if (typeof window === "undefined") {
    return "hidden";
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "hidden";
  }

  try {
    return window.sessionStorage.getItem("ihealth-landing-intro-seen") === "true"
      ? "hidden"
      : "active";
  } catch {
    return "active";
  }
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const containerRef = useRef(null);
  const sectionRefs = useRef([]);
  const progressRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [introPhase, setIntroPhase] = useState(getInitialIntroPhase);

  const primaryLabel = user ? "Open dashboard" : "Create account";
  const primaryPath = user ? getRoleHomePath(user.role) : "/register";

  const slides = useMemo(
      () => [
        {
          eyebrow: "Smarter Remote Care",
          title: "Clinical pulse monitoring with a sharper digital presence.",
          copy:
            "iHealth delivers real-time oxygen and heart-rate monitoring in one streamlined experience that helps care teams detect risk earlier, act faster, and protect patients with confidence.",
          meta: ["Real-time readings", "Remote monitoring", "Faster response"],
          primaryAction: {
            label: primaryLabel,
            action: () => navigate(primaryPath),
          },
          secondaryAction: {
            label: "Sign in",
            action: () => navigate("/login"),
          },
        },
        {
          eyebrow: "Always-On Visibility",
          title: "See every oxygen shift the moment it matters.",
          copy:
            "From home follow-up to critical escalation, iHealth keeps SpO2, pulse, and patient status in clear view so clinicians can respond before subtle changes become serious events.",
          meta: ["Live SpO2", "Instant status", "Patient overview"],
        },
        {
          eyebrow: "Actionable Insights",
          title: "Turn raw readings into decisions your team can trust.",
          copy:
            "Focused dashboards turn continuous readings into clear trends, priority alerts, and faster interventions without adding friction to the care workflow.",
          meta: ["Trend clarity", "Priority alerts", "Decision support"],
        },
        {
          eyebrow: "Built For Care Teams",
          title: "One connected experience for patients and clinicians.",
          copy:
            "iHealth connects patients and clinicians in one reliable system for remote follow-up, clinical oversight, and coordinated care at scale.",
          meta: ["Role-based access", "Connected workflow", "Scalable platform"],
        },
        {
          eyebrow: "Trusted Monitoring",
          title: "A product experience designed for confidence at every step.",
          copy:
            "iHealth combines dependable monitoring, modern usability, and a strong clinical interface to create a product teams can trust and patients can rely on every day.",
          meta: ["Dependable monitoring", "Modern usability", "Clinical confidence"],
          primaryAction: {
            label: primaryLabel,
            action: () => navigate(primaryPath),
          },
          secondaryAction: {
            label: user ? "Back to sign in" : "Explore login",
            action: () => navigate("/login"),
          },
        },
      ],
    [navigate, primaryLabel, primaryPath, user]
  );

  useEffect(() => {
    if (introPhase !== "active" || typeof window === "undefined") {
      return undefined;
    }

    const exitTimer = window.setTimeout(() => {
      setIntroPhase("exiting");
    }, 3600);

    const doneTimer = window.setTimeout(() => {
      setIntroPhase("hidden");

      try {
        window.sessionStorage.setItem("ihealth-landing-intro-seen", "true");
      } catch {
        // Ignore session storage failures and continue showing the site.
      }
    }, 4700);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  useEffect(() => {
    if (introPhase !== "hidden") {
      return undefined;
    }

    const scroller = containerRef.current;
    const sections = sectionRefs.current.filter(Boolean);

    if (!scroller || sections.length === 0) {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const ctx = gsap.context(() => {
      const progressState = { value: 0 };

      gsap.set(".slides-panel", {
        autoAlpha: prefersReducedMotion ? 1 : 0.4,
        y: prefersReducedMotion ? 0 : 54,
      });

      gsap.to(progressState, {
        value: 1,
        ease: "none",
        onUpdate: () => {
          progressRef.current = progressState.value;
          scroller.style.setProperty(
            "--slides-progress",
            progressState.value.toFixed(4)
          );
        },
        scrollTrigger: {
          trigger: sections[0],
          endTrigger: sections[sections.length - 1],
          scroller,
          start: "top top",
          end: "bottom bottom",
          scrub: 1,
        },
      });

      sections.forEach((section, index) => {
        const panel = section.querySelector(".slides-panel");
        const revealItems = section.querySelectorAll("[data-reveal]");

        if (!panel) {
          return;
        }

        ScrollTrigger.create({
          trigger: section,
          scroller,
          start: "top center",
          end: "bottom center",
          onEnter: () => setActiveIndex(index),
          onEnterBack: () => setActiveIndex(index),
        });

        if (prefersReducedMotion) {
          return;
        }

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            scroller,
            start: "top 80%",
            end: "top 34%",
            scrub: 0.8,
          },
        });

        timeline.to(panel, {
          autoAlpha: 1,
          y: 0,
          ease: "none",
          duration: 1,
        });

        if (revealItems.length > 0) {
          timeline.fromTo(
            revealItems,
            { autoAlpha: 0, y: 28 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.74,
              ease: "none",
              stagger: 0.08,
            },
            0.08
          );
        }
      });

      ScrollTrigger.refresh();
    }, scroller);

    return () => {
      ctx.revert();
      progressRef.current = 0;
    };
  }, [introPhase, slides.length]);

  const scrollToSlide = (index) => {
    const target = sectionRefs.current[index];

    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const isIntroVisible = introPhase !== "hidden";
  const isIntroExiting = introPhase === "exiting";
  const shouldRenderDynamicBackground = introPhase !== "active";

  return (
    <div className={isIntroVisible ? "slides-shell is-intro-active" : "slides-shell"}>
      {isIntroVisible ? <IntroSplash exiting={isIntroExiting} /> : null}

      {shouldRenderDynamicBackground ? (
        <SlidesBackground progressRef={progressRef} />
      ) : null}

      <header className="slides-topbar">
        <button
          type="button"
          className="slides-brand"
          onClick={() => scrollToSlide(0)}
        >
          <span className="slides-brand-mark">P</span>
          <span>iHealth</span>
        </button>

        <div className="slides-topbar-actions">
          <button
            type="button"
            className="slides-button slides-button--ghost"
            onClick={() => navigate("/login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className="slides-button slides-button--primary"
            onClick={() => navigate(primaryPath)}
          >
            {primaryLabel}
          </button>
        </div>
      </header>

      <SlideNavigation
        activeIndex={activeIndex}
        slides={slides}
        onSelect={scrollToSlide}
      />

      <main className="slides-page" ref={containerRef}>
        {slides.map((slide, index) => (
          <SlideSection
            key={slide.title}
            index={index}
            slide={slide}
            sectionRefs={sectionRefs}
          />
        ))}
      </main>
    </div>
  );
}

function SlideSection({ index, slide, sectionRefs }) {
  const HeadingTag = index === 0 ? "h1" : "h2";

  return (
    <section
      ref={(node) => {
        sectionRefs.current[index] = node;
      }}
      className="slides-section"
    >
      <div className="slides-panel">
        <p className="slides-eyebrow" data-reveal>
          {slide.eyebrow}
        </p>
        <HeadingTag className="slides-title" data-reveal>
          {slide.title}
        </HeadingTag>
        <p className="slides-copy" data-reveal>
          {slide.copy}
        </p>

        <div className="slides-meta" data-reveal>
          {slide.meta.map((item) => (
            <span key={item} className="slides-chip">
              {item}
            </span>
          ))}
        </div>

        {(slide.primaryAction || slide.secondaryAction) && (
          <div className="slides-actions" data-reveal>
            {slide.primaryAction && (
              <button
                type="button"
                className="slides-button slides-button--primary"
                onClick={slide.primaryAction.action}
              >
                {slide.primaryAction.label}
              </button>
            )}

            {slide.secondaryAction && (
              <button
                type="button"
                className="slides-button slides-button--ghost"
                onClick={slide.secondaryAction.action}
              >
                {slide.secondaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
