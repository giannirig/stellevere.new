from flask import Flask, render_template, send_from_directory, jsonify, request
import re
import unicodedata
import os
import json
from collections import defaultdict

app = Flask(__name__, static_folder='static', template_folder='templates')


def slugify(s):
    s = unicodedata.normalize('NFD', str(s)).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-z0-9\s-]', '', s.lower())
    return re.sub(r'[\s-]+', '-', s).strip('-')


# Mappa categoria → slug e viceversa
CATEGORIE = {
    'idraulica':    {'nome': 'Idraulica',    'cat_tipo': 'Idraulico',    'plurale': 'Idraulici',    'icona': 'drop'},
    'elettricista': {'nome': 'Elettricista', 'cat_tipo': 'Elettricista', 'plurale': 'Elettricisti', 'icona': 'zap'},
    'imbianchino':  {'nome': 'Imbianchino',  'cat_tipo': 'Imbianchino',  'plurale': 'Imbianchini',  'icona': 'paint'},
    'muratore':     {'nome': 'Muratore',     'cat_tipo': 'Muratore',     'plurale': 'Muratori',     'icona': 'wall'},
    'falegname':    {'nome': 'Falegname',    'cat_tipo': 'Falegname',    'plurale': 'Falegnami',    'icona': 'wood'},
    'altro':        {'nome': 'Altro',        'cat_tipo': 'Artigiano',    'plurale': 'Artigiani',    'icona': 'tool'},
}

