// Main application JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const elements = {
        searchInput: document.getElementById('search-input'),
        searchButton: document.getElementById('search-button'),
        resultsSectionAccordion: document.getElementById('results-section-accordion'),
        searchAccordion: document.getElementById('search-accordion'),
        resultsHeading: document.getElementById('results-heading'),
        resultsTable: document.getElementById('results-table'),
        resultsTableBody: document.getElementById('results-table-body'),
        searchLoading: document.getElementById('search-loading'),
        statusLoading: document.getElementById('status-loading'),
        statusTable: document.getElementById('status-table'),
        statusTableBody: document.getElementById('status-table-body'),
        modalOverlay: document.getElementById('modal-overlay'),
        detailsContainer: document.getElementById('details-container')
    };

    // State
    let currentBookDetails = null;
    const STATE = {
        isSearching: false,
        isLoadingDetails: false
    };

    // Constants
    const REFRESH_INTERVAL = 60000; // 60 seconds
    const API_ENDPOINTS = {
        search: '/api/search',
        info: '/api/info',
        download: '/api/download',
        status: '/api/status'
    };

    // Utility Functions
    const utils = {
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        showLoading(element) {
            element.removeAttribute('hidden');
        },

        hideLoading(element) {
            element.setAttribute('hidden', '');
        },

        showAccordion(element) {
            UIkit.accordion(element).toggle(1, true);
        },

        async fetchJson(url, options = {}) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Fetch error:', error);
                throw error;
            }
        },

        createElement(tag, attributes = {}, children = []) {
            const element = document.createElement(tag);
            Object.entries(attributes).forEach(([key, value]) => {
                element[key] = value;
            });
        
            // Ensure children is an array
            const childArray = Array.isArray(children) ? children : [children];
        
            childArray.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else {
                    element.appendChild(child);
                }
            });
        
            return element;
        }
    };

    // Search Functions
    const search = {
        async performSearch(query) {
            if (STATE.isSearching) return;
        
            try {
                STATE.isSearching = true;
                utils.showLoading(elements.searchLoading);
        
                // Ensure results section is displayed
                if (elements.resultsSectionAccordion) {
                    elements.resultsSectionAccordion.hidden = false;
                }
        
                // Fetch search results
                const data = await utils.fetchJson(
                    `${API_ENDPOINTS.search}?query=${encodeURIComponent(query)}`
                );
        
                // Display results
                if (elements.resultsTableBody) {
                    this.displayResults(data);
                } else {
                    console.error('Error: resultsTableBody element is missing in the DOM.');
                }
            } catch (error) {
                console.error('Search error:', error);
                this.handleSearchError(error);
            } finally {
                STATE.isSearching = false;
                utils.hideLoading(elements.searchLoading);
            }
        },
    
        displayResults(books) {
            // Clear table and card containers
            elements.resultsTableBody.innerHTML = '';
            const cardContainer = document.getElementById('results-card-container');
            cardContainer.innerHTML = '';
        
            if (!books.length) {
                this.displayNoResults();
                return;
            }
        
            books.forEach((book, index) => {
                // Add to table for larger screens
                const row = this.createBookRow(book, index);
                elements.resultsTableBody.appendChild(row);
        
                // Add to card container for mobile
                const card = this.createBookCard(book, index);
                cardContainer.appendChild(card);
            });
        },
        
        displayNoResults() {
            // Handle empty state for both table and cards
            elements.resultsTableBody.innerHTML = '';
            const cardContainer = document.getElementById('results-card-container');
            cardContainer.innerHTML = '';
        
            const tableRow = utils.createElement('tr', {}, [
                utils.createElement('td', {
                    colSpan: '10',
                    textContent: 'No results found.'
                }),
            ]);
            elements.resultsTableBody.appendChild(tableRow);
        
            const card = utils.createElement('div', {
                className: 'bg-white shadow rounded-md p-4 mb-4 text-center text-gray-600'
            }, 'No results found.');
            cardContainer.appendChild(card);
        },
        
        createBookRow(book, index) {
            // Table row for larger screens
            return utils.createElement('tr', {}, [
                utils.createElement('td', { textContent: index + 1 }),
                this.createPreviewCell(book.preview),
                utils.createElement('td', { textContent: book.title || 'N/A' }),
                utils.createElement('td', { textContent: book.author || 'N/A' }),
                utils.createElement('td', { textContent: book.publisher || 'N/A' }),
                utils.createElement('td', { textContent: book.year || 'N/A' }),
                this.createActionCell(book)
            ]);
        },
        
        createBookCard(book, index) {
            // Card for mobile-friendly display
            return utils.createElement('div', {
                className: 'bg-white shadow rounded-md p-4 mb-4'
            }, [
                utils.createElement('div', { className: 'flex items-start gap-4' }, [
                    book.preview
                        ? utils.createElement('img', {
                              src: book.preview,
                              alt: 'Book Preview',
                              className: 'w-16 h-24 object-cover rounded'
                          })
                        : utils.createElement('div', { className: 'w-16 h-24 bg-gray-200 rounded' }),
                    utils.createElement('div', {}, [
                        utils.createElement('h3', { className: 'font-bold text-lg' }, book.title || 'N/A'),
                        utils.createElement('p', { className: 'text-gray-600' }, `Author: ${book.author || 'N/A'}`),
                        utils.createElement('p', { className: 'text-gray-600' }, `Publisher: ${book.publisher || 'N/A'}`),
                        utils.createElement('p', { className: 'text-gray-600' }, `Year: ${book.year || 'N/A'}`)
                    ])
                ]),
                utils.createElement('div', { className: 'mt-4 flex gap-2' }, [
                    utils.createElement('button', {
                        className: 'bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700',
                        onclick: () => bookDetails.show(book.id)
                    }, 'Details'),
                    utils.createElement('button', {
                        className: 'bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700',
                        onclick: () => bookDetails.downloadBook(book)
                    }, 'Download')
                ])
            ]);
        },
        
        createPreviewCell(previewUrl) {
            if (!previewUrl) {
                return utils.createElement('td', { textContent: 'N/A' });
            }
        
            const img = utils.createElement('img', {
                src: previewUrl,
                alt: 'Book Preview',
                style: 'max-width: 60px;'
            });
        
            return utils.createElement('td', {}, [img]);
        },
        
        createActionCell(book) {
            const buttonDetails = utils.createElement('button', {
                className: 'bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700',
                onclick: () => bookDetails.show(book.id)
            }, 'Details');
        
            const downloadButton = utils.createElement('button', {
                className: 'bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700',
                onclick: () => bookDetails.downloadBook(book)
            }, 'Download');
        
            return utils.createElement('td', {}, [buttonDetails, downloadButton]);
        },

        handleSearchError(error) {
            console.error('Search error:', error);
        
            if (elements.resultsTableBody) {
                elements.resultsTableBody.innerHTML = '';
                const errorRow = utils.createElement('tr', {}, [
                    utils.createElement('td', {
                        colSpan: '10',
                        textContent: 'An error occurred while searching. Please try again.'
                    })
                ]);
                elements.resultsTableBody.appendChild(errorRow);
            } else {
                console.error('Error: resultsTableBody element is missing in the DOM.');
            }
        }
    };

    // Book Details Functions
    const bookDetails = {
        async show(bookId) {
            if (STATE.isLoadingDetails) return;
    
            try {
                STATE.isLoadingDetails = true;
    
                if (modal.open) {
                    modal.open();
                }
    
                if (elements.detailsContainer) {
                    elements.detailsContainer.innerHTML = '<p>Loading details...</p>';
                }
    
                const book = await utils.fetchJson(
                    `${API_ENDPOINTS.info}?id=${encodeURIComponent(bookId)}`
                );
    
                currentBookDetails = book;
                this.displayDetails(book);
            } catch (error) {
                console.error('Details error:', error);
                this.handleDetailsError(error);
            } finally {
                STATE.isLoadingDetails = false;
            }
        },

        displayDetails(book) {
            elements.detailsContainer.innerHTML = this.generateDetailsHTML(book);
            
            // Add event listeners
            document.getElementById('download-button')
                .addEventListener('click', () => this.downloadBook(book));
            document.getElementById('close-details')
                .addEventListener('click', modal.close);
        },

        generateDetailsHTML(book) {
            return `
                <div class="bg-white rounded-lg shadow-md p-6 space-y-4">
                    <div>
                        <h3 class="text-xl font-bold text-gray-800">${book.title || 'No title available'}</h3>
                        <p class="text-gray-600"><strong>Author:</strong> ${book.author || 'N/A'}</p>
                        <p class="text-gray-600"><strong>Publisher:</strong> ${book.publisher || 'N/A'}</p>
                        <p class="text-gray-600"><strong>Year:</strong> ${book.year || 'N/A'}</p>
                        <p class="text-gray-600"><strong>Language:</strong> ${book.language || 'N/A'}</p>
                        <p class="text-gray-600"><strong>Format:</strong> ${book.format || 'N/A'}</p>
                        <p class="text-gray-600"><strong>Size:</strong> ${book.size || 'N/A'}</p>
                    </div>
        
                    <div class="flex space-x-4">
                        <button id="download-button" 
                                class="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 focus:ring focus:ring-blue-300">
                            Download
                        </button>
                        <button id="close-details" 
                                class="bg-gray-600 text-white px-4 py-2 rounded-md shadow hover:bg-gray-700 focus:ring focus:ring-gray-300">
                            Close
                        </button>
                    </div>
        
                    <div class="border-t pt-4">
                        <h4 class="text-lg font-semibold text-gray-700">Further Information</h4>
                        <div class="text-gray-600">
                            ${this.generateInfoList(book.info)}
                        </div>
                    </div>
                </div>
            `;
        },

        generateInfoList(info) {
            if (!info) return '';

            const listItems = Object.entries(info)
                .map(([key, values]) => `
                    <li><strong>${key}:</strong> ${values.join(', ')}</li>
                `)
                .join('');

            return `<ul class="uk-list uk-list-bullet">${listItems}</ul>`;
        },

        async downloadBook(book) {
            if (!book) return;

            try {
                utils.showLoading(elements.searchLoading);
                await utils.fetchJson(
                    `${API_ENDPOINTS.download}?id=${encodeURIComponent(book.id)}`
                );
                
                modal.close();
                status.fetch();
            } catch (error) {
                console.error('Download error:', error);
            } finally {
                utils.hideLoading(elements.searchLoading);
            }
        },

        handleDetailsError(error) {
            console.error('Details error:', error);
            elements.detailsContainer.innerHTML = `
                <p>Error loading details. Please try again.</p>
                <div class="details-actions">
                    <button id="close-details" onclick="modal.close()">Close</button>
                </div>
            `;
            document.getElementById('close-details')
                .addEventListener('click', modal.close);
        }
    };

    // Status Functions
    const status = {
        async fetch() {
            try {
                utils.showLoading(elements.statusLoading);
                const data = await utils.fetchJson(API_ENDPOINTS.status);
                this.display(data);
            } catch (error) {
                this.handleError(error);
            } finally {
                utils.hideLoading(elements.statusLoading);
            }
        },

        display(data) {
            elements.statusTableBody.innerHTML = '';
            
            // Handle each status type
            Object.entries(data).forEach(([status, booksInStatus]) => {
                // If the status section has books
                if (Object.keys(booksInStatus).length > 0) {
                    // For each book in this status
                    Object.entries(booksInStatus).forEach(([bookId, bookData]) => {
                        this.addStatusRow(status, bookData);
                    });
                }
            });
        },

        addStatusRow(status, book) {
            if (!book.id || !book.title) return;

            const statusCell = utils.createElement('td', {
                className: `status-${status.toLowerCase()}`,
                textContent: status
            });

            let titleElement;
            if (status.toLowerCase().includes('available')) {
                titleElement = utils.createElement('a', {
                    href: `/api/localdownload?id=${book.id}`,
                    target: '_blank',
                    textContent: book.title || 'N/A'
                });
            }
            else {
                titleElement = utils.createElement('td', { textContent: book.title || 'N/A' })
            }

            const row = utils.createElement('tr', {}, [
                statusCell,
                utils.createElement('td', { textContent: book.id }),
                titleElement,
                this.createPreviewCell(book.preview)
            ]);

            elements.statusTableBody.appendChild(row);
        },

        createPreviewCell(previewUrl) {
            const cell = utils.createElement('td');
            
            if (previewUrl) {
                const img = utils.createElement('img', {
                    src: previewUrl,
                    alt: 'Book Preview',
                    style: 'max-width: 60px; height: auto;'
                });
                cell.appendChild(img);
            } else {
                cell.textContent = 'N/A';
            }
            
            return cell;
        },

        handleError(error) {
            console.error('Status error:', error);
        
            if (elements.statusTableBody) {
                elements.statusTableBody.innerHTML = '';
                const errorRow = utils.createElement('tr', {}, [
                    utils.createElement('td', {
                        colSpan: '4',
                        textContent: 'Error loading status. Will retry automatically.'
                    })
                ]);
                elements.statusTableBody.appendChild(errorRow);
            } else {
                console.error('Error: statusTableBody element is missing in the DOM.');
            }
        }
    };

    // Modal Functions
    const modal = {
        open() {
            if (elements.modalOverlay) {
                elements.modalOverlay.classList.remove('hidden');
            } else {
                console.error('Error: modalOverlay element is missing in the DOM.');
            }
        },
        close() {
            if (elements.modalOverlay) {
                elements.modalOverlay.classList.add('hidden');
            } else {
                console.error('Error: modalOverlay element is missing in the DOM.');
            }
    
            if (elements.detailsContainer) {
                elements.detailsContainer.innerHTML = ''; // Clear content when closed
            } else {
                console.error('Error: detailsContainer element is missing in the DOM.');
            }
        }
    };

    // Event Listeners
    function setupEventListeners() {
        // Search events
        elements.searchButton.addEventListener('click', () => {
            const query = elements.searchInput.value.trim();
            if (query) search.performSearch(query);
        });

        elements.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = elements.searchInput.value.trim();
                if (query) search.performSearch(query);
            }
        });

        // Modal close on overlay click
        elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === elements.modalOverlay) {
                modal.close();
            }
        });

        // Keyboard accessibility
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && elements.modalOverlay.classList.contains('active')) {
                modal.close();
            }
        });
    }

    // Initialize
    function init() {
        setupEventListeners();
        status.fetch();
        setInterval(() => status.fetch(), REFRESH_INTERVAL);
    }

    init();
});