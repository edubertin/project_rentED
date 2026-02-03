import Link from "next/link";
import { useRouter } from "next/router";
import { logout } from "../lib/auth";

export default function TopNav() {
  const router = useRouter();
  async function handleLogout() {
    await logout();
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
        <Link href="/upload">Upload Document</Link>
        <Link href="/review">Review</Link>
      </div>
      <button className="nav-logout" onClick={handleLogout}>Logout</button>
    </nav>
  );
}
