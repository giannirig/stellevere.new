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
        {'titolo': 'Sostituzione Caldaia', 'descrizione': 'Sostituzione caldaia con modello ad alta efficienza energetica. Comprensivo di collaudo e certificazione.', 'quartiere': 'Centro'},
        {'titolo': 'Rifacimento Bagno', 'descrizione': 'Ristrutturazione completa del bagno con nuovi sanitari, rubinetteria e piastrelle.', 'quartiere': 'Zona residenziale'},
        {'titolo': 'Riparazione Perdita Urgente', 'descrizione': 'Intervento urgente per perdita d\'acqua. Riparazione rapida e definitiva.', 'quartiere': ''},
    ],
    'Elettricista': [
        {'titolo': 'Impianto Elettrico Appartamento', 'descrizione': 'Rifacimento completo impianto elettrico con quadro moderno, prese e interruttori nuovi. Certificazione a norma CEI.', 'quartiere': ''},
        {'titolo': 'Installazione Fotovoltaico', 'descrizione': 'Installazione pannelli fotovoltaici con inverter e sistema di monitoraggio.', 'quartiere': ''},
    ],
    'Imbianchino': [
        {'titolo': 'Tinteggiatura Appartamento Completo', 'descrizione': 'Tinteggiatura completa di appartamento 80mq. Preparazione pareti, stucco, due mani di pittura lavabile.', 'quartiere': ''},
        {'titolo': 'Rifacimento Intonaco Esterno', 'descrizione': 'Rasatura e tinteggiatura facciata esterna condominiale con colori coordinati.', 'quartiere': ''},
    ],
    'Muratore': [
        {'titolo': 'Demolizione e Ricostruzione Muro', 'descrizione': 'Demolizione parete divisoria non portante e ricostruzione con cartongesso. Intonacatura e finitura.', 'quartiere': ''},
        {'titolo': 'Posa Pavimento', 'descrizione': 'Posa pavimento in gres porcellanato su massetto esistente. Taglio e finitura angoli.', 'quartiere': ''},
    ],
    'Falegname': [
        {'titolo': 'Cucina su Misura', 'descrizione': 'Progettazione e realizzazione cucina su misura in legno massello. Montaggio e finitura inclusi.', 'quartiere': ''},
        {'titolo': 'Armadio a Muro', 'descrizione': 'Realizzazione armadio a muro con ante scorrevoli e organizzazione interna personalizzata.', 'quartiere': ''},
    ],
    'Altro': [
        {'titolo': 'Lavoro di manutenzione', 'descrizione': 'Descrivi qui il lavoro svolto con dettagli su materiali usati e risultato finale.', 'quartiere': ''},
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
