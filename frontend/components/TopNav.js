import Link from "next/link";

export default function TopNav() {
  return (
    <nav className="nav">
      <Link href="/" className="nav-logo" aria-label="rentED home">
        <img src="/brand/logo.png" alt="rentED" />
      </Link>
      <div className="nav-links">
        <Link href="/">Properties</Link>
        <Link href="/work-orders">Work Orders</Link>
        <Link href="/upload">Upload Document</Link>
        <Link href="/review">Review</Link>
      </div>
    </nav>
  );
}
