# Scenario generator

Generate a threat scenario from a self-defined morphological box.

> Chat-GPT prompt:
>
> Je bent een informatiemanager, werkzaam in het veiligheidsdomein. Op basis van scenario > elementen, zoals de locatie of de aard van een incident, schrijf je scenario's waarin deze elementen prominent en op een logische wijze naar voren komen.
>
> Schrijf een scenario in het Nederlands bestaande uit onderstaande elementen. Schrijf het niet als een verhaal, maar beschrijf het op een professionele wijze, zonder opsmuk.Highlight de gebruikte scenario elementen in je verhaal.
> Include a copy of the table (copy to Word)

## Cyber incident example

# Factoren en drijfveren voor een morfologische analyse van cyberincidenten

## Factoren/Drijveren om een cyberincidentscenario te modelleren
1. **Aanvalsvector**
   De methode waarmee een cyberaanval wordt uitgevoerd, zoals phishing, malware, ransomware, of DDoS-aanvallen.

2. **Motivatie van de aanvaller**
   Het doel van de aanval, zoals financieel gewin, sabotage, spionage, of ideologische redenen.

3. **Doelwit**
   De organisatie, sector of specifieke systemen die worden aangevallen (bijvoorbeeld kritieke infrastructuur, gezondheidszorg, financiële instellingen).

4. **Kwetsbaarheden**
   Zwakke plekken in systemen, software of processen die door aanvallers worden benut.

5. **Impactgebied**
   De gebieden die door het incident worden beïnvloed, zoals operationele verstoring, financiële schade, reputatieverlies, of datalekken.

6. **Aanvalscomplexiteit**
   De technische en organisatorische moeilijkheidsgraad van de aanval, variërend van eenvoudige tot zeer geavanceerde aanvallen.

7. **Tijdstip van de aanval**
   Het moment waarop de aanval plaatsvindt, zoals tijdens piekuren, feestdagen, of nachtelijke uren.

8. **Geografische context**
   De locatie van zowel de aanvaller als het doelwit, inclusief juridische en culturele factoren.

9. **Aanvallers**
   Het type actor dat de aanval uitvoert, zoals individuele hackers, hacktivisten, georganiseerde misdaadgroepen, of staatsactoren.

---

## Factoren/Drijveren om de respons op een cyberincident te modelleren
1. **Detectietijd**
   De tijd die nodig is om het incident te identificeren vanaf het moment dat het begint.

2. **Incidentclassificatie**
   Hoe het incident wordt beoordeeld en geclassificeerd in termen van ernst en prioriteit.

3. **Beschikbare middelen**
   De technische, financiële en personele middelen die beschikbaar zijn voor responsacties.

4. **Communicatieprotocollen**
   De interne en externe communicatiekanalen en strategieën, zoals het informeren van stakeholders, klanten, en toezichthouders.

5. **Incidentresponsplan**
   Het bestaande plan en procedures die zijn ontworpen om incidenten aan te pakken en te beheersen.

6. **Samenwerking met derden**
   De rol van externe partijen, zoals incidentrespons-teams, forensische experts, of overheidsinstanties.

7. **Hersteltijd**
   De snelheid waarmee getroffen systemen en diensten weer operationeel worden gemaakt.

8. **Juridische en nalevingsvereisten**
   De wet- en regelgeving waarmee rekening moet worden gehouden bij de respons, zoals dataverliesmeldingen of privacywetgeving.

9. **Post-incident evaluatie**
   De processen om lessen te trekken uit het incident, inclusief forensische analyse en verbetering van processen.

10. **Impactbeheersing**
   De maatregelen die worden genomen om schade aan reputatie, financiën, of operations te minimaliseren.

---

Met deze gestructureerde lijsten kun je een uitgebreide morfologische analyse uitvoeren die inzicht biedt in zowel de oorzaken als de mogelijke reacties op een cyberincident.


## Example prompt