# Dati artigiani
ARTIGIANI = {
    'fossati-antonio': {
        'id': 'fossati-antonio',
        'nome': 'Fossati Antonio',
        'categoria': 'Idraulico',
        'cat_slug': 'idraulica',
        'citta': 'Milano',
        'stelle': 5.0,
        'recensioni': 23,
        'telefono': '+39 333 123 4567',
        'lavori': [
            {'id': 1, 'titolo': 'Sostituzione Caldaia Condominiale',
             'descrizione': 'Sostituzione completa caldaia condominiale da 80kW con modello ad alta efficienza. Lavoro eseguito in 2 giorni, compreso smaltimento vecchia caldaia e collaudo impianto.',
             'citta': 'Milano', 'quartiere': 'Porta Venezia', 'stelle': 5, 'visite': 38,
             'recensione': 'Caldaia sostituita in 2 giorni. Preciso, pulito, puntuale.', 'cliente': 'Luca C.'},
            {'id': 2, 'titolo': 'Rifacimento Bagno Completo',
             'descrizione': 'Rifacimento completo del bagno: demolizione pavimento e rivestimenti, nuova posa piastrelle, installazione sanitari e rubinetteria.',
             'citta': 'Milano', 'quartiere': 'Navigli', 'stelle': 5, 'visite': 52,
             'recensione': 'Bagno rifatto in una settimana, tutto perfetto. Prezzo onesto.', 'cliente': 'Maria R.'},
            {'id': 3, 'titolo': 'Perdita Urgente H24',
             'descrizione': 'Intervento di emergenza per perdita d\'acqua notturna. Riparazione tubazione rotta sotto pavimento.',
             'citta': 'Milano', 'quartiere': 'Città Studi', 'stelle': 5, 'visite': 29,
             'recensione': 'Perdita di notte risolta in un\'ora. Disponibile H24, professionista vero.', 'cliente': 'Giorgio P.'},
            {'id': 4, 'titolo': 'Impianto Termosifoni',
             'descrizione': 'Installazione nuovo impianto di riscaldamento con termosifoni in alluminio. Progettazione, fornitura e posa completa.',
             'citta': 'Milano', 'quartiere': 'Brera', 'stelle': 5, 'visite': 41,
             'recensione': 'Impianto realizzato a regola d\'arte. Consigliatissimo!', 'cliente': 'Sara M.'},
        ]
    },
    'ricci-marco': {
        'id': 'ricci-marco',
        'nome': 'Ricci Marco',
        'categoria': 'Idraulico',
        'cat_slug': 'idraulica',
        'citta': 'Milano',
        'stelle': 4.8,
        'recensioni': 17,
        'telefono': '+39 348 765 4321',
        'lavori': [
            {'id': 5, 'titolo': 'Installazione Scalda Acqua',
             'descrizione': 'Installazione boiler elettrico 80L con valvola di sicurezza. Smaltimento vecchio e collaudo.',
             'citta': 'Milano', 'quartiere': 'San Siro', 'stelle': 5, 'visite': 22,
             'recensione': 'Lavoro fatto bene, in tempi rapidi. Lo richiamerei.', 'cliente': 'Paolo F.'},
            {'id': 6, 'titolo': 'Sostituzione Rubinetteria Cucina',
             'descrizione': 'Sostituzione rubinetto cucina e sifone. Intervento pulito e veloce.',
             'citta': 'Milano', 'quartiere': 'Isola', 'stelle': 5, 'visite': 18,
             'recensione': 'Puntuale e professionale. Ottimo lavoro.', 'cliente': 'Giulia T.'},
        ]
    },
    'ferrari-luigi': {
        'id': 'ferrari-luigi',
        'nome': 'Ferrari Luigi',
        'categoria': 'Elettricista',
        'cat_slug': 'elettricista',
        'citta': 'Milano',
        'stelle': 4.9,
        'recensioni': 31,
        'telefono': '+39 366 222 3344',
        'lavori': [
            {'id': 7, 'titolo': 'Impianto Elettrico Appartamento',
             'descrizione': 'Rifacimento completo impianto elettrico con quadro moderno differenziali a norma CEI 64-8.',
             'citta': 'Milano', 'quartiere': 'Navigli', 'stelle': 5, 'visite': 67,
             'recensione': 'Lavoro impeccabile, impianto a norma. Professionale e puntuale.', 'cliente': 'Roberto A.'},
            {'id': 8, 'titolo': 'Installazione Climatizzatore',
             'descrizione': 'Installazione split dual inverter con gas R32, foratura muro e collaudo.',
             'citta': 'Milano', 'quartiere': 'Porta Romana', 'stelle': 5, 'visite': 44,
             'recensione': 'Ottimo lavoro, veloce e preciso. Molto soddisfatto.', 'cliente': 'Francesca B.'},
        ]
    },
    'bianchi-carlo': {
        'id': 'bianchi-carlo',
        'nome': 'Bianchi Carlo',
        'categoria': 'Elettricista',
        'cat_slug': 'elettricista',
        'citta': 'Roma',
        'stelle': 4.7,
        'recensioni': 14,
        'telefono': '+39 347 888 9900',
        'lavori': [
            {'id': 9, 'titolo': 'Sostituzione Quadro Elettrico',
             'descrizione': 'Sostituzione quadro obsoleto con nuovo centralino con differenziali separati per zona.',
             'citta': 'Roma', 'quartiere': 'Prati', 'stelle': 5, 'visite': 33,
             'recensione': 'Preciso e affidabile. Impianto perfetto.', 'cliente': 'Matteo G.'},
            {'id': 10, 'titolo': 'Punti Luce e Prese Aggiuntivi',
             'descrizione': 'Aggiunta punti presa e luce in soggiorno. Passaggio cavi sotto traccia.',
             'citta': 'Roma', 'quartiere': 'Trastevere', 'stelle': 5, 'visite': 28,
             'recensione': 'Lavoro ben fatto, zona rimasta pulita.', 'cliente': 'Anna V.'},
        ]
    },
    'esposito-giovanni': {
        'id': 'esposito-giovanni',
        'nome': 'Esposito Giovanni',
        'categoria': 'Imbianchino',
        'cat_slug': 'imbianchino',
        'citta': 'Roma',
        'stelle': 4.9,
        'recensioni': 28,
        'telefono': '+39 339 111 2233',
        'lavori': [
            {'id': 11, 'titolo': 'Tinteggiatura Appartamento 90mq',
             'descrizione': 'Tinteggiatura completa 90mq: preparazione pareti, stucco, primer e due mani pittura lavabile.',
             'citta': 'Roma', 'quartiere': 'Parioli', 'stelle': 5, 'visite': 55,
             'recensione': 'Lavoro perfetto, casa come nuova. Consigliatissimo!', 'cliente': 'Claudia M.'},
            {'id': 12, 'titolo': 'Stucco Veneziano Camera da Letto',
             'descrizione': 'Applicazione stucco veneziano a due strati con finitura a cera e lucidatura.',
             'citta': 'Roma', 'quartiere': 'Testaccio', 'stelle': 5, 'visite': 38,
             'recensione': 'Risultato bellissimo, artigiano vero.', 'cliente': 'Lorenzo P.'},
        ]
    },
    'russo-stefano': {
        'id': 'russo-stefano',
        'nome': 'Russo Stefano',
        'categoria': 'Muratore',
        'cat_slug': 'muratore',
        'citta': 'Milano',
        'stelle': 4.8,
        'recensioni': 19,
        'telefono': '+39 340 555 6677',
        'lavori': [
            {'id': 13, 'titolo': 'Posa Pavimento Gres 60x60',
             'descrizione': 'Posa 55mq gres porcellanato su massetto autolivellante. Fughe con stuccatura epossidica.',
             'citta': 'Milano', 'quartiere': 'Niguarda', 'stelle': 5, 'visite': 31,
             'recensione': 'Posa perfetta, pavimento bellissimo.', 'cliente': 'Elena C.'},
            {'id': 14, 'titolo': 'Demolizione Parete e Cartongesso',
             'descrizione': 'Abbattimento parete non portante, nuova parete in cartongesso con isolamento acustico.',
             'citta': 'Milano', 'quartiere': 'Bicocca', 'stelle': 5, 'visite': 25,
             'recensione': 'Lavoro pulito e veloce. Molto professionale.', 'cliente': 'Marco L.'},
        ]
    },
    'de-luca-piero': {
        'id': 'de-luca-piero',
        'nome': 'De Luca Piero',
        'categoria': 'Idraulico',
        'cat_slug': 'idraulica',
        'citta': 'Roma',
        'stelle': 4.9,
        'recensioni': 21,
        'telefono': '+39 333 444 5566',
        'lavori': [
            {'id': 15, 'titolo': 'Rifacimento Impianto Idrico',
             'descrizione': 'Rifacimento completo impianto idrico appartamento 70mq. Tubi in multistrato, collaudo incluso.',
             'citta': 'Roma', 'quartiere': 'Prati', 'stelle': 5, 'visite': 43,
             'recensione': 'Lavoro eccellente, nessun problema. Molto raccomandato.', 'cliente': 'Simone D.'},
            {'id': 16, 'titolo': 'Sostituzione Caldaia Murale',
             'descrizione': 'Sostituzione caldaia murale con modello a condensazione classe A+ con cronotermostato Wi-Fi.',
             'citta': 'Roma', 'quartiere': 'Flaminio', 'stelle': 5, 'visite': 37,
             'recensione': 'Veloce, preciso, prezzi onesti. Lo riconfermerò.', 'cliente': 'Valentina R.'},
        ]
    },
}

