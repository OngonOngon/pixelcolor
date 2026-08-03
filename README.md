# Kostková linka

Mobilní barevná logická hra inspirovaná principem třídění kostek do beden. Je vytvořená pouze v HTML, CSS a JavaScriptu.

- bez reklam
- bez životů a čekání
- bez mikrotransakcí
- funguje offline jako PWA
- ukládá rozehranou úroveň i nejlepší výsledky do `localStorage`
- neomezené vrácení tahu a restart

## Spuštění lokálně

Kvůli service workeru ji nespouštěj dvojklikem na `index.html`. V kořenové složce spusť například:

```bash
python -m http.server 8000
```

Potom otevři `http://localhost:8000`.

## Nasazení přes GitHub Pages

1. Na GitHubu vytvoř nový veřejný repozitář, například `kostkova-linka`.
2. Nahraj do něj celý obsah této složky včetně skryté složky `.github`.
3. V repozitáři otevři **Settings → Pages**.
4. V části **Build and deployment → Source** vyber **GitHub Actions**.
5. Po pushi do větve `main` proběhne automatické nasazení.
6. Web bude dostupný na adrese ve tvaru `https://UZIVATEL.github.io/kostkova-linka/`.

### Nahrání přes Git

```bash
git init
git add .
git commit -m "První verze Kostkové linky"
git branch -M main
git remote add origin https://github.com/UZIVATEL/kostkova-linka.git
git push -u origin main
```

## Instalace do telefonu

### Android / Chrome

Otevři web a klepni na tlačítko `+` vpravo nahoře, případně v nabídce prohlížeče zvol **Nainstalovat aplikaci** nebo **Přidat na plochu**.

### iPhone / Safari

Otevři web v Safari, klepni na **Sdílet** a potom na **Přidat na plochu**.

## Licence

Zdrojový kód je možné volně používat a upravovat podle licence MIT. Název, grafika i kód jsou původní a nepoužívají aktiva původní hry Color Cube Match.
