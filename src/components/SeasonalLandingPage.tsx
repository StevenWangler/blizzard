import { EnhancedHeader } from '@/components/EnhancedHeader'

/** Activation remains controlled by the existing season gate, never a countdown. */
export function SeasonalLandingPage() {
  return <section className="seasonal-standby" aria-labelledby="standby-title">
    <header className="standby-header"><EnhancedHeader /></header>
    <div className="standby-strip"><span aria-hidden="true">■</span> SEASONAL STANDBY</div>
    <div className="standby-body">
      <p className="standby-location">Rockford Public Schools · Michigan</p>
      <h2 id="standby-title">Snow-day forecasts<br />are off air.</h2>
      <figure className="standby-art"><img src="/images/broadcast/winter-school-river-v2-1280.webp" srcSet="/images/broadcast/winter-school-river-v2-640.webp 640w, /images/broadcast/winter-school-river-v2-1280.webp 1280w" sizes="(min-width: 760px) 722px, calc(100vw - 38px)" width="1280" height="640" decoding="async" alt="" /><figcaption>Illustration · not current conditions</figcaption></figure>
      <div className="standby-message"><p>Blizzard is paused for the off-season.</p><p>New forecasts return when the season is reactivated.</p></div>
      <p className="standby-school-status">For school status, check Rockford Public Schools’ announcements.</p>
      <footer>Forecast estimates never replace district announcements.</footer>
    </div>
  </section>
}