# Esempi di lavori per categoria (per suggerimenti al momento dell'inserimento)
ESEMPI_PER_CATEGORIA = {
    'Idraulica': [
        {'titolo': 'Sostituzione Caldaia a Condensazione', 'descrizione': 'Sostituzione caldaia murale con modello a condensazione classe A. Collaudo e certificazione inclusi.'},
        {'titolo': 'Rifacimento Bagno Completo', 'descrizione': 'Ristrutturazione bagno: demolizione, nuovi sanitari sospesi, box doccia, piastrelle e rubinetteria.'},
        {'titolo': 'Riparazione Perdita Urgente', 'descrizione': 'Intervento rapido per perdita d\'acqua da tubo sotto traccia. Riparazione definitiva in giornata.'},
        {'titolo': 'Installazione Termosifoni', 'descrizione': 'Installazione radiatori in alluminio con valvole termostatiche e bilanciamento impianto.'},
        {'titolo': 'Scarico Intasato Cucina', 'descrizione': 'Disintasamento colonna scarico cucina e sostituzione sifone. Intervento rapido con idropulitrice.'},
        {'titolo': 'Sostituzione Rubinetteria Bagno', 'descrizione': 'Sostituzione completa miscelatori bagno e cucina con modelli a risparmio idrico certificati.'},
        {'titolo': 'Impianto Idrico Ristrutturazione', 'descrizione': 'Rifacimento completo impianto idrico per appartamento in ristrutturazione. Tubi in multistrato.'},
        {'titolo': 'Installazione Scalda Acqua', 'descrizione': 'Installazione boiler elettrico 80L con valvola di sicurezza e collaudo. Smaltimento vecchio.'},
        {'titolo': 'Riparazione WC che Perde', 'descrizione': 'Sostituzione meccanismo interno cassetta WC e guarnizioni. Risolto in meno di un\'ora.'},
        {'titolo': 'Allaccio Lavatrice e Lavastoviglie', 'descrizione': 'Allaccio idraulico lavatrice e lavastoviglie con rubinetti di arresto e scarico dedicato.'},
    ],
    'Elettricista': [
        {'titolo': 'Impianto Elettrico Appartamento', 'descrizione': 'Rifacimento completo impianto elettrico con quadro moderno differenziali e prese a norma CEI 64-8.'},
        {'titolo': 'Installazione Impianto Fotovoltaico', 'descrizione': 'Installazione 6kWp con inverter ibrido, sistema di accumulo e monitoraggio da app.'},
        {'titolo': 'Installazione Climatizzatore', 'descrizione': 'Installazione split dual inverter con gas R32, foratura muro e collaudo con gas ecologico.'},
        {'titolo': 'Sostituzione Quadro Elettrico', 'descrizione': 'Sostituzione quadro obsoleto con nuovo centralino con differenziali e salvavita separati per zona.'},
        {'titolo': 'Punti Luce e Prese Aggiuntivi', 'descrizione': 'Aggiunta punti presa e luce in soggiorno e cucina. Passaggio cavi sotto traccia, intonaco incluso.'},
        {'titolo': 'Impianto Domotica', 'descrizione': 'Installazione sistema domotico per controllo luci, tapparelle e riscaldamento da smartphone.'},
        {'titolo': 'Videocitofono e Campanello', 'descrizione': 'Sostituzione videocitofono con modello Wi-Fi con telecamera HD e sblocco da remoto.'},
        {'titolo': 'Colonnina Ricarica Auto Elettrica', 'descrizione': 'Installazione wallbox 11kW in garage con linea dedicata da quadro, certificazione MISE.'},
        {'titolo': 'Riparazione Guasto Elettrico Urgente', 'descrizione': 'Diagnosi e riparazione guasto impianto elettrico. Intervento entro 2 ore, disponibile H24.'},
        {'titolo': 'Impianto Illuminazione Esterna', 'descrizione': 'Installazione luci da giardino con cavi interrati, faretto LED e sensore crepuscolare.'},
    ],
    'Imbianchino': [
        {'titolo': 'Tinteggiatura Appartamento Completo', 'descrizione': 'Tinteggiatura 80mq: preparazione pareti, stucco, primer e due mani di pittura lavabile traspirante.'},
        {'titolo': 'Rifacimento Intonaco Facciata', 'descrizione': 'Rasatura e tinteggiatura facciata esterna 200mq con pittura silossanica idrorepellente.'},
        {'titolo': 'Verniciatura Infissi e Porte', 'descrizione': 'Levigatura, stuccatura e verniciatura porte interne e infissi in legno con prodotti a base acqua.'},
        {'titolo': 'Carta da Parati Design', 'descrizione': 'Posa carta da parati in camera da letto con trattamento muri e levigatura. Precisione millimetrica.'},
        {'titolo': 'Rasatura al Civile', 'descrizione': 'Rasatura fine su tutta la superficie dell\'appartamento per finitura liscia a specchio.'},
        {'titolo': 'Tinteggiatura Garage e Cantina', 'descrizione': 'Tinteggiatura pareti garage con pittura antimuffa e pavimento con smalto epossidico grigio.'},
        {'titolo': 'Rifacimento Soffitto in Cartongesso', 'descrizione': 'Posa controsoffitto in cartongesso con incasso faretti LED e isolamento acustico.'},
        {'titolo': 'Stucco Veneziano', 'descrizione': 'Applicazione stucco veneziano a due strati con effetto marmo. Finitura a cera e lucidatura.'},
    ],
    'Muratore': [
        {'titolo': 'Demolizione Parete Divisoria', 'descrizione': 'Abbattimento parete non portante, sgombero macerie, intonacatura e tinteggiatura bordi.'},
        {'titolo': 'Posa Pavimento Gres Porcellanato', 'descrizione': 'Posa 60mq gres grande formato 120x60 su massetto autolivellante. Fughe con stuccatura epossidica.'},
        {'titolo': 'Costruzione Muro di Contenimento', 'descrizione': 'Costruzione muro in mattoni pieni 25cm con fondamenta, intonaco e trattamento impermeabilizzante.'},
        {'titolo': 'Rifacimento Massetto', 'descrizione': 'Demolizione pavimento esistente, nuovo massetto alleggerito con impianto radiante e livellatura.'},
        {'titolo': 'Riparazione Crepe e Intonaco', 'descrizione': 'Ripristino crepe strutturali con resine epossidiche, stuccatura e rifacimento intonaco a tre strati.'},
        {'titolo': 'Costruzione Barbecue in Muratura', 'descrizione': 'Realizzazione barbecue in mattoni refrattari con piano cottura in pietra lavica e piano d\'appoggio.'},
        {'titolo': 'Impermeabilizzazione Terrazzo', 'descrizione': 'Rifacimento impermeabilizzazione terrazza con guaina ardesiata e nuovo pavimento in gres.'},
        {'titolo': 'Posa Piastrelle Bagno', 'descrizione': 'Posa rivestimento bagno 5mq con piastrelle grande formato, nicchie e bordi in acciaio satinato.'},
    ],
    'Falegname': [
        {'titolo': 'Cucina su Misura', 'descrizione': 'Progettazione e realizzazione cucina in rovere naturale con top in quarzo. Montaggio e assistenza post-vendita.'},
        {'titolo': 'Armadio a Muro con Ante Scorrevoli', 'descrizione': 'Armadio su misura con ante in vetro acidato, interni organizzati e illuminazione LED interna.'},
        {'titolo': 'Sostituzione Porte Interne', 'descrizione': 'Fornitura e posa porte interne in laminato rovere grigio con maniglie in acciaio. Compreso telaio.'},
        {'titolo': 'Pavimento in Parquet', 'descrizione': 'Posa 50mq parquet prefinito rovere spazzolato 14mm con battiscopa abbinato. Flottante su schiuma.'},
        {'titolo': 'Pergola in Legno di Pino', 'descrizione': 'Realizzazione pergola 4x5m in legno di pino impregnato con copertura in policarbonato ondulato.'},
        {'titolo': 'Libreria a Muro su Misura', 'descrizione': 'Libreria in multistrato laccato bianco con scala scorrevole su binario. Illuminazione LED integrata.'},
        {'titolo': 'Restauro Mobili Antichi', 'descrizione': 'Restauro tavolo e sedie antichi: smontaggio, trattamento tarli, riverniciatura a cera e rigenerazione.'},
        {'titolo': 'Infissi in Legno Doppio Vetro', 'descrizione': 'Sostituzione infissi con telaio in legno di meranti verniciato e vetrocamera basso emissivo 4-16-4.'},
    ],
    'Altro': [
        {'titolo': 'Montaggio Mobili IKEA', 'descrizione': 'Montaggio e assemblaggio mobili con attrezzatura professionale. Nessun graffioo sui pavimenti.'},
        {'titolo': 'Trasloco e Facchinaggio', 'descrizione': 'Trasloco appartamento con protezione mobili, smontaggio e rimontaggio. Furgone incluso.'},
        {'titolo': 'Installazione Condizionatore', 'descrizione': 'Installazione split con ricerca guasti, ricarica gas e certificazione F-GAS.'},
        {'titolo': 'Pulizia Straordinaria Appartamento', 'descrizione': 'Pulizia profonda post-cantiere o fine locazione. Prodotti professionali, risultato garantito.'},
        {'titolo': 'Manutenzione Giardino', 'descrizione': 'Taglio erba, potatura siepi, pulizia foglie e trattamento antiparassitario piante.'},
        {'titolo': 'Riparazione Elettrodomestici', 'descrizione': 'Diagnosi e riparazione lavatrice, lavastoviglie, frigorifero. Ricambi originali, garanzia 12 mesi.'},
    ]
}


