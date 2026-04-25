import { animate, createScope, onScroll, stagger } from "animejs";
import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PreferenceControls from "../components/common/PreferenceControls";
import AnimatedCounter from "../components/landing/AnimatedCounter";
import NeoHero from "../components/landing/NeoHero";
import StatusPill from "../components/ui/StatusPill";
import { useAuth } from "../hooks/useAuth";
import { useUiPreferences } from "../hooks/useUiPreferences";
import "../styles/landingNeo.css";
import "../styles/neo-hero.css";
import { getRoleHomePath } from "../utils/roleRoutes";

const featureVariants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.62,
      delay: index * 0.09,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const timelineVariants = {
  hidden: {
    opacity: 0,
    x: -24,
  },
  visible: (index = 0) => ({
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.6,
      delay: index * 0.11,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

export default function LandingPage() {
  const { user } = useAuth();
  const { t } = useUiPreferences();
  const navigate = useNavigate();

  const landingRootRef = useRef(null);
  const featuresSectionRef = useRef(null);
  const historySectionRef = useRef(null);
  const rollSectionRef = useRef(null);
  const rollWheelWrapRef = useRef(null);
  const rollWheelRef = useRef(null);
  const rollTitleRef = useRef(null);
  const rollDescriptionRef = useRef(null);
  const rollMetricRef = useRef(null);
  const animeScopeRef = useRef(null);
  const activeRollIndexRef = useRef(0);
  const [activeRollIndex, setActiveRollIndex] = useState(0);

  /* ── anime.js refs for new scroll animations ── */
  const heroTitleRef = useRef(null);
  const navRef = useRef(null);
  const previewRef = useRef(null);
  const featureGridRef = useRef(null);
  const timelineBarRef = useRef(null);
  const timelineSectionRef = useRef(null);
  const statsSectionRef = useRef(null);
  const animeExtraScopeRef = useRef(null);

  const { scrollYProgress } = useScroll();
  const orbOneY = useTransform(scrollYProgress, [0, 1], [0, -220]);
  const orbTwoY = useTransform(scrollYProgress, [0, 1], [0, 170]);

  const features = useMemo(
    () => [
      {
        title: t("landing.features.oxygenTitle"),
        description: t("landing.features.oxygenDescription"),
        metric: "SpO2",
        status: "normal",
      },
      {
        title: t("landing.features.heartRateTitle"),
        description: t("landing.features.heartRateDescription"),
        metric: "BPM",
        status: "warning",
      },
      {
        title: t("landing.features.analyticsTitle"),
        description: t("landing.features.analyticsDescription"),
        metric: t("common.openAlerts"),
        status: "critical",
      },
    ],
    [t]
  );

  const steps = useMemo(
    () => [
      {
        title: t("landing.how.stepOneTitle"),
        description: t("landing.how.stepOneDescription"),
      },
      {
        title: t("landing.how.stepTwoTitle"),
        description: t("landing.how.stepTwoDescription"),
      },
      {
        title: t("landing.how.stepThreeTitle"),
        description: t("landing.how.stepThreeDescription"),
      },
      {
        title: t("landing.how.stepFourTitle"),
        description: t("landing.how.stepFourDescription"),
      },
    ],
    [t]
  );

  const rollStatuses = useMemo(
    () => [
      {
        title: t("landing.roll.statusOneTitle"),
        description: t("landing.roll.statusOneDescription"),
        metric: t("landing.roll.statusOneMetric"),
        status: "normal",
      },
      {
        title: t("landing.roll.statusTwoTitle"),
        description: t("landing.roll.statusTwoDescription"),
        metric: t("landing.roll.statusTwoMetric"),
        status: "pending",
      },
      {
        title: t("landing.roll.statusThreeTitle"),
        description: t("landing.roll.statusThreeDescription"),
        metric: t("landing.roll.statusThreeMetric"),
        status: "warning",
      },
      {
        title: t("landing.roll.statusFourTitle"),
        description: t("landing.roll.statusFourDescription"),
        metric: t("landing.roll.statusFourMetric"),
        status: "critical",
      },
    ],
    [t]
  );

  const stats = useMemo(
    () => [
      {
        value: 98,
        suffix: "%",
        label: t("landing.stats.accuracyLabel"),
        caption: t("landing.stats.accuracyCaption"),
      },
      {
        value: 24,
        suffix: "/7",
        label: t("landing.stats.monitoringLabel"),
        caption: t("landing.stats.monitoringCaption"),
      },
      {
        value: 120,
        suffix: "ms",
        label: t("landing.stats.latencyLabel"),
        caption: t("landing.stats.latencyCaption"),
      },
      {
        value: 3200,
        suffix: "+",
        label: t("landing.stats.sessionsLabel"),
        caption: t("landing.stats.sessionsCaption"),
      },
    ],
    [t]
  );

  const activeRollStatus = rollStatuses[activeRollIndex] ?? rollStatuses[0];

  const primaryCtaPath = user ? getRoleHomePath(user.role) : "/register";
  const primaryCtaText = user
    ? t("landing.hero.ctaEnterApp")
    : t("landing.hero.ctaSignUp");
  const secondaryCtaText = user
    ? t("landing.hero.ctaLearnMore")
    : t("landing.hero.ctaLogin");

  const handlePrimaryAction = () => {
    navigate(primaryCtaPath);
  };

  const handleSecondaryAction = () => {
    if (user) {
      featuresSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    navigate("/login");
  };

  /* ════════════════════════════════════════════════════════════════
     Rolling-wheel scroll animation (existing)
     ════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (
      !landingRootRef.current ||
      !rollSectionRef.current ||
      !rollWheelWrapRef.current ||
      !rollWheelRef.current
    ) {
      return undefined;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const rollSectionNode = rollSectionRef.current;
    let glowFrameId = null;
    let glowCurrent = 0;
    let glowTarget = 0;

    const applyVelocityGlow = (nextValue) => {
      const clamped = Math.max(0, Math.min(1, nextValue));
      rollSectionNode.style.setProperty("--neo-wheel-velocity", clamped.toFixed(3));
    };

    const startGlowLoop = () => {
      if (glowFrameId !== null) {
        return;
      }

      const tickGlow = () => {
        glowCurrent += (glowTarget - glowCurrent) * 0.26;
        glowTarget *= 0.9;
        applyVelocityGlow(glowCurrent);

        if (Math.abs(glowCurrent - glowTarget) > 0.002 || glowTarget > 0.01) {
          glowFrameId = window.requestAnimationFrame(tickGlow);
          return;
        }

        glowCurrent = 0;
        glowTarget = 0;
        applyVelocityGlow(0);
        glowFrameId = null;
      };

      glowFrameId = window.requestAnimationFrame(tickGlow);
    };

    const updateGlowFromVelocity = (velocityValue = 0) => {
      const normalizedVelocity = Math.min(1, velocityValue / 2.8);
      glowTarget = Math.max(glowTarget * 0.82, normalizedVelocity);
      startGlowLoop();
    };

    const pulseBoundaryElastic = (observer) => {
      const rawVelocity = Math.abs(Number.isFinite(observer?.velocity) ? observer.velocity : 0);
      const velocityFactor = Math.min(1, rawVelocity / 2.4);
      const stretch = 1.1 + velocityFactor * 0.16;
      const squeeze = 0.93 - velocityFactor * 0.05;
      const rebound = 1.05 + velocityFactor * 0.06;
      const wobble = velocityFactor * 8;

      animate(rollWheelRef.current, {
        scaleX: [1, squeeze, rebound, 1],
        scaleY: [1, stretch, 0.98, 1],
        rotateZ: [0, wobble, 0],
        duration: 920,
        ease: "outElastic(1.2, 0.42)",
      });

      updateGlowFromVelocity(2.2 + velocityFactor * 1.2);
    };

    applyVelocityGlow(0);
    activeRollIndexRef.current = 0;
    setActiveRollIndex(0);

    const rollScrollObserver = onScroll({
      target: rollSectionNode,
      sync: 1,
      onEnterForward: pulseBoundaryElastic,
      onLeaveForward: pulseBoundaryElastic,
      onEnterBackward: pulseBoundaryElastic,
      onLeaveBackward: pulseBoundaryElastic,
      onUpdate: (observer) => {
        const progress = Number.isFinite(observer?.progress) ? observer.progress : 0;
        const boundedProgress = Math.min(0.999, Math.max(0, progress));
        const nextIndex = Math.floor(boundedProgress * rollStatuses.length);

        if (nextIndex !== activeRollIndexRef.current) {
          activeRollIndexRef.current = nextIndex;
          setActiveRollIndex(nextIndex);
        }

        const velocity = Math.abs(Number.isFinite(observer?.velocity) ? observer.velocity : 0);
        updateGlowFromVelocity(velocity);
      },
    });

    animeScopeRef.current = createScope({ root: landingRootRef }).add(() => {
      animate(rollWheelWrapRef.current, {
        translateY: [-168, 168],
        ease: "linear",
        autoplay: rollScrollObserver,
      });

      animate(rollWheelRef.current, {
        rotate: "5turn",
        ease: "linear",
        autoplay: rollScrollObserver,
      });

      animate(".neo-track-fill", {
        scaleY: 1,
        ease: "linear",
        autoplay: rollScrollObserver,
      });
    });

    return () => {
      if (glowFrameId !== null) {
        window.cancelAnimationFrame(glowFrameId);
      }

      rollSectionNode.style.removeProperty("--neo-wheel-velocity");
      animeScopeRef.current?.revert();
      animeScopeRef.current = null;
    };
  }, [rollStatuses.length]);

  /* roll-content micro-animations on index change */
  useEffect(() => {
    if (!rollSectionRef.current) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const contentTargets = [
      rollTitleRef.current,
      rollDescriptionRef.current,
      rollMetricRef.current,
    ].filter(Boolean);

    if (contentTargets.length) {
      animate(contentTargets, {
        opacity: [0.4, 1],
        translateY: [14, 0],
        delay: stagger(70),
        duration: 420,
        ease: "out(3)",
      });
    }

    const listItems = rollSectionRef.current.querySelectorAll(".neo-roll-list-item");

    if (listItems.length) {
      animate(listItems, {
        opacity: [0.55, 1],
        scale: [0.985, 1],
        delay: stagger(55, { from: activeRollIndex }),
        duration: 320,
        ease: "out(2)",
      });
    }
  }, [activeRollIndex]);

  /* ════════════════════════════════════════════════════════════════
     NEW: anime.js enhanced scroll animations
     ════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!landingRootRef.current) {
      return undefined;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    /* ── 1. Hero title letter cascade ── */
    const titleNode = heroTitleRef.current;
    if (titleNode) {
      const text = titleNode.textContent || "";
      const words = text.split(" ");
      titleNode.innerHTML = "";
      titleNode.classList.add("neo-hero-title-animated");

      words.forEach((word, wordIndex) => {
        const wordSpan = document.createElement("span");
        wordSpan.className = "neo-hero-word";

        [...word].forEach((char) => {
          const charSpan = document.createElement("span");
          charSpan.className = "neo-letter";
          charSpan.textContent = char;
          wordSpan.appendChild(charSpan);
        });

        titleNode.appendChild(wordSpan);
        if (wordIndex < words.length - 1) {
          const space = document.createElement("span");
          space.className = "neo-letter neo-letter-space";
          space.innerHTML = "&nbsp;";
          titleNode.appendChild(space);
        }
      });

      animate(".neo-letter", {
        opacity: [0, 1],
        translateY: [40, 0],
        rotateX: [90, 0],
        delay: stagger(28, { start: 200 }),
        duration: 700,
        ease: "out(3)",
      });
    }

    /* ── 2. Preview panel floating pulse ── */
    const previewNode = previewRef.current;
    if (previewNode) {
      animate(previewNode, {
        translateY: [0, -8, 0],
        duration: 3800,
        ease: "inOut(2)",
        loop: true,
      });
    }

    /* ── 3. Nav backdrop blur on scroll ── */
    const navNode = navRef.current;
    if (navNode) {
      onScroll({
        target: navNode,
        enter: "top top",
        leave: "bottom+=200 top",
        sync: 1,
        onUpdate: (observer) => {
          const progress = Number.isFinite(observer?.progress)
            ? Math.min(1, Math.max(0, observer.progress))
            : 0;
          const blurAmount = 8 + progress * 16;
          const bgOpacity = 0.6 + progress * 0.3;
          navNode.style.backdropFilter = `blur(${blurAmount}px)`;
          navNode.style.webkitBackdropFilter = `blur(${blurAmount}px)`;
          navNode.style.setProperty("--nav-bg-opacity", bgOpacity.toFixed(2));
        },
      });
    }

    /* ── 4. Feature cards scroll-triggered stagger entry ── */
    const featureCards = featureGridRef.current?.querySelectorAll(".neo-feature-card");
    if (featureCards?.length) {
      featureCards.forEach((card) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(60px) scale(0.92)";
      });

      onScroll({
        target: featureGridRef.current,
        enter: "top bottom-=80",
        leave: "bottom top",
        onEnterForward: () => {
          animate(featureCards, {
            opacity: [0, 1],
            translateY: [60, 0],
            scale: [0.92, 1],
            rotateZ: [2, 0],
            delay: stagger(120),
            duration: 900,
            ease: "outElastic(1, 0.6)",
          });
        },
        onEnterBackward: () => {
          animate(featureCards, {
            opacity: [0, 1],
            translateY: [-40, 0],
            scale: [0.95, 1],
            delay: stagger(80),
            duration: 600,
            ease: "out(3)",
          });
        },
      });
    }

    /* ── 5. Timeline line drawing + step reveals ── */
    const timelineBarNode = timelineBarRef.current;
    const timelineSectionNode = timelineSectionRef.current;
    if (timelineBarNode && timelineSectionNode) {
      const timelineScrollObs = onScroll({
        target: timelineSectionNode,
        enter: "top bottom-=100",
        leave: "bottom top+=100",
        sync: 1,
      });

      animate(timelineBarNode, {
        scaleY: [0, 1],
        ease: "linear",
        autoplay: timelineScrollObs,
      });

      const stepElements = timelineSectionNode.querySelectorAll(".neo-timeline-step");
      if (stepElements.length) {
        stepElements.forEach((step) => {
          step.style.opacity = "0";
          step.style.transform = "translateX(-30px)";
        });

        onScroll({
          target: timelineSectionNode,
          enter: "top bottom-=120",
          leave: "bottom top",
          onEnterForward: () => {
            animate(stepElements, {
              opacity: [0, 1],
              translateX: [-30, 0],
              scale: [0.96, 1],
              delay: stagger(150, { start: 200 }),
              duration: 800,
              ease: "outElastic(1, 0.7)",
            });
          },
          onEnterBackward: () => {
            animate(stepElements, {
              opacity: [0, 1],
              translateX: [20, 0],
              delay: stagger(100),
              duration: 500,
              ease: "out(3)",
            });
          },
        });
      }
    }

    /* ── 6. Stats cards elastic spin-in ── */
    const statsSectionNode = statsSectionRef.current;
    if (statsSectionNode) {
      const statCards = statsSectionNode.querySelectorAll(".neo-stat-card");
      if (statCards.length) {
        statCards.forEach((card) => {
          card.style.opacity = "0";
          card.style.transform = "scale(0.7) rotate(-8deg)";
        });

        onScroll({
          target: statsSectionNode,
          enter: "top bottom-=60",
          leave: "bottom top",
          onEnterForward: () => {
            animate(statCards, {
              opacity: [0, 1],
              scale: [0.7, 1],
              rotate: [-8, 0],
              delay: stagger(100, { start: 100 }),
              duration: 1000,
              ease: "outElastic(1.2, 0.5)",
            });
          },
          onEnterBackward: () => {
            animate(statCards, {
              opacity: [0, 1],
              scale: [0.85, 1],
              rotate: [4, 0],
              delay: stagger(70),
              duration: 600,
              ease: "out(3)",
            });
          },
        });
      }
    }

    /* ── 7. Section headings slide-up on scroll ── */
    const sectionHeads = landingRootRef.current.querySelectorAll(
      ".neo-section-head"
    );
    if (sectionHeads.length) {
      sectionHeads.forEach((head) => {
        head.style.opacity = "0";
        head.style.transform = "translateY(36px)";

        onScroll({
          target: head,
          enter: "top bottom-=40",
          leave: "bottom top",
          onEnterForward: () => {
            const children = [
              head.querySelector(".neo-eyebrow"),
              head.querySelector("h2"),
              head.querySelector("p"),
            ].filter(Boolean);

            animate(children.length ? children : [head], {
              opacity: [0, 1],
              translateY: [36, 0],
              delay: stagger(80),
              duration: 700,
              ease: "out(4)",
            });

            head.style.opacity = "1";
            head.style.transform = "none";
          },
        });
      });
    }

    animeExtraScopeRef.current = true;

    return () => {
      animeExtraScopeRef.current = null;
      /* Restore hero title plain text if needed */
      if (titleNode && titleNode.classList.contains("neo-hero-title-animated")) {
        const currentText = titleNode.textContent || "";
        titleNode.innerHTML = "";
        titleNode.textContent = currentText;
        titleNode.classList.remove("neo-hero-title-animated");
      }
    };
  }, [t]);

  return (
    <div className="neo-landing" ref={landingRootRef}>
      <motion.div className="neo-orb orb-left" style={{ y: orbOneY }} />
      <motion.div className="neo-orb orb-right" style={{ y: orbTwoY }} />

      <header className="neo-nav" ref={navRef}>
        <button
          type="button"
          className="neo-brand"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <span className="neo-brand-mark">PO</span>
          <span>{t("common.appName")}</span>
        </button>

        <div className="neo-nav-actions">
          <PreferenceControls />
          {!user ? (
            <button
              type="button"
              className="ghost-button"
              onClick={() => navigate("/login")}
            >
              {t("common.signIn")}
            </button>
          ) : null}
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate(primaryCtaPath)}
          >
            {user ? t("landing.nav.dashboard") : t("common.createAccount")}
          </button>
        </div>
      </header>

      <main className="neo-main">
        <NeoHero
          onPrimaryClick={handlePrimaryAction}
          onSecondaryClick={handleSecondaryAction}
          primaryCtaText={primaryCtaText}
          secondaryCtaText={secondaryCtaText}
        />

        <section className="neo-section neo-features" ref={featuresSectionRef}>
          <div className="neo-section-head">
            <p className="neo-eyebrow">{t("landing.features.eyebrow")}</p>
            <h2>{t("landing.features.title")}</h2>
            <p>{t("landing.features.subtitle")}</p>
          </div>

          <div className="neo-feature-grid" ref={featureGridRef}>
            {features.map((feature, index) => (
              <motion.article
                key={feature.title}
                className="neo-feature-card"
                variants={featureVariants}
                custom={index}
                whileHover={{ y: -8, scale: 1.03, transition: { duration: 0.22 } }}
              >
                <div className="neo-feature-head">
                  <span>{feature.metric}</span>
                  <StatusPill status={feature.status} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="neo-section neo-roll-section" ref={rollSectionRef}>
          <div className="neo-section-head">
            <p className="neo-eyebrow">{t("landing.roll.eyebrow")}</p>
            <h2>{t("landing.roll.title")}</h2>
            <p>{t("landing.roll.subtitle")}</p>
          </div>

          <div className="neo-roll-grid">
            <div className="neo-roll-stage" aria-hidden="true">
              <div className="neo-roll-track">
                <div className="neo-track-fill" />
                <div className="neo-track-checkpoints">
                  {rollStatuses.map((item, index) => (
                    <span
                      key={item.title}
                      className={`neo-track-checkpoint ${index === activeRollIndex ? "is-active" : ""}`}
                      style={{
                        "--checkpoint-index": index,
                        "--checkpoint-total": Math.max(1, rollStatuses.length - 1),
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="neo-wheel-wrap" ref={rollWheelWrapRef}>
                <div className="neo-roll-wheel" ref={rollWheelRef}>
                  <span className="neo-wheel-ring" />
                  <span className="neo-wheel-core" />
                  <span className="neo-wheel-spoke spoke-a" />
                  <span className="neo-wheel-spoke spoke-b" />
                  <span className="neo-wheel-spoke spoke-c" />
                </div>
              </div>
            </div>

            <div className="neo-roll-panel" aria-live="polite">
              <p className="neo-eyebrow">{t("landing.roll.currentLabel")}</p>
              <h3 ref={rollTitleRef}>{activeRollStatus.title}</h3>
              <p ref={rollDescriptionRef}>{activeRollStatus.description}</p>

              <div className="neo-roll-meta">
                <StatusPill status={activeRollStatus.status} />
                <strong ref={rollMetricRef}>{activeRollStatus.metric}</strong>
              </div>

              <ol className="neo-roll-list">
                {rollStatuses.map((item, index) => (
                  <li
                    key={item.title}
                    className={`neo-roll-list-item ${index === activeRollIndex ? "is-active" : ""}`}
                  >
                    <span>{item.title}</span>
                  </li>
                ))}
              </ol>

              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  historySectionRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
              >
                {t("landing.roll.historyCta")}
              </button>
            </div>
          </div>
        </section>

        <section className="neo-section" ref={featuresSectionRef}>
          <div className="neo-section-head">
            <p className="neo-eyebrow">{t("landing.features.eyebrow")}</p>
            <h2>{t("landing.features.title")}</h2>
            <p>{t("landing.features.subtitle")}</p>
          </div>

          <div className="neo-feature-grid" ref={featureGridRef}>
            {features.map((feature, index) => (
              <motion.article
                key={feature.title}
                className="neo-feature-card"
                variants={featureVariants}
                custom={index}
                whileHover={{ y: -8, scale: 1.03, transition: { duration: 0.22 } }}
              >
                <div className="neo-feature-head">
                  <span>{feature.metric}</span>
                  <StatusPill status={feature.status} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="neo-section neo-timeline-section" id="neo-history" ref={(node) => { historySectionRef.current = node; timelineSectionRef.current = node; }}>
          <div className="neo-section-head">
            <p className="neo-eyebrow">{t("landing.history.eyebrow")}</p>
            <h2>{t("landing.history.title")}</h2>
            <p>{t("landing.history.subtitle")}</p>
          </div>

          <div className="neo-timeline">
            <div className="neo-timeline-bar" ref={timelineBarRef} aria-hidden="true" />
            {steps.map((step, index) => (
              <motion.article
                key={step.title}
                className="neo-timeline-step"
                variants={timelineVariants}
                custom={index}
              >
                <span className="neo-step-index">{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="neo-section neo-stats-section" ref={statsSectionRef}>
          <div className="neo-section-head">
            <p className="neo-eyebrow">{t("landing.stats.eyebrow")}</p>
            <h2>{t("landing.stats.title")}</h2>
            <p>{t("landing.stats.subtitle")}</p>
          </div>

          <div className="neo-stats-grid">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="neo-stat-card"
              >
                <strong>
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </strong>
                <span>{stat.label}</span>
                <small>{stat.caption}</small>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
