// Configurazione di DataTables
let table;
let currentItemId = null;
let editMode = false;
let isSaving = false; // Flag to prevent multiple simultaneous save requests

// Inizializzazione al caricamento del documento
document.addEventListener('DOMContentLoaded', function() {
    // Inizializzazione DataTables
    table = $('#inventoryTable').DataTable({
        responsive: false,
        scrollX: true,
        scrollCollapse: true,
        language: {
            url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/it-IT.json'
        },
        colReorder: false,
        autoWidth: false,
        pageLength: 100, // Mostra 100 righe per pagina
        lengthMenu: [[50, 100, 250, -1], [50, 100, 250, "Tutti"]], // Opzioni per il numero di righe
        columns: [
            { data: 'codiceArticolo', name: 'codiceArticolo', className: 'editable', width: '150px' },
            { data: 'oggetto', name: 'oggetto', className: 'editable', width: '200px' },
            { data: 'descrizione', name: 'descrizione', className: 'editable', width: '250px' },
            { data: 'fornitore', name: 'fornitore', className: 'editable', width: '150px' },
            { data: 'quantita', name: 'quantita', className: 'editable', width: '100px' },
            { data: 'stanza', name: 'stanza', className: 'editable', width: '120px' },
            { data: 'zona', name: 'zona', className: 'editable', width: '100px' },
            { data: 'ripiano', name: 'ripiano', className: 'editable', width: '100px' },
            { data: 'scatola', name: 'scatola', className: 'editable', width: '120px' },
            { data: 'tipologia', name: 'tipologia', className: 'editable', width: '150px' },
            { 
                data: 'dataIngresso',
                name: 'dataIngresso', 
                className: 'editable', 
                width: '120px',
                render: function(data) {
                    return data || 'N.A.';
                }
            },
            { 
                data: 'dataModifica',
                name: 'dataModifica',
                width: '120px',
                render: function(data) {
                    return data || 'N.A.';
                }
            },
            { 
                data: 'operatore',
                name: 'operatore',
                width: '120px',
                render: function(data) {
                    return data || 'N.A.';
                }
            },
            {
                data: null,
                orderable: false,
                searchable: false,
                width: '100px',
                render: function(data, type, row) {
                    return `
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-primary me-1 edit-btn" ${!editMode ? 'disabled' : ''}>
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger delete-btn" ${!editMode ? 'disabled' : ''}>
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                }
            }
        ],
        dom: 'Blfrtip', // Aggiungo 'l' per mostrare il menu di selezione delle righe per pagina
        buttons: [
            {
                extend: 'csv',
                text: '<i class="fas fa-file-export"></i> Esporta TSV',
                className: 'btn btn-secondary',
                fieldSeparator: '\t',
                extension: '.txt',
                exportOptions: {
                    columns: ':not(:last-child)'
                }
            }
        ]
    });

    // Gestione del ridimensionamento delle colonne
    let isResizing = false;
    let currentTh = null;
    let startX = 0;
    let startWidth = 0;

    $('#inventoryTable thead th').each(function() {
        $(this).css('position', 'relative').append('<div class="column-resizer"></div>');
    });

    $(document).on('mousedown', '.column-resizer', function(e) {
        isResizing = true;
        currentTh = $(this).parent();
        startX = e.pageX;
        startWidth = currentTh.width();
        $(this).addClass('resizing');
        e.preventDefault();
    });

    $(document).on('mousemove', function(e) {
        if (!isResizing) return;
        
        const width = startWidth + (e.pageX - startX);
        if (width > 50) {
            currentTh.width(width);
            table.columns.adjust();
        }
    });

    $(document).on('mouseup', function() {
        if (isResizing) {
            $('.column-resizer').removeClass('resizing');
            isResizing = false;
            currentTh = null;
        }
    });

    // Gestione modifica inline delle celle
    $('#inventoryTable').on('click', 'td.editable', function() {
        if (!editMode) return;
        
        const cell = table.cell(this);
        const data = cell.data();
        const isDate = $(this).index() === 10; // Indice della colonna Data Ingresso
        
        if ($(this).find('input, select').length > 0) return;

        const currentContent = data === 'N.A.' ? '' : data;
        let input;
        
        if (isDate) {
            input = $('<input type="text" class="form-control form-control-sm">');
            input.val(currentContent);
            flatpickr(input[0], {
                locale: 'it',
                dateFormat: 'd/m/Y',
                defaultDate: currentContent
            });
        } else if ($(this).index() === 4) { // Indice della colonna Quantità
            input = $('<input type="number" class="form-control form-control-sm" min="0">');
            input.val(currentContent);
        } else {
            input = $('<input type="text" class="form-control form-control-sm">');
            input.val(currentContent);
        }

        $(this).html(input);
        input.focus();

        // Gestione del salvataggio
        input.on('blur', function() {
            let newValue = $(this).val().trim() || 'N.A.';
            const row = table.row(cell.index().row);
            const rowData = row.data();
            
            // Aggiorna il valore nella cella
            cell.data(newValue);
            
            // Aggiorna la data di modifica
            rowData.dataModifica = new Date().toLocaleDateString('it-IT');
            row.data(rowData);
            
            // Salva i dati
            saveInventoryData();
            updateFilters();
        });

        // Gestione del tasto Invio
        input.on('keypress', function(e) {
            if (e.which === 13) {
                $(this).blur();
            }
        });
    });

    // Inizializzazione Flatpickr per i datepicker
    flatpickr('#filterData', {
        locale: 'it',
        dateFormat: 'd/m/Y'
    });

    flatpickr('input[name="dataIngresso"]', {
        locale: 'it',
        dateFormat: 'd/m/Y'
    });

    // Caricamento dati iniziali dal server
    loadInventoryData();
    updateFilters();

    // Event listeners
    setupEventListeners();

    // Aggiunta del ridimensionamento delle colonne
    $('#inventoryTable thead th').each(function() {
        const th = $(this);
        const resizer = $('<div class="column-resizer"></div>');
        th.append(resizer);

        let startX, startWidth;

        resizer.on('mousedown', function(e) {
            startX = e.pageX;
            startWidth = th.width();
            
            $(document).on('mousemove.resize', function(e) {
                const width = startWidth + (e.pageX - startX);
                if (width > 50) {
                    th.width(width);
                }
            });

            $(document).on('mouseup.resize', function() {
                $(document).off('.resize');
            });
        });
    });

    // Aggiunta della classe per la modalità di modifica
    document.getElementById('toggleEdit').addEventListener('click', function() {
        editMode = !editMode;
        this.innerHTML = editMode ? 
            '<i class="fas fa-lock-open"></i> Disabilita Modifica' : 
            '<i class="fas fa-edit"></i> Abilita Modifica';
        this.classList.toggle('btn-warning');
        this.classList.toggle('btn-danger');
        
        // Aggiorna i pulsanti nella tabella
        $('.edit-btn, .delete-btn').prop('disabled', !editMode);
        
        // Abilita/disabilita il pulsante Aggiungi Articolo
        document.getElementById('addNewItem').disabled = !editMode;
        
        // Quando si disabilita la modalità di modifica, salva i dati sul server
        if (!editMode) {
            saveInventoryData();
        }
    });

    // Gestione dello zoom
    let currentZoomLevel = 3; // Livello di zoom predefinito (1 = più piccolo, 5 = più grande)
    const tableContainer = $('.table-responsive');
    
    function updateZoom() {
        tableContainer.removeClass('zoom-level-1 zoom-level-2 zoom-level-3 zoom-level-4 zoom-level-5')
                     .addClass(`zoom-level-${currentZoomLevel}`);
        
        // Definisci le larghezze delle colonne per ogni livello di zoom
        const columnWidths = {
            1: { // Zoom minimo
                codiceArticolo: '100px',
                oggetto: '150px',
                descrizione: '200px',
                fornitore: '100px',
                quantita: '80px',
                stanza: '80px',
                zona: '70px',
                ripiano: '70px',
                scatola: '80px',
                tipologia: '100px',
                dataIngresso: '90px',
                dataModifica: '90px',
                operatore: '90px',
                azioni: '80px'
            },
            3: { // Zoom normale
                codiceArticolo: '150px',
                oggetto: '200px',
                descrizione: '250px',
                fornitore: '150px',
                quantita: '100px',
                stanza: '120px',
                zona: '100px',
                ripiano: '100px',
                scatola: '120px',
                tipologia: '150px',
                dataIngresso: '120px',
                dataModifica: '120px',
                operatore: '120px',
                azioni: '100px'
            },
            5: { // Zoom massimo
                codiceArticolo: '200px',
                oggetto: '250px',
                descrizione: '300px',
                fornitore: '200px',
                quantita: '120px',
                stanza: '150px',
                zona: '120px',
                ripiano: '120px',
                scatola: '150px',
                tipologia: '200px',
                dataIngresso: '150px',
                dataModifica: '150px',
                operatore: '150px',
                azioni: '120px'
            }
        };

        // Calcola le larghezze intermedie per i livelli 2 e 4
        const interpolateWidths = (level) => {
            const widths = {};
            const lowerLevel = level < 3 ? 1 : 3;
            const upperLevel = level < 3 ? 3 : 5;
            const factor = level < 3 ? (level - 1) / 2 : (level - 3) / 2;

            Object.keys(columnWidths[lowerLevel]).forEach(key => {
                const lowerWidth = parseInt(columnWidths[lowerLevel][key]);
                const upperWidth = parseInt(columnWidths[upperLevel][key]);
                const interpolatedWidth = lowerWidth + (upperWidth - lowerWidth) * factor;
                widths[key] = `${Math.round(interpolatedWidth)}px`;
            });

            return widths;
        };

        // Ottieni le larghezze appropriate per il livello di zoom corrente
        const widths = currentZoomLevel === 1 ? columnWidths[1] :
                      currentZoomLevel === 3 ? columnWidths[3] :
                      currentZoomLevel === 5 ? columnWidths[5] :
                      interpolateWidths(currentZoomLevel);

        // Applica le larghezze alle colonne
        table.columns().every(function(index) {
            const column = this;
            const columnName = Object.keys(columnWidths[3])[index];
            if (columnName) {
                $(column.header()).css('width', widths[columnName]);
            }
        });

        // Aggiusta le colonne e ridisegna la tabella
        table.columns.adjust().draw();
    }

    $('#zoomIn').on('click', function() {
        if (currentZoomLevel < 5) {
            currentZoomLevel++;
            updateZoom();
        }
    });

    $('#zoomOut').on('click', function() {
        if (currentZoomLevel > 1) {
            currentZoomLevel--;
            updateZoom();
        }
    });

    $('#zoomReset').on('click', function() {
        currentZoomLevel = 3;
        updateZoom();
    });

    // Imposta lo zoom iniziale
    updateZoom();
});

// Funzione per caricare i dati dal server
function loadInventoryData() {
    // Mostra un indicatore di caricamento
    const loadingIndicator = $('<div class="text-center my-3"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Caricamento...</span></div><p>Caricamento dati in corso...</p></div>');
    $('#inventoryTable_wrapper').before(loadingIndicator);
    
    // Richiesta AJAX al server
    fetch('/api/inventory')
        .then(response => {
            if (!response.ok) {
                throw new Error('Errore nel caricamento dei dati: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            // Rimuovi l'indicatore di caricamento
            loadingIndicator.remove();
            
            // Verifica che i dati siano validi
            if (data && data.items && Array.isArray(data.items)) {
                table.clear().rows.add(data.items).draw();
                console.log('Dati caricati dal server:', data.items.length, 'articoli');
            } else {
                console.error('Formato dati non valido:', data);
                table.clear().draw();
            }
        })
        .catch(error => {
            // Rimuovi l'indicatore di caricamento
            loadingIndicator.remove();
            
            console.error('Errore nel caricamento dei dati:', error);
            
            // Mostra un messaggio di errore
            const errorMsg = $(`<div class="alert alert-danger alert-dismissible fade show" role="alert">
                <strong>Errore!</strong> Impossibile caricare i dati dal server: ${error.message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>`);
            $('#inventoryTable_wrapper').before(errorMsg);
            
            // Pulisci la tabella
            table.clear().draw();
        });
}

// Funzione per salvare i dati sul server
function saveInventoryData() {
    // Evita richieste multiple simultanee
    if (isSaving) return;
    isSaving = true;
    
    // Prepara i dati
    const items = table.data().toArray();
    const data = { items: items };
    
    // Mostra un indicatore di salvataggio
    const savingToast = $(`<div class="toast position-fixed bottom-0 end-0 m-3" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header">
            <strong class="me-auto">Salvataggio</strong>
            <small>In corso...</small>
        </div>
        <div class="toast-body">
            <div class="d-flex align-items-center">
                <div class="spinner-border spinner-border-sm me-2" role="status">
                    <span class="visually-hidden">Salvataggio...</span>
                </div>
                <span>Salvataggio dei dati in corso...</span>
            </div>
        </div>
    </div>`);
    $('body').append(savingToast);
    const toastInstance = new bootstrap.Toast(savingToast[0], { autohide: false });
    toastInstance.show();
    
    // Richiesta AJAX al server
    fetch('/api/inventory', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Errore nel salvataggio dei dati: ' + response.statusText);
        }
        return response.json();
    })
    .then(result => {
        // Aggiorna il toast con il risultato
        savingToast.find('.toast-header small').text('Completato');
        savingToast.find('.toast-body').html('<i class="fas fa-check-circle text-success me-2"></i> Dati salvati correttamente');
        
        // Chiudi il toast dopo 2 secondi
        setTimeout(() => {
            toastInstance.hide();
            setTimeout(() => savingToast.remove(), 500);
        }, 2000);
        
        console.log('Dati salvati con successo:', result);
    })
    .catch(error => {
        // Mostra l'errore nel toast
        savingToast.find('.toast-header small').text('Errore');
        savingToast.find('.toast-body').html(`<i class="fas fa-exclamation-circle text-danger me-2"></i> Errore: ${error.message}`);
        
        // Chiudi il toast dopo 5 secondi
        setTimeout(() => {
            toastInstance.hide();
            setTimeout(() => savingToast.remove(), 500);
        }, 5000);
        
        console.error('Errore nel salvataggio dei dati:', error);
    })
    .finally(() => {
        isSaving = false;
    });
}

// Funzione per aggiornare i filtri dropdown
function updateFilters() {
    const data = table.data().toArray();
    
    // Aggiorna filtro Tipologia
    const tipologie = [...new Set(data.map(item => item.tipologia))].filter(Boolean);
    const filterTipologia = document.getElementById('filterTipologia');
    filterTipologia.innerHTML = '<option value="">Tutti</option>' +
        tipologie.map(t => `<option value="${t}">${t}</option>`).join('');

    // Aggiorna filtro Fornitore
    const fornitori = [...new Set(data.map(item => item.fornitore))].filter(Boolean);
    const filterFornitore = document.getElementById('filterFornitore');
    filterFornitore.innerHTML = '<option value="">Tutti</option>' +
        fornitori.map(f => `<option value="${f}">${f}</option>`).join('');

    // Aggiorna filtro Stanza
    const stanze = [...new Set(data.map(item => item.stanza))].filter(Boolean);
    const filterStanza = document.getElementById('filterStanza');
    filterStanza.innerHTML = '<option value="">Tutte</option>' +
        stanze.map(s => `<option value="${s}">${s}</option>`).join('');

    // Aggiorna filtro Zona
    const zone = [...new Set(data.map(item => item.zona))].filter(Boolean);
    const filterZona = document.getElementById('filterZona');
    filterZona.innerHTML = '<option value="">Tutte</option>' +
        zone.map(z => `<option value="${z}">${z}</option>`).join('');

    // Aggiorna filtro Ripiano
    const ripiani = [...new Set(data.map(item => item.ripiano))].filter(Boolean);
    const filterRipiano = document.getElementById('filterRipiano');
    filterRipiano.innerHTML = '<option value="">Tutti</option>' +
        ripiani.map(r => `<option value="${r}">${r}</option>`).join('');

    // Aggiorna filtro Scatola
    const scatole = [...new Set(data.map(item => item.scatola))].filter(Boolean);
    const filterScatola = document.getElementById('filterScatola');
    filterScatola.innerHTML = '<option value="">Tutte</option>' +
        scatole.map(s => `<option value="${s}">${s}</option>`).join('');
}

// Setup degli event listeners
function setupEventListeners() {
    // Gestione del form di aggiunta/modifica
    document.getElementById('itemForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveItem();
    });

    // Gestione del pulsante Aggiungi Articolo
    document.getElementById('addNewItem').addEventListener('click', function() {
        currentItemId = null;
        document.getElementById('itemForm').reset();
        $('#itemModal').modal('show');
    });

    // Gestione del pulsante Salva nel modal
    document.getElementById('saveItem').addEventListener('click', function() {
        document.getElementById('itemForm').dispatchEvent(new Event('submit'));
    });

    // Gestione dei pulsanti di modifica e eliminazione nella tabella
    $('#inventoryTable').on('click', '.edit-btn', function() {
        if (!editMode) return;
        const data = table.row($(this).closest('tr')).data();
        editItem(data);
    });

    $('#inventoryTable').on('click', '.delete-btn', function() {
        if (!editMode) return;
        const row = $(this).closest('tr');
        const data = table.row(row).data();
        if (data) {
            deleteItem(data);
        }
    });

    // Gestione del pulsante Importa TXT
    document.getElementById('importTxt').addEventListener('click', function() {
        document.getElementById('fileInput').value = ''; // Reset input file
        document.getElementById('previewArea').classList.add('d-none'); // Nascondi area preview
        $('#importModal').modal('show');
    });

    // Gestione dei filtri
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);

    // Gestione della ricerca
    document.getElementById('searchBox').addEventListener('input', function() {
        const searchText = this.value;
        const exactMatch = document.getElementById('exactSearch').checked;
        
        table.search(searchText, exactMatch).draw();
    });

    // Gestione dell'importazione file
    setupFileImport();

    // Disabilita inizialmente il pulsante Aggiungi Articolo
    document.getElementById('addNewItem').disabled = true;
}

// Funzione per salvare un articolo
function saveItem() {
    const form = document.getElementById('itemForm');
    const formData = new FormData(form);
    const item = Object.fromEntries(formData.entries());

    // Validazione
    if (!validateItem(item)) {
        return;
    }

    // Aggiunta data modifica e operatore
    item.dataModifica = new Date().toLocaleDateString('it-IT');
    item.operatore = 'Utente Corrente'; // TODO: Implementare gestione utenti

    // Se alcuni campi sono vuoti, imposta 'N.A.'
    Object.keys(item).forEach(key => {
        if (!item[key] && key !== 'dataModifica' && key !== 'operatore') {
            item[key] = 'N.A.';
        }
    });

    if (currentItemId === null) {
        // Nuovo articolo
        if (!item.dataIngresso) {
            item.dataIngresso = new Date().toLocaleDateString('it-IT');
        }
        
        // Aggiungi l'articolo localmente
        table.row.add(item).draw();
        
        // Invia al server
        fetch('/api/inventory/item', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(item)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Errore nell\'aggiunta dell\'articolo');
            }
            return response.json();
        })
        .then(data => {
            console.log('Articolo aggiunto con successo:', data);
        })
        .catch(error => {
            console.error('Errore nell\'aggiunta dell\'articolo:', error);
            alert('Si è verificato un errore durante il salvataggio dell\'articolo');
        });
    } else {
        // Modifica articolo esistente
        const existingRow = table.row(function(idx, data) {
            return data.codiceArticolo === currentItemId;
        });
        
        if (existingRow.any()) {
            // Mantieni la data di ingresso originale se non modificata
            const oldData = existingRow.data();
            if (!item.dataIngresso) {
                item.dataIngresso = oldData.dataIngresso;
            }
            
            // Aggiorna localmente
            existingRow.data(item).draw();
            
            // Invia al server
            fetch(`/api/inventory/item/${currentItemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(item)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Errore nell\'aggiornamento dell\'articolo');
                }
                return response.json();
            })
            .then(data => {
                console.log('Articolo modificato con successo:', data);
            })
            .catch(error => {
                console.error('Errore nell\'aggiornamento dell\'articolo:', error);
                alert('Si è verificato un errore durante l\'aggiornamento dell\'articolo');
            });
        }
    }

    updateFilters();
    $('#itemModal').modal('hide');
}

// Funzione per validare un articolo
function validateItem(item) {
    // Verifica solo che la quantità sia un numero valido se specificata
    if (item.quantita && item.quantita !== 'N.A.' && (isNaN(item.quantita) || parseInt(item.quantita) < 0)) {
        alert('La quantità deve essere un numero positivo');
        return false;
    }

    return true;
}

// Funzione per modificare un articolo
function editItem(data) {
    currentItemId = data.codiceArticolo;
    const form = document.getElementById('itemForm');
    
    // Popola il form con i dati dell'articolo
    Object.keys(data).forEach(key => {
        const input = form.elements[key];
        if (input && key !== 'dataModifica') { // Non copiare la data di modifica
            input.value = data[key] === 'N.A.' ? '' : data[key];
        }
    });

    $('#itemModal').modal('show');
}

// Funzione per eliminare un articolo
function deleteItem(data) {
    if (confirm('Sei sicuro di voler eliminare questo articolo?')) {
        const codiceArticolo = data.codiceArticolo;
        
        // Rimuovi localmente
        const rowToDelete = table.row(function(idx, rowData) {
            return rowData.codiceArticolo === codiceArticolo;
        });
        
        if (rowToDelete.any()) {
            rowToDelete.remove();
            table.draw();
            
            // Invia al server
            fetch(`/api/inventory/item/${codiceArticolo}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Errore nell\'eliminazione dell\'articolo');
                }
                return response.json();
            })
            .then(data => {
                console.log('Articolo eliminato con successo:', data);
                updateFilters();
            })
            .catch(error => {
                console.error('Errore nell\'eliminazione dell\'articolo:', error);
                alert('Si è verificato un errore durante l\'eliminazione dell\'articolo');
                // Ricarica i dati in caso di errore per mantenere la sincronizzazione
                loadInventoryData();
            });
        }
    }
}

// Funzione per applicare i filtri
function applyFilters() {
    // Reset precedenti filtri
    table.search('').columns().search('').draw();
    
    // Rimuovi eventuali filtri personalizzati precedenti
    $.fn.dataTable.ext.search = [];

    const filters = {
        tipologia: { value: $('#filterTipologia').val(), index: 9 },
        fornitore: { value: $('#filterFornitore').val(), index: 3 },
        stanza: { value: $('#filterStanza').val(), index: 5 },
        zona: { value: $('#filterZona').val(), index: 6 },
        ripiano: { value: $('#filterRipiano').val(), index: 7 },
        scatola: { value: $('#filterScatola').val(), index: 8 }
    };

    // Applica i filtri di testo
    Object.entries(filters).forEach(([key, filter]) => {
        if (filter.value) {
            table.column(filter.index).search(filter.value);
        }
    });

    // Applica il filtro della quantità
    const quantitaMax = $('#filterQuantita').val();
    if (quantitaMax) {
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                const quantita = parseInt(data[4]) || 0; // Indice 4 per la colonna quantità
                const max = parseInt(quantitaMax) || 0;
                return quantita <= max;
            }
        );
    }

    // Applica tutti i filtri
    table.draw();
}

function resetFilters() {
    $('#filterTipologia').val('');
    $('#filterFornitore').val('');
    $('#filterStanza').val('');
    $('#filterZona').val('');
    $('#filterRipiano').val('');
    $('#filterScatola').val('');
    $('#filterQuantita').val('');
    table.search('').columns().search('').draw();
}

// Setup dell'importazione file
function setupFileImport() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    // Gestione drag & drop
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.name.toLowerCase().endsWith('.txt')) {
            fileInput.files = e.dataTransfer.files;
            processFile(file);
        } else {
            alert('Per favore seleziona un file TXT valido');
        }
    });

    // Gestione selezione file tramite pulsante
    document.getElementById('selectFile').addEventListener('click', function(e) {
        e.preventDefault();
        fileInput.click();
    });

    fileInput.addEventListener('change', function(e) {
        const file = this.files[0];
        if (file && file.name.toLowerCase().endsWith('.txt')) {
            processFile(file);
        } else {
            alert('Per favore seleziona un file TXT valido');
            this.value = '';
        }
    });

    // Gestione conferma importazione
    document.getElementById('confirmImport').addEventListener('click', function() {
        const previewTable = document.getElementById('previewTable');
        const headers = Array.from(previewTable.querySelector('thead tr').children)
            .map(th => th.textContent.trim());
        
        console.log('Headers originali:', headers); // Debug

        const rows = Array.from(previewTable.querySelectorAll('tbody tr'))
            .map(row => {
                const cells = Array.from(row.children);
                const item = {};
                
                // Mappa i valori usando i nomi delle colonne corretti
                headers.forEach((header, index) => {
                    const value = cells[index].textContent.trim();
                    // Normalizza l'header rimuovendo caratteri speciali e parentesi
                    const headerNormalized = header.toLowerCase()
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Rimuove accenti
                        .replace(/[:()]/g, '') // Rimuove due punti e parentesi
                        .replace(/\s+/g, ' ') // Normalizza spazi
                        .trim();
                    
                    console.log(`Mappatura - Header originale: "${header}", Normalizzato: "${headerNormalized}", Valore: "${value}"`); // Debug
                    
                    // Mappa le intestazioni ai campi corretti
                    const mappings = {
                        'codice articolo': 'codiceArticolo',
                        'oggetto': 'oggetto',
                        'descrizione': 'descrizione',
                        'fornitore': 'fornitore',
                        'quantita totale pz': 'quantita',
                        'quantita totale': 'quantita',
                        'quantita': 'quantita',
                        'quantit totale pz': 'quantita',
                        'quantit totale': 'quantita',
                        'quantit': 'quantita',
                        'stanza': 'stanza',
                        'zona': 'zona',
                        'ripiano': 'ripiano',
                        'scatola n': 'scatola',
                        'scatola': 'scatola',
                        'tipologia': 'tipologia',
                        'data in ingresso': 'dataIngresso',
                        'data ingresso': 'dataIngresso',
                        'data ultima modifica': 'dataModifica',
                        'data modifica': 'dataModifica',
                        'operatore': 'operatore'
                    };

                    // Cerca una corrispondenza nelle mappature
                    const fieldName = mappings[headerNormalized] || 
                                    (headerNormalized.includes('quantit') ? 'quantita' : null);

                    if (fieldName) {
                        // Imposta 'N.A.' se il valore è vuoto
                        item[fieldName] = value || 'N.A.';
                        console.log(`Campo mappato: ${fieldName} = ${item[fieldName]}`); // Debug
                    } else {
                        console.log(`ATTENZIONE: Intestazione non riconosciuta: ${headerNormalized}`); // Debug
                    }
                });

                // Imposta valori di default per i campi mancanti
                const defaultFields = {
                    'codiceArticolo': `ITEM_${new Date().getTime()}`,
                    'oggetto': 'N.A.',
                    'descrizione': 'N.A.',
                    'fornitore': 'N.A.',
                    'quantita': 'N.A.',
                    'stanza': 'N.A.',
                    'zona': 'N.A.',
                    'ripiano': 'N.A.',
                    'scatola': 'N.A.',
                    'tipologia': 'N.A.',
                    'dataIngresso': new Date().toLocaleDateString('it-IT'),
                    'dataModifica': new Date().toLocaleDateString('it-IT'),
                    'operatore': 'Utente Corrente'
                };

                // Applica i valori di default per i campi mancanti
                Object.keys(defaultFields).forEach(field => {
                    if (!item[field]) {
                        item[field] = defaultFields[field];
                    }
                });

                console.log('Item completo:', item); // Debug
                return item;
            });

        // Verifica doppioni
        const existingData = table.data().toArray();
        const newRows = rows.filter(newItem => {
            // Considera una riga come doppione se ha lo stesso oggetto, stanza, zona e ripiano
            return !existingData.some(existingItem => 
                existingItem.oggetto === newItem.oggetto &&
                existingItem.stanza === newItem.stanza &&
                existingItem.zona === newItem.zona &&
                existingItem.ripiano === newItem.ripiano
            );
        });

        if (newRows.length === 0) {
            alert('Tutte le righe sono già presenti nel database.');
            return;
        }

        if (newRows.length < rows.length) {
            const skipped = rows.length - newRows.length;
            if (!confirm(`${skipped} righe verranno saltate perché già presenti nel database. Vuoi continuare con l'importazione di ${newRows.length} nuove righe?`)) {
                return;
            }
        }

        // Aggiungi solo le righe nuove alla tabella principale
        table.rows.add(newRows).draw();
        saveInventoryData();
        updateFilters();
        
        // Invia i dati al server per generare il report JSON
        saveJsonReport(newRows);

        $('#importModal').modal('hide');
    });
}

// Funzione per processare il file importato
function processFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n');
        
        // Pulisci le intestazioni mantenendo i caratteri originali per la visualizzazione
        const headers = lines[0].split('\t')
            .map(h => h.trim());

        console.log('Headers dal file:', headers); // Debug

        // Crea la tabella di anteprima
        const previewTable = document.getElementById('previewTable');
        previewTable.innerHTML = '';

        // Intestazioni
        const thead = document.createElement('thead');
        thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
        previewTable.appendChild(thead);

        // Dati
        const tbody = document.createElement('tbody');
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const cells = lines[i].split('\t');
            const tr = document.createElement('tr');
            
            for (let j = 0; j < headers.length; j++) {
                const td = document.createElement('td');
                td.textContent = (cells[j] || '').trim() || 
                    (document.getElementById('replaceEmpty').checked ? 'N.A.' : '');
                tr.appendChild(td);
            }
            
            tbody.appendChild(tr);
        }
        previewTable.appendChild(tbody);

        // Mostra l'area di anteprima
        document.getElementById('previewArea').classList.remove('d-none');
    };

    reader.readAsText(file);
} 