def build_jobs_index():
    """Costruisce un indice di tutti i lavori pubblicati dagli artigiani."""
    jobs = []
    for art in ARTIGIANI.values():
        for lavoro in art['lavori']:
            jobs.append({**lavoro, 'artigiano': art})
    return jobs


def jobs_by_category_city(jobs, cat_slug=None, citta_slug=None, quart_slug=None):
    """Filtra i lavori per categoria e/o città e/o quartiere."""
    result = []
    for j in jobs:
        art = j['artigiano']
        if cat_slug and art.get('cat_slug') != cat_slug:
            continue
        if citta_slug and slugify(j.get('citta', '')) != citta_slug:
            continue
        if quart_slug and slugify(j.get('quartiere', '')) != quart_slug:
            continue
        result.append(j)
    return result


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/scheda/<artigiano_id>')
def scheda(artigiano_id):
    artigiano = ARTIGIANI.get(artigiano_id)
    if not artigiano:
        return "Scheda non trovata", 404
    return render_template('scheda.html', artigiano=artigiano)


@app.route('/artigiano/<artigiano_id>/inserisci')
def inserisci_lavoro(artigiano_id):
    artigiano = ARTIGIANI.get(artigiano_id)
    if not artigiano:
        return "Artigiano non trovato", 404
    return render_template('inserisci_lavoro.html', artigiano=artigiano)


