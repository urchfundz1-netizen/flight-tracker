import Link from "next/link";
import { SiteFooter } from "@/components/SiteChrome";
import LogoutButton from "@/components/LogoutButton";

export function AdminHeader({ username }) {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/admin" className="brand">
          <span className="brand__mark" aria-hidden="true">
            ⚙
          </span>
          Admin
        </Link>
        <nav className="nav" aria-label="Admin">
          <Link href="/admin" className="nav__link">
            Flights
          </Link>
          <Link href="/admin/flights/new" className="nav__link">
            Add
          </Link>
          <Link href="/admin/account" className="nav__link">
            Account
          </Link>
          <span className="nav__link small" style={{ color: "var(--muted)", cursor: "default" }}>
            {username}
          </span>
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}

export { SiteFooter as AdminFooter };
