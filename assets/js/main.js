/* Kytkafe: demo web, fáze 1. Bez knihoven. */
(function () {
  'use strict';

  var doc = document;
  doc.documentElement.classList.add('js');

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  /* ---------- 1. Hlavička a mobilní navigace ---------- */
  var hlavicka = $('.hlavicka');
  var nav = $('#nav');
  var tlacitko = $('.menu-tlacitko');

  function onScroll() {
    if (hlavicka) hlavicka.classList.toggle('je-odscrollovano', window.scrollY > 10);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function zavriMenu(vratFocus) {
    if (!nav || !tlacitko) return;
    nav.classList.remove('je-otevrena');
    tlacitko.setAttribute('aria-expanded', 'false');
    if (vratFocus) tlacitko.focus();
  }
  if (nav && tlacitko) {
    tlacitko.addEventListener('click', function () {
      var otevrena = nav.classList.toggle('je-otevrena');
      tlacitko.setAttribute('aria-expanded', String(otevrena));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) zavriMenu(false);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('je-otevrena')) zavriMenu(true);
    });
  }

  /* ---------- 2. Aktivní sekce v navigaci ---------- */
  var odkazyNav = $$('.nav-odkazy a');
  var sekce = odkazyNav.map(function (a) {
    var id = (a.getAttribute('href') || '').split('#')[1];
    return id ? doc.getElementById(id) : null;
  }).filter(Boolean);

  if ('IntersectionObserver' in window && sekce.length) {
    var vsechnyKotvy = sekce.concat([doc.getElementById('napiste')]).filter(Boolean);
    var pozorovatel = new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) {
        if (!z.isIntersecting) return;
        odkazyNav.forEach(function (a) {
          var id = (a.getAttribute('href') || '').split('#')[1];
          if (id === z.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    vsechnyKotvy.forEach(function (s) { pozorovatel.observe(s); });
  }

  /* ---------- 3. Stav otevření (kapitola 19) ---------- */
  var NBSP = '\u00a0';
  var DNY4 = ['v neděli', 'v pondělí', 'v úterý', 've středu', 've čtvrtek', 'v pátek', 'v sobotu'].map(function (d) { return d.replace(' ', NBSP); });
  var data = null;
  var blok = doc.getElementById('oteviraci-doba');
  if (blok) {
    try { data = JSON.parse(blok.textContent); } catch (e) { data = null; }
  }

  function minuty(hhmm) { var p = hhmm.split(':'); return +p[0] * 60 + +p[1]; }
  function cas(min) { return Math.floor(min / 60) + ':' + ('0' + (min % 60)).slice(-2); }
  function dow(iso) { var p = iso.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); }
  function pridejDny(iso, n) {
    var p = iso.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10);
  }

  /* Aktuální okamžik v pásmu Europe/Prague. Pro zkoušení: ?cas=2026-11-06T19:00 */
  function ted() {
    var m = /[?&]cas=(\d{4}-\d{2}-\d{2})T(\d{1,2}):(\d{2})/.exec(location.search);
    if (m) return { datum: m[1], min: +m[2] * 60 + +m[3] };
    var c = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).forEach(function (p) { c[p.type] = p.value; });
    return { datum: c.year + '-' + c.month + '-' + c.day, min: +c.hour * 60 + +c.minute };
  }

  /* Intervaly platné pro dané datum: výjimka má přednost před běžným týdnem. */
  function intervaly(iso) {
    var seznam = null;
    data.vyjimky.forEach(function (v) { if (iso >= v.od && iso <= v.do) seznam = v.intervaly; });
    if (!seznam) seznam = data.tyden[(dow(iso) + 6) % 7].intervaly;
    return seznam.map(function (i) { return [minuty(i[0]), minuty(i[1])]; });
  }

  /* Nejbližší otevření od zítřka, nejvýš 14 dní dopředu. */
  function pristiOtevreni(dnes) {
    for (var i = 1; i <= 14; i++) {
      var iv = intervaly(pridejDny(dnes, i));
      if (iv.length) {
        return (i === 1 ? 'zítra' : DNY4[dow(pridejDny(dnes, i))]) + ' v' + NBSP + cas(iv[0][0]);
      }
    }
    return null;
  }

  function spocitej() {
    var n = ted();
    var iv = intervaly(n.datum);
    var vysledek = { otevreno: false, text: '', dnes: '' };
    var bezi = null, dalsi = null;
    iv.forEach(function (i) {
      if (n.min >= i[0] && n.min < i[1]) bezi = i;
      else if (n.min < i[0] && !dalsi) dalsi = i;
    });
    var pristi = pristiOtevreni(n.datum);

    if (bezi) {
      vysledek.otevreno = true;
      vysledek.text = 'Dnes otevřeno do ' + cas(bezi[1]);
    } else if (dalsi) {
      vysledek.text = 'Teď zavřeno, otevíráme v' + NBSP + cas(dalsi[0]);
    } else if (pristi) {
      vysledek.text = 'Teď zavřeno, otevíráme ' + pristi;
    } else {
      vysledek.text = 'Teď zavřeno';
    }

    if (bezi || dalsi) {
      vysledek.dnes = 'Dnes ' + iv.map(function (i) { return cas(i[0]) + ' až ' + cas(i[1]); }).join(' a ');
    } else {
      vysledek.dnes = pristi ? 'Dnes zavřeno, otevíráme ' + pristi : 'Dnes zavřeno';
    }
    vysledek.dnesDen = (dow(n.datum) + 6) % 7 + 1; // 1 pondělí až 7 neděle
    return vysledek;
  }

  function vykresliStav() {
    if (!data) return;
    var s = spocitej();
    $$('[data-stav-otevreni]').forEach(function (el) {
      el.textContent = s.text;
      el.setAttribute('data-stav', s.otevreno ? 'otevreno' : 'zavreno');
    });
    $$('[data-dnes]').forEach(function (el) { el.textContent = s.dnes; });
    $$('.hodiny').forEach(function (t) {
      t.classList.toggle('zavreno', !s.otevreno);
      $$('tr', t).forEach(function (r) {
        r.classList.toggle('je-dnes', +r.getAttribute('data-den') === s.dnesDen);
      });
    });
  }
  vykresliStav();
  setInterval(vykresliStav, 60000);

  /* ---------- 4. Formulář ---------- */
  var form = doc.getElementById('formular');
  var napiste = doc.getElementById('napiste');

  var PLACEHOLDERY = {
    kytice: 'Barvy, oblíbené květiny, komu je kytice určená…',
    workshop: 'Co byste chtěli vést, co k tomu potřebujete a co čekáte od nás…',
    svatba: 'Jaká je představa, jaké barvy a květiny se vám líbí…',
    dekorace: 'Co chcete vyzdobit a jak by to mělo vypadat…',
    jine: 'S čím vám můžeme pomoct…'
  };

  function nastavChybu(poleId, chybaId, zprava) {
    var pole = doc.getElementById(poleId);
    var el = doc.getElementById(chybaId);
    if (el) el.textContent = zprava ? 'Chyba: ' + zprava : '';
    if (pole) {
      if (zprava) pole.setAttribute('aria-invalid', 'true');
      else pole.removeAttribute('aria-invalid');
    }
  }

  if (form) {
    var kroky = $$('.krok', form);
    var posledni = kroky.length - 1;
    var poradi = 0;
    var stavKroku = $('#krok-stav', form);
    var zpet = $('#krok-zpet', form);
    var dalsi = $('#krok-dalsi', form);
    var demoPoznamka = $('#demo-poznamka', form);

    /* Zobrazí jeden krok. S fokusem přesune pozornost na jeho nadpis (klávesnice, čtečky obrazovky). */
    function ukazKrok(i, fokus) {
      poradi = i;
      kroky.forEach(function (k, j) { k.hidden = j !== i; });
      stavKroku.textContent = 'Krok ' + (i + 1) + ' ze ' + kroky.length;
      zpet.hidden = i === 0;
      dalsi.textContent = i === posledni ? 'Odeslat' : 'Další';
      if (demoPoznamka) demoPoznamka.hidden = i !== posledni;
      if (fokus) {
        kroky[i].focus({ preventScroll: true });
        if (form.getBoundingClientRect().top < 80) form.scrollIntoView();
      }
    }

    function hodnota(id) { var el = doc.getElementById(id); return el && !el.disabled ? el.value.trim() : ''; }

    /* Ověří jeden krok, vrací první chybné pole nebo null. */
    function overKrok(i) {
      var prvni = null;
      function chyba(poleId, chybaId, zprava) {
        nastavChybu(poleId, chybaId, zprava);
        if (!prvni) prvni = doc.getElementById(poleId);
      }
      if (i === 0) {
        nastavChybu('typ-skupina', 'chyba-typ', '');
        if (!$('input[name="typ"]:checked', form)) chyba('typ-skupina', 'chyba-typ', 'Vyberte prosím, co chystáte.');
      } else if (i === 1) {
        nastavChybu('jmeno', 'chyba-jmeno', '');
        if (!hodnota('jmeno')) chyba('jmeno', 'chyba-jmeno', 'Vyplňte prosím jméno.');
      } else if (i === 2) {
        var tel = hodnota('telefon'), mail = hodnota('email');
        nastavChybu('telefon', 'chyba-kontakt', '');
        nastavChybu('email', 'chyba-kontakt', '');
        if (!tel && !mail) {
          chyba('telefon', 'chyba-kontakt', 'Vyplňte prosím telefon nebo e-mail.');
          doc.getElementById('email').setAttribute('aria-invalid', 'true');
        } else if (tel && tel.replace(/\D/g, '').length < 9) {
          chyba('telefon', 'chyba-kontakt', 'Telefon má mít aspoň 9 číslic.');
        } else if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
          chyba('email', 'chyba-kontakt', 'Zkontrolujte prosím e-mail, zdá se, že v něm něco chybí.');
        }
      } else {
        var kdy = doc.getElementById('kdy');
        nastavChybu('kdy', 'chyba-kdy', '');
        if (kdy && kdy.required && !kdy.value) chyba('kdy', 'chyba-kdy', 'Vyplňte prosím, na kdy kytici potřebujete.');
      }
      return prvni;
    }

    function nastavTyp(typ) {
      var radio = $('input[name="typ"][value="' + typ + '"]', form);
      if (radio) radio.checked = true;
      $$('.skupina', form).forEach(function (s) {
        var aktivni = s.getAttribute('data-typ') === typ;
        s.hidden = !aktivni;
        $$('input, select, textarea', s).forEach(function (p) {
          p.disabled = !aktivni;
          if (p.hasAttribute('data-req')) p.required = aktivni;
        });
      });
      var zprava = $('#zprava', form);
      if (zprava && PLACEHOLDERY[typ]) zprava.placeholder = PLACEHOLDERY[typ];
    }

    /* Typ z odkazu (například ?typ=svatba) je odpověď na první krok, takže se rovnou přejde na jméno. */
    function predvyplnZParametru(query) {
      var typ = new URLSearchParams(query).get('typ');
      if (!typ || !$('input[name="typ"][value="' + typ + '"]', form)) return;
      nastavTyp(typ);
      nastavChybu('typ-skupina', 'chyba-typ', '');
      ukazKrok(1, false);
    }

    $$('input[name="typ"]', form).forEach(function (r) {
      r.addEventListener('change', function () { nastavTyp(r.value); nastavChybu('typ-skupina', 'chyba-typ', ''); });
    });
    var vybrany = $('input[name="typ"]:checked', form);
    nastavTyp(vybrany ? vybrany.value : '');
    ukazKrok(vybrany ? 1 : 0, false);
    if (location.search) predvyplnZParametru(location.search);

    /* Tlačítka "Poptat", "Nabídnout workshop" a podobná předvyplní formulář bez načtení stránky. */
    doc.addEventListener('click', function (e) {
      var a = e.target.closest('a[href*="typ="]');
      if (!a || !napiste) return;
      e.preventDefault();
      predvyplnZParametru(a.getAttribute('href').split('#')[0]);
      napiste.scrollIntoView();
      napiste.focus({ preventScroll: true });
      if (history.replaceState) history.replaceState(null, '', '#napiste');
    });

    $$('input, select, textarea', form).forEach(function (p) {
      p.addEventListener('input', function () {
        if (p.id === 'telefon' || p.id === 'email') {
          nastavChybu('telefon', 'chyba-kontakt', '');
          nastavChybu('email', 'chyba-kontakt', '');
        } else {
          nastavChybu(p.id, 'chyba-' + p.id, '');
        }
      });
    });

    zpet.addEventListener('click', function () { if (poradi > 0) ukazKrok(poradi - 1, true); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var past = form.elements.web;
      if (!(past && past.value)) {
        if (poradi < posledni) {
          var chybne = overKrok(poradi);
          if (chybne) chybne.focus();
          else ukazKrok(poradi + 1, true);
          return;
        }
        /* Poslední krok: před odesláním znovu projít všechny kroky. */
        for (var i = 0; i <= posledni; i++) {
          var c = overKrok(i);
          if (c) { ukazKrok(i, false); c.focus(); return; }
        }
      }

      var potvrzeni = doc.createElement('div');
      potvrzeni.className = 'potvrzeni';
      potvrzeni.tabIndex = -1;
      potvrzeni.setAttribute('role', 'status');
      potvrzeni.innerHTML = '<h3>Děkujeme, máme to.</h3>' +
        '<p>Ozveme se vám co nejdřív.</p>' +
        '<p class="mala">Ukázka webu. Nic se neodeslalo.</p>';
      form.replaceWith(potvrzeni);
      var cas = $('.napiste-cas');
      if (cas) cas.hidden = true;
      potvrzeni.focus();
    });
  }
})();
