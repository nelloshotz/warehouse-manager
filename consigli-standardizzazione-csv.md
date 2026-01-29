# Consigli per Standardizzare il File CSV Magazzino

## Problemi Rilevati

Dall'analisi del file `Magazzino Casilli Teverola - Generale new.csv` sono stati identificati i seguenti problemi:

1. **Date mancanti** (111 casi)
2. **Shift di colonne** (date nella colonna successiva)
3. **Date non valide** (valori numerici invece di date)
4. **Inconsistenza formati data** (DD/MM/YYYY vs MM/DD/YY)
5. **Punti e virgola nei percorsi file** che causano shift di colonne
6. **Date precedenti all'ingresso** (errori logici)

---

## Raccomandazioni per Standardizzazione

### 1. **Separatori e Caratteri Speciali**

#### Problema Attuale:
- I percorsi file contengono punti e virgola (`;`) che causano shift di colonne
- Esempio: `DDT Carichi - Generale\2025\Novembre 2025\07-11-2025\ES6180SX AC98736 COSTICA.pdf`

#### Soluzione Consigliata:
- **Opzione A (Raccomandata)**: Sostituire i punti e virgola nei percorsi file con caratteri alternativi:
  - Usare virgolette doppie per incapsulare i campi con separatori
  - Esempio: `"DDT Carichi - Generale\2025\Novembre 2025\07-11-2025\ES6180SX AC98736 COSTICA.pdf"`
  
- **Opzione B**: Usare un separatore diverso (es. TAB o `|`) per il CSV
  - CSV con TAB: `Magazzino Casilli Teverola - Generale.tsv`
  
- **Opzione C**: Sostituire `\` con `/` o `_` nei percorsi
  - Esempio: `DDT Carichi - Generale/2025/Novembre 2025/07-11-2025/ES6180SX AC98736 COSTICA.pdf`

---

### 2. **Standardizzazione Formato Date**

#### Problema Attuale:
- Mix di formati: `DD/MM/YYYY` e `MM/DD/YY`
- Date ambigue (es. `01/12/2024` può essere 1 dicembre o 12 gennaio)

#### Soluzione Consigliata:
- **Standardizzare su un unico formato: `DD/MM/YYYY`**
  - Tutte le date devono avere 4 cifre per l'anno
  - Usare sempre 2 cifre per giorno e mese con zero iniziale
  - Esempi validi: `01/12/2024`, `07/11/2025`, `29/10/2025`

#### Validazione Excel:
```excel
FORMULA VALIDAZIONE:
=AND(LEN(CELLA)=10, MID(CELLA,3,1)="/", MID(CELLA,6,1)="/", 
     ISNUMBER(VALUE(LEFT(CELLA,2))), VALUE(LEFT(CELLA,2))<=31,
     ISNUMBER(VALUE(MID(CELLA,4,2))), VALUE(MID(CELLA,4,2))<=12)
