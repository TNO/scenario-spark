import m from 'mithril';
import { Dashboards } from '../models';
import { MeiosisComponent, setPage } from '../services';
import { render } from 'mithril-ui-form';
import process_flow from '../assets/process_flow.png';
import menu from '../assets/menu.png';
import menu_settings from '../assets/menu_settings.png';
import menu_generate from '../assets/menu_generate.png';
import menu_tabs from '../assets/menu_tabs.png';
import menu_tabs2 from '../assets/menu_tabs2.png';
import { scrollToSection } from '../utils';

const background = `_ScenarioSpark is ontwikkeld als ondersteunend instrument voor de methode “Risicomanagement Integrale Beveiliging”. Specifiek biedt ScenarioSpark vooral ondersteuning bij de uitvoering van stap 2 van deze methode. Het betreft de stap waarin onder meer de te behandelen dreigingsscenario’s voor de TBB’s worden bepaald._

![De zes stappen van de methode “Risicomanagement Integrale Beveiliging”](${process_flow})`;

const goal = `ScenarioSpark is ontwikkeld om de risicomanager te ondersteunen in twee uitdagingen:

- Het op een creatieve manier ontwikkelen van plausibele scenario’s;
- Het samenstellen van een beperkte, maar toch representatieve set van scenario’s.

### Het ontwikkelen van creatieve scenario’s

Zoals we in het recente verleden hebben gezien, blijven terroristen en andere criminelen voortdurend nieuwe manieren bedenken om onze samenleving aan te vallen. Voor een goede beveiliging is het belangrijk dat we niet alleen bekende dreigingen beoordelen, maar ook creatieve dreigingsscenario's bedenken om buiten de gebaande paden te denken. Dit is makkelijker gezegd dan gedaan, omdat recente ervaringen vaak onze gedachten sturen. ScenarioSpark is ontwikkeld om hierin te ondersteunen door willekeurig (dus niet beïnvloed door vooroordelen of ervaringen uit het verleden) potentieel valide scenariostammen te genereren. Op basis van de gegenereerde suggesties kan de gebruiker vervolgens bepalen welke interessant zijn om uit te werken en in de risicoanalyse mee te nemen.

### Het samenstellen van een beperkte, maar toch representatieve set van scenario’s

Het maken van een compleet overzicht van alle risico’s in alle situaties op alle te beschermen belangen is in het algemeen niet realistisch. Er zijn immers zoveel variaties mogelijk dat volledige analyse hiervan niet haalbaar is. In de praktijk wordt daarom getracht een beperkte set scenario’s te kiezen waarmee toch een goed, representatief beeld ontstaat van alle mogelijke risico’s.

ScenarioSpark ondersteunt hierin door inzicht te geven in welke mate een set geselecteerde scenario’s de totale risico-ruimte afdekt en welke overlappen er in die set zitten. Hiertoe wordt gebruik gemaakt van een zogenaamde ‘morfologische box’. Dat is een matrix waarin de kolommen worden gevormd door alle relevante factoren die een scenario karakteriseren, en waarin de rijen worden gevormd door de opties voor ieder van die factoren (de mogelijke waarden die de factoren kunnen aannemen). In ScenarioSpark wordt een scenario gekarakteriseerd door de keuze van één of meer opties voor iedere factor.

Uit alle gegenereerde of gedefinieerde scenario’s kan de gebruiker de scenario’s selecteren die worden toegevoegd aan de set met te evalueren dreigingsscenario’s. In de morfologische box wordt aan de hand van een kleurcodering aangegeven hoe vaak bepaalde opties voorkomen in deze set.

Op deze wijze kan met ScenarioSpark een set scenario’s worden samengesteld waarin de te analyseren factoren van risico’s zo efficiënt mogelijk worden behandeld in de (beperkte) set met scenario’s. Bovendien wordt voorkomen dat belangrijke factoren over het hoofd worden gezien.`;

