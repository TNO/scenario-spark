import type {
  Category,
  DataModel,
  Inconsistencies,
  Scenario,
  ScenarioComponent,
  ThresholdColor,
} from './data-model';

type FactorSpec = {
  id: string;
  label: string;
  desc: string;
  values: [id: string, label: string][];
};

type CategorySpec = {
  id: string;
  label: string;
  desc: string;
  factors: FactorSpec[];
};

type BoxSpec = {
  id: string;
  label: string;
  desc: string;
  categories: CategorySpec[];
  exclusions: [from: string, to: string][];
  prompt: string;
  example: { label: string; desc: string; choices: string[] };
};

const boxes: BoxSpec[] = [
  {
    id: 'evenementenveiligheid',
    label: 'Evenementenveiligheid',
    desc: 'Verken hoe bezoekersstromen, terrein, weersomstandigheden en beschikbare capaciteit de voorbereiding van een evenement beïnvloeden. De opgegeven capaciteit is een scenario-aanname, geen vergunningsnorm.\n\nBron: [NIPV – Evenementenveiligheid](https://nipv.nl/onderzoek/evenementenveiligheid/).',
    categories: [
      {
        id: 'evenement', label: 'Evenement en locatie',
        desc: 'Het soort bijeenkomst en de inrichting van de locatie bepalen welke partijen en bezoekersstromen aandacht vragen.',
        factors: [
          { id: 'soort', label: 'Soort evenement', desc: 'Welke bijeenkomst vormt het uitgangspunt voor de oefening?', values: [['festival', 'Cultureel festival'], ['wedstrijd', 'Sportwedstrijd'], ['markt', 'Publieke markt']] },
          { id: 'terrein', label: 'Terrein', desc: 'Hoe is de publieksruimte fysiek ingericht?', values: [['openbaar', 'Openbare buitenruimte'], ['afgesloten', 'Afgesloten terrein'], ['gebouw', 'Gebouw of hal']] },
        ],
      },
      {
        id: 'belasting', label: 'Belasting en omstandigheden',
        desc: 'Variaties in verwachte opkomst en weer veranderen het handelingsperspectief.',
        factors: [
          { id: 'opkomst', label: 'Verwachte opkomst', desc: 'Hoeveel bezoekers zijn gelijktijdig op locatie aanwezig?', values: [['klein', 'Tot 500 bezoekers'], ['middel', '1.000–5.000 bezoekers'], ['groot', 'Meer dan 10.000 bezoekers']] },
          { id: 'weer', label: 'Weersituatie', desc: 'Welke omstandigheden moeten in de voorbereiding worden meegewogen?', values: [['rustig', 'Rustig weer'], ['hitte', 'Aanhoudende hitte'], ['regen', 'Langdurige regen'], ['storm', 'Zware wind']] },
        ],
      },
      {
        id: 'organisatie', label: 'Organisatie en toegang',
        desc: 'Capaciteit en toegang zijn expliciete ontwerpkeuzes, geen voorspelling van werkelijk gedrag.',
        factors: [
          { id: 'maximum', label: 'Toegestane gelijktijdige capaciteit', desc: 'Welk maximum is voor deze fictieve locatie vastgesteld?', values: [['vijfhonderd', 'Maximaal 500'], ['vijfduizend', 'Maximaal 5.000'], ['ruim', 'Meer dan 10.000']] },
          { id: 'toegang', label: 'Toegangsregime', desc: 'Hoe wordt bezoekers toegang verleend?', values: [['vrij', 'Vrije toegang'], ['ticket', 'Toegang met ticket'], ['uitnodiging', 'Alleen genodigden']] },
        ],
      },
    ],
    exclusions: [['opkomst.middel', 'maximum.vijfhonderd'], ['opkomst.groot', 'maximum.vijfhonderd'], ['opkomst.groot', 'maximum.vijfduizend']],
    prompt: 'Schrijf in het Nederlands een geloofwaardig oefenscenario voor evenementenveiligheid met de gekozen waarden. Beschrijf het verloop van publieksstromen, de samenwerking tussen organisator, gemeente en hulpdiensten en een dilemma rond capaciteit of weer. Maak aannames expliciet; geef geen operationele kwetsbaarheden of omzeilingsinstructies. Sluit af met twee reflectievragen.',
    example: {
      label: 'Een festivalavond die anders loopt',
      desc: '<p>Een cultureel festival op een afgesloten terrein verwacht enkele duizenden bezoekers. Aanhoudende hitte verandert de vraag naar water, schaduw en rustplekken. Terwijl de toegang met tickets ordelijk verloopt, bespreken organisator en gemeente of de geplande capaciteit nog past bij de omstandigheden en hoe zij bezoekers tijdig informeren.</p>',
      choices: ['soort.festival', 'terrein.afgesloten', 'opkomst.middel', 'weer.hitte', 'maximum.vijfduizend', 'toegang.ticket'],
    },
  },
  {
    id: 'cybercontinuiteit',
    label: 'Cyberincident en continuïteit',
    desc: 'Een defensief oefenmodel voor dienstverlening, ketenafhankelijkheid en herstel na een digitaal incident. Het beschrijft gevolgen en governance, niet de uitvoering van een aanval.\n\nBron: [NCSC – Incidenten en herstellen](https://www.ncsc.nl/incidenten-en-herstellen/resultaten).',
    categories: [
      {
        id: 'dienst', label: 'Dienstverlening',
        desc: 'Welke dienst en digitale afhankelijkheden staan centraal?',
        factors: [
          { id: 'sector', label: 'Betrokken dienst', desc: 'Welke maatschappelijke functie wordt door de verstoring geraakt?', values: [['zorg', 'Zorgverlening'], ['gemeente', 'Gemeentelijke dienstverlening'], ['logistiek', 'Logistieke coördinatie']] },
          { id: 'netwerk', label: 'Netwerkverbinding van de dienst', desc: 'In welke mate is de betreffende dienst verbonden met externe netwerken?', values: [['los', 'Volledig zelfstandig zonder netwerk'], ['partner', 'Alleen partnernetwerk'], ['internet', 'Via internet bereikbaar']] },
        ],
      },
      {
        id: 'incident', label: 'Incidentbeeld',
        desc: 'Het waarneembare effect en de fase van de afhandeling.',
        factors: [
          { id: 'effect', label: 'Waarneembaar effect', desc: 'Welk effect merkt de organisatie zonder de oorzaak al vast te stellen?', values: [['uitval', 'Volledige uitval van de digitale dienst'], ['twijfel', 'Twijfel over gegevenskwaliteit'], ['leverancier', 'Verstoring bij een leverancier']] },
          { id: 'fase', label: 'Fase van afhandeling', desc: 'Waar staat de organisatie in de incidentcyclus?', values: [['detectie', 'Signalering en verificatie'], ['respons', 'Coördinatie tijdens het incident'], ['herstel', 'Herstel en evaluatie']] },
        ],
      },
      {
        id: 'aanpak', label: 'Continuïteit en contact',
        desc: 'Hoe blijven dienstverlening en communicatie mogelijk?',
        factors: [
          { id: 'kanaal', label: 'Kanaal voor deze dienst', desc: 'Via welk kanaal kunnen gebruikers de betreffende dienst bereiken?', values: [['lokaal', 'Alleen ter plaatse'], ['intern', 'Via het interne netwerk'], ['online', 'Via een publiek online loket']] },
          { id: 'niveau', label: 'Digitale beschikbaarheid', desc: 'In hoeverre werkt de betrokken digitale dienst momenteel?', values: [['offline', 'Niet digitaal beschikbaar'], ['beperkt', 'Beperkt digitaal beschikbaar'], ['normaal', 'Normaal digitaal beschikbaar']] },
        ],
      },
    ],
    exclusions: [['netwerk.los', 'kanaal.intern'], ['netwerk.los', 'kanaal.online'], ['netwerk.partner', 'kanaal.online'], ['effect.uitval', 'niveau.normaal']],
    prompt: 'Maak een Nederlandstalig oefenscenario voor defensieve cybercontinuïteit op basis van de gekozen waarden. Leg de gevolgen voor gebruikers, verificatie van feiten, besluitvorming, ketenpartners en herstel uit. Onderscheid waarnemingen van vermoedens; beschrijf geen aanvalsstappen, zwakke plekken of omzeiling. Eindig met twee vragen over dienstverlening en communicatie.',
    example: {
      label: 'Het gemeentelijke loket valt weg',
      desc: '<p>Een gemeentelijke dienst met een publiek online loket valt digitaal uit. De organisatie onderzoekt nog of de gegevens betrouwbaar zijn en organiseert een tijdelijk contactpunt op locatie. Gemeente, leverancier en communicatieadviseurs moeten afstemmen welke dienstverlening voorrang krijgt en wat zij al met inwoners kunnen delen.</p>',
      choices: ['sector.gemeente', 'netwerk.internet', 'effect.uitval', 'fase.respons', 'kanaal.online', 'niveau.offline'],
    },
  },
  {
    id: 'hoogwater',
    label: 'Hoogwater en wateroverlast',
    desc: 'Oefen afwegingen rond hoogwater, blootstelling van inwoners en bereikbaarheid van hulp. De scenario-opties zijn fictief en vervangen geen actuele waarschuwingen.\n\nBron: [Deltaprogramma – Waterveiligheid](https://www.deltaprogramma.nl/themas/waterveiligheid).',
    categories: [
      {
        id: 'water', label: 'Waterbeeld',
        desc: 'Bron en zichtbare toestand van het water in het oefengebied.',
        factors: [
          { id: 'bron', label: 'Dominante waterbron', desc: 'Waar komt het water in deze fictieve situatie hoofdzakelijk vandaan?', values: [['rivier', 'Hoge rivierafvoer'], ['kust', 'Hoge zeewaterstand'], ['regen', 'Extreme neerslag']] },
          { id: 'beeld', label: 'Zichtbaar effect', desc: 'Welke waarneembare gevolgen zijn er op dit moment?', values: [['droog', 'Gebied nog droog'], ['straat', 'Straten onder water'], ['woning', 'Gebouwen onder water']] },
        ],
      },
      {
        id: 'omgeving', label: 'Gebied en blootstelling',
        desc: 'De omgeving bepaalt de aard van de mogelijke maatschappelijke gevolgen.',
        factors: [
          { id: 'gebied', label: 'Type gebied', desc: 'Welk gebied is het zwaartepunt van de oefening?', values: [['stad', 'Dichtbebouwde wijk'], ['dorp', 'Landelijk dorp'], ['knooppunt', 'Vitale voorzieningen']] },
          { id: 'inwoners', label: 'Potentieel getroffen inwoners', desc: 'Hoe groot is de groep die mogelijk hulp of informatie nodig heeft?', values: [['beperkt', 'Enkele huishoudens'], ['wijk', 'Een wijk of dorp'], ['regio', 'Meerdere gemeenten']] },
        ],
      },
      {
        id: 'bereikbaarheid', label: 'Bereikbaarheid en hulp',
        desc: 'De feitelijke toegangswegen begrenzen hoe hulp kan worden aangevoerd.',
        factors: [
          { id: 'wegen', label: 'Toegangswegen tot het gebied', desc: 'Zijn toegangswegen voor voertuigen beschikbaar?', values: [['open', 'Alle toegangswegen berijdbaar'], ['deels', 'Sommige toegangswegen berijdbaar'], ['dicht', 'Alle toegangswegen afgesloten']] },
          { id: 'aanvoer', label: 'Aanvoer van hulp', desc: 'Hoe bereikt hulp van buiten het gebied de getroffen locatie?', values: [['direct', 'Over de gewone toegangsweg'], ['omweg', 'Via een alternatieve toegangsweg'], ['nietweg', 'Niet over de weg']] },
        ],
      },
    ],
    exclusions: [['wegen.dicht', 'aanvoer.direct'], ['wegen.dicht', 'aanvoer.omweg']],
    prompt: 'Schrijf een Nederlandstalig hoogwaterscenario voor een veiligheidsregio. Verbind de gekozen waterbron, het zichtbare waterbeeld, potentieel getroffen inwoners en bereikbaarheid met bestuurlijke keuzes over waarschuwing en hulp. Maak onderscheid tussen verwachting en waarneming; veronderstel geen exacte waterstanden of schade zonder gegevens. Eindig met twee oefenvragen.',
    example: {
      label: 'De omweg naar het dorp',
      desc: '<p>Na langdurig hoogwater lopen de straten van een landelijk dorp onder. Een deel van de toegangswegen is nog berijdbaar, maar hulp moet via een omweg worden aangevoerd. Gemeente en veiligheidsregio beslissen welke inwoners eerst informatie of ondersteuning nodig hebben terwijl het waterbeeld verandert.</p>',
      choices: ['bron.rivier', 'beeld.straat', 'gebied.dorp', 'inwoners.wijk', 'wegen.deels', 'aanvoer.omweg'],
    },
  },
  {
    id: 'dijkdoorbraak',
    label: 'Dijkdoorbraak',
    desc: 'Verken signalering, onzekerheid, verplaatsing en continuïteit bij schade aan een waterkering. Een zichtbare bres en een intacte kering worden in dit model niet tegelijk geselecteerd.\n\nBronnen: [Deltaprogramma – Waterveiligheid](https://www.deltaprogramma.nl/themas/waterveiligheid) en [Rijkswaterstaat – Bescherming tegen het water](https://www.rijkswaterstaat.nl/water/waterbeheer/bescherming-tegen-het-water).',
    categories: [
      {
        id: 'kering', label: 'Kering en waarneming',
        desc: 'Maak de fysieke situatie en de mate van bevestiging expliciet.',
        factors: [
          { id: 'toestand', label: 'Toestand van de kering', desc: 'Welke toestand is voor deze oefening als uitgangspunt vastgesteld?', values: [['intact', 'Kering intact'], ['schade', 'Schade zonder doorbraak'], ['door', 'Kering doorgebroken']] },
          { id: 'bres', label: 'Waargenomen bres', desc: 'Wat is feitelijk bekend over een eventuele opening in de kering?', values: [['geen', 'Geen bres vastgesteld'], ['onzeker', 'Melding nog niet bevestigd'], ['bevestigd', 'Bres bevestigd']] },
        ],
      },
      {
        id: 'gebied', label: 'Gebied en tijd',
        desc: 'Ruimtelijke context en beschikbare voorbereidingstijd.',
        factors: [
          { id: 'omgeving', label: 'Achterliggend gebied', desc: 'Welk type gebied ligt mogelijk in de invloedssfeer?', values: [['woonwijk', 'Woonwijk'], ['polder', 'Landelijke polder'], ['bedrijven', 'Bedrijventerrein']] },
          { id: 'tijd', label: 'Tijd voor maatregelen', desc: 'Hoeveel tijd veronderstelt de oefening voor bestuurlijke afwegingen?', values: [['vooraf', 'Voorbereiding mogelijk'], ['kort', 'Korte reactietijd'], ['direct', 'Directe besluitvorming nodig']] },
        ],
      },
      {
        id: 'gevolgen', label: 'Maatschappelijke gevolgen',
        desc: 'Opties voor verplaatsing en basisvoorzieningen, zonder een vaste maatregel voor te schrijven.',
        factors: [
          { id: 'verplaatsing', label: 'Verplaatsingsvraag', desc: 'Welke afweging rond inwoners ligt voor?', values: [['blijven', 'Veilig blijven op locatie onderzoeken'], ['gefaseerd', 'Gefaseerde verplaatsing overwegen'], ['snel', 'Snelle verplaatsing voorbereiden']] },
          { id: 'voorzieningen', label: 'Basisvoorzieningen', desc: 'Hoe functioneren energie, drinkwater en communicatie in het scenario?', values: [['normaal', 'Normaal beschikbaar'], ['deels', 'Plaatselijk beperkt'], ['uitval', 'Meerdere voorzieningen uitgevallen']] },
        ],
      },
    ],
    exclusions: [['toestand.intact', 'bres.bevestigd'], ['toestand.door', 'bres.geen'], ['toestand.schade', 'bres.bevestigd']],
    prompt: 'Maak een realistisch Nederlandstalig oefenscenario over een beschadigde of doorgebroken dijk. Beschrijf wat bevestigd is en wat onzeker is, de mogelijke gevolgen voor het achterliggende gebied, en een dilemma rond waarschuwing, verplaatsing en basisvoorzieningen. Verzin geen exacte voorspellingen of instructies voor ingrepen aan de kering. Eindig met twee bestuurlijke reflectievragen.',
    example: {
      label: 'Een onbevestigde melding bij de polder',
      desc: '<p>Bij een kering naast een landelijke polder wordt schade gemeld, maar een bres is nog niet bevestigd. Er is weinig tijd om maatregelen voor te bereiden. De veiligheidsregio verkent een gefaseerde verplaatsing en stemt met de waterbeheerder af welke feiten eerst gecontroleerd moeten worden.</p>',
      choices: ['toestand.schade', 'bres.onzeker', 'omgeving.polder', 'tijd.kort', 'verplaatsing.gefaseerd', 'voorzieningen.normaal'],
    },
  },
  {
    id: 'natuurbrand',
    label: 'Natuurbrand',
    desc: 'Gebruik natuurbrand als oefening in omgevingsbeeld, rook, publieke toegang en bescherming van mensen. Dit model is geen voorspelling van brandverloop.\n\nBron: [NIPV – Onderzoek natuurbranden](https://nipv.nl/onderzoek/natuurbranden/).',
    categories: [
      {
        id: 'brand', label: 'Brand en landschap',
        desc: 'Landschap en actuele brandstatus voor de oefening.',
        factors: [
          { id: 'terrein', label: 'Type natuurgebied', desc: 'Welk landschap bepaalt de mogelijke gevolgen voor gebruikers van het gebied?', values: [['bos', 'Bosrijk gebied'], ['heide', 'Heidegebied'], ['duin', 'Duinlandschap']] },
          { id: 'status', label: 'Brandstatus', desc: 'Is er al een brand in het onderzochte gebied?', values: [['dreiging', 'Nog geen brand in dit gebied'], ['lokaal', 'Lokale brand'], ['meervoud', 'Brand op meerdere plekken']] },
        ],
      },
      {
        id: 'omgeving', label: 'Omgeving en rook',
        desc: 'Rook en aanwezige mensen kunnen verschillende afwegingen oproepen.',
        factors: [
          { id: 'rook', label: 'Rook van deze brand', desc: 'Wat wordt waargenomen aan rook van de brand in dit gebied?', values: [['geen', 'Geen rook van deze brand'], ['plaatselijk', 'Plaatselijke rook'], ['wijd', 'Rook in meerdere woonkernen']] },
          { id: 'mensen', label: 'Aanwezige mensen', desc: 'Wie kan in het gebied door de situatie worden geraakt?', values: [['weinig', 'Weinig bezoekers'], ['recreanten', 'Veel recreanten'], ['woningen', 'Ook omliggende bewoners']] },
        ],
      },
      {
        id: 'publiek', label: 'Publiek en bereikbaarheid',
        desc: 'De formele afsluiting wordt onderscheiden van feitelijke mogelijkheden voor publiek.',
        factors: [
          { id: 'afsluiting', label: 'Publieke afsluiting', desc: 'Welke toegangsbeperking geldt voor het publiek?', values: [['open', 'Geen afsluiting'], ['deels', 'Deelgebied gesloten'], ['dicht', 'Hele gebied voor publiek gesloten']] },
          { id: 'toegang', label: 'Toegang voor publiek', desc: 'Hoe kunnen bezoekers het gebied in de oefening gebruiken?', values: [['vrij', 'Vrije toegang tot het hele gebied'], ['geleid', 'Alleen begeleide publieke toegang'], ['geen', 'Geen publieke toegang']] },
        ],
      },
    ],
    exclusions: [['status.dreiging', 'rook.plaatselijk'], ['status.dreiging', 'rook.wijd'], ['afsluiting.dicht', 'toegang.vrij'], ['afsluiting.dicht', 'toegang.geleid'], ['afsluiting.deels', 'toegang.vrij']],
    prompt: 'Schrijf een Nederlandstalig scenario voor een veiligheidsregio over een natuurbrand of de dreiging daarvan. Gebruik de gekozen landschaps- en rookgegevens, benoem recreanten en omwonenden, en beschrijf afwegingen over waarschuwing, publieke toegang en interregionale samenwerking. Vermijd exacte brandvoorspellingen en operationele bestrijdingsinstructies. Eindig met twee oefenvragen.',
    example: {
      label: 'Rook bij het heidegebied',
      desc: '<p>In een heidegebied ontstaat een lokale brand terwijl veel recreanten aanwezig zijn. Plaatselijke rook wordt gemeld en een deel van het gebied gaat dicht. De veiligheidsregio bespreekt met terreinbeheerders hoe bezoekers geïnformeerd worden en hoe omwonenden een betrouwbaar beeld krijgen zonder onnodige onrust.</p>',
      choices: ['terrein.heide', 'status.lokaal', 'rook.plaatselijk', 'mensen.recreanten', 'afsluiting.deels', 'toegang.geleid'],
    },
  },
  {
    id: 'demonstraties',
    label: 'Demonstraties en openbare orde',
    desc: 'Verken vreedzame demonstraties van bijvoorbeeld boeren of studenten, of een protest bij een ambassade. De identiteit van deelnemers zegt niets over dreiging; het demonstratierecht en proportionele afwegingen staan voorop.',
    categories: [
      {
        id: 'bijeenkomst', label: 'Aanleiding en vorm',
        desc: 'De boodschap en vorm worden afzonderlijk gekozen; groepen zijn niet gelijk te stellen aan een risicoprofiel.',
        factors: [
          { id: 'thema', label: 'Context van demonstratie', desc: 'Welk voorbeeld helpt de oefening te concretiseren zonder de deelnemers te stereotyperen?', values: [['landbouw', 'Boeren rond landbouwbeleid'], ['studie', 'Studenten rond onderwijsbeleid'], ['diplomatie', 'Demonstratie bij een ambassade']] },
          { id: 'vorm', label: 'Vorm van bijeenkomst', desc: 'Is verplaatsing onderdeel van het programma?', values: [['statisch', 'Statische bijeenkomst'], ['mars', 'Optocht'], ['combinatie', 'Bijeenkomst gevolgd door optocht']] },
        ],
      },
      {
        id: 'ruimte', label: 'Openbare ruimte',
        desc: 'De omgeving en geplande route bepalen waar belangen elkaar raken.',
        factors: [
          { id: 'locatie', label: 'Omgeving', desc: 'Welk type omgeving is relevant voor de uitoefening van demonstratierecht?', values: [['plein', 'Stadsplein'], ['campus', 'Campus en omgeving'], ['diplomatiek', 'Wijk met diplomatieke functies']] },
          { id: 'route', label: 'Verplaatsing van de bijeenkomst', desc: 'Welke beweging is in dit oefenscenario gepland?', values: [['geen', 'Geen verplaatsing'], ['afgesproken', 'Vooraf besproken looproute'], ['onbekend', 'Verplaatsing, route nog onbekend']] },
        ],
      },
      {
        id: 'afstemming', label: 'Afstemming',
        desc: 'De opkomst en het contact met organisatoren sturen informatievoorziening, niet de rechten van deelnemers.',
        factors: [
          { id: 'opkomst', label: 'Verwachte opkomst', desc: 'Hoeveel deelnemers worden ongeveer verwacht?', values: [['klein', 'Tientallen'], ['middel', 'Honderden'], ['groot', 'Duizenden']] },
          { id: 'contact', label: 'Contact met organisatoren', desc: 'Welke mogelijkheid tot afstemming bestaat er?', values: [['bereikbaar', 'Contactpersonen bereikbaar'], ['los', 'Los georganiseerd collectief'], ['onbekend', 'Nog geen contact vastgesteld']] },
        ],
      },
    ],
    exclusions: [['vorm.statisch', 'route.afgesproken'], ['vorm.statisch', 'route.onbekend'], ['vorm.mars', 'route.geen'], ['vorm.combinatie', 'route.geen']],
    prompt: 'Schrijf een evenwichtig Nederlandstalig scenario rond een vreedzame demonstratie met de gekozen waarden. Beschrijf de uitoefening van het demonstratierecht, het gesprek met organisatoren en de afweging met bereikbaarheid en omwonenden. Stel geen groep gelijk aan een dreiging, verzin geen strafbare feiten en geef geen tactische aanwijzingen. Eindig met twee vragen over proportionaliteit en communicatie.',
    example: {
      label: 'Een studentenmars door de stad',
      desc: '<p>Honderden studenten willen vanuit de campus met een optocht naar het stadsplein. De looproute is vooraf besproken en de organisatoren zijn bereikbaar. De gemeente weegt bereikbaarheid voor omwonenden af tegen het recht om te demonstreren en communiceert duidelijk over mogelijke wijzigingen in het verloop.</p>',
      choices: ['thema.studie', 'vorm.mars', 'locatie.campus', 'route.afgesproken', 'opkomst.middel', 'contact.bereikbaar'],
    },
  },
  {
    id: 'publieke-gebouwen',
    label: 'Veiligheid van publieke gebouwen',
    desc: 'Een bestuursgerichte box over toegang, dienstverlening en bezoekerszorg bij publieke gebouwen. Kies expliciet of het gebouw open is; beschrijf geen kwetsbaarheden of omzeilingsmogelijkheden.',
    categories: [
      {
        id: 'gebouw', label: 'Gebouw en gebruik',
        desc: 'Welke publieke functie en openingstoestand staan centraal?',
        factors: [
          { id: 'functie', label: 'Gebouwfunctie', desc: 'Welke dienst of functie komen bezoekers gebruiken?', values: [['gemeente', 'Gemeentehuis'], ['cultuur', 'Bibliotheek of museum'], ['onderwijs', 'Onderwijsgebouw']] },
          { id: 'opening', label: 'Opening voor publiek', desc: 'Wat is de actuele publiekstoegankelijkheid van het gebouw?', values: [['open', 'Publiek geopend'], ['beperkt', 'Beperkt geopend'], ['gesloten', 'Volledig gesloten voor publiek']] },
        ],
      },
      {
        id: 'bezoekers', label: 'Bezoekers en omgeving',
        desc: 'De combinatie van bezetting en bezoekafspraken bepaalt de vraag naar gastvrijheid.',
        factors: [
          { id: 'bezoek', label: 'Bezoekersregime', desc: 'Onder welke voorwaarden mogen bezoekers binnenkomen?', values: [['vrij', 'Vrije inloop'], ['afspraak', 'Alleen op afspraak'], ['geen', 'Geen publiek toegelaten']] },
          { id: 'drukte', label: 'Bezetting', desc: 'Hoeveel aanwezigen zijn in het gebouw te verwachten?', values: [['laag', 'Lage bezetting'], ['middel', 'Gemiddelde bezetting'], ['hoog', 'Hoge bezetting']] },
        ],
      },
      {
        id: 'dienst', label: 'Dienstverlening en entree',
        desc: 'Hoe verhouden dienstverlening en fysieke publieksentrees zich tot elkaar?',
        factors: [
          { id: 'service', label: 'Dienstverlening', desc: 'Hoe wordt de maatschappelijke functie beschikbaar gehouden?', values: [['normaal', 'Normale dienstverlening'], ['beperkt', 'Beperkte dienstverlening'], ['online', 'Vooral op afstand']] },
          { id: 'entree', label: 'Publieksentrees', desc: 'In welke mate zijn de entrees voor bezoekers geopend?', values: [['open', 'Alle publieksentrees open'], ['deels', 'Een publieksentree open'], ['dicht', 'Alle publieksentrees gesloten']] },
        ],
      },
    ],
    exclusions: [['opening.gesloten', 'bezoek.vrij'], ['opening.gesloten', 'entree.open'], ['opening.gesloten', 'entree.deels'], ['bezoek.vrij', 'entree.dicht'], ['bezoek.geen', 'entree.open']],
    prompt: 'Maak een Nederlandstalig scenario over continuïteit en bezoekerszorg in een publiek gebouw. Verbind toegang, opening en dienstverlening met beslissingen van gebouwbeheer en betrokken organisaties. Benoem inclusieve communicatie en de gevolgen voor bezoekers; beschrijf geen technische of fysieke zwakke plekken. Eindig met twee vragen voor de organisatie.',
    example: {
      label: 'Het gemeentehuis blijft bereikbaar',
      desc: '<p>Een gemeentehuis ontvangt bezoekers alleen op afspraak terwijl één publieksentree open blijft. De bezetting is gemiddeld en de dienstverlening is tijdelijk beperkt. Het team bespreekt hoe inwoners die niet digitaal vaardig zijn toch duidelijkheid en toegang tot noodzakelijke diensten houden.</p>',
      choices: ['functie.gemeente', 'opening.beperkt', 'bezoek.afspraak', 'drukte.middel', 'service.beperkt', 'entree.deels'],
    },
  },
  {
    id: 'religieuze-centra',
    label: 'Veiligheid van religieuze centra',
    desc: 'Een inclusieve oefenbox voor gastvrijheid, bijeenkomsten en zorg voor bezoekers van religieuze centra. Het geloof of de gemeenschap wordt niet als risico behandeld.',
    categories: [
      {
        id: 'bijeenkomst', label: 'Bijeenkomst en bezoekers',
        desc: 'De activiteit bepaalt wie welkom is en hoeveel mensen worden verwacht.',
        factors: [
          { id: 'activiteit', label: 'Activiteit', desc: 'Welke activiteit vindt in het gebouw plaats?', values: [['publiek', 'Publiek toegankelijke viering'], ['besloten', 'Besloten bijeenkomst'], ['geen', 'Geen bijeenkomst in het gebouw']] },
          { id: 'bezoekers', label: 'Verwachte bezoekers', desc: 'Voor welke groep is de activiteit toegankelijk?', values: [['iedereen', 'Publiek welkom'], ['gasten', 'Alleen genodigden'], ['niemand', 'Geen bezoekers verwacht']] },
        ],
      },
      {
        id: 'omgeving', label: 'Omgeving en bezetting',
        desc: 'De relatie met de omgeving en schaal van de bijeenkomst.',
        factors: [
          { id: 'plek', label: 'Omgeving van het centrum', desc: 'Waar ligt het gebouw ten opzichte van dagelijkse bezoekersstromen?', values: [['buurt', 'Woonbuurt'], ['centrum', 'Stadscentrum'], ['dorp', 'Dorpskern']] },
          { id: 'drukte', label: 'Verwachte bezetting', desc: 'Hoeveel bezoekers zijn op hetzelfde moment aanwezig?', values: [['klein', 'Kleine groep'], ['middel', 'Middelgrote groep'], ['groot', 'Drukke bijeenkomst']] },
        ],
      },
      {
        id: 'gastvrijheid', label: 'Gastvrijheid en communicatie',
        desc: 'Publieke toegang en communicatie worden vanuit zorg voor bezoekers vormgegeven.',
        factors: [
          { id: 'toegang', label: 'Toegang tot de bijeenkomst', desc: 'Hoe is de deelname aan de bijeenkomst georganiseerd?', values: [['open', 'Vrije inloop'], ['uitnodiging', 'Alleen op uitnodiging'], ['dicht', 'Geen toegang voor bezoekers']] },
          { id: 'communicatie', label: 'Contact met de omgeving', desc: 'Hoe wordt relevante informatie gedeeld met betrokkenen?', values: [['intern', 'Via de gemeenschap'], ['buurt', 'Ook met omwonenden'], ['breed', 'Ook via publieke kanalen']] },
        ],
      },
    ],
    exclusions: [['activiteit.publiek', 'bezoekers.niemand'], ['activiteit.publiek', 'toegang.dicht'], ['activiteit.geen', 'bezoekers.iedereen'], ['activiteit.geen', 'toegang.open'], ['bezoekers.iedereen', 'toegang.dicht'], ['bezoekers.gasten', 'toegang.open']],
    prompt: 'Schrijf een respectvol Nederlandstalig scenario voor een religieus centrum met de gekozen waarden. Benadruk gastvrijheid, toegankelijkheid, samenwerking met de gemeenschap en zorgvuldige communicatie met bezoekers en omwonenden. Maak geen aannames over dreiging op basis van religie en noem geen kwetsbaarheden of beveiligingsdetails. Eindig met twee reflectievragen.',
    example: {
      label: 'Een drukke bijeenkomst in de buurt',
      desc: '<p>Een publiek toegankelijke viering trekt veel bezoekers naar een centrum in een woonbuurt. De gemeenschap informeert omwonenden vooraf over de verwachte drukte. Gastvrijheid en bereikbaarheid worden samen besproken, met aandacht voor bezoekers die extra ondersteuning nodig hebben.</p>',
      choices: ['activiteit.publiek', 'bezoekers.iedereen', 'plek.buurt', 'drukte.groot', 'toegang.open', 'communicatie.buurt'],
    },
  },
  {
    id: 'havencontinuiteit',
    label: 'Haven en continuïteit',
    desc: 'Oefen de gevolgen van verstoringen in havenlogistiek voor dienstverlening en ketenpartners. Capaciteit en goederenstroom beschrijven alleen de fictieve terminal; geen beveiligingsdetails.',
    categories: [
      {
        id: 'haven', label: 'Havenfunctie',
        desc: 'Type terminal en actuele afhandeling in de oefening.',
        factors: [
          { id: 'functie', label: 'Havenfunctie', desc: 'Welke functie heeft de onderzochte fictieve terminal?', values: [['container', 'Containerafhandeling'], ['veer', 'Veerverbinding'], ['gemengd', 'Gemengde logistiek']] },
          { id: 'afhandeling', label: 'Afhandeling op de terminal', desc: 'Kan de terminal goederen en reizigers verwerken?', values: [['normaal', 'Normale afhandeling'], ['beperkt', 'Beperkte afhandeling'], ['stil', 'Afhandeling stilgelegd']] },
        ],
      },
      {
        id: 'keten', label: 'Keten en scheepvaart',
        desc: 'Afhankelijkheden buiten de terminal kunnen ook bij beperkte afhandeling blijven bestaan.',
        factors: [
          { id: 'scheepvaart', label: 'Scheepvaart in de haven', desc: 'Welke verkeerssituatie geldt breder dan deze terminal?', values: [['normaal', 'Regulier verkeer'], ['beperkt', 'Beperkt verkeer'], ['omgeleid', 'Verkeer wordt omgeleid']] },
          { id: 'druk', label: 'Druk op ketenpartners', desc: 'Hoe groot is de vraag naar afstemming met vervoerders en autoriteiten?', values: [['laag', 'Beperkt'], ['middel', 'Merkbaar'], ['hoog', 'Groot']] },
        ],
      },
      {
        id: 'capaciteit', label: 'Terminalcapaciteit',
        desc: 'Maak capaciteit en feitelijke goederenstroom afzonderlijk zichtbaar.',
        factors: [
          { id: 'capaciteit', label: 'Verwerkingscapaciteit van de terminal', desc: 'Hoeveel van de gewone verwerkingscapaciteit is beschikbaar?', values: [['normaal', 'Volledig beschikbaar'], ['beperkt', 'Gedeeltelijk beschikbaar'], ['geen', 'Geen verwerkingscapaciteit']] },
          { id: 'stroom', label: 'Goederenstroom via de terminal', desc: 'Welke afhandeling vindt nog via deze specifieke terminal plaats?', values: [['normaal', 'Normale stroom'], ['beperkt', 'Beperkte stroom'], ['geen', 'Geen stroom']] },
        ],
      },
    ],
    exclusions: [['afhandeling.normaal', 'capaciteit.geen'], ['afhandeling.stil', 'stroom.normaal'], ['afhandeling.stil', 'stroom.beperkt'], ['capaciteit.geen', 'stroom.normaal'], ['capaciteit.geen', 'stroom.beperkt']],
    prompt: 'Schrijf een Nederlandstalig continuïteitsscenario voor een fictieve haventerminal. Laat zien welke effecten een verstoring van afhandeling heeft voor scheepvaart, ketenpartners en publieke communicatie. Maak expliciet wat alleen de terminal betreft en wat de hele haven betreft. Beschrijf geen toegangsroutes, kwetsbaarheden of beveiligingsprocedures. Eindig met twee vragen over samenwerking.',
    example: {
      label: 'Een terminal schakelt terug',
      desc: '<p>Een containerterminal kan tijdelijk slechts beperkt verwerken, terwijl elders in de haven de scheepvaart regulier doorgaat. De goederenstroom via de terminal neemt af en ketenpartners vragen om duidelijke verwachtingen. Havenbedrijf en vervoerders stemmen af hoe zij het verschil tussen terminal- en havenbrede gevolgen communiceren.</p>',
      choices: ['functie.container', 'afhandeling.beperkt', 'scheepvaart.normaal', 'druk.hoog', 'capaciteit.beperkt', 'stroom.beperkt'],
    },
  },
  {
    id: 'luchthavencontinuiteit',
    label: 'Luchthaven en continuïteit',
    desc: 'Een oefenbox voor vluchtoperatie, passagierszorg en communicatie bij een fictieve luchthaven. Alle operationele banen gesloten betekent in dit model dat er geen starts of landingen plaatsvinden.',
    categories: [
      {
        id: 'vluchten', label: 'Luchthaven en vluchten',
        desc: 'Type luchthaven en huidige starts en landingen.',
        factors: [
          { id: 'functie', label: 'Luchthavenfunctie', desc: 'Welke schaal en functie heeft de fictieve luchthaven?', values: [['regionaal', 'Regionale luchthaven'], ['internationaal', 'Internationale luchthaven'], ['gemengd', 'Gemengde luchthavenfunctie']] },
          { id: 'operatie', label: 'Starts en landingen', desc: 'Wat is de feitelijke vluchtoperatie in de oefening?', values: [['normaal', 'Volgens regulier schema'], ['beperkt', 'Beperkt aantal vluchten'], ['stil', 'Geen starts of landingen']] },
        ],
      },
      {
        id: 'infrastructuur', label: 'Beschikbare infrastructuur',
        desc: 'Banen en terminal kunnen onafhankelijk van elkaar beperkt zijn.',
        factors: [
          { id: 'banen', label: 'Operationele start- en landingsbanen', desc: 'Zijn de banen voor vluchten beschikbaar?', values: [['open', 'Alle banen beschikbaar'], ['deels', 'Een deel beschikbaar'], ['dicht', 'Alle banen gesloten']] },
          { id: 'terminal', label: 'Terminal voor publiek', desc: 'Is de passagiersterminal geopend?', values: [['open', 'Geheel geopend'], ['deels', 'Gedeeltelijk geopend'], ['dicht', 'Geheel gesloten']] },
        ],
      },
      {
        id: 'reizigers', label: 'Reizigers en informatie',
        desc: 'Welke dienstverlening en informatie ontvangen reizigers?',
        factors: [
          { id: 'verwerking', label: 'Passagiersverwerking in de terminal', desc: 'In welke mate worden reizigers in de terminal verwerkt?', values: [['normaal', 'Normaal'], ['beperkt', 'Beperkt'], ['stil', 'Gestopt']] },
          { id: 'informatie', label: 'Informatie aan reizigers', desc: 'Hoe snel kunnen betrokken partijen een actueel beeld delen?', values: [['tijdig', 'Tijdige gezamenlijke updates'], ['traag', 'Vertraagde updates'], ['onzeker', 'Onzeker beeld']] },
        ],
      },
    ],
    exclusions: [['banen.dicht', 'operatie.normaal'], ['banen.dicht', 'operatie.beperkt'], ['terminal.dicht', 'verwerking.normaal'], ['terminal.dicht', 'verwerking.beperkt']],
    prompt: 'Maak een Nederlandstalig scenario over continuïteit en reizigerszorg op een fictieve luchthaven. Beschrijf afzonderlijk de vluchtoperatie, terminal en passagiersverwerking, en een afstemmingsvraag voor luchthaven, vervoerders en overheden. Vermijd specifieke infrastructuurkwetsbaarheden en technische beveiligingsdetails. Eindig met twee vragen over reizigersinformatie.',
    example: {
      label: 'Reizigers wachten op duidelijkheid',
      desc: '<p>Een internationale luchthaven kan nog een beperkt aantal vluchten afhandelen, maar een deel van de terminal is niet in gebruik. De passagiersverwerking verloopt trager en updates bereiken reizigers met vertraging. Luchthaven, vervoerders en overheid bespreken wie wanneer welke informatie kan bevestigen.</p>',
      choices: ['functie.internationaal', 'operatie.beperkt', 'banen.deels', 'terminal.deels', 'verwerking.beperkt', 'informatie.traag'],
    },
  },
];

