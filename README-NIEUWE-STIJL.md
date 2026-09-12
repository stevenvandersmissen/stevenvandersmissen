# Nieuwe stijl — geïnspireerd op foundation-labs.xyz

De site is herbouwd als **één pagina** in de stijl van Foundation Labs:
een fel, vlak kleurvlak, monospace labels tussen vierkante haken (`[ ABOUT ]`),
gigantische strakke grotesque koppen in kleine letters, afgeronde beeldkaarten
met zachte schaduw, en hover-gedrag waarbij zusterelementen dimmen.

## Wat is er nieuw

| Bestand | Rol |
|---|---|
| `index.html` | Nieuwe één-pagina site (about / work / resume / skills / contact) |
| `css/main.css` | Alle styling + animaties, geen framework, geen jQuery |
| `js/main.js` | Vanilla JS: reveals, filters, lightbox, thema-wisselaar, cursor-chip … |
| `favicon.svg` | Nieuw favicon (doolhof-monogram, past bij "Daedalus") |
| `images/opengraph.png` | Nieuwe social-preview afbeelding (1200×630) |
| `images/works/thumbs/*.webp` | Lichte webp-thumbnails voor alle kaarten (±380 KB totaal) |
| `resume.html`, `portfolio.html`, `contacts.html` | Nu doorverwijzingen naar `index.html#…` (oude links blijven werken) |

## Thema-wisselaar

Knop onderaan de pagina: `[ theme: green ]`. Cyclust door
**green → dark → blue → pink → purple** (zelfde paletten als Foundation Labs).
De keuze wordt onthouden in `localStorage` en de wissel gebeurt met een
*circular reveal* via de View Transitions API (met nette fallback).

## Animaties (allemaal met `prefers-reduced-motion` fallback)

1. **Intro** — logo, nav, kop en ticker faden getrapt in bij het laden.
2. **Word-mask reveal** — grote koppen rollen woord per woord omhoog.
3. **Scroll-reveals** — secties, kaarten en rijen komen binnen via IntersectionObserver
   (fade/slide, clip-reveal voor de portrait, stagger voor lijsten).
4. **Ticker/marquee** — oneindige band met disciplines, pauzeert bij hover.
5. **Nav-dimming** — hover je één nav-item, dan dimmen de andere (Foundation-gedrag).
6. **Kaart-hover** — beeld zoomt traag, jaartal/category-badge schuift in,
   zusterkaarten dimmen, en een **cursor-chip** ("view site", "play animation") volgt de muis.
7. **Filters** — `[ all ] [ web ] [ 2d animation ] [ teaching ]` met getrapt card-in effect.
8. **Lightbox** — animaties (jimmy, floral loop, morphing) openen in een dialoog met blur-backdrop.
9. **Rij-hover** — resume-rijen vullen zich van boven met de voorgrondkleur (invert).
10. **Scroll-progress** — dunne lijn bovenaan de pagina.
11. **Magnetische knoppen** — CV/knoppen/theme bewegen licht mee met de cursor.
12. **Thema-wissel** — circulaire view-transition vanuit de knop.

## Wave 2 — extra eye-catchers + mini-game

### Daedalus Dash (`[ PLAY ]`-sectie, `js/game.js` + `js/phaser.min.js`)
Een eigen arcade-gamepje (endless runner) volledig **in code getekend** — geen
sprites: speler, blokken, diamanten en de parallax-doolhoven op de achtergrond
worden met Phaser-graphics gegenereerd in de kleuren van het actieve thema.

- Besturing: **spatie / pijl omhoog / tap** = springen, **double jump** toegestaan
- Diamanten pakken (+25), blokken ontwijken, snelheid loopt op tot 2.4×
- Particles, squash & stretch, screenshake, crash-flash, "+25"-popups
- High score in `localStorage`; game-over-scherm met retry
- Pauzeert automatisch wanneer hij uit beeld scrolt of de tab verborgen is
- Kleurt live mee bij thema-wissel (`themechange`-event)
- Geen Phaser beschikbaar (offline)? Net fallback-bericht in de overlay

### Extra animaties bovenop wave 1
13. **Scramble-decode** — alle `[ LABELS ]` decoden karakter-voor-karakter bij reveal
14. **3D-tilt** — projectkaarten en portrait kantelen subtiel mee met de muis
15. **Count-up statistieken** — 19 / 11 / 5 tellen op bij de about-sectie
16. **Hero scroll-parallax** — de hero-tekst fades en schuift weg bij scrollen
17. **Glitch-hover** — RGB-split flicker op de grote hero-titel (knipoog naar het oude glitche-template)
18. **Shine-sweep** — lichtflits over kaartbeelden bij hover
19. **Omgekeerde ticker** — tweede marquee-band die de andere richting op draait

