import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useNotifications } from "../../hooks/useNotifications";
import { useUiPreferences } from "../../hooks/useUiPreferences";
import { getRoleHomePath } from "../../utils/roleRoutes";
import PreferenceControls from "../common/PreferenceControls";
import { FiBell, FiX } from "react-icons/fi";

export default function AppShell({
  title,
  subtitle,
  actions,
  children,
}) {
  const { user, logout } = useAuth();
  const {
    notifications = [],
    unreadCount = 0,
    markAllRead,
    markRead,
    dismissAll,
  } = useNotifications() || {};
  const { formatDateTime, t } = useUiPreferences();
  const location = useLocation();
  const shellRef = useRef(null);
  const notificationsRef = useRef(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const primaryNavigation = user
    ? [
        {
          href: getRoleHomePath(user.role),
          label: t("common.dashboard"),
        },
        {
          href: "/profile",
          label: t("common.profile"),
        },
      ]
    : [];

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

  useEffect(() => {
    if (!notificationsOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!notificationsRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [notificationsOpen]);

  const visibleNotifications = notifications.slice(0, 10);

  return (
    <div className="app-shell" ref={shellRef}>
      <a href="#main-content" className="skip-to-content">
        {t("common.skipToContent") || "Skip to main content"}
      </a>
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
          <div className="notifications-menu" ref={notificationsRef}>
            <button
              className="icon-button notification-bell"
              type="button"
              aria-label={t("notifications.bellLabel")}
              onClick={() => setNotificationsOpen((isOpen) => !isOpen)}
            >
              <FiBell aria-hidden="true" />
              {unreadCount > 0 ? (
                <span className="notification-badge">{unreadCount}</span>
              ) : null}
            </button>

            {notificationsOpen ? (
              <div className="notifications-panel">
                <div className="notifications-panel-header">
                  <strong>{t("notifications.title")}</strong>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t("notifications.close")}
                    onClick={() => setNotificationsOpen(false)}
                  >
                    <FiX aria-hidden="true" />
                  </button>
                </div>

                <div className="notifications-actions">
                  <button className="ghost-button" type="button" onClick={markAllRead}>
                    {t("notifications.markAllRead")}
                  </button>
                  <button className="ghost-button danger" type="button" onClick={dismissAll}>
                    {t("notifications.dismissAll")}
                  </button>
                </div>

                {visibleNotifications.length ? (
                  <div className="notifications-list">
                    {visibleNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        className={
                          notification.read
                            ? "notification-item"
                            : "notification-item unread"
                        }
                        type="button"
                        onClick={() => markRead(notification.id)}
                      >
                        <span>{notification.message}</span>
                        <small>{formatDateTime(notification.createdAt)}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="notifications-empty">{t("notifications.empty")}</p>
                )}
              </div>
            ) : null}
          </div>
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

        {primaryNavigation.length ? (
          <nav className="workspace-nav" aria-label={t("common.workspaceNavigation")}>
            <div className="workspace-nav-group">
              <div className="workspace-nav-links">
                {primaryNavigation.map((item) => (
                  <Link
                    key={item.href}
                    className={
                      location.pathname === item.href
                        ? "workspace-nav-link active"
                        : "workspace-nav-link"
                    }
                    aria-current={location.pathname === item.href ? "page" : undefined}
                    to={item.href}
                  >
                    <span>{item.label}</span>
                  </Link>
                ))}
            </div>
          </div>
          </nav>
        ) : null}
      </header>

      <main id="main-content">{children}</main>
    </div>
  );
}
