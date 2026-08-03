# Pixelová palba

Samostatná mobilní HTML/PWA logická hra. Hráč vybírá horní děla ze šesti zásobníků. Dělo se přesune na omezenou palebnou lištu a automaticky ničí kostky stejné barvy, které jsou přístupné z okraje obrazce. Dokud nevystřílí všechny náboje, zabírá místo, takže záleží na pořadí.

- bez reklam, životů, mincí a mikrotransakcí
- funguje offline
- ukládá rozehranou úroveň do zařízení
- neomezené vracení tahů, nápověda a restart
- procedurálně generované a konstrukčně ověřené řešitelné úrovně
- instalovatelná PWA pro Android i počítač

## Spuštění lokálně

Kvůli service workeru je vhodné použít lokální server:

```bash
python -m http.server 8000
```

Potom otevřete `http://localhost:8000`.

## GitHub Pages

1. Nahrajte obsah této složky do veřejného GitHub repozitáře.
2. Otevřete **Settings → Pages**.
3. Jako **Source** zvolte **GitHub Actions**.
4. Po dokončení workflow bude hra na adrese `https://UZIVATEL.github.io/REPOZITAR/`.

Workflow je v `.github/workflows/pages.yml`.

## Aktualizace existujícího repozitáře

Nahraďte staré soubory novými, včetně `game-core.js`, a změny odešlete do hlavní větve. GitHub Pages se znovu nasadí automaticky. Service worker používá novou cache `pixelova-palba-v2`, takže se aktualizace po znovunačtení stáhne.
