import { useLocation } from '@tanstack/react-router';

export const PageTransition = () => {
  const { pathname } = useLocation();

  return (
    <div key={pathname} className="page-split-reveal" aria-hidden="true">
      <div className="page-split-reveal-panel page-split-reveal-top" />
      <div className="page-split-reveal-panel page-split-reveal-bottom" />
    </div>
  );
};