```md
Je bent een Nederlandse scenario schrijver, werkzaam in het veiligheidsdomein. Op basis van scenario elementen, zoals de locatie of de aard van een incident, schrijf je scenario's waarin die elementen prominent en op een logische wijze naar voren komen. Maak van ieder scenario drie varianten: een best case, een realistic case, en een worst case.

Hoofdfactor	Waarde
Bron	KC Borssele
Waarschuwingstijd	48 uur
Oorzaak	Ketenincident
Bronterm	10 TBq
Neerslag in NL	Droog
Soort weer	Zomers
Dagdeel	Dag
Oogsttijd	Ja
Acuut gevarengebied 	n.v.t.
Effectgebied	10% van NL
#Aanwezigen-Acuut gebied	0
#Aanwezigen-Effectgebied	0
Aanwezige Vitale Infra	Schiphol
Ketengevolg(en)	Uitval internet
```

## TODO

- [X] Landing page
- [X] Landing page with overview of saved narratives
- [X] Morphological box page
- [X] About page
- [X] Editor for main model in Settings
- [X] Translations
- [X] Kanban drag-n-drop functionality
- Kanban direction functionality
- [X] Implement page for inconsistency settings
- [X] Implement page for scenario generation
- [X] Implement page for showing scenarios
- [X] Save data model
- [X] Load old data model
- Implement OSM functionality
- [X] Implement copy functionality
- [X] Add tooltip to show the description of a component... perhaps a fixed location, as it is rather annoying to see it popup all the time, or after a timeout?
- [X] Make generating a value optional, so some key values (component values) need to be specified manually. E.g. use the 'manual' property for each component (key factor). For example, when splitting the narrative between the threat and measures to counter the threat, you would like to choose the latter manually.
- Provide a context function of additional comments, e.g. to indicate tips on usage. E.g. when suggesting a measure that either reduces the chance, or reduces the effect, add tips on how to implement it.
- [X] Clear function should be renamed to NEW: and when pressing it, allow the user to choose one of several available models, e.g. one for threat scenarios, one for safety regions, DBB, etc. When selecting the models, choose whether to open the whole model (so including the key values), or only the key factors (components).
- Indicate how plausible a combination of certain key values is, e.g. if there are multiple combinations that are not very likely, the whole is even less likely too.

- [X] genereer scenario's: slotje standaard open ipv dicht
- [X] mogelijkheid creëren meerdere opties te selecteren binnen elke dreigingscategorie
- [X] Handmatig toevoegen van extra keuzes naast eventueel automatisch gegenereerde keuze.
- [X] Gebruikte keuzes moeten zichtbaar worden in morfbox.
- [X] in overzicht niet twee maar drie kleuren weergeven: vakje niet geselecteerd, minder dan instelbaar aantal geselecteerd, meer dan instelbaar aantal geselecteerd	Functie is om te zien welke nog aanvulling behoeven, ook als ze 1 keer voorkomen
- [X] Scenariobeschrijving in tool rich text maken / koppelen Word bestand
- [X] Scenariobeschrijving in rich tekst, plaatjes en tabellen, koppeling naar plek opslag (url / folder locatie) – zo veel mogelijk vertrouwde omgeving
- [X] admin interface / hidden elementen / flow aangeven: Wegwerken elementen die je maar zelden gebruikt in admin optie. Mogelijkheid om keuzemogelijkheden te verbergen als ze niet relevant zijn voor in een bepaalde context. Flow aangeven: voornamelijk lay-out zo maken dat volgorde logisch wordt.
- [X] landing page overzicht scenario's: Snel overzicht gebruikte/alle scenario’s. Sortering: alfabetisch, (eventueel op waarschijnlijkheid.) Per scenario stam plus ‘tagline’.
- [X] Rekening houden met inlezen oude scenario’s	Compatible of converteren
- [X] Export functies aanpassen aan update bovenstaande functies
- Help functie bijwerken: In de applicatie zetten
- [X] Do we want a visibility (eye) when creating a narrative? No, removed.
- [ ] Use collections to order multiple models
  - [ ] Add a new model to a collection
  - [ ] Import a model to a collection
  - [ ] Export a model to a collection
  - [ ] Remove a model from a collection
  - [ ] Rename a model
- [ ] Add map servers:
  - [ ] Each map server should contain a `label`, `url` and `isVector` property.
  - [ ] Display a map, if required by a model
  - [ ] Add a list of amenities from OSM to display on the map
  - [ ] Add latitude and longitude coordinates as context in a property
  - [ ] Add range (circular) in km as context in a property
- [ ] Add personas
  - [ ] Add an image and a description
  - [ ] Add them to the context
  - [ ] For each driver value that has a persona, add a persona's opinion (how does he feel about that decision)