## Wave 3 — header-animaties + sticky topbar

- **Logo tekent zichzelf in** bij het laden (stroke-dashoffset-animatie van het
  doolhof-pad); hover geeft een speelse kwartslag i.p.v. het oude wis-effect
  (dat op touch-toestellen bleef hangen)
- **Sticky topbar** schuift naar binnen zodra je voorbij ±65% van de hero scrolt:
  mini-logo + naam, quick-nav met actieve sectie-onderstreping, live klok
  `[ MECHELEN hh:mm:ss ]` (Europe/Brussels) en een tweede thema-knop.
  Blur-backdrop, getrapte kind-animaties bij het openen, en `visibility`-delay
  zodat de verborgen bar niet focusbaar is
- **Geanimeerde underline** op de grote nav-links (schuift van links naar rechts)
- Bugfix: intro-elementen bleven na hun animatie op `opacity: 0` vallen
  (waardoor de header "leeg" leek) — opacity/transform worden nu inline gepind
  zodra de intro-animatie eindigt

## Wave 4 — interactieve physics playground in de lege hero-zone

`js/physics.js` + `js/matter.min.js` (Matter.js 0.19) + `js/gsap.min.js`
(GSAP 3.12.5) — beide lokaal, geen CDN. Verving het eerdere particle-veld.

Een echte rigid-body simulatie in de lege ruimte boven de hero-titel:

- **Shapes**: vierkanten, balken, zeskanten, driehoeken en bolletjes — gevuld
  of outline — vallen in clusters binnen en stapelen op een onzichtbare richel
  net boven de gigantische titel (de plank-positie wordt uit de DOM berekend,
  dus altijd in de échte lege zone, op elk formaat)
- **Grab & throw**: pak een shape vast en slinger hem weg (eigen pointer-logica
  met throw-velocity uit de pointer-trail — werkt met muis én touch, zonder
  het scrollen van de pagina te blokkeren); gestippelde tether tijdens vasthouden
- **Click = spawn** op de cursorpositie, **double-click = reset** met pop-out
  en verse regen; max. 34 bodies (oudste wordt weggepopt)
- **GSAP-juice**: elastic pop-in bij spawn, back.in pop-out bij removal,
  impact-ringen bij harde botsingen, ambient rain om de 6–12 s
- **Matter-physics**: gravity, restitution, friction, angular velocity,
  sleeping (spaart CPU zodra de stapel ligt)
- Eigen flat 2D-rendering in de themakleuren (kleurt live mee via `themechange`),
  shelf-lijn met streepjes en een `[ playground ]`-tag
- Pauzeert buiten beeld / verborgen tab; bij `prefers-reduced-motion` wordt een
  statische, vooraf gesettelde stapel getekend zonder interactie
- Hint `[ drag & throw ] / [ click = spawn · 2× click = reset ]` fade uit na
  de eerste interactie

## Publiceren

De map is gewoon statisch (GitHub Pages-vriendelijk). Twee opties:

**Optie A — patch toepassen op je lokale clone**
```bash
git apply --binary nieuwe-stijl.patch
git add -A && git commit -m "Nieuwe stijl (foundation-labs inspired)" && git push
```

**Optie B — mapinhoud kopiëren**
Kopieer de inhoud van deze map over je repository-root (bestanden met dezelfde
naam overschrijven) en push.

## Optionele opschoning

De nieuwe site gebruikt **geen** jQuery, isotope, magnific-popup, typed.js of ionicons meer.
Deze mappen/bestanden zijn daarom dood gewicht en mogen weg (na controle):

- `css/` (behalve `css/main.css`), `js/` (behalve `js/main.js`), `less/`, `fonts/`
- `mailer/` (PHP werkt toch niet op GitHub Pages; contact loopt nu via mailto + kopieerknop)
- `layout.css` in de root

**Behouden:** `images/works/*` (originelen voor lightbox/PDF), `images/works/thumbs/`,
`images/favicons/`, `images/me.jpg`, `CV-stevenvandersmissen.pdf`, `StevenVandersmissenCV.pdf`.

## Lettertypes

Google Fonts: **Inter Tight** (koppen/tekst) en **JetBrains Mono** (labels).
Zonder netwerk valt de site terug op Helvetica/Arial + systeem-mono.
