/** Original interface emblem inspired by cinematic voice-assistant displays. */
export default function BrandHeader(){
 return <header className="jarvici-header">
  <div className="jarvici-identity">
   <svg className="jarvici-core" viewBox="0 0 140 140" fill="none" aria-hidden="true">
    <circle cx="70" cy="70" r="65" stroke="currentColor" opacity=".16"/>
    <g className="core-orbit"><circle cx="70" cy="70" r="58" stroke="currentColor" strokeWidth="2" strokeDasharray="70 14 8 14"/><circle cx="70" cy="12" r="3" fill="currentColor"/></g>
    <circle cx="70" cy="70" r="49" stroke="currentColor" strokeDasharray="1 7" strokeWidth="4" opacity=".45"/>
    <path d="M70 29 105.5 49.5v41L70 111 34.5 90.5v-41Z" stroke="currentColor" opacity=".65"/>
    <circle cx="70" cy="70" r="31" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M50 59h40L70 92Z" fill="currentColor" fillOpacity=".09" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M58 65h24L70 84Z" fill="currentColor"/>
    <path d="M0 70h15m110 0h15M70 0v15m0 110v15" stroke="currentColor" opacity=".6"/>
   </svg>
   <div className="jarvici-name"><h1 className="landing-brand">JARVICI<span className="brand-separator"> - </span><span className="brand-expansion">Just A Rather Very Intelligent<br className="brand-break"/> Car Inspector</span></h1></div>
  </div>
  <div className="jarvici-trace" aria-hidden="true"><span/><svg viewBox="0 0 110 24" fill="none"><path d="M0 12h29l5-6 6 13 8-18 8 22 7-16 5 5h42" stroke="currentColor" strokeWidth="1.2"/></svg><span/></div>
 </header>;
}
