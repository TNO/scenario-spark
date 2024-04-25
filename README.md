# Scenario generator

Generate a threat scenario from a self-defined morphological box.

> Chat-GPT prompt:
>
> Je bent een informatiemanager, werkzaam in het veiligheidsdomein. Op basis van scenario > elementen, zoals de locatie of de aard van een incident, schrijf je scenario's waarin deze elementen prominent en op een logische wijze naar voren komen.
>
> Schrijf een scenario in het Nederlands bestaande uit onderstaande elementen. Schrijf het niet als een verhaal, maar beschrijf het op een professionele wijze, zonder opsmuk.Highlight de gebruikte scenario elementen in je verhaal.
> Include a copy of the table (copy to Word)

## TODO

- [DONE] Landing page
- [DONE] Landing page with overview of saved narratives
- [DONE] Morphological box page
- [DONE] About page
- [DONE] Editor for main model in Settings
- [DONE] Translations
- [DONE] Kanban drag-n-drop functionality
- Kanban direction functionality
- [DONE] Implement page for inconsistency settings
- [DONE] Implement page for scenario generation
- [DONE] Implement page for showing scenarios
- [DONE] Save data model
- [DONE] Load old data model
- Implement OSM functionality
- Implement copy functionality?
- [DONE] Add tooltip to show the description of a component... perhaps a fixed location, as it is rather annoying to see it popup all the time, or after a timeout?
- [DONE] Make generating a value optional, so some key values (component values) need to be specified manually. E.g. use the 'manual' property for each component (key factor). For example, when splitting the narrative between the threat and measures to counter the threat, you would like to choose the latter manually.
- Provide a context function of additional comments, e.g. to indicate tips on usage. E.g. when suggesting a measure that either reduces the chance, or reduces the effect, add tips on how to implement it.
- [PARTIALLY_DONE] Clear function should be renamed to NEW: and when pressing it, allow the user to choose one of several available models, e.g. one for threat scenarios, one for safety regions, DBB, etc. When selecting the models, choose whether to open the whole model (so including the key values), or only the key factors (components).
- Indicate how plausible a combination of certain key values is, e.g. if there are multiple combinations that are not very likely, the whole is even less likely too.
- When certain combinations are not possible, can they still be selected and overwritten in the drop down? Or should we disable or remove them? Or only indicate that they are not possible, e.g. by using a X icon in front of the option value.

- eenvoudiger opslaan en inlezen + versie stamp toevoegen: “save” en “load” button, browse in folders, liefst onthouden laatste keuze
- [DONE] genereer scenario's: slotje standaard open ipv dicht
- [DONE] mogelijkheid creëren meerdere opties te selecteren binnen elke dreigingscategorie
- [DONE] Handmatig toevoegen van extra keuzes naast eventueel automatisch gegenereerde keuze.
- [DONE] Gebruikte keuzes moeten zichtbaar worden in morfbox.
- [DONE] in overzicht niet twee maar drie kleuren weergeven: vakje niet geselecteerd, minder dan instelbaar aantal geselecteerd, meer dan instelbaar aantal geselecteerd	Functie is om te zien welke nog aanvulling behoeven, ook als ze 1 keer voorkomen
- [DONE] Scenariobeschrijving in tool rich text maken / koppelen Word bestand
- [DONE] Scenariobeschrijving in rich tekst, plaatjes en tabellen, koppeling naar plek opslag (url / folder locatie) – zo veel mogelijk vertrouwde omgeving
- [DONE] admin interface / hidden elementen / flow aangeven: Wegwerken elementen die je maar zelden gebruikt in admin optie. Mogelijkheid om keuzemogelijkheden te verbergen als ze niet relevant zijn voor in een bepaalde context. Flow aangeven: voornamelijk lay-out zo maken dat volgorde logisch wordt.
- [DONE] landing page overzicht scenario's: Snel overzicht gebruikte/alle scenario’s. Sortering: alfabetisch, (eventueel op waarschijnlijkheid.) Per scenario stam plus ‘tagline’.
- Rekening houden met inlezen oude scenario’s	Compatible of converteren
- [DONE] Export functies aanpassen aan update bovenstaande functies
- Help functie bijwerken: In de applicatie zetten
- Do we want a visibility (eye) when creating a narrative?