const howToUse = `### Het ontwikkelen van creatieve scenario’s

Navigeer in het hoofdmenu naar ‘maak scenario’.

![Menubalk met instellingen](${menu})
![Model en inconsistenties](${menu_tabs})

De pagina bestaat uit een aantal componenten:

1. Drie knoppen: ‘genereer’, ‘wis’ en 'bewaar’;
2. Een drop down menu waarin eerder gegenereerde scenario’s weer opgeroepen kunnen worden;
3. De factoren waaruit de morfologische box is opgebouwd;
4. Een ‘slotje’ achter ieder van de factoren;
5. Een beschrijvende titel die kan worden toegekend aan het scenario;
6. Een vinkje dat aangeeft of het scenario is geselecteerd voor evaluatie;
7. Een tekst vak waarin de scenariostam verder kan worden uitgewerkt, eventueel met opmaak en/of afbeeldingen.

Door op ‘genereer’ te klikken wordt er aan de hand van de morfologische box een scenario gegeneerd waarbij random een optie wordt toegekend aan elk van de factoren. De gebruiker heeft een aantal mogelijkheden:

1. Het scenario houden zoals is gegenereerd door de morfologische box;
2. Enkele factoren vastzetten door middel van het slotje en nieuwe opties genereren voor de andere factoren door opnieuw op ‘genereer’ te klikken;
3. Een scenario wijzigen of aanvullen door zelf een optie te kiezen voor een factor of meerdere opties te selecteren voor een factor;
4. Een compleet nieuw scenario door de tool laten genereren;
5. Een eigen scenario te creëren door handmatig optie(s) voor elke factor te selecteren.

Indien de gebruiker tevreden is met het gegenereerde scenario kan ervoor worden gekozen het scenario toe te voegen aan de lijst met de te evalueren dreigingsscenario’s. Het scenario kan worden uitgeschreven tot een verhaal en er kan een titel worden gegeven om het scenario herkenbaar en ondubbelzinnig te maken.

### Het samenstellen van een beperkte, maar toch representatieve set van scenario’s.

#### Modus uitsluiten inconsistenties

Sommige combinaties van opties van factoren zijn onmogelijk of onwaarschijnlijk. Denk bijvoorbeeld aan een cybercrimineel (actor) die fysieke informatie steelt (doelwit) door middel van een ramvoertuig (middel/ wapen). Om deze reden is er in ScenarioSpark een kruistabel toegevoegd die weergeeft wanneer combinaties van opties van factoren mogelijk, onmogelijk of onwaarschijnlijk zijn. Wanneer de modus ‘uitsluiten inconsistenties’ is aangevinkt in instellingen, is het niet mogelijk om handmatig een optie voor een factor te kiezen die onmogelijk of onwaarschijnlijk is in combinatie met de reeds geselecteerde opties voor de andere factoren.`;

const settings = `### Aanpassen morfologische box

Het aanpassen van de morfologische box kan worden gedaan in ‘instellingen’ onder het kopje ‘model’.

![Menubalk met instellingen](${menu_settings})

### Aanpassen categorieën
Door het instellen van categorieën kan de morfologische box in meerdere delen worden gesplitst (zoals dreigingen, objecten, omstandigheden). Deze mogelijkheid wordt niet gebruikt binnen de context van de Tweede Kamer.

### Selectie getoonde factoren

In dit drop down menu kan een selectie worden gemaakt van de factoren die meegenomen worden in de morfologische box.

### Aanpassen factoren

Nieuwe factoren kunnen worden toegevoegd door op het plusje naast ‘factoren’ te klikken. Er dienen een aantal gegevens te worden ingevuld:

1. Volgorde (de plek in de morfologische box waar de factor komt te staan);
2. Manuele mode (bij het automatisch genereren van een scenario wordt deze factor overgeslagen, en dient dus manueel gekozen te worden);
3. Naam;
4. Omschrijving.

Factoren kunnen worden gewijzigd door naar de desbetreffende factor te navigeren. Factoren kunnen worden verwijderd door aan de rechterkant op het kruisje te klikken.

### Aanpassen opties binnen factoren

Het aanpassen van opties binnen factoren gebeurt op de pagina van de morfologische box zelf.

![Genereren van varianten](${menu_generate})

Er kunnen nieuwe opties worden toegevoegd en bestaande opties worden gewijzigd of verwijderd. Om een nieuwe optie toe te voegen dient geklikt te worden op het plusje naast de factor, die tevoorschijn komt door met de muis over de factor te hoveren. Een optie kan worden bewerkt of verwijderd door op het pennetje te klikken dat tevoorschijn komt door met de muis over de optie te hoveren.

### Aanpassen consistenties

Het aanpassen van consistenties kan door op de pagina ‘instellingen’ te navigeren naar ‘bewerk inconsitenties’.

![Model en inconsistenties](${menu_tabs2})

ScenarioSpark beschikt over een kruistabel waarin voor alle combinaties van opties van factoren is aangegeven of het mogelijk, onwaarschijnlijk of onmogelijk is. Dit kruistabel dient handmatig te worden aangepast. Er kan een rij en een kolom worden gekozen, die beiden een factor representeren. Vervolgens kan worden aangegeven per combinatie van de opties van de factoren of de combinatie als mogelijk, onmogelijk of onwaarschijnlijk wordt geacht. Hoe meer factoren er zijn, hoe meer combinaties moeten worden gecheckt. Houd er dus rekening mee dat dit de nodige tijd in beslag neemt. Indien een nieuwe optie wordt toegevoegd aan een factor in de morfologische box, dient voor de nieuwe optie alle combinaties met bestaande opties van andere factoren beoordeeld te worden.

Let op: na het toevoegen van nieuwe opties in de morfologische box wordt geen enkele combinatie met deze nieuwe optie uitgesloten. Indien u wilt voorkomen dat niet-realistische scenario’s worden gegeneerd in de scenariogenerator, dient u handmatig de niet- realistische combinaties hier af te vinken.

### Aanpassen kleurweergave

Met behulp van kleuren kan voor de opties in de morfologische box worden aangegeven hoe vaak deze is gebruikt in een scenario. De keuze van de gebruikte kleuren, het aantal verschillende kleuren en de bandbreedtes waarin dezelfde kleur gegeven wordt, kan naar vrijheid worden ingevuld. Een optie krijgt de kleur van de bandbreedte als het aantal keer dat deze voorkomt groter of gelijk is aan het getal dat wordt ingevoerd als drempelwaarde bij de bandbreedte, zolang er geen hogere drempelwaarde bestaat waar dit ook voor geldt.

### Aanpassen taal

De taalinstelling van de tool kan worden aangepast door de gewenste vlag op de homepagina te selecteren, of het menu rechtsboven te gebruiken.`;

