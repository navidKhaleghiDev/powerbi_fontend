import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';

import { LoginIllustration } from '@/features/auth/organisms/LoginIllustration';

const slides = ['overview'] as const;

export const LoginShowcase = () => {
  const t = useTranslations('login');
  const locale = useLocale();
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPlaying(!preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!playing || hovered || focused) return;
    const timer = window.setInterval(() => setSlide((value) => (value + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [playing, hovered, focused]);

  return (
    <aside
      className="login-showcase"
      aria-label={t('carouselLabel')}
      aria-roledescription={t('carouselRole')}
      dir={locale === 'fa' ? 'rtl' : 'ltr'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div className="login-carousel-slide" key={slide} aria-live={playing ? 'off' : 'polite'}>
        <div className="login-showcase-copy">
          <span className="login-showcase-label">{t('product')}</span>
          <h2>{t(`slides.${slides[slide]}.title`)}</h2>
          <p>{t(`slides.${slides[slide]}.description`)}</p>
        </div>
        <div
          className={`login-illustration login-illustration-${slides[slide]}`}
          aria-hidden="true"
        >
          <LoginIllustration />
        </div>
      </div>
    </aside>
  );
};