const createScenario = (box: BoxSpec, thresholdColors: ThresholdColor[]): Scenario => {
  const id = `starter-nl-${box.id}`;
  const valueIds = new Map<string, string>();
  const categories: Category[] = box.categories.map((category) => ({
    id: `${id}-${category.id}`,
    label: category.label,
    desc: category.desc,
    componentIds: category.factors.map((factor) => `${id}-${factor.id}`),
  }));
  const components: ScenarioComponent[] = box.categories.flatMap((category) =>
    category.factors.map((factor) => ({
      id: `${id}-${factor.id}`,
      label: factor.label,
      desc: factor.desc,
      values: factor.values.map(([value, label]) => {
        const valueId = `${id}-${factor.id}-${value}`;
        valueIds.set(`${factor.id}.${value}`, valueId);
        return { id: valueId, label };
      }),
    }))
  );
  const getValueId = (ref: string) => {
    const valueId = valueIds.get(ref);
    if (!valueId) throw new Error(`Unknown starter kit choice: ${id}/${ref}`);
    return valueId;
  };
  const inconsistencies: Inconsistencies = {};
  for (const [from, to] of box.exclusions) {
    const fromId = getValueId(from);
    inconsistencies[fromId] ??= {};
    inconsistencies[fromId][getValueId(to)] = true;
  }
  const selected = Object.fromEntries(
    box.example.choices.map((ref) => {
      const factor = ref.split('.')[0];
      return [`${id}-${factor}`, [getValueId(ref)]];
    })
  );
  return {
    id,
    label: box.label,
    desc: box.desc,
    hideInconsistentValues: true,
    includeDecisionSupport: false,
    inconsistencies,
    categories,
    components,
    narratives: [{
      id: `${id}-voorbeeld`,
      label: box.example.label,
      desc: box.example.desc,
      components: selected,
      included: true,
      saved: true,
      personaEffects: {},
    }],
    thresholdColors: thresholdColors.map((item) => ({ ...item })),
    llm: {
      id: 'clipboard',
      url: '',
      model: 'gemma3',
      temperature: 0.7,
      prompts: [{ type: 'narrative', categories: categories.map(({ id }) => id), prompt: box.prompt }],
    },
  };
};

export const createStarterKitNl = (thresholdColors: ThresholdColor[]): DataModel => {
  const scenarios = boxes.map((box) => createScenario(box, thresholdColors));
  return {
    version: 1,
    lastUpdate: Date.now(),
    scenario: scenarios[0],
    scenarios: scenarios.slice(1),
    personas: [],
  };
};
