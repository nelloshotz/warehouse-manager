# Resoconto Controlli di Validazione durante il Parsing CSV

Questo documento descrive tutti i controlli di validazione eseguiti durante il parsing del file CSV e come vengono comunicati all'utente.

---

## 📋 Categorie di Controlli

I controlli sono divisi in due categorie principali:

1. **Controlli che causano lo SKIP della riga** (riga ignorata, non processata)
2. **Controlli di VALIDAZIONE** (riga processata ma con errori segnalati all'utente)

---

## 🚫 Controlli che causano lo SKIP della riga

Questi controlli fanno sì che la riga venga completamente ignorata durante il parsing. La riga viene aggiunta al contatore `skippedRows` e viene loggata nel file di debug, ma **NON viene mostrata nel modal di validazione**.

### 1. **File CSV vuoto o senza dati**
- **Quando**: Se il file ha meno di 2 righe (solo header o vuoto)
- **Azione**: Parsing interrotto, errore aggiunto a `result.errors`
- **Messaggio**: `"Il file CSV sembra vuoto o non contiene dati"`
- **Comunicazione**: Errore generale, parsing non procede

### 2. **Colonna "Verifica" non valida**
- **Quando**: La colonna verifica non rispetta il formato `"numero - CASILLI"`
- **Azione**: Riga saltata, aggiunta a `skippedRows`
- **Messaggio**: `"colonna verifica non valida \"{valore}\" (atteso formato: \"numero - CASILLI\")"`
- **Comunicazione**: Loggato nel file di debug, non mostrato all'utente

### 3. **Numero documento non valido**
- **Quando**: Il numero documento è vuoto o non rispetta il formato valido (es. "YYYY/NNNN")
- **Azione**: Riga saltata, aggiunta a `skippedRows`
- **Messaggio**: `"numero documento non valido \"{docNum}\" (colonna {index})"`
- **Comunicazione**: Loggato nel file di debug, non mostrato all'utente

### 4. **Data ingresso non valida e senza fallback**
- **Quando**: 
  - La colonna data ingresso è vuota o non valida
  - E non esiste una data precedente per lo stesso documento
  - E non esiste una data dal documento precedente (fallback temporaneo)
- **Azione**: Riga saltata, aggiunta a `skippedRows` e a `result.errors`
- **Messaggio**: `"data ingresso non valida (colonna {index}, valore: \"{valore}\") e nessuna data precedente per questo documento"`
- **Comunicazione**: Aggiunto a `result.errors` (visibile nei log ma non nel modal)

### 5. **Numero bancali = 0**
- **Quando**: 
  - Il numero bancali è 0, null, undefined o stringa vuota
  - E il documento non ha ancora righe valide processate
- **Azione**: Riga saltata, aggiunta a `skippedRows`
- **Messaggio**: `"numero bancali è 0 (colonna {index}, valore: {valore})"`
- **Comunicazione**: Loggato nel file di debug, non mostrato all'utente

### 6. **Numero bancali = 0 ma documento ha già righe valide**
- **Quando**: 
  - Il numero bancali è 0
  - Ma il documento ha già almeno una riga con bancali > 0 processata
- **Azione**: Riga saltata (considerata duplicato), aggiunta a `skippedRows`
- **Messaggio**: `"numero bancali è 0 (colonna {index}, valore: {valore}) e documento ha già righe con bancali > 0"`
- **Comunicazione**: Loggato nel file di debug, non mostrato all'utente

### 7. **Errori generici durante il parsing**
- **Quando**: Eccezioni non gestite durante il parsing di una riga
- **Azione**: Riga saltata, errore aggiunto a `result.errors`
- **Messaggio**: `"Errore alla riga {numero}: {motivo}"`
- **Comunicazione**: Aggiunto a `result.errors` (visibile nei log ma non nel modal)

### 8. **Errore durante la lettura del file**
- **Quando**: Errore durante l'apertura o la lettura del file CSV
- **Azione**: Parsing interrotto, errore aggiunto a `result.errors`
- **Messaggio**: `"Errore durante la lettura del file: {messaggio errore}"`
- **Comunicazione**: Errore generale, parsing non procede

---

## ⚠️ Controlli di VALIDAZIONE (mostrati all'utente)

Questi controlli **NON bloccano** il parsing (la riga viene processata), ma segnalano errori di validazione che vengono mostrati all'utente tramite il **Modal di Validazione** (`ValidationErrorsModal`).

Il modal viene mostrato automaticamente dopo il completamento del parsing se ci sono errori di validazione.

### 1. 📅 **Data Uscita Futura**
- **Tipo**: `date_future`
- **Quando**: La data di uscita è successiva alla data odierna
- **Azione**: 
  - L'uscita viene **NON registrata** (non considerata nel calcolo giacenza)
  - Errore aggiunto a `validationErrors`
- **Dettagli mostrati**:
  - Numero documento
  - Numero uscita (1-15)
  - Data futura rilevata
  - Numero bancali
  - Tipologia bancali (80X120 o 100X120)
  - Numero riga CSV
- **Messaggio**: `"Uscita {N}: data {data} futura per {bancali} bancali {tipologia} (riga {riga})"`
- **Comunicazione**: Mostrato nel modal con icona 📅

### 2. ⚠️ **Uscite Superiori all'Ingresso**
- **Tipo**: `uscite_superiori_ingresso`
- **Quando**: Il totale delle uscite (somma di tutte le uscite) è superiore al totale degli ingressi per un documento
- **Azione**: 
  - Errore aggiunto a `validationErrors` (validazione finale dopo il parsing)
  - Il documento viene comunque processato
- **Dettagli mostrati**:
  - Numero documento
  - Totale uscite calcolato
  - Totale ingresso calcolato
  - Numero riga CSV (prima riga del documento)
- **Messaggio**: `"Totale uscite ({totaleUscite}) superiore al totale ingresso ({totaleIngresso})"`
- **Comunicazione**: Mostrato nel modal con icona ⚠️

### 3. 📆 **Data Uscita Precedente all'Ingresso**
- **Tipo**: `data_uscita_precedente_ingresso`
- **Quando**: La data di uscita è precedente alla data di ingresso dello stesso documento
- **Azione**: 
  - L'uscita viene comunque registrata
  - Errore aggiunto a `validationErrors`
- **Dettagli mostrati**:
  - Numero documento
  - Numero uscita (1-15)
  - Data uscita
  - Data ingresso
  - Numero riga CSV
- **Messaggio**: `"Uscita {N}: data {dataUscita} precedente alla data ingresso {dataIngresso} (riga {riga})"`
- **Comunicazione**: Mostrato nel modal con icona 📆

### 4. ❌ **Bancali Senza Data**
- **Tipo**: `bancali_senza_data`
- **Quando**: 
  - Ci sono bancali in uscita (bancali > 0)
  - Ma non c'è una data valida per quella uscita
  - (Anche dopo i fallback: colonna successiva, data riga precedente)
- **Azione**: 
  - L'uscita viene comunque processata (se possibile con fallback)
  - Errore aggiunto a `validationErrors`
- **Dettagli mostrati**:
  - Numero documento
  - Numero uscita (1-15)
  - Numero bancali
  - Tipologia bancali
  - Numero riga CSV
- **Messaggio**: `"Uscita {N}: {bancali} bancali {tipologia} senza data (riga {riga})"`
- **Comunicazione**: Mostrato nel modal con icona ❌

### 5. ❌ **Data Senza Bancali**
- **Tipo**: `data_senza_bancali`
- **Quando**: 
  - C'è una data valida per un'uscita
  - Ma il numero bancali è 0
- **Azione**: 
  - L'uscita non viene registrata (bancali = 0)
  - Errore aggiunto a `validationErrors`
- **Dettagli mostrati**:
  - Numero documento
  - Numero uscita (1-15)
  - Data presente
  - Numero riga CSV
- **Messaggio**: `"Uscita {N}: data {data} presente ma bancali = 0 (riga {riga})"`
- **Comunicazione**: Mostrato nel modal con icona ❌

---

## 📊 Modal di Validazione

### Caratteristiche:
- **Quando viene mostrato**: Automaticamente dopo il completamento del parsing se `validationErrors.length > 0`
- **Ritardo**: 1 secondo dopo il completamento di `calculateSummaries()`
- **Layout**: 
  - Header con icona di avviso e titolo
  - Riepilogo: numero totale errori e numero documenti interessati
  - ScrollView con errori raggruppati per tipo
  - Ogni errore mostra: documento, dettagli, riga CSV
  - Footer con pulsante "Chiudi"

### Raggruppamento:
- Gli errori sono raggruppati per **tipo** (5 categorie)
- All'interno di ogni tipo, gli errori sono mostrati in ordine di apparizione
- Ogni sezione mostra il numero di errori di quel tipo

### Messaggio all'utente:
> "Trovati **{N}** errori in **{M}** documento/i  
> Correggi il file CSV e ricaricalo per calcoli corretti"

---

## 🔄 Meccanismi di Fallback (non generano errori)

Questi meccanismi cercano di recuperare dati mancanti senza generare errori:

1. **Data ingresso mancante**: Usa la data dell'ultima riga processata per lo stesso documento
2. **Data ingresso mancante (prima riga documento)**: Usa la data del documento precedente (temporaneo)
3. **Data uscita mancante**: 
   - Controlla la colonna successiva (shift di colonna)
   - Usa la data della riga precedente per la stessa uscita
4. **Data uscita non valida o precedente all'ingresso**: 
   - Controlla la colonna successiva (shift di colonna)
   - Usa la data della riga precedente per la stessa uscita

---

## 📝 Note Importanti

1. **Date future**: Vengono rilevate ma **NON vengono registrate** come uscite (non influenzano il calcolo giacenza)
2. **Errori di validazione**: Non bloccano il parsing, ma segnalano problemi che potrebbero influenzare i calcoli
3. **Righe saltate**: Vengono loggate nel file di debug ma non mostrate all'utente nel modal
4. **File di debug**: Viene generato `debug-csv-{timestamp}.log` con tutti i dettagli del parsing

---

## 🎯 Riepilogo Controlli

| Controllo | Tipo | Blocca Parsing | Mostrato all'Utente | Azione |
|-----------|------|----------------|---------------------|--------|
| File vuoto | Skip | ✅ Sì | ❌ No | Parsing interrotto |
| Colonna verifica non valida | Skip | ❌ No | ❌ No | Riga saltata |
| Numero documento non valido | Skip | ❌ No | ❌ No | Riga saltata |
| Data ingresso non valida | Skip | ❌ No | ❌ No | Riga saltata |
| Bancali = 0 | Skip | ❌ No | ❌ No | Riga saltata |
| Data uscita futura | Validazione | ❌ No | ✅ Sì (Modal) | Uscita non registrata |
| Uscite > Ingressi | Validazione | ❌ No | ✅ Sì (Modal) | Documento processato |
| Data uscita < Data ingresso | Validazione | ❌ No | ✅ Sì (Modal) | Uscita registrata |
| Bancali senza data | Validazione | ❌ No | ✅ Sì (Modal) | Uscita processata (con fallback) |
| Data senza bancali | Validazione | ❌ No | ✅ Sì (Modal) | Uscita non registrata |

---

*Documento generato il: $(date)*

