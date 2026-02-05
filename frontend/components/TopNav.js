import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { getCurrentUser, logout } from "../lib/auth";

export default function TopNav() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [indicator, setIndicator] = useState({ width: 0, x: 0, opacity: 0 });
  const navLinksRef = useRef(null);
  const itemRefs = useRef([]);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    getCurrentUser().then((currentUser) => {
      if (isMounted) setUser(currentUser);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [router.pathname]);

  useEffect(() => {
    let rafId = null;
    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 8);
      });
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
    router.push("/");
  }

  const isActive = (path) => {
    if (path === "/properties") return router.pathname.startsWith("/properties");
    if (path === "/work-orders") return router.pathname.startsWith("/work-orders");
    if (path === "/docs-logs") return router.pathname.startsWith("/docs-logs") || router.pathname === "/review";
    return router.pathname === path;
  };

  const links = [
    { href: "/properties", label: "Properties" },
    { href: "/work-orders", label: "Work Orders" },
    { href: "/docs-logs", label: "Docs/Logs" },
    { href: "/users", label: "Users", adminOnly: true },
  ];
  const visibleLinks = links.filter((link) => !link.adminOnly || user?.role === "admin");
  const activeIndex = visibleLinks.findIndex((link) => isActive(link.href));

  useEffect(() => {
    function updateIndicator() {
      const container = navLinksRef.current;
      const item = itemRefs.current[activeIndex];
      if (!container || !item) {
        setIndicator((prev) => ({ ...prev, opacity: 0 }));
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const width = itemRect.width;
      const x = itemRect.left - containerRect.left;
      setIndicator({ width, x, opacity: 1 });
    }

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [router.pathname, activeIndex, visibleLinks.length]);

  useEffect(() => {
    if (!mobileOpen) return;
    function handleKey(event) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        if (menuButtonRef.current) menuButtonRef.current.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  return (
    <>
      <nav className={`nav nav--glass ${isScrolled ? "nav--scrolled" : ""}`}>
        <Link href="/properties" className="nav-logo" aria-label="rentED home">
          <img src="/brand/logo.png" alt="rentED" />
        </Link>
        <div className="nav-links-wrap" ref={navLinksRef}>
          <div
            className="nav-indicator"
            style={{
              width: indicator.width,
              transform: `translateX(${indicator.x}px)`,
              opacity: indicator.opacity,
            }}
          />
          {visibleLinks.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${isActive(link.href) ? "active" : ""}`}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="nav-actions">
          <button
            className="nav-toggle"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            ref={menuButtonRef}
          >
            <span />
            <span />
            <span />
          </button>
          <button className="nav-logout" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="nav-mobile-overlay" onClick={() => setMobileOpen(false)}>
          <div className="nav-mobile-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="nav-mobile-header">
              <span>Menu</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu">Close</button>
            </div>
            <div className="nav-mobile-links">
              {visibleLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-mobile-link ${isActive(link.href) ? "active" : ""}`}
                >
                  {link.label}
                </Link>
              ))}
              <button className="nav-mobile-logout" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
