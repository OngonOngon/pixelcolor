<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#6055df">
  <meta name="description" content="Pixelová palba – barevná logická střílečka bez reklam, životů a mikrotransakcí.">
  <title>Pixelová palba</title>
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" href="icons/icon-192.png">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">BEZ REKLAM · OFFLINE</p>
        <h1>Pixelová palba</h1>
      </div>
      <div class="top-actions">
        <button id="installButton" class="icon-button hidden" type="button" aria-label="Nainstalovat aplikaci" title="Nainstalovat aplikaci">＋</button>
        <button id="soundButton" class="icon-button" type="button" aria-label="Vypnout zvuk" title="Zvuk">♪</button>
        <button id="helpButton" class="icon-button" type="button" aria-label="Nápověda" title="Nápověda">?</button>
      </div>
    </header>

    <main>
      <section class="status-row" aria-label="Stav hry">
        <div class="status-card"><span>Úroveň</span><strong id="levelLabel">1</strong></div>
        <div class="status-card"><span>Kostky</span><strong id="blocksLabel">0</strong></div>
        <div class="status-card"><span>Volná místa</span><strong id="freeLabel">4 / 4</strong></div>
      </section>

      <section class="game-card board-card" aria-labelledby="boardHeading">
        <div class="section-heading">
          <div>
            <p class="section-kicker">CÍL</p>
            <h2 id="boardHeading">Rozstřílej obrazec zvenku dovnitř</h2>
          </div>
          <span class="soft-pill"><span id="movesLabel">0</span> tahů</span>
        </div>
        <div class="board-stage">
          <div id="pixelBoard" class="pixel-board" role="img" aria-label="Barevný obrazec z kostek"></div>
        </div>
      </section>

      <section class="game-card rack-card" aria-labelledby="rackHeading">
        <div class="section-heading compact">
          <div>
            <p class="section-kicker">PALEBNÁ LIŠTA</p>
            <h2 id="rackHeading">Děla čekají, dokud nevystřílí náboje</h2>
          </div>
          <span class="soft-pill"><span id="cannonsLabel">0</span> děl</span>
        </div>
        <div id="cannonRack" class="cannon-rack" aria-live="polite"></div>
        <p class="microcopy">Číslo znamená počet nábojů. Dělo střílí jen do kostek své barvy, které jsou právě přístupné z okraje.</p>
      </section>

      <section class="game-card supply-card" aria-labelledby="supplyHeading">
        <div class="section-heading compact">
          <div>
            <p class="section-kicker">ZÁSOBNÍKY</p>
            <h2 id="supplyHeading">Vyber vždy horní dělo</h2>
          </div>
        </div>
        <div id="cannonStacks" class="cannon-stacks" aria-live="polite"></div>
      </section>

      <section class="controls" aria-label="Ovládání hry">
        <button id="undoButton" class="control-button secondary" type="button">↶ Vrátit tah</button>
        <button id="hintButton" class="control-button secondary" type="button">✦ Nápověda</button>
        <button id="restartButton" class="control-button danger" type="button">↻ Restart</button>
      </section>
    </main>

    <footer><p>Postup se ukládá pouze v tomto zařízení.</p></footer>
  </div>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>

  <dialog id="messageDialog" class="modal">
    <div class="modal-content">
      <div id="modalIcon" class="modal-icon">◎</div>
      <p id="modalKicker" class="section-kicker">PIXELOVÁ PALBA</p>
      <h2 id="modalTitle">Jak hrát</h2>
      <div id="modalText" class="modal-text"></div>
      <div id="modalActions" class="modal-actions"></div>
    </div>
  </dialog>

  <script src="game-core.js" defer></script>
  <script src="game.js" defer></script>
</body>
</html>
