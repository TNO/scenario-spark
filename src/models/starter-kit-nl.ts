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
    desc: 'Een oefenbox met vier lagen: evenementkarakteristieken, verstoringen, maatregelen en effecten. Combineer deze om aannames over bezoekers, bereikbaarheid, capaciteit, besluitvorming en herstel bespreekbaar te maken. Een verwachte opkomst boven de toegestane capaciteit blijft bewust mogelijk: juist dat kan een relevant dilemma zijn.\n\nBron: [NIPV – Evenementenveiligheid](https://nipv.nl/onderzoek/evenementenveiligheid/).',
    categories: [
      {
        id: 'evenement', label: 'Evenementkarakteristieken',
        desc: 'Type, locatie, schaal, duur en bezoekerssamenstelling bepalen de uitgangssituatie.',
        factors: [
          { id: 'soort', label: 'Soort evenement', desc: 'Welke bijeenkomst vormt het uitgangspunt voor de oefening?', values: [['festival', 'Cultureel festival'], ['wedstrijd', 'Sportwedstrijd'], ['markt', 'Publieke markt']] },
          { id: 'terrein', label: 'Terrein', desc: 'Hoe is de publieksruimte fysiek ingericht?', values: [['openbaar', 'Openbare buitenruimte'], ['afgesloten', 'Afgesloten terrein'], ['gebouw', 'Gebouw of hal']] },
          { id: 'opkomst', label: 'Verwachte opkomst', desc: 'Hoeveel bezoekers kunnen gelijktijdig op locatie aankomen? Dit kan hoger zijn dan de toegestane capaciteit.', values: [['klein', 'Tot 500 bezoekers'], ['middel', '1.000–5.000 bezoekers'], ['groot', 'Meer dan 10.000 bezoekers']] },
          { id: 'duur', label: 'Duur van het evenement', desc: 'Over welk tijdsbestek moet de organisatie mensen en middelen inzetten?', values: [['kort', 'Enkele uren'], ['dag', 'Een volledige dag'], ['meerdaags', 'Meerdere aaneengesloten dagen']] },
          { id: 'moment', label: 'Tijdvenster', desc: 'Op welke momenten vindt de bijeenkomst plaats?', values: [['dag', 'Uitsluitend één dagdeel'], ['avond', 'Uitsluitend één avond'], ['doorlopend', 'Doorlopend over meerdere dagen']] },
          { id: 'bezoekers', label: 'Bezoekerssamenstelling', desc: 'Welke behoeften rond informatie, mobiliteit en voorzieningen vragen aandacht zonder mensen een risicoprofiel toe te kennen?', values: [['families', 'Veel gezinnen'], ['gemengd', 'Gemengd publiek'], ['ondersteuning', 'Veel bezoekers met ondersteuningsbehoeften']] },
        ],
      },
      {
        id: 'belasting', label: 'Verstoringen en druk',
        desc: 'Een weersituatie, bereikbaarheid, incidenten of publieksdruk kan het verloop veranderen.',
        factors: [
          { id: 'weer', label: 'Weersituatie', desc: 'Welke omstandigheden moeten in de voorbereiding worden meegewogen?', values: [['rustig', 'Rustig weer'], ['hitte', 'Aanhoudende hitte'], ['regen', 'Langdurige regen'], ['storm', 'Zware wind']] },
          { id: 'bereik', label: 'Bereikbaarheid van de omgeving', desc: 'Hoe bereikbaar zijn de gewone aan- en afvoerroutes voor bezoekers en hulpverleners?', values: [['normaal', 'Regulier bereikbaar'], ['beperkt', 'Deels vertraagd'], ['dicht', 'Gebruikelijke aanvoerroute niet beschikbaar']] },
          { id: 'medisch', label: 'Medische hulpvragen', desc: 'Wat is het vastgestelde niveau van medische incidenten tijdens deze bijeenkomst?', values: [['geen', 'Geen letselincidenten'], ['beperkt', 'Enkele lichte letselincidenten'], ['ernstig', 'Ernstige letselincidenten']] },
          { id: 'techniek', label: 'Beschikbare publiekscommunicatie', desc: 'Welke communicatievoorzieningen werken op dit moment?', values: [['volledig', 'Omroep en mobiele kanalen beschikbaar'], ['mobiel', 'Alleen mobiele kanalen beschikbaar'], ['terplekke', 'Alleen mondeling via medewerkers']] },
          { id: 'stroom', label: 'Verloop bezoekersstromen', desc: 'Wanneer is de grootste gelijktijdige druk in het terrein of de omgeving merkbaar?', values: [['gespreid', 'Gelijkmatig verspreid'], ['entree', 'Piek bij aankomst'], ['vertrek', 'Piek bij vertrek']] },
        ],
      },
      {
        id: 'organisatie', label: 'Maatregelen en organisatie',
        desc: 'Toegangsafspraken, voorzieningen en coördinatie geven handelingsmogelijkheden.',
        factors: [
          { id: 'maximum', label: 'Toegestane gelijktijdige capaciteit', desc: 'Welk maximum is voor deze fictieve locatie vastgesteld?', values: [['vijfhonderd', 'Maximaal 500'], ['vijfduizend', 'Maximaal 5.000'], ['ruim', 'Meer dan 10.000']] },
          { id: 'toegang', label: 'Toegangsregime', desc: 'Hoe wordt bezoekers toegang verleend?', values: [['vrij', 'Vrije toegang'], ['ticket', 'Toegang met ticket'], ['uitnodiging', 'Alleen genodigden']] },
          { id: 'zorg', label: 'Medische voorbereiding', desc: 'Welke vorm van eerste hulp is vooraf voorzien voor bezoekers?', values: [['basis', 'Basisvoorziening ter plaatse'], ['meervoud', 'Meerdere eerstehulppunten'], ['opschalen', 'Opschaalbare medische ondersteuning']] },
          { id: 'regie', label: 'Coördinatievorm', desc: 'Wie stemt besluiten tussen organisator, gemeente en hulpdiensten af?', values: [['organisator', 'Organisator met vaste contactpersonen'], ['gezamenlijk', 'Gezamenlijk afstemmingsoverleg'], ['crisis', 'Opgeschaalde publieke crisisstructuur']] },
          { id: 'bericht', label: 'Actief communicatiekanaal', desc: 'Hoe bereikt de organisatie bezoekers tijdens deze situatie?', values: [['omroep', 'Omroepinstallatie'], ['mobiel', 'Mobiele berichten'], ['medewerkers', 'Medewerkers ter plaatse']] },
          { id: 'opvang', label: 'Opvang na onderbreking', desc: 'Welke vorm van opvang is voorbereid als bezoekers niet verder kunnen?', values: [['terrein', 'Tijdelijke plek op het terrein'], ['omgeving', 'Opvang in de omgeving'], ['regionaal', 'Afstemming over regionale opvang']] },
        ],
      },
      {
        id: 'gevolgen', label: 'Effecten en herstel',
        desc: 'Gevolgen voor mensen, programma, omgeving en organisatie geven richting aan de evaluatie.',
        factors: [
          { id: 'gezondheid', label: 'Gevolgen voor bezoekers', desc: 'Welke gezondheidseffecten zijn feitelijk vastgesteld, niet slechts gevreesd?', values: [['geen', 'Geen gewonden'], ['licht', 'Lichte verwondingen'], ['ernstig', 'Ernstige verwondingen']] },
          { id: 'uitloop', label: 'Gevolgen voor het programma', desc: 'Hoe verandert het geplande programma door de situatie?', values: [['opplan', 'Volgens plan'], ['vertraging', 'Tijdelijke vertraging'], ['stop', 'Voortijdige beëindiging']] },
          { id: 'omgeving', label: 'Gevolgen voor omwonenden', desc: 'Wat merken mensen in de directe omgeving van het evenement?', values: [['beperkt', 'Beperkte hinder'], ['bereik', 'Bereikbaarheid onder druk'], ['voorziening', 'Tijdelijke uitval van voorzieningen']] },
          { id: 'vertrouwen', label: 'Publieke informatiebehoefte', desc: 'Welke omvang heeft de vraag naar betrouwbare uitleg en verantwoording?', values: [['lokaal', 'Vooral bezoekers en omwonenden'], ['regionaal', 'Ook regionale aandacht'], ['breed', 'Brede maatschappelijke aandacht']] },
          { id: 'evaluatie', label: 'Vervolg na het evenement', desc: 'Welke nazorg of leeractiviteit vraagt deze oefensituatie?', values: [['regulier', 'Reguliere evaluatie'], ['nazorg', 'Nazorg en opvolging'], ['onderzoek', 'Gezamenlijk feitenonderzoek']] },
        ],
      },
    ],
    exclusions: [['duur.meerdaags', 'moment.dag'], ['duur.meerdaags', 'moment.avond'], ['duur.kort', 'moment.doorlopend'], ['duur.dag', 'moment.doorlopend'], ['techniek.mobiel', 'bericht.omroep'], ['techniek.terplekke', 'bericht.omroep'], ['techniek.terplekke', 'bericht.mobiel'], ['medisch.geen', 'gezondheid.licht'], ['medisch.geen', 'gezondheid.ernstig'], ['medisch.beperkt', 'gezondheid.geen'], ['medisch.ernstig', 'gezondheid.geen'], ['medisch.ernstig', 'gezondheid.licht']],
    prompt: 'Schrijf in het Nederlands een geloofwaardig oefenscenario voor evenementenveiligheid met alle gekozen waarden. Orden het verhaal in aanloop, verstoring, maatregelen en effecten. Beschrijf bezoekersstromen, de samenwerking tussen organisator, gemeente en hulpdiensten, en een dilemma rond bereikbaarheid, capaciteit, informatie of weer. Maak onderscheid tussen verwachte opkomst en toegestane capaciteit: een overschrijding is een mogelijk probleem, geen onmogelijke combinatie. Maak aannames expliciet; geef geen operationele kwetsbaarheden of omzeilingsinstructies. Sluit af met twee reflectievragen.',
    example: {
      label: 'Een festivalavond die anders loopt',
      desc: '<p>Een cultureel festival op een afgesloten terrein verwacht enkele duizenden bezoekers voor een avondprogramma. Hitte en een vertraagde aanvoer zorgen bij de entree voor een plotselinge bezoekerspiek. Enkele bezoekers vragen lichte medische hulp. De organisator houdt het programma tijdelijk aan en informeert het publiek via de omroep.</p><p>In een gezamenlijk overleg wegen gemeente en hulpdiensten af hoe de toegestane capaciteit, de opvang in de omgeving en de bereikbaarheid voor omwonenden op elkaar ingrijpen. De volgende ochtend volgt nazorg en een evaluatie van het besluit en de communicatie.</p>',
      choices: ['soort.festival', 'terrein.afgesloten', 'opkomst.middel', 'duur.kort', 'moment.avond', 'bezoekers.gemengd', 'weer.hitte', 'bereik.beperkt', 'medisch.beperkt', 'techniek.volledig', 'stroom.entree', 'maximum.vijfduizend', 'toegang.ticket', 'zorg.meervoud', 'regie.gezamenlijk', 'bericht.omroep', 'opvang.omgeving', 'gezondheid.licht', 'uitloop.vertraging', 'omgeving.bereik', 'vertrouwen.regionaal', 'evaluatie.nazorg'],
    },
  },
  {
    id: 'cybercontinuiteit',
    label: 'Cyberincident en continuïteit',
    desc: 'Een defensief oefenmodel voor dienstverlening, signalering, ketenafhankelijkheid, besluitvorming en herstel na een digitaal incident. De focus ligt op bestuurlijke continuïteit, niet op aanvalstechnieken.\n\nBron: [NCSC – Incidenten en herstellen](https://www.ncsc.nl/incidenten-en-herstellen/resultaten).',
    categories: [
      {
        id: 'dienst', label: 'Dienstverlening',
        desc: 'Welke dienst en digitale afhankelijkheden staan centraal?',
        factors: [
          { id: 'sector', label: 'Betrokken dienst', desc: 'Welke maatschappelijke functie wordt door de verstoring geraakt?', values: [['zorg', 'Zorgverlening'], ['gemeente', 'Gemeentelijke dienstverlening'], ['logistiek', 'Logistieke coördinatie']] },
          { id: 'netwerk', label: 'Netwerkverbinding van de dienst', desc: 'In welke mate is de betreffende dienst verbonden met externe netwerken?', values: [['los', 'Volledig zelfstandig zonder netwerk'], ['partner', 'Alleen partnernetwerk'], ['internet', 'Via internet bereikbaar']] },
          { id: 'afhankelijkheid', label: 'Kritieke afhankelijkheid', desc: 'Welke externe of interne schakel is nodig om de dienst te laten werken?', values: [['intern', 'Eigen ICT-organisatie'], ['leverancier', 'Externe leverancier'], ['meervoud', 'Meerdere ketenpartners']] },
          { id: 'gebruikers', label: 'Gebruikers van de dienst', desc: 'Welke groep ervaart de gevolgen van de verstoring als eerste?', values: [['medewerkers', 'Interne medewerkers'], ['inwoners', 'Inwoners en cliënten'], ['keten', 'Samenwerkende organisaties']] },
        ],
      },
      {
        id: 'incident', label: 'Incidentbeeld',
        desc: 'Het waarneembare effect en de fase van de afhandeling.',
        factors: [
          { id: 'effect', label: 'Waarneembaar effect', desc: 'Welk effect merkt de organisatie zonder de oorzaak al vast te stellen?', values: [['uitval', 'Volledige uitval van de digitale dienst'], ['twijfel', 'Twijfel over gegevenskwaliteit'], ['leverancier', 'Verstoring bij een leverancier']] },
          { id: 'fase', label: 'Fase van afhandeling', desc: 'Waar staat de organisatie in de incidentcyclus?', values: [['detectie', 'Signalering en verificatie'], ['respons', 'Coördinatie tijdens het incident'], ['herstel', 'Herstel en evaluatie']] },
          { id: 'detectie', label: 'Eerste signaal', desc: 'Via welke waarneming wordt een probleem aanvankelijk herkend?', values: [['gebruikers', 'Meldingen van gebruikers'], ['monitoring', 'Interne monitoring'], ['partner', 'Signaal van een ketenpartner']] },
          { id: 'zekerheid', label: 'Zekerheid over oorzaak', desc: 'Hoe zeker is de duiding van de aanleiding op dit moment?', values: [['onbekend', 'Oorzaak onbekend'], ['werkhypothese', 'Werkhypothese wordt onderzocht'], ['bevestigd', 'Oorzaak door onderzoek bevestigd']] },
        ],
      },
      {
        id: 'aanpak', label: 'Continuïteit en contact',
        desc: 'Hoe blijven dienstverlening en communicatie mogelijk?',
        factors: [
          { id: 'kanaal', label: 'Kanaal voor deze dienst', desc: 'Via welk kanaal kunnen gebruikers de betreffende dienst bereiken?', values: [['lokaal', 'Alleen ter plaatse'], ['intern', 'Via het interne netwerk'], ['online', 'Via een publiek online loket']] },
          { id: 'niveau', label: 'Digitale beschikbaarheid', desc: 'In hoeverre werkt de betrokken digitale dienst momenteel?', values: [['offline', 'Niet digitaal beschikbaar'], ['beperkt', 'Beperkt digitaal beschikbaar'], ['normaal', 'Normaal digitaal beschikbaar']] },
          { id: 'noodproces', label: 'Continuïteitsproces', desc: 'Welke tijdelijke werkwijze houdt essentiële dienstverlening mogelijk?', values: [['handmatig', 'Handmatige registratie'], ['prioriteit', 'Alleen prioritaire aanvragen'], ['alternatief', 'Afzonderlijke alternatieve dienst']] },
          { id: 'gegevens', label: 'Status van gegevens', desc: 'Welk beeld is er van de betrouwbaarheid van gegevens voor deze dienst?', values: [['onzeker', 'Betrouwbaarheid nog onzeker'], ['controle', 'Hercontrole in uitvoering'], ['geverifieerd', 'Betrouwbaarheid bevestigd']] },
        ],
      },
      {
        id: 'bestuur', label: 'Besluitvorming en herstel',
        desc: 'Eigenaarschap, samenwerking, externe communicatie en herstel worden afzonderlijk afgewogen.',
        factors: [
          { id: 'regie', label: 'Regie over besluiten', desc: 'Waar worden prioriteiten voor dienstverlening en herstel vastgesteld?', values: [['dienst', 'Binnen de dienst'], ['organisatie', 'Organisatiebreed crisisteam'], ['keten', 'Gezamenlijk met ketenpartners']] },
          { id: 'afstemming', label: 'Ketenafstemming', desc: 'Hoe wisselen betrokken organisaties statusinformatie uit?', values: [['bilateraal', 'Afzonderlijke contacten'], ['gezamenlijk', 'Gezamenlijk situatiebeeld'], ['tijdelijk', 'Tijdelijk coördinatieoverleg']] },
          { id: 'publiek', label: 'Publiekscommunicatie', desc: 'Wat kan verantwoord naar gebruikers worden gecommuniceerd?', values: [['ontvangst', 'Melding ontvangen, feiten nog onbekend'], ['dienst', 'Gevolgen voor dienstverlening bekend'], ['herstel', 'Herstelstappen bevestigd']] },
          { id: 'herstel', label: 'Status van herstel', desc: 'In hoeverre is de betreffende digitale dienst weer bruikbaar?', values: [['niet', 'Herstel nog niet begonnen'], ['beperkt', 'Gefaseerd herstel'], ['afgerond', 'Dienst volledig hersteld']] },
        ],
      },
    ],
    exclusions: [['netwerk.los', 'kanaal.intern'], ['netwerk.los', 'kanaal.online'], ['netwerk.partner', 'kanaal.online'], ['effect.uitval', 'niveau.beperkt'], ['effect.uitval', 'niveau.normaal'], ['effect.uitval', 'herstel.afgerond'], ['effect.twijfel', 'gegevens.geverifieerd'], ['niveau.offline', 'herstel.afgerond']],
    prompt: 'Maak een Nederlandstalig oefenscenario voor defensieve cybercontinuïteit op basis van alle gekozen waarden. Orden het in eerste signaal, verificatie, gevolgen voor gebruikers, bestuur en herstel. Leg afwegingen over onzekerheid, gegevenskwaliteit, communicatie en ketenpartners bloot. Een uitgevallen dienst kan via een tijdelijk noodproces doorgaan; verwar dienst en achterliggende techniek niet. Onderscheid waarnemingen van vermoedens; beschrijf geen aanvalsstappen, zwakke plekken of omzeiling. Eindig met twee vragen over dienstverlening en verantwoording.',
    example: {
      label: 'Het gemeentelijke loket valt weg',
      desc: '<p>Gebruikers melden dat een gemeentelijk online loket niet meer werkt. De organisatie onderzoekt met haar leverancier of de bestaande gegevens nog betrouwbaar zijn. Een handmatig noodproces houdt prioritaire aanvragen mogelijk, maar vraagt extra uitleg aan inwoners.</p><p>Het organisatiebrede crisisteam bespreekt met ketenpartners hoe zij hun situatiebeeld delen. Het digitale herstel is nog niet begonnen; in de eerste publieksmelding worden daarom gevolgen voor de dienstverlening uitgelegd zonder een onbevestigde oorzaak te noemen.</p>',
      choices: ['sector.gemeente', 'netwerk.internet', 'afhankelijkheid.leverancier', 'gebruikers.inwoners', 'effect.uitval', 'fase.respons', 'detectie.gebruikers', 'zekerheid.onbekend', 'kanaal.online', 'niveau.offline', 'noodproces.handmatig', 'gegevens.onzeker', 'regie.organisatie', 'afstemming.gezamenlijk', 'publiek.dienst', 'herstel.niet'],
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
          { id: 'verloop', label: 'Ontwikkeling van het waterbeeld', desc: 'Welke verandering is uit waarnemingen of prognoses bekend?', values: [['stijgend', 'Verwacht stijgend'], ['stabiel', 'Voorlopig stabiel'], ['dalend', 'Waargenomen dalend']] },
        ],
      },
      {
        id: 'omgeving', label: 'Gebied en blootstelling',
        desc: 'De omgeving bepaalt de aard van de mogelijke maatschappelijke gevolgen.',
        factors: [
          { id: 'gebied', label: 'Type gebied', desc: 'Welk gebied is het zwaartepunt van de oefening?', values: [['stad', 'Dichtbebouwde wijk'], ['dorp', 'Landelijk dorp'], ['knooppunt', 'Vitale voorzieningen']] },
          { id: 'inwoners', label: 'Potentieel getroffen inwoners', desc: 'Hoe groot is de groep die mogelijk hulp of informatie nodig heeft?', values: [['beperkt', 'Enkele huishoudens'], ['wijk', 'Een wijk of dorp'], ['regio', 'Meerdere gemeenten']] },
          { id: 'zorgvraag', label: 'Bijzondere zorgvraag', desc: 'Welke ondersteuningsbehoefte vraagt expliciete afstemming met zorgorganisaties?', values: [['mobiliteit', 'Mensen met beperkte mobiliteit'], ['zorg', 'Zorginstellingen'], ['verspreid', 'Verspreide thuiszorgcliënten']] },
        ],
      },
      {
        id: 'bereikbaarheid', label: 'Bereikbaarheid en hulp',
        desc: 'De feitelijke toegangswegen begrenzen hoe hulp kan worden aangevoerd.',
        factors: [
          { id: 'wegen', label: 'Toegangswegen tot het gebied', desc: 'Zijn toegangswegen voor voertuigen beschikbaar?', values: [['open', 'Alle toegangswegen berijdbaar'], ['deels', 'Sommige toegangswegen berijdbaar'], ['dicht', 'Alle toegangswegen afgesloten']] },
          { id: 'aanvoer', label: 'Aanvoer van hulp', desc: 'Hoe bereikt hulp van buiten het gebied de getroffen locatie?', values: [['direct', 'Over de gewone toegangsweg'], ['omweg', 'Via een alternatieve toegangsweg'], ['nietweg', 'Niet over de weg']] },
          { id: 'voorziening', label: 'Beschikbaarheid basisvoorzieningen', desc: 'Welke gevolgen voor energie, drinkwater of communicatie moeten worden meegenomen?', values: [['normaal', 'Normaal beschikbaar'], ['plaatselijk', 'Plaatselijke beperking'], ['meervoud', 'Meerdere voorzieningen beperkt']] },
        ],
      },
      {
        id: 'besluit', label: 'Informatie en besluiten',
        desc: 'Waarschuwing, opvang en samenwerking zijn keuzes onder onzekerheid.',
        factors: [
          { id: 'zekerheid', label: 'Betrouwbaarheid situatiebeeld', desc: 'Hoe zeker zijn de gegevens over water, wegen en bevolking?', values: [['voorlopig', 'Voorlopige meldingen'], ['gedeeld', 'Gedeeld maar deels onzeker beeld'], ['bevestigd', 'Bevestigde waarnemingen']] },
          { id: 'opvang', label: 'Opvangvraag', desc: 'Welke vraag naar tijdelijke ondersteuning wordt verwacht?', values: [['thuis', 'Inwoners blijven voorlopig thuis'], ['lokaal', 'Lokale tijdelijke opvang'], ['regionaal', 'Afstemming over regionale opvang']] },
          { id: 'regie', label: 'Bestuurlijke samenwerking', desc: 'Wie deelt een gezamenlijk handelingsbeeld?', values: [['gemeente', 'Gemeente en waterbeheerder'], ['regio', 'Regionale crisispartners'], ['grens', 'Meerdere veiligheidsregio’s']] },
        ],
      },
    ],
    exclusions: [['wegen.dicht', 'aanvoer.direct'], ['wegen.dicht', 'aanvoer.omweg']],
    prompt: 'Schrijf een Nederlandstalig hoogwaterscenario voor een veiligheidsregio met alle gekozen waarden. Verbind bron, ontwikkeling van het waterbeeld, zorgvraag, bereikbaarheid en voorzieningen met bestuurlijke keuzes over waarschuwing en opvang. Laat zien hoe zekerheid van het situatiebeeld en samenwerking tussen waterbeheerder, gemeente en regio besluiten beïnvloeden. Maak onderscheid tussen verwachting en waarneming; veronderstel geen exacte waterstanden of schade zonder gegevens. Eindig met twee oefenvragen.',
    example: {
      label: 'De omweg naar het dorp',
      desc: '<p>Na langdurig hoogwater lopen de straten van een landelijk dorp onder; de waterstand kan verder stijgen. Een deel van de toegangswegen is nog berijdbaar, maar hulp moet via een omweg worden aangevoerd. Gemeente en waterbeheerder delen een nog onzeker beeld van de zorgvraag bij thuiszorgcliënten.</p><p>Bij plaatselijke problemen met voorzieningen wordt tijdelijke opvang verkend. De vraag voor het regionaal overleg is wanneer omwonenden een waarschuwing krijgen, terwijl het bereikbare gebied per uur verandert.</p>',
      choices: ['bron.rivier', 'beeld.straat', 'verloop.stijgend', 'gebied.dorp', 'inwoners.wijk', 'zorgvraag.verspreid', 'wegen.deels', 'aanvoer.omweg', 'voorziening.plaatselijk', 'zekerheid.gedeeld', 'opvang.lokaal', 'regie.regio'],
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
          { id: 'belasting', label: 'Waterbelasting', desc: 'Welke externe belasting van de kering wordt in de oefening verwacht?', values: [['rivier', 'Hoge rivierafvoer'], ['kust', 'Hoge kustwaterstand'], ['combinatie', 'Samenvallende waterdruk en neerslag']] },
        ],
      },
      {
        id: 'gebied', label: 'Gebied en tijd',
        desc: 'Ruimtelijke context en beschikbare voorbereidingstijd.',
        factors: [
          { id: 'omgeving', label: 'Achterliggend gebied', desc: 'Welk type gebied ligt mogelijk in de invloedssfeer?', values: [['woonwijk', 'Woonwijk'], ['polder', 'Landelijke polder'], ['bedrijven', 'Bedrijventerrein']] },
          { id: 'tijd', label: 'Tijd voor maatregelen', desc: 'Hoeveel tijd veronderstelt de oefening voor bestuurlijke afwegingen?', values: [['vooraf', 'Voorbereiding mogelijk'], ['kort', 'Korte reactietijd'], ['direct', 'Directe besluitvorming nodig']] },
          { id: 'blootstelling', label: 'Mensen achter de kering', desc: 'Welke groep vraagt mogelijk om waarschuwing of ondersteuning?', values: [['verspreid', 'Verspreid wonende huishoudens'], ['wijk', 'Dichtbevolkte woonkern'], ['zorg', 'Zorglocaties in het gebied']] },
        ],
      },
      {
        id: 'gevolgen', label: 'Maatschappelijke gevolgen',
        desc: 'Opties voor verplaatsing en basisvoorzieningen, zonder een vaste maatregel voor te schrijven.',
        factors: [
          { id: 'verplaatsing', label: 'Verplaatsingsvraag', desc: 'Welke afweging rond inwoners ligt voor?', values: [['blijven', 'Veilig blijven op locatie onderzoeken'], ['gefaseerd', 'Gefaseerde verplaatsing overwegen'], ['snel', 'Snelle verplaatsing voorbereiden']] },
          { id: 'voorzieningen', label: 'Basisvoorzieningen', desc: 'Hoe functioneren energie, drinkwater en communicatie in het scenario?', values: [['normaal', 'Normaal beschikbaar'], ['deels', 'Plaatselijk beperkt'], ['uitval', 'Meerdere voorzieningen uitgevallen']] },
          { id: 'opvang', label: 'Opvangcapaciteit', desc: 'Welke voorbereidende opvangmogelijkheid staat ter beschikking?', values: [['lokaal', 'Lokale voorzieningen'], ['regionaal', 'Regionaal afgesproken opvang'], ['onbekend', 'Capaciteit nog in onderzoek']] },
        ],
      },
      {
        id: 'regie', label: 'Regie en kennis',
        desc: 'Verificatie van waarnemingen en afstemming tussen waterbeheerder en bestuur.',
        factors: [
          { id: 'meting', label: 'Situatiebeeld', desc: 'Welke informatie is onafhankelijk bevestigd?', values: [['meldingen', 'Losse meldingen'], ['gedeeld', 'Gezamenlijk voorlopig beeld'], ['bevestigd', 'Bevestigde metingen']] },
          { id: 'afstemming', label: 'Afstemming partners', desc: 'Waar vindt de besluitvorming met relevante organisaties plaats?', values: [['beheerder', 'Waterbeheerder en gemeente'], ['regio', 'Veiligheidsregio met waterpartners'], ['meerdere', 'Meerdere regio’s en waterbeheerders']] },
          { id: 'bericht', label: 'Publieke communicatie', desc: 'Wat kan op basis van het huidige beeld verantwoord worden gedeeld?', values: [['waakzaam', 'Uitleg over onzekerheid'], ['voorbereiden', 'Inwoners voorbereiden op maatregelen'], ['handelen', 'Inwoners over actueel besluit informeren']] },
        ],
      },
    ],
    exclusions: [['toestand.intact', 'bres.bevestigd'], ['toestand.door', 'bres.geen'], ['toestand.schade', 'bres.bevestigd']],
    prompt: 'Maak een realistisch Nederlandstalig oefenscenario over een beschadigde of doorgebroken dijk met alle gekozen waarden. Beschrijf belasting van de kering, wat over een bres bevestigd is, wie achter de kering woont en welke tijd voor besluiten overblijft. Verbind verificatie en afstemming met keuzes over waarschuwing, verplaatsing, opvang en basisvoorzieningen. Verzin geen exacte voorspellingen of instructies voor ingrepen aan de kering. Eindig met twee bestuurlijke reflectievragen.',
    example: {
      label: 'Een onbevestigde melding bij de polder',
      desc: '<p>Bij een kering naast een landelijke polder wordt na hoge rivierafvoer schade gemeld, maar een bres is nog niet bevestigd. Verspreid wonende huishoudens hebben weinig tijd om zich voor te bereiden. Gemeente en waterbeheerder delen losse meldingen terwijl opvangcapaciteit nog wordt onderzocht.</p><p>De veiligheidsregio verkent een gefaseerde verplaatsing. Zij moet besluiten wat zij inwoners al kan vertellen over een onzeker keringbeeld, zonder een doorbraak als vaststaand feit te presenteren.</p>',
      choices: ['toestand.schade', 'bres.onzeker', 'belasting.rivier', 'omgeving.polder', 'tijd.kort', 'blootstelling.verspreid', 'verplaatsing.gefaseerd', 'voorzieningen.normaal', 'opvang.onbekend', 'meting.meldingen', 'afstemming.regio', 'bericht.waakzaam'],
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
          { id: 'omstandigheden', label: 'Omstandigheden in het gebied', desc: 'Welke weers- en terreinomstandigheden beïnvloeden het situatiebeeld?', values: [['droog', 'Droog en warm'], ['wind', 'Sterke wind'], ['wisselend', 'Wisselende omstandigheden']] },
        ],
      },
      {
        id: 'omgeving', label: 'Omgeving en rook',
        desc: 'Rook en aanwezige mensen kunnen verschillende afwegingen oproepen.',
        factors: [
          { id: 'rook', label: 'Rook van deze brand', desc: 'Wat wordt waargenomen aan rook van de brand in dit gebied?', values: [['geen', 'Geen rook van deze brand'], ['plaatselijk', 'Plaatselijke rook'], ['wijd', 'Rook in meerdere woonkernen']] },
          { id: 'mensen', label: 'Aanwezige mensen', desc: 'Wie kan in het gebied door de situatie worden geraakt?', values: [['weinig', 'Weinig bezoekers'], ['recreanten', 'Veel recreanten'], ['woningen', 'Ook omliggende bewoners']] },
          { id: 'omgeving', label: 'Functies aan de rand van het gebied', desc: 'Welke maatschappelijke activiteit kan hinder of informatiebehoefte ondervinden?', values: [['recreatie', 'Recreatievoorzieningen'], ['wonen', 'Woonbuurten'], ['zorg', 'Zorg- en verblijfsvoorzieningen']] },
        ],
      },
      {
        id: 'publiek', label: 'Publiek en bereikbaarheid',
        desc: 'De formele afsluiting wordt onderscheiden van feitelijke mogelijkheden voor publiek.',
        factors: [
          { id: 'afsluiting', label: 'Publieke afsluiting', desc: 'Welke toegangsbeperking geldt voor het publiek?', values: [['open', 'Geen afsluiting'], ['deels', 'Deelgebied gesloten'], ['dicht', 'Hele gebied voor publiek gesloten']] },
          { id: 'toegang', label: 'Toegang voor publiek', desc: 'Hoe kunnen bezoekers het gebied in de oefening gebruiken?', values: [['vrij', 'Vrije toegang tot het hele gebied'], ['geleid', 'Alleen begeleide publieke toegang'], ['geen', 'Geen publieke toegang']] },
          { id: 'opvang', label: 'Ondersteuning voor bezoekers', desc: 'Hoe worden recreanten en bewoners opgevangen of geïnformeerd?', values: [['lokaal', 'Contact via terreinbeheer'], ['gemeente', 'Gemeentelijke ondersteuning'], ['regionaal', 'Regionaal afgestemde ondersteuning']] },
        ],
      },
      {
        id: 'regie', label: 'Samenwerking en herstel',
        desc: 'Een gedeeld beeld en passende nazorg geven richting aan besluiten.',
        factors: [
          { id: 'beeld', label: 'Zekerheid van situatiebeeld', desc: 'Hoe volledig is de informatie over rook en gevolgen voor de omgeving?', values: [['eerste', 'Eerste meldingen'], ['gedeeld', 'Gedeeld beeld met onzekerheden'], ['bevestigd', 'Waarnemingen bevestigd']] },
          { id: 'partners', label: 'Betrokken organisaties', desc: 'Wie moet voor een samenhangende publieksaanpak samenwerken?', values: [['beheer', 'Terreinbeheerder en gemeente'], ['regio', 'Veiligheidsregio en terreinbeheer'], ['grens', 'Meerdere regio’s en beheerders']] },
          { id: 'nazorg', label: 'Herstelvraag', desc: 'Wat vraagt aandacht wanneer de directe druk afneemt?', values: [['toegang', 'Heropening van het gebied'], ['gezondheid', 'Uitleg over rook en gezondheid'], ['omgeving', 'Omgevingsherstel en evaluatie']] },
        ],
      },
    ],
    exclusions: [['status.dreiging', 'rook.plaatselijk'], ['status.dreiging', 'rook.wijd'], ['afsluiting.dicht', 'toegang.vrij'], ['afsluiting.dicht', 'toegang.geleid'], ['afsluiting.deels', 'toegang.vrij']],
    prompt: 'Schrijf een Nederlandstalig scenario voor een veiligheidsregio over een natuurbrand of de dreiging daarvan. Gebruik alle gekozen waarden over landschap, weersomstandigheden, brandstatus, rook, bezoekers en functies rond het gebied. Beschrijf afwegingen over publieke toegang, ondersteuning, onzekerheid van het situatiebeeld, samenwerking en nazorg. Vermijd exacte brandvoorspellingen en operationele bestrijdingsinstructies. Eindig met twee oefenvragen.',
    example: {
      label: 'Rook bij het heidegebied',
      desc: '<p>In een droog heidegebied ontstaat een lokale brand terwijl veel recreanten aanwezig zijn. Plaatselijke rook wordt gemeld en een deel van het gebied gaat dicht; begeleide publieke toegang blijft mogelijk in een ander deel. Recreatievoorzieningen vragen om één betrouwbaar situatiebeeld.</p><p>Terreinbeheerder en veiligheidsregio stemmen gemeentelijke ondersteuning voor bezoekers af. Terwijl de eerste meldingen nog onvolledig zijn, bespreken zij ook hoe toekomstige heropening en communicatie over rook zorgvuldig voorbereid kunnen worden.</p>',
      choices: ['terrein.heide', 'status.lokaal', 'omstandigheden.droog', 'rook.plaatselijk', 'mensen.recreanten', 'omgeving.recreatie', 'afsluiting.deels', 'toegang.geleid', 'opvang.gemeente', 'beeld.eerste', 'partners.regio', 'nazorg.toegang'],
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
          { id: 'fase', label: 'Fase van publieke besluitvorming', desc: 'Wanneer in het publieke debat vindt de bijeenkomst plaats?', values: [['voorstel', 'Een voorstel wordt besproken'], ['besluit', 'Na een aangekondigd besluit'], ['evaluatie', 'Tijdens de evaluatie van beleid']] },
        ],
      },
      {
        id: 'ruimte', label: 'Openbare ruimte',
        desc: 'De omgeving en geplande route bepalen waar belangen elkaar raken.',
        factors: [
          { id: 'locatie', label: 'Omgeving', desc: 'Welk type omgeving is relevant voor de uitoefening van demonstratierecht?', values: [['plein', 'Stadsplein'], ['campus', 'Campus en omgeving'], ['diplomatiek', 'Wijk met diplomatieke functies']] },
          { id: 'route', label: 'Verplaatsing van de bijeenkomst', desc: 'Welke beweging is in dit oefenscenario gepland?', values: [['geen', 'Geen verplaatsing'], ['afgesproken', 'Vooraf besproken looproute'], ['onbekend', 'Verplaatsing, route nog onbekend']] },
          { id: 'bereikbaarheid', label: 'Bereikbaarheid omgeving', desc: 'Welke gevolgen voor normale verplaatsingen zijn vooraf bekend?', values: [['normaal', 'Gebruikelijke routes bereikbaar'], ['omleiding', 'Tijdelijke omleidingen'], ['onzeker', 'Bereikbaarheid nog onbekend']] },
        ],
      },
      {
        id: 'afstemming', label: 'Afstemming',
        desc: 'De opkomst en het contact met organisatoren sturen informatievoorziening, niet de rechten van deelnemers.',
        factors: [
          { id: 'opkomst', label: 'Verwachte opkomst', desc: 'Hoeveel deelnemers worden ongeveer verwacht?', values: [['klein', 'Tientallen'], ['middel', 'Honderden'], ['groot', 'Duizenden']] },
          { id: 'contact', label: 'Contact met organisatoren', desc: 'Welke mogelijkheid tot afstemming bestaat er?', values: [['bereikbaar', 'Contactpersonen bereikbaar'], ['los', 'Los georganiseerd collectief'], ['onbekend', 'Nog geen contact vastgesteld']] },
          { id: 'tijd', label: 'Tijdsduur van bijeenkomst', desc: 'Hoelang is de publieke ruimte volgens de planning in gebruik?', values: [['kort', 'Enkele uren'], ['dag', 'Een dagdeel'], ['lang', 'Meerdere dagdelen']] },
        ],
      },
      {
        id: 'rechten', label: 'Rechten en communicatie',
        desc: 'Leg de afwegingen vast zonder deelnemers op identiteit te beoordelen.',
        factors: [
          { id: 'kennisgeving', label: 'Status van kennisgeving', desc: 'Welk contact is er over de voorgenomen demonstratie met het bevoegde gezag?', values: [['ontvangen', 'Kennisgeving ontvangen'], ['laat', 'Laat bekend geworden'], ['onzeker', 'Status nog onduidelijk']] },
          { id: 'belang', label: 'Belangrijkste afweging', desc: 'Welk ander publiek belang vraagt naast het demonstratierecht aandacht?', values: [['toegang', 'Toegang voor omwonenden'], ['hulp', 'Bereikbaarheid voor hulpverlening'], ['dialoog', 'Rustige dialoog tussen partijen']] },
          { id: 'publiek', label: 'Communicatie naar omwonenden', desc: 'Welke vorm van informatie over verloop en bereikbaarheid is voorbereid?', values: [['lokaal', 'Lokale informatie'], ['breed', 'Breed afgestemde informatie'], ['voorlopig', 'Voorlopige informatie met onzekerheden']] },
        ],
      },
    ],
    exclusions: [['vorm.statisch', 'route.afgesproken'], ['vorm.statisch', 'route.onbekend'], ['vorm.mars', 'route.geen'], ['vorm.combinatie', 'route.geen']],
    prompt: 'Schrijf een evenwichtig Nederlandstalig scenario rond een vreedzame demonstratie met alle gekozen waarden. Beschrijf aanleiding, fase van besluitvorming, vorm, route, verwachte opkomst en kennisgeving. Laat zien hoe demonstratierecht, contact met organisatoren, bereikbaarheid voor omwonenden en eerlijke publieke communicatie tegen elkaar worden afgewogen. Stel geen groep gelijk aan een dreiging, verzin geen strafbare feiten en geef geen tactische aanwijzingen. Eindig met twee vragen over proportionaliteit.',
    example: {
      label: 'Een studentenmars door de stad',
      desc: '<p>Honderden studenten willen na een aangekondigd onderwijsbesluit vanuit de campus met een optocht naar het stadsplein. Hun contactpersonen hebben een looproute voor een dagdeel besproken; tijdelijk zijn omleidingen nodig. De kennisgeving is ontvangen.</p><p>De gemeente zorgt dat omwonenden tijdig weten welke routes bereikbaar blijven. In het overleg staat zowel het recht om te demonstreren als toegang tot de buurt centraal. De organisatoren kunnen veranderingen rechtstreeks terugkoppelen.</p>',
      choices: ['thema.studie', 'vorm.mars', 'fase.besluit', 'locatie.campus', 'route.afgesproken', 'bereikbaarheid.omleiding', 'opkomst.middel', 'contact.bereikbaar', 'tijd.dag', 'kennisgeving.ontvangen', 'belang.toegang', 'publiek.lokaal'],
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
          { id: 'gebruik', label: 'Type gebruik', desc: 'Welke activiteit maakt de betrokken ruimte op dit moment belangrijk?', values: [['loket', 'Publieke dienstverlening'], ['bijeenkomst', 'Geplande bijeenkomst'], ['dagelijks', 'Dagelijks onderwijs of cultuur']] },
        ],
      },
      {
        id: 'bezoekers', label: 'Bezoekers en omgeving',
        desc: 'De combinatie van bezetting en bezoekafspraken bepaalt de vraag naar gastvrijheid.',
        factors: [
          { id: 'bezoek', label: 'Bezoekersregime', desc: 'Onder welke voorwaarden mogen bezoekers binnenkomen?', values: [['vrij', 'Vrije inloop'], ['afspraak', 'Alleen op afspraak'], ['geen', 'Geen publiek toegelaten']] },
          { id: 'drukte', label: 'Bezetting', desc: 'Hoeveel aanwezigen zijn in het gebouw te verwachten?', values: [['laag', 'Lage bezetting'], ['middel', 'Gemiddelde bezetting'], ['hoog', 'Hoge bezetting']] },
          { id: 'behoefte', label: 'Toegankelijkheidsbehoefte', desc: 'Welke bezoekers hebben extra ondersteuning bij veranderingen nodig?', values: [['taal', 'Meertalige uitleg'], ['digitaal', 'Hulp buiten digitale kanalen'], ['mobiliteit', 'Toegankelijke begeleiding']] },
        ],
      },
      {
        id: 'dienst', label: 'Dienstverlening en entree',
        desc: 'Hoe verhouden dienstverlening en fysieke publieksentrees zich tot elkaar?',
        factors: [
          { id: 'service', label: 'Dienstverlening', desc: 'Hoe wordt de maatschappelijke functie beschikbaar gehouden?', values: [['normaal', 'Normale dienstverlening'], ['beperkt', 'Beperkte dienstverlening'], ['online', 'Vooral op afstand']] },
          { id: 'entree', label: 'Publieksentrees', desc: 'In welke mate zijn de entrees voor bezoekers geopend?', values: [['open', 'Alle publieksentrees open'], ['deels', 'Een publieksentree open'], ['dicht', 'Alle publieksentrees gesloten']] },
          { id: 'verstoring', label: 'Gevolg voor de dienst', desc: 'Welk effect merkt een bezoeker van de verandering?', values: [['wachttijd', 'Langere wachttijd'], ['verplaatst', 'Afspraak verplaatst'], ['alternatief', 'Andere vorm van dienstverlening']] },
        ],
      },
      {
        id: 'regie', label: 'Continuïteit en nazorg',
        desc: 'Ook bij toegangsbeperking blijft het belang van gebruikers zichtbaar.',
        factors: [
          { id: 'beheer', label: 'Afstemming gebouw en dienst', desc: 'Hoe organiseren gebouwbeheer en dienstverlener hun besluitvorming?', values: [['direct', 'Direct contact'], ['team', 'Gezamenlijk overleg'], ['keten', 'Overleg met externe partners']] },
          { id: 'alternatief', label: 'Alternatief voor bezoekers', desc: 'Hoe blijft een noodzakelijke dienst bereikbaar voor mensen die niet binnen kunnen?', values: [['afspraak', 'Nieuwe afspraak'], ['locatie', 'Andere locatie'], ['afstand', 'Ondersteuning op afstand']] },
          { id: 'bericht', label: 'Informatie aan publiek', desc: 'Wanneer krijgt een bezoeker uitleg over gewijzigde toegang?', values: [['vooraf', 'Vooraf via bekende kanalen'], ['terplekke', 'Bij aankomst'], ['persoonlijk', 'Persoonlijk bij bestaande afspraak']] },
        ],
      },
    ],
    exclusions: [['opening.gesloten', 'bezoek.vrij'], ['opening.gesloten', 'entree.open'], ['opening.gesloten', 'entree.deels'], ['bezoek.vrij', 'entree.dicht'], ['bezoek.geen', 'entree.open']],
    prompt: 'Maak een Nederlandstalig scenario over continuïteit en bezoekerszorg in een publiek gebouw. Gebruik alle gekozen waarden over gebruik, opening, bezetting, toegankelijkheidsbehoeften, dienstverstoring en alternatieve dienstverlening. Verbind keuzes van gebouwbeheer en dienstverlener met heldere informatie en de gevolgen voor bezoekers. Beschrijf geen technische of fysieke zwakke plekken. Eindig met twee vragen voor de organisatie.',
    example: {
      label: 'Het gemeentehuis blijft bereikbaar',
      desc: '<p>Een gemeentehuis ontvangt bezoekers van het publieksloket alleen op afspraak terwijl één entree open blijft. De bezetting is gemiddeld en de dienstverlening is tijdelijk beperkt. Vooral inwoners die niet digitaal vaardig zijn krijgen langere wachttijden.</p><p>Gebouwbeheer en de dienst stemmen in een gezamenlijk overleg een alternatief af: wie niet terechtkan krijgt persoonlijk een nieuwe afspraak. Zo blijft toegang tot noodzakelijke diensten mogelijk zonder dat de gemeente aanneemt dat iedereen online uit de voeten kan.</p>',
      choices: ['functie.gemeente', 'opening.beperkt', 'gebruik.loket', 'bezoek.afspraak', 'drukte.middel', 'behoefte.digitaal', 'service.beperkt', 'entree.deels', 'verstoring.wachttijd', 'beheer.team', 'alternatief.afspraak', 'bericht.persoonlijk'],
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
          { id: 'activiteit', label: 'Activiteit', desc: 'Welke activiteit vindt in het gebouw plaats?', values: [['publiek', 'Publiek toegankelijke viering'], ['besloten', 'Besloten bijeenkomst'], ['geen', 'Geen gezamenlijke bijeenkomst; individueel bezoek mogelijk']] },
          { id: 'bezoekers', label: 'Publieksbereik van de bijeenkomst', desc: 'Voor welke groep is de bijeenkomst toegankelijk?', values: [['iedereen', 'Publiek welkom'], ['gasten', 'Alleen genodigden'], ['niemand', 'Geen publiek toegelaten']] },
          { id: 'ritme', label: 'Moment van de bijeenkomst', desc: 'Wanneer en met welke voorbereiding komen mensen bijeen?', values: [['regulier', 'Reguliere bijeenkomst'], ['feestdag', 'Drukke feestdag'], ['bijzonder', 'Bijzondere gemeenschapsbijeenkomst']] },
        ],
      },
      {
        id: 'omgeving', label: 'Omgeving en bezetting',
        desc: 'De relatie met de omgeving en schaal van de bijeenkomst.',
        factors: [
          { id: 'plek', label: 'Omgeving van het centrum', desc: 'Waar ligt het gebouw ten opzichte van dagelijkse bezoekersstromen?', values: [['buurt', 'Woonbuurt'], ['centrum', 'Stadscentrum'], ['dorp', 'Dorpskern']] },
          { id: 'drukte', label: 'Verwachte bezetting', desc: 'Hoeveel bezoekers zijn op hetzelfde moment aanwezig?', values: [['klein', 'Kleine groep'], ['middel', 'Middelgrote groep'], ['groot', 'Drukke bijeenkomst']] },
          { id: 'mobiliteit', label: 'Bereikbaarheid voor bezoekers', desc: 'Welke manier van aankomst vraagt aandacht bij de bijeenkomst?', values: [['lopen', 'Voornamelijk lopend'], ['vervoer', 'Mix van openbaar vervoer en auto'], ['ondersteuning', 'Extra toegankelijk vervoer nodig']] },
        ],
      },
      {
        id: 'gastvrijheid', label: 'Gastvrijheid en communicatie',
        desc: 'Publieke toegang en communicatie worden vanuit zorg voor bezoekers vormgegeven.',
        factors: [
          { id: 'toegang', label: 'Toegang tot het centrum', desc: 'Hoe is de toegang voor bezoekers georganiseerd?', values: [['open', 'Vrije inloop'], ['uitnodiging', 'Alleen op uitnodiging'], ['dicht', 'Geen toegang voor bezoekers']] },
          { id: 'communicatie', label: 'Contact met de omgeving', desc: 'Hoe wordt relevante informatie gedeeld met betrokkenen?', values: [['intern', 'Via de gemeenschap'], ['buurt', 'Ook met omwonenden'], ['breed', 'Ook via publieke kanalen']] },
          { id: 'welkom', label: 'Ondersteuning op locatie', desc: 'Hoe wordt de ontvangst van mensen met verschillende behoeften verzorgd?', values: [['vrijwilligers', 'Vrijwilligers als aanspreekpunt'], ['meertalig', 'Meertalige begeleiding'], ['zorg', 'Ondersteuning voor minder mobiele bezoekers']] },
        ],
      },
      {
        id: 'samenwerking', label: 'Samenwerking en nazorg',
        desc: 'Besluiten vinden plaats met de gemeenschap en houden de toegankelijkheid centraal.',
        factors: [
          { id: 'regie', label: 'Besluitvorming', desc: 'Wie bepaalt hoe ontvangst en communicatie worden aangepast?', values: [['gemeenschap', 'Organisatie van de gemeenschap'], ['buurt', 'Samen met buurtorganisaties'], ['publiek', 'Samen met betrokken publieke partners']] },
          { id: 'zorg', label: 'Extra aandacht', desc: 'Welke opgave verdient extra aandacht na een drukke bijeenkomst?', values: [['toegang', 'Toegankelijkheid van deelname'], ['contact', 'Contact met omwonenden'], ['nazorg', 'Nazorg voor bezoekers']] },
          { id: 'terugkoppeling', label: 'Evaluatie', desc: 'Hoe worden ervaringen van bezoekers en vrijwilligers verzameld?', values: [['gesprek', 'Gesprek na afloop'], ['gemeenschap', 'Terugkoppeling binnen de gemeenschap'], ['samen', 'Gezamenlijke evaluatie']] },
        ],
      },
    ],
    exclusions: [['activiteit.publiek', 'bezoekers.niemand'], ['activiteit.publiek', 'toegang.dicht'], ['bezoekers.iedereen', 'toegang.dicht']],
    prompt: 'Schrijf een respectvol Nederlandstalig scenario voor een religieus centrum met alle gekozen waarden. Verbind moment en omvang van de bijeenkomst, vervoer, ontvangst en vrije toegang met gastvrijheid, samenwerking met de gemeenschap en zorgvuldige communicatie met omwonenden. Benoem wie besluiten neemt en hoe bezoekerservaringen worden geëvalueerd. Maak geen aannames over dreiging op basis van religie en noem geen kwetsbaarheden of beveiligingsdetails. Eindig met twee reflectievragen.',
    example: {
      label: 'Een drukke bijeenkomst in de buurt',
      desc: '<p>Een publiek toegankelijke viering op een feestdag trekt veel bezoekers naar een centrum in een woonbuurt. Veel mensen komen met vervoer uit de omgeving. De organisatie houdt vrije inloop mogelijk en informeert omwonenden over de verwachte drukte.</p><p>Vrijwilligers verzorgen de ontvangst. Met de buurt bespreekt de gemeenschap hoe iedereen kan deelnemen zonder dat de bereikbaarheid onnodig onder druk komt. Na afloop delen bezoekers en vrijwilligers hun ervaringen in een gesprek.</p>',
      choices: ['activiteit.publiek', 'bezoekers.iedereen', 'ritme.feestdag', 'plek.buurt', 'drukte.groot', 'mobiliteit.vervoer', 'toegang.open', 'communicatie.buurt', 'welkom.vrijwilligers', 'regie.buurt', 'zorg.contact', 'terugkoppeling.gesprek'],
    },
  },
  {
    id: 'havencontinuiteit',
    label: 'Haven en continuïteit',
    desc: 'Oefen de gevolgen van verstoringen in havenlogistiek voor dienstverlening en ketenpartners. Capaciteit en afhandelingsstroom beschrijven alleen de fictieve terminal, ook wanneer deze reizigers in plaats van goederen verwerkt; geen beveiligingsdetails.',
    categories: [
      {
        id: 'haven', label: 'Havenfunctie',
        desc: 'Type terminal en actuele afhandeling in de oefening.',
        factors: [
          { id: 'functie', label: 'Havenfunctie', desc: 'Welke functie heeft de onderzochte fictieve terminal?', values: [['container', 'Containerafhandeling'], ['veer', 'Veerverbinding'], ['gemengd', 'Gemengde logistiek']] },
          { id: 'afhandeling', label: 'Afhandeling op de terminal', desc: 'Kan de terminal goederen en reizigers verwerken?', values: [['normaal', 'Normale afhandeling'], ['beperkt', 'Beperkte afhandeling'], ['stil', 'Afhandeling stilgelegd']] },
          { id: 'tijd', label: 'Tijdshorizon van verstoring', desc: 'Hoelang verwacht de organisatie een effect op de terminal?', values: [['kort', 'Enkele uren'], ['dag', 'Een etmaal'], ['lang', 'Meerdere dagen']] },
        ],
      },
      {
        id: 'keten', label: 'Keten en scheepvaart',
        desc: 'Afhankelijkheden buiten de terminal kunnen ook bij beperkte afhandeling blijven bestaan.',
        factors: [
          { id: 'scheepvaart', label: 'Scheepvaart in de haven', desc: 'Welke verkeerssituatie geldt breder dan deze terminal?', values: [['normaal', 'Regulier verkeer'], ['beperkt', 'Beperkt verkeer'], ['omgeleid', 'Verkeer wordt omgeleid']] },
          { id: 'druk', label: 'Druk op ketenpartners', desc: 'Hoe groot is de vraag naar afstemming met vervoerders en autoriteiten?', values: [['laag', 'Beperkt'], ['middel', 'Merkbaar'], ['hoog', 'Groot']] },
          { id: 'achterland', label: 'Verbinding met achterland', desc: 'Wat is bekend over vervoer buiten de terminal?', values: [['normaal', 'Regulier beschikbaar'], ['beperkt', 'Beperkt beschikbaar'], ['onzeker', 'Capaciteit nog onduidelijk']] },
        ],
      },
      {
        id: 'capaciteit', label: 'Terminalcapaciteit',
        desc: 'Maak capaciteit en feitelijke goederenstroom afzonderlijk zichtbaar.',
        factors: [
          { id: 'capaciteit', label: 'Verwerkingscapaciteit van de terminal', desc: 'Hoeveel van de gewone verwerkingscapaciteit is beschikbaar?', values: [['normaal', 'Volledig beschikbaar'], ['beperkt', 'Gedeeltelijk beschikbaar'], ['geen', 'Geen verwerkingscapaciteit']] },
          { id: 'stroom', label: 'Afhandelingsstroom via de terminal', desc: 'Welke goederen- of reizigersafhandeling vindt nog via deze specifieke terminal plaats?', values: [['normaal', 'Normale stroom'], ['beperkt', 'Beperkte stroom'], ['geen', 'Geen stroom']] },
          { id: 'bezetting', label: 'Beschikbaar personeel', desc: 'Hoeveel van de gewone bezetting kan de dienst ondersteunen?', values: [['normaal', 'Reguliere bezetting'], ['beperkt', 'Beperkte bezetting'], ['wisselend', 'Wisselende bezetting']] },
        ],
      },
      {
        id: 'regie', label: 'Ketenregie en herstel',
        desc: 'Stem gevolgen van de terminal af met maatschappelijke dienstverlening en partners.',
        factors: [
          { id: 'prioriteit', label: 'Prioritaire dienstverlening', desc: 'Welk belang krijgt in de afweging bijzondere aandacht?', values: [['reiziger', 'Continuïteit reizigers'], ['levering', 'Continuïteit leveringen'], ['veiligheid', 'Zorg voor medewerkers en omgeving']] },
          { id: 'afstemming', label: 'Gezamenlijk situatiebeeld', desc: 'Met welke partijen wordt de status van de terminal gedeeld?', values: [['terminal', 'Terminal en havenbedrijf'], ['keten', 'Logistieke ketenpartners'], ['overheid', 'Ketenpartners en overheid']] },
          { id: 'informatie', label: 'Uitleg aan betrokkenen', desc: 'Hoe worden planning en onzekerheden gecommuniceerd?', values: [['gericht', 'Gerichte updates aan klanten'], ['breed', 'Brede publieke communicatie'], ['voorlopig', 'Voorlopige status met onzekerheden']] },
        ],
      },
    ],
    exclusions: [['afhandeling.normaal', 'capaciteit.geen'], ['afhandeling.stil', 'stroom.normaal'], ['afhandeling.stil', 'stroom.beperkt'], ['capaciteit.geen', 'stroom.normaal'], ['capaciteit.geen', 'stroom.beperkt']],
    prompt: 'Schrijf een Nederlandstalig continuïteitsscenario voor een fictieve haventerminal. Laat zien hoe duur, terminalfunctie, beschikbare medewerkers, afhandelingsstroom en achterlandverbinding de afwegingen voor reizigers of leveringen beïnvloeden. Maak expliciet wat alleen de terminal betreft en wat de hele haven betreft. Beschrijf geen toegangsroutes, kwetsbaarheden of beveiligingsprocedures. Eindig met twee vragen over samenwerking en herstel.',
    example: {
      label: 'Een terminal schakelt terug',
      desc: '<p>Een containerterminal kan naar verwachting een etmaal slechts beperkt verwerken, terwijl elders in de haven de scheepvaart regulier doorgaat. De bezetting van de terminal wisselt en de verbinding met het achterland is beperkt. Daardoor neemt de afhandelingsstroom af en vragen ketenpartners om heldere verwachtingen.</p><p>Havenbedrijf, vervoerders en overheid stemmen af welke leveringen voorrang krijgen. In gerichte updates leggen zij uit waarom de gevolgen voor deze terminal niet gelijkstaan aan stilstand van de hele haven.</p>',
      choices: ['functie.container', 'afhandeling.beperkt', 'tijd.dag', 'scheepvaart.normaal', 'druk.hoog', 'achterland.beperkt', 'capaciteit.beperkt', 'stroom.beperkt', 'bezetting.wisselend', 'prioriteit.levering', 'afstemming.overheid', 'informatie.gericht'],
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
          { id: 'tijd', label: 'Verwachte duur', desc: 'Hoelang houdt de onzekerheid over de situatie naar verwachting aan?', values: [['kort', 'Enkele uren'], ['dag', 'Een dagdeel'], ['lang', 'Meer dan een etmaal']] },
        ],
      },
      {
        id: 'infrastructuur', label: 'Beschikbare infrastructuur',
        desc: 'Banen en terminal kunnen onafhankelijk van elkaar beperkt zijn.',
        factors: [
          { id: 'banen', label: 'Operationele start- en landingsbanen', desc: 'Zijn de banen voor vluchten beschikbaar?', values: [['open', 'Alle banen beschikbaar'], ['deels', 'Een deel beschikbaar'], ['dicht', 'Alle banen gesloten']] },
          { id: 'terminal', label: 'Terminal voor publiek', desc: 'Is de passagiersterminal geopend?', values: [['open', 'Geheel geopend'], ['deels', 'Gedeeltelijk geopend'], ['dicht', 'Geheel gesloten']] },
          { id: 'verbinding', label: 'Vervoer van en naar de luchthaven', desc: 'Welke mogelijkheden zijn voor reizigers in de regio beschikbaar?', values: [['normaal', 'Regulier vervoer'], ['beperkt', 'Beperkt vervoer'], ['onzeker', 'Alternatieven worden onderzocht']] },
        ],
      },
      {
        id: 'reizigers', label: 'Reizigers en informatie',
        desc: 'Welke dienstverlening en informatie ontvangen reizigers?',
        factors: [
          { id: 'verwerking', label: 'Passagiersverwerking in de terminal', desc: 'In welke mate worden reizigers in de terminal verwerkt?', values: [['normaal', 'Normaal'], ['beperkt', 'Beperkt'], ['stil', 'Gestopt']] },
          { id: 'informatie', label: 'Informatie aan reizigers', desc: 'Hoe snel kunnen betrokken partijen een actueel beeld delen?', values: [['tijdig', 'Tijdige gezamenlijke updates'], ['traag', 'Vertraagde updates'], ['onzeker', 'Onzeker beeld']] },
          { id: 'opvang', label: 'Reizigerszorg', desc: 'Welke ondersteuning is voor gestrande of vertraagde reizigers georganiseerd?', values: [['terplekke', 'Informatie ter plaatse'], ['vervoer', 'Hulp bij alternatief vervoer'], ['opvang', 'Tijdelijke opvang in afstemming']] },
        ],
      },
      {
        id: 'regie', label: 'Ketenbesluiten',
        desc: 'Een luchthaven is ook afhankelijk van vervoerders, overheid en regionale voorzieningen.',
        factors: [
          { id: 'partners', label: 'Betrokken partners', desc: 'Wie bouwt een gezamenlijk beeld van de situatie op?', values: [['luchthaven', 'Luchthaven en luchtvaartmaatschappijen'], ['regionaal', 'Ook regionale vervoerders'], ['breed', 'Ook betrokken overheden en zorgpartners']] },
          { id: 'keuze', label: 'Belangrijkste afweging', desc: 'Welk maatschappelijk belang staat onder tijdsdruk?', values: [['reizigers', 'Zorg voor reizigers'], ['vluchten', 'Prioriteren van vluchten'], ['omgeving', 'Gevolgen voor de omgeving']] },
          { id: 'herstel', label: 'Herstelperspectief', desc: 'Hoe zeker is de terugkeer naar de gewone dienstregeling?', values: [['onbekend', 'Nog onbekend'], ['gefaseerd', 'Gefaseerde hervatting voorzien'], ['normaal', 'Reguliere situatie hersteld']] },
        ],
      },
    ],
    exclusions: [['banen.dicht', 'operatie.normaal'], ['banen.dicht', 'operatie.beperkt'], ['terminal.dicht', 'verwerking.normaal'], ['terminal.dicht', 'verwerking.beperkt']],
    prompt: 'Maak een Nederlandstalig scenario over continuïteit en reizigerszorg op een fictieve luchthaven met alle gekozen waarden. Beschrijf afzonderlijk vluchtoperatie, terminal, passagiersverwerking en regionaal vervoer, en betrek onzekerheid over de duur en het herstelperspectief. Laat zien hoe luchthaven, vervoerders en overheden reizigers ondersteunen en informatie afstemmen. Vermijd specifieke infrastructuurkwetsbaarheden en technische beveiligingsdetails. Eindig met twee vragen over reizigersinformatie.',
    example: {
      label: 'Reizigers wachten op duidelijkheid',
      desc: '<p>Een internationale luchthaven kan naar verwachting een dagdeel een beperkt aantal vluchten afhandelen. Een deel van de terminal is niet in gebruik en reizigers ondervinden vertraging. Ook het regionale vervoer kan minder mensen meenemen, terwijl updates van vervoerders laat binnenkomen.</p><p>Luchthaven, luchtvaartmaatschappijen en regionale vervoerders stemmen tijdelijke opvang en alternatieve reisopties af. De terugkeer naar een gewone dienstregeling is nog onzeker; daarom staat zorg voor reizigers centraal bij het besluit welke informatie al gedeeld kan worden.</p>',
      choices: ['functie.internationaal', 'operatie.beperkt', 'tijd.dag', 'banen.deels', 'terminal.deels', 'verbinding.beperkt', 'verwerking.beperkt', 'informatie.traag', 'opvang.opvang', 'partners.regionaal', 'keuze.reizigers', 'herstel.onbekend'],
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

export const addStarterKitToModel = (
  model: DataModel,
  starter: DataModel
): { model: DataModel; added: number } => {
  const existingIds = new Set([model.scenario, ...model.scenarios].map(({ id }) => id));
  const missing = [starter.scenario, ...starter.scenarios].filter(
    ({ id }) => !existingIds.has(id)
  );
  return {
    model: missing.length ? { ...model, scenarios: [...model.scenarios, ...missing] } : model,
    added: missing.length,
  };
};
