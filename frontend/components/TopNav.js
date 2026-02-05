import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { getCurrentUser, logout } from "../lib/auth";

export default function TopNav() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    let isMounted = true;
    getCurrentUser().then((currentUser) => {
      if (isMounted) setUser(currentUser);
    });
    return () => {
      isMounted = false;
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
    return router.pathname === path;
  };

  return (
    <nav className="nav">
      <Link href="/properties" className="nav-logo" aria-label="rentED home">
        <img src="/brand/logo.png" alt="rentED" />
      </Link>
      <div className="nav-links">
        <Link href="/properties" className={`nav-link ${isActive("/properties") ? "active" : ""}`}>
          Properties
        </Link>
        <Link href="/work-orders" className={`nav-link ${isActive("/work-orders") ? "active" : ""}`}>
          Work Orders
        </Link>
        <Link href="/review" className={`nav-link ${isActive("/review") ? "active" : ""}`}>
          Review
        </Link>
        {user?.role === "admin" && (
          <Link href="/users" className={`nav-link ${isActive("/users") ? "active" : ""}`}>
            Users
          </Link>
        )}
      </div>
      <button className="nav-logout" onClick={handleLogout}>Logout</button>
    </nav>
  );
}
