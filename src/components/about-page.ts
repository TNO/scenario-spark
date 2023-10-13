import m from 'mithril';
import { Dashboards } from '../models';
import { MeiosisComponent, setPage } from '../services';
import { render } from 'mithril-ui-form';
import process_flow from '../assets/process_flow.png';

const md = `#### Achtergrond

ScenarioSpark is ontwikkeld als ondersteunend instrument voor de methode Risicomanagement Integrale Beveiliging van Te Beschermen Belangen (TBB’s). Specifiek biedt ScenarioSpark vooral ondersteuning bij de uitvoering van stap 2 van deze methode. Het betreft de stap waarin onder meer de te behandelen dreigingsscenario’s voor de TBB’s worden bepaald. 

![Process flow](${process_flow})

##### Doel van ScenarioSpark

ScenarioSpark is ontwikkeld om de risicomanager te ondersteunen in twee uitdagingen:

- Het op een creatieve manier ontwikkelen van plausibele scenario’s;
- Het samenstellen van een beperkte, maar toch representatieve set van scenario’s.

##### Het ontwikkelen van scenario’s

Zoals we in het recente verleden hebben gezien, blijven terroristen en andere criminelen voortdurend nieuwe manieren bedenken om onze samenleving aan te vallen. Daarom moeten we, om ons terdege voor te bereiden, ervoor waken alleen de bekende dreigingen te beoordelen, maar ook creatieve dreigingsscenario's bedenken en buiten de gebaande paden denken. Dit is makkelijker gezegd dan gedaan, omdat recente ervaringen vaak onze gedachten sturen. ScenarioSpark is ontwikkeld om hierin te ondersteunen door willekeurig (dus niet beïnvloed door vooroordelen of ervaringen uit het verleden) potentieel valide scenariostammen te genereren. Op basis van de gegenereerde suggesties kan de gebruiker vervolgens bepalen welke interessant zijn om uit te werken en in de risicoanalyse mee te nemen.

##### Het samenstellen van een beperkte, maar toch representatieve set van scenario’s

Het maken van een compleet overzicht van alle risico’s in alle situaties op alle te beschermen belangen is in het algemeen niet realistisch. Er zijn immers zoveel variaties mogelijk dat analyse hiervan niet haalbaar is. In de praktijk wordt daarom getracht een beperkt aantal scenario’s te kiezen waarmee toch een goed, representatief beeld ontstaat van alle mogelijke risico’s. 

ScenarioSpark ondersteunt hierin door inzicht te geven in welke mate een set geselecteerde scenario’s de totale risico-ruimte afdekt en welke overlappen er in die set zitten. Hiertoe wordt gebruik gemaakt van een zogenaamde ‘morfologische box’. Dat is een matrix waarin de rijen worden gevormd door alle relevante elementen die een scenario karakteriseren, en waarin de kolommen worden gevormd door de opties voor ieder van die elementen (de mogelijke waarden die de elementen kunnen aannemen). In ScenarioSpark wordt een scenario gekarakteriseerd door de keuze van één of meer opties voor ieder element. 

Uit alle gegenereerde of gedefinieerde scenario’s kan de gebruiker scenario’s selecteren om te worden toegevoegd aan de set met dreigingsscenario’s. In de morfologische box wordt aan de hand van een kleurcodering aangegeven hoe vaak bepaalde opties voorkomen in de set met geselecteerde scenario’s.
Op deze wijze kan met ScenarioSpark een set scenario’s worden samengesteld waarin de te analyseren elementen van risico’s zo efficiënt mogelijk worden behandeld in de (beperkte) set met scenario’s. Bovendien wordt voorkomen dat niet per ongeluk belangrijke elementen over het hoofd worden gezien.

##### Hoe te gebruiken

###### Het ontwikkelen van creatieve scenario’s

###### Het samenstellen van een beperkte, maar toch representatieve set van scenario’s.

###### Modus uitsluiten inconsistenties


##### Security

##### Beheer

###### Aanpassen morfologische box

###### Aanpassen categorieën

###### Aanpassen factoren

###### Aanpassen opties binnen factoren

###### Aanpassen consistenties

###### Aanpassen weergave

###### Aanpassen taal

`;

export const AboutPage: MeiosisComponent = () => {
  return {
    oninit: ({ attrs }) => setPage(attrs, Dashboards.ABOUT),
    view: ({}) => {
      return [m('.row', []), m('.row.markdown', m.trust(render(md)))];
    },
  };
};
