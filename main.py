from flask import Flask, render_template, send_from_directory, jsonify, request
import os
import json

app = Flask(__name__, static_folder='static', template_folder='templates')

# Dati di esempio artigiani (in futuro verranno dal database)
ARTIGIANI = {
    'fossati-antonio': {
        'id': 'fossati-antonio',
        'nome': 'Fossati Antonio',
        'categoria': 'Idraulico',
        'citta': 'Milano',
        'emoji': '🔧',
        'stelle': 5.0,
        'recensioni': 23,
        'telefono': '+39 333 123 4567',
        'lavori': [
            {
                'id': 1,
                'titolo': 'Sostituzione Caldaia Condominiale',
                'descrizione': 'Sostituzione completa caldaia condominiale da 80kW con modello ad alta efficienza. Lavoro eseguito in 2 giorni, compreso smaltimento vecchia caldaia e collaudo impianto.',
                'categoria': 'Caldaia',
                'emoji': '🔧',
                'citta': 'Milano',
                'quartiere': 'Porta Venezia',
                'stelle': 5,
                'visite': 38,
                'recensione': 'Caldaia sostituita in 2 giorni. Preciso, pulito, puntuale.',
                'cliente': 'Luca C.',
            },
            {
                'id': 2,
                'titolo': 'Rifacimento Bagno Completo',
                'descrizione': 'Rifacimento completo del bagno: demolizione pavimento e rivestimenti, nuova posa piastrelle, installazione sanitari e rubinetteria, impianto idraulico.',
                'categoria': 'Bagno',
                'emoji': '🚿',
                'citta': 'Milano',
                'quartiere': 'Navigli',
                'stelle': 5,
                'visite': 52,
                'recensione': 'Bagno rifatto in una settimana, tutto perfetto. Prezzo onesto.',
                'cliente': 'Maria R.',
            },
            {
                'id': 3,
                'titolo': 'Perdita Urgente H24',
                'descrizione': 'Intervento di emergenza per perdita d\'acqua notturna. Riparazione tubazione rotta sotto pavimento con minima demolizione. Disponibile 7 giorni su 7.',
                'categoria': 'Urgenza',
                'emoji': '💧',
                'citta': 'Milano',
                'quartiere': 'Città Studi',
                'stelle': 5,
                'visite': 29,
                'recensione': 'Perdita di notte risolta in un\'ora. Disponibile H24, professionista vero.',
                'cliente': 'Giorgio P.',
            },
            {
                'id': 4,
                'titolo': 'Impianto Termosifoni',
                'descrizione': 'Installazione nuovo impianto di riscaldamento con termosifoni in alluminio. Progettazione, fornitura e posa completa con bilanciamento dell\'impianto.',
                'categoria': 'Impianto',
                'emoji': '🌡️',
                'citta': 'Milano',
                'quartiere': 'Brera',
                'stelle': 5,
                'visite': 41,
                'recensione': 'Impianto realizzato a regola d\'arte. Consigliatissimo!',
                'cliente': 'Sara M.',
            },
        ]
    }
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


@app.route('/<categoria_slug>/<titolo_slug>/<loc_slug>')
def pagina_lavoro(categoria_slug, titolo_slug, loc_slug):
    """Pagina pubblica indicizzabile da Google.
    Struttura: /categoria/titolo-lavoro/citta-quartiere
    Esempio:   /idraulica/installazione-caldaia/milano-navigli
    """
    import re
    import unicodedata

    def slugify(s):
        s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode()
        s = re.sub(r'[^a-z0-9\s-]', '', s.lower())
        return re.sub(r'[\s-]+', '-', s).strip('-')

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
