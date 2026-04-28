import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useUiPreferences } from "../../hooks/useUiPreferences";
import { getRoleHomePath } from "../../utils/roleRoutes";
import PreferenceControls from "../common/PreferenceControls";

export default function AppShell({ title, subtitle, actions, children }) {
  const { user, logout } = useAuth();
  const { t } = useUiPreferences();
  const location = useLocation();
  const navigate = useNavigate();
  const shellRef = useRef(null);
  const isProfilePage = location.pathname === "/profile";

  useEffect(() => {
    const root = document.documentElement;
    let rafId = null;

    const updateScrollDepth = () => {
      root.style.setProperty("--scroll-depth", `${window.scrollY}`);
      rafId = null;
    };

    const handleScroll = () => {
      if (rafId !== null) {
        return;
      }

      rafId = window.requestAnimationFrame(updateScrollDepth);
    };

    updateScrollDepth();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }

      window.removeEventListener("scroll", handleScroll);
      root.style.removeProperty("--scroll-depth");
    };
  }, []);

  useEffect(() => {
    const shellNode = shellRef.current;

    if (!shellNode) {
      return undefined;
    }

    const trackedTargets = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.16,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    const registerTargets = () => {
      const targets = shellNode.querySelectorAll(
        ".section-card, .metric-card, .snapshot-status-card, .status-detail-card, .doctor-option-card, .request-review-card, .alert-item, .patient-list-item, .chart-wrapper, .assistant-report, .admin-user-card"
      );

      targets.forEach((target) => {
        if (trackedTargets.has(target)) {
          return;
        }

        trackedTargets.add(target);
        target.classList.add("reveal-on-scroll");
        target.style.setProperty(
          "--reveal-delay",
          `${Math.min((trackedTargets.size - 1) % 8, 6) * 45}ms`
        );
        observer.observe(target);
      });
    };

    registerTargets();

    const mutationObserver = new MutationObserver(registerTargets);
    mutationObserver.observe(shellNode, {
      childList: true,
      subtree: true,
    });

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, [title]);

  return (
    <div className="app-shell" ref={shellRef}>
      <header className="topbar">
        <div className="topbar-main">
          <div className="brand-badge">PO</div>
          <div>
            <p className="eyebrow">{t("common.appName")}</p>
            <h1>{title}</h1>
            <p className="subtitle">{subtitle}</p>
          </div>
        </div>

        <div className="topbar-actions">
          {actions}
          {user ? (
            <button
              className="ghost-button"
              type="button"
              onClick={() =>
                navigate(isProfilePage ? getRoleHomePath(user.role) : "/profile")
              }
            >
              {isProfilePage ? t("common.dashboard") : t("common.profile")}
            </button>
          ) : null}
          <PreferenceControls />
          <div className="profile-chip">
            <div>
              <strong>{user?.name}</strong>
              <span>{t(`role.${user?.role}`)}</span>
            </div>
          </div>
          <button className="ghost-button danger" type="button" onClick={logout}>
            {t("common.signOut")}
          </button>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