// Funzione per salvare il report JSON
function saveJsonReport(items) {
    // Prepara i dati con informazioni aggiuntive
    const reportData = {
        timestamp: new Date().toISOString(),
        totalItems: items.length,
        filename: `inventory_import_${new Date().toLocaleDateString('it-IT').replace(/\//g, '-')}.json`,
        items: items
    };
    
    // Invia i dati al server
    fetch('/api/save-report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Errore durante il salvataggio del report');
        }
        return response.json();
    })
    .then(data => {
        console.log('Report salvato con successo:', data);
        // Mostra una notifica di successo
        const alertDiv = document.createElement('div');
        alertDiv.classList.add('alert', 'alert-success', 'alert-dismissible', 'fade', 'show', 'position-fixed', 'top-0', 'end-0', 'm-3');
        alertDiv.setAttribute('role', 'alert');
        alertDiv.innerHTML = `
            <strong>Report Salvato!</strong> Il file JSON è stato salvato nella cartella reports.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        document.body.appendChild(alertDiv);
        
        // Rimuovi l'alert dopo 5 secondi
        setTimeout(() => {
            alertDiv.classList.remove('show');
            setTimeout(() => alertDiv.remove(), 150);
        }, 5000);
        
        // Ricarica i dati per sincronizzare con il server
        loadInventoryData();
    })
    .catch(error => {
        console.error('Errore:', error);
        alert('Si è verificato un errore durante il salvataggio del report JSON');
    });
}