@app.route('/api/esempi/<categoria>')
def esempi_categoria(categoria):
    esempi = ESEMPI_PER_CATEGORIA.get(categoria, ESEMPI_PER_CATEGORIA['Altro'])
    return jsonify(esempi)


@app.route('/api/lavoro/salva', methods=['POST'])
def salva_lavoro():
    data = request.get_json()
    # In futuro: salva nel database
    return jsonify({'success': True, 'message': 'Lavoro salvato con successo'})


@app.route('/<categoria_slug>')
def pagina_categoria(categoria_slug):
    """Directory per categoria: /idraulica, /elettricista …"""
    cat = CATEGORIE.get(categoria_slug)
    if not cat:
        return "Categoria non trovata", 404

    tutti_jobs = build_jobs_index()
    jobs = jobs_by_category_city(tutti_jobs, cat_slug=categoria_slug)

    # Aggrega per città
    citta_count = defaultdict(int)
    for j in jobs:
        citta_count[j.get('citta', '')] += 1
    citta_list = sorted(citta_count.items(), key=lambda x: -x[1])

    # Artigiani distinti
    artigiani_cat = [a for a in ARTIGIANI.values() if a.get('cat_slug') == categoria_slug]

    return render_template('pagina_categoria.html',
        cat=cat, categoria_slug=categoria_slug,
        jobs=jobs, citta_list=citta_list,
        artigiani=artigiani_cat, slugify=slugify)


