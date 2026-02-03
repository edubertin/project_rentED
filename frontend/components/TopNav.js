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

  return (
    <nav className="nav">
      <Link href="/properties" className="nav-logo" aria-label="rentED home">
        <img src="/brand/logo.png" alt="rentED" />
      </Link>
      <div className="nav-links">
        <Link href="/properties">Properties</Link>
        <Link href="/work-orders">Work Orders</Link>
        <Link href="/review">Review</Link>
        {user?.role === "admin" && <Link href="/users">Users</Link>}
      </div>
      <button className="nav-logout" onClick={handleLogout}>Logout</button>
    </nav>
  );
}
