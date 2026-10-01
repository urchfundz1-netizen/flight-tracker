import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="brand">
          <span className="brand__mark" aria-hidden="true">
            ✈
          </span>
          Flight Tracker
        </Link>
        <nav className="nav" aria-label="Main">
          <Link href="/" className="nav__link">
            Track
          </Link>
          <Link href="/admin" className="nav__link">
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <span>Flight Tracker</span>
        <span>Times shown in local airport time.</span>
      </div>
    </footer>
  );
}
