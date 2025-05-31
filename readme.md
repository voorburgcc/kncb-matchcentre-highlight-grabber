# 🏏 KNCB Matchcentre Highlight Extractor

Een eenvoudige Chrome-extensie die automatisch de highlights van het **KNCB Match Centre** uitleest, en per highlight de **over** en **balnummer** toevoegt. Handig voor het snel samenstellen van een tijdlijn voor de beschrijving van een YouTube livestream of highlightvideo.

## 🎯 Functionaliteit

- ✅ Extraheert alle highlight-momenten van een KNCB-wedstrijdpagina
- ✅ Voegt per highlight de over en het balnummer toe
- ✅ Kopieert het resultaat naar het klembord in een kant-en-klaar formaat voor YouTube

## 💡 Voorbeeldoutput

```
3.2 - Four by Seelaar  
5.4 - Wicket: O'Dowd b Sharma  
10.1 - Six by Zulfiqar
```

Deze tekst kan direct in de YouTube-beschrijving geplakt worden.

## 🔧 Installatie

1. Clone deze repository:

   ```bash
   git clone https://github.com/voorburgcc/kncb-matchcentre-highlight-grabber.git
   ```

2. Open Chrome en ga naar: `chrome://extensions/`
3. Zet rechtsboven **Developer mode** aan
4. Klik op **Load unpacked**
5. Selecteer de map van je project

## 🛠 Gebruik

1. Ga naar een KNCB Match Centre-pagina met highlights.
2. Klik op het extensie-icoon in Chrome.
3. De gegenereerde lijst met highlights wordt gekopieerd naar je klembord.
4. Plak het direct in je YouTube-beschrijving of document.

## 🔄 Workflow voor development (meerdere apparaten)

### Op apparaat A (waar je iets wijzigt):

```bash
git add .
git commit -m "wat je wijzigt"
git push
```

### Op apparaat B:

```bash
git pull
```

Klik daarna op **Reload** bij de extensie in `chrome://extensions/`.

## 📋 TODO

- [ ] timestamps bij highlights

## 📜 Licentie

MIT © Voorburg Cricket Club
