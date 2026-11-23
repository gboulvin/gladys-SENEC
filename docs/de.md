# SENEC.Home

Überwachen und steuern Sie Ihren **SENEC.Home**-Speicher und Ihre
**SENEC.Wallbox** in Gladys: Akkustand, Solarerzeugung, Hausverbrauch,
Netzbezug und Einspeisung, Systemzustand, Sicherheitsladung und Lademodus der
Wallbox. Alles läuft **direkt über Ihr lokales Netz**, über dieselbe
Schnittstelle wie die Weboberfläche des Systems (`lala.cgi`): kein
mein-senec.de-Konto, keine Cloud, und die Werte kommen auch ohne Internet an.

## Kompatible Systeme

- **SENEC.Home V3 hybrid / hybrid duo** (auch die LFP-Versionen);
- **SENEC.Home V2.1** und neuere SENEC.Home V2;
- die an diesen Systemen eingerichteten **SENEC.Wallbox** (bis zu 4).

**SENEC.Home 4 / P4** haben keine lokale Schnittstelle: Sie werden von dieser
Integration nicht unterstützt.

## Voraussetzungen

1. Gladys muss das System im lokalen Netz erreichen: Öffnen Sie
   `https://<senec-adresse>/` im Browser, die SENEC-Webseite muss erscheinen
   (der Browser warnt vor einem selbstsignierten Zertifikat: das ist normal).
2. Vergeben Sie dem System eine **feste IP-Adresse** (eine DHCP-Reservierung
   im Router genügt).

## Konfiguration

1. Öffnen Sie den Reiter **Konfiguration** der Integration.
2. Tragen Sie unter **Adresse des SENEC.Home** die IP-Adresse ein, z. B.
   `192.168.1.40`. Mehrere Systeme: durch Kommas trennen.
3. **Protokoll**: **HTTPS** beibehalten (aktuelle Firmware). HTTP nur für eine
   alte Firmware wählen, die nicht per HTTPS antwortet.
4. **Aktualisierungsintervall**: wie oft das System gelesen wird,
   standardmäßig 30 Sekunden (mindestens 10 Sekunden).
5. **Schwelle Solarüberschuss**: die eingespeiste Leistung (W, standardmäßig
   500), ab der der Auslöser „Solarüberschuss beginnt“ auslöst.
6. Speichern und auf **Verbindung testen** klicken: Die antwortenden Systeme
   werden mit Modell und Wallboxen angezeigt, sonst mit dem Fehlergrund.
7. Öffnen Sie den Reiter **Erkennung** und fügen Sie das SENEC.Home und seine
   Wallboxen hinzu.

## Was Sie erhalten

**Ein SENEC.Home-Gerät**, benannt nach Modell und Seriennummer:

| Funktion                                     | Typ                 |
| -------------------------------------------- | ------------------- |
| Akkustand (%)                                | Batteriespeicher    |
| Lade- / Entladeleistung des Akkus (W)        | Batteriespeicher    |
| Solarerzeugung (W)                           | Energieerzeugung    |
| Hausverbrauch (W)                            | Hausverbrauch       |
| Netzbezug / Einspeisung (W)                  | Netz                |
| Energiezähler (kWh): Solar, Haus, Netz, Akku | je nach Firmware \* |
| Akku- und Gehäusetemperatur (°C)             | Fühler              |
| Systemzustand (SENEC-Text, z. B. `CHARGE`)   | Text                |
| **Sicherheitsladung** (Schalter)             | steuerbar           |

\* Neuere Firmware (NPU-Image 2408 und später) liefert die Energiezähler nicht
mehr: Diese Funktionen erscheinen dann nicht.

**Ein Gerät pro SENEC.Wallbox**: Ladeleistung (W), Fahrzeug angesteckt,
Wallbox-Zustand und der steuerbare **Lademodus** (Schnell, Solar-optimiert,
Gesperrt).

Die **Sicherheitsladung** lädt den Akku aus dem Netz auf 100 % und hält ihn
dort: nützlich vor einem angekündigten Stromausfall oder im Niedertarif.
Beenden Sie sie, um zum normalen Betrieb zurückzukehren.

Jedes Gerät zeigt ein Abzeichen **lokal / nicht erreichbar**.

## Szenen

Auslöser:

- **SENEC-Akku voll** / **SENEC-Akku leer**;
- **SENEC-Betriebsmodus geändert**: Laden, Entladen, Akku voll, Akku leer,
  Bereitschaft, Sicherheitsladung, Wartung, Fehler, nicht erreichbar… nach
  neuem Modus filterbar; die Variablen `mode`, `previous_mode` und
  `state_name` (roher SENEC-Zustand) stehen zur Verfügung;
- **Solarüberschuss beginnt** / **Solarüberschuss endet**, mit der
  eingespeisten Leistung (`export_power`);
- **Fahrzeug an SENEC.Wallbox angesteckt / abgesteckt**.

Aktionen:

- **SENEC.Home auslesen**: liest die Werte sofort und reicht sie an die
  folgenden Aktionen weiter (Akkustand, Erzeugung, Verbrauch, Netz, Modus…);
- **SENEC-Sicherheitsladung**: starten oder beenden;
- **SENEC.Wallbox-Lademodus**: Schnell, Solar-optimiert oder Gesperrt.

Für eine Schwelle auf einen Wert (Akku über 80 %…) nutzen Sie den
Standard-Auslöser **Gerätezustand geändert** von Gladys.

## Dashboard-Widgets

- **SENEC.Home**: Erzeugung, Haus, Netz, Akku, Füllstandsanzeige, Tageskurve,
  Betriebsmodus und Knopf für die Sicherheitsladung;
- **SENEC.Wallbox**: Ladeleistung, Fahrzeug, Modus und ein Knopf pro
  Lademodus.

## Fehlerbehebung

- **„… does not answer“**: Prüfen Sie die IP-Adresse und ob sich die
  SENEC-Webseite aus dem Netz von Gladys öffnen lässt; versuchen Sie das
  andere Protokoll.
- **„… without a SENEC serial number“**: Die Adresse antwortet, ist aber kein
  kompatibles SENEC.Home (oder ein SENEC.Home 4).
- **Eingefrorene Werte**: Das System verträgt nur eine begrenzte Zahl von
  Anfragen; wählen Sie kein sehr kurzes Intervall, wenn andere Werkzeuge es
  ebenfalls abfragen.
- Die Protokolle der Integration (Seite Supervision in Gladys) zeigen jeden
  Fehler im Detail.

## Datenschutz und Sicherheit

Die Integration spricht nur mit Ihrem SENEC.Home, im lokalen Netz. Sie
speichert nichts Geheimes. Das selbstsignierte Zertifikat des Systems wird
nicht geprüft: Stellen Sie das System niemals ins Internet.