```

---

### 3. **Gestione Date Mancanti**

#### Problema Attuale:
- 111 righe con date di ingresso mancanti
- Date di uscita mancanti con bancali presenti

#### Soluzione Consigliata:

**Per Date di Ingresso:**
- **Obbligatorie**: La colonna DATA (colonna 8) deve sempre essere compilata
- Se un documento ha più righe, tutte le righe devono avere la stessa data di ingresso
- Usare una formula Excel per copiare automaticamente la data dalla prima riga:
  ```excel
  =IF(ISBLANK(A2), A1, A2)
  ```

**Per Date di Uscita:**
- Se ci sono bancali in uscita, la data è obbligatoria
- Se non c'è data, rimuovere anche i bancali (o viceversa)
- Non lasciare bancali senza data o data senza bancali

---

### 4. **Validazione Dati con Excel**

#### Consigliato: Aggiungere Colonne di Validazione

**Nuova Colonna "CONTROLLO DATE":**
```excel
=IF(AND(H2<>"", I2<>""), IF(DATEVALUE(H2)<=DATEVALUE(I2), "OK", "ERRORE: Data ingresso dopo data uscita"), "OK")
```

**Nuova Colonna "CONTROLLO BANCALI":**
```excel
=IF(AND(AB2<>"", AC2=""), "ERRORE: Bancali senza data", IF(AND(AB2="", AC2<>""), "ERRORE: Data senza bancali", "OK"))
```

**Nuova Colonna "CONTROLLO TOTALE":**
```excel
=IF(SUM(AB2,AE2,AI2,AO2,AU2,BA2,BG2,BM2,BS2,BY2,CE2,CK2,CQ2,CW2,DC2) > T2, "ERRORE: Uscite > Ingresso", "OK")
```

---

### 5. **Struttura Righe e Documenti**

#### Problema Attuale:
- Documenti con più righe dove solo la prima ha la data
- Bancali a zero in righe successive

#### Soluzione Consigliata:

**Regola: Ogni riga deve essere autonoma**
- Ogni riga deve avere:
  - ✅ Numero documento
  - ✅ Data di ingresso
  - ✅ Numero bancali > 0
  - ✅ Tipologia bancali
  
**Alternative:**
- Se un documento ha più tipologie di bancali, creare una riga per tipo
- Se un documento ha date di ingresso diverse, creare documenti separati

---

### 6. **Template Standardizzato**

#### Struttura Consigliata:

```csv
SCARICHI;DATA;TIPOLOGIA;DOCUMENTO;BANCALI_INGRESSO;USCITA1_BANCALI;USCITA1_DATA;USCITA2_BANCALI;USCITA2_DATA;...
```

**Con validazione:**
- Tutti i campi obbligatori devono essere compilati
- Formato date: `DD/MM/YYYY` (sempre 4 cifre anno)
- Numeri: solo valori positivi interi
- Percorsi file: tra virgolette doppie o senza `;`

---

### 7. **Checklist Pre-Export**

Prima di esportare il CSV, verificare:

- [ ] Tutte le date sono nel formato `DD/MM/YYYY`
- [ ] Nessuna data mancante dove richiesta
- [ ] Tutti i percorsi file sono tra virgolette o senza `;`
- [ ] Date di uscita >= date di ingresso
- [ ] Se ci sono bancali in uscita, c'è sempre la data
- [ ] Se c'è una data di uscita, ci sono sempre i bancali
- [ ] Totale uscite <= bancali ingresso (per ogni riga)
- [ ] Numeri bancali sono interi positivi

---

### 8. **Script di Validazione Pre-Export**

Consigliato creare uno script che validi il CSV prima di usarlo:

```javascript
// validazione-pre-export.js
// Controlla:
// 1. Formato date corretto
// 2. Date mancanti
// 3. Shift di colonne (percorsi con ;)
// 4. Coerenza date ingresso/uscita
// 5. Totale uscite <= ingressi
```

---

### 9. **Raccomandazioni per Excel**

#### Formato Celle:
- **Date**: Formato personalizzato `dd/mm/yyyy`
- **Bancali**: Formato Numero (intero)
- **Percorsi**: Formato Testo

#### Protezione Celle:
- Proteggere le colonne di calcolo
- Lasciare modificabili solo le colonne di input

#### Formule di Controllo:
- Evidenziare in rosso le righe con errori
- Bloccare il salvataggio se ci sono errori di validazione

---

### 10. **Alternative: Database invece di CSV**

Per evitare completamente questi problemi:

**Opzione A: Database Excel con Macro**
- Excel con macro VBA per validazione automatica
- Tabella strutturata con relazioni

**Opzione B: File JSON**
- Struttura dati più rigida
- Validazione automatica dello schema
- Migliore gestione dei tipi di dati

**Opzione C: Applicazione Web dedicata**
- Form di inserimento con validazione
- Database SQLite o PostgreSQL
- Export controllato

---

## Priorità di Implementazione

### 🔴 Alta Priorità (Implementare subito):
1. Standardizzare formato date su `DD/MM/YYYY`
2. Gestire punti e virgola nei percorsi file (virgolette o sostituzione)
3. Compilare tutte le date obbligatorie

### 🟡 Media Priorità (Implementare prossimamente):
4. Aggiungere colonne di validazione in Excel
5. Template standardizzato con controlli
6. Script di validazione pre-export

### 🟢 Bassa Priorità (Valutare in futuro):
7. Migrazione a database strutturato
8. Applicazione web dedicata

---

## Esempio di CSV Standardizzato

```csv
SCARICHI;DATA;N_DOCUMENTO;BANCALI_INGRESSO;USCITA1_BANCALI;USCITA1_DATA;...
"3153 - CASILLI";29/10/2025;2025/8974;1;1;"07/11/2025";...
```

**Note:**
- Percorsi file tra virgolette
- Date sempre `DD/MM/YYYY`
- Tutti i campi obbligatori compilati

---

## Contatti e Supporto

Per implementare queste modifiche:
1. Revisionare il template Excel attuale
2. Applicare le validazioni suggerite
3. Testare con un subset di dati
4. Eseguire la migrazione completa