@app.route('/<categoria_slug>/<citta_slug>')
def pagina_citta(categoria_slug, citta_slug):
    """Directory per città: /idraulica/milano, /elettricista/roma …"""
    cat = CATEGORIE.get(categoria_slug)
    if not cat:
        return "Categoria non trovata", 404

    tutti_jobs = build_jobs_index()
    jobs = jobs_by_category_city(tutti_jobs, cat_slug=categoria_slug, citta_slug=citta_slug)

    # Aggrega per quartiere
    quart_count = defaultdict(int)
    for j in jobs:
        if j.get('quartiere'):
            quart_count[j['quartiere']] += 1
    quart_list = sorted(quart_count.items(), key=lambda x: -x[1])

    # Nome città leggibile dallo slug
    citta_nome = citta_slug.replace('-', ' ').title()

    artigiani_citta = [a for a in ARTIGIANI.values()
                       if a.get('cat_slug') == categoria_slug
                       and slugify(a.get('citta', '')) == citta_slug]

    return render_template('pagina_citta.html',
        cat=cat, categoria_slug=categoria_slug,
        citta_slug=citta_slug, citta_nome=citta_nome,
        jobs=jobs, quart_list=quart_list,
        artigiani=artigiani_citta, slugify=slugify)


@app.route('/<categoria_slug>/<titolo_slug>/<loc_slug>')
def pagina_lavoro(categoria_slug, titolo_slug, loc_slug):
    """Pagina pubblica indicizzabile da Google.
    Struttura: /categoria/titolo-lavoro/citta-quartiere
    Esempio:   /idraulica/installazione-caldaia/milano-navigli
    """
    # Cerca tra tutti gli artigiani quello con lavori corrispondenti
    artigiano_trovato = None
    lavoro_trovato = None

    for art in ARTIGIANI.values():
        for l in art['lavori']:
            if (slugify(l['titolo']).startswith(titolo_slug[:8]) or
                    titolo_slug[:8] in slugify(l['titolo'])):
                artigiano_trovato = art
                lavoro_trovato = l
                break
        if artigiano_trovato:
            break

    # Fallback: primo artigiano disponibile
    if not artigiano_trovato:
        artigiano_trovato = next(iter(ARTIGIANI.values()))
        lavoro_trovato = artigiano_trovato['lavori'][0] if artigiano_trovato['lavori'] else None

    titolo_seo   = titolo_slug.replace('-', ' ').title()
    cat_seo      = categoria_slug.replace('-', ' ').title()
    loc_seo      = loc_slug.replace('-', ' ').title()

    return render_template(
        'pagina_lavoro.html',
        artigiano=artigiano_trovato,
        lavoro=lavoro_trovato,
        titolo_seo=titolo_seo,
        cat_seo=cat_seo,
        loc_seo=loc_seo,
        categoria_slug=categoria_slug,
        titolo_slug=titolo_slug,
        loc_slug=loc_slug,
        artigiano_slug=artigiano_trovato['id']
    )


@app.route('/manifest.json')
def manifest():
    return jsonify({
        "name": "StelleVere",
        "short_name": "StelleVere",
        "description": "La tua scheda artigiano",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#111111",
        "theme_color": "#f5c842",
        "icons": [
            {"src": "/static/icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/static/icons/icon-512.png", "sizes": "512x512", "type": "image/png"}
        ]
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