const security = `Omdat de informatie die in ScenarioSpark wordt gezet vertrouwelijk kan zijn, is bij het ontwerp van deze applicatie hiermee rekening gehouden door de volgende uitgangspunten te hanteren:

-	ScenarioSpark wordt geladen vanaf een website. De enige informatie die hierbij over het net gaat, is de werking van het programma. Eenmaal ingeladen in de computer, is een verbinding met internet dus ook niet meer noodzakelijk;
-	Alle informatie die door ScenarioSpark wordt gebruikt, blijft op de computer van de gebruiker (hetzij in de Browsercache, hetzij in een bewaard bestand). De mate van beveiliging van deze gegevens is hiermee gelijk aan de mate van beveiliging van de betreffende computer en volledig controleerbaar door de beheerder van de betreffende computer. Dit betreft zowel de gebruikersinstellingen, de opzet van de morfologische box, als de scenario’s.
-	Het programma biedt de mogelijkheid deze informatie op te slaan en in te lezen. De informatie wordt altijd opgeslagen in de download map van de browser (dit is de enige map waarvoor de browser schrijfrechten heeft). Het inlezen van een bestand kan vanaf elke locatie.
`;

export const AboutPage: MeiosisComponent = () => {
  return {
    oninit: ({ attrs }) => setPage(attrs, Dashboards.ABOUT),
    // oncreate: () => {
    //   const match = /#([a-zA-Z]*)/.exec(m.route.get());
    //   if (match && match.length > 0) {
    //     setTimeout(() => scrollToSection(match[1]), 100);
    //   }
    // },
    view: () => {
      const match = /#([a-zA-Z]*)/.exec(m.route.get());
      if (match && match.length > 0) {
        setTimeout(() => scrollToSection(match[1]), 0);
      }
      return m('.markdown', [
        m('aside#toc', [
          m('.center-align', [
            m('ul.list-inline', [
              m(
                'li',
                m(
                  'a',
                  {
                    href: '#goal',
                    onclick: (e: MouseEvent) => scrollToSection('goal', e),
                  },
                  'Doel van ScenarioSpark'
                )
              ),
              m('li', ' | '),
              m(
                'li',
                m(
                  'a',
                  {
                    href: '#usage',
                    onclick: (e: MouseEvent) => scrollToSection('usage', e),
                  },
                  'Hoe te gebruiken'
                )
              ),
              m('li', ' | '),
              m(
                'li',
                m(
                  'a',
                  {
                    href: '#settings',
                    onclick: (e: MouseEvent) => scrollToSection('settings', e),
                  },
                  'Beheer'
                )
              ),
              m('li', ' | '),
              m(
                'li',
                m(
                  'a',
                  {
                    href: '#security',
                    onclick: (e: MouseEvent) => scrollToSection('security', e),
                  },
                  'Security'
                )
              ),
            ]),
          ]),
        ]),
        m('main', [
          m('header', [m('h1', 'Achtergrond'), m.trust(render(background))]),
          m('section#goal', [
            m('h2', 'Doel van ScenarioSpark'),
            m.trust(render(goal)),
          ]),
          m('section#usage', [
            m('h2', 'Hoe te gebruiken'),
            m.trust(render(howToUse)),
          ]),
          m('section#settings', [m('h2', 'Beheer'), m.trust(render(settings))]),
          m('section#security', [
            m('h2', 'Security'),
            m.trust(render(security)),
          ]),
        ]),
      ]);
      //   return [m('.row', []), m('.row.markdown', m.trust(render(md)))];
    },
  };
};
